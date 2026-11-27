// Yangi tarmoq rejimlari (mijoz tomoni): jang maydoni — PUBG uslubi (br) va gun game — arena (gg).
// Hisob-kitob serverda (server.js): qurol darajalari, qayta tug'ilmaslik, o'lja egasi, shlem va g'olib o'sha yerda aniqlanadi.
import { G, camera, player, sound } from './core.js';
import { banner, buildSlots, popup, setText } from './hud.js';
import { BR_DROP_H, GG_LADDER } from './shared.mjs';
import { WEAPONS } from './weapons.js';
import { isGun } from './arsenal.js';
import { groundBelow, tryChute } from './movement.js';
import { applyLoadout } from './menu.js';
import { esc, nameOf, remotes } from './mp.js';

export const isBR = () => !!G.mp && G.mpMode === 'br';
export const isGG = () => !!G.mp && G.mpMode === 'gg';
const mmss = (t) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
const TEAM = ['', 'QIZIL', "KO'K"];

// ================= GUN GAME =================
export const ggName = (lv) => { const id = GG_LADDER[Math.max(0, Math.min(GG_LADDER.length - 1, lv))]; return id === 'knife' ? 'Pichoq' : (WEAPONS[G.era][id] || {}).name || id; };
// Daraja quroli: o'q-dori cheksiz; granata va bint yo'q (faqat qurol yoki pichoq bilan o'ldirish darajani oshiradi)
export function ggAmmo() {
  for (const w of G.weapons) if (isGun(w) && !w.locked) { w.mag = w.def.mag; w.inf = true; }
  G.grenades_n = 0; G.bandages = 0;
  buildSlots();
}
export function ggSet(lv, say) {
  G.ggLv = lv;
  applyLoadout(); ggAmmo();
  const N = GG_LADDER.length;
  if (say === 'up') { banner(`${lv + 1}/${N}: ${ggName(lv).toUpperCase()}`, lv >= N - 1 ? "Oxirgi daraja — PICHOQ bilan o'ldirsangiz g'olibsiz!" : `Keyingi qurol: ${ggName(lv + 1)}`, 2.6); sound.ping(); }
  else if (say === 'down') popup(`Pichoq yedingiz — bir daraja pastga: ${ggName(lv)}`, true);
}
// server: kimningdir darajasi o'zgardi
export function onGG(o) {
  if (o.id === G.myId) ggSet(o.lv, o.down ? 'down' : 'up');
  else if (o.lv >= GG_LADDER.length - 1 && !o.down) { popup(`${nameOf(o.id)} oxirgi darajada — pichoq bilan!`, true); sound.horn(); }
}

// ================= JANG MAYDONI =================
export function brInit() {
  G.helm = 0; G.brAtt = new Set(); G.brOut = false; G.spec = 0; G.brDropping = false; G.brPlace = 0;
  G.grenades_n = 0; G.bandages = 0; G.armor = 0;
  buildSlots();
}
// Tushish: har kim xaritaning tasodifiy joyi ustida, balandda paydo bo'ladi; [PROBEL] — parashyut (60 m da o'zi ochiladi), W/A/S/D — boshqarish
export function brDrop() {
  const P = player, hf = G.world.half, a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * hf * 0.7;
  P.pos.set(Math.cos(a) * d, BR_DROP_H, Math.sin(a) * d); P.vel.set(0, 0, 0); P.onGround = false;
  P.yaw = Math.atan2(P.pos.x, P.pos.z); P.pitch = -0.7; G.chute = false; G.brDropping = true;
}
const specList = () => [...remotes.values()].filter((r) => r.alive && r.hasPos).sort((a, b) => (G.teams && a.tm === G.myTeam ? 0 : 1) - (G.teams && b.tm === G.myTeam ? 0 : 1) || a.id - b.id);
export function nextSpec() {
  const l = specList();
  if (!l.length) { G.spec = 0; return; }
  const i = l.findIndex((r) => r.id === G.spec);
  G.spec = l[(i + 1) % l.length].id;
}
// O'yinchi halok bo'ldi: qayta tug'ilish yo'q — kuzatuvchi bo'lib qoladi
export function brOut(killer, why) {
  const alive = G.mpPlayers.filter((p) => p.al && !p.o && p.id !== G.myId).length;
  G.brOut = true; G.brDropping = false; G.brPlace = alive + 1;
  if (why !== undefined) banner(`${G.brPlace}-O'RIN`, `${why} · kuzatuv rejimi: [PROBEL] — keyingi o'yinchi`, 4.5);
  G.spec = killer && remotes.get(killer) ? killer : 0;
  if (!G.spec) nextSpec();
}
// har kadr (mp.js: mpUpdate)
export function modeUpdate() {
  if (!isBR()) return;
  const P = player;
  if (G.brDropping) {
    if (P.onGround || !P.alive) G.brDropping = false;
    else if (!G.chute && P.vel.y < -3 && P.pos.y - groundBelow() < 60) tryChute();   // ochilmagan parashyut pastda o'zi ochiladi
  }
}
// Kuzatuv kamerasi: tirik o'yinchining orqasidan (movement.js: updateCamera dan keyin chaqiriladi)
export function specCamera() {
  if (!isBR() || !G.brOut || G.state !== 'playing') return;
  let r = G.spec ? remotes.get(G.spec) : null;
  if (!r || !r.alive || !r.hasPos) { nextSpec(); r = G.spec ? remotes.get(G.spec) : null; if (!r) return; }
  const yaw = r.netYaw || 0;
  camera.position.set(r.pos.x + Math.sin(yaw) * 3.6, r.pos.y + 2.7, r.pos.z + Math.cos(yaw) * 3.6);
  camera.lookAt(r.pos.x, r.pos.y + 1.5, r.pos.z);
}
addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat && isBR() && G.brOut && G.state === 'playing') nextSpec(); });

// ================= HUD =================
let boardT = 0;
// Qaytaradi: shu rejim HUDni o'zi chizdimi
export function modeHUD(dt, $) {
  if (!isBR() && !isGG()) return false;
  const me = G.mpPlayers.find((p) => p.id === G.myId), tl = Math.max(0, G.mpTL || 0), name = (p) => esc(p.id === G.myId ? (G.myName || 'Siz') : nameOf(p.id));
  const cls = (p) => (p.id === G.myId ? 'me' : G.teams && p.tm === G.myTeam ? 'mate' : G.teams ? 'foe' : '');
  boardT -= dt;
  if (isGG()) {
    const N = GG_LADDER.length, lv = G.ggLv | 0, top = G.mpPlayers.slice().sort((a, b) => (b.g || 0) - (a.g || 0) || b.k - a.k)[0];
    setText('waveLabel', 'GUN GAME'); setText('enemyLabel', `Vaqt: ${mmss(tl)}`); setText('scoreLabel', `${lv + 1}/${N}`);
    setText('objective', !player.alive ? "Qayta tug'ilishni kuting..." : lv >= N - 1 ? "Oxirgi daraja: PICHOQ bilan o'ldiring — g'alaba sizniki!" : `Har o'ldirish — keyingi qurol. Hozir: ${ggName(lv)} → keyin: ${ggName(lv + 1)}. Pichoq bilan o'ldirilgan raqib bir daraja pasayadi.`);
    setText('flagStatus', `🔫 ${lv + 1}/${N} · ${ggName(lv).toUpperCase()}` + (top && top.id !== G.myId && (top.g || 0) > 0 ? ` · YETAKCHI: ${nameOf(top.id).toUpperCase()} — ${(top.g || 0) + 1}/${N}` : ''));
    $('flagStatus').className = top && top.id === G.myId && lv > 0 ? 'mine' : '';
    if (boardT <= 0) {
      boardT = 0.25;
      const rows = G.mpPlayers.slice().sort((a, b) => (b.g || 0) - (a.g || 0) || b.k - a.k);
      $('mpBoard').innerHTML = rows.map((p) => `<div class="${cls(p)}"><span>${name(p)}</span><span class="hold">${(p.g || 0) + 1}/${N}</span><span>${p.k}/${p.d}</span></div>`).join('');
    }
    return true;
  }
  const alive = G.mpPlayers.filter((p) => p.al && !p.o).length, armed = G.weapons.some((w) => isGun(w) && !w.locked), sp = G.spec ? remotes.get(G.spec) : null;
  setText('waveLabel', 'JANG MAYDONI'); setText('enemyLabel', `Tirik: ${alive}`); setText('scoreLabel', `${me ? me.k : 0} ☠`);
  setText('objective', G.brOut ? (sp ? `Kuzatuv: ${sp.name} · [PROBEL] — keyingi o'yinchi` : 'Kuzatuv rejimi') : G.brDropping ? (G.chute ? "Parashyut ochiq: W/A/S/D bilan qo'nadigan joyni tanlang" : '[PROBEL] — parashyutni ochish (pastda o\'zi ochiladi)')
    : !armed ? "Qurolsizsiz: uylardan qurol [E], o'q, shlem, zirh va qo'shimchalarni toping" : "Zona ichida qoling. Oxirgi tirik qolgan g'olib — qayta tug'ilish yo'q!");
  setText('flagStatus', `🪂 TIRIK: ${alive}` + (G.brOut ? ` · SIZ: ${G.brPlace || '—'}-O'RIN` : ` · O'LDIRDINGIZ: ${me ? me.k : 0}`) + (G.teams && G.myTeam ? ` · ${TEAM[G.myTeam]} JAMOA` : ''));
  $('flagStatus').className = '';
  if (boardT <= 0) {
    boardT = 0.3;
    const rows = G.mpPlayers.slice().sort((a, b) => (a.o ? 1 : 0) - (b.o ? 1 : 0) || b.k - a.k);
    $('mpBoard').innerHTML = rows.map((p) => `<div class="${cls(p)}" style="${p.o ? 'opacity:0.45' : ''}"><span>${name(p)}</span><span class="hold">${p.o ? '✝' : 'tirik'}</span><span>${p.k} ☠</span></div>`).join('');
  }
  return true;
}
