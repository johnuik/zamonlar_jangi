// Kiritish: klaviatura, sichqoncha, sichqonchani qulflash, pauza.
import { $, G, camera, canvas, clamp, keys, mouse, player, settings, sound } from './core.js';
import { knifeAttack, selectSlot, startReload, switchWeapon, throwGrenade } from './arsenal.js';
import { useStreak } from './game.js';
import { toggleTorch } from './zmode.js';
import { toggleCrouch, toggleProne, tryChute, tryVault } from './movement.js';
import { cycleSeat, cycleSeatGun, exitVehicle, interact, nearestVehicle, ownGunActive, requestSeat, toggleVehView, tryEnterVehicle } from './transport.js';
import { pickKey, show } from './menu.js';
import { useBandage } from './items.js';
import { chatOpen, doPing, openChat } from './social.js';
import { endDrone } from './drone.js';
import { toggleBigMap } from './hud.js';

export let locked = false; export function setLocked(v) { locked = v; }

export function requestLock() {
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* e'tiborsiz */ }
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) {
    if (G.state === 'paused') { G.state = 'playing'; $('pause').classList.add('hidden'); }
  } else if (G.state === 'playing' && (player.alive || G.mp)) pauseGame();
});
export function pauseGame() {
  G.state = 'paused';
  mouse.L = mouse.R = false;
  for (const k in keys) keys[k] = false;
  $('pauseTitle').textContent = G.mp ? 'PAUZA · jang davom etmoqda!' : 'PAUZA';
  $('btnResume').textContent = 'Davom etish';
  show('pause');
}

// ---------- Kiritish ----------
addEventListener('keydown', (e) => {
  if (chatOpen()) return;   // chat yozilayotganda tugmalar o'yinga o'tmaydi
  if (e.code === 'KeyT' && G.mp && !e.repeat && !G.pick && (G.state === 'playing' || G.state === 'paused')) { e.preventDefault(); openChat(); return; }
  // harakat tugmalari faqat jang paytida qabul qilinadi (tarmoqda pauza yoki klass tanlash oynasi ochiq bo'lsa o'yin fonda davom etadi — o'yinchi yurib ketmasin)
  if (G.state === 'playing' && !G.pick) keys[e.code] = true;
  if (G.pick && pickKey(e)) return;                       // klass tanlash oynasi (o'lik paytda ham ishlaydi)
  if (e.code === 'KeyM' && !e.repeat && G.bigMap && G.state === 'playing' && !player.alive) { toggleBigMap(false); return; }   // o'lik paytda ham ochiq xaritani yopsa bo'ladi
  if (G.state !== 'playing' || !player.alive) return;
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (G.droneCtl) { if (e.code === 'KeyF' && !e.repeat) endDrone('quit'); else if (e.code === 'KeyM' && !e.repeat) toggleBigMap(); return; }   // dron boshqaruvi: [F] — tashlab chiqish, qolgan tugmalar — uchish
  if (G.inVeh) {
    if (e.code === 'KeyF' && !e.repeat) exitVehicle();
    else if (e.code === 'KeyQ' && !e.repeat) cycleSeat();                                    // keyingi bo'sh o'rin
    else if (e.code === 'KeyV' && !e.repeat) toggleVehView();                                // 1-shaxs / 3-shaxs ko'rinish
    else if (e.code === 'KeyR' && ownGunActive()) startReload();                             // o'z qurolini o'qlash
    else if (e.code === 'KeyL' && !e.repeat) toggleTorch();                                  // fonar
    else if (e.code === 'KeyH' && !e.repeat) useBandage();                                   // bint
    else if (e.code === 'KeyM' && !e.repeat) toggleBigMap();                                 // katta xarita
    else if (/^Digit[1-6]$/.test(e.code) && !e.repeat) requestSeat(+e.code.slice(5) - 1);   // aniq o'rin
    return;
  }
  switch (e.code) {
    case 'KeyR': startReload(); break;
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': if (!e.repeat) selectSlot(+e.code.slice(5) - 1); break;
    case 'KeyF': if (!e.repeat) tryEnterVehicle(); break;
    case 'KeyG': if (!e.repeat) throwGrenade(); break;
    case 'KeyV': knifeAttack('stab'); break;
    case 'KeyB': useStreak(); break;
    case 'KeyE': interact(); break;
    case 'KeyC': if (!e.repeat) toggleCrouch(); break;
    case 'KeyZ': if (!e.repeat) toggleProne(); break;
    case 'KeyL': if (!e.repeat) toggleTorch(); break;
    case 'KeyH': if (!e.repeat) useBandage(); break;
    case 'KeyX': if (!e.repeat) doPing(); break;
    case 'KeyM': if (!e.repeat) toggleBigMap(); break;
    case 'Space': if (e.repeat || !tryVault()) tryChute(); break;
    case 'KeyQ': if (!e.repeat && nearestVehicle()) { G.seatPick++; sound.ui(); } break;   // o'tirishdan oldin o'rin tanlash
  }
});
addEventListener('keyup', (e) => { if (!chatOpen()) keys[e.code] = false; });
canvas.addEventListener('mousedown', (e) => {
  if (G.state === 'playing' && !locked) { requestLock(); return; }
  if (e.button === 0) mouse.L = true;
  if (e.button === 2) mouse.R = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) { mouse.L = false; G.triggerHeld = false; } if (e.button === 2) mouse.R = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
  if (G.state !== 'playing' || !player.alive || G.droneCtl) return;
  if (G.inVeh) { cycleSeatGun(e.deltaY > 0 ? 1 : -1); return; }
  const n = G.weapons.length, dir = e.deltaY > 0 ? 1 : -1;
  let i = G.wi;
  for (let k = 0; k < n; k++) { i = (i + dir + n) % n; if (!G.weapons[i].locked && !(G.weapons[i].def.kind === 'throw' && G.grenades_n <= 0)) break; }   // bo'sh o'rin va tugagan granata o'tkazib yuboriladi
  switchWeapon(i);
});
addEventListener('mousemove', (e) => {
  if (!locked || G.state !== 'playing' || !player.alive) return;
  const s = settings.sens * 0.0021 * (camera.fov / settings.fov);
  player.yaw -= e.movementX * s;
  player.pitch = clamp(player.pitch - e.movementY * s, -1.5, 1.5);
  G.swayX = clamp(G.swayX + e.movementX * 0.00035, -0.04, 0.04);
  G.swayY = clamp(G.swayY + e.movementY * 0.00035, -0.04, 0.04);
});
