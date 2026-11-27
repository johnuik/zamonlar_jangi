// Qo'ldagi qurolning (ko'rinish modeli) animatsiyasi: gilzalar, qurol, pichoq, panjalar, granata.
import * as THREE from '../lib/three.module.js';
import { G, _tmp, clamp, lerp, player } from './core.js';
import { NADE } from './weapons.js';

// ---------- Gilzalar (ko'rinish modeli sahnasida) ----------
export const _sv = new THREE.Vector3();
export function ejectShell(vm) {
  if (!vm.eject || !G.shells) return;
  const sh = G.shells.find((x) => x.t <= 0 && x.shot === vm.shell);
  if (!sh) return;
  vm.group.updateMatrixWorld(true);
  vm.eject.getWorldPosition(sh.m.position);
  sh.t = 0.7; sh.m.visible = true;
  if (vm.ejectUp) sh.v.set(0.25 + Math.random() * 0.3, 1.5 + Math.random() * 0.4, 0.15);
  else sh.v.set(1.0 + Math.random() * 0.5, 0.7 + Math.random() * 0.4, 0.25 + Math.random() * 0.2);
  sh.r.set(Math.random() * 20, Math.random() * 20, Math.random() * 20);
  sh.m.rotation.set(0, Math.random() * 3, 0);
}
export function updateShells(dt) {
  for (const sh of G.shells) {
    if (sh.t <= 0) continue;
    sh.t -= dt; sh.v.y -= 6.5 * dt;
    sh.m.position.addScaledVector(sh.v, dt);
    sh.m.rotation.x += sh.r.x * dt; sh.m.rotation.y += sh.r.y * dt; sh.m.rotation.z += sh.r.z * dt;
    if (sh.t <= 0) sh.m.visible = false;
  }
}

// O'qotar qurolning ko'rinish modeli: holat (son/mo'ljal), yurish tebranishi, tepki, zatvor, qayta o'qlash
export function animGun(dt, W, lower) {
  const d = W.def, vm = W.vm, P = player;
  if (vm.skinLater && vm.skinLater()) vm.skinLater = null;   // haqiqiy qurol modeli yuklangach — qurol tanasi almashadi
  G.dofRange = vm.dofRange || null;   // (mo'ljaldagi xiralik chegarasi — model qurollarda orqa mo'ljalgacha)
  const a = G.ads * G.ads * (3 - 2 * G.ads), hipK = 1 - a;
  const pos = _tmp.copy(vm.hip).lerp(vm.ads, a);
  let rx = 0.012 * hipK, ry = (vm.legacy ? 0 : 0.035) * hipK, rz = 0;
  // nafas olish
  const br = G.time * 1.7;
  pos.y += Math.sin(br) * 0.0016 * (0.12 + hipK); pos.x += Math.cos(br * 0.5) * 0.0011 * (0.12 + hipK);
  // yurish
  const bobAmt = P.onGround ? Math.min(1.3, Math.hypot(P.vel.x, P.vel.z) / 5) : 0.2;
  const bm = (1 - a * 0.92) * bobAmt;
  pos.x += Math.sin(P.bob) * 0.011 * bm * (1 + G.sprintAmt);
  pos.y += -Math.abs(Math.cos(P.bob)) * 0.013 * bm * (1 + G.sprintAmt) - G.landDip * 0.5 * (1 - a * 0.6);
  // sichqoncha inersiyasi va yon tomonga og'ish
  pos.x -= G.swayX * (1 - a * 0.8); pos.y += G.swayY * (1 - a * 0.8);
  ry += -G.swayX * 1.5 * (1 - a * 0.7); rx += -G.swayY * 1.5 * (1 - a * 0.7);
  rz -= G.tilt * 0.055 * (1 - a * 0.75); pos.x += G.tilt * 0.005 * hipK;
  if (!P.onGround) pos.y += clamp(-P.vel.y * 0.003, -0.025, 0.025) * (1 - a * 0.7);
  // yugurish pozasi
  const s = G.sprintAmt;
  pos.x -= 0.06 * s; pos.y -= 0.05 * s; ry += 0.75 * s; rx -= 0.25 * s; rz += 0.25 * s;
  if (P.crouch) rz -= 0.05 * hipK;
  if (P.prone) { rz -= 0.09 * hipK; pos.y -= 0.012 * hipK; }
  // tepki: qurol orqaga suriladi va uchi ko'tariladi (mo'ljalda — kamroq)
  const heavy = d.recoil > 0.04, kk = G.kick * (1 - a * 0.45);
  pos.z += kk * (heavy ? 0.05 : 0.026); pos.y += kk * 0.004 * hipK;
  rx += kk * (heavy ? 0.16 : 0.04) * (1 - a * 0.45); rz += kk * G.kickRoll;
  // zatvor (avtomat/yarim avtomat): har o'qda orqaga borib qaytadi; to'pponcha zatvori o'q tugaganda orqada qoladi
  const cyc = G.boltT > 0 ? Math.sin((1 - G.boltT / 0.085) * Math.PI) : 0;
  let pull = 0;   // qayta o'qlash oxirida zatvorni tortish
  // qo'lda harakatlanadigan zatvor / pomp
  const cycleDur = 60 / d.rpm;
  let man = 0;
  if (G.cycleT > 0 && (d.bolt || d.pump)) {
    G.cycleT -= dt;
    const ph = 1 - G.cycleT / cycleDur;
    if (ph > 0.25 && ph < 0.9) {
      man = Math.sin(((ph - 0.25) / 0.65) * Math.PI);
      if (d.bolt) { rz += 0.22 * man * (1 - a * 0.6); pos.y -= 0.016 * man * (1 - a * 0.5); }
      if (G.cycleEject && ph > 0.5) { G.cycleEject = false; ejectShell(vm); }
    }
  }
  // qayta o'qlash
  let magOff = 0, hand = 0, load = 0;
  if (G.reloadT > 0) {
    const t = 1 - G.reloadT / G.reloadDur;
    if (d.shells) load = t;
    else {
      if (t > 0.12 && t < 0.38) magOff = (t - 0.12) / 0.26; else if (t >= 0.38 && t < 0.55) magOff = 1; else if (t >= 0.55 && t < 0.74) magOff = 1 - (t - 0.55) / 0.19;
      hand = t < 0.1 ? t / 0.1 : t < 0.76 ? 1 : t < 0.86 ? 1 - (t - 0.76) / 0.1 : 0;
      if (t > 0.84 && t < 0.97) pull = Math.sin(((t - 0.84) / 0.13) * Math.PI);
    }
  }
  const rp = G.relPose;
  if (d.shells) { pos.y -= 0.03 * rp; rx += 0.22 * rp; rz -= 0.5 * rp; pos.x -= 0.02 * rp; }   // o'qlash oynasi yuqoriga qaraydi
  else { pos.y -= 0.055 * rp; pos.x -= 0.025 * rp; rx += 0.32 * rp; rz += 0.5 * rp; ry += 0.12 * rp; }
  if (vm.mag && vm.magBase) {
    vm.mag.position.set(vm.magBase.x, vm.magBase.y - magOff * vm.magDrop, vm.magBase.z + magOff * 0.02);
    vm.mag.visible = magOff < 0.96;
  }
  if (vm.handL && !vm.pump) {
    // chap qo'l magazin bilan birga pastga tushadi va yangi magazinni olib keladi
    if (hand > 0 && vm.magBase) vm.handL.position.set(lerp(vm.handLBase.x, vm.magBase.x - 0.005, hand), lerp(vm.handLBase.y, vm.magBase.y - 0.1 - magOff * vm.magDrop, hand), lerp(vm.handLBase.z, vm.magBase.z + 0.01, hand));
    else vm.handL.position.copy(vm.handLBase);
  }
  if (vm.loader) {
    vm.loader.visible = load > 0.15 && load < 0.75;
    if (vm.loader.visible) { const k = (load - 0.15) / 0.6; vm.loader.position.set(0, lerp(-0.2, -0.092, k), lerp(-0.02, -0.13, k)); }
  }
  for (const b of vm.boltParts) b.position.z = b.userData.z0 + b.userData.bolt * Math.max(d.bolt ? man : cyc, pull);
  if (vm.pump) vm.pump.position.z = vm.pumpBase.z + 0.085 * man;
  if (vm.slide) vm.slide.position.z = W.mag === 0 && G.reloadT <= 0 ? 0.03 : W.mag === 0 && G.reloadT > 0 && pull === 0 && (1 - G.reloadT / G.reloadDur) < 0.9 ? 0.03 : 0.032 * Math.max(cyc, pull * 0.6);
  // almashtirish
  if (G.switchT > 0) { const k = G.switchT / 0.45; pos.y -= 0.32 * k * k; rx -= 0.7 * k; rz += 0.2 * k; }
  pos.y -= 0.3 * lower; rx -= 0.5 * lower;
  if (!P.alive) pos.y -= 0.5;
  if (vm.spin) vm.spin.rotation.z += G.kick * dt * 40;
  if (vm.reticle) vm.reticle.material.opacity = 0.35 + a * 0.65;

  vm.group.position.copy(pos);
  vm.group.rotation.set(rx, ry, rz);
  vm.group.visible = !(d.scope && G.ads > 0.92);
  vm.flash.visible = G.flashT > 0;
  if (vm.flash.visible) { vm.flash.rotation.z = Math.random() * 6; const fs = 0.8 + Math.random() * 0.5; vm.flash.scale.set(fs, fs, fs); }
}

// Pichoq: equipped — qo'lda ushlab turilgan (3-o'rin); aks holda faqat [V] zarbasi paytida ko'rinadi
export function animKnife(equipped) {
  if (G.knifeVM.claws) { animClaws(); return; }
  if (G.knifeVM.skinLater && G.knifeVM.skinLater()) G.knifeVM.skinLater = null;
  const g = G.knifeVM.group, P = player;
  g.visible = (equipped || G.knifeT > 0) && P.alive;
  if (!g.visible) return;
  const t = G.knifeT > 0 ? 1 - G.knifeT / G.knifeDur : 0;
  let px = 0.2, py = -0.17, pz = -0.42, rx = 0.5, ry = 0.3, rz = 0.2;
  const br = Math.sin(G.time * 1.7) * 0.003, bob = P.onGround ? Math.min(1.3, Math.hypot(P.vel.x, P.vel.z) / 5) : 0.2;
  py += br - Math.abs(Math.cos(P.bob)) * 0.014 * bob; px += Math.sin(P.bob) * 0.012 * bob;
  if (G.knifeT > 0 && G.knifeKind === 'slash') {
    // o'ngdan chapga kesish
    const k = t < 0.25 ? -t / 0.25 * 0.35 : t < 0.7 ? -0.35 + ((t - 0.25) / 0.45) * 1.35 : 1 - (t - 0.7) / 0.3;
    px = lerp(0.2, -0.12, clamp(k, -0.4, 1)); py += -0.02 + Math.sin(clamp(k, 0, 1) * Math.PI) * 0.05; pz = lerp(-0.42, -0.5, clamp(k, 0, 1));
    ry = lerp(0.3, 1.5, clamp(k, -0.4, 1)); rz = lerp(0.2, 1.2, clamp(k, 0, 1)); rx = lerp(0.5, 0.1, clamp(k, 0, 1));
  } else if (G.knifeT > 0) {
    // oldinga sanchish
    const k = t < 0.3 ? t / 0.3 : t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
    px = lerp(equipped ? 0.2 : 0.25, 0.02, k); py = lerp(equipped ? -0.17 : -0.3, -0.1, k); pz = lerp(equipped ? -0.42 : -0.3, -0.62, k);
    rx = lerp(equipped ? 0.5 : 0.3, -0.05, k); ry = lerp(equipped ? 0.3 : 0.4, -0.1, k); rz = lerp(equipped ? 0.2 : -0.8, 0.4, k);
  }
  if (equipped && G.switchT > 0) { const k = G.switchT / 0.45; py -= 0.3 * k * k; rx -= 0.5 * k; }
  px -= G.swayX; py += G.swayY;
  g.position.set(px, py, pz);
  g.rotation.set(rx, ry, rz);
}

// Zombi-o'yinchining qo'llari: oldinga cho'zilgan; zarbada ikkalasi siltanadi (tishlashda — oldinga tortiladi)
export function animClaws() {
  const vm = G.knifeVM, g = vm.group, P = player;
  g.visible = P.alive && !G.inVeh;
  if (!g.visible) return;
  const t = G.knifeT > 0 ? 1 - G.knifeT / G.knifeDur : 0, k = Math.sin(Math.min(1, t) * Math.PI), bite = G.knifeKind !== 'slash';
  const bob = P.onGround ? Math.min(1.3, Math.hypot(P.vel.x, P.vel.z) / 5) : 0.2, br = Math.sin(G.time * 2.1) * 0.012;
  g.position.set(Math.sin(P.bob) * 0.02 * bob - G.swayX, -0.02 + br - Math.abs(Math.cos(P.bob)) * 0.02 * bob + G.swayY, -0.02 - k * (bite ? 0.2 : 0.12));
  g.rotation.set(-k * (bite ? 0.1 : 0.3), 0, Math.sin(G.time * 1.3) * 0.03);
  vm.R.rotation.set(0.12 - k * (bite ? 0.25 : 0.55), 0.2 - k * (bite ? 0.25 : 0.5), 0);
  vm.L.rotation.set(0.12 - k * (bite ? 0.25 : 0.2), -0.2 + k * (bite ? 0.25 : 0.1), Math.sin(G.time * 1.7) * 0.05);
}

// Granata: equipped — qo'lda (4-o'rin); aks holda faqat [G] bilan tez uloqtirish paytida ko'rinadi
export function animNade(equipped) {
  const g = G.nadeVM.group, P = player;
  const quick = !equipped && G.throwT > 0 && !G.thrown;
  const flying = equipped && G.throwT > 0;
  g.visible = P.alive && (quick || (equipped && G.grenades_n > 0 && !(flying && G.throwT < 0.24)));
  if (!g.visible) return;
  G.nadeVM.pin.visible = !(G.cookT >= 0 || flying || quick);
  if (quick) {
    const t = 1 - G.throwT / 0.75;
    g.position.set(0.18, -0.22 + t * 0.2, -0.35 + t * 0.15);
    g.rotation.set(-0.3 - t * 0.6, 0, 0);
    return;
  }
  const bob = P.onGround ? Math.min(1.3, Math.hypot(P.vel.x, P.vel.z) / 5) : 0.2;
  let px = 0.16 + Math.sin(P.bob) * 0.012 * bob, py = -0.13 + Math.sin(G.time * 1.7) * 0.003 - Math.abs(Math.cos(P.bob)) * 0.014 * bob, pz = -0.36, rx = 0.15, ry = -0.2, rz = 0.1;
  if (G.cookT >= 0) {
    // halqa sug'urilgan: qo'l orqaga tortilgan, vaqt tugashiga yaqin titraydi
    const k = Math.min(1, G.cookT / 0.25), lob = G.cookLob, sh = G.cookT > NADE.fuse - 1.2 ? (Math.random() - 0.5) * 0.006 : 0;
    px = lerp(px, lob ? 0.2 : 0.24, k) + sh; py = lerp(py, lob ? -0.27 : -0.1, k) + sh; pz = lerp(pz, lob ? -0.3 : -0.24, k);
    rx = lerp(rx, lob ? -0.5 : 0.7, k);
  } else if (flying) {
    const k = 1 - G.throwT / 0.4;   // 0 → 1: qo'l oldinga siltanadi
    px = lerp(0.24, 0.1, k); py = lerp(-0.1, -0.02, k); pz = lerp(-0.24, -0.6, k); rx = lerp(0.7, -0.9, k);
  }
  if (G.switchT > 0) { const k = G.switchT / 0.45; py -= 0.3 * k * k; rx -= 0.4 * k; }
  px -= G.swayX; py += G.swayY;
  g.position.set(px, py, pz);
  g.rotation.set(rx, ry, rz);
}
