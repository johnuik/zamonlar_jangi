// Yerdan olinadigan vositalar: aptechka, bint, zirh nimcha, adrenalin, o'q-dori, granatalar.
// Ustidan yurib o'tilganda olinadi (kerak bo'lsa); 30 soniyadan keyin joyida qayta paydo bo'ladi.
// Bint [H] — cho'ntakda olib yuriladi: 1,5 soniyada bog'lanadi va 40 jon qaytaradi.
import * as THREE from '../lib/three.module.js';
import { G, clamp, mouse, player, sound } from './core.js';
import { banner, buildSlots, popup } from './hud.js';
import { isGun, refit, setSlotWeapon } from './arsenal.js';
import { net } from './mp.js';
import { ARMOR_MAX, BR_BASE, ITEM_RESPAWN, LOOT_BASE, LOOT_RESPAWN } from './shared.mjs';
import { ATTACH, SIDEARMS, WEAPONS, buildViewmodel, withAttachments } from './weapons.js';

export const ITEM_KINDS = {
  med:   { name: 'Aptechka', color: '#e9e9e4', mark: '✚', mc: '#d32222', desc: "jon to'liq tiklandi, +1 bint" },
  band:  { name: 'Bintlar', color: '#d9cfb4', mark: '≡', mc: '#9a2c2c', desc: '+2 bint — [H] bilan ishlating' },
  armor: { name: 'Zirh nimcha', color: '#46586a', mark: '⛨', mc: '#bfe2ff', desc: 'zararning yarmini yutadi' },
  adr:   { name: 'Adrenalin', color: '#f0bd2c', mark: '⚡', mc: '#2a1e00', desc: '20 soniya tezroq harakat, +30 jon' },
  ammo:  { name: "O'q-dori", color: '#4c5c36', mark: '▮▮▮', mc: '#ffcc55', desc: "o'q-dori to'ldirildi" },
  nade:  { name: 'Granatalar', color: '#39482a', mark: '●●', mc: '#ff8a33', desc: '+2 granata' },
  // jang maydoni rejimi
  helm:  { name: 'Shlem', color: '#4d5a48', mark: '⛑', mc: '#e8f0d8', desc: 'boshga tekkan zararning yarmini oladi' },
  att:   { name: "Qo'shimcha", color: '#2c333c', mark: '⌖', mc: '#8fd3ff', desc: 'qurolga o\'rnatildi' },
  // zombi rejimi (tiriltirish punktlarida)
  defib: { name: 'Defibrillyator', color: '#2f8f4e', mark: '♥', mc: '#ffffff', desc: "yiqilgan sherik yonida [E] — uni tiriltiradi (yakka o'yinda — halok bo'lsangiz o'zingizni)" },
};
const isBR = () => !!G.mp && G.mpMode === 'br';
// ---------- Jang maydoni: o'lja ro'yxati (urug' bo'yicha — hamma o'yinchida bir xil) ----------
// Har xonada 3–5 ta narsa: birinchisi doim qurol, qolganlari — og'irligiga qarab. Tartib va raqamlar (BR_BASE + i) hamma mijozda bir xil chiqadi.
const BR_W = [['ammo', 26], ['att', 13], ['helm', 9], ['armor', 8], ['band', 13], ['med', 6], ['adr', 3], ['nade', 5], ['gun', 17]];
const BR_GUNS = [['ar', 3], ['smg', 3], ['shotgun', 2], ['dmr', 1.6], ['lmg', 1.2], ['sniper', 1.4], ['ar2', 1.6], ['smg2', 1.6], ['shotgun2', 1.2], ['pistol', 2.4], ['pistol2', 1.5]];
const BR_ATT = ['optic', 'extmag', 'supp', 'grip', 'laser'];
const BR_OFF = [[0, 0], [0.95, 0.55], [-0.85, 0.7], [0.6, -0.95], [-0.75, -0.8]];
const pickW = (list, r) => { let t = 0; for (const e of list) t += e[1]; let x = r * t; for (const e of list) { x -= e[1]; if (x <= 0) return e[0]; } return list[0][0]; };
export function brList() {
  if (G.brItems && G.brItems.seed === G.lootSeed && G.brItems.world === G.world) return G.brItems.list;
  const rnd = seeded((G.lootSeed | 0) * 31 + 977), W = G.world, list = [], v = new THREE.Vector3();
  const add = (x, y, z, kind) => {
    const o = { id: BR_BASE + list.length, kind, x, y, z }, r = rnd();   // (har narsa uchun aynan bitta tasodifiy son — ro'yxat uzunligi va raqamlar hech narsaga bog'liq emas)
    if (kind === 'gun') o.sub = pickW(BR_GUNS, r); else if (kind === 'att') o.sub = BR_ATT[Math.min(BR_ATT.length - 1, (r * BR_ATT.length) | 0)]; else if (kind === 'helm') o.lv = r < 0.5 ? 1 : r < 0.85 ? 2 : 3;
    list.push(o);
  };
  for (const sp of W.roomSpots || []) {
    const n = 3 + Math.min(2, (rnd() * 3) | 0);
    for (let k = 0; k < n; k++) {
      let x = sp.x + BR_OFF[k][0], z = sp.z + BR_OFF[k][1];
      if (k && W.pointInBox(v.set(x, sp.y + 0.35, z))) { x = sp.x + BR_OFF[k][0] * 0.28; z = sp.z + BR_OFF[k][1] * 0.28; }   // jihoz ichiga tushsa — xona o'rtasiga yaqinroq
      add(x, sp.y, z, k === 0 ? 'gun' : pickW(BR_W, rnd()));
    }
  }
  for (const sp of W.itemSpots || []) add(sp.x, sp.y, sp.z, sp.kind);
  G.brItems = { seed: G.lootSeed, world: W, list };
  return list;
}
// Topilgan qo'shimchalarni qo'ldagi qurollarga o'rnatish (mos kelganlari)
const brDef = (def) => withAttachments(WEAPONS[G.era][def.id] || def, [...(G.brAtt || [])], 5);
function brRefit() { for (const slot of [0, 1]) { const w = G.weapons[slot]; if (w && !w.locked && isGun(w)) refit(slot, brDef(w.def)); } }
export const MAX_BAND = 4, BAND_HP = 40, BAND_T = 1.5, ADR_T = 20, ADR_HP = 30;

const texCache = {};
function itemTexture(kind) {
  if (texCache[kind]) return texCache[kind];
  const K = ITEM_KINDS[kind], c = document.createElement('canvas'); c.width = c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = K.color; g.fillRect(0, 0, 96, 96);
  g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 6; g.strokeRect(3, 3, 90, 90);
  g.fillStyle = K.mc; g.font = 'bold 52px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(K.mark, 48, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[kind] = t);
}

// Jang boshida: xaritadagi joylar (world.itemSpots) bo'yicha vositalarni yaratish
export function setupItems() {
  G.bandages = G.zombie ? 1 : 2; G.armor = 0; G.adrT = 0; G.healT = 0; G.defib = 0; G.tentCd = []; G.protUntil = 0;
  const br = isBR(), src = br ? brList().filter((o) => o.kind !== 'gun') : (G.world.itemSpots || []).map((s, id) => Object.assign({ id }, s));
  G.itemById = new Map();
  G.items = src.map((s) => {
    const id = s.id;
    const mat = new THREE.MeshStandardMaterial({ map: itemTexture(s.kind), roughness: 0.7 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.3, 0.3), mat);
    m.castShadow = true; m.userData.dyn = true;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glintTex, color: s.kind === 'med' || s.kind === 'band' ? 0xff7766 : s.kind === 'armor' ? 0x88c8ff : s.kind === 'defib' ? 0x7dff9a : 0xffd070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55, fog: false }));
    glow.scale.set(1.1, 1.1, 1); m.add(glow);
    m.position.set(s.x, s.y + 0.4, s.z); G.scene.add(m);
    const it = { id, kind: s.kind, sub: s.sub, lv: s.lv, pos: new THREE.Vector3(s.x, s.y, s.z), taken: false, respT: 0, askT: -9, mesh: m };
    G.itemById.set(id, it);
    return it;
  });
}

// Shu vosita hozir kerakmi (keraksizini olib, boshqalarga qoldirmaslik uchun)
function wants(kind, it) {
  const P = player;
  if (kind === 'helm') return (G.helm | 0) < ((it && it.lv) || 1);
  if (kind === 'att') return !!it && !(G.brAtt && G.brAtt.has(it.sub));
  if (kind === 'med') return P.hp < 100 || G.bandages < MAX_BAND;
  if (kind === 'band') return G.bandages < MAX_BAND;
  if (kind === 'armor') return G.armor < ARMOR_MAX - 5;
  if (kind === 'adr') return G.adrT < 3;
  if (kind === 'defib') return !(G.defib > 0);   // (bittadan ortiq olib yurilmaydi)
  if (kind === 'nade') return G.grenades_n < 4 && !(G.mp && G.mpMode === 'gg');   // (gun game'da granata yo'q)
  if (kind === 'ammo') return G.weapons.some((w) => isGun(w) && !w.locked && !w.def.special && !w.inf && (G.zombie || w.reserve < w.def.reserve));
  return false;
}
// Vositaning ta'siri (tarmoqda jon va zirhni server ham o'zida yuritadi)
export function applyItem(kind, it) {
  const P = player, K = ITEM_KINDS[kind];
  if (!K) return;
  if (kind === 'helm') { G.helm = (it && it.lv) || 1; popup(`SHLEM (${G.helm}-daraja): ${K.desc}`); sound.ping(); buildSlots(); return; }
  if (kind === 'att') {
    const a = it && ATTACH[it.sub];
    if (!a) return;
    (G.brAtt || (G.brAtt = new Set())).add(it.sub); brRefit();
    popup(`${a.name.toUpperCase()}: ${a.desc}`); sound.reload('in'); buildSlots(); return;
  }
  if (kind === 'med') { P.hp = 100; G.bandages = Math.min(MAX_BAND, G.bandages + 1); }
  else if (kind === 'band') G.bandages = Math.min(MAX_BAND, G.bandages + 2);
  else if (kind === 'armor') G.armor = ARMOR_MAX;
  else if (kind === 'adr') { G.adrT = ADR_T; P.hp = Math.min(100, P.hp + ADR_HP); }
  else if (kind === 'nade') G.grenades_n = Math.min(4, G.grenades_n + 2);
  else if (kind === 'defib') G.defib = 1;
  else if (kind === 'ammo') {
    for (const w of G.weapons) {
      if (!isGun(w) || w.locked || w.def.special || w.inf) continue;
      w.reserve = G.zombie ? w.reserve + w.def.mag : isBR() ? Math.min(w.def.reserve, w.reserve + w.def.mag * 2) : w.def.reserve;   // zombi rejimida o'q-dori tanqis: bitta magazin; jang maydonida — ikkita
    }
  }
  popup(`${K.name.toUpperCase()}: ${K.desc}`);
  if (kind === 'ammo' || kind === 'nade') sound.reload('in'); else sound.ping();
  buildSlots();
}
function take(it) {
  if (G.mp) { it.askT = G.time; net.send({ t: 'item', id: it.id, k: it.kind, lv: it.lv }); return; }   // tarmoqda — server tasdiqlagach olinadi
  it.taken = true; it.respT = ITEM_RESPAWN; it.mesh.visible = false;
  applyItem(it.kind, it);
}
// Tarmoq: kimdir vositani oldi
export function onItemTaken(o) {
  const l = G.lootById && G.lootById.get(o.id);
  if (l) {   // xonadagi qurol
    if (l.dead) return;
    l.taken = true; if (l.mesh) l.mesh.visible = false;
    if (o.by === G.myId) giveGun(l.def);
    return;
  }
  const it = G.itemById && G.itemById.get(o.id);
  if (!it) return;
  it.taken = true; it.mesh.visible = false;
  if (o.by === G.myId) applyItem(it.kind, it);
}
// Tarmoq: serverdagi olingan vositalar ro'yxati (har holat xabarida)
export function syncItems(list) {
  if (G.loot) for (const l of G.loot) l.taken = !!l.dead || list.includes(l.id);
  if (!G.items) return;
  for (const it of G.items) it.taken = list.includes(it.id);
}

export function updateItems(dt) {
  const P = player;
  if (G.adrT > 0) G.adrT = Math.max(0, G.adrT - dt);
  // bint bog'lash: tugma bosilgandan 1,5 soniya o'tgach jon qaytadi; o'q uzilsa — to'xtaydi (bint sarflanmaydi)
  if (G.healT > 0) {
    if (!P.alive || mouse.L || G.knifeT > 0 || G.throwT > 0) G.healT = 0;
    else {
      G.healT -= dt;
      if (G.healT <= 0) {
        G.healT = 0; G.bandages--;
        if (G.mp) net.send({ t: 'heal', amt: BAND_HP });
        P.hp = Math.min(100, P.hp + BAND_HP);
        popup(`+${BAND_HP} JON`); sound.ping(); buildSlots();
      }
    }
  }
  updateLoot(dt);
  if (!G.items) return;
  const can = P.alive && !G.inVeh && !G.isZ && G.state === 'playing';
  for (const it of G.items) {
    if (!G.mp && it.taken && !G.zombie) { it.respT -= dt; if (it.respT <= 0) it.taken = false; }   // (zombi rejimida olingan narsa qaytmaydi — zaxira tanqis)
    const far = isBR() && Math.hypot(P.pos.x - it.pos.x, P.pos.z - it.pos.z) > 55;   // jang maydonida o'lja ko'p — uzoqdagilari chizilmaydi
    it.mesh.visible = !it.taken && !far;
    if (it.taken || far) continue;
    it.mesh.rotation.y += dt * 1.6;
    it.mesh.position.y = it.pos.y + 0.4 + Math.sin(G.time * 2.4 + it.id) * 0.06;
    if (can && G.time - it.askT > 1 && Math.abs(P.pos.y - it.pos.y) < 1.4 && Math.hypot(P.pos.x - it.pos.x, P.pos.z - it.pos.z) < 1.15 && wants(it.kind, it)) take(it);
  }
}
// [H] — bint bog'lash
export function useBandage() {
  const P = player;
  if (!P.alive || G.isZ || G.healT > 0 || G.state !== 'playing') return;
  if (G.bandages <= 0) { popup('Bint qolmadi — aptechka yoki bint toping', true); return; }
  if (P.hp >= 100) { popup("Jon to'la", true); return; }
  G.healT = BAND_T; G.reloadT = 0; G.ads = 0;
  sound.reload('out');
}
// ================= XONALARDAGI QUROLLAR =================
// Har jangda har bir xonada tasodifiy qurol paydo bo'ladi ([E] bilan olinadi: asosiy qurol yoki to'pponcha o'rniga).
// Qaysi xonada nima chiqishi urug'ga (G.lootSeed) bog'liq — tarmoqda hamma o'yinchida bir xil. Olingan qurol bir daqiqadan keyin qaytadi.
// Zombi rejimi: ko'proq to'pponcha, PP va drobovik; kuchli qurollar kam uchraydi. Topilgan qurolning o'qi tanqis (ikki magazin).
const LOOT_Z = [['pistol2', 3], ['smg', 3], ['shotgun', 2.5], ['smg2', 1.5], ['ar', 1.5], ['shotgun2', 1], ['dmr', 0.8], ['ar2', 0.6], ['sniper', 0.5], ['lmg', 0.4]];
const LOOT_W = [['ar', 3], ['smg', 3], ['shotgun', 2], ['dmr', 2], ['lmg', 1.6], ['sniper', 1.6], ['ar2', 1.6], ['smg2', 1.6], ['shotgun2', 1.2], ['pistol2', 1.5]];
// Urug'li tasodifiy sonlar (mulberry32)
export function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// qurolning yerda yotgan ko'rinishi (jang maydonida — o'yinchi yaqinlashganda yasaladi)
function lootMesh(def, x, y, z, rot) {
  const g = new THREE.Group(), vm = buildViewmodel(def, G.era, true);
  vm.group.scale.setScalar(1.35); vm.group.position.set(0, 0.12, 0.3); vm.group.rotation.z = Math.PI / 2;   // yonboshlab yotadi
  g.add(vm.group);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glintTex, color: 0x9fe8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.28, fog: false }));
  glow.scale.set(0.95, 0.95, 1); g.add(glow);
  g.position.set(x, y + 0.3, z); g.rotation.y = rot; g.userData.dyn = true; G.scene.add(g);
  return g;
}
export function setupLoot() {
  G.loot = []; G.lootById = new Map();
  if (isBR()) {
    const Wp = WEAPONS[G.era];
    G.loot = brList().filter((o) => o.kind === 'gun').map((o) => ({ id: o.id, def: Wp[o.sub] || Wp.ar, pos: new THREE.Vector3(o.x, o.y, o.z), taken: false, respT: 0, mesh: null, lazy: true }));
    for (const l of G.loot) G.lootById.set(l.id, l);
    return;
  }
  if (G.mp && G.mpMode === 'gg') return;   // gun game: xonalarda qurol yo'q — faqat daraja quroli
  const LW = G.zombie ? LOOT_Z : LOOT_W;
  const rnd = seeded((G.lootSeed | 0) * 7919 + 13), W = WEAPONS[G.era], tot = LW.reduce((a, w) => a + w[1], 0), spots = G.world.roomSpots || [];
  // "xalta": har bir qurol turi og'irligiga mos sonda solinadi, keyin aralashtiriladi — xaritada hamma tur uchraydi, lekin qaysi xonada qaysi biri — tasodifiy
  const bag = []; let acc = 0;
  for (const [id, w] of LW) { acc += (w / tot) * spots.length; while (bag.length < Math.round(acc)) bag.push(id); }
  for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
  G.loot = spots.map((sp, i) => {
    const def = W[bag[i] || LW[0][0]];
    // bu xonaga noyob qurol tushgan (transport.js: setupExtras) — oddiy qurol chiqmaydi
    if (G.specialRooms && G.specialRooms.has(i)) return { id: LOOT_BASE + i, def, pos: new THREE.Vector3(sp.x, sp.y, sp.z), taken: true, dead: true, respT: 0, mesh: null };
    const g = lootMesh(def, sp.x, sp.y, sp.z, rnd() * 6.28);
    return { id: LOOT_BASE + i, def, pos: new THREE.Vector3(sp.x, sp.y, sp.z), taken: false, respT: 0, mesh: g };
  });
  for (const l of G.loot) G.lootById.set(l.id, l);
}
const _le = new THREE.Vector3(), _lt = new THREE.Vector3();
export function nearestLoot() {
  const P = player;
  if (!G.loot || G.isZ) return null;
  let best = null, bd = 1.9;
  for (const l of G.loot) {
    if (l.taken) continue;
    const d = Math.hypot(l.pos.x - P.pos.x, l.pos.z - P.pos.z);
    // (devor ortidagi qurol olinmaydi: ko'zdan qurolgacha ko'rinish ochiq bo'lishi kerak)
    if (d < bd && Math.abs(l.pos.y - P.pos.y) < 1.5 && G.world.los(_le.set(P.pos.x, P.pos.y + Math.max(0.5, P.eyeH - 0.2), P.pos.z), _lt.set(l.pos.x, l.pos.y + 0.35, l.pos.z), P.vehBox)) { bd = d; best = l; }
  }
  return best;
}
export const lootSlot = (def) => (SIDEARMS.includes(def.id) ? 1 : 0);
// [E]: yonidagi qurolni olish. Qaytaradi: olindimi (yoki so'rov yuborildimi).
export function tryLoot() {
  const l = nearestLoot();
  if (!l || !player.alive || G.inVeh) return false;
  if (G.mp) { net.send({ t: 'item', id: l.id, k: 'gun' }); return true; }
  l.taken = true; l.respT = LOOT_RESPAWN; if (l.mesh) l.mesh.visible = false;
  giveGun(l.def);
  return true;
}
function giveGun(def) {
  const slot = lootSlot(def), was = G.weapons[slot], r0 = !was.locked && was.def.id === def.id ? was.reserve : 0;
  setSlotWeapon(slot, isBR() ? brDef(def) : def);
  if (isBR()) { const w = G.weapons[slot]; w.mag = w.def.mag; w.reserve = Math.min(def.reserve, r0 + w.def.mag); }   // jang maydoni: to'la magazin + bitta zaxira (qolgani — o'q-dori qutilaridan)
  if (G.zombie) { const w = G.weapons[slot]; w.reserve = Math.min(def.reserve, r0 + def.mag * 2); if (slot === 1) w.inf = true; }   // o'q tanqis; to'pponchaning o'qi tugamaydi (boshlang'ichdagi kabi)
  banner(def.name.toUpperCase(), `${slot === 0 ? 'Asosiy qurol' : "To'pponcha"} almashtirildi · [${slot + 1}] tugmasi`, 2.4);
  sound.ping();
}
function updateLoot(dt) {
  if (!G.loot) return;
  const P = player;
  let built = false;
  for (const l of G.loot) {
    if (l.dead) continue;
    if (!G.mp && l.taken && !G.zombie) { l.respT -= dt; if (l.respT <= 0) l.taken = false; }
    const near = !l.taken && Math.hypot(l.pos.x - P.pos.x, l.pos.z - P.pos.z) < 45;   // uzoqdagilar chizilmaydi (kadr tezligi uchun)
    if (near && !l.mesh && l.lazy) { if (built) continue; built = true; l.mesh = lootMesh(l.def, l.pos.x, l.pos.y, l.pos.z, (l.id * 2.399) % 6.28); }   // (kadriga bittadan — to'satdan qotib qolmasin)
    if (!l.mesh) continue;
    l.mesh.visible = near;
    if (near) l.mesh.rotation.y += dt * 0.9;
  }
}

export const healing = () => G.healT > 0;
export const armorFrac = () => clamp((G.armor || 0) / ARMOR_MAX, 0, 1);
