import * as THREE from '../lib/three.module.js';
import { Soldier } from './soldier.js';
import { animateSoldier } from './soldiermodel.js';

// ================= ZOMBI REJIMI =================
// Zombilar oson o'ladi (to'pponchadan 2 o'q yoki boshga 1 o'q), lekin ko'p va qorong'idan chiqib keladi.
export const ZKINDS = {
  walker: { hp: 60, speed: 2.6, dmg: 13, scale: 1.0, name: 'Zombi' },
  runner: { hp: 45, speed: 5.1, dmg: 10, scale: 0.95, name: 'Chopqir zombi' },
  brute:  { hp: 170, speed: 2.1, dmg: 26, scale: 1.17, name: 'Bahaybat zombi' },
};
export const VIS_R = 36;          // qorong'ida shu masofadan narida zombi ko'rinmaydi (faqat chaqmoq chaqqanda)
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const rnd = (a, b) => a + Math.random() * (b - a);

export class Zombie extends Soldier {
  // local = true — shu kompyuter boshqaradi (yakka o'yin yoki xost); false — tarmoqdan kelgan holat bo'yicha ko'rsatiladi
  constructor(game, pos, kind = 'walker', zid = 0, local = true) {
    super(game, 'enemy', 'zombie', pos, ZKINDS[kind] ? ZKINDS[kind].name : 'Zombi');
    const K = (this.K = ZKINDS[kind] || ZKINDS.walker);
    this.kind = kind; this.zid = zid; this.local = local; this.isZombie = true;
    this.maxHp = this.hp = K.hp;
    this.s = K.scale; this.root.scale.multiplyScalar(K.scale);
    this.tgt = null; this.tgtT = 0; this.atk = 0; this.atkT = 0; this.atkCd = rnd(0, 0.6); this.hitDone = false;
    this.groanT = rnd(1, 7); this.wander = rnd(0, 6.28);
    this.netPos = this.pos.clone(); this.netYaw = this.yaw; this.netAtk = 0;
    this.sound = 'none';
  }
  eye(out) { return out.set(this.pos.x, this.pos.y + 1.55 * this.s, this.pos.z); }

  // Tarmoq: xost bo'lmagan mijozda zarba xostga yuboriladi (jon hisobi xostda)
  damage(amount, from, head, attacker, kind) {
    if (!this.alive) return;
    if (!this.local) {
      this.hitFlash = 0.08;
      if (attacker === 'player') this.g.net.send({ t: 'zhit', z: this.zid, dmg: Math.round(amount), head: !!head, kind: kind || 'bullet' });
      return;
    }
    // o'q zarbi zombini orqaga itaradi (drobovik — kuchliroq)
    if (from) { const dx = this.pos.x - from.x, dz = this.pos.z - from.z, L = Math.hypot(dx, dz) || 1, k = Math.min(1.5, amount / 45) * 2.2; this.vel.x += (dx / L) * k; this.vel.z += (dz / L) * k; }
    super.damage(amount, from, head, attacker, kind);
  }
  setNet(st) { this.netPos.set(st[1], st[2], st[3]); this.netYaw = st[4]; this.netAtk = st[5] ? 1 : 0; }

  update(dt) {
    const g = this.g, W = g.world;
    if (!this.alive) { this.updateDead(dt); return; }
    if (this.hitFlash > 0) { this.hitFlash -= dt; const e = this.hitFlash > 0 ? 0x661111 : 0x000000; for (const m of this.mats) m.emissive.setHex(e); }
    let sp = 0;
    if (!this.local) {
      const ox = this.pos.x, oz = this.pos.z;
      this.pos.lerp(this.netPos, Math.min(1, dt * 10));
      sp = dt > 0 ? Math.hypot(this.pos.x - ox, this.pos.z - oz) / dt : 0;
      let dy = this.netYaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * Math.min(1, dt * 10);
      this.atk += ((this.netAtk ? 0.5 : 0) - this.atk) * Math.min(1, dt * 8);
    } else sp = this.think(dt);
    animateSoldier(this, dt, sp);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    // qorong'ilik: uzoqdagi zombi ko'rinmaydi, chaqmoq chaqqanda hammasi bir lahzaga ko'rinadi
    const cam = g.camPos, dc = Math.hypot(this.pos.x - cam.x, this.pos.z - cam.z);
    this.root.visible = dc < VIS_R + 4 || (W.flashF || 0) > 0.02;
    this.groanT -= dt;
    if (this.groanT <= 0) { this.groanT = rnd(4, 11); if (dc < 46 && g.zGroan()) { const pd = g.relToPlayer(this.pos); g.sound.zombie(pd.dist, pd.pan, this.kind === 'brute'); } }
  }

  // Mahalliy boshqaruv: eng yaqin odamni quvadi va yetganda uradi. Qaytaradi: yurish tezligi (animatsiya uchun).
  think(dt) {
    const g = this.g, W = g.world, K = this.K;
    this.tgtT -= dt;
    if (this.tgtT <= 0 || !this.tgt || !this.tgt.alive) {
      this.tgtT = rnd(0.3, 0.55);
      let best = null, bd = 1e9;
      for (const h of g.zTargets()) { if (!h.alive) continue; const d = Math.hypot(h.pos.x - this.pos.x, h.pos.z - this.pos.z) + Math.abs(h.pos.y - this.pos.y) * 2; if (d < bd) { bd = d; best = h; } }
      this.tgt = best;
    }
    const t = this.tgt;
    let mx = 0, mz = 0, speed = K.speed, inReach = false;
    if (t) {
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z, dist = Math.hypot(dx, dz) || 0.001, dy = t.pos.y - this.pos.y;
      const veh = t.veh && t.veh.alive ? t.veh : null;
      // transportdagi odam: transportning o'zini uradi; aks holda — odamni
      const cx = veh ? veh.pos.x - this.pos.x : dx, cz = veh ? veh.pos.z - this.pos.z : dz, cd = Math.hypot(cx, cz) || 0.001;
      const reach = veh && veh.T.enclosed ? veh.T.r + 1.5 : veh ? Math.max(1.5, veh.T.r + 0.9) : 1.5;
      inReach = cd < reach && Math.abs(veh ? veh.pos.y - this.pos.y : dy) < 1.9;
      const tPit = W.pitAt(t.pos), lvl = W.levelOf(this.pos);
      let wp = null;
      if (this.descend >= 0) {
        const p = W.pits[this.descend]; this.descT -= dt;
        if (this.pos.y <= p.floor + 0.3 || this.descT <= 0 || tPit !== this.descend) this.descend = -1; else wp = p.stairBot;
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
      if (inReach) { /* joyida turib uradi */ }
      else if (wp) { const wx = wp.x - this.pos.x, wz = wp.z - this.pos.z, L = Math.hypot(wx, wz); if (L > 0.05) { mx = wx / L; mz = wz / L; } }
      else if (this.detourT > 0) { this.detourT -= dt; mx = this.detour.x; mz = this.detour.z; }
      else if (sameBase || (cd < 9 && lvl < 0 && tPit < 0 && Math.abs(dy) < 1.2 && W.los(this.eye(_v), _v2.set(t.pos.x, t.pos.y + 1.2, t.pos.z), t.veh ? t.veh.box : undefined))) { mx = cx / cd; mz = cz / cd; }
      else if (W.flowDir(this.pos.x, this.pos.z, _v)) { mx = _v.x; mz = _v.z; }
      else { mx = cx / cd; mz = cz / cd; }
      if (cd > 14 && K === ZKINDS.walker) speed *= 0.85;
      // zarba: avval qo'l ko'tariladi, so'ng (hali yetib tursa) zarar yetkazadi
      this.atkCd -= dt;
      if (inReach && this.atkT <= 0 && this.atkCd <= 0) { this.atkT = 0.6; this.hitDone = false; }
      if (this.atkT > 0) {
        this.atkT -= dt; this.atk = Math.min(1, 1 - this.atkT / 0.6);
        if (!this.hitDone && this.atk > 0.45) {
          this.hitDone = true;
          const nd = veh ? Math.hypot(veh.pos.x - this.pos.x, veh.pos.z - this.pos.z) : Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
          if (nd < reach + 0.6) g.zAttack(this, t, K.dmg);
        }
        if (this.atkT <= 0) { this.atk = 0; this.atkCd = rnd(0.45, 0.9); }
      }
      this.wantYaw = Math.atan2(inReach ? cx : mx || cx, inReach ? cz : mz || cz);
    } else {
      // nishon yo'q: sekin tentirab yuradi
      this.wander += rnd(-1, 1) * dt; mx = Math.sin(this.wander); mz = Math.cos(this.wander); speed *= 0.35;
      this.wantYaw = this.wander; this.atk = 0;
    }
    const k = Math.min(1, dt * 6);
    this.vel.x += (mx * speed - this.vel.x) * k;
    this.vel.z += (mz * speed - this.vel.z) * k;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    // bir-biridan ajralish
    for (const o of g.soldiers) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.5 && d2 > 1e-6 && Math.abs(this.pos.y - o.pos.y) < 1.5) { const d = Math.sqrt(d2), p = ((0.7 - d) * 0.5) / d; this.pos.x += dx * p; this.pos.z += dz * p; }
    }
    W.collideCircle(this.pos, 0.36 * this.s, this.pos.y, this.pos.y + 1.7);
    { const gh = W.groundHeight(this.pos.x, this.pos.z, 0.3, this.pos.y); this.pos.y = gh >= this.pos.y ? gh : Math.max(gh, this.pos.y - 9 * dt); }
    // tiqilib qolsa — tasodifiy tomonga aylanib o'tadi
    this.stuckT += dt;
    if (this.stuckT > 1.2) {
      if ((mx || mz) && !inReach && this.pos.distanceTo(this.lastPos) < 0.45) { const a = Math.random() * Math.PI * 2; this.detour.set(Math.cos(a), 0, Math.sin(a)); this.detourT = 0.9; }
      this.lastPos.copy(this.pos); this.stuckT = 0;
    }
    let dyaw = this.wantYaw - this.yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.yaw += dyaw * Math.min(1, dt * 6);
    return Math.hypot(this.vel.x, this.vel.z);
  }
}

// ---------- Rejim boshqaruvi: punktlar, zombilar oqimi, chaqmoq, yashiklar ----------
// api: main.js dagi funksiyalar ({ G, player, popup, banner, sound, net, giveCrateWeapon, refillVehicles, endZombie })
export class ZombieGame {
  constructor(api) {
    this.a = api; this.G = api.G;
    this.stage = 0;                // 0: B ga, 1: C ga, 2: D ga, 3: D ni ushlab turish, 4: tugadi
    this.pts = this.G.world.points;
    this.hold = 45; this.holdMax = 45;
    this.spawnT = 2.5; this.flashT = rnd(7, 12); this.zid = 1; this.groanGate = 0; this.over = false;
    this.auth = !this.G.mp;        // bosqichlarni kim hisoblaydi: yakka o'yinda — o'zimiz, tarmoqda — server
    this.host = !this.G.mp;        // zombilarni kim boshqaradi: yakka o'yinda — o'zimiz, tarmoqda — xost
    this.syncT = 0; this.remote = new Map();
  }
  get target() { return this.pts[Math.min(3, this.stage + 1)]; }
  zombies() { return this.G.soldiers.filter((s) => s.isZombie && s.alive); }

  // Zombilar ko'radigan odamlar: yakka o'yinda — o'yinchi; tarmoqda — barcha tirik odam-o'yinchilar
  humans() { return this.a.humans(); }
  // Oqim maydoni uchun nishonlar (podvaldagi odam o'rniga — zinapoya boshi)
  flowTargets() {
    const W = this.G.world, out = [];
    for (const h of this.humans()) { if (!h.alive) continue; const pi = W.pitAt(h.pos); out.push(pi >= 0 ? W.pits[pi].stairTop : h.pos); }
    return out;
  }

  spawn(kind, x, z, zid) {
    const G = this.G, p = new THREE.Vector3(x, 0, z);
    const zb = new Zombie(G, p, kind, zid || this.zid++, this.host);
    zb.yaw = Math.random() * 6.28;
    G.soldiers.push(zb);
    return zb;
  }
  pickKind() {
    const r = Math.random(), s = this.stage;
    if (s >= 2 && r < (s >= 3 ? 0.12 : 0.07)) return 'brute';
    if (s >= 1 && r < [0, 0.2, 0.32, 0.42][Math.min(3, s)]) return 'runner';
    return 'walker';
  }
  // Odamlardan 37–53 m narida (qorong'ida, ko'rinmaydigan joyda) yangi zombi paydo bo'ladi
  spawnOne() {
    const W = this.G.world, hs = this.humans().filter((h) => h.alive);
    if (!hs.length) return false;
    const h = hs[(Math.random() * hs.length) | 0];
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, d = rnd(37, 53), x = h.pos.x + Math.cos(a) * d, z = h.pos.z + Math.sin(a) * d;
      if (Math.abs(x) > W.half - 3 || Math.abs(z) > W.half - 3 || W.pitIndexXZ(x, z) >= 0 || !W.reachable(x, z)) continue;
      if (hs.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < 34)) continue;
      this.spawn(this.pickKind(), x, z);
      return true;
    }
    return false;
  }

  update(dt) {
    const G = this.G, a = this.a, W = G.world;
    if (this.over) return;
    this.groanGate -= dt;
    // chaqmoq (tarmoqda server yuboradi — hammada bir vaqtda)
    if (!G.mp) { this.flashT -= dt; if (this.flashT <= 0) { this.flashT = rnd(15, 30); this.lightning(rnd(0.75, 1)); } }
    // bosqichlar
    if (this.auth) {
      const hs = this.humans().filter((h) => h.alive), tp = this.target;
      const near = (r) => hs.some((h) => Math.hypot(h.pos.x - tp.x, h.pos.z - tp.z) < r && h.pos.y < 6);
      if (this.stage < 3) { if (near(tp.r)) this.setStage(this.stage + 1, true); }
      else if (this.stage === 3) {
        if (near(tp.r * 1.6)) this.hold -= dt;
        if (this.hold <= 0) { this.setStage(4, true); return; }
      }
      if (!hs.length) { this.finish(false); return; }
    }
    // zombilar oqimi
    if (this.host) {
      const hs = this.humans().filter((h) => h.alive), n = this.zombies().length;
      const st = Math.min(3, this.stage), max = Math.min(36, [9, 13, 17, 24][st] + (hs.length - 1) * 4);
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnT = [1.7, 1.35, 1.05, 0.7][st] / Math.max(1, hs.length * 0.6); if (n < max) this.spawnOne(); }
      // odamlardan juda uzoqlashib qolganlari olib tashlanadi (o'rniga yaqinroqda yangisi chiqadi)
      for (const s of G.soldiers) {
        if (!s.isZombie || !s.alive) continue;
        if (hs.length && hs.every((h) => Math.hypot(h.pos.x - s.pos.x, h.pos.z - s.pos.z) > 88)) { s.alive = false; s.dispose(); }
      }
    }
  }
  lightning(k) {
    this.G.world.flash(k);
    this.a.sound.thunder(rnd(0.25, 1.6), k);
  }
  // Bosqich o'zgardi (yakka o'yinda mahalliy, tarmoqda server xabari bilan)
  setStage(st, announce) {
    const prev = this.stage, a = this.a;
    this.stage = st;
    if (st === 4) { this.finish(true); return; }
    if (st <= prev) return;
    const reached = this.pts[st];   // hozirgina yetib kelingan punkt
    if (announce) a.onPoint(reached.id, st);
  }
  finish(victory) { if (this.over) return; this.over = true; this.a.endZombie(victory); }

  // ---------- Qurol yashiklari (har bir o'yinchi har yashikni bir marta ochadi) ----------
  nearCrate() {
    const P = this.a.player;
    for (const c of this.G.world.crates) if (!c.open && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 2.3 && Math.abs(P.pos.y) < 1.2) return c;
    return null;
  }
  tryCrate() {
    const c = this.nearCrate();
    if (!c) return false;
    c.open = true;
    this.a.giveCrateWeapon(c.kind);
    return true;
  }
}
