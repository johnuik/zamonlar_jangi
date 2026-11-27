import * as THREE from '../lib/three.module.js';
import { gunModelFor, knifeModel, skinGun } from './gunskin.js';
import { rbox } from './gfx.js';
import { flashTexture } from './fx.js';

// ================= KLASSLAR =================
// Har bir klassning asosiy quroli boshqa; pichoq va granata hammasida bir xil.
// alts — shu klassda tanlasa bo'ladigan asosiy qurollar (birinchisi — boshlang'ich; qolganlari daraja bilan ochiladi, js/progress.js).
export const CLASSES = [
  { id: 'assault', name: 'Avtomatchi', primary: 'ar', alts: ['ar', 'ar2'], desc: 'Avtomat — har qanday masofada ishonchli, universal jangchi.' },
  { id: 'engineer', name: 'Injener', primary: 'smg', alts: ['smg', 'smg2'], desc: "PP — yaqin jangda juda kuchli va tez, uzoq masofada kuchsiz." },
  { id: 'sniper', name: 'Snayper', primary: 'sniper', alts: ['sniper'], desc: "Optik miltiq — uzoqdan bir o'q bilan; transportni ham teshadi. Yaqinda noqulay." },
  { id: 'breacher', name: 'Shturmchi', primary: 'shotgun', alts: ['shotgun', 'shotgun2'], desc: "Drobovik — uy ichida va yaqin masofada bir o'qda yiqitadi." },
  { id: 'gunner', name: 'Pulemyotchi', primary: 'lmg', alts: ['lmg'], desc: "Qo'l pulemyoti — uzoq uzluksiz o't, yengil transportni ham ishdan chiqaradi. Og'ir va sekin." },
  { id: 'marksman', name: 'Mergan', primary: 'dmr', alts: ['dmr'], desc: "Yarim avtomat optik miltiq — o'rta va uzoq masofada tez ketma-ket aniq o'q." },
];
// To'pponcha o'rnidagi qurollar (ikkinchisi daraja bilan ochiladi)
export const SIDEARMS = ['pistol', 'pistol2'];

// falloff: [boshlanish, tugash, minimal ko'paytuvchi]
// vehMul — transportga zarar ko'paytuvchisi (ko'rsatilmasa VEH_MUL); pierce — zirhni qisman teshish: zirh ko'paytuvchisi shundan past bo'lmaydi
export const VEH_MUL = 0.85;
export const WEAPONS = {
  historical: {
    ar: { id: 'ar', name: 'Avtomat StG-44', short: 'StG-44', dmg: 40, head: 1.8, rpm: 560, mag: 30, reserve: 180, reload: 2.6, auto: true,
      hip: 0.045, spread: 0.004, bloom: 0.005, bloomMax: 0.032, recoil: 0.0105, recoilH: 0.0065, adsFov: 54, adsTime: 0.2, range: 240, falloff: [45, 120, 0.75],
      sound: 'ar', model: 'stg', move: 0.98 },
    ar2: { id: 'ar2', name: 'Avtomat miltiq FG-42', short: 'FG-42', dmg: 47, head: 1.8, rpm: 610, mag: 20, reserve: 140, reload: 2.5, auto: true,
      hip: 0.05, spread: 0.0035, bloom: 0.006, bloomMax: 0.036, recoil: 0.0135, recoilH: 0.0085, adsFov: 52, adsTime: 0.22, range: 280, falloff: [55, 150, 0.8],
      sound: 'ar', model: 'stg', move: 0.96, vehMul: 1.0 },
    smg: { id: 'smg', name: 'PP-41', short: 'PP-41', dmg: 27, head: 1.5, rpm: 860, mag: 71, reserve: 213, reload: 3.1, auto: true,
      hip: 0.03, spread: 0.013, bloom: 0.004, bloomMax: 0.032, recoil: 0.0095, recoilH: 0.008, adsFov: 62, adsTime: 0.14, range: 110, falloff: [9, 36, 0.35],
      sound: 'smg', model: 'drum', move: 1.05 },
    smg2: { id: 'smg2', name: 'PP MP-40', short: 'MP-40', dmg: 32, head: 1.5, rpm: 540, mag: 32, reserve: 192, reload: 2.2, auto: true,
      hip: 0.026, spread: 0.009, bloom: 0.003, bloomMax: 0.026, recoil: 0.0075, recoilH: 0.005, adsFov: 60, adsTime: 0.14, range: 130, falloff: [14, 48, 0.45],
      sound: 'smg', model: 'vityaz', move: 1.05 },
    sniper: { id: 'sniper', name: 'Snayper M-44 (optika)', short: 'M-44', dmg: 92, head: 3, rpm: 46, mag: 5, reserve: 35, reload: 3.2, auto: false,
      hip: 0.085, spread: 0.0, bloom: 0.03, recoil: 0.08, recoilH: 0.014, adsFov: 16, adsTime: 0.3, range: 500, falloff: [180, 500, 0.9],
      sound: 'bolt', model: 'mosin', move: 0.92, bolt: true, scope: true, vehMul: 2.2, pierce: 0.45 },
    shotgun: { id: 'shotgun', name: 'Drobovik M-97', short: 'M-97', dmg: 18, pellets: 9, head: 1.3, rpm: 72, mag: 6, reserve: 42, reload: 0.55, auto: false,
      hip: 0.065, spread: 0.05, bloom: 0.0, recoil: 0.08, recoilH: 0.02, adsFov: 66, adsTime: 0.18, range: 60, falloff: [7, 28, 0.15],
      sound: 'shotgun', model: 'trench', move: 1.0, pump: true, shells: true, vehMul: 0.6 },
    shotgun2: { id: 'shotgun2', name: "Ikki stvolli ov miltig'i", short: 'Ikki stvol', dmg: 20, pellets: 12, head: 1.3, rpm: 200, mag: 2, reserve: 40, reload: 0.7, auto: false,
      hip: 0.07, spread: 0.06, bloom: 0.0, recoil: 0.1, recoilH: 0.025, adsFov: 66, adsTime: 0.17, range: 55, falloff: [6, 24, 0.12],
      sound: 'shotgun', model: 'trench', move: 1.02, shells: true, vehMul: 0.6 },
    lmg: { id: 'lmg', name: 'Pulemyot DP-27', short: 'DP-27', dmg: 36, head: 1.6, rpm: 560, mag: 47, reserve: 188, reload: 4.2, auto: true,
      hip: 0.07, spread: 0.006, bloom: 0.003, bloomMax: 0.03, recoil: 0.0095, recoilH: 0.008, adsFov: 58, adsTime: 0.3, range: 260, falloff: [50, 140, 0.75],
      sound: 'mg', model: 'mg', move: 0.84, vehMul: 1.15, pierce: 0.2 },
    dmr: { id: 'dmr', name: 'Yarim avtomat SVT-40 (optika)', short: 'SVT-40', dmg: 54, head: 2.2, rpm: 230, mag: 10, reserve: 60, reload: 2.9, auto: false,
      hip: 0.07, spread: 0.0, bloom: 0.012, bloomMax: 0.04, recoil: 0.04, recoilH: 0.012, adsFov: 26, adsTime: 0.24, range: 400, falloff: [110, 320, 0.85],
      sound: 'bolt', model: 'mosin', move: 0.95, scope: true, vehMul: 1.4, pierce: 0.25 },
    pistol: { id: 'pistol', name: "To'pponcha TT-33", short: 'TT-33', dmg: 40, head: 1.8, rpm: 380, mag: 8, reserve: 64, reload: 1.6, auto: false,
      hip: 0.03, spread: 0.008, bloom: 0.01, recoil: 0.03, recoilH: 0.01, adsFov: 68, adsTime: 0.12, range: 120, falloff: [15, 45, 0.6],
      sound: 'pistol', model: 'tt', move: 1.08 },
    pistol2: { id: 'pistol2', name: 'Revolver Nagan', short: 'Nagan', dmg: 62, head: 2.0, rpm: 170, mag: 7, reserve: 49, reload: 2.7, auto: false,
      hip: 0.03, spread: 0.005, bloom: 0.016, recoil: 0.05, recoilH: 0.014, adsFov: 66, adsTime: 0.13, range: 140, falloff: [20, 60, 0.65],
      sound: 'pistol', model: 'tt', move: 1.08 },
  },
  modern: {
    ar: { id: 'ar', name: 'Avtomat M4', short: 'M4', dmg: 35, head: 1.8, rpm: 720, mag: 30, reserve: 180, reload: 2.3, auto: true,
      hip: 0.04, spread: 0.0035, bloom: 0.004, bloomMax: 0.03, recoil: 0.0088, recoilH: 0.0055, adsFov: 50, adsTime: 0.18, range: 250, falloff: [45, 120, 0.75],
      sound: 'ar', model: 'm4', move: 1.0 },
    ar2: { id: 'ar2', name: 'Jangovar miltiq SCAR-H', short: 'SCAR-H', dmg: 46, head: 1.8, rpm: 600, mag: 20, reserve: 140, reload: 2.5, auto: true,
      hip: 0.046, spread: 0.003, bloom: 0.006, bloomMax: 0.036, recoil: 0.0125, recoilH: 0.008, adsFov: 50, adsTime: 0.2, range: 300, falloff: [60, 160, 0.8],
      sound: 'ar', model: 'm4', move: 0.97, vehMul: 1.0 },
    smg: { id: 'smg', name: 'PP-19 Vityaz', short: 'PP-19', dmg: 29, head: 1.5, rpm: 900, mag: 30, reserve: 210, reload: 2.0, auto: true,
      hip: 0.028, spread: 0.012, bloom: 0.004, bloomMax: 0.03, recoil: 0.0085, recoilH: 0.007, adsFov: 62, adsTime: 0.13, range: 110, falloff: [10, 38, 0.35],
      sound: 'smg', model: 'vityaz', move: 1.06 },
    smg2: { id: 'smg2', name: 'PP-90 (50 o\'qli)', short: 'PP-90', dmg: 25, head: 1.5, rpm: 940, mag: 50, reserve: 200, reload: 2.4, auto: true,
      hip: 0.026, spread: 0.011, bloom: 0.003, bloomMax: 0.028, recoil: 0.0072, recoilH: 0.006, adsFov: 62, adsTime: 0.13, range: 110, falloff: [10, 36, 0.35],
      sound: 'smg', model: 'vityaz', move: 1.07 },
    sniper: { id: 'sniper', name: 'Snayper SR-9', short: 'SR-9', dmg: 92, head: 3, rpm: 42, mag: 5, reserve: 35, reload: 3.2, auto: false,
      hip: 0.09, spread: 0.0, bloom: 0.03, recoil: 0.085, recoilH: 0.015, adsFov: 13, adsTime: 0.32, range: 500, falloff: [200, 500, 0.9],
      sound: 'sniper', model: 'sniper', move: 0.9, bolt: true, scope: true, vehMul: 2.2, pierce: 0.45 },
    shotgun: { id: 'shotgun', name: 'Drobovik M-12', short: 'M-12', dmg: 17, pellets: 10, head: 1.3, rpm: 78, mag: 8, reserve: 48, reload: 0.5, auto: false,
      hip: 0.065, spread: 0.05, bloom: 0.0, recoil: 0.075, recoilH: 0.02, adsFov: 66, adsTime: 0.17, range: 60, falloff: [7, 28, 0.15],
      sound: 'shotgun', model: 'shotgun', move: 1.0, pump: true, shells: true, vehMul: 0.6 },
    shotgun2: { id: 'shotgun2', name: 'Yarim avtomat drobovik S-12', short: 'S-12', dmg: 14, pellets: 9, head: 1.3, rpm: 230, mag: 8, reserve: 48, reload: 2.7, auto: false,
      hip: 0.07, spread: 0.055, bloom: 0.004, bloomMax: 0.03, recoil: 0.06, recoilH: 0.02, adsFov: 66, adsTime: 0.17, range: 55, falloff: [7, 26, 0.15],
      sound: 'shotgun', model: 'shotgun', move: 0.98, vehMul: 0.6 },
    lmg: { id: 'lmg', name: 'Pulemyot PKM', short: 'PKM', dmg: 34, head: 1.6, rpm: 650, mag: 100, reserve: 200, reload: 5.0, auto: true,
      hip: 0.07, spread: 0.006, bloom: 0.003, bloomMax: 0.03, recoil: 0.009, recoilH: 0.008, adsFov: 58, adsTime: 0.3, range: 270, falloff: [50, 140, 0.75],
      sound: 'mg', model: 'mg', move: 0.82, vehMul: 1.15, pierce: 0.2 },
    dmr: { id: 'dmr', name: 'Mergan miltig\'i SVD (optika)', short: 'SVD', dmg: 56, head: 2.2, rpm: 250, mag: 10, reserve: 60, reload: 2.8, auto: false,
      hip: 0.07, spread: 0.0, bloom: 0.012, bloomMax: 0.04, recoil: 0.042, recoilH: 0.012, adsFov: 24, adsTime: 0.24, range: 420, falloff: [120, 340, 0.85],
      sound: 'sniper', model: 'sniper', move: 0.94, scope: true, vehMul: 1.4, pierce: 0.25 },
    pistol: { id: 'pistol', name: "To'pponcha G-19", short: 'G-19', dmg: 34, head: 1.8, rpm: 460, mag: 17, reserve: 102, reload: 1.5, auto: false,
      hip: 0.028, spread: 0.007, bloom: 0.008, recoil: 0.025, recoilH: 0.009, adsFov: 68, adsTime: 0.12, range: 120, falloff: [15, 45, 0.6],
      sound: 'pistol', model: 'glock', move: 1.08 },
    pistol2: { id: 'pistol2', name: "Og'ir to'pponcha Burgut .50", short: '.50', dmg: 64, head: 2.0, rpm: 190, mag: 7, reserve: 49, reload: 2.1, auto: false,
      hip: 0.032, spread: 0.005, bloom: 0.018, recoil: 0.055, recoilH: 0.016, adsFov: 66, adsTime: 0.13, range: 140, falloff: [20, 60, 0.65],
      sound: 'pistol', model: 'glock', move: 1.07 },
  },
};
// Har bir qurolning ustun tomoni (klass tanlash oynasida ko'rsatiladi) — o'yinda "keraksiz" qurol bo'lmasligi kerak
export const WEAPON_ADV = {
  ar: "har qanday masofada barqaror: aniq, tepkisi kam, magazini yetarli",
  ar2: "har bir o'qi kuchliroq va uzoqroqqa yetadi; evaziga magazini kichik (20) va tepkisi kattaroq",
  smg: "eng tez otadi va eng tez mo'ljalga olinadi — yaqin jangda tengsiz; uzoqda zarari tez kamayadi",
  smg2: { historical: "sekinroq otadi, lekin aniq va tepkisi juda kam — o'rta masofada ham ishlaydi", modern: "50 o'qli magazin — qayta o'qlamasdan uzoq otadi" },
  sniper: "boshga bir o'q; transportni ham teshadi (jipga 3 o'q) — eng uzoq masofa",
  dmr: "yarim avtomat: snayperdan 5 baravar tez otadi, optikasi yengilroq — harakatdagi nishonga qulay",
  shotgun: "yaqindan bir o'qda yiqitadi; patronlari bittalab solinadi — o'qlash paytida ham otsa bo'ladi",
  shotgun2: { historical: "ikki stvol — ikki o'qni ketma-ket darhol uzadi: eng kuchli birinchi zarba", modern: "yarim avtomat: pompasiz, ketma-ket tez otadi; magazin bilan o'qlanadi" },
  lmg: "katta magazin va uzluksiz o't: raqibni bostirib turadi, yengil transportni ishdan chiqaradi",
  pistol: "tez olinadi va tez otadi — asosiy qurol bo'shab qolganda qutqaradi",
  pistol2: "to'pponchalar ichida eng kuchlisi: tanaga 2 o'q; sekinroq otadi va magazini kichik",
};
export const weaponAdv = (id, era) => { const a = WEAPON_ADV[id]; return !a ? '' : typeof a === 'string' ? a : a[era] || ''; };

// Qo'lga olinadigan pichoq va granata (3 va 4-o'rinlar)
// Zombi-o'yinchining yagona quroli: chap tugma — panja urish, o'ng tugma — tishlash
export const CLAW = { id: 'claw', kind: 'melee', name: 'Panjalar', short: 'Panja', move: 1.2, slash: 26, stab: 42, slashT: 0.42, stabT: 0.7, reach: 2.5 };
// Zombi rejimida asosiy qurol o'rni boshida bo'sh (yashikdan topiladi)
export const EMPTY = { id: 'none', kind: 'none', name: "Asosiy qurol yo'q", short: "bo'sh", move: 1.08 };
export const KNIFE = { id: 'knife', kind: 'melee', name: 'Pichoq', short: 'Pichoq', move: 1.15, slash: 55, slashT: 0.4, stabT: 0.55, reach: 2.6 };
export const NADE = { id: 'nade', kind: 'throw', name: 'Granata', short: 'Granata', move: 1.05, fuse: 3.4 };

// Klass uchun qurollar to'plami: [asosiy, to'pponcha, pichoq, granata]
// pick — o'yinchi tanlagan variantlar: { p: asosiy qurol idsi, s: to'pponcha idsi, a: qo'shimchalar ro'yxati } (js/progress.js)
export function loadout(era, cls, pick) {
  const W = WEAPONS[era], c = CLASSES[cls] || CLASSES[0];
  const p = pick && c.alts.includes(pick.p) && W[pick.p] ? W[pick.p] : W[c.primary];
  const sd = pick && SIDEARMS.includes(pick.s) && W[pick.s] ? W[pick.s] : W.pistol;
  return [pick && pick.a && pick.a.length ? withAttachments(p, pick.a) : p, sd, KNIFE, NADE];
}

// ================= QUROL QO'SHIMCHALARI =================
// Har bir qurolga ko'pi bilan 2 ta. fits — qaysi qurollarga o'rnatiladi (ko'rsatilmasa — o'qotar asosiy qurollarning hammasiga).
export const ATTACH = {
  grip: { name: 'Tutqich', desc: "Tepki 18% kamroq, sondan otish aniqroq", no: ['sniper', 'dmr'] },
  extmag: { name: 'Katta magazin', desc: "Magazinda 40% ko'proq o'q, qayta o'qlash biroz sekinroq", no: ['shotgun', 'shotgun2', 'sniper'] },
  optic: { name: 'Kollimator optika', desc: "Mo'ljalda 1.6 baravar yaqinlashtiradi", no: ['sniper', 'dmr', 'shotgun', 'shotgun2'] },
  supp: { name: "Ovoz so'ndirgich", desc: "O'q uzganingizda xaritada ko'rinmaysiz, ovoz past; zarar 6% kam", no: ['shotgun', 'shotgun2', 'lmg'] },
  laser: { name: 'Lazer nishon', desc: 'Sondan otishda tarqalish 30% kam', no: ['sniper', 'dmr'] },
};
export const MAX_ATTACH = 2;
export const attachFits = (att, weaponId) => !!ATTACH[att] && !(ATTACH[att].no || []).includes(weaponId);
// Qo'shimchalar qo'llangan qurol ta'rifi (asl ta'rif o'zgarmaydi)
export function withAttachments(def, atts, max = MAX_ATTACH) {
  const d = Object.assign({}, def), list = (atts || []).filter((a) => attachFits(a, def.id)).slice(0, max);
  if (!list.length) return def;
  d.att = list;
  for (const a of list) {
    if (a === 'grip') { d.recoil *= 0.82; d.recoilH *= 0.8; d.hip *= 0.92; }
    else if (a === 'extmag') { d.mag = Math.round(d.mag * 1.4); d.reload = +(d.reload * 1.08).toFixed(2); }
    else if (a === 'optic') { d.adsFov = Math.min(d.adsFov, 40); d.adsTime += 0.03; d.spread *= 0.85; }
    else if (a === 'supp') { d.quiet = true; d.dmg = +(d.dmg * 0.94).toFixed(1); d.recoil *= 0.93; }
    else if (a === 'laser') { d.hip *= 0.7; }
  }
  return d;
}

// ================= MATERIALLAR =================
let flashTex = null;
const matCache = {};
function mats(era) {
  if (matCache[era]) return matCache[era];
  const H = era === 'historical';
  const S = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.9 }, o));
  const Bm = (c, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o));
  return (matCache[era] = {
    metal: S(0x3a3d42, { metalness: 0.85, roughness: 0.34 }),       // po'lat
    steel: S(0x9a9da2, { metalness: 0.95, roughness: 0.28 }),       // yaltiroq po'lat (zatvor, tirgak)
    blued: S(0x2b2f36, { metalness: 0.8, roughness: 0.38 }),        // qoraytirilgan po'lat
    black: S(0x25272a, { metalness: 0.55, roughness: 0.5 }),        // anodlangan alyuminiy
    dark: S(0x121314, { metalness: 0.4, roughness: 0.6 }),          // tirqish va teshiklar
    polymer: S(0x1d1e20, { roughness: 0.82, metalness: 0.02, envMapIntensity: 0.5 }),
    rubber: S(0x101010, { roughness: 0.95, metalness: 0, envMapIntensity: 0.2 }),
    tan: S(0x9c8763, { roughness: 0.75, envMapIntensity: 0.5 }),
    tanDark: S(0x7c6a4c, { roughness: 0.8, envMapIntensity: 0.5 }),
    olive: S(0x4c5437, { roughness: 0.75, envMapIntensity: 0.5 }),
    wood: S(0x7d4c26, { roughness: 0.5, envMapIntensity: 0.6 }),
    woodDark: S(0x55331a, { roughness: 0.55, envMapIntensity: 0.6 }),
    brass: S(0xc9a44c, { metalness: 0.95, roughness: 0.3 }),
    red: S(0xa32b22, { roughness: 0.6 }),
    skin: S(0xd09a78, { roughness: 0.75, envMapIntensity: 0.3 }),
    glove: S(H ? 0x5a4632 : 0x2c2a24, { roughness: 0.92, envMapIntensity: 0.3 }),
    sleeve: S(H ? 0x5e5a3c : 0x8f8262, { roughness: 0.95, envMapIntensity: 0.3 }),
    cuff: S(H ? 0x4b482f : 0x6e6349, { roughness: 0.95, envMapIntensity: 0.3 }),
    blade: S(0xd6dade, { metalness: 0.55, roughness: 0.22, envMapIntensity: 1.3 }),
    dot: Bm(0xf2f2e6),                                               // mo'ljaldagi oq nuqta
    fiber: Bm(0xff5a1e),                                             // old mo'ljalning yorqin nuqtasi
    lens: Bm(0x8fc6ff, { transparent: true, opacity: 0.1, depthWrite: false }),
    glassDark: S(0x0c1622, { roughness: 0.08, metalness: 0.9, envMapIntensity: 1.6 }),
  });
}

// ================= YORDAMCHI SHAKLLAR =================
function B(p, w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) {
  const me = new THREE.Mesh(rbox(w, h, d, Math.min(0.0045, Math.min(w, h, d) * 0.2), 0.008), m);   // qirralari yumaloqlangan (gfx.js)
  me.position.set(x, y, z); me.rotation.set(rx, ry, rz); p.add(me); return me;
}
function C(p, rt, rb, len, m, x, y, z, axis = 'z', seg = 14) {
  const g = new THREE.CylinderGeometry(rt, rb, len, seg);
  if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(Math.PI / 2);
  const me = new THREE.Mesh(g, m); me.position.set(x, y, z); p.add(me); return me;
}
function ball(p, r, m, x, y, z) { const me = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), m); me.position.set(x, y, z); p.add(me); return me; }
// Halqa (mo'ljal halqasi, optika gardishi) — z o'qiga qaragan
function ring(p, R, t, m, x, y, z, seg = 22) {
  const me = new THREE.Mesh(new THREE.TorusGeometry(R, t, 8, seg), m); me.position.set(x, y, z); p.add(me); return me;
}
// Pikatinni relsi: asos + tishlar
function rail(p, m, y, z0, z1, w = 0.02) {
  B(p, w * 0.8, 0.004, z0 - z1, m, 0, y - 0.002, (z0 + z1) / 2);
  for (let z = z0 - 0.004; z > z1; z -= 0.0105) B(p, w, 0.0045, 0.0055, m, 0, y + 0.002, z);
}
// Qo'l: musht (qurolga moslangan) + bilakdan tirsakka qarab yeng
function fist(g, M, x, y, z, w, h, d, gloved, side) {
  const hm = gloved ? M.glove : M.skin, f = new THREE.Group();
  f.position.set(x, y, z); g.add(f);
  B(f, w, h, d, hm, 0, 0, 0);
  // barmoqlar (old tomonda) va bosh barmoq
  const fh = h / 4.4;
  for (let i = 0; i < 4; i++) B(f, w * 0.92, fh, d * 0.5, hm, side * w * 0.12, h / 2 - fh * 0.6 - i * fh * 1.08, -d * 0.42);
  B(f, w * 0.34, h * 0.3, d * 0.75, hm, -side * w * 0.5, h * 0.3, -d * 0.1, 0, 0, 0);
  return f;
}
function forearm(g, M, from, to) {
  const a = new THREE.Group(); a.position.copy(from);
  const d = to.clone().sub(from), len = d.length();
  a.rotation.order = 'YXZ'; a.rotation.y = Math.atan2(d.x, d.z); a.rotation.x = -Math.asin(d.y / len);
  C(a, 0.047, 0.033, len, M.sleeve, 0, 0, len / 2, 'z', 10);
  C(a, 0.036, 0.036, 0.03, M.cuff, 0, 0, 0.012, 'z', 10);
  g.add(a); return a;
}
// Ikki qo'l: o'ng qo'l dastada (gun ichida), chap qo'l alohida guruhda — qayta o'qlashda magazin bilan birga harakatlanadi
function addArms(gun, M, grip, fore, gloved, o = {}) {
  const gw = o.gripW || 0.05;
  fist(gun, M, grip.x, grip.y, grip.z, gw, 0.075, 0.058, gloved, -1);
  forearm(gun, M, new THREE.Vector3(grip.x + 0.012, grip.y - 0.03, grip.z + 0.035), new THREE.Vector3(grip.x + (o.elbowR || 0.15), grip.y - 0.2, grip.z + 0.42));
  let handL = null;
  if (fore) {
    handL = new THREE.Group(); handL.position.copy(fore); gun.add(handL);
    if (o.cup) {
      // to'pponcha: chap qo'l o'ng qo'lni ostidan qamrab oladi
      fist(handL, M, 0, 0, 0, 0.062, 0.06, 0.06, gloved, 1);
      forearm(handL, M, new THREE.Vector3(-0.02, -0.03, 0.03), new THREE.Vector3(-0.2, -0.2, 0.36));
    } else {
      const hm = gloved ? M.glove : M.skin;
      B(handL, 0.07, 0.035, 0.085, hm, 0, -0.012, 0);                              // kaft pastdan
      for (let i = 0; i < 4; i++) B(handL, 0.014, 0.05, 0.018, hm, 0.036, 0.012, -0.03 + i * 0.02);   // barmoqlar o'ng tomonda
      B(handL, 0.014, 0.04, 0.03, hm, -0.036, 0.008, -0.01);                       // bosh barmoq chapda
      forearm(handL, M, new THREE.Vector3(-0.02, -0.03, 0.04), new THREE.Vector3(-0.27, -0.24, 0.38));
    }
  }
  return handL;
}

// Orqa mo'ljal: ikki ingichka ustuncha orasidagi tirqish (ustunchalar uchi mo'ljal chizig'ida) va asosgacha tushadigan tirgak
function notch(g, m, z, baseY, o = {}) {
  const gap = o.gap || 0.005, w = o.w || 0.004, h = o.h || 0.009, x = gap / 2 + w / 2;
  B(g, w, h, 0.003, m, x, 0.0015 - h / 2, z); B(g, w, h, 0.003, m, -x, 0.0015 - h / 2, z);
  B(g, gap + w * 2, 0.003, 0.003, m, 0, 0.003 - h, z);
  const top = 0.0015 - h, sh = top - baseY;
  if (sh > 0) B(g, o.stemW || 0.008, sh, o.stemD || 0.014, m, 0, baseY + sh / 2, z - (o.stemD || 0.014) / 2 + 0.0015);
}
// Old mo'ljal: halqa ichidagi ustuncha, ingichka asosda
function hoodPost(g, m, z, baseY, R = 0.0125) {
  ring(g, R, 0.0018, m, 0, 0, z);
  B(g, 0.0026, R + 0.002, 0.0026, m, 0, 0.0015 - (R + 0.002) / 2, z);
  const top = -R, sh = top - baseY;
  if (sh > 0) B(g, 0.009, sh, 0.014, m, 0, baseY + sh / 2, z);
}
// Korpusni mo'ljal chizig'idan dy ga pastga tushiradi: mo'ljallar o'z joyida qoladi, qurol tanasi esa nishonni kamroq to'sadi
function lowBody(gun, dy) { const b = new THREE.Group(); b.position.y = -dy; gun.add(b); return b; }
function lowR(R, dy) { for (const k of ['muzzle', 'eject', 'grip', 'fore']) if (R[k]) R[k][1] -= dy; R.bodyY = -dy; }

// Kollimator nishoni teksturasi: halqa + nuqta
let holoTex = null;
function holoTexture() {
  if (holoTex) return holoTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,40,30,0.95)'; g.fillStyle = 'rgba(255,60,40,1)'; g.lineWidth = 5;
  g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(64, 64, 6, 0, Math.PI * 2); g.fill();
  g.lineWidth = 5;
  for (const [x0, y0, x1, y1] of [[64, 8, 64, 26], [64, 102, 64, 120], [8, 64, 26, 64], [102, 64, 120, 64]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  holoTex = new THREE.CanvasTexture(c); holoTex.colorSpace = THREE.SRGBColorSpace;
  return holoTex;
}

// ================= QUROL MODELLARI =================
// Barcha yangi modellarda: MO'LJAL CHIZIG'I y = 0 da, −z tomonga qaragan. Nishonga olganda (ADS) ko'z (0, 0, eye) nuqtada turadi,
// shuning uchun orqa va old mo'ljal aniq ekran markaziga to'g'ri keladi, qurol korpusi esa mo'ljal chizig'idan pastda qoladi.
const MODELS = {
  // ---- Avtomat M4: golografik kollimator, rels, FDE qo'ndoq ----
  m4(gun, M, R) {
    B(gun, 0.04, 0.044, 0.205, M.black, 0, -0.056, -0.1025);                  // ustki qism (upper)
    B(gun, 0.036, 0.036, 0.19, M.black, 0, -0.094, -0.095);                   // pastki qism (lower)
    B(gun, 0.034, 0.05, 0.062, M.black, 0, -0.12, -0.155);                    // magazin uyasi
    B(gun, 0.038, 0.006, 0.066, M.black, 0, -0.146, -0.155);
    rail(gun, M.black, -0.034, -0.004, -0.2);
    B(gun, 0.05, 0.008, 0.012, M.black, 0, -0.038, 0.004);                    // zatvor ramasi dastasi
    B(gun, 0.016, 0.01, 0.03, M.black, 0, -0.04, -0.01);
    const bolt = B(gun, 0.003, 0.012, 0.034, M.steel, 0.0205, -0.057, -0.105); bolt.userData.bolt = 0.03;   // gilza chiqarish oynasidagi zatvor
    B(gun, 0.002, 0.017, 0.058, M.dark, 0.0202, -0.057, -0.098);              // gilza oynasi
    B(gun, 0.005, 0.003, 0.058, M.black, 0.0225, -0.0675, -0.098);            // ochiq chang qopqog'i
    B(gun, 0.008, 0.012, 0.014, M.black, 0.023, -0.05, -0.048);               // gilza qaytargich
    C(gun, 0.006, 0.006, 0.022, M.black, 0.024, -0.05, -0.02, 'z', 10);       // forward assist
    C(gun, 0.004, 0.004, 0.006, M.steel, 0.0195, -0.092, -0.118, 'x', 8);     // magazin tugmasi
    B(gun, 0.004, 0.02, 0.01, M.blued, -0.0195, -0.086, -0.125);              // zatvor ushlagich
    B(gun, 0.003, 0.006, 0.02, M.blued, -0.0195, -0.093, -0.03, 0.5);         // saqlagich
    C(gun, 0.003, 0.003, 0.042, M.steel, 0, -0.085, -0.008, 'x', 8); C(gun, 0.003, 0.003, 0.042, M.steel, 0, -0.092, -0.186, 'x', 8);   // shtiftlar
    B(gun, 0.03, 0.09, 0.04, M.polymer, 0, -0.152, -0.035, 0.32);             // dasta
    B(gun, 0.008, 0.005, 0.062, M.black, 0, -0.129, -0.086); B(gun, 0.008, 0.02, 0.005, M.black, 0, -0.12, -0.116);   // tepki himoyasi
    B(gun, 0.005, 0.022, 0.006, M.steel, 0, -0.118, -0.088, 0.3);             // tepki
    // bufer trubkasi va teleskopik qo'ndoq
    C(gun, 0.0135, 0.0135, 0.2, M.black, 0, -0.058, 0.1, 'z', 12);
    C(gun, 0.017, 0.017, 0.012, M.blued, 0, -0.058, 0.008, 'z', 12);
    B(gun, 0.036, 0.046, 0.14, M.tan, 0, -0.068, 0.2);
    B(gun, 0.024, 0.07, 0.1, M.tan, 0, -0.115, 0.225, -0.5);
    B(gun, 0.038, 0.115, 0.02, M.rubber, 0, -0.092, 0.278);
    B(gun, 0.01, 0.01, 0.05, M.black, 0, -0.095, 0.16);                       // qo'ndoq richagi
    // FDE old qo'ndoq (handguard) relslar va tirqishlar bilan
    C(gun, 0.023, 0.023, 0.014, M.blued, 0, -0.058, -0.212, 'z', 14);         // delta halqa
    B(gun, 0.041, 0.044, 0.245, M.tan, 0, -0.056, -0.342);
    rail(gun, M.tanDark, -0.034, -0.222, -0.462);
    B(gun, 0.018, 0.005, 0.24, M.tanDark, 0, -0.0805, -0.342);
    for (let i = 0; i < 5; i++) { B(gun, 0.043, 0.009, 0.03, M.dark, 0, -0.049, -0.25 - i * 0.046); B(gun, 0.043, 0.009, 0.03, M.dark, 0, -0.066, -0.25 - i * 0.046); }
    B(gun, 0.024, 0.075, 0.026, M.polymer, 0, -0.118, -0.335); B(gun, 0.028, 0.008, 0.03, M.polymer, 0, -0.158, -0.335);   // vertikal tutqich
    // stvol, gaz bloki, alangani so'ndirgich
    C(gun, 0.0085, 0.0085, 0.17, M.blued, 0, -0.058, -0.55, 'z', 12);
    B(gun, 0.022, 0.026, 0.024, M.black, 0, -0.054, -0.48);
    C(gun, 0.0115, 0.0115, 0.05, M.black, 0, -0.058, -0.655, 'z', 12);
    for (let i = 0; i < 3; i++) B(gun, 0.025, 0.003, 0.03, M.dark, 0, -0.058, -0.655, 0, 0, (i / 3) * Math.PI);
    B(gun, 0.016, 0.008, 0.036, M.black, 0, -0.029, -0.445); B(gun, 0.018, 0.008, 0.03, M.black, 0, -0.029, -0.022);       // buklangan zaxira mo'ljallar
    // golografik nishon (haqiqiy qurol modeli qo'yilganda ham qoladi — R.keep)
    const keep0 = gun.children.length;
    B(gun, 0.036, 0.014, 0.078, M.black, 0, -0.027, -0.105);
    B(gun, 0.04, 0.012, 0.03, M.polymer, 0, -0.016, -0.078);
    B(gun, 0.052, 0.005, 0.046, M.black, 0, 0.0205, -0.122);                  // gardish: ust
    B(gun, 0.005, 0.043, 0.046, M.black, 0.0235, 0.0, -0.122); B(gun, 0.005, 0.043, 0.046, M.black, -0.0235, 0.0, -0.122);   // gardish: yonlar
    B(gun, 0.044, 0.004, 0.046, M.black, 0, -0.0195, -0.122);
    B(gun, 0.004, 0.008, 0.012, M.polymer, 0.02, -0.026, -0.09); B(gun, 0.004, 0.008, 0.012, M.polymer, 0.02, -0.026, -0.125);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.043, 0.036), M.lens); lens.position.set(0, 0, -0.138); gun.add(lens);
    const ret = new THREE.Mesh(new THREE.PlaneGeometry(0.013, 0.013), new THREE.MeshBasicMaterial({ map: holoTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    ret.position.set(0, 0, -0.137); ret.renderOrder = 5; gun.add(ret);
    R.reticle = ret; R.keep = gun.children.slice(keep0);
    // magazin (biroz egilgan)
    const mag = new THREE.Group(); mag.position.set(0, -0.145, -0.155); gun.add(mag);
    B(mag, 0.026, 0.085, 0.052, M.blued, 0, -0.04, 0.004, -0.1); B(mag, 0.026, 0.07, 0.052, M.blued, 0, -0.108, -0.01, -0.24);
    B(mag, 0.029, 0.008, 0.056, M.polymer, 0, -0.145, -0.02, -0.24);
    for (let i = 0; i < 3; i++) B(mag, 0.028, 0.003, 0.05, M.black, 0, -0.03 - i * 0.03, 0.002 - i * 0.004, -0.14);
    R.mag = mag; R.muzzle = [0, -0.058, -0.685]; R.eject = [0.026, -0.055, -0.1];
    R.grip = [0, -0.15, -0.03]; R.fore = [0, -0.105, -0.3];
    R.hip = [0.125, -0.098, -0.31]; R.eye = 0.062;
  },

  // ---- PP-19 Vityaz: AK naqshidagi PP, ochiq mo'ljal ----
  vityaz(top, M, R) {
    const gun = lowBody(top, 0.014);
    B(gun, 0.036, 0.05, 0.25, M.blued, 0, -0.061, -0.125);                    // quti
    B(gun, 0.034, 0.012, 0.2, M.black, 0, -0.031, -0.105);                    // qopqoq
    for (let i = 0; i < 4; i++) B(gun, 0.0355, 0.003, 0.012, M.black, 0, -0.026, -0.04 - i * 0.04);
    const ch = B(gun, 0.022, 0.009, 0.014, M.steel, 0.027, -0.047, -0.12); ch.userData.bolt = 0.05;    // zatvor dastasi (o'ngda)
    B(gun, 0.002, 0.012, 0.06, M.dark, 0.0185, -0.047, -0.1);
    B(gun, 0.002, 0.01, 0.07, M.metal, 0.0188, -0.072, -0.07, 0.12);          // saqlagich richagi
    // orqa mo'ljal (tirqishli)
    notch(top, M.black, -0.19, -0.039, { stemD: 0.03 });
    // old qo'ndoq va gaz trubkasi
    B(gun, 0.04, 0.044, 0.13, M.polymer, 0, -0.06, -0.315);
    B(gun, 0.03, 0.014, 0.125, M.polymer, 0, -0.031, -0.315);
    for (let i = 0; i < 4; i++) B(gun, 0.042, 0.007, 0.018, M.dark, 0, -0.055, -0.27 - i * 0.03);
    rail(gun, M.black, -0.084, -0.26, -0.37);
    C(gun, 0.0085, 0.0085, 0.13, M.blued, 0, -0.052, -0.44, 'z', 12);
    // old mo'ljal: ustun, halqa va himoya qanotlari
    hoodPost(top, M.black, -0.44, -0.074);
    C(gun, 0.012, 0.012, 0.045, M.black, 0, -0.052, -0.525, 'z', 12);         // alanga so'ndirgich
    for (let i = 0; i < 3; i++) B(gun, 0.026, 0.004, 0.022, M.dark, 0, -0.052, -0.525, 0, 0, (i / 3) * Math.PI);
    // dasta, tepki
    B(gun, 0.028, 0.088, 0.038, M.polymer, 0, -0.128, -0.04, 0.28);
    B(gun, 0.008, 0.005, 0.07, M.blued, 0, -0.105, -0.1); B(gun, 0.008, 0.022, 0.005, M.blued, 0, -0.095, -0.135);
    B(gun, 0.005, 0.02, 0.006, M.steel, 0, -0.094, -0.1, 0.3);
    B(gun, 0.03, 0.022, 0.05, M.blued, 0, -0.092, -0.17);                     // magazin uyasi
    // yonga buklanadigan qo'ndoq
    B(gun, 0.012, 0.012, 0.25, M.black, 0, -0.05, 0.125); B(gun, 0.012, 0.012, 0.255, M.black, 0, -0.098, 0.122, -0.2);
    B(gun, 0.03, 0.105, 0.014, M.rubber, 0, -0.075, 0.25);
    B(gun, 0.018, 0.02, 0.016, M.blued, 0, -0.06, 0.004);
    const mag = new THREE.Group(); mag.position.set(0, -0.1, -0.17); gun.add(mag);
    B(mag, 0.022, 0.17, 0.032, M.polymer, 0, -0.08, 0.006, 0.07);
    B(mag, 0.024, 0.008, 0.036, M.black, 0, -0.165, 0.012, 0.07);
    for (let i = 0; i < 4; i++) B(mag, 0.0235, 0.003, 0.03, M.black, 0, -0.03 - i * 0.033, 0.002 + i * 0.0024, 0.07);
    R.mag = mag; R.muzzle = [0, -0.052, -0.555]; R.eject = [0.024, -0.047, -0.1];
    R.grip = [0, -0.128, -0.035]; R.fore = [0, -0.1, -0.31];
    lowR(R, 0.014);
    R.hip = [0.125, -0.09, -0.31]; R.eye = -0.03;
  },

  // ---- PP-41: yog'och qo'ndoq, teshikli g'ilof, barabanli magazin ----
  drum(top, M, R) {
    const gun = lowBody(top, 0.014);
    B(gun, 0.04, 0.045, 0.2, M.wood, 0, -0.078, -0.09);                       // yog'och o'rta qism
    B(gun, 0.04, 0.05, 0.2, M.wood, 0, -0.085, 0.1, -0.1);                    // bo'yin
    B(gun, 0.04, 0.11, 0.14, M.wood, 0, -0.118, 0.235, -0.12);                // qo'ndoq
    B(gun, 0.042, 0.115, 0.01, M.blued, 0, -0.125, 0.305, -0.12);
    B(gun, 0.038, 0.034, 0.27, M.blued, 0, -0.04, -0.145);                    // qopqoq
    C(gun, 0.019, 0.019, 0.27, M.blued, 0, -0.04, -0.145, 'z', 12);
    B(gun, 0.012, 0.002, 0.07, M.dark, 0.004, -0.0215, -0.13);                // gilza oynasi (tepada)
    const bh = B(gun, 0.02, 0.008, 0.012, M.steel, 0.028, -0.036, -0.13); bh.userData.bolt = 0.06;
    B(gun, 0.002, 0.008, 0.11, M.dark, 0.0195, -0.036, -0.1);
    // teshikli stvol g'ilofi
    C(gun, 0.021, 0.021, 0.27, M.blued, 0, -0.042, -0.415, 'z', 14);
    for (let i = 0; i < 4; i++) {
      B(gun, 0.044, 0.009, 0.04, M.dark, 0, -0.042, -0.31 - i * 0.058);
      B(gun, 0.009, 0.044, 0.04, M.dark, 0, -0.042, -0.31 - i * 0.058);
    }
    B(gun, 0.04, 0.036, 0.022, M.blued, 0, -0.038, -0.555, 0.35);             // qiya kompensator
    C(gun, 0.008, 0.008, 0.05, M.metal, 0, -0.042, -0.545, 'z', 10);
    // orqa mo'ljal (quloqchalar bilan) va old mo'ljal (halqada)
    notch(top, M.blued, -0.17, -0.037, { stemD: 0.024 });
    B(top, 0.0022, 0.016, 0.018, M.blued, 0.0125, -0.006, -0.176); B(top, 0.0022, 0.016, 0.018, M.blued, -0.0125, -0.006, -0.176);   // himoya quloqchalari
    B(top, 0.027, 0.003, 0.018, M.blued, 0, -0.0145, -0.176);
    hoodPost(top, M.blued, -0.52, -0.036);
    // tepki
    B(gun, 0.008, 0.005, 0.075, M.blued, 0, -0.118, -0.02); B(gun, 0.008, 0.02, 0.005, M.blued, 0, -0.109, -0.056);
    B(gun, 0.005, 0.02, 0.006, M.steel, 0, -0.108, -0.02, 0.3);
    // barabanli magazin
    const mag = new THREE.Group(); mag.position.set(0, -0.14, -0.19); gun.add(mag);
    C(mag, 0.068, 0.068, 0.05, M.blued, 0, 0, 0, 'z', 22);
    C(mag, 0.07, 0.07, 0.008, M.metal, 0, 0, 0.022, 'z', 22); C(mag, 0.07, 0.07, 0.008, M.metal, 0, 0, -0.022, 'z', 22);
    C(mag, 0.014, 0.014, 0.056, M.steel, 0, 0, 0, 'z', 10);
    B(mag, 0.03, 0.04, 0.04, M.blued, 0, 0.07, 0);
    R.mag = mag; R.muzzle = [0, -0.042, -0.585]; R.eject = [0.006, -0.018, -0.13]; R.ejectUp = true;
    R.grip = [0, -0.115, 0.07]; R.fore = [0, -0.2, -0.2]; R.foreDrum = true;
    lowR(R, 0.014);
    R.hip = [0.125, -0.088, -0.31]; R.eye = -0.03;
  },

  // ---- StG-44: shtamplangan quti, yog'och qo'ndoq, uzun egik magazin ----
  stg(top, M, R) {
    const gun = lowBody(top, 0.012);
    B(gun, 0.038, 0.05, 0.27, M.blued, 0, -0.061, -0.135);
    for (let i = 0; i < 3; i++) B(gun, 0.0395, 0.004, 0.19, M.metal, 0, -0.048 - i * 0.012, -0.14);
    B(gun, 0.03, 0.016, 0.1, M.blued, 0, -0.092, -0.06);                      // tepki qutisi
    const ch = B(gun, 0.02, 0.009, 0.014, M.steel, -0.028, -0.05, -0.15); ch.userData.bolt = 0.06;      // zatvor dastasi (chapda)
    B(gun, 0.002, 0.016, 0.055, M.dark, 0.0195, -0.056, -0.125);
    B(gun, 0.004, 0.02, 0.058, M.metal, 0.0215, -0.07, -0.125, 0, 0, 0.3);    // chang qopqog'i
    C(gun, 0.0125, 0.0125, 0.31, M.blued, 0, -0.033, -0.395, 'z', 12);        // gaz trubkasi
    B(gun, 0.04, 0.036, 0.16, M.blued, 0, -0.068, -0.345);                    // old qo'ndoq
    for (let i = 0; i < 2; i++) B(gun, 0.0415, 0.005, 0.13, M.metal, 0, -0.06 - i * 0.014, -0.345);
    C(gun, 0.0088, 0.0088, 0.22, M.blued, 0, -0.062, -0.53, 'z', 12);
    C(gun, 0.0115, 0.0115, 0.022, M.metal, 0, -0.062, -0.63, 'z', 12);
    // old mo'ljal: baland asos va halqa
    hoodPost(top, M.blued, -0.575, -0.075, 0.013);
    // orqa mo'ljal (sektorli)
    B(top, 0.018, 0.012, 0.07, M.blued, 0, -0.042, -0.215);
    B(top, 0.012, 0.003, 0.06, M.metal, 0, -0.03, -0.215, 0.18);
    notch(top, M.blued, -0.186, -0.036, { stemD: 0.012 });
    B(gun, 0.03, 0.09, 0.042, M.wood, 0, -0.138, -0.045, 0.3);                // dasta
    B(gun, 0.008, 0.005, 0.07, M.blued, 0, -0.118, -0.105); B(gun, 0.008, 0.022, 0.005, M.blued, 0, -0.108, -0.14);
    B(gun, 0.005, 0.02, 0.006, M.steel, 0, -0.106, -0.105, 0.3);
    B(gun, 0.034, 0.034, 0.056, M.blued, 0, -0.1, -0.21);                     // magazin uyasi
    // yog'och qo'ndoq
    B(gun, 0.038, 0.058, 0.2, M.wood, 0, -0.078, 0.1, -0.08);
    B(gun, 0.038, 0.115, 0.1, M.wood, 0, -0.105, 0.235, -0.08);
    B(gun, 0.04, 0.12, 0.01, M.blued, 0, -0.11, 0.288, -0.08);
    C(gun, 0.014, 0.014, 0.02, M.metal, 0, -0.06, 0.006, 'z', 10);
    const mag = new THREE.Group(); mag.position.set(0, -0.115, -0.21); gun.add(mag);
    B(mag, 0.027, 0.08, 0.05, M.blued, 0, -0.035, 0.0, -0.08); B(mag, 0.027, 0.08, 0.05, M.blued, 0, -0.105, -0.012, -0.24); B(mag, 0.027, 0.06, 0.05, M.blued, 0, -0.165, -0.032, -0.4);
    for (let i = 0; i < 3; i++) B(mag, 0.0285, 0.16, 0.004, M.metal, 0, -0.085, -0.02 + i * 0.018, -0.2);
    R.mag = mag; R.muzzle = [0, -0.062, -0.645]; R.eject = [0.024, -0.056, -0.125];
    R.grip = [0, -0.138, -0.04]; R.fore = [0, -0.11, -0.34];
    lowR(R, 0.012);
    R.hip = [0.125, -0.095, -0.31]; R.eye = -0.02;
  },

  // ---- Zamonaviy snayper miltig'i (AMR ham shu model: og'ir varianti) ----
  sniper(gun, M, R, def) {
    const heavy = def.id === 'amr', body = heavy ? M.olive : M.tan;
    // optika: trubka, okulyar, obyektiv, barabanchalar
    C(gun, 0.0152, 0.0152, 0.21, M.black, 0, 0, -0.125, 'z', 16);
    C(gun, 0.021, 0.0175, 0.07, M.black, 0, 0, 0.015, 'z', 18);
    C(gun, 0.022, 0.022, 0.012, M.rubber, 0, 0, 0.052, 'z', 18);
    C(gun, 0.0152, 0.027, 0.035, M.black, 0, 0, -0.245, 'z', 18);
    C(gun, 0.027, 0.027, 0.075, M.black, 0, 0, -0.3, 'z', 18);
    C(gun, 0.0235, 0.0235, 0.002, M.glassDark, 0, 0, -0.337, 'z', 18);
    C(gun, 0.017, 0.017, 0.002, M.glassDark, 0, 0, 0.056, 'z', 18);
    B(gun, 0.034, 0.034, 0.034, M.black, 0, 0, -0.125);
    C(gun, 0.0125, 0.0125, 0.022, M.black, 0, 0.027, -0.125, 'y', 14); C(gun, 0.0135, 0.0135, 0.006, M.metal, 0, 0.04, -0.125, 'y', 14);
    C(gun, 0.0125, 0.0125, 0.022, M.black, 0.027, 0, -0.125, 'x', 14); C(gun, 0.0115, 0.0115, 0.02, M.black, -0.026, 0, -0.125, 'x', 14);
    for (const z of [-0.06, -0.19]) { B(gun, 0.04, 0.012, 0.016, M.blued, 0, 0.012, z); B(gun, 0.012, 0.036, 0.016, M.blued, 0.018, -0.004, z); B(gun, 0.012, 0.036, 0.016, M.blued, -0.018, -0.004, z); B(gun, 0.03, 0.014, 0.018, M.blued, 0, -0.027, z); }
    rail(gun, M.black, -0.036, -0.02, -0.23, 0.022);
    // zatvor qutisi, shassi, og'ir stvol
    C(gun, 0.0185, 0.0185, 0.25, M.blued, 0, -0.06, -0.12, 'z', 14);
    B(gun, 0.002, 0.014, 0.06, M.dark, 0.0178, -0.058, -0.1);
    B(gun, 0.046, 0.045, 0.52, body, 0, -0.098, -0.18);
    B(gun, 0.048, 0.012, 0.3, M.black, 0, -0.124, -0.28);
    for (let i = 0; i < 4; i++) B(gun, 0.0475, 0.008, 0.04, M.dark, 0, -0.092, -0.25 - i * 0.055);
    C(gun, heavy ? 0.0135 : 0.0115, heavy ? 0.015 : 0.013, 0.5, M.blued, 0, -0.06, -0.495, 'z', 14);
    B(gun, heavy ? 0.04 : 0.03, 0.024, heavy ? 0.085 : 0.06, M.black, 0, -0.06, heavy ? -0.785 : -0.775);   // dulo tormozi
    for (let i = 0; i < (heavy ? 3 : 2); i++) B(gun, heavy ? 0.042 : 0.032, 0.012, 0.012, M.dark, 0, -0.06, -0.76 - i * 0.022);
    // qo'ndoq: yonoq yostig'i, dasta, taglik
    B(gun, 0.04, 0.06, 0.25, body, 0, -0.1, 0.2);
    B(gun, 0.034, 0.022, 0.13, M.black, 0, -0.055, 0.2);
    B(gun, 0.008, 0.02, 0.008, M.steel, 0.012, -0.07, 0.16); B(gun, 0.008, 0.02, 0.008, M.steel, 0.012, -0.07, 0.24);
    B(gun, 0.042, 0.125, 0.022, M.rubber, 0, -0.1, 0.336);
    B(gun, 0.032, 0.09, 0.04, body, 0, -0.158, 0.035, 0.25);
    B(gun, 0.008, 0.005, 0.06, M.black, 0, -0.127, -0.03); B(gun, 0.005, 0.02, 0.006, M.steel, 0, -0.117, -0.025, 0.3);
    // zatvor dastasi
    const bh = C(gun, 0.0055, 0.0055, 0.05, M.steel, 0.042, -0.062, 0.0, 'x', 8); bh.userData.bolt = 0.075;
    const kn = ball(gun, 0.0115, M.black, 0.07, -0.066, 0.0); kn.userData.bolt = 0.075;
    // soshka (buklangan)
    B(gun, 0.008, 0.008, 0.21, M.black, 0.019, -0.134, -0.33); B(gun, 0.008, 0.008, 0.21, M.black, -0.019, -0.134, -0.33);
    B(gun, 0.05, 0.014, 0.02, M.black, 0, -0.128, -0.43);
    const mag = new THREE.Group(); mag.position.set(0, -0.12, -0.11); gun.add(mag);
    B(mag, 0.03, heavy ? 0.085 : 0.06, heavy ? 0.095 : 0.075, M.black, 0, heavy ? -0.04 : -0.03, 0);
    R.mag = mag; R.muzzle = [0, -0.06, heavy ? -0.84 : -0.815]; R.eject = [0.022, -0.058, -0.1];
    R.grip = [0, -0.158, 0.04]; R.fore = [0, -0.14, -0.3];
    R.hip = [0.12, -0.105, -0.3]; R.eye = 0.09; R.big = 1.4;
  },

  // ---- M-44 optikali (bo'ylama sirpanuvchi zatvor, PU optikasi) ----
  mosin(gun, M, R) {
    B(gun, 0.042, 0.048, 0.86, M.wood, 0, -0.086, -0.24);                     // to'liq yog'och qo'ndoq
    B(gun, 0.036, 0.02, 0.36, M.woodDark, 0, -0.054, -0.44);                  // ustki yog'och
    B(gun, 0.042, 0.055, 0.14, M.wood, 0, -0.092, 0.14, -0.2);                // bo'yin
    B(gun, 0.042, 0.115, 0.2, M.wood, 0, -0.125, 0.27, -0.13);
    B(gun, 0.044, 0.12, 0.01, M.blued, 0, -0.137, 0.372, -0.13);
    C(gun, 0.0165, 0.0165, 0.21, M.blued, 0, -0.056, -0.08, 'z', 12);         // zatvor qutisi
    B(gun, 0.002, 0.012, 0.07, M.dark, 0.016, -0.05, -0.08);
    C(gun, 0.0095, 0.0085, 0.2, M.blued, 0, -0.056, -0.72, 'z', 12);          // stvol uchi
    for (const z of [-0.47, -0.62]) B(gun, 0.046, 0.056, 0.014, M.metal, 0, -0.08, z);
    B(gun, 0.012, 0.022, 0.016, M.blued, 0, -0.04, -0.79); ring(gun, 0.011, 0.002, M.blued, 0, -0.03, -0.79);
    C(gun, 0.004, 0.004, 0.4, M.metal, 0, -0.112, -0.62, 'z', 8);             // shompol
    // PU optikasi yon kronshteynda (R.keep — optikasiz qurol modeli qo'yilsa ham qoladi)
    const keep0 = gun.children.length;
    C(gun, 0.0125, 0.0125, 0.175, M.blued, 0, 0, -0.09, 'z', 14);
    C(gun, 0.0155, 0.0135, 0.03, M.blued, 0, 0, 0.005, 'z', 14); C(gun, 0.0135, 0.0155, 0.03, M.blued, 0, 0, -0.185, 'z', 14);
    C(gun, 0.012, 0.012, 0.002, M.glassDark, 0, 0, 0.021, 'z', 14); C(gun, 0.012, 0.012, 0.002, M.glassDark, 0, 0, -0.201, 'z', 14);
    C(gun, 0.0105, 0.0105, 0.016, M.blued, 0, 0.019, -0.09, 'y', 12); C(gun, 0.0105, 0.0105, 0.016, M.blued, 0.019, 0, -0.07, 'x', 12);
    B(gun, 0.008, 0.034, 0.11, M.blued, -0.019, -0.03, -0.09);
    for (const z of [-0.05, -0.13]) { B(gun, 0.034, 0.008, 0.012, M.blued, 0, 0.0155, z); B(gun, 0.008, 0.03, 0.012, M.blued, 0.0155, 0, z); B(gun, 0.008, 0.03, 0.012, M.blued, -0.0155, 0, z); }
    R.keep = gun.children.slice(keep0);
    // zatvor dastasi (pastga egilgan)
    const bh = C(gun, 0.005, 0.005, 0.04, M.steel, 0.034, -0.058, 0.012, 'x', 8); bh.userData.bolt = 0.07;
    const kn = ball(gun, 0.011, M.steel, 0.056, -0.072, 0.012); kn.userData.bolt = 0.07;
    C(gun, 0.011, 0.011, 0.016, M.steel, 0, -0.056, 0.035, 'z', 10);          // zatvor uchi
    B(gun, 0.008, 0.005, 0.07, M.blued, 0, -0.118, 0.0); B(gun, 0.005, 0.02, 0.006, M.steel, 0, -0.112, 0.005, 0.3);
    const mag = new THREE.Group(); mag.position.set(0, -0.11, -0.085); gun.add(mag);
    B(mag, 0.022, 0.035, 0.075, M.blued, 0, -0.012, 0, 0.1);
    R.mag = mag; R.muzzle = [0, -0.056, -0.83]; R.eject = [0.02, -0.05, -0.08];
    R.grip = [0, -0.118, 0.1]; R.fore = [0, -0.125, -0.3];
    R.hip = [0.12, -0.105, -0.28]; R.eye = 0.075; R.big = 1.4;
  },

  // ---- Zamonaviy pompali drobovik: halqali mo'ljal, yon patrontash ----
  shotgun(gun, M, R) {
    B(gun, 0.042, 0.062, 0.21, M.black, 0, -0.054, -0.105);
    B(gun, 0.002, 0.02, 0.075, M.dark, 0.0212, -0.046, -0.1);
    B(gun, 0.03, 0.004, 0.09, M.dark, 0, -0.0855, -0.13);                     // o'qlash oynasi
    rail(gun, M.black, -0.023, -0.06, -0.2);
    // halqali orqa mo'ljal
    B(gun, 0.02, 0.012, 0.018, M.black, 0, -0.017, -0.032);
    ring(gun, 0.0085, 0.0013, M.black, 0, 0, -0.032);
    B(gun, 0.0025, 0.022, 0.02, M.black, 0.0155, -0.009, -0.032); B(gun, 0.0025, 0.022, 0.02, M.black, -0.0155, -0.009, -0.032);
    C(gun, 0.0128, 0.0128, 0.47, M.blued, 0, -0.04, -0.44, 'z', 14);          // stvol
    C(gun, 0.0118, 0.0118, 0.42, M.blued, 0, -0.072, -0.415, 'z', 14);        // magazin trubkasi
    C(gun, 0.0135, 0.0135, 0.018, M.metal, 0, -0.072, -0.632, 'z', 14);
    B(gun, 0.022, 0.056, 0.014, M.black, 0, -0.056, -0.6);
    // old mo'ljal yorqin nuqta bilan
    B(gun, 0.008, 0.014, 0.022, M.black, 0, -0.022, -0.66);
    B(gun, 0.005, 0.018, 0.005, M.black, 0, -0.0075, -0.66);
    B(gun, 0.0042, 0.0042, 0.001, M.fiber, 0, -0.0012, -0.6572);
    // pomp
    const pump = new THREE.Group(); pump.position.set(0, -0.072, -0.37); gun.add(pump);
    B(pump, 0.046, 0.042, 0.155, M.polymer, 0, 0, 0);
    for (let i = 0; i < 6; i++) B(pump, 0.0475, 0.03, 0.008, M.dark, 0, 0, -0.06 + i * 0.024);
    B(pump, 0.006, 0.006, 0.16, M.metal, 0.02, 0.012, 0.15); B(pump, 0.006, 0.006, 0.16, M.metal, -0.02, 0.012, 0.15);
    // qo'ndoq va dasta
    B(gun, 0.04, 0.055, 0.24, M.polymer, 0, -0.075, 0.13, -0.1);
    B(gun, 0.042, 0.12, 0.022, M.rubber, 0, -0.092, 0.258, -0.1);
    B(gun, 0.032, 0.088, 0.04, M.polymer, 0, -0.13, 0.0, 0.3);
    B(gun, 0.008, 0.005, 0.065, M.black, 0, -0.106, -0.055); B(gun, 0.005, 0.02, 0.006, M.steel, 0, -0.096, -0.05, 0.3);
    // yon patrontash
    B(gun, 0.005, 0.034, 0.105, M.polymer, -0.0235, -0.062, -0.13);
    for (let i = 0; i < 4; i++) { C(gun, 0.0088, 0.0088, 0.04, M.red, -0.034, -0.06, -0.092 - i * 0.025, 'y', 10); C(gun, 0.0092, 0.0092, 0.01, M.brass, -0.034, -0.085, -0.092 - i * 0.025, 'y', 10); }
    R.pump = pump; R.muzzle = [0, -0.04, -0.685]; R.eject = [0.026, -0.046, -0.1]; R.shell = true;
    R.grip = [0, -0.13, 0.005]; R.fore = [0, -0.098, -0.37]; R.foreOnPump = true;
    R.hip = [0.125, -0.092, -0.32]; R.eye = 0.1; R.big = 1.4;
  },

  // ---- M-97 "xandaq" droboviki: yog'och, ochiq kurok, teshikli issiqlik qalqoni ----
  trench(top, M, R) {
    const gun = lowBody(top, 0.012);
    B(gun, 0.04, 0.06, 0.2, M.blued, 0, -0.052, -0.1);
    B(gun, 0.002, 0.02, 0.07, M.dark, 0.0202, -0.044, -0.1);
    B(gun, 0.007, 0.016, 0.01, M.steel, 0, -0.03, 0.006, 0.5);                // ochiq kurok
    // orqa mo'ljal (tirqish)
    notch(top, M.blued, -0.05, -0.034, { stemD: 0.02 });
    C(gun, 0.0128, 0.0128, 0.5, M.blued, 0, -0.04, -0.45, 'z', 14);
    // issiqlik qalqoni
    B(gun, 0.036, 0.014, 0.3, M.blued, 0, -0.024, -0.42);
    for (let i = 0; i < 6; i++) { B(gun, 0.012, 0.0145, 0.022, M.dark, 0.008, -0.024, -0.3 - i * 0.046); B(gun, 0.012, 0.0145, 0.022, M.dark, -0.008, -0.024, -0.3 - i * 0.046); }
    B(top, 0.005, 0.03, 0.008, M.blued, 0, -0.019, -0.66); ball(top, 0.0036, M.brass, 0, -0.001, -0.66);    // old mo'ljal (jez sharcha)
    C(gun, 0.0115, 0.0115, 0.4, M.blued, 0, -0.07, -0.4, 'z', 14);
    C(gun, 0.013, 0.013, 0.016, M.metal, 0, -0.07, -0.606, 'z', 14);
    B(gun, 0.014, 0.024, 0.05, M.metal, 0, -0.084, -0.665);                   // nayza tirgagi
    const pump = new THREE.Group(); pump.position.set(0, -0.07, -0.38); gun.add(pump);
    B(pump, 0.044, 0.04, 0.14, M.wood, 0, 0, 0);
    for (let i = 0; i < 7; i++) B(pump, 0.0455, 0.03, 0.006, M.woodDark, 0, 0, -0.054 + i * 0.018);
    B(pump, 0.006, 0.006, 0.16, M.metal, 0.02, 0.01, 0.15);
    B(gun, 0.038, 0.05, 0.16, M.wood, 0, -0.078, 0.07, -0.25);
    B(gun, 0.04, 0.105, 0.2, M.wood, 0, -0.12, 0.22, -0.13);
    B(gun, 0.042, 0.11, 0.01, M.blued, 0, -0.133, 0.322, -0.13);
    B(gun, 0.008, 0.005, 0.07, M.blued, 0, -0.105, -0.04); B(gun, 0.005, 0.02, 0.006, M.steel, 0, -0.095, -0.035, 0.3);
    R.pump = pump; R.muzzle = [0, -0.04, -0.71]; R.eject = [0.025, -0.044, -0.1]; R.shell = true;
    R.grip = [0, -0.11, 0.06]; R.fore = [0, -0.095, -0.38]; R.foreOnPump = true;
    lowR(R, 0.012);
    R.hip = [0.125, -0.092, -0.32]; R.eye = 0.08; R.big = 1.4;
  },

  // ---- G-19: polimer ramka, uch nuqtali mo'ljal ----
  glock(gun, M, R) {
    const slide = new THREE.Group(); gun.add(slide);
    B(slide, 0.026, 0.024, 0.18, M.black, 0, -0.016, -0.09);
    B(slide, 0.009, 0.007, 0.008, M.black, 0.0065, -0.0015, -0.008); B(slide, 0.009, 0.007, 0.008, M.black, -0.0065, -0.0015, -0.008);
    B(slide, 0.022, 0.004, 0.008, M.black, 0, -0.005, -0.008);
    B(slide, 0.0032, 0.0032, 0.001, M.dot, 0.0065, -0.0012, -0.0037); B(slide, 0.0032, 0.0032, 0.001, M.dot, -0.0065, -0.0012, -0.0037);
    B(slide, 0.0042, 0.007, 0.01, M.black, 0, -0.0015, -0.17);
    B(slide, 0.0032, 0.0032, 0.001, M.dot, 0, -0.0012, -0.1648);
    B(slide, 0.016, 0.002, 0.032, M.steel, 0.003, -0.0042, -0.075);           // stvol qopqog'i (gilza oynasi)
    B(slide, 0.002, 0.012, 0.03, M.dark, 0.013, -0.012, -0.075);
    for (let i = 0; i < 6; i++) B(slide, 0.0268, 0.016, 0.0025, M.dark, 0, -0.018, -0.014 - i * 0.006);
    C(slide, 0.0062, 0.0062, 0.012, M.blued, 0, -0.016, -0.181, 'z', 10);
    B(gun, 0.025, 0.018, 0.172, M.polymer, 0, -0.037, -0.086);                // ramka
    B(gun, 0.022, 0.008, 0.055, M.polymer, 0, -0.049, -0.142);
    for (let i = 0; i < 3; i++) B(gun, 0.023, 0.003, 0.006, M.dark, 0, -0.053, -0.125 - i * 0.012);
    B(gun, 0.012, 0.004, 0.048, M.polymer, 0, -0.07, -0.088); B(gun, 0.012, 0.028, 0.004, M.polymer, 0, -0.058, -0.112);
    B(gun, 0.006, 0.02, 0.006, M.black, 0, -0.056, -0.082, 0.3);
    B(gun, 0.027, 0.09, 0.046, M.polymer, 0, -0.088, -0.022, 0.2);
    for (let i = 0; i < 5; i++) B(gun, 0.0285, 0.004, 0.03, M.dark, 0, -0.06 - i * 0.012, -0.027 + i * 0.0024, 0.2);
    B(gun, 0.004, 0.006, 0.012, M.black, 0.0135, -0.04, -0.06);               // zatvor to'xtatgich
    const mag = new THREE.Group(); mag.position.set(0, -0.09, -0.02); gun.add(mag);
    B(mag, 0.02, 0.085, 0.034, M.blued, 0, 0, 0, 0.2);
    B(mag, 0.028, 0.008, 0.05, M.black, 0, -0.044, 0.009, 0.2);
    R.mag = mag; R.slide = slide; R.muzzle = [0, -0.016, -0.195]; R.eject = [0.016, -0.008, -0.075];
    R.grip = [0, -0.092, -0.02]; R.fore = [-0.022, -0.105, -0.022]; R.cup = true; R.gripW = 0.046;
    R.hip = [0.1, -0.105, -0.4]; R.eye = 0.33; R.magDrop = 0.16;
  },

  // ---- TT-33: ingichka po'lat zatvor, ochiq kurok ----
  tt(gun, M, R) {
    const slide = new THREE.Group(); gun.add(slide);
    B(slide, 0.023, 0.02, 0.185, M.blued, 0, -0.016, -0.0925);
    C(slide, 0.0115, 0.0115, 0.185, M.blued, 0, -0.012, -0.0925, 'z', 12);
    B(slide, 0.008, 0.007, 0.006, M.blued, 0.006, -0.0015, -0.01); B(slide, 0.008, 0.007, 0.006, M.blued, -0.006, -0.0015, -0.01);
    B(slide, 0.02, 0.004, 0.006, M.blued, 0, -0.005, -0.01);
    B(slide, 0.0035, 0.007, 0.01, M.blued, 0, -0.0015, -0.175);
    B(slide, 0.002, 0.01, 0.028, M.dark, 0.0118, -0.012, -0.08);
    for (let i = 0; i < 7; i++) B(slide, 0.0238, 0.014, 0.002, M.dark, 0, -0.016, -0.016 - i * 0.005);
    C(slide, 0.0058, 0.0058, 0.016, M.steel, 0, -0.014, -0.19, 'z', 10);
    B(gun, 0.022, 0.018, 0.15, M.blued, 0, -0.034, -0.085);
    B(gun, 0.006, 0.014, 0.01, M.steel, 0, -0.012, 0.006, 0.5);               // kurok
    B(gun, 0.01, 0.004, 0.044, M.blued, 0, -0.064, -0.082); B(gun, 0.01, 0.024, 0.004, M.blued, 0, -0.054, -0.104);
    B(gun, 0.005, 0.018, 0.006, M.steel, 0, -0.052, -0.078, 0.3);
    B(gun, 0.024, 0.09, 0.04, M.blued, 0, -0.085, -0.016, 0.12);
    B(gun, 0.0275, 0.072, 0.032, M.woodDark, 0, -0.088, -0.016, 0.12);         // dasta qoplamasi
    for (let i = 0; i < 6; i++) B(gun, 0.0285, 0.003, 0.026, M.dark, 0, -0.062 - i * 0.01, -0.019 + i * 0.0012, 0.12);
    C(gun, 0.004, 0.004, 0.004, M.steel, 0, -0.135, 0.0, 'x', 8);
    const mag = new THREE.Group(); mag.position.set(0, -0.088, -0.016); gun.add(mag);
    B(mag, 0.018, 0.085, 0.03, M.metal, 0, 0, 0, 0.12);
    B(mag, 0.024, 0.006, 0.04, M.blued, 0, -0.045, 0.005, 0.12);
    R.mag = mag; R.slide = slide; R.muzzle = [0, -0.014, -0.205]; R.eject = [0.014, -0.006, -0.08];
    R.grip = [0, -0.09, -0.015]; R.fore = [-0.022, -0.103, -0.018]; R.cup = true; R.gripW = 0.044;
    R.hip = [0.1, -0.105, -0.4]; R.eye = 0.33; R.magDrop = 0.16;
  },

  // ================= Eski uslubdagi modellar (noyob qurollar va bort pulemyoti) =================
  mg(gun, M, R) {
    B(gun, 0.06, 0.08, 0.45, M.black, 0, -0.05, -0.05);
    B(gun, 0.05, 0.1, 0.32, M.polymer, 0, -0.08, 0.32, -0.08);
    C(gun, 0.027, 0.027, 0.52, M.blued, 0, -0.04, -0.52);
    for (let i = 0; i < 6; i++) C(gun, 0.029, 0.029, 0.02, M.black, 0, -0.04, -0.32 - i * 0.07);
    C(gun, 0.032, 0.02, 0.07, M.black, 0, -0.04, -0.8);
    B(gun, 0.008, 0.03, 0.008, M.metal, 0, -0.005, -0.72);
    B(gun, 0.03, 0.02, 0.012, M.metal, 0, -0.005, -0.02);
    B(gun, 0.012, 0.012, 0.32, M.metal, 0.02, -0.08, -0.6, 0.05);
    B(gun, 0.012, 0.012, 0.32, M.metal, -0.02, -0.08, -0.6, 0.05);
    R.mag = B(gun, 0.05, 0.13, 0.15, M.tan, -0.07, -0.08, -0.05);
    R.muzzle = [0, -0.04, -0.84]; R.grip = [0, -0.13, 0.08]; R.fore = [0.0, -0.1, -0.32];
    R.hip = [0.18, -0.21, -0.52]; R.ads = [0, 0, -0.3]; R.big = 1.4;
  },
  rpg(gun, M, R, def, era) {
    const H = era === 'historical';
    C(gun, 0.045, 0.045, H ? 1.25 : 1.0, M.tan, 0.05, -0.06, H ? -0.25 : -0.2, 'z', 16);
    C(gun, 0.06, 0.045, 0.14, M.black, 0.05, -0.06, 0.36, 'z', 16);
    B(gun, 0.03, 0.1, 0.04, M.woodDark, 0.05, -0.15, -0.05, 0.25);
    B(gun, 0.03, 0.1, 0.04, M.woodDark, 0.05, -0.15, -0.3, 0.1);
    B(gun, 0.006, 0.05, 0.006, M.metal, -0.01, -0.02, -0.25);
    B(gun, 0.02, 0.012, 0.006, M.metal, -0.01, -0.002, -0.05);
    R.mag = H ? C(gun, 0.035, 0.035, 0.2, M.black, 0.05, -0.06, -0.85, 'z', 12) : C(gun, 0.02, 0.075, 0.34, M.olive, 0.05, -0.06, -0.86, 'z', 14);
    if (!H) C(gun, 0.075, 0.03, 0.12, M.olive, 0.05, -0.06, -0.64, 'z', 14);
    R.muzzle = [0.05, -0.06, -1.05]; R.grip = [0.05, -0.17, -0.02]; R.fore = [0.05, -0.17, -0.32];
    R.hip = [0.16, -0.12, -0.42]; R.ads = [0.01, 0.0, -0.3]; R.big = 2;
  },
  minigun(gun, M, R) {
    B(gun, 0.13, 0.14, 0.34, M.black, 0, -0.12, -0.08);
    B(gun, 0.03, 0.03, 0.26, M.metal, 0, -0.02, -0.05);
    B(gun, 0.03, 0.06, 0.03, M.metal, 0, -0.045, 0.06); B(gun, 0.03, 0.06, 0.03, M.metal, 0, -0.045, -0.16);
    const spin = new THREE.Group(); spin.position.set(0, -0.11, -0.55); gun.add(spin);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; C(spin, 0.012, 0.012, 0.62, M.blued, Math.cos(a) * 0.042, Math.sin(a) * 0.042, 0, 'z', 8); }
    C(spin, 0.06, 0.06, 0.03, M.black, 0, 0, -0.28, 'z', 14); C(spin, 0.06, 0.06, 0.03, M.black, 0, 0, 0.05, 'z', 14);
    R.spin = spin;
    R.mag = B(gun, 0.12, 0.16, 0.2, M.tan, -0.13, -0.16, -0.05);
    B(gun, 0.03, 0.1, 0.04, M.polymer, 0, -0.22, 0.05, 0.3);
    R.muzzle = [0, -0.11, -0.88]; R.grip = [0, -0.22, 0.07]; R.fore = [0, -0.03, -0.05];
    R.hip = [0.14, -0.2, -0.45]; R.ads = [0.04, -0.09, -0.4]; R.big = 1.4;
  },
  gl(gun, M, R, def, era) {
    B(gun, 0.045, 0.08, 0.3, era === 'modern' ? M.polymer : M.wood, 0, -0.09, 0.22, 0.1);
    B(gun, 0.05, 0.07, 0.22, M.black, 0, -0.06, -0.02);
    R.mag = C(gun, 0.075, 0.075, 0.15, M.blued, 0, -0.085, -0.2, 'z', 12);
    C(gun, 0.032, 0.032, 0.36, M.black, 0, -0.05, -0.45, 'z', 12);
    B(gun, 0.03, 0.09, 0.04, M.polymer, 0, -0.15, 0.06, 0.3);
    B(gun, 0.03, 0.08, 0.04, M.polymer, 0, -0.13, -0.38);
    B(gun, 0.006, 0.03, 0.006, M.metal, 0, -0.005, -0.58);
    B(gun, 0.024, 0.012, 0.006, M.metal, 0, -0.006, 0.05);
    R.muzzle = [0, -0.05, -0.65]; R.grip = [0, -0.15, 0.08]; R.fore = [0, -0.14, -0.38];
    R.hip = [0.16, -0.19, -0.5]; R.ads = [0, 0, -0.3]; R.big = 1.4;
  },
};

// Qo'shimchalarning ko'rinishi: modellar mo'ljal chizig'i y = 0 da turadigan qilib yig'ilgan — optika shu chiziqqa, so'ndirgich stvol uchiga qo'yiladi
function addAttachmentMeshes(gun, M, R, def) {
  const atts = def.att || [];
  if (atts.includes('supp') && R.muzzle) {
    const [x, y, z] = R.muzzle;
    C(gun, 0.017, 0.017, 0.15, M.black, x, y, z - 0.075, 'z', 14);
    C(gun, 0.0185, 0.0185, 0.012, M.dark || M.black, x, y, z - 0.012, 'z', 14);
    R.muzzle = [x, y, z - 0.15]; R.big = (R.big || 1) * 0.55;   // alanga deyarli ko'rinmaydi
  }
  if (atts.includes('optic') && !R.reticle && !R.ads) {
    const z = -0.085;
    ring(gun, 0.017, 0.0026, M.black, 0, 0, z); ring(gun, 0.017, 0.0026, M.black, 0, 0, z - 0.045);
    B(gun, 0.02, 0.0035, 0.05, M.black, 0, 0.0185, z - 0.022); B(gun, 0.0035, 0.03, 0.05, M.black, 0.0185, 0, z - 0.022); B(gun, 0.0035, 0.03, 0.05, M.black, -0.0185, 0, z - 0.022);
    B(gun, 0.018, 0.016, 0.04, M.black, 0, -0.026, z - 0.022);
    const ret = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.012), new THREE.MeshBasicMaterial({ map: holoTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    ret.position.set(0, 0, z - 0.03); ret.renderOrder = 5; gun.add(ret);
    R.reticle = ret;
  }
  if (atts.includes('grip') && R.fore && def.model !== 'm4') {
    const [x, y, z] = R.fore;
    B(gun, 0.022, 0.07, 0.024, M.polymer || M.black, x, y - 0.03, z + 0.02);
  }
  if (atts.includes('laser') && R.fore) {
    const [x, y, z] = R.fore;
    B(gun, 0.014, 0.014, 0.05, M.black, x + 0.028, y + 0.035, z);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    dot.position.set(x + 0.028, y + 0.035, z - 0.027); gun.add(dot);
  }
  if (atts.includes('extmag') && R.mag) R.mag.scale.y *= 1.28;
}

export function buildViewmodel(def, era, noArms = false) {
  const M = mats(era);
  const g = new THREE.Group();
  const gun = new THREE.Group(); g.add(gun);
  const R = {};
  (MODELS[def.model] || MODELS.mg)(gun, M, R, def, era);
  { const sk = gunModelFor(def.id, era); if (sk && sk.R) Object.assign(R, sk.R); }   // (haqiqiy model o'z tayanch nuqtalarini bersa — qo'llar va stvol uchi o'shanga)
  const keepParts = R.keep || [], codeParts = gun.children.filter((c) => !keepParts.includes(c));   // (kod bilan qurilgan qurol tanasi — model bilan almashtirilishi mumkin; R.keep — model so'rasa qoladigan qismlar, masalan, optika)
  const modern = era === 'modern';
  let handL = null;
  if (!noArms) {
    const fp = R.fore ? new THREE.Vector3(R.fore[0], R.fore[1], R.fore[2]) : null;
    if (R.foreOnPump && R.pump && fp) {
      // chap qo'l pompda — u bilan birga harakatlanadi
      const hold = new THREE.Group(); R.pump.add(hold);
      const pp = R.pump.position.clone(); pp.y += R.bodyY || 0;
      handL = addArms(hold, M, new THREE.Vector3(R.grip[0], R.grip[1], R.grip[2]).sub(pp), fp.clone().sub(pp), true, R);
      // o'ng qo'l pomp bilan birga siljimasligi kerak: uni qurolga ko'chiramiz
      const right = hold.children.filter((c) => c !== handL);
      for (const c of right) { hold.remove(c); c.position.add(pp); gun.add(c); }
    } else handL = addArms(gun, M, new THREE.Vector3(R.grip[0], R.grip[1], R.grip[2]), fp, true, R);
  }
  addAttachmentMeshes(gun, M, R, def);
  const muzzle = new THREE.Object3D(); muzzle.position.set(R.muzzle[0], R.muzzle[1], R.muzzle[2]); gun.add(muzzle);
  let eject = null;
  if (R.eject) { eject = new THREE.Object3D(); eject.position.set(R.eject[0], R.eject[1], R.eject[2]); gun.add(eject); }
  gun.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });

  if (!flashTex) flashTex = flashTexture();
  const fm = new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const flash = new THREE.Group();
  const big = R.big || 1;
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.22 * big, 0.22 * big), fm); flash.add(p1);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.12 * big, 0.4 * big), fm); p2.rotation.x = Math.PI / 2; p2.position.z = -0.12 * big; flash.add(p2);
  const p3 = new THREE.Mesh(new THREE.PlaneGeometry(0.12 * big, 0.4 * big), fm); p3.rotation.set(Math.PI / 2, 0, Math.PI / 2); p3.position.z = -0.12 * big; flash.add(p3);
  flash.position.copy(muzzle.position); flash.visible = false;
  gun.add(flash);

  const boltParts = [];
  gun.traverse((o) => { if (o.userData.bolt) { o.userData.z0 = o.position.z; boltParts.push(o); } });
  const hip = new THREE.Vector3(R.hip[0], R.hip[1], R.hip[2]);
  const ads = R.ads ? new THREE.Vector3(R.ads[0], R.ads[1], R.ads[2]) : new THREE.Vector3(0, 0, -R.eye);
  const vm = {
    group: g, gun, muzzle, eject, flash, hip, ads, boltParts, handL, handLBase: handL ? handL.position.clone() : null,
    spin: R.spin || null, mag: R.mag || null, magBase: R.mag ? R.mag.position.clone() : null, magDrop: R.magDrop || 0.3,
    pump: R.pump || null, pumpBase: R.pump ? R.pump.position.clone() : null, slide: R.slide || null,
    reticle: R.reticle || null, shell: !!R.shell, ejectUp: !!R.ejectUp, legacy: !!R.ads,
    dofRange: null,
  };
  // haqiqiy qurol modeli (gunskin.js): yuklangan bo'lsa — hozir, aks holda qurol birinchi chizilganda almashadi
  // mo'ljaldagi ko'z joyi modelning o'z mo'ljalidan olinadi (optik oynali, to'pponcha, granatomyot va qo'lda olib yuriladigan vositalardan tashqari)
  const autoAds = !def.scope && !SIDEARMS.includes(def.id) && !['rpg', 'turret', 'drone'].includes(def.id);
  vm.skinLater = gunSkinner(gunModelFor(def.id, era), gun, codeParts, R.muzzle[2], R.ads ? null : R.eye, vm, keepParts, autoAds);
  return vm;
}

// Gilza: latun (yoki drobovikning qizil patroni) — otilganda qurol yonidan uchib chiqadi
export function buildShell(era, shotgun) {
  const M = mats(era), g = new THREE.Group();
  if (shotgun) { C(g, 0.0095, 0.0095, 0.045, M.red, 0, 0, 0, 'z', 8); C(g, 0.0098, 0.0098, 0.01, M.brass, 0, 0, 0.022, 'z', 8); }
  else C(g, 0.0042, 0.0042, 0.02, M.brass, 0, 0, 0, 'z', 8);
  g.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  g.visible = false;
  return g;
}

// Pichoq (3-o'rin): qo'lda ushlab turiladi, chap tugma — kesish, o'ng tugma — sanchish
export function buildKnife(era) {
  const M = mats(era), modern = era === 'modern';
  const g = new THREE.Group(), k = new THREE.Group(); g.add(k);
  // tig': yassi qism, o'tkir qirra va uchi
  B(k, 0.004, 0.03, 0.17, M.blade, 0, 0.004, -0.115);
  B(k, 0.0025, 0.012, 0.165, M.steel, 0, -0.015, -0.112);
  B(k, 0.004, 0.022, 0.04, M.blade, 0, 0.006, -0.215, 0.38);
  B(k, 0.0045, 0.006, 0.09, M.blued, 0, 0.016, -0.08);                         // qon yo'li
  if (modern) for (let i = 0; i < 5; i++) B(k, 0.0045, 0.006, 0.006, M.blued, 0, 0.021, -0.04 - i * 0.011);   // arra tishlari
  B(k, 0.014, 0.06, 0.012, M.metal, 0, 0, -0.024);                             // gard
  B(k, 0.024, 0.032, 0.105, modern ? M.polymer : M.woodDark, 0, 0, 0.034);     // dasta
  for (let i = 0; i < 5; i++) B(k, 0.0255, 0.034, 0.004, M.dark, 0, 0, 0.0 + i * 0.017);
  B(k, 0.02, 0.036, 0.014, M.metal, 0, 0, 0.093);                              // dasta uchi
  const codeParts = k.children.slice();
  fist(k, M, 0, -0.004, 0.036, 0.05, 0.07, 0.07, modern, -1);
  forearm(k, M, new THREE.Vector3(0.01, -0.035, 0.07), new THREE.Vector3(0.1, -0.2, 0.44));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  g.visible = false;
  return { group: g, knife: k, skinLater: gunSkinner(knifeModel(), k, codeParts, -0.235) };
}

// Zombi qo'llari (birinchi shaxs): oldinga cho'zilgan ikki bilak va panjalar
export function buildClaws(era) {
  const M = mats(era), g = new THREE.Group();
  const zs = new THREE.MeshStandardMaterial({ color: 0x7f9272, roughness: 0.8 }), bl = new THREE.MeshStandardMaterial({ color: 0x4d0f0c, roughness: 0.7 });
  const arm = (sx) => {
    const a = new THREE.Group(); a.position.set(sx * 0.2, -0.24, -0.12); g.add(a);
    C(a, 0.034, 0.05, 0.5, zs, 0, 0, -0.2, 'z', 9);
    B(a, 0.085, 0.03, 0.09, zs, 0, 0.005, -0.49);
    for (let i = 0; i < 4; i++) B(a, 0.014, 0.018, 0.075, zs, -0.033 + i * 0.022, 0.004, -0.565, 0.25);
    B(a, 0.016, 0.02, 0.05, zs, sx * -0.05, 0.0, -0.5, 0, sx * 0.6, 0);
    B(a, 0.07, 0.008, 0.16, bl, 0.01, 0.036, -0.3); B(a, 0.11, 0.06, 0.12, M.cuff, 0, 0, 0.02);
    a.rotation.set(0.12, sx * 0.2, 0);
    return a;
  };
  const L = arm(-1), R = arm(1);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  g.visible = false;
  return { group: g, L, R, claws: true };
}

// Granata qo'lda (4-o'rin): chap tugma bosib turilganda halqa sug'uriladi, qo'yib yuborilganda uloqtiriladi
export function buildGrenadeHand(era) {
  const M = mats(era), modern = era === 'modern';
  const g = new THREE.Group(), n = new THREE.Group(); g.add(n);
  let pin;
  if (!modern) {
    C(n, 0.034, 0.034, 0.095, M.olive, 0, 0.1, 0, 'y', 14);
    C(n, 0.036, 0.036, 0.008, M.blued, 0, 0.148, 0, 'y', 14); C(n, 0.036, 0.036, 0.008, M.blued, 0, 0.052, 0, 'y', 14);
    C(n, 0.0125, 0.0145, 0.2, M.wood, 0, -0.05, 0, 'y', 10);
    C(n, 0.016, 0.016, 0.014, M.metal, 0, -0.155, 0, 'y', 10);
    pin = new THREE.Group(); pin.position.set(0, -0.17, 0); n.add(pin);
    C(pin, 0.002, 0.002, 0.05, M.tan, 0, -0.025, 0, 'y', 6); ball(pin, 0.008, M.dot, 0, -0.055, 0);
    fist(n, M, 0, -0.07, 0.0, 0.052, 0.075, 0.06, false, -1);
    forearm(n, M, new THREE.Vector3(0.01, -0.1, 0.03), new THREE.Vector3(0.1, -0.27, 0.4));
    n.scale.setScalar(0.82); n.position.y = -0.03;
  } else {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), M.olive); body.scale.set(1, 1.12, 1); n.add(body);
    for (let i = 0; i < 4; i++) { const r = ring(n, 0.0362, 0.0016, M.dark, 0, -0.02 + i * 0.014, 0, 16); r.rotation.x = Math.PI / 2; r.scale.setScalar(Math.cos((-0.02 + i * 0.014) / 0.04)); }
    C(n, 0.011, 0.013, 0.022, M.metal, 0, 0.048, 0, 'y', 10);
    B(n, 0.012, 0.006, 0.02, M.metal, 0, 0.058, 0.004);
    B(n, 0.011, 0.07, 0.004, M.metal, 0, 0.022, 0.034, -0.32);                 // richag (qoshiq)
    pin = new THREE.Group(); pin.position.set(-0.012, 0.056, 0); n.add(pin);
    const pr = ring(pin, 0.011, 0.0014, M.steel, -0.012, 0, 0, 14); pr.rotation.y = Math.PI / 2;
    C(pin, 0.0012, 0.0012, 0.02, M.steel, 0.004, 0, 0, 'x', 6);
    fist(n, M, 0.002, -0.012, 0.012, 0.062, 0.07, 0.06, true, -1);
    forearm(n, M, new THREE.Vector3(0.014, -0.04, 0.04), new THREE.Vector3(0.1, -0.2, 0.42));
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  g.visible = false;
  return { group: g, nade: n, pin };
}

// ---------- Noyob qurollar (podvallarda va binolarda topiladi) ----------
// rpg — transportga qulflanadi (lockon): mo'ljalda bir soniya poylansa, raketa nishonni o'zi quvadi.
// turret — yerga o'rnatiladigan avtomatik pulemyot (js/turret.js). drone — o'yinchining o'zi boshqaradigan dron: 1 ta bomba, nishonga borib urilsa portlaydi, bitta o'q tegsa yo'q bo'ladi (js/drone.js).
// amr — zirh teshar yirik kalibrli miltiq.
export function specialWeapons(era) {
  const H = era === 'historical';
  return [
    { id: 'rpg', name: H ? 'Bazuka M-9' : 'RPG-7', short: H ? 'Bazuka' : 'RPG-7', projectile: 'rocket', lockon: true, dmg: 0, head: 1, rpm: 40, mag: 1, reserve: 5, reload: 3.0, auto: false,
      hip: 0.02, spread: 0.004, bloom: 0, recoil: 0.09, recoilH: 0.02, adsFov: 55, adsTime: 0.3, range: 400, sound: 'rocket', model: 'rpg', move: 0.85, special: true },
    { id: 'turret', name: H ? "Qo'riqchi pulemyot (o'zi otadi)" : 'Avtomatik turel', short: 'Turel', deploy: 'turret', dmg: 0, head: 1, rpm: 40, mag: 1, reserve: 1, reload: 2.2, auto: false,
      hip: 0.02, spread: 0.01, bloom: 0, recoil: 0, recoilH: 0, adsFov: 70, adsTime: 0.3, range: 60, sound: 'mg', model: 'minigun', move: 0.82, special: true },
    { id: 'amr', name: H ? 'PTR-41 tankbuzar' : 'Burgut .50', short: H ? 'PTR-41' : 'Burgut', dmg: 260, head: 2, rpm: 38, mag: 5, reserve: 15, reload: 3.6, auto: false,
      hip: 0.1, spread: 0, bloom: 0.03, recoil: 0.11, recoilH: 0.02, adsFov: 11, adsTime: 0.36, range: 600, sound: 'sniper', model: 'sniper', move: 0.85,
      bolt: true, scope: true, special: true, vehMul: 1.5, ap: true },
    { id: 'drone', name: H ? 'Radio-boshqariladigan dron' : 'FPV dron', short: 'Dron', deploy: 'drone', dmg: 0, head: 1, rpm: 34, mag: 1, reserve: 0, reload: 2.4, auto: false,
      hip: 0.02, spread: 0.01, bloom: 0, recoil: 0, recoilH: 0, adsFov: 70, adsTime: 0.25, range: 200, sound: 'gl', model: 'gl', move: 0.9, special: true },
  ];
}
// Transportga o'rnatilgan pulemyot (ko'rinish modeli uchun)
export const MOUNT_DEF = { id: 'mount', name: 'Bort pulemyoti', model: 'mg' };

// Qurol tanasini modelga almashtiruvchi (darhol urinadi; model hali yuklanmagan bo'lsa — keyinroq chaqiriladigan funksiya qaytaradi)
// (vm — ko'rinish modeli: unga mo'ljaldagi xiralik chegarasi yoziladi)
function gunSkinner(def, gun, parts, muzzleZ, eyeZ, vm, keepParts, autoAds) {
  if (!def) return null;
  const run = () => {
    const g = skinGun(def, gun, parts, muzzleZ, eyeZ, { mag: vm && vm.mag, magBase: vm && vm.magBase, keepParts });
    if (g && vm) {
      vm.dofRange = g.userData.dofRange || null;
      const A = g.userData.ads;
      if (autoAds && A && !def.keep) {
        // ko'z mo'ljal chizig'ida, orqa mo'ljal (optika) ortida; yaqin maydon xiraligi faqat ko'zga juda yaqin qismlarga (mo'ljal tiniq qoladi)
        vm.ads.set(0, 0, -A.z); vm.dofRange = [0.02, 0.05];
        // kollimator optika: o'rtasida qizil nuqta (modelning o'zida yo'q)
        if (A.optic && !vm.reticle) {
          const ret = new THREE.Mesh(new THREE.PlaneGeometry(0.011, 0.011), new THREE.MeshBasicMaterial({ map: holoTexture(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
          ret.position.set(0, 0, (A.front + A.rear) / 2); ret.renderOrder = 6; gun.add(ret); vm.reticle = ret;
        }
      }
    }
    return !!g;
  };
  return run() ? null : run;
}
