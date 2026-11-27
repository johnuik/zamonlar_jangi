import * as THREE from '../lib/three.module.js';
import { rayAABB, raySphere, rayCyl, inv } from './world.js';
import { CHAR_K } from './shared.mjs';
import { makeSoldierModel, animateSoldier, animateDeath } from './soldiermodel.js';

export const TYPES = {
  rifle:   { hp: 100, speed: 3.3, range: 55, prefer: 22, dmg: 14, rpm: 110, burst: [1, 2], pause: [1.0, 1.9], acc: 0.42, name: 'Askar' },
  smg:     { hp: 85,  speed: 4.5, range: 28, prefer: 8,  dmg: 8,  rpm: 650, burst: [4, 8], pause: [0.8, 1.5], acc: 0.3, name: 'Hujumchi' },
  heavy:   { hp: 300, speed: 2.4, range: 45, prefer: 18, dmg: 9,  rpm: 720, burst: [8, 16], pause: [1.2, 2.2], acc: 0.27, name: 'Pulemyotchi', scale: 1.07 },
  sniper:  { hp: 90,  speed: 2.7, range: 100, prefer: 42, dmg: 48, rpm: 40, burst: [1, 1], pause: [2.8, 4.2], acc: 0.55, name: 'Snayper' },
  officer: { hp: 150, speed: 3.1, range: 30, prefer: 13, dmg: 12, rpm: 320, burst: [2, 4], pause: [1.0, 1.6], acc: 0.4, name: 'Ofitser' },
  zombie:  { hp: 60,  speed: 2.6, range: 2,  prefer: 1,  dmg: 13, rpm: 60,  burst: [1, 1], pause: [1, 1], acc: 1, name: 'Zombi' },
  ally:    { hp: 220, speed: 4.4, range: 60, prefer: 12, dmg: 24, rpm: 520, burst: [3, 6], pause: [0.6, 1.2], acc: 0.32, name: 'Ittifoqchi' },
};

const SOUNDS = {
  historical: { rifle: 'bolt', smg: 'smg', heavy: 'mg', sniper: 'bolt', officer: 'pistol', ally: 'smg' },
  modern: { rifle: 'ar', smg: 'smg', heavy: 'mg', sniper: 'sniper', officer: 'pistol', ally: 'ar' },
};

function palette(era, team, type) {
  if (era === 'historical') {
    if (team === 'ally') return { uni: 0x6b5f3e, pants: 0x5d5236, helm: 0x4e5236, gear: 0x3d3424, skin: 0xd1a07c, helmet: 'round' };
    const p = { uni: 0x5c6152, pants: 0x4d5146, helm: 0x45484a, gear: 0x2a2a26, skin: 0xd8ab88, helmet: 'stahl' };
    if (type === 'officer') { p.uni = 0x4a5048; p.helmet = 'cap'; p.helm = 0x3a3e3a; }
    if (type === 'heavy') { p.uni = 0x4a4e44; p.gear = 0x1e1e1c; }
    if (type === 'smg') p.uni = 0x666a5a;
    return p;
  }
  if (team === 'ally') return { uni: 0xa89878, pants: 0x9a8a6a, helm: 0x8c7c5c, gear: 0x6a6a50, skin: 0xc8956e, helmet: 'modern', vest: true };
  const p = { uni: 0x3c3a34, pants: 0x4a4638, helm: 0x222222, gear: 0x2b2a26, skin: 0xb58263, helmet: 'mask', vest: true };
  if (type === 'smg') { p.uni = 0x5a5040; p.helmet = 'mask'; p.vest = false; }
  if (type === 'heavy') { p.uni = 0x2a2a28; p.gear = 0x151515; p.helmet = 'modern'; }
  if (type === 'sniper') { p.uni = 0x6a6448; p.pants = 0x5a5440; p.helmet = 'boonie'; p.helm = 0x7a7050; }
  if (type === 'officer') { p.uni = 0x2f3a2c; p.helmet = 'beret'; p.helm = 0x5a1a1a; }
  return p;
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _d = new THREE.Vector3(), _tmpBox = new THREE.Box3();
const rnd = (a, b) => a + Math.random() * (b - a);

export function markerTexture(name, color = '#7fe08a') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 28px Arial'; g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(name, 129, 30);
  g.fillStyle = color; g.fillText(name, 128, 28);
  g.beginPath(); g.moveTo(116, 38); g.lineTo(140, 38); g.lineTo(128, 56); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Soldier {
  constructor(game, team, type, pos, name) {
    this.g = game; this.team = team; this.type = type; this.T = TYPES[type];
    this.name = name || this.T.name;
    this.pos = pos.clone(); this.vel = new THREE.Vector3();
    this.yaw = Math.atan2(-pos.x, -pos.z);
    this.s = (this.T.scale || 1) * CHAR_K;
    this.maxHp = this.T.hp * (team === 'enemy' ? game.diff.hpMul : 1);
    this.hp = this.maxHp;
    this.alive = true; this.deadT = 0; this.remove = false;
    this.target = null; this.visible = false; this.visT = 0; this.losTimer = Math.random() * 0.2;
    this.lastKnown = new THREE.Vector3();
    this.cool = rnd(0.8, 1.8); this.burstLeft = 0; this.shotT = 0;
    this.strafeT = rnd(1, 2.5); this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.crouch = false; this.crouchAmt = 0; this.crouchT = rnd(2, 5);
    this.prone = false; this.proneAmt = 0;   // yotgan holat (tarmoqdagi o'yinchilar)
    this.walkPhase = Math.random() * 6; this.lastFired = -99; this.hitFlash = 0;
    this.grenadeCool = rnd(10, 22); this.rocketCool = rnd(5, 14); this.hiddenT = 0; this.gunKick = 0;
    this.stuckT = 0; this.detourT = 0; this.detour = new THREE.Vector3(); this.descend = -1; this.descT = 0;
    this.lastPos = this.pos.clone();
    this.sound = SOUNDS[game.era][type] || 'ar';
    this.buildModel();
  }

  // Model js/soldiermodel.js da yig'iladi: bo'g'imli tana, anjomlar, qurol (geometriyasi bir xil turdagi askarlar uchun umumiy)
  buildModel() {
    const team = this.team, type = this.type;
    const root = makeSoldierModel(this, this.g.era, team, type);
    root.position.copy(this.pos);
    root.rotation.y = this.yaw;
    this.g.scene.add(root);
    this.root = root;

    if (team === 'ally') {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture(this.name), depthTest: false, transparent: true, fog: false }));
      sp.scale.set(1.6, 0.4, 1); sp.position.set(0, 2.35, 0); sp.renderOrder = 999;
      root.add(sp); this.marker = sp;
    }
    if (type === 'sniper' && team === 'enemy') {
      const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.g.glintTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      glint.scale.set(0.9, 0.9, 1); glint.position.copy(this.glintLocal || this.muzzleLocal); glint.visible = false;
      root.add(glint); this.glint = glint;
    }
  }

  // ---------- Geometrik so'rovlar ----------
  // (o'lchamlar chizilgan model bo'yicha: transport o'rindig'ida o'tirgan odam eski o'lchamda chiziladi — drawS)
  eye(out) { const p = this.proneAmt; return out.set(this.pos.x, this.pos.y + ((1.62 - this.crouchAmt * 0.45) * (1 - p) + 0.4 * p) * (this.drawS || this.s), this.pos.z); }
  getAimPoint(out) { const p = this.proneAmt; return out.set(this.pos.x, this.pos.y + ((1.2 - this.crouchAmt * 0.4) * (1 - p) + 0.2 * p) * (this.drawS || this.s), this.pos.z); }
  muzzle(out) {
    const s = this.drawS || this.s, c = Math.cos(this.yaw), sn = Math.sin(this.yaw);
    const lx = this.muzzleLocal.x * s, ly = (this.muzzleLocal.y - this.crouchAmt * 0.45) * s, lz = this.muzzleLocal.z * s;
    return out.set(this.pos.x + lx * c + lz * sn, this.pos.y + ly, this.pos.z - lx * sn + lz * c);
  }
  // Nishon hajmlari tana shakliga mos: bosh (shar), tana (silindr), oyoqlar (ingichkaroq silindr), qo'llar (tana atrofidagi halqa).
  // Tananing yonidan o'tgan o'q endi tegmaydi. Qaytaradi: { dist, head, zone, mul } — mul: oyoq/qo'lga tekkan o'qning zarar ko'paytuvchisi.
  hitTest(o, d, maxD) {
    if (!this.alive) return null;
    if (this.proneAmt > 0.5) return this.hitTestProne(o, d, maxD);
    const s = this.drawS || this.s, w = s * (this.build || 1), c = this.crouchAmt, co = c * 0.45, x = this.pos.x, y = this.pos.y, z = this.pos.z;
    const hf = this.zombie ? 0.14 * s : 0;   // zombining boshi oldinga engashgan
    const th = raySphere(o, d, x + Math.sin(this.yaw) * hf, y + (1.66 - co) * s - (hf ? 0.03 : 0), z + Math.cos(this.yaw) * hf, 0.13 * s);
    const hip = (0.92 - co) * s;
    const tt = rayCyl(o, d, x, z, 0.21 * w, y + hip, y + (1.56 - co) * s);
    const tl = rayCyl(o, d, x, z, (0.17 + 0.09 * c) * w, y, y + hip);
    let t = th, zone = 'head', mul = 1;
    if (tt < t) { t = tt; zone = 'torso'; }
    if (tl < t) { t = tl; zone = 'leg'; mul = 0.75; }
    if (t === Infinity) {   // tanani chetlab o'tgan o'q faqat qo'lga tegishi mumkin
      const ta = rayCyl(o, d, x, z, 0.3 * w, y + (1.02 - co) * s, y + (1.5 - co) * s);
      if (ta < Infinity) { t = ta; zone = 'arm'; mul = 0.7; }
    }
    if (t > maxD) return null;
    return { dist: t, head: zone === 'head', zone, mul, soldier: this };
  }

  // Yotgan askar: bosh old tomonda (pos yonida), tana va oyoqlar orqaga cho'zilgan — yer bo'ylab sharlar zanjiri
  hitTestProne(o, d, maxD) {
    const s = this.s, fx = Math.sin(this.yaw) * s, fz = Math.cos(this.yaw) * s, x = this.pos.x, y = this.pos.y, z = this.pos.z;
    let t = raySphere(o, d, x + fx * 0.08, y + 0.3 * s, z + fz * 0.08, 0.14 * s), zone = 'head', mul = 1;
    for (const k of [0.3, 0.58]) { const tt = raySphere(o, d, x - fx * k, y + 0.2 * s, z - fz * k, 0.24 * s); if (tt < t) { t = tt; zone = 'torso'; mul = 1; } }
    for (const k of [0.92, 1.22, 1.5]) { const tl = raySphere(o, d, x - fx * k, y + 0.14 * s, z - fz * k, 0.17 * s); if (tl < t) { t = tl; zone = 'leg'; mul = 0.75; } }
    if (t > maxD) return null;
    return { dist: t, head: zone === 'head', zone, mul, soldier: this };
  }

  // Qadam: yaqinda yurgan odam eshitiladi va (raqib bo'lsa) xaritada iz qoldiradi. Cho'kkalab yoki yotib yurgan odam sassiz.
  footstep(dt, sp) {
    if (sp < 2.3 || this.crouchAmt > 0.5 || this.proneAmt > 0.5 || this.hidden) { this.stepD = 0; return; }
    this.stepD = (this.stepD || 0) + sp * dt;
    const run = sp > 5.2;
    if (this.stepD < (run ? 2.7 : 2.1)) return;
    this.stepD = 0;
    const g = this.g, pd = g.relToPlayer(this.pos);
    if (pd.dist > (run ? 36 : 24)) return;
    g.sound.stepAt(g.era, pd.dist, pd.pan, run);
    if (g.noise && g.hostile && g.hostile(this)) g.noise(this.pos, 'step');
  }

  // ---------- Nishonni tanlash ----------
  acquire() {
    const g = this.g;
    const eye = this.eye(_v);
    let best = null, bestScore = 1e9;
    const consider = (t, isPlayer) => {
      const ap = t.getAimPoint(_v2);
      const dx = ap.x - eye.x, dz = ap.z - eye.z, dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > this.T.range * 1.6) return;
      const score = isPlayer ? dist * 0.8 : dist;
      if (score >= bestScore) return;
      if (!g.world.los(eye, ap, t.vehBox)) return;
      best = t; bestScore = score;
    };
    if (this.team === 'enemy') {
      if (g.player.alive) consider(g.player, true);
      for (const s of g.soldiers) if (s.alive && s.team === 'ally') consider(s, false);
    } else {
      for (const s of g.soldiers) if (s.alive && s.team === 'enemy') consider(s, false);
    }
    if (best) {
      if (best !== this.target || !this.visible) this.visT = 0;
      this.target = best; this.visible = true;
      best.getAimPoint(this.lastKnown);
    } else {
      this.visible = false;
    }
  }

  // ---------- Har kadr yangilanish ----------
  update(dt) {
    const g = this.g;
    if (!this.alive) { this.updateDead(dt); return; }
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      const e = this.hitFlash > 0 ? 0x661111 : 0x000000;
      for (const m of this.mats) m.emissive.setHex(e);
    }
    this.losTimer -= dt;
    if (this.losTimer <= 0) { this.losTimer = 0.18 + Math.random() * 0.12; this.acquire(); }

    const T = this.T, P = g.player;
    let mx = 0, mz = 0, speed = T.speed;
    const toP = _d.set(P.pos.x - this.pos.x, 0, P.pos.z - this.pos.z);
    const distP = toP.length();
    let engaging = false;

    if (this.visible && this.target) {
      const tp = this.target.getAimPoint(_v2);
      const dx = tp.x - this.pos.x, dz = tp.z - this.pos.z, dT = Math.sqrt(dx * dx + dz * dz) || 1;
      const allyFar = this.team === 'ally' && distP > 16;
      if (!allyFar && dT < T.prefer * 1.3) {
        engaging = true;
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafeT = rnd(1, 2.6); this.strafeDir = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.25) this.strafeDir = 0; }
        this.crouchT -= dt;
        if (this.crouchT <= 0) { this.crouchT = rnd(2, 5); this.crouch = this.type !== 'smg' && Math.random() < 0.5; }
        if (!this.crouch) { mx = (-dz / dT) * this.strafeDir; mz = (dx / dT) * this.strafeDir; speed *= 0.45; }
        if (dT < T.prefer * 0.45 && this.type !== 'smg') { mx -= dx / dT; mz -= dz / dT; this.crouch = false; }
        if (this.type === 'smg' && dT > 4) { mx += dx / dT * 0.8; mz += dz / dT * 0.8; this.crouch = false; }
      }
    }
    if (!engaging) {
      this.crouch = false;
      const W = g.world, lvl = W.levelOf(this.pos), tPit = g.playerPit;
      let wp = null;   // to'g'ridan-to'g'ri boriladigan nuqta (zinapoya)
      if (this.descend >= 0) {
        const p = W.pits[this.descend];
        this.descT -= dt;
        if (this.pos.y <= p.floor + 0.3 || this.descT <= 0 || tPit !== this.descend) this.descend = -1;
        else wp = p.stairBot;
      }
      if (!wp && lvl >= 0 && lvl !== tPit) {            // podvaldan chiqish
        const p = W.pits[lvl];
        if (this.pos.y <= p.floor + 0.25 && Math.hypot(p.stairBot.x - this.pos.x, p.stairBot.z - this.pos.z) > 0.6) wp = p.stairBot;
        else wp = this.pos.y < -0.45 ? p.stairStep : p.stairTop;
      } else if (!wp && tPit >= 0 && lvl !== tPit) {    // podvalga tushish
        const p = W.pits[tPit];
        if (Math.hypot(p.stairTop.x - this.pos.x, p.stairTop.z - this.pos.z) < 0.9) { this.descend = tPit; this.descT = 4; wp = p.stairBot; }
      }
      const sameBase = lvl >= 0 && lvl === tPit;
      const goalNear = sameBase ? distP < 1.6 : tPit >= 0 ? false : this.team === 'ally' ? distP < 5 : distP < 3;
      if (wp) {
        const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z, L = Math.hypot(dx, dz);
        if (L > 0.05) { mx = dx / L; mz = dz / L; }
      } else if (!goalNear) {
        if (this.detourT > 0) { this.detourT -= dt; mx = this.detour.x; mz = this.detour.z; }
        else if (!sameBase && g.world.flowDir(this.pos.x, this.pos.z, _v)) { mx = _v.x; mz = _v.z; }
        else if (distP > 0.1) { mx = toP.x / distP; mz = toP.z / distP; }
        if (this.team === 'ally' && distP < 9 && tPit < 0) speed *= 0.6;
      }
    }
    // Harakat
    const ml = Math.sqrt(mx * mx + mz * mz);
    if (ml > 0.01) { mx /= ml; mz /= ml; }
    const k = Math.min(1, dt * 8);
    this.vel.x += (mx * speed - this.vel.x) * k;
    this.vel.z += (mz * speed - this.vel.z) * k;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    // boshqa askarlardan ajralish
    for (const o of g.soldiers) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.64 && d2 > 1e-6) { const d = Math.sqrt(d2), p = (0.8 - d) * 0.5 / d; this.pos.x += dx * p; this.pos.z += dz * p; }
    }
    { const dx = this.pos.x - P.pos.x, dz = this.pos.z - P.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.7 && d2 > 1e-6) { const d = Math.sqrt(d2), p = (0.84 - d) / d; this.pos.x += dx * p; this.pos.z += dz * p; } }
    g.world.collideCircle(this.pos, 0.36 * this.s, this.pos.y, this.pos.y + 1.7 * this.s);
    { const gh = g.world.groundHeight(this.pos.x, this.pos.z, 0.3, this.pos.y);
      this.pos.y = gh >= this.pos.y ? gh : Math.max(gh, this.pos.y - 9 * dt); }

    // Tiqilib qolishni aniqlash
    this.stuckT += dt;
    if (this.stuckT > 1.2) {
      const moved = this.pos.distanceTo(this.lastPos);
      if (ml > 0.1 && moved < 0.5 && !engaging) {
        const a = Math.random() * Math.PI * 2;
        this.detour.set(Math.cos(a), 0, Math.sin(a)); this.detourT = 0.9;
      }
      this.lastPos.copy(this.pos); this.stuckT = 0;
    }

    // Burilish
    let wantYaw = this.yaw;
    if (this.visible && this.target) { const tp = this.target.getAimPoint(_v2); wantYaw = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z); }
    else if (Math.abs(this.vel.x) + Math.abs(this.vel.z) > 0.3) wantYaw = Math.atan2(this.vel.x, this.vel.z);
    let dy = wantYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 7);

    // Animatsiya: nishon ko'ringanda qurol yelkada va nishon balandligiga qaratilgan, aks holda pastga tushirilgan
    this.crouchAmt += ((this.crouch ? 1 : 0) - this.crouchAmt) * Math.min(1, dt * 8);
    const sp = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
    if (this.team === 'enemy' && !this.isZombie) this.footstep(dt, sp);   // dushman askarning qadami (ittifoqchilar doim yonimizda — ularniki eshittirilmaydi)
    const aiming = this.visible && !!this.target;
    let pitch = 0;
    if (aiming) { const tp = this.target.getAimPoint(_v2); pitch = Math.atan2(tp.y - (this.pos.y + this.muzzleLocal.y * this.s), Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z) || 1); }
    animateSoldier(this, dt, sp, aiming, pitch);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;

    // O'q otish
    if (this.visible && this.target && this.target.alive !== false) {
      this.visT += dt; this.hiddenT = 0;
      const react = g.diff.reaction * (this.team === 'ally' ? 0.7 : 1) * (this.type === 'sniper' ? 1.6 : 1);
      if (this.glint) this.glint.visible = this.target === P && (Math.sin(g.time * 9) > 0.2 || this.cool < 0.6);
      if (this.visT > react && Math.abs(dy) < 0.35) {
        if (this.burstLeft > 0) {
          this.shotT -= dt;
          if (this.shotT <= 0) {
            this.fire(); this.burstLeft--; this.shotT = 60 / T.rpm;
            if (this.burstLeft <= 0) this.cool = rnd(T.pause[0], T.pause[1]);
          }
        } else {
          this.cool -= dt;
          if (this.cool <= 0) { this.burstLeft = Math.round(rnd(T.burst[0], T.burst[1])); this.shotT = 0; }
        }
      }
    } else {
      if (this.glint) this.glint.visible = false;
      this.visT = 0; this.burstLeft = 0; this.cool = Math.max(this.cool, 0.4);
      this.hiddenT += dt;
    }

    // Granata otish (dushman)
    if (this.team === 'enemy') {
      this.grenadeCool -= dt;
      if (this.grenadeCool <= 0 && this.hiddenT > 2.5 && distP > 7 && distP < 26 && g.canEnemyGrenade()) {
        this.grenadeCool = rnd(16, 28);
        this.throwGrenade();
      }
      // Zirhli transportdagi o'yinchiga (tank, vertolyot) qarshi raketa
      this.rocketCool -= dt;
      const pv = g.inVeh;
      if (this.rocketCool <= 0 && pv && pv.alive && pv.T.enclosed && this.visible && this.target === P && this.pos.distanceTo(pv.pos) < 65 && g.canEnemyRocket()) {
        this.rocketCool = rnd(14, 24);
        this.fireRocket(pv);
      }
    }
  }

  fireRocket(v) {
    const g = this.g, SPEED = 75;
    const mz = this.muzzle(new THREE.Vector3());
    const aim = v.center(new THREE.Vector3());
    const t = (mz.distanceTo(aim) / SPEED) * 0.7;   // nishon harakatini qisman hisobga oladi
    aim.x += v.vel.x * t + rnd(-1.2, 1.2); aim.y += v.vel.y * t + rnd(-0.5, 0.8); aim.z += v.vel.z * t + rnd(-1.2, 1.2);
    g.spawnProjectile(mz, aim.sub(mz).normalize().multiplyScalar(SPEED), 'rocket', 'enemy');
    g.fx.muzzle(mz, 1.6);
    const pd = g.relToPlayer(this.pos);
    g.sound.shot('rocket', pd.dist, pd.pan, true);
    this.lastFired = g.time; this.gunKick = 1;
  }

  throwGrenade() {
    const g = this.g, P = g.player;
    const from = this.eye(_v).clone(); from.y += 0.2;
    const tx = P.pos.x + rnd(-2, 2), tz = P.pos.z + rnd(-2, 2);
    const dx = tx - from.x, dz = tz - from.z, dist = Math.sqrt(dx * dx + dz * dz);
    const T = Math.min(2.0, Math.max(0.9, dist / 12));
    const grav = 18;
    const vel = new THREE.Vector3(dx / T, (0 - from.y + 0.5 * grav * T * T) / T, dz / T);
    g.spawnGrenade(from, vel, 'enemy', this);
  }

  fire() {
    const g = this.g, T = this.T, tgt = this.target, P = g.player;
    const mz = this.muzzle(new THREE.Vector3());
    const aim = tgt.getAimPoint(new THREE.Vector3());
    if (tgt === P && Math.random() < 0.25) aim.y += 0.4;
    const dist = mz.distanceTo(aim);
    let p = T.acc * (this.team === 'enemy' ? g.diff.acc : 1) * Math.min(1, Math.max(0.12, 1.25 - dist / T.range));
    if (tgt === P) {
      if (P.sprinting) p *= 0.55; else if (P.moving) p *= 0.75;
      if (P.crouch) p *= 0.8;
      if (P.prone) p *= 0.5;   // yotgan o'yinchi — kichik nishon
      p *= Math.min(1, 0.45 + this.visT * 0.35);
    }
    const hit = Math.random() < p;
    if (!hit) {
      const off = 0.5 + Math.random() * 1.2;
      const a = Math.random() * Math.PI * 2;
      aim.x += Math.cos(a) * off; aim.y += Math.sin(a) * off * 0.7; aim.z += Math.sin(a) * off;
    }
    const dir = aim.sub(mz).normalize();
    const wh = g.world.rayCast(mz, dir, 250, null, tgt.vehBox);
    const th = tgt.hitTest(mz, dir, 250);
    let end;
    if (th && (!wh || th.dist < wh.dist)) {
      end = mz.clone().addScaledVector(dir, th.dist);
      const dmg = T.dmg * (this.team === 'enemy' ? g.diff.dmg : 1) * (th.head ? 1.6 : 1);
      if (tgt === P) g.damagePlayer(dmg, this.pos, this);
      else { tgt.damage(this.team === 'ally' ? dmg : dmg * 0.45, this.pos, th.head, this, 'bullet'); g.fx.blood(end, dir); }
    } else if (wh) {
      end = wh.point.clone();
      g.fx.impact(wh.point, wh.normal, wh.ground ? 'ground' : 'wall');
      if (!wh.ground && !(wh.box && wh.box.vehicle)) g.fx.decal(wh.point, wh.normal);
      if (tgt === P && end.distanceTo(P.pos) < 3) g.sound.impactNear();
    } else end = mz.clone().addScaledVector(dir, 150);
    if (tgt === P && !hit && Math.random() < 0.6) g.sound.whiz();
    g.world.breakGlass(mz, end);   // o'q yo'lidagi deraza oynalari sinadi
    if (Math.random() < 0.55) g.fx.tracer(mz, end, this.team === 'enemy' ? (g.era === 'modern' ? 0xff8a5a : 0xffd890) : 0xc8ffb0);
    g.fx.muzzle(mz, this.type === 'heavy' ? 1.2 : 0.9);
    const pd = g.relToPlayer(this.pos);
    g.sound.shot(this.sound, pd.dist, pd.pan, true);
    this.lastFired = g.time;
    this.gunKick = 1;
    if (this.team === 'enemy' && g.noise) g.noise(this.pos, 'shot');   // o'q uzilgan joy xaritada belgilanadi
  }

  damage(amount, from, head, attacker, kind) {
    if (!this.alive) return;
    this.hp -= amount;
    this.hitFlash = 0.08;
    // o'q tekkanda seskanadi: tanasi silkinadi, nishoni buziladi (bir lahza ota olmaydi)
    this.flinch = Math.min(1, 0.4 + amount / 80);
    this.flinchDir = from ? (((from.x - this.pos.x) * Math.sin(this.yaw) + (from.z - this.pos.z) * Math.cos(this.yaw)) > 0 ? -1 : 1) : -1;
    this.cool = Math.max(this.cool, 0.2 + Math.min(0.5, amount / 160));
    // halokatli zarba: burilishga ulgurmaydi — orqadan otilgan askar yuztuban, olddan otilgani chalqancha yiqiladi
    if (this.hp <= 0) { this.die(attacker, head, kind, from); return; }
    if (!this.visible && from) { this.yaw = Math.atan2(from.x - this.pos.x, from.z - this.pos.z); this.losTimer = 0; }
  }

  die(attacker, head, kind, from) {
    this.alive = false; this.deadT = 0;
    for (const m of this.mats) m.emissive.setHex(0);
    if (this.glint) this.glint.visible = false;
    if (this.marker) this.marker.visible = false;
    const fwd = from ? Math.sign((this.pos.x - from.x) * Math.sin(this.yaw) + (this.pos.z - from.z) * Math.cos(this.yaw)) || 1 : 1;
    this.fallDir = fwd;
    this.fallSpin = (Math.random() - 0.5) * 0.8;
    this.g.onSoldierKilled(this, attacker, { head, kind });
  }

  updateDead(dt) {
    this.deadT += dt;
    const t = Math.min(1, this.deadT / 0.7);
    const e = t * t;
    animateDeath(this, dt, t);
    this.root.position.y = this.pos.y + Math.sin(t * Math.PI) * 0.1 + e * 0.06;   // yotgan tana yerdan biroz yuqorida (yerga botib ketmasligi uchun)
    if (this.deadT > 9) this.root.position.y -= (this.deadT - 9) * 0.4;
    if (this.deadT > 11) this.dispose();
  }

  dispose() {
    if (this.remove) return;
    this.remove = true;
    this.g.scene.remove(this.root);
    // tana geometriyasi boshqa askarlar bilan umumiy (kesh) — faqat o'ziga tegishlisi tozalanadi
    this.root.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    for (const m of this.mats) m.dispose();
  }
}

// Parashyut gumbazi (oyoq ostidan hisoblaganda tepada)
export function buildChute(era) {
  const cm = new THREE.MeshStandardMaterial({ color: era === 'historical' ? 0xd8d2bc : 0x6a7a52, roughness: 0.9, side: THREE.DoubleSide });
  const ch = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.2), cm);
  dome.position.y = 4.2; dome.scale.y = 0.7; ch.add(dome);
  const lm = new THREE.MeshBasicMaterial({ color: 0x222222 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const ln = new THREE.Mesh(new THREE.BoxGeometry(0.02, 3.3, 0.02), lm);
    ln.position.set(Math.cos(a) * 1.1, 3.2, Math.sin(a) * 1.1); ln.rotation.set(Math.sin(a) * 0.62, 0, -Math.cos(a) * 0.62); ch.add(ln);
  }
  ch.visible = false;
  return ch;
}

// ---------- Tarmoqdagi raqib o'yinchi ----------
export class RemotePlayer extends Soldier {
  constructor(game, id, name) {
    super(game, 'remote', 'rifle', new THREE.Vector3(0, -50, 0), name);
    this.id = id; this.netPos = new THREE.Vector3(0, -50, 0); this.netYaw = 0; this.hasPos = false;
    this.root.visible = false;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture(this.name, '#ff6b5b'), depthTest: true, transparent: true, fog: false }));
    sp.scale.set(1.6, 0.4, 1); sp.position.set(0, 2.3, 0);
    this.root.add(sp); this.marker = sp;
    this.mats.push(sp.material);
    const ch = buildChute(game.era);
    this.root.add(ch); this.chuteG = ch;
    this.hidden = false;
  }
  hitTest(o, d, maxD) { return this.hidden ? null : super.hitTest(o, d, maxD); }
  // Ko'rinishni almashtirish (zombi rejimi: odam ↔ zombi). color — ism belgisining rangi.
  setLook(team, type, color = '#ff6b5b') {
    const old = this.root, vis = old.visible;
    this.g.scene.remove(old);
    for (const m of this.mats) m.dispose();
    const root = makeSoldierModel(this, this.g.era, team, type);
    root.position.copy(this.pos); root.rotation.y = this.yaw; root.visible = vis;
    this.g.scene.add(root); this.root = root;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture(this.name, color), depthTest: true, transparent: true, fog: false }));
    sp.scale.set(1.6, 0.4, 1); sp.position.set(0, 2.3, 0);
    root.add(sp); this.marker = sp; this.mats.push(sp.material);
    root.add(this.chuteG);
    sp.visible = this.alive;
  }
  setState(st, veh) {
    // Transportda: yopiq transportda to'g'ridan-to'g'ri o'q tegmaydi (faqat oyna zonasi orqali),
    // lekin kabina oynasi/eshik oldidagi odam tashqaridan ko'rinadi.
    this.veh = veh && veh.alive ? veh : null; this.vseat = this.veh ? st.se : -1;
    this.hidden = !!(this.veh && this.veh.T.enclosed);
    this.shown = !this.hidden || this.veh.seatShown(this.vseat);
    this.chuteG.visible = !!st.ch;
    if (st.x === null || st.x === undefined) return;
    this.netPos.set(st.x, st.y, st.z);
    this.netYaw = st.yw + Math.PI; this.netPitch = st.pt || 0;
    this.crouch = st.cr === 1 || st.cr === true; this.prone = st.cr === 2;
    if (!this.hasPos || this.pos.distanceTo(this.netPos) > 6) { this.pos.copy(this.netPos); this.yaw = this.netYaw; }
    this.hasPos = true;
    this.root.visible = this.shown;
    if (!st.al && this.alive) {
      this.alive = false; this.deadT = 0; this.fallDir = Math.random() < 0.5 ? -1 : 1; this.fallSpin = (Math.random() - 0.5) * 0.8;
      this.marker.visible = false;
    } else if (st.al && !this.alive) {
      this.alive = true; this.root.rotation.x = 0; this.root.rotation.z = 0; this.marker.visible = true;
      this.pos.copy(this.netPos); this.yaw = this.netYaw;
    }
  }
  damage(amount, from, head, attacker, kind) {
    if (!this.alive) return;
    this.hitFlash = 0.08;
    if (attacker === 'player') this.g.net.send({ t: 'hit', target: this.id, dmg: Math.round(amount), head: !!head, kind: kind || 'bullet', wn: this.g.weaponName ? this.g.weaponName(kind) : undefined });
  }
  // Ism belgisi: sherikniki doim ko'rinadi; raqibniki — faqat yaqindan nishonga olinganda (aks holda pana joyda turgan o'yinchini
  // boshi ustidagi yozuv oshkor qilib qo'yardi)
  updateTag() {
    const g = this.g, mk = this.marker;
    let show = this.alive && this.shown !== false;
    const friend = !(g.hostile && g.hostile(this));
    // sherik: belgi devor ortidan ham ko'rinadi va uzoqda kichrayib ketmaydi (masofaga qarab kattalashadi)
    if (mk.material.depthTest === friend) { mk.material.depthTest = !friend; mk.material.needsUpdate = true; mk.renderOrder = friend ? 999 : 0; }
    { const c = g.camPos, d = Math.hypot(this.pos.x - c.x, this.pos.y - c.y, this.pos.z - c.z), k = friend ? Math.max(1, d / 11) : 1; mk.scale.set(1.6 * k, 0.4 * k, 1); mk.position.y += 0.2 * (k - 1); }
    if (show && !friend) {
      const cam = g.camPos, P = g.player, h = this.eye(_v);
      const dx = h.x - cam.x, dy = h.y - cam.y, dz = h.z - cam.z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const cp = Math.cos(P.pitch), dot = (-Math.sin(P.yaw) * cp * dx + Math.sin(P.pitch) * dy - Math.cos(P.yaw) * cp * dz) / dist;
      show = dist < 30 && dot > 0.994 && g.world.los(cam, h, P.vehBox);
    }
    mk.visible = show;
  }
  update(dt) {
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      const e = this.hitFlash > 0 ? 0x661111 : 0x000000;
      for (const m of this.mats) if (m.emissive) m.emissive.setHex(e);
    }
    if (!this.alive) {
      this.deadT += dt;
      const t = Math.min(1, this.deadT / 0.7), e = t * t;
      animateDeath(this, dt, t);
      this.root.position.copy(this.pos); this.root.position.y += e * 0.06;
      return;
    }
    const px = this.pos.x, pz = this.pos.z;
    const seated = !!(this.veh && this.veh.alive && this.vseat >= 0);
    if (seated) {   // o'rindiqqa mahkam bog'langan (tarmoq kechikishisiz)
      this.veh.seatPos(this.vseat, this.pos); this.netPos.copy(this.pos);
      if (this.veh.T.roles[this.vseat] !== 'gunner') this.netYaw = this.veh.yaw;
      this.vel.set(0, 0, 0);
    } else this.pos.lerp(this.netPos, Math.min(1, dt * 14));
    if (dt > 0 && !seated) {
      const k = Math.min(1, dt * 10);
      this.vel.x += ((this.pos.x - px) / dt - this.vel.x) * k;
      this.vel.z += ((this.pos.z - pz) / dt - this.vel.z) * k;
    }
    let dy = this.netYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 15);
    this.crouchAmt += ((this.crouch ? 1 : 0) - this.crouchAmt) * Math.min(1, dt * 8);
    this.proneAmt += ((this.prone && !seated ? 1 : 0) - this.proneAmt) * Math.min(1, dt * 7);
    const sp = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
    if (!seated) { this.footstep(dt, sp); if (sp > 0.5) this.g.world.touchGlass(this.pos.x, this.pos.y + 1.45, this.pos.z); }   // derazadan oshgan o'yinchi oynani sindiradi
    // raqib o'yinchi: yugurmayotgan bo'lsa qurol yelkada va u qaragan balandlikka qaratilgan
    this.sit = seated && this.crouch;
    animateSoldier(this, dt, sp, sp < 6.5 || this.g.time - this.lastFired < 1.5, this.netPitch || 0);
    // yotgan holatda model oyoq tomonga suriladi: boshi o'yinchining haqiqiy joyida (kamerasi turgan nuqtada) bo'ladi
    const pr = this.proneAmt;
    { const k = this.s * pr; this.root.position.set(this.pos.x - Math.sin(this.yaw) * 1.5 * k, this.pos.y + 0.2 * k, this.pos.z - Math.cos(this.yaw) * 1.5 * k); }   // (nishon hajmlari ham shu o'lchamda: hitTestProne)
    this.root.rotation.y = this.yaw;
    this.marker.position.set(0, 2.3 - this.crouchAmt * 0.45 * (1 - pr) - 0.8 * pr, -0.7 * pr);
    this.updateTag();
  }
}
