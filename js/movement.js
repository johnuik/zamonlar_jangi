// O'yinchi harakati, parashyut, balanddan yiqilish va kamera.
import * as THREE from '../lib/three.module.js';
import { $, EYE_CROUCH, EYE_H, FOV_BASE, G, _dir, _o, _tmp, _wh, camera, keys, lerp, mouse, player, settings, sound } from './core.js';
import { banner, hudCache, popup, setText } from './hud.js';
import { cur } from './arsenal.js';
import { damagePlayer, endGame } from './game.js';
import { leaveVehicleLocal, updatePrompt, vehicleCamera } from './transport.js';
import { net } from './mp.js';
import { killerYaw } from './social.js';
import { droneCamera } from './drone.js';
import { evacCamera, evacFreeze } from './evac.js';

// ---------- O'yinchi yangilanishi ----------
export function updatePlayer(dt) {
  const P = player;
  if (!P.alive) {
    P.deathT += dt;
    if (P.deathT > 3 && G.state === 'playing' && !G.mp && !(G.zg && G.zg.revive())) endGame(false);   // (zombi rejimi: imkoniyat qolgan bo'lsa nazorat nuqtasidan davom etadi)
    $('prompt').style.display = 'none';
    return;
  }
  if (evacFreeze()) { $('prompt').style.display = 'none'; P.moving = false; P.sprinting = false; return; }   // evakuatsiya vertolyotida yoki yakuniy "kino" paytida — joyini evac.js boshqaradi
  if (G.inVeh && !G.inVeh.alive) leaveVehicleLocal();
  if (G.inVeh) {
    // transport ichida: o'rindiqqa bog'langan
    const v = G.inVeh;
    v.seatPos(G.seat, P.pos); P.vel.copy(v.vel); P.onGround = true; P.sprinting = false;
    P.moving = v.vel.lengthSq() > 9; P.crouch = v.seatSit(G.seat); P.prone = false;
    P.eyeH += ((P.crouch ? EYE_CROUCH : EYE_H) - P.eyeH) * Math.min(1, dt * 10);
    G.platform = null; G.insideVeh = null;
  } else if (G.vault) {
    updateVault(dt);
  } else {
    // Ichida yursa bo'ladigan transport (Chinuk) yaqinida uning dunyo qutisi o'rniga o'z devor/pol/rampasi ishlaydi
    const wv = walkVehicleNear(), ign = wv ? wv.box : undefined;
    if (G.platform && (G.platform !== wv || !G.platform.alive)) G.platform = null;
    if (G.platform) {
      // transport polida turibmiz: u bilan birga ko'chamiz va burilamiz (havoda ham)
      const v = G.platform, c = Math.cos(v.dYaw), s = Math.sin(v.dYaw);
      const rx = P.pos.x - (v.pos.x - v.dPos.x), rz = P.pos.z - (v.pos.z - v.dPos.z);
      P.pos.x = v.pos.x + rx * c + rz * s; P.pos.z = v.pos.z - rx * s + rz * c;
      P.pos.y += v.dPos.y; P.yaw += v.dYaw;
    }
    let fx = 0, fz = 0;
    const ctl = !G.droneCtl;   // dron boshqarilayotganda tugmalar dronga tegishli — o'yinchining o'zi joyida turadi
    if (ctl) { if (keys.KeyW) fz += 1; if (keys.KeyS) fz -= 1; if (keys.KeyD) fx += 1; if (keys.KeyA) fx -= 1; }
    const shift = ctl && (keys.ShiftLeft || keys.ShiftRight);
    // yugurish — o'rnidan turadi (mo'ljalda emas: optikada [Shift] — nafasni ushlash, yotgan mergan turib ketmasin)
    if (shift && fz > 0 && !mouse.R && G.ads < 0.1 && (G.crouchToggle || G.proneToggle) && canRise(STAND_H)) { G.crouchToggle = false; G.proneToggle = false; }
    // holat: tik, cho'kkalagan [C] yoki yotgan [Z] (yotgan o'yinchi sekin emaklaydi, lekin uni ko'rish va urish qiyin)
    P.prone = !!G.proneToggle && !G.chute && !G.isZ;
    P.crouch = !P.prone && !!G.crouchToggle && !G.chute;
    P.sprinting = shift && fz > 0 && !mouse.R && !mouse.L && !P.crouch && !P.prone && G.knifeT <= 0 && G.throwT <= 0 && G.cookT < 0 && !G.chute;
    const def = cur().def;
    let speed = 5.0 * (def.move || 1);
    if (G.isZ) speed *= 1.25;   // zombi-o'yinchi tezroq yuguradi va balandroq sakraydi
    if (P.sprinting) speed *= 1.6;
    if (P.crouch) speed *= 0.5;
    if (P.prone) speed *= 0.26;
    if (G.adrT > 0) speed *= 1.18;    // adrenalin
    if (G.healT > 0) speed *= 0.6;    // bint bog'layotganda sekinroq
    speed *= 1 - G.ads * 0.45;
    if (G.chute) speed = 5.5;
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    let wx = -sy * fz + cy * fx, wz = -cy * fz - sy * fx;
    const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    const acc = P.onGround ? 11 : 2.5;
    P.vel.x += (wx * speed - P.vel.x) * Math.min(1, acc * dt);
    P.vel.z += (wz * speed - P.vel.z) * Math.min(1, acc * dt);
    // [PROBEL]: yotgan — cho'kkalaydi, cho'kkalagan — turadi, tik turgan — sakraydi (bir bosishda bitta harakat)
    if (!keys.Space) G.jumpLatch = false;
    if (ctl && keys.Space && P.onGround && !G.jumpLatch) {
      if (P.prone) { setStance(1); G.jumpLatch = true; }
      else if (P.crouch) { setStance(0); G.jumpLatch = true; }
      else { P.vel.y = G.isZ ? 9.2 : 6.3; P.onGround = false; }
    }
    P.vel.y -= 18 * dt;
    if (P.vel.y < -48) P.vel.y = -48;   // erkin tushishning eng katta tezligi
    if (G.chute && P.vel.y < -4.2) P.vel.y += (-4.2 - P.vel.y) * Math.min(1, dt * 6);   // parashyut tushishni sekinlashtiradi
    const head = P.eyeH + 0.15;
    if (P.vel.y > 0) {
      const top = P.pos.y + P.eyeH + 0.2;
      let ceil = G.world.ceilingHeight(P.pos.x, P.pos.z, 0.38, top, ign);
      if (wv) ceil = Math.min(ceil, wv.walkCeiling(P.pos, 0.38, top));
      if (top + P.vel.y * dt > ceil) P.vel.y = 0;   // shiftga urilish
    }
    P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
    G.world.collideCircle(P.pos, 0.38, P.pos.y, P.pos.y + head, ign);
    if (wv) wv.walkCollide(P.pos, 0.38, P.pos.y, P.pos.y + head);
    P.pos.y += P.vel.y * dt;
    let gh = G.world.groundHeight(P.pos.x, P.pos.z, 0.38, P.pos.y, ign), onVeh = false;
    if (wv) { const g2 = wv.walkGround(P.pos, 0.38, P.pos.y); if (g2 > gh) { gh = g2; onVeh = true; } }
    if (P.pos.y <= gh) {
      if (!P.onGround) {
        const vy = -P.vel.y;
        if (vy > 4) { sound.land(); G.landDip = Math.min(0.12, vy * 0.012); }
        if (vy > 14) fallDamage((vy - 14) * 8.5);   // ~5.5 m dan balanddan parashyutsiz tushish; ~18 m — halokatli
      }
      P.pos.y = gh; P.vel.y = 0; P.onGround = true;
      G.chute = false;
      G.platform = onVeh ? wv : null;
    } else if (P.pos.y > gh + 0.05) { P.onGround = false; G.platform = null; }
    G.insideVeh = wv && wv.inCabin(P.pos) ? wv : null;
    // transport qutisi ichida turgan bo'lsak (yuk bo'limi, rampa), o'z o'qimiz va raqib nishoni uni to'siq deb hisoblamaydi
    player.vehBox = wv && wv.box.containsPoint(_tmp.set(P.pos.x, P.pos.y + P.eyeH, P.pos.z)) ? wv.box : null;
    P.eyeH += ((P.prone ? PRONE_EYE : P.crouch ? EYE_CROUCH : EYE_H) - P.eyeH) * Math.min(1, dt * 10);
    const hs = Math.hypot(P.vel.x, P.vel.z);
    P.moving = hs > 1;
    if (P.onGround && hs > 1.2) {
      P.bob += hs * dt * 1.9;
      P.stepAcc += hs * dt;
      if (P.stepAcc > (P.sprinting ? 2.7 : 2.1)) { P.stepAcc = 0; sound.step(G.era, P.sprinting); }
    }
  }
  // jon o'zi tiklanmaydi: faqat aptechka, bint [H] yoki adrenalin bilan
  if (P.hp < 35) { G.hbT -= dt; if (G.hbT <= 0) { sound.heartbeat(); G.hbT = 0.85; } }
  updatePrompt();
}

// ---------- Holat: tik / cho'kkalagan / yotgan ----------
export const STAND_H = 1.98, CROUCH_H = 1.34, PRONE_EYE = 0.45;   // (personaj o'lchami: core.js CHAR_K)
// Bosh ustida shu balandlikkacha (oyoqdan hisoblaganda) bo'sh joy bormi — past joyda o'rnidan turib bo'lmaydi
export function canRise(h) {
  const P = player;
  return G.world.ceilingHeight(P.pos.x, P.pos.z, 0.38, P.pos.y + P.eyeH + 0.2) >= P.pos.y + h;
}
// n: 0 — tik, 1 — cho'kkalagan, 2 — yotgan. Joy yetmasa, pastroq holatda qoladi.
export function setStance(n) {
  const P = player;
  if (!P.alive || G.inVeh || G.vault) return;
  if (n === 2) { if (!P.onGround || G.chute || G.isZ) return; G.proneToggle = true; G.crouchToggle = false; return; }
  if (n === 0 && !canRise(STAND_H)) n = 1;
  if (n === 1 && G.proneToggle && !canRise(CROUCH_H)) return;
  G.proneToggle = false; G.crouchToggle = n === 1;
}
export function toggleCrouch() { setStance(G.proneToggle || !G.crouchToggle ? 1 : 0); }
export function toggleProne() { setStance(G.proneToggle ? 0 : 2); }

// ---------- Oshib o'tish ----------
// [PROBEL]: oldimizdagi past to'siq (deraza tokchasi, qum qoplari, past devor, yashik) ustidan oshib o'tiladi yoki ustiga chiqiladi.
// Derazadan uyga kirish ham shu: tokcha ustida kamida ~0.9 m ochiq joy bo'lsa, o'yinchi narigi tomonga o'tadi.
const _vp = new THREE.Vector3();
function spaceFree(x, y, z, h) {   // (x, z) ustunida y dan y+h gacha qattiq jism yo'qmi
  for (let k = 0.2; k < h; k += 0.3) if (G.world.pointInBox(_vp.set(x, y + k, z))) return false;
  return !G.world.pointInBox(_vp.set(x, y + h, z));
}
export function tryVault() {
  const P = player, W = G.world;
  if (G.vault || !P.alive || !P.onGround || G.inVeh || G.chute || G.state !== 'playing') return false;
  const dx = -Math.sin(P.yaw), dz = -Math.cos(P.yaw), y0 = P.pos.y;
  // 1) old tomonda tizza–bel balandligida to'siq bormi
  let hit = null;
  for (const h of [0.35, 0.8]) {
    const wh = W.rayCast(_o.set(P.pos.x, y0 + h, P.pos.z), _dir.set(dx, 0, dz), 1.15, _wh);
    if (wh && wh.box && !wh.box.vehicle) { hit = { d: wh.dist, top: wh.box.max.y }; break; }
  }
  if (!hit) return false;
  const top = hit.top, rise = top - y0;
  if (rise < 0.55 || rise > 1.65) return false;
  // 2) to'siq ustida joy bormi va u qayerda tugaydi
  let end = -1;
  for (let t = hit.d + 0.1; t <= hit.d + 1.75; t += 0.1) {
    const x = P.pos.x + dx * t, z = P.pos.z + dz * t;
    const g = W.groundHeight(x, z, 0.25, top + 0.05);
    if (g > top + 0.12) return false;                       // to'siq balandlashib ketdi
    if (g < top - 0.15) { end = t; break; }                 // narigi tomon
    if (!spaceFree(x, top, z, 0.85)) return false;          // ustida joy yo'q (devor, panjara, ustma-ust yashik)
  }
  let tx, ty, tz, over = end >= 0, drop = false;
  if (over) {
    // narigi tomonga tushish joyi
    const t = end + 0.28;
    _vp.set(P.pos.x + dx * t, 0, P.pos.z + dz * t);
    const gl = W.groundHeight(_vp.x, _vp.z, 0.3, top);
    // narigi tomon ancha pastda (ikkinchi qavat derazasi): tokchadan oshib, pastga sakraymiz — 5 m gacha (undan balandi xavfli: tasodifan yiqilmaslik uchun ruxsat yo'q)
    drop = gl < y0 - 1.6;
    if (gl > top + 0.1 || gl < y0 - 5.2) return false;
    tx = _vp.x; tz = _vp.z; ty = drop ? top - 0.35 : gl;
    W.collideCircle(_vp, 0.37, ty, ty + CROUCH_H);
    if (Math.hypot(_vp.x - tx, _vp.z - tz) > 0.3) return false;   // narigi tomonda turadigan joy yo'q
    tx = _vp.x; tz = _vp.z;
    if (!spaceFree(tx, ty, tz, CROUCH_H - 0.1)) return false;
  } else {
    // qalin to'siq: ustiga chiqamiz
    const t = hit.d + 0.6;
    tx = P.pos.x + dx * t; tz = P.pos.z + dz * t; ty = top;
    if (!spaceFree(tx, top, tz, CROUCH_H - 0.1)) return false;
  }
  const arc = over ? Math.max(0.08, top + 0.14 - (y0 + ty) / 2) : 0.12;
  G.vault = { t: 0, dur: (over ? 0.36 : 0.46) + rise * 0.16, fx: P.pos.x, fy: y0, fz: P.pos.z, tx, ty, tz, arc, dx, dz, over, drop };
  G.proneToggle = false; G.reloadT = 0; G.ads = 0;
  P.vel.set(0, 0, 0); P.sprinting = false;
  sound.step(G.era, true);
  return true;
}
function updateVault(dt) {
  const P = player, v = G.vault;
  v.t += dt;
  const k = Math.min(1, v.t / v.dur), e = k * k * (3 - 2 * k), ey = v.over ? e : 1 - (1 - k) * (1 - k);
  P.pos.set(lerp(v.fx, v.tx, e), lerp(v.fy, v.ty, ey) + v.arc * Math.sin(Math.PI * k), lerp(v.fz, v.tz, e));
  P.vel.set(0, 0, 0); P.onGround = false; P.sprinting = false; P.moving = true; P.crouch = true; P.prone = false;
  P.eyeH += (0.9 - P.eyeH) * Math.min(1, dt * 14);
  G.platform = null; G.insideVeh = null; player.vehBox = null;
  if (k >= 1) {
    P.pos.set(v.tx, v.ty, v.tz); P.onGround = !v.drop; P.vel.set(v.dx * 2.4, v.drop ? -1.5 : 0, v.dz * 2.4);   // (drop — havoda qoladi va o'zi pastga tushadi)
    G.vault = null; G.landDip = 0.05; G.jumpLatch = true;
    G.crouchToggle = !canRise(STAND_H);   // past joyga tushgan bo'lsak — cho'kkalagan holda qolamiz
    sound.land();
  }
}

// ---------- Parashyut va balanddan yiqilish ----------
export function walkVehicleNear() {
  const P = player;
  let best = null, bd = 11;
  for (const v of G.vehicles) {
    if (!v.alive || !v.T.walk) continue;
    const d = Math.hypot(v.pos.x - P.pos.x, v.pos.z - P.pos.z);
    if (d < bd && P.pos.y > v.pos.y - 3 && P.pos.y < v.pos.y + 6) { bd = d; best = v; }
  }
  return best;
}
// Oyoq ostidagi yer/pol balandligi (transport polini ham hisobga oladi)
export function groundBelow() {
  const P = player, wv = walkVehicleNear();
  let g = G.world.groundHeight(P.pos.x, P.pos.z, 0.38, P.pos.y, wv ? wv.box : undefined);
  if (wv) g = Math.max(g, wv.walkGround(P.pos, 0.38, P.pos.y));
  return g;
}
// Parashyut o'zi ochilmaydi: havoda [PROBEL] bosilganda ochiladi
export function tryChute() {
  const P = player;
  if (G.chute || P.onGround || G.inVeh || !P.alive || P.vel.y > -3) return;
  if (P.pos.y - groundBelow() < 3.5) return;
  G.chute = true; sound.chute();
  banner('PARASHYUT OCHILDI', 'W/A/S/D bilan boshqaring', 2);
}
export function fallDamage(dmg) {
  if (!(dmg > 0)) return;
  popup('BALANDDAN YIQILDINGIZ', true);
  if (G.mp) { net.send({ t: 'fall', dmg: Math.round(dmg) }); G.hurtPulse = 1; G.shake = Math.max(G.shake, 0.7); sound.hurt(); }
  else { G.shake = Math.max(G.shake, 0.7); damagePlayer(dmg, null, null, true); }
}

export function updateCamera(dt) {
  if (evacCamera()) { $('scope').style.display = 'none'; return; }   // vertolyot kabinasi yoki yakuniy kino rakurslari
  if (G.droneCtl && G.drone && !G.inVeh) { droneCamera(dt); $('scope').style.display = 'none'; return; }
  if (G.inVeh) { vehicleCamera(dt); return; }
  const P = player, def = cur().def;
  G.shake = Math.max(0, G.shake - dt * 1.8);
  G.landDip = Math.max(0, G.landDip - dt * 0.5);
  G.kickPitch *= Math.max(0, 1 - dt * 14);
  // tepkini qaytarish
  if (G.time - G.lastShot > 0.12 && G.recoilAcc > 0) {
    const r = Math.min(G.recoilAcc, G.recoilAcc * dt * 7 + 0.0005);
    P.pitch -= r * 0.85; G.recoilAcc -= r;
  }
  const scoped = def.scope && G.ads > 0.92;
  let sx = 0, sy = 0;
  if (scoped) {
    const hold = (keys.ShiftLeft || keys.ShiftRight) && G.breath > 0;
    if (hold) G.breath -= dt; else G.breath = Math.min(4, G.breath + dt * 0.8);
    const amp = hold ? 0.12 : 1;
    sx = (Math.sin(G.time * 1.3) * 0.004 + Math.sin(G.time * 2.7) * 0.002) * amp;
    sy = (Math.cos(G.time * 1.7) * 0.003 + Math.sin(G.time * 0.9) * 0.002) * amp;
  }
  const sh = G.shake * G.shake;
  const bobAmt = P.onGround ? Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 5) * (1 - G.ads * 0.85) : 0;
  const bobY = Math.abs(Math.sin(P.bob)) * 0.05 * bobAmt;
  let eyeY = P.pos.y + P.eyeH + bobY - G.landDip;
  let roll = (Math.random() - 0.5) * sh * 0.04 + Math.sin(P.bob) * 0.004 * bobAmt;
  if (!P.alive) {
    const t = Math.min(1, P.deathT / 1.2);
    eyeY = lerp(P.pos.y + P.eyeH, P.pos.y + 0.35, t * t);
    roll = t * 0.55;
    // kamera asta-sekin o'ldirgan tomonga buriladi
    const ky = killerYaw();
    if (ky !== null) { let d = ky - P.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; P.yaw += d * Math.min(1, dt * 3); P.pitch += (0.12 - P.pitch) * Math.min(1, dt * 3); }
  }
  camera.position.set(P.pos.x, eyeY, P.pos.z);
  camera.rotation.set(P.pitch + G.kickPitch + sy + (Math.random() - 0.5) * sh * 0.03, P.yaw + sx + (Math.random() - 0.5) * sh * 0.03, roll);
  aimFov(dt, def, scoped && P.alive);
}
// Mo'ljalga olishdagi yaqinlashtirish, optika qoplamasi va chetlarning qorayishi (piyoda ham, transportda o'z qurolidan otganda ham)
export function aimFov(dt, def, sc) {
  const P = player;
  const fk = settings.fov / FOV_BASE, adsFov = (def.adsFov || FOV_BASE) * fk;   // yaqinlashtirish darajasi tanlangan ko'rish burchagiga nisbatan saqlanadi
  const targetFov = lerp(settings.fov, def.scope ? (G.ads > 0.92 ? adsFov : lerp(settings.fov, 40 * fk, G.ads)) : adsFov, def.scope ? 1 : G.ads) * (P.sprinting ? 1.06 : 1);
  camera.fov = lerp(camera.fov, targetFov, Math.min(1, dt * 18));
  camera.updateProjectionMatrix();
  $('scope').style.display = sc ? 'block' : 'none';
  if (sc) {
    // nafas zaxirasi: [Shift] bosib turilganda optika tebranmaydi
    $('scopeBreath').style.width = Math.round((G.breath / 4) * 100) + '%';
    setText('scopeInfo', `${(FOV_BASE / def.adsFov).toFixed(1)}×  ·  SHIFT — nafasni ushlash`);
  }
  // mo'ljalga olganda ekran chetlari biroz qorayadi — diqqat nishonda
  const av = def.scope ? 0 : G.ads * 0.55;
  if (hudCache.adsVig !== av) { hudCache.adsVig = av; $('adsVig').style.opacity = av; }
}
