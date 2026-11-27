// Zombi rejimi uchun main tomondagi qism: fonar, yashik quroli, punktlar, zombi-o'yinchi, xost holati.
import * as THREE from '../lib/three.module.js';
import { DEFIB_HP, WILD } from './shared.mjs';
import { EYE_H, G, _f, _r, _u, camBasis, camera, effQ, player, sound } from './core.js';
import { banner, buildSlots, clearOverlays, feed, hitmarker, popup, relToPlayer } from './hud.js';
import { cancelThrow, cur, makeWeapon, vmRoot } from './arsenal.js';
import { damagePlayer, endGame } from './game.js';
import { ME, damageVehicle, dropSpecial, leaveVehicleLocal } from './transport.js';
import { nameOf, net, remotes } from './mp.js';
import { GFX } from './gfx.js';
import { CLAW, WEAPONS, buildClaws } from './weapons.js';
import { Zombie } from './zombie.js';
import { XP, addXp } from './progress.js';
import { evacAboard, evacFreeze, evacHas, evacObjective, evacPreload, evacStartSP, evacTarget } from './evac.js';
import { activeTent, tentFront } from './revive.js';

// ---------- Zombi rejimi: fonar, yashikdagi qurol, punktlar ----------
export function setupTorch() {
  evacPreload();   // (tungi zombi jangi — oxirida evakuatsiya vertolyoti kerak bo'ladi)
  const L = new THREE.SpotLight(0xfff0d2, 0, 60, 0.5, 0.6, 1.0);   // qorong'ida oldinga yoritadi
  // yuqori sifatda fonar soya tashlaydi: zombilar va to'siqlarning uzun soyalari
  if (!GFX.lite && (effQ() === 'high' || effQ() === 'ultra')) {
    L.castShadow = true; const ms = effQ() === 'ultra' ? 2048 : 1024;
    L.shadow.mapSize.set(ms, ms); L.shadow.camera.near = 0.6; L.shadow.camera.far = 60; L.shadow.bias = -0.0015; L.shadow.normalBias = 0.02;
  }
  G.scene.add(L); G.scene.add(L.target);
  G.torch = L; G.torchOn = true;
}
export function toggleTorch() {
  if (!G.torch) { popup('Fonar faqat tungi rejimda ishlaydi', true); return; }
  if (G.isZ) return;
  G.torchOn = !G.torchOn; sound.click();
  popup(G.torchOn ? 'Fonar yoqildi' : "Fonar o'chirildi");
}
export const TORCH_I = 46;
export function updateTorch(dt) {
  const L = G.torch;
  if (!L) return;
  camBasis();
  L.position.copy(camera.position).addScaledVector(_r, 0.14).addScaledVector(_u, -0.12);
  L.target.position.copy(camera.position).addScaledVector(_f, 12);
  L.intensity += ((G.torchOn && player.alive && !G.isZ && !evacFreeze() ? TORCH_I : 0) - L.intensity) * Math.min(1, dt * 14);   // (vertolyotda va kinoda fonar o'chiq)
}
// Yashikdan topilgan qurol: o'q-dorisi cheklangan (jami). Shu turdagi qurol qo'lda bo'lsa — o'q-dori to'ldiriladi.
export const ZAMMO = { ar: 300, smg: 300, shotgun: 40, sniper: 20 };
export function giveCrateWeapon(kind) {
  const def = WEAPONS[G.era][kind] || WEAPONS[G.era].ar, total = ZAMMO[def.id] || 120, old = G.weapons[0];
  if (!old.locked && old.def.id === def.id) { old.mag = def.mag; old.reserve = total - def.mag; }
  else {
    old.vm.group.visible = false; vmRoot.remove(old.vm.group); old.vm.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    const w = makeWeapon(def, G.era); w.vm.group.visible = false; vmRoot.add(w.vm.group);
    w.mag = def.mag; w.reserve = total - def.mag;
    G.weapons[0] = w;
  }
  // topilgan qurol darhol qo'lga olinadi
  cancelThrow();
  cur().vm.group.visible = false;
  G.wi = 0; G.reloadT = 0; G.switchT = 0.45; G.ads = 0;
  cur().vm.group.visible = true;
  buildSlots();
  banner(def.name.toUpperCase(), `Jami ${total} ta o'q — tejab ishlating · [1] tugmasi`, 2.8);
  sound.ping();
}
// Bosqich bajarildi (i — bajarilgan bosqich raqami): mukofot, e'lon, yaqin atrofdagi transportga yoqilg'i va o'q-dori
export function zOnStage(i) {
  const st = WILD.stages[i], P = player;
  if (!G.mp && P.alive) P.hp = Math.max(P.hp, 100);
  let fed = 0;
  const cx = st.x !== undefined ? st.x : P.pos.x, cz = st.z !== undefined ? st.z : P.pos.z;
  for (const v of G.vehicles) if (v.alive && Math.hypot(v.pos.x - cx, v.pos.z - cz) < 45) { v.refill(0.5); fed++; }
  const veh = fed ? " · yaqindagi transportga yoqilg'i quyildi" : '';
  if (!G.isZ) G.grenades_n = Math.min(4, G.grenades_n + (i === 0 ? 2 : i === 2 ? 2 : 1));
  if (i === 0) banner("OQTEPA QISHLOG'I", "Uylardan qurol, o'q-dori va dori qidiring · endi ratsiya qismlarini toping (3 ta, ko'k halqalar)" + veh, 7);
  else if (i === 1) banner("QISMLAR TO'PLANDI", "Radio minoraga boring (shimoli-g'arb, o'rmon ichida) va signal yuboring" + veh, 7);
  else if (i === 2) banner('SIGNAL YUBORILDI', "Vertolyot harbiy bazaga keladi (shimoli-sharq). TUN KIRDI — zombilar ko'paydi" + veh, 7);
  else if (i === 3) banner('HARBIY BAZA', "Vertolyot maydonini (yashil halqa) egallang va vertolyot kelguncha ushlab turing" + veh, 7);
  sound.horn();
  if (!G.isZ) addXp(XP.stage);
  buildSlots();
}
// Ratsiya qismi topildi (by — kim: 0 yoki o'z raqamimiz — o'zimiz; n — nechtasi topilgani)
export function zOnPart(i, by, n) {
  const p = WILD.parts[i], mine = !by || by === G.myId;
  banner(`${p.name.toUpperCase()} TOPILDI`, `${mine ? '' : nameOf(by) + ' topdi · '}${n}/${WILD.parts.length} · ehtiyot bo'ling — shovqin zombilarni chaqirdi`, 4.5);
  sound.ping();
  if (mine && !G.isZ) addXp(Math.round(XP.stage / 2));
}
// Yakka o'yin: halok bo'lgach davom etish. how: 'defib' — defibrillyator shu joyning o'zida tiriltirdi (imkoniyat sarflanmaydi);
// aks holda — oxirgi ochilgan tiriltirish punkti (chodir) oldida, how — uning nomi
export function zRespawn(cp, lives, how = '') {
  const P = player, defib = how === 'defib';
  if (!defib) { P.pos.set(cp.x, 0, cp.z); G.world.collideCircle(P.pos, 0.4, 0, 1.98); }
  P.vel.set(0, 0, 0);
  P.hp = defib ? DEFIB_HP : 100; P.alive = true; P.deathT = 0; P.lastHurt = -99; P.eyeH = EYE_H; P.crouch = false; P.prone = false;
  G.crouchToggle = false; G.proneToggle = false; G.vault = null; G.bandages = Math.max(G.bandages, 1); G.switchT = 0.4; G.reloadT = 0;
  G.protUntil = G.time + (defib ? 3 : 2);   // (bir zumda yana yiqitib qo'yilmasin)
  clearOverlays();
  if (defib) {
    // elektr zarbasi atrofdagi zombilarni itarib yuboradi
    for (const s of G.soldiers) if (s.isZombie && s.alive) { const dx = s.pos.x - P.pos.x, dz = s.pos.z - P.pos.z, d = Math.hypot(dx, dz); if (d < 7) { s.vel.x += (dx / (d || 1)) * 11; s.vel.z += (dz / (d || 1)) * 11; s.atkCd = 1.6; } }
    banner('DEFIBRILLYATOR!', `Yuragingiz qayta urdi — ${DEFIB_HP} jon, 3 soniya himoya. Tezroq chekining!`, 4.5);
    sound.ping(); buildSlots();
    return;
  }
  banner('YANA BIR IMKONIYAT', (how ? `Tiriltirish punkti (${how}) oldida o'zingizga keldingiz · ` : '') + (lives > 0 ? `yana ${lives} ta imkoniyat qoldi` : "bu — so'nggi imkoniyat"), 5);
}
// Zombilar quvadigan odamlar ro'yxati: yakka o'yinda — o'yinchi; tarmoqda — barcha tirik odam-o'yinchilar
// (crouch/prone/low/torch — zombilarning ko'rish masofasi va qadam shovqini uchun)
export const meHuman = { pos: player.pos, me: true, get alive() { return player.alive && !G.isZ && !evacAboard(); },   // (vertolyotga chiqqan odamga zombilar yetolmaydi)
  get veh() { return G.inVeh; }, get id() { return ME(); },
  get crouch() { return player.crouch; }, get prone() { return player.prone; }, get low() { return player.crouch || player.prone; }, get torch() { return !!G.torchOn; } };
export function zHumans() {
  const out = [meHuman];
  if (G.mp) for (const r of remotes.values()) if (!r.isZ && r.hasPos) out.push(r.human || (r.human = { pos: r.pos, get alive() { return r.alive && !r.isZ && !evacHas(r.id); }, get veh() { return r.veh; }, id: r.id,
    get crouch() { return !!r.crouch; }, get prone() { return !!r.prone; }, get low() { return !!(r.crouch || r.prone); }, torch: false }));
  return out;
}
export const zApi = { G, player, sound, get net() { return net; }, humans: zHumans, giveCrateWeapon, onStage: zOnStage, onPart: zOnPart, respawn: zRespawn, endZombie: (victory) => { if (!G.mp) endGame(victory); },
  evacStart: evacStartSP, evacTarget, evacObjective, tent: activeTent, tentFront };
G.camPos = camera.position;
G.zTargets = () => (G.zg ? G.zg.humans() : []);
G.zGroan = () => { if (!G.zg || G.zg.groanGate > 0) return false; G.zg.groanGate = 0.4; return true; };
// Zombi odamni qancha masofadan ko'radi: shomda uzoqroq, tunda yaqinroq; yotgan/cho'kkalagan odam — ancha yaqindan;
// transportdagi yoki (tunda) fonar yoqqan odam — uzoqdan
G.zSight = (h) => {
  const dark = G.zg ? G.zg.dark : 1;
  let r = 44 - dark * 18;
  if (h.veh) r *= 1.5; else if (h.prone) r *= 0.35; else if (h.crouch) r *= 0.6;
  if (h.torch && dark > 0.4) r *= 1.35;
  return r;
};
// Shovqin: zombilar eshitadi (faqat zombilarni boshqaruvchi kompyuterda hisoblanadi). Manba — shu joydagi odam (bo'lsa).
G.zNoise = (x, z, r) => {
  const zg = G.zg;
  if (!zg || !zg.host) return;
  let src = null; for (const h of zg.humans()) if (h.alive && Math.hypot(h.pos.x - x, h.pos.z - z) < 4) { src = h; break; }
  zg.noise(x, z, r, src);
};
G.zHeard = (pos) => (G.zg ? G.zg.heard(pos) : null);
// Chinqiroq zombi baqirdi: atrofdagi (55 m) hamma zombi uyg'onadi
G.zScream = (z) => {
  if (G.zg) G.zg.noise(z.pos.x, z.pos.z, 55, null, true);
  const pd = relToPlayer(z.pos); sound.zombie(pd.dist, pd.pan, true);
  if (pd.dist < 60 && !G.isZ) popup('Chinqiroq zombi baqirdi — atrofdagilar yugurib kelmoqda!', true);
};
// Zombi zarbasi: yakka o'yinda — to'g'ridan-to'g'ri (yopiq transport himoyalaydi); tarmoqda — server orqali
G.zAttack = (z, t, dmg) => {
  const pd = relToPlayer(z.pos); sound.zombieHit(pd.dist, pd.pan);
  if (G.mp) {
    if (t.veh && t.veh.alive && t.veh.T.enclosed) damageVehicle(t.veh, dmg * (t.veh.T.bulletMul ?? 1), 'zombie');
    else net.send({ t: 'zatk', target: t.id, dmg, x: +z.pos.x.toFixed(1), z: +z.pos.z.toFixed(1) });
    return;
  }
  damagePlayer(dmg, z.pos, z);
};

// O'yinchi zombiga aylandi (tarmoq): qurollar o'rniga panjalar, fonar yo'q, qorong'ida uzoqroq ko'radi
export function becomeZombie() {
  if (G.isZ) return;
  G.isZ = true;
  leaveVehicleLocal(); dropSpecial(false);
  for (const w of G.weapons) w.vm.group.visible = false;
  G.weapons[0].locked = true; G.weapons[1].locked = true; G.weapons[3].locked = true;
  vmRoot.remove(G.weapons[2].vm.group);
  const cw = { def: CLAW, vm: buildClaws(G.era) }; vmRoot.add(cw.vm.group);
  G.weapons[2] = cw; G.knifeVM = cw.vm;
  G.wi = 2; G.grenades_n = 0; G.reloadT = 0; G.ads = 0; G.knifeT = 0; G.throwT = 0; G.cookT = -1; G.switchT = 0.4; G.torchOn = false;
  if (G.zg) G.world.setDark(G.zg.dark, true);   // zombi tunda yaxshiroq ko'radi (odamlarni topishi uchun)
  buildSlots();
  banner('SIZ ZOMBISIZ', "Odamlarni toping va yuqtiring · chap tugma — panja · o'ng tugma — tishlash", 5.5);
}
// Zombilarni kim boshqarishi o'zgardi (xost chiqib ketsa, keyingi o'yinchi davom ettiradi)
export function setZHost(host) {
  const z = G.zg;
  if (!z || z.host === host) return;
  z.host = host;
  for (const s of G.soldiers) if (s.isZombie) { s.local = host; if (host) { s.vel.set(0, 0, 0); z.zid = Math.max(z.zid, s.zid + 1); } else if (s.alive) z.remote.set(s.zid, s); }
  if (host) z.remote.clear();
}
// Xostdan kelgan zombilar holati: yangilarini yaratadi, ro'yxatdan chiqqanlarini olib tashlaydi
export const ZK = ['walker', 'runner', 'brute', 'screamer'];
export function onZombieState(list) {
  const z = G.zg;
  if (!z || z.host || !Array.isArray(list)) return;
  const seen = new Set();
  for (const st of list) {
    if (!Array.isArray(st) || st.length < 6) continue;
    seen.add(st[0]);
    let zb = z.remote.get(st[0]);
    if (!zb) { zb = new Zombie(G, new THREE.Vector3(st[1], st[2], st[3]), ZK[st[6]] || 'walker', st[0], false); zb.yaw = st[4]; G.soldiers.push(zb); z.remote.set(st[0], zb); }
    zb.setNet(st);
  }
  for (const [id, zb] of z.remote) if (!seen.has(id)) { z.remote.delete(id); if (zb.alive) { zb.alive = false; zb.dispose(); } }
}
export function sendZombieState() {
  const out = [];
  for (const s of G.soldiers) if (s.isZombie && s.alive) out.push([s.zid, +s.pos.x.toFixed(2), +s.pos.y.toFixed(2), +s.pos.z.toFixed(2), +s.yaw.toFixed(2), s.atkT > 0 ? 1 : 0, ZK.indexOf(s.kind)]);
  net.send({ t: 'zs', z: out });
}
// Boshqa o'yinchining o'qi zombiga tegdi (jon hisobi xostda yuritiladi)
export function onZombieHit(o) {
  const z = G.zg;
  if (!z || !z.host) return;
  const zb = G.soldiers.find((s) => s.isZombie && s.zid === o.z && s.alive);
  const r = remotes.get(o.by);
  if (zb) zb.damage(o.dmg, r ? r.pos : null, !!o.head, { id: o.by, team: 'remote' }, o.kind);
}
export function onZombieDead(o) {
  const zb = G.soldiers.find((s) => s.isZombie && s.zid === o.z);
  if (zb && zb.alive) { zb.alive = false; zb.deadT = 0; zb.fallDir = Math.random() < 0.5 ? 1 : -1; zb.fallSpin = (Math.random() - 0.5) * 0.8; for (const m of zb.mats) if (m.emissive) m.emissive.setHex(0); }
  if (G.zg) G.zg.remote.delete(o.z);
  if (o.by === G.myId) { G.kills++; if (o.head) G.headshots++; popup(o.head ? '+30' : '+20'); hitmarker(true); sound.kill(); addXp(XP.zombieKill); }
  if (o.by) feed(nameOf(o.by), o.by === G.myId ? 'me' : 'al', 'Zombi', 'en', o.head ? '⦿' : '☠');
}
