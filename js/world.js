import * as THREE from '../lib/three.module.js';
import { GU, GFX, LAMP_N, hook, normalFrom, roughFrom, roofMap, makeSky } from './gfx.js';

import { HALF, MAPS, VEHICLE_SPAWNS, VEH_TYPES, vehiclesFor, mapId } from './shared.mjs';
import { buildWild } from './wild.js';
import { buildAirfield } from './airfield.js';
import { getModel, instances } from './models.js';

// Xaritalar, transport joylari va zombi punktlari server bilan umumiy — js/shared.mjs da
export { HALF, MAPS, VEHICLE_SPAWNS, VEH_TYPES };
export const STEP_H = 0.5;
const CELL = 0.5;
const GS = 8;   // to'qnashuv to'ri katagining o'lchami (m)
const EXTRA_TOWN = [
  ['pillars', 16, -16, false], ['colonnade', 44, -22, true], ['bunker', 24, 44, false], ['barrier', 12, 12, true],
  ['pillars', -18, -38, true], ['shed', -22, 20, false], ['barrier', 56, -30, false], ['pillars', 34, 16, false],
];   // (yo'l ustiga to'g'ri kelgani uchun hech qachon qurilmagan 'teeth' yozuvi olib tashlandi)
const CITY = {
  houses: [   // bir qavatli uylar: base — podval, sp — uy ichidagi noyob qurol
    { x: -46, z: -46, w: 12, d: 10, base: 0 }, { x: 14, z: -48, w: 10, d: 8, base: 1 }, { x: -48, z: 16, w: 10, d: 8, base: 2 }, { x: 14, z: 50, w: 10, d: 8, base: 3 },
    { x: -80, z: -40, w: 12, d: 10, base: 4 }, { x: 80, z: 40, w: 12, d: 10, base: 5 }, { x: -14, z: 48, w: 10, d: 8 }, { x: 46, z: -76, w: 10, d: 8 }, { x: -46, z: 78, w: 10, d: 8 },
  ],
  houses2: [  // ikki qavatli uylar: sp — ikkinchi qavatdagi noyob qurol
    { x: -26, z: -27, w: 12, d: 10, sp: 6 }, { x: -47, z: -23, w: 10, d: 10 }, { x: -24, z: -47, w: 10, d: 10, sp: 7 }, { x: -48, z: 44, w: 10, d: 10 },
    { x: 72, z: -44, w: 12, d: 10 }, { x: -72, z: 44, w: 12, d: 10 }, { x: 44, z: 76, w: 10, d: 10 },
  ],
  warehouses: [{ x: 31, z: -30, w: 22, d: 16, sp: 10 }, { x: 78, z: -16, w: 14, d: 18 }],
  bunkers: [[25, 25, 3, 8], [47, 22, 0, undefined], [27, 49, 3, undefined], [48, 48, 3, 9], [0, 82, 0, undefined], [-82, -8, 1, undefined], [62, 62, 3, undefined]],   // [x, z, tuynuk tomoni, noyob qurol]
  colonnades: [[15, -15, false], [-15, 15, false], [15, 15, true], [-15, -15, true], [-30, 30, false], [-30, 64, false], [64, 30, true]],
  towers: [[37, 37, 11], [-64, -64, undefined], [64, -62, undefined], [-62, 66, undefined]],   // [x, z, noyob qurol]
  sheds: [[50, 10, 10, 8], [48, -12, 8, 6], [-22, 26, 4, 3.2], [-30, 22, 4, 3.2], [-38, 26, 4, 3.2], [-22, 36, 4, 3.2], [-38, 36, 4, 3.2], [-72, 16, 8, 6], [18, -76, 8, 6]],   // [x, z, eni, bo'yi] — kichiklari bozor rastalari
  pillars: [[-36, -35], [-36, -14], [-14, -36], [-35, -57], [8, -24], [24, -8], [-8, 24], [-24, 8], [36, 12], [12, 36], [60, 46], [46, 60], [-58, 30], [-60, -22], [60, 22], [22, -58], [-20, 62], [70, 6], [-70, -4], [6, 70], [-6, -70]],
  barriers: [[30, 8, false], [8, 30, true], [56, 34, false], [34, 56, true], [-8, -30, true], [-58, -8, false], [66, -30, true], [-66, 28, true], [40, 66, false], [-28, -66, false], [86, 20, true], [-86, -22, true]],
  teeth: [[-36, -27, true], [-30, -37, false], [-14, -52, true], [-52, -34, false], [22, 37, false], [37, 22, true], [-40, 6, false], [6, -40, true]],
  containers: [[44, -48, false], [44, -44.4, false], [44, -46.2, false, 1], [52, -46, true], [56.4, -46, true], [58, -54, false], [36, -56, false], [36, -56, false, 1], [62, -36, true], [26, -66, false]],   // [x, z, burilgan, ustma-ust]
};
const COVER_CITY = [
  ['bags', 20, -7.2, false], ['wreck', 66, -7, true], ['crates', 9, -34, false], ['wall', -62, -30, true], ['big', 84, -44, true], ['hedge', -10, 36, false],
  ['barrels', 56, -8, false], ['crates', 30, -62, false], ['bags', -70, -62, true], ['wreck', -74, 62, false], ['hedge', 70, 70, false], ['bags', 88, 46, true],
  ['wall', 20, 84, false], ['crates', -60, 84, false], ['barrels', -86, 30, false], ['big', -84, 52, false], ['wreck', 20, -90, false], ['crates', 90, -30, false],
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

const _hn = new THREE.Vector3(), _hn2 = new THREE.Vector3(), _ld = new THREE.Vector3(), _zvC = new THREE.Color(0x8fd09a);
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
  blobs(g, 256, 256, 5, 'rgba(20,15,10,A)', 30, 80, 0.1);   // (dog'lar yumshoq: to'q dumaloq dog'lar har 3 metrda takrorlanib, devorni "xol-xol" qilib ko'rsatardi)
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
// Yer aralashmasi uchun: yeyilgan tuproq (yo'l va bino atrofi) va o't yamog'i teksturalari
function dirtTex(H) {
  const [c, g] = cv(256);
  g.fillStyle = H ? '#5d554b' : '#8f6f4a'; g.fillRect(0, 0, 256, 256);
  blobs(g, 256, 256, 26, H ? 'rgba(48,42,36,A)' : 'rgba(110,82,50,A)', 12, 50, 0.4);
  blobs(g, 256, 256, 18, H ? 'rgba(150,150,150,A)' : 'rgba(170,140,98,A)', 10, 40, 0.3);
  speckle(g, 256, 256, 5200, H ? ['#3b352e', '#8a8680', '#c8ccd0'] : ['#5e472c', '#b39468', '#4a3823'], 1, 3, 0.5);
  for (let i = 0; i < 150; i++) { const x = Math.random() * 256, y = Math.random() * 256, r = 0.8 + Math.random() * 2.2; g.fillStyle = 'rgba(30,24,18,0.45)'; g.beginPath(); g.ellipse(x + 0.6, y + 0.6, r, r * 0.8, 0, 0, 6.3); g.fill(); g.fillStyle = H ? '#8d8a84' : '#a58d68'; g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, 6.3); g.fill(); }
  fine(c, g, 0.12);
  return toTex(c);
}
function grassTex(H) {
  const [c, g] = cv(256);
  g.fillStyle = H ? '#857a58' : '#8d8a4c'; g.fillRect(0, 0, 256, 256);
  blobs(g, 256, 256, 30, H ? 'rgba(210,214,220,A)' : 'rgba(120,128,60,A)', 10, 44, 0.35);
  blobs(g, 256, 256, 22, H ? 'rgba(96,84,58,A)' : 'rgba(176,160,92,A)', 10, 40, 0.35);
  // qisqa o't chiziqlari (har xil yo'nalishda)
  for (let i = 0; i < 3800; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * 6.28, l = 2 + Math.random() * 5;
    g.strokeStyle = shade(H ? 0x9c8f62 : 0xa5a25a, 0.55 + Math.random() * 0.75); g.globalAlpha = 0.5 + Math.random() * 0.4; g.lineWidth = 0.6 + Math.random() * 0.9;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.globalAlpha = 1;
  fine(c, g, 0.1);
  return toTex(c);
}
function tuftTex(H) {
  // o't tutami: ingichka, uchi toraygan, tagi to'qroq poyalar (qurigan sariq va zaytun-yashil aralash)
  const N = 128, c = canvas(N, N), g = c.getContext('2d');
  g.clearRect(0, 0, N, N);
  const cols = H ? [0xa3925c, 0x8c8468, 0xb4aa86] : [0xbfa860, 0x97a052, 0xa89a58, 0x7f8c46];
  for (let i = 0; i < 64; i++) {
    const x = 8 + Math.random() * (N - 16), h = N * (0.3 + Math.random() * 0.66), lean = (Math.random() - 0.5) * N * 0.34, w = 1.6 + Math.random() * 2.2;
    const col = cols[(Math.random() * cols.length) | 0], k = 0.75 + Math.random() * 0.4, gr = g.createLinearGradient(0, N, 0, N - h);
    gr.addColorStop(0, shade(col, k * 0.55)); gr.addColorStop(0.5, shade(col, k)); gr.addColorStop(1, shade(col, k * (H ? 1.25 : 1.12)));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - w, N); g.quadraticCurveTo(x - w * 0.6 + lean * 0.3, N - h * 0.6, x + lean, N - h); g.quadraticCurveTo(x + w * 0.6 + lean * 0.3, N - h * 0.6, x + w, N); g.closePath(); g.fill();
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
// ================= FOTO-TEKSTURALAR (ixtiyoriy) =================
// assets/tex papkasida haqiqiy yuzalarning suratlari turadi (Poly Haven, CC0 — assets/tex/LICENSE.txt): rang va relyef xaritasi.
// Papka bor bo'lsa — ular kodda chizilgan teksturalar o'rniga qo'yiladi (rangi asl material rangiga keltiriladi, o'lchami saqlanadi);
// yo'q bo'lsa yoki yuklanmasa — o'yin avvalgidek, faqat kodda chizilgan teksturalar bilan ishlayveradi.
const PHOTO_AVG = { sand: 0xa4946e, snow: 0xa4a4a6, asphalt: 0x5a5a54, cobble: 0x8a7d62, plaster: 0x9d8c78, brick: 0x68524a, concrete: 0x8d856f, planks: 0x604c39, grass: 0xac9379, dirt: 0x725a3d };   // suratlarning o'rtacha rangi
const photos = new Map(), _ldr = new THREE.TextureLoader(), _pa = new THREE.Color(), _pt = new THREE.Color();
let photosOff = new URLSearchParams(location.search).get('foto') === '0';   // ?foto=0 — suratlarsiz (solishtirish uchun)
function getPhoto(name, cb) {
  if (photosOff) return;
  let P = photos.get(name);
  if (!P) {
    P = { ready: false, d: null, n: null, c: null, cbs: [] };
    photos.set(name, P);
    const fire = () => { if (!P.d || P.n === null) return; P.ready = true; for (const f of P.cbs.splice(0)) f(P); };
    const prep = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
    _ldr.load(`assets/tex/${name}_d.jpg`, (t) => {
      prep(t).colorSpace = THREE.SRGBColorSpace; P.d = t;
      const c = canvas(256, 256); c.getContext('2d').drawImage(t.image, 0, 0, 256, 256); c.uuid = 'foto-' + name; P.c = c;   // silliqlik xaritasi shundan hisoblanadi
      fire();
    }, undefined, () => { photosOff = true; P.cbs.length = 0; });   // papka yo'q — boshqa urinilmaydi
    _ldr.load(`assets/tex/${name}_n.jpg`, (t) => { P.n = prep(t); fire(); }, undefined, () => { P.n = false; fire(); });
  }
  if (P.ready) cb(P); else P.cbs.push(cb);
}
// Suratning o'rtacha rangini kerakli rangga keltiruvchi ko'paytuvchi
function photoTint(out, name, target) {
  _pa.setHex(PHOTO_AVG[name]); _pt.setHex(target);
  const k = (a, b) => Math.max(0.4, Math.min(2.2, b / Math.max(a, 0.004)));
  return out.setRGB(k(_pa.r, _pt.r), k(_pa.g, _pt.g), k(_pa.b, _pt.b));
}

export class World {
  // opts: map ('city' | 'town' | 'big' — aerodrom | 'wild' — karantin zonasi), night (kech/tun, yomg'ir, chaqmoq), zombie (zombi rejimi), veh (transport joylari)
  constructor(scene, era, quality = 'high', opts = {}) {
    this.scene = scene; this.era = era; this.quality = quality;
    this.map = mapId(opts.map); this.night = !!opts.night; this.zombie = !!opts.zombie;
    this.half = MAPS[this.map].half; this.navN = Math.round((this.half * 2) / CELL);
    this.vehSpawns = opts.noVeh ? [] : opts.veh && opts.veh.length ? opts.veh : vehiclesFor(this.map, Math.random, this.zombie);   // noVeh — transportsiz jang
    this.boxes = []; this.mapRects = []; this.spawns = []; this.fires = []; this.smokes = []; this.fireLights = [];
    this.props = [];   // foto-skanerlangan model bilan almashtiriladigan jismlar: { model, x, y, z, h, proto }
    this.pits = []; this.pickups = []; this.clear = []; this.points = []; this.crates = []; this.itemSpots = []; this.roomSpots = []; this.panes = []; this.mapBlds = [];   // roomSpots — xonalardagi qurol joylari   // mapBlds — xaritada chiziladigan bino konturlari
    this.flashT = -1; this.flashK = 0;
    this.rand = mulberry((era === 'historical' ? 1944 : 2026) + (this.map === 'big' ? 77 : this.map === 'city' ? 311 : this.map === 'wild' ? 555 : 0));
    // bezak uchun alohida tasodif manbai: asosiy joylashuv (daraxt, to'siq) o'zgarmaydi
    this.rand2 = mulberry((era === 'historical' ? 4419 : 6202) + (this.map === 'big' ? 31 : this.map === 'city' ? 57 : this.map === 'wild' ? 91 : 0));
    this.H = era === 'historical';
    this.lite = GFX.lite;   // dasturiy chizish: relyef xaritasi, bulut, o't va osmon aksi yo'q
    GFX.night = this.night; // tungi chiroqlar shaderi faqat tunda qo'shiladi
    this.lamps = [];
    for (const v of GU.uLamps.value) v.set(0, 0, 0, 0);
    TQ = !this.lite && (quality === 'high' || quality === 'ultra') ? 2 : 1;
    this.makeMaterials();
    this.setupEnvironment();
    this.build();
    this.buildGrid();   // (o't-tosh joylashtirish va keyingi so'rovlar uchun; bundan keyin to'qnashuv qutisi qo'shilmaydi)
    this.buildSplat();
    this.pickups.sort((a, b) => a.id - b.id);   // ro'yxatdagi o'rin = noyob qurol raqami (server shu raqam bilan ishlaydi)
    this.groundCover();
    // tom xaritasi: uy ichi va podvalga osmon yorug'ligi kam tushadi (gfx.js)
    this.roof = roofMap(this.boxes, this.half);
    GU.uRoof.value = this.roof.tex; GU.uRoofInfo.value.set(this.roof.G, 1 / (this.roof.G * 2), this.roof.HMAX, 1);
    GU.uWet.value = this.night ? 1 : 0;
    GU.uCloud.value = this.night || this.lite ? 0 : this.H ? 0.2 : 0.36;   // bulut soyalari (kunduzi; qishda bulut qalin — soyasi sust)
    this.mergeStatic();
    this.applyModels();
    this.buildGlass();
    this.buildNav();
  }
  dispose() { this.dead = true; if (this.roof) this.roof.tex.dispose(); }
  r2(a = 0, b = 1) { return a + this.rand2() * (b - a); }

  // ---------- Deraza oynalari ----------
  // wallRun har bir deraza uchun joy qoldiradi (this.panes); bu yerda ular bitta InstancedMesh bo'lib chiziladi (bitta chizish chaqiruvi).
  // Oyna to'siq emas — o'q ham, odam ham o'tadi; lekin o'q tegsa, yonida portlash bo'lsa yoki kimdir derazadan oshib o'tsa — sinib tushadi.
  // Sinish har bir kompyuterda o'zi hisoblanadi (faqat ko'rinish, o'yin natijasiga ta'sir qilmaydi). Jang boshida oynalarning bir qismi allaqachon singan.
  buildGlass() {
    const n = this.panes.length; this.glass = null; this.onGlass = null;
    if (!n || this.lite) return;   // dasturiy chizishda (yengil rejim) oyna chizilmaydi
    const mat = new THREE.MeshStandardMaterial({ color: 0x9fb6c2, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.4 });
    // tik qaralganda deyarli shaffof, qiya qaralganda osmonni aks ettiradi (Frenel)
    mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'float gfr_ = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);\ndiffuseColor.a = mix(0.16, 0.92, gfr_);\n#include <opaque_fragment>'); };
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const g = this.panes[i];
      g.broken = ((Math.imul(i + 7, 2654435761) >>> 8) % 100) < 22;   // (xarita urug'iga tegmaydigan, lekin har doim bir xil tanlov)
      p.set(g.ax === 'x' ? g.c : g.f, (g.y0 + g.y1) / 2, g.ax === 'x' ? g.f : g.c);
      if (g.ax === 'x') q.identity(); else q.copy(qz);
      s.set(g.broken ? 0 : g.w, g.broken ? 0 : g.y1 - g.y0, 1);
      im.setMatrixAt(i, m.compose(p, q, s));
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; im.renderOrder = 2;
    this.scene.add(im); this.glass = im; this._gm = m;
  }
  // i-oynani sindirish: dir — parchalar uchadigan tomon (+1 / −1, devorga tik o'q bo'ylab)
  shatter(i, dir = 1) {
    const g = this.panes[i];
    if (!this.glass || !g || g.broken) return;
    g.broken = true;
    this.glass.setMatrixAt(i, this._gm.makeScale(0, 0, 0)); this.glass.instanceMatrix.needsUpdate = true;
    const fx = this._fx, x = g.ax === 'x' ? g.c : g.f, z = g.ax === 'x' ? g.f : g.c, yc = (g.y0 + g.y1) / 2;
    if (fx) for (let k = 0; k < 26; k++) {
      const u = (Math.random() - 0.5) * g.w, y = g.y0 + Math.random() * (g.y1 - g.y0), n = dir * (0.6 + Math.random() * 2.6), tv = (Math.random() - 0.5) * 1.6;
      fx.add.emit(g.ax === 'x' ? x + u : x, y, g.ax === 'x' ? z : z + u, g.ax === 'x' ? tv : n, Math.random() * 1.4, g.ax === 'x' ? n : tv, 0.55 + Math.random() * 0.5, 0.035 + Math.random() * 0.04, 0, 0.75, 0.9, 1, 0.9, 11, 0.6);
    }
    if (this.onGlass) this.onGlass(x, yc, z);
  }
  // O'q yo'li (a → b kesma) kesib o'tgan oynalar sinadi. Qaytaradi: nechta sindi.
  breakGlass(a, b) {
    if (!this.glass) return 0;
    let n = 0;
    for (let i = 0; i < this.panes.length; i++) {
      const g = this.panes[i];
      if (g.broken) continue;
      const x = g.ax === 'x', fa = (x ? a.z : a.x) - g.f, fb = (x ? b.z : b.x) - g.f;
      if (fa * fb > 0 || fa === fb) continue;   // kesma oyna tekisligini kesib o'tmaydi
      const t = fa / (fa - fb), y = a.y + (b.y - a.y) * t, u = x ? a.x + (b.x - a.x) * t : a.z + (b.z - a.z) * t;
      if (y < g.y0 || y > g.y1 || Math.abs(u - g.c) > g.w / 2) continue;
      this.shatter(i, fb > fa ? 1 : -1); n++;
    }
    return n;
  }
  // Derazadan o'tayotgan odam (x, y, z — boshi/ko'kragi) oynani sindiradi: nuqta oyna tekisligiga juda yaqin va deraza o'rnida bo'lsa
  touchGlass(px, py, pz) {
    if (!this.glass) return;
    for (let i = 0; i < this.panes.length; i++) {
      const g = this.panes[i];
      if (g.broken) continue;
      const x = g.ax === 'x', d = (x ? pz : px) - g.f;
      if (Math.abs(d) < 0.45 && py > g.y0 - 0.2 && py < g.y1 + 0.4 && Math.abs((x ? px : pz) - g.c) < g.w / 2 + 0.1) this.shatter(i, d > 0 ? -1 : 1);
    }
  }
  // Portlash: R masofadagi hamma oynalar sinadi
  breakGlassNear(pos, R) {
    if (!this.glass) return;
    for (let i = 0; i < this.panes.length; i++) {
      const g = this.panes[i];
      if (g.broken) continue;
      const x = g.ax === 'x' ? g.c : g.f, z = g.ax === 'x' ? g.f : g.c;
      if (Math.hypot(x - pos.x, (g.y0 + g.y1) / 2 - pos.y, z - pos.z) < R) this.shatter(i, ((g.ax === 'x' ? z - pos.z : x - pos.x) >= 0) ? 1 : -1);
    }
  }

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
    const H = this.H, nm = this.quality !== 'low' && !this.lite, rgh = nm && this.quality !== 'medium';   // silliqlik xaritasi — yuqori sifatda
    // o: n — relyef kuchi (0 — relyefsiz), fx — gfx.hook sozlamalari (macro, grime, wet)
    const std = (o) => {
      const n = o.n, fx = o.fx; delete o.n; delete o.fx;
      const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.92, metalness: 0 }, o));
      if (nm && n && m.map) m.normalMap = normalFrom(m.map, n);
      if (rgh && m.map && !m.alphaTest) { m.roughnessMap = roughFrom(m.map, m.roughness, m.metalness > 0.3 ? 0.75 : 0.4); m.roughness = 1; }
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
      ground: std({ map: groundTex(this.era), n: H ? 1.6 : 2.6, fx: { macro: true, wet: true, ground: true } }),
      road: std({ map: roadTex(this.era), n: H ? 3.6 : 1.8, roughness: H ? 0.85 : 0.88, fx: OUT }),
      crate: std({ map: simpleTex(H ? 0x7d6440 : 0x9b7d4f, { planks: true }), n: 2.6, roughness: 0.82, fx: DAMP }),
      crateTrim: std({ map: simpleTex(H ? 0x6a5334 : 0x846a42, { planks: true }), n: 2.6, roughness: 0.86, fx: DAMP }),   // yashik hoshiyasi — bir oz to'qroq taxta
      container: simpleTex(0x9a9a9a, { ridges: true }),
      sandbag: std({ map: simpleTex(H ? 0x9c8c66 : 0xb8a479, { bags: true }), n: 3.4, fx: DAMP }),
      metal: std({ map: simpleTex(H ? 0x4b4e48 : 0x55524a, { rust: true, noise: 0.25 }), n: 1.3, roughness: 0.62, metalness: 0.55, fx: DAMP }),
      burnt: std({ map: simpleTex(0x2c2824, { rust: true, noise: 0.35 }), n: 1.6, roughness: 0.9, metalness: 0.2, fx: DAMP }),
      concrete: std({ map: simpleTex(H ? 0x8a8780 : 0xb3ada0, { noise: 0.25 }), n: 1.5, fx: OUT }),
      wall: std({ map: wallTex(H ? { base: 0x7b4636, brick: true } : { base: 0xa9a393 }), n: H ? 3.2 : 1.5, fx: WALL }),
      bark: std({ color: H ? 0x3f3a33 : 0x8a7350 }),
      leaf: H ? std({ color: 0x4f6b2c, side: THREE.DoubleSide }) : std({ map: frondTex(), alphaTest: 0.3, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.75, fx: { windW: true } }),
      supply: std({ map: crossTex() }),
      // bezak: deraza va eshik romlari, uy poydevori, tom jihozlari
      trim: std({ color: H ? 0x3d3024 : 0x6b6558, roughness: 0.8, fx: DAMP }),
      plinth: std({ map: simpleTex(H ? 0x5e5a54 : 0x8f887a, { noise: 0.3 }), n: 1.5, fx: { macro: true, grime: true, wet: true } }),
      steel: std({ color: H ? 0x4a4d50 : 0xb8bcc0, roughness: 0.38, metalness: 0.85, fx: DAMP }),
      rock: std({ color: H ? 0x8f9499 : 0xa08a68, roughness: 0.95, flatShading: true, fx: DAMP }),
      tuft: std({ map: tuftTex(H), alphaTest: 0.35, alphaToCoverage: true, roughness: 1, fx: { wind: 0.22 } }),
    };
    this._wallStyles = wallStyles;
    const rh = this.mat.road.map.clone(); rh.needsUpdate = true;
    this.mat.roadH = std({ map: rh, roughness: this.mat.road.roughness, fx: OUT });
    if (this.mat.road.normalMap) { const rn = this.mat.road.normalMap.clone(); rn.needsUpdate = true; this.mat.roadH.normalMap = rn; }
    if (this.mat.road.roughnessMap) { const rr = this.mat.road.roughnessMap.clone(); rr.needsUpdate = true; this.mat.roadH.roughnessMap = rr; this.mat.roadH.roughness = 1; }
    const cc = this.mat.container, cn = nm ? normalFrom(cc, 4.5) : null;
    this.mat.containers = [0x8c3a2a, 0x2f5a7a, 0x4a6a3a, 0xb06a28, 0x6a6a6a].map((c) => std({ map: cc, normalMap: cn, color: c, roughness: 0.55, metalness: 0.45, fx: DAMP }));
    this.applyPhotos();
  }
  // Foto-teksturalarni materiallarga qo'yish (makeMaterials oxirida chaqiriladi; suratlar yuklangach almashtiriladi)
  applyPhotos() {
    if (this.lite || this.quality === 'low') return;
    const H = this.H, M = this.mat;
    this._wallStyles.forEach((st, i) => this.photo(M.walls[i], st.brick ? 'brick' : 'plaster', st.base, { rep: st.brick ? 2 : 1 }));
    this.photo(M.ground, H ? 'snow' : 'sand', H ? 0xdfe4e8 : 0xc9ab7a, { rep: 2, ns: H ? 0.55 : 0.9 });
    for (const m of [M.road, M.roadH]) this.photo(m, H ? 'cobble' : 'asphalt', H ? 0x6a6862 : 0x4b4a48, { rep: H ? 2 : 1 });
    this.photo(M.floor, 'planks', H ? 0x6b5334 : 0x8a7a62, { rep: 3 });
    this.photo(M.crate, 'planks', H ? 0x7d6440 : 0x9b7d4f); this.photo(M.crateTrim, 'planks', H ? 0x6a5334 : 0x846a42);
    this.photo(M.concrete, 'concrete', H ? 0x8a8780 : 0xb3ada0);
    this.photo(M.plinth, 'concrete', H ? 0x5e5a54 : 0x8f887a);
    this.photo(M.roof, 'concrete', H ? 0x55524d : 0x9e9483);
    this.photo(M.wall, H ? 'brick' : 'concrete', H ? 0x7b4636 : 0xa9a393, { rep: H ? 2 : 1 });
  }
  // mat — material; name — surat nomi; target — materialning asl rangi; o.rep — takrorlanish ko'paytuvchisi, o.ns — relyef kuchi
  photo(mat, name, target, o = {}) {
    getPhoto(name, (P) => {
      const old = mat.map, k = o.rep || 1;
      mat.userData.rep = k;   // (surat keshdan darhol qo'yilgan bo'lsa, keyin chaqirilgan setRepeat ham shu ko'paytuvchini hisobga oladi)
      const mk = (src) => { const t = src.clone(); t.needsUpdate = true; t.repeat.copy(old.repeat).multiplyScalar(k); return t; };
      mat.map = mk(P.d);
      if (mat.normalMap && P.n) { const on = mat.normalMap; mat.normalMap = mk(P.n); mat.normalScale.set(o.ns || 1, o.ns || 1); on.dispose(); }
      if (mat.roughnessMap) { const or = mat.roughnessMap, r = roughFrom(P.c, 0.9, 0.4); r.repeat.copy(mat.map.repeat); mat.roughnessMap = r; or.dispose(); }
      old.dispose();   // kodda chizilgan eski teksturalar videoxotiradan bo'shatiladi
      photoTint(mat.color, name, target);
    });
  }
  // teksturaning takrorlanishi (rang va relyef xaritasi birga)
  setRepeat(mat, u, v) { const k = mat.userData.rep || 1; u *= k; v *= k; mat.map.repeat.set(u, v); if (mat.normalMap) mat.normalMap.repeat.set(u, v); if (mat.roughnessMap) mat.roughnessMap.repeat.set(u, v); }   // (rep — foto-teksturaning takrorlanish ko'paytuvchisi)

  setupEnvironment() {
    const H = this.H, scene = this.scene, N = this.night, Q = this.quality;
    // tun: qorong'ulik 30 m dan narini butunlay yashiradi (tuman rangi qora); chaqmoq chaqqanda bir lahzaga hammasi ko'rinadi
    const fogColor = N ? 0x05070a : H ? 0x9ea6ae : 0xdac9a8;
    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.Fog(fogColor, N ? 3 : H ? 15 : 30, N ? 34 : H ? 175 : 240);

    // osmon yorug'ligining bir qismi atrof-muhit xaritasidan keladi (main.js: makeEnv) — yarim shar chirog'i shunga yarasha kuchsizroq
    const LT = this.lite;   // yengil rejimda atrof-muhit xaritasi yo'q — yarim shar chirog'i to'liq kuchda
    const hemi = new THREE.HemisphereLight(N ? 0x6f86b0 : H ? 0xc4ccd6 : 0xe2ecff, N ? 0x14181e : H ? 0x5a5852 : 0x8a7350, N ? 0.42 : H ? (LT ? 1.25 : 0.62) : (LT ? 1.05 : 0.5));
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(N ? 0x9fb4d8 : H ? 0xdfe6f0 : 0xffecc8, N ? 0.45 : H ? 1.6 : 3.3);
    const sd = H ? new THREE.Vector3(-0.5, 0.8, 0.35) : new THREE.Vector3(0.45, 0.75, -0.35);
    sd.normalize();
    const wide = this.half > 200;   // katta xarita: quyosh uzoqroqda, soya kamerasi chuqurroq
    sun.position.copy(sd).multiplyScalar(wide ? 700 : 110);
    sun.target.position.set(0, 0, 0);
    if (Q !== 'low') {
      sun.castShadow = true;
      const ms = Q === 'ultra' ? 8192 : Q === 'high' ? 4096 : 2048;
      sun.shadow.mapSize.set(ms, ms);
      const sc = sun.shadow.camera, se = this.half + 18;
      sc.left = -se; sc.right = se; sc.top = se; sc.bottom = -se; sc.near = 10; sc.far = wide ? 1500 : 290;
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    }
    scene.add(sun); scene.add(sun.target);
    this.sun = sun; this.lightDir = sd.clone();
    // Yaqin soya kaskadi: o'yinchi atrofidagi ±NR metr yuqori aniqlikda (gfx.js dagi shader o'zgartirishi shu xaritadan foydalanadi).
    // Chiroqning kuchi 0 — yoritmaydi, faqat soya xaritasini beradi.
    this.sunNear = null;
    if (!LT && (Q === 'high' || Q === 'ultra')) {
      const nl = new THREE.DirectionalLight(0xffffff, 0), NR = 27, ms = Q === 'ultra' ? 4096 : 2048;
      nl.castShadow = true; nl.shadow.mapSize.set(ms, ms);
      const nc = nl.shadow.camera; nc.left = -NR; nc.right = NR; nc.top = NR; nc.bottom = -NR; nc.near = 10; nc.far = 290;
      nl.shadow.bias = -0.00025; nl.shadow.normalBias = 0.018;
      nl.position.copy(sd).multiplyScalar(110);
      scene.add(nl); scene.add(nl.target);
      this.sunNear = nl; this.nearTexel = (NR * 2) / ms;
      // yorug'lik fazosidagi o'qlar (soya xaritasi piksel to'riga "yopishtirish" uchun — aks holda kamera yurganda soya cheti miltillaydi)
      this._lr = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), sd).normalize(); this._lu = new THREE.Vector3().crossVectors(sd, this._lr).normalize();
    }
    this.sunDir = N ? null : sd.clone();     // quyosh nurlari (post.js) uchun; tunda yo'q
    this.envGain = N ? 1 : H ? 0.62 : 0.5;  // atrof-muhit xaritasining yorqinligi

    // bulutli osmon (gfx.js): kunduzi — siyrak bulutlar va quyosh, qishda — qalin bulut, tunda — bo'ronli osmon
    this.sky = makeSky({
      top: N ? 0x0a0e15 : H ? 0x56637a : 0x245cb4, bottom: fogColor, ground: N ? 0x030405 : H ? 0x8c9196 : 0x9a8460,
      mid: N || H ? undefined : 0x86b2e2, hz: 7,
      sunDir: sd, sunColor: N ? 0x9fb4d8 : H ? 0xc9d0d8 : 0xfff1c8, sunAmt: N ? 0.1 : H ? 0.3 : 1.0,
      cloudLit: N ? 0x161b25 : H ? 0xc6ccd4 : 0xffffff, cloudDark: N ? 0x06080b : H ? 0x6c747e : 0xa4adba,
      cover: N ? 0.88 : H ? 0.76 : 0.44, oct: LT ? 1 : Q === 'low' ? 3 : 5, cloudK: LT ? 0 : 1,
    });
    const skyMat = this.sky.material;
    scene.add(this.sky);
    // rang tuzatish (post.js): davr va ob-havoga mos kayfiyat
    const C3 = (r, g, b) => new THREE.Color(r, g, b);
    // ae — avto-ekspozitsiya: [eng kam, eng ko'p, maqsad yorqinlik] (tunda o'chiq: qorong'ulik saqlanishi kerak)
    // tintS / tintH — soya va yorug' joylarning rang tusi (kino uslubi: sovuq soya, iliq yorug'lik); ca — linzaning chetdagi rang ajralishi
    this.grade = N ? { exposure: 1.12, sat: 0.82, contrast: 1.0, tint: C3(0.93, 0.98, 1.07), tintS: C3(0.94, 0.99, 1.07), tintH: C3(1.0, 1.0, 1.0), ca: 0.0012, bloom: 0.16, rays: 0, vig: 0.42, grain: 0.045, ao: 0.9, ae: null }
      : H ? { exposure: 1.02, sat: 0.84, contrast: 1.25, tint: C3(0.97, 1.0, 1.04), tintS: C3(0.95, 0.99, 1.06), tintH: C3(1.03, 1.0, 0.97), ca: 0.0012, bloom: 0.07, rays: 0.25, raysC: C3(0.8, 0.85, 0.95), vig: 0.28, grain: 0.03, ao: 0.95, ae: [0.82, 1.85, 0.3] }
        : { exposure: 1.0, sat: 1.06, contrast: 1.2, tint: C3(1.015, 1.0, 0.975), tintS: C3(0.94, 0.995, 1.07), tintH: C3(1.045, 1.0, 0.945), ca: 0.0012, bloom: 0.09, rays: 0.6, raysC: C3(1.0, 0.9, 0.72), vig: 0.22, grain: 0.018, ao: 0.9, ae: [0.82, 1.85, 0.31] };
    // chaqmoq uchun boshlang'ich qiymatlar
    this.env = { hemi, sun, sky: skyMat, fog: scene.fog, bg: scene.background, far: scene.fog.far, hemiI: hemi.intensity, sunI: sun.intensity,
      fogC: new THREE.Color(fogColor), top: skyMat.uniforms.top.value.clone(), flashC: new THREE.Color(0x93a4c2), flashTop: new THREE.Color(0x56658a) };
    if (N) {
      // Zombi rejimi: shom (k = 0) va tun (k = 1) qiymatlari — setDark() ular orasida silliq o'tadi (vazifa davomida tun quyuqlashadi)
      const E = this.env, C = (h) => new THREE.Color(h), U = skyMat.uniforms;
      E.near = 3; E.k = 1;
      E.nightP = { fog: C(fogColor), near: 3, far: 34, hemiI: hemi.intensity, hemiC: hemi.color.clone(), sunI: sun.intensity, sunC: sun.color.clone(), top: E.top.clone(),
        cloudLit: U.cloudLit.value.clone(), cloudDark: U.cloudDark.value.clone(), sunAmt: U.sunAmt.value, cover: U.cover.value, exp: this.grade.exposure, sat: this.grade.sat, vig: this.grade.vig };
      E.duskP = { fog: C(H ? 0x7a838f : 0x8f8378), near: 14, far: 170, hemiI: hemi.intensity * 2.3, hemiC: C(H ? 0xb0bac8 : 0xd0bcae), sunI: 1.3, sunC: C(H ? 0xc8d2e6 : 0xffb890), top: C(H ? 0x3c4a60 : 0x40507a),
        cloudLit: C(H ? 0xa2acba : 0xdcae96), cloudDark: C(H ? 0x4e5662 : 0x5e5466), sunAmt: 0.5, cover: 0.68, exp: 1.0, sat: 0.92, vig: 0.26 };
    }
  }
  // Chaqmoq: butun xarita bir lahzaga yorishadi (k — kuchi), so'ng yana qorong'ilik
  flash(k = 1) { if (this.night) { this.flashT = 0; this.flashK = k; } }
  // Zombi rejimi: qorong'ilik darajasi (0 — shom: 170 m gacha ko'rinadi; 1 — tun: 34 m). Tuman, osmon va yorug'lik oraliq qiymat oladi.
  // zv — zombi-o'yinchi ko'rishi: qorong'ida uzoqroq (70 m) va yashilroq ko'radi (odamlarni topishi uchun)
  setDark(k, zv) {
    const E = this.env;
    if (!E || !E.duskP) return;
    k = Math.max(0, Math.min(1, k));
    if ((Math.abs(k - E.k) < 0.002 && !!zv === !!E.zv) || this.flashT >= 0) return;   // (chaqmoq paytida o'zgartirilmaydi — u o'z qiymatlarini yozadi)
    E.k = k; E.zv = !!zv;
    const D = E.duskP, N = E.nightP, L = (a, b) => a + (b - a) * k, U = E.sky.uniforms;
    E.fogC.lerpColors(D.fog, N.fog, k); E.fog.color.copy(E.fogC); E.bg.copy(E.fogC);
    E.near = L(D.near, N.near); E.fog.near = E.near; E.far = L(D.far, N.far); E.fog.far = E.far;
    E.hemiI = L(D.hemiI, N.hemiI); E.hemi.intensity = E.hemiI; E.hemi.color.lerpColors(D.hemiC, N.hemiC, k);
    E.sunI = L(D.sunI, N.sunI); E.sun.intensity = E.sunI; E.sun.color.lerpColors(D.sunC, N.sunC, k);
    E.top.lerpColors(D.top, N.top, k); U.top.value.copy(E.top); U.bottom.value.copy(E.fogC);
    U.cloudLit.value.lerpColors(D.cloudLit, N.cloudLit, k); U.cloudDark.value.lerpColors(D.cloudDark, N.cloudDark, k); U.sunAmt.value = L(D.sunAmt, N.sunAmt); U.cover.value = L(D.cover, N.cover);
    this.grade.exposure = L(D.exp, N.exp); this.grade.sat = L(D.sat, N.sat); this.grade.vig = L(D.vig, N.vig);
    if (zv) { E.far = Math.max(E.far, 70); E.fog.far = E.far; E.hemiI = Math.max(E.hemiI, 1.15); E.hemi.intensity = E.hemiI; E.hemi.color.lerp(_zvC, 0.6); }
  }
  updateFlash(dt) {
    if (this.flashT < 0) return 0;
    this.flashT += dt;
    const t = this.flashT, E = this.env;
    // ikki marta chaqnab, so'ng asta so'nadi
    let f = t < 0.07 ? 1 : t < 0.14 ? 0.25 : t < 0.24 ? 0.95 : Math.max(0, 0.95 * Math.exp(-(t - 0.24) * 3.2) - 0.02);
    f *= this.flashK;
    if (t > 2.2) { f = 0; this.flashT = -1; }
    E.fog.far = E.far + f * 300; E.fog.near = (E.near === undefined ? 3 : E.near) + f * 40;
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
    if (mat === this.mat.crate && opts.trim !== false && Math.min(w, h, d) >= 0.7 && Math.max(w, h, d) <= 2.6) this.crateTrim(x, y0, z, w, h, d);
    if (opts.collide !== false) {
      this.boxes.push(new THREE.Box3(new THREE.Vector3(x - w / 2, y0, z - d / 2), new THREE.Vector3(x + w / 2, y0 + h, z + d / 2)));
      if (opts.map !== false && h > 0.6 && y0 > -0.5 && y0 < 1) this.mapRects.push({ x: x - w / 2, z: z - d / 2, w, d, h, c: opts.mapColor });
    }
    return m;
  }
  // Yashikning relyefi: har yog'ida hoshiya taxtalari va diagonal tirgak (silliq kub o'rniga haqiqiy yig'ma yashik ko'rinishi)
  crateTrim(x, y0, z, w, h, d) {
    if (this.lite || this.quality === 'low') return;
    const M = this.mat.crateTrim, bw = Math.min(0.12, Math.min(w, h, d) * 0.1), t = 0.022, yc = y0 + h / 2;
    const board = (bx, by, bz, sx, sy, sz, rx = 0, rz = 0) => { const g = new THREE.BoxGeometry(sx, sy, sz); scaleUV(g, sx, sy, sz, 1.1); this.deco(g, M, bx, by, bz, rx, 0, rz, false); };
    // yon tomonlar: ±z yoqlari (kengligi w) va ±x yoqlari (kengligi d)
    for (const s of [-1, 1]) {
      const fz = z + s * (d / 2 + t / 2), fx = x + s * (w / 2 + t / 2);
      board(x, y0 + bw / 2, fz, w + t * 2, bw, t); board(x, y0 + h - bw / 2, fz, w + t * 2, bw, t);
      board(x - w / 2 + bw / 2, yc, fz, bw, h - bw * 2, t); board(x + w / 2 - bw / 2, yc, fz, bw, h - bw * 2, t);
      board(x, yc, fz, Math.hypot(w - bw * 2, h - bw * 2) - bw * 0.6, bw * 0.9, t * 0.8, 0, s * Math.atan2(h - bw * 2, w - bw * 2));
      board(fx, y0 + bw / 2, z, t, bw, d); board(fx, y0 + h - bw / 2, z, t, bw, d);
      board(fx, yc, z - d / 2 + bw / 2, t, h - bw * 2, bw); board(fx, yc, z + d / 2 - bw / 2, t, h - bw * 2, bw);
      board(fx, yc, z, t * 0.8, bw * 0.9, Math.hypot(d - bw * 2, h - bw * 2) - bw * 0.6, s * Math.atan2(h - bw * 2, d - bw * 2), 0);
    }
    // qopqoq: chetidagi to'rt taxta
    const ty = y0 + h + t / 2;
    board(x, ty, z - d / 2 + bw / 2, w, t, bw); board(x, ty, z + d / 2 - bw / 2, w, t, bw);
    board(x - w / 2 + bw / 2, ty, z, bw, t, d - bw * 2); board(x + w / 2 - bw / 2, ty, z, bw, t, d - bw * 2);
  }
  // Foto-skanerlangan modellar (js/models.js): yuklangach kodda qurilgan oddiy shakl (proto) o'rnini bosadi; yuklanmasa — oddiy shakl qoladi.
  // Faqat ko'rinish: to'qnashuv qutilari o'zgarmaydi.
  applyModels() {
    if (this.lite || this.quality === 'low' || this.quality === 'medium' || !this.props.length) return;
    const by = new Map();
    for (const p of this.props) { let a = by.get(p.model); if (!a) by.set(p.model, (a = [])); a.push(p); }
    for (const [name, list] of by) getModel(name).then((M) => {
      if (!M || this.dead) return;
      // joyiga qarab burilish (tasodifiy sonlar ketma-ketligiga tegilmaydi — xarita hamma o'yinchida bir xil qolishi kerak)
      const arr = list.map((p) => { const k = p.h / M.size[1]; return { x: p.x, y: p.y, z: p.z, rot: (Math.abs(Math.sin(p.x * 12.9898 + p.z * 78.233)) * 43758.5453) % 6.283, sx: k, sy: k, sz: k }; });
      for (const im of instances(M, arr)) this.scene.add(im);
      for (const p of list) if (p.proto) { this.scene.remove(p.proto); p.proto.geometry.dispose(); p.proto = null; }
      this.modelsOn = (this.modelsOn || 0) + list.length;
    });
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
    if (this.map === 'wild') { buildWild(this); return; }   // karantin zonasi (zombi rejimi) — js/wild.js
    if (this.map === 'big') { buildAirfield(this); return; }   // aerodrom — js/airfield.js
    const hf = this.half, city = this.map === 'city';
    // Bo'sh qoldiriladigan joylar (transport, markaz, punktlar)
    for (const v of this.vehSpawns) this.clear.push({ x: v.x, z: v.z, r: v.type === 'chinook' ? 11 : v.type === 'heli' ? 9 : v.type === 'truck' ? 8 : v.type === 'tank' || v.type === 'ltank' ? 7 : 5 });
    this.clear.push({ x: 0, z: 2, r: 6 });

    if (city) this.buildCity(); else for (const hd of HOUSES) this.house(hd);
    this.buildGround();

    // Yo'llar (xoch shaklida; katta xaritada — qo'shimcha halqa yo'llar)
    this.setRepeat(this.mat.road, 2, hf / 2);
    this.setRepeat(this.mat.roadH, hf / 2, 2);
    if (city) {
      // Yangi shahar: ko'chalar "#" shaklida (ikki juft parallel ko'cha) — markazdan o'tadigan xoch yo'l YO'Q.
      // Ichki kvartal — piyodalar hududi: tosh yo'laklar, rastalar ayvoni, baland to'siq devorlar (markaz orqali to'g'ri ko'rinish va otish yo'li yopiq).
      for (const r of [-60, 60]) { this.plane(this.mat.road, r, 0.011, 0, 7, hf * 2); this.plane(this.mat.roadH, 0, 0.013, r, hf * 2, 7); }
      for (const s of [-1, 1]) { this.plane(this.mat.road, 0, 0.012, s * 80, 8, 40); this.plane(this.mat.roadH, s * 80, 0.014, 0, 40, 8); }   // halqadan tashqaridagi chiqish yo'llari
      this.plane(this.mat.concrete, 0, 0.012, 0, 6, 113); this.plane(this.mat.concrete, 0, 0.0125, 0, 113, 6);                                   // piyodalar yo'lagi
      for (const s of [-1, 1]) {
        this.colonnade(0, s * 26, 3, true); this.colonnade(s * 26, 0, 3, false);                                                                 // rastalar ayvoni (ostidan o'tiladi)
        this.solid(0, 0, s * 44, 6.4, 3.0, 0.6, this.mat.concrete, { uv: 3 }); this.solid(s * 44, 0, 0, 0.6, 3.0, 6.4, this.mat.concrete, { uv: 3 });   // to'siq devor: ikki yonidan aylanib o'tiladi
        this.solid(s * 3.6, 0, s * 51, 2.2, 1.0, 0.9, this.mat.crate, { map: false }); this.solid(s * 51, 0, -s * 3.6, 0.9, 1.0, 2.2, this.mat.crate, { map: false });
      }
    } else {
      this.plane(this.mat.road, 0, 0.012, 0, 8, hf * 2);
      this.plane(this.mat.roadH, 0, 0.014, 0, hf * 2, 8);
    }

    // Chegara devorlari
    const wh = 5, L = hf * 2 + 2;
    this.solid(0, 0, -hf - 0.5, L, wh, 1, this.mat.wall, { uv: 4 });
    this.solid(0, 0, hf + 0.5, L, wh, 1, this.mat.wall, { uv: 4 });
    this.solid(-hf - 0.5, 0, 0, 1, wh, L, this.mat.wall, { uv: 4 });
    this.solid(hf + 0.5, 0, 0, 1, wh, L, this.mat.wall, { uv: 4 });

    this.buildPlaza();
    this.buildPads();

    // To'siqlar — markazga nisbatan simmetrik (ikkala tomon uchun adolatli)
    const cover = city ? COVER_CITY : [
      ['bags', 20, -12, false], ['wreck', 22, 9, true], ['crates', 9, -27, false], ['wall', 0, -25, false],
      ['big', 46, -34, true], ['hedge', 10, 31, false], ['barrels', 50, -8, false], ['crates', 34, -58, false],
      ['bags', 30, -6, true], ['wreck', -40, -50, false], ['hedge', 24, -60, false], ['bags', 60, 22, true],
    ];
    for (const [type, x, z, rot] of cover) for (const sg of [1, -1]) {
      // transport joyi yoki punkt ustiga tushadigan to'siq qo'yilmaydi (katta xaritada joylar tasodifiy)
      if (city && !this.freeSpot(x * sg, z * sg, 3)) continue;
      this.coverItem(type, x * sg, z * sg, rot);
    }

    // Daraxtlar
    let placed = 0, tries = 0;
    const nTrees = city ? 30 : 11, tr = hf - 4;
    while (placed < nTrees && tries++ < 400) {
      const x = this.r(-tr, tr), z = this.r(-tr, tr);
      if (!this.freeSpot(x, z, 2.5) || (city && !this.freeSpot(-x, -z, 2.5))) continue;   // kichik xaritada avvalgi joylashuv saqlanadi
      this.tree(x, z); this.tree(-x, -z); placed++;
    }

    // Yangi pana joylar (ustun, ayvon, dot, beton to'siq, tankka qarshi tishlar) — eski xaritalarda bo'sh joylarga qo'shiladi
    // (daraxtlardan keyin quriladi: avvalgi joylashuv o'zgarmaydi; band joyga tushgani o'tkazib yuboriladi)
    if (!city) for (const [type, x, z, rot] of EXTRA_TOWN) for (const sg of [1, -1]) {
      if (!this.freeSpot(x * sg, z * sg, type === 'bunker' || type === 'colonnade' ? 5 : 2.6)) continue;
      this.coverItem(type, x * sg, z * sg, rot);
    }

    this.backdrop();

    // Ochiq joydagi vositalar: markaz atrofida va chetlarda (to'siq yoki transport joyiga tushganlari o'tkazib yuboriladi)
    const io = city ? [[10, 26], [-10, -26], [26, -10], [-26, 10], [66, 6], [-66, -6], [6, -66], [-6, 66], [80, 30], [-80, -30], [30, -80], [-30, 80]]
        : [[18, 18], [-18, -18], [18, -18], [-18, 18], [44, 40], [-44, -40]];
    for (const [x, z] of io) if (this.freeSpot(x, z, 1.2)) this.itemSpot(x, z);

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

  // Qurol yashigi (zombi rejimi): ichidagi qurol turi — kind; har bir o'yinchi har yashikni bir marta ochadi
  weaponCrate(x, z, kind) {
    const body = this._crateM || (this._crateM = hook(new THREE.MeshStandardMaterial({ map: simpleTex(0x3f4a34, { boards: true }), roughness: 0.85 }), { wet: true }));
    const glow = this._crateG || (this._crateG = new THREE.MeshBasicMaterial({ color: 0x9dff7a, fog: false }));
    this.solid(x, 0, z, 1.25, 0.55, 0.7, body, { map: false });
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.29, 0.1, 0.74), body); lid.geometry.translate(0, 0.05, 0.37);
    lid.position.set(x, 0.55, z - 0.37); lid.castShadow = true; lid.userData.dyn = true; this.scene.add(lid);   // qopqoq ochiladi — birlashtirilmaydi
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.03), glow); lamp.position.set(x, 0.36, z + 0.365); lamp.userData.dyn = true; this.scene.add(lamp);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture(), color: 0x9dff7a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.8 }));
    tag.scale.set(1.3, 1.3, 1); tag.position.set(x, 1.25, z); this.scene.add(tag);
    this.crates.push({ id: this.crates.length, x, z, kind, lid, lamp, tag, open: false, pos: new THREE.Vector3(x, 0.3, z) });
  }

  // Vosita joyi (aptechka, bint, zirh, adrenalin, o'q-dori, granata — navbat bilan). Tartib va joylar hamma o'yinchida bir xil.
  itemSpot(x, z, y = 0.02) {
    const KINDS = ['med', 'ammo', 'armor', 'band', 'nade', 'med', 'adr', 'band'];
    this.itemSpots.push({ x, y, z, kind: KINDS[this.itemSpots.length % KINDS.length] });
  }

  freeSpot(x, z, m) {
    if (this.roads) {   // karantin zonasi: yo'llar ro'yxat bo'yicha (kesma atrofida bo'sh joy qoldiriladi)
      for (const r of this.roads) { const dx = r.bx - r.ax, dz = r.bz - r.az, L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / L2)); if (Math.hypot(x - r.ax - dx * t, z - r.az - dz * t) < r.w / 2 + m) return false; }
    } else if (Math.abs(x) < 6 || Math.abs(z) < 6) return false;
    for (const c of this.clear) if (Math.hypot(c.x - x, c.z - z) < c.r + m) return false;
    for (const b of this.near(x - m, x + m, z - m, z + m)) {
      if (b.max.y < 0.3) continue;
      if (x > b.min.x - m && x < b.max.x + m && z > b.min.z - m && z < b.max.z + m) return false;
    }
    return true;
  }

  // ---------- Uy (ichiga kirish mumkin) ----------
  // yb — devor asosining balandligi (ikkinchi qavat uchun); op.type: 'window', 'door' yoki 'gate' (op.top — darvoza balandligi)
  wallRun(ax, fixed, a0, a1, ops, h, t, mat, yb = 0) {
    const seg = (u0, u1, y0, y1) => {
      if (u1 - u0 < 0.02 || y1 - y0 < 0.02) return;
      const len = u1 - u0, c = (u0 + u1) / 2;
      if (ax === 'x') this.solid(c, y0 + yb, fixed, len, y1 - y0, t, mat, { uv: 3, map: y0 === 0 && yb === 0 });
      else this.solid(fixed, y0 + yb, c, t, y1 - y0, len, mat, { uv: 3, map: y0 === 0 && yb === 0 });
    };
    // bezak (to'qnashuvsiz): poydevor tasmasi, deraza va eshik romlari
    const bar = (u0, u1, y0, y1, th, m) => {
      if (u1 - u0 < 0.02) return;
      const len = u1 - u0, c = (u0 + u1) / 2;
      this.deco(new THREE.BoxGeometry(ax === 'x' ? len : th, y1 - y0, ax === 'x' ? th : len), m, ax === 'x' ? c : fixed, (y0 + y1) / 2 + yb, ax === 'x' ? fixed : c, 0, 0, 0, false);
    };
    const T = this.mat.trim, P = this.mat.plinth;
    let cur = a0;
    for (const op of ops) {
      const s = op.c - op.w / 2, e = op.c + op.w / 2;
      seg(cur, s, 0, h); bar(cur, s, 0, 0.38, t + 0.1, P);
      if (op.type === 'door' || op.type === 'gate') {
        const top = op.top || 2.3;
        seg(s, e, top, h);
        bar(s - 0.09, s, 0, top, t + 0.08, T); bar(e, e + 0.09, 0, top, t + 0.08, T); bar(s - 0.09, e + 0.09, top, top + 0.11, t + 0.1, T);
      } else {
        seg(s, e, 0, 1.0); seg(s, e, 2.2, h); bar(s, e, 0, 0.38, t + 0.1, P);
        this.panes.push({ ax, f: fixed, c: op.c, w: op.w, y0: yb + 1.03, y1: yb + 2.2, broken: false });   // deraza oynasi (buildGlass)
        bar(s - 0.1, e + 0.1, 0.96, 1.03, t + 0.22, T);                                   // deraza tokchasi
        bar(s - 0.06, s, 1.03, 2.2, t + 0.06, T); bar(e, e + 0.06, 1.03, 2.2, t + 0.06, T); bar(s - 0.08, e + 0.08, 2.2, 2.29, t + 0.1, T);
      }
      cur = e;
    }
    seg(cur, a1, 0, h); bar(cur, a1, 0, 0.38, t + 0.1, P);
  }

  // Deraza qo'yish mumkinmi: ichkarida deraza oldidagi yo'lak (kengligi 1.5, chuqurligi 1.1 m) bo'sh bo'lishi va tagida pol bo'lishi kerak —
  // aks holda o'yinchi derazaga yaqinlasha olmaydi (yashik, zina, podval tuynugi). Tashqarida ham 1 m bo'sh joy kerak (devorga tiralgan deraza befoyda).
  // ax/fixed/c — wallRun dagidek; inN — ichkariga qaragan tomon (+1/−1); yF — pol balandligi; b0 — shu uyning birinchi to'qnashuv qutisi raqami
  winFree(ax, fixed, c, inN, yF, b0) {
    const hw = 0.75, t = 0.15;
    const zone = (n0, n1) => { const a = fixed + inN * n0, b = fixed + inN * n1, lo = Math.min(a, b), hi = Math.max(a, b);
      return ax === 'x' ? [c - hw, c + hw, lo, hi] : [lo, hi, c - hw, c + hw]; };
    const hits = (r, y0, y1, from) => { for (let i = from; i < this.boxes.length; i++) { const b = this.boxes[i];
      if (b.max.x > r[0] && b.min.x < r[1] && b.max.z > r[2] && b.min.z < r[3] && b.max.y > y0 && b.min.y < y1) return true; } return false; };
    const zi = zone(t, t + 1.1);
    if (hits(zi, yF + 0.15, yF + 1.95, b0)) return false;                       // ichkarida to'siq
    // pol: birinchi qavatda — podval tuynugi bo'lmasin; yuqori qavatda — plita bo'lsin (zina ustidagi teshik emas)
    if (yF < 0.5) { for (const p of this.pits) if (p.open && p.open.x1 > zi[0] && p.open.x0 < zi[1] && p.open.z1 > zi[2] && p.open.z0 < zi[3]) return false; }
    else for (const fx of [zi[0] + 0.2, zi[1] - 0.2]) for (const fz of [zi[2] + 0.2, zi[3] - 0.2]) {
      let ok = false;
      for (let i = b0; i < this.boxes.length && !ok; i++) { const b = this.boxes[i]; ok = Math.abs(b.max.y - yF) < 0.06 && fx > b.min.x && fx < b.max.x && fz > b.min.z && fz < b.max.z; }
      if (!ok) return false;
    }
    return !hits(zone(-t - 1.0, -t), 0.3, yF + 1.9, 0);                           // tashqarida (pastda ham) to'siq
  }
  // Devor uchun teshiklar ro'yxati: (bo'lsa) o'rtada eshik va oldi ochiq joylarga n tagacha deraza. a0..a1 — devor uzunligi bo'ylab chegaralar.
  wallOps(ax, fixed, a0, a1, inN, yF, b0, hasDoor, n) {
    const L = a1 - a0, mid = (a0 + a1) / 2, ops = [];
    if (hasDoor) ops.push({ c: mid, w: 2.0, type: 'door' });
    // nomzod joylar: eshiksiz devorda avval o'rta; eshikli devorda — eshikdan uzoqroq ikki yon
    const cand = hasDoor ? [0.3, -0.3, 0.36, -0.36] : n > 1 ? [0.25, -0.25, 0, 0.34, -0.34] : [0, 0.14, -0.14, 0.27, -0.27, 0.36, -0.36];
    let left = n;
    for (const k of cand) {
      if (left <= 0) break;
      const c = mid + k * L;
      if (c - 0.7 < a0 + 0.55 || c + 0.7 > a1 - 0.55) continue;                        // burchakka juda yaqin
      if (ops.some((o) => Math.abs(o.c - c) < (o.w + 1.4) / 2 + 0.6)) continue;          // boshqa teshikka yaqin
      if (!this.winFree(ax, fixed, c, inN, yF, b0)) continue;
      ops.push({ c, w: 1.4, type: 'window' }); left--;
    }
    return ops.sort((p, q) => p.c - q.c);
  }

  house(hd) {
    const { x: cx, z: cz, w, d } = hd, t = 0.3, h = 3.2;
    const mat = this.pick(this.mat.walls);
    const zDoor = cz < 0 ? 1 : -1;   // markazga qaragan tomonda eshik
    const xDoor = cx < 0 ? 1 : -1;
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const b0 = this.boxes.length;   // (shu uyning qutilari — deraza joyini tanlashda ichki jihoz hisobga olinadi)
    this.solid(cx, h, cz, w + 0.8, 0.25, d + 0.8, this.mat.roof, { map: false, uv: 3 });
    this.clear.push({ x: cx, z: cz, r: Math.max(w, d) / 2 + 2 });
    this.mapBlds.push({ x: cx, z: cz, w, d, k: hd.base !== undefined ? 'base' : 'house' });
    this.roofDetail(cx, cz, w, d, h + 0.25);
    // ichki jihoz
    const fx = x1 - 1.4, fz = zDoor > 0 ? z0 + 1.4 : z1 - 1.4;
    this.itemSpot(cx - 1.6, zDoor > 0 ? z1 - 1.5 : z0 + 1.5);   // eshik yonida, ichkarida — aptechka/zirh/o'q-dori
    this.roomSpots.push({ x: cx + 1.3, y: 0.02, z: cz + zDoor * 0.4 });   // xona o'rtasida — qurol
    if (hd.base === undefined) {
      this.plane(this.mat.floor, cx, 0.02, cz, w - 0.5, d - 0.5);
      this.solid(fx - 0.4, 0, fz, 1.8, 0.9, 0.9, this.mat.crate, { map: false });
      // podvalsiz uylarning ba'zilarida noyob qurol yashik ustida turadi (katta shaharda maxsus qurollar ko'proq)
      if (hd.sp !== undefined) this.pickups.push({ id: hd.sp, pos: new THREE.Vector3(fx - 0.4, 0.9 + 0.45, fz), pit: -1 });
      this.solid(x0 + 1.3, 0, zDoor > 0 ? z0 + 1.2 : z1 - 1.2, 1.1, 1.1, 1.1, this.mat.crate, { map: false });
    } else {
      this.basement(hd, cx, cz, x0 + t + 0.1, x1 - t - 0.1, z0 + t + 0.1, z1 - t - 0.1, -zDoor);
      this.solid(fx, 0, zDoor > 0 ? z1 - 1.4 : z0 + 1.4, 1.1, 1.1, 1.1, this.mat.crate, { map: false });
    }
    // devorlar eng oxirida: har devorda (bo'lsa) eshik va oldi ochiq joyga 1–2 deraza (ilgari har devorda uchtadan teshik bor edi —
    // uy g'alvirga o'xshardi va derazalarning yarmini ichkaridan yashik yoki podval tuynugi to'sib turardi)
    for (const s of [-1, 1]) {
      const wz = s < 0 ? z0 + t / 2 : z1 - t / 2, wx = s < 0 ? x0 + t / 2 : x1 - t / 2;
      this.wallRun('x', wz, x0, x1, this.wallOps('x', wz, x0, x1, -s, 0, b0, s === zDoor, s === zDoor ? (w >= 9 ? 1 : 0) : (w >= 11 ? 2 : 1)), h, t, mat);
      this.wallRun('z', wx, z0 + t, z1 - t, this.wallOps('z', wx, z0 + t, z1 - t, -s, 0, b0, s === xDoor, s === xDoor ? (d >= 9 ? 1 : 0) : (d >= 11 ? 2 : 1)), h, t, mat);
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

  // Tungi ko'cha chiroqlari (zombi rejimi): punktlar va ular orasidagi yo'l bo'ylab — qorong'ida yo'l ko'rsatadi
  // Bitta ko'cha chirog'i (ko'pi bilan LAMP_N ta — shader chegarasi). Ustun va to'qnashuvi har doim quriladi; yog'du va nur — faqat to'liq grafikada.
  lampPost(x, z) {
    if (this.lampN >= LAMP_N) return;
    this.lampN = (this.lampN || 0) + 1;
    const lite = this.lite, poleM = this.mat.metal, H0 = 4.6, i = this.lamps.length;
    this.deco(new THREE.CylinderGeometry(0.06, 0.09, H0, 8), poleM, x, H0 / 2, z);
    this.deco(new THREE.BoxGeometry(0.9, 0.07, 0.07), poleM, x + 0.4, H0 - 0.05, z);
    this.deco(new THREE.BoxGeometry(0.34, 0.1, 0.2), poleM, x + 0.82, H0 - 0.13, z);
    this.boxes.push(new THREE.Box3(new THREE.Vector3(x - 0.1, 0, z - 0.1), new THREE.Vector3(x + 0.1, H0, z + 0.1)));
    if (lite) return;   // dasturiy chizish: yog'du va chiroq nuri yo'q
    const bulbM = this._bulbM || (this._bulbM = new THREE.MeshBasicMaterial({ color: 0xffe2a8, fog: false })), glowTex = this._glowTex || (this._glowTex = glintTexture());
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.14), bulbM); bulb.position.set(x + 0.82, H0 - 0.2, z); bulb.userData.dyn = true; this.scene.add(bulb);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
    glow.scale.set(2.6, 2.6, 1); glow.position.set(x + 0.82, H0 - 0.22, z); this.scene.add(glow);
    GU.uLamps.value[i].set(x + 0.82, H0 - 0.3, z, 14);
    this.lamps.push({ i, r: 14, flick: i % 4 === 2, glow, bulb });
  }

  // Yer qoplami: toshlar va o't tutamlari (bir chizish chaqiruvi — InstancedMesh; to'qnashuvsiz)
  // ---------- Yer qoplami xaritasi ----------
  // Butun xarita uchun kichik rasm: R — yeyilgan yer (yo'llar va binolar atrofi, chetlari yumshoq), G — o't yamoqlari, B — qattiq yuza (o't o'smaydi).
  // Yer shaderi (gfx.js: GROUND) shu bo'yicha qum, tuproq va o'tni aralashtiradi; o't tutamlari ham shunga qarab joylashadi.
  buildSplat() {
    GU.uSplatInfo.value.set(this.half, 1 / (this.half * 2), 0, 0); this.splat = null;
    if (this.lite || this.quality === 'low') return;
    const hf = this.half, N = hf > 200 ? 1024 : 512, k = N / (hf * 2), c = canvas(N, N), g = c.getContext('2d'), X = (v) => (v + hf) * k;
    g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
    g.globalCompositeOperation = 'lighter';
    // G: o't yamoqlari (katta-kichik dog'lar)
    const nG = Math.round((hf * hf) / (hf > 200 ? 300 : 170));
    for (let i = 0; i < nG; i++) {
      const x = X(this.r2(-hf, hf)), z = X(this.r2(-hf, hf)), r = this.r2(6, hf > 200 ? 32 : 20) * k, a = this.r2(0.45, 0.9), gr = g.createRadialGradient(x, z, 0, x, z, r);
      gr.addColorStop(0, `rgba(0,255,0,${a.toFixed(2)})`); gr.addColorStop(0.55, `rgba(0,255,0,${(a * 0.8).toFixed(2)})`); gr.addColorStop(1, 'rgba(0,255,0,0)'); g.fillStyle = gr; g.fillRect(x - r, z - r, r * 2, r * 2);
    }
    // qattiq yuzalar ro'yxati: yo'llar (kesma) va to'rtburchaklar (binolar, maydonchalar)
    const lines = [], rects = [];
    if (this.roads) for (const r of this.roads) lines.push(r);
    else if (this.map === 'city') { for (const r of [-60, 60]) { rects.push([r, 0, 7, hf * 2], [0, r, hf * 2, 7]); } for (const s of [-1, 1]) rects.push([0, s * 80, 8, 40], [s * 80, 0, 40, 8]); rects.push([0, 0, 6, 113], [0, 0, 113, 6]); }
    else rects.push([0, 0, 8, hf * 2], [0, 0, hf * 2, 8]);
    for (const b of this.mapBlds) if (b.k !== 'roof') rects.push([b.x, b.z, b.w, b.d]);
    const draw = (grow, col) => {
      g.strokeStyle = g.fillStyle = col; g.lineCap = 'butt';
      for (const r of lines) { g.lineWidth = (r.w + grow * 2) * k; g.beginPath(); g.moveTo(X(r.ax), X(r.az)); g.lineTo(X(r.bx), X(r.bz)); g.stroke(); }
      for (const [x, z, w, d] of rects) g.fillRect(X(x - w / 2 - grow), X(z - d / 2 - grow), (w + grow * 2) * k, (d + grow * 2) * k);
      for (const v of this.vehSpawns) if (v.type !== 'cannon') { g.beginPath(); g.arc(X(v.x), X(v.z), ((v.type === 'chinook' ? 8 : v.type === 'heli' ? 6 : 4) + grow) * k, 0, Math.PI * 2); g.fill(); }
    };
    // R: yeyilgan yer — qattiq yuzalardan 2.5 m keng, chetlari yumshatilgan
    if ('filter' in g) g.filter = `blur(${(2.2 * k).toFixed(1)}px)`;
    draw(2.4, '#ff0000');
    if ('filter' in g) g.filter = 'none';
    // B: qattiq yuzaning o'zi (aniq chegarada)
    draw(0.3, '#0000ff');
    g.globalCompositeOperation = 'source-over';
    const t = new THREE.CanvasTexture(c); t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.flipY = false;   // rasmning yuqori qatori — xaritaning −z cheti (aks holda shader xaritani z bo'yicha teskari o'qirdi)
    if (GU.uSplat.value) GU.uSplat.value.dispose();
    if (!this._gd) { this._gd = dirtTex(this.H); this._gg = grassTex(this.H); }
    GU.uSplat.value = t; GU.uGDirt.value = this._gd; GU.uGGrass.value = this._gg; GU.uSplatInfo.value.z = 1;
    GU.uGDirtC.value.setRGB(1, 1, 1); GU.uGGrassC.value.setRGB(1, 1, 1);
    // (foto-teksturalar bo'lsa — tuproq va o't ham suratdan; t hali joriy dunyoniki bo'lsagina almashtiriladi)
    getPhoto('dirt', (P) => { if (GU.uSplat.value === t) { GU.uGDirt.value = P.d; photoTint(GU.uGDirtC.value, 'dirt', this.H ? 0x5d554b : 0x8f6f4a); } });
    getPhoto('grass', (P) => { if (GU.uSplat.value === t) { GU.uGGrass.value = P.d; photoTint(GU.uGGrassC.value, 'grass', this.H ? 0x857a58 : 0x8d8a4c); } });
    this.splat = { d: g.getImageData(0, 0, N, N).data, N, k };
  }
  // Yer qoplami nuqtada: [yeyilgan, o't, qattiq] (0..1); xarita yo'q bo'lsa — null
  splatAt(x, z) {
    const s = this.splat; if (!s) return null;
    const ix = Math.max(0, Math.min(s.N - 1, ((x + this.half) * s.k) | 0)), iz = Math.max(0, Math.min(s.N - 1, ((z + this.half) * s.k) | 0)), i = (iz * s.N + ix) * 4;
    return [s.d[i] / 255, s.d[i + 1] / 255, s.d[i + 2] / 255];
  }

  groundCover() {
    if (this.quality === 'low' || this.lite) return;
    const wide = this.half > 200, big = this.map === 'big' || wide, hf = this.half - 2, M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const spot = () => { for (let i = 0; i < 30; i++) { const x = this.r2(-hf, hf), z = this.r2(-hf, hf); if ((this.roads || (Math.abs(x) > 5 && Math.abs(z) > 5)) && this.freeSpot(x, z, 0.4)) return [x, z]; } return null; };
    // o't va butalar asosan o't yamoqlarida o'sadi (yer rangi bilan mos tushadi); toshlar — hamma joyda
    const green = () => { for (let i = 0; i < 40; i++) { const x = this.r2(-hf, hf), z = this.r2(-hf, hf), sp = this.splatAt(x, z);
      if (sp && (sp[2] > 0.3 || ((sp[1] < 0.3 || sp[0] > 0.4) && i < 34))) continue;   // avval arzon tekshiruv: qattiq yuza emas va (asosan) o't yamog'ida
      if ((this.roads || (Math.abs(x) > 5 && Math.abs(z) > 5)) && this.freeSpot(x, z, 0.4)) return [x, z]; } return null; };
    const nR = wide ? 1500 : big ? 520 : 220, rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), this.mat.rock, nR);
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
    const nT = (wide ? 16000 : big ? 4200 : 1700) * (this.quality === 'medium' ? 0.5 : 1) | 0, tufts = new THREE.InstancedMesh(tg, this.mat.tuft, nT);
    c = 0;
    for (let i = 0; i < nT; i++) {
      const s = green(); if (!s) continue;
      const w = this.r2(0.35, 0.8), h = this.r2(0.18, 0.5) * (this.H ? 0.75 : 1);
      e.set(0, this.r2(0, 3.14), 0); q.setFromEuler(e);
      M.compose(p.set(s[0], 0, s[1]), q, sc.set(w, h, w));
      tufts.setMatrixAt(c++, M);
    }
    tufts.count = c; tufts.receiveShadow = true; tufts.frustumCulled = false; tufts.userData.dyn = true; this.scene.add(tufts);
    // baland o't va butalar (yuqori sifatda): yotgan o'yinchini ko'zdan yashiradi, lekin o'qni to'smaydi
    if (this.quality === 'high' || this.quality === 'ultra') {
      const nB = (wide ? 2600 : big ? 620 : this.map === 'city' ? 520 : 260) * (this.quality === 'ultra' ? 1.5 : 1) | 0, bush = new THREE.InstancedMesh(tg, this.mat.tuft, nB);
      c = 0;
      for (let i = 0; i < nB; i++) {
        const s = green(); if (!s) continue;
        // to'p-to'p o'sadi: har bir joyda 2-3 ta yonma-yon
        const w = this.r2(1.0, 1.9), h = this.r2(0.65, 1.15) * (this.H ? 0.8 : 1);
        e.set(0, this.r2(0, 3.14), 0); q.setFromEuler(e);
        M.compose(p.set(s[0], 0, s[1]), q, sc.set(w, h, w));
        bush.setMatrixAt(c++, M);
      }
      bush.count = c; bush.receiveShadow = true; bush.frustumCulled = false; bush.userData.dyn = true; this.scene.add(bush);
      // o't halqasi: kamera atrofidagi zich o't (gfx.js: RING) — hamma tutam bitta chizish chaqiruvida
      if (this.splat) {
        const RS = this.quality === 'ultra' ? 60 : 52, nR = this.quality === 'ultra' ? 18000 : 11000, ig = new THREE.InstancedBufferGeometry(), off = new Float32Array(nR * 3);
        ig.setAttribute('position', tg.attributes.position); ig.setAttribute('uv', tg.attributes.uv); ig.setAttribute('normal', tg.attributes.normal);
        for (let i = 0; i < nR; i++) { off[i * 3] = this.rand2() * RS; off[i * 3 + 1] = this.rand2() * RS; off[i * 3 + 2] = this.rand2(); }
        ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3)); ig.instanceCount = nR;
        const rm = hook(new THREE.MeshStandardMaterial({ map: this.mat.tuft.map, alphaTest: 0.35, alphaToCoverage: true, roughness: 1, color: this.H ? 0xe6e2d2 : 0xdcd6a6 }), { ring: RS });
        const ring = new THREE.Mesh(ig, rm); ring.frustumCulled = false; ring.receiveShadow = true; ring.userData.dyn = true; this.scene.add(ring); this.grassRing = ring;
      }
    }
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
    const E = Math.max(380, this.half + 260);
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

  // ================= YANGI PANA JOYLAR VA BINOLAR =================
  // To'rtburchak maydonni band deb belgilash (daraxt, tosh va o't shu yerga tushmaydi)
  clearRect(x, z, w, d) {
    const r = Math.min(w, d) / 2 + 1.5, n = Math.max(1, Math.ceil(Math.max(w, d) / (r * 1.4))), lw = w >= d;
    for (let i = 0; i < n; i++) { const a = n === 1 ? 0 : (i / (n - 1) - 0.5) * (Math.max(w, d) - Math.min(w, d)); this.clear.push({ x: x + (lw ? a : 0), z: z + (lw ? 0 : a), r }); }
  }
  // Qalin beton ustun: orqasiga bemalol berkinsa bo'ladi
  pillar(x, z, h = 3.4, s = 1.0, mat = this.mat.concrete) {
    this.solid(x, 0, z, s, h, s, mat, { uv: 2 });
    this.deco(new THREE.BoxGeometry(s + 0.22, 0.3, s + 0.22), this.mat.plinth, x, 0.15, z, 0, 0, 0, false);
    this.deco(new THREE.BoxGeometry(s + 0.18, 0.22, s + 0.18), this.mat.plinth, x, h - 0.11, z, 0, 0, 0, false);
  }
  // Ayvon: ikki qator ustun va ustida tom — vertolyotdan pana, transport ustunlar orasidan o'tolmaydi
  colonnade(x, z, n, rot, h = 3.3) {
    const sp = 3.2, wd = 3.4, L = (n - 1) * sp;
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
      const a = -L / 2 + i * sp;
      this.pillar(rot ? x + s * wd / 2 : x + a, rot ? z + a : z + s * wd / 2, h, 0.85);
    }
    const w = rot ? wd + 1.6 : L + 1.6, d = rot ? L + 1.6 : wd + 1.6;
    this.solid(x, h, z, w, 0.35, d, this.mat.roof, { uv: 3, map: false });
    this.deco(new THREE.BoxGeometry(w + 0.2, 0.12, d + 0.2), this.mat.plinth, x, h + 0.41, z, 0, 0, 0, false);
    this.mapBlds.push({ x, z, w, d, k: 'roof' });
    this.clearRect(x, z, w, d);
  }
  // Bostirma: to'rt ustun va tom (kichigi — bozor rastasi, peshtaxtasi bilan)
  shed(x, z, w, d, h = 3.0) {
    const small = w < 5, ps = small ? 0.22 : 0.45, m = small ? this.mat.trim : this.mat.steel;
    for (const a of [-1, 1]) for (const b of [-1, 1]) this.solid(x + a * (w / 2 - ps / 2), 0, z + b * (d / 2 - ps / 2), ps, small ? 2.5 : h, ps, m, { map: false, uv: 2 });
    this.solid(x, small ? 2.5 : h, z, w + 0.7, 0.16, d + 0.7, small ? this.pick(this.mat.containers) : this.mat.metal, { uv: 2.6, map: false });
    if (small) this.solid(x, 0, z + d / 2 - 0.5, w - 0.7, 0.95, 0.7, this.mat.crate, { uv: 1.2 });   // peshtaxta — orqasiga cho'kkalab berkinsa bo'ladi
    else { this.solid(x - w / 2 + 1.1, 0, z, 1.2, 1.2, 1.2, this.mat.crate, { map: false }); this.solid(x + w / 2 - 1.3, 0, z + d / 2 - 1.2, 1.6, 0.95, 0.95, this.mat.crate, { map: false }); }
    this.mapBlds.push({ x, z, w, d, k: 'roof' });
    this.clearRect(x, z, w, d);
  }
  // Beton to'siqlar qatori: ortiga cho'kkalab/yotib berkiniladi, [PROBEL] bilan oshib o'tiladi
  barrier(x, z, rot, n = 3) {
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * 2.7;
      this.solid(x + (rot ? 0 : a), 0, z + (rot ? a : 0), rot ? 0.55 : 2.4, 1.06, rot ? 2.4 : 0.55, this.mat.concrete, { uv: 1.4 });   // (panalar personaj o'lchamiga mos balandlikda)
    }
  }
  // Tankka qarshi tishlar: transport o'tolmaydi, piyoda oralaridan o'tadi
  teeth(x, z, rot, n = 6) {
    const g = new THREE.CylinderGeometry(0.16, 0.42, 0.95, 4);
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * 1.65, px = x + (rot ? 0 : a), pz = z + (rot ? a : 0);
      this.deco(g, this.mat.concrete, px, 0.475, pz, 0, Math.PI / 4, 0);
      this.boxes.push(new THREE.Box3(new THREE.Vector3(px - 0.33, 0, pz - 0.33), new THREE.Vector3(px + 0.33, 0.95, pz + 0.33)));
    }
    const L = (n - 1) * 1.65 + 0.7;
    this.mapRects.push({ x: x - (rot ? 0.35 : L / 2), z: z - (rot ? L / 2 : 0.35), w: rot ? 0.7 : L, d: rot ? L : 0.7, h: 1 });
  }
  // Dot (beton bunker): qalin devor va tom, old tomonda otish tuynugi, orqada eshik. face: 0 — tuynuk −z ga, 1 — +x, 2 — +z, 3 — −x ga qaraydi.
  bunker(x, z, face = 0, sp) {
    const m = this.mat.concrete, W = 5.2, D = 4.6, t = 0.5, h = 2.6, s0 = 1.36, s1 = 2.02;   // tuynuk tik turgan odamning ko'zi (1.81 m) balandligida
    // mahalliy koordinata (old tomon −z) → dunyo: chorak burilishlar
    const put = (lx, y0, lz, lw, lh, ld, o = {}) => {
      let X = lx, Z = lz, w = lw, d = ld;
      for (let k = 0; k < face; k++) { [X, Z] = [-Z, X]; [w, d] = [d, w]; }
      return this.solid(x + X, y0, z + Z, w, lh, d, m, Object.assign({ uv: 2.5 }, o));
    };
    const zf = -D / 2 + t / 2, zb = D / 2 - t / 2, xs = W / 2 - t / 2;
    put(0, 0, zf, W, s0, t); put(0, s1, zf, W, h - s1, t, { map: false });                       // old devor: tuynuk ostidan va ustidan
    for (const k of [-1, 1]) put(k * (W / 2 - 0.45), s0, zf, 0.9, s1 - s0, t, { map: false });   // tuynuk chetlari
    for (const k of [-1, 1]) {                                                                   // yon devorlar: o'rtasida kichik tuynuk
      put(k * xs, 0, -1.075, t, h, 1.45);
      put(k * xs, 0, 1.225, t, h, 1.15, { map: false });
      put(k * xs, 0, 0.15, t, s0, 1.0, { map: false }); put(k * xs, s1, 0.15, t, h - s1, 1.0, { map: false });
    }
    put(-1.275, 0, zb, 2.65, h, t); put(1.975, 0, zb, 1.25, h, t, { map: false }); put(0.7, 2.25, zb, 1.3, h - 2.25, t, { map: false });   // orqa devor: eshik (1.3 × 2.25)
    put(0, h, 0, W + 0.5, 0.45, D + 0.5, { map: false, uv: 3 });                                  // tom
    const ff = face % 2 ? [D, W] : [W, D];
    this.plane(this.mat.floor, x, 0.02, z, ff[0] - 1, ff[1] - 1);
    put(-1.5, 0, 0.9, 0.9, 0.7, 0.9, { map: false });                                             // o'q-dori yashigi
    let ix = 1.2, iz = 0.6; for (let k = 0; k < face; k++) [ix, iz] = [-iz, ix];
    this.itemSpot(x + ix, z + iz);
    { let rx = 0.3, rz = -0.9; for (let k = 0; k < face; k++) [rx, rz] = [-rz, rx]; this.roomSpots.push({ x: x + rx, y: 0.02, z: z + rz }); }
    if (sp !== undefined) { let px = -1.5, pz = 0.9; for (let k = 0; k < face; k++) [px, pz] = [-pz, px]; this.pickups.push({ id: sp, pos: new THREE.Vector3(x + px, 0.7 + 0.45, z + pz), pit: -1 }); }
    this.mapBlds.push({ x, z, w: ff[0], d: ff[1], k: 'bunker' });
    this.clearRect(x, z, ff[0] + 1, ff[1] + 1);
  }
  // Qorovul minorasi: zinadan chiqiladigan supa (4 m), to'siq va tom. sp — supadagi noyob qurol.
  tower(x, z, sp) {
    const m = this.mat.metal, wood = this.mat.crate, P = 3.2, top = 3.87;
    for (const a of [-1, 1]) for (const b of [-1, 1]) this.solid(x + a * 1.35, 0, z + b * 1.35, 0.3, top - 0.25, 0.3, m, { map: false, uv: 2 });
    this.solid(x, top - 0.25, z, P, 0.25, P, wood, { map: false, uv: 1.6 });
    // zina: g'arb tomondan (x−) ko'tariladi, to'qqiz pog'ona
    for (let i = 0; i < 9; i++) this.solid(x - P / 2 - 0.3 - (8 - i) * 0.55, 0, z, 0.55, (i + 1) * (top / 9), 1.1, wood, { map: false, uv: 1.4 });
    // to'siq (zina tomoni ochiq) va tom
    const r = 1.1, y = top;
    this.solid(x + P / 2 - 0.08, y, z, 0.16, r, P, wood, { map: false, uv: 1.4 }); this.solid(x, y, z - P / 2 + 0.08, P, r, 0.16, wood, { map: false, uv: 1.4 }); this.solid(x, y, z + P / 2 - 0.08, P, r, 0.16, wood, { map: false, uv: 1.4 });
    for (const b of [-1, 1]) this.solid(x - P / 2 + 0.08, y, z + b * 1.1, 0.16, r, 1.0, wood, { map: false, uv: 1.4 });
    for (const a of [-1, 1]) for (const b of [-1, 1]) this.deco(new THREE.BoxGeometry(0.12, 2.45, 0.12), m, x + a * 1.45, y + 1.225, z + b * 1.45, 0, 0, 0, false);
    this.solid(x, y + 2.45, z, P + 0.8, 0.14, P + 0.8, this.mat.metal, { map: false, uv: 2.6 });
    if (sp !== undefined) { this.solid(x + 0.9, y, z + 0.9, 0.7, 0.5, 0.7, wood, { map: false }); this.pickups.push({ id: sp, pos: new THREE.Vector3(x + 0.9, y + 0.5 + 0.45, z + 0.9), pit: -1 }); }
    else this.itemSpot(x + 0.8, z - 0.8, y + 0.02);
    this.mapBlds.push({ x, z, w: P, d: P, k: 'tower' });
    this.clearRect(x - 2.5, z, P + 6, P + 1);
  }
  // Ikki qavatli uy: ichki zina, ikkinchi qavatdan atrof ko'rinadi. sp — ikkinchi qavatdagi noyob qurol.
  house2(hd) {
    const { x: cx, z: cz, w, d } = hd, t = 0.3, h = 3.2, F = 3.45, h2 = 3.0;
    const mat = this.pick(this.mat.walls);
    const zDoor = cz < 0 ? 1 : -1, xDoor = cx < 0 ? 1 : -1;
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const b0 = this.boxes.length;
    this.plane(this.mat.floor, cx, 0.02, cz, w - 0.5, d - 0.5);
    // zina eshikka qarama-qarshi devor bo'ylab: g'arbdan sharqqa ko'tariladi (8 pog'ona)
    const sw = 1.25, ix0 = x0 + t, ix1 = x1 - t, sx0 = ix0 + 1.6, sx1 = sx0 + 4.0;
    const bz0 = zDoor > 0 ? z0 + t : z1 - t - sw, bz1 = bz0 + sw, bzc = (bz0 + bz1) / 2;   // zina yo'lagi
    const az0 = zDoor > 0 ? bz1 : z0 + t, az1 = zDoor > 0 ? z1 - t : bz0;                  // qolgan qism
    for (let i = 0; i < 8; i++) this.solid(sx0 + i * 0.5 + 0.25, 0, bzc, 0.5, (i + 1) * (F / 8), sw, this.mat.concrete, { map: false, uv: 2 });
    // qavatlararo plita (zina ustida teshik)
    const fo = { map: false, uv: 2 };
    this.solid(cx, h, (az0 + az1) / 2, ix1 - ix0, F - h, az1 - az0, this.mat.floor, fo);
    this.solid((ix0 + sx0) / 2, h, bzc, sx0 - ix0, F - h, sw, this.mat.floor, fo);
    this.solid((sx1 + ix1) / 2, h, bzc, ix1 - sx1, F - h, sw, this.mat.floor, fo);
    // tom
    this.solid(cx, F + h2, cz, w + 0.8, 0.25, d + 0.8, this.mat.roof, { map: false, uv: 3 });
    this.roofDetail(cx, cz, w, d, F + h2 + 0.25);
    this.clear.push({ x: cx, z: cz, r: Math.max(w, d) / 2 + 2 });
    this.mapBlds.push({ x: cx, z: cz, w, d, k: 'house2' });
    // jihozlar: pastda yashiklar; tepada yashik (deraza oldida pana) va vosita yoki noyob qurol
    this.solid(x1 - 1.6, 0, zDoor > 0 ? z1 - 1.5 : z0 + 1.5, 1.6, 0.9, 0.9, this.mat.crate, { map: false });
    this.itemSpot(cx + 1.5, zDoor > 0 ? z1 - 1.6 : z0 + 1.6);
    const ux = x1 - 1.5, uz = zDoor > 0 ? z1 - 1.5 : z0 + 1.5;
    this.solid(ux, F, uz, 1.0, 0.8, 1.0, this.mat.crate, { map: false });
    this.solid(x0 + 1.4, F, (az0 + az1) / 2, 1.1, 1.1, 1.1, this.mat.crate, { map: false });
    if (hd.sp !== undefined) this.pickups.push({ id: hd.sp, pos: new THREE.Vector3(ux, F + 0.8 + 0.45, uz), pit: -1 });
    this.itemSpot(cx, (az0 + az1) / 2, F + 0.02);
    this.roomSpots.push({ x: cx - 2.0, y: 0.02, z: cz + zDoor * 1.2 }, { x: cx + 2.2, y: F + 0.02, z: (az0 + az1) / 2 + zDoor * 1.1 });   // ikkala qavatda
    // devorlar eng oxirida (zina, plita va jihozlar joylashgach): deraza faqat oldi ochiq va tagida pol bor joyga qo'yiladi.
    // Birinchi qavat devori ikkinchi qavat poligacha (F) ko'tariladi — aks holda qavatlar orasida 25 sm ochiq tirqish qolardi.
    for (const s of [-1, 1]) {
      const wz = s < 0 ? z0 + t / 2 : z1 - t / 2, wx = s < 0 ? x0 + t / 2 : x1 - t / 2, front = s === zDoor, side = s === xDoor;
      this.wallRun('x', wz, x0, x1, this.wallOps('x', wz, x0, x1, -s, 0, b0, front, front ? (w >= 9 ? 1 : 0) : 1), F, t, mat);
      this.wallRun('z', wx, z0 + t, z1 - t, this.wallOps('z', wx, z0 + t, z1 - t, -s, 0, b0, side, side ? (d >= 9 ? 1 : 0) : 1), F, t, mat);
      // ikkinchi qavat: old tomonda ikkita, qolgan tomonlarda bittadan deraza
      this.wallRun('x', wz, x0, x1, this.wallOps('x', wz, x0, x1, -s, F, b0, false, front && w >= 10 ? 2 : 1), h2, t, mat, F);
      this.wallRun('z', wx, z0 + t, z1 - t, this.wallOps('z', wx, z0 + t, z1 - t, -s, F, b0, false, 1), h2, t, mat, F);
    }
  }
  // Ombor: baland devor, ikki tomonda katta darvoza (jip kira oladi), ichida ustunlar, yashik va konteynerlar
  warehouse(hd) {
    const { x: cx, z: cz, w, d } = hd, t = 0.4, h = 5.2, long = w >= d;
    const mat = this.mat.plinth, x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const gate = (c) => ({ c, w: 4.4, type: 'gate', top: 3.7 }), door = (c) => ({ c, w: 2.0, type: 'door' });
    // darvozalar qisqa tomonlarda, yon eshik uzun tomonda
    this.wallRun('x', z0 + t / 2, x0, x1, long ? [door(cx - w * 0.25)] : [gate(cx)], h, t, mat);
    this.wallRun('x', z1 - t / 2, x0, x1, long ? [door(cx + w * 0.25)] : [gate(cx)], h, t, mat);
    this.wallRun('z', x0 + t / 2, z0 + t, z1 - t, long ? [gate(cz)] : [door(cz - d * 0.25)], h, t, mat);
    this.wallRun('z', x1 - t / 2, z0 + t, z1 - t, long ? [gate(cz)] : [door(cz + d * 0.25)], h, t, mat);
    this.solid(cx, h, cz, w + 0.8, 0.3, d + 0.8, this.mat.metal, { map: false, uv: 3 });
    this.plane(this.mat.concrete, cx, 0.02, cz, w - 0.6, d - 0.6);
    // ichki ustunlar (ikki qator)
    const n = Math.max(2, Math.round((long ? w : d) / 6));
    for (let i = 1; i < n; i++) for (const s of [-1, 1]) {
      const a = (i / n - 0.5) * (long ? w : d), b = s * (long ? d : w) * 0.24;
      this.solid(long ? cx + a : cx + b, 0, long ? cz + b : cz + a, 0.6, h, 0.6, this.mat.steel, { map: false, uv: 2 });
    }
    // yuklar: devor bo'ylab yashiklar va bitta konteyner
    // (konteyner yon eshiklarni to'smaydigan burchakda turadi)
    if (long) this.solid(cx - (w / 2 - 4.2), 0, cz + (d / 2 - 2.2), 6, 2.6, 2.5, this.pick(this.mat.containers), { uv: 2.6 });
    else this.solid(cx + (w / 2 - 2.2), 0, cz - (d / 2 - 4.2), 2.5, 2.6, 6, this.pick(this.mat.containers), { uv: 2.6 });
    for (const [a, b, s] of [[0.3, -0.36, 1.2], [0.22, 0.36, 1.1], [-0.1, 0.38, 1.3], [0.08, 0.37, 1.0]]) this.solid(cx + (long ? a * w : b * w), 0, cz + (long ? b * d : a * d), s, s, s, this.mat.crate, { map: false });
    this.itemSpot(cx + (long ? w * 0.18 : 0), cz + (long ? 0 : d * 0.18));
    this.itemSpot(cx - (long ? w * 0.3 : 0) + 1, cz - (long ? 0 : d * 0.3) + 1);
    this.roomSpots.push({ x: cx + 1.6, y: 0.02, z: cz - 1.6 }, { x: cx - 3, y: 0.02, z: cz + 1.6 });
    if (hd.sp !== undefined) { const px = cx + (long ? w * 0.4 : 0), pz = cz + (long ? 0 : d * 0.4) + (long ? d * 0.3 : 0); this.solid(px, 0, pz, 0.9, 0.8, 0.9, this.mat.crate, { map: false }); this.pickups.push({ id: hd.sp, pos: new THREE.Vector3(px, 0.8 + 0.45, pz), pit: -1 }); }
    this.clearRect(cx, cz, w + 2, d + 2);
    this.mapBlds.push({ x: cx, z: cz, w, d, k: 'ware' });
  }
  // Yuk konteyneri (ustma-ust bo'lsa — ikkinchi qavatda)
  container(x, z, rot, up = 0) {
    const w = rot ? 2.5 : 6, d = rot ? 6 : 2.5;
    this.solid(x, up * 2.6, z, w, 2.6, d, this.pick(this.mat.containers), { uv: 2.6, map: up === 0 });
  }
  // Yangi shahar: barcha binolar va pana joylar (podvallar ham shu yerda — yer qoplamasidan oldin quriladi)
  buildCity() {
    const C = CITY;
    for (const hd of C.houses) this.house(hd);
    for (const hd of C.houses2) this.house2(hd);
    for (const hd of C.warehouses) this.warehouse(hd);
    for (const [x, z, f, sp] of C.bunkers) this.bunker(x, z, f, sp);
    for (const [x, z, rot] of C.colonnades) this.colonnade(x, z, 4, rot);
    for (const [x, z, sp] of C.towers) this.tower(x, z, sp);
    for (const [x, z, w, d] of C.sheds) this.shed(x, z, w, d);
    for (const [x, z] of C.pillars) this.pillar(x, z, 3.4, 1.0, this.H ? this.mat.wall : this.mat.concrete);
    for (const [x, z, rot] of C.barriers) this.barrier(x, z, rot, 3);
    for (const [x, z, rot] of C.teeth) this.teeth(x, z, rot, 6);
    for (const [x, z, rot, up] of C.containers) this.container(x, z, rot, up || 0);
    this.clearRect(46, -50, 30, 22);   // konteynerlar maydoni
  }

  coverItem(type, x, z, rot) {
    const H = this.H;
    const sw = (a, b) => (rot ? [b, a] : [a, b]);
    if (type === 'pillars') { for (const k of [-1, 1]) this.pillar(x + (rot ? 0 : k * 2.2), z + (rot ? k * 2.2 : 0)); }
    else if (type === 'colonnade') this.colonnade(x, z, 4, rot);
    else if (type === 'bunker') this.bunker(x, z, rot ? 1 : 0);
    else if (type === 'barrier') this.barrier(x, z, rot, 3);
    else if (type === 'teeth') this.teeth(x, z, rot, 6);
    else if (type === 'shed') this.shed(x, z, rot ? 6 : 8, rot ? 8 : 6);
    else if (type === 'bags') {
      const [w, d] = sw(4, 0.7);
      this.solid(x, 0, z, w, 1.12, d, this.mat.sandbag, { uv: 1.2 });
      const [w2, d2] = sw(0.7, 2.2);
      this.solid(x + (rot ? 1.4 : -2), 0, z + (rot ? -2 : 1.4), w2, 1.12, d2, this.mat.sandbag, { uv: 1.2 });
    } else if (type === 'wall') {
      const [w, d] = sw(6, 0.5);
      this.solid(x, 0, z, w, 1.45, d, H ? this.mat.wall : this.mat.concrete, { uv: 3 });
    } else if (type === 'crates') this.crateStack(x, z);
    else if (type === 'barrels') this.barrels(x, z);
    else if (type === 'hedge') {
      if (H) { this.hedgehog(x, z); this.hedgehog(x + (rot ? 0 : 2.4), z + (rot ? 2.4 : 0)); }
      else { const [w, d] = sw(3, 0.6); this.solid(x, 0, z, w, 1.06, d, this.mat.concrete, { uv: 1 }); this.solid(x + (rot ? 0 : 3.2), 0, z + (rot ? 3.2 : 0), w, 1.06, d, this.mat.concrete, { uv: 1 }); }
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
      const proto = this.deco(new THREE.CylinderGeometry(0.3, 0.3, 0.95, 12), m, bx, 0.475, bz); proto.userData.dyn = true;
      this.props.push({ model: 'barrel_03', x: bx, y: 0, z: bz, h: 0.95, proto });   // (qizil "portlovchi" bochka modeli ataylab ishlatilmagan: o'yinda bochkalar portlamaydi)
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
    // Uzoqdagi tepaliklar: xaritani o'rab turgan ikki qator silliq tizma (balandligi shovqin bilan o'zgaradi); tuman ularni havoga singdiradi.
    // (Avvalgi yetti qirrali konuslar piramidaga o'xshab qolardi.)
    const ridge = (R, hMin, hMax, col, seed) => {
      const N = 180, pos = [], idx = [], hh = (a) => { const t = a + seed; return hMin + (hMax - hMin) * Math.max(0, 0.5 + 0.28 * Math.sin(t * 3) + 0.2 * Math.sin(t * 7 + 1.3) + 0.14 * Math.sin(t * 13 + 0.4) + 0.08 * Math.sin(t * 29)); };
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), h = hh(a), w = 40 + h * 1.6;
        pos.push(c * (R - w), -2, sn * (R - w), c * R, h, sn * R, c * (R + w), -2, sn * (R + w));   // old etak, cho'qqi, orqa etak
        if (i < N) { const k = i * 3; idx.push(k, k + 1, k + 3, k + 1, k + 4, k + 3, k + 1, k + 2, k + 4, k + 2, k + 5, k + 4); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col, roughness: 1, side: THREE.DoubleSide })); m.frustumCulled = false; m.userData.dyn = true; this.scene.add(m);
    };
    const R0 = this.half + (this.half > 200 ? 150 : 120);
    ridge(R0, 8, 30, H ? 0xc4cad0 : 0xbfa272, 0.7);
    ridge(R0 + 90, 22, 62, H ? 0xaab2bc : 0xae9468, 2.9);
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
  addBox(b) { if (!this.boxes.includes(b)) { this.boxes.push(b); if (this.dyn) this.dyn.push(b); } }
  removeBox(b) { let i = this.boxes.indexOf(b); if (i >= 0) this.boxes.splice(i, 1); if (this.dyn) { i = this.dyn.indexOf(b); if (i >= 0) this.dyn.splice(i, 1); } }

  // ---------- To'qnashuv to'ri ----------
  // Qo'zg'almas qutilar XZ tekisligida GS metrli kataklarga taqsimlanadi: nur, ko'rinish va to'qnashuv so'rovlari butun ro'yxatni emas,
  // faqat o'z yo'lidagi kataklarni tekshiradi (katta xaritada minglab quti bor — har bir o'q va har bir zombi uchun hammasini aylanib chiqish juda sekin).
  // Harakatlanuvchi qutilar (transport) alohida kichik ro'yxatda turadi (this.dyn) va har doim tekshiriladi.
  // Dunyo qurib bo'lingach chaqiriladi; undan keyin qo'zg'almas quti qo'shilmaydi.
  buildGrid() {
    const ext = this.half + 8, n = Math.ceil((ext * 2) / GS), cells = new Array(n * n), ci = (v) => Math.max(0, Math.min(n - 1, Math.floor((v + ext) / GS)));
    this.dyn = []; this.qid = 0; this._cand = []; this._rb = [];
    let idx = 0;
    for (const b of this.boxes) {
      b._q = 0; b._i = idx++;   // _i — ro'yxatdagi o'rni (tartib saqlanishi kerak bo'lgan so'rovlar uchun)
      if (b.vehicle) { this.dyn.push(b); continue; }
      const x0 = ci(b.min.x), x1 = ci(b.max.x), z0 = ci(b.min.z), z1 = ci(b.max.z);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const i = z * n + x; (cells[i] || (cells[i] = [])).push(b); }
    }
    this.gN = n; this.gExt = ext; this.gCells = cells;
  }
  // [x0..x1] × [z0..z1] to'rtburchakka tegishi mumkin bo'lgan qutilar (takrorsiz). Natija massivi keyingi chaqiruvgacha yaroqli.
  // sorted — qutilar dunyo qurilgandagi tartibda qaytariladi (ketma-ket itarishda natija avvalgidek aniq bo'lishi uchun)
  near(x0, x1, z0, z1, sorted) {
    const cells = this.gCells;
    if (!cells) return this.boxes;   // (dunyo hali qurilmoqda)
    const n = this.gN, e = this.gExt, out = this._cand, q = ++this.qid;
    out.length = 0;
    const cx0 = Math.max(0, Math.floor((x0 + e) / GS)), cx1 = Math.min(n - 1, Math.floor((x1 + e) / GS));
    const cz0 = Math.max(0, Math.floor((z0 + e) / GS)), cz1 = Math.min(n - 1, Math.floor((z1 + e) / GS));
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = cells[cz * n + cx];
      if (c) for (let i = 0; i < c.length; i++) { const b = c[i]; if (b._q !== q) { b._q = q; out.push(b); } }
    }
    if (sorted) for (let i = 1; i < out.length; i++) { const b = out[i]; let j = i - 1; while (j >= 0 && out[j]._i > b._i) { out[j + 1] = out[j]; j--; } out[j + 1] = b; }
    const dy = this.dyn;
    for (let i = 0; i < dy.length; i++) out.push(dy[i]);
    return out;
  }
  // Nur (o + d·t, 0 ≤ t ≤ maxT) yo'lidagi kataklarda turgan qutilar (takrorsiz) + harakatlanuvchilar. Natija keyingi chaqiruvgacha yaroqli.
  rayBoxes(o, d, maxT) {
    const cells = this.gCells;
    if (!cells) return this.boxes;
    const n = this.gN, e = this.gExt, S = n * GS, out = this._rb, q = ++this.qid, dy = this.dyn;
    out.length = 0;
    for (let i = 0; i < dy.length; i++) out.push(dy[i]);
    let t0 = 0, x = o.x + e, z = o.z + e;
    if (x < 0 || x >= S || z < 0 || z >= S) {   // to'rdan tashqarida boshlangan nur kirish nuqtasigacha suriladi
      let ta = 0, tb = maxT;
      if (d.x !== 0) { let a = -x / d.x, c = (S - x) / d.x; if (a > c) { const w = a; a = c; c = w; } if (a > ta) ta = a; if (c < tb) tb = c; } else if (x < 0 || x >= S) return out;
      if (d.z !== 0) { let a = -z / d.z, c = (S - z) / d.z; if (a > c) { const w = a; a = c; c = w; } if (a > ta) ta = a; if (c < tb) tb = c; } else if (z < 0 || z >= S) return out;
      if (ta > tb) return out;
      t0 = ta + 1e-4; x += d.x * t0; z += d.z * t0;
    }
    let cx = Math.max(0, Math.min(n - 1, Math.floor(x / GS))), cz = Math.max(0, Math.min(n - 1, Math.floor(z / GS)));
    const sx = d.x > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1, ax = Math.abs(d.x), az = Math.abs(d.z);
    const tdx = ax > 0 ? GS / ax : Infinity, tdz = az > 0 ? GS / az : Infinity;
    let tmx = ax > 0 ? t0 + (d.x > 0 ? (cx + 1) * GS - x : x - cx * GS) / ax : Infinity, tmz = az > 0 ? t0 + (d.z > 0 ? (cz + 1) * GS - z : z - cz * GS) / az : Infinity;
    let tc = t0;
    while (tc <= maxT && cx >= 0 && cx < n && cz >= 0 && cz < n) {
      const c = cells[cz * n + cx];
      if (c) for (let i = 0; i < c.length; i++) { const b = c[i]; if (b._q !== q) { b._q = q; out.push(b); } }
      if (tmx < tmz) { tc = tmx; tmx += tdx; cx += sx; } else { tc = tmz; tmz += tdz; cz += sz; }
    }
    return out;
  }

  // ---------- Fizika so'rovlari ----------
  rayCast(o, d, maxDist, out, ignore) {
    const ix = inv(d.x), iy = inv(d.y), iz = inv(d.z);
    let best = maxDist, hit = null, hullN = false;
    const bs = this.rayBoxes(o, d, maxDist);
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
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
  los(a, b, ignore, ignore2) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (L < 0.01) return true;
    const ix = inv(dx / L), iy = inv(dy / L), iz = inv(dz / L);
    const bs = this.rayBoxes(a, _ld.set(dx / L, dy / L, dz / L), L);
    for (let i = 0; i < bs.length; i++) {
      const bx = bs[i];
      if (bx === ignore || (ignore2 && bx === ignore2)) continue;
      if (rayAABB(a.x, a.y, a.z, ix, iy, iz, bx) < L - 0.05) {
        if (bx.vehicle && bx.vehicle.T.openHull && !(bx.vehicle.rayHull(a, _ld.set(dx / L, dy / L, dz / L), L) < L - 0.05)) continue;
        return false;
      }
    }
    return true;
  }

  pointInBox(p) {
    const bs = this.near(p.x, p.x, p.z, p.z);
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (!b.containsPoint(p)) continue;
      if (b.vehicle && b.vehicle.T.openHull && !b.vehicle.solidAt(p)) continue;   // ochiq kuzov ustidagi bo'sh joy
      return b;
    }
    return null;
  }

  groundHeight(x, z, r, feetY, ignore) {
    let g = this.baseHeight(x, z);
    const bs = this.near(x - r, x + r, z - r, z + r);
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
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
    const bs = this.near(x - r, x + r, z - r, z + r);
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (b === ignore || b.min.y < headY - 0.3 || b.min.y >= c) continue;
      const cx = x < b.min.x ? b.min.x : x > b.max.x ? b.max.x : x;
      const cz = z < b.min.z ? b.min.z : z > b.max.z ? b.max.z : z;
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r * 0.5) c = b.min.y;
    }
    return c;
  }

  collideCircle(pos, r, feetY, headY, ignore, lim = this.half) {
    const bs = this.near(pos.x - r - 1.5, pos.x + r + 1.5, pos.z - r - 1.5, pos.z + r + 1.5, true);   // (itarilish ko'pi bilan r ga suradi)
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
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
    // Katta xaritada oqim maydoni butun xaritaga emas, nishon atrofidagi 120 m ga hisoblanadi (2.5 mln katakni har 0.3 soniyada aylanib chiqish juda sekin).
    // Undan uzoqdagi bot nishonga to'g'ri chiziq bo'ylab yuradi va yaqinlashgach maydonga tushadi.
    this.flowLim = this.half > 200 ? 240 : 0; this.navTail = 0;
  }
  cellOf(x, z) {
    const N = this.navN, cx = Math.floor((x + this.half) / CELL), cz = Math.floor((z + this.half) / CELL);
    if (cx < 0 || cz < 0 || cx >= N || cz >= N) return -1;
    return cz * N + cx;
  }
  // more — qo'shimcha nishonlar [{x, z}, ...]: har bir katak ENG YAQIN nishongacha bo'lgan masofani oladi
  updateFlow(x, z, more) {
    const N = this.navN, dist = this.navDist, q = this.navQueue, bl = this.navBlocked, lim = this.flowLim;
    if (lim) { for (let i = 0; i < this.navTail; i++) dist[q[i]] = -1; this.navTail = 0; } else dist.fill(-1);   // (cheklangan maydonda faqat avval tegilgan kataklar tozalanadi)
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
    const bfs = () => {
      while (head < tail) {
        const c = q[head++], d = dist[c] + 1, cx = c % N;
        if (lim && d > lim) continue;
        if (cx > 0 && !bl[c - 1] && dist[c - 1] < 0) { dist[c - 1] = d; q[tail++] = c - 1; }
        if (cx < N - 1 && !bl[c + 1] && dist[c + 1] < 0) { dist[c + 1] = d; q[tail++] = c + 1; }
        if (c >= N && !bl[c - N] && dist[c - N] < 0) { dist[c - N] = d; q[tail++] = c - N; }
        if (c < N * (N - 1) && !bl[c + N] && dist[c + N] < 0) { dist[c + N] = d; q[tail++] = c + N; }
      }
    };
    bfs();
    // O'yinchi to'rda asosiy maydondan ajralgan kichik "orolcha"da turgan bo'lishi mumkin (yashik va devor orasidagi tor burchak:
    // odam sig'adi, lekin to'r katakchalari to'silgan). Unda botlar yo'l topa olmay, devorga tiralib qolardi —
    // bunday holda atrofdagi eng yaqin bo'sh katakchalar ham manba qilinadi.
    if (start >= 0 && !bl[start] && tail < 60) {
      const sx = start % N, sz = (start / N) | 0, t0 = tail;
      for (let r = 1; r <= 10 && tail === t0; r++) {
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          const nx = sx + dx, nz = sz + dz;
          if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
          const c = nz * N + nx;
          if (!bl[c] && dist[c] < 0) { dist[c] = r; q[tail++] = c; }
        }
      }
      bfs();
    }
    this.navTail = tail;
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
    this._fx = fx;
    this.touchGlass(camPos.x, camPos.y, camPos.z);   // derazadan oshib o'tayotgan o'yinchi (kamera oyna tekisligidan o'tadi) oynani sindiradi
    this.sky.position.copy(camPos);
    this.sky.material.uniforms.time.value = time; GU.uTime.value = time;
    if (this.sunNear) {
      // markaz kamera joyida; soya xaritasi piksellariga karrali qilib yaxlitlanadi
      const tx = this.nearTexel, u = Math.round(camPos.dot(this._lr) / tx) * tx, v = Math.round(camPos.dot(this._lu) / tx) * tx, w = camPos.dot(this.lightDir);
      const t = this.sunNear.target.position;
      t.set(0, 0, 0).addScaledVector(this._lr, u).addScaledVector(this._lu, v).addScaledVector(this.lightDir, w);
      this.sunNear.position.copy(t).addScaledVector(this.lightDir, 110);
      this.sunNear.target.updateMatrixWorld();
    }
    for (const L of this.lamps) {   // tungi chiroqlar: ba'zilari miltillaydi
      const k = L.flick ? (Math.sin(time * 23 + L.i) > 0.92 || Math.sin(time * 3.1 + L.i * 2) > 0.97 ? 0.25 : 1) : 1;
      GU.uLamps.value[L.i].w = L.r * k; L.glow.material.opacity = 0.85 * k; L.bulb.visible = k > 0.5;
    }
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
