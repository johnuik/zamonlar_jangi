// Torayuvchi zona (PUBG uslubida, tarmoq rejimlari): xavfsiz doira bosqichma-bosqich kichrayadi, tashqarida qolgan o'yinchi jon yo'qotadi.
// Hisob serverda (server.js: tickZone); bu yerda — ko'rinishi (ko'k devor, yerdagi oq halqa — keyingi doira), ekrandagi xabar,
// xaritadagi doiralar va zona ichida qayta tug'ilish joyini tanlash.
import * as THREE from '../lib/three.module.js';
import { $, G, player, sound } from './core.js';
import { banner, setText } from './hud.js';

let wall = null, ring = null, wallTex = null;
function build() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(70,150,255,0)'); gr.addColorStop(0.55, 'rgba(70,150,255,0.5)'); gr.addColorStop(1, 'rgba(120,190,255,0.95)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  g.fillStyle = 'rgba(200,230,255,0.55)'; g.fillRect(0, 0, 3, 256); for (let y = 16; y < 256; y += 40) g.fillRect(0, y, 64, 2);   // to'r chiziqlari
  wallTex = new THREE.CanvasTexture(c); wallTex.wrapS = THREE.RepeatWrapping; wallTex.colorSpace = THREE.SRGBColorSpace;
  wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 128, 1, true),
    new THREE.MeshBasicMaterial({ map: wallTex, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  wall.frustumCulled = false; wall.renderOrder = 6;
  ring = new THREE.Mesh(new THREE.RingGeometry(0.992, 1, 160), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  ring.rotation.x = -Math.PI / 2; ring.frustumCulled = false;
}
export function clearZone() {
  G.zone = null; G.zoneOut = false;
  if (wall && wall.parent) wall.parent.remove(wall);
  if (ring && ring.parent) ring.parent.remove(ring);
  const el = $('zoneInfo'); if (el) { el.style.display = 'none'; $('zoneTint').style.opacity = 0; }
}
// Serverdan kelgan holat: [x, z, r, keyingi x, z, r, vaqt (s), toraymoqdami, zarar/s, yana torayadimi]
export function onZoneState(zn) {
  if (!Array.isArray(zn) || zn.length < 9) { if (G.zone) clearZone(); return; }
  const z = G.zone || (G.zone = { x: zn[0], z: zn[1], r: zn[2] });
  z.sx = zn[0]; z.sz = zn[1]; z.sr = zn[2]; z.tx = zn[3]; z.tz = zn[4]; z.tr = zn[5]; z.t = zn[6]; z.sh = !!zn[7]; z.dmg = zn[8]; z.more = !!zn[9];
}
export function onZoneEvent(o) {
  if (o.ev === 'shrink') { banner('ZONA TORAYMOQDA', "Oq halqa ichiga kiring — ko'k devor ortida jon ketadi", 3.2); sound.alarm(); }
}
// Nuqta zona ichidami (zona yo'q bo'lsa — ha)
export const inZone = (x, z, m = 0) => !G.zone || Math.hypot(x - G.zone.x, z - G.zone.z) <= G.zone.r - m;
// Nuqta XAVFSIZ joydami: hozirgi doira ichida (serverdagi aniq qiymat bo'yicha ham) va — zona yana torayadigan bo'lsa — keyingi (oq) doira ichida ham.
// Qayta tug'ilish shu bo'yicha tanlanadi: aks holda toraya turgan doira chetida paydo bo'lgan o'yinchi bir necha soniyada tashqarida qolardi.
export function inSafe(x, z, m = 0) {
  const Z = G.zone;
  if (!Z) return true;
  if (Math.hypot(x - Z.x, z - Z.z) > Z.r - m || Math.hypot(x - Z.sx, z - Z.sz) > Z.sr - m) return false;
  return !(Z.more || Z.sh) || Math.hypot(x - Z.tx, z - Z.tz) <= Z.tr - m;
}
// Xavfsiz doira ichidan qayta tug'ilish joyi: bo'sh va raqiblardan uzoqroq nuqta (topilmasa — doira markazi yaqinidagi bo'sh joy)
const _zp = new THREE.Vector3();
export function zoneSpawn(others) {
  const z = G.zone, W = G.world, next = z.more || z.sh;
  const cx = next ? z.tx : z.sx, cz = next ? z.tz : z.sz, R = Math.max(3, (next ? z.tr : z.sr) - 5);
  let best = null, bs = -1;
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R, x = cx + Math.cos(a) * d, zz = cz + Math.sin(a) * d;
    if (Math.abs(x) > W.half - 3 || Math.abs(zz) > W.half - 3 || !inSafe(x, zz, 3) || !W.freeSpot(x, zz, 0.9) || W.pitIndexXZ(x, zz) >= 0) continue;
    let md = 999; for (const r of others) md = Math.min(md, Math.hypot(r.pos.x - x, r.pos.z - zz));
    const sc = Math.min(md, 60) + Math.random() * 10;
    if (sc > bs) { bs = sc; best = new THREE.Vector3(x, 0, zz); }
  }
  if (best) return best;
  // tayyor bo'sh joy topilmadi (doira juda kichik yoki markazi yo'l ustida): markazdan aylana bo'ylab birinchi to'siqsiz nuqta
  for (let r = 0; r <= R; r += 1.5) for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, x = cx + Math.cos(a) * r, zz = cz + Math.sin(a) * r;
    if (Math.abs(x) < W.half - 3 && Math.abs(zz) < W.half - 3 && !W.pointInBox(_zp.set(x, 1, zz)) && W.pitIndexXZ(x, zz) < 0) return new THREE.Vector3(x, 0, zz);
  }
  return new THREE.Vector3(cx, 0, cz);
}

export function updateZone(dt) {
  const z = G.zone, el = $('zoneInfo');
  if (!z || !G.mp || !G.scene) { if (wall && wall.parent) clearZone(); return; }
  if (!wall) build();
  if (wall.parent !== G.scene) { G.scene.add(wall); G.scene.add(ring); }
  // server holatiga silliq yaqinlashish
  const k = Math.min(1, dt * 8);
  z.x += (z.sx - z.x) * k; z.z += (z.sz - z.z) * k; z.r += (z.sr - z.r) * k;
  wall.position.set(z.x, 45, z.z); wall.scale.set(z.r, 90, z.r);
  wallTex.repeat.set(Math.max(8, Math.round((z.r * 6.283) / 5)), 1); wallTex.offset.y = 0;
  ring.visible = z.more || z.sh; ring.position.set(z.tx, 0.09, z.tz); ring.scale.set(z.tr, z.tr, 1);
  const P = player, d = Math.hypot(P.pos.x - z.x, P.pos.z - z.z), out = d > z.r && P.alive;
  wall.material.opacity = out ? 0.75 : 0.32 + 0.3 * Math.max(0, 1 - (z.r - d) / 30);   // devorga yaqinlashganda quyuqroq
  G.zoneOut = out;
  if (el.style.display !== 'block') el.style.display = 'block';
  const mm = Math.floor(z.t / 60), ss = String(Math.floor(z.t % 60)).padStart(2, '0');
  setText('zoneInfo', out ? `ZONADAN TASHQARIDASIZ! −${z.dmg || 0} jon/s · xavfsiz joygacha ${Math.ceil(d - z.r)} m`
    : z.sh ? `ZONA TORAYMOQDA — ${z.t} s` : z.more ? `Zona ${mm}:${ss} dan keyin torayadi · chetigacha ${Math.max(0, Math.floor(z.r - d))} m` : `Oxirgi doira · chetigacha ${Math.max(0, Math.floor(z.r - d))} m`);
  const cls = out ? 'out' : z.sh ? 'sh' : '';
  if (el.className !== cls) el.className = cls;
  $('zoneTint').style.opacity = out ? 0.55 + Math.sin(G.time * 5) * 0.15 : 0;
}
// Xaritada: xavfsiz doira (ko'k), tashqarisi xiralashgan, keyingi doira (oq)
export function drawZone(ctx, px, hf) {
  const z = G.zone;
  if (!z) return;
  ctx.save();
  ctx.fillStyle = 'rgba(40,110,255,0.28)'; ctx.beginPath(); ctx.rect(-hf - 60, -hf - 60, hf * 2 + 120, hf * 2 + 120); ctx.arc(z.x, z.z, z.r, 0, Math.PI * 2, true); ctx.fill('evenodd');
  ctx.strokeStyle = '#4aa8ff'; ctx.lineWidth = px(2.6); ctx.beginPath(); ctx.arc(z.x, z.z, z.r, 0, Math.PI * 2); ctx.stroke();
  if (z.more || z.sh) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = px(1.8); ctx.setLineDash([px(6), px(4)]); ctx.beginPath(); ctx.arc(z.tx, z.tz, z.tr, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
