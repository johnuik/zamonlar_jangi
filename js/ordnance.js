// Portlovchi narsalar: granata, raketa/snaryad va portlash zarari.
import * as THREE from '../lib/three.module.js';
import { G, _tmp, clamp, disposeTree, glintTex, player, sound } from './core.js';
import { relToPlayer } from './hud.js';
import { damagePlayer } from './game.js';
import { damageVehicle } from './transport.js';
import { hostile, remotes } from './mp.js';
import { BURN_AT } from './vehicles.js';
import { blastDrones } from './drone.js';
import { blastTurrets } from './turret.js';

// ================= TRANSPORT, RAKETALAR, NOYOB QUROLLAR =================
export const PROJ = {
  rocket:  { speed: 75, grav: 0, radius: 6, dmg: 300, vdmg: 600, scale: 1.3, kind: 'rocket', homing: 2.6 },   // homing — nishon berilgan bo'lsa burilish tezligi (rad/s)
  dbomb:   { speed: 22, grav: 13, radius: 5, dmg: 170, vdmg: 300, scale: 0.9, kind: 'grenade' },   // dron tashlaydigan bomba
  hrocket: { speed: 100, grav: 0, radius: 5, dmg: 200, vdmg: 320, scale: 1.1, kind: 'rocket' },
  shell:   { speed: 190, grav: 3, radius: 5, dmg: 260, vdmg: 450, scale: 1.1, kind: 'shell' },   // zenit pushkasi
  gl:      { speed: 40, grav: 12, radius: 5, dmg: 240, vdmg: 260, scale: 1.0, kind: 'grenade' },
  tshell:  { speed: 150, grav: 2, radius: 6, dmg: 320, vdmg: 700, scale: 1.4, kind: 'shell' },
  lshell:  { speed: 165, grav: 2, radius: 4, dmg: 170, vdmg: 380, scale: 1.0, kind: 'shell' },   // yengil tank pushkasi
};

export const _pd = new THREE.Vector3(), _pwh = { point: new THREE.Vector3(), normal: new THREE.Vector3(), dist: 0 };

// ---------- Granatalar ----------
export class Grenade {
  constructor(pos, vel, team, owner, fuse) {
    this.pos = pos.clone(); this.vel = vel.clone(); this.team = team; this.owner = owner;
    this.fuse = fuse > 0 ? fuse : team === 'enemy' ? 3.3 : 2.8; this.dead = false;
    const g = new THREE.Group();
    if (G.era === 'historical') {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 8), new THREE.MeshStandardMaterial({ color: 0x333833 }));
      h.position.y = 0.08; g.add(h);
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0x6a4a2a })));
    } else {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3e4a32, roughness: 0.6 })));
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.mesh = g; G.scene.add(g);
  }
  update(dt) {
    this.fuse -= dt;
    if (this.fuse <= 0) {
      this.dead = true; G.scene.remove(this.mesh); disposeTree(this.mesh, true);
      explode(this.pos, this.team === 'enemy' ? 'enemy' : this.team === 'remote' ? 'remote' : 'player', { owner: this.owner, kind: 'grenade', visual: this.team === 'remote', friendly: G.mp });
      return;
    }
    this.vel.y -= 18 * dt;
    for (const ax of ['x', 'y', 'z']) {
      const old = this.pos[ax];
      this.pos[ax] += this.vel[ax] * dt;
      if (G.world.pointInBox(this.pos)) {
        this.pos[ax] = old;
        if (Math.abs(this.vel[ax]) > 2) sound.bounce(relToPlayer(this.pos).dist);
        this.vel[ax] *= -0.35;
        for (const o of ['x', 'y', 'z']) if (o !== ax) this.vel[o] *= 0.8;
      }
    }
    const gy = G.world.baseHeight(this.pos.x, this.pos.z) + 0.07;
    if (this.pos.y < gy) {
      this.pos.y = gy;
      if (this.vel.y < -2.5) sound.bounce(relToPlayer(this.pos).dist);
      this.vel.y *= -0.3; this.vel.x *= 0.65; this.vel.z *= 0.65;
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.x += this.vel.length() * dt * 2;
  }
}
export function spawnGrenade(pos, vel, team, owner, fuse) { G.grenades.push(new Grenade(pos, vel, team, owner, fuse)); }

export function explode(pos, team, o = {}) {
  const R = o.radius || 7, D = o.dmg || 230;
  G.fx.explosion(pos, o.scale || 1);
  const rp = relToPlayer(pos);
  sound.explosion(rp.dist, rp.pan, o.scale > 1);
  G.shake = Math.max(G.shake, clamp(1.5 - rp.dist / 22, 0, 1.5));
  if (rp.dist < 9) G.flashA = Math.max(G.flashA || 0, 0.5 * (1 - rp.dist / 9));
  G.world.breakGlassNear(pos, R * 1.2);   // yaqindagi deraza oynalari sinadi
  if (G.zg) G.zNoise(pos.x, pos.z, 95);   // portlash uzoqdagi zombilarni ham chaqiradi
  // (tarmoqda boshqa o'yinchining portlashi — faqat ko'rinish: bizning dron/turelga zararni o'sha o'yinchi hisoblab yuboradi, bu yerda takrorlanmaydi)
  blastDrones(pos, R, !o.visual && team === 'player', !!o.visual); blastTurrets(pos, R, !o.visual && team === 'player', !!o.visual);   // yaqindagi dron (o'zimizniki ham) portlashdan yo'q bo'ladi
  if (o.visual) return;
  const c = _tmp.copy(pos); c.y += 0.5;
  const cc = c.clone();
  for (const s of G.soldiers) {
    if (!s.alive) continue;
    if (team === 'player' && s.team === 'ally') continue;
    if (team === 'enemy' && s.team === 'enemy') continue;
    const ap = s.getAimPoint(new THREE.Vector3());
    const d = cc.distanceTo(ap);
    if (d < R && G.world.los(cc, ap)) s.damage((D * (1 - d / R) + 15) * (s.veh && s.veh.T.shield ? 0.5 : 1), pos, false, team === 'player' ? 'player' : o.owner, o.kind || 'grenade');   // zenit to'pchisini qalqon va qum qoplari yarim himoya qiladi
  }
  if (player.alive && !o.friendly && !(G.inVeh && G.inVeh.T.enclosed)) {
    const ap = player.getAimPoint(new THREE.Vector3());
    const d = cc.distanceTo(ap);
    if (d < R && G.world.los(cc, ap, player.vehBox)) damagePlayer(D * (1 - d / R) * 0.85, pos, null);
  }
  for (const v of G.vehicles) {
    if (!v.alive) continue;
    let dmg = 0, tr = 0;
    const direct = o.directVeh === v;
    if (direct) dmg = o.vdmg || D;
    else { const d = cc.distanceTo(v.center(new THREE.Vector3())), RR = R + 2.5; if (d < RR) dmg = (o.vdmg || D) * 0.5 * (1 - d / RR); }
    if (dmg <= 0 || (G.mp && v === G.inVeh)) continue;
    dmg *= v.T.explMul ?? 1;
    if (v.T.tank) {
      if (direct && o.dir) {
        const f = v.facing(o.dir.x, o.dir.z);
        if (f.zone === 'rear') dmg = Math.max(dmg, v.hp - v.T.hp * BURN_AT + 1);   // orqaga tekkan snaryad tankni darhol yondiradi
        else if (f.zone === 'side') tr = f.bit;                                    // yonga (g'ildirakka) tekkani gusenitsani uzadi
      } else if (!direct && D >= 150 && Math.hypot(pos.x - v.pos.x, pos.z - v.pos.z) < v.T.r + 3.2) tr = v.sideOf(pos);   // yonida portlagan bomba ham
    }
    damageVehicle(v, dmg, team === 'player' ? 'player' : 'enemy', tr);
  }
}

// ---------- Raketa / snaryad ----------
export class Projectile {
  // target — quviladigan nishon: faqat transport ({ veh }). Raketa odamni quvmaydi.
  constructor(pos, vel, kind, team, ignore, visual, target) {
    this.pos = pos.clone(); this.vel = vel.clone(); this.kind = kind; this.P = PROJ[kind] || PROJ.rocket;
    this.team = team; this.ignore = ignore || null; this.visual = !!visual; this.life = this.P.life || 7; this.dead = false;
    this.target = target || null;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, kind === 'gl' ? 0.14 : 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x2a2c2a, roughness: 0.5, metalness: 0.5 }));
    body.rotation.x = Math.PI / 2; g.add(body);
    if (kind !== 'gl' && kind !== 'dbomb') {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      glow.scale.set(1.4, 1.4, 1); glow.position.z = -0.3; g.add(glow);
    }
    this.mesh = g; G.scene.add(g);
  }
  kill() { this.dead = true; G.scene.remove(this.mesh); disposeTree(this.mesh, true); }
  boom(pt, veh) {
    const P = this.P;
    explode(pt, this.team, { radius: P.radius, dmg: P.dmg, vdmg: P.vdmg, scale: P.scale, kind: P.kind, visual: this.visual, friendly: G.mp, directVeh: veh, dir: _pd.clone() });
  }
  // Nishonning hozirgi joyi (yo'qolgan bo'lsa — null: raketa to'g'ri uchishda davom etadi)
  targetPos(out) {
    const t = this.target;
    return t.veh && t.veh.alive ? t.veh.center(out) : null;
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.kill(); return; }
    const sp = this.vel.length();
    if (sp < 0.01) { this.kill(); return; }
    // nishonni quvish: tezlik yo'nalishi cheklangan burchak tezligi bilan nishon tomonga buriladi
    const tp = this.target ? this.targetPos(_tp) : null;
    if (tp) {
      _td.copy(tp).sub(this.pos);
      const dist = _td.length();
      if (this.P.fuse && dist < this.P.fuse) { this.kill(); this.boom(this.pos.clone(), null); return; }   // yaqinlashganda o'zi portlaydi
      _td.normalize();
      _pd.copy(this.vel).multiplyScalar(1 / sp);
      const ang = Math.acos(clamp(_pd.dot(_td), -1, 1));
      if (ang > 1e-4) { _pd.lerp(_td, Math.min(1, (this.P.homing || 2) * dt / ang)).normalize(); this.vel.copy(_pd).multiplyScalar(sp); }
    }
    const step = sp * dt;
    _pd.copy(this.vel).multiplyScalar(1 / sp);
    const wh = G.world.rayCast(this.pos, _pd, step, _pwh, this.ignore);
    let t = wh ? wh.dist : step, hit = !!wh, veh = wh && wh.box && wh.box.vehicle ? wh.box.vehicle : null;
    if (this.team === 'player') {
      for (const s of G.soldiers) { if (!s.alive || !hostile(s)) continue; const h = s.hitTest(this.pos, _pd, t); if (h) { t = h.dist; hit = true; veh = null; } }
    } else if (this.team !== 'mate' && player.alive && !G.inVeh) {   // ('mate' — sherikning raketasi: bizdan o'tib ketadi, uning ekranida ham shunday)
      const h = player.hitTest(this.pos, _pd, t);
      if (h) { t = h.dist; hit = true; veh = null; }
    }
    if (hit) {
      const pt = this.pos.clone().addScaledVector(_pd, Math.max(0, t - 0.05));
      this.kill();
      this.boom(pt, veh);
      return;
    }
    this.pos.addScaledVector(this.vel, dt);
    this.vel.y -= this.P.grav * dt;
    this.mesh.position.copy(this.pos);
    this.mesh.lookAt(this.pos.x + this.vel.x, this.pos.y + this.vel.y, this.pos.z + this.vel.z);
    if (this.kind !== 'gl' && this.kind !== 'dbomb') {
      const g = 0.75;
      G.fx.norm.emit(this.pos.x, this.pos.y, this.pos.z, (Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 0.6, 0.35, 1.3, g, g, g, 0.5, -0.2, 0.8);
      G.fx.add.emit(this.pos.x, this.pos.y, this.pos.z, 0, 0, 0, 0.12, 0.5, -1, 1, 0.6, 0.2, 0.9, 0, 0);
    }
  }
}
export function spawnProjectile(pos, vel, kind, team, ignore, visual, target) { G.projectiles.push(new Projectile(pos, vel, kind, team, ignore, visual, target)); }

const _tp = new THREE.Vector3(), _td = new THREE.Vector3();
// Transport "dushmanniki"mi (ichida sherigimiz yo'q)? Bo'sh transport ham nishon bo'la oladi.
export function vehHostile(v) {
  if (!G.mp) return true;
  for (const id of v.seats) { if (id == null) continue; if (id === G.myId) return false; const r = remotes.get(id); if (r && !hostile(r)) return false; }
  return true;
}
