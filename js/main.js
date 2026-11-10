import { state as I18N, T, L, fmt, setLang, S, t } from './i18n.js';
import { audio } from './audio.js';
import { makeParts } from './parts.js';
import { CAR_CFG } from './cars.js';
import { SCEN as SCEN_KOLEOS, SRC as SRC_K } from './scen_koleos.js';
import { SCEN as SCEN_GOLF, SRC as SRC_G } from './scen_golf.js';
import { SCEN as SCEN_OCT, SRC as SRC_O } from './scen_octavia.js';
import { SCEN as SCEN_MATIZ, SRC as SRC_M } from './scen_matiz.js';
import { createScene } from './scene3d.js';
import { LESSONS } from './lesson.js';
const SRC_LINKS = Object.assign({}, SRC_K, SRC_G, SRC_O, SRC_M);

/* ================= MAȘINI ================= */
const CARS = [
  { id: 'koleos', name: 'Renault Koleos', sub: T('2009 · 2.0 dCi (M9R) · 150 CP · 4x4 · manuală', '2009 · 2.0 dCi (M9R) · 150 hp · 4x4 · manual'), scen: SCEN_KOLEOS, ready: true },
  { id: 'golf4', name: 'VW Golf 4', sub: T('2000–2004 · 1.9 TDI (ALH) · 90 CP · manuală', '2000–2004 · 1.9 TDI (ALH) · 90 hp · manual'), scen: SCEN_GOLF, ready: true },
  { id: 'octavia', name: 'Škoda Octavia II', sub: T('2008 · 1.6 MPI (BSE) · 102 CP · benzină', '2008 · 1.6 MPI (BSE) · 102 hp · petrol'), scen: SCEN_OCT, ready: true },
  { id: 'matiz', name: 'Daewoo Matiz', sub: T('2005 · 0.8 (F8CV) · 3 cilindri · benzină', '2005 · 0.8 (F8CV) · 3 cylinders · petrol'), scen: SCEN_MATIZ, ready: true }
];
CARS.forEach(c => c.cfg = CAR_CFG[c.id]);
export function registerScenarios(id, list, src) { const c = CARS.find(x => x.id === id); c.scen = list; c.ready = list.length > 0; Object.assign(SRC_LINKS, src || {}); }
let PARTS = null, sc = null;
function useCar(car) { if (!car.world) { car.PARTS = makeParts(car.cfg); car.world = createScene($('#c3d'), car.PARTS, car.cfg); car.world.build(); } PARTS = car.PARTS; sc = car.world; sc.resize(); }

/* ================= SIMULATOR ELECTRIC ================= */
const sim = {
  reset(c) { Object.assign(this, { ambient: c.ambient ?? 15, engT: c.engT ?? 15, soc: c.soc ?? 0.9, health: c.health ?? 0.95, faults: new Set(c.faults || []), running: false, booster: false, last: null }); },
  restV() { const s = Math.max(0, Math.min(1, this.soc)); return s < 0.1 ? 10.0 + (11.84 - 10.0) * s / 0.1 : 11.75 + 0.9 * s; },
  drop() { const coldF = 1 + Math.max(0, 5 - this.engT) * 0.025; const socF = 1 + (1 - Math.max(0, this.soc)) * 0.6; return 2.2 * (1 + (1 - this.health)) * coldF * socF; },
  runV() { return this.faults.has('alternator') ? 12.35 - (1 - this.soc) * 0.35 : (this.engT < 30 ? 14.35 : 14.1); },
  idleRpm() { return this.engT < 40 ? 950 : 800; },
  obdPowered() { return this.running || this.booster || this.restV() >= 10.8; },
  hot() { return this.engT > 60; },
  electric() { // rezultat electric la răsucirea cheii
    const rest = this.restV(); let r;
    if (this.faults.has('solenoid') && this.engT > 55) r = { kind: 'click', vmin: rest - 0.12, vS: rest - 0.45, vOut: 0, gnd: 0 };
    else if (rest < 10.8 && !this.booster) r = { kind: 'dead', vmin: rest - 0.3, vS: rest - 0.6, vOut: 0, gnd: 0 };
    else if (this.faults.has('starterMotor') && Math.random() < 0.6) r = { kind: 'click', vmin: rest - 0.1, vS: rest - 0.4, vOut: rest - 0.3, gnd: 0 };
    else { let vc = rest - this.drop() - (this.faults.has('ground') ? 2.1 : 0); if (this.booster) vc = Math.max(vc, 10.4); const thr = this.engT < 0 ? 9.0 : 8.5;
      if (vc < 7.5) r = { kind: 'chatter', vmin: Math.max(4.8, vc), vS: null, vOut: null, gnd: 0.1 };
      else if (vc < thr) r = { kind: 'slow', vmin: vc, vS: vc - 0.2, vOut: vc - 0.35, gnd: 0.16 };
      else r = { kind: 'start', vmin: vc, vS: vc - 0.2, vOut: vc - 0.35, gnd: 0.15 };
      if (this.faults.has('ground') && r.kind !== 'chatter') { r.gnd = 1.6; r.vmin = rest - this.drop() * 0.7; } }
    return r;
  },
  attempt(scn, fixed) {
    if (this.running) return null; let r = this.electric();
    if (r.kind === 'start' && scn && scn.start && !fixed) { const k = typeof scn.start === 'string' ? scn.start : (this.hot() ? scn.start.hot : scn.start.cold); if (k && k !== 'start') r = Object.assign({}, r, { kind: k }); }
    if (r.kind === 'start' && scn && !fixed && scn.coldMiss && !this.hot()) r.kind = 'startLong';
    if (['start', 'startLong', 'startRough'].includes(r.kind)) { this.soc = Math.max(0, this.soc - 0.02); this.running = true; }
    else if (['slow', 'chatter', 'crankNoStart'].includes(r.kind)) this.soc = Math.max(0, this.soc - (r.kind === 'crankNoStart' ? 0.03 : 0.06));
    this.last = r; return r;
  }
};

/* ================= UI COMUNĂ ================= */
const $ = s => document.querySelector(s);
function h(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else if (k === 'html') e.innerHTML = v; else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); } for (const k of kids.flat()) { if (k == null || k === false) continue; e.append(k.nodeType ? k : document.createTextNode(String(k))); } return e; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const G = { screen: 'menu', car: null, scn: null, idx: -1, score: 100, hintsUsed: 0, wrong: 0, repair: null, meterOpen: false, lesson: null, busy: false, best: {}, seen: new Set(), fixed: false, sysFilter: 'all', nudges: true, crankAnim: 0, sawHotClick: false, freeStack: [], freeMode: false };
try { G.best = JSON.parse(localStorage.getItem('ma_best') || '{}'); } catch (e) {}
try { G.nudges = localStorage.getItem('ma_nudges') !== '0'; } catch (e) {}

function show(id) { G.screen = id; document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); if (id === 'garage' && sc) sc.resize(); if (id === 'road') resizeRoad(); updateTop(); }
function updateTop() {
  $('#brand').textContent = t('brand'); $('#btnMenu').textContent = t('menu'); $('#btnLang').textContent = I18N.lang === 'ro' ? 'EN' : 'RO'; $('#btnSound').textContent = audio.on ? '🔊' : '🔇';
  $('#lvlName').textContent = G.lesson ? L(G.lesson.def.title) : (G.scn && G.screen !== 'menu' ? `${G.car.name} · ${L(G.scn.title)}` : '');
  $('#scoreBox').textContent = (G.scn && G.screen !== 'menu' && !G.lesson) ? `${t('score')}: ${G.score}` : '';
}
document.addEventListener('pointerdown', () => { audio.init(); if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume(); }, { capture: true });
$('#btnSound').onclick = () => { audio.init(); audio.setOn(!audio.on); updateTop(); };
$('#btnLang').onclick = () => { setLang(I18N.lang === 'ro' ? 'en' : 'ro'); refreshAll(); };
$('#btnMenu').onclick = () => goMenu();
function refreshAll() { updateTop(); if (G.screen === 'menu') renderMenu(); if (G.screen === 'garage') { if (G.lesson) renderLesson(); else renderTools(); renderViewbar(); } if (G.screen === 'road' && road.lastSay) $('#storyTxt').textContent = L(road.lastSay); }
function modal(build) { const box = $('#modalBox'); box.innerHTML = ''; build(box); $('#modal').classList.add('on'); }
function closeModal() { $('#modal').classList.remove('on'); }

/* ================= MENIU ================= */
function goMenu() { closeModal(); G.freeStack = []; renderWarn(); audio.stopIdle(); road.token++; G.scn = null; G.lesson = null; G.repair = null; $('#lesson').style.display = 'none'; $('#tools').style.display = ''; if (sc) sc.setFocus(null); renderMenu(); show('menu'); }
const SYS = ['electric', 'fuel', 'air', 'exhaust', 'cooling', 'engine', 'driveline', 'chassis'];
function renderMenu() {
  const w = $('#menuWrap'); w.innerHTML = '';
  if (!G.car) {
    w.append(h('h1', {}, t('brand')), h('p', { class: 'sub' }, t('menuSub')));
    const grid = h('div', { class: 'cars' });
    CARS.forEach(c => grid.append(h('div', { class: 'card car' + (c.ready ? '' : ' off') }, h('h3', {}, c.name), h('p', {}, L(c.sub)),
      c.ready ? h('div', {}, h('span', { class: 'tag' }, `${c.scen.length} ${t('scenarios')}`), h('button', { class: 'primary', style: 'margin-top:10px;display:block', on: { click: () => { G.car = c; G.sysFilter = 'all'; renderMenu(); } } }, t('play'))) : h('span', { class: 'tag' }, t('soon')))));
    w.append(grid);
    w.append(h('h4', { class: 'sec' }, t('lessons')));
    LESSONS.forEach(ls => w.append(h('div', { class: 'card' }, h('h3', {}, L(ls.title)), h('p', {}, L(ls.desc)), h('button', { class: 'primary', on: { click: () => startLesson(ls.id) } }, t('start')))));
    w.append(h('p', { class: 'sub', style: 'font-size:13px' }, t('note') + ' ' + t('sfx')));
    return;
  }
  const car = G.car;
  w.append(h('button', { class: 'small', style: 'margin-bottom:12px', on: { click: () => { G.car = null; renderMenu(); } } }, '← ' + t('back')));
  w.append(h('h1', {}, car.name), h('p', { class: 'sub' }, L(car.sub)));
  const used = SYS.filter(s => car.scen.some(x => x.sys === s));
  const fbar = h('div', { class: 'filters' }, h('button', { class: 'small' + (G.sysFilter === 'all' ? ' primary' : ''), on: { click: () => { G.sysFilter = 'all'; renderMenu(); } } }, t('filterAll')),
    ...used.map(s => h('button', { class: 'small' + (G.sysFilter === s ? ' primary' : ''), on: { click: () => { G.sysFilter = s; renderMenu(); } } }, t('sys_' + s))));
  w.append(fbar, h('button', { style: 'margin:0 0 14px', on: { click: () => { const list = car.scen.filter(x => G.sysFilter === 'all' || x.sys === G.sysFilter); startScenario(car.scen.indexOf(list[Math.floor(Math.random() * list.length)])); } } }, t('random')));
  car.scen.forEach((s, i) => { if (G.sysFilter !== 'all' && s.sys !== G.sysFilter) return; const b = G.best[s.id];
    w.append(h('div', { class: 'card' }, h('h3', {}, `${i + 1}. ${L(s.title)}`, s.user ? h('span', { class: 'tag you' }, I18N.lang === 'ro' ? 'cazul tău' : 'your case') : null), h('p', {}, L(s.blurb)),
      h('div', {}, h('span', { class: 'tag' }, t('sys_' + s.sys)), h('span', { class: 'tag' }, '★'.repeat(s.diff) + '☆'.repeat(3 - s.diff)), h('span', { class: 'tag' }, s.conf), b != null ? h('span', { class: 'tag' }, `${t('best')}: ${b}`) : null),
      h('div', { style: 'margin-top:10px;display:flex;gap:8px;flex-wrap:wrap' }, h('button', { class: 'primary', on: { click: () => startScenario(i) } }, t('play')), h('button', { class: 'small', on: { click: () => startScenario(i, true) } }, t('debugGarage'))))); });
}

/* ================= DRUM (2D) ================= */
const road = { x: 0, speed: 0, target: 0, snow: false, sky: 'day', station: false, rpm: 0, token: 0, lastSay: null, flakes: [], puffs: [], smoke: null };
const rc = $('#roadCanvas'), rx = rc.getContext('2d');
function resizeRoad() { const r = rc.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); rc.width = Math.max(1, r.width * dpr); rc.height = Math.max(1, r.height * dpr); rx.setTransform(dpr, 0, 0, dpr, 0, 0); }
function drawRoad(dt) {
  const W = rc.clientWidth, H = rc.clientHeight; if (!W) return;
  road.speed += (road.target - road.speed) * Math.min(1, dt * 0.9); road.x += road.speed * dt * 4;
  const skies = { cold: ['#8ea6bd', '#dfe7ee'], dusk: ['#2b3550', '#c9866a'], day: ['#6fa6d6', '#d6e8f5'] }; const sk = skies[road.sky] || skies.day;
  const g = rx.createLinearGradient(0, 0, 0, H * 0.7); g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]); rx.fillStyle = g; rx.fillRect(0, 0, W, H);
  const hz = H * 0.62;
  rx.fillStyle = road.sky === 'dusk' ? '#3a3b4f' : '#7d8fa3'; rx.beginPath(); rx.moveTo(0, hz); for (let i = 0; i <= W + 80; i += 40) { const xx = i - ((road.x * 0.08) % 80); rx.lineTo(xx, hz - 40 - 30 * Math.abs(Math.sin((i + Math.floor(road.x * 0.08 / 80) * 80) * 0.013))); } rx.lineTo(W, hz); rx.closePath(); rx.fill();
  rx.fillStyle = road.snow ? '#e9eef2' : (road.sky === 'dusk' ? '#3b4a35' : '#6f9a5a'); rx.fillRect(0, hz, W, H - hz);
  const ry = H * 0.72, rh = H * 0.14; rx.fillStyle = '#3c4046'; rx.fillRect(0, ry, W, rh);
  rx.fillStyle = '#e8e8e0'; const off = road.x % 110; for (let xx = -off; xx < W; xx += 110) rx.fillRect(xx, ry + rh / 2 - 2, 60, 4);
  rx.fillStyle = '#5b4a3a'; const poff = road.x % 260; for (let xx = -poff; xx < W + 260; xx += 260) { rx.fillRect(xx, hz - 70, 5, 70 + (ry - hz) - 4); rx.fillRect(xx - 14, hz - 66, 33, 4); }
  if (road.station) { const sx = W * 0.68; rx.fillStyle = '#d9dde2'; rx.fillRect(sx - 30, hz - 120, 240, 14); rx.fillStyle = '#8a929c'; rx.fillRect(sx - 20, hz - 106, 8, 106 + (ry - hz) - 8); rx.fillRect(sx + 180, hz - 106, 8, 106 + (ry - hz) - 8); rx.fillStyle = '#2f7d5b'; rx.fillRect(sx + 70, hz - 30, 26, 30 + (ry - hz) - 14); rx.fillStyle = '#fff'; rx.font = 'bold 12px system-ui'; rx.fillText(I18N.lang === 'ro' ? 'BENZINĂRIE' : 'FUEL', sx + 40, hz - 109); }
  const cx = W * 0.36, cy = ry + rh * 0.42; const bounce = road.rpm > 0 ? Math.sin(performance.now() * 0.05) * 0.6 : 0;
  rx.save(); rx.translate(cx, cy + bounce);
  rx.fillStyle = '#23272d'; rx.beginPath(); rx.moveTo(-120, -10); rx.lineTo(-118, -48); rx.lineTo(-70, -52); rx.lineTo(-48, -86); rx.lineTo(48, -86); rx.lineTo(78, -54); rx.lineTo(118, -46); rx.lineTo(124, -12); rx.closePath(); rx.fill();
  rx.fillStyle = '#9fb4c8'; rx.beginPath(); rx.moveTo(-60, -54); rx.lineTo(-42, -80); rx.lineTo(-4, -80); rx.lineTo(-4, -54); rx.closePath(); rx.fill(); rx.beginPath(); rx.moveTo(2, -54); rx.lineTo(2, -80); rx.lineTo(44, -80); rx.lineTo(66, -54); rx.closePath(); rx.fill();
  rx.fillStyle = '#f3e3a0'; rx.fillRect(112, -42, 10, 8); rx.fillStyle = '#b33'; rx.fillRect(-121, -44, 6, 10);
  [-72, 74].forEach(wx => { rx.save(); rx.translate(wx, -8); rx.fillStyle = '#111'; rx.beginPath(); rx.arc(0, 0, 22, 0, Math.PI * 2); rx.fill(); rx.fillStyle = '#8c939b'; rx.beginPath(); rx.arc(0, 0, 11, 0, Math.PI * 2); rx.fill(); rx.rotate(road.x / 22); rx.strokeStyle = '#444'; rx.lineWidth = 3; for (let k = 0; k < 5; k++) { rx.rotate(Math.PI * 2 / 5); rx.beginPath(); rx.moveTo(0, 0); rx.lineTo(10, 0); rx.stroke(); } rx.restore(); });
  rx.restore();
  const rate = road.smoke ? 22 : 8; if (road.rpm > 0 && Math.random() < dt * rate) road.puffs.push({ x: cx - 122, y: cy - 10, r: road.smoke ? 5 : 3, a: road.smoke ? 0.75 : 0.45, c: road.smoke || 'light' });
  road.puffs.forEach(p => { p.x -= (20 + road.speed * 3) * dt; p.y -= 6 * dt; p.r += (road.smoke ? 14 : 8) * dt; p.a -= 0.3 * dt; }); road.puffs = road.puffs.filter(p => p.a > 0);
  const col = { light: '220,220,220', white: '245,245,245', black: '30,30,30', blue: '150,170,210' };
  road.puffs.forEach(p => { rx.fillStyle = `rgba(${col[p.c] || col.light},${p.a})`; rx.beginPath(); rx.arc(p.x, p.y, p.r, 0, Math.PI * 2); rx.fill(); });
  if (road.snow) { while (road.flakes.length < 140) road.flakes.push({ x: Math.random() * W, y: Math.random() * H, v: 20 + Math.random() * 40 }); rx.fillStyle = 'rgba(255,255,255,.85)'; road.flakes.forEach(f => { f.y += f.v * dt; f.x -= (road.speed * 2 + 8) * dt; if (f.y > H) { f.y = -4; f.x = Math.random() * W; } if (f.x < 0) f.x += W; rx.fillRect(f.x, f.y, 2, 2); }); }
}
const DASH = { bat: '#icBat', eng: '#icEng', glow: '#icGlow', oil: '#icOil', temp: '#icTemp' };
async function runRoad(ops, tok) {
  const alive = () => tok === road.token;
  const dash = o => { for (const [k, v] of Object.entries(o)) $(DASH[k]).classList.toggle('on', v); };
  const setRpm = v => { road.rpm = v; $('#rpmTxt').textContent = `${Math.round(v)} rpm`; audio.setRpm(v); };
  for (const op of ops) {
    if (!alive()) return; const [k, a, b] = op;
    if (k === 'scene') { road.snow = !!a.snow; road.sky = a.sky || 'day'; road.station = false; road.target = road.speed = 0; road.flakes = []; road.smoke = null; dash({ bat: false, eng: false, glow: false, oil: false, temp: false }); setRpm(0); }
    else if (k === 'say') { road.lastSay = a; $('#storyTxt').textContent = L(a); }
    else if (k === 'btn') { await new Promise(res => { const bb = $('#storyBtns'); bb.innerHTML = ''; bb.append(h('button', { class: 'primary', on: { click: () => { bb.innerHTML = ''; res(); } } }, L(a === 'toGarage' ? S.toGarage : a))); }); }
    else if (k === 'wait') await sleep(a);
    else if (k === 'dash') dash(a);
    else if (k === 'crank') { const d = audio.play(a) || 0; if (a === 'slow' || a === 'crankNoStart') setRpm(150); await sleep(Math.max(600, d * 1000)); setRpm(0); }
    else if (k === 'start') { const d = audio.play(a, { rpm: 900, cold: sim.engT < 0, miss: G.scn && G.scn.runMiss }) || 0; setRpm(150); await sleep(Math.max(900, d * 1000)); setRpm(a === 'startRough' ? 750 : 900); }
    else if (k === 'drive') { road.target = a; setRpm(b); }
    else if (k === 'park') { road.target = 0; setRpm(0); audio.stopIdle(); road.smoke = null; if (a) setTimeout(() => { if (alive()) road.station = true; }, 1200); await sleep(1200); }
    else if (k === 'stall') { road.target = 0; setRpm(0); audio.play('stall'); await sleep(1500); }
    else if (k === 'sfx') audio.sfx(a, b);
    else if (k === 'smoke') road.smoke = a;
  }
}
async function startScenario(i, skipRoad) {
  closeModal(); const s = G.car.scen[i]; if (!s) return; useCar(G.car);
  Object.assign(G, { scn: s, idx: i, score: 100, hintsUsed: 0, wrong: 0, repair: null, lesson: null, meterOpen: false, seen: new Set(), sawHotClick: false, fixed: false });
  sc.setXray(false); sc.setFocus(null); sim.reset(s.sim || {}); audio.stopIdle(true); road.token++; const tok = road.token; $('#storyBtns').innerHTML = '';
  if (skipRoad) { enterGarage(); return; }
  show('road'); try { await runRoad(s.road || [], tok); } catch (e) { console.error(e); }
  if (tok !== road.token) return; audio.stopIdle(true); enterGarage();
}

/* ================= GARAJ ================= */
function enterGarage() {
  const s = G.scn; Object.assign(sim, s.garage || {}); sim.running = false; sim.booster = false; sc.resetParts(); sc.setHighlight([], 0); sc.setFocus(null); sc.setXray(false);
  G.repair = null; G.meterOpen = false; G.freeStack = []; G.freeMode = false; renderWarn(); $('#readout').innerHTML = ''; $('#lesson').style.display = 'none'; $('#tools').style.display = '';
  show('garage'); sc.introHood(); renderTools(); renderViewbar();
  readout(t('gCar'), [h('div', {}, L(s.blurb)), h('div', { class: 'q', style: 'margin-top:6px' }, t('clickHelp'))]);
}
function readout(title, body, cls = '', sub = '') { const box = h('div', { class: 'ro ' + cls }, h('div', { class: 'h' }, h('span', {}, title), sub ? h('small', {}, sub) : null), ...(Array.isArray(body) ? body : [body])); const r = $('#readout'); r.prepend(box); while (r.children.length > 8) r.lastChild.remove(); return box; }
const kv = rows => h('table', {}, ...rows.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v))));
function statusLine() { return h('div', { id: 'status' }, h('div', {}, `${t('stEngine')}: `, h('b', {}, sim.running ? t('stOn') : t('stOff')), ` · ${t('stTemp')}: `, h('b', {}, `${Math.round(sim.engT)} °C`)), h('div', {}, `${t('stAmb')}: `, h('b', {}, `${sim.ambient} °C`), sim.booster ? h('span', {}, ' · ' + t('stBooster')) : null)); }
function renderTools() {
  const Tt = $('#tools'); Tt.innerHTML = ''; Tt.append(statusLine());
  if (G.repair) { renderRepairTools(Tt); return; }
  const s = G.scn; const B = (lbl, fn, dis) => h('button', { disabled: !!dis || G.busy, on: { click: fn } }, lbl);
  Tt.append(h('h4', {}, t('gCar')), B(sim.running ? t('stopEngine') : t('tryStart'), () => sim.running ? stopEngine(true) : doAttempt()), B(t('drive'), doDrive, !sim.running));
  Tt.append(h('h4', {}, t('gScan')), B(t('obd'), doOBD));
  const DSL = G.car.cfg.fuel === 'diesel';
  Tt.append(h('h4', {}, t('gMech')), B(t('listen'), () => doTool('listen')), B(t('smoke'), () => doTool('smoke')), DSL ? B(t('injReturn'), () => doTool('injReturn'), !sim.running) : B(t('spark'), () => doTool('spark')), B(DSL ? t('fuel') : t('fuelP'), () => doTool('fuel')), B(t('compression'), () => doTool('compression')), B(t('coolant'), () => doTool('coolant')), B(t('oil'), () => doTool('oil')), B(t('lift'), () => doTool('lift')));
  Tt.append(h('h4', {}, t('gElec')), B(t('meter') + (G.meterOpen ? ' ▾' : ' ▸'), () => { G.meterOpen = !G.meterOpen; renderTools(); }));
  if (G.meterOpen) [['batRest', 'mBatRest'], ['batCrank', 'mBatCrank'], ['batRun', 'mBatRun'], ['solS', 'mSolS'], ['solOut', 'mSolOut'], ['gnd', 'mGnd']].forEach(([k, ss]) => Tt.append(h('button', { class: 'small', style: 'margin-left:10px', disabled: G.busy, on: { click: () => doMeter(k) } }, t(ss))));
  Tt.append(B(t('batTest'), doBatTest), B(sim.booster ? t('boosterOff') : t('boosterOn'), () => { sim.booster = !sim.booster; renderTools(); }));
  Tt.append(h('h4', {}, t('gTime')), B(t('cool'), doCool, sim.running), B(t('charge'), doCharge, sim.running));
  Tt.append(h('h4', {}, t('gHelp')), B(`${t('hint')} · ${s.hints.length - G.hintsUsed}`, doHint, G.hintsUsed >= s.hints.length), h('button', { class: 'small', on: { click: () => { G.nudges = !G.nudges; try { localStorage.setItem('ma_nudges', G.nudges ? '1' : '0'); } catch (e) {} renderTools(); } } }, G.nudges ? t('nudgesOn') : t('nudgesOff')));
  Tt.append(h('h4', {}, t('gRepair')), h('button', { class: 'small' + (G.freeMode ? ' primary' : ''), on: { click: () => { G.freeMode = !G.freeMode; renderTools(); } } }, G.freeMode ? t('freeOn') : t('freeOff')), h('div', { style: 'font-size:12px;color:var(--quiet)' }, t('freeHelp')));
  Tt.append(h('button', { class: 'primary', style: 'margin-top:8px', disabled: G.busy, on: { click: openDiagnose } }, t('diagnose')));
}
function renderViewbar() { const v = $('#viewbar'); v.innerHTML = ''; [['def', 'vDef'], ['top', 'vTop'], ['right', 'vRight'], ['left', 'vLeft'], ['below', 'vBelow'], ['rear', 'vRear']].forEach(([k, s]) => v.append(h('button', { class: 'small', on: { click: () => sc.setView(k) } }, t(s)))); v.append(h('button', { class: 'small' + (sc.xray ? ' primary' : ''), on: { click: () => { sc.setXray(!sc.xray); renderViewbar(); } } }, t('xray'))); }
async function busy(fn) { if (G.busy) return; G.busy = true; renderTools(); try { await fn(); } finally { G.busy = false; renderTools(); } }

const ATTEMPT_TXT = {
  dead: T('Nimic. Bordul abia pâlpâie, demarorul tace.', 'Nothing. The dash barely flickers, the starter is silent.'),
  chatter: T('Clic-clic-clic rapid din zona demarorului, motorul nu se rotește. Bordul pâlpâie.', 'Rapid click-click-click from the starter, the engine doesn\'t turn. Dash flickers.'),
  slow: T('Demarorul rotește motorul greu, rar. Motorul nu prinde.', 'The starter turns the engine slowly. It doesn\'t catch.'),
  start: T('Demarorul rotește normal, motorul pornește.', 'The starter cranks normally, the engine starts.'),
  click: T('Un singur clic sec. Demarorul nu se rotește. Bordul rămâne aprins normal.', 'A single dry click. The starter doesn\'t turn. Dash stays normally lit.'),
  crankNoStart: T('Demarorul învârte normal, dar motorul nu prinde deloc.', 'The starter cranks normally, but the engine won\'t catch at all.'),
  startLong: T('Demarorul învârte mult până când motorul prinde.', 'The starter cranks for a long time before it catches.'),
  startRough: T('Pornește, dar ralantiul e neregulat.', 'It starts, but idles roughly.')
};
async function animateAttempt(r) {
  const d = audio.play(r.kind, { rpm: sim.idleRpm(), cold: sim.engT < 0, miss: G.fixed ? 0 : (G.scn.runMiss || (G.scn.coldMiss && !sim.hot() ? G.scn.coldMiss : 0)) }) || 0;
  const cranks = ['slow', 'start', 'startLong', 'startRough', 'crankNoStart'].includes(r.kind);
  G.crankAnim = cranks ? (r.kind === 'slow' ? 2 : 1) : 0; await sleep(Math.max(500, d * 1000)); G.crankAnim = 0;
}
function doAttempt() { if (blockIfOut()) return; return busy(async () => { const r = sim.attempt(G.scn, G.fixed); if (!r) return; await animateAttempt(r); readout(t('tryStart'), h('div', {}, L(ATTEMPT_TXT[r.kind])), sim.running ? 'good' : ''); nudgeAttempt(r); }); }
function stopEngine(log) { if (!sim.running) return; sim.running = false; audio.stopIdle(); if (log) renderTools(); }
function doDrive() {
  if (!sim.running) return; const s = G.scn;
  busy(async () => {
    audio.setRpm(2000); const dv = !G.fixed && s.drive; if (dv && dv.sfx) audio.sfx(dv.sfx, 2.5); await sleep(1600); audio.setRpm(sim.idleRpm());
    if (s.elec) { sim.engT = Math.max(sim.engT, 88); sim.soc = sim.faults.has('alternator') ? Math.max(0, sim.soc - 0.15) : Math.min(1, sim.soc + 0.15);
      readout(t('drive'), h('div', {}, L(sim.faults.has('alternator') ? T('Ai mers 20 de minute. Martorul bateriei a stat aprins tot drumul.', 'You drove 20 minutes. The battery light stayed on.') : T('Ai mers 20 de minute. Motorul e cald.', 'You drove 20 minutes. The engine is warm.')))); return; }
    sim.engT = (dv && dv.noWarm) ? dv.noWarm : Math.max(sim.engT, 88); sim.soc = Math.min(1, sim.soc + 0.1);
    readout(t('drive'), h('div', {}, L(dv ? dv.txt : T('Mașina merge normal, fără nimic de semnalat.', 'The car drives normally, nothing to report.'))));
    if (dv && dv.stall) { sim.running = false; audio.play('stall'); }
  });
}
const TOOL_DEF = {
  listen: T('Ralanti uniform, fără zgomote mecanice anormale.', 'Even idle, no abnormal mechanical noise.'),
  smoke: T('Fumul nu iese nicăieri: admisia e etanșă.', 'No smoke escapes anywhere: the intake is sealed.'),
  injReturn: T('Retur aproape egal la toate 4 injectoarele, în limite.', 'Nearly equal back-leak on all 4 injectors, within limits.'),
  fuel: T('Motorina vine curată și fără bule; filtrul nu e colmatat.', 'Fuel arrives clean and bubble-free; the filter isn\'t clogged.'),
  coolant: T('Presiunea se menține 15 minute: nicio scurgere.', 'Pressure holds for 15 minutes: no leaks.'),
  oil: T('Nivel între MIN și MAX, ulei curat. Presiune bună la cald.', 'Level between MIN and MAX, clean oil. Good hot pressure.'),
  lift: T('Fără joc la roți, fără scurgeri, burdufuri întregi, articulații fără joc.', 'No wheel play, no leaks, boots intact, joints tight.'),
  compression: T('Compresie în limite pe toți cilindrii, diferențe mici între ei.', 'Compression within limits on all cylinders, small differences between them.'),
  spark: T('Scânteie puternică, albastră, pe toți cilindrii.', 'Strong blue spark on every cylinder.')
};
const TOOL_DEF_P = {
  fuel: T('Presiune în rampă aprox. 3,5 bar, se menține după oprire.', 'Rail pressure about 3.5 bar, holds after switch-off.'),
  smoke: T('Fumul nu iese nicăieri: admisia și furtunurile de vacuum sunt etanșe.', 'No smoke escapes: intake and vacuum hoses are sealed.'),
  listen: T('Ralanti uniform, fără țăcănit sau șuierat.', 'Even idle, no ticking or hissing.')
};
function doTool(k) {
  const s = G.scn; const custom = !G.fixed && s[k];
  if (k === 'listen' && !sim.running && !custom) { readout(t('listen'), h('div', {}, t('needRun'))); return; }
  if (k === 'listen' && sim.running && custom && s.listenSfx) audio.sfx(s.listenSfx, 2.2);
  if (k === 'compression' && sim.running) { readout(t(k), h('div', {}, t('needOff'))); return; }
  const def = (G.car.cfg.fuel === 'petrol' && TOOL_DEF_P[k]) || TOOL_DEF[k];
  readout(k === 'fuel' && G.car.cfg.fuel === 'petrol' ? t('fuelP') : t(k), h('div', {}, L(custom || def)), custom ? 'find' : '');
  if (custom) nudge('tool_' + k, T('Ai găsit ceva anormal. Gândește-te ce piesă ar produce exact asta.', 'You found something abnormal. Think which part would produce exactly this.'));
}
function liveRows() {
  const s = G.scn, cfg = G.car.cfg, lv = G.fixed ? {} : (s.live || {}), run = sim.running, R = [], dash = '—', ro = I18N.lang === 'ro';
  const rq = (o, unit, dflt) => { const custom = o != null && !(typeof o === 'object' && 'req' in o); if (!run && !custom) return dash; const v = o ?? dflt; if (v && typeof v === 'object' && 'req' in v) return `${v.req.toLocaleString(I18N.lang)} / ${typeof v.act === 'object' ? L(v.act) : v.act.toLocaleString(I18N.lang)} ${unit}`; return typeof v === 'object' ? L(v) : v; };
  R.push([t('lvV'), `${fmt(run ? sim.runV() : (sim.booster ? 12.8 : sim.restV()), 1)} V`]);
  R.push([t('lvT'), lv.ectTxt ? L(lv.ectTxt) : `${Math.round(run && lv.ect ? lv.ect : sim.engT)} °C`]);
  R.push([t('lvRpm'), `${run ? (lv.rpm || sim.idleRpm()) : 0} rpm`]);
  R.push([t('lvAmb'), `${sim.ambient} °C`]);
  if (lv.crankSig) R.push([t('lvCrank'), L(sim.hot() ? lv.crankSig.hot : lv.crankSig.cold)]);
  if (cfg.fuel === 'diesel') {
    if (cfg.inj === 'cr') { let rail = rq(lv.rail, 'bar', { req: 290, act: 285 }); if (lv.railCrank) rail += ' · ' + L(lv.railCrank); R.push([t('lvRail'), rail]); }
    else R.push([t('lvQty'), rq(lv.qty, '', T('aprox. 5 mg/cursă la ralanti', 'about 5 mg/stroke at idle'))]);
    if (cfg.turbo) R.push([t('lvBoost'), rq(lv.boost, 'mbar', { req: cfg.id === 'golf4' ? 1900 : 2200, act: cfg.id === 'golf4' ? 1880 : 2180 })]);
    if (PARTS.maf) R.push([t('lvMaf'), rq(lv.maf, 'mg/c', cfg.id === 'golf4' ? { req: 420, act: 415 } : { req: 520, act: 515 })]);
    if (cfg.egr) R.push([t('lvEgr'), rq(lv.egr, '%', { req: 0, act: 1 })]);
    if (cfg.dpf) { R.push([t('lvDpf'), rq(lv.dpfP, '', T('aprox. 20 mbar la ralanti', 'about 20 mbar at idle'))]); R.push([t('lvSoot'), lv.soot || '35%']); }
    if (cfg.lambda) R.push([t('lvO2'), rq(lv.o2, '', T('variază 3–18 % după sarcină', 'varies 3–18% with load'))]);
  } else {
    R.push([t('lvMap'), rq(lv.map, '', T('aprox. 30–35 kPa la ralanti', 'about 30–35 kPa at idle'))]);
    R.push([t('lvTrim'), rq(lv.trim, '', '+1 % / −2 %')]);
    R.push([t('lvO2v'), rq(lv.o2v, '', T('oscilează 0,1–0,9 V, de câteva ori pe secundă', 'swings 0.1–0.9 V several times a second'))]);
    R.push([t('lvO2v2'), rq(lv.o2v2, '', T('stabil aprox. 0,6–0,7 V', 'steady about 0.6–0.7 V'))]);
    R.push([t('lvThr'), rq(lv.thr, '', '3 %')]);
    R.push([t('lvAdv'), rq(lv.adv, '', T('aprox. 8–12° la ralanti', 'about 8–12° at idle'))]);
    R.push([t('lvMis'), rq(lv.mis, '', cfg.cyl === 3 ? '0 / 0 / 0' : '0 / 0 / 0 / 0')]);
  }
  R.push([t('lvFan'), lv.fan ? L(lv.fan) : (sim.engT > 98 ? (ro ? 'pornit' : 'on') : (ro ? 'oprit' : 'off'))]);
  return R;
}
function doOBD() {
  if (!sim.obdPowered()) { readout(t('obd'), h('div', {}, t('obdNoPower')), 'bad'); nudge('obdDead', T('Testerul nici nu se aprinde, deci tensiunea e foarte mică. Poate are legătură cu bateria? Un booster ar alimenta și testerul.', 'The scanner won\'t even power up, so voltage is very low. Maybe the battery? A jump pack would power it too.')); return; }
  const codes = G.fixed ? [] : (G.scn.codes || []);
  readout(t('obd'), [h('div', { class: 'sub2' }, t('obdCodes')), codes.length ? kv(codes.map(c => [`${c.code} – ${L(c.txt)}`, t('stored')])) : h('div', { class: 'q' }, t('obdNone')), h('div', { class: 'sub2' }, `${t('obdLive')} (${t('obdLiveNote')})`), kv(liveRows())]);
  if (codes.some(c => c.code === 'P0562')) nudge('obd562', NUDGE.obd562); else if (codes.length) nudge('obdCode', NUDGE.obdCode); else nudge('obdNone', NUDGE.obdNone);
  if (!sim.running) nudge('obdRun', T('Multe valori din date live apar doar cu motorul pornit.', 'Many live values only show with the engine running.'));
}
const noisy = v => v + (Math.random() - 0.5) * 0.04;
function doMeter(k) {
  const name = t({ batRest: 'mBatRest', batCrank: 'mBatCrank', batRun: 'mBatRun', solS: 'mSolS', solOut: 'mSolOut', gnd: 'mGnd' }[k]);
  if (k === 'batRest') { if (sim.running) { readout(t('meter'), h('div', {}, t('needOff')), '', name); return; } const v = sim.booster ? 12.8 : sim.restV(); readout(t('meter'), kv([[name, `${fmt(noisy(v))} V`]])); if (!sim.booster) nudgeRest(v); return; }
  if (k === 'batRun') { if (!sim.running) { readout(t('meter'), h('div', {}, t('needRun')), '', name); return; } readout(t('meter'), kv([[name, `${fmt(noisy(sim.runV()))} V`]])); nudgeRun(sim.runV()); return; }
  if (sim.running) { readout(t('meter'), h('div', {}, t('needOff')), '', name); return; }
  if (blockIfOut()) return;
  busy(async () => { const r = sim.attempt(G.scn, G.fixed); await animateAttempt(r); let val;
    if (k === 'batCrank') val = r.kind === 'chatter' ? t('jumpy') : `${fmt(noisy(r.vmin))} V`;
    if (k === 'solS') val = r.vS == null ? t('jumpy') : `${fmt(noisy(r.vS))} V`;
    if (k === 'solOut') val = r.vOut == null ? t('jumpy') : `${fmt(Math.max(0, noisy(r.vOut)))} V`;
    if (k === 'gnd') val = `${fmt(Math.max(0, noisy(r.gnd)))} V`;
    readout(t('meter'), [h('div', { class: 'q', style: 'margin-bottom:4px' }, t('helper')), kv([[name, val]]), h('div', { class: 'q', style: 'margin-top:4px' }, L(ATTEMPT_TXT[r.kind]))]); nudgeMeter(k, r); });
}
function doBatTest() {
  if (sim.booster) { readout(t('batTest'), h('div', {}, t('btBooster'))); return; }
  const verdict = sim.health < 0.6 ? t('btReplace') : (sim.soc < 0.7 ? t('btCharge') : t('btGood'));
  readout(t('batTest'), kv([[t('btV'), `${fmt(sim.running ? sim.runV() : sim.restV())} V`], [t('btSoc'), `${Math.round(Math.max(0, sim.soc) * 100)}%`], [t('btSoh'), `${Math.round(sim.health * 100)}%`], [t('btVerdict'), verdict]]), sim.health < 0.6 ? 'bad' : '');
  if (sim.health < 0.6) nudge('weakBat', NUDGE.weakBat); else if (sim.soc < 0.7) nudge('lowSoc', NUDGE.lowSoc); else nudge('goodBat', NUDGE.goodBat);
}
function doCool() { sim.engT = sim.ambient; readout(t('cool'), h('div', {}, L(T(`Au trecut 2 ore. Motorul s-a răcit la ${sim.ambient} °C.`, `2 hours later. The engine has cooled to ${sim.ambient} °C.`)))); renderTools(); }
function doCharge() { sim.booster = false; sim.soc = 1; sim.engT = sim.ambient; readout(t('charge'), h('div', {}, L(T('Bateria a stat 6 ore la încărcător. Arată 100%.', 'The battery spent 6 hours on the charger. It reads 100%.')))); renderTools(); }
function doHint() { const s = G.scn; if (G.hintsUsed >= s.hints.length) { readout(t('hintT'), h('div', {}, t('noHints'))); return; } const hh = s.hints[G.hintsUsed]; G.hintsUsed++; G.score = Math.max(0, G.score - 10); updateTop(); readout(`${t('hintT')} ${G.hintsUsed}/${s.hints.length}`, h('div', {}, L(hh)), 'hint', '−10'); renderTools(); }

/* ---------- indicații automate ---------- */
const NUDGE = {
  chatter: T('Clic-clic rapid apare de obicei când solenoidul primește prea puțină tensiune: se închide, tensiunea cade, se deschide. Poate are legătură cu voltajul?', 'Rapid clicking usually means the solenoid gets too little voltage: it closes, voltage drops, it opens. Maybe it\'s voltage?'),
  dead: T('Nimic deloc… Ajunge curent măcar la bord? Poate are legătură cu bateria sau bornele.', 'Nothing at all… Is current even reaching the dash? Maybe the battery or terminals.'),
  slow: T('Demarorul se învârte, dar greu. Ori nu primește destul curent, ori motorul e greu de rotit.', 'The starter turns, but slowly. Either too little current, or the engine is hard to turn.'),
  slowCharged: T('Bateria e încărcată și totuși nu are forță la frig. Încărcată nu înseamnă sănătoasă.', 'The battery is charged yet weak in the cold. Charged doesn\'t mean healthy.'),
  click: T('Un singur clic și bordul nu scade deloc. O baterie slabă ar face luminile să scadă. Curentul mare pare că nici nu pleacă spre demaror.', 'A single click and the dash doesn\'t dim. A weak battery would dim the lights. The big current never seems to leave for the starter.'),
  crankNoStart: T('Demarorul învârte bine, deci bateria și demarorul își fac treaba. Problema e la ce îi trebuie motorului ca să ardă: motorină, presiune, semnale.', 'The starter turns well, so battery and starter are fine. The problem is what the engine needs to fire: fuel, pressure, signals.'),
  startLong: T('Învârte mult până prinde. Ceva îi lipsește motorului la început: căldură, motorină sau presiune.', 'Long crank before it catches. Something is missing at first: heat, fuel or pressure.'),
  boosterStart: T('Cu booster pornește. Deci demarorul și motorul pot face treaba; problema pare la sursa de curent.', 'It starts with the jump pack. So the starter and engine can do it; the problem looks like the power source.'),
  coldStarts: T('Rece a pornit, cald doar clic. Ce piesă se poartă diferit cu temperatura?', 'Started cold, only clicks hot. Which part behaves differently with temperature?'),
  restLow: T('Sub aprox. 12,2 V în repaus bateria e descărcată. De ce s-a descărcat?', 'Under about 12.2 V at rest the battery is flat. Why?'),
  restOk: T('Bateria pare plină. Tensiunea în repaus nu spune însă cât curent dă la pornire.', 'The battery looks full. Resting voltage doesn\'t show cranking power, though.'),
  runLow: T('Cu motorul pornit ar trebui să fie peste aprox. 13,5 V. Ceva nu încarcă.', 'Running it should be above about 13.5 V. Something isn\'t charging.'),
  runOk: T('Încărcarea arată bine.', 'Charging looks good.'),
  crankLow: T('La pornire bateria n-ar trebui să scadă sub aprox. 9,6 V.', 'While cranking the battery shouldn\'t drop below about 9.6 V.'),
  sOkOut0: T('Comanda ajunge la solenoid, dar din el nu iese nimic spre demaror.', 'The command reaches the solenoid, but nothing comes out to the starter.'),
  obd562: T('P0562 înseamnă tensiune scăzută. Codul spune ce a văzut calculatorul, nu ce piesă e de vină.', 'P0562 means low voltage. A code says what the ECU saw, not which part is to blame.'),
  obdCode: T('Codul arată unde să cauți, nu ce piesă să schimbi. Compară în date live valoarea cerută cu cea reală.', 'A code shows where to look, not what to replace. Compare target and actual values in live data.'),
  obdNone: T('Niciun cod. Multe defecte mecanice nu lasă cod: ascultă, privește, măsoară.', 'No codes. Many mechanical faults leave none: listen, look, measure.'),
  weakBat: T('Starea bateriei e slabă. O încărcare îi crește tensiunea, nu și puterea la pornire.', 'Battery health is poor. Charging raises voltage, not cranking power.'),
  lowSoc: T('Bateria e sănătoasă, doar descărcată. Contează de ce.', 'The battery is healthy, just flat. Why matters.'),
  goodBat: T('Bateria e bună. Caută mai departe.', 'The battery is good. Look further.')
};
function nudge(key, txt) { if (!G.nudges || !G.scn || G.lesson) return; if (G.seen.has(key)) return; G.seen.add(key); readout('💭 ' + t('thought'), h('div', {}, L(txt)), 'think'); }
function nudgeAttempt(r) {
  if (r.kind === 'click' && sim.engT > 55) G.sawHotClick = true;
  const m = { chatter: 'chatter', dead: 'dead', click: 'click', crankNoStart: 'crankNoStart', startLong: 'startLong' }[r.kind];
  if (r.kind === 'slow') (sim.soc > 0.9 && sim.health < 0.6) ? nudge('slowCharged', NUDGE.slowCharged) : nudge('slow', NUDGE.slow);
  else if (m) nudge(m, NUDGE[m]);
  else if (r.kind === 'start') { if (sim.booster) nudge('boosterStart', NUDGE.boosterStart); else if (G.sawHotClick && sim.engT < 40) nudge('coldStarts', NUDGE.coldStarts); }
}
function nudgeRest(v) { v < 12.2 ? nudge('restLow', NUDGE.restLow) : (v >= 12.45 && nudge('restOk', NUDGE.restOk)); }
function nudgeRun(v) { v < 13.5 ? nudge('runLow', NUDGE.runLow) : nudge('runOk', NUDGE.runOk); }
function nudgeMeter(k, r) { if (k === 'batCrank' && r.vmin < 9.6) nudge('crankLow', NUDGE.crankLow); if (k === 'solOut' && r.vOut === 0 && r.vS > 10) nudge('sOkOut0', NUDGE.sOkOut0); nudgeAttempt(r); }

/* ---------- informații piesă ---------- */
let hoverId = null, downAt = null; const canvas = $('#c3d');
canvas.addEventListener('pointermove', ev => { if (G.screen !== 'garage') return; const id = sc.pickAt(ev); hoverId = id; const tip = $('#tip'); if (id && ev.pointerType === 'mouse') { tip.style.display = 'block'; tip.textContent = L(PARTS[id].name); const r = canvas.getBoundingClientRect(); tip.style.left = (ev.clientX - r.left + 14) + 'px'; tip.style.top = (ev.clientY - r.top + 10) + 'px'; } else tip.style.display = 'none'; if (!G.lesson) sc.setHighlight(id ? [id] : [], 0x3366cc); });
let pressTimer = null;
canvas.addEventListener('contextmenu', ev => { ev.preventDefault(); if (G.screen !== 'garage') return; const id = sc.pickAt(ev); if (id) freeRemove(id); });
canvas.addEventListener('pointerdown', ev => { downAt = [ev.clientX, ev.clientY]; clearTimeout(pressTimer); if (ev.pointerType === 'touch') { const e0 = { clientX: ev.clientX, clientY: ev.clientY }; pressTimer = setTimeout(() => { if (!downAt) return; const id = sc.pickAt(e0); if (id) { freeRemove(id); downAt = null; } }, 600); } });
canvas.addEventListener('pointermove', ev => { if (downAt && Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 8) clearTimeout(pressTimer); });
canvas.addEventListener('pointerleave', () => { $('#tip').style.display = 'none'; if (!G.lesson) sc.setHighlight([], 0); });
canvas.addEventListener('pointerup', ev => { clearTimeout(pressTimer); if (!downAt) return; const d = Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]); downAt = null; if (d > 6) return; const id = sc.pickAt(ev); if (id) onPartClick(id); });
function onPartClick(id) { if (G.repair && G.repair.phase === 'remove') { tryRemove(id); return; } if (G.freeMode && !G.lesson && !G.repair) { freeRemove(id); return; } showInfo(id); }
function freeRemove(id) { if (!G.scn || G.lesson) return; if (G.repair) { if (G.repair.phase === 'remove') tryRemove(id); return; } const p = PARTS[id]; if (!p.removable) { showInfo(id); return; } if (p.state !== 'in') return; if (sim.running) stopEngine(true);
  const missing = p.pre.filter(q => PARTS[q].state === 'in'); if (missing.length) { readout(L(p.name), h('div', {}, `${t('blocked')} `, h('b', {}, missing.map(q => L(PARTS[q].name)).join(', '))), 'bad'); return; }
  p.state = p.bench ? 'bench' : 'out'; G.freeStack.push(id); sc.syncPart(id); audio.ok() && audio.click(audio.now() + 0.02, 0.35); readout(`${t('removed')}: ${L(p.name)}`, [h('div', { class: 'q' }, `${t('tool')}: ${L(p.tool)}`), (G.scn.obs && G.scn.obs[id] && !G.fixed) ? h('div', { style: 'margin-top:4px' }, h('b', {}, t('see') + ': '), L(G.scn.obs[id])) : null]); renderWarn(); }
function freeRefit(all) { do { const id = G.freeStack.pop(); if (!id) break; PARTS[id].state = 'in'; sc.syncPart(id, all ? 350 : 650); } while (all && G.freeStack.length); audio.ok() && audio.click(audio.now() + 0.02, 0.3); renderWarn(); }
function partsOut() { return Object.values(PARTS).some(p => p.state && p.state !== 'in'); }
function renderWarn() { const w = $('#warn'); const n = G.freeStack.length; w.classList.toggle('on', n > 0 && !G.lesson); w.innerHTML = ''; if (!n) return; w.append(h('b', {}, '⚠ ' + t('warnOut')), h('span', { class: 'q' }, `${t('removedN')}: ${n}`), h('button', { class: 'small', on: { click: () => freeRefit(false) } }, `${t('putLast')}: ${L(PARTS[G.freeStack[n - 1]].name)}`), h('button', { class: 'small primary', on: { click: () => freeRefit(true) } }, t('putAll'))); }
function blockIfOut() { if (!partsOut()) return false; readout(t('tryStart'), h('div', {}, t('partsOutBlock')), 'bad'); return true; }
function showInfo(id) { const p = PARTS[id]; const obs = G.scn && !G.fixed && G.scn.obs && G.scn.obs[id]; readout(L(p.name), [h('div', {}, L(p.desc)), (G.scn && !G.lesson && p.removable) ? h('div', { style: 'margin-top:6px' }, h('b', {}, t('see') + ': '), obs ? L(obs) : t('nothing')) : null]); }

/* ================= REPARAȚIE ================= */
function openDiagnose() { let sel = null; modal(box => { box.append(h('h2', {}, t('diagT')), h('p', { class: 'q' }, t('diagP'))); const opts = h('div', { class: 'opts' }); const go = h('button', { class: 'primary', disabled: true, on: { click: () => { closeModal(); startRepair(sel); } } }, t('doReplace'));
  G.scn.cands.forEach(id => { const b = h('button', { on: { click: () => { sel = id; opts.querySelectorAll('button').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); go.disabled = false; } } }, L(PARTS[id].name)); opts.append(b); });
  box.append(opts, h('div', { class: 'btns' }, h('button', { on: { click: closeModal } }, t('cancel')), go)); }); }
function startRepair(target) { if (sim.running) stopEngine(); sim.booster = false; G.repair = { target, stack: G.freeStack.slice(), phase: PARTS[target].state !== 'in' ? 'install' : 'remove' }; G.freeStack = []; renderWarn();
  if (G.repair.phase === 'install') { const st = G.repair.stack; st.splice(st.indexOf(target), 1); st.push(target); } renderTools(); readout(t('gRepair'), [h('div', {}, h('b', {}, `${t('repTarget')}: ${L(PARTS[target].name)}`)), h('div', { class: 'q' }, t('repHelp'))]); }
function renderRepairTools(Tt) { const R = G.repair; Tt.append(h('h4', {}, t('gRepair')), h('div', { style: 'font-size:14px' }, `${t('repTarget')}: `, h('b', {}, L(PARTS[R.target].name))));
  if (R.phase === 'remove') { Tt.append(h('div', { style: 'font-size:13px;color:var(--quiet)' }, t('repHelp'))); if (R.stack.length) Tt.append(h('div', { style: 'font-size:13px;color:var(--quiet)' }, R.stack.map((id, i) => h('div', {}, `${i + 1}. ${L(PARTS[id].name)}`)))); }
  if (R.phase === 'install') { const top = R.stack[R.stack.length - 1]; Tt.append(h('button', { class: 'primary', on: { click: installNext } }, top === R.target ? `${t('installNew')}: ${L(PARTS[top].name)}` : `${t('installBack')}: ${L(PARTS[top].name)}`)); }
  Tt.append(h('button', { style: 'margin-top:10px', on: { click: abortRepair } }, t('abortRepair'))); }
function tryRemove(id) { const p = PARTS[id], R = G.repair; if (!p.removable) { showInfo(id); return; } if (p.state !== 'in') return;
  const missing = p.pre.filter(q => PARTS[q].state === 'in'); if (missing.length) { readout(L(p.name), h('div', {}, `${t('blocked')} `, h('b', {}, missing.map(q => L(PARTS[q].name)).join(', '))), 'bad'); return; }
  p.state = p.bench ? 'bench' : 'out'; R.stack.push(id); sc.syncPart(id); audio.ok() && audio.click(audio.now() + 0.02, 0.35);
  readout(`${t('removed')}: ${L(p.name)}`, h('div', { class: 'q' }, `${t('tool')}: ${L(p.tool)}`)); if (id === R.target) R.phase = 'install'; renderTools(); }
function installNext() { const R = G.repair; const id = R.stack.pop(); PARTS[id].state = 'in'; sc.syncPart(id); audio.ok() && audio.click(audio.now() + 0.02, 0.3); if (!R.stack.length) { finishRepair(); return; } renderTools(); }
function abortRepair() { const R = G.repair; while (R.stack.length) { const id = R.stack.pop(); PARTS[id].state = 'in'; sc.syncPart(id, 300); } G.repair = null; renderTools(); renderWarn(); }
function applyReplacement(id) { const s = G.scn; if (id === 'battery') { sim.health = 1; sim.soc = 0.95; } if (id === 'alternator') sim.faults.delete('alternator'); if (id === 'solenoid' || id === 'starter') sim.faults.delete('solenoid'); if (id === 'starter') sim.faults.delete('starterMotor'); if (id === 'groundStrap') sim.faults.delete('ground'); if (id === 'battery') sim.faults.delete('battery'); if (!s.elec && s.correct.includes(id)) G.fixed = true; }
async function finishRepair() { const target = G.repair.target, s = G.scn; G.repair = null; applyReplacement(target); renderTools(); await sleep(700); if (G.scn !== s || G.screen !== 'garage') return; runTest(target); }

const ELEC_TESTS = {
  frost: async T_ => { T_.say(T('Noaptea trece. Dimineață, −10 °C.', 'The night passes. Morning, −10 °C.')); sim.running = false; sim.booster = false; sim.engT = -10; if (sim.health > 0.9) sim.soc = 0.95; await sleep(1200); const r = sim.attempt(G.scn, G.fixed); await T_.attempt(r); return r.kind === 'start'; },
  alt: async T_ => { sim.running = false; sim.booster = false; sim.engT = 15; sim.soc = Math.max(sim.soc, 0.9); T_.say(T('Bateria a fost încărcată. Drum de test de 30 de minute.', 'The battery was charged. 30-minute test drive.')); await sleep(1200); const r = sim.attempt(G.scn, G.fixed); await T_.attempt(r); if (r.kind !== 'start') return false; await sleep(1500);
    if (sim.faults.has('alternator')) { T_.say(T(`După 15 minute se aprinde martorul bateriei. ${fmt(12.2)} V și scade.`, `After 15 minutes the battery light comes on. ${fmt(12.2)} V and falling.`)); stopEngine(); return false; }
    T_.say(T(`Martorul e stins, ${fmt(14.1)} V tot drumul.`, `Light off, ${fmt(14.1)} V all the way.`)); await sleep(1200); stopEngine(); return true; },
  sol: async T_ => { sim.running = false; sim.booster = false; sim.engT = 8; sim.soc = Math.max(sim.soc, 0.9); T_.say(T('Test: pornire la rece, 30 km, oprire și repornire la cald.', 'Test: cold start, 30 km, stop and hot restart.')); await sleep(1200); let r = sim.attempt(G.scn, G.fixed); await T_.attempt(r); if (r.kind !== 'start') return false;
    await sleep(1200); sim.engT = 88; T_.say(T('Motorul e cald. Oprești.', 'Engine hot. You switch off.')); stopEngine(); await sleep(1400); r = sim.attempt(G.scn, G.fixed); await T_.attempt(r); if (r.kind === 'start') { await sleep(800); stopEngine(); } return r.kind === 'start'; }
};
async function runTest(target) {
  const s = G.scn; let lines;
  modal(box => { box.append(h('h2', {}, t('testT'))); lines = h('div', {}); box.append(lines); });
  const T_ = { say: txt => lines.append(h('p', {}, L(txt))), attempt: async r => { T_.say(ATTEMPT_TXT[r.kind]); await animateAttempt(r); } };
  let ok = false;
  try {
    if (s.elec) ok = await ELEC_TESTS[s.test](T_);
    else {
      sim.running = false; sim.booster = false; sim.engT = s.testCold ? sim.ambient : 88;
      T_.say(T('Pornești și faci un drum de test.', 'You start up and take a test drive.')); await sleep(900);
      const r = sim.attempt(s, G.fixed); await T_.attempt(r); await sleep(900);
      ok = G.fixed; if (ok) audio.setRpm(1800); else if (s.drive && s.drive.sfx) audio.sfx(s.drive.sfx, 2);
      T_.say(ok ? (s.fixed || T('Simptomele au dispărut.', 'The symptoms are gone.')) : (s.still || T('Simptomul a revenit.', 'The symptom is back.')));
      await sleep(1500); stopEngine();
    }
  } catch (e) { console.error(e); }
  await sleep(500); const box = $('#modalBox');
  if (!ok) { G.wrong++; G.score = Math.max(0, G.score - 25); updateTop(); box.append(h('h2', { style: 'color:var(--bad);margin-top:12px' }, t('failT')), h('p', {}, t('failP')), h('div', { class: 'btns' }, h('button', { class: 'primary', on: { click: () => { closeModal(); renderTools(); } } }, t('backDiag')))); renderTools(); return; }
  let extra = null; if (s.partial && s.partial[target]) { G.score = Math.max(0, G.score - s.partial[target].pts); extra = L(s.partial[target].txt); }
  updateTop(); try { if (G.best[s.id] == null || G.score > G.best[s.id]) { G.best[s.id] = G.score; localStorage.setItem('ma_best', JSON.stringify(G.best)); } } catch (e) {}
  const next = G.idx + 1 < G.car.scen.length ? G.idx + 1 : null;
  const src = (s.src || []).map(k => SRC_LINKS[k]).filter(Boolean);
  box.append(...[h('h2', { style: 'color:var(--good);margin-top:12px' }, `${t('okT')} ${t('score')}: ${G.score}`), extra ? h('p', {}, extra) : null,
    h('div', { class: 'sec' }, t('whatT')), h('p', {}, L(s.explain)), h('div', { class: 'sec' }, t('homeT')), h('p', {}, L(s.home)),
    h('div', { class: 'sec' }, t('srcT')), h('p', { class: 'q' }, t('conf_' + s.conf), s.user ? (I18N.lang === 'ro' ? ' · cazul tău real' : ' · your real case') : ''), src.length ? h('ul', { class: 'src' }, src.map(x => h('li', {}, h('a', { href: x.u, target: '_blank', rel: 'noopener' }, x.t)))) : null,
    h('div', { class: 'btns' }, h('button', { on: { click: goMenu } }, t('menu')), next != null ? h('button', { class: 'primary', on: { click: () => { closeModal(); startScenario(next); } } }, t('nextLevel')) : null)].filter(Boolean));
}

/* ================= LECȚIA ================= */
function startLesson(id) { const def = LESSONS.find(l => l.id === id) || LESSONS[0]; useCar(CARS.find(c => c.id === def.car)); G.scn = null; G.lesson = { i: 0, def, steps: def.steps }; sc.resetParts(); sc.setXray(false); show('garage'); $('#tools').style.display = 'none'; $('#readout').innerHTML = ''; sc.openHoodNow(); sc.setView('def'); renderViewbar(); $('#lesson').style.display = 'block'; lessonStep(0); }
function lessonStep(i) {
  const st = G.lesson.steps[i]; Object.assign(G.lesson, { i, rpm: st.rpm || 0, pinion: st.pinion || 0, glow: !!st.glow });
  sc.setFocus(st.hl);
  if (st.sound === 'crank') { audio.stopIdle(true); if (audio.ok()) audio.crank(audio.now() + 0.05, 2.2, 1); }
  else if (st.sound === 'idle') audio.startIdle(900);
  else if (!st.rpm) audio.stopIdle(true);
  if (st.sound === 'click' && audio.ok()) audio.click(audio.now() + 0.05, 1);
  if (st.view) sc.setView(st.view);
  renderLesson();
}
function renderLesson() {
  const i = G.lesson.i, st = G.lesson.steps[i], N = G.lesson.steps.length;
  $('#lsN').textContent = `${t('step')} ${i + 1}/${N}`; $('#lsT').textContent = L(st.t);
  const B = $('#lsB'); B.innerHTML = ''; L(st.b).split('\n').forEach(p => B.append(h('p', {}, p)));
  B.append(h('div', { class: 'focus' }, h('b', {}, t('inFocus') + ': '), st.hl.filter(id => PARTS[id]).map(id => L(PARTS[id].name)).join(', ')));
  const b = $('#lsBtns'); b.innerHTML = '';
  b.append(h('button', { disabled: i === 0, on: { click: () => lessonStep(i - 1) } }, t('prev')), h('button', { on: { click: () => lessonStep(i) } }, t('replay')),
    i < N - 1 ? h('button', { class: 'primary', on: { click: () => lessonStep(i + 1) } }, t('next')) : h('button', { class: 'primary', on: { click: endLesson } }, t('finish')));
}
function endLesson() { audio.stopIdle(); sc.setFocus(null); goMenu(); }

/* ================= BUCLĂ ================= */
let last = performance.now();
function loop(now) { requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.screen === 'road') drawRoad(dt);
  if (G.screen !== 'garage' || !sc) return;
  let rpm = 0, pinion = false, glow = false;
  if (G.lesson) { rpm = G.lesson.rpm; pinion = !!G.lesson.pinion; glow = G.lesson.glow; }
  else if (G.crankAnim) { rpm = G.crankAnim === 2 ? 60 : 200; pinion = true; }
  else if (sim.running) rpm = sim.idleRpm();
  sc.update(dt, { rpm, pinion, glow, fan: sim.running && sim.engT > 98 && !(G.scn && G.scn.fanDead && !G.fixed) });
}
window.addEventListener('resize', () => { if (sc) sc.resize(); resizeRoad(); });
renderMenu(); updateTop(); resizeRoad(); requestAnimationFrame(loop);
window.__booted = true; document.getElementById('fallback').style.display = 'none';
window.__game = { useCar, freeRemove, freeRefit, partsOut, G, sim, get PARTS() { return PARTS; }, get sc() { return sc; }, CARS, startScenario, enterGarage, startLesson, lessonStep, openDiagnose, startRepair, tryRemove, installNext, doMeter, doOBD, doBatTest, doCharge, doCool, doAttempt, doHint, doTool, doDrive };
