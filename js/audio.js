// Sunete sintetizate cu Web Audio (fără fișiere)
export const audio = {
  ctx: null, master: null, on: true, idle: null, loops: [],
  init() {
    if (this.ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    this.master = this.ctx.createGain(); this.master.gain.value = this.on ? 0.7 : 0; this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2; const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noise = b;
  },
  ok() { return this.ctx && this.ctx.state !== 'closed'; },
  now() { return this.ctx ? this.ctx.currentTime : 0; },
  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? 0.7 : 0; },
  burst(t, dur, freq, type, gain, q = 1) {
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  click(t, g = 1) { this.burst(t, 0.045, 2600, 'bandpass', 0.9 * g, 2.5); this.burst(t, 0.13, 170, 'lowpass', 0.8 * g); },
  crank(t0, dur, speed) {
    const c = this.ctx; this.click(t0, 0.9);
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(40 * speed + 20, t0); o.frequency.linearRampToValueAtTime(110 * speed + 30, t0 + 0.35);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.12, t0 + 0.08); g.gain.setValueAtTime(0.12, t0 + dur - 0.05); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
    const step = 1 / (6.6 * Math.max(speed, 0.3)); for (let t = 0.18; t < dur; t += step) this.burst(t0 + t, 0.11, 240, 'lowpass', 0.55);
    return dur;
  },
  // Pornire: tipuri de rezultat la răsucirea cheii. Întoarce durata în secunde.
  play(kind, opt = {}) {
    if (!this.ok()) return 0; const t0 = this.now() + 0.05; const rpm = opt.rpm || 850;
    switch (kind) {
      case 'click': this.click(t0, 1.2); return 0.4;
      case 'chatter': for (let t = 0; t < 1.5; t += 0.075 + Math.random() * 0.02) this.click(t0 + t, 0.55); return 1.6;
      case 'dead': this.burst(t0, 0.02, 3000, 'bandpass', 0.08, 3); return 0.3;
      case 'slow': return this.crank(t0, 2.6, 0.45);
      case 'crankNoStart': return this.crank(t0, 3.2, 1);
      case 'start': case 'start-late': case 'startLong': case 'startRough': {
        const d = kind === 'start-late' ? 0.6 : kind === 'startLong' ? 2.6 : (opt.cold ? 1.6 : 0.9);
        const dur = this.crank(t0, d, 1); setTimeout(() => this.startIdle(rpm, { miss: kind === 'startRough' ? 0.22 : (opt.miss || 0) }), dur * 1000 - 80); return dur;
      }
      case 'stall': this.stopIdle(); return 0.6;
      case 'stop': this.stopIdle(); return 0.5;
    }
    return 0;
  },
  startIdle(rpm, o = {}) {
    if (!this.ok()) return; this.stopIdle(true); const c = this.ctx;
    const osc = c.createOscillator(); osc.type = 'sawtooth'; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const g = c.createGain(); g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.11, c.currentTime + 0.3);
    osc.connect(f); f.connect(g); g.connect(this.master); osc.start();
    const st = { o: osc, g, rpm, miss: o.miss || 0, next: c.currentTime + 0.05 }; osc.frequency.value = rpm / 30;
    st.timer = setInterval(() => {
      if (!this.ok()) return; const now = c.currentTime; const iv = 30 / st.rpm;
      while (st.next < now + 0.12) { if (Math.random() >= st.miss) { this.burst(st.next, 0.03, 1900, 'highpass', 0.10); this.burst(st.next, 0.07, 140, 'lowpass', 0.22); } st.next += iv * (st.miss ? 0.9 + Math.random() * 0.25 : 1); }
    }, 40);
    this.idle = st;
  },
  setRpm(r) { if (this.idle) { this.idle.rpm = Math.max(300, r); this.idle.o.frequency.setTargetAtTime(this.idle.rpm / 30, this.ctx.currentTime, 0.2); } },
  setMiss(m) { if (this.idle) this.idle.miss = m; },
  stopIdle(fast) {
    const st = this.idle; if (!st) return; this.idle = null; clearInterval(st.timer);
    try { st.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, fast ? 0.02 : 0.15); st.o.stop(this.ctx.currentTime + (fast ? 0.1 : 0.8)); } catch (e) {}
  },
  // Efecte de defect, cu durată
  sfx(kind, dur = 2.5) {
    if (!this.ok()) return 0; const c = this.ctx, t0 = this.now() + 0.05;
    const tone = (type, f0, f1, gain, lp) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.linearRampToValueAtTime(f1, t0 + dur); const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp || 4000; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.3); g.gain.setValueAtTime(gain, t0 + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t0 + dur); o.connect(fl); fl.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05); };
    const noiseLoop = (type, freq, gain, q = 1) => { const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.4); g.gain.setValueAtTime(gain, t0 + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(g); g.connect(this.master); s.start(t0); s.stop(t0 + dur + 0.05); return f; };
    switch (kind) {
      case 'hiss': { const f = noiseLoop('highpass', 3500, 0.12); f.frequency.linearRampToValueAtTime(5000, t0 + dur); break; }
      case 'whistle': tone('sine', 2600, 4200, 0.035); break;
      case 'hum': tone('triangle', 70, 140, 0.12, 400); break;
      case 'grind': { noiseLoop('bandpass', 380, 0.16, 3); tone('square', 45, 60, 0.04, 300); break; }
      case 'rattle': for (let t = 0; t < dur; t += 0.07 + Math.random() * 0.05) this.burst(t0 + t, 0.03, 900, 'bandpass', 0.25, 3); break;
      case 'squeal': tone('sawtooth', 1900, 2300, 0.03, 3000); break;
      case 'tick': for (let t = 0; t < dur; t += 0.09) this.burst(t0 + t, 0.015, 4000, 'highpass', 0.18); break;
      case 'knock': for (let t = 0; t < dur; t += 0.14) this.burst(t0 + t, 0.05, 500, 'bandpass', 0.45, 2); break;
      case 'clunk': this.burst(t0, 0.12, 200, 'lowpass', 0.9); break;
      case 'fan': noiseLoop('bandpass', 700, 0.08, 0.6); break;
    }
    return dur;
  }
};
