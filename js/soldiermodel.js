import * as THREE from '../lib/three.module.js';
import { hook } from './gfx.js';

// ================= ASKAR MODELI =================
// Tana bo'g'imli qismlardan iborat: son + boldir (tizza), tos, ko'krak (egiladi), bosh (buriladi), qo'llar + qurol (ko'tariladi/tushadi).
// Har bir qismning barcha shakllari material bo'yicha BITTA geometriyaga birlashtiriladi (chizish chaqiruvlari kam bo'lishi uchun),
// geometriya esa (davr, tomon, tur, variant) bo'yicha keshlanadi — bir xil turdagi askarlar uni birgalikda ishlatadi.
// Koordinatalar: askar +z tomonga qaragan, +x — uning CHAP tomoni, y — yuqoriga. O'lchamlar metrda (bo'yi ~1.8 m).

export const HIP_Y = 0.92, THIGH = 0.42, SHIN = 0.41;
const HIP_X = 0.1, WAIST_Y = 1.06, SH_Y = 1.43, NECK_Y = 1.5;
const UVS = 1.7;   // mato naqshining zichligi (takror / metr)
const ONE = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _nm = new THREE.Matrix3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// Bu kalitlar alohida material emas: rangi cho'qqilarga yoziladi va butun askar uchun BITTA umumiy material bilan chiziladi
const VC = { boots: 0x1c1815, dark: 0x151515, hair: 0x241a12, eye: 0xe8e4dc, gun: 0x25272a, wood: 0x6a4424, brass: 0xb8943f, glass: 0x0e141a, blood: 0x4d0f0c, zeye: 0xd8e6b0 };
const _col = new THREE.Color();

// Bir qism (masalan, "son" yoki "bosh") uchun shakllarni yig'uvchi
class Part {
  constructor(ox = 0, oy = 0, oz = 0) { this.o = V(ox, oy, oz); this.by = new Map(); this.frame = null; }
  // Keyingi shakllar shu nuqta atrofida y o'qi bo'yicha buriladi (ko'krakni yonlab turish uchun)
  turn(ry, px = 0, pz = 0) { this.frame = ry ? new THREE.Matrix4().makeTranslation(px, 0, pz).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeTranslation(-px, 0, -pz)) : null; return this; }
  add(geo, key) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (this.frame) _m.premultiply(this.frame);
    _nm.getNormalMatrix(_m);
    const vc = VC[key], bk = vc !== undefined ? 'vc' : key;
    if (vc !== undefined) _col.setHex(vc);
    let b = this.by.get(bk);
    if (!b) this.by.set(bk, (b = { pos: [], nor: [], uv: [], col: [] }));
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      _a.fromBufferAttribute(p, i).applyMatrix4(_m); _b.fromBufferAttribute(n, i).applyMatrix3(_nm).normalize();
      b.pos.push(_a.x - this.o.x, _a.y - this.o.y, _a.z - this.o.z); b.nor.push(_b.x, _b.y, _b.z);
      if (vc !== undefined) b.col.push(_col.r, _col.g, _col.b);
      // tekstura koordinatasi — normalning ustun o'qi bo'yicha proyeksiya: mato naqshi hamma joyda bir xil o'lchamda chiqadi
      const ax = Math.abs(_b.x), ay = Math.abs(_b.y), az = Math.abs(_b.z);
      if (ax >= ay && ax >= az) b.uv.push(_a.z * UVS, _a.y * UVS); else if (ay >= az) b.uv.push(_a.x * UVS, _a.z * UVS); else b.uv.push(_a.x * UVS, _a.y * UVS);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }
  box(key, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), ONE);
    this.add(new THREE.BoxGeometry(w, h, d), key);
  }
  // silindr (o'qi y bo'yicha; rx/rz bilan yotqiziladi)
  cyl(key, rt, rb, len, x, y, z, rx = 0, ry = 0, rz = 0, seg = 10) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), ONE);
    this.add(new THREE.CylinderGeometry(rt, rb, len, seg), key);
  }
  sph(key, r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 10) {
    _m.compose(_p.set(x, y, z), _q.identity(), _s.set(sx, sy, sz));
    this.add(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 3)), key);
  }
  // yarim shar (kaska gumbazi)
  dome(key, r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 12) {
    _m.compose(_p.set(x, y, z), _q.identity(), _s.set(sx, sy, sz));
    this.add(new THREE.SphereGeometry(r, seg, 7, 0, Math.PI * 2, 0, Math.PI / 2), key);
  }
  // ikki nuqta orasidagi toraygan silindr (qo'l-oyoq bo'laklari)
  seg(key, p0, p1, r0, r1, n = 8) {
    _b.subVectors(p1, p0); const len = _b.length();
    _m.compose(_p.addVectors(p0, p1).multiplyScalar(0.5), _q.setFromUnitVectors(UP, _b.multiplyScalar(1 / len)), ONE);
    this.add(new THREE.CylinderGeometry(r1, r0, len, n), key);
  }
  build() {
    const out = {};
    for (const [k, b] of this.by) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      if (b.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.userData.shared = true;
      out[k] = g;
    }
    return out;
  }
}

// ---------- Ko'rinish to'plami (rang, bosh kiyim, anjomlar) ----------
// variant — bir xil turdagi askarlar bir-biridan farq qilishi uchun (0..2)
function look(era, team, type, variant) {
  if (type === 'zombie') {
    // zombi: yirtiq kiyim, kulrang-yashil teri, qurolsiz — qo'llari oldinga cho'zilgan
    return { uni: [0x5a5f52, 0x6a5444, 0x47525c][variant], pants: [0x3f4238, 0x4a4036, 0x33383c][variant], helm: 0x2a2c2a, gear: 0x2e2a24, cloth: 0x5a1c16,
      skin: [0x7f9272, 0x8c9a84, 0x6f8078][variant], pat: 'gore', helmet: 'none', kit: 'zombie', gun: 'none', zombie: true };
  }
  if (era === 'historical') {
    if (team === 'ally') return { uni: 0x77693f, pants: 0x4a4f5c, helm: 0x47502f, gear: 0x5a4226, cloth: 0x8d8062, skin: 0xd1a07c, pat: 'wool', helmet: variant === 2 ? 'pilotka' : 'round', kit: 'soviet', tall: true, gun: 'ppsh' };
    const p = { uni: 0x5c6152, pants: 0x565a4e, helm: 0x3d4240, gear: 0x1d1b18, cloth: 0x6a6850, skin: 0xd8ab88, pat: 'wool', helmet: variant === 2 ? 'feldcap' : 'stahl', kit: 'german', tall: true, gun: 'bolt', cover: variant === 1 };
    if (type === 'officer') { p.uni = 0x4f564c; p.helmet = 'cap'; p.helm = 0x3a3e3a; p.gun = 'pistol'; p.breeches = true; }
    if (type === 'heavy') { p.uni = 0x4c5046; p.helmet = 'stahl'; p.gun = 'mg'; p.belt = true; }
    if (type === 'smg') { p.uni = 0x666a5a; p.gun = 'mp'; }
    if (type === 'sniper') { p.uni = 0x6b6a4a; p.pants = 0x5c5b42; p.pat = 'camoH'; p.helmet = 'stahl'; p.cover = true; p.gun = 'boltScope'; }
    return p;
  }
  if (team === 'ally') return { uni: 0xa39473, pants: 0xa39473, helm: 0x8c7c5c, gear: 0x7d7054, cloth: 0x6f6a55, skin: 0xc8956e, pat: 'camoM', helmet: 'modern', kit: 'operator', gloves: true, pads: true, gun: 'ar', headset: true, goggles: variant !== 1 };
  const p = { uni: [0x5d5a4c, 0x74664a, 0x4c5a54][variant], pants: [0x6a6450, 0x4a4840, 0x7a7052][variant], helm: 0x26282a, gear: 0x4a4e36, cloth: [0x9c967e, 0x8e3a32, 0x66704f][variant], skin: 0xb58263, pat: 'plain',
    helmet: ['mask', 'shemagh', 'bare'][variant], kit: 'insurgent', gun: 'ak' };
  if (type === 'smg') { p.uni = [0x7a6c52, 0x4f6170, 0x6b5a48][variant]; p.gun = 'smgM'; p.light = true; }
  if (type === 'heavy') { p.uni = 0x43453f; p.pants = 0x4a4a42; p.gear = 0x2a2c28; p.helmet = 'modern'; p.helm = 0x2c2e2c; p.kit = 'operator'; p.gun = 'mg'; p.belt = true; p.pads = true; p.gloves = true; p.mask = true; }
  if (type === 'sniper') { p.uni = 0x6a6448; p.pants = 0x5a5440; p.pat = 'camoM'; p.helmet = 'boonie'; p.helm = 0x7a7050; p.gun = 'svd'; p.ghillie = true; p.cloth = 0x6a6a44; }
  if (type === 'officer') { p.uni = 0x47553f; p.pants = 0x414a38; p.helmet = 'beret'; p.helm = 0x6e1f1f; p.kit = 'operator'; p.gear = 0x33382c; p.gun = 'pistol'; p.shades = true; p.headset = false; }
  return p;
}

// ---------- Mato teksturalari (kodda chiziladi) ----------
const texCache = new Map();
function fabric(hex, pat) {
  const key = hex + pat;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  // rang to'g'ridan-to'g'ri hex dan olinadi (THREE.Color ichki chiziqli qiymat saqlaydi — canvas uchun to'g'ri kelmaydi)
  const cr = (hex >> 16) & 255, cg = (hex >> 8) & 255, cb = hex & 255;
  const css = (k, a = 1) => `rgba(${Math.round(Math.min(255, cr * k))},${Math.round(Math.min(255, cg * k))},${Math.round(Math.min(255, cb * k))},${a})`;
  g.fillStyle = css(1); g.fillRect(0, 0, 128, 128);
  let seed = hex % 9973 + pat.length * 31;
  const R = () => ((seed = (seed * 16807 + 11) % 2147483647) / 2147483647);
  const blot = (n, k, rmin, rmax, a) => {
    g.fillStyle = typeof k === 'string' ? k : css(k, a);
    for (let i = 0; i < n; i++) {
      const x = R() * 128, y = R() * 128, r = rmin + R() * (rmax - rmin);
      for (const [ox, oy] of [[0, 0], [128, 0], [-128, 0], [0, 128], [0, -128]]) {   // chetlarda uzilmasligi uchun
        g.beginPath(); g.ellipse(x + ox, y + oy, r, r * (0.45 + R() * 0.5), R() * 3.14, 0, Math.PI * 2); g.fill();
      }
    }
  };
  if (pat === 'gore') { blot(9, 'rgba(70,12,10,0.85)', 6, 20); blot(10, 0.55, 8, 22, 0.8); blot(6, 'rgba(20,18,14,0.7)', 4, 12); }
  else if (pat === 'camoM') { blot(16, 0.66, 9, 22, 1); blot(13, 'rgba(96,104,70,0.9)', 7, 17); blot(10, 1.28, 5, 12, 1); blot(9, 'rgba(70,58,42,0.85)', 4, 9); }
  else if (pat === 'camoH') { blot(14, 0.6, 8, 20, 1); blot(12, 'rgba(92,70,44,0.85)', 6, 15); blot(10, 1.25, 4, 10, 1); }
  // mato to'qimasi: mayda donador shovqin va vertikal iplar
  const im = g.getImageData(0, 0, 128, 128), d = im.data, amp = pat === 'wool' ? 20 : 13;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * amp + ((i >> 2) % 2 ? 2 : -2); d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(im, 0, 0);
  // burmalar/kirlanish: bir nechta yumshoq qoramtir dog'
  blot(5, 0.8, 14, 30, 0.16);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}

// ---------- Ikki bo'g'imli qo'l: yelka (S) dan qo'l uchi (H) gacha tirsak nuqtasi ----------
function elbow(S, H, a, b, pole) {
  const d = H.clone().sub(S), L = Math.min(d.length(), a + b - 0.002), dir = d.normalize();
  const x = (a * a - b * b + L * L) / (2 * L), h = Math.sqrt(Math.max(0, a * a - x * x));
  const pl = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  return { E: S.clone().addScaledVector(dir, x).addScaledVector(pl, h), H: S.clone().addScaledVector(dir, L) };
}

// ---------- Qurollar (uchinchi shaxs ko'rinishi). Boshlang'ich nuqta — dasta ustida, stvol +z tomonga ----------
const GUNS = {
  ar(P, o) {   // zamonaviy avtomat: qo'ndoq, rels, optika
    const f = o.furn;
    P.box('gun', 0.045, 0.07, 0.24, 0, 0.005, 0.07); P.box('gun', 0.036, 0.045, 0.07, 0, -0.05, 0.1);
    P.cyl('gun', 0.014, 0.014, 0.2, 0, 0.005, -0.14, Math.PI / 2); P.box(f, 0.04, 0.06, 0.13, 0, -0.005, -0.23); P.box('dark', 0.042, 0.11, 0.02, 0, -0.02, -0.3);
    P.box(f, 0.046, 0.055, 0.25, 0, 0.005, 0.31); P.box('gun', 0.02, 0.012, 0.44, 0, 0.044, 0.21);
    P.cyl('gun', 0.009, 0.009, 0.2, 0, 0.005, 0.53, Math.PI / 2); P.cyl('gun', 0.013, 0.013, 0.05, 0, 0.005, 0.64, Math.PI / 2);
    P.box('gun', 0.03, 0.17, 0.06, 0, -0.14, 0.1, -0.18); P.box('gun', 0.032, 0.09, 0.04, 0, -0.06, -0.005, 0.3);
    P.box('gun', 0.04, 0.045, 0.07, 0, 0.075, 0.08); P.box('glass', 0.03, 0.03, 0.005, 0, 0.078, 0.116); P.box('gun', 0.025, 0.06, 0.03, 0, -0.05, 0.3);
    return { muzzle: 0.67, hand: [0, -0.04, 0.3], pose: 'shoulder' };
  },
  ak(P) {      // yog'och qo'ndoqli avtomat, egik magazin
    P.box('gun', 0.04, 0.06, 0.26, 0, 0.0, 0.07); P.box('gun', 0.036, 0.016, 0.2, 0, 0.036, 0.06);
    P.box('wood', 0.036, 0.06, 0.24, 0, -0.012, -0.18, 0.08); P.box('wood', 0.038, 0.1, 0.03, 0, -0.03, -0.3, 0.08);
    P.box('wood', 0.044, 0.05, 0.2, 0, -0.005, 0.3); P.box('wood', 0.034, 0.03, 0.17, 0, 0.035, 0.3);
    P.cyl('gun', 0.009, 0.009, 0.26, 0, 0.0, 0.52, Math.PI / 2); P.cyl('gun', 0.008, 0.008, 0.16, 0, 0.034, 0.46, Math.PI / 2);
    P.box('gun', 0.012, 0.05, 0.016, 0, 0.03, 0.6); P.box('gun', 0.016, 0.02, 0.04, 0, 0.05, 0.22);
    P.box('gun', 0.03, 0.1, 0.06, 0, -0.08, 0.13, -0.25); P.box('gun', 0.03, 0.1, 0.06, 0, -0.165, 0.165, -0.55); P.box('wood', 0.03, 0.09, 0.04, 0, -0.065, -0.005, 0.3);
    return { muzzle: 0.66, hand: [0, -0.04, 0.3], pose: 'shoulder' };
  },
  bolt(P, o) { // bo'ylama zatvorli miltiq (optikali varianti bilan)
    P.box('wood', 0.045, 0.055, 0.78, 0, -0.012, 0.2); P.box('wood', 0.044, 0.1, 0.2, 0, -0.04, -0.2, 0.12); P.box('gun', 0.046, 0.105, 0.012, 0, -0.05, -0.3, 0.12);
    P.cyl('gun', 0.016, 0.016, 0.2, 0, 0.022, 0.08, Math.PI / 2); P.cyl('gun', 0.0095, 0.0085, 0.72, 0, 0.022, 0.5, Math.PI / 2);
    P.box('gun', 0.048, 0.06, 0.014, 0, -0.008, 0.36); P.box('gun', 0.048, 0.06, 0.014, 0, -0.008, 0.54);
    P.cyl('gun', 0.005, 0.005, 0.045, -0.035, 0.012, 0.0, 0, 0, Math.PI / 2); P.sph('gun', 0.012, -0.058, 0.004, 0.0);
    P.box('gun', 0.02, 0.03, 0.07, 0, -0.05, 0.1); P.box('gun', 0.01, 0.022, 0.012, 0, 0.04, 0.84);
    if (o.scope) { P.cyl('gun', 0.014, 0.014, 0.2, 0, 0.068, 0.1, Math.PI / 2); P.cyl('gun', 0.018, 0.016, 0.03, 0, 0.068, 0.21, Math.PI / 2); P.cyl('gun', 0.017, 0.018, 0.03, 0, 0.068, -0.01, Math.PI / 2); P.box('gun', 0.012, 0.03, 0.1, 0, 0.045, 0.1); }
    return { muzzle: 0.87, hand: [0, -0.04, 0.34], pose: 'shoulder', glint: o.scope ? [0, 0.068, 0.24] : null };
  },
  ppsh(P) {    // barabanli PP, teshikli g'ilof
    P.box('wood', 0.042, 0.05, 0.3, 0, -0.02, 0.0); P.box('wood', 0.042, 0.1, 0.18, 0, -0.045, -0.2, 0.12); P.box('gun', 0.044, 0.105, 0.012, 0, -0.055, -0.29, 0.12);
    P.cyl('gun', 0.021, 0.021, 0.26, 0, 0.02, 0.1, Math.PI / 2); P.cyl('gun', 0.023, 0.023, 0.26, 0, 0.018, 0.36, Math.PI / 2);
    for (let i = 0; i < 4; i++) P.box('dark', 0.05, 0.01, 0.035, 0, 0.018, 0.27 + i * 0.055);
    P.box('gun', 0.04, 0.036, 0.022, 0, 0.022, 0.5, 0.35);
    P.cyl('gun', 0.072, 0.072, 0.052, 0, -0.085, 0.14, Math.PI / 2, 0, 0, 16); P.cyl('gun', 0.016, 0.016, 0.058, 0, -0.085, 0.14, Math.PI / 2);
    return { muzzle: 0.52, hand: [0, -0.14, 0.14], pose: 'shoulder' };
  },
  mp(P) {      // qora PP, uzun to'g'ri magazin, buklanadigan qo'ndoq
    P.cyl('gun', 0.021, 0.021, 0.3, 0, 0.012, 0.08, Math.PI / 2); P.box('gun', 0.04, 0.05, 0.2, 0, -0.022, 0.06);
    P.cyl('gun', 0.01, 0.01, 0.22, 0, 0.012, 0.33, Math.PI / 2); P.box('gun', 0.016, 0.03, 0.02, 0, -0.008, 0.36);
    P.box('gun', 0.026, 0.2, 0.034, 0, -0.14, 0.17); P.box('gun', 0.034, 0.03, 0.05, 0, -0.045, 0.17);
    P.box('dark', 0.03, 0.09, 0.04, 0, -0.07, -0.01, 0.25);
    P.box('gun', 0.01, 0.012, 0.26, 0.016, -0.02, -0.19); P.box('gun', 0.01, 0.012, 0.26, -0.016, -0.02, -0.19); P.box('gun', 0.05, 0.07, 0.012, 0, -0.03, -0.32);
    return { muzzle: 0.45, hand: [0, -0.2, 0.17], pose: 'shoulder' };
  },
  smgM(P) {    // ixcham zamonaviy PP
    P.box('gun', 0.042, 0.065, 0.26, 0, 0.0, 0.06); P.box('dark', 0.044, 0.045, 0.12, 0, -0.01, 0.24);
    P.cyl('gun', 0.01, 0.01, 0.1, 0, 0.0, 0.34, Math.PI / 2); P.cyl('gun', 0.013, 0.013, 0.04, 0, 0.0, 0.4, Math.PI / 2);
    P.box('gun', 0.024, 0.19, 0.034, 0, -0.13, 0.13, 0.08); P.box('dark', 0.03, 0.09, 0.04, 0, -0.065, -0.01, 0.28);
    P.box('gun', 0.012, 0.012, 0.24, 0, 0.0, -0.18); P.box('gun', 0.012, 0.012, 0.24, 0, -0.045, -0.18, -0.2); P.box('dark', 0.03, 0.1, 0.014, 0, -0.025, -0.3);
    P.box('gun', 0.02, 0.012, 0.2, 0, 0.038, 0.08);
    return { muzzle: 0.43, hand: [0, -0.045, 0.24], pose: 'shoulder' };
  },
  svd(P) {     // optikali yarim avtomat snayper miltig'i
    P.box('gun', 0.04, 0.06, 0.3, 0, 0.0, 0.08); P.box('wood', 0.036, 0.11, 0.26, 0, -0.03, -0.2, 0.1); P.box('dark', 0.03, 0.03, 0.12, 0, 0.035, -0.17);
    P.box('wood', 0.042, 0.045, 0.26, 0, 0.0, 0.36); P.cyl('gun', 0.009, 0.008, 0.5, 0, 0.004, 0.72, Math.PI / 2); P.cyl('gun', 0.013, 0.013, 0.07, 0, 0.004, 0.99, Math.PI / 2);
    P.box('gun', 0.03, 0.11, 0.07, 0, -0.085, 0.13, -0.12); P.box('wood', 0.03, 0.08, 0.04, 0, -0.06, -0.01, 0.3);
    P.cyl('gun', 0.016, 0.016, 0.26, 0, 0.078, 0.1, Math.PI / 2); P.cyl('gun', 0.023, 0.018, 0.05, 0, 0.078, 0.25, Math.PI / 2); P.cyl('gun', 0.019, 0.02, 0.04, 0, 0.078, -0.04, Math.PI / 2);
    P.box('gun', 0.012, 0.035, 0.12, 0.012, 0.05, 0.1);
    return { muzzle: 1.03, hand: [0, -0.035, 0.36], pose: 'shoulder', glint: [0, 0.078, 0.28] };
  },
  mg(P, o) {   // pulemyot: soshka, o'q lentasi qutisi, ko'tarish dastasi
    P.box('gun', 0.06, 0.09, 0.42, 0, 0.0, 0.14); P.box(o.H ? 'wood' : 'dark', 0.045, 0.1, 0.26, 0, -0.015, -0.2, 0.06); P.box('gun', 0.047, 0.11, 0.014, 0, -0.022, -0.335);
    P.cyl('gun', 0.026, 0.026, 0.4, 0, 0.012, 0.52, Math.PI / 2); for (let i = 0; i < 5; i++) P.box('dark', 0.058, 0.014, 0.03, 0, 0.012, 0.38 + i * 0.07);
    P.cyl('gun', 0.012, 0.012, 0.16, 0, 0.012, 0.78, Math.PI / 2); P.cyl('gun', 0.022, 0.016, 0.06, 0, 0.012, 0.88, Math.PI / 2);
    P.box('gun', 0.012, 0.012, 0.3, 0.03, -0.06, 0.56, 0.12); P.box('gun', 0.012, 0.012, 0.3, -0.03, -0.06, 0.56, 0.12);
    if (o.H) P.cyl('helm', 0.075, 0.075, 0.06, 0.075, -0.03, 0.16, 0, 0, Math.PI / 2, 14); else P.box('gear', 0.09, 0.13, 0.15, 0.07, -0.1, 0.16);
    P.box('gun', 0.014, 0.014, 0.13, 0, 0.085, 0.3); P.box('gun', 0.014, 0.05, 0.014, 0, 0.062, 0.24); P.box('gun', 0.014, 0.05, 0.014, 0, 0.062, 0.36);
    P.box('dark', 0.032, 0.09, 0.045, 0, -0.07, -0.01, 0.25);
    for (let i = 0; i < 4; i++) P.box('brass', 0.016, 0.03, 0.012, -0.045, 0.02 - i * 0.022, 0.16 + (i % 2) * 0.012);
    return { muzzle: 0.92, hand: [0, 0.1, 0.3], pose: 'hip' };
  },
  none() { return { muzzle: 0.3, hand: [0.27, 0.06, -0.05], pose: 'zombie' }; },   // zombi: qurol yo'q
  pistol(P) {
    P.box('gun', 0.03, 0.035, 0.18, 0, 0.012, 0.05); P.box('dark', 0.03, 0.09, 0.045, 0, -0.045, -0.005, 0.2); P.box('gun', 0.012, 0.03, 0.05, 0, -0.02, 0.05);
    return { muzzle: 0.15, hand: [0.03, -0.045, 0.0], pose: 'pistol' };
  },
};

// ---------- Geometriyani qurish (keshlanadi) ----------
const cache = new Map();
function buildGeo(era, team, type, variant) {
  const key = `${era}|${team}|${type}|${variant}`;
  if (cache.has(key)) return cache.get(key);
  const L = look(era, team, type, variant), H = era === 'historical', op = L.kit === 'operator';
  const out = { look: L };

  // --- Oyoqlar: son (tosdan tizzagacha) va boldir (tizzadan pastga, botinka bilan) ---
  for (const sg of [1, -1]) {
    const x = sg * HIP_X, kY = HIP_Y - THIGH;
    const th = new Part(x, HIP_Y, 0);
    th.seg('pants', V(x, HIP_Y + 0.01, 0), V(x, kY, 0.004), L.breeches ? 0.112 : 0.1, 0.074);
    if (L.breeches) th.sph('pants', 0.07, x + sg * 0.05, HIP_Y - 0.12, 0, 0.9, 1.6, 1);          // galife shim
    if (!H) th.box('pants', 0.035, 0.15, 0.115, x + sg * 0.078, kY + 0.2, 0.0);                  // yon cho'ntak
    if (sg < 0 && (op || type === 'officer') && L.gun !== 'pistol') { th.box('gear', 0.045, 0.19, 0.1, x - 0.092, kY + 0.24, 0.01); th.box('dark', 0.03, 0.06, 0.05, x - 0.1, kY + 0.36, 0.0, 0.2); th.box('gear', 0.2, 0.03, 0.2, x, kY + 0.24, 0); }
    out[sg > 0 ? 'thighL' : 'thighR'] = th.build();
    const sh = new Part(x, kY, 0);
    sh.sph('pants', 0.077, x, kY, 0.004, 1, 1, 1, 8);
    sh.seg('pants', V(x, kY, 0.004), V(x, 0.14, 0), 0.074, 0.056);
    if (L.pads) { sh.sph('gear', 0.07, x, kY - 0.005, 0.032, 1.05, 1.1, 0.75, 8); sh.box('gear', 0.155, 0.022, 0.145, x, kY - 0.08, 0); }
    const top = L.tall ? 0.4 : 0.24;                                                             // botinka qo'nji
    sh.seg('boots', V(x, top, 0), V(x, 0.07, 0), L.tall ? 0.072 : 0.063, 0.058);
    if (!L.tall) sh.sph('pants', 0.072, x, top + 0.02, 0, 1, 0.55, 1, 8);                        // botinka ustidagi shim burmasi
    sh.box('boots', 0.105, 0.08, 0.21, x, 0.057, 0.04); sh.sph('boots', 0.055, x, 0.054, 0.145, 0.95, 0.8, 1.1, 8);
    sh.box('dark', 0.11, 0.022, 0.285, x, 0.011, 0.052); sh.box('dark', 0.105, 0.03, 0.075, x, 0.02, -0.048);
    out[sg > 0 ? 'shinL' : 'shinR'] = sh.build();
  }

  // --- Tos va kamar anjomlari ---
  const hp = new Part(0, 0, 0);
  hp.box('pants', 0.35, 0.19, 0.21, 0, 0.965, 0); hp.sph('pants', 0.11, 0.09, 0.93, -0.035, 1, 1, 1, 8); hp.sph('pants', 0.11, -0.09, 0.93, -0.035, 1, 1, 1, 8);
  if (H) hp.box('uni', 0.385, 0.17, 0.245, 0, 0.985, 0);                                          // kitel/gimnastyorka etagi
  hp.box('gear', 0.365 + (H ? 0.03 : 0), 0.05, 0.225 + (H ? 0.03 : 0), 0, WAIST_Y, 0);
  hp.box(H ? 'brass' : 'dark', 0.05, 0.042, 0.012, 0, WAIST_Y, H ? 0.13 : 0.112);
  if (L.kit === 'german') {
    if (L.gun === 'mp') { hp.box('gear', 0.1, 0.2, 0.04, 0.115, 1.0, 0.135, 0, 0, 0.22); hp.box('gear', 0.1, 0.2, 0.04, -0.115, 1.0, 0.135, 0, 0, -0.22); }
    else if (L.gun !== 'pistol') for (const s of [1, -1]) for (let i = 0; i < 3; i++) hp.box('gear', 0.04, 0.075, 0.045, s * (0.065 + i * 0.045), 1.035, 0.14);
    if (L.gun === 'pistol' || L.gun === 'mg') { hp.box('gear', 0.075, 0.13, 0.045, 0.13, 1.0, 0.125, 0, 0, 0.15); hp.box('gear', 0.08, 0.05, 0.05, 0.135, 1.05, 0.127, 0, 0, 0.15); }
    hp.box('cloth', 0.2, 0.17, 0.075, -0.09, 0.97, -0.155); hp.box('cloth', 0.2, 0.06, 0.08, -0.09, 1.03, -0.157);             // non xaltasi
    hp.cyl('wood', 0.05, 0.055, 0.15, -0.15, 0.97, -0.225); hp.cyl('dark', 0.042, 0.05, 0.05, -0.15, 1.06, -0.225);             // flyaga
    hp.cyl('helm', 0.06, 0.06, 0.27, 0.03, 1.09, -0.19, 0, 0, Math.PI / 2, 12);                                                 // protivogaz qutisi
    hp.box('gear', 0.115, 0.17, 0.02, 0.175, 0.95, -0.05, 0, 0.4, 0); hp.cyl('wood', 0.013, 0.013, 0.26, 0.19, 1.03, -0.07, 0.15);   // sapyor belkuragi
  } else if (L.kit === 'soviet') {
    hp.cyl('gear', 0.086, 0.086, 0.055, 0.115, 0.99, 0.14, Math.PI / 2, 0, 0, 14);                                              // baraban xaltasi
    hp.box('cloth', 0.17, 0.2, 0.075, 0.185, 0.96, -0.03, 0, 0.3, 0);                                                           // protivogaz sumkasi
    hp.cyl('helm', 0.05, 0.055, 0.15, -0.13, 0.97, -0.15); hp.cyl('dark', 0.02, 0.02, 0.04, -0.13, 1.065, -0.15);               // flyaga
    hp.box('gear', 0.11, 0.16, 0.02, -0.19, 0.95, -0.02, 0, -0.4, 0); hp.cyl('wood', 0.013, 0.013, 0.24, -0.2, 1.03, -0.03, 0.1);
    hp.box('gear', 0.06, 0.07, 0.04, -0.1, 1.035, 0.14);
  } else if (op) {
    hp.box('gear', 0.12, 0.13, 0.07, 0.165, 0.99, -0.085, 0, 0.3, 0); hp.box('gear', 0.13, 0.085, 0.06, 0, 1.01, -0.14);        // xalta va aptechka
    hp.box('gear', 0.06, 0.1, 0.04, -0.17, 1.0, 0.06, 0, -0.3, 0);
  } else {
    hp.box('gear', 0.09, 0.11, 0.05, -0.15, 1.0, 0.09, 0, -0.3, 0); hp.cyl('helm', 0.045, 0.05, 0.14, 0.15, 0.97, -0.13);       // xalta, flyaga
  }
  out.hips = hp.build();

  // --- Tana (bel atrofida egiladi). Ko'krak biroz yonlab turadi: chap yelka oldinda — qurolni ikki qo'llab ushlash uchun ---
  const BL = -0.5, tr = new Part(0, WAIST_Y, 0);
  tr.turn(BL * 0.5);
  tr.box('uni', 0.335, 0.2, 0.2, 0, 1.165, 0);
  tr.turn(BL);
  tr.box('uni', 0.395, 0.25, 0.225, 0, 1.335, 0.004); tr.box('uni', 0.41, 0.07, 0.2, 0, 1.44, 0);
  tr.sph('uni', 0.078, 0.2, SH_Y, 0, 1, 1, 1, 8); tr.sph('uni', 0.078, -0.2, SH_Y, 0, 1, 1, 1, 8);
  tr.seg('uni', V(0.07, 1.485, -0.01), V(0.2, 1.465, 0), 0.05, 0.05, 6); tr.seg('uni', V(-0.07, 1.485, -0.01), V(-0.2, 1.465, 0), 0.05, 0.05, 6);   // trapetsiya
  if (H) {
    for (const s of [1, -1]) { tr.box('uni', 0.11, 0.1, 0.02, s * 0.1, 1.36, 0.113); tr.box('uni', 0.12, 0.035, 0.026, s * 0.1, 1.405, 0.115); tr.box('brass', 0.012, 0.012, 0.008, s * 0.1, 1.395, 0.13); }
    for (let i = 0; i < 4; i++) tr.box('brass', 0.014, 0.014, 0.008, 0, 1.44 - i * 0.075, 0.114);                              // tugmalar
    for (const s of [1, -1]) tr.box(L.kit === 'german' ? 'gear' : 'cloth', 0.062, 0.012, 0.11, s * 0.165, 1.484, 0);            // pogonlar
  }
  if (L.kit === 'german' && L.gun !== 'pistol') {
    // Y shaklidagi tasmalar
    for (const s of [1, -1]) { tr.box('gear', 0.034, 0.4, 0.012, s * 0.105, 1.285, 0.118, 0.03, 0, s * -0.03); tr.box('gear', 0.034, 0.03, 0.2, s * 0.11, 1.488, 0.02); tr.box('gear', 0.034, 0.24, 0.012, s * 0.06, 1.38, -0.116, 0, 0, s * 0.42); }
    tr.box('gear', 0.034, 0.22, 0.012, 0, 1.19, -0.115); tr.cyl('helm', 0.022, 0.022, 0.012, 0, 1.3, -0.118, Math.PI / 2);
  }
  if (L.kit === 'german' && L.gun === 'pistol') {   // ofitser: yelka tasmasi va durbin
    tr.box('gear', 0.03, 0.52, 0.012, 0.01, 1.28, 0.118, 0, 0, 0.62); tr.box('gear', 0.03, 0.5, 0.012, 0.01, 1.28, -0.116, 0, 0, -0.62);
    tr.cyl('dark', 0.022, 0.026, 0.085, 0.028, 1.27, 0.15); tr.cyl('dark', 0.022, 0.026, 0.085, -0.028, 1.27, 0.15); tr.box('dark', 0.03, 0.02, 0.02, 0, 1.285, 0.15);
    tr.box('brass', 0.03, 0.03, 0.008, 0.11, 1.33, 0.127);
  }
  if (L.kit === 'soviet') {
    // skatka: chap yelkadan o'ng songa o'ralgan shinel
    const pts = [V(0.17, 1.49, 0.0), V(0.13, 1.45, 0.11), V(0.0, 1.3, 0.155), V(-0.14, 1.14, 0.13), V(-0.2, 1.08, 0.0), V(-0.14, 1.14, -0.13), V(0.0, 1.3, -0.155), V(0.13, 1.45, -0.11), V(0.17, 1.49, 0.0)];
    for (let i = 0; i < pts.length - 1; i++) { tr.seg('cloth', pts[i], pts[i + 1], 0.047, 0.047, 7); tr.sph('cloth', 0.047, pts[i].x, pts[i].y, pts[i].z, 1, 1, 1, 7); }
    tr.box('gear', 0.05, 0.02, 0.05, -0.19, 1.09, 0.03); tr.box('brass', 0.022, 0.03, 0.008, 0.11, 1.36, 0.127);
  }
  if (op) {
    // bronejilet: old/orqa plita, yon kamar, yelka tasmalari, magazin xaltalari, ratsiya, ryukzak
    tr.box('gear', 0.3, 0.31, 0.065, 0, 1.31, 0.128); tr.box('gear', 0.3, 0.33, 0.055, 0, 1.31, -0.128); tr.box('gear', 0.405, 0.13, 0.235, 0, 1.205, 0);
    for (const s of [1, -1]) tr.box('gear', 0.065, 0.03, 0.26, s * 0.115, 1.482, 0);
    for (let i = 0; i < 3; i++) { tr.box('gear', 0.078, 0.135, 0.05, -0.09 + i * 0.09, 1.2, 0.175); tr.box('dark', 0.05, 0.035, 0.03, -0.09 + i * 0.09, 1.28, 0.175); }
    tr.box('gear', 0.15, 0.075, 0.035, 0, 1.41, 0.165); tr.box(team === 'ally' ? 'cloth' : 'dark', 0.075, 0.04, 0.006, 0, 1.415, 0.185);
    tr.box('dark', 0.062, 0.14, 0.045, 0.165, 1.31, -0.13); tr.cyl('dark', 0.005, 0.004, 0.3, 0.165, 1.52, -0.14);
    tr.box('gear', 0.25, 0.32, 0.1, 0, 1.31, -0.2); tr.box('gear', 0.2, 0.1, 0.06, 0, 1.24, -0.27);
    tr.cyl('dark', 0.008, 0.008, 0.32, 0.09, 1.43, -0.14, 0.5, 0, 0.3, 5);
  }
  if (L.kit === 'insurgent') {
    if (!L.light) { tr.box('gear', 0.31, 0.17, 0.05, 0, 1.235, 0.13); for (let i = 0; i < 3; i++) { tr.box('gear', 0.082, 0.2, 0.05, -0.09 + i * 0.09, 1.235, 0.165, 0, 0, (i - 1) * 0.05); tr.box('dark', 0.05, 0.03, 0.03, -0.09 + i * 0.09, 1.345, 0.165); } }
    for (const s of [1, -1]) { tr.box('gear', 0.04, 0.32, 0.012, s * 0.1, 1.38, 0.116); tr.box('gear', 0.04, 0.03, 0.2, s * 0.1, 1.488, 0.02); tr.box('gear', 0.04, 0.4, 0.012, s * 0.06, 1.33, -0.115, 0, 0, s * 0.3); }
    if (variant === 1 || L.light) tr.seg('gear', V(0.19, 1.47, 0.03), V(-0.17, 1.1, 0.125), 0.022, 0.022, 5);                   // yelkadan o'tgan patrontash
    tr.box('gear', 0.24, 0.26, 0.09, 0, 1.3, -0.16);
  }
  if (L.zombie) {
    tr.box('blood', 0.16, 0.14, 0.012, 0.05, 1.3, 0.118, 0, 0, 0.3); tr.box('blood', 0.1, 0.2, 0.012, -0.09, 1.2, 0.108, 0, 0, -0.2); tr.box('blood', 0.14, 0.1, 0.012, -0.04, 1.36, -0.118);
    tr.box('skin', 0.11, 0.09, 0.014, 0.1, 1.22, 0.106); tr.box('cloth', 0.06, 0.24, 0.02, -0.15, 1.18, 0.11, 0.1, 0, 0.25);   // yirtiq va osilgan latta
  }
  if (L.ghillie) for (let i = 0; i < 12; i++) { const a = i * 2.4, r = 0.12 + (i % 3) * 0.045; tr.box(i % 2 ? 'cloth' : 'uni', 0.05, 0.19 + (i % 4) * 0.03, 0.012, Math.cos(a) * r * 1.5, 1.4 - (i % 5) * 0.045, -0.06 + Math.sin(a) * 0.1, 0.2 * Math.sin(a), a, 0.25 * Math.cos(a)); }
  if (L.belt) {   // ko'krakdan o'tgan o'q lentasi
    const b0 = V(0.2, 1.47, 0.02), b1 = V(-0.16, 1.1, 0.13), n = 11;
    for (let i = 0; i <= n; i++) { const t = i / n; tr.box('brass', 0.022, 0.05, 0.016, b0.x + (b1.x - b0.x) * t, b0.y + (b1.y - b0.y) * t, 0.118 + Math.sin(t * Math.PI) * 0.04 + (L.kit === 'operator' ? 0.06 : 0), 0, 0, 0.75); }
  }
  tr.turn(0);
  tr.cyl('skin', 0.05, 0.056, 0.11, 0, NECK_Y + 0.01, 0.004, 0, 0, 0, 8);
  if (H) tr.cyl(L.kit === 'german' ? 'gear' : 'uni', 0.06, 0.066, 0.045, 0, NECK_Y - 0.012, 0.004, 0, 0, 0, 8);                 // yoqa
  if (L.helmet === 'shemagh' || L.ghillie || (L.kit === 'insurgent' && variant === 0)) { tr.cyl('cloth', 0.078, 0.092, 0.08, 0, NECK_Y - 0.005, 0.004, 0, 0, 0, 9); tr.box('cloth', 0.1, 0.12, 0.03, 0.02, 1.42, 0.115, 0.1, 0, 0.1); }   // bo'yin ro'moli
  out.torso = tr.build();
  // yelka nuqtalari (ko'krak bilan birga burilgan)
  const SL = V(0.2 * Math.cos(BL), SH_Y, -0.2 * Math.sin(BL)), SR = V(-0.2 * Math.cos(BL), SH_Y, 0.2 * Math.sin(BL));

  // --- Bosh (bo'yin asosi atrofida buriladi) ---
  const hd = new Part(0, NECK_Y, 0), cy = 1.655, masked = L.helmet === 'mask' || L.mask, fk = masked ? 'dark' : 'skin';
  hd.sph(fk, 0.1, 0, cy, 0.008, 0.9, 1.13, 1.0, 12);
  hd.box(fk, 0.125, 0.07, 0.11, 0, 1.585, 0.03); hd.box(fk, 0.075, 0.035, 0.045, 0, 1.555, 0.068);                              // jag' va iyak
  hd.box(fk, 0.024, 0.045, 0.034, 0, 1.643, 0.106, -0.25);                                                                     // burun
  for (const s of [1, -1]) hd.box(fk, 0.013, 0.048, 0.03, s * 0.091, cy, 0.002);                                                // quloqlar
  if (masked) { hd.box('skin', 0.115, 0.03, 0.012, 0, 1.667, 0.092); for (const s of [1, -1]) hd.box('dark', 0.022, 0.012, 0.006, s * 0.034, 1.667, 0.099); }
  else if (L.zombie) {
    for (const s of [1, -1]) { hd.box('dark', 0.034, 0.024, 0.008, s * 0.035, 1.667, 0.092); hd.box('zeye', 0.016, 0.013, 0.006, s * 0.035, 1.667, 0.097); }
    hd.box('dark', 0.055, 0.03, 0.01, 0.004, 1.602, 0.094, 0, 0, 0.12); hd.box('blood', 0.07, 0.05, 0.008, 0.01, 1.575, 0.09, 0, 0, 0.1);   // ochiq og'iz, iyakdagi qon
    hd.box('blood', 0.05, 0.03, 0.01, -0.05, 1.71, 0.085);
    if (variant !== 1) hd.sph('hair', 0.098, 0, cy + 0.016, -0.016, 0.9, 1.05, 1.0, 9);
  } else {
    for (const s of [1, -1]) { hd.box('eye', 0.026, 0.013, 0.008, s * 0.035, 1.667, 0.094); hd.box('dark', 0.012, 0.012, 0.004, s * 0.035, 1.667, 0.098); hd.box('hair', 0.042, 0.009, 0.012, s * 0.036, 1.688, 0.093, 0, 0, s * -0.08); }
    hd.box('hair', 0.05, 0.006, 0.008, 0, 1.607, 0.093);                                                                        // og'iz
    hd.sph('hair', 0.098, 0, cy + 0.012, -0.012, 0.92, 1.1, 1.0, 10);                                                           // soch (bosh kiyim ostida)
    if (L.kit === 'insurgent' || (variant === 1 && !H)) { hd.box('hair', 0.12, 0.06, 0.06, 0, 1.578, 0.05); hd.box('hair', 0.07, 0.03, 0.04, 0, 1.548, 0.075); }   // soqol
    if (type === 'officer' && H) hd.box('hair', 0.05, 0.01, 0.01, 0, 1.622, 0.098);                                             // mo'ylov
  }
  if (L.shades) { hd.box('glass', 0.125, 0.03, 0.012, 0, 1.668, 0.1); for (const s of [1, -1]) hd.box('dark', 0.006, 0.01, 0.09, s * 0.089, 1.67, 0.05); }
  const hy = cy + 0.03, strap = () => { for (const s of [1, -1]) hd.box('gear', 0.008, 0.11, 0.016, s * 0.094, 1.615, 0.02, 0.25); hd.box('gear', 0.07, 0.014, 0.02, 0, 1.553, 0.062); };
  switch (L.helmet) {
    case 'stahl':
      hd.dome('helm', 0.118, 0, hy - 0.005, 0, 1.0, 0.98, 1.1); hd.cyl('helm', 0.118, 0.142, 0.085, 0, hy - 0.045, -0.018, 0, 0, 0, 14);
      hd.box('helm', 0.2, 0.012, 0.07, 0, hy - 0.012, 0.118, 0.25); strap();
      if (L.cover) { hd.dome('uni', 0.123, 0, hy - 0.002, 0, 1.0, 0.98, 1.1); hd.cyl('gear', 0.127, 0.127, 0.012, 0, hy + 0.01, 0, 0, 0, 0, 14); }
      break;
    case 'round':
      hd.dome('helm', 0.118, 0, hy - 0.01, 0, 1.0, 1.02, 1.08); hd.cyl('helm', 0.119, 0.136, 0.035, 0, hy - 0.026, 0, 0, 0, 0, 14); strap();
      hd.box('brass', 0.022, 0.022, 0.006, 0, hy + 0.04, 0.122, -0.4);
      break;
    case 'pilotka':
      hd.box('uni', 0.13, 0.065, 0.22, 0, hy + 0.045, -0.005, 0, 0, 0.1); hd.box('uni', 0.14, 0.03, 0.225, 0, hy + 0.02, -0.005, 0, 0, 0.1); hd.box('brass', 0.016, 0.016, 0.006, 0.006, hy + 0.045, 0.107);
      break;
    case 'feldcap':
      hd.cyl('uni', 0.108, 0.112, 0.075, 0, hy + 0.035, -0.005, 0, 0, 0, 12); hd.box('uni', 0.15, 0.012, 0.08, 0, hy + 0.005, 0.125, 0.12); hd.box('brass', 0.014, 0.014, 0.006, 0, hy + 0.04, 0.108);
      break;
    case 'modern':
      hd.dome('helm', 0.118, 0, hy - 0.012, -0.004, 1.0, 1.0, 1.08); hd.cyl('helm', 0.118, 0.12, 0.045, 0, hy - 0.032, -0.012, 0, 0, 0, 14);
      for (const s of [1, -1]) hd.box('dark', 0.012, 0.022, 0.11, s * 0.122, hy - 0.03, -0.01);                                 // yon relslar
      hd.box('dark', 0.05, 0.045, 0.02, 0, hy + 0.045, 0.118, -0.35); strap();                                                 // tungi ko'rish asbobi tirgagi
      if (L.headset) for (const s of [1, -1]) { hd.cyl('dark', 0.04, 0.04, 0.035, s * 0.104, cy - 0.005, 0.0, 0, 0, Math.PI / 2, 10); }
      if (L.headset) hd.seg('dark', V(0.1, cy - 0.03, 0.02), V(0.05, 1.6, 0.1), 0.005, 0.005, 5);                               // mikrofon
      if (L.goggles) { hd.box('dark', 0.15, 0.045, 0.03, 0, hy + 0.05, 0.1, -0.5); hd.box('glass', 0.13, 0.03, 0.01, 0, hy + 0.057, 0.117, -0.5); }
      break;
    case 'cap':
      hd.cyl('helm', 0.135, 0.105, 0.05, 0, hy + 0.075, -0.005, 0.1, 0, 0, 14); hd.cyl('gear', 0.106, 0.108, 0.04, 0, hy + 0.035, -0.005, 0, 0, 0, 14);
      hd.box('dark', 0.15, 0.01, 0.075, 0, hy + 0.012, 0.125, 0.3); hd.box('brass', 0.03, 0.022, 0.006, 0, hy + 0.07, 0.115, -0.1);
      break;
    case 'boonie':
      hd.cyl('helm', 0.1, 0.108, 0.075, 0, hy + 0.04, 0, 0, 0, 0, 12); hd.cyl('helm', 0.19, 0.2, 0.014, 0, hy + 0.008, 0, 0.06, 0, 0, 14);
      hd.box('cloth', 0.17, 0.12, 0.012, 0, 1.6, 0.108, 0.12);                                                                  // yuz to'ri
      break;
    case 'beret':
      hd.cyl('helm', 0.125, 0.11, 0.03, 0.02, hy + 0.05, 0, 0, 0, -0.22, 14); hd.cyl('helm', 0.105, 0.108, 0.03, 0, hy + 0.03, 0, 0, 0, 0, 12); hd.box('brass', 0.022, 0.026, 0.006, -0.05, hy + 0.045, 0.098);
      break;
    case 'shemagh':
      hd.sph('cloth', 0.112, 0, cy + 0.02, -0.01, 0.96, 1.08, 1.04, 10); hd.box('cloth', 0.13, 0.06, 0.03, 0, 1.585, 0.085); hd.box('cloth', 0.1, 0.2, 0.03, -0.06, 1.56, -0.09, 0.2, 0, 0.15);
      break;
    case 'bare':
      hd.box('dark', 0.19, 0.03, 0.2, 0, hy + 0.035, 0, 0.1); hd.box('dark', 0.2, 0.012, 0.09, 0, hy + 0.022, 0.13, 0.15);       // kepka
      break;
    case 'none': break;                                                                                                       // bosh kiyimsiz
    default:
      hd.sph('dark', 0.104, 0, cy + 0.006, 0.004, 0.92, 1.13, 1.02, 10);                                                        // niqob
  }
  out.head = hd.build();

  // --- Qurol va uni ushlab turgan qo'llar (yelka chizig'i atrofida ko'tariladi/tushadi) ---
  const gp = new Part(0, 0, 0);
  const gm = GUNS[{ boltScope: 'bolt' }[L.gun] || L.gun](gp, { furn: team === 'ally' ? 'gear' : 'dark', scope: L.gun === 'boltScope', H });
  out.gun = gp.build();
  const O = gm.pose === 'zombie' ? V(-0.15, 1.42, 0.5) : gm.pose === 'hip' ? V(-0.21, 1.1, 0.12) : gm.pose === 'pistol' ? V(-0.03, 1.44, 0.43) : V(-0.1, 1.42, 0.31);         // dasta ustidagi nuqta (tana koordinatasida)
  const HR = O.clone().add(V(0, -0.05, 0)), HLt = O.clone().add(V(gm.hand[0], gm.hand[1], gm.hand[2]));
  const ar = new Part(0, SH_Y, 0), hk = L.gloves ? 'dark' : 'skin';
  const R = elbow(SR, HR, 0.3, 0.28, V(-0.55, -1, -0.35)), Lf = elbow(SL, HLt, 0.3, 0.28, V(0.45, -1, -0.05));
  for (const [S, A] of [[SR, R], [SL, Lf]]) {
    ar.seg('uni', S, A.E, 0.058, 0.046); ar.sph('uni', 0.047, A.E.x, A.E.y, A.E.z, 1, 1, 1, 7);
    ar.seg(L.zombie ? 'skin' : 'uni', A.E, A.H, 0.046, 0.036);   // zombining yengi yirtilgan — bilagi ochiq
    const wr = A.E.clone().lerp(A.H, 0.86); ar.seg(hk, wr, A.H, 0.037, 0.034, 7);
    if (L.pads) ar.sph('gear', 0.05, A.E.x, A.E.y, A.E.z, 1, 1, 1, 7);
  }
  ar.box(hk, 0.07, 0.078, 0.08, HR.x, HR.y - 0.012, HR.z); ar.box(hk, 0.078, 0.06, 0.085, Lf.H.x, Lf.H.y, Lf.H.z);
  out.arms = ar.build();
  out.meta = { O: [O.x, O.y, O.z], muzzle: [O.x, O.y + 0.01, O.z + gm.muzzle], glint: gm.glint ? [O.x + gm.glint[0], O.y + gm.glint[1], O.z + gm.glint[2]] : null, pose: gm.pose };
  cache.set(key, out);
  return out;
}

// ---------- Umumiy (hamma askarlar uchun bitta) materiallar ----------
let common = null;
function commonMat() { return common || (common = hook(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.3 }), { dyn: true })); }
const mulColor = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return c; };

// Modelni yig'adi va askar obyektiga (s) bo'g'im guruhlarini yozadi. Qaytaradi: ildiz guruh.
export function makeSoldierModel(s, era, team, type) {
  const variant = (Math.random() * 3) | 0;
  s.variant = variant;
  const G = buildGeo(era, team, type, variant), L = G.look, C = commonMat();
  const S = (c, o = {}) => hook(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.88 }, o)), { dyn: true });
  const tone = 0.86 + Math.random() * 0.24;   // teri rangi biroz farq qiladi
  const own = {
    uni: S(0xffffff, { map: fabric(L.uni, L.pat) }), pants: S(0xffffff, { map: fabric(L.pants, L.pat === 'wool' ? 'wool' : L.pat) }),
    skin: S(mulColor(L.skin, tone), { roughness: 0.7 }), helm: S(L.helm, { roughness: 0.55, metalness: 0.25 }),
    gear: S(0xffffff, { map: fabric(L.gear, 'plain'), roughness: 0.8 }), cloth: S(0xffffff, { map: fabric(L.cloth, 'plain'), roughness: 0.95 }),
  };
  s.mats = Object.values(own);
  const mat = (k) => own[k] || C;
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const grp = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const fill = (g, geos) => { for (const k in geos) { const m = new THREE.Mesh(geos[k], mat(k)); m.castShadow = true; g.add(m); } };
  s.legL = grp(root, HIP_X, HIP_Y, 0); fill(s.legL, G.thighL); s.shinL = grp(s.legL, 0, -THIGH, 0); fill(s.shinL, G.shinL);
  s.legR = grp(root, -HIP_X, HIP_Y, 0); fill(s.legR, G.thighR); s.shinR = grp(s.legR, 0, -THIGH, 0); fill(s.shinR, G.shinR);
  s.upper = grp(root, 0, 0, 0); fill(s.upper, G.hips);
  s.torso = grp(s.upper, 0, WAIST_Y, 0); fill(s.torso, G.torso);
  s.head = grp(s.torso, 0, NECK_Y - WAIST_Y, 0); fill(s.head, G.head); s.head.rotation.order = 'YXZ';
  s.armsG = grp(s.torso, 0, SH_Y - WAIST_Y, 0); fill(s.armsG, G.arms);
  const M = G.meta;
  s.gun = grp(s.armsG, M.O[0], M.O[1] - SH_Y, M.O[2]); fill(s.gun, G.gun);
  s.gunZ0 = M.O[2];
  s.muzzleLocal = new THREE.Vector3(M.muzzle[0], M.muzzle[1], M.muzzle[2]);
  s.glintLocal = M.glint ? new THREE.Vector3(M.glint[0], M.glint[1], M.glint[2]) : null;
  s.hipFire = M.pose === 'hip'; s.zombie = !!L.zombie;
  s.ready = 1; s.aimPitch = 0; s.lookT = Math.random() * 10;
  // bo'y va gavda biroz farq qiladi (tarmoqdagi o'yinchilar bundan mustasno — ularning nishon qutisi aniq bo'lishi kerak)
  s.build = team === 'remote' ? 1 : 0.95 + Math.random() * 0.12;
  root.scale.set(s.s * s.build, s.s, s.s * s.build);
  return root;
}

// ---------- Animatsiya ----------
// sp — gorizontal tezlik; aiming — nishonga olayaptimi (aks holda qurol pastga tushirilgan); pitch — nishonning balandlik burchagi
export function animateSoldier(s, dt, sp, aiming, pitch) {
  if (s.zombie) { animateZombie(s, dt, sp); return; }
  const c = s.crouchAmt, k = Math.min(1, dt * 8);
  s.walkPhase += sp * dt * 2.8;
  const ph = s.walkPhase, A = (0.34 + 0.2 * Math.min(1, sp / 5)) * Math.min(1, sp / 2) * (1 - c), sw = Math.sin(ph) * A, cw = Math.cos(ph);
  const run = Math.min(1, sp / 4.5);
  // oyoqlar: son tebranadi, oldinga ko'tarilayotgan oyoqning tizzasi bukiladi; cho'kkalaganda — bir tizzada
  const st = (1 - s.ready) * (1 - c) * 0.1;   // nishonda: tizzalar biroz bukilgan, chap oyoq oldinda
  s.legL.rotation.x = sw - 0.04 - st * 1.6 - c * 1.64; s.shinL.rotation.x = 0.08 + st * 2.2 + Math.max(0, -cw) * A * (1.6 + run * 0.6) + c * 1.64;
  s.legR.rotation.x = -sw - 0.04 + st * 0.6 + c * 0.22; s.shinR.rotation.x = 0.08 + st * 1.2 + Math.max(0, cw) * A * (1.6 + run * 0.6) + c * 1.56;
  s.legL.rotation.z = -0.03 * (1 - c); s.legR.rotation.z = 0.03 * (1 - c);
  if (s.sit) { s.legL.rotation.x = s.legR.rotation.x = -1.45; s.shinL.rotation.x = s.shinR.rotation.x = 1.4; }   // transport o'rindig'ida o'tirgan holat
  const bob = Math.abs(Math.sin(ph)) * 0.035 * Math.min(1, sp / 2) * (1 - c);
  s.legL.position.y = s.legR.position.y = HIP_Y - c * 0.45 + bob;
  s.upper.position.y = -c * 0.45 + bob;
  s.upper.rotation.y = Math.sin(ph) * 0.07 * Math.min(1, sp / 2.5);                                  // yurganda tos biroz buriladi
  // qurol holati: nishonda — yelkada; aks holda pastga tushirilgan. Yugurganda tana oldinga engashadi.
  s.ready += ((aiming ? 0 : 1) - s.ready) * Math.min(1, dt * (aiming ? 10 : 4));
  s.aimPitch += ((aiming ? Math.max(-0.7, Math.min(0.7, pitch || 0)) : 0) - s.aimPitch) * k;
  const breath = Math.sin(s.lookT * 1.6) * 0.012;
  s.lookT += dt;
  // o'q tekkanda seskanish: olddan tegsa orqaga, orqadan tegsa oldinga silkinadi
  const fl = s.flinch || 0;
  if (fl > 0) s.flinch = Math.max(0, fl - dt * 3.2);
  s.torso.rotation.x = run * 0.16 * s.ready + c * 0.2 + (1 - s.ready) * 0.1 - s.aimPitch * 0.3 + breath + fl * 0.28 * (s.flinchDir || -1);
  s.torso.rotation.y = -s.upper.rotation.y * 0.6;
  s.armsG.rotation.x = (s.hipFire ? 0.16 : 0.52) * s.ready - s.aimPitch * 0.7 - c * 0.1 + Math.sin(ph * 2) * 0.02 * run - s.gunKick * 0.03;
  s.armsG.rotation.z = Math.sin(ph) * 0.03 * run * s.ready;
  s.gunKick *= Math.max(0, 1 - dt * 14);
  s.gun.position.z = s.gunZ0 - s.gunKick * 0.05;
  // bosh: nishonda — mo'ljalga egilgan; bo'sh paytda atrofga qaraydi
  const aimK = 1 - s.ready, idle = s.ready * (1 - run);
  s.head.rotation.y = Math.sin(s.lookT * 0.55) * 0.45 * idle + Math.sin(s.lookT * 1.3) * 0.08 * idle;
  s.head.rotation.x = (s.hipFire ? 0.02 : 0.1) * aimK - s.aimPitch * 0.35 - s.torso.rotation.x * 0.6 * s.ready;
  s.head.rotation.z = (s.hipFire ? 0 : -0.14) * aimK + fl * 0.12;
  s.armsG.rotation.x += fl * 0.2;
}

// Zombi: sudralib yurish, tana oldinga engashgan va chayqaladi, qo'llar oldinga cho'zilgan; s.atk (0..1) — zarba paytida qo'llar siltanadi
function animateZombie(s, dt, sp) {
  s.walkPhase += sp * dt * 2.4; s.lookT += dt;
  const ph = s.walkPhase, run = Math.min(1, sp / 4.5), A = (0.3 + 0.25 * run) * Math.min(1, sp / 1.2), sw = Math.sin(ph) * A, cw = Math.cos(ph);
  const limp = 0.55 + 0.45 * Math.sin(s.lookT * 0.7 + s.variant);            // bir oyog'ini sudraydi
  s.legL.rotation.x = sw * limp - 0.06; s.shinL.rotation.x = 0.14 + Math.max(0, -cw) * A * 1.1;
  s.legR.rotation.x = -sw - 0.06; s.shinR.rotation.x = 0.14 + Math.max(0, cw) * A * (1.3 + run * 0.6);
  s.legL.rotation.z = -0.06; s.legR.rotation.z = 0.05;
  const bob = Math.abs(Math.sin(ph)) * 0.03 * Math.min(1, sp / 1.5);
  s.legL.position.y = s.legR.position.y = HIP_Y - 0.02 + bob;
  s.upper.position.y = -0.02 + bob;
  s.upper.rotation.y = Math.sin(ph) * 0.14;
  const atk = s.atk || 0, fl = s.flinch || 0;
  if (fl > 0) s.flinch = Math.max(0, fl - dt * 3);
  s.torso.rotation.x = 0.26 + run * 0.14 + Math.sin(s.lookT * 1.3) * 0.04 + atk * 0.25 + fl * 0.4 * (s.flinchDir || -1);
  s.torso.rotation.z = Math.sin(ph) * 0.09 + Math.sin(s.lookT * 0.9) * 0.03;
  s.torso.rotation.y = -s.upper.rotation.y * 0.5;
  s.armsG.rotation.x = -0.12 + Math.sin(s.lookT * 2.1 + s.variant) * 0.07 + Math.sin(ph) * 0.05 - Math.sin(atk * Math.PI) * 0.75 + atk * 0.5;
  s.armsG.rotation.z = Math.sin(s.lookT * 1.7) * 0.05;
  s.head.rotation.x = -0.18 + Math.sin(s.lookT * 1.1) * 0.06;
  s.head.rotation.z = 0.24 + Math.sin(s.lookT * 0.8 + s.variant * 2) * 0.1;
  s.head.rotation.y = Math.sin(s.lookT * 0.6) * 0.15;
}

// Halok bo'lish: avval tizzalar bukiladi va qurol qo'ldan tushadi, so'ng tana yerga yiqiladi
export function animateDeath(s, dt, t) {
  const e = t * t, buckle = Math.sin(Math.min(1, t * 1.6) * Math.PI);   // 0 → 1 → 0
  s.root.rotation.x = s.fallDir * e * (Math.PI / 2 - 0.06);
  s.root.rotation.z = s.fallSpin * e;
  const d = s.fallDir;
  s.legL.rotation.x += ((-0.5 * buckle + (d > 0 ? 0.12 : -0.25) * e) - s.legL.rotation.x) * 0.3;
  s.legR.rotation.x += ((-0.3 * buckle + (d > 0 ? -0.2 : 0.3) * e) - s.legR.rotation.x) * 0.3;
  s.shinL.rotation.x += ((0.9 * buckle + 0.25 * e) - s.shinL.rotation.x) * 0.3;
  s.shinR.rotation.x += ((0.7 * buckle + 0.6 * e) - s.shinR.rotation.x) * 0.3;
  s.upper.position.y += ((-0.2 * buckle) - s.upper.position.y) * 0.3;
  s.legL.position.y = s.legR.position.y = HIP_Y + s.upper.position.y;
  s.torso.rotation.x += ((d > 0 ? 0.25 : -0.2) * e - s.torso.rotation.x) * 0.2;
  s.armsG.rotation.x += ((d > 0 ? -1.5 : 1.5) * e - s.armsG.rotation.x) * 0.2;   // yuztuban yiqilganda qo'llar bosh tomonga, chalqancha yiqilganda qurol tana ustida yotadi
  s.armsG.rotation.z += (s.fallSpin * 0.6 * e - s.armsG.rotation.z) * 0.2;
  s.head.rotation.x += ((d > 0 ? -0.35 : 0.3) * e - s.head.rotation.x) * 0.2;
  s.head.rotation.y += (s.fallSpin * 1.2 * e - s.head.rotation.y) * 0.2;
  s.head.rotation.z = 0;
}
