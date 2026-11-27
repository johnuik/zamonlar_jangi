// Rivojlanish tizimi: tajriba ballari (XP), darajalar, daraja bilan ochiladigan qurol va qo'shimchalar,
// har bir klass uchun tanlangan qurollar to'plami. Hammasi brauzerda (localStorage) saqlanadi.
import { CLASSES, SIDEARMS, ATTACH, MAX_ATTACH, attachFits, WEAPONS } from './weapons.js';

const KEY = 'zj_prog';
export const MAX_LEVEL = 20;
// Shu darajaga yetish uchun kerakli jami XP: 2-daraja — 175, 3 — 500, 4 — 975, 5 — 1600, ...
export const xpFor = (lvl) => (lvl <= 1 ? 0 : 100 * (lvl - 1) + 75 * (lvl - 1) * (lvl - 1));

// Nima qaysi darajada ochiladi (ro'yxatda yo'q narsalar boshidan ochiq)
export const UNLOCKS = [
  { lvl: 2, kind: 'weapon', id: 'pistol2' }, { lvl: 2, kind: 'att', id: 'grip' },
  { lvl: 3, kind: 'weapon', id: 'ar2' }, { lvl: 3, kind: 'att', id: 'extmag' },
  { lvl: 4, kind: 'weapon', id: 'smg2' }, { lvl: 4, kind: 'att', id: 'optic' },
  { lvl: 5, kind: 'weapon', id: 'shotgun2' }, { lvl: 5, kind: 'att', id: 'laser' },
  { lvl: 6, kind: 'att', id: 'supp' },
];
// Tajriba manbalari
export const XP = { kill: 25, head: 10, botKill: 20, zombieKill: 6, wave: 50, stage: 40, win: 300, mpWin: 150, mpPlayed: 50, flag10s: 6 };

function load() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; }
  if (!o || typeof o !== 'object') o = {};
  return { xp: Math.max(0, +o.xp || 0), lo: o.lo && typeof o.lo === 'object' ? o.lo : {} };
}
export const prog = load();
export function saveProg() { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch (e) { /* saqlab bo'lmadi — o'yin baribir ishlaydi */ } }

export function level(xp = prog.xp) { let l = 1; while (l < MAX_LEVEL && xp >= xpFor(l + 1)) l++; return l; }
// { lvl, into — shu darajada to'plangan XP, need — keyingi darajagacha jami, frac — 0..1 }
export function levelInfo() {
  const lvl = level(), a = xpFor(lvl), b = lvl >= MAX_LEVEL ? a : xpFor(lvl + 1);
  return { lvl, into: prog.xp - a, need: b - a, frac: b > a ? Math.min(1, (prog.xp - a) / (b - a)) : 1 };
}
export function unlockLevel(kind, id) { const u = UNLOCKS.find((x) => x.kind === kind && x.id === id); return u ? u.lvl : 1; }
export const unlocked = (kind, id) => level() >= unlockLevel(kind, id);
export function unlockName(u, era = 'modern') {
  return u.kind === 'att' ? ATTACH[u.id].name : (WEAPONS[era][u.id] || {}).short || u.id;
}

// Klass uchun tanlangan to'plam (ochilmagan yoki mos kelmaydigan narsalar chiqarib tashlanadi)
export function loadoutFor(clsIdx) {
  const c = CLASSES[clsIdx] || CLASSES[0], raw = prog.lo[c.id] || {};
  const p = c.alts.includes(raw.p) && unlocked('weapon', raw.p) ? raw.p : c.primary;
  const s = SIDEARMS.includes(raw.s) && unlocked('weapon', raw.s) ? raw.s : SIDEARMS[0];
  const a = (Array.isArray(raw.a) ? raw.a : []).filter((x) => unlocked('att', x) && attachFits(x, p)).slice(0, MAX_ATTACH);
  return { p, s, a };
}
export function setLoadout(clsIdx, patch) {
  const c = CLASSES[clsIdx] || CLASSES[0];
  prog.lo[c.id] = Object.assign(loadoutFor(clsIdx), patch);
  prog.lo[c.id] = loadoutFor(clsIdx);   // qayta tekshirish (qurol almashsa, mos kelmaydigan qo'shimcha tushib qoladi)
  saveProg();
}
export function toggleAttach(clsIdx, att) {
  const lo = loadoutFor(clsIdx), i = lo.a.indexOf(att);
  if (i >= 0) lo.a.splice(i, 1);
  else { if (!unlocked('att', att) || !attachFits(att, lo.p)) return false; if (lo.a.length >= MAX_ATTACH) lo.a.shift(); lo.a.push(att); }
  setLoadout(clsIdx, { a: lo.a });
  return true;
}

// XP qo'shish. Qaytaradi: yangi darajaga chiqilgan bo'lsa — { lvl, unlocks: [...] }, aks holda null.
const listeners = [];
export function onProgress(fn) { listeners.push(fn); }
export function addXp(n) {
  n = Math.round(n);
  if (!(n > 0)) return null;
  const before = level();
  prog.xp += n; saveProg();
  const after = level(), up = after > before ? { lvl: after, unlocks: UNLOCKS.filter((u) => u.lvl > before && u.lvl <= after) } : null;
  for (const fn of listeners) fn(n, up);
  return up;
}
