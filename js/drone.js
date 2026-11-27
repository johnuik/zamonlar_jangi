// Boshqariladigan dron (noyob qurol): uchirgan o'yinchi uni o'zi boshqaradi va kamerasidan qaraydi.
// Bitta dron, bitta bomba. Nishonga (devor, yer, transport, raqib) tez borib urilsa — o'zi portlaydi (bomba hali ichida bo'lsa kuchliroq).
// Joni yo'q: bitta o'q (yoki yaqindagi portlash) tegsa — yo'q bo'ladi. Batareyasi tugasa ham tushib ketadi.
// Boshqarayotganda o'yinchining o'zi joyida himoyasiz turadi.
// Tarmoqda dronni egasi hisoblaydi; boshqalar uning joyini ko'radi va urib tushira oladi ('dkill' xabari).
import * as THREE from '../lib/three.module.js';
import { droneVisual } from './vehskin.js';
import { $, G, _f, _u, camBasis, camera, clamp, keys, mouse, player, settings, sound } from './core.js';
import { banner, popup, relToPlayer, setText } from './hud.js';
import { hostile, net, remotes, v3arr } from './mp.js';
import { explode, spawnProjectile } from './ordnance.js';
import { raySphere } from './world.js';

export const DRONE = { speed: 13, climb: 7, battery: 45, bombs: 1, r: 0.45, maxH: 45,
  crash: 5, arm: 1.0,   // shu tezlikdan (m/s) tez urilsa portlaydi; uchirilgandan keyin bir soniya o'tgach faollashadi (o'zingizni portlatib qo'ymaslik uchun)
  ram: { radius: 4, dmg: 150, vdmg: 180, scale: 0.7 },            // bombasiz urilish: to'g'ri tekkan raqibni yo'q qiladi (zirhlisi omon qoladi)
  ramBomb: { radius: 6, dmg: 230, vdmg: 440, scale: 1.15 } };     // bomba bilan birga urilish

const _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

function buildDrone(era) {
  const g = new THREE.Group(), H = era === 'historical';
  const body = new THREE.MeshStandardMaterial({ color: H ? 0x4a4f3c : 0x26282b, roughness: 0.5, metalness: 0.5 });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.36), body));
  const rotors = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.3), body); arm.position.set(a * 0.16, 0.01, b * 0.17); arm.rotation.y = a * b * 0.7; g.add(arm);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.012, 12), new THREE.MeshBasicMaterial({ color: 0x151515, transparent: true, opacity: 0.5 }));
    r.position.set(a * 0.24, 0.06, b * 0.25); g.add(r); rotors.push(r);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); eye.position.set(0, -0.02, -0.19); g.add(eye);
  const bomb = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0x3e4a32, roughness: 0.6 })); bomb.rotation.x = Math.PI / 2; bomb.position.y = -0.09; g.add(bomb);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.rotors = rotors; g.userData.bomb = bomb;
  // haqiqiy kvadrokopter modeli (vehskin.js; 1944 yilda xaki-zaytun rangda); bomba va kamera ko'zi qoladi
  const mv = droneVisual(era);
  if (mv) { for (const c of g.children) if (c !== bomb && c !== eye) c.visible = false; mv.g.position.y = -0.075; g.add(mv.g); g.userData.rotors = mv.rotors; }
  return g;
}

// ---------- O'z dronimiz ----------
// Uchirish (arsenal.js: noyob qurol otilganda). Qaytaradi: uchdimi.
export function launchDrone() {
  const P = player;
  if (G.drone) return false;
  if (G.inVeh) { popup("Dronni transport ichidan uchirib bo'lmaydi — avval tushing", true); return false; }   // (kamera transportda qolardi — dron ko'rinmay uchardi)
  const pos = new THREE.Vector3(P.pos.x - Math.sin(P.yaw) * 1.1, P.pos.y + 2.2, P.pos.z - Math.cos(P.yaw) * 1.1);
  if (G.world.pointInBox(pos) || !G.world.los(_a.set(P.pos.x, P.pos.y + 1.6, P.pos.z), pos, P.vehBox)) { popup("Dronni bu yerdan uchirib bo'lmaydi — ochiqroq joyga chiqing", true); return false; }
  const mesh = buildDrone(G.era); mesh.position.copy(pos); G.scene.add(mesh);
  G.drone = { pos, vel: new THREE.Vector3(), mesh, bombs: DRONE.bombs, t: DRONE.battery, fireT: 0.5, netT: 0, shotT: 1.2, doneT: 0, warnT: 0, armT: DRONE.arm };
  G.droneCtl = true; G.droneSave = { yaw: P.yaw, pitch: P.pitch };
  P.pitch = -0.3; G.ads = 0; mouse.L = mouse.R = false;
  G.drone.snd = sound.engine('heli');
  banner('DRON BOSHQARUVI', "W/A/S/D — uchish · PROBEL/SHIFT — balandlik · Chap tugma — bomba (1 ta) · nishonga tez borib urilsa portlaydi · F — tashlab chiqish", 5);
  return true;
}
// why: 'battery' | 'shot' | 'ram' (nishonga urilib portladi) | 'quit' | 'dead'
export function endDrone(why) {
  const d = G.drone;
  if (!d) return;
  if (d.snd) d.snd.stop();
  if (why === 'shot') { G.fx.explosion(d.pos, 0.45); const rp = relToPlayer(d.pos); sound.explosion(rp.dist, rp.pan, false); }
  G.scene.remove(d.mesh);
  d.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  if (G.mp) net.send({ t: 'drone', off: 1, boom: why === 'shot' ? 1 : why === 'ram' ? 2 : 0, p: v3arr(d.pos) });
  G.drone = null; G.droneCtl = false;
  if (G.droneSave) { player.yaw = G.droneSave.yaw; player.pitch = G.droneSave.pitch; }
  mouse.L = mouse.R = false; G.switchT = Math.max(G.switchT || 0, 0.4);
  $('droneHud').style.display = 'none';
  const msg = why === 'shot' ? 'DRON URIB TUSHIRILDI!' : why === 'ram' ? 'Dron nishonga urilib portladi' : why === 'battery' ? 'Dron: batareya tugadi' : why === 'dead' ? '' : 'Dron tashlab ketildi';
  if (msg) popup(msg, why === 'shot');
}
// Dron nishonga urildi: o'zi portlaydi (veh — to'g'ridan-to'g'ri urilgan transport)
function crashDrone(veh) {
  const d = G.drone, pos = d.pos.clone(), S = d.bombs > 0 ? DRONE.ramBomb : DRONE.ram, dir = d.vel.clone().normalize();
  endDrone('ram');   // avval dron yo'q qilinadi (portlash o'z dronimizni qayta "urib tushirmasin")
  explode(pos, 'player', { radius: S.radius, dmg: S.dmg, vdmg: S.vdmg, scale: S.scale, kind: 'grenade', friendly: G.mp, directVeh: veh || undefined, dir });
}
// Tarmoq: raqib dronimizga o'q tekkizdi
export function onDroneKilled() { if (G.drone) endDrone('shot'); }

// Dron kamerasi (movement.js: boshqaruv paytida oddiy kamera o'rniga)
export function droneCamera(dt) {
  const d = G.drone, P = player;
  camera.position.set(d.pos.x, d.pos.y - 0.1, d.pos.z);
  const lat = (d.vel.x * Math.cos(P.yaw) - d.vel.z * Math.sin(P.yaw)) / DRONE.speed;
  camera.rotation.set(P.pitch, P.yaw, -lat * 0.18);
  camera.fov += (Math.max(78, settings.fov) - camera.fov) * Math.min(1, dt * 10);
  camera.updateProjectionMatrix();
}

// ---------- Boshqa o'yinchilarning dronlari (tarmoq) ----------
export function onRemoteDrone(o) {
  G.rdrones = G.rdrones || new Map();
  let r = G.rdrones.get(o.id);
  if (o.off) {
    if (r) {
      if (Array.isArray(o.p) && o.p.length === 3 && o.p.every(Number.isFinite)) r.pos.set(o.p[0], o.p[1], o.p[2]);
      if (o.boom === 2) explode(r.pos.clone(), 'remote', { visual: true, scale: 1.0, radius: 5 });   // nishonga urilib portladi (zararni egasi hisoblaydi)
      else if (o.boom) { G.fx.explosion(r.pos, 0.45); const rp = relToPlayer(r.pos); sound.explosion(rp.dist, rp.pan, false); }
      removeRemote(o.id);
    }
    return;
  }
  if (!Array.isArray(o.p) || o.p.length !== 3 || !o.p.every(Number.isFinite)) return;
  if (!r) {
    const mesh = buildDrone(G.era); G.scene.add(mesh);
    r = { id: o.id, pos: new THREE.Vector3(o.p[0], o.p[1], o.p[2]), to: new THREE.Vector3(), mesh, t: 0 };
    G.rdrones.set(o.id, r);
  }
  r.to.set(o.p[0], o.p[1], o.p[2]); r.yaw = Number.isFinite(o.yw) ? o.yw : 0; r.t = 0;
}
function removeRemote(id) {
  const r = G.rdrones && G.rdrones.get(id);
  if (!r) return;
  if (r.mesh.parent) r.mesh.parent.remove(r.mesh);
  r.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  G.rdrones.delete(id);
}
export function clearDrones() {
  if (G.drone) { if (G.drone.snd) G.drone.snd.stop(); G.drone = null; }
  G.droneCtl = false; G.rdrones = new Map();
  const el = $('droneHud'); if (el) el.style.display = 'none';
}
// O'q raqib droniga tegadimi? (arsenal.js hitscan chaqiradi.) Qaytaradi: { dist, id } yoki null.
export function hitRemoteDrone(o, dir, maxD) {
  if (!G.mp || !G.rdrones || !G.rdrones.size) return null;
  let best = null;
  for (const r of G.rdrones.values()) {
    const owner = remotes.get(r.id);
    if (r.dead || (owner && !hostile(owner))) continue;   // sherikning droniga o'q tegmaydi; urib tushirilgani (egasi tasdiqlashini kutyapti) qayta urilmaydi
    const t = raySphere(o, dir, r.pos.x, r.pos.y, r.pos.z, DRONE.r);
    if (t < maxD && (!best || t < best.dist)) best = { dist: t, id: r.id };
  }
  return best;
}
// Raqib dronlari ro'yxati (turel ularni o'zi urib tushiradi)
export function hostileDrones() {
  const out = [];
  if (G.mp && G.rdrones) for (const r of G.rdrones.values()) { const ow = remotes.get(r.id); if (!r.dead && (!ow || hostile(ow))) out.push(r); }
  return out;
}
// Raqib dronini urib tushirdik: egasiga xabar beramiz (u dronni yo'q qiladi va hammaga e'lon qiladi)
// (bitta dron uchun bir marta: sochma o'qning har bir donasi yoki turelning har bir o'qi qayta xabar yubormasin; egasi javob bermasa 1.5 s dan keyin yana urish mumkin)
export function killRemoteDrone(id) {
  const r = G.rdrones && G.rdrones.get(id);
  if (!r || r.dead) return;
  r.dead = true; r.deadT = 0;
  net.send({ t: 'dkill', id }); popup('Dron urib tushirildi!');
}
// Portlash yaqinidagi dronlar ham yo'q bo'ladi (ordnance.js explode chaqiradi; mine — portlash bizniki)
export function blastDrones(pos, R, mine, visual) {
  if (!visual && G.drone && pos.distanceTo(G.drone.pos) < R * 0.6) endDrone('shot');
  if (mine && G.mp && G.rdrones) for (const r of G.rdrones.values()) { const ow = remotes.get(r.id); if ((!ow || hostile(ow)) && pos.distanceTo(r.pos) < R * 0.6) killRemoteDrone(r.id); }
}

// ---------- Har kadr ----------
export function updateDrones(dt) {
  if (G.rdrones) for (const r of G.rdrones.values()) {
    r.t += dt;
    if (r.dead && (r.deadT += dt) > 1.5) r.dead = false;
    if (r.t > 2.5) { removeRemote(r.id); continue; }   // egasidan xabar kelmay qoldi
    r.pos.lerp(r.to, Math.min(1, dt * 12));
    r.mesh.position.copy(r.pos); r.mesh.rotation.y = (r.yaw || 0);
    for (const m of r.mesh.userData.rotors) m.rotation.y += dt * 60;
  }
  const d = G.drone, P = player;
  if (!d) return;
  if (!P.alive) { endDrone('dead'); return; }
  const W = G.world;
  d.t -= dt; d.fireT -= dt; d.armT -= dt;
  // boshqaruv: kamera qaragan tomonga nisbatan
  const k = G.droneCtl && G.state === 'playing' ? keys : {};
  const fz = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), fx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), up = (k.Space ? 1 : 0) - (k.ShiftLeft || k.ShiftRight ? 1 : 0);
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  _p.set((-sy * fz + cy * fx) * DRONE.speed, up * DRONE.climb, (-cy * fz - sy * fx) * DRONE.speed);
  d.vel.lerp(_p, Math.min(1, dt * 3.5));
  // to'siqlar: har o'q bo'yicha alohida. Sekin tegsa — to'xtaydi; tez borib urilsa (DRONE.crash) — portlaydi.
  let crash = false, hitVeh = null;
  for (const ax of ['x', 'y', 'z']) {
    const old = d.pos[ax];
    d.pos[ax] += d.vel[ax] * dt;
    const b = W.pointInBox(d.pos);
    if (b || (ax === 'y' && d.pos.y < W.baseHeight(d.pos.x, d.pos.z) + 0.4)) {
      if (Math.abs(d.vel[ax]) >= DRONE.crash && d.armT <= 0) { crash = true; if (b && b.vehicle) hitVeh = b.vehicle; }
      d.pos[ax] = old; if (!crash) d.vel[ax] = 0;
    }
  }
  // raqibning o'ziga borib urilsa ham portlaydi
  if (!crash && d.armT <= 0 && d.vel.lengthSq() > 9) {
    for (const s of G.soldiers) {
      if (!s.alive || s.veh || !hostile(s)) continue;
      const dy = d.pos.y - s.pos.y;
      if (dy > -0.3 && dy < 1.95 && Math.hypot(s.pos.x - d.pos.x, s.pos.z - d.pos.z) < 0.8) { crash = true; break; }
    }
  }
  if (crash) { crashDrone(hitVeh); return; }
  const L = W.half - 1;
  d.pos.x = clamp(d.pos.x, -L, L); d.pos.z = clamp(d.pos.z, -L, L); d.pos.y = Math.min(d.pos.y, DRONE.maxH);
  d.mesh.position.copy(d.pos); d.mesh.rotation.set(-d.vel.z * 0.012, P.yaw, 0);
  d.mesh.visible = !G.droneCtl;   // o'z kameramizdan dron korpusi ko'rinmaydi
  for (const m of d.mesh.userData.rotors) m.rotation.y += dt * 60;
  if (d.snd) d.snd.set(0.16, 0.75 + Math.min(1, d.vel.length() / DRONE.speed) * 0.25);
  // bomba: kamera qaragan tomonga otiladi (pastga qarab tashlasa — tik tushadi)
  if (G.droneCtl && mouse.L && d.fireT <= 0 && d.bombs > 0 && G.state === 'playing') {
    d.bombs--; d.fireT = 0.9;
    camBasis();
    const start = _a.copy(d.pos).addScaledVector(_f, 0.5).addScaledVector(_u, -0.25).clone(), vel = _b.copy(_f).multiplyScalar(22).add(d.vel).clone();
    spawnProjectile(start, vel, 'dbomb', 'player', null, false);
    if (G.mp) net.send({ t: 'rocket', p: v3arr(start), v: v3arr(vel), k: 'dbomb' });
    sound.shot('gl', 0, 0, false);
    d.mesh.userData.bomb.visible = d.bombs > 0;
    if (d.bombs <= 0) popup('Bomba tashlandi — dronni nishonga urib portlatsa ham bo\'ladi');   // dron uchishda davom etadi (batareya tugaguncha)
  }
  // yakka o'yin: dushman askarlari dronni ko'rsa, urib tushirishga harakat qiladi (bitta o'q yetarli)
  d.shotT -= dt;
  if (!G.mp && d.shotT <= 0) {
    d.shotT = 0.5;
    for (const s of G.soldiers) {
      if (!s.alive || s.team !== 'enemy' || s.isZombie) continue;
      const e = s.eye(_a), dist = e.distanceTo(d.pos);
      if (dist > 60 || !W.los(e, d.pos)) continue;
      const rp = relToPlayer(s.pos); sound.shot(s.sound, rp.dist, rp.pan, true);
      G.fx.tracer(s.muzzle(_b), d.pos, 0xffd890);
      if (Math.random() < 0.1 + 0.25 * Math.max(0, 1 - dist / 40)) { endDrone('shot'); return; }
      break;   // yarim soniyada bitta askar otadi
    }
  }
  if (G.mp) { d.netT -= dt; if (d.netT <= 0) { d.netT = 0.08; net.send({ t: 'drone', p: v3arr(d.pos), yw: +P.yaw.toFixed(2) }); } }
  // ekrandagi ko'rsatkich
  const el = $('droneHud');
  if (el.style.display !== 'block') el.style.display = 'block';
  setText('droneHud', `DRON · ${d.bombs > 0 ? 'bomba ×1 [Chap tugma]' : "bomba yo'q"} · batareya ${Math.max(0, Math.ceil(d.t))} s · balandlik ${Math.round(d.pos.y - W.baseHeight(d.pos.x, d.pos.z))} m · tez borib urilsa PORTLAYDI · [F] tashlab chiqish`);
  if (d.t <= 0) endDrone('battery');
}
