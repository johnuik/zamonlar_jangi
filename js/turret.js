// Avtomatik turel (noyob qurol): yerga o'rnatiladi va 55 m ichidagi dushmanni o'zi topib otadi.
// Egasining kompyuterida hisoblanadi (zarar — egasining o'qi sifatida); boshqalar faqat ko'rinishini va o'qlarini ko'radi.
import * as THREE from '../lib/three.module.js';
import { G, player } from './core.js';
import { popup, relToPlayer, hitmarker } from './hud.js';
import { hostile, net, remotes, v3arr } from './mp.js';
import { raySphere } from './world.js';
import { hostileDrones, killRemoteDrone } from './drone.js';
import { turretVisual } from './vehskin.js';

// Ustunligi: 55 m ichida o'zi qo'riqlaydi (o'yinchi boshqa ish bilan band bo'lsa ham), ko'rgan raqibini xaritada belgilaydi (razvedka)
// va raqib dronini urib tushiradi. Zaifligi: joyidan qimirlamaydi va uni otib yoki portlatib yo'q qilsa bo'ladi (hp).
export const TURRET = { life: 75, range: 55, rpm: 600, dmg: 22, spread: 0.012, max: 2, hp: 140, radar: 55 };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _wh = { point: new THREE.Vector3(), normal: new THREE.Vector3(), dist: 0 };
let seq = 1;

function buildTurret(era) {
  // haqiqiy model (vehskin.js: TURRET_DEFS): taglik joyida, pulemyot aylanadi; holat chirog'i boshning ustida
  const mv = turretVisual(era);
  if (mv) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0x55ff66 })); lamp.position.set(0.06, mv.headTop + 0.02, -0.12); mv.head.add(lamp);
    return { g: mv.g, head: mv.head, lamp, eyeH: mv.eyeH };
  }
  const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: era === 'historical' ? 0x3d4236 : 0x2b2e31, roughness: 0.55, metalness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x6a6f74, roughness: 0.4, metalness: 0.8 });
  for (let i = 0; i < 3; i++) {   // uch oyoq
    const a = (i / 3) * Math.PI * 2, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.95, 6), steel);
    leg.position.set(Math.sin(a) * 0.28, 0.4, Math.cos(a) * 0.28); leg.rotation.set(Math.cos(a) * 0.62, 0, -Math.sin(a) * 0.62); g.add(leg);
  }
  const head = new THREE.Group(); head.position.y = 0.88; g.add(head);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.42), dark); head.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.55, 8), steel); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, 0.46); head.add(barrel);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.2), dark); box.position.set(-0.2, -0.02, 0.02); head.add(box);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0x55ff66 })); lamp.position.set(0.09, 0.14, -0.1); head.add(lamp);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, head, lamp };
}
function add(pos, yaw, own, key) {
  const m = buildTurret(G.era); m.headBase = m.head.position.clone();
  m.g.position.copy(pos); m.head.rotation.y = yaw; G.scene.add(m.g);
  const t = { key, pos: pos.clone(), yaw, t: TURRET.life + (own ? 0 : 4), own, mesh: m, fireT: 0.6, scanT: 0, target: null, hp: TURRET.hp };
  (G.turrets = G.turrets || []).push(t);
  return t;
}
function remove(t, fx = true) {
  if (t.mesh.g.parent) t.mesh.g.parent.remove(t.mesh.g);
  t.mesh.g.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && !o.material.userData.shared) o.material.dispose(); });   // (model geometriyasi hamma turellar uchun umumiy)
  G.turrets = (G.turrets || []).filter((x) => x !== t);
  if (fx && G.fx) G.fx.impact(_a.copy(t.pos).setY(t.pos.y + 0.8), _b.set(0, 1, 0), 'wall');
}
export function clearTurrets() { for (const t of (G.turrets || []).slice()) remove(t, false); G.turrets = []; }

// O'rnatish: ekran markazi qaragan tomonga, 1,7 m oldinga. Qaytaradi: o'rnatildimi.
export function deployTurret() {
  const P = player, W = G.world;
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), x = P.pos.x + fx * 1.7, z = P.pos.z + fz * 1.7;
  const y = W.groundHeight(x, z, 0.3, P.pos.y);
  if (Math.abs(y - P.pos.y) > 0.6 || W.pointInBox(_a.set(x, y + 0.5, z)) || W.pointInBox(_a.set(x, y + 1.0, z)) || !W.los(_a.set(P.pos.x, P.pos.y + 1.0, P.pos.z), _b.set(x, y + 1.0, z), P.vehBox)) { popup("Turelni bu yerga o'rnatib bo'lmaydi — tekisroq va ochiq joy tanlang", true); return false; }
  const mine = (G.turrets || []).filter((t) => t.own);
  if (mine.length >= TURRET.max) removeOwn(mine[0]);   // ko'pi bilan ikkita — eng eskisi yig'ishtiriladi
  const t = add(_e.set(x, y, z), Math.atan2(fx, fz), true, seq++);
  if (G.mp) net.send({ t: 'turret', n: t.key, p: v3arr(t.pos), yw: +t.yaw.toFixed(2) });
  G.sound.door();
  return true;
}
function removeOwn(t) { if (G.mp) net.send({ t: 'turret', n: t.key, off: 1 }); remove(t); }
// Egasi halok bo'lsa yoki jang tugasa — o'z turellarimiz o'chadi
export function dropOwnTurrets() { for (const t of (G.turrets || []).filter((x) => x.own)) removeOwn(t); }

// O'q raqib tureliga tegadimi? (arsenal.js hitscan chaqiradi.) Qaytaradi: { dist, t } yoki null.
export function hitRemoteTurret(o, dir, maxD) {
  let best = null;
  for (const t of G.turrets || []) {
    if (t.own || !t.owner) continue;
    const ow = remotes.get(t.owner);
    if (ow && !hostile(ow)) continue;   // sherikning tureliga o'q tegmaydi
    const d = raySphere(o, dir, t.pos.x, t.pos.y + 0.8, t.pos.z, 0.5);
    if (d < maxD && (!best || d < best.dist)) best = { dist: d, t };
  }
  return best;
}
// Raqib tureliga zarar: egasiga xabar beriladi (jonini u hisoblaydi)
export function damageRemoteTurret(t, dmg) { net.send({ t: 'thit', id: t.owner, n: +String(t.key).split(':')[1] || 0, dmg: Math.round(dmg) }); }
// Tarmoq: o'z turelimizga o'q tegdi
export function onTurretHit(o) {
  const t = (G.turrets || []).find((x) => x.own && x.key === o.n);
  if (!t) return;
  t.hp -= Math.max(0, Math.min(500, +o.dmg || 0));
  if (t.hp <= 0) { popup('TURELINGIZ YO\'Q QILINDI', true); removeOwn(t); }
}
// Portlash yaqinidagi turellar (ordnance.js): o'zimizniki — darhol, raqibniki — egasiga xabar
export function blastTurrets(pos, R, mine, visual) {
  for (const t of (G.turrets || []).slice()) {
    const d = pos.distanceTo(_a.set(t.pos.x, t.pos.y + 0.6, t.pos.z));
    if (d > R * 0.7) continue;
    if (t.own) { if (visual) continue; t.hp -= 260 * (1 - d / R); if (t.hp <= 0) removeOwn(t); }   // (boshqa o'yinchining portlashi zararini 'thit' orqali o'zi yuboradi)
    else if (mine && G.mp && t.owner) { const ow = remotes.get(t.owner); if (!ow || hostile(ow)) damageRemoteTurret(t, 260 * (1 - d / R)); }
  }
}
// Tarmoq: boshqa o'yinchining tureli
export function onRemoteTurret(o) {
  const key = o.id + ':' + o.n, cur = (G.turrets || []).find((t) => t.key === key);
  if (o.off) { if (cur) remove(cur); return; }
  if (cur) { cur.seen = 0; return; }   // egasi har 2 soniyada qayta e'lon qiladi — turel hali joyida
  if (!Array.isArray(o.p) || o.p.length !== 3 || !o.p.every(Number.isFinite)) return;
  add(_e.set(o.p[0], o.p[1], o.p[2]), Number.isFinite(o.yw) ? o.yw : 0, false, key).owner = o.id;
}
export function removeTurretsOf(id) { for (const t of (G.turrets || []).filter((x) => x.owner === id)) remove(t); }
// Tarmoq: begona turel o'q uzgan tomonga buriladi ('shot' xabaridan)
export function aimRemoteTurret(id, A, B) {
  for (const t of G.turrets || []) if (t.owner === id && Math.hypot(t.pos.x - A.x, t.pos.z - A.z) < 1.4 && Math.abs(t.pos.y + 0.9 - A.y) < 0.6) { t.yaw = Math.atan2(B.x - t.pos.x, B.z - t.pos.z); t.kick = 1; }
}

let annT = 0;
export function updateTurrets(dt) {
  const list = G.turrets;
  if (!list || !list.length) return;
  // tarmoq: o'z turellarimiz har 2 soniyada qayta e'lon qilinadi — jang o'rtasida qo'shilgan yoki qayta ulangan o'yinchi ham ularni ko'rsin va ura olsin
  if (G.mp) { annT -= dt; if (annT <= 0) { annT = 2; for (const t of list) if (t.own) net.send({ t: 'turret', n: t.key, p: v3arr(t.pos), yw: +t.yaw.toFixed(2) }); } }
  for (const t of list.slice()) {
    t.t -= dt;
    if (t.t <= 0) { if (t.own) removeOwn(t); else remove(t); continue; }
    // boshqa o'yinchining tureli: egasidan 8 soniya xabar kelmasa (aloqasi uzilgan, qayta ulangan) — o'chiriladi, "arvoh" turel o'qlarni yutib turmaydi
    if (!t.own && G.mp) { t.seen = (t.seen || 0) + dt; if (t.seen > 8) { remove(t); continue; } }
    const head = t.mesh.head;
    if (t.own) {
      if (!player.alive) { removeOwn(t); continue; }
      const eye = _a.set(t.pos.x, t.pos.y + (t.mesh.eyeH || 0.9), t.pos.z);   // (stvol balandligi — modelga qarab)
      t.scanT -= dt;
      if (t.scanT <= 0) {
        t.scanT = 0.15;
        let best = null, bd = TURRET.range;
        for (const s of G.soldiers) {
          if (!s.alive || s.hidden || !hostile(s)) continue;
          const ap = s.getAimPoint(_b), d = eye.distanceTo(ap);
          if (d > TURRET.radar || !G.world.los(eye, ap)) continue;
          s.seenAt = G.time;                       // razvedka: turel ko'rgan raqib xaritada belgilanadi
          if (d < bd) { bd = d; best = s; }
        }
        t.target = best;
        // raqib droni ko'rinsa — avval uni urib tushiradi
        for (const dr of hostileDrones()) if (eye.distanceTo(dr.pos) < TURRET.range && G.world.los(eye, dr.pos)) {
          t.yaw = Math.atan2(dr.pos.x - t.pos.x, dr.pos.z - t.pos.z); t.kick = 1;
          G.fx.tracer(_e.copy(eye), dr.pos, 0xffe6a8, 380); G.fx.muzzle(eye, 0.8);
          const rp = relToPlayer(t.pos); G.sound.shot('mg', rp.dist, rp.pan, false);
          killRemoteDrone(dr.id); break;
        }
      }
      const s = t.target;
      if (s && s.alive) {
        const ap = s.getAimPoint(_b), want = Math.atan2(ap.x - t.pos.x, ap.z - t.pos.z);
        let dy = want - t.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
        t.yaw += dy * Math.min(1, dt * 9);
        t.fireT -= dt;
        if (t.fireT <= 0 && Math.abs(dy) < 0.2) {
          t.fireT = 60 / TURRET.rpm;
          _d.copy(ap).sub(eye).normalize();
          _d.x += (Math.random() - 0.5) * 2 * TURRET.spread; _d.y += (Math.random() - 0.5) * 2 * TURRET.spread; _d.z += (Math.random() - 0.5) * 2 * TURRET.spread; _d.normalize();
          const mz = _e.copy(eye).addScaledVector(_d, 0.75);
          const wh = G.world.rayCast(mz, _d, TURRET.range + 10, _wh), h = s.hitTest(mz, _d, wh ? wh.dist : TURRET.range + 10);
          const end = mz.clone().addScaledVector(_d, h ? h.dist : wh ? wh.dist : TURRET.range);
          if (h) { s.damage(TURRET.dmg * (h.mul || 1), t.pos, false, 'player', 'turret'); G.fx.blood(end, _d, !s.alive); if (!s.alive) hitmarker(!G.mp); }
          else if (wh) G.fx.impact(wh.point, wh.normal, wh.ground ? 'ground' : 'wall');
          G.world.breakGlass(mz, end); G.fx.tracer(mz, end, 0xffe6a8, 380); G.fx.muzzle(mz, 0.8); if (G.zg) G.zNoise(t.pos.x, t.pos.z, 60);
          const rp = relToPlayer(t.pos); G.sound.shot('mg', rp.dist, rp.pan, false);
          if (G.mp) net.send({ t: 'shot', a: v3arr(mz), b: v3arr(end), s: 'mg' });
          t.kick = 1;
        }
      } else t.yaw += dt * 0.5;   // nishon yo'q — sekin aylanib qidiradi
    }
    t.kick = Math.max(0, (t.kick || 0) - dt * 12);
    const hb = t.mesh.headBase;   // (boshning tinch holatdagi joyi — model aylanish o'qi markazda bo'lmasligi mumkin)
    head.rotation.y = t.yaw; head.position.z = hb.z - t.kick * 0.03 * Math.cos(t.yaw); head.position.x = hb.x - t.kick * 0.03 * Math.sin(t.yaw);
    t.mesh.lamp.material.color.setHex(t.t < 6 && Math.sin(G.time * 12) > 0 ? 0xff3322 : t.target ? 0xffaa22 : 0x55ff66);   // o'chishiga oz qolganda qizil miltillaydi
  }
}
