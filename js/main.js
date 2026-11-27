// ZAMONLAR JANGI — kirish nuqtasi: modullarni ulaydi, asosiy sikl, ishga tushirish.
import { $, G, GL_NAME, SOFT_GL, camera, dynRes, dynScale, keys, mouse, player, post, postLevel, renderFrame, renderer, rnd, setPostForce, settings, sound, wScene } from './core.js';
import { createScene, updateGunLight } from './scene.js';
import { banner, relToPlayer, updateHUD } from './hud.js';
import { hitscan, knifeAttack, selectSlot, switchWeapon, throwGrenade, tryFire, updateLock, updateWeapon } from './arsenal.js';
import { spawnGrenade, spawnProjectile } from './ordnance.js';
import { damagePlayer, onSoldierKilled, spawnEnemy, startGame, updateStrikes, updateWaves } from './game.js';
import { giveCrateWeapon, toggleTorch, updateTorch } from './zmode.js';
import { evacPhase, evacState, updateEvac } from './evac.js';
import { downedMates, fallenMates, updateRevive } from './revive.js';
import { setStance, toggleCrouch, toggleProne, tryVault, updateCamera, updatePlayer } from './movement.js';
import { specCamera } from './modes.js';
import { preloadChars } from './charskin.js';
import { preloadGuns } from './gunskin.js';
preloadChars();   // askar modellari menyu ochiq turganda yuklanadi
preloadGuns('modern'); preloadGuns('historical');   // qurol modellari ham (birinchi jangdayoq qo'lda bo'lishi uchun)
import { cycleSeatGun, damageVehicle, enterVehicle, exitVehicle, giveComeback, giveSpecial, interact, ownGunActive, toggleVehView, tryEnterVehicle, updateAvatar, updatePickups, updateVehicles, vehFP } from './transport.js';
import { mpError, mpUpdate, respawnMe } from './mp.js';
import { applyLoadout, openClassPick, pickConfirm, pickSelect, pickTick, selectEra, setClass, updateProgBox } from './menu.js';
import { setLocked } from './input.js';
import { animateSoldier } from './soldiermodel.js';
import './viewmodel.js';
import { applyItem, nearestLoot, seeded, setupLoot, tryLoot, updateItems, useBandage } from './items.js';
import { addXp, level, loadoutFor, onProgress, prog, setLoadout, toggleAttach, unlockName } from './progress.js';
import { doPing, openChat, updateSocial } from './social.js';
import { deployTurret, updateTurrets } from './turret.js';
import { endDrone, launchDrone, updateDrones } from './drone.js';
import { inSafe, updateZone } from './zone.js';

G.relToPlayer = relToPlayer;
G.damagePlayer = damagePlayer;
G.onSoldierKilled = onSoldierKilled;
G.spawnGrenade = spawnGrenade;
G.canEnemyGrenade = () => {
  if (G.time - (G.lastEnemyNade || -99) < 7) return false;
  G.lastEnemyNade = G.time; return true;
};

// ---------- Asosiy sikl ----------
function updateGame(dt) {
  G.time += dt;
  updateVehicles(dt);
  updatePlayer(dt);
  updateDrones(dt);
  updateCamera(dt);
  specCamera();   // jang maydoni: halok bo'lgan o'yinchi tiriklarni kuzatadi
  updateAvatar(dt);
  updateWeapon(dt);
  G.flowT -= dt;
  G.playerPit = G.world.pitAt(player.pos);
  if (G.flowT <= 0) {
    G.flowT = 0.3;
    const ft = G.playerPit >= 0 ? G.world.pits[G.playerPit].stairTop : player.pos;   // podvalda bo'lsa — zinapoya tomon
    if (G.zg) { const tg = G.zg.flowTargets(); if (tg.length) G.world.updateFlow(tg[0].x, tg[0].z, tg); }   // zombilar eng yaqin odam tomon yuradi
    else G.world.updateFlow(ft.x, ft.z);
  }
  for (const s of G.soldiers) s.update(dt);
  G.soldiers = G.soldiers.filter((s) => !s.remove);
  for (const g of G.grenades) g.update(dt);
  G.grenades = G.grenades.filter((g) => !g.dead);
  for (const pr of G.projectiles) pr.update(dt);
  G.projectiles = G.projectiles.filter((pr) => !pr.dead);
  updatePickups(dt);
  updateItems(dt);
  updateSocial(dt);
  updateTurrets(dt);
  updateLock(dt);
  updateZone(dt);
  if (G.chuteMesh) { G.chuteMesh.visible = G.chute && player.alive; G.chuteMesh.position.copy(player.pos); }
  updateStrikes(dt);
  if (G.uavT > 0) G.uavT -= dt;
  if (G.zg) G.zg.update(dt);
  if (G.mp) mpUpdate(dt); else if (!G.zombie) updateWaves(dt);
  updateEvac(dt);   // zombi rejimi yakuni: evakuatsiya vertolyoti va yakuniy "kino"
  updateRevive();   // tiriltirish punktlari va yerda yotgan sheriklar belgilari
  updateTorch(dt);
  G.ambT -= dt;
  if (G.ambT <= 0) { G.ambT = rnd(5, 14); if (!G.zombie) sound.distant(G.era); }
  if (G.state === 'playing' || G.state === 'over' || G.mp) updateHUD(dt);
}

function updateMenu(dt) {
  G.menuT += dt;
  const a = G.menuT * 0.05;
  camera.fov = 60; camera.updateProjectionMatrix();
  const k = G.world ? G.world.half / 70 : 1;   // katta xaritada kamera uzoqroqdan aylanadi
  camera.position.set(Math.cos(a) * 52 * k, (22 + Math.sin(G.menuT * 0.2) * 3) * k, Math.sin(a) * 52 * k);
  camera.lookAt(0, 3, 0);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  dynRes(dt);
  if (dt > 0.05) dt = 0.05;
  tick(dt);
}
function tick(dt) {
  if (G.pick) pickTick();
  if (G.state === 'playing' || (G.mp && G.state === 'paused')) updateGame(dt);
  else if (G.state === 'menu' || G.state === 'briefing') updateMenu(dt);
  if (G.world && (G.state !== 'paused' || G.mp)) {
    G.world.update(dt, performance.now() / 1000, G.fx, camera.position);
    G.fx.update(dt);
    { const f = G.world.flashF || 0, k = G.night ? 0.2 + f * 1.6 : 1; G.fx.setLight(k, k, G.night ? k * 1.1 : k); }   // tutun va chang atrof yorug'ligiga mos
    G.weather.update(dt, camera.position);
  }
  G.fx && G.fx.setScale(camera, renderer.domElement.height);
  updateGunLight(dt);
  renderFrame();
}

// Havola orqali kirish: ?kod=ABCD (&ism=Ali)
{
  const q = new URLSearchParams(location.search);
  const kod = (q.get('kod') || '').toUpperCase().slice(0, 4);
  if (kod) {
    $('mpCode').value = kod;
    if (q.get('ism')) $('mpName').value = q.get('ism').slice(0, 16);
    mpError($('mpName').value ? '' : "Ismingizni yozing va QO'SHILISH tugmasini bosing");
    if (q.get('ism')) setTimeout(() => $('btnJoin').click(), 300);
    else setTimeout(() => $('mpName').focus(), 300);
  }
}
// Tajriba: jang davomida yig'ilgan XP hisoblanadi; daraja oshsa — ekranda xabar va ochilgan narsalar
onProgress((n, up) => {
  G.xpGained = (G.xpGained || 0) + n;
  if (up) { banner(`DARAJA ${up.lvl}!`, up.unlocks.length ? 'Ochildi: ' + up.unlocks.map((u) => unlockName(u, G.era)).join(', ') + ' — klass tanlash oynasida' : 'Tabriklaymiz!', 4.5); sound.victory(); }
  updateProgBox();
});
// Ishga tushirish
selectEra('historical');
$('loading').classList.add('hidden');
requestAnimationFrame(frame);
window.__G = G;
window.__anim = animateSoldier;   // sinovlar uchun: askar pozasini qo'lda hisoblash
window.__dbg = { nearestLoot, seeded, setupLoot, tryLoot, respawnMe, inSafe, dyn: () => dynScale, post, postLevel, setPost: setPostForce, GL_NAME, SOFT_GL, wScene, keys, mouse, player, camera, renderer, tick, startGame, createScene, settings, enterVehicle, exitVehicle, tryEnterVehicle, giveSpecial, spawnProjectile, damageVehicle, switchWeapon, selectSlot, tryFire, interact, knifeAttack, throwGrenade,
  openClassPick, pickSelect, pickConfirm, setClass, applyLoadout, giveCrateWeapon, toggleTorch, damagePlayer, toggleVehView, vehFP, ownGunActive, cycleSeatGun, hitscan, spawnEnemy, spawnGrenade, setLocked,
  // yangi imkoniyatlar (sinovlar uchun)
  evac: evacState, evacPhase, revive: { downedMates, fallenMates },
  setStance, toggleProne, toggleCrouch, tryVault, useBandage, applyItem, deployTurret, giveComeback, doPing, openChat, launchDrone, endDrone, prog: { state: prog, addXp, level, setLoadout, toggleAttach, loadoutFor } };
