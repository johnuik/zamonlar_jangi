// O'yin jarayoni (yakka rejim): boshlash, to'lqinlar, mukofotlar, o'ldirish hodisalari, o'yinchiga zarar, yakun.
import * as THREE from '../lib/three.module.js';
import { endDrone } from './drone.js';
import { $, ALLY_NAMES, DIFFS, EYE_H, G, STREAKS, TOTAL_WAVES, clamp, mouse, player, rnd, sound } from './core.js';
import { addDmgIndicator, banner, buildSlots, clearOverlays, feed, hitmarker, popup, updateStreakHUD } from './hud.js';
import { cur, isGun, setupWeapons } from './arsenal.js';
import { explode } from './ordnance.js';
import { zApi } from './zmode.js';
import { armorMul, damageVehicle, setupExtras, stopEngines } from './transport.js';
import { net } from './mp.js';
import { show } from './menu.js';
import { Soldier } from './soldier.js';
import { ZombieGame } from './zombie.js';
import { setupItems, setupLoot } from './items.js';
import { XP, addXp, level } from './progress.js';
import { ARMOR_ABSORB, WILD } from './shared.mjs';
import { setKillInfo } from './social.js';

// ---------- O'yinni boshlash ----------
export function startGame() {
  G.diff = DIFFS[G.diffIdx];
  G.time = 0; G.score = 0; G.kills = 0; G.headshots = 0; G.shots = 0; G.hits = 0;
  G.wave = 0; G.waveState = G.mp ? 'mp' : G.zombie ? 'zombie' : 'intermission'; G.waveTimer = 6; G.toSpawn = 0; G.spawnT = 0; G.maxAlive = 6;
  G.streak = 0; G.streakReady = []; G.uavT = 0; G.shake = 0; G.hurtPulse = 0; G.hbT = 0;
  G.supplyReady = !G.zombie; G.grenades_n = G.zombie ? 0 : 3; G.lastKillT = -9; G.multi = 0; G.flowT = 0; G.ambT = 5; G.dmgInds = [];
  G.lastEnemyNade = -99; G.lastEnemyRocket = -99; G.droneWarnT = -9; G.vEmptyT = -9; G.bannerT = 0; G.mpStreak = 0;   // (vaqt 0 dan boshlanadi — oldingi jangdan qolgan vaqt belgilari tozalanadi)
  const P = player;
  P.pos.copy(G.world.playerSpawn); P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = 0; P.hp = 100; P.alive = true;
  if (G.zombie) P.yaw = WILD.start.yaw;   // halokat joyida, qishloq tomonga qarab
  P.eyeH = EYE_H; P.deathT = 0; P.lastHurt = -99; P.crouch = false; P.prone = false;
  G.crouchToggle = false; G.proneToggle = false; G.vault = null; G.jumpLatch = false;
  // yakka o'yinda har jang yangi urug' (sinovlarda ?urug=0 — o'zgarmas); tarmoqda urug' serverdan keladi (mp.js)
  if (!G.mp) { const u = new URLSearchParams(location.search).get('urug'); G.lootSeed = G.seedNext || (u !== null ? +u | 0 : 1 + ((Math.random() * 1e9) | 0)); G.seedNext = 0; }   // (G.seedNext — sinov uchun: keyingi jang urug'i)
  setupWeapons(G.era);
  setupExtras(G.world.vehSpawns);
  setupItems(); setupLoot();
  G.xpGained = 0;
  G.world.updateFlow(P.pos.x, P.pos.z);
  if (!G.mp && !G.zombie) spawnAllies();
  G.zg = G.zombie ? new ZombieGame(zApi) : null; G.isZ = false;
  if (G.torch) { G.torchOn = true; G.torch.intensity = 0; }
  if (G.zg && G.zg.host) for (let i = 0; i < 2; i++) G.zg.spawnOne();
  $('killfeed').innerHTML = ''; $('popups').innerHTML = ''; $('dmgInd').innerHTML = '';
  $('hud').classList.remove('hidden');
  buildSlots(); updateStreakHUD();
  if (G.mp || G.zombie) $('streaks').innerHTML = '';
  $('mpBoard').style.display = $('flagStatus').style.display = G.mp ? 'block' : 'none';
  $('hud').classList.toggle('mp', !!G.mp);   // tarmoqda killfeed hisob jadvali ostiga tushadi
  G.state = 'playing';
  sound.init(); sound.startAmbient(G.era, G.night);
  if (G.zombie && !G.mp) banner('KARANTIN ZONASI', "Qishloqqa yeting (sariq ustun) · zombilar shovqin va harakatni sezadi — cho'kkalab [C] chetlab o'tsa bo'ladi · [M] — xarita", 8);
  else if (G.mp) banner(G.mpMode === 'dm' ? 'DEATHMATCH' : G.mpMode === 'tdm' ? 'JAMOAVIY JANG' : 'BAYROQ JANGI', G.mpMode === 'dm' ? `Birinchi bo'lib ${G.dmTarget} ta raqibni yo'q qiling!` : G.mpMode === 'tdm' ? `Raqib jamoadan ${G.tdmTarget} ta o'yinchini yo'q qiling — sherikka o'q tegmaydi` : 'Markazdagi bayroqni oling va ushlab turing!', 4);
  else banner(G.era === 'historical' ? 'QISHKI FRONT' : "CHO'L BO'RONI", 'Pozitsiyani egallang. Dushman yaqinlashmoqda...', 4);
}

export function spawnAllies() {
  const names = ALLY_NAMES[G.era];
  for (let i = 0; i < 2; i++) {
    const existing = G.soldiers.find((s) => s.team === 'ally' && s.name === names[i] && s.alive);
    if (existing) { existing.hp = existing.maxHp; continue; }
    const p = player.pos.clone().add(new THREE.Vector3(i === 0 ? -2 : 2, 0, 1.5));
    // o'yinchi tomda, vertolyotda yoki podvalda bo'lishi mumkin: sherik uning yonidagi yerga (havoga emas) qo'yiladi
    p.y = G.world.groundHeight(p.x, p.z, 0.3, p.y + 0.6);
    G.world.collideCircle(p, 0.42, p.y, p.y + 1.9);
    G.soldiers.push(new Soldier(G, 'ally', 'ally', p, names[i]));
  }
}

// ---------- Ketma-ket o'ldirish mukofotlari ----------
export function buildPlane(era, scale = 1) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: era === 'historical' ? 0x4c5538 : 0x6c7075, roughness: 0.6, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 9, 10), m); body.rotation.x = Math.PI / 2; g.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(era === 'historical' ? 13 : 10, 0.16, 2.2), m); wing.position.z = era === 'historical' ? 0.8 : -0.5; g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.7, 1.4), m); tail.position.set(0, 0.9, -4); g.add(tail);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, 1.1), m); stab.position.set(0, 0.2, -4); g.add(stab);
  if (era === 'historical') {
    const prop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.06), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    prop.position.z = 4.6; g.add(prop); g.userData.prop = prop;
  } else {
    const ck = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.2, metalness: 0.8 }));
    ck.position.set(0, 0.4, 2.2); ck.scale.set(0.8, 0.7, 2); g.add(ck);
  }
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  G.scene.add(g);
  return g;
}
export function useStreak() {
  if (!G.streakReady.length) return;
  const st = G.streakReady.shift();
  sound.ping();
  const enemies = G.soldiers.filter((s) => s.alive && s.team === 'enemy');
  if (st.id === 'recon') {
    G.uavT = 30;
    G.planes.push({ mesh: buildPlane(G.era, G.era === 'modern' ? 0.6 : 0.8), type: 'circle', t: 0, dur: 30 });
    banner(st.name.toUpperCase(), 'Dushman pozitsiyalari xaritada ko\'rinadi', 2.5);
  } else if (st.id === 'mortar') {
    const targets = enemies.slice().sort(() => Math.random() - 0.5).slice(0, 8);
    let i = 0;
    for (const e of targets) G.strikes.push({ pos: e.pos.clone().add(new THREE.Vector3(rnd(-1.5, 1.5), 0, rnd(-1.5, 1.5))), t: 1.6 + i++ * 0.35, wh: false, follow: e });
    while (i < 10) {
      const c = enemies.length ? enemies[(Math.random() * enemies.length) | 0].pos : player.pos.clone().add(new THREE.Vector3(rnd(-30, 30), 0, rnd(-30, 30)));
      G.strikes.push({ pos: c.clone().add(new THREE.Vector3(rnd(-6, 6), 0, rnd(-6, 6))), t: 1.6 + i++ * 0.35, wh: false });
    }
    banner(st.name.toUpperCase(), 'Zarba yo\'lda!', 2.5);
  } else if (st.id === 'bomber') {
    const c = new THREE.Vector3();
    if (enemies.length) { for (const e of enemies) c.add(e.pos); c.multiplyScalar(1 / enemies.length); }
    else c.set(rnd(-30, 30), 0, rnd(-30, 30));
    const a = Math.random() * Math.PI * 2, dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const from = c.clone().addScaledVector(dir, -110).setY(32), to = c.clone().addScaledVector(dir, 110).setY(32);
    const speed = 50;
    G.planes.push({ mesh: buildPlane(G.era, 1.2), type: 'line', from, to, t: 0, dur: 220 / speed });
    for (let k = -27; k <= 27; k += 4.5) {
      for (const side of [-3, 3]) {
        const p = c.clone().addScaledVector(dir, k).add(new THREE.Vector3(-dir.z * side, 0, dir.x * side));
        p.x = clamp(p.x, -G.world.half + 1, G.world.half - 1); p.z = clamp(p.z, -G.world.half + 1, G.world.half - 1);
        G.strikes.push({ pos: p, t: (110 + k) / speed + 0.9 + Math.random() * 0.15, wh: true, big: true });
      }
    }
    sound.flyby(G.era === 'modern');
    banner(st.name.toUpperCase(), 'Samolyot yaqinlashmoqda!', 2.5);
  }
  updateStreakHUD();
}
export function updateStrikes(dt) {
  for (let i = G.strikes.length - 1; i >= 0; i--) {
    const s = G.strikes[i];
    s.t -= dt;
    if (s.follow && s.follow.alive && s.t > 0.8) s.pos.copy(s.follow.pos);
    if (!s.wh && s.t < 1.0) { s.wh = true; sound.whistle(0, Math.max(0.3, s.t)); }
    if (s.t <= 0) {
      explode(s.pos, 'player', { friendly: true, radius: s.big ? 8 : 7.5, dmg: 400, kind: 'strike', scale: s.big ? 1.4 : 1.2 });
      G.strikes.splice(i, 1);
    }
  }
  for (let i = G.planes.length - 1; i >= 0; i--) {
    const p = G.planes[i];
    p.t += dt;
    if (p.mesh.userData.prop) p.mesh.userData.prop.rotation.z += dt * 40;
    if (p.type === 'circle') {
      const a = p.t * 0.22;
      p.mesh.position.set(Math.cos(a) * 48, 55, Math.sin(a) * 48);
      p.mesh.lookAt(Math.cos(a + 0.1) * 48, 55, Math.sin(a + 0.1) * 48);
      p.mesh.rotateZ(-0.35);
    } else {
      p.mesh.position.lerpVectors(p.from, p.to, p.t / p.dur);
      p.mesh.lookAt(p.to);
    }
    if (p.t >= p.dur) { G.scene.remove(p.mesh); G.planes.splice(i, 1); }
  }
}

// ---------- To'lqinlar ----------
export function pickType() {
  const w = G.wave, r = Math.random();
  if (w >= 4 && r < 0.06 + w * 0.012) return 'heavy';
  if (w >= 6 && r < 0.22) return 'sniper';
  if (w >= 5 && r < 0.32) return 'officer';
  if (w >= 2 && r < 0.55) return 'smg';
  return 'rifle';
}
export function spawnEnemy(type) {
  const P = player;
  let cand = G.world.spawns.filter((s) => s.distanceTo(P.pos) > 30 && G.world.reachable(s.x, s.z));
  if (!cand.length) cand = G.world.spawns.filter((s) => G.world.reachable(s.x, s.z));
  if (!cand.length) cand = G.world.spawns.slice().sort((a, b) => a.distanceTo(P.pos) - b.distanceTo(P.pos)).slice(0, 8);   // (katta xaritada — eng yaqin nuqtalar: 800 m naridan piyoda kelmaydi)
  cand.sort(() => Math.random() - 0.5);
  const eye = new THREE.Vector3(P.pos.x, P.pos.y + P.eyeH, P.pos.z);
  let pick = cand[0];
  for (const c of cand.slice(0, 6)) { if (!G.world.los(eye, new THREE.Vector3(c.x, 1.7, c.z))) { pick = c; break; } }
  const pos = pick.clone().add(new THREE.Vector3(rnd(-1.2, 1.2), 0, rnd(-1.2, 1.2)));
  G.world.collideCircle(pos, 0.42, 0, 1.9);
  G.soldiers.push(new Soldier(G, 'enemy', type, pos));
}
export function startWave() {
  G.wave++;
  G.toSpawn = 4 + G.wave * 2 + (G.wave === TOTAL_WAVES ? 6 : 0);
  G.maxAlive = Math.min(4 + G.wave, 12);
  G.waveState = 'fight'; G.spawnT = 0;
  for (const pk of G.pickups) if (pk.taken && !G.weapons.some((w) => w.pid === pk.id)) pk.taken = false;
  if (G.wave === TOTAL_WAVES) { spawnEnemy('heavy'); spawnEnemy('heavy'); spawnEnemy('officer'); }
  sound.horn();
  banner(`TO'LQIN ${G.wave}`, G.wave === TOTAL_WAVES ? "SO'NGGI HUJUM! Barcha kuchlar!" : 'Dushman hujum qilmoqda!', 3);
}
export function updateWaves(dt) {
  if (G.waveState === 'intermission') {
    G.waveTimer -= dt;
    if (G.waveTimer <= 0) startWave();
    return;
  }
  if (G.waveState !== 'fight') return;
  const alive = G.soldiers.filter((s) => s.alive && s.team === 'enemy').length;
  G.spawnT -= dt;
  if (G.toSpawn > 0 && alive < G.maxAlive && G.spawnT <= 0) {
    spawnEnemy(pickType()); G.toSpawn--; G.spawnT = rnd(0.6, 1.6);
  }
  if (G.toSpawn <= 0 && alive === 0) {
    const bonus = Math.round(500 * G.wave * G.diff.score);
    G.score += bonus;
    if (G.wave >= TOTAL_WAVES) { addXp(XP.wave); endGame(true); return; }
    addXp(XP.wave);
    G.waveState = 'intermission'; G.waveTimer = 12;
    G.supplyReady = true;
    G.grenades_n = Math.max(G.grenades_n, 3);
    spawnAllies();
    banner("TO'LQIN QAYTARILDI", `+${bonus} bonus · Keyingi hujumga tayyorlaning`, 3.5);
    sound.victory();
  }
}

// ---------- Hodisalar ----------
export function onSoldierKilled(s, attacker, info) {
  if (G.mp) {   // tarmoq (zombi rejimi): hisobni server yuritadi — xost faqat xabar beradi
    if (s.isZombie && G.zg && G.zg.host) net.send({ t: 'zdead', z: s.zid, by: attacker === 'player' ? G.myId : attacker && attacker.id ? attacker.id : 0, head: info.head ? 1 : 0 });
    return;
  }
  if (s.team === 'enemy') {
    if (attacker === 'player') {
      G.kills++;
      if (info.head) G.headshots++;
      let pts = 100;
      const extra = [];
      if (info.head) { pts += 50; extra.push(["BOSHGA O'Q", true]); }
      if (info.kind === 'knife') { pts += 75; extra.push(['PICHOQ', true]); }
      if (info.kind === 'grenade') { pts += 50; extra.push(['PORTLASH', false]); }
      if (G.time - G.lastKillT < 2.2) { G.multi++; pts += 50 * G.multi; extra.push([G.multi === 1 ? 'IKKI KARRA!' : G.multi === 2 ? 'UCH KARRA!' : 'QIRG\'IN!', true]); }
      else G.multi = 0;
      G.lastKillT = G.time;
      pts = Math.round(pts * G.diff.score);
      G.score += pts;
      popup(`+${pts}`);
      for (const [t, hs] of extra) popup(t, hs);
      addXp(s.isZombie ? XP.zombieKill : XP.botKill + (info.head ? XP.head : 0));
      if (info.kind !== 'bullet') hitmarker(true);
      sound.kill();
      const icon = { knife: '🔪', grenade: '💣', strike: '✈', rocket: '🚀', shell: '🚀', roadkill: '🚙' }[info.kind] || ((G.inVeh ? G.inVeh.T.name : cur().def.name) + (info.head ? ' ⦿' : ''));
      feed('Siz', 'me', s.name, 'en', icon);
      if (info.kind !== 'strike' && !G.zombie) {
        G.streak++;
        for (const st of STREAKS[G.era]) if (G.streak === st.k) {
          G.streakReady.push(st);
          banner(st.name.toUpperCase() + ' TAYYOR', '[B] tugmasini bosing', 2.5);
          sound.ping();
        }
        if (G.streak >= 10) G.streak = 0;
        updateStreakHUD();
      }
    } else if (attacker && attacker.team === 'ally') {
      feed(attacker.name, 'al', s.name, 'en', '⌖');
    } else feed('—', 'al', s.name, 'en', '✈');
  } else if (s.team === 'ally') {
    feed(attacker && attacker.name ? attacker.name : 'Dushman', 'en', s.name, 'al', '✖');
    popup(`${s.name} yaralandi!`, true);
  }
}

// direct — transportga yo'naltirilmaydigan shikast (masalan, balanddan yiqilish)
// Qalqon: o'q (dir — uchish yo'nalishi) stvol qaragan tomondan kelyaptimi?
export function shieldBlocks(v, dir) {
  const L = Math.hypot(dir.x, dir.z) || 1;
  return -(dir.x * Math.sin(v.aimYaw) + dir.z * Math.cos(v.aimYaw)) / L > Math.cos(v.T.shield);
}
export function damagePlayer(amount, from, src, direct) {
  const P = player;
  if (!P.alive || G.state !== 'playing') return;
  if (!G.mp && src && G.protUntil > G.time) return;   // (yakka o'yin: tiriltirilgandan keyingi qisqa himoya — zombi/dushman zarbasi o'tmaydi)
  // zenit pushkasi to'pchisi: olddan kelgan zarba qalqonga (pushkaga) tegadi, yon/orqadan — to'pchiga (qum qoplari biroz to'sadi)
  if (!direct && G.inVeh && G.inVeh.T.shield && from) {
    const v = G.inVeh;
    if (shieldBlocks(v, { x: v.pos.x - from.x, z: v.pos.z - from.z })) { damageVehicle(v, amount * (v.T.bulletMul ?? 1), 'enemy'); addDmgIndicator(from); return; }
    amount *= 0.75;
  }
  // Chinuk yuk bo'limida piyoda turgan o'yinchi ham korpus bilan himoyalangan
  if (!direct && !G.inVeh && G.insideVeh && G.insideVeh.alive) { damageVehicle(G.insideVeh, amount, 'enemy'); if (from) addDmgIndicator(from); return; }
  if (!direct && G.inVeh && G.inVeh.T.enclosed) {
    // Oyna/ochiq eshik oldida o'tirgan bo'lsak, o'qlarning bir qismi transportga emas, to'g'ridan-to'g'ri bizga tegadi
    const v = G.inVeh;
    let glass = false;
    if (from && v.T.zones && v.T.zones.some((z) => z[0] === G.seat)) {
      const dx = from.x - v.pos.x, dz = from.z - v.pos.z, L = Math.hypot(dx, dz) || 1;
      const front = (dx * Math.sin(v.yaw) + dz * Math.cos(v.yaw)) / L;
      glass = (v.T.roles[G.seat] === 'gunner' || front > 0.2) && Math.random() < 0.3;
    }
    if (!glass) { damageVehicle(v, amount * armorMul(v, from ? { x: v.pos.x - from.x, z: v.pos.z - from.z } : null, false), 'enemy'); if (from) addDmgIndicator(from); return; }
    amount *= 0.8;
  }
  // zirh nimcha zararning yarmini o'ziga oladi (tugaguncha)
  if (G.armor > 0 && !direct) { const a = Math.min(G.armor, amount * ARMOR_ABSORB); G.armor -= a; amount -= a; }
  P.hp -= amount; P.lastHurt = G.time;
  if (G.droneCtl && G.time - (G.droneWarnT || -9) > 2) { G.droneWarnT = G.time; popup("SIZGA O'Q TEGMOQDA! [F] — dronni tashlab chiqing", true); }
  hitPunch(amount);
  G.hurtPulse = Math.min(1, G.hurtPulse + amount / 35);
  G.shake = Math.max(G.shake, 0.22);
  sound.hurt();
  if (from) addDmgIndicator(from);
  if (P.hp <= 0) {
    P.hp = 0; P.alive = false; P.deathT = 0; sound.defeat(); mouse.L = mouse.R = false;
    if (src && src.pos) setKillInfo(src.name || 'Dushman', src.pos, { ref: src }); else G.killInfo = null;
  }
}

export function endGame(victory) {
  G.state = 'over';
  if (victory) addXp(XP.win);
  stopEngines(); endDrone('dead'); clearOverlays();   // (dron ovozi va ekran pardalari yakun oynasida qolmasin)
  if (document.pointerLockElement) document.exitPointerLock();
  $('hud').classList.add('hidden'); $('scope').style.display = 'none';
  const rec = JSON.parse(localStorage.getItem('zj_rec') || '{}');
  const isRec = !G.zombie && G.score > 0 && (!rec[G.era] || G.score > rec[G.era].score);
  if (isRec) { rec[G.era] = { score: G.score, wave: G.wave }; localStorage.setItem('zj_rec', JSON.stringify(rec)); }
  $('btnAgain').textContent = 'Qayta jang';
  $('endTitle').textContent = G.zombie ? (victory ? 'EVAKUATSIYA QILINDINGIZ!' : 'SIZ ZOMBIGA AYLANDINGIZ') : victory ? "G'ALABA!" : 'SIZ HALOK BO\'LDINGIZ';
  $('endTitle').style.color = victory ? '#ffcc55' : '#ff5b4b';
  $('endSub').textContent = G.zombie
    ? (victory ? "Vertolyot sizni olib ketdi. Tun ortda qoldi." : `"${G.zg ? G.zg.cur.name : ''}" bosqichida (${G.zg ? Math.min(G.zg.stage + 1, G.zg.stages.length) : 1}/${G.zg ? G.zg.stages.length : 5}) halok bo'ldingiz. Yana urinib ko'ring!`)
    : victory
    ? (G.era === 'historical' ? "Shaharcha ozod qilindi. Vzvodingiz qahramonlik ko'rsatdi!" : 'Operatsiya muvaffaqiyatli yakunlandi. Baza zararsizlantirildi!')
    : `To'lqin ${G.wave} da halok bo'ldingiz. Yana urinib ko'ring, askar!`;
  const acc = G.shots ? Math.round((G.hits / G.shots) * 100) : 0;
  const mm = Math.floor(G.time / 60), ss = Math.floor(G.time % 60).toString().padStart(2, '0');
  $('endStats').innerHTML = [
    ['Ochko', G.score + (isRec ? ' ★' : '')], G.zombie ? ['Bosqich', G.zg ? `${Math.min(G.zg.stage, G.zg.stages.length)}/${G.zg.stages.length}` : '0'] : ["To'lqin", `${G.wave}/${TOTAL_WAVES}`],
    ["O'ldirishlar", G.kills], ["Boshga o'qlar", G.headshots],
    ['Aniqlik', acc + '%'], ['Vaqt', `${mm}:${ss}`],
    ['Qiyinlik', G.diff.name], ['Davr', G.era === 'historical' ? '1944' : '2026'],
    ['Tajriba', `+${G.xpGained || 0} XP · daraja ${level()}`],
  ].map(([a, b]) => `<div>${a}<span>${b}</span></div>`).join('');
  show('end');
  if (victory) sound.victory();
}

// O'q tekkanda nishon siljiydi (zarba kuchiga qarab)
export function hitPunch(amount) {
  const k = Math.min(1, amount / 40);
  G.kickPitch += 0.035 * k * (0.6 + Math.random() * 0.8);
  player.yaw += (Math.random() - 0.5) * 0.03 * k;
}

export function useSupply() {
  if (G.zombie || !G.supplyReady || player.pos.distanceTo(G.world.supplyPos) > 2.8) return;   // zombi rejimida o'q-dori cheklangan
  for (const w of G.weapons) { if (isGun(w) && !w.def.special) w.reserve = w.def.reserve; }
  G.grenades_n = 4; G.bandages = Math.max(G.bandages || 0, 2);
  G.supplyReady = false;
  sound.reload('in');
  popup("O'Q-DORI TO'LDIRILDI");
}
