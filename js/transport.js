// Transport (o'yinchi tomoni): o'tirish/chiqish, kamera, qurollar, shikast, noyob qurollar, eslatmalar.
import * as THREE from '../lib/three.module.js';
import { CHAR_K, WILD } from './shared.mjs';
import { $, G, _dir, _f, _mz, _o, _tmp, _u, _wh, camBasis, camera, disposeTree, glintTex, keys, lerp, mouse, player, rnd, settings, sound } from './core.js';
import { banner, buildSlots, hitmarker, hudCache, popup, relToPlayer, setText } from './hud.js';
import { cancelThrow, cur, hitscan, isGun, mainSlot, switchWeapon, vmRoot } from './arsenal.js';
import { PROJ, explode, spawnProjectile } from './ordnance.js';
import { damagePlayer, useSupply } from './game.js';
import { aimFov, groundBelow } from './movement.js';
import { hostile, net, remotes, v3arr } from './mp.js';
import { buildChute } from './soldier.js';
import { animateSoldier, makeSoldierModel } from './soldiermodel.js';
import { Vehicle, gunCool, gunFire, newGun } from './vehicles.js';
import { buildViewmodel } from './weapons.js';
import { lootSlot, nearestLoot, seeded, tryLoot } from './items.js';
import { clearEvac } from './evac.js';
import { revivePrompt, tryRevive } from './revive.js';

export const VW = {
  heliMg: { dmg: 24, head: 1.5, range: 350, vehMul: 0.8, rpm: 750, spread: 0.012, sound: 'mg', heat: 0.022 },   // ~3.6 s uzluksiz otishda qizib ketadi
  doorMg: { dmg: 30, head: 1.5, range: 300, vehMul: 0.8, rpm: 650, spread: 0.01, sound: 'mg', heat: 0.02 },
  tankMg: { dmg: 26, head: 1.5, range: 300, vehMul: 0.6, rpm: 600, spread: 0.012, sound: 'mg' },
};
export const SEAT_HINTS = {
  heli0: "W/S/A/D — uchish · PROBEL/SHIFT — balandlik · Chap tugma: pulemyot (qiziydi) · O'ng tugma: raketa (12 ta) · F — chiqish",
  heli1: 'Sichqoncha — nishon · Chap tugma: bort pulemyoti (qiziydi) · F — chiqish',
  heli2: 'Chap eshik oldida · F — chiqish',
  heli3: "O'ng eshik oldida · F — chiqish",
  chinook0: "W/S/A/D — uchish · PROBEL/SHIFT — balandlik · Qurolsiz transport · F — o'rindan turish",
  chinook1: "Ikkinchi uchuvchi: uchuvchi safdan chiqsa, boshqaruv avtomatik sizga o'tadi · F — o'rindan turish",
  chinook2: "Sichqoncha — nishon · Chap tugma: bort pulemyoti (qiziydi) · F — o'rindan turish",
  chinook3: "Sichqoncha — nishon · Chap tugma: bort pulemyoti (qiziydi) · F — o'rindan turish",
  chinook4: "Yo'lovchi · F — o'rindan turish (orqa rampadan sakrash mumkin)",
  chinook5: "Yo'lovchi · F — o'rindan turish (orqa rampadan sakrash mumkin)",
  jeep0: 'W/S — gaz/tormoz · A/D — burilish · F — chiqish',
  jeep1: 'Sichqoncha — nishon · Chap tugma: pulemyot · F — chiqish',
  cannon0: "Sichqoncha — nishon · Chap tugma: o'q uzish · qalqon olddan kelgan o'qdan to'sadi · F — chiqish",
  tank0: "W/S — oldinga/orqaga · A/D — burilish · Sichqoncha — minora · Chap tugma: pushka · O'ng tugma: pulemyot · F — chiqish",
  tank1: 'Sichqoncha — nishon · Chap tugma: komandir pulemyoti · F — chiqish',
  ltank0: "W/S — oldinga/orqaga · A/D — burilish · Sichqoncha — minora · Chap tugma: tez otar pushka · O'ng tugma: pulemyot · F — chiqish",
  ltank1: 'Sichqoncha — nishon · Chap tugma: komandir pulemyoti · F — chiqish',
  quad0: 'W/S — gaz/tormoz · A/D — burilish · F — chiqish',
  quad1: "Yo'lovchi · F — chiqish",
  truck0: "W/S — gaz/tormoz · A/D — burilish · Kuzovga orqa zinadan yurib chiqiladi · F — chiqish",
  truck1: "Yo'lovchi (kabinada) · F — chiqish",
};
// ---------- Ko'rinish: 1-shaxs / 3-shaxs (har bir vazifa uchun alohida eslab qolinadi) ----------
G.viewPref = (() => { try { return JSON.parse(localStorage.getItem('zj_view') || '{}') || {}; } catch (e) { return {}; } })();
export function vehFP(v = G.inVeh, seat = G.seat) {
  if (!v) return false;
  const role = v.T.roles[seat], pref = G.viewPref[role];
  return pref === undefined ? role === 'gunner' || role === 'pass' : !!pref;   // boshlang'ich holat: o'qchi va yo'lovchi — 1-shaxs (qurol qo'lda), haydovchi/uchuvchi — 3-shaxs
}
// Transport ichida o'z qurolidan otish: yo'lovchi o'rnida — doim, o'qchi o'rnida — g'ildirak bilan tanlanganda. Faqat 1-shaxs ko'rinishida.
export function ownGunActive() {
  const v = G.inVeh;
  if (!v || !player.alive || !vehFP()) return false;
  const role = v.T.roles[G.seat];
  return role === 'pass' || (role === 'gunner' && !!G.ownGun);
}
export function seatGuns() { const out = []; G.weapons.forEach((w, i) => { if (isGun(w) && !w.locked) out.push(i); }); return out; }
// G'ildirak: yo'lovchi — o'z qurollari orasida; o'qchi — bort pulemyoti va o'z qurollari orasida almashtiradi
export function cycleSeatGun(dir = 1) {
  const v = G.inVeh;
  if (!v) return;   // (transportdan tushib bo'lgan — masalan, server o'rinni bermagan)
  const role = v.T.roles[G.seat];
  if (role !== 'pass' && role !== 'gunner') return;
  if (!vehFP()) { popup("Otish uchun 1-shaxs ko'rinishiga o'ting — [V]", true); return; }
  const guns = seatGuns();
  if (!guns.length) return;
  const list = role === 'gunner' ? [-1].concat(guns) : guns;   // −1 — bort pulemyoti
  let k = list.indexOf(role === 'gunner' && !G.ownGun ? -1 : G.wi);
  k = ((k < 0 ? 0 : k) + dir + list.length) % list.length;
  if (list[k] < 0) { G.ownGun = false; G.reloadT = 0; popup('Bort pulemyoti'); sound.reload('out'); return; }
  G.ownGun = true;
  if (list[k] !== G.wi) switchWeapon(list[k]); else G.switchT = 0.3;
  popup(cur().def.name);
}
// ---------- Transportdagi o'z personajimiz (3-shaxs ko'rinishida) ----------
export function setupAvatar() {
  const av = { s: CHAR_K, crouchAmt: 0, walkPhase: 0, gunKick: 0, fallDir: 1, fallSpin: 0 };
  // boshqalar bizni qanday ko'rsa, o'zimiz ham shunday ko'ramiz
  const lk = G.mp && G.mpMode !== 'zombie' ? ['remote', 'rifle'] : ['ally', 'ally'];
  av.root = makeSoldierModel(av, G.era, lk[0], lk[1]);
  av.root.visible = false; G.scene.add(av.root);
  G.avatar = av;
}
export function updateAvatar(dt) {
  const av = G.avatar, v = G.inVeh;
  if (!av) return;
  const show = !!v && v.alive && player.alive && !vehFP() && !(v.skin && v.skinDef && v.skinDef.show && !v.skinDef.show[G.seat]);   // (model qo'yilgan tankda haydovchi ichkarida)
  av.root.visible = show;
  if (!show) return;
  const role = v.T.roles[G.seat], aimer = role === 'gunner' || role === 'pass';
  v.seatPos(G.seat, av.root.position);
  av.root.rotation.y = aimer ? player.yaw + Math.PI : v.type === 'cannon' ? v.aimYaw : v.yaw;
  av.crouchAmt = v.seatSit(G.seat) ? 1 : 0; av.sit = av.crouchAmt === 1;
  animateSoldier(av, dt, 0, aimer, aimer ? player.pitch : 0);
}
export function toggleVehView() {
  const v = G.inVeh;
  if (!v) return;
  const fp = !vehFP();
  G.viewPref[v.T.roles[G.seat]] = fp ? 1 : 0;
  localStorage.setItem('zj_view', JSON.stringify(G.viewPref));
  G.vAim = null;
  popup(fp ? "1-shaxs ko'rinishi" : "3-shaxs ko'rinishi");
  sound.ui();
}
G.vehicles = []; G.projectiles = []; G.pickups = []; G.inVeh = null; G.seat = -1; G.chute = false; G.playerPit = -1;
G.aimPt = new THREE.Vector3(); G.vAim = null; G.chuteMesh = null;
G.vehicleCrash = (v, dmg) => damageVehicle(v, dmg, 'self');
G.spawnProjectile = (pos, vel, kind, team) => spawnProjectile(pos, vel, kind, team, null, false);
G.canEnemyRocket = () => {
  if (G.time - (G.lastEnemyRocket || -99) < 5) return false;
  G.lastEnemyRocket = G.time; return true;
};
export const ME = () => (G.mp ? G.myId : 1);

export function stopEngines() { for (const v of G.vehicles) if (v.snd) { v.snd.stop(); v.snd = null; } clearEvac(); }   // (jang tugadi yoki yangisi boshlandi — evakuatsiya vertolyoti ham tozalanadi)

export function setupExtras(spawns) {
  stopEngines();
  G.vehicles = (spawns || []).map((s, i) => new Vehicle(G, i, s.type, s.x, s.z, s.yaw));
  G.projectiles = []; G.inVeh = null; G.seat = -1; G.chute = false; G.vFireT = 0; G.vAltT = 0; G.enterT = -9; G.seatT = -9; G.alarmT = 0; G.playerPit = -1; G.vAim = null; G.gunHeat = newGun();
  G.platform = null; G.insideVeh = null; G.seatPick = 0; G.pickVeh = null;
  player.vehBox = null;
  // Noyob qurollar ham har jangda tasodifiy joylashadi: turlari teng taqsimlanadi, joylari esa — o'z supalari (podval, dot, minora)
  // va istalgan xona orasidan tanlanadi (o'sha xonada oddiy qurol chiqmaydi). Tarmoqda urug' serverdan keladi — hamma o'yinchida bir xil.
  // Urug' 0 (sinovlar) — o'zgarmas: har biri o'z supasida, turlari raqam tartibida.
  const WP = G.mp && G.mpMode === 'gg' ? [] : G.world.pickups, RS = G.world.roomSpots || [];   // gun game: noyob qurollar yo'q (faqat daraja quroli)
  // zombi rejimida avtomatik turel yo'q (o'zi otadigan pulemyot zombilarni o'yinchi o'rniga qirib tashlardi) — uning o'rniga boshqa noyob qurollar
  const SPX = G.zombie ? G.specials.filter((d) => d.id !== 'turret') : G.specials;
  const order = WP.map((p) => p.id % SPX.length), place = WP.map((p) => p.pos);
  G.specialRooms = new Set();
  if (G.lootSeed) {
    const rnd = seeded(G.lootSeed | 0);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (!G.zombie) {
      const pool = WP.map((p) => ({ pos: p.pos, room: -1 })).concat(RS.map((sp, i) => ({ pos: new THREE.Vector3(sp.x, sp.y + 0.95, sp.z), room: i })));
      for (let i = 0; i < place.length; i++) {
        const j = i + Math.floor(rnd() * (pool.length - i)); [pool[i], pool[j]] = [pool[j], pool[i]];
        place[i] = pool[i].pos; if (pool[i].room >= 0) G.specialRooms.add(pool[i].room);
      }
    }
  }
  G.pickups = WP.map((p0, pi) => {
    const p = { id: p0.id, pos: place[pi] };
    const def = SPX[order[pi]];
    const g = new THREE.Group();
    const vm = buildViewmodel(def, G.era, true);
    vm.group.scale.setScalar(1.5); vm.group.position.set(0, 0.1, 0.45);
    g.add(vm.group);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, color: 0xc98bff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    glow.scale.set(2.2, 2.2, 1); g.add(glow);
    g.position.copy(p.pos); G.scene.add(g);
    return { id: p.id, pos: p.pos, def, taken: false, respT: 0, mesh: g };
  });
  G.chuteMesh = buildChute(G.era); G.chuteMesh.scale.setScalar(CHAR_K); G.scene.add(G.chuteMesh);
  setupAvatar();
}

// ---------- O'tirish / chiqish ----------
export function freeSeat(v) { for (let i = 0; i < v.T.seats; i++) if (v.seats[i] == null) return i; return -1; }
// Transportning shu o'rnida o'tirgan raqib (tarmoqda). O'zimiz yoki bo'sh o'rin — null.
export function occupantAt(v, seat) {
  const id = v.seats[seat];
  if (id == null || id === ME()) return null;
  const r = remotes.get(id);
  return r && r.alive ? r : null;
}
export function nearestVehicle() {
  let best = null, bd = 1e9;
  for (const v of G.vehicles) {
    if (!v.alive || freeSeat(v) < 0) continue;
    const d = v.pos.distanceTo(player.pos);
    if (d < v.T.enterR && d < bd) { bd = d; best = v; }
  }
  return best;
}
export function tryEnterVehicle() {
  const v = nearestVehicle();
  if (!v || !player.alive) return;
  if (G.isZ) { popup("Zombilar transportga o'tira olmaydi", true); return; }
  const seat = pickedSeat(v);
  if (seat < 0) return;
  if (G.mp) { net.send({ t: 'venter', v: v.id, seat }); return; }
  enterVehicle(v, seat);
}
// O'tirishdan oldin tanlangan o'rin: [Q] bo'sh o'rinlar orasida almashtiradi (masalan, uchuvchi emas — o'qchi)
export function pickedSeat(v) {
  const free = [];
  for (let i = 0; i < v.T.seats; i++) if (v.seats[i] == null) free.push(i);
  return free.length ? free[G.seatPick % free.length] : -1;
}
// seat — yangi o'rin. Shu transport ichida bo'lsak, bu o'rin almashtirish (yoki boshqaruvni qabul qilish).
export function enterVehicle(v, seat, promoted) {
  if (!v || !v.alive || seat < 0 || seat >= v.T.seats) return;
  const change = G.inVeh === v;
  if (G.inVeh && !change) leaveVehicleLocal();
  if (change && v.seats[G.seat] === ME()) v.seats[G.seat] = null;
  if (!change) { G.enterT = G.time; G.gunHeat = newGun(); }
  G.inVeh = v; G.seat = seat; G.seatT = G.time; G.platform = null; G.insideVeh = null;
  v.seats[seat] = ME();
  if (seat === 0) v.owner = ME();
  player.vehBox = v.box;
  G.reloadT = 0; G.ads = 0; G.chute = false; G.crouchToggle = false; G.proneToggle = false; G.vault = null; cancelThrow();
  mouse.L = mouse.R = false;
  G.vAim = null; G.ownGun = false;
  const role = v.T.roles[seat];
  if (seat === 0) {
    // kamera transport ortida turadi (boshqaruvni qabul qilganda vertolyot yo'nalishini saqlaydi)
    player.yaw = (v.type === 'cannon' || v.T.tank ? v.aimYaw : v.yaw) + Math.PI;
    player.pitch = v.type === 'cannon' ? 0.05 : v.T.tank ? -0.1 : -0.18;
  } else if (role === 'gunner') {
    // bort o'qchisi o'z eshigi tomonga qaraydi
    v.gunPos(_tmp, seat);
    const c = Math.cos(v.yaw), s = Math.sin(v.yaw), lat = (_tmp.x - v.pos.x) * c - (_tmp.z - v.pos.z) * s;
    player.yaw = lat > 0.8 ? Math.atan2(-c, s) : lat < -0.8 ? Math.atan2(c, -s) : v.yaw + Math.PI;
    player.pitch = -0.15;
  } else { player.yaw = v.yaw + Math.PI; player.pitch = -0.18; }
  sound.door();
  if (promoted) { banner('BOSHQARUV SIZDA!', "Uchuvchi safdan chiqdi — vertolyotni endi siz boshqarasiz", 3.5); sound.alarm(); }
  else banner(v.T.name.toUpperCase(), v.T.seatNames[seat], 2);
}
// Transport ichida o'rin almashtirish: [1–6] — aniq o'rin, [Q] — keyingi bo'sh o'rin
export function requestSeat(i) {
  const v = G.inVeh;
  if (!v || i === G.seat || i < 0 || i >= v.T.seats) return;
  if (v.seats[i] != null) { popup(`${i + 1}-o'rin band`, true); return; }
  if (G.mp) net.send({ t: 'vswap', seat: i });
  else enterVehicle(v, i);
}
export function cycleSeat() {
  const v = G.inVeh;
  if (!v || v.T.seats < 2) return;
  for (let k = 1; k < v.T.seats; k++) {
    const i = (G.seat + k) % v.T.seats;
    if (v.seats[i] == null) { requestSeat(i); return; }
  }
  popup("Bo'sh o'rin yo'q", true);
}
export function leaveVehicleLocal() {
  const v = G.inVeh;
  if (!v) return;
  if (v.seats[G.seat] === ME()) v.seats[G.seat] = null;
  for (const m of v.fpHide) m.visible = true;
  G.inVeh = null; G.seat = -1; player.vehBox = null; G.switchT = 0.4;
  mouse.L = mouse.R = false;
  if (G.weapons) cur().vm.group.visible = true;
}
export function exitVehicle() {
  const v = G.inVeh, P = player;
  if (!v) return;
  const high = v.T.fly && v.pos.y - G.world.groundHeight(v.pos.x, v.pos.z, 0.4, v.pos.y, v.box) > 4;
  let stay = null;
  if (high && v.T.walk) {
    // Chinuk havoda: o'rindiqdan turib yuk bo'limida qolamiz — orqa rampadan yurib sakrash mumkin
    v.standPos(G.seat, P.pos); P.vel.set(0, 0, 0); P.onGround = true; stay = v;
    banner("YUK BO'LIMI", 'Orqa rampadan sakrang · havoda [PROBEL] — parashyut', 3);
    sound.door();
  } else if (high) {
    // havoda sakrash: parashyut o'zi ochilmaydi
    v.exitPos(G.seat, P.pos);
    P.pos.y = v.pos.y - 0.5; P.vel.copy(v.vel); P.vel.y = Math.min(P.vel.y, -1); P.onGround = false;
    banner('SAKRADINGIZ!', '[PROBEL] — parashyutni oching', 3);
  } else {
    v.exitPos(G.seat, P.pos);
    P.pos.y = v.pos.y; P.vel.set(0, 0, 0);
    G.world.collideCircle(P.pos, 0.4, P.pos.y, P.pos.y + 1.98);
    sound.door();
  }
  if (G.mp) net.send({ t: 'vexit' });
  leaveVehicleLocal();
  G.platform = stay;
}

// ---------- Shikast va portlash ----------
// Zirh: o'q qaysi tomondan tekkaniga qarab ko'paytuvchi. dir — o'q UCHAYOTGAN yo'nalish ({x, z}).
// pierce — qurolning zirhni qisman teshishi: zirh ko'paytuvchisi shundan past bo'lmaydi (snayper, pulemyot)
export function armorMul(v, dir, ap, pierce = 0) {
  const K = v.T.tank;
  if (K && dir && !v.burning && v.facing(dir.x, dir.z).zone === 'rear') return ap ? 1.6 : Math.max(K.rearMul, pierce);   // orqa zirh yupqa — yonish darajasigacha jon tez ketadi
  return ap ? 1 : Math.max(v.T.bulletMul ?? 1, pierce);
}
// Gusenitsa uzilganda / transport yona boshlaganda effekt va ogohlantirish
export function vehicleStatusFx(v, what) {
  if (what === 'track') {
    const up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3();
    for (let i = 0; i < 12; i++) G.fx.impact(p.set(v.pos.x + rnd(-2, 2), v.pos.y + 0.3, v.pos.z + rnd(-2, 2)), up, 'wall');
    const rp = relToPlayer(v.pos);
    if (rp.dist < 60) sound.land();
  }
  if (G.inVeh === v) {
    if (what === 'track') popup('GUSENITSA UZILDI — tank yurmaydi!', true);
    else popup(`${v.T.name.toUpperCase()} YONMOQDA${v.immobile ? ' — yurmaydi' : ''}!`, true);
    sound.alarm();
  }
}
// tr — uzilgan gusenitsa bitlari (1 — chap, 2 — o'ng)
export function damageVehicle(v, dmg, by, tr = 0) {
  if (!v || !v.alive || !(dmg > 0 || tr)) return;
  dmg = Math.max(0, dmg);
  // (by === 'zombie' — zombi rejimida sun'iy zombining zarbasi: uni xost uzatadi, lekin bu xostning o'ldirishi hisoblanmaydi)
  if (G.mp) { if (by === 'player' || by === 'self' || by === 'zombie') net.send({ t: 'vhit', v: v.id, dmg: Math.round(dmg), tr, z: by === 'zombie' ? 1 : undefined }); return; }
  const wasBurning = v.burning;
  v.hp -= dmg;
  if (tr && (v.trackBroken | tr) !== v.trackBroken) { v.setTracks(v.trackBroken | tr); vehicleStatusFx(v, 'track'); }
  if (v.hp <= 0) { v.respT = 45; boomVehicle(v); }
  else if (!wasBurning && v.burning) vehicleStatusFx(v, 'burn');
}
export function boomVehicle(v) {
  if (!v.alive) return;
  // o'rindiqda o'tirgan ham, yuk bo'limida piyoda turgan ham halok bo'ladi
  const inside = G.inVeh === v || G.insideVeh === v || G.platform === v;
  const p = v.pos.clone(); p.y += 1.2;
  if (v.snd) { v.snd.stop(); v.snd = null; }
  v.destroy();
  explode(p, 'neutral', { visual: true, scale: 1.7 });
  if (G.inVeh === v) leaveVehicleLocal();
  if (G.platform === v) G.platform = null;
  if (G.insideVeh === v) G.insideVeh = null;
  if (inside && !G.mp) damagePlayer(150, null, null, true);
}
// Zombi rejimi: yoqilg'i va shu o'rindagi qurolning qolgan o'q-dorisi
export function vehSupply(v, role) {
  if (!v.limited) return '';
  let s = v.T.fly || v.T.car || v.T.tank ? ` · yoqilg'i ${Math.round(v.fuel * 100)}%${v.fuel <= 0 ? " — TUGADI" : ''}` : '';
  if (role === 'gunner') s += ` · o'q ${v.ammo.d}`;
  else if (G.seat === 0 && v.type === 'heli') s += ` · o'q ${v.ammo.a}`;
  else if (G.seat === 0 && v.T.tank) s += ` · snaryad ${v.ammo.b} · o'q ${v.ammo.a}`;
  else if (v.type === 'cannon') s += ` · snaryad ${v.ammo.b}`;
  return s;
}
export function vehStatus(v) {
  let s = '';
  if (v.trackBroken) s += ' · GUSENITSA UZILDI';
  if (v.burning) s += ' · YONMOQDA';
  if (s && v.immobile) s += ' — YURMAYDI';
  return s;
}

// ---------- Har kadr: transport ----------
export function updateVehicles(dt) {
  G.vFireT -= dt; G.vAltT -= dt;
  const me = ME(), k = keys;
  for (const v of G.vehicles) {
    if (!v.alive) { if (!G.mp) { v.respT -= dt; if (v.respT <= 0) v.respawn(); } continue; }
    const mine = !G.mp || v.owner === me;
    if (mine) {
      let inp = null;
      if (G.inVeh === v && G.seat === 0) {
        if (player.alive && G.state === 'playing') {
          inp = { fwd: (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), strafe: (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), steer: (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0),
            up: (k.Space ? 1 : 0) - (k.ShiftLeft || k.ShiftRight ? 1 : 0), yaw: player.yaw + Math.PI, pitch: player.pitch };
          if (v.type === 'cannon' && G.vAim) { inp.yaw = G.vAim.yaw; inp.pitch = G.vAim.pitch; }
          if (v.T.tank) { inp.aimYaw = G.vAim ? G.vAim.yaw : player.yaw + Math.PI; inp.aimPitch = G.vAim ? G.vAim.pitch : player.pitch; }
        } else if (v.T.fly) inp = { fwd: 0, strafe: 0, steer: 0, up: 0, yaw: v.yaw, pitch: 0 };   // pauza: joyida osilib turadi
      }
      const yaw0 = v.yaw;
      v.simulate(dt, inp);
      if (inp && v.T.car) player.yaw += v.yaw - yaw0 > Math.PI ? v.yaw - yaw0 - Math.PI * 2 : v.yaw - yaw0 < -Math.PI ? v.yaw - yaw0 + Math.PI * 2 : v.yaw - yaw0;
      if (G.mp && v.alive) {
        v.netT = (v.netT || 0) - dt;
        const moving = !!inp || v.vel.lengthSq() > 0.01 || v.rocketReload > 0 || v.gun.heat > 0.01;
        if (v.netT <= 0 && (moving || !v.sentRest)) {
          v.netT = 0.05; v.sentRest = !moving;
          net.send({ t: 'v', id: v.id, x: +v.pos.x.toFixed(2), y: +v.pos.y.toFixed(2), z: +v.pos.z.toFixed(2), yw: +v.yaw.toFixed(3), pt: +v.pitch.toFixed(3), rl: +v.roll.toFixed(3), ay: +v.aimYaw.toFixed(3), ap: +v.aimPitch.toFixed(3),
            rk: v.rockets, rr: +v.rocketReload.toFixed(1), ht: +v.gun.heat.toFixed(2), oh: v.gun.hot ? 1 : 0,
            fu: v.limited ? +v.fuel.toFixed(3) : undefined, aa: v.limited ? v.ammo.a : undefined, ab: v.limited ? v.ammo.b : undefined });
        }
      }
    } else v.remote(dt);
    v.trackMotion();
    if (!v.alive) continue;
    v.visual(dt);
    // dvigatel ovozi
    const active = v.T.fly ? v.rotor > 0.05 : (v.T.car || v.T.tank) && (v.seats[0] != null || Math.abs(v.speed) > 0.5);
    if (active && !v.snd) v.snd = sound.engine(v.T.fly ? 'heli' : v.T.tank || v.type === 'truck' ? 'tank' : 'jeep');
    if (v.snd) {
      if (!active) { v.snd.stop(); v.snd = null; }
      else {
        const dist = G.inVeh === v ? 0 : relToPlayer(v.pos).dist;
        const base = v.T.fly ? v.rotor * (v.type === 'chinook' ? 0.7 : 0.55) : v.T.tank ? 0.45 : v.type === 'truck' ? 0.36 : 0.3;
        v.snd.set((G.inVeh === v ? base * 0.7 : base * 1.6 / (1 + dist * 0.07)), v.T.fly ? v.rotor * (v.type === 'chinook' ? 0.75 : 1) : Math.min(1, Math.abs(v.speed) / (v.T.tank ? v.T.tank.max : v.T.car ? v.T.car.max : 16)));
      }
    }
    // jip bilan bosib ketish
    const tk = !!v.T.tank;
    if ((tk || v.T.car) && mine && G.inVeh === v && G.seat === 0 && Math.abs(v.speed) > (tk ? 2.5 : 6)) {
      const sg = Math.sign(v.speed), fo = tk ? 3.0 : (v.T.car.front || 1.7), fx = v.pos.x + Math.sin(v.yaw) * fo * sg, fz = v.pos.z + Math.cos(v.yaw) * fo * sg;
      for (const s of G.soldiers) {
        if (!s.alive || !hostile(s) || s.hidden || Math.abs(s.pos.y - v.pos.y) > 1.5 || G.time - (s.rkT || -9) < 0.7) continue;
        if (Math.hypot(s.pos.x - fx, s.pos.z - fz) < (tk ? 2.1 : (v.T.car.hitR || 1.6))) { s.rkT = G.time; s.damage(260, v.pos, false, 'player', 'roadkill'); sound.stab(); if (!tk) v.speed *= 0.8; }
      }
    }
  }
  gunCool(G.gunHeat, dt);
  // o'z transportimiz shikastlanganda ogohlantirish
  const mv = G.inVeh;
  if (mv && mv.alive && mv.hp < mv.T.hp * 0.35) { G.alarmT -= dt; if (G.alarmT <= 0) { G.alarmT = 0.9; sound.alarm(); } }
}

// ---------- Transport ichidagi kamera ----------
export function vehicleCamera(dt) {
  const v = G.inVeh, P = player;
  G.shake = Math.max(0, G.shake - dt * 1.8);
  G.landDip = 0;
  const own = ownGunActive();   // o'z qurolidan otayotgan yo'lovchi: tepki va mo'ljal piyodadagidek ishlaydi
  if (own) {
    G.kickPitch *= Math.max(0, 1 - dt * 14);
    if (G.time - G.lastShot > 0.12 && G.recoilAcc > 0) { const r = Math.min(G.recoilAcc, G.recoilAcc * dt * 7 + 0.0005); P.pitch -= r * 0.85; G.recoilAcc -= r; }
  } else { G.kickPitch = 0; G.recoilAcc = 0; }
  const sh = G.shake * G.shake, jx = (Math.random() - 0.5) * sh * 0.03, jy = (Math.random() - 0.5) * sh * 0.03;
  const fp = vehFP();
  let roll = 0;
  if (fp) {
    v.eyePos(G.seat, camera.position);
    // uchayotgan vertolyot egilganda ufq ham og'adi
    if (v.T.fly) { const dl = P.yaw - (v.yaw + Math.PI); roll = -(v.roll * Math.cos(dl) + v.pitch * Math.sin(dl)); }
  } else {
    const cpit = Math.cos(P.pitch);
    _f.set(-Math.sin(P.yaw) * cpit, Math.sin(P.pitch), -Math.cos(P.yaw) * cpit);
    const tgt = _tmp.set(v.pos.x, v.pos.y + v.T.camH, v.pos.z);
    _dir.copy(_f).multiplyScalar(-1);
    let dist = v.T.camDist;
    const wh = G.world.rayCast(tgt, _dir, dist + 0.5, _wh, v.box);
    if (wh) dist = Math.max(1.2, wh.dist - 0.4);
    camera.position.copy(tgt).addScaledVector(_dir, dist);
    camera.position.y += 1.3 * (dist / v.T.camDist);
    const floorY = G.world.baseHeight(camera.position.x, camera.position.z) + 0.3;
    if (camera.position.y < floorY) camera.position.y = floorY;
  }
  camera.rotation.set(P.pitch + G.kickPitch + jx, P.yaw + jy, roll);
  if (own) aimFov(dt, cur().def, !!cur().def.scope && G.ads > 0.92);
  else {
    camera.fov = lerp(camera.fov, settings.fov, Math.min(1, dt * 10));
    camera.updateProjectionMatrix();
    $('scope').style.display = 'none';
    if (hudCache.adsVig !== 0) { hudCache.adsVig = 0; $('adsVig').style.opacity = 0; }
  }
  // nishon nuqtasi (ekran markazi qayerga qarayapti)
  camBasis();
  const start = _o.copy(camera.position).addScaledVector(_f, fp ? 0.5 : v.T.camDist + 2.5);
  const hit = G.world.rayCast(start, _f, 500, _wh, v.box);
  let d = hit ? hit.dist : 500;
  for (const s of G.soldiers) { if (!s.alive || !hostile(s)) continue; const h = s.hitTest(start, _f, d); if (h) d = h.dist; }
  G.aimPt.copy(start).addScaledVector(_f, d);
  if (v.type === 'cannon' || v.T.tank) {
    const dx = G.aimPt.x - v.pos.x, dy = G.aimPt.y - (v.pos.y + (v.T.tank ? v.T.tank.pivotY : 1.35)), dz = G.aimPt.z - v.pos.z;
    G.vAim = { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
  }
}

// ---------- Transport qurollari ----------
export function vehicleShot(v, mz, W, fromCam) {
  const o = fromCam ? camera.position.clone() : mz.clone();
  _dir.copy(G.aimPt).sub(o).normalize();
  _dir.x += (Math.random() - 0.5) * 2 * W.spread; _dir.y += (Math.random() - 0.5) * 2 * W.spread; _dir.z += (Math.random() - 0.5) * 2 * W.spread;
  _dir.normalize();
  const res = hitscan(o, _dir, W, v.box);
  G.world.breakGlass(o, res.end);
  if (Math.random() < 0.7) G.fx.tracer(mz, res.end, 0xffe6a8, 380);
  if (!fromCam) G.fx.muzzle(mz, 1.1); else G.fx.flash(mz, 0xffb050, 8, 0.06, 10);
  sound.shot(W.sound, 0, 0, false);
  if (G.zg) G.zNoise(v.pos.x, v.pos.z, 80);
  G.shots++;
  if (res.hit) { G.hits++; hitmarker(res.kill && !G.mp); sound.hit(res.head); }
  if (G.mp) net.send({ t: 'shot', a: v3arr(mz), b: v3arr(res.end), s: W.sound });
}
export function vehicleProjectile(v, mz, kind, dir) {
  const pr = PROJ[kind];
  if (dir) _dir.copy(dir).normalize(); else _dir.copy(G.aimPt).sub(mz).normalize();
  const vel = _dir.clone().multiplyScalar(pr.speed);
  spawnProjectile(mz, vel, kind, 'player', v.box, false);
  G.fx.muzzle(mz, 1.8);
  sound.shot(pr.kind === 'shell' ? 'cannon' : 'rocket', 0, 0, false);
  G.shake = Math.max(G.shake, 0.25);
  if (G.mp) net.send({ t: 'rocket', p: v3arr(mz), v: v3arr(vel), k: kind });
}
export function updateVehicleSeat(dt) {
  const v = G.inVeh, P = player;
  if (G.hmT > 0) { G.hmT -= dt; if (G.hmT <= 0) $('hitmarker').style.opacity = 0; }
  G.ads = 0; G.reloadT = 0; G.kick = Math.max(0, G.kick - dt * 9);
  if (G.flashT > 0) G.flashT -= dt;
  for (const w of G.weapons) w.vm.group.visible = false;
  for (const sh of G.shells) { sh.t = 0; sh.m.visible = false; }
  const role = v.T.roles[G.seat], gunner = role === 'gunner', fp = vehFP();
  const mvm = G.mountVM;
  mvm.group.visible = gunner && fp;
  for (const m of v.fpHide) m.visible = !fp;
  if (gunner && fp) {
    mvm.group.position.set(0, -0.17 + G.kick * 0.006, -0.5 + G.kick * 0.04);
    mvm.group.rotation.set(G.kick * 0.02, 0, 0);
    mvm.flash.visible = G.flashT > 0;
    if (mvm.flash.visible) mvm.flash.rotation.z = Math.random() * 6;
  }
  if (P.alive && G.state === 'playing') {
    if (v.type === 'heli' && G.seat === 0) {
      // Uchuvchi: pulemyot qiziydi; raketa 12 ta, tugagach 15 soniya qayta o'qlanadi
      if (mouse.L && G.vFireT <= 0) {
        if (v.gun.hot) G.vFireT = 0.1;   // qizigan: otmaydi va o'q ham sarflanmaydi
        else if (!useVehAmmo(v, 'a')) G.vFireT = 0.4;
        else if (gunFire(v.gun, VW.heliMg.heat)) {
          G.vFireT = 60 / VW.heliMg.rpm;
          vehicleShot(v, v.muzzle('mg', _mz), VW.heliMg, false);
          if (v.gun.hot) { sound.alarm(); popup('PULEMYOT QIZIB KETDI!', true); }
        } else { G.vFireT = 0.35; sound.empty(); }
      }
      if (mouse.R && G.vAltT <= 0) {
        if (v.rockets > 0) {
          G.vAltT = 0.6; v.rockets--;
          vehicleProjectile(v, v.muzzle('rocket', _mz), 'hrocket');
          if (v.rockets === 0 && v.limited) popup('Raketalar tugadi', true);   // zombi rejimida qayta o'qlanmaydi
          else if (v.rockets === 0) { v.rocketReload = v.T.rocketReload; popup(`Raketalar tugadi — ${v.T.rocketReload} soniya qayta o'qlanadi`, true); }
        } else { G.vAltT = 0.5; sound.empty(); }
      }
    } else if (gunner) {
      if (mouse.L && G.vFireT <= 0) {
        // vertolyotlarning bort pulemyotlari ham qiziydi
        if (v.T.fly && G.gunHeat.hot) G.vFireT = 0.1;
        else if (!useVehAmmo(v, 'd')) G.vFireT = 0.4;
        else if (!v.T.fly || gunFire(G.gunHeat, VW.doorMg.heat)) {
          G.vFireT = 60 / VW.doorMg.rpm;
          camBasis();
          if (fp) {
            _mz.copy(camera.position).addScaledVector(_f, 0.9).addScaledVector(_u, -0.15);
            vehicleShot(v, _mz, VW.doorMg, true);
          } else {
            // 3-shaxs ko'rinishida o'q kameradan emas, pulemyotning o'zidan chiqadi
            v.gunPos(_mz, G.seat);
            _mz.addScaledVector(_dir.copy(G.aimPt).sub(_mz).normalize(), 0.9);
            vehicleShot(v, _mz, VW.doorMg, false);
          }
          G.kick = Math.min(1.4, G.kick + 1); G.flashT = 0.045;
          if (v.T.fly && G.gunHeat.hot) { sound.alarm(); popup('PULEMYOT QIZIB KETDI!', true); }
        } else { G.vFireT = 0.35; sound.empty(); }
      }
    } else if (v.type === 'cannon') {
      if (mouse.L && G.vFireT <= 0) { G.vFireT = 0.6; if (useVehAmmo(v, 'b')) vehicleProjectile(v, v.muzzle('shell', _mz), 'shell'); }
    } else if (v.T.tank) {
      // haydovchi-to'pchi: asosiy pushka stvol qaragan tomonga otadi (minora nishonga burilib ulgurishi kerak)
      if (mouse.L && G.vAltT <= 0 && !useVehAmmo(v, 'b')) G.vAltT = 0.5;
      else if (mouse.L && G.vAltT <= 0) {
        G.vAltT = v.T.tank.reload;
        const ca = Math.cos(v.aimPitch);
        const bd = new THREE.Vector3(Math.sin(v.aimYaw) * ca, Math.sin(v.aimPitch), Math.cos(v.aimYaw) * ca);
        vehicleProjectile(v, v.muzzle('shell', _mz), v.T.tank.gun, bd);
        G.shake = Math.max(G.shake, v.type === 'tank' ? 0.55 : 0.3);
      }
      if (mouse.R && G.vFireT <= 0) { G.vFireT = 60 / VW.tankMg.rpm; if (useVehAmmo(v, 'a')) vehicleShot(v, v.muzzle('mg', _mz), VW.tankMg, false); else G.vFireT = 0.4; }
    }
  }
  const armed = gunner || (G.seat === 0 && (v.type === 'cannon' || v.type === 'heli' || !!v.T.tank));
  const ch = $('crosshair');
  ch.style.opacity = P.alive && armed ? 1 : 0;
  ch.children[0].style.top = '-21px'; ch.children[1].style.top = '12px';
  ch.children[2].style.left = '-21px'; ch.children[3].style.left = '12px';
}

// Transport o'q-dorisi (faqat zombi rejimida cheklangan): bitta o'q sarflaydi; tugagan bo'lsa false qaytaradi va xabar beradi
export function useVehAmmo(v, key) {
  if (!v.limited) return true;
  if (v.ammo[key] > 0) { v.ammo[key]--; return true; }
  sound.empty();
  if (G.time - (G.vEmptyT || -9) > 2.5) { G.vEmptyT = G.time; popup(key === 'b' ? 'Snaryad tugadi' : "Pulemyot o'qi tugadi", true); }
  return false;
}

// ---------- Noyob qurollar ----------
// torayuvchi zona bor jangda avtomatik turel (qo'riqchi pulemyot) olinmaydi — yerda ham ko'rinmaydi
const zoneOff = (pk) => !!G.zone && pk.def && pk.def.id === 'turret';
export function nearestPickup() {
  const P = player;
  for (const pk of G.pickups) {
    if (pk.taken || zoneOff(pk)) continue;
    if (Math.hypot(pk.pos.x - P.pos.x, pk.pos.z - P.pos.z) < 2.3 && Math.abs(pk.pos.y - (P.pos.y + 1.2)) < 1.6
      && G.world.los(_tmp.set(P.pos.x, P.pos.y + Math.max(0.5, P.eyeH - 0.2), P.pos.z), pk.pos, P.vehBox)) return pk;   // (devor ortidagi qurol olinmaydi)
  }
  return null;
}
export function tryPickup() {
  const pk = nearestPickup();
  if (!pk || G.isZ) return false;
  if (G.mp) net.send({ t: 'pick', id: pk.id });
  else { pk.taken = true; giveSpecial(pk.id); }
  return true;
}
export function giveSpecial(id) {
  const pk = G.pickups.find((p) => p.id === id);   // (joydagi qurol turi tasodifiy; joy topilmasa — raqam bo'yicha)
  giveBonusWeapon(pk ? pk.def : G.specials[id % G.specials.length], id, "Noyob qurol qo'lga kiritildi · [5] tugmasi");
}
// 5-o'ringa qo'shimcha qurol: pid — podval raqami (yordam sifatida berilgan qurolda −1)
export function giveBonusWeapon(def, pid, sub) {
  dropSpecial(false);
  const vm = buildViewmodel(def, G.era);
  vm.group.visible = false; vmRoot.add(vm.group);
  G.weapons.push({ def, mag: def.mag, reserve: def.reserve, vm, pid });
  switchWeapon(G.weapons.length - 1);
  banner(def.name.toUpperCase(), sub, 3);
  sound.ping();
}
// Ketma-ket yutqazayotgan o'yinchiga yordam (tarmoq): 1-daraja — boshqariladigan dron, 2-daraja — avtomatik turel
export function giveComeback(tier) {
  // torayuvchi zona bor jangda avtomatik turel berilmaydi (kichik doirada u hammani o'ldirib qo'yardi) — dron beriladi
  const def = G.specials.find((d) => d.id === (tier >= 2 && !G.zone ? 'turret' : 'drone'));
  if (def) giveBonusWeapon(def, -1, "Omad kelmayaptimi? Mana kuchliroq qurol · [5] tugmasi");
}
export function dropSpecial(notify) {
  if (!G.weapons || G.weapons.length <= 4) return;
  const w = G.weapons.pop();
  vmRoot.remove(w.vm.group); disposeTree(w.vm.group);
  if (G.wi >= G.weapons.length) { G.wi = mainSlot(); G.switchT = 0.45; G.reloadT = 0; }
  buildSlots();
  if (G.mp) { if (notify) net.send({ t: 'unpick' }); }
  else { const pk = G.pickups.find((p) => p.id === w.pid); if (pk) pk.respT = 25; }
  if (notify && !w.def.deploy) popup(`${w.def.name}: o'q tugadi`);
}
export function updatePickups(dt) {
  for (const pk of G.pickups) {
    if (!G.mp && pk.taken && pk.respT > 0) { pk.respT -= dt; if (pk.respT <= 0) pk.taken = false; }
    pk.mesh.visible = !pk.taken && !zoneOff(pk);
    if (!pk.mesh.visible) continue;
    pk.mesh.rotation.y += dt * 1.2;
    pk.mesh.position.y = pk.pos.y + Math.sin(G.time * 2 + pk.id) * 0.08;
  }
}
export function interact() { if (G.zg && !G.isZ && (tryRevive() || G.zg.tryPart() || G.zg.tryCrate())) return; if (tryPickup() || tryLoot()) return; useSupply(); }

export function updatePrompt() {
  const pr = $('prompt'), P = player;
  let text = '';
  if (!G.inVeh && P.alive) {
    if (!P.onGround && !G.chute && P.vel.y < -6 && P.pos.y - groundBelow() > 6) text = '[PROBEL] — PARASHYUTNI OCHISH';
    else {
      const v = nearestVehicle();
      if (v !== G.pickVeh) { G.pickVeh = v; G.seatPick = 0; }
      if (v) {
        let free = 0;
        for (let i = 0; i < v.T.seats; i++) if (v.seats[i] == null) free++;
        text = `[F] ${v.T.name} — ${v.T.seatNames[pickedSeat(v)]}` + (free > 1 ? " · [Q] boshqa o'rin" : '') + (v.type === 'truck' ? ' · kuzovga orqadagi zinadan chiqing' : '');
      } else {
        const pk = nearestPickup(), rp = G.zg && !G.isZ ? revivePrompt() : '';
        if (rp) text = rp;   // defibrillyator / tiriltirish punkti
        else if (G.zg && !G.isZ && G.zg.nearPart() >= 0) text = `[E] ${WILD.parts[G.zg.nearPart()].name} — olish`;
        else if (G.zg && !G.isZ && G.zg.nearCrate()) text = '[E] Qurol yashigini ochish';
        else if (pk && !G.isZ) text = `[E] ${pk.def.name} — noyob qurolni olish`;
        else if (nearestLoot()) { const l = nearestLoot(); text = `[E] ${l.def.name} — olish (${lootSlot(l.def) === 0 ? 'asosiy qurol' : "to'pponcha"} o'rniga)`; }
        else if (G.supplyReady && P.pos.distanceTo(G.world.supplyPos) < 2.8) text = "[E] O'q-dori va granatalarni olish";
      }
    }
  }
  if (text) { pr.style.display = 'block'; if (pr.textContent !== text) pr.textContent = text; }
  else pr.style.display = 'none';
}
export function updateVehHUD() {
  const el = $('vehHud'), v = G.inVeh;
  if (!v) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
  el.style.display = 'block';
  const pct = Math.max(0, (v.hp / v.T.hp) * 100), role = v.T.roles[G.seat];
  setText('vehName', `${v.T.name.toUpperCase()} · ${v.T.seatNames[G.seat]}${v.T.fly ? ` · balandlik ${Math.round(v.pos.y)} m` : ''}${v.T.tank && G.seat === 0 ? (G.vAltT > 0 ? ` · pushka o'qlanmoqda ${G.vAltT.toFixed(1)} s` : ' · pushka TAYYOR') : ''}${vehStatus(v)}${vehSupply(v, role)}`);
  $('vehFill').style.width = pct + '%';
  $('vehFill').style.background = pct < 35 ? '#ff4433' : pct < 65 ? '#ffb02e' : '#7fd36a';
  // qurol holati: raketalar va pulemyot qizishi
  let rk = '', gun = null;
  if (v.type === 'heli' && G.seat === 0) {
    rk = v.rocketReload > 0 ? `RAKETA: qayta o'qlanmoqda ${Math.ceil(v.rocketReload)} s` : `RAKETA ${v.rockets}/${v.T.rockets}`;
    gun = v.gun;
  } else if (role === 'gunner' && v.T.fly && !ownGunActive()) gun = G.gunHeat;
  const am = $('vehAmmo');
  if (gun) {
    am.style.display = 'block';
    setText('vehRk', rk);
    setText('vehHeatTxt', gun.hot ? 'PULEMYOT QIZIB KETDI — sovumoqda' : 'Pulemyot qizishi');
    $('vehHeatTxt').style.color = gun.hot ? '#ff5b4b' : '';
    $('vehHeatFill').style.width = Math.round(gun.heat * 100) + '%';
    $('vehHeatFill').style.background = gun.hot ? '#ff4433' : gun.heat > 0.7 ? '#ffb02e' : '#7fd3ff';
  } else if (am.style.display !== 'none') am.style.display = 'none';
  // uchuvchisiz qolgan vertolyot
  const noPilot = v.T.fly && G.seat !== 0 && v.seats[0] == null && !v.onGround;
  // o'rinlar ro'yxati: qaysi o'rindamiz, qaysilari bo'sh/band — va ularni qanday almashtirish
  const vs = $('vehSeats');
  if (v.T.seats > 1) {
    let html = '';
    for (let i = 0; i < v.T.seats; i++) html += `<span class="${i === G.seat ? 'me' : v.seats[i] != null ? 'busy' : 'free'}">${i + 1} ${v.T.seatNames[i]}</span>`;
    if (hudCache.vehSeats !== html) { hudCache.vehSeats = html; vs.innerHTML = html; }
    if (vs.style.display !== 'flex') vs.style.display = 'flex';
  } else if (vs.style.display !== 'none') vs.style.display = 'none';
  const ownH = role === 'pass' ? (vehFP() ? " · O'z qurolingiz: chap tugma — otish, o'ng — mo'ljal, R — o'qlash, g'ildirak — qurol" : " · O'z qurolingizdan otish uchun 1-shaxsga o'ting")
    : role === 'gunner' ? ` · G'ildirak — bort pulemyoti / o'z qurolingiz (hozir ${G.ownGun && vehFP() ? cur().def.short || cur().def.name : 'bort pulemyoti'})` : '';
  const swap = ownH + (v.T.seats > 1 ? ` · Q yoki 1–${v.T.seats} — o'rin almashtirish` : '') + ` · V — ko'rinish (hozir ${vehFP() ? '1-shaxs' : '3-shaxs'})`;
  setText('vehHint', noPilot ? "UCHUVCHI YO'Q! [F] — sakrang (PROBEL — parashyut) · [1] — boshqaruvni oling" : (SEAT_HINTS[v.type + G.seat] || '') + swap);
  $('vehHint').style.color = noPilot ? '#ff5b4b' : '';
}
