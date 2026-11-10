// Scena 3D: garaj + Koleos (geometrie simplificată, în metri)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

let CORE = null;
function core(canvas) { if (CORE) return CORE; const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let envTex = null; try { const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; } catch (e) { console.warn(e); }
  const camera = new THREE.PerspectiveCamera(48, 1, 0.02, 60);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.minDistance = 0.3; controls.maxDistance = 5;
  CORE = { renderer, camera, controls, envTex }; return CORE; }

export function createScene(canvas, PARTS, cfg) {
  const { renderer, camera, controls, envTex } = core(canvas);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1d2126); scene.environment = envTex;
  const root = new THREE.Group(); const SC = cfg.scale || 1; root.scale.setScalar(SC); root.position.y = -0.7 * (1 - SC); scene.add(root);
  const has = id => !!PARTS[id];
  const CYLX = cfg.cyl === 3 ? [-0.2, 0, 0.2] : [-0.225, -0.075, 0.075, 0.225];
  scene.add(new THREE.HemisphereLight(0xe8eef7, 0x30343a, 0.5));
  const sun = new THREE.DirectionalLight(0xfff4e6, 1.6); sun.position.set(1.4, 3.4, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  { const c = sun.shadow.camera; c.left = -3; c.right = 3; c.top = 3; c.bottom = -3.5; c.near = 0.5; c.far = 10; } sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01; scene.add(sun);
  const fillL = new THREE.DirectionalLight(0xa8c0ff, 0.45); fillL.position.set(-2.2, 1.2, -1.2); scene.add(fillL);
  const underL = new THREE.DirectionalLight(0xffffff, 0.45); underL.position.set(0.4, -3, 0.2); scene.add(underL);

  /* ---------- materiale și texturi ---------- */
  const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.2 }, o));
  const MAT = {
    alu: () => M(0xb7bcc2, { metalness: 0.85, roughness: 0.36 }), cast: () => M(0x6b6f74, { metalness: 0.55, roughness: 0.72 }), steel: () => M(0x8f9499, { metalness: 0.9, roughness: 0.28 }),
    dark: () => M(0x2b2e32, { metalness: 0.4, roughness: 0.55 }), black: () => M(0x1b1d20, { roughness: 0.78, metalness: 0.05 }), rubber: () => M(0x131313, { roughness: 0.95, metalness: 0 }),
    milky: () => M(0xe9e6dc, { roughness: 0.45, metalness: 0, transparent: true, opacity: 0.82 }), copper: () => M(0xc58b3a, { metalness: 0.9, roughness: 0.32 }),
    red: () => M(0xb3261e, { roughness: 0.5, metalness: 0.05 }), yellow: () => M(0xf2b705, { roughness: 0.5, metalness: 0 }), blue: () => M(0x2f6fd6, { roughness: 0.5, metalness: 0 }),
    green: () => M(0x2f7d4f, { roughness: 0.5, metalness: 0.1 }), glass: () => M(0xaec4d6, { metalness: 0, roughness: 0.04, transparent: true, opacity: 0.3 }),
    body: () => new THREE.MeshPhysicalMaterial({ color: cfg.body || 0x34465c, metalness: 0.6, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }),
    bodyIn: () => M(0x2f3d4f, { metalness: 0.4, roughness: 0.6 }), exhaust: () => M(0x6e655c, { metalness: 0.8, roughness: 0.55 })
  };
  function canvasTex(w, hh, draw) { const c = document.createElement('canvas'); c.width = w; c.height = hh; const x = c.getContext('2d'); draw(x, w, hh); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx; }
  const TEX = {
    floor: canvasTex(512, 512, (x, w, hh) => { x.fillStyle = '#55585c'; x.fillRect(0, 0, w, hh); for (let i = 0; i < 9000; i++) { const v = 70 + Math.random() * 40 | 0; x.fillStyle = `rgba(${v},${v},${v + 2},.35)`; x.fillRect(Math.random() * w, Math.random() * hh, 2, 2); } x.strokeStyle = 'rgba(30,30,30,.6)'; x.lineWidth = 3; x.strokeRect(0, 0, w, hh); }),
    peg: canvasTex(256, 256, (x, w, hh) => { x.fillStyle = '#3b3f45'; x.fillRect(0, 0, w, hh); x.fillStyle = '#24272b'; for (let i = 8; i < w; i += 16) for (let j = 8; j < hh; j += 16) { x.beginPath(); x.arc(i, j, 2.2, 0, Math.PI * 2); x.fill(); } }),
    fins: canvasTex(256, 128, (x, w, hh) => { x.fillStyle = '#2a2d30'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#4b5055'; for (let i = 0; i < w; i += 3) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, hh); x.stroke(); } x.strokeStyle = '#1c1e20'; for (let j = 0; j < hh; j += 10) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); } }),
    cover: canvasTex(512, 256, (x, w, hh) => { x.fillStyle = '#1c1e21'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#2b2e32'; x.lineWidth = 6; x.strokeRect(20, 20, w - 40, hh - 40); x.fillStyle = '#8c939b'; x.font = 'bold 64px system-ui'; x.textAlign = 'center'; x.fillText(cfg.cover || '', w / 2, hh / 2 + 22); }),
    battery: canvasTex(256, 128, (x, w, hh) => { x.fillStyle = '#202226'; x.fillRect(0, 0, w, hh); x.fillStyle = '#3d6fb3'; x.fillRect(16, 28, w - 32, 60); x.fillStyle = '#fff'; x.font = 'bold 34px system-ui'; x.textAlign = 'center'; x.fillText('12V', w / 2, 70); }),
    tray: canvasTex(512, 384, (x, w, hh) => { x.fillStyle = '#4a4e54'; x.fillRect(0, 0, w, hh); for (let i = 0; i < 4000; i++) { const v = 60 + Math.random() * 30 | 0; x.fillStyle = `rgba(${v},${v},${v + 4},.4)`; x.fillRect(Math.random() * w, Math.random() * hh, 2, 2); } x.strokeStyle = '#5c6168'; x.lineWidth = 10; for (let j = 40; j < hh; j += 70) { x.beginPath(); x.moveTo(30, j); x.lineTo(w - 30, j); x.stroke(); } x.fillStyle = '#25282c'; for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) { x.beginPath(); x.ellipse(70 + i * 46, 300 + j * 22, 16, 5, 0, 0, Math.PI * 2); x.fill(); } x.strokeStyle = '#2d3035'; x.lineWidth = 4; x.strokeRect(6, 6, w - 12, hh - 12); }),
    tread: canvasTex(64, 256, (x, w, hh) => { x.fillStyle = '#161616'; x.fillRect(0, 0, w, hh); x.fillStyle = '#0b0b0b'; for (let j = 0; j < hh; j += 16) { x.fillRect(6, j, 22, 6); x.fillRect(36, j + 8, 22, 6); } })
  };
  TEX.floor.wrapS = TEX.floor.wrapT = THREE.RepeatWrapping; TEX.floor.repeat.set(5, 5); TEX.peg.wrapS = TEX.peg.wrapT = THREE.RepeatWrapping; TEX.peg.repeat.set(10, 3); TEX.fins.wrapS = TEX.fins.wrapT = THREE.RepeatWrapping; TEX.fins.repeat.set(4, 2);

  /* ---------- registru ---------- */
  const groups = {}, pickables = [], xrayMats = [], anim = {};
  const allMats = new Set();
  function part(id) { const g = new THREE.Group(); g.userData.part = id; root.add(g); groups[id] = g; if (PARTS[id]) PARTS[id].state = 'in'; return g; }
  function add(g, geo, mat, pos, rot) { const m = new THREE.Mesh(geo, mat); if (pos) m.position.set(pos[0], pos[1], pos[2]); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); m.userData.part = g.userData.part; m.castShadow = true; m.receiveShadow = true; g.add(m); pickables.push(m); allMats.add(mat); return m; }
  const rbox = (w, hh, d, r = 0.01) => new RoundedBoxGeometry(w, hh, d, 3, Math.min(r, w / 2 - 0.001, hh / 2 - 0.001, d / 2 - 0.001));
  const cylX = (r, len, seg = 28) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
  const cylZ = (r, len, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
  const cylY = (r, len, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg);
  const latheX = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg).rotateZ(-Math.PI / 2);
  function pulleyGeo(r, w, ribs = 5) { const pts = [[0.004, -w / 2], [r * 0.55, -w / 2], [r, -w / 2 + 0.002]]; const n = ribs * 2; for (let i = 1; i < n; i++) pts.push([i % 2 ? r - 0.005 : r, -w / 2 + w * i / n]); pts.push([r, w / 2 - 0.002], [r * 0.55, w / 2], [0.004, w / 2]); return latheX(pts, 48); }
  const tubeGeo = (pts, r, closed = false, seg = 64) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), closed), seg, r, 10, closed);
  const hose = (g, pts, r, mat) => add(g, tubeGeo(pts, r), mat || MAT.rubber());
  const bolt = (g, pos, axis = 'y', s = 0.009) => { const geo = new THREE.CylinderGeometry(s, s, s * 0.8, 6); if (axis === 'x') geo.rotateZ(Math.PI / 2); if (axis === 'z') geo.rotateX(Math.PI / 2); return add(g, geo, MAT.steel(), pos); };
  const tyreGeo = latheX([[0.235, -0.11], [0.32, -0.115], [0.352, -0.095], [0.36, -0.04], [0.36, 0.04], [0.352, 0.095], [0.32, 0.115], [0.235, 0.11]], 48);
  function wheel(g, x, z) { add(g, tyreGeo, M(0xffffff, { map: TEX.tread, roughness: 0.95, metalness: 0 }), [x, -0.34, z]); add(g, cylX(0.235, 0.2, 40), MAT.alu(), [x, -0.34, z]); for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; add(g, rbox(0.02, 0.19, 0.035, 0.006), MAT.alu(), [x + (x > 0 ? 0.1 : -0.1), -0.34 + 0.1 * Math.cos(a), z + 0.1 * Math.sin(a)], [a, 0, 0]); } add(g, cylX(0.05, 0.03), MAT.dark(), [x + (x > 0 ? 0.11 : -0.11), -0.34, z]); }

  anim.glowMat = M(0x8a8f95, { metalness: 0.8, emissive: 0x000000 });
  let hoodPivot = null, hoodStrut = null, lampLight = null; const env = []; let floorMesh = null;
  function build() {
    /* garaj */
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), M(0xffffff, { map: TEX.floor, roughness: 0.92, metalness: 0 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.7; floor.receiveShadow = true; scene.add(floor); floorMesh = floor;
    const wallB = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), M(0xffffff, { map: TEX.peg, roughness: 1, metalness: 0 })); wallB.position.set(0, 1.8, -5.5); scene.add(wallB);
    const wallL = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), M(0x2a2e33, { roughness: 1, metalness: 0 })); wallL.position.set(-4, 1.8, 0); wallL.rotation.y = Math.PI / 2; scene.add(wallL);
    const cab = new THREE.Mesh(rbox(1.2, 1.0, 0.5, 0.02), M(0xa3271f, { metalness: 0.4, roughness: 0.45 })); cab.position.set(-2.8, -0.2, -1.5); cab.castShadow = true; scene.add(cab); env.push(wallB, wallL, cab);

    /* caroserie */
    const body = part('body'); const bm = MAT.body(), bin = MAT.bodyIn();
    const fShape = new THREE.Shape(); fShape.moveTo(-0.62, 0.31); fShape.lineTo(0.76, 0.27); fShape.quadraticCurveTo(0.96, 0.24, 0.97, 0.06); fShape.lineTo(0.97, -0.44); fShape.lineTo(0.435, -0.44); fShape.absarc(0, -0.36, 0.445, -0.18, Math.PI + 0.18, false); fShape.lineTo(-0.62, -0.44); fShape.closePath();
    const fGeo = new THREE.ExtrudeGeometry(fShape, { depth: 0.13, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24 }).rotateY(-Math.PI / 2);
    add(body, fGeo, bm, [0.93, 0, 0]); add(body, fGeo, bm, [-0.8, 0, 0]);
    add(body, rbox(0.03, 0.42, 1.18, 0.01), bin, [0.745, -0.08, 0.03]); add(body, rbox(0.03, 0.42, 1.18, 0.01), bin, [-0.745, -0.08, 0.03]);
    [0.66, -0.66].forEach(x => { add(body, cylY(0.105, 0.26, 32), bin, [x, 0.08, -0.29]); add(body, cylY(0.06, 0.03, 24), MAT.dark(), [x, 0.225, -0.29]); [0, 2.1, 4.2].forEach(a => bolt(body, [x + 0.075 * Math.cos(a), 0.215, -0.29 + 0.075 * Math.sin(a)])); });
    add(body, rbox(1.52, 0.72, 0.04, 0.01), bin, [0, -0.05, -0.61]); add(body, rbox(1.48, 0.5, 0.015, 0.005), MAT.black(), [0, -0.02, -0.585]);
    add(body, rbox(1.52, 0.04, 0.2, 0.015), MAT.black(), [0, 0.33, -0.69], [0.25, 0, 0]);
    /* caroserie din profile extrudate (forma depinde de mașină) */
    const SH = Object.assign({ roofY: 1.1, roofF: -1.3, roofR: -2.95, rearZ: -3.4, beltF: 0.34, beltR: 0.42 }, cfg.shape || {});
    const rz = SH.rearZ, deckZ = SH.deckZ ?? rz + 0.1, deckY = SH.deckY ?? SH.beltR + 0.05, zA = -2.69, Z0 = -0.66;
    const beltAt = z => SH.beltF + (SH.beltR - SH.beltF) * (Z0 - z) / (Z0 - rz);
    const extX = (shape, w, bev) => new THREE.ExtrudeGeometry(shape, { depth: w - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 28 }).rotateY(-Math.PI / 2).translate((w - 2 * bev) / 2, 0, 0);
    const lo = new THREE.Shape(); lo.moveTo(Z0, -0.41); lo.lineTo(zA + 0.473, -0.41); lo.absarc(zA, -0.36, 0.475, -0.1, Math.PI + 0.1, false);
    lo.lineTo(Math.min(rz + 0.14, zA - 0.48), -0.41); lo.quadraticCurveTo(rz, -0.41, rz, -0.24); lo.lineTo(rz, SH.beltR - 0.06); lo.quadraticCurveTo(rz, SH.beltR, rz + 0.07, SH.beltR); lo.lineTo(Z0, SH.beltF); lo.closePath();
    add(body, extX(lo, 1.86, 0.03), bm);
    const roofMid = (SH.roofF + SH.roofR) / 2;
    const q3 = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
    const roofC = { getPoints: n => Array.from({ length: n + 1 }, (_, i) => ({ x: q3(SH.roofF, roofMid, SH.roofR, i / n), y: q3(SH.roofY - 0.04, SH.roofY + 0.035, SH.roofY - 0.05, i / n) })) };
    const gh = new THREE.Shape(); gh.moveTo(Z0 + 0.02, SH.beltF - 0.03); gh.lineTo(SH.roofF, SH.roofY - 0.04); roofC.getPoints(16).slice(1).forEach(p => gh.lineTo(p.x, p.y)); gh.lineTo(deckZ, deckY); gh.lineTo(deckZ, SH.beltR - 0.03); gh.closePath();
    const tint = M(0x16222e, { metalness: 0.6, roughness: 0.06, transparent: true, opacity: 0.88 });
    add(body, extX(gh, 1.7, 0.04), tint);
    if (SH.deckZ) { const dk = new THREE.Shape(); dk.moveTo(deckZ + 0.02, SH.beltR - 0.03); dk.lineTo(deckZ + 0.02, deckY); dk.quadraticCurveTo(rz + 0.05, deckY + 0.01, rz + 0.04, SH.beltR - 0.03); dk.closePath(); add(body, extX(dk, 1.8, 0.03), bm); }
    const rp = roofC.getPoints(16), rs = new THREE.Shape(); rp.forEach((p, i) => i ? rs.lineTo(p.x, p.y + 0.03) : rs.moveTo(p.x - 0.03, p.y + 0.03)); rp.slice().reverse().forEach((p, i) => rs.lineTo(p.x, p.y - 0.025)); rs.closePath();
    add(body, extX(rs, 1.76, 0.025), bm);
    const roofAt = z => { let best = rp[0]; rp.forEach(p => { if (Math.abs(p.x - z) < Math.abs(best.x - z)) best = p; }); return best.y; };
    [0.86, -0.86].forEach(x => {
      add(body, tubeGeo([[x, SH.beltF, Z0 + 0.03], [x, (SH.beltF + SH.roofY) / 2, (Z0 + SH.roofF) / 2 + 0.01], [x, SH.roofY - 0.03, SH.roofF - 0.02]], 0.038, false, 8), bm);   // stâlp A
      add(body, rbox(0.03, roofAt(-1.62) - beltAt(-1.62), 0.09, 0.012), MAT.black(), [x * 1.005, (roofAt(-1.62) + beltAt(-1.62)) / 2, -1.62]);                                     // stâlp B
      add(body, tubeGeo([[x, beltAt(-2.24), -2.24], [x, (beltAt(-2.24) + roofAt(SH.roofR + 0.2)) / 2, (-2.24 + SH.roofR + 0.2) / 2 - 0.04], [x, roofAt(SH.roofR + 0.2) - 0.02, SH.roofR + 0.2]], 0.05, false, 8), bm); // stâlp C
      add(body, tubeGeo([[x, SH.roofY - 0.06, SH.roofR + 0.02], [x, deckY, deckZ + 0.02]], 0.04, false, 4), bm);                                                                    // stâlp spate
      add(body, tubeGeo([[x * 1.012, SH.beltF + 0.005, Z0 + 0.02], [x * 1.012, SH.beltR + 0.005, deckZ]], 0.011, false, 4), MAT.black());                                          // chedere geam
      const sx = x > 0 ? 0.933 : -0.933, seam = M(0x0b0c0e, { roughness: 0.9, metalness: 0 });
      [-0.665, -1.62, -2.2].forEach(z => add(body, rbox(0.005, beltAt(z) + 0.38, 0.007, 0.002), seam, [sx, (beltAt(z) - 0.38) / 2, z]));                                          // rosturi uși
      add(body, rbox(0.005, 0.007, 1.535, 0.002), seam, [sx, -0.37, -1.432]);
      [-1.47, -2.06].forEach(z => add(body, rbox(0.016, 0.03, 0.12, 0.012), MAT.steel(), [sx + (x > 0 ? 0.006 : -0.006), beltAt(z) - 0.1, z]));                                     // mânere
      add(body, rbox(0.012, 0.02, 1.5, 0.008), MAT.black(), [sx + (x > 0 ? 0.004 : -0.004), -0.12, -1.42]);                                                                          // bandou lateral
      const mx = x > 0 ? 1.0 : -1.0; add(body, rbox(0.06, 0.035, 0.08, 0.012), MAT.black(), [x > 0 ? 0.95 : -0.95, SH.beltF + 0.04, -0.78]);                                     // oglinzi
      add(body, rbox(0.15, 0.1, 0.075, 0.03), bm, [mx, SH.beltF + 0.08, -0.79]); add(body, rbox(0.13, 0.08, 0.008, 0.004), MAT.steel(), [mx, SH.beltF + 0.08, -0.832]);
      add(body, rbox(0.3, 0.13, 0.05, 0.02), M(0x9e1414, { roughness: 0.25, metalness: 0.1, emissive: 0x3a0000 }), [x > 0 ? 0.7 : -0.7, SH.beltR - 0.1, rz - 0.015]);          // stopuri
    });
    add(body, rbox(1.92, 0.24, 0.17, 0.07), MAT.black(), [0, -0.3, rz + 0.02]);                                                                                                      // bara spate
    add(body, rbox(0.46, 0.11, 0.01, 0.004), M(0xf2f2ee, { roughness: 0.4 }), [0, -0.12, rz - 0.038]);                                                                              // număr
    /* emblemă originală a jocului (nu sigla producătorului) */
    const badgeTex = canvasTex(256, 256, (x, w, hh) => { const c = w / 2; const hex = r => { x.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; x.lineTo(c + r * Math.cos(a), c + r * Math.sin(a)); } x.closePath(); };
      const g = x.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, '#f4f6f8'); g.addColorStop(0.5, '#9aa1a8'); g.addColorStop(1, '#e3e6e9'); hex(120); x.fillStyle = g; x.fill();
      hex(98); x.fillStyle = cfg.badge || '#1c3d6e'; x.fill(); x.strokeStyle = '#ffffff'; x.lineWidth = 16; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(c - 48, c + 42); x.lineTo(c - 48, c - 42); x.lineTo(c, c + 6); x.lineTo(c + 48, c - 42); x.lineTo(c + 48, c + 42); x.stroke(); });
    const badgeMat = M(0xffffff, { map: badgeTex, transparent: true, alphaTest: 0.3, metalness: 0.5, roughness: 0.3 });
    const bf = add(body, new THREE.PlaneGeometry(0.13, 0.13), badgeMat, [0, 0.06, 0.962]);
    const bb = add(body, new THREE.PlaneGeometry(0.12, 0.12), badgeMat, [0, SH.beltR - 0.14, rz - 0.04], [0, Math.PI, 0]);
    add(body, rbox(1.88, 0.33, 0.24, 0.09), bm, [0, -0.3, 0.89]); add(body, rbox(1.0, 0.12, 0.04, 0.02), MAT.black(), [0, -0.34, 1.005]);
    add(body, rbox(1.02, 0.15, 0.05, 0.03), MAT.black(), [0, 0.06, 0.92]); add(body, rbox(0.96, 0.012, 0.02, 0.005), MAT.steel(), [0, 0.06, 0.948]);
    [0.62, -0.62].forEach(x => { add(body, rbox(0.38, 0.14, 0.12, 0.04), MAT.glass(), [x, 0.11, 0.875]); add(body, cylZ(0.04, 0.04, 24), MAT.steel(), [x + (x > 0 ? -0.08 : 0.08), 0.11, 0.87]); });
    add(body, rbox(1.46, 0.05, 0.08, 0.01), MAT.black(), [0, 0.27, 0.66]);
    wheel(body, 0.82, 0); wheel(body, -0.82, 0); wheel(body, 0.82, -2.69); wheel(body, -0.82, -2.69);
    hoodPivot = new THREE.Group(); hoodPivot.position.set(0, 0.385, -0.6); root.add(hoodPivot);
    { const hm = new THREE.Mesh(rbox(1.66, 0.035, 1.44, 0.016), bm); hm.position.set(0, 0, 0.72); hm.castShadow = true; hoodPivot.add(hm);
      const pad = new THREE.Mesh(rbox(1.42, 0.012, 1.2, 0.005), M(0x3a3c40, { roughness: 1, metalness: 0 })); pad.position.set(0, -0.024, 0.7); hoodPivot.add(pad);
      const lampM = new THREE.Mesh(cylX(0.018, 0.5, 12), M(0xffffff, { emissive: 0xfff2d0, emissiveIntensity: 2 })); lampM.position.set(0, -0.05, 0.55); hoodPivot.add(lampM);
      lampLight = new THREE.PointLight(0xfff2d8, 4, 3.5, 1.5); lampLight.position.set(0, -0.12, 0.55); hoodPivot.add(lampLight); }
    hoodStrut = new THREE.Mesh(cylY(0.008, 1, 8), MAT.steel()); root.add(hoodStrut);

    /* răcire, aer, accesorii */
    const rad = part('radiator'); add(rad, rbox(1.2, 0.48, 0.04, 0.008), M(0xffffff, { map: TEX.fins, metalness: 0.5, roughness: 0.6 }), [0, -0.06, 0.63]); add(rad, rbox(1.24, 0.04, 0.06, 0.01), MAT.black(), [0, 0.2, 0.63]); add(rad, rbox(1.24, 0.04, 0.06, 0.01), MAT.black(), [0, -0.32, 0.63]);
    hose(rad, [[-0.4, 0.12, 0.6], [-0.33, 0.17, 0.45], [-0.25, 0.17, 0.28], [-0.22, 0.15, 0.2]], 0.019); hose(rad, [[0.45, -0.26, 0.6], [0.52, -0.3, 0.42], [0.47, -0.3, 0.2], [0.36, -0.27, 0.12]], 0.019);
    const fan = part('fan'); add(fan, rbox(0.9, 0.42, 0.035, 0.02), MAT.black(), [0, -0.07, 0.595]); add(fan, cylZ(0.06, 0.07, 24), MAT.dark(), [0, -0.07, 0.55]);
    anim.fan = new THREE.Group(); anim.fan.position.set(0, -0.07, 0.567); fan.add(anim.fan); for (let k = 0; k < 7; k++) { const geo = rbox(0.16, 0.05, 0.006, 0.003); geo.translate(0.1, 0, 0); const b = new THREE.Mesh(geo, MAT.black()); b.rotation.z = k * Math.PI * 2 / 7; b.userData.part = 'fan'; b.castShadow = true; anim.fan.add(b); pickables.push(b); allMats.add(b.material); }
    if (cfg.turbo) { const ic = part('intercooler'); add(ic, rbox(0.82, 0.16, 0.05, 0.01), M(0xc8ccd0, { map: TEX.fins, metalness: 0.7, roughness: 0.45 }), [0, -0.37, 0.71]); add(ic, rbox(0.05, 0.18, 0.07, 0.01), MAT.alu(), [0.43, -0.37, 0.71]); add(ic, rbox(0.05, 0.18, 0.07, 0.01), MAT.alu(), [-0.43, -0.37, 0.71]); hose(ic, [[-0.45, -0.36, 0.69], [-0.54, -0.3, 0.55], [-0.32, -0.14, 0.34], [-0.2, 0.06, 0.25]], 0.026, MAT.alu()); }
    if (cfg.turbo) { const ich = part('icHose'); hose(ich, [[0.45, -0.36, 0.69], [0.58, -0.32, 0.55], [0.6, -0.27, 0.25]], 0.026, MAT.alu()); hose(ich, [[0.6, -0.27, 0.25], [0.6, -0.25, 0.05], [0.56, -0.18, -0.2]], 0.03, MAT.rubber()); hose(ich, [[0.56, -0.18, -0.2], [0.48, -0.1, -0.3], [0.24, -0.02, -0.3]], 0.026, MAT.alu()); }
    const exp = part('expTank'); add(exp, rbox(0.2, 0.14, 0.13, 0.02), MAT.milky(), [0.56, 0.12, -0.1]); add(exp, rbox(0.18, 0.06, 0.11, 0.01), M(0xe86aa6, { roughness: 0.3, transparent: true, opacity: 0.8 }), [0.56, 0.08, -0.1]); add(exp, cylY(0.03, 0.025), MAT.black(), [0.6, 0.2, -0.1]);
    const ws = part('washer'); add(ws, rbox(0.18, 0.2, 0.13, 0.02), MAT.milky(), [0.6, 0.0, 0.47]); add(ws, cylY(0.025, 0.03), MAT.blue(), [0.58, 0.115, 0.47]);
    const br = part('brakeMaster'); add(br, cylZ(0.13, 0.13, 40), MAT.black(), [-0.45, 0.1, -0.52]); add(br, cylZ(0.035, 0.17, 20), MAT.alu(), [-0.45, 0.1, -0.38]); add(br, rbox(0.13, 0.07, 0.08, 0.015), MAT.milky(), [-0.45, 0.18, -0.38]); add(br, cylY(0.025, 0.025), MAT.yellow(), [-0.45, 0.225, -0.38]);
    const fb = part('fuseBox'); add(fb, rbox(0.14, 0.12, 0.16, 0.012), MAT.black(), [-0.63, 0.08, 0.13]);
    const ecu = part('ecu'); add(ecu, rbox(0.04, 0.12, 0.2, 0.008), MAT.alu(), [-0.7, 0.0, -0.02]); add(ecu, rbox(0.03, 0.05, 0.08, 0.006), MAT.black(), [-0.67, 0.05, -0.02]);
    const air = part('airbox'); add(air, rbox(0.32, 0.14, 0.3, 0.025), MAT.black(), [-0.5, 0.18, -0.12]); hose(air, [[-0.2, 0.18, -0.18], [-0.12, 0.17, -0.32], [0.06, 0.06, -0.34], [0.17, -0.01, -0.3]], 0.035, MAT.black());
    if (has('maf')) { const maf = part('maf'); add(maf, cylX(0.042, 0.1), MAT.black(), [-0.29, 0.18, -0.18]); add(maf, rbox(0.04, 0.03, 0.03, 0.006), MAT.dark(), [-0.29, 0.235, -0.18]); }
    if (cfg.turbo) { const map = part('mapSensor'); add(map, rbox(0.035, 0.03, 0.04, 0.006), MAT.black(), [-0.3, 0.02, 0.3]); add(map, rbox(0.02, 0.02, 0.02, 0.004), MAT.dark(), [-0.3, 0.045, 0.3]); }
    if (has('boostSol')) { const bs = part('boostSol'); add(bs, rbox(0.05, 0.05, 0.035, 0.008), MAT.black(), [0.3, 0.16, -0.55]); hose(bs, [[0.3, 0.14, -0.53], [0.22, 0.05, -0.45], [0.05, -0.08, -0.33]], 0.004, MAT.black()); }
    if (has('dpfSensor')) { const dps = part('dpfSensor'); add(dps, rbox(0.05, 0.04, 0.03, 0.006), MAT.black(), [0.15, 0.16, -0.56]); hose(dps, [[0.14, 0.14, -0.55], [0.12, -0.15, -0.5], [0.08, -0.4, -0.55]], 0.004, MAT.steel()); hose(dps, [[0.17, 0.14, -0.55], [0.16, -0.15, -0.55], [0.1, -0.42, -0.8]], 0.004, MAT.steel()); }

    /* motor */
    const blk = part('block'); const bmat = MAT.cast(); add(blk, rbox(0.6, 0.4, 0.34, 0.015), bmat, [0.05, -0.13, 0]); for (let i = 0; i < 5; i++) add(blk, rbox(0.012, 0.32, 0.012, 0.004), bmat, [-0.2 + i * 0.125, -0.13, 0.172]); xrayMats.push(bmat);
    const pan = part('oilPan'); const pm = MAT.alu(); add(pan, rbox(0.56, 0.12, 0.3, 0.02), pm, [0.05, -0.39, 0]); bolt(pan, [0.05, -0.455, 0.05]); xrayMats.push(pm);
    const op = part('oilPump'); add(op, rbox(0.12, 0.06, 0.1, 0.01), M(0x9aa0a6, { metalness: 0.7 }), [0.1, -0.37, 0.04]); add(op, cylY(0.012, 0.08, 10), MAT.steel(), [0.1, -0.41, -0.02]);
    const osw = part('oilSwitch'); add(osw, cylZ(0.012, 0.03, 12), MAT.steel(), [0.26, -0.22, 0.18]); add(osw, rbox(0.018, 0.018, 0.012, 0.003), MAT.black(), [0.26, -0.22, 0.2]);
    const head = part('head'); const hm = MAT.alu(), vc = MAT.dark(); add(head, rbox(0.62, 0.13, 0.33, 0.01), hm, [0.05, 0.135, 0]); const vcg = has('camLifters') ? part('camLifters') : head; add(vcg, rbox(0.6, 0.08, 0.29, 0.025), vc, [0.05, 0.24, 0]); for (let i = 0; i < 6; i++) { bolt(vcg, [-0.22 + i * 0.108, 0.283, 0.13]); bolt(vcg, [-0.22 + i * 0.108, 0.283, -0.12]); } if (has('camLifters')) { add(vcg, cylX(0.018, 0.56, 16), MAT.steel(), [0.05, 0.215, -0.05]); CYLX.forEach(x => { add(vcg, cylY(0.014, 0.03, 12), MAT.steel(), [0.05 + x - 0.03, 0.2, -0.05]); add(vcg, cylY(0.014, 0.03, 12), MAT.steel(), [0.05 + x + 0.03, 0.2, -0.05]); }); } if (has('headGasket')) { const hg = part('headGasket'); add(hg, rbox(0.64, 0.008, 0.36, 0.002), M(0x8a7d6a, { metalness: 0.6, roughness: 0.5 }), [0.05, 0.07, 0]); } xrayMats.push(hm, vc);
    const cmp = part('cmp'); add(cmp, cylX(0.012, 0.04, 12), MAT.black(), [-0.28, 0.2, -0.08]);
    if (has('glow')) { const glow = part('glow'); CYLX.forEach(x => { add(glow, cylZ(0.008, 0.05, 8), anim.glowMat, [0.05 + x, 0.16, 0.18]); hose(glow, [[0.05 + x, 0.16, 0.205], [0.05 + x, 0.19, 0.22], [0.05 + x + 0.04, 0.2, 0.21]], 0.003, MAT.black()); }); }
    if (cfg.fuel === 'diesel') { const inj = part('injectors'); CYLX.forEach(x => { add(inj, cylY(0.012, 0.11, 14), MAT.steel(), [0.05 + x, 0.27, 0.06]); add(inj, rbox(0.022, 0.02, 0.03, 0.004), MAT.black(), [0.05 + x, 0.33, 0.06]); }); }
    if (has('rail')) { const rail = part('rail'); add(rail, cylX(0.016, 0.52, 16), MAT.steel(), [0.05, 0.3, 0.15]); add(rail, cylX(0.01, 0.04, 10), MAT.black(), [0.33, 0.3, 0.15]); }
    if (cfg.inj === 'cr') { const il = part('injLines'); CYLX.forEach(x => hose(il, [[0.05 + x, 0.3, 0.135], [0.05 + x, 0.32, 0.1], [0.05 + x, 0.315, 0.07]], 0.004, MAT.steel())); hose(il, [[-0.2, 0.3, 0.15], [-0.25, 0.2, 0.0], [-0.18, 0.02, -0.18]], 0.005, MAT.steel()); }
    if (has('hpPump')) { const hpp = part('hpPump'); add(hpp, cylX(0.05, 0.12, 24), MAT.alu(), [-0.18, 0.0, -0.21]); add(hpp, rbox(0.04, 0.04, 0.04, 0.006), MAT.black(), [-0.1, 0.04, -0.21]); }
    if (cfg.fuel === 'diesel') { const ff = part('fuelFilter'); add(ff, cylY(0.045, 0.15, 24), MAT.green(), [0.63, 0.05, 0.28]); add(ff, cylY(0.05, 0.025, 24), MAT.black(), [0.63, 0.14, 0.28]); }
    if (has('fuelLine')) { const fl = part('fuelLine'); hose(fl, [[0.63, 0.15, 0.3], [0.5, 0.22, 0.32], [0.2, 0.24, 0.3], [-0.1, 0.12, 0.0], [-0.13, 0.03, -0.2]], 0.006, MAT.black()); hose(fl, [[0.63, -0.03, 0.28], [0.66, -0.2, 0.2], [0.66, -0.4, -0.3], [0.4, -0.46, -0.6]], 0.006, MAT.black()); }
    const im = part('intakeManifold'); const imm = MAT.black(); add(im, rbox(0.52, 0.06, 0.06, 0.02), imm, [0.05, 0.06, 0.215]); CYLX.forEach(x => add(im, rbox(0.06, 0.07, 0.04, 0.012), imm, [0.05 + x, 0.1, 0.19])); xrayMats.push(imm);
    if (has('egr')) { const egr = part('egr'); add(egr, rbox(0.08, 0.08, 0.07, 0.01), MAT.alu(), [-0.24, 0.09, 0.23]); add(egr, cylY(0.03, 0.06), MAT.black(), [-0.24, 0.16, 0.23]); }
    const th = part('thermostat'); add(th, rbox(0.06, 0.05, 0.05, 0.01), MAT.black(), [-0.22, 0.14, 0.2]);
    if (cfg.turbo) { const tb = part('turbo'); add(tb, new THREE.TorusGeometry(0.05, 0.032, 14, 28).rotateY(Math.PI / 2), MAT.exhaust(), [0.0, -0.02, -0.28]); add(tb, new THREE.TorusGeometry(0.055, 0.03, 14, 28).rotateY(Math.PI / 2), MAT.alu(), [0.17, -0.02, -0.28]); add(tb, cylX(0.035, 0.12), MAT.steel(), [0.085, -0.02, -0.28]); add(tb, rbox(0.26, 0.012, 0.16, 0.004), MAT.steel(), [0.06, 0.07, -0.27]); add(tb, rbox(0.03, 0.03, 0.05, 0.005), MAT.dark(), [0.0, -0.1, -0.28]); }
    if (has('lambda')) { const lam = part('lambda'); hose(lam, [[-0.02, -0.08, -0.3], [-0.02, -0.25, -0.36], [0.03, -0.42, -0.42], [0.05, -0.47, -0.5]], 0.03, MAT.exhaust()); add(lam, cylZ(0.009, 0.05, 10).rotateX(0.6), MAT.steel(), [0.0, -0.32, -0.38]); hose(lam, [[0.0, -0.3, -0.36], [0.05, -0.15, -0.45], [0.15, 0.1, -0.55]], 0.003, MAT.black()); }
    if (has('dpf')) { const dpf = part('dpf'); add(dpf, cylZ(0.075, 0.36, 32), MAT.steel(), [0.05, -0.47, -0.68]); hose(dpf, [[0.05, -0.47, -0.86], [0.06, -0.48, -1.3], [0.2, -0.5, -2.2], [0.5, -0.5, -3.1]], 0.025, MAT.exhaust()); }
    const gb = part('gearbox'); const gbm = MAT.alu(); add(gb, latheX([[0.12, -0.09], [0.215, -0.07], [0.215, 0.07], [0.17, 0.09]]), gbm, [-0.34, -0.15, 0]); add(gb, rbox(0.26, 0.3, 0.32, 0.03), gbm, [-0.55, -0.18, 0]); add(gb, cylX(0.05, 0.1), gbm, [-0.7, -0.25, 0.0]); add(gb, rbox(0.1, 0.1, 0.12, 0.02), gbm, [-0.45, -0.32, -0.2]); xrayMats.push(gbm);
    const ds = part('driveshaft'); add(ds, cylX(0.018, 0.16, 12), MAT.steel(), [-0.76, -0.31, 0.0]); add(ds, latheX([[0.02, -0.03], [0.04, -0.015], [0.035, 0.0], [0.04, 0.015], [0.02, 0.03]], 20), MAT.rubber(), [-0.71, -0.29, 0.0]);
    const mnt = part('engineMount'); add(mnt, rbox(0.12, 0.08, 0.12, 0.015), MAT.black(), [0.5, 0.24, 0.08]); add(mnt, rbox(0.15, 0.03, 0.06, 0.006), MAT.steel(), [0.39, 0.24, 0.08]);
    const oil = part('oil'); add(oil, cylY(0.028, 0.03), MAT.yellow(), [0.3, 0.42, -0.06]); add(oil, cylY(0.012, 0.06, 10), MAT.black(), [0.3, 0.38, -0.06]); add(oil, new THREE.TorusGeometry(0.022, 0.006, 8, 20), MAT.yellow(), [-0.12, 0.44, 0.2]); add(oil, cylY(0.005, 0.24, 6), MAT.steel(), [-0.12, 0.31, 0.2]);
    const ckp = part('ckp'); add(ckp, cylZ(0.012, 0.04, 12), MAT.black(), [-0.24, -0.26, -0.18]); hose(ckp, [[-0.24, -0.26, -0.2], [-0.3, -0.15, -0.3], [-0.5, 0.0, -0.3]], 0.003, MAT.black());

    /* interior: arbore cotit, pistoane, volant, ambreiaj */
    const fw = part('flywheel'); add(fw, cylX(0.17, 0.03, 40), M(0x555a60, { metalness: 0.85 }), [-0.3, -0.15, 0]); add(fw, new THREE.TorusGeometry(0.172, 0.01, 8, 48).rotateY(Math.PI / 2), MAT.steel(), [-0.3, -0.15, 0]); add(fw, rbox(0.012, 0.06, 0.02, 0.004), M(0xf0a020), [-0.315, -0.02, 0]); anim.flywheel = fw;
    const cl = part('clutch'); add(cl, cylX(0.15, 0.02, 36), M(0x8a7a62, { roughness: 0.8 }), [-0.33, -0.15, 0]); add(cl, cylX(0.16, 0.02, 36), MAT.steel(), [-0.355, -0.15, 0]); add(cl, cylX(0.035, 0.04, 20), MAT.alu(), [-0.385, -0.15, 0]);
    const cr = part('crank'); add(cr, cylX(0.025, 0.66), M(0x6d7278, { metalness: 0.8 }), [0.05, -0.15, 0]); CYLX.forEach(x => add(cr, rbox(0.03, 0.09, 0.06, 0.01), M(0x6d7278, { metalness: 0.8 }), [0.05 + x, -0.15, 0])); anim.crank = cr;
    const ps = part('pistons'); anim.pistons = []; CYLX.forEach((x, i) => { const m = add(ps, cylY(0.06, 0.08, 28), M(0xb7bcc2, { metalness: 0.75 }), [0.05 + x, 0.02, 0]); m.userData.phase = (i === 0 || i === 3) ? 0 : Math.PI; anim.pistons.push(m); });
    anim.xrayOnly = [cr, ps];

    /* curea */
    const cp = part('crankPulley'); add(cp, pulleyGeo(0.08, 0.035, 6), M(0x55595e, { metalness: 0.75, roughness: 0.35 }), [0.43, -0.15, 0]); add(cp, rbox(0.045, 0.1, 0.015, 0.004), M(0xf0a020), [0.452, -0.15, 0]); anim.crankPulley = cp;
    const ac = part('acComp'); add(ac, cylX(0.07, 0.16), MAT.alu(), [0.33, -0.22, 0.24]); anim.acPulley = add(ac, pulleyGeo(0.055, 0.03, 6), MAT.dark(), [0.43, -0.22, 0.24]);
    const tn = part('tensioner'); add(tn, rbox(0.03, 0.14, 0.03, 0.008), MAT.dark(), [0.42, -0.06, 0.28]); anim.tensPulley = add(tn, latheX([[0.004, -0.016], [0.03, -0.015], [0.03, 0.015], [0.004, 0.016]], 32), MAT.steel(), [0.43, -0.02, 0.3]);
    const belt = part('belt'); const bpts = [[-0.15, -0.085], [-0.21, -0.06], [-0.235, 0], [-0.21, 0.06], [-0.24, 0.18], [-0.28, 0.24], [-0.24, 0.3], [-0.12, 0.32], [-0.02, 0.335], [0.06, 0.3], [0.13, 0.245], [0.14, 0.21], [0.13, 0.175], [0.06, 0.12], [-0.08, 0.05], [-0.13, -0.06]];
    { const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bpts.map(([y, z]) => new THREE.Vector3(0.43, y, z)), true), 160, 0.008, 6, true); geo.scale(2.2, 1, 1); geo.translate(-0.43 * 1.2, 0, 0); add(belt, geo, MAT.rubber()); }
    const alt = part('alternator'); add(alt, latheX([[0.004, -0.085], [0.06, -0.085], [0.075, -0.07], [0.077, 0.05], [0.07, 0.075], [0.035, 0.085], [0.004, 0.085]], 40), MAT.alu(), [0.31, 0.1, 0.21]);
    for (let k = 0; k < 12; k++) { const a = k * Math.PI * 2 / 12; add(alt, rbox(0.1, 0.008, 0.016, 0.003), MAT.dark(), [0.3, 0.1 + 0.077 * Math.cos(a), 0.21 + 0.077 * Math.sin(a)], [a, 0, 0]); }
    anim.altPulley = add(alt, pulleyGeo(0.035, 0.03, 6), MAT.dark(), [0.42, 0.1, 0.21]);
    const altC = part('altConn'); add(altC, cylX(0.012, 0.03, 10), MAT.red(), [0.22, 0.16, 0.26]); add(altC, rbox(0.04, 0.03, 0.03, 0.006), MAT.black(), [0.22, 0.06, 0.27]); hose(altC, [[0.21, 0.16, 0.27], [0.0, 0.21, 0.4], [-0.3, 0.21, 0.45], [-0.42, 0.145, 0.42]], 0.008, MAT.red());

    /* baterie */
    const bat = part('battery'); add(bat, rbox(0.26, 0.2, 0.17, 0.012), M(0x202226, { roughness: 0.8, metalness: 0 }), [-0.5, 0.0, 0.38]); add(bat, new THREE.PlaneGeometry(0.22, 0.11), M(0xffffff, { map: TEX.battery, roughness: 0.6, metalness: 0 }), [-0.5, 0.101, 0.38], [-Math.PI / 2, 0, 0]);
    add(bat, new THREE.CylinderGeometry(0.013, 0.016, 0.03, 16), MAT.steel(), [-0.42, 0.115, 0.42]); add(bat, new THREE.CylinderGeometry(0.013, 0.016, 0.03, 16), MAT.steel(), [-0.58, 0.115, 0.42]);
    const clamp = part('batClamp'); add(clamp, rbox(0.28, 0.015, 0.02, 0.004), MAT.steel(), [-0.5, 0.105, 0.33]); add(clamp, cylY(0.005, 0.13, 8), MAT.steel(), [-0.36, 0.04, 0.33]); add(clamp, cylY(0.005, 0.13, 8), MAT.steel(), [-0.64, 0.04, 0.33]);
    const bp = part('batPos'); add(bp, rbox(0.045, 0.03, 0.035, 0.006), MAT.red(), [-0.42, 0.135, 0.42]);
    const bn = part('batNeg'); add(bn, rbox(0.045, 0.03, 0.035, 0.006), MAT.black(), [-0.58, 0.135, 0.42]); hose(bn, [[-0.6, 0.14, 0.42], [-0.66, 0.1, 0.42], [-0.72, 0.0, 0.3]], 0.007, MAT.black());
    const bc = part('batteryCover'); add(bc, rbox(0.29, 0.025, 0.2, 0.008), MAT.black(), [-0.5, 0.165, 0.38]);
    const pc = part('posCable'); hose(pc, [[-0.42, 0.15, 0.43], [-0.36, 0.0, 0.53], [-0.33, -0.29, 0.3], [-0.28, -0.3, -0.1], [-0.1, -0.06, -0.27]], 0.011, M(0xb22222, { roughness: 0.6 }));

    /* demaror */
    const st = part('starter'); add(st, latheX([[0.004, -0.1], [0.045, -0.1], [0.05, -0.09], [0.05, 0.09], [0.045, 0.1], [0.004, 0.1]], 32), MAT.dark(), [-0.17, -0.13, -0.26]); add(st, cylX(0.053, 0.02, 28), MAT.steel(), [-0.07, -0.13, -0.26]); add(st, cylX(0.04, 0.04, 28), MAT.alu(), [-0.26, -0.13, -0.26]);
    anim.pinion = add(st, cylX(0.022, 0.03, 12), MAT.steel(), [-0.295, -0.13, -0.26]);
    const sol = part('solenoid'); add(sol, latheX([[0.004, -0.07], [0.027, -0.07], [0.03, -0.06], [0.03, 0.06], [0.027, 0.07], [0.004, 0.07]], 28), MAT.alu(), [-0.18, -0.055, -0.26]); add(sol, cylX(0.008, 0.02, 8), MAT.copper(), [-0.1, -0.04, -0.26]); add(sol, cylX(0.008, 0.02, 8), MAT.copper(), [-0.1, -0.07, -0.26]);
    const sc = part('starterConn'); add(sc, rbox(0.02, 0.022, 0.022, 0.005), MAT.red(), [-0.085, -0.04, -0.26]); add(sc, rbox(0.02, 0.012, 0.012, 0.003), MAT.yellow(), [-0.085, -0.07, -0.26]);
    const ut = part('undertray'); add(ut, rbox(1.3, 0.015, 1.0, 0.006), M(0xffffff, { map: TEX.tray, roughness: 0.85, metalness: 0 }), [0, -0.5, 0.05]); [-0.55, 0.55].forEach(x => [-0.35, 0.45].forEach(z => bolt(ut, [x, -0.51, z])));
    const gs = part('groundStrap'); hose(gs, [[-0.24, -0.25, 0.18], [-0.4, -0.3, 0.25], [-0.6, -0.25, 0.25], [-0.72, -0.2, 0.2]], 0.009, M(0x6b5a3a, { roughness: 0.9 }));
    const ec = part('engineCover'); const ecm = MAT.black(); add(ec, rbox(0.58, 0.06, 0.34, 0.025), ecm, [0.05, 0.375, 0.0]); add(ec, new THREE.PlaneGeometry(0.4, 0.2), M(0xffffff, { map: TEX.cover, roughness: 0.6, metalness: 0.1 }), [0.05, 0.4062, 0.0], [-Math.PI / 2, 0, 0]); xrayMats.push(ecm);

    /* puntea spate (4x4) */
    if (cfg.awd) { const prop = part('propShaft'); add(prop, cylZ(0.03, 2.1, 16), MAT.steel(), [-0.2, -0.43, -1.4]).rotation.y = -0.17; add(prop, cylZ(0.045, 0.06, 16), MAT.dark(), [-0.38, -0.4, -0.35]); }
    if (cfg.awd) { const rd = part('rearDiff'); add(rd, latheX([[0.02, -0.09], [0.11, -0.06], [0.12, 0.0], [0.11, 0.06], [0.03, 0.09]], 32).rotateY(Math.PI / 2), MAT.cast(), [0, -0.4, -2.55]); add(rd, rbox(0.22, 0.18, 0.16, 0.03), MAT.cast(), [0, -0.4, -2.68]); add(rd, cylX(0.03, 1.2, 16), MAT.steel(), [0, -0.36, -2.69]); }
    const rw = part('rearWheel'); wheel(rw, -0.82, -2.69);
    const rb = part('rearBearing'); add(rb, cylX(0.07, 0.07, 28), MAT.steel(), [-0.66, -0.34, -2.69]); add(rb, cylX(0.09, 0.015, 28), MAT.dark(), [-0.7, -0.34, -2.69]);


    /* ---------- specific mașinii ---------- */
    const E = (pts, r, mat, g) => hose(g, pts, r, mat);
    if (!cfg.turbo) { const em = part('exhManifold'); CYLX.forEach(x => E([[0.05 + x, 0.1, -0.17], [0.05 + x * 0.6, 0.02, -0.25], [-0.02, -0.06, -0.3]], 0.022, MAT.exhaust(), em)); }
    if (has('ectSensor')) { const ect = part('ectSensor'); add(ect, cylZ(0.008, 0.03, 10), MAT.steel(), [-0.22, 0.17, 0.235]); add(ect, rbox(0.02, 0.015, 0.02, 0.004), cfg.id === 'golf4' ? MAT.blue() : MAT.black(), [-0.22, 0.17, 0.255]); }
    if (cfg.inj === 've') {
      const ip = part('injPump'); add(ip, cylX(0.06, 0.16, 28), MAT.alu(), [0.26, -0.06, 0.2]); add(ip, rbox(0.07, 0.07, 0.06, 0.01), MAT.alu(), [0.15, -0.02, 0.2]); add(ip, rbox(0.04, 0.03, 0.03, 0.006), MAT.black(), [0.15, 0.03, 0.2]);
      const il2 = part('injLines'); CYLX.forEach((x, i) => E([[0.15 - i * 0.012, 0.0, 0.22], [0.12, 0.2, 0.24], [0.05 + x, 0.26, 0.12], [0.05 + x, 0.3, 0.07]], 0.004, MAT.steel(), il2));
    }
    if (cfg.fuel === 'petrol') {
      const pinj = part('injectors'); CYLX.forEach(x => add(pinj, cylY(0.01, 0.06, 12).rotateX(0.5), MAT.dark(), [0.05 + x, 0.14, 0.215]));
      const fr = part('fuelRail'); add(fr, cylX(0.011, 0.52, 12), MAT.steel(), [0.05, 0.17, 0.235]); E([[0.31, 0.17, 0.235], [0.5, 0.15, 0.3], [0.6, -0.3, 0.1], [0.4, -0.47, -1.5]], 0.005, MAT.black(), fr);
      const pm2 = part('mapSensor'); add(pm2, rbox(0.035, 0.03, 0.04, 0.006), MAT.black(), [0.2, 0.11, 0.25]);
      const th2 = part('throttle'); add(th2, cylX(0.04, 0.07, 24), MAT.alu(), [-0.24, 0.1, 0.22]); add(th2, rbox(0.05, 0.06, 0.05, 0.01), MAT.black(), [-0.24, 0.16, 0.22]); E([[-0.27, 0.1, 0.22], [-0.38, 0.14, 0.12], [-0.42, 0.15, -0.05]], 0.035, MAT.black(), th2);
      if (cfg.isc) { const isc = part('isc'); add(isc, cylZ(0.016, 0.05, 14), MAT.black(), [-0.24, 0.05, 0.27]); }
      const vh = part('vacHose'); E([[0.25, 0.28, -0.05], [0.3, 0.2, 0.15], [0.32, 0.12, 0.22]], 0.007, MAT.rubber(), vh);
      const sp = part('sparkPlugs'); CYLX.forEach(x => { add(sp, cylY(0.008, 0.06, 10), MAT.steel(), [0.05 + x, 0.25, 0.0]); add(sp, cylY(0.011, 0.04, 12), M(0xf3f1ea, { roughness: 0.3 }), [0.05 + x, 0.29, 0.0]); });
      const ht = part('htLeads'); const cx = cfg.ign === 'dist' ? -0.31 : -0.33, cy = cfg.ign === 'dist' ? 0.18 : 0.3, cz = cfg.ign === 'dist' ? 0.1 : -0.08;
      CYLX.forEach((x, i) => E([[0.05 + x, 0.31, 0.0], [0.05 + x, 0.345, -0.03 - i * 0.01], [cx + 0.03, cy + 0.02, cz]], 0.005, M(0x1f2a44, { roughness: 0.7 }), ht));
      if (cfg.ign === 'dist') { const di = part('distributor'); add(di, cylX(0.045, 0.08, 24), MAT.dark(), [-0.31, 0.18, 0.1]); add(di, cylX(0.05, 0.03, 24), MAT.black(), [-0.35, 0.18, 0.1]);
        const co = part('coil'); add(co, cylY(0.03, 0.1, 18), MAT.black(), [-0.45, 0.06, -0.42]); E([[-0.45, 0.115, -0.42], [-0.42, 0.22, -0.2], [-0.36, 0.2, 0.1]], 0.005, M(0x1f2a44), co); }
      else { const co = part('coil'); add(co, rbox(0.1, 0.05, 0.08, 0.01), MAT.black(), [-0.33, 0.29, -0.08]); }
      if (cfg.sai) { const sai = part('saiPump'); add(sai, cylX(0.05, 0.11, 20), MAT.black(), [-0.36, 0.38, -0.08]); E([[-0.42, 0.38, -0.08], [-0.45, 0.2, -0.25], [-0.1, -0.05, -0.3]], 0.012, MAT.rubber(), sai); }
      const kn = part('knock'); add(kn, cylZ(0.015, 0.02, 12), MAT.steel(), [0.0, -0.18, -0.18]);
      const ffp = part('fuelFilter'); add(ffp, cylZ(0.035, 0.14, 20), MAT.steel(), [0.4, -0.47, -1.45]);
      const tank = part('tank'); add(tank, rbox(0.9, 0.22, 0.5, 0.05), MAT.black(), [0.1, -0.42, -1.95]);
      const fp = part('fuelPump'); add(fp, cylY(0.07, 0.04, 24), MAT.dark(), [0.3, -0.55, -1.95]); add(fp, rbox(0.03, 0.02, 0.03, 0.005), MAT.black(), [0.3, -0.58, -1.95]);
      const cat = part('cat'); add(cat, cylZ(0.08, 0.28, 32), MAT.steel(), [0.05, -0.47, -0.66]); E([[0.05, -0.47, -0.8], [0.06, -0.48, -1.3], [0.4, -0.5, -2.4], [0.5, -0.5, -3.1]], 0.025, MAT.exhaust(), cat);
      const l2 = part('lambda2'); add(l2, cylY(0.009, 0.05, 10), MAT.steel(), [0.05, -0.41, -0.84]); E([[0.05, -0.39, -0.84], [0.1, -0.3, -0.7], [0.15, 0.1, -0.56]], 0.003, MAT.black(), l2);
    }
    if (cfg.timing === 'belt') {
      const tc = part('timingCover'); add(tc, rbox(0.035, 0.42, 0.3, 0.02), MAT.black(), [0.385, 0.06, -0.02]);
      const tbelt = part('timingBelt'); add(tbelt, tubeGeo([[0.37, -0.15, 0.07], [0.37, 0.25, 0.1], [0.37, 0.28, -0.05], [0.37, 0.23, -0.12], [0.37, -0.15, -0.07], [0.37, -0.22, 0.0]], 0.007, true, 80).scale(1, 1, 1), M(0x161616, { roughness: 0.9 }));
      add(tbelt, cylX(0.06, 0.025, 28), MAT.steel(), [0.37, 0.24, -0.02]);
      const wp = part('waterPump'); add(wp, cylX(0.04, 0.03, 24), MAT.alu(), [0.365, 0.02, -0.06]);
    }
    if (!has('lambda')) { const ex = part('exhaust'); E([[-0.02, -0.08, -0.3], [-0.02, -0.25, -0.36], [0.05, -0.47, -0.5], [0.06, -0.48, -1.3], [0.4, -0.5, -2.4], [0.5, -0.5, -3.1]], 0.025, MAT.exhaust(), ex); add(ex, cylZ(0.07, 0.3, 24), MAT.steel(), [0.25, -0.5, -2.0]); }
    if (!cfg.awd) { const ra = part('rearAxle'); add(ra, rbox(1.4, 0.08, 0.1, 0.02), MAT.dark(), [0, -0.36, -2.6]); }
    /* banc */
    const bench = part('bench'); add(bench, rbox(0.8, 0.05, 0.5, 0.01), M(0x7a5a3a, { roughness: 0.8, metalness: 0 }), [1.65, 0.17, 0.3]); [[-0.35, -0.2], [0.35, -0.2], [-0.35, 0.2], [0.35, 0.2]].forEach(([dx, dz]) => add(bench, rbox(0.04, 0.86, 0.04, 0.008), MAT.dark(), [1.65 + dx, -0.27, 0.3 + dz]));
    allMats.forEach(m => { m.userData.orig = { t: m.transparent, o: m.opacity, dw: m.depthWrite }; });
    setXray(false);
  }

  /* ---------- poziții de demontare ---------- */
  const BENCH_OFF = { starter: new THREE.Vector3(1.8, 0.38, 0.56) };
  const LIFT = new THREE.Vector3(0, 1.0, 0.35), DROP = new THREE.Vector3(0.0, -0.08, 1.4);
  const LOW = new Set(['undertray', 'oilPan', 'oilPump', 'driveshaft', 'gearbox', 'clutch', 'flywheel', 'propShaft', 'rearDiff', 'rearWheel', 'rearBearing', 'lambda', 'dpf', 'ckp', 'icHose', 'turbo']);
  function posOf(id) { const p = PARTS[id]; const out = () => (LOW.has(id) ? (id.startsWith('rear') || id === 'propShaft' ? new THREE.Vector3(1.2, -0.2, 0) : DROP.clone()) : LIFT.clone());
    if (p.state === 'bench') return BENCH_OFF[id].clone();
    if (p.state === 'out') { const base = (p.attach && PARTS[p.attach].state === 'bench') ? BENCH_OFF[p.attach].clone().add(LIFT) : out(); return base; }
    if (p.attach && PARTS[p.attach].state === 'bench') return BENCH_OFF[p.attach].clone(); return new THREE.Vector3(); }
  const tweens = [];
  function syncPart(id, ms = 650) { const g = groups[id]; if (!g) return; const p = PARTS[id]; const to = posOf(id); if (p.state !== 'out') g.visible = true;
    tweens.push({ g, from: g.position.clone(), to, t: 0, dur: ms / 1000, done: () => { if (p.state === 'out') g.visible = false; } });
    Object.keys(PARTS).forEach(k => { if (PARTS[k].attach === id) syncPart(k, ms); }); }
  function resetParts() { Object.keys(PARTS).forEach(k => { if (!groups[k]) return; PARTS[k].state = 'in'; groups[k].position.set(0, 0, 0); groups[k].visible = true; }); tweens.length = 0; }
  let xray = false, focus = null;
  function applyLook() {
    allMats.forEach(m => { const o = m.userData.orig || { t: false, o: 1, dw: true }; m.transparent = o.t; m.opacity = o.o; m.depthWrite = o.dw; });
    if (xray) xrayMats.forEach(m => { m.transparent = true; m.opacity = 0.16; m.depthWrite = false; });
    anim.xrayOnly.forEach(g => g.visible = xray || !!focus);
    if (focus) Object.entries(groups).forEach(([id, g]) => { if (focus.includes(id) || id === 'body' || id === 'bench') return; g.traverse(o => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = Math.min(o.material.opacity, 0.09); o.material.depthWrite = false; } }); });
    if (groups.body) groups.body.visible = !focus; if (hoodPivot) hoodPivot.visible = !focus; if (hoodStrut) hoodStrut.visible = !focus; env.forEach(o => o.visible = !focus); if (groups.bench) groups.bench.visible = !focus;
    allMats.forEach(m => m.needsUpdate = true);
  }
  function setXray(on) { xray = on; applyLook(); }
  function setFocus(ids) { focus = ids && ids.length ? ids : null; applyLook(); setHighlight(focus || [], 0xff7a00, 0.9); }
  function setHighlight(ids, color, inten = 0.22) { Object.entries(groups).forEach(([id, g]) => { const on = ids.includes(id); g.traverse(o => { if (o.isMesh && o.material && o.material.emissive && o.material !== anim.glowMat) { o.material.emissive.setHex(on ? color : 0x000000); o.material.emissiveIntensity = on ? inten : 1; } }); }); }

  /* ---------- camere și capotă ---------- */
  const VIEWS = { def: [[0.12, 0.98, 1.62], [0, -0.06, 0.05]], top: [[0.02, 1.6, 0.32], [0, -0.06, 0.02]], right: [[1.35, 1.05, 0.55], [0.33, -0.08, 0.1]], left: [[-1.35, 1.1, 0.7], [-0.42, -0.04, 0.15]], below: [[0.6, -1.5, 1.05], [0, -0.32, -0.05]], rear: [[-1.25, -1.4, -3.75], [0, -0.4, -2.62]], front: [[0.35, 0.3, 1.25], [0, -0.08, 0]] };
  let camTween = null, hoodAngle = -1.15, hoodTarget = -1.15, hoodDelay = 0;
  let lift = 0, liftT = 0; const LIFT_DROP = 1.35;
  const W = a => root.localToWorld(new THREE.Vector3(...a));
  function setView(k) { camTween = null; liftT = (k === 'below' || k === 'rear') ? 1 : 0; lift = liftT; applyLift(); const [p, tg] = VIEWS[k]; root.updateMatrixWorld(true); camera.position.copy(W(p)); if (lift) camera.position.y = p[1]; controls.target.copy(W(tg)); controls.update(); }
  const underLamp = new THREE.PointLight(0xfff2d8, 0, 4, 1.4); underLamp.position.set(0.2, -1.25, -0.6); scene.add(underLamp);
  function applyLift() { underLamp.intensity = lift ? 7 : 0; underL.intensity = lift ? 0.9 : 0.45; const dy = -LIFT_DROP * lift; floorMesh.position.y = -0.7 + dy; env.forEach(o => { o.userData.y0 ??= o.position.y; o.position.y = o.userData.y0 + dy; }); if (groups.bench) groups.bench.userData.liftDy = dy; }
  function introHood() { liftT = lift = 0; applyLift(); hoodAngle = 0.035; hoodTarget = -1.15; hoodDelay = 0.6; camera.position.set(0.0, 0.55, 3.2); controls.target.set(0, 0.12, 0); controls.update();
    root.updateMatrixWorld(true); camTween = { from: camera.position.clone(), to: W(VIEWS.def[0]), tf: controls.target.clone(), tt: W(VIEWS.def[1]), t: -0.7, dur: 1.9 }; }
  function openHoodNow() { hoodAngle = hoodTarget = -1.15; hoodDelay = 0; }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function updateHood(dt) { if (hoodDelay > 0) hoodDelay -= dt; else hoodAngle += (hoodTarget - hoodAngle) * Math.min(1, dt * 2.4); hoodPivot.rotation.x = hoodAngle; hoodPivot.updateMatrixWorld(true);
    _a.set(0.7, 0.19, -0.42); _b.set(0.7, -0.02, 0.42); hoodPivot.localToWorld(_b); root.worldToLocal(_b); const len = _a.distanceTo(_b); const dir = _b.clone().sub(_a); hoodStrut.position.copy(_a).add(_b).multiplyScalar(0.5); hoodStrut.scale.set(1, len, 1); hoodStrut.quaternion.setFromUnitVectors(_up, dir.normalize());
    lampLight.intensity = hoodAngle < -0.6 ? 4 : 0.3; }
  function render() { renderer.render(scene, camera); }
  function resize() { const r = canvas.getBoundingClientRect(); if (!r.width) return; renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); }

  /* ---------- selecție ---------- */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const isVisible = o => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
  function pickAt(ev) { const r = canvas.getBoundingClientRect(); ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1; ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1; ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(pickables.filter(isVisible), false); for (const hit of hits) { const id = hit.object.userData.part; if (focus && !focus.includes(id)) continue; if (id && PARTS[id]) return id; } return null; }

  /* ---------- animație ---------- */
  let crankAngle = 0, curRpm = 0, pinionOut = 0;
  function update(dt, st) { // st: {rpm, pinion, glow, fan}
    updateHood(dt);
    if (groups.bench && PARTS.bench) { const dy = (groups.bench.userData.liftDy || 0) / SC; if (!tweens.some(tw => tw.g === groups.bench)) groups.bench.position.y = dy; }
    if (camTween) { camTween.t += dt / camTween.dur; if (camTween.t > 0) { const k = Math.min(1, camTween.t), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; camera.position.lerpVectors(camTween.from, camTween.to, e); controls.target.lerpVectors(camTween.tf, camTween.tt, e); if (k >= 1) camTween = null; } }
    for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t += dt / tw.dur; const k = Math.min(1, tw.t); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; tw.g.position.lerpVectors(tw.from, tw.to, e); if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); } }
    curRpm += (st.rpm - curRpm) * Math.min(1, dt * 3); crankAngle += curRpm / 60 * Math.PI * 2 * dt;
    anim.crank.rotation.x = crankAngle; anim.flywheel.rotation.x = crankAngle; anim.crankPulley.rotation.x = crankAngle;
    anim.altPulley.rotation.x = crankAngle * 2.4; anim.acPulley.rotation.x = crankAngle * 1.45; anim.tensPulley.rotation.x = crankAngle * 2.7;
    pinionOut += ((st.pinion ? 1 : 0) - pinionOut) * Math.min(1, dt * 10); anim.pinion.position.x = -0.295 - 0.035 * pinionOut; if (st.pinion) anim.pinion.rotation.x += curRpm / 60 * Math.PI * 2 * dt * 9;
    anim.pistons.forEach(m => { m.position.y = 0.02 + 0.05 * Math.cos(crankAngle + m.userData.phase); });
    anim.glowMat.emissive.setHex(st.glow ? 0xff5a10 : 0x000000); anim.glowMat.emissiveIntensity = st.glow ? 1.4 : 1;
    if (st.fan) anim.fan.rotation.z += dt * 30;
    controls.update(); renderer.render(scene, camera);
  }
  function activate() { controls.enabled = true; }
  return { activate, build, setXray, setFocus, setHighlight, setView, introHood, openHoodNow, resetParts, syncPart, pickAt, update, resize, get xray() { return xray; } };
}
