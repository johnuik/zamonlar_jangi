// O'yinchining qurollari: to'plam, almashtirish, qayta o'qlash, otish (hitscan), pichoq, granata uloqtirish.
import * as THREE from '../lib/three.module.js';
import { $, G, W_FOV_TAN, _dir, _f, _mz, _o, _r, _u, _wh, camBasis, camera, clamp, disposeTree, lerp, mouse, player, sound, wScene } from './core.js';
import { buildSlots, hitmarker, popup, setText } from './hud.js';
import { animGun, animKnife, animNade, ejectShell, updateShells } from './viewmodel.js';
import { PROJ, spawnGrenade, spawnProjectile, vehHostile } from './ordnance.js';
import { shieldBlocks } from './game.js';
import { armorMul, damageVehicle, dropSpecial, occupantAt, ownGunActive, seatGuns, updateVehicleSeat } from './transport.js';
import { hostile, net, v3arr } from './mp.js';
import { CLASSES, EMPTY, KNIFE, MOUNT_DEF, NADE, SIDEARMS, VEH_MUL, WEAPONS, buildGrenadeHand, buildKnife, buildShell, buildViewmodel, loadout, specialWeapons } from './weapons.js';
import { GG_LADDER } from './shared.mjs';
import { loadoutFor } from './progress.js';
import { damageRemoteTurret, deployTurret, hitRemoteTurret } from './turret.js';
import { hitRemoteDrone, killRemoteDrone, launchDrone } from './drone.js';
import { evacFreeze } from './evac.js';

// ---------- Qurollar ----------
export const vmRoot = new THREE.Group(); wScene.add(vmRoot);
G.knifeVM = null; G.nadeVM = null;
G.cls = clamp(+(localStorage.getItem('zj_class') || 0) | 0, 0, CLASSES.length - 1);
export const isGun = (w) => !w.def.kind;
export function makeWeapon(def, era) {
  if (def.kind === 'none') return { def, locked: true, vm: { group: new THREE.Group() } };   // bo'sh o'rin
  if (def.kind === 'melee') return { def, vm: buildKnife(era) };
  if (def.kind === 'throw') return { def, vm: buildGrenadeHand(era) };
  const vm = buildViewmodel(def, era);
  if (vm.shell) { vm.loader = buildShell(era, true); vm.gun.add(vm.loader); }   // drobovik: qo'lda solinadigan patron
  return { def, mag: def.mag, reserve: def.reserve, vm };
}
export function setupWeapons(era) {
  while (vmRoot.children.length) { const c = vmRoot.children[0]; vmRoot.remove(c); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  // Klass to'plami: 1 — asosiy qurol, 2 — to'pponcha, 3 — pichoq, 4 — granata (5 — podvaldan topilgan noyob qurol)
  // Zombi rejimi: faqat to'pponcha (o'qi tugamaydi) va pichoq; asosiy qurol uylardan va yashiklardan topiladi
  // Jang maydoni: hamma qurolsiz boshlaydi (faqat pichoq) — qurol uylardan topiladi. Gun game: darajaga mos bitta qurol.
  const br = G.mp && G.mpMode === 'br', gg = G.mp && G.mpMode === 'gg';
  const defs = G.zombie ? [EMPTY, WEAPONS[era].pistol, KNIFE, NADE] : br ? [EMPTY, EMPTY, KNIFE, NADE] : gg ? ggDefs(era, G.ggLv | 0) : loadout(era, G.cls, loadoutFor(G.cls));
  G.weapons = defs.map((def) => { const w = makeWeapon(def, era); w.vm.group.visible = false; vmRoot.add(w.vm.group); return w; });
  if (G.zombie) G.weapons[1].inf = true;
  if (gg) for (const w of G.weapons) if (isGun(w) && !w.locked) w.inf = true;
  G.knifeVM = G.weapons[2].vm; G.nadeVM = G.weapons[3].vm;
  G.mountVM = buildViewmodel(MOUNT_DEF, era); G.mountVM.group.visible = false; vmRoot.add(G.mountVM.group);
  G.specials = specialWeapons(era);
  // uchib chiqadigan gilzalar
  G.shells = [];
  for (let i = 0; i < 12; i++) { const m = buildShell(era, i >= 8); vmRoot.add(m); G.shells.push({ m, shot: i >= 8, t: 0, v: new THREE.Vector3(), r: new THREE.Vector3() }); }
  G.wi = mainSlot(); G.weapons[G.wi].vm.group.visible = true;
  G.fireT = 0; G.reloadT = 0; G.switchT = 0.5; G.ads = 0; G.bloom = 0; G.kick = 0; G.kickPitch = 0; G.recoilAcc = 0; G.lastShot = -9;
  G.triggerHeld = false; G.knifeT = 0; G.knifeDur = 0.55; G.knifeKind = 'stab'; G.throwT = 0; G.thrown = false; G.flashT = 0; G.swayX = 0; G.swayY = 0; G.sprintAmt = 0;
  G.breath = 4; G.landDip = 0; G.cookT = -1; G.cookLob = false; G.boltT = 0; G.relPose = 0; G.tilt = 0; G.cycleT = 0; G.cycleEject = false; G.kickRoll = 0;
}
export const cur = () => G.weapons[G.wi];
// Pichoq/granata harakatini bekor qilish (qurol almashganda, transportga o'tirganda). Tez uloqtirish boshlangan,
// lekin granata hali qo'ldan chiqmagan bo'lsa — u hisobdan chiqarilgan edi, qaytarib beriladi.
export function cancelThrow() {
  if (G.throwT > 0 && !G.thrown) G.grenades_n++;
  G.knifeT = 0; G.throwT = 0; G.thrown = false; G.cookT = -1;
}
// O'rindagi (0 — asosiy, 1 — to'pponcha) qurolni boshqasiga almashtirish va darhol qo'lga olish (xonadan topilgan qurol)
export function setSlotWeapon(slot, def) {
  const old = G.weapons[slot];
  if (!old.locked && old.def.id === def.id) { old.mag = old.def.mag; old.reserve = old.def.reserve; }   // shu qurolning o'zi — o'q-dori to'ldiriladi
  else {
    old.vm.group.visible = false; vmRoot.remove(old.vm.group); disposeTree(old.vm.group);
    const w = makeWeapon(def, G.era); w.vm.group.visible = false; vmRoot.add(w.vm.group);
    G.weapons[slot] = w;
  }
  cancelThrow();
  cur().vm.group.visible = false;
  G.wi = slot; G.reloadT = 0; G.switchT = 0.45; G.ads = 0;
  cur().vm.group.visible = true;
  buildSlots();
}
// asosiy qurol o'rni (bo'sh bo'lsa — to'pponcha)
export function mainSlot() { return !G.weapons[0].locked ? 0 : !G.weapons[1].locked ? 1 : 2; }
// Gun game: daraja quroli (asosiy qurol — 1-o'rinda, to'pponcha — 2-o'rinda, oxirgi daraja — faqat pichoq)
export function ggDefs(era, lv) {
  const id = GG_LADDER[Math.max(0, Math.min(GG_LADDER.length - 1, lv))], W = WEAPONS[era];
  if (id === 'knife' || !W[id]) return [EMPTY, EMPTY, KNIFE, NADE];
  return SIDEARMS.includes(id) ? [EMPTY, W[id], KNIFE, NADE] : [W[id], EMPTY, KNIFE, NADE];
}
// Shu o'rindagi qurolni yangi ko'rsatkichlar bilan qayta yig'ish (topilgan qo'shimcha o'rnatilganda): o'q-dori va qo'ldagi qurol o'zgarmaydi
export function refit(slot, def) {
  const old = G.weapons[slot];
  if (!old || old.locked || !isGun(old)) return;
  const w = makeWeapon(def, G.era);
  w.mag = Math.min(old.mag, def.mag); w.reserve = old.reserve; w.inf = old.inf;
  old.vm.group.visible = false; vmRoot.remove(old.vm.group); disposeTree(old.vm.group);
  w.vm.group.visible = G.wi === slot; vmRoot.add(w.vm.group);
  G.weapons[slot] = w;
  buildSlots();
}

// ---------- Qurol harakatlari ----------
// Raqam tugmasi: rad etilsa, sababi ekranda ko'rsatiladi
export function selectSlot(i) {
  if (i >= G.weapons.length) { if (i === 4) popup("Noyob qurol yo'q — podvallardan toping", true); return; }
  if (G.weapons[i].locked) { popup(G.mp && G.mpMode === 'gg' ? 'Bu darajada faqat berilgan qurol' : "Qurol yo'q — uylardan yoki yashiklardan toping", true); return; }
  if (G.weapons[i].def.kind === 'throw' && G.grenades_n <= 0) { popup('Granata qolmadi', true); return; }
  switchWeapon(i);
}
export function switchWeapon(i) {
  if (i === G.wi || i < 0 || i >= G.weapons.length || G.weapons[i].locked || G.knifeT > 0 || G.throwT > 0 || G.cookT >= 0) return;
  cur().vm.group.visible = false;
  G.wi = i; G.reloadT = 0; G.switchT = 0.45; G.fireT = Math.max(G.fireT, 0.1); G.ads = 0;
  cur().vm.group.visible = true;
  sound.reload('out');
  buildSlots();
}
export function startReload() {
  const W = cur();
  if (!isGun(W) || G.reloadT > 0 || G.switchT > 0 || W.mag >= W.def.mag || W.reserve <= 0 || G.knifeT > 0 || G.throwT > 0) return;
  // drobovik patronlarni bittalab oladi: birinchi patron oldidan qurolni burish uchun biroz vaqt
  G.reloadT = G.reloadDur = W.def.reload + (W.def.shells ? 0.3 : 0); G.reloadIn = false;
  sound.reload('out');
}
export function finishReload() {
  const W = cur(), d = W.def;
  if (d.shells) {
    W.mag++; W.reserve--;
    if (W.mag < d.mag && W.reserve > 0 && !mouse.L) { G.reloadT = G.reloadDur = d.reload; G.reloadIn = false; }
    else { G.cycleT = 60 / d.rpm * 0.6; G.cycleEject = true; sound.reload('out'); }   // oxirida pompni tortish
    return;
  }
  const take = Math.min(d.mag - W.mag, W.reserve);
  W.mag += take; if (!W.inf) W.reserve -= take;   // zombi rejimida to'pponcha o'qi tugamaydi
}
// [G] — granatani darhol uloqtirish (qurolni almashtirmasdan). Granata qo'lda bo'lsa — shu zahoti otiladi.
export function throwGrenade() {
  if (G.grenades_n <= 0) { popup('Granata qolmadi', true); return; }
  if (G.throwT > 0 || G.knifeT > 0) return;
  if (cur().def.kind === 'throw') {
    if (G.switchT > 0.15) return;
    if (G.cookT < 0) { G.cookT = 0; G.cookLob = false; sound.pin(); }
    releaseNade();
    return;
  }
  G.throwT = 0.75; G.thrown = false; G.reloadT = 0; G.grenades_n--;
  sound.pin();
}
// Qo'ldagi granata: halqa sug'urilgandan beri o'tgan vaqt (cookT) portlash vaqtidan ayiriladi
export function releaseNade(inHand) {
  const P = player;
  camBasis();
  const from = camera.position.clone().addScaledVector(_f, 0.5).addScaledVector(_r, 0.15).addScaledVector(_u, -0.1);
  const vel = inHand ? new THREE.Vector3(0, 0, 0)
    : (G.cookLob ? _f.clone().multiplyScalar(8.5).addScaledVector(_u, 4.2) : _f.clone().multiplyScalar(17).addScaledVector(_u, 3)).add(new THREE.Vector3(P.vel.x * 0.5, 0, P.vel.z * 0.5));
  const fuse = inHand ? 0.02 : Math.max(0.12, NADE.fuse - G.cookT);
  spawnGrenade(from, vel, 'player', 'player', fuse);
  if (G.mp) net.send({ t: 'nade', p: v3arr(from), v: v3arr(vel), f: +fuse.toFixed(2) });
  G.grenades_n--; G.cookT = -1; G.throwT = 0.4; G.thrown = true;
  if (inHand) popup("GRANATA QO'LDA PORTLADI!", true);
}
// kind: 'stab' — sanchish (bir zarbada), 'slash' — tez kesish
// Qo'l jangi quroli: odatda pichoq; zombi-o'yinchida — panjalar (kuchsizroq, lekin tezroq yuguradi)
export function meleeDef() { const d = G.weapons[2].def; return d.kind === 'melee' ? d : KNIFE; }
export function knifeAttack(kind = 'stab') {
  if (G.knifeT > 0 || G.throwT > 0 || G.cookT >= 0) return;
  const M = meleeDef();
  G.knifeKind = kind; G.knifeDur = kind === 'slash' ? M.slashT : M.stabT;
  G.knifeT = G.knifeDur; G.knifeHit = false; G.reloadT = 0;
  sound.knife();
}
export function knifeStrike() {
  const P = player;
  camBasis();
  const M = meleeDef();
  let best = null, bd = M.reach;
  for (const s of G.soldiers) {
    if (!s.alive || !hostile(s) || s.hidden || Math.abs(s.pos.y - P.pos.y) > 2) continue;
    const dx = s.pos.x - P.pos.x, dz = s.pos.z - P.pos.z, dd = Math.hypot(dx, dz);
    if (dd < bd && (dx * _f.x + dz * _f.z) / (dd || 1) > 0.5) { best = s; bd = dd; }
  }
  if (!best) return;
  best.damage(G.knifeKind === 'slash' ? M.slash : M.stab || 999, P.pos, false, 'player', M.id === 'claw' ? 'claw' : 'knife');
  sound.stab(); hitmarker(!best.alive && !G.mp);
  G.fx.blood(best.getAimPoint(new THREE.Vector3()), _f, !best.alive);
}

export function muzzleWorld(out) {
  const vm = cur().vm;
  vm.group.updateMatrixWorld(true);
  vm.muzzle.getWorldPosition(out);
  const k = Math.tan((camera.fov * Math.PI) / 360) / W_FOV_TAN;
  out.x *= k; out.y *= k;
  return camera.localToWorld(out);
}
export function falloff(def, d) {
  const f = def.falloff;
  if (!f || d <= f[0]) return 1;
  if (d >= f[1]) return f[2];
  return 1 - ((d - f[0]) / (f[1] - f[0])) * (1 - f[2]);
}
export function currentSpread() {
  const d = cur().def, P = player;
  if (d.kind) return 0.02;
  let s = lerp(d.hip, d.spread, G.ads);
  const hs = Math.min(8, Math.hypot(P.vel.x, P.vel.z));   // transportda ketayotganda ham tarqalish cheksiz o'smaydi
  s += (hs / 5) * 0.025 * (1 - G.ads * 0.75);
  if (!P.onGround) s += 0.06;
  if (P.crouch) s *= 0.75;
  if (P.prone) s *= 0.5;   // yotib otish — eng aniq
  if (d.scope && G.ads < 0.95) s = Math.max(s, 0.06);
  return s + G.bloom;
}

export function tryFire() {
  const W = cur(), d = W.def, P = player;
  if (d.kind || G.fireT > 0 || G.switchT > 0 || G.knifeT > 0 || G.throwT > 0 || G.vault || G.healT > 0) return;
  if (G.reloadT > 0) {
    if (d.pump && W.mag > 0) G.reloadT = 0; else return;
  }
  if (W.mag <= 0) {
    sound.empty(); G.fireT = 0.25;
    if (W.reserve > 0) startReload();
    return;
  }
  if (d.deploy) {   // turel yerga o'rnatiladi; dron uchiriladi va boshqaruv unga o'tadi
    G.fireT = 0.6;
    if (d.deploy === 'drone') { if (launchDrone()) { W.mag--; G.triggerHeld = true; } }
    else if (deployTurret()) { W.mag--; G.kick = 1; popup("TUREL O'RNATILDI — 75 soniya qo'riqlaydi va raqiblarni xaritada belgilaydi"); }
    return;
  }
  W.mag--; G.fireT = 60 / d.rpm; G.shots++; G.lastShot = G.time;
  P.sprinting = false;
  camBasis();
  _o.copy(camera.position);
  const spread = currentSpread();
  const pellets = d.projectile ? 0 : d.pellets || 1;
  let anyHit = false, anyHead = false, anyKill = false, firstEnd = null;
  muzzleWorld(_mz);
  for (let i = 0; i < pellets; i++) {
    const r = spread * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
    _dir.copy(_f).addScaledVector(_r, Math.cos(a) * r).addScaledVector(_u, Math.sin(a) * r).normalize();
    const res = hitscan(_o, _dir, d, player.vehBox || undefined);
    G.world.breakGlass(_o, res.end);   // o'q yo'lidagi deraza oynalari sinadi
    if (i === 0) firstEnd = res.end;
    if (res.hit) { anyHit = true; if (res.head) anyHead = true; if (res.kill) anyKill = true; }
    if (i === 0 || Math.random() < 0.3) {
      if (Math.random() < (d.auto ? 0.45 : 0.8)) G.fx.tracer(_mz, res.end, 0xffe6a8, 380);
    }
  }
  if (d.projectile) {
    const r = spread * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
    _dir.copy(_f).addScaledVector(_r, Math.cos(a) * r).addScaledVector(_u, Math.sin(a) * r).normalize();
    const start = _o.clone().addScaledVector(_f, 0.7).addScaledVector(_r, 0.12).addScaledVector(_u, -0.08);
    const vel = _dir.clone().multiplyScalar(PROJ[d.projectile].speed);
    if (d.projectile === 'gl') vel.y += 3;
    // nishon: faqat qulflangan transport (bazuka). Raketa odamni quvmaydi — qulfsiz otilsa to'g'ri uchadi.
    const target = d.lockon && G.lock && G.lock.locked && G.lock.veh.alive ? { veh: G.lock.veh } : null;
    spawnProjectile(start, vel, d.projectile, 'player', player.vehBox, false, target);
    if (G.mp) net.send({ t: 'rocket', p: v3arr(start), v: v3arr(vel), k: d.projectile, tg: target ? { v: target.veh.id } : undefined });
    G.lock = null;
    if (d.projectile === 'rocket') for (let i = 0; i < 6; i++) G.fx.smokePuff(_o.clone().addScaledVector(_f, -0.8 - i * 0.3), 0.35);
  }
  if (anyHit) { G.hits++; hitmarker(anyKill && !G.mp); sound.hit(anyHead); }
  if (G.mp && firstEnd) { net.send({ t: 'shot', a: v3arr(_mz), b: v3arr(firstEnd), s: d.quiet ? 'supp' : d.sound }); G.protUntil = 0; }   // (o'q uzdi — tug'ilishdagi himoya tugadi)
  // tepki
  const rm = (G.ads > 0.5 ? 0.65 : 1) * (P.prone ? 0.55 : P.crouch ? 0.8 : 1);
  const kickV = d.recoil * rm * (0.85 + Math.random() * 0.3);
  P.pitch = clamp(P.pitch + kickV, -1.5, 1.5);
  G.recoilAcc += kickV;
  P.yaw += (Math.random() - 0.5) * 2 * d.recoilH * rm;
  G.kick = Math.min(1.4, G.kick + 1);
  G.kickPitch += kickV * 0.6;
  G.bloom = Math.min(d.bloomMax || 0.06, G.bloom + (d.bloom || 0));
  G.flashT = 0.045;
  if (!d.quiet) G.fx.flash(_mz, 0xffb050, 8, 0.06, 10);
  sound.shot(d.quiet ? 'supp' : d.sound, 0, 0, false);
  if (G.zg) G.zNoise(player.pos.x, player.pos.z, d.quiet ? 16 : d.sound === 'pistol' ? 44 : 68);   // zombilar o'q ovozini eshitadi (so'ndirgich bilan — faqat yaqindagilar)
  G.kickRoll = (Math.random() - 0.5) * 0.06;
  if (d.bolt || d.pump) { G.cycleT = 60 / d.rpm; G.cycleEject = true; }
  else {
    G.boltT = 0.085; ejectShell(W.vm);
    // gilza dunyoda ham uchib tushadi va yerda qoladi
    if (!d.projectile && !G.inVeh) { const cp = _o.clone().addScaledVector(_r, 0.22).addScaledVector(_f, 0.35).addScaledVector(_u, -0.12); G.fx.casing(cp, _r.clone().multiplyScalar(1.6 + Math.random()).addScaledVector(_u, 1.6 + Math.random()).addScaledVector(_f, (Math.random() - 0.5) * 0.8).add(P.vel), G.world.groundHeight(cp.x, cp.z, 0.1, P.pos.y + 0.3)); }
  }
}

// ---------- Bazukani transportga qulflash ----------
// Qurol qo'lda turganda ko'rib turgan transportingizga qarab tursangiz (nishon belgisi ustida, oradagi ko'rinish ochiq), u LOCK_T soniyada
// belgilanadi (qulflanadi) — shundan keyin otilgan raketa faqat o'sha transportni quvadi. Ko'rinmayotgan (to'siq ortidagi) transport belgilanmaydi;
// belgisiz otilgan raketa to'g'ri uchadi. Odamni hech qachon quvmaydi.
export const LOCK_T = 0.8;
const _lc = new THREE.Vector3(), _lp = new THREE.Vector3();
export function updateLock(dt) {
  const el = $('lockBox'), W = G.weapons && cur(), d = W && W.def;
  const can = d && d.lockon && player.alive && G.state === 'playing' && !G.droneCtl && W.mag > 0 && G.reloadT <= 0 && G.switchT <= 0 && (!G.inVeh || ownGunActive());
  let best = null;
  if (can) {
    camBasis();
    let bq = 1;   // (nishon belgisidan og'ish) / (ruxsat etilgan og'ish) — eng kichigi tanlanadi
    for (const v of G.vehicles) {
      if (!v.alive || v === G.inVeh || !vehHostile(v)) continue;
      v.center(_lc); _lp.copy(_lc).sub(camera.position);
      const dist = _lp.length();
      if (dist < 6 || dist > 280) continue;
      // transport ekranda nishon belgisi ostida (yoki unga juda yaqin) bo'lishi kerak: uning ko'rinma kattaligi + 2° (mo'ljalda + 3°)
      const q = Math.acos(Math.min(1, _lp.dot(_f) / dist)) / (Math.atan((Math.max(v.T.box[0], v.T.box[2]) * 0.5) / dist) + (G.ads > 0.6 ? 0.052 : 0.035));
      if (q >= bq) continue;
      // ko'rinib turishi shart: markazi yoki tepasi (to'siq ortidan qisman ko'ringan transport ham belgilanadi)
      // (o'z transportimiz ichidan qaralganda uning qutisi ko'rinishni to'smaydi)
      let see = G.world.los(camera.position, _lc, v.box, player.vehBox);
      if (!see) { _lp.copy(_lc); _lp.y += v.T.box[1] * 0.42; see = G.world.los(camera.position, _lp, v.box, player.vehBox); }
      if (see) { bq = q; best = v; }
    }
  }
  if (!best) { G.lock = null; if (el.style.display !== 'none') el.style.display = 'none'; return; }
  if (!G.lock || G.lock.veh !== best) G.lock = { veh: best, t: 0, locked: false, beep: 0 };
  const L = G.lock;
  L.t += dt; L.beep -= dt;
  if (!L.locked && L.t >= LOCK_T) { L.locked = true; sound.ping(); }
  else if (!L.locked && L.beep <= 0) { L.beep = 0.22; sound.click(); }
  // ekrandagi ramka nishon ustida turadi
  best.center(_lc).project(camera);
  el.style.display = 'block';
  el.style.left = ((_lc.x * 0.5 + 0.5) * innerWidth) + 'px'; el.style.top = ((-_lc.y * 0.5 + 0.5) * innerHeight) + 'px';
  const cls = L.locked ? 'on' : '';
  if (el.className !== cls) el.className = cls;
  setText('lockTxt', L.locked ? `${best.T.name.toUpperCase()} BELGILANDI — OTING` : `BELGILANMOQDA ${Math.round((L.t / LOCK_T) * 100)}%`);
}

export function hitscan(o, dir, d, ignore) {
  const wh = G.world.rayCast(o, dir, d.range, _wh, ignore);
  const lim = wh ? wh.dist : d.range;
  let best = null;
  for (const s of G.soldiers) {
    if (!s.alive || !hostile(s)) continue;
    const h = s.hitTest(o, dir, lim);
    if (h && (!best || h.dist < best.dist)) best = h;
  }
  // raqib droni: bitta o'q tegsa yo'q bo'ladi
  { const dh = hitRemoteDrone(o, dir, best ? best.dist : lim);
    if (dh) { const end = o.clone().addScaledVector(dir, dh.dist); G.fx.impact(end, dir.clone().multiplyScalar(-1), 'wall'); killRemoteDrone(dh.id); return { end, hit: true }; }
    // raqib tureli: otib yo'q qilsa bo'ladi
    const th = hitRemoteTurret(o, dir, best ? best.dist : lim);
    if (th) { const end = o.clone().addScaledVector(dir, th.dist); G.fx.impact(end, dir.clone().multiplyScalar(-1), 'wall'); damageRemoteTurret(th.t, d.dmg * (d.vehMul || VEH_MUL)); return { end, hit: true }; } }
  if (best) {
    const end = o.clone().addScaledVector(dir, best.dist);
    // boshga — qurolning bosh ko'paytuvchisi; oyoq/qo'lga — kamroq zarar (best.mul)
    const dmg = d.dmg * (best.head ? d.head : best.mul || 1) * falloff(d, best.dist);
    const s = best.soldier;
    // zenit pushkasi qalqoni: olddan otilgan o'q to'pchiga emas, pushkaga tegadi
    if (s.veh && s.veh.alive && s.veh.T.shield && shieldBlocks(s.veh, dir)) {
      G.fx.impact(end, dir.clone().multiplyScalar(-1), 'wall');
      damageVehicle(s.veh, d.dmg * (d.vehMul || VEH_MUL) * armorMul(s.veh, dir, d.ap, d.pierce), 'player');
      return { end, hit: true, shield: true };
    }
    s.damage(dmg, player.pos, best.head, 'player', 'bullet');
    G.fx.blood(end, dir, !s.alive);
    return { end, hit: true, head: best.head, kill: !s.alive };
  }
  if (wh) {
    const veh = wh.box && wh.box.vehicle;
    if (veh) {
      // Oyna yoki ochiq eshik: o'q transportga emas, o'sha joyda o'tirgan odamga tegadi
      const wz = veh.windowHit(o, dir, d.range);
      const occ = wz ? occupantAt(veh, wz.seat) : null;
      if (occ) {
        const pt = o.clone().addScaledVector(dir, wz.dist);
        occ.damage(d.dmg * falloff(d, wz.dist), player.pos, false, 'player', 'bullet');
        G.fx.impact(pt, wh.normal, 'wall'); G.fx.blood(pt, dir);
        return { end: pt, hit: true, glass: true };
      }
      G.fx.impact(wh.point, wh.normal, 'wall');
      damageVehicle(veh, d.dmg * (d.vehMul || VEH_MUL) * armorMul(veh, dir, d.ap, d.pierce), 'player');
      return { end: wh.point.clone(), hit: true };
    }
    G.fx.impact(wh.point, wh.normal, wh.ground ? 'ground' : 'wall');
    G.fx.decal(wh.point, wh.normal);
    return { end: wh.point.clone(), hit: false };
  }
  return { end: o.clone().addScaledVector(dir, d.range), hit: false };
}

export function updateWeapon(dt) {
  if (evacFreeze()) {   // evakuatsiya vertolyotida: qurol qo'lda ko'rinmaydi va otilmaydi
    for (const w of G.weapons) w.vm.group.visible = false;
    G.mountVM.group.visible = false; G.ads = 0; G.reloadT = 0; $('crosshair').style.opacity = 0;
    return;
  }
  if (G.droneCtl) {   // dron boshqarilmoqda: qo'ldagi qurol ko'rinmaydi va otmaydi (sichqoncha — dron uchun)
    for (const w of G.weapons) w.vm.group.visible = false;
    G.mountVM.group.visible = false; G.ads = 0; G.reloadT = 0;
    if (G.hmT > 0) { G.hmT -= dt; if (G.hmT <= 0) $('hitmarker').style.opacity = 0; }
    const ch = $('crosshair'); ch.style.opacity = 1;
    ch.children[0].style.top = '-21px'; ch.children[1].style.top = '12px'; ch.children[2].style.left = '-21px'; ch.children[3].style.left = '12px';
    return;
  }
  if (G.inVeh) {
    if (!ownGunActive()) { updateVehicleSeat(dt); return; }
    // o'z qurolimiz qo'lda: bort pulemyoti modeli va ko'rishni to'sadigan qismlar yashiriladi
    for (const m of G.inVeh.fpHide) m.visible = false;
    if (!isGun(cur()) || cur().locked) { const g = seatGuns(); if (g.length) switchWeapon(g[0]); else { updateVehicleSeat(dt); return; } }
  }
  G.mountVM.group.visible = false;
  { const w0 = cur(); if (w0.def.special && w0.mag === 0 && w0.reserve === 0 && G.fireT <= 0 && G.reloadT <= 0) dropSpecial(true); }
  const W = cur(), d = W.def, P = player, gun = isGun(W);
  G.fireT -= dt;
  if (G.switchT > 0) G.switchT -= dt;
  if (G.boltT > 0) G.boltT -= dt;
  G.bloom = Math.max(0, G.bloom - dt * 0.12);
  G.kick = Math.max(0, G.kick - dt * 9);
  if (G.flashT > 0) G.flashT -= dt;
  if (G.hmT > 0) { G.hmT -= dt; if (G.hmT <= 0) $('hitmarker').style.opacity = 0; }
  updateShells(dt);

  const busy = G.knifeT > 0 || G.throwT > 0;
  const wantAds = gun && mouse.R && P.alive && G.reloadT <= 0 && G.switchT <= 0 && !busy && !P.sprinting && !G.vault;
  G.ads = clamp(G.ads + (wantAds ? 1 : -1) * dt / (d.adsTime || 0.2), 0, 1);

  if (P.alive && gun) {
    if (mouse.L) { if (d.auto) tryFire(); else if (!G.triggerHeld) { tryFire(); G.triggerHeld = true; } }
    if (G.reloadT > 0) {
      G.reloadT -= dt;
      const prog = 1 - G.reloadT / G.reloadDur;
      if (!G.reloadIn && prog > (d.shells ? 0.55 : 0.7)) { G.reloadIn = true; sound.reload('in'); }
      if (G.reloadT <= 0) finishReload();
    }
    if (W.mag === 0 && W.reserve > 0 && G.reloadT <= 0 && G.fireT <= 0 && G.switchT <= 0 && !mouse.L && !busy) startReload();
  } else if (P.alive && d.kind === 'melee') {
    // qo'ldagi pichoq: chap tugma — tez kesish (bosib tursa takrorlanadi), o'ng tugma — sanchish
    if (G.switchT <= 0.15) { if (mouse.R) knifeAttack('stab'); else if (mouse.L) knifeAttack('slash'); }
  } else if (P.alive && d.kind === 'throw') {
    // qo'ldagi granata: tugma bosilganda halqa sug'uriladi, qo'yib yuborilganda uloqtiriladi (o'ng tugma — yaqinga)
    const held = mouse.L || mouse.R;
    if (G.cookT < 0) {
      if (held && !G.triggerHeld && G.throwT <= 0 && G.switchT <= 0.1 && G.grenades_n > 0) { G.cookT = 0; G.cookLob = !mouse.L; sound.pin(); }
    } else {
      G.cookT += dt;
      if (mouse.L) G.cookLob = false;
      if (G.cookT >= NADE.fuse) releaseNade(true);
      else if (!held) releaseNade();
    }
  }
  if (!P.alive && G.cookT >= 0) { G.cookT = -1; }

  // pichoq zarbasi
  if (G.knifeT > 0) {
    G.knifeT -= dt;
    if (!G.knifeHit && G.knifeT < G.knifeDur * (G.knifeKind === 'slash' ? 0.62 : 0.76)) { G.knifeHit = true; knifeStrike(); }
  }
  // granata uloqtirish
  if (G.throwT > 0) {
    G.throwT -= dt;
    if (!G.thrown && G.throwT < 0.38) {
      G.thrown = true;
      camBasis();
      const from = camera.position.clone().addScaledVector(_f, 0.5).addScaledVector(_r, 0.15).addScaledVector(_u, -0.1);
      const vel = _f.clone().multiplyScalar(17).addScaledVector(_u, 3).add(new THREE.Vector3(P.vel.x * 0.5, 0, P.vel.z * 0.5));
      spawnGrenade(from, vel, 'player', 'player');
      if (G.mp) net.send({ t: 'nade', p: v3arr(from), v: v3arr(vel) });
    }
    if (G.throwT <= 0 && d.kind === 'throw') {
      // qo'lda keyingi granata; qolmagan bo'lsa — asosiy qurolga qaytamiz
      if (G.grenades_n > 0) G.switchT = 0.35; else switchWeapon(mainSlot());
    }
  }

  // --- Ko'rinish modeli ---
  G.sprintAmt = lerp(G.sprintAmt, P.sprinting ? 1 : 0, Math.min(1, dt * 8));
  G.swayX *= Math.max(0, 1 - dt * 9); G.swayY *= Math.max(0, 1 - dt * 9);
  const vr = P.vel.x * Math.cos(P.yaw) - P.vel.z * Math.sin(P.yaw);   // o'ngga tezlik
  G.tilt = lerp(G.tilt, clamp(vr / 5, -1, 1), Math.min(1, dt * 7));
  G.relPose = lerp(G.relPose, gun && G.reloadT > 0 ? 1 : 0, Math.min(1, dt * 9));
  let lower = 0;   // pichoq/granata paytida asosiy qurol pastga tushadi
  if (gun) {
    if (G.knifeT > 0) lower = Math.sin((1 - G.knifeT / G.knifeDur) * Math.PI);
    if (G.throwT > 0) lower = Math.max(lower, Math.sin((1 - G.throwT / 0.75) * Math.PI));
    if (G.vault) lower = Math.max(lower, Math.sin(Math.min(1, G.vault.t / G.vault.dur) * Math.PI));   // oshib o'tayotganda qurol pastda
    animGun(dt, W, lower);
  }
  animKnife(d.kind === 'melee');
  animNade(d.kind === 'throw');

  // HUD: nishon belgisi. Mo'ljalga olganda u yashiriladi — o'rnini qurolning o'z mo'ljali egallaydi.
  const cs = currentSpread();
  const gap = d.kind === 'melee' ? 5 : (cs / Math.tan((camera.fov * Math.PI) / 360)) * (innerHeight / 2) + 4;
  const ch = $('crosshair');
  const hideCh = G.ads > 0.55 || P.sprinting || !P.alive;
  ch.style.opacity = hideCh ? 0 : 1;
  if (!hideCh) {
    ch.children[0].style.top = -(gap + 9) + 'px';
    ch.children[1].style.top = gap + 'px';
    ch.children[2].style.left = -(gap + 9) + 'px';
    ch.children[3].style.left = gap + 'px';
  }
}
