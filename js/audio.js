// Sintez qilingan ovoz dvigateli (WebAudio) — tashqi fayllarsiz
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const SHOT = {
  bolt:    { crack: [3000, 1.0, 0.09], body: [1300, 0.95, 0.35], thump: [140, 0.9, 0.22], tail: [700, 0.55, 1.5], mech: 'bolt' },
  smg:     { crack: [2600, 0.55, 0.05], body: [1500, 0.6, 0.13], thump: [125, 0.55, 0.09], tail: [800, 0.22, 0.5] },
  mg:      { crack: [2200, 0.7, 0.06], body: [1000, 0.85, 0.17], thump: [100, 0.8, 0.12], tail: [600, 0.3, 0.6] },
  pistol:  { crack: [3300, 0.6, 0.05], body: [1900, 0.55, 0.12], thump: [170, 0.5, 0.08], tail: [900, 0.2, 0.5] },
  ar:      { crack: [3600, 0.7, 0.05], body: [1700, 0.7, 0.15], thump: [110, 0.7, 0.12], tail: [800, 0.3, 0.7] },
  sniper:  { crack: [4200, 1.1, 0.11], body: [900, 1.05, 0.45], thump: [80, 1.0, 0.32], tail: [500, 0.65, 1.9], mech: 'bolt' },
  shotgun: { crack: [2000, 0.9, 0.08], body: [700, 1.05, 0.35], thump: [90, 1.0, 0.26], tail: [500, 0.5, 1.2], mech: 'pump' },
  rocket:  { crack: [900, 0.7, 0.35], body: [600, 1.1, 0.7], thump: [70, 1.0, 0.35], tail: [1800, 0.9, 1.3] },
  cannon:  { crack: [1500, 1.1, 0.12], body: [500, 1.3, 0.5], thump: [60, 1.3, 0.4], tail: [400, 0.7, 1.8] },
  gl:      { crack: [700, 0.5, 0.08], body: [350, 0.9, 0.18], thump: [95, 0.9, 0.16], tail: [400, 0.2, 0.4] },
  supp:    { crack: [1500, 0.2, 0.035], body: [700, 0.32, 0.09], thump: [150, 0.28, 0.06], tail: [500, 0.06, 0.25] },   // ovoz so'ndirgich
};

export class SoundEngine {
  constructor() { this.ctx = null; this.vol = 0.8; this.ambientNodes = []; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.vol;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    // Sun'iy aks-sado (reverb)
    const irLen = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const dd = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const rg = ctx.createGain(); rg.gain.value = 0.32;
    this.reverb.connect(rg); rg.connect(this.master);
  }

  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  get t() { return this.ctx.currentTime; }

  bus(dist = 0, pan = 0, rev = 0.25, gain = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = gain / (1 + dist * 0.045);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(450, 16000 / (1 + dist * 0.06));
    g.connect(lp);
    let last = lp;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      lp.connect(p); last = p;
    }
    last.connect(this.master);
    const rs = ctx.createGain();
    rs.gain.value = rev + Math.min(0.6, dist * 0.012);
    last.connect(rs); rs.connect(this.reverb);
    return g;
  }

  noise(dest, t, dur, o) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t + dur);
    f.Q.value = o.q || 0.7;
    const g = ctx.createGain();
    const a = o.attack || 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(dur, a + 0.01));
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }

  tone(dest, t, dur, o) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(10, o.freqEnd), t + dur);
    const g = ctx.createGain();
    const a = o.attack || 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(dur, a + 0.01));
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  // ---------- Qurollar ----------
  shot(kind, dist = 0, pan = 0, enemy = false) {
    if (!this.ctx) return;
    const p = SHOT[kind] || SHOT.ar;
    const t = this.t;
    const dest = this.bus(dist, pan, 0.22, enemy ? 0.8 : 1);
    const r = 0.92 + Math.random() * 0.16;
    this.noise(dest, t, p.crack[2], { type: 'highpass', freq: p.crack[0] * r, gain: p.crack[1] * 0.8 });
    this.noise(dest, t, p.body[2], { type: 'lowpass', freq: p.body[0] * r, freqEnd: p.body[0] * 0.3, gain: p.body[1] });
    this.tone(dest, t, p.thump[2], { type: 'sine', freq: p.thump[0] * r, freqEnd: 35, gain: p.thump[1] });
    this.noise(dest, t + 0.02, p.tail[2], { type: 'lowpass', freq: p.tail[0], freqEnd: 150, gain: p.tail[1] * 0.4, attack: 0.02 });
    if (!enemy && p.mech) this.mech(t + (p.mech === 'bolt' ? 0.42 : 0.3), p.mech);
  }

  mech(t, kind) {
    const dest = this.bus(0, 0.2, 0.05, 0.6);
    if (kind === 'bolt') {
      [0, 0.13, 0.32, 0.43].forEach((o, i) => {
        this.noise(dest, t + o, 0.035, { type: 'bandpass', freq: 2600 + i * 300, q: 3, gain: 0.55 });
        this.tone(dest, t + o, 0.04, { type: 'square', freq: 1500 + i * 200, gain: 0.05 });
      });
    } else {
      this.noise(dest, t, 0.07, { type: 'bandpass', freq: 1400, q: 2, gain: 0.7 });
      this.noise(dest, t + 0.17, 0.08, { type: 'bandpass', freq: 1800, q: 2, gain: 0.8 });
    }
  }

  reload(phase) {
    if (!this.ctx) return;
    const t = this.t, dest = this.bus(0, 0.15, 0.05, 0.7);
    if (phase === 'out') {
      this.noise(dest, t, 0.05, { type: 'bandpass', freq: 2200, q: 3, gain: 0.6 });
      this.tone(dest, t + 0.02, 0.06, { type: 'triangle', freq: 600, gain: 0.12 });
    } else {
      this.noise(dest, t, 0.05, { type: 'bandpass', freq: 1800, q: 3, gain: 0.8 });
      this.noise(dest, t + 0.18, 0.06, { type: 'bandpass', freq: 2800, q: 2, gain: 0.7 });
      this.tone(dest, t + 0.18, 0.05, { type: 'square', freq: 900, gain: 0.05 });
    }
  }

  empty() { if (!this.ctx) return; this.tone(this.bus(0, 0, 0, 0.5), this.t, 0.03, { type: 'square', freq: 2500, gain: 0.15 }); }

  explosion(dist = 0, pan = 0, big = false) {
    if (!this.ctx) return;
    const t = this.t, dest = this.bus(dist * 0.6, pan, 0.5, big ? 1.4 : 1.1);
    this.noise(dest, t, 1.9, { type: 'lowpass', freq: 1000, freqEnd: 60, gain: 1.6 });
    this.noise(dest, t, 0.25, { type: 'bandpass', freq: 1800, q: 0.5, gain: 0.9 });
    this.tone(dest, t, 1.1, { type: 'sine', freq: 75, freqEnd: 22, gain: 1.5 });
    this.noise(dest, t + 0.15, 1.6, { type: 'bandpass', freq: 3000, freqEnd: 700, gain: 0.12, attack: 0.1 });
  }

  whistle(delay = 0, dur = 1.0) {
    if (!this.ctx) return;
    const t = this.t + delay, dest = this.bus(10, (Math.random() - 0.5), 0.3, 0.7);
    this.tone(dest, t, dur, { type: 'sine', freq: 1500, freqEnd: 450, gain: 0.18, attack: 0.3 });
  }

  flyby(jet) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t, dur = 5;
    const dest = this.bus(0, 0, 0.4, 1);
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(jet ? 400 : 200, t);
    f.frequency.linearRampToValueAtTime(jet ? 2200 : 700, t + dur * 0.45);
    f.frequency.linearRampToValueAtTime(jet ? 300 : 150, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(jet ? 1.4 : 0.7, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t); s.stop(t + dur + 0.1);
    if (!jet) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(70, t + dur);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.25, t + dur * 0.45); og.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); lp.connect(og); og.connect(dest); o.start(t); o.stop(t + dur + 0.1);
    }
  }

  // ---------- Interfeys va o'yinchi ----------
  hit(head) {
    if (!this.ctx) return;
    const t = this.t, d = this.bus(0, 0, 0, 0.6);
    this.tone(d, t, 0.05, { type: 'square', freq: 1700, gain: 0.12 });
    this.noise(d, t, 0.03, { type: 'highpass', freq: 5000, gain: 0.25 });
    if (head) this.tone(d, t + 0.01, 0.22, { type: 'sine', freq: 2300, gain: 0.22 });
  }
  kill() {
    if (!this.ctx) return;
    const t = this.t, d = this.bus(0, 0, 0, 0.5);
    this.tone(d, t, 0.08, { type: 'triangle', freq: 900, gain: 0.2 });
    this.tone(d, t + 0.07, 0.12, { type: 'triangle', freq: 1400, gain: 0.2 });
  }
  hurt() {
    if (!this.ctx) return;
    const t = this.t, d = this.bus(0, 0, 0.05, 0.9);
    this.noise(d, t, 0.18, { type: 'lowpass', freq: 600, gain: 0.7 });
    this.tone(d, t, 0.16, { type: 'sine', freq: 110, freqEnd: 50, gain: 0.6 });
  }
  heartbeat() {
    if (!this.ctx) return;
    const t = this.t, d = this.bus(0, 0, 0, 0.8);
    this.tone(d, t, 0.12, { type: 'sine', freq: 62, freqEnd: 40, gain: 0.8 });
    this.tone(d, t + 0.22, 0.12, { type: 'sine', freq: 55, freqEnd: 38, gain: 0.6 });
  }
  // Boshqa odamning qadami: masofa va yo'nalishga qarab eshitiladi
  stepAt(era, dist = 0, pan = 0, sprint = false) {
    if (!this.ctx) return;
    const t = this.t, d = this.bus(dist * 1.6, pan, 0.06, sprint ? 1.25 : 0.95);
    this.noise(d, t, era === 'historical' ? 0.14 : 0.1, { type: 'bandpass', freq: (era === 'historical' ? 1500 : 950) + Math.random() * 500, q: 1.1, gain: 0.3, attack: 0.012 });
    this.tone(d, t, 0.06, { type: 'sine', freq: 95, freqEnd: 55, gain: 0.16 });
  }
  step(era, sprint) {
    if (!this.ctx) return;
    const t = this.t, d = this.bus(0, (Math.random() - 0.5) * 0.3, 0.02, sprint ? 0.7 : 0.5);
    if (era === 'historical') {
      this.noise(d, t, 0.14, { type: 'bandpass', freq: 1600 + Math.random() * 600, q: 0.9, gain: 0.22, attack: 0.02 });
    } else {
      this.noise(d, t, 0.1, { type: 'bandpass', freq: 1000 + Math.random() * 500, q: 1.2, gain: 0.18, attack: 0.01 });
    }
    this.noise(d, t, 0.08, { type: 'lowpass', freq: 220, gain: 0.35 });
  }
  land() { if (!this.ctx) return; const d = this.bus(0, 0, 0, 0.8); this.noise(d, this.t, 0.15, { type: 'lowpass', freq: 300, gain: 0.7 }); }
  whiz() {
    if (!this.ctx) return;
    const d = this.bus(0, (Math.random() - 0.5) * 1.6, 0.05, 0.7);
    this.noise(d, this.t, 0.16, { type: 'bandpass', freq: 4500, freqEnd: 1400, q: 4, gain: 0.5, attack: 0.04 });
  }
  impactNear() { if (!this.ctx) return; const d = this.bus(2, (Math.random() - 0.5), 0.05, 0.5); this.noise(d, this.t, 0.06, { type: 'bandpass', freq: 2500, q: 1.5, gain: 0.4 }); }
  knife() {
    if (!this.ctx) return;
    const d = this.bus(0, 0, 0.05, 0.8);
    this.noise(d, this.t, 0.22, { type: 'bandpass', freq: 3000, freqEnd: 600, q: 2, gain: 0.5, attack: 0.05 });
  }
  stab() { if (!this.ctx) return; const d = this.bus(0, 0, 0.05, 0.8); this.noise(d, this.t, 0.12, { type: 'lowpass', freq: 500, gain: 0.8 }); }
  pin() { if (!this.ctx) return; const d = this.bus(0, 0.2, 0.05, 0.6); this.tone(d, this.t, 0.06, { type: 'triangle', freq: 2600, gain: 0.15 }); this.noise(d, this.t + 0.08, 0.04, { type: 'highpass', freq: 3000, gain: 0.3 }); }
  bounce(dist) { if (!this.ctx) return; const d = this.bus(dist, 0, 0.1, 0.6); this.tone(d, this.t, 0.05, { type: 'triangle', freq: 800 + Math.random() * 400, gain: 0.25 }); }
  ui() { if (!this.ctx) return; const d = this.bus(0, 0, 0, 0.4); this.tone(d, this.t, 0.05, { type: 'triangle', freq: 1200, gain: 0.2 }); }
  // Oyna sinishi: qisqa shitirlash va bir nechta jarangdor tovush
  glass(dist = 0, pan = 0) {
    if (!this.ctx || dist > 70) return;
    const d = this.bus(dist, pan, 0.2, 0.75), t = this.t;
    this.noise(d, t, 0.32, { type: 'highpass', freq: 3200, gain: 0.5, q: 0.6 });
    this.noise(d, t + 0.05, 0.5, { type: 'bandpass', freq: 6200, gain: 0.22, q: 2 });
    for (let i = 0; i < 6; i++) this.tone(d, t + 0.02 + Math.random() * 0.3, 0.09 + Math.random() * 0.12, { type: 'sine', freq: 2400 + Math.random() * 4200, gain: 0.07 });
  }
  ping() { if (!this.ctx) return; const d = this.bus(0, 0, 0.3, 0.5); this.tone(d, this.t, 0.4, { type: 'sine', freq: 1300, gain: 0.2 }); this.tone(d, this.t + 0.15, 0.4, { type: 'sine', freq: 1750, gain: 0.15 }); }
  horn() {
    if (!this.ctx) return;
    const t = this.t, d = this.bus(0, 0, 0.4, 0.5);
    [220, 277, 330].forEach((f) => this.tone(d, t, 1.4, { type: 'sawtooth', freq: f, gain: 0.06, attack: 0.15 }));
    this.tone(d, t, 1.4, { type: 'sine', freq: 110, gain: 0.25, attack: 0.1 });
  }
  victory() {
    if (!this.ctx) return;
    const t = this.t, d = this.bus(0, 0, 0.4, 0.5);
    [262, 330, 392, 523, 659].forEach((f, i) => this.tone(d, t + i * 0.16, 0.9, { type: 'triangle', freq: f, gain: 0.25, attack: 0.02 }));
  }
  defeat() {
    if (!this.ctx) return;
    const t = this.t, d = this.bus(0, 0, 0.5, 0.5);
    [220, 196, 165, 131].forEach((f, i) => this.tone(d, t + i * 0.35, 1.2, { type: 'triangle', freq: f, gain: 0.25, attack: 0.05 }));
  }

  distant(era) {
    if (!this.ctx) return;
    const pan = Math.random() * 2 - 1;
    if (Math.random() < 0.5) this.explosion(160 + Math.random() * 100, pan);
    else {
      const kind = era === 'historical' ? (Math.random() < 0.5 ? 'mg' : 'bolt') : (Math.random() < 0.5 ? 'ar' : 'mg');
      const n = kind === 'bolt' ? 1 : 3 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) setTimeout(() => this.shot(kind, 140, pan, true), i * 90);
    }
  }

  // Transport dvigateli (uzluksiz ovoz). Qaytaradi: { set(balandlik, tezlik), stop() }
  engine(kind) {
    if (!this.ctx) return null;
    const ctx = this.ctx, out = ctx.createGain(); out.gain.value = 0; out.connect(this.master);
    const nodes = [];
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = kind === 'heli' ? 42 : kind === 'tank' ? 34 : 55;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'heli' ? 260 : kind === 'tank' ? 300 : 420;
    const og = ctx.createGain(); og.gain.value = kind === 'heli' ? 0.35 : kind === 'tank' ? 0.75 : 0.5;
    osc.connect(lp); lp.connect(og); og.connect(out); osc.start(); nodes.push(osc);
    let chop = null;
    if (kind === 'heli') {
      const ns = ctx.createBufferSource(); ns.buffer = this.noiseBuf; ns.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.7;
      const ng = ctx.createGain(); ng.gain.value = 0.5;
      chop = ctx.createOscillator(); chop.type = 'square'; chop.frequency.value = 11;
      const cg = ctx.createGain(); cg.gain.value = 0.5;
      chop.connect(cg); cg.connect(ng.gain);
      ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(); chop.start(); nodes.push(ns, chop);
    }
    return {
      set: (vol, rate) => {
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(vol, t, 0.1);
        osc.frequency.setTargetAtTime((kind === 'heli' ? 30 : kind === 'tank' ? 26 : 45) + rate * (kind === 'heli' ? 16 : kind === 'tank' ? 30 : 70), t, 0.1);
        if (chop) chop.frequency.setTargetAtTime(3 + rate * 9, t, 0.1);
      },
      stop: () => { for (const n of nodes) { try { n.stop(); } catch (e) { /* to'xtagan */ } } out.disconnect(); },
    };
  }
  alarm() { if (!this.ctx) return; const d = this.bus(0, 0, 0, 0.5); this.tone(d, this.t, 0.12, { type: 'square', freq: 1900, gain: 0.12 }); this.tone(d, this.t + 0.16, 0.12, { type: 'square', freq: 1900, gain: 0.12 }); }
  chute() { if (!this.ctx) return; const d = this.bus(0, 0, 0.1, 0.9); this.noise(d, this.t, 0.5, { type: 'lowpass', freq: 900, freqEnd: 200, gain: 0.8, attack: 0.05 }); }
  door() { if (!this.ctx) return; const d = this.bus(0, 0, 0.05, 0.7); this.noise(d, this.t, 0.09, { type: 'lowpass', freq: 500, gain: 0.7 }); this.tone(d, this.t, 0.06, { type: 'square', freq: 220, gain: 0.08 }); }

  // ---------- Zombi rejimi ----------
  // Zombi xirillashi: past, titroq ovoz (masofa va tomonga qarab eshitiladi)
  zombie(dist = 0, pan = 0, big = false) {
    if (!this.ctx) return;
    const d = this.bus(dist, pan, 0.3, 0.95), t = this.t, f = (big ? 58 : 86) + Math.random() * 30, dur = 0.7 + Math.random() * 0.8;
    this.tone(d, t, dur, { type: 'sawtooth', freq: f, freqEnd: f * (0.7 + Math.random() * 0.22), gain: 0.22, attack: 0.12 });
    this.tone(d, t + 0.03, dur * 0.9, { type: 'square', freq: f * 1.52, freqEnd: f * 1.18, gain: 0.06, attack: 0.15 });
    this.noise(d, t, dur, { type: 'bandpass', freq: 500 + Math.random() * 320, freqEnd: 280, q: 2.6, gain: 0.3, attack: 0.14 });
  }
  zombieHit(dist = 0, pan = 0) {
    if (!this.ctx) return;
    const d = this.bus(dist, pan, 0.1, 0.9), t = this.t;
    this.noise(d, t, 0.14, { type: 'lowpass', freq: 420, gain: 0.9 });
    this.tone(d, t, 0.25, { type: 'sawtooth', freq: 150, freqEnd: 70, gain: 0.25, attack: 0.02 });
  }
  // Momaqaldiroq: chaqmoqdan biroz keyin eshitiladi
  thunder(delay = 0.5, k = 1) {
    if (!this.ctx) return;
    const t = this.t + delay, d = this.bus(0, (Math.random() - 0.5) * 0.8, 0.55, 1.25 * k);
    this.noise(d, t, 0.22, { type: 'highpass', freq: 1700, gain: 0.45 });
    this.noise(d, t + 0.04, 3.4, { type: 'lowpass', freq: 250, freqEnd: 48, gain: 1.3, attack: 0.07 });
    this.noise(d, t + 0.8, 2.8, { type: 'lowpass', freq: 130, freqEnd: 40, gain: 0.85, attack: 0.45 });
  }
  click() { if (!this.ctx) return; const d = this.bus(0, 0, 0, 0.5); this.tone(d, this.t, 0.025, { type: 'square', freq: 3200, gain: 0.12 }); this.noise(d, this.t, 0.02, { type: 'highpass', freq: 4000, gain: 0.2 }); }

  // rain — yomg'ir shovqini (tungi rejim)
  startAmbient(era, rain = false) {
    if (!this.ctx) return;
    this.stopAmbient();
    const ctx = this.ctx;
    if (rain) {
      const mk = (type, freq, q, gain) => { const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(this.master); s.start(0, Math.random()); return s; };
      this.ambientNodes = [mk('highpass', 2600, 0.5, 0.045), mk('bandpass', 950, 0.7, 0.05), mk('lowpass', 180, 0.7, 0.09)];
      return;
    }
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = era === 'historical' ? 450 : 650; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = era === 'historical' ? 0.1 : 0.07;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lg = ctx.createGain(); lg.gain.value = 0.05;
    lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(); lfo.start();
    this.ambientNodes = [s, lfo];
  }
  stopAmbient() {
    for (const n of this.ambientNodes) { try { n.stop(); } catch (e) { /* allaqachon to'xtagan */ } }
    this.ambientNodes = [];
  }
}
