// HUD: xabarlar, o'ldirishlar ro'yxati, mini xarita, kompas, har kadr yangilanish.
import * as THREE from '../lib/three.module.js';
import { WILD } from './shared.mjs';
import { $, G, STREAKS, TOTAL_WAVES, clamp, player } from './core.js';
import { cur, isGun } from './arsenal.js';
import { armorFrac } from './items.js';
import { drawZone } from './zone.js';

import { ownGunActive, updateVehHUD } from './transport.js';
import { esc, updateMpHUD } from './mp.js';
import { downedMates } from './revive.js';
import { CLASSES, NADE } from './weapons.js';

// ---------- HUD yordamchilari ----------
export function banner(title, sub, dur) {
  $('cmTitle').textContent = title; $('cmSub').textContent = sub;
  $('centerMsg').style.opacity = 1; G.bannerT = dur;
}
export function popup(text, hs = false) {
  const d = document.createElement('div');
  d.textContent = text; if (hs) d.className = 'hs';
  $('popups').appendChild(d);
  setTimeout(() => d.remove(), 1200);
}
export function feed(a, ac, b, bc, icon) {
  const d = document.createElement('div');
  d.className = 'kf';
  d.innerHTML = `<span class="${ac}">${esc(a)}</span><span class="ic">[${esc(icon)}]</span><span class="${bc}">${esc(b)}</span>`;
  $('killfeed').appendChild(d);
  while ($('killfeed').children.length > 6) $('killfeed').firstChild.remove();
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 500); }, 5000);
}
G.hmT = 0;
export function hitmarker(kill) {
  G.hmT = kill ? 0.3 : 0.15;
  const h = $('hitmarker'); h.classList.toggle('kill', !!kill); h.style.opacity = 1;
}
export function addDmgIndicator(from) {
  const el = document.createElement('div'); el.className = 'di';
  $('dmgInd').appendChild(el);
  G.dmgInds.push({ el, pos: from.clone(), t: 1.4 });
}
export function buildSlots() {
  const clsName = G.isZ ? '☣ Zombi' : G.zombie ? 'Tirik qolgan' : G.mp && G.mpMode === 'gg' ? 'Gun game' : G.mp && G.mpMode === 'br' ? 'Jang maydoni' : CLASSES[G.cls].name;   // (gun game va jang maydonida klass yo'q)
  $('weaponSlots').innerHTML = `<div class="cls">${clsName}</div>` + G.weapons.map((w, i) => G.isZ && w.locked ? '' :   // zombi-o'yinchida faqat panjalar ko'rsatiladi
    `<div class="${i === G.wi ? 'on' : ''}${w.def.kind === 'throw' && G.grenades_n <= 0 ? ' empty' : ''}">${i + 1} ${w.def.short || w.def.name}${w.def.kind === 'throw' ? ' ×' + G.grenades_n : ''}</div>`).join('');
}
export function updateStreakHUD() {
  const list = STREAKS[G.era];
  let html = G.streakReady.map((s) => `<div class="rdy">[B] ${s.name}</div>`).join('');
  const next = list.find((s) => s.k > G.streak);
  if (next) html += `<div class="prog">${next.name}: ${G.streak}/${next.k}</div>`;
  $('streaks').innerHTML = html;
}
export function relToPlayer(p) {
  const P = player;
  const rx = p.x - P.pos.x, rz = p.z - P.pos.z;
  const dist = Math.sqrt(rx * rx + rz * rz + (p.y - P.pos.y) ** 2);
  const right = rx * Math.cos(P.yaw) - rz * Math.sin(P.yaw);
  const fwd = -rx * Math.sin(P.yaw) - rz * Math.cos(P.yaw);
  return { dist, pan: dist > 0.1 ? right / Math.max(dist, 1) : 0, angle: Math.atan2(right, fwd) };
}

// ---------- Mini xarita va kompas ----------
export const mm = $('minimap').getContext('2d');
export const cp = $('compass').getContext('2d');
// Mini xarita (doira, o'yinchi atrofida aylanadi) va [M] bilan ochiladigan katta xarita (butun maydon, shimol tepada).
// Belgilar ekran pikselida o'lchanadi (px(n) — n piksel necha metr), shuning uchun har ikkala xaritada ham yaxshi ko'rinadi.
export const MM_S = 260, MM_SC = 1.6, BM_S = 820;
let bigT = 0;
// [M] — katta xaritani ochish/yopish
export function toggleBigMap(on) {
  G.bigMap = on === undefined ? !G.bigMap : !!on;
  $('bigmap').style.display = G.bigMap ? 'block' : 'none'; bigT = 0;
}
export const bm = $('bigmap').getContext('2d');
// Raqibni "ko'rib qolish": ko'z oldimizda, 80 m ichida va to'siqsiz turgan dushman xaritada belgilanadi (yo'qolgach yana 3 soniya ko'rinadi)
let spotT = 0;
export function updateSpotting(dt) {
  spotT -= dt;
  if (spotT > 0 || !G.world) return;
  spotT = 0.2;
  const cam = G.camPos, P = player, cpv = Math.cos(P.pitch), fx = -Math.sin(P.yaw) * cpv, fy = Math.sin(P.pitch), fz = -Math.cos(P.yaw) * cpv;
  for (const s of G.soldiers) {
    if (!s.alive || s.hidden || s.team === 'ally' || (G.hostile && !G.hostile(s))) continue;
    const e = s.eye(_sp), dx = e.x - cam.x, dy = e.y - cam.y, dz = e.z - cam.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    if (d < 80 && (dx * fx + dy * fy + dz * fz) / d > 0.6 && G.world.los(cam, e, P.vehBox)) s.seenAt = G.time;
  }
}
const _sp = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } };
// Tovush belgilari (PUBG uslubida): raqib o'q uzgan joy va yaqindagi qadamlar xaritada bir necha soniya ko'rinadi.
// Mini xaritaga sig'magan uzoqdagi otishma uning chetida yo'nalish belgisi bilan ko'rsatiladi.
G.noises = [];
export function addNoise(pos, kind) {
  const N = G.noises, now = G.time;
  // bir joydan ketma-ket kelgan tovushlar bitta belgiga birlashadi (avtomat navbati xaritani to'ldirib yubormasin)
  for (const n of N) if (n.kind === kind && now - n.t < 0.6 && Math.hypot(n.x - pos.x, n.z - pos.z) < 3) { n.t = now; n.x = pos.x; n.z = pos.z; return; }
  N.push({ x: pos.x, z: pos.z, t: now, kind });
  if (N.length > 40) N.shift();
}
G.noise = addNoise;
const NOISE_LIFE = { shot: 3.2, step: 1.8 };
export function drawMinimap() { renderMap(mm, MM_S, false); }
export function drawBigMap() { renderMap(bm, BM_S, true); }
function renderMap(ctx, S, full) {
  const P = player, W = G.world, hf = W.half, H = G.era === 'historical', sc = full ? (S - 24) / (hf * 2) : MM_SC, px = (n) => n / sc;
  const dot = (x, z, r, fill, ring) => { ctx.beginPath(); ctx.arc(x, z, px(r), 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); if (ring) { ctx.lineWidth = px(1.3); ctx.strokeStyle = ring; ctx.stroke(); } };
  const label = (x, z, text, color) => { if (!full) return; ctx.save(); ctx.translate(x, z); ctx.scale(1 / sc, 1 / sc); ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(text, 1, -9); ctx.fillStyle = color; ctx.fillText(text, 0, -10); ctx.restore(); };
  // dunyo nuqtasi → ekran pikseli (belgilarni ekran o'lchamida chizish va mini xarita chetiga "yopishtirish" uchun)
  const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), RIM = S / 2 - 13;
  const scr = (x, z) => {
    if (full) return [S / 2 + x * sc, S / 2 + z * sc, false];
    const dx = (x - P.pos.x) * sc, dz = (z - P.pos.z) * sc; let X = dx * cy - dz * sy, Y = dx * sy + dz * cy, edge = false;
    const d = Math.hypot(X, Y); if (d > RIM) { X *= RIM / d; Y *= RIM / d; edge = true; }
    return [S / 2 + X, S / 2 + Y, edge];
  };
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  if (!full) { ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); ctx.clip(); }
  ctx.fillStyle = H ? (full ? 'rgba(52,60,66,0.96)' : 'rgba(52,60,66,0.86)') : (full ? 'rgba(84,72,50,0.96)' : 'rgba(84,72,50,0.86)'); ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2); ctx.scale(sc, sc);
  if (!full) { ctx.rotate(P.yaw); ctx.translate(-P.pos.x, -P.pos.z); }
  // maydon, yo'llar, to'r
  ctx.fillStyle = H ? '#7c8a92' : '#a8946a'; ctx.fillRect(-hf, -hf, hf * 2, hf * 2);
  ctx.fillStyle = H ? '#59626a' : '#6f6654';
  if (W.roads) {   // karantin zonasi: yo'llar ro'yxat bo'yicha (asfalt — kulrang, tuproq — och jigarrang, temir yo'l — shtrix)
    ctx.lineCap = 'butt';
    for (const r of W.roads) { ctx.strokeStyle = r.k === 'a' ? (H ? '#59626a' : '#6f6654') : r.k === 'w' ? '#4c4f52' : r.k === 'c' ? (H ? '#878c90' : '#9a958a') : r.k === 'r' ? '#2e2a26' : (H ? '#8b9096' : '#bba57c'); ctx.lineWidth = Math.max(r.w, px(r.k === 'a' ? 2.2 : 1.4)); ctx.setLineDash(r.k === 'r' ? [px(5), px(3)] : []); ctx.beginPath(); ctx.moveTo(r.ax, r.az); ctx.lineTo(r.bx, r.bz); ctx.stroke(); }
    ctx.setLineDash([]);
  } else if (W.map === 'city') {   // yangi shahar: markazda xoch yo'l yo'q — piyodalar yo'lagi (och rang) va halqadan tashqaridagi chiqishlar
    for (const s of [-1, 1]) { ctx.fillRect(-4, s * 80 - 20, 8, 40); ctx.fillRect(s * 80 - 20, -4, 40, 8); }
    ctx.fillStyle = H ? '#8a9096' : '#b3ab98'; ctx.fillRect(-3, -56.5, 6, 113); ctx.fillRect(-56.5, -3, 113, 6); ctx.fillStyle = H ? '#59626a' : '#6f6654';
  } else { ctx.fillRect(-4, -hf, 8, hf * 2); ctx.fillRect(-hf, -4, hf * 2, 8); }
  const ring = W.map === 'city' ? 60 : 0;
  if (ring) for (const r of [-ring, ring]) { ctx.fillRect(r - 3.5, -hf, 7, hf * 2); ctx.fillRect(-hf, r - 3.5, hf * 2, 7); }
  const gstep = hf > 200 ? 100 : 20;
  if (full) { ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = px(1); ctx.beginPath(); for (let m = -hf + gstep; m < hf; m += gstep) { ctx.moveTo(m, -hf); ctx.lineTo(m, hf); ctx.moveTo(-hf, m); ctx.lineTo(hf, m); } ctx.stroke(); }
  // to'siqlar (devor, qum qoplari, yashik, konteyner ...)
  for (const r of W.mapRects) { ctx.fillStyle = r.c || (r.h > 2 ? (H ? '#3d4347' : '#4f4636') : (H ? '#4f565b' : '#665b46')); ctx.fillRect(r.x, r.z, r.w, r.d); }
  // binolar: to'liq shakl va kontur (podvalli uy — sariq hoshiya; ayvon/bostirma — yarim shaffof tom)
  for (const b of W.mapBlds) {
    const x = b.x - b.w / 2, z = b.z - b.d / 2;
    if (b.k === 'roof') { ctx.fillStyle = 'rgba(235,235,225,0.22)'; ctx.fillRect(x, z, b.w, b.d); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = px(1); ctx.strokeRect(x, z, b.w, b.d); continue; }
    ctx.fillStyle = b.k === 'bunker' ? '#55585a' : b.k === 'tower' ? '#8a6a3a' : b.k === 'ware' ? (H ? '#6e675f' : '#8d8674') : b.k === 'house2' ? (H ? '#8a4f40' : '#d9c8a0') : (H ? '#9c6a58' : '#c9b78e');
    ctx.fillRect(x, z, b.w, b.d);
    ctx.strokeStyle = b.k === 'base' ? '#ffd24a' : 'rgba(20,18,14,0.9)'; ctx.lineWidth = px(b.k === 'base' ? 1.6 : 1.2); ctx.strokeRect(x, z, b.w, b.d);
    if (b.k === 'house2') { ctx.strokeStyle = 'rgba(20,18,14,0.55)'; ctx.lineWidth = px(1); ctx.strokeRect(x + 1.2, z + 1.2, b.w - 2.4, b.d - 2.4); }   // ikki qavatli — ichki hoshiya
  }
  ctx.strokeStyle = '#ffc850'; ctx.lineWidth = px(1.5); ctx.strokeRect(-hf, -hf, hf * 2, hf * 2);
  if (full && W.pois) for (const p of W.pois) label(p.x, p.z - p.r * 0.5, p.name, 'rgba(255,255,255,0.85)');   // joy nomlari
  drawZone(ctx, px, hf);   // torayuvchi zona: xavfsiz doira va keyingisi
  if (G.supplyReady) { ctx.fillStyle = '#5f5'; ctx.fillRect(W.supplyPos.x - px(3.5), W.supplyPos.z - px(3.5), px(7), px(7)); ctx.strokeStyle = '#063'; ctx.lineWidth = px(1); ctx.strokeRect(W.supplyPos.x - px(3.5), W.supplyPos.z - px(3.5), px(7), px(7)); }
  if (G.zg) {
    // vazifa belgilari: joriy nishon (halqa va nom), qism qidiriladigan hududlar; ochilmagan qurol yashiklari
    const zg = G.zg, cur = zg.cur;
    const ringAt = (x, z, r, col, name) => { ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = px(2); ctx.setLineDash([px(5), px(3)]); ctx.beginPath(); ctx.arc(x, z, Math.max(r, px(7)), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(x, z, px(3), 0, Math.PI * 2); ctx.fill(); label(x, z + px(4), name, col); };
    if (!zg.done && !G.isZ) {
      if (cur.k === 'parts') WILD.parts.forEach((p, i) => { if (zg.got[i]) return; const q = WILD.poi.find((o) => o.id === p.poi); ringAt(q.x, q.z, q.r, '#7fd3ff', p.name); });
      else ringAt(cur.x, cur.z, cur.r, cur.k === 'hold' ? '#7dff9a' : '#ffcc55', cur.name);
    }
    if (zg.evac && !G.isZ) { const t = zg.target; ringAt(t.x, t.z, t.r, '#7dff9a', 'Vertolyot'); }   // evakuatsiya: bortga chiqish joyi
    // tiriltirish punktlari (ochilganlari — qizil xoch) va yerda yotgan sheriklar (miltillaydi)
    if (W.revivePts && !G.isZ) for (const R of W.revivePts) {
      if (zg.stage < R.from) continue;
      const a = px(4.2), b = px(1.5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(R.x - a - px(0.8), R.z - b - px(0.8), (a + px(0.8)) * 2, (b + px(0.8)) * 2); ctx.fillRect(R.x - b - px(0.8), R.z - a - px(0.8), (b + px(0.8)) * 2, (a + px(0.8)) * 2);
      ctx.fillStyle = '#e0242c'; ctx.fillRect(R.x - a, R.z - b, a * 2, b * 2); ctx.fillRect(R.x - b, R.z - a, b * 2, a * 2);
    }
    if (G.mp && !G.isZ) for (const r of downedMates()) { ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(G.time * 5)); dot(r.downPos.x, r.downPos.z, 3.4, '#7dff9a', '#063'); ctx.globalAlpha = 1; }
    if (!G.isZ) for (const c of W.crates) { if (c.open) continue; ctx.fillStyle = '#9dff7a'; ctx.fillRect(c.x - px(2.4), c.z - px(2.4), px(4.8), px(4.8)); }
  }
  for (const pk of G.pickups) { if (pk.taken || (G.zone && pk.def && pk.def.id === 'turret')) continue; ctx.fillStyle = '#c98bff'; ctx.fillRect(pk.pos.x - px(3.4), pk.pos.z - px(3.4), px(6.8), px(6.8)); ctx.strokeStyle = '#2a0a4a'; ctx.lineWidth = px(1); ctx.strokeRect(pk.pos.x - px(3.4), pk.pos.z - px(3.4), px(6.8), px(6.8)); }
  if (G.loot && !G.isZ) for (const l of G.loot) { if (l.taken) continue; ctx.fillStyle = '#bfefff'; ctx.fillRect(l.pos.x - px(2.2), l.pos.z - px(2.2), px(4.4), px(4.4)); ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = px(0.9); ctx.strokeRect(l.pos.x - px(2.2), l.pos.z - px(2.2), px(4.4), px(4.4)); }
  if (G.items && !G.isZ) for (const it of G.items) { if (it.taken) continue; dot(it.pos.x, it.pos.z, 2.6, it.kind === 'med' || it.kind === 'band' ? '#ff5b5b' : it.kind === 'armor' ? '#6ec4ff' : '#ffd24a', 'rgba(0,0,0,0.7)'); }
  for (const v of G.vehicles) {
    if (!v.alive) continue;
    const occ = v.seats.some((s) => s != null), foe = G.mp && occ && v !== G.inVeh && v.seats.some((id) => { const r = id != null && id !== G.myId && G.remoteById && G.remoteById(id); return r && G.hostile(r); });
    ctx.fillStyle = ctx.strokeStyle = v === G.inVeh ? '#7fd3ff' : foe ? '#ff4433' : G.mp && occ ? '#7fd3ff' : '#ffffff';
    if (v.type === 'heli') { ctx.fillRect(v.pos.x - 3.2, v.pos.z - 0.7, 6.4, 1.4); ctx.fillRect(v.pos.x - 0.7, v.pos.z - 3.2, 1.4, 6.4); }
    else if (v.type === 'chinook') { const sx = Math.sin(v.yaw) * 3, sz = Math.cos(v.yaw) * 3; for (const k of [-1, 1]) { ctx.fillRect(v.pos.x + sx * k - 2.6, v.pos.z + sz * k - 0.6, 5.2, 1.2); ctx.fillRect(v.pos.x + sx * k - 0.6, v.pos.z + sz * k - 2.6, 1.2, 5.2); } }
    else if (v.T.tank) {
      ctx.fillRect(v.pos.x - 2.3, v.pos.z - 2.3, 4.6, 4.6);
      ctx.lineWidth = Math.max(1.1, px(1.6)); ctx.beginPath(); ctx.moveTo(v.pos.x, v.pos.z); ctx.lineTo(v.pos.x + Math.sin(v.aimYaw) * 5.5, v.pos.z + Math.cos(v.aimYaw) * 5.5); ctx.stroke();
    }
    else if (v.type === 'truck') { ctx.save(); ctx.translate(v.pos.x, v.pos.z); ctx.rotate(-v.yaw); ctx.fillRect(-1.5, -4.4, 3, 8.2); ctx.restore(); }
    else if (v.T.car) { const h = v.type === 'quad' ? 1.1 : 1.7; ctx.fillRect(v.pos.x - h, v.pos.z - h, h * 2, h * 2); }
    else { ctx.lineWidth = Math.max(0.9, px(1.4)); ctx.beginPath(); ctx.arc(v.pos.x, v.pos.z, 1.8, 0, Math.PI * 2); ctx.stroke(); }
    if (full) label(v.pos.x, v.pos.z, v.T.name, ctx.fillStyle);
  }
  // odamlar: sheriklar — doim (ko'k/yashil); raqiblar — ko'rib qolinganda, razvedkada yoki bayroq bilan (qizil, yirik)
  for (const s of G.soldiers) {
    if (!s.alive || s.hidden) continue;
    if (G.zombie) {
      const zomb = !!(s.isZombie || s.isZ), far = Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z) > 24 && !((W.flashF || 0) > 0.05);
      if (G.isZ) { if (zomb) continue; dot(s.pos.x, s.pos.z, 3.8, '#7fd3ff', '#06324a'); }                 // zombi-o'yinchi odamlarni ko'radi
      else if (zomb) { if (far) continue; dot(s.pos.x, s.pos.z, 3.6, '#ff4433', '#3a0a05'); }             // odam: faqat yaqindagi zombilar (chaqmoqda — hammasi)
      else { dot(s.pos.x, s.pos.z, 3.8, '#7fd3ff', '#fff'); label(s.pos.x, s.pos.z, s.name, '#7fd3ff'); } // sheriklar
      continue;
    }
    if (s.team === 'ally') { dot(s.pos.x, s.pos.z, 3.4, '#7fe08a', '#0c2e10'); label(s.pos.x, s.pos.z, s.name, '#7fe08a'); }
    else if (G.mp && G.hostile && !G.hostile(s)) { dot(s.pos.x, s.pos.z, 4, '#7fd3ff', '#fff'); label(s.pos.x, s.pos.z, s.name, '#7fd3ff'); }   // jamoadosh
    else {
      const seen = G.time - (s.seenAt || -9) < 3, carrier = G.mp && G.mpMode === 'flag' && G.mpFlag.h === s.id;
      if (!(G.uavT > 0 || seen || carrier)) continue;   // o'q uzgan joyi alohida belgi bilan ko'rsatiladi (pastda)
      dot(s.pos.x, s.pos.z, 4.4, '#ff3b2a', '#fff');
    }
  }
  if (G.rdrones) for (const r of G.rdrones.values()) dot(r.pos.x, r.pos.z, 2.8, '#ffb02e', '#000');
  if (G.drone) dot(G.drone.pos.x, G.drone.pos.z, 3.2, '#ffffff', '#ffb02e');
  if (G.turrets) for (const t of G.turrets) { ctx.fillStyle = t.own ? '#7fd3ff' : '#ff8a5a'; ctx.fillRect(t.pos.x - px(2.6), t.pos.z - px(2.6), px(5.2), px(5.2)); if (t.own) { ctx.strokeStyle = 'rgba(127,211,255,0.25)'; ctx.lineWidth = px(1); ctx.beginPath(); ctx.arc(t.pos.x, t.pos.z, 55, 0, Math.PI * 2); ctx.stroke(); } }
  if (G.pings) for (const p of G.pings) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = px(1.8); ctx.beginPath(); ctx.arc(p.pos.x, p.pos.z, px(6 + Math.sin(G.time * 6) * 1.5), 0, Math.PI * 2); ctx.stroke(); }
  for (const g of G.grenades) dot(g.pos.x, g.pos.z, 2.6, g.team === 'enemy' ? '#ffaa00' : '#ffee88', '#000');
  // o'yinchi (katta xaritada — o'z joyida, qarash yo'nalishi bilan)
  if (full) {
    ctx.save(); ctx.translate(P.pos.x, P.pos.z); ctx.rotate(-P.yaw); ctx.scale(1 / sc, 1 / sc);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 70, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 8); ctx.lineTo(0, 3); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // ---- ekran o'lchamidagi belgilar: tovushlar va bayroq ----
  if (!full) { ctx.save(); ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); ctx.clip(); }
  for (let i = G.noises.length - 1; i >= 0; i--) {
    const n = G.noises[i], life = NOISE_LIFE[n.kind] || 2, age = G.time - n.t;
    if (age > life || age < 0) { G.noises.splice(i, 1); continue; }
    const [X, Y, edge] = scr(n.x, n.z), a = Math.min(1, (1 - age / life) * 1.6);
    ctx.globalAlpha = a;
    if (n.kind === 'shot') {
      if (edge) {   // uzoqdagi otishma: mini xarita chetida yo'nalish uchburchagi
        const ang = Math.atan2(Y - S / 2, X - S / 2);
        ctx.save(); ctx.translate(X, Y); ctx.rotate(ang); ctx.fillStyle = '#ff3b2a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -7); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      } else {     // o'q uzilgan joy: qizil chaqnash belgisi va kengayuvchi halqa
        ctx.strokeStyle = '#ff3b2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, 5 + age * 5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ff3b2a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.3; ctx.beginPath();
        for (let k = 0; k < 8; k++) { const r = k % 2 ? 2.6 : 6.5, an = k * Math.PI / 4; ctx.lineTo(X + Math.cos(an) * r, Y + Math.sin(an) * r); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else if (!edge) {   // qadam: ikkita oyoq izi
      ctx.fillStyle = '#ffb02e'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 1;
      for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(X + k * 2.6, Y + k * 1.6, 2.1, 3.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  // bayroq: doim ko'rinadi (kimda bo'lsa — o'sha bilan birga yuradi); mini xaritaga sig'masa — chetida
  if (G.mp && G.mpMode === 'flag' && G.mpFlag) {
    const f = G.mpFlag, mine = f.h === G.myId, hr = f.h && !mine && G.remoteById ? G.remoteById(f.h) : null;
    const fx = mine ? P.pos.x : hr ? hr.pos.x : f.x, fz = mine ? P.pos.z : hr ? hr.pos.z : f.z, [X, Y, edge] = scr(fx, fz);
    if (!mine) {
      ctx.fillStyle = '#ffcc33'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
      ctx.fillRect(X - 1, Y - 13, 2, 14); ctx.beginPath(); ctx.moveTo(X + 1, Y - 13); ctx.lineTo(X + 11, Y - 9.5); ctx.lineTo(X + 1, Y - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = f.h ? '#ff3b2a' : '#ffcc33'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, 7 + Math.sin(G.time * 5) * 1.5, 0, Math.PI * 2); ctx.stroke();
      if (edge) { ctx.fillStyle = '#ffcc33'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.fillText(Math.round(Math.hypot(fx - P.pos.x, fz - P.pos.z)) + ' m', X, Y + 16); }
    }
  }
  if (!full) ctx.restore();
  if (!full) {
    ctx.save(); ctx.translate(S / 2, S / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, S * 0.45, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7.5, 8); ctx.lineTo(0, 3.5); ctx.lineTo(-7.5, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    // shimol belgisi (xarita o'yinchi bilan birga aylanadi)
    const nx = Math.sin(P.yaw) * (S / 2 - 11), ny = -Math.cos(P.yaw) * (S / 2 - 11);
    ctx.fillStyle = '#ffcc55'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', nx, ny);   // (xarita ctx.rotate(yaw) bilan aylanadi: shimol ekranda (sin, −cos) tomonda)
    ctx.restore();
  } else {
    ctx.fillStyle = '#ffcc55'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('XARITA  ·  [M] — yopish', 14, 22);
    ctx.fillStyle = '#eee'; ctx.font = '12px Arial';
    ctx.fillText("oq uchburchak — siz  ·  ko'k — sheriklar  ·  qizil nuqta — ko'ringan raqib  ·  qizil yulduz — o'q uzilgan joy  ·  sariq izlar — qadam", 14, S - 44);
    ctx.fillText("sariq hoshiyali uy — podval  ·  binafsha kvadrat — noyob qurol  ·  och ko'k kvadrat — xonadagi qurol", 14, S - 28);
    ctx.fillText("nuqtalar — vositalar: qizil — davolash, ko'k — zirh, sariq — o'q-dori", 14, S - 12);
  }
  if (G.uavT > 0) { ctx.fillStyle = '#ff6655'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('RAZVEDKA ' + Math.ceil(G.uavT), S / 2, full ? 22 : S - 14); }
}
export function drawCompass() {
  const ctx = cp, W = 480, Hh = 34;
  ctx.clearRect(0, 0, W, Hh);
  const grd = ctx.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.2, 'rgba(0,0,0,0.35)'); grd.addColorStop(0.8, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, Hh);
  const h = ((-player.yaw * 180) / Math.PI % 360 + 360) % 360;
  const ppd = W / 180;
  ctx.textAlign = 'center'; ctx.font = 'bold 13px Arial';
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let a = 0; a < 360; a += 15) {
    let d = a - h; while (d > 180) d -= 360; while (d < -180) d += 360;
    if (Math.abs(d) > 88) continue;
    const x = W / 2 + d * ppd, al = 1 - Math.abs(d) / 90;
    ctx.globalAlpha = al;
    ctx.fillStyle = labels[a] && a % 90 === 0 ? '#ffcc55' : '#fff';
    if (labels[a]) ctx.fillText(labels[a], x, 22);
    else { ctx.fillRect(x - 0.5, 14, 1, 8); }
  }
  ctx.globalAlpha = 1;
  if (G.mp && G.flag && G.flag.g.visible) {
    const d = (relToPlayer(G.flag.g.position).angle * 180) / Math.PI;
    if (Math.abs(d) < 88) { ctx.fillStyle = '#ffcc33'; ctx.font = 'bold 16px Arial'; ctx.fillText('⚑', W / 2 + d * ppd, 16); }
  }
  if (G.zg && !G.isZ) {   // zombi rejimi: keyingi punkt yo'nalishi
    const tp = G.zg.target, d = (relToPlayer(new THREE.Vector3(tp.x, player.pos.y, tp.z)).angle * 180) / Math.PI;
    ctx.fillStyle = tp.id === 'P' ? '#7fd3ff' : G.zg.cur.k === 'hold' ? '#7dff9a' : '#ffcc55'; ctx.font = 'bold 15px Arial';
    ctx.fillText(tp.id === 'P' ? '◆' : tp.id, W / 2 + clamp(d, -86, 86) * ppd, 16);
  }
  ctx.fillStyle = '#ffcc55'; ctx.beginPath(); ctx.moveTo(W / 2 - 5, 0); ctx.lineTo(W / 2 + 5, 0); ctx.lineTo(W / 2, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.fillText(Math.round(h) + '°', W / 2, 33);
}

// ---------- HUD ----------
export const hudCache = {};
// Jang tugaganda yoki menyuga chiqilganda to'liq ekranli pardalar (zarba qizili, chaqnash, mo'ljal qorayishi) o'chiriladi —
// aks holda ular yakun oynasi va menyu ustida qolib ketardi (ularni faqat jang paytidagi kadrlar yangilaydi).
export function clearOverlays() {
  const f = () => { for (const id of ['hurt', 'flashbang', 'adsVig']) { const el = $(id); if (el) el.style.opacity = 0; } hudCache.adsVig = 0; G.flashA = 0; G.hurtPulse = 0; };
  f();
  // (jang shu kadrning o'rtasida tugaydi — kadrning qolgan qismida HUD pardani yana yozib qo'yadi; keyingi kadrda yana tozalanadi)
  requestAnimationFrame(() => { if (G.state !== 'playing') f(); });
}
export function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
export function updateHUD(dt) {
  const P = player, W = cur();
  updateVehHUD();
  setText('healthNum', Math.ceil(P.hp));
  setText('stance', G.inVeh || !P.alive ? '' : G.vault ? "OSHIB O'TISH" : P.prone ? 'YOTGAN [Z]' : P.crouch ? "CHO'KKALAGAN [C]" : '');
  $('healthFill').style.width = P.hp + '%';
  { const low = P.hp < 35; if (hudCache.hpLow !== low) { hudCache.hpLow = low; $('healthBox').classList.toggle('low', low); } }   // jon kam qolganda chiziq qizaradi
  const gun = isGun(W), kind = W.def.kind;
  setText('weaponName', W.def.name);
  setText('mag', gun ? W.mag : kind === 'throw' ? '×' + G.grenades_n : '—'); setText('reserve', gun ? (W.inf ? '/ ∞' : '/ ' + W.reserve) : '');
  $('mag').classList.toggle('low', gun ? W.mag <= Math.ceil(W.def.mag * 0.25) : kind === 'throw' && G.grenades_n <= 0);
  setText('grenades', G.isZ ? '' : `[G] GRANATA ×${G.grenades_n}`);
  setText('meds', G.isZ ? '' : `[H] BINT ×${G.bandages || 0}` + (G.adrT > 0 ? ` · ⚡ ${Math.ceil(G.adrT)} s` : '') + (G.helm > 0 ? ` · ⛑ SHLEM ${G.helm}` : '') + (G.defib > 0 ? ' · ♥ DEFIBRILLYATOR' : ''));
  { const af = armorFrac(); if (hudCache.armor !== af) { hudCache.armor = af; $('armorBar').style.display = af > 0 ? 'block' : 'none'; $('armorFill').style.width = Math.round(af * 100) + '%'; } }
  // qo'ldagi qurolning tugmalari doim ekranda
  setText('weaponHint', G.inVeh && !ownGunActive() ? '' : W.def.id === 'claw' ? "Chap tugma — panja urish · O'ng tugma — tishlash · Shift — yugurish" : kind === 'melee' ? "Chap tugma — kesish · O'ng tugma — sanchish"
    : kind === 'throw' ? "Chap tugma — uloqtirish (bosib tursangiz ushlab turiladi) · O'ng tugma — yaqinga"
    : W.def.lockon ? "Ko'rib turgan transportingizga nishonni qarating — bir soniyada belgilanadi va raketa faqat uni quvadi · belgisiz otilsa to'g'ri uchadi"
    : W.def.deploy === 'turret' ? "Chap tugma — turelni o'rnatish: 55 m ichida o'zi otadi, ko'rgan raqibini xaritada belgilaydi, dronni urib tushiradi (75 s; uni otib yo'q qilsa bo'ladi)"
    : W.def.deploy === 'drone' ? "Chap tugma — dronni uchirish: o'zingiz boshqarasiz, 1 ta bomba tashlaydi, nishonga borib urilsa portlaydi; bitta o'q tegsa yo'q bo'ladi"
    : W.def.scope ? "O'ng tugma — optika · Shift — nafasni ushlash · R — o'qlash" : "O'ng tugma — mo'ljalga olish · R — o'qlash · V — pichoq zarbasi");
  if (hudCache.slotN !== G.grenades_n) { hudCache.slotN = G.grenades_n; buildSlots(); }
  if (G.mp) updateMpHUD(dt);
  else if (G.zg) zombieHUD();
  else {
  const alive = G.soldiers.filter((s) => s.alive && s.team === 'enemy').length;
  setText('waveLabel', `TO'LQIN ${Math.max(1, G.wave)}/${TOTAL_WAVES}`);
  setText('enemyLabel', G.waveState === 'fight' ? `Dushmanlar: ${alive + G.toSpawn}` : 'Tanaffus');
  setText('scoreLabel', G.score.toLocaleString('ru-RU'));
  setText('objective', (G.waveState === 'intermission'
    ? `Keyingi to'lqin: ${Math.ceil(G.waveTimer)} s${G.supplyReady ? " · O'q-dori qutisi markazda [E]" : ''}`
    : G.wave === TOTAL_WAVES ? "So'nggi to'lqin — maydonni ushlab turing!" : 'Dushman hujumini qaytaring'));
  }
  let hint = '';
  if ((G.inVeh && !ownGunActive()) || G.droneCtl) hint = '';   // transportda yoki dron boshqarilayotganda qurol eslatmasi kerak emas
  else if (G.healT > 0) hint = `BINT BOG'LANMOQDA — ${G.healT.toFixed(1)} s`;
  else if (G.cookT >= 0) hint = `HALQA SUG'URILDI — ${Math.max(0, NADE.fuse - G.cookT).toFixed(1)} s`;
  else if (!gun) hint = '';
  else if (G.reloadT > 0) hint = "QAYTA O'QLANMOQDA...";
  else if (W.mag === 0 && W.reserve === 0) hint = "O'Q-DORI YO'Q";
  else if (W.mag < W.def.mag && W.mag <= Math.floor(W.def.mag * 0.25) && W.reserve > 0) hint = "[R] QAYTA O'QLASH";
  setText('reloadHint', hint);
  // shikastlanish effektlari
  G.hurtPulse = Math.max(0, G.hurtPulse - dt * 1.4);
  $('hurt').style.opacity = Math.max(G.hurtPulse, (1 - P.hp / 100) * 0.9);
  G.flashA = Math.max(0, (G.flashA || 0) - dt * 1.2);
  $('flashbang').style.opacity = G.flashA;
  if (G.bannerT > 0) { G.bannerT -= dt; if (G.bannerT <= 0) $('centerMsg').style.opacity = 0; }
  // zarar ko'rsatkichlari
  for (let i = G.dmgInds.length - 1; i >= 0; i--) {
    const d = G.dmgInds[i];
    d.t -= dt;
    if (d.t <= 0) { d.el.remove(); G.dmgInds.splice(i, 1); continue; }
    d.el.style.transform = `rotate(${relToPlayer(d.pos).angle}rad)`;
    d.el.style.opacity = Math.min(1, d.t);
  }
  // granata ogohlantirishi
  let near = null, nd = 8;
  for (const g of G.grenades) { if (g.team === 'player') continue; const dd = g.pos.distanceTo(P.pos); if (dd < nd) { nd = dd; near = g; } }
  const gi = $('grenadeInd');
  if (near) {
    const a = relToPlayer(near.pos).angle;
    gi.style.display = 'block';
    gi.style.transform = `translate(${Math.sin(a) * 110}px, ${-Math.cos(a) * 110}px)`;
  } else gi.style.display = 'none';
  updateSpotting(dt);
  drawMinimap(); drawCompass();
  // katta xarita [M]: sekundiga ~12 marta yangilanadi
  if (G.bigMap) { bigT -= dt; if (bigT <= 0) { bigT = 0.08; drawBigMap(); } }
}

// Zombi rejimi (yakka o'yin): qaysi punktga borish kerakligi, masofa, evakuatsiya sanog'i
export function zombieHUD() {
  const z = G.zg, tp = z.target, P = player;
  const d = Math.round(Math.hypot(tp.x - P.pos.x, tp.z - P.pos.z));
  setText('waveLabel', 'ZOMBI REJIMI');
  setText('enemyLabel', `Bosqich ${Math.min(z.stage + 1, z.stages.length)}/${z.stages.length} · imkoniyat: ${z.lives}`);
  setText('scoreLabel', `☠ ${G.kills}`);
  setText('objective', zObjective(d));
}
export function zObjective(d) {
  return G.zg.objective(d) + (G.torchOn || G.zg.dark < 0.5 ? '' : ' · [L] fonar');
}
