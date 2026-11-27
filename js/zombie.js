import * as THREE from '../lib/three.module.js';
import { CHAR_K, WILD, wildParts } from './shared.mjs';
import { Soldier } from './soldier.js';
import { animateSoldier } from './soldiermodel.js';

// ================= ZOMBI REJIMI =================
// Zombilar oson o'ladi (to'pponchadan 2 o'q yoki boshga 1 o'q), lekin ko'p. Ular butun xaritada tentirab yuradi va odamni
// KO'RSA (yaqin masofada, oradagi ko'rinish ochiq bo'lsa) yoki ESHITSA (o'q ovozi, portlash, transport, yugurish) quvadi.
// Cho'kkalab yoki yotib, otmasdan chetlab o'tsa bo'ladi. Himoya bosqichlarida esa to'da bo'lib, to'g'ridan-to'g'ri hujum qiladi.
// (joni va tezligi kuchaytirilgan: o'yinchi yugurganda 8 m/s — chopqir zombidan zo'rg'a qochib qutuladi)
export const ZKINDS = {
  walker: { hp: 120, speed: 3.8, dmg: 13, scale: 1.0, name: 'Zombi' },
  runner: { hp: 90, speed: 7.0, dmg: 10, scale: 0.95, name: 'Chopqir zombi' },
  brute:  { hp: 340, speed: 3.1, dmg: 26, scale: 1.1, name: 'Bahaybat zombi' },
  screamer: { hp: 80, speed: 4.6, dmg: 8, scale: 0.98, name: 'Chinqiroq zombi' },   // odamni ko'rsa chinqiradi — atrofdagi hamma zombi yugurib keladi
};
// Sakrash: oldidagi to'siq yoki tepadagi odam (mashina, tom, quti) REACH m gacha baland bo'lsa — sakrab chiqadi
export const ZJUMP = { g: 20, reach: 3.2 };
export const VIS_R = 36;          // (eski qiymat) zombi ko'rinadigan masofa endi tuman uzoqligiga bog'liq
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const rnd = (a, b) => a + Math.random() * (b - a);

export class Zombie extends Soldier {
  // local = true — shu kompyuter boshqaradi (yakka o'yin yoki xost); false — tarmoqdan kelgan holat bo'yicha ko'rsatiladi
  constructor(game, pos, kind = 'walker', zid = 0, local = true) {
    super(game, 'enemy', 'zombie', pos, ZKINDS[kind] ? ZKINDS[kind].name : 'Zombi');
    const K = (this.K = ZKINDS[kind] || ZKINDS.walker);
    this.kind = kind; this.zid = zid; this.local = local; this.isZombie = true;
    this.maxHp = this.hp = K.hp;
    this.s = K.scale * CHAR_K; this.root.scale.multiplyScalar(K.scale); this.drawS = this.s;
    if (kind === 'screamer') for (const m of this.mats) if (m.color) m.color.setRGB(1.5, 1.42, 1.1);   // chinqiroq — rangpar: uzoqdan tanib olinadi (birinchi bo'lib uni otish kerak)
    this.tgt = null; this.tgtT = rnd(0, 0.5); this.atk = 0; this.atkT = 0; this.atkCd = rnd(0, 0.6); this.hitDone = false;
    // sezgi: aware — odamni payqagan (quvadi); rage — to'da zombisi (har doim quvadi); heard — shovqin eshitilgan joy (borib tekshiradi)
    this.aware = false; this.rage = false; this.loseT = 0; this.heard = null; this.heardT = 0; this.home = this.pos.clone(); this.idleT = rnd(0, 6); this.screamed = false;
    this.groanT = rnd(1, 7); this.wander = rnd(0, 6.28); this.vy = 0; this.jumpCd = rnd(0, 1); this.jt = null;
    this.netPos = this.pos.clone(); this.netYaw = this.yaw; this.netAtk = 0;
    this.sound = 'none';
  }
  eye(out) { return out.set(this.pos.x, this.pos.y + 1.55 * this.s, this.pos.z); }
  // Odamni payqadi: quvishni boshlaydi. Chinqiroq zombi bir marta baqirib, atrofdagilarni chaqiradi.
  wake() {
    if (this.aware) return;
    this.aware = true; this.loseT = 0; this.heardT = 0;
    if (this.kind === 'screamer' && !this.screamed && this.local) { this.screamed = true; this.g.zScream(this); }
  }

  // Tarmoq: xost bo'lmagan mijozda zarba xostga yuboriladi (jon hisobi xostda)
  damage(amount, from, head, attacker, kind) {
    if (!this.alive) return;
    if (!this.local) {
      this.hitFlash = 0.08;
      if (attacker === 'player') this.g.net.send({ t: 'zhit', z: this.zid, dmg: Math.round(amount), head: !!head, kind: kind || 'bullet' });
      return;
    }
    // o'q zarbi zombini orqaga itaradi (drobovik — kuchliroq)
    this.aware = true; this.loseT = 0;   // o'q tekkan zombi uyg'onadi
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
    this.root.visible = dc < (W.env ? W.env.far : VIS_R) + 6 || (W.flashF || 0) > 0.02;
    this.groanT -= dt;
    if (this.groanT <= 0) { this.groanT = rnd(4, 11); if (dc < 46 && g.zGroan()) { const pd = g.relToPlayer(this.pos); g.sound.zombie(pd.dist, pd.pan, this.kind === 'brute'); } }
  }

  // Mahalliy boshqaruv: eng yaqin odamni quvadi va yetganda uradi. Qaytaradi: yurish tezligi (animatsiya uchun).
  think(dt) {
    const g = this.g, W = g.world, K = this.K;
    this.tgtT -= dt;
    if (this.tgtT <= 0 || (this.tgt && !this.tgt.alive)) {
      this.tgtT = rnd(0.3, 0.55);
      const hot = this.aware || this.rage;
      let best = null, bd = 1e9, seen = null, sd = 1e9;
      for (const h of g.zTargets()) {
        if (!h.alive) continue;
        const d = Math.hypot(h.pos.x - this.pos.x, h.pos.z - this.pos.z) + Math.abs(h.pos.y - this.pos.y) * 2;
        if (d < bd) { bd = d; best = h; }
        // ko'rish: masofa odamning holatiga bog'liq (yotgan/cho'kkalagan — yaqindan, fonar yoqilgan yoki transportda — uzoqdan)
        if (!hot && d < sd && d < g.zSight(h) && (d < 6 || W.los(this.eye(_v), _v2.set(h.pos.x, h.pos.y + 1.1, h.pos.z), h.veh ? h.veh.box : undefined))) { sd = d; seen = h; }
      }
      if (!hot) {
        if (seen) this.wake();
        else { const n = g.zHeard(this.pos); if (n) { if (n.near) this.wake(); else { this.heard = this.heard || new THREE.Vector3(); this.heard.set(n.x, 0, n.z); this.heardT = 7; } } }
      } else if (!this.rage) {
        if (!best || bd > 80) { this.loseT += 0.45; if (this.loseT > 7) { this.aware = false; this.home.copy(this.pos); } } else this.loseT = 0;   // izini yo'qotdi — yana tentiraydi
      }
      this.tgt = this.aware || this.rage ? best : null;
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
      this.jt = { dy: veh ? 0 : dy, cd };
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
      // nishon yo'q: eshitilgan shovqin tomonga boradi; aks holda o'z joyi atrofida sekin tentiraydi (ba'zan to'xtab turadi)
      this.atk = 0;
      if (this.heardT > 0 && this.heard) {
        this.heardT -= dt;
        const hx = this.heard.x - this.pos.x, hz = this.heard.z - this.pos.z, hl = Math.hypot(hx, hz);
        if (hl < 2.5) this.heardT = 0; else if (this.detourT > 0) { this.detourT -= dt; mx = this.detour.x; mz = this.detour.z; } else { mx = hx / hl; mz = hz / hl; }
        speed *= 0.8; this.wantYaw = Math.atan2(mx, mz);
      } else {
        this.idleT -= dt;
        if (this.idleT < -5) this.idleT = rnd(2, 7);
        const hx = this.home.x - this.pos.x, hz = this.home.z - this.pos.z, hl = Math.hypot(hx, hz);
        if (hl > 14) this.wander = Math.atan2(hx, hz); else this.wander += rnd(-1, 1) * dt;
        if (this.idleT < 0) { mx = Math.sin(this.wander); mz = Math.cos(this.wander); speed *= 0.3; }
        this.wantYaw = this.wander;
      }
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
    W.collideCircle(this.pos, 0.36 * this.s, this.pos.y, this.pos.y + 1.7 * this.s);
    {
      // baland sakrash: oldidagi to'siq (3 m gacha) yoki tepada turgan odam sari; chopqir zombi yaqinlashganda sakrab hamla qiladi
      this.jumpCd -= dt;
      const gh0 = W.groundHeight(this.pos.x, this.pos.z, 0.3, this.pos.y), onG = this.vy <= 0 && this.pos.y <= gh0 + 0.05;
      if (onG && this.jumpCd <= 0 && t && this.jt && (mx || mz) && !inReach) {
        let up = 0;
        const ah = W.groundHeight(this.pos.x + mx * 0.9, this.pos.z + mz * 0.9, 0.3, this.pos.y + ZJUMP.reach) - this.pos.y;
        if (ah > 0.5 && ah < ZJUMP.reach) up = ah;
        else if (this.jt.dy > 0.8 && this.jt.dy < ZJUMP.reach && this.jt.cd < 4.5) up = this.jt.dy;
        else if (this.kind === 'runner' && this.jt.cd > 3 && this.jt.cd < 7 && Math.abs(this.jt.dy) < 0.6 && Math.random() < dt * 0.8) up = 0.9;
        if (up > 0) { this.vy = Math.sqrt(2 * ZJUMP.g * (up + 0.45)); this.jumpCd = 1.1 + Math.random() * 0.6; this.vel.x *= 1.25; this.vel.z *= 1.25; }
      }
      if (this.vy > 0 || this.pos.y > gh0 + 0.05) {   // havoda
        // shiftga urilish: uy ichida yuqori qavatga ship orqali sakrab chiqib ketmasin
        if (this.vy > 0) { const top = this.pos.y + 1.75 * this.s; if (top + this.vy * dt > W.ceilingHeight(this.pos.x, this.pos.z, 0.36 * this.s, top)) this.vy = 0; }
        const y0 = this.pos.y; this.vy -= ZJUMP.g * dt; this.pos.y += this.vy * dt;
        const gh = W.groundHeight(this.pos.x, this.pos.z, 0.3, Math.max(y0, this.pos.y));
        if (this.pos.y <= gh) { this.pos.y = gh; this.vy = 0; }
      } else { this.pos.y = gh0; this.vy = 0; }
    }
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

// ---------- Rejim boshqaruvi: vazifalar zanjiri, zombilar "rejissyori", qorong'ilashish, chaqmoq, yashiklar ----------
// Vazifalar (js/shared.mjs: WILD.stages): qishloqqa yetish → uch joydan ratsiya qismlarini topish → radio minorani ushlab turish →
// harbiy bazaga yetish → vertolyot maydonini ushlab turish. Yakka o'yinda bosqichlarni shu yer hisoblaydi, tarmoqda — server.
// api: zmode.js dagi funksiyalar ({ G, player, sound, net, humans, onStage, onPart, respawn, endZombie ... })
const DARK = [0, 0.3, 0.55, 0.8, 1, 1];   // bosqich bo'yicha qorong'ilik (0 — shom, 1 — tun)
export class ZombieGame {
  constructor(api) {
    this.a = api; const G = (this.G = api.G);
    this.stages = WILD.stages; this.stage = 0;   // joriy bosqich raqami (stages.length — vazifa bajarildi)
    this.spots = wildParts(G.lootSeed | 0); this.got = WILD.parts.map(() => false);   // ratsiya qismlari: shu jangdagi joylari va topilgan-topilmagani
    this.hold = 0; this.holdMax = 0; this.holdK = 1;   // ushlab turish sanog'i (holdK — vaqt ko'paytuvchisi: tarmoqda server beradi)
    this.lives = 2; this.cp = new THREE.Vector3(WILD.start.x, 0, WILD.start.z);   // yakka o'yin: qo'shimcha imkoniyatlar va oxirgi nazorat nuqtasi
    this.dark = 0; this.noises = []; this.dirT = 0.5; this.hordeN = 0; this.flashT = rnd(25, 40); this.zid = 1; this.groanGate = 0; this.over = false;
    this.auth = !G.mp;        // bosqichlarni kim hisoblaydi: yakka o'yinda — o'zimiz, tarmoqda — server
    this.host = !G.mp;        // zombilarni kim boshqaradi: yakka o'yinda — o'zimiz, tarmoqda — xost
    this.syncT = 0; this.remote = new Map();
    this.buildMarkers();
    this.enter();
  }
  get cur() { return this.stages[Math.min(this.stage, this.stages.length - 1)]; }
  get done() { return this.stage >= this.stages.length; }
  // Joriy nishon (kompas, xarita va masofa uchun): nuqtali bosqichda — o'sha nuqta; qism qidirishda — eng yaqin topilmagan qism joyi
  get target() {
    if (this.evac) return this.a.evacTarget;   // evakuatsiya: vertolyot rampasi
    const c = this.cur;
    if (c.k !== 'parts') return c;
    const P = this.a.player; let best = null, bd = 1e9;
    WILD.parts.forEach((p, i) => { if (this.got[i]) return; const q = WILD.poi.find((o) => o.id === p.poi), d = Math.hypot(q.x - P.pos.x, q.z - P.pos.z); if (d < bd) { bd = d; best = { x: q.x, z: q.z, r: q.r, id: 'P', name: p.at, part: i }; } });
    return best || c;
  }
  zombies() { return this.G.soldiers.filter((s) => s.isZombie && s.alive); }
  humans() { return this.a.humans(); }
  // Oqim maydoni uchun nishonlar (podvaldagi odam o'rniga — zinapoya boshi)
  flowTargets() {
    const W = this.G.world, out = [];
    for (const h of this.humans()) { if (!h.alive) continue; const pi = W.pitAt(h.pos); out.push(pi >= 0 ? W.pits[pi].stairTop : h.pos); }
    return out;
  }

  // ---------- Belgilar: nishon ustuni va halqasi, qidiruv hududlari, qismlarning o'zi ----------
  buildMarkers() {
    const S = this.G.scene, mk = (hex, r) => {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 90, 14, 1, true), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 64), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      ring.rotation.x = -Math.PI / 2; beam.visible = ring.visible = false; beam.userData.dyn = ring.userData.dyn = true; S.add(beam); S.add(ring);
      return { beam, ring, r };
    };
    this.mk = mk(0xffcc55, 16);
    this.pmk = WILD.parts.map(() => mk(0x7fd3ff, 30));
    this.partM = WILD.parts.map((p, i) => {
      const g = new THREE.Group(), sp = this.spots[i];
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.26), new THREE.MeshStandardMaterial({ color: [0x2c3a2c, 0xa3281c, 0x39424a][i], roughness: 0.5, metalness: 0.4, emissive: 0x16303a, emissiveIntensity: 0.7 }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.G.glintTex, color: 0x7fd3ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8, fog: false }));
      glow.scale.set(1.6, 1.6, 1); g.add(body); g.add(glow); g.position.set(sp[0], sp[2] + 0.45, sp[1]); g.visible = false; g.userData.dyn = true; S.add(g);
      return g;
    });
  }
  placeMarkers() {
    const c = this.cur, parts = !this.done && c.k === 'parts', m = this.mk;
    m.beam.visible = m.ring.visible = !this.done && !parts;
    if (!parts && !this.done) { const col = c.k === 'hold' ? 0x7dff9a : 0xffcc55; m.beam.material.color.setHex(col); m.ring.material.color.setHex(col); m.beam.position.set(c.x, 45, c.z); m.ring.position.set(c.x, 0.06, c.z); m.ring.scale.set(c.r, c.r, 1); }
    WILD.parts.forEach((p, i) => {
      const on = parts && !this.got[i], q = WILD.poi.find((o) => o.id === p.poi), k = this.pmk[i];
      k.beam.visible = k.ring.visible = on; this.partM[i].visible = on;
      if (on) { k.beam.position.set(q.x, 45, q.z); k.ring.position.set(q.x, 0.06, q.z); k.ring.scale.set(q.r, q.r, 1); }
    });
  }
  // Bosqichga kirish: sanoq, belgilar
  enter() {
    const c = this.cur;
    if (!this.done && c.k === 'hold') this.hold = this.holdMax = c.t * this.holdK;
    this.hordeN = 0;
    this.placeMarkers();
  }
  // Bosqich o'zgardi (yakka o'yinda mahalliy, tarmoqda server xabari bilan). announce — e'lon va mukofot ko'rsatilsinmi.
  setStage(st, announce) {
    const prev = this.stage;
    if (st <= prev) return;
    for (let i = prev; i < st && i < this.stages.length; i++) { const s = this.stages[i]; if (s.x !== undefined) this.cp.set(s.x, 0, s.z); else this.cp.copy(this.a.player.pos); if (announce) this.a.onStage(i, st); }
    this.stage = st;
    this.enter();
    if (this.done && !this.G.mp) this.a.evacStart();   // vazifa bajarildi: vertolyot uchib keladi (tarmoqda — server 'zevac' xabari bilan)
  }
  finish(victory) { if (this.over) return; this.over = true; this.a.endZombie(victory); }

  // ---------- Ratsiya qismlari ----------
  nearPart() {
    if (this.done || this.cur.k !== 'parts') return -1;
    const P = this.a.player;
    for (let i = 0; i < this.spots.length; i++) { const s = this.spots[i]; if (!this.got[i] && Math.hypot(s[0] - P.pos.x, s[1] - P.pos.z) < 2.4 && Math.abs(s[2] - P.pos.y) < 1.8) return i; }
    return -1;
  }
  // [E]: yonidagi qismni olish (tarmoqda — server tasdiqlaydi)
  tryPart() {
    const i = this.nearPart();
    if (i < 0) return false;
    if (this.G.mp) this.a.net.send({ t: 'zpart', i }); else { this.onPart(i, 0); if (this.got.every(Boolean)) this.setStage(this.stage + 1, true); }
    return true;
  }
  // Qism topildi (by — kim; 0 — o'zimiz). Shovqin ko'taradi: yaqin atrofdagi zombilar yopirilib keladi.
  onPart(i, by) {
    if (this.got[i]) return;
    this.got[i] = true;
    const s = this.spots[i];
    this.a.onPart(i, by, this.got.filter(Boolean).length);
    if (this.host) { this.noise(s[0], s[1], 60, null, true); for (let k = 0; k < 5; k++) this.spawnRing(s[0], s[1], 34, 52, true); }
    this.placeMarkers();
  }

  // ---------- Shovqin ----------
  // (x, z) da r metrgacha eshitiladigan tovush. src — tovush chiqargan odam (bo'lsa); wake — eshitgan zombi darhol quvadi.
  noise(x, z, r, src, wake) {
    if (!this.host) return;
    const n = this.noises;
    if (n.length > 24) n.shift();
    n.push({ x, z, r, src: src || null, t: 0.9, wake: !!wake });
  }
  // Zombi shu joyda nima eshitdi? Qaytaradi: { x, z, near } (near — juda yaqin/aniq: darhol quvadi) yoki null
  heard(pos) {
    let best = null, bk = 1;
    for (const n of this.noises) { const k = Math.hypot(n.x - pos.x, n.z - pos.z) / n.r; if (k < bk) { bk = k; best = n; } }
    return best ? { x: best.x, z: best.z, near: best.wake || bk < 0.5 } : null;
  }

  // ---------- Zombilarni paydo qilish ----------
  spawn(kind, x, z, zid) {
    const G = this.G, zb = new Zombie(G, new THREE.Vector3(x, 0, z), kind, zid || this.zid++, this.host);
    zb.yaw = Math.random() * 6.28;
    G.soldiers.push(zb);
    return zb;
  }
  pickKind() {
    const r = Math.random(), s = Math.min(4, this.stage), pb = [0, 0.03, 0.07, 0.08, 0.12][s], ps = s >= 1 ? 0.07 : 0, pr = [0.08, 0.18, 0.28, 0.34, 0.42][s] + this.dark * 0.08;
    return r < pb ? 'brute' : r < pb + ps ? 'screamer' : r < pb + ps + pr ? 'runner' : 'walker';
  }
  // Nuqta zombi paydo bo'lishiga yaroqlimi: xarita ichida, to'siq ichida emas, odamlardan uzoqda va ularning ko'z o'ngida emas
  okSpot(x, z, hs, minD, strict) {
    const W = this.G.world;
    if (Math.abs(x) > W.half - 4 || Math.abs(z) > W.half - 4 || W.pitIndexXZ(x, z) >= 0 || W.pointInBox(_v.set(x, 1, z)) || W.pointInBox(_v.set(x, 0.3, z))) return false;
    const far = (W.env ? W.env.far : 36) * 0.85;
    for (const h of hs) {
      const d = Math.hypot(h.pos.x - x, h.pos.z - z);
      if (d < minD) return false;
      if (strict && d < far && W.los(_v.set(h.pos.x, h.pos.y + 1.7, h.pos.z), _v2.set(x, 1.3, z), h.veh ? h.veh.box : undefined)) return false;   // ko'z o'ngida "yo'qdan paydo bo'lmaydi"
    }
    return true;
  }
  // (cx, cz) atrofidagi halqada (d0..d1 m) bitta zombi; rage — to'da zombisi (darhol hujum qiladi)
  spawnRing(cx, cz, d0, d1, rage) {
    const hs = this.humans().filter((h) => h.alive);
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, d = rnd(d0, d1), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!this.okSpot(x, z, hs, 30, i < 10)) continue;
      const zb = this.spawn(this.pickKind(), x, z); zb.rage = !!rage; zb.home.set(x, 0, z);
      return zb;
    }
    return null;
  }
  // Tentirab yuruvchi zombi: odam turgan joy (qishloq, shaharcha ...) hududida yoki ochiq dalada undan 55–90 m narida
  spawnAmbient(h, poi) {
    const hs = this.humans().filter((o) => o.alive);
    for (let i = 0; i < 14; i++) {
      let x, z;
      if (poi && i < 9) { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * poi.r; x = poi.x + Math.cos(a) * d; z = poi.z + Math.sin(a) * d; }
      else { const a = Math.random() * Math.PI * 2, d = rnd(55, 90); x = h.pos.x + Math.cos(a) * d; z = h.pos.z + Math.sin(a) * d; }
      if (!this.okSpot(x, z, hs, 38, i < 11)) continue;
      const zb = this.spawn(this.pickKind(), x, z); zb.home.set(x, 0, z);
      return zb;
    }
    return null;
  }
  // Eski nom (sinovlar va boshlang'ich to'ldirish uchun): o'yinchi atrofida bitta zombi
  spawnOne() { const h = this.humans().find((o) => o.alive); return h ? !!this.spawnAmbient(h, WILD.poi.find((p) => Math.hypot(p.x - h.pos.x, p.z - h.pos.z) < p.r + 30)) : false; }

  // ---------- "Rejissyor": har yarim soniyada zombilar sonini va shovqinni boshqaradi (faqat xostda) ----------
  direct() {
    const G = this.G, hs = this.humans().filter((h) => h.alive);
    if (!hs.length) return;
    const zs = this.zombies(), cap = Math.min(58, 34 + (hs.length - 1) * 6), c = this.cur;
    // odamlarning harakat shovqini: transport uzoqdan, yugurish yaqindan eshitiladi; cho'kkalab/yotib yurish — sassiz
    for (const h of hs) {
      const px = h._zx === undefined ? h.pos.x : h._zx, pz = h._zz === undefined ? h.pos.z : h._zz, sp = Math.hypot(h.pos.x - px, h.pos.z - pz) / 0.5;
      h._zx = h.pos.x; h._zz = h.pos.z;
      if (h.veh) { if (sp > 1) this.noise(h.pos.x, h.pos.z, 46, h); } else if (sp > 5.2) this.noise(h.pos.x, h.pos.z, 13, h); else if (sp > 2.2 && !h.low) this.noise(h.pos.x, h.pos.z, 6, h);
    }
    // odamlardan juda uzoqlashib qolganlari olib tashlanadi (o'rniga yaqinroqda yangisi chiqadi)
    for (const s of zs) if (hs.every((h) => Math.hypot(h.pos.x - s.pos.x, h.pos.z - s.pos.z) > 125)) { s.alive = false; s.dispose(); }
    let n = this.zombies().length;
    // himoya bosqichi (va evakuatsiya — vertolyot maydoni): nuqta atrofida kimdir bo'lsa — to'da-to'da hujum (tun quyuqlashgani sari tezroq)
    if ((this.evac || !this.done) && c.k === 'hold' && hs.some((h) => Math.hypot(h.pos.x - c.x, h.pos.z - c.z) < c.r * 3)) {
      const want = Math.min(cap, 16 + this.stage * 3 + (hs.length - 1) * 5), k = this.stage >= 4 ? 3 : 2;
      for (let i = 0; i < k && n < want; i++) if (this.spawnRing(c.x, c.z, 44, 70, true)) n++;
      return;
    }
    // tentirab yuruvchilar: har bir odam turgan joyga qarab (aholi punktida ko'p, dalada kam; tunda ko'proq)
    for (const h of hs) {
      const poi = WILD.poi.find((p) => Math.hypot(p.x - h.pos.x, p.z - h.pos.z) < p.r + 30);
      const want = Math.round((poi ? poi.n : 4) * (1 + this.dark * 0.6) * (0.8 + 0.2 * hs.length));
      let have = 0; for (const s of zs) if (s.alive && Math.hypot(h.pos.x - s.pos.x, h.pos.z - s.pos.z) < 95) have++;
      if (have < want && n < cap && this.spawnAmbient(h, poi)) n++;
    }
  }

  update(dt) {
    const G = this.G, W = G.world;
    if (this.over) return;
    this.groanGate -= dt;
    for (let i = this.noises.length - 1; i >= 0; i--) if ((this.noises[i].t -= dt) <= 0) this.noises.splice(i, 1);
    // qorong'ilashish: har bir bosqichda tun bir pog'ona quyuqlashadi (asta-sekin)
    const dk = DARK[Math.min(this.stage, DARK.length - 1)];
    if (this.darkHold !== undefined) this.dark = this.darkHold;   // (evakuatsiya kinosi: tong otadi)
    else if (this.dark < dk) this.dark = Math.min(dk, this.dark + dt * 0.012);
    if (W.setDark) W.setDark(this.dark, !!G.isZ);
    // chaqmoq (tarmoqda server yuboradi — hammada bir vaqtda); faqat tun kirgach
    if (!G.mp && this.dark > 0.45) { this.flashT -= dt; if (this.flashT <= 0) { this.flashT = rnd(15, 30); this.lightning(rnd(0.75, 1)); } }
    // bosqichlar (yakka o'yin)
    if (this.auth && !this.done) {
      const hs = this.humans().filter((h) => h.alive), c = this.cur;
      const near = (r) => hs.some((h) => Math.hypot(h.pos.x - c.x, h.pos.z - c.z) < r && h.pos.y < 6);
      if (c.k === 'reach') { if (near(c.r)) { this.setStage(this.stage + 1, true); return; } }
      else if (c.k === 'hold') { if (near(c.r * 1.4)) this.hold -= dt; if (this.hold <= 0) { this.setStage(this.stage + 1, true); return; } }
      else if (this.got.every(Boolean)) { this.setStage(this.stage + 1, true); return; }
    }
    if (this.host) { this.dirT -= dt; if (this.dirT <= 0) { this.dirT = 0.5; this.direct(); } }
    // belgilar: ustun miltillaydi, qismlar aylanadi
    const t = G.time;
    this.mk.beam.material.opacity = 0.16 + Math.sin(t * 2.2) * 0.05;
    for (const g of this.partM) if (g.visible) { g.rotation.y = t * 1.6; g.position.y += Math.sin(t * 3) * 0.0015; }
  }
  lightning(k) {
    if (this.dark < 0.3) return;   // shom paytida chaqmoq yo'q
    this.G.world.flash(k);
    this.a.sound.thunder(rnd(0.25, 1.6), k);
  }
  // Yakka o'yin: halok bo'lgach oxirgi nazorat nuqtasidan davom etish. Qaytaradi: davom etildimi (imkoniyat qolmagan bo'lsa — yo'q).
  // Yakka o'yin: halok bo'lganda — defibrillyator bo'lsa, shu joyda tiriladi (imkoniyat sarflanmaydi); bo'lmasa oxirgi ochilgan
  // tiriltirish punkti (chodir) oldidan davom etadi. Qaytaradi: davom etildimi (imkoniyat qolmagan bo'lsa — yo'q).
  revive() {
    if (this.G.mp || this.over) return false;
    if (this.G.defib > 0) { this.G.defib = 0; this.a.respawn(this.cp, this.lives, 'defib'); return true; }
    if (this.lives <= 0) return false;
    this.lives--;
    const R = this.a.tent();
    if (R) this.a.tentFront(R, this.cp);
    for (const s of this.zombies()) if (Math.hypot(s.pos.x - this.cp.x, s.pos.z - this.cp.z) < 60) { s.alive = false; s.dispose(); }
    this.a.respawn(this.cp, this.lives, R ? R.name : '');
    return true;
  }
  // Ekrandagi vazifa matni (d — nishongacha masofa, m)
  objective(d) {
    const c = this.cur;
    if (this.evac) return this.a.evacObjective(d);
    if (this.done) return '';
    if (c.k === 'reach') return `${c.name} — ${d} m · ${c.text}`;
    if (c.k === 'hold') return d > c.r * 1.4 ? `${c.name}ga qayting — sanoq to'xtab turibdi (${d} m)` : `${c.name}: ushlab turing — ${Math.max(0, Math.ceil(this.hold))} s`;
    const P = this.a.player;
    return 'Ratsiya qismlari: ' + WILD.parts.map((p, i) => { if (this.got[i]) return `${p.name} ✓`; const q = WILD.poi.find((o) => o.id === p.poi); return `${p.name} — ${p.at} (${Math.round(Math.hypot(q.x - P.pos.x, q.z - P.pos.z))} m)`; }).join(' · ');
  }

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
