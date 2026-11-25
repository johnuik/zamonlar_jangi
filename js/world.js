import * as THREE from '../lib/three.module.js';
import { GU, GFX, hook, normalFrom, roofMap, makeSky } from './gfx.js';

export const HALF = 70;
export const STEP_H = 0.5;
const CELL = 0.5;
// Xaritalar: 'town' — kichik shaharcha (140×140 m), 'big' — katta shahar (240×240 m)
export const MAPS = { town: { name: 'Shaharcha', half: HALF }, big: { name: 'Katta shahar', half: 120 } };

// Transport joylashuvi (server.js dagi jadval bilan bir xil bo'lishi kerak)
export const VEHICLE_SPAWNS = [
  { type: 'heli', x: -58, z: -58, yaw: Math.PI / 4 },
  { type: 'chinook', x: 58, z: 58, yaw: (-Math.PI * 3) / 4 },
  { type: 'jeep', x: 58, z: -50, yaw: -Math.PI / 2 },
  { type: 'quad', x: -58, z: 50, yaw: Math.PI / 2 },
  { type: 'cannon', x: -14, z: -18, yaw: 0 },
  { type: 'cannon', x: 14, z: 18, yaw: Math.PI },
  { type: 'tank', x: -62, z: 0, yaw: Math.PI / 2 },
  { type: 'ltank', x: 62, z: 0, yaw: -Math.PI / 2 },
  { type: 'truck', x: 0, z: -58, yaw: 0 },
];

// ---------- Katta xarita ----------
// Transport turlari tartibi o'zgarmaydi (indeks bo'yicha murojaat qilinadi); joylari har jangda tasodifiy taqsimlanadi.
// BIG_PADS, BIG_POINTS va randomVehicles server.js dagi nusxa bilan bir xil bo'lishi shart.
export const VEH_TYPES = ['heli', 'chinook', 'jeep', 'quad', 'cannon', 'cannon', 'tank', 'ltank', 'truck'];
export const BIG_PADS = [
  [-102, -102, Math.PI / 4], [102, 102, (-Math.PI * 3) / 4], [102, -102, -Math.PI / 4], [-102, 102, (Math.PI * 3) / 4],
  [0, -104, 0], [0, 104, Math.PI], [-104, 0, Math.PI / 2], [104, 0, -Math.PI / 2],
  [-64, -64, Math.PI / 4], [64, 64, (-Math.PI * 3) / 4], [64, -64, -Math.PI / 4], [-64, 64, (Math.PI * 3) / 4],
  [-20, -74, Math.PI / 2], [20, 74, -Math.PI / 2], [-74, 22, 0], [74, -22, Math.PI],
];
// Zombi rejimi: A — boshlanish, B va C — oraliq punktlar, D — evakuatsiya
export const BIG_POINTS = [{ id: 'A', x: -98, z: 98 }, { id: 'B', x: -56, z: 8 }, { id: 'C', x: 20, z: -62 }, { id: 'D', x: 98, z: -72 }];
// rnd — 0..1 tasodifiy son funksiyasi; zombie — punktlar yonidagi joylar ishlatilmaydi
export function randomVehicles(rnd, zombie) {
  const pads = BIG_PADS.filter((p) => !zombie || BIG_POINTS.every((q) => Math.hypot(q.x - p[0], q.z - p[1]) > 16));
  for (let i = pads.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = pads[i]; pads[i] = pads[j]; pads[j] = t; }
  return VEH_TYPES.map((type, i) => ({ type, x: pads[i][0], z: pads[i][1], yaw: pads[i][2] }));
}
const HOUSES_BIG = [
  { x: -32, z: -30, w: 12, d: 10, base: 0 }, { x: 32, z: 30, w: 12, d: 10, base: 1 }, { x: 32, z: -30, w: 12, d: 10, base: 2 }, { x: -32, z: 30, w: 12, d: 10, base: 3 },
  { x: 14, z: -46, w: 10, d: 8 }, { x: -14, z: 46, w: 10, d: 8 }, { x: -48, z: -12, w: 10, d: 8 }, { x: 48, z: 12, w: 10, d: 8 },
  { x: -90, z: -34, w: 12, d: 10, base: 4 }, { x: 90, z: 34, w: 12, d: 10, base: 5 }, { x: -34, z: -90, w: 12, d: 10, base: 6 }, { x: 34, z: 90, w: 12, d: 10, base: 7 },   // tashqi kvartallarda ham podval va noyob qurol
  { x: 90, z: -36, w: 10, d: 8 }, { x: -90, z: 36, w: 10, d: 8 }, { x: 36, z: -92, w: 10, d: 8 }, { x: -36, z: 92, w: 10, d: 8 },
  { x: -84, z: -84, w: 14, d: 10 }, { x: 84, z: 84, w: 14, d: 10 }, { x: 80, z: -90, w: 12, d: 8 }, { x: -78, z: 70, w: 10, d: 8 },
];
// to'siqlar (markazga nisbatan simmetrik qo'yiladi)
const COVER_BIG = [
  ['bags', 20, -12, false], ['wreck', 22, 9, true], ['crates', 9, -27, false], ['wall', 0, -25, false], ['big', 46, -34, true], ['hedge', 10, 31, false],
  ['barrels', 50, -8, false], ['bags', 30, -6, true], ['wreck', -40, -50, false], ['bags', 60, 22, true],
  ['wall', 0, -84, false], ['crates', 76, -52, false], ['big', 104, -52, true], ['hedge', 22, 60, false], ['barrels', 108, -14, false], ['wreck', 84, 8, true],
  ['bags', 50, -80, false], ['crates', 60, -104, false], ['wall', 64, -36, true], ['barrels', 30, 68, false], ['wreck', -12, 104, true], ['bags', 106, 64, true],
  ['hedge', 44, 46, false], ['crates', 72, 44, false], ['big', -52, 96, false], ['bags', -76, 50, true], ['barrels', -40, 60, false], ['wreck', 40, 104, false],
];
// zombi rejimidagi qurol yashiklari: [x, z, ichidagi qurol]
const BIG_CRATES = [
  [-92, 88, 'smg'], [-84, 60, 'shotgun'], [-70, 38, 'ar'], [-62, 24, 'smg'],
  [-52, 2, 'ar'], [-61, 13, 'sniper'], [-50, 14, 'shotgun'],
  [-30, -10, 'ar'], [-12, -36, 'smg'], [4, -54, 'sniper'],
  [15, -57, 'ar'], [25, -67, 'shotgun'], [26, -57, 'sniper'],
  [48, -67, 'ar'], [72, -67, 'smg'], [90, -62, 'ar'],
  // qo'shimcha yashiklar (yo'l bo'ylab va uylar yonida)
  [-86, 76, 'ar'], [-78, 48, 'shotgun'], [-60, 40, 'sniper'], [-44, 20, 'smg'], [-38, -2, 'shotgun'], [-22, -22, 'ar'],
  [-2, -44, 'smg'], [12, -66, 'ar'], [36, -60, 'shotgun'], [50, -76, 'sniper'], [84, -70, 'ar'],
];

// Uylar: base — podval raqami (noyob qurol indeksi)
const HOUSES = [
  { x: -32, z: -30, w: 12, d: 10, base: 0 },
  { x: 32, z: 30, w: 12, d: 10, base: 1 },
  { x: 32, z: -30, w: 12, d: 10, base: 2 },
  { x: -32, z: 30, w: 12, d: 10, base: 3 },
  { x: 14, z: -46, w: 10, d: 8 },
  { x: -14, z: 46, w: 10, d: 8 },
  { x: -48, z: -12, w: 10, d: 8 },
  { x: 48, z: 12, w: 10, d: 8 },
];

const _hn = new THREE.Vector3(), _hn2 = new THREE.Vector3(), _ld = new THREE.Vector3();
// ---------- Yordamchi matematik funksiyalar ----------
export function rayAABB(ox, oy, oz, ix, iy, iz, b) {
  let t1 = (b.min.x - ox) * ix, t2 = (b.max.x - ox) * ix;
  let tmin = t1 < t2 ? t1 : t2, tmax = t1 < t2 ? t2 : t1;
  t1 = (b.min.y - oy) * iy; t2 = (b.max.y - oy) * iy;
  tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
  t1 = (b.min.z - oz) * iz; t2 = (b.max.z - oz) * iz;
  tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
  if (tmax < 0 || tmin > tmax) return Infinity;
  return tmin < 0 ? 0 : tmin;
}
export function raySphere(o, d, cx, cy, cz, r) {
  const lx = cx - o.x, ly = cy - o.y, lz = cz - o.z;
  const tc = lx * d.x + ly * d.y + lz * d.z;
  if (tc < 0) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tc * tc;
  if (d2 > r * r) return Infinity;
  return tc - Math.sqrt(r * r - d2);
}
// Nur va tik silindr (o'qi y bo'ylab, y0..y1 oralig'ida): kesishgan masofa yoki Infinity
export function rayCyl(o, d, cx, cz, r, y0, y1) {
  const ox = o.x - cx, oz = o.z - cz, a = d.x * d.x + d.z * d.z;
  let t0 = -Infinity, t1 = Infinity;
  if (a > 1e-10) {
    const b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - r * r, disc = b * b - a * c;
    if (disc < 0) return Infinity;
    const sq = Math.sqrt(disc); t0 = (-b - sq) / a; t1 = (-b + sq) / a;
  } else if (ox * ox + oz * oz > r * r) return Infinity;
  if (Math.abs(d.y) > 1e-10) {
    let ta = (y0 - o.y) / d.y, tb = (y1 - o.y) / d.y;
    if (ta > tb) { const q = ta; ta = tb; tb = q; }
    if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
  } else if (o.y < y0 || o.y > y1) return Infinity;
  if (t1 < Math.max(t0, 0)) return Infinity;
  return t0 >= 0 ? t0 : 0;
}
export const inv = (v) => 1 / (Math.abs(v) < 1e-9 ? (v < 0 ? -1e-9 : 1e-9) : v);

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Protsedural teksturalar ----------
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// TQ — tekstura aniqligi ko'paytuvchisi (yuqori sifatda 2): chizish kodi o'sha "mantiqiy" o'lchamda qoladi
let TQ = 1;
function cv(size) { const c = canvas(size * TQ, size * TQ), g = c.getContext('2d'); g.scale(TQ, TQ); return [c, g]; }
// haqiqiy piksel o'lchamidagi mayda don — yaqindan qaraganda yuza "yuvilgan" ko'rinmaydi
function fine(c, g, amt = 0.1) {
  if (TQ < 2) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const n = (c.width * c.height) / 14;
  for (let i = 0; i < n; i++) { g.globalAlpha = amt * Math.random(); g.fillStyle = Math.random() < 0.5 ? '#000' : '#fff'; g.fillRect(Math.random() * c.width, Math.random() * c.height, 1, 1); }
  g.restore(); g.globalAlpha = 1;
}
function toTex(c, rep = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
function shade(c, f) {
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) * f)) | 0;
  const g = Math.min(255, Math.max(0, ((c >> 8) & 255) * f)) | 0;
  const b = Math.min(255, Math.max(0, (c & 255) * f)) | 0;
  return `rgb(${r},${g},${b})`;
}
function speckle(g, w, h, n, colors, smin, smax, alpha = 0.25) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * Math.random();
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    const s = smin + Math.random() * (smax - smin);
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  g.globalAlpha = 1;
}
function blobs(g, w, h, n, color, rmin, rmax, alpha) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = rmin + Math.random() * (rmax - rmin);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color.replace('A', alpha)); gr.addColorStop(1, color.replace('A', 0));
    g.fillStyle = gr;
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
    }
  }
}

// Devor teksturasi (derazasiz — derazalar endi haqiqiy teshik)
function wallTex(style) {
  const [c, g] = cv(256);
  const base = style.base;
  g.fillStyle = hex(base); g.fillRect(0, 0, 256, 256);
  if (style.brick) {
    // g'isht orasidagi qorishma to'qroq — relyef xaritasida chuqurcha bo'lib chiqadi
    g.fillStyle = shade(base, 0.5); g.fillRect(0, 0, 256, 256);
    const bh = 16, bw = 40;
    for (let row = 0; row < 256 / bh; row++) {
      const off = (row % 2) * (bw / 2);
      for (let x = -bw; x < 256 + bw; x += bw) {
        const k = 0.82 + Math.random() * 0.32;
        g.fillStyle = shade(base, k);
        g.fillRect(x + off + 1, row * bh + 1, bw - 2, bh - 2);
        g.fillStyle = shade(base, k * 1.12); g.fillRect(x + off + 1, row * bh + 1, bw - 2, 1.5);
        g.fillStyle = shade(base, k * 0.8); g.fillRect(x + off + 1, row * bh + bh - 2.5, bw - 2, 1.5);
      }
    }
  } else {
    speckle(g, 256, 256, 2500, ['#000', '#fff'], 1, 3, 0.12);
    if (style.peel) {
      for (let i = 0; i < 6; i++) {
        const x = Math.random() * 220, y = Math.random() * 220, w = 20 + Math.random() * 40, h = 12 + Math.random() * 30;
        for (let yy = 0; yy < h; yy += 8) for (let xx = 0; xx < w; xx += 18) {
          g.fillStyle = shade(0x8a4b38, 0.8 + Math.random() * 0.3);
          g.fillRect(x + xx + ((yy / 8) % 2) * 9, y + yy, 16, 7);
        }
      }
    }
  }
  speckle(g, 256, 256, 1500, ['#000', '#222', '#555'], 1, 2, 0.2);
  blobs(g, 256, 256, 6, 'rgba(20,15,10,A)', 20, 60, 0.25);
  if (!style.brick) {
    // suvoqdagi ingichka yoriqlar
    g.strokeStyle = 'rgba(30,24,18,0.45)'; g.lineWidth = 0.7;
    for (let i = 0; i < 5; i++) { g.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 26; y += Math.random() * 22; g.lineTo(x, y); } g.stroke(); }
  }
  fine(c, g);
  return toTex(c);
}

function groundTex(era) {
  const [c, g] = cv(512);
  if (era === 'historical') {
    g.fillStyle = '#dfe4e8'; g.fillRect(0, 0, 512, 512);
    blobs(g, 512, 512, 40, 'rgba(120,110,95,A)', 20, 70, 0.35);
    blobs(g, 512, 512, 30, 'rgba(255,255,255,A)', 20, 80, 0.5);
    speckle(g, 512, 512, 6000, ['#9aa0a6', '#ffffff', '#6d655a'], 1, 3, 0.35);
  } else {
    g.fillStyle = '#c9ab7a'; g.fillRect(0, 0, 512, 512);
    blobs(g, 512, 512, 50, 'rgba(160,125,80,A)', 20, 90, 0.35);
    blobs(g, 512, 512, 40, 'rgba(230,205,160,A)', 20, 80, 0.35);
    speckle(g, 512, 512, 8000, ['#8a6c45', '#e8d4a8', '#6b5535'], 1, 3, 0.4);
    // mayda shag'al
    for (let i = 0; i < 260; i++) { const x = Math.random() * 512, y = Math.random() * 512, r = 0.8 + Math.random() * 2; g.fillStyle = 'rgba(60,45,28,0.5)'; g.beginPath(); g.ellipse(x + 0.6, y + 0.6, r, r * 0.8, 0, 0, 7); g.fill(); g.fillStyle = shade(0xb09570, 0.8 + Math.random() * 0.4); g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, 7); g.fill(); }
  }
  fine(c, g, 0.14);
  return toTex(c);
}
function roadTex(era) {
  const [c, g] = cv(256);
  if (era === 'historical') {
    g.fillStyle = '#55534f'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) for (let x = 0; x < 256; x += 16) {
      const k = 0.72 + Math.random() * 0.36, ex = x + 8 + (y / 16 % 2) * 4;
      g.fillStyle = shade(0x74716a, k * 0.86);
      g.beginPath(); g.ellipse(ex, y + 8, 7.4, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = shade(0x74716a, k);
      g.beginPath(); g.ellipse(ex - 0.4, y + 7.5, 5.6, 5.2, 0, 0, Math.PI * 2); g.fill();
    }
    blobs(g, 256, 256, 25, 'rgba(240,244,248,A)', 10, 40, 0.75);
  } else {
    g.fillStyle = '#4b4a48'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 5000, ['#222', '#777', '#5a5a5a'], 1, 2, 0.5);
    blobs(g, 256, 256, 12, 'rgba(200,170,120,A)', 15, 50, 0.4);
    g.strokeStyle = 'rgba(20,20,20,0.6)'; g.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { g.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  }
  fine(c, g, 0.16);
  return toTex(c);
}
function simpleTex(base, opts = {}) {
  const [c, g] = cv(128);
  g.fillStyle = hex(base); g.fillRect(0, 0, 128, 128);
  if (opts.planks || opts.boards) {
    for (let y = 0; y < 128; y += 21) { g.fillStyle = shade(base, 0.85 + Math.random() * 0.25); g.fillRect(0, y + 1, 128, 19); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, y, 128, 2); }
    if (opts.planks) {
      g.strokeStyle = shade(base, 0.55); g.lineWidth = 10; g.strokeRect(5, 5, 118, 118);
      g.beginPath(); g.moveTo(8, 8); g.lineTo(120, 120); g.stroke();
    }
  }
  if (opts.ridges) {
    for (let x = 0; x < 128; x += 8) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, 0, 3, 128); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 4, 0, 3, 128); }
    blobs(g, 128, 128, 6, 'rgba(110,60,30,A)', 5, 20, 0.5);
  }
  if (opts.bags) {
    // to'ldirilgan qoplar: o'rtasi bo'rtgan (yorug'), chetlari va oralig'i chuqur (to'q) — relyef xaritasi shundan olinadi
    g.fillStyle = shade(base, 0.3); g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 32) for (let x = -64; x < 160; x += 64) {
      const ox = x + ((y / 32) % 2) * 32, k = 0.86 + Math.random() * 0.24, r = 11;
      const gr = g.createRadialGradient(ox + 32, y + 13, 3, ox + 32, y + 16, 38);
      gr.addColorStop(0, shade(base, 1.1 * k)); gr.addColorStop(0.6, shade(base, 0.92 * k)); gr.addColorStop(1, shade(base, 0.42 * k));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(ox + 1 + r, y + 1.5); g.arcTo(ox + 63, y + 1.5, ox + 63, y + 30.5, r); g.arcTo(ox + 63, y + 30.5, ox + 1, y + 30.5, r); g.arcTo(ox + 1, y + 30.5, ox + 1, y + 1.5, r); g.arcTo(ox + 1, y + 1.5, ox + 63, y + 1.5, r); g.closePath(); g.fill();
      // mato to'qimasi va tikuv
      g.strokeStyle = 'rgba(0,0,0,0.10)'; g.lineWidth = 0.6;
      for (let i = 6; i < 60; i += 3.5) { g.beginPath(); g.moveTo(ox + i, y + 4); g.lineTo(ox + i, y + 28); g.stroke(); }
      g.strokeStyle = 'rgba(40,30,15,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(ox + 6, y + 16); g.lineTo(ox + 12, y + 16); g.stroke();
    }
  }
  if (opts.rust) blobs(g, 128, 128, 10, 'rgba(120,60,25,A)', 6, 25, 0.6);
  speckle(g, 128, 128, 900, ['#000', '#fff'], 1, 2, opts.noise ?? 0.15);
  fine(c, g);
  return toTex(c);
}
function padTex(letter) {
  const c = canvas(256, 256), g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(70,70,68,0.95)'; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#e8e2d0'; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e8e2d0'; g.font = 'bold 150px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, 128, 134);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function crossTex() {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#3d5a2e'; g.fillRect(0, 0, 128, 128);
  speckle(g, 128, 128, 600, ['#000', '#fff'], 1, 2, 0.12);
  g.strokeStyle = '#2a3d20'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
  g.fillStyle = '#f0e6c0'; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.fillText("O'Q-DORI", 64, 72);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function frondTex() {
  const c = canvas(128, 512), g = c.getContext('2d');
  g.clearRect(0, 0, 128, 512);
  for (let y = 500; y > 14; y -= 7) {
    const k = 1 - Math.abs((y - 200) / 310), len = 16 + 46 * Math.max(0.15, k);
    for (const s of [-1, 1]) {
      g.fillStyle = shade(0x648f36, 0.7 + Math.random() * 0.5);
      g.beginPath(); g.moveTo(64, y + 5); g.lineTo(64 + s * len, y - 22 - Math.random() * 8); g.lineTo(64 + s * len * 0.4, y - 14); g.lineTo(64, y - 7); g.closePath(); g.fill();
    }
  }
  g.fillStyle = '#6b6a32'; g.fillRect(61, 0, 6, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return t;
}
function tuftTex(H) {
  const c = canvas(64, 64), g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 26; i++) {
    const x = 6 + Math.random() * 52, h = 22 + Math.random() * 40, lean = (Math.random() - 0.5) * 22;
    g.strokeStyle = shade(H ? 0xa3925c : 0xc9b06a, 0.7 + Math.random() * 0.45); g.lineWidth = 1.6 + Math.random() * 1.8;
    g.beginPath(); g.moveTo(x, 64); g.quadraticCurveTo(x + lean * 0.3, 64 - h * 0.6, x + lean, 64 - h); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return t;
}
// uzoqdagi binolar fasadi: deraza qatorlari
function facadeTex(H) {
  const c = canvas(128, 128), g = c.getContext('2d'), base = H ? 0x6d6a66 : 0xa89878;
  g.fillStyle = hex(base); g.fillRect(0, 0, 128, 128);
  speckle(g, 128, 128, 500, ['#000', '#fff'], 2, 6, 0.08);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = Math.random() < 0.15 ? shade(base, 0.75) : shade(H ? 0x2a2c30 : 0x3a3f48, 0.7 + Math.random() * 0.5);
    g.fillRect(x * 32 + 9, y * 32 + 8, 14, 17);
  }
  for (let y = 0; y < 4; y++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y * 32, 128, 1.5); }
  return toTex(c);
}

let _glint = null;
function glintTexture() {
  if (_glint) return _glint;
  const c = canvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _glint = new THREE.CanvasTexture(c); _glint.colorSpace = THREE.SRGBColorSpace; return _glint;
}
// UV larni dunyo o'lchamiga moslash (tekstura cho'zilmasligi uchun)
function scaleUV(geo, w, h, d, s) {
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    let su, sv;
    if (f < 2) { su = d / s; sv = h / s; } else if (f < 4) { su = w / s; sv = d / s; } else { su = w / s; sv = h / s; }
    for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * su, uv.getY(k) * sv); }
  }
  uv.needsUpdate = true;
}

// ---------- Dunyo ----------
export class World {
  // opts: map ('town' | 'big'), night (tun, yomg'ir, chaqmoq), zombie (punktlar va qurol yashiklari), veh (transport joylari)
  constructor(scene, era, quality = 'high', opts = {}) {
    this.scene = scene; this.era = era; this.quality = quality;
    this.map = opts.map === 'big' ? 'big' : 'town'; this.night = !!opts.night; this.zombie = !!opts.zombie;
    this.half = MAPS[this.map].half; this.navN = Math.round((this.half * 2) / CELL);
    this.vehSpawns = opts.veh && opts.veh.length ? opts.veh : this.map === 'big' ? randomVehicles(Math.random, this.zombie) : VEHICLE_SPAWNS;
    this.boxes = []; this.mapRects = []; this.spawns = []; this.fires = []; this.smokes = []; this.fireLights = [];
    this.pits = []; this.pickups = []; this.clear = []; this.points = []; this.crates = [];
    this.flashT = -1; this.flashK = 0;
    this.rand = mulberry((era === 'historical' ? 1944 : 2026) + (this.map === 'big' ? 77 : 0));
    // bezak uchun alohida tasodif manbai: asosiy joylashuv (daraxt, to'siq) o'zgarmaydi
    this.rand2 = mulberry((era === 'historical' ? 4419 : 6202) + (this.map === 'big' ? 31 : 0));
    this.H = era === 'historical';
    this.lite = GFX.lite;   // dasturiy chizish: relyef xaritasi, bulut, o't va osmon aksi yo'q
    TQ = !this.lite && (quality === 'high' || quality === 'ultra') ? 2 : 1;
    this.makeMaterials();
    this.setupEnvironment();
    this.build();
    this.groundCover();
    // tom xaritasi: uy ichi va podvalga osmon yorug'ligi kam tushadi (gfx.js)
    this.roof = roofMap(this.boxes, this.half);
    GU.uRoof.value = this.roof.tex; GU.uRoofInfo.value.set(this.roof.G, 1 / (this.roof.G * 2), this.roof.HMAX, 1);
    GU.uWet.value = this.night ? 1 : 0;
    this.mergeStatic();
    this.buildNav();
  }
  dispose() { if (this.roof) this.roof.tex.dispose(); }
  r2(a = 0, b = 1) { return a + this.rand2() * (b - a); }

  // Qo'zg'almas jismlarni material bo'yicha birlashtirish: minglab alohida mesh o'rniga bir necha o'nta chizish chaqiruvi
  // (to'qnashuv qutilari this.boxes da alohida saqlanadi — bu faqat chizishga ta'sir qiladi)
  mergeStatic() {
    const groups = new Map(), drop = [], a = new THREE.Vector3(), b = new THREE.Vector3(), nm = new THREE.Matrix3();
    this.scene.updateMatrixWorld(true);
    for (const m of this.scene.children) {
      if (!m.isMesh || m.isInstancedMesh || m.userData.dyn || m === this.sky) continue;
      const mat = m.material, g = m.geometry;
      if (Array.isArray(mat) || !mat.isMeshStandardMaterial || mat.transparent || !g.attributes.normal || !g.attributes.uv) continue;
      const key = mat.uuid + (m.castShadow ? 'c' : '-') + (m.receiveShadow ? 'r' : '-');
      let G = groups.get(key);
      if (!G) groups.set(key, (G = { mat, cast: m.castShadow, recv: m.receiveShadow, pos: [], nor: [], uv: [] }));
      const ng = g.index ? g.toNonIndexed() : g, p = ng.attributes.position, n = ng.attributes.normal, u = ng.attributes.uv;
      nm.getNormalMatrix(m.matrixWorld);
      for (let i = 0; i < p.count; i++) {
        a.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
        G.pos.push(a.x, a.y, a.z); G.nor.push(b.x, b.y, b.z); G.uv.push(u.getX(i), u.getY(i));
      }
      if (ng !== g) ng.dispose();
      drop.push(m);
    }
    for (const m of drop) { this.scene.remove(m); m.geometry.dispose(); }
    for (const G of groups.values()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(G.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2));
      const mesh = new THREE.Mesh(g, G.mat);
      mesh.castShadow = G.cast; mesh.receiveShadow = G.recv; mesh.frustumCulled = false;
      this.scene.add(mesh);
    }
    this.staticMeshes = groups.size; this.mergedFrom = drop.length;
  }

  r(a = 0, b = 1) { return a + this.rand() * (b - a); }
  pick(arr) { return arr[(this.rand() * arr.length) | 0]; }

  makeMaterials() {
    const H = this.H, nm = this.quality !== 'low' && !this.lite;
    // o: n — relyef kuchi (0 — relyefsiz), fx — gfx.hook sozlamalari (macro, grime, wet)
    const std = (o) => {
      const n = o.n, fx = o.fx; delete o.n; delete o.fx;
      const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.92, metalness: 0 }, o));
      if (nm && n && m.map) m.normalMap = normalFrom(m.map, n);
      return hook(m, fx || {});
    };
    const wallStyles = H ? [
      { base: 0x8a4b38, brick: true },
      { base: 0x9c9384, peel: true },
      { base: 0x7d5a48, brick: true },
    ] : [
      { base: 0xcdb892 },
      { base: 0xd9d0bd },
      { base: 0xc4a877, peel: true },
    ];
    const WALL = { macro: true, grime: true, wet: true }, OUT = { macro: true, wet: true }, DAMP = { wet: true };
    this.mat = {
      walls: wallStyles.map((s) => std({ map: wallTex(s), n: s.brick ? 3.2 : 1.5, fx: WALL })),
      roof: std({ map: simpleTex(H ? 0x55524d : 0x9e9483, { noise: 0.3 }), n: 1.4, fx: OUT }),
      floor: std({ map: simpleTex(H ? 0x6b5334 : 0x8a7a62, { boards: true }), n: 2.4, roughness: 0.8 }),
      ground: std({ map: groundTex(this.era), n: H ? 1.6 : 2.6, fx: OUT }),
      road: std({ map: roadTex(this.era), n: H ? 3.6 : 1.8, roughness: H ? 0.85 : 0.88, fx: OUT }),
      crate: std({ map: simpleTex(H ? 0x7d6440 : 0x9b7d4f, { planks: true }), n: 2.6, roughness: 0.82, fx: DAMP }),
      container: simpleTex(0x9a9a9a, { ridges: true }),
      sandbag: std({ map: simpleTex(H ? 0x9c8c66 : 0xb8a479, { bags: true }), n: 3.4, fx: DAMP }),
      metal: std({ map: simpleTex(H ? 0x4b4e48 : 0x55524a, { rust: true, noise: 0.25 }), n: 1.3, roughness: 0.62, metalness: 0.55, fx: DAMP }),
      burnt: std({ map: simpleTex(0x2c2824, { rust: true, noise: 0.35 }), n: 1.6, roughness: 0.9, metalness: 0.2, fx: DAMP }),
      concrete: std({ map: simpleTex(H ? 0x8a8780 : 0xb3ada0, { noise: 0.25 }), n: 1.5, fx: OUT }),
      wall: std({ map: wallTex(H ? { base: 0x7b4636, brick: true } : { base: 0xa9a393 }), n: H ? 3.2 : 1.5, fx: WALL }),
      bark: std({ color: H ? 0x3f3a33 : 0x8a7350 }),
      leaf: H ? std({ color: 0x4f6b2c, side: THREE.DoubleSide }) : std({ map: frondTex(), alphaTest: 0.3, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.75 }),
      supply: std({ map: crossTex() }),
      // bezak: deraza va eshik romlari, uy poydevori, tom jihozlari
      trim: std({ color: H ? 0x3d3024 : 0x6b6558, roughness: 0.8, fx: DAMP }),
      plinth: std({ map: simpleTex(H ? 0x5e5a54 : 0x8f887a, { noise: 0.3 }), n: 1.5, fx: { macro: true, grime: true, wet: true } }),
      steel: std({ color: H ? 0x4a4d50 : 0xb8bcc0, roughness: 0.38, metalness: 0.85, fx: DAMP }),
      rock: std({ color: H ? 0x8f9499 : 0xa08a68, roughness: 0.95, flatShading: true, fx: DAMP }),
      tuft: std({ map: tuftTex(H), alphaTest: 0.35, alphaToCoverage: true, roughness: 1 }),
    };
    const rh = this.mat.road.map.clone(); rh.needsUpdate = true;
    this.mat.roadH = std({ map: rh, roughness: this.mat.road.roughness, fx: OUT });
    if (this.mat.road.normalMap) { const rn = this.mat.road.normalMap.clone(); rn.needsUpdate = true; this.mat.roadH.normalMap = rn; }
    const cc = this.mat.container, cn = nm ? normalFrom(cc, 4.5) : null;
    this.mat.containers = [0x8c3a2a, 0x2f5a7a, 0x4a6a3a, 0xb06a28, 0x6a6a6a].map((c) => std({ map: cc, normalMap: cn, color: c, roughness: 0.55, metalness: 0.45, fx: DAMP }));
  }
  // teksturaning takrorlanishi (rang va relyef xaritasi birga)
  setRepeat(mat, u, v) { mat.map.repeat.set(u, v); if (mat.normalMap) mat.normalMap.repeat.set(u, v); }

  setupEnvironment() {
    const H = this.H, scene = this.scene, N = this.night, Q = this.quality;
    // tun: qorong'ulik 30 m dan narini butunlay yashiradi (tuman rangi qora); chaqmoq chaqqanda bir lahzaga hammasi ko'rinadi
    const fogColor = N ? 0x05070a : H ? 0x9ea6ae : 0xdac9a8;
    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.Fog(fogColor, N ? 3 : H ? 15 : 30, N ? 34 : H ? 175 : 240);

    // osmon yorug'ligining bir qismi atrof-muhit xaritasidan keladi (main.js: makeEnv) — yarim shar chirog'i shunga yarasha kuchsizroq
    const LT = this.lite;   // yengil rejimda atrof-muhit xaritasi yo'q — yarim shar chirog'i to'liq kuchda
    const hemi = new THREE.HemisphereLight(N ? 0x6f86b0 : H ? 0xc4ccd6 : 0xfff2dd, N ? 0x14181e : H ? 0x5a5852 : 0x8a7350, N ? 0.42 : H ? (LT ? 1.25 : 0.62) : (LT ? 1.05 : 0.5));
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(N ? 0x9fb4d8 : H ? 0xdfe6f0 : 0xffecc8, N ? 0.45 : H ? 1.6 : 3.3);
    const sd = H ? new THREE.Vector3(-0.5, 0.8, 0.35) : new THREE.Vector3(0.45, 0.75, -0.35);
    sd.normalize();
    sun.position.copy(sd).multiplyScalar(110);
    sun.target.position.set(0, 0, 0);
    if (Q !== 'low') {
      sun.castShadow = true;
      const ms = Q === 'ultra' ? 8192 : Q === 'high' ? 4096 : 2048;
      sun.shadow.mapSize.set(ms, ms);
      const sc = sun.shadow.camera, se = this.half + 18;
      sc.left = -se; sc.right = se; sc.top = se; sc.bottom = -se; sc.near = 10; sc.far = 290;
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    }
    scene.add(sun); scene.add(sun.target);
    this.sun = sun;
    this.sunDir = N ? null : sd.clone();     // quyosh nurlari (post.js) uchun; tunda yo'q
    this.envGain = N ? 1 : H ? 0.62 : 0.5;  // atrof-muhit xaritasining yorqinligi

    // bulutli osmon (gfx.js): kunduzi — siyrak bulutlar va quyosh, qishda — qalin bulut, tunda — bo'ronli osmon
    this.sky = makeSky({
      top: N ? 0x0a0e15 : H ? 0x56637a : 0x2f6cc0, bottom: fogColor, ground: N ? 0x030405 : H ? 0x8c9196 : 0x9a8460,
      sunDir: sd, sunColor: N ? 0x9fb4d8 : H ? 0xc9d0d8 : 0xfff1c8, sunAmt: N ? 0.1 : H ? 0.3 : 1.0,
      cloudLit: N ? 0x161b25 : H ? 0xc6ccd4 : 0xffffff, cloudDark: N ? 0x06080b : H ? 0x6c747e : 0xa4adba,
      cover: N ? 0.88 : H ? 0.76 : 0.44, oct: LT ? 1 : Q === 'low' ? 3 : 5, cloudK: LT ? 0 : 1,
    });
    const skyMat = this.sky.material;
    scene.add(this.sky);
    // rang tuzatish (post.js): davr va ob-havoga mos kayfiyat
    const C3 = (r, g, b) => new THREE.Color(r, g, b);
    this.grade = N ? { exposure: 1.12, sat: 0.82, contrast: 1.0, tint: C3(0.93, 0.98, 1.07), bloom: 0.16, rays: 0, vig: 0.42, grain: 0.045, ao: 0.9 }
      : H ? { exposure: 1.02, sat: 0.84, contrast: 1.25, tint: C3(0.97, 1.0, 1.04), bloom: 0.07, rays: 0.25, raysC: C3(0.8, 0.85, 0.95), vig: 0.28, grain: 0.03, ao: 0.95 }
        : { exposure: 1.0, sat: 1.06, contrast: 1.2, tint: C3(1.03, 1.0, 0.95), bloom: 0.08, rays: 0.6, raysC: C3(1.0, 0.88, 0.66), vig: 0.22, grain: 0.018, ao: 0.9 };
    // chaqmoq uchun boshlang'ich qiymatlar
    this.env = { hemi, sun, sky: skyMat, fog: scene.fog, bg: scene.background, far: scene.fog.far, hemiI: hemi.intensity, sunI: sun.intensity,
      fogC: new THREE.Color(fogColor), top: skyMat.uniforms.top.value.clone(), flashC: new THREE.Color(0x93a4c2), flashTop: new THREE.Color(0x56658a) };
  }
  // Chaqmoq: butun xarita bir lahzaga yorishadi (k — kuchi), so'ng yana qorong'ilik
  flash(k = 1) { if (this.night) { this.flashT = 0; this.flashK = k; } }
  updateFlash(dt) {
    if (this.flashT < 0) return 0;
    this.flashT += dt;
    const t = this.flashT, E = this.env;
    // ikki marta chaqnab, so'ng asta so'nadi
    let f = t < 0.07 ? 1 : t < 0.14 ? 0.25 : t < 0.24 ? 0.95 : Math.max(0, 0.95 * Math.exp(-(t - 0.24) * 3.2) - 0.02);
    f *= this.flashK;
    if (t > 2.2) { f = 0; this.flashT = -1; }
    E.fog.far = E.far + f * 300; E.fog.near = 3 + f * 40;
    E.fog.color.copy(E.fogC).lerp(E.flashC, f * 0.85); E.bg.copy(E.fog.color);
    E.sky.uniforms.bottom.value.copy(E.fog.color); E.sky.uniforms.top.value.copy(E.top).lerp(E.flashTop, f); E.sky.uniforms.flash.value = f;
    E.hemi.intensity = E.hemiI + f * 2.6; E.sun.intensity = E.sunI + f * 3.2;
    return f;
  }

  // Asosiy qattiq quti (to'qnashuv bilan)
  solid(x, y0, z, w, h, d, mat, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (opts.uv) scaleUV(geo, w, h, d, opts.uv);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y0 + h / 2, z);
    m.castShadow = opts.shadow !== false; m.receiveShadow = true;
    this.scene.add(m);
    if (opts.collide !== false) {
      this.boxes.push(new THREE.Box3(new THREE.Vector3(x - w / 2, y0, z - d / 2), new THREE.Vector3(x + w / 2, y0 + h, z + d / 2)));
      if (opts.map !== false && h > 0.6 && y0 > -0.5 && y0 < 1) this.mapRects.push({ x: x - w / 2, z: z - d / 2, w, d, h, c: opts.mapColor });
    }
    return m;
  }
  deco(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = shadow; m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }
  plane(mat, x, y, z, w, d) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  build() {
    const H = this.H, hf = this.half, big = this.map === 'big';
    // Bo'sh qoldiriladigan joylar (transport, markaz, punktlar)
    for (const v of this.vehSpawns) this.clear.push({ x: v.x, z: v.z, r: big ? 12 : v.type === 'chinook' ? 11 : v.type === 'heli' ? 9 : v.type === 'truck' ? 8 : v.type === 'tank' || v.type === 'ltank' ? 7 : 5 });
    this.clear.push({ x: 0, z: 2, r: 6 });
    if (big) for (const p of BIG_POINTS) this.clear.push({ x: p.x, z: p.z, r: 10 });

    for (const hd of big ? HOUSES_BIG : HOUSES) this.house(hd);
    this.buildGround();

    // Yo'llar (xoch shaklida; katta xaritada — qo'shimcha halqa yo'llar)
    this.plane(this.mat.road, 0, 0.012, 0, 8, hf * 2);
    this.plane(this.mat.roadH, 0, 0.014, 0, hf * 2, 8);
    this.setRepeat(this.mat.road, 2, hf / 2);
    this.setRepeat(this.mat.roadH, hf / 2, 2);
    if (big) for (const r of [-64, 64]) { this.plane(this.mat.road, r, 0.011, 0, 7, hf * 2); this.plane(this.mat.roadH, 0, 0.013, r, hf * 2, 7); }

    // Chegara devorlari
    const wh = 5, L = hf * 2 + 2;
    this.solid(0, 0, -hf - 0.5, L, wh, 1, this.mat.wall, { uv: 4 });
    this.solid(0, 0, hf + 0.5, L, wh, 1, this.mat.wall, { uv: 4 });
    this.solid(-hf - 0.5, 0, 0, 1, wh, L, this.mat.wall, { uv: 4 });
    this.solid(hf + 0.5, 0, 0, 1, wh, L, this.mat.wall, { uv: 4 });

    this.buildPlaza();
    this.buildPads();
    if (this.zombie) this.buildZombieRoute();

    // To'siqlar — markazga nisbatan simmetrik (ikkala tomon uchun adolatli)
    const cover = big ? COVER_BIG : [
      ['bags', 20, -12, false], ['wreck', 22, 9, true], ['crates', 9, -27, false], ['wall', 0, -25, false],
      ['big', 46, -34, true], ['hedge', 10, 31, false], ['barrels', 50, -8, false], ['crates', 34, -58, false],
      ['bags', 30, -6, true], ['wreck', -40, -50, false], ['hedge', 24, -60, false], ['bags', 60, 22, true],
    ];
    for (const [type, x, z, rot] of cover) for (const sg of [1, -1]) {
      // transport joyi yoki punkt ustiga tushadigan to'siq qo'yilmaydi (katta xaritada joylar tasodifiy)
      if (big && this.clear.some((c) => c.r >= 10 && Math.hypot(c.x - x * sg, c.z - z * sg) < c.r + 5)) continue;
      this.coverItem(type, x * sg, z * sg, rot);
    }

    // Daraxtlar
    let placed = 0, tries = 0;
    const nTrees = big ? 34 : 11, tr = hf - 4;
    while (placed < nTrees && tries++ < (big ? 1500 : 400)) {
      const x = this.r(-tr, tr), z = this.r(-tr, tr);
      if (!this.freeSpot(x, z, 2.5) || (big && !this.freeSpot(-x, -z, 2.5))) continue;   // kichik xaritada avvalgi joylashuv saqlanadi
      this.tree(x, z); this.tree(-x, -z); placed++;
    }

    this.backdrop();

    // Paydo bo'lish nuqtalari (perimetr bo'ylab)
    for (let p = -(hf - 10); p <= hf - 10; p += 20) {
      for (const s of [new THREE.Vector3(p, 0, -(hf - 4)), new THREE.Vector3(p, 0, hf - 4), new THREE.Vector3(-(hf - 4), 0, p), new THREE.Vector3(hf - 4, 0, p)]) {
        if (this.clear.every((c) => Math.hypot(c.x - s.x, c.z - s.z) > c.r + 4)) this.spawns.push(s);
      }
    }

    for (let i = 0; i < Math.min(2, this.fires.length); i++) {
      const Lt = new THREE.PointLight(0xff7a2a, 18, 14, 2);
      Lt.position.copy(this.fires[i]).add(new THREE.Vector3(0, 1.2, 0));
      this.scene.add(Lt);
      this.fireLights.push(Lt);
    }
  }

  // Zombi rejimi: punktlar (A → B → C → D) va yo'l bo'ylab qurol yashiklari
  buildZombieRoute() {
    const letter = (ch, color) => {
      const c = canvas(128, 128), g = c.getContext('2d');
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
      g.strokeStyle = color; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke();
      g.fillStyle = color; g.font = 'bold 84px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    for (const p of BIG_POINTS) {
      const col = p.id === 'D' ? '#7dff9a' : '#ffcc55', hex3 = p.id === 'D' ? 0x7dff9a : 0xffcc55;
      // yorug' ustun va halqa: qorong'ida uzoqdan ham ko'rinadi (tuman ta'sir qilmaydi)
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 70, 14, 1, true),
        new THREE.MeshBasicMaterial({ color: hex3, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.set(p.x, 35, p.z); this.scene.add(beam);
      const ring = new THREE.Mesh(new THREE.RingGeometry(7.6, 8, 48), new THREE.MeshBasicMaterial({ color: hex3, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.05, p.z); this.scene.add(ring);
      const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: letter(p.id, col), depthTest: false, transparent: true, fog: false }));
      mark.scale.set(3, 3, 1); mark.position.set(p.x, 5.5, p.z); mark.renderOrder = 998; this.scene.add(mark);
      this.points.push({ id: p.id, x: p.x, z: p.z, r: 8, beam, ring, mark });
      // punkt yonida qum qoplari va yonib turgan bochka (yorug'lik manbai)
      this.solid(p.x + 5, 0, p.z + 3, 3.4, 0.9, 0.7, this.mat.sandbag, { uv: 1.2 });
      this.solid(p.x - 5, 0, p.z - 3, 0.7, 0.9, 3.4, this.mat.sandbag, { uv: 1.2 });
      this.solid(p.x - 3.5, 0, p.z + 4.5, 0.7, 0.95, 0.7, this.mat.metal, { map: false });
      this.fires.push(new THREE.Vector3(p.x - 3.5, 1.0, p.z + 4.5));
      const Lt = new THREE.PointLight(0xff8a3a, 30, 20, 2); Lt.position.set(p.x - 3.5, 2.0, p.z + 4.5); this.scene.add(Lt); this.fireLights.push(Lt);
    }
    // qurol yashiklari
    const body = hook(new THREE.MeshStandardMaterial({ map: simpleTex(0x3f4a34, { boards: true }), roughness: 0.85 }), { wet: true });
    const glow = new THREE.MeshBasicMaterial({ color: 0x9dff7a, fog: false });
    BIG_CRATES.forEach(([x, z, kind], id) => {
      this.solid(x, 0, z, 1.25, 0.55, 0.7, body, { map: false });
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.29, 0.1, 0.74), body); lid.geometry.translate(0, 0.05, 0.37);
      lid.position.set(x, 0.55, z - 0.37); lid.castShadow = true; lid.userData.dyn = true; this.scene.add(lid);   // qopqoq ochiladi — birlashtirilmaydi
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.03), glow); lamp.position.set(x, 0.36, z + 0.365); this.scene.add(lamp);
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture(), color: 0x9dff7a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.8 }));
      tag.scale.set(1.3, 1.3, 1); tag.position.set(x, 1.25, z); this.scene.add(tag);
      this.crates.push({ id, x, z, kind, lid, lamp, tag, open: false, pos: new THREE.Vector3(x, 0.3, z) });
    });
  }

  freeSpot(x, z, m) {
    if (Math.abs(x) < 6 || Math.abs(z) < 6) return false;
    for (const c of this.clear) if (Math.hypot(c.x - x, c.z - z) < c.r + m) return false;
    for (const b of this.boxes) {
      if (b.max.y < 0.3) continue;
      if (x > b.min.x - m && x < b.max.x + m && z > b.min.z - m && z < b.max.z + m) return false;
    }
    return true;
  }

  // ---------- Uy (ichiga kirish mumkin) ----------
  wallRun(ax, fixed, a0, a1, ops, h, t, mat) {
    const seg = (u0, u1, y0, y1) => {
      if (u1 - u0 < 0.02) return;
      const len = u1 - u0, c = (u0 + u1) / 2;
      if (ax === 'x') this.solid(c, y0, fixed, len, y1 - y0, t, mat, { uv: 3, map: y0 === 0 });
      else this.solid(fixed, y0, c, t, y1 - y0, len, mat, { uv: 3, map: y0 === 0 });
    };
    // bezak (to'qnashuvsiz): poydevor tasmasi, deraza va eshik romlari
    const bar = (u0, u1, y0, y1, th, m) => {
      if (u1 - u0 < 0.02) return;
      const len = u1 - u0, c = (u0 + u1) / 2;
      this.deco(new THREE.BoxGeometry(ax === 'x' ? len : th, y1 - y0, ax === 'x' ? th : len), m, ax === 'x' ? c : fixed, (y0 + y1) / 2, ax === 'x' ? fixed : c, 0, 0, 0, false);
    };
    const T = this.mat.trim, P = this.mat.plinth;
    let cur = a0;
    for (const op of ops) {
      const s = op.c - op.w / 2, e = op.c + op.w / 2;
      seg(cur, s, 0, h); bar(cur, s, 0, 0.38, t + 0.1, P);
      if (op.type === 'door') {
        seg(s, e, 2.3, h);
        bar(s - 0.09, s, 0, 2.3, t + 0.08, T); bar(e, e + 0.09, 0, 2.3, t + 0.08, T); bar(s - 0.09, e + 0.09, 2.3, 2.41, t + 0.1, T);
      } else {
        seg(s, e, 0, 1.0); seg(s, e, 2.2, h); bar(s, e, 0, 0.38, t + 0.1, P);
        bar(s - 0.1, e + 0.1, 0.96, 1.03, t + 0.22, T);                                   // deraza tokchasi
        bar(s - 0.06, s, 1.03, 2.2, t + 0.06, T); bar(e, e + 0.06, 1.03, 2.2, t + 0.06, T); bar(s - 0.08, e + 0.08, 2.2, 2.29, t + 0.1, T);
      }
      cur = e;
    }
    seg(cur, a1, 0, h); bar(cur, a1, 0, 0.38, t + 0.1, P);
  }

  house(hd) {
    const { x: cx, z: cz, w, d } = hd, t = 0.3, h = 3.2;
    const mat = this.pick(this.mat.walls);
    const zDoor = cz < 0 ? 1 : -1;   // markazga qaragan tomonda eshik
    const xDoor = cx < 0 ? 1 : -1;
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const win = (c) => ({ c, w: 1.4, type: 'window' }), door = (c) => ({ c, w: 2.0, type: 'door' });
    for (const s of [-1, 1]) {
      this.wallRun('x', s < 0 ? z0 + t / 2 : z1 - t / 2, x0, x1, [win(cx - w * 0.3), s === zDoor ? door(cx) : win(cx), win(cx + w * 0.3)], h, t, mat);
      this.wallRun('z', s < 0 ? x0 + t / 2 : x1 - t / 2, z0 + t, z1 - t, [win(cz - d * 0.3), s === xDoor ? door(cz) : win(cz), win(cz + d * 0.3)], h, t, mat);
    }
    this.solid(cx, h, cz, w + 0.8, 0.25, d + 0.8, this.mat.roof, { map: false, uv: 3 });
    this.clear.push({ x: cx, z: cz, r: Math.max(w, d) / 2 + 2 });
    this.roofDetail(cx, cz, w, d, h + 0.25);
    // ichki jihoz
    const fx = x1 - 1.4, fz = zDoor > 0 ? z0 + 1.4 : z1 - 1.4;
    if (hd.base === undefined) {
      this.plane(this.mat.floor, cx, 0.02, cz, w - 0.5, d - 0.5);
      this.solid(fx - 0.4, 0, fz, 1.8, 0.9, 0.9, this.mat.crate, { map: false });
      this.solid(x0 + 1.3, 0, zDoor > 0 ? z0 + 1.2 : z1 - 1.2, 1.1, 1.1, 1.1, this.mat.crate, { map: false });
    } else {
      this.basement(hd, cx, cz, x0 + t + 0.1, x1 - t - 0.1, z0 + t + 0.1, z1 - t - 0.1, -zDoor);
      this.solid(fx, 0, zDoor > 0 ? z1 - 1.4 : z0 + 1.4, 1.1, 1.1, 1.1, this.mat.crate, { map: false });
    }
  }

  // Tom cheti (karniz) va tom ustidagi jihozlar: mo'ri, suv baki, konditsioner, antenna
  roofDetail(cx, cz, w, d, y) {
    const H = this.H, P = this.mat.plinth, o = { map: false, uv: 2 };
    for (const s of [-1, 1]) {
      this.deco(new THREE.BoxGeometry(w + 0.96, 0.14, 0.16), P, cx, y + 0.07, cz + s * (d / 2 + 0.4), 0, 0, 0, false);
      this.deco(new THREE.BoxGeometry(0.16, 0.14, d + 0.64), P, cx + s * (w / 2 + 0.4), y + 0.07, cz, 0, 0, 0, false);
    }
    const px = cx + this.r2(-0.3, 0.3) * w, pz = cz + this.r2(-0.3, 0.3) * d, k = this.rand2();
    if (H) {
      this.solid(px, y, pz, 0.7, 1.3, 0.7, this.mat.walls[0], o);                                     // mo'ri
      this.deco(new THREE.BoxGeometry(0.86, 0.12, 0.86), P, px, y + 1.36, pz);
    } else if (k < 0.5) {
      // suv baki (oyoqlarda)
      this.boxes.push(new THREE.Box3(new THREE.Vector3(px - 0.6, y, pz - 0.6), new THREE.Vector3(px + 0.6, y + 1.5, pz + 0.6)));
      this.deco(new THREE.CylinderGeometry(0.6, 0.6, 1.0, 14), this.mat.steel, px, y + 1.0, pz);
      for (const a of [-1, 1]) for (const b of [-1, 1]) this.deco(new THREE.BoxGeometry(0.07, 0.5, 0.07), this.mat.metal, px + a * 0.42, y + 0.25, pz + b * 0.42);
    } else {
      this.solid(px, y, pz, 1.1, 0.7, 0.8, this.mat.steel, o);                                         // konditsioner bloki
      this.deco(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 5), this.mat.metal, px + 1.6, y + 1.2, pz + 0.8, 0, 0, 0, false);   // antenna
      this.deco(new THREE.BoxGeometry(0.9, 0.02, 0.02), this.mat.metal, px + 1.6, y + 2.1, pz + 0.8, 0, 0, 0, false);
      this.deco(new THREE.BoxGeometry(0.6, 0.02, 0.02), this.mat.metal, px + 1.6, y + 1.8, pz + 0.8, 0, 0, 0, false);
    }
  }

  // Yer qoplami: toshlar va o't tutamlari (bir chizish chaqiruvi — InstancedMesh; to'qnashuvsiz)
  groundCover() {
    if (this.quality === 'low' || this.lite) return;
    const big = this.map === 'big', hf = this.half - 2, M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const spot = () => { for (let i = 0; i < 30; i++) { const x = this.r2(-hf, hf), z = this.r2(-hf, hf); if (Math.abs(x) > 5 && Math.abs(z) > 5 && this.freeSpot(x, z, 0.4)) return [x, z]; } return null; };
    const nR = big ? 520 : 220, rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), this.mat.rock, nR);
    let c = 0;
    for (let i = 0; i < nR; i++) {
      const s = spot(); if (!s) continue;
      const r = this.r2(0.06, 0.2) * (this.rand2() < 0.08 ? 2.2 : 1);
      e.set(this.r2(0, 6), this.r2(0, 6), this.r2(0, 6)); q.setFromEuler(e);
      M.compose(p.set(s[0], r * 0.25, s[1]), q, sc.set(r * this.r2(0.8, 1.5), r * this.r2(0.5, 0.9), r * this.r2(0.8, 1.4)));
      rocks.setMatrixAt(c++, M);
    }
    rocks.count = c; rocks.castShadow = true; rocks.receiveShadow = true; rocks.frustumCulled = false; rocks.userData.dyn = true; this.scene.add(rocks);
    // o't: ikki kesishgan tekislik, normali yuqoriga (yer kabi yoritiladi)
    const tg = new THREE.BufferGeometry(), pos = [], uv = [], nor = [];
    for (const a of [0, Math.PI / 2]) {
      const cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1], [0, 0], [1, 1], [1, 0], [0, 0], [0, 1], [1, 1]]) { pos.push((u * 2 - 1) * cx, v, (u * 2 - 1) * cz); uv.push(u, v); nor.push(0, 1, 0); }
    }
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); tg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const nT = (big ? 4200 : 1700) * (this.quality === 'medium' ? 0.5 : 1) | 0, tufts = new THREE.InstancedMesh(tg, this.mat.tuft, nT);
    c = 0;
    for (let i = 0; i < nT; i++) {
      const s = spot(); if (!s) continue;
      const w = this.r2(0.35, 0.8), h = this.r2(0.18, 0.5) * (this.H ? 0.75 : 1);
      e.set(0, this.r2(0, 3.14), 0); q.setFromEuler(e);
      M.compose(p.set(s[0], 0, s[1]), q, sc.set(w, h, w));
      tufts.setMatrixAt(c++, M);
    }
    tufts.count = c; tufts.receiveShadow = true; tufts.frustumCulled = false; tufts.userData.dyn = true; this.scene.add(tufts);
  }

  basement(hd, cx, cz, px0, px1, pz0, pz1, sz) {
    const floor = -3, m = this.mat.concrete, o = { map: false, shadow: false, uv: 3 };
    const pit = { x0: px0, x1: px1, z0: pz0, z1: pz1, floor };
    // yer ostidagi devorlar
    const rt = 0.6, top = -0.02, y0 = floor - 0.3, hh = top - y0;
    this.solid((px0 + px1) / 2, y0, pz0 - rt / 2, px1 - px0 + rt * 2, hh, rt, m, o);
    this.solid((px0 + px1) / 2, y0, pz1 + rt / 2, px1 - px0 + rt * 2, hh, rt, m, o);
    this.solid(px0 - rt / 2, y0, (pz0 + pz1) / 2, rt, hh, pz1 - pz0, m, o);
    this.solid(px1 + rt / 2, y0, (pz0 + pz1) / 2, rt, hh, pz1 - pz0, m, o);
    this.plane(m, (px0 + px1) / 2, floor + 0.005, (pz0 + pz1) / 2, px1 - px0, pz1 - pz0);
    // zinapoya o'rni va birinchi qavat poli
    const sw = 1.3, sx0 = px0 + 0.7, open1 = sx0 + 4.0;
    const bz0 = sz > 0 ? pz1 - sw : pz0, bz1 = sz > 0 ? pz1 : pz0 + sw, bzc = (bz0 + bz1) / 2;
    const az0 = sz > 0 ? pz0 : pz0 + sw, az1 = sz > 0 ? pz1 - sw : pz1;
    const fo = { map: false, uv: 2 };
    this.solid((px0 + px1) / 2, -0.25, (az0 + az1) / 2, px1 - px0, 0.25, az1 - az0, this.mat.floor, fo);
    this.solid((px0 + sx0) / 2, -0.25, bzc, sx0 - px0, 0.25, sw, this.mat.floor, fo);
    this.solid((open1 + px1) / 2, -0.25, bzc, px1 - open1, 0.25, sw, this.mat.floor, fo);
    for (let i = 0; i < 7; i++) {
      const topY = -(i + 1) * 0.375;
      this.solid(sx0 + i * 0.5 + 0.25, floor, bzc, 0.5, topY - floor, sw, m, { map: false, uv: 2 });
    }
    pit.stairTop = new THREE.Vector3(sx0 + 0.25, 0, sz > 0 ? bz0 - 0.7 : bz1 + 0.7);
    pit.stairStep = new THREE.Vector3(sx0 + 0.25, -0.375, bzc);
    pit.stairBot = new THREE.Vector3(sx0 + 3.9, floor, bzc);
    pit.open = { x0: sx0, x1: open1, z0: bz0, z1: bz1 };
    this.pits.push(pit);
    // podval jihozlari va noyob qurol supasi
    const pxp = px1 - 1.1, pzp = sz > 0 ? pz0 + 1.1 : pz1 - 1.1;
    this.solid(pxp, floor, pzp, 0.9, 0.8, 0.9, this.mat.crate, { map: false });
    this.solid(px0 + 1.2, floor, sz > 0 ? pz0 + 1.0 : pz1 - 1.0, 1.2, 1.2, 1.2, this.mat.crate, { map: false });
    this.solid(cx + 0.5, floor, cz - sz * 0.3, 0.6, 0.95, 0.6, this.mat.metal, { map: false });
    this.pickups.push({ id: hd.base, pos: new THREE.Vector3(pxp, floor + 1.3, pzp), pit: this.pits.length - 1 });
  }

  // Yer — podvallar ustida teshiklari bilan
  buildGround() {
    const E = 380;
    const xs = [-E, E], zs = [-E, E];
    for (const p of this.pits) { xs.push(p.x0, p.x1); zs.push(p.z0, p.z1); }
    xs.sort((a, b) => a - b); zs.sort((a, b) => a - b);
    const pos = [], uv = [], nor = [];
    const S = 5;
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
      const xa = xs[i], xb = xs[i + 1], za = zs[j], zb = zs[j + 1];
      if (xb - xa < 1e-6 || zb - za < 1e-6) continue;
      if (this.pitIndexXZ((xa + xb) / 2, (za + zb) / 2) >= 0) continue;
      for (const [x, z] of [[xa, za], [xa, zb], [xb, zb], [xa, za], [xb, zb], [xb, za]]) { pos.push(x, 0, z); uv.push(x / S, z / S); nor.push(0, 1, 0); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const ground = new THREE.Mesh(g, this.mat.ground);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  buildPads() {
    const hm = new THREE.MeshStandardMaterial({ map: padTex('H'), transparent: true, roughness: 0.9 });
    const pm = new THREE.MeshStandardMaterial({ map: padTex('P'), transparent: true, roughness: 0.9 });
    for (const v of this.vehSpawns) {
      if (v.type === 'cannon') {
        // zenit pushkasi atrofida qum qoplari
        const s = Math.sign(v.z) || 1;
        this.solid(v.x, 0, v.z + s * 2.3, 4.4, 0.9, 0.7, this.mat.sandbag, { uv: 1.2 });
        this.solid(v.x - 2.4, 0, v.z + s * 0.6, 0.7, 0.9, 3.4, this.mat.sandbag, { uv: 1.2 });
        this.solid(v.x + 2.4, 0, v.z + s * 0.6, 0.7, 0.9, 3.4, this.mat.sandbag, { uv: 1.2 });
        continue;
      }
      const fly = v.type === 'heli' || v.type === 'chinook';
      const r = v.type === 'chinook' ? 8 : v.type === 'heli' ? 6 : v.type === 'truck' ? 5.4 : v.type === 'tank' || v.type === 'ltank' ? 4.8 : v.type === 'quad' ? 2.6 : 3.5;
      const pad = new THREE.Mesh(new THREE.CircleGeometry(r, 40), fly ? hm : pm);
      pad.rotation.x = -Math.PI / 2; pad.position.set(v.x, 0.02, v.z); pad.receiveShadow = true;
      this.scene.add(pad);
    }
  }

  buildPlaza() {
    const H = this.H;
    this.playerSpawn = new THREE.Vector3(0, 0, 9);
    this.supplyPos = new THREE.Vector3(-5, 0, 5);
    this.solid(-5, 0, 5, 1.4, 0.9, 0.9, this.mat.supply, { mapColor: '#3c8a3c' });
    if (H) {
      this.solid(0, 0, -5, 3.4, 1.4, 3.4, this.mat.concrete, { uv: 2 });
      const sm = new THREE.MeshStandardMaterial({ color: 0x5c6a5e, roughness: 0.6, metalness: 0.5 });
      this.deco(new THREE.BoxGeometry(0.8, 1.6, 0.6), sm, 0, 2.6, -5);
      this.deco(new THREE.BoxGeometry(0.5, 0.5, 0.5), sm, 0, 3.7, -5);
      this.deco(new THREE.BoxGeometry(0.2, 1.4, 0.2), sm, 0.5, 3.2, -5, 0, 0, -0.6);
      this.deco(new THREE.BoxGeometry(0.7, 0.6, 0.5), sm, 0, 1.7, -5);
    } else {
      this.deco(new THREE.CylinderGeometry(0.08, 0.2, 14, 6), this.mat.metal, 0, 7, -5);
      this.boxes.push(new THREE.Box3(new THREE.Vector3(-0.3, 0, -5.3), new THREE.Vector3(0.3, 14, -4.7)));
      this.solid(0, 0, -5, 2.2, 0.7, 2.2, this.mat.concrete, { uv: 2 });
    }
    const s = this.mat.sandbag;
    this.solid(8, 0, -7, 4, 1.0, 0.7, s, { uv: 1.2 });
    this.solid(-8, 0, 9, 4, 1.0, 0.7, s, { uv: 1.2 });
    this.solid(9, 0, 7, 0.7, 1.0, 3.5, s, { uv: 1.2 });
    this.solid(-9, 0, -5, 0.7, 1.0, 3.5, s, { uv: 1.2 });
  }

  tree(x, z) {
    if (this.H) {
      const h = this.r(4, 7);
      this.deco(new THREE.CylinderGeometry(0.1, 0.24, h, 7), this.mat.bark, x, h / 2, z);
      for (let i = 0; i < 5; i++) {
        const bl = this.r(1, 2.2), by = this.r(h * 0.45, h * 0.95), a = this.r(0, Math.PI * 2);
        const br = this.deco(new THREE.CylinderGeometry(0.03, 0.07, bl, 5), this.mat.bark, x + Math.cos(a) * bl * 0.4, by, z + Math.sin(a) * bl * 0.4);
        br.rotation.order = 'YXZ'; br.rotation.set(0.9, -a + Math.PI / 2, 0);
      }
    } else {
      const h = this.r(5.5, 8.5);
      const lean = this.r(-0.12, 0.12);
      this.deco(new THREE.CylinderGeometry(0.16, 0.26, h, 8), this.mat.bark, x, h / 2, z, lean, 0, lean);
      const leafG = new THREE.PlaneGeometry(1.5, 3.6, 2, 6);
      leafG.translate(0, 1.8, 0);
      // barg uchiga qarab egiladi, o'rtasi bo'ylab bukilgan
      { const lp = leafG.attributes.position; for (let i = 0; i < lp.count; i++) { const yy = lp.getY(i), xx = lp.getX(i); lp.setZ(i, -0.11 * yy * yy - Math.abs(xx) * 0.22); } leafG.computeVertexNormals(); }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const lf = this.deco(leafG, this.mat.leaf, x + lean * h * 0.5, h, z + lean * h * 0.5);
        lf.rotation.order = 'YXZ'; lf.rotation.set(1.15 + this.r(-0.2, 0.3), a, 0);
      }
      for (let i = 0; i < 7; i++) {
        const lf = this.deco(leafG, this.mat.leaf, x + lean * h * 0.5, h + 0.1, z + lean * h * 0.5);
        lf.rotation.order = 'YXZ'; lf.rotation.set(0.55 + this.r2(-0.2, 0.3), (i / 7) * Math.PI * 2 + 0.4, 0); lf.scale.setScalar(0.8);
      }
      this.deco(new THREE.SphereGeometry(0.34, 8, 6), this.mat.bark, x + lean * h * 0.5, h - 0.05, z + lean * h * 0.5);
    }
    this.boxes.push(new THREE.Box3(new THREE.Vector3(x - 0.25, 0, z - 0.25), new THREE.Vector3(x + 0.25, 6, z + 0.25)));
  }

  coverItem(type, x, z, rot) {
    const H = this.H;
    const sw = (a, b) => (rot ? [b, a] : [a, b]);
    if (type === 'bags') {
      const [w, d] = sw(4, 0.7);
      this.solid(x, 0, z, w, 1.0, d, this.mat.sandbag, { uv: 1.2 });
      const [w2, d2] = sw(0.7, 2.2);
      this.solid(x + (rot ? 1.4 : -2), 0, z + (rot ? -2 : 1.4), w2, 1.0, d2, this.mat.sandbag, { uv: 1.2 });
    } else if (type === 'wall') {
      const [w, d] = sw(6, 0.5);
      this.solid(x, 0, z, w, 1.3, d, H ? this.mat.wall : this.mat.concrete, { uv: 3 });
    } else if (type === 'crates') this.crateStack(x, z);
    else if (type === 'barrels') this.barrels(x, z);
    else if (type === 'hedge') {
      if (H) { this.hedgehog(x, z); this.hedgehog(x + (rot ? 0 : 2.4), z + (rot ? 2.4 : 0)); }
      else { const [w, d] = sw(3, 0.6); this.solid(x, 0, z, w, 0.95, d, this.mat.concrete, { uv: 1 }); this.solid(x + (rot ? 0 : 3.2), 0, z + (rot ? 3.2 : 0), w, 0.95, d, this.mat.concrete, { uv: 1 }); }
    } else if (type === 'wreck') { if (H) this.tankWreck(x, z, rot); else this.carWreck(x, z, rot); }
    else if (type === 'big') {
      if (H) this.truckWreck(x, z, rot);
      else { const [w, d] = sw(6, 2.5); this.solid(x, 0, z, w, 2.6, d, this.pick(this.mat.containers), { uv: 2.6 }); }
    }
  }

  crateStack(x, z) {
    const n = 2 + ((this.rand() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const s = this.r(1.0, 1.3);
      this.solid(x + (i % 2) * 1.25, 0, z + (i === 2 ? 1.25 : 0), s, s, s, this.mat.crate);
    }
    if (this.rand() < 0.5) this.solid(x + 0.6, 1.3, z, 1, 1, 1, this.mat.crate, { map: false });
  }
  barrels(x, z) {
    const m = new THREE.MeshStandardMaterial({ color: this.pick([0x3d5a3a, 0x6a2a20, 0x2e4a6a, 0x555555]), roughness: 0.6, metalness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const bx = x + (i % 2) * 0.7, bz = z + (i > 1 ? 0.65 : 0);
      this.deco(new THREE.CylinderGeometry(0.3, 0.3, 0.95, 12), m, bx, 0.475, bz);
      this.boxes.push(new THREE.Box3(new THREE.Vector3(bx - 0.3, 0, bz - 0.3), new THREE.Vector3(bx + 0.3, 0.95, bz + 0.3)));
    }
    this.mapRects.push({ x: x - 0.3, z: z - 0.3, w: 1.3, d: 1.25, h: 1 });
  }
  hedgehog(x, z) {
    const m = this.mat.metal;
    const g = new THREE.BoxGeometry(0.15, 0.15, 2.0);
    this.deco(g, m, x, 0.6, z, 0.75, 0, 0);
    this.deco(g, m, x, 0.6, z, -0.75, Math.PI / 2, 0);
    this.deco(g, m, x, 0.6, z, Math.PI / 2, 0, 0);
    this.boxes.push(new THREE.Box3(new THREE.Vector3(x - 0.6, 0, z - 0.6), new THREE.Vector3(x + 0.6, 1.2, z + 0.6)));
    this.mapRects.push({ x: x - 0.6, z: z - 0.6, w: 1.2, d: 1.2, h: 1.2 });
  }
  tankWreck(x, z, rot) {
    const m = this.rand() < 0.5 ? this.mat.burnt : this.mat.metal;
    const [w, d] = rot ? [3.2, 6.2] : [6.2, 3.2];
    this.solid(x, 0, z, w, 1.5, d, m, { uv: 2 });
    const [tw, td] = rot ? [2.2, 2.6] : [2.6, 2.2];
    this.solid(x, 1.5, z, tw, 0.9, td, m, { uv: 2, map: false });
    this.deco(new THREE.CylinderGeometry(0.09, 0.11, 3.4, 8), m, x + (rot ? 0 : 2.4), 2.0, z + (rot ? 2.4 : 0), rot ? Math.PI / 2 - 0.15 : 0, 0, rot ? 0 : Math.PI / 2 + 0.15);
    const [gw, gd] = rot ? [0.5, 6.4] : [6.4, 0.5];
    for (const s of [-1, 1]) this.deco(new THREE.BoxGeometry(gw, 0.8, gd), this.mat.burnt, x + (rot ? s * 1.6 : 0), 0.4, z + (rot ? 0 : s * 1.6));
    this.fires.push(new THREE.Vector3(x, 2.3, z));
  }
  truckWreck(x, z, rot) {
    const m = this.mat.burnt;
    const [w, d] = rot ? [2.2, 5.5] : [5.5, 2.2];
    this.solid(x, 0.4, z, w, 1.2, d, m, { uv: 2 });
    const off = 1.9;
    const [cw, cd] = rot ? [2.1, 1.6] : [1.6, 2.1];
    this.solid(x + (rot ? 0 : off), 1.6, z + (rot ? off : 0), cw, 1.1, cd, m, { map: false });
    const wg = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 10);
    for (const a of [-1.8, 1.8]) for (const s of [-1, 1]) {
      this.deco(wg, this.mat.burnt, x + (rot ? s * 1.1 : a), 0.45, z + (rot ? a : s * 1.1), rot ? 0 : Math.PI / 2, 0, rot ? Math.PI / 2 : 0);
    }
    this.deco(new THREE.BoxGeometry(rot ? 2.3 : 3.3, 1.2, rot ? 3.3 : 2.3), new THREE.MeshStandardMaterial({ color: 0x4a4a36, roughness: 1 }), x - (rot ? 0 : 0.9), 2.2, z - (rot ? 0.9 : 0));
  }
  carWreck(x, z, rot) {
    const col = this.pick([0x8a8a86, 0x6a2a24, 0x2a3a5a, 0xd8d4c8, 0x3a3a36]);
    const burnt = this.rand() < 0.5;
    const mm = burnt ? this.mat.burnt : new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.5 });
    const [w, d] = rot ? [1.9, 4.4] : [4.4, 1.9];
    this.solid(x, 0.3, z, w, 0.8, d, mm);
    const [cw, cd] = rot ? [1.7, 2.3] : [2.3, 1.7];
    this.solid(x, 1.1, z, cw, 0.65, cd, mm, { map: false });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1a2228, roughness: 0.2, metalness: 0.6 });
    this.deco(new THREE.BoxGeometry(rot ? 1.72 : 2.1, 0.5, rot ? 2.1 : 1.72), glass, x, 1.43, z, 0, 0, 0, false);
    const wg = new THREE.CylinderGeometry(0.33, 0.33, 0.25, 10);
    for (const a of [-1.4, 1.4]) for (const s of [-1, 1]) {
      this.deco(wg, this.mat.burnt, x + (rot ? s * 0.9 : a), 0.33, z + (rot ? a : s * 0.9), rot ? 0 : Math.PI / 2, 0, rot ? Math.PI / 2 : 0);
    }
    if (burnt) this.fires.push(new THREE.Vector3(x, 1.3, z));
  }

  backdrop() {
    const H = this.H;
    const hillM = new THREE.MeshStandardMaterial({ color: H ? 0xc8ced4 : 0xc2a576, roughness: 1, flatShading: true });
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + this.r(-0.1, 0.1), dist = this.r(175, 240) + (this.half - HALF);
      const r = this.r(28, 55), h = this.r(8, 28);
      const hill = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), hillM);
      hill.position.set(Math.cos(a) * dist, h / 2 - 1, Math.sin(a) * dist);
      this.scene.add(hill);
    }
    const sil = new THREE.MeshStandardMaterial({ map: facadeTex(H), roughness: 1 });
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2, dist = this.r(150, 175) + (this.half - HALF) * 1.3;
      const w = this.r(8, 18), h = H ? this.r(5, 14) : this.r(8, 26);
      const bg = new THREE.BoxGeometry(w, h, w); scaleUV(bg, w, h, w, 12);
      const b = new THREE.Mesh(bg, sil);
      b.position.set(Math.cos(a) * dist, h / 2, Math.sin(a) * dist);
      b.rotation.y = this.r(0, 1);
      this.scene.add(b);
    }
    const n = H ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const a = this.r(0, Math.PI * 2), dist = this.r(150, 170) + (this.half - HALF) * 1.3;
      this.smokes.push(new THREE.Vector3(Math.cos(a) * dist, 2, Math.sin(a) * dist));
    }
  }

  // ---------- Podval (chuqurlik) so'rovlari ----------
  pitIndexXZ(x, z) {
    for (let i = 0; i < this.pits.length; i++) {
      const p = this.pits[i];
      if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return i;
    }
    return -1;
  }
  baseHeight(x, z) { const i = this.pitIndexXZ(x, z); return i < 0 ? 0 : this.pits[i].floor; }
  // Nuqta qaysi podval "sathida" (zinapoya yoki podval ichida)? -1 = yer usti
  levelOf(pos) { return pos.y < -0.1 ? this.pitIndexXZ(pos.x, pos.z) : -1; }
  pitAt(pos) { return pos.y < -1 ? this.pitIndexXZ(pos.x, pos.z) : -1; }

  // ---------- Dinamik qutilar (transport) ----------
  addBox(b) { if (!this.boxes.includes(b)) this.boxes.push(b); }
  removeBox(b) { const i = this.boxes.indexOf(b); if (i >= 0) this.boxes.splice(i, 1); }

  // ---------- Fizika so'rovlari ----------
  rayCast(o, d, maxDist, out, ignore) {
    const ix = inv(d.x), iy = inv(d.y), iz = inv(d.z);
    let best = maxDist, hit = null, hullN = false;
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (b === ignore) continue;
      let t = rayAABB(o.x, o.y, o.z, ix, iy, iz, b), hn = false;
      // ochiq korpusli transport (Kamaz): qutining o'ziga emas, korpusning haqiqiy shakliga tegishi kerak
      if (t < best && b.vehicle && b.vehicle.T.openHull) { t = b.vehicle.rayHull(o, d, best, _hn); hn = true; }
      if (t < best) { best = t; hit = b; hullN = hn; if (hn) _hn2.copy(_hn); }
    }
    let ground = false;
    if (d.y < 0) {
      const tg = -o.y / d.y;
      if (tg >= 0) {
        if (tg < best) {
          const pi = this.pitIndexXZ(o.x + d.x * tg, o.z + d.z * tg);
          if (pi < 0) { best = tg; hit = null; ground = true; }
          else { const tf = (this.pits[pi].floor - o.y) / d.y; if (tf < best) { best = tf; hit = null; ground = true; } }
        }
      } else {
        const pi = this.pitIndexXZ(o.x, o.z);
        if (pi >= 0) { const tf = (this.pits[pi].floor - o.y) / d.y; if (tf >= 0 && tf < best) { best = tf; hit = null; ground = true; } }
      }
    }
    if (!hit && !ground) return null;
    const res = out || { point: new THREE.Vector3(), normal: new THREE.Vector3(), dist: 0 };
    res.dist = best;
    res.point.copy(o).addScaledVector(d, best);
    res.box = hit;
    if (ground) res.normal.set(0, 1, 0);
    else if (hullN) res.normal.copy(_hn2);
    else {
      const p = res.point, b = hit;
      const dx0 = Math.abs(p.x - b.min.x), dx1 = Math.abs(p.x - b.max.x);
      const dy0 = Math.abs(p.y - b.min.y), dy1 = Math.abs(p.y - b.max.y);
      const dz0 = Math.abs(p.z - b.min.z), dz1 = Math.abs(p.z - b.max.z);
      const m = Math.min(dx0, dx1, dy0, dy1, dz0, dz1);
      if (m === dx0) res.normal.set(-1, 0, 0); else if (m === dx1) res.normal.set(1, 0, 0);
      else if (m === dy0) res.normal.set(0, -1, 0); else if (m === dy1) res.normal.set(0, 1, 0);
      else if (m === dz0) res.normal.set(0, 0, -1); else res.normal.set(0, 0, 1);
    }
    res.ground = ground;
    return res;
  }

  // a nuqtadan b nuqtaga ko'rinish bormi?
  los(a, b, ignore) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (L < 0.01) return true;
    const ix = inv(dx / L), iy = inv(dy / L), iz = inv(dz / L);
    for (let i = 0; i < this.boxes.length; i++) {
      const bx = this.boxes[i];
      if (bx === ignore) continue;
      if (rayAABB(a.x, a.y, a.z, ix, iy, iz, bx) < L - 0.05) {
        if (bx.vehicle && bx.vehicle.T.openHull && !(bx.vehicle.rayHull(a, _ld.set(dx / L, dy / L, dz / L), L) < L - 0.05)) continue;
        return false;
      }
    }
    return true;
  }

  pointInBox(p) {
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (!b.containsPoint(p)) continue;
      if (b.vehicle && b.vehicle.T.openHull && !b.vehicle.solidAt(p)) continue;   // ochiq kuzov ustidagi bo'sh joy
      return b;
    }
    return null;
  }

  groundHeight(x, z, r, feetY, ignore) {
    let g = this.baseHeight(x, z);
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (b === ignore || b.max.y > feetY + STEP_H + 0.01 || b.max.y <= g) continue;
      const cx = x < b.min.x ? b.min.x : x > b.max.x ? b.max.x : x;
      const cz = z < b.min.z ? b.min.z : z > b.max.z ? b.max.z : z;
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r * 0.5) g = b.max.y;
    }
    return g;
  }

  // Bosh ustidagi eng yaqin shift
  ceilingHeight(x, z, r, headY, ignore) {
    let c = Infinity;
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (b === ignore || b.min.y < headY - 0.3 || b.min.y >= c) continue;
      const cx = x < b.min.x ? b.min.x : x > b.max.x ? b.max.x : x;
      const cz = z < b.min.z ? b.min.z : z > b.max.z ? b.max.z : z;
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r * 0.5) c = b.min.y;
    }
    return c;
  }

  collideCircle(pos, r, feetY, headY, ignore, lim = this.half) {
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < this.boxes.length; i++) {
        const b = this.boxes[i];
        if (b === ignore || b.max.y <= feetY + STEP_H || b.min.y >= headY) continue;
        if (pos.x < b.min.x - r || pos.x > b.max.x + r || pos.z < b.min.z - r || pos.z > b.max.z + r) continue;
        const cx = pos.x < b.min.x ? b.min.x : pos.x > b.max.x ? b.max.x : pos.x;
        const cz = pos.z < b.min.z ? b.min.z : pos.z > b.max.z ? b.max.z : pos.z;
        const dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = (r - d) / d;
          pos.x += dx * push; pos.z += dz * push;
        } else {
          const l = pos.x - b.min.x, rr = b.max.x - pos.x, n = pos.z - b.min.z, f = b.max.z - pos.z;
          const m = Math.min(l, rr, n, f);
          if (m === l) pos.x = b.min.x - r; else if (m === rr) pos.x = b.max.x + r;
          else if (m === n) pos.z = b.min.z - r; else pos.z = b.max.z + r;
        }
      }
    }
    const L = lim - r;
    if (pos.x < -L) pos.x = -L; if (pos.x > L) pos.x = L;
    if (pos.z < -L) pos.z = -L; if (pos.z > L) pos.z = L;
  }

  // ---------- Navigatsiya (oqim maydoni, 0.5 m katak) ----------
  buildNav() {
    const N = this.navN, HALF = this.half;
    const blocked = new Uint8Array(N * N);
    const mark = (ax0, ax1, az0, az1) => {
      const x0 = Math.max(0, Math.floor((ax0 + HALF) / CELL)), x1 = Math.min(N - 1, Math.floor((ax1 + HALF) / CELL));
      const z0 = Math.max(0, Math.floor((az0 + HALF) / CELL)), z1 = Math.min(N - 1, Math.floor((az1 + HALF) / CELL));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) blocked[z * N + x] = 1;
    };
    const pad = 0.33;
    for (const b of this.boxes) {
      if (b.max.y < STEP_H || b.min.y > 1.7) continue;
      mark(b.min.x - pad, b.max.x + pad, b.min.z - pad, b.max.z + pad);
    }
    for (const p of this.pits) mark(p.open.x0 - 0.1, p.open.x1 + 0.1, p.open.z0 - 0.1, p.open.z1 + 0.1);
    for (let i = 0; i < N; i++) { blocked[i] = 1; blocked[(N - 1) * N + i] = 1; blocked[i * N] = 1; blocked[i * N + N - 1] = 1; }
    this.navBlocked = blocked;
    this.navDist = new Int32Array(N * N).fill(-1);
    this.navQueue = new Int32Array(N * N);
  }
  cellOf(x, z) {
    const N = this.navN, cx = Math.floor((x + this.half) / CELL), cz = Math.floor((z + this.half) / CELL);
    if (cx < 0 || cz < 0 || cx >= N || cz >= N) return -1;
    return cz * N + cx;
  }
  // more — qo'shimcha nishonlar [{x, z}, ...]: har bir katak ENG YAQIN nishongacha bo'lgan masofani oladi
  updateFlow(x, z, more) {
    const N = this.navN, dist = this.navDist, q = this.navQueue, bl = this.navBlocked;
    dist.fill(-1);
    let head = 0, tail = 0;
    if (more) for (const m of more) { const c = this.cellOf(m.x, m.z); if (c >= 0 && !bl[c] && dist[c] < 0) { dist[c] = 0; q[tail++] = c; } }
    const start = this.cellOf(x, z);
    if (start < 0) { if (!tail) return; }
    else if (!bl[start]) { if (dist[start] < 0) { dist[start] = 0; q[tail++] = start; } }
    else {
      const sx = start % N, sz = (start / N) | 0;
      for (let r = 1; r <= 8 && tail === 0; r++) {
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          const nx = sx + dx, nz = sz + dz;
          if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
          const c = nz * N + nx;
          if (!bl[c] && dist[c] < 0) { dist[c] = 0; q[tail++] = c; }
        }
      }
    }
    while (head < tail) {
      const c = q[head++], d = dist[c] + 1, cx = c % N;
      if (cx > 0 && !bl[c - 1] && dist[c - 1] < 0) { dist[c - 1] = d; q[tail++] = c - 1; }
      if (cx < N - 1 && !bl[c + 1] && dist[c + 1] < 0) { dist[c + 1] = d; q[tail++] = c + 1; }
      if (c >= N && !bl[c - N] && dist[c - N] < 0) { dist[c - N] = d; q[tail++] = c - N; }
      if (c < N * (N - 1) && !bl[c + N] && dist[c + N] < 0) { dist[c + N] = d; q[tail++] = c + N; }
    }
  }
  // Eng yaxshi qo'shni katakni topadi
  bestNeighbor(cx, cz, cur) {
    const N = this.navN, HALF = this.half, dist = this.navDist, bl = this.navBlocked;
    let best = cur, bx = -1, bz = -1;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
      const nc = nz * N + nx;
      if (dist[nc] < 0) continue;
      if (dx && dz && (bl[cz * N + nx] || bl[nz * N + cx])) continue;
      const v = dist[nc] + (dx && dz ? -0.5 : 0);
      if (v < best) { best = v; bx = nx; bz = nz; }
    }
    return bx < 0 ? null : [bx, bz];
  }
  flowDir(x, z, out) {
    const N = this.navN, HALF = this.half, dist = this.navDist;
    const c = this.cellOf(x, z);
    if (c < 0) return false;
    let cx = c % N, cz = (c / N) | 0;
    let nb = this.bestNeighbor(cx, cz, dist[c] >= 0 ? dist[c] : 1e9);
    if (!nb) return false;
    // bir necha katak oldinga qaraymiz — harakat silliq bo'ladi
    for (let k = 0; k < 3; k++) {
      cx = nb[0]; cz = nb[1];
      const n2 = this.bestNeighbor(cx, cz, dist[cz * N + cx]);
      if (!n2) break;
      nb = n2;
    }
    out.set((nb[0] + 0.5) * CELL - HALF - x, 0, (nb[1] + 0.5) * CELL - HALF - z);
    const L = out.length();
    if (L < 1e-4) return false;
    out.multiplyScalar(1 / L);
    return true;
  }
  reachable(x, z) { const c = this.cellOf(x, z); return c >= 0 && this.navDist[c] >= 0; }

  update(dt, time, fx, camPos) {
    this.sky.position.copy(camPos);
    this.sky.material.uniforms.time.value = time; GU.uTime.value = time;
    this.flashF = this.updateFlash(dt);
    for (const p of this.points) { p.ring.material.opacity = 0.4 + Math.sin(time * 3) * 0.15; }
    for (const c of this.crates) {
      const want = c.open ? -1.9 : 0; c.lid.rotation.x += (want - c.lid.rotation.x) * Math.min(1, dt * 6);
      c.tag.visible = c.lamp.visible = !c.open; if (!c.open) c.tag.material.opacity = 0.55 + Math.sin(time * 4 + c.id) * 0.25;
    }
    for (let i = 0; i < this.fireLights.length; i++) {
      this.fireLights[i].intensity = 14 + Math.sin(time * 17 + i * 3) * 4 + Math.sin(time * 31 + i) * 3 + Math.random() * 3;
    }
    if (!fx) return;
    for (const f of this.fires) {
      if (Math.random() < dt * 22) fx.fire(f);
      if (Math.random() < dt * 5) fx.smokePuff(f, 0.25);
    }
    for (const s of this.smokes) if (Math.random() < dt * 4) fx.smokePuff(s, 0.12, true);
  }
}
