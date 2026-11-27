// Tarmoq rejimi (LAN): ulanish, lobbi, server xabarlari, qayta tug'ilish, bayroq, hisob jadvali.
import * as THREE from '../lib/three.module.js';
import { $, EYE_H, G, clamp, mouse, player, rnd, sound } from './core.js';
import { createScene } from './scene.js';
import { addDmgIndicator, addNoise, banner, buildSlots, clearOverlays, feed, hitmarker, popup, relToPlayer, setText, zObjective } from './hud.js';
import { cur, isGun } from './arsenal.js';
import { PROJ, spawnGrenade, spawnProjectile } from './ordnance.js';
import { hitPunch, startGame } from './game.js';
import { becomeZombie, onZombieDead, onZombieHit, onZombieState, sendZombieState, setZHost, zHumans } from './zmode.js';
import { boomVehicle, dropSpecial, enterVehicle, giveComeback, giveSpecial, leaveVehicleLocal, ownGunActive, stopEngines, vehicleStatusFx } from './transport.js';
import { applyLoadout, closePick, openClassPick, setClass, show, toMenu } from './menu.js';
import { requestLock } from './input.js';
import { Net } from './net.js';
import { RemotePlayer } from './soldier.js';
import { DEFIB_HP, GG_LADDER, MODES, SPAWN_PROT, WILD, Z_DOWN, Z_HP } from './shared.mjs';
import { brDrop, brInit, brOut, ggAmmo, ggName, ggSet, modeHUD, modeUpdate, onGG } from './modes.js';
import { onItemTaken, syncItems } from './items.js';
import { XP, addXp, level } from './progress.js';
import { addChat, onChat, onPing, setKillInfo } from './social.js';
import { aimRemoteTurret, dropOwnTurrets, onRemoteTurret, onTurretHit, removeTurretsOf } from './turret.js';
import { endDrone, onDroneKilled, onRemoteDrone } from './drone.js';
import { clearZone, inSafe, onZoneEvent, onZoneState, zoneSpawn } from './zone.js';
import { evacPhase, evacSync } from './evac.js';
import { becomeHuman, onMateRevived, tentFront } from './revive.js';

// ================= TARMOQ REJIMI (LAN) =================
export const net = new Net();
G.net = net;
export const remotes = new Map();
G.mp = false; G.myId = 0; G.mpFlag = { h: null, x: 0, z: 2 }; G.mpPlayers = []; G.mpRoom = null; G.mpTL = 0; G.netT = 0; G.mpMode = 'flag'; G.dmTarget = 15; G.vehSpawns = [];
export function esc(v) { return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
// Kimga o'q/zarba tegadi: odatda — dushman askarlar va raqib o'yinchilar; zombi rejimida (tarmoq) — faqat qarama-qarshi tomon
export function hostile(s) {
  if (G.mp && G.mpMode === 'zombie') return G.isZ ? s.team === 'remote' && !s.isZ : !!s.isZombie || (s.team === 'remote' && !!s.isZ);
  if (G.mp && G.teams && s.team === 'remote') return !G.myTeam || s.tm !== G.myTeam;   // jamoalar bor (jamoaviy jang; jang maydoni va gun game — tanlovga ko'ra): sheriklar — do'st
  return s.team === 'enemy' || s.team === 'remote';
}
G.hostile = hostile;   // soldier.js (ism belgisi) uchun
G.remoteById = (id) => remotes.get(id);   // hud.js (xaritada transport egasi) uchun
// O'ldirish xabarida ko'rsatiladigan qurol nomi
G.weaponName = (kind) => (kind === 'turret' ? 'Avtomatik turel' : kind === 'knife' ? 'Pichoq' : kind === 'claw' ? 'Panjalar' : kind === 'grenade' ? 'Granata' : kind === 'roadkill' ? (G.inVeh ? G.inVeh.T.name : 'Transport') : G.inVeh && !ownGunActive() ? G.inVeh.T.name : cur().def.name);
export function v3arr(v) { return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; }
export function arrV3(a) { return Array.isArray(a) && a.length === 3 && a.every(Number.isFinite) ? new THREE.Vector3(a[0], a[1], a[2]) : null; }
export function nameOf(id) {
  if (id === G.myId) return 'Siz';
  const r = remotes.get(id); if (r) return r.name;
  const p = G.mpRoom && G.mpRoom.players.find((x) => x.id === id);
  return p ? p.name : '?';
}
export function ensureRemote(id, name) {
  if (id === G.myId || !G.scene) return null;
  let r = remotes.get(id);
  if (!r) {
    r = new RemotePlayer(G, id, name || nameOf(id)); remotes.set(id, r); G.soldiers.push(r);
    if (G.mpMode === 'zombie') { r.isZ = false; r.setLook('ally', 'ally', '#7fd3ff'); }   // zombi rejimida boshqa odamlar — sheriklar
  }
  return r;
}
export function clearRemotes() {
  for (const r of remotes.values()) r.dispose();
  remotes.clear();
  G.soldiers = G.soldiers.filter((s) => s.team !== 'remote');
}

// --- Menyu ---
$('mpName').value = localStorage.getItem('zj_name') || '';
// Server eski kod bilan ishlayaptimi? (server.js yangilangan, lekin jarayon qayta ishga tushirilmagan)
// Bunday serverda tarmoq o'yini noto'g'ri ishlaydi — masalan, transport ro'yxati eski bo'ladi.
export const STALE_MSG = "Server eski kod bilan ishlayapti. Terminalda Ctrl+C bosing va ./start.sh ni qayta ishga tushiring, so'ng sahifani yangilang.";
export async function serverStale() {
  if (location.protocol === 'file:') return false;
  try { const i = await (await fetch('/api/info', { cache: 'no-store' })).json(); return i.build === undefined || !!i.stale; }
  catch (e) { return false; }
}
serverStale().then((st) => { if (st) $('mpErr').textContent = STALE_MSG; });
export function mpError(m) { $('mpErr').textContent = m; }
export async function mpConnect() {
  const name = $('mpName').value.trim();
  if (!name) { mpError('Avval ismingizni yozing'); $('mpName').focus(); return null; }
  localStorage.setItem('zj_name', name);
  sound.init();
  if (net.connected) return name;
  if (await serverStale()) { mpError(STALE_MSG); return null; }
  mpError('Ulanmoqda...');
  try { await net.connect(); } catch (e) {
    mpError(e.message === 'file' ? "O'yinni start.sh orqali oching — tarmoq uchun server kerak." : "Serverga ulanib bo'lmadi. start.sh ishlayotganini tekshiring.");
    return null;
  }
  mpError('');
  return name;
}
$('btnCreate').addEventListener('click', async () => { sound.ui(); const n = await mpConnect(); if (n) net.send({ t: 'create', name: n, era: G.era }); });
$('btnJoin').addEventListener('click', async () => {
  sound.ui();
  const code = $('mpCode').value.trim().toUpperCase();
  if (code.length !== 4) { mpError("Do'stingiz bergan 4 belgili kodni kiriting"); $('mpCode').focus(); return; }
  const n = await mpConnect();
  if (n) net.send({ t: 'join', name: n, code });
});
$('mpCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
$('mpName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnCreate').click(); });
$('btnLobbyStart').addEventListener('click', () => { sound.ui(); $('lobbyMsg').textContent = ''; net.send({ t: 'start' }); });
$('btnLobbyLeave').addEventListener('click', () => { sound.ui(); toMenu(); });
document.querySelectorAll('.lobbyEra').forEach((b) => b.addEventListener('click', () => { sound.ui(); net.send({ t: 'era', era: b.dataset.era }); }));
document.querySelectorAll('.lobbyMode').forEach((b) => b.addEventListener('click', () => {
  sound.ui(); net.send({ t: 'mode', mode: b.dataset.mode });
  // rejimga mos xarita: jang maydoni — katta xaritada, gun game — kichigida (xost keyin o'zgartirishi mumkin)
  const map = (G.mpRoom && G.mpRoom.map) || 'city';
  if (b.dataset.mode === 'br' && map !== 'wild' && map !== 'big') net.send({ t: 'map', map: 'wild' });
  if (b.dataset.mode === 'gg' && (map === 'wild' || map === 'big')) net.send({ t: 'map', map: 'town' });
}));
document.querySelectorAll('.lobbyTeams').forEach((b) => b.addEventListener('click', () => { sound.ui(); net.send({ t: 'teams', on: b.dataset.v === '1' ? 1 : 0 }); }));
document.querySelectorAll('.lobbyMap').forEach((b) => b.addEventListener('click', () => { sound.ui(); net.send({ t: 'map', map: b.dataset.map }); }));
document.querySelectorAll('.lobbyVeh').forEach((b) => b.addEventListener('click', () => { sound.ui(); net.send({ t: 'veh', on: b.dataset.v === '1' ? 1 : 0 }); }));
document.querySelectorAll('.lobbyZone').forEach((b) => b.addEventListener('click', () => { sound.ui(); net.send({ t: 'zone', on: b.dataset.v === '1' ? 1 : 0 }); }));
document.querySelectorAll('.lobbyTeam').forEach((b) => b.addEventListener('click', () => { sound.ui(); net.send({ t: 'team', tm: +b.dataset.tm }); }));   // jamoaviy rejim: o'z jamoasini tanlash

export function showLobby() {
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('pause').classList.add('hidden'); $('hud').classList.add('hidden');
  $('lobby').classList.remove('hidden');
  renderLobby();
  fetch('/api/info').then((r) => r.json()).then((info) => {
    const host = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const addrs = host ? info.ips.map((ip) => `http://${ip}:${info.port}`) : [location.origin];
    const code = G.mpRoom ? G.mpRoom.code : '';
    $('lobbyAddr').textContent = addrs.length ? "Do'stingiz brauzerda shu havolani ochsin: " + addrs.map((a) => `${a}/?kod=${code}`).join('  yoki  ') : '';
  }).catch(() => {});
}
export function renderLobby() {
  const o = G.mpRoom;
  if (!o) return;
  $('lobbyCode').textContent = o.code;
  const isHost = o.host === G.myId;
  document.querySelectorAll('.lobbyEra').forEach((b) => { b.classList.toggle('sel', b.dataset.era === o.era); b.disabled = !isHost; });
  document.querySelectorAll('.lobbyMode').forEach((b) => { b.classList.toggle('sel', b.dataset.mode === o.mode); b.disabled = !isHost; });
  document.querySelectorAll('.lobbyMap').forEach((b) => { b.classList.toggle('sel', b.dataset.map === (o.map || 'city')); b.disabled = !isHost || o.mode === 'zombie'; });   // zombi rejimi doim o'z xaritasida (karantin zonasi)
  document.querySelectorAll('.lobbyVeh').forEach((b) => { b.classList.toggle('sel', (b.dataset.v === '1') === (o.veh !== 0)); b.disabled = !isHost; });
  document.querySelectorAll('.lobbyZone').forEach((b) => { b.classList.toggle('sel', (b.dataset.v === '1') === ((o.zone !== 0 && o.mode !== 'zombie') || o.mode === 'br')); b.disabled = !isHost || o.mode === 'zombie' || o.mode === 'br'; });
  const solo = o.mode === 'br' || o.mode === 'gg';   // jamoa bo'lib yoki har kim o'zi uchun o'ynaladigan rejimlar
  $('lobbyTeamsRow').style.display = solo ? 'flex' : 'none';
  document.querySelectorAll('.lobbyTeams').forEach((b) => { b.classList.toggle('sel', (b.dataset.v === '1') === !!o.team); b.disabled = !isHost; });   // zombi rejimida zona yo'q
  $('lobbyRules').innerHTML = o.mode === 'br'
    ? "<b>Jang maydoni (PUBG uslubi):</b> hamma <b>qurolsiz</b>, parashyutda tushadi ([PROBEL] — ochish, W/A/S/D — boshqarish). Qurol, o'q-dori, <b>shlem</b>, zirh, pritsel, katta magazin, ovoz so'ndirgich, bint va aptechkalar <b>uylardan</b> topiladi: qurol — [E], qolganlari ustidan yurib o'tilganda olinadi. Zona bosqichma-bosqich torayib, oxirida butunlay yopiladi. <b>Qayta tug'ilish yo'q</b> — oxirgi tirik qolgan o'yinchi (yoki jamoa) g'olib; halok bo'lganlar tiriklarni kuzatadi. Katta xarita tavsiya etiladi (Karantin zonasi yoki Aerodrom)."
    : o.mode === 'gg'
    ? `<b>Gun game (arena):</b> hamma eng kuchli quroldan boshlaydi; har o'ldirishda keyingi, kuchsizroq qurol beriladi — jami <b>${GG_LADDER.length} daraja</b>, oxirgisi <b>pichoq</b>. Pichoq bilan o'ldirgan o'yinchi <b>g'olib</b>. Pichoq bilan o'ldirilgan raqib bir daraja pastga tushadi. O'q-dori cheksiz, qayta tug'ilish tez; granata va noyob qurollar yo'q. Kichik xarita tavsiya etiladi (Shaharcha).`
    : o.mode === 'zombie'
    ? "<b>Zombi rejimi — Karantin zonasi (800 × 800 m):</b> birinchi <b>4 o'yinchi</b> — odamlar, qolganlar zombi bo'lib qo'shiladi. Vazifa: qishloqqa yetish → fermadan, yoqilg'i shoxobchasidan va shaharchadan <b>uchta ratsiya qismini</b> topish → radio minorada signal yuborib, uni ushlab turish → harbiy bazaga borib, vertolyot maydonini himoya qilish. Shom tunga aylanadi, zombilar ko'payadi. Zombilar <b>ko'rish va shovqinga</b> qarab sezadi: cho'kkalab, otmasdan chetlab o'tsa bo'ladi. Boshida faqat to'pponcha va pichoq; qurol, o'q-dori va dori binolardan topiladi (o'q tanqis). Halok bo'lgan odam zombi bo'lib qaytadi. Hamma zombiga aylansa yoki 25 daqiqa o'tsa — zombilar yutadi."
    : o.mode === 'tdm'
    ? "<b>Jamoaviy jang:</b> pastda o'z jamoangizni tanlang (Qizil yoki Ko'k); tanlamaganlar kichikroq jamoaga qo'shiladi. Sherikka o'q tegmaydi; sheriklar xaritada va boshi ustidagi ko'k yozuv bilan uzoqdan, devor ortidan ham ko'rinib turadi. Birinchi bo'lib <b>30 ta</b> raqibni yo'q qilgan yoki 8 daqiqa tugaganda oldinda bo'lgan jamoa g'olib."
    : o.mode === 'dm'
    ? "<b>Deathmatch:</b> har kim o'zi uchun. Birinchi bo'lib <b>15 ta</b> raqibni o'ldirgan yoki 8 daqiqa tugaganda eng ko'p o'ldirgan o'yinchi g'olib. Har tug'ilishdan oldin klass tanlanadi. Ikki xil tank, hujumchi vertolyot, Chinuk, Kamaz, jip, kvadrotsikl, zenit pushkasi va podvallardagi noyob qurollardan foydalaning."
    : "<b>Bayroq:</b> markazdagi bayroqni oling va ushlab turing. <b>90 soniya</b> ushlagan yoki 8 daqiqa tugaganda eng ko'p ushlagan o'yinchi g'olib. O'ldirish +100, boshga +50, bayroq tashuvchini o'ldirish +50, bayroq har soniyada +10 ball. Bayroq bilan transportga o'tirib bo'lmaydi.";
  if (solo) $('lobbyRules').innerHTML += o.team ? " <b>Jamoa bo'lib:</b> pastda jamoangizni tanlang; sherikka o'q tegmaydi." : " <b>Har kim o'zi uchun.</b>";
  if (o.zone !== 0 && o.mode !== 'zombie' && o.mode !== 'br') $('lobbyRules').innerHTML += " <b>Zona:</b> xavfsiz doira bosqichma-bosqich torayadi — tashqarida qolgan o'yinchi jon yo'qotadi, shuning uchun hamma bir-biriga yaqinlashadi.";
  if (o.veh === 0) $('lobbyRules').innerHTML += ' <b>Transportsiz jang:</b> xaritada tank, vertolyot va mashinalar bo\'lmaydi — faqat piyoda.';
  if (o.mode !== 'zombie' && !solo) $('lobbyRules').innerHTML += " <b>Yordam:</b> hech kimni o'ldira olmay ketma-ket 3 marta halok bo'lgan o'yinchi keyingi tug'ilishda boshqariladigan dron, 5 marta — avtomatik turel oladi.";
  // jamoaviy rejim: har kim o'z jamoasini tanlaydi (tanlamaganlar jang boshlanganda kichikroq jamoaga tushadi)
  const tdm = o.mode === 'tdm' || (solo && !!o.team), mine = o.players.find((p) => p.id === G.myId), TN = ['avtomatik', 'QIZIL', "KO'K"];
  $('lobbyTeamRow').style.display = tdm ? 'flex' : 'none';
  document.querySelectorAll('.lobbyTeam').forEach((b) => b.classList.toggle('sel', !!mine && +b.dataset.tm === (mine.tm || 0)));
  $('lobbyPlayers').innerHTML = o.players.map((p) =>
    `<div class="${p.id === G.myId ? 'me' : ''}">${esc(p.name)}${p.id === o.host ? ' ★ xost' : ''}${p.id === G.myId ? ' (siz)' : ''}${tdm ? `<span class="tm tm${p.tm || 0}">${TN[p.tm || 0]}</span>` : ''}${p.gone ? ' — aloqa uzilgan' : ''}</div>`).join('');
  $('btnLobbyStart').style.display = isHost ? '' : 'none';
  $('lobbyMsg').textContent = isHost
    ? (o.players.length < 2 && o.mode !== 'zombie' ? "Do'stingiz kodni kiritib qo'shilishini kuting..." : 'Hamma tayyor! Jangni boshlang.')
    : 'Xost jangni boshlashini kuting...';
}

// --- Server xabarlari ---
// Aloqa uzilsa: darhol menyuga chiqarilmaydi — bir necha marta qayta ulanib ko'riladi (server o'yinchini 20 soniya saqlab turadi)
let rejoinT = null, rejoinN = 0;
export function rejoinStop() { clearTimeout(rejoinT); rejoinT = null; rejoinN = 0; $('netLost').classList.add('hidden'); }
function rejoinDone() { if (rejoinT !== null || rejoinN) { rejoinStop(); popup('Aloqa tiklandi'); } }
async function rejoinTry() {
  rejoinN++;
  $('netLostMsg').textContent = `Qayta ulanmoqda... (${rejoinN}/10)`;
  try { await net.connect(); net.send({ t: 'rejoin', code: G.myCode, id: G.myId, key: G.myKey }); rejoinT = null; }
  catch (e) { if (rejoinN >= 10) { rejoinStop(); toMenu(); mpError('Server bilan aloqa uzildi.'); } else rejoinT = setTimeout(rejoinTry, 1600); }
}
net.onclose = () => {
  if (!(G.mp || !$('lobby').classList.contains('hidden'))) return;
  if (!G.myKey || !G.myCode) { toMenu(); mpError('Server bilan aloqa uzildi.'); return; }
  if (rejoinT !== null) return;
  if (document.pointerLockElement) document.exitPointerLock();
  $('netLost').classList.remove('hidden'); rejoinN = 0;
  rejoinT = setTimeout(rejoinTry, 700);
};
net.onmsg = (o) => {
  switch (o.t) {
    case 'error': mpError(o.m); $('lobbyMsg').textContent = o.m; if (o.fatal) { rejoinStop(); toMenu(); mpError(o.m); } break;
    case 'joined': G.myId = o.id; G.myName = o.name; G.myKey = o.key; G.myCode = o.code; G.reJoined = !!o.re; rejoinDone(); showLobby(); break;
    case 'chat': onChat(o); break;
    case 'ping': if (G.mp) onPing(o); break;
    case 'away': if (G.mp) addChat('Tizim', `${o.name} aloqani yo'qotdi — 20 soniya kutiladi`, 'sys'); break;
    case 'back': if (G.mp) addChat('Tizim', `${o.name} qaytdi`, 'sys'); break;
    case 'lobby':
      G.mpRoom = o; renderLobby();
      // qayta ulandik, lekin jang biz yo'qligimizda tugab bo'lgan: jang holati tozalanadi (aks holda lobbi ostida o'yin davom etaverardi)
      if (G.reJoined) { G.reJoined = false; if (o.state !== 'playing' && G.mp) { leaveVehicleLocal(); stopEngines(); closePick(); dropOwnTurrets(); endDrone('dead'); clearOverlays(); clearZone(); G.mp = false; G.state = 'menu'; $('hud').classList.add('hidden'); $('scope').style.display = 'none'; $('pause').classList.add('hidden'); showLobby(); } }
      break;
    case 'start': mpStart(o); break;
    case 's': if (G.mp) mpState(o); break;
    case 'shot': if (G.mp) onRemoteShot(o); break;
    case 'nade': {
      const p = arrV3(o.p), v = arrV3(o.v);
      if (G.mp && p && v) spawnGrenade(p, v, 'remote', remotes.get(o.id), Number.isFinite(o.f) ? o.f : 0);
      break;
    }
    case 'hurt': if (G.mp) onHurt(o); break;
    case 'kill': if (G.mp) onKill(o); break;
    case 'respawn': if (G.mp) { if (o.id === G.myId) respawnMe(!!o.zb, o.bo | 0, o); else if (o.rv || o.cb) onMateRevived(o); } break;
    case 'zcall': if (G.mp) (G.tentCd || (G.tentCd = []))[o.i] = G.time + (o.cd || 40); break;   // tiriltirish punkti ratsiyasi band
    case 'gg': if (G.mp) onGG(o); break;
    case 'zs': if (G.mp) onZombieState(o.z); break;
    case 'zhit': if (G.mp) onZombieHit(o); break;
    case 'zdead': if (G.mp) onZombieDead(o); break;
    case 'zstage': if (G.mp && G.zg) { G.zg.setStage(o.st, true); if (o.by && o.by !== G.myId) popup(`${nameOf(o.by)} nuqtaga yetib keldi`); } break;
    case 'zpart': if (G.mp && G.zg) G.zg.onPart(o.i, o.by); break;
    case 'flash': if (G.mp && G.zg) G.zg.lightning(o.k || 1); break;
    case 'zevac': if (G.mp && G.zg) evacPhase(o.ph, o.d, o.ev); break;   // evakuatsiya bosqichi (server)
    case 'flag': if (G.mp) onFlag(o); break;
    case 'vseat': if (G.mp) enterVehicle(G.vehicles[o.v], o.seat, !!o.promoted); break;
    case 'vboom': if (G.mp) onVehicleBoom(o); break;
    case 'pick': if (G.mp) onPick(o); break;
    case 'item': if (G.mp) onItemTaken(o); break;
    case 'rocket': if (G.mp) onRemoteRocket(o); break;
    case 'turret': if (G.mp) onRemoteTurret(o); break;
    case 'drone': if (G.mp) onRemoteDrone(o); break;
    case 'dkill': if (G.mp) onDroneKilled(); break;
    case 'thit': if (G.mp) onTurretHit(o); break;
    case 'zone': if (G.mp) onZoneEvent(o); break;
    case 'left': {
      const r = remotes.get(o.id);
      if (r) { r.dispose(); remotes.delete(o.id); G.soldiers = G.soldiers.filter((s) => s !== r); }
      removeTurretsOf(o.id); onRemoteDrone({ id: o.id, off: 1 });
      if (G.mp) popup(`${o.name} jangni tark etdi`);
      break;
    }
    case 'end': if (G.mp) mpEnd(o); break;
  }
};

export function mpStart(o) {
  G.mp = true; G.era = o.era; G.mpHold = o.holdTarget; G.mpTL = o.matchTime;
  G.mpMode = MODES.includes(o.mode) ? o.mode : 'flag'; G.teams = !!o.teams; G.ggLv = 0; G.brOut = false; G.brDropping = false; G.helm = 0; G.dmTarget = o.dmTarget || 15; G.tdmTarget = o.tdmTarget || 30; G.vehSpawns = o.veh || [];
  G.myTeam = 0; G.mpTk = [0, 0]; G.lootSeed = o.seed | 0;   // xonalardagi qurollar tartibi (hamma o'yinchida bir xil)
  G.mpFlag = { h: null, x: o.base.x, z: o.base.z }; G.mpPlayers = [];
  $('lobby').classList.add('hidden'); $('end').classList.add('hidden'); $('menu').classList.add('hidden');
  clearRemotes();
  createScene(o.era, { map: o.map, night: o.mode === 'zombie', zombie: o.mode === 'zombie', veh: o.veh, noVeh: !!o.nv });
  startGame();
  if (G.mpMode === 'flag') createFlag();
  for (const p of (G.mpRoom && G.mpRoom.players) || []) ensureRemote(p.id, p.name);
  if (G.mpMode === 'zombie') {
    // zombi rejimi: klass tanlanmaydi; odamlar halokat joyida yonma-yon paydo bo'ladi (startGame joylagan), zombilar — birinchi holat kelganda ko'chiriladi
    const P = player; P.pos.x += rnd(-3, 3); P.pos.z += rnd(-3, 3); G.world.collideCircle(P.pos, 0.4, 0, 1.98);
    if (G.zg) { const zg = G.zg; zg.stage = o.zstage || 0; zg.got = zg.got.map((g, i) => !!((o.zpt || 0) & (1 << i))); zg.enter(); zg.dark = [0, 0.3, 0.55, 0.8, 1, 1][Math.min(5, zg.stage)]; if (o.zev) evacSync(o.zev); }   // (jang o'rtasida qo'shilgan o'yinchi ham joriy bosqich va qorong'ilikni ko'radi)
    G.state = 'paused';
    $('pauseTitle').textContent = 'ZOMBI REJIMI BOSHLANDI!'; $('btnResume').textContent = 'JANGGA KIRISH ▶';
    show('pause');
    return;
  }
  onZoneState(o.zn);   // jang o'rtasida qo'shilgan (yoki qayta ulangan) o'yinchi ham torayib bo'lgan zona ichida paydo bo'lishi uchun
  respawnMe();
  if (G.mpMode === 'gg' || G.mpMode === 'br') {
    // klass tanlanmaydi: gun game — daraja quroli; jang maydoni — qurolsiz, havodan tushiladi. Sichqonchani qulflash uchun bitta tugma bosiladi.
    closePick();
    if (G.mpMode === 'gg') { ggSet(0); banner('GUN GAME', `Har o'ldirish — keyingi qurol (${GG_LADDER.length} daraja). Oxirida pichoq bilan o'ldirgan g'olib!`, 5); }
    else { brInit(); brDrop(); banner('JANG MAYDONI', "Qurolsiz tushasiz — hammasini uylardan toping. Oxirgi tirik qolgan g'olib!", 6); }
    G.state = 'paused';
    $('pauseTitle').textContent = G.mpMode === 'gg' ? 'GUN GAME BOSHLANDI!' : 'JANG MAYDONI: SAKRASHGA TAYYORMISIZ?'; $('btnResume').textContent = G.mpMode === 'gg' ? 'JANGGA KIRISH ▶' : 'SAKRASH ▶';
    show('pause');
    return;
  }
  // jang boshlandi: avval klass tanlanadi (o'yin fonda davom etadi), so'ng sichqoncha qulflanadi
  G.state = 'paused';
  $('pause').classList.add('hidden');
  openClassPick('mpstart', () => { applyLoadout(); respawnAmmo(); G.state = 'playing'; requestLock(); });
}

export function mpState(o) {
  G.mpTL = o.tl; G.mpFlag = o.f; G.mpPlayers = o.p; if (o.tk) G.mpTk = o.tk;
  if (o.v) for (let i = 0; i < o.v.length && i < G.vehicles.length; i++) {
    const sv = o.v[i], v = G.vehicles[i];
    if (sv.al && !v.alive) v.respawn();
    else if (!sv.al && v.alive) boomVehicle(v);
    if (!v.alive) continue;
    const wasBurning = v.burning;
    v.hp = sv.hp; v.owner = sv.ow || null;
    if (!wasBurning && v.burning) vehicleStatusFx(v, 'burn');
    if (sv.tr !== undefined && sv.tr !== v.trackBroken) { const fresh = sv.tr & ~v.trackBroken; v.setTracks(sv.tr); if (fresh) vehicleStatusFx(v, 'track'); }
    for (let k = 0; k < v.seats.length; k++) v.seats[k] = (sv.s && sv.s[k]) || null;
    if (v.owner !== G.myId) v.setNet(sv);
  }
  if (o.pk) for (let i = 0; i < o.pk.length && i < G.pickups.length; i++) G.pickups[i].taken = !!o.pk[i];
  if (o.it) syncItems(o.it);
  onZoneState(o.zn);   // torayuvchi zona (bo'lmasa — tozalanadi)
  if (o.zm && G.zg) {   // zombi rejimi: bosqich, evakuatsiya sanog'i, zombilarni boshqaruvchi xost
    if (o.zm.st > G.zg.stage) G.zg.setStage(o.zm.st, false);
    G.zg.hold = o.zm.ho; setZHost(o.zm.host === G.myId);
    if (o.zm.ev) evacSync(o.zm.ev);   // (evakuatsiya xabari yo'qolgan bo'lsa ham holatdan tiklanadi)
    if (o.zm.pt) { let ch = false; G.zg.got.forEach((g, i) => { if (!g && (o.zm.pt & (1 << i))) { G.zg.got[i] = true; ch = true; } }); if (ch) G.zg.placeMarkers(); }   // (xabar yo'qolgan bo'lsa ham topilgan qismlar holatdan olinadi)
  }
  const seen = new Set();
  for (const p of o.p) {
    if (p.id === G.myId) {
      G.score = p.sc; G.mpStreak = p.st || 0; G.myTeam = p.tm || 0;
      if (G.mpMode === 'gg' && p.g !== undefined && p.g !== (G.ggLv | 0)) ggSet(p.g);   // (daraja xabari yo'qolgan bo'lsa ham holatdan olinadi)
      if (G.mpMode === 'br') { if (p.hl !== undefined || G.helm) G.helm = p.hl || 0; if (p.o && !G.brOut) { player.alive = false; player.hp = 0; brOut(0); } }   // kech qo'shilgan o'yinchi — kuzatuvchi
      if (p.zb && !G.isZ && G.zg) { becomeZombie(); G.zNeedSpot = !zombieSpot(); }
      if (player.alive && p.al) { player.hp = p.hp; G.armor = p.ar || 0; }
      if (G.inVeh && p.vh !== G.inVeh.id && G.time - G.enterT > 0.6) leaveVehicleLocal();
      else if (G.inVeh && p.vh === G.inVeh.id && p.se >= 0 && p.se !== G.seat && G.time - G.seatT > 0.6) enterVehicle(G.inVeh, p.se, p.se === 0);   // o'tkazib yuborilgan xabar
      continue;
    }
    seen.add(p.id);
    const r = ensureRemote(p.id);
    if (r) r.fl = !!p.fl;   // (zombi rejimi: odam bo'lib yiqilgan — ratsiya orqali chaqirsa bo'ladi)
    if (r && G.zg && !!p.zb !== !!r.isZ) { r.isZ = !!p.zb; if (r.isZ) r.setLook('enemy', 'zombie', '#ff6b5b'); else r.setLook('ally', 'ally', '#7fd3ff'); }
    // jamoaviy rejim: sherik — ittifoqchi ko'rinishida (ko'k yozuv), raqib — odatdagidek (qizil)
    if (r && G.teams && G.myTeam && p.tm && r.tmLook !== (p.tm === G.myTeam ? 1 : 2)) {
      r.tm = p.tm; r.tmLook = p.tm === G.myTeam ? 1 : 2;
      if (r.tmLook === 1) r.setLook('ally', 'ally', '#7fd3ff'); else r.setLook('remote', 'rifle', '#ff6b5b');
    }
    if (r) { r.streak = p.st || 0; r.setState(p, p.vh >= 0 ? G.vehicles[p.vh] : null); }
  }
  for (const [id, r] of remotes) if (!seen.has(id)) { r.dispose(); remotes.delete(id); G.soldiers = G.soldiers.filter((s) => s !== r); }
  if (G.isZ && G.zNeedSpot && zombieSpot()) G.zNeedSpot = false;   // jang boshida zombi bo'lib qo'shilgan o'yinchi odamlardan uzoqroqqa ko'chiriladi
}

export function onVehicleBoom(o) {
  const v = G.vehicles[o.v];
  if (!v) return;
  boomVehicle(v);
  if (o.by === G.myId) popup(`${v.T.name} yo'q qilindi!`, true);
}
export function onPick(o) {
  const pk = G.pickups[o.id];
  if (!pk) return;
  pk.taken = true;
  if (o.by === G.myId) giveSpecial(o.id);
  else popup(`${nameOf(o.by)} noyob qurolni oldi: ${pk.def.name}`, true);
}
export function onRemoteRocket(o) {
  const p = arrV3(o.p), v = arrV3(o.v);
  if (!p || !v) return;
  const sv = G.vehicles.find((x) => x.alive && x.seats.includes(o.id));
  // nishonni quvadigan raketa/dron: bizga yoki transportimizga qaratilgan bo'lsa — ogohlantirish
  let target = null;
  if (o.tg && Number.isInteger(o.tg.v) && G.vehicles[o.tg.v]) { target = { veh: G.vehicles[o.tg.v] }; if (G.inVeh === target.veh) { popup('RAKETA SIZGA QULFLANGAN!', true); sound.alarm(); } }
  const sr = remotes.get(o.id), foe = !sr || hostile(sr);
  spawnProjectile(p, v, PROJ[o.k] ? o.k : 'rocket', foe ? 'remote' : 'mate', sv ? sv.box : null, true, target);   // sherikning raketasi bizga "tegmaydi" (faqat ko'rinish)
  if (foe) addNoise(p, 'shot');
  const rp = relToPlayer(p);
  sound.shot(PROJ[o.k] && PROJ[o.k].kind === 'shell' ? 'cannon' : o.k === 'gl' || o.k === 'dbomb' ? 'gl' : 'rocket', rp.dist, rp.pan, true);
  G.fx.muzzle(p, 1.6);
}

export function onRemoteShot(o) {
  const A = arrV3(o.a), B = arrV3(o.b);
  if (!A || !B) return;
  const r = remotes.get(o.id);
  aimRemoteTurret(o.id, A, B);
  const quiet = o.s === 'supp';   // so'ndirgich: o'q uzgan o'yinchi xaritada ko'rinmaydi, alanga kichik
  if (r) { r.gunKick = 1; if (!quiet) r.lastFired = G.time; }
  if (!quiet && (!r || hostile(r))) addNoise(A, 'shot');   // so'ndirgichsiz o'q uzilgan joy xaritada ko'rinadi
  if (G.zg) G.zNoise(A.x, A.z, quiet ? 16 : 66);   // (zombilarni boshqaruvchi kompyuterda: boshqa o'yinchining o'qini ham zombilar eshitadi)
  G.fx.muzzle(A, quiet ? 0.35 : 1);
  G.fx.tracer(A, B, 0xff9a70); G.world.breakGlass(A, B);
  const rp = relToPlayer(A);
  sound.shot(o.s, rp.dist, rp.pan, true);
  const dir = B.clone().sub(A); const L = dir.length();
  if (L < 0.1) return;
  dir.multiplyScalar(1 / L);
  const wh = G.world.rayCast(A, dir, L + 0.3);
  if (wh && wh.dist > L - 0.6) { G.fx.impact(wh.point, wh.normal, wh.ground ? 'ground' : 'wall'); if (!wh.ground && !(wh.box && wh.box.vehicle)) G.fx.decal(wh.point, wh.normal); }
  // yonidan o'tgan o'q ovozi
  if (player.alive) {
    const eye = new THREE.Vector3(player.pos.x, player.pos.y + player.eyeH, player.pos.z);
    const t = clamp(eye.clone().sub(A).dot(dir), 0, L);
    const d = A.clone().addScaledVector(dir, t).distanceTo(eye);
    if (d < 2.5 && d > 0.4) sound.whiz();
  }
}

export function onHurt(o) {
  const P = player;
  if (!P.alive) return;
  if (o.hl !== undefined) { if (!o.hl && G.helm) popup('SHLEM SINDI', true); G.helm = o.hl; }   // shlem zarbani oldi (qolmagan bo'lsa — sindi)
  const dmg = Math.max(0, P.hp - o.hp);
  P.hp = o.hp; P.lastHurt = G.time;
  if (dmg > 0 && G.droneCtl && G.time - (G.droneWarnT || -9) > 2) { G.droneWarnT = G.time; popup("SIZGA O'Q TEGMOQDA! [F] — dronni tashlab chiqing", true); }
  hitPunch(dmg);
  G.hurtPulse = Math.min(1, G.hurtPulse + dmg / 35);
  G.shake = Math.max(G.shake, 0.22);
  sound.hurt();
  if (Number.isFinite(o.fx) && Number.isFinite(o.fz)) addDmgIndicator(new THREE.Vector3(o.fx, 0, o.fz));
}

export function onKill(o) {
  removeTurretsOf(o.victim);   // egasi halok bo'lgan turel o'chadi
  const kn = o.killer ? nameOf(o.killer) : '', vn = nameOf(o.victim);
  const icon = { knife: '🔪', claw: '☣', zombie: '☣', grenade: '💣', rocket: '🚀', shell: '🚀', vehicle: '💥', roadkill: '🚙', fall: '⤓', zone: '◯' }[o.kind] || (o.head ? '⦿' : '⌖');
  if (o.kind === 'zombie') feed('Zombi', 'en', vn, o.victim === G.myId ? 'me' : 'al', '☣');
  else if (o.killer) feed(kn, feedCls(o.killer), vn, feedCls(o.victim), icon);
  else feed(vn, o.victim === G.myId ? 'me' : 'en', o.kind === 'fall' ? 'balanddan yiqildi' : o.kind === 'zone' ? 'zonadan tashqarida qoldi' : "halok bo'ldi", 'ic', o.kind === 'fall' ? '⤓' : o.kind === 'zone' ? '◯' : '💥');
  if (o.killer === G.myId) {
    G.kills++; if (o.head) G.headshots++;
    popup(o.head ? '+150' : '+100');
    if (o.head) popup("BOSHGA O'Q", true);
    addXp(XP.kill + (o.head ? XP.head : 0));
    hitmarker(true); sound.kill();
  }
  { const vr = remotes.get(o.victim); if (vr && G.mpMode === 'zombie' && !vr.isZ) { vr.downAt = G.time; vr.downPos = vr.pos.clone(); } }   // (yerda yotgan sherik — defibrillyator bilan tiriltirsa bo'ladi)
  if (o.victim === G.myId) {
    const P = player;
    if (G.mpMode === 'zombie' && !G.isZ) { G.defib = 0; buildSlots(); }   // (defibrillyator yiqilgan odamda qolmaydi)
    leaveVehicleLocal(); G.chute = false; G.platform = null; G.insideVeh = null; G.vault = null;
    P.alive = false; P.deathT = 0; P.hp = 0;
    { const kr = o.killer ? remotes.get(o.killer) : null; if (kr) setKillInfo(kr.name, kr.pos, { ref: kr, weapon: o.wn, head: o.head, hp: o.khp }); else G.killInfo = null; }
    mouse.L = mouse.R = false;
    sound.hurt();
    const why = kn ? kn + " sizni o'ldirdi" : o.kind === 'fall' ? 'Balanddan yiqildingiz' : o.kind === 'zone' ? 'Zonadan tashqarida qoldingiz' : 'Transport halokati';
    if (G.mpMode === 'br') brOut(o.killer, why);
    else if (G.mpMode === 'gg') banner("HALOK BO'LDINGIZ", `${why} · tez orada qayta tug'ilasiz`, 2.2);
    else if (G.mpMode === 'zombie') banner(G.isZ ? "YO'Q QILINDINGIZ" : 'SIZNI YUQTIRISHDI', G.isZ ? '4 soniyada yana zombi bo\'lib qaytasiz' : `${Z_DOWN} soniya ichida sherigingiz defibrillyator bilan tiriltirishi mumkin — aks holda ZOMBI bo'lib qaytasiz`, 4.5);
    else {
      banner("HALOK BO'LDINGIZ", `${kn ? kn + " sizni o'ldirdi" : o.kind === 'fall' ? 'Balanddan yiqildingiz' : o.kind === 'zone' ? 'Zonadan tashqarida qoldingiz' : 'Transport halokati'} · 4 soniyada qayta tug'ilasiz`, 3.5);
      openClassPick('respawn');   // kutish o'rniga shu 4 soniyada klass tanlanadi
    }
  }
}

// O'ldirishlar ro'yxatidagi rang: o'zimiz — ko'k, sherik — yashil, raqib — qizil
function feedCls(id) {
  if (id === G.myId) return 'me';
  if (!G.teams) return 'en';
  const p = G.mpPlayers.find((x) => x.id === id);
  return p && p.tm === G.myTeam ? 'al' : 'en';
}
export function onFlag(o) {
  if (o.ev === 'take') {
    if (o.id === G.myId) { banner('BAYROQ SIZDA!', 'Uni iloji boricha uzoq ushlab turing', 2.5); sound.ping(); }
    else { popup(`${nameOf(o.id)} bayroqni oldi!`, true); sound.horn(); }
  } else if (o.ev === 'drop') popup('Bayroq yerga tushdi!', true);
  else if (o.ev === 'return') popup('Bayroq markazga qaytdi');
}

export function respawnAmmo() {
  for (const w of G.weapons) if (isGun(w)) { w.mag = w.def.mag; w.reserve = w.def.reserve; }
  G.grenades_n = 2; G.bandages = 2; G.armor = 0; G.adrT = 0; G.healT = 0; G.cookT = -1; G.supplyReady = true; G.reloadT = 0; G.switchT = 0.45; G.knifeT = 0; G.throwT = 0;
  G.recoilAcc = 0; G.kickPitch = 0; G.ads = 0;
  buildSlots();
}
// Zombi-o'yinchi odamlardan uzoqroqda (qorong'ida) paydo bo'ladi
export function zombieSpot() {
  const P = player, W = G.world, hs = zHumans().filter((h) => h.alive && !h.me);
  for (let i = 0; i < 30 && hs.length; i++) {
    const h = hs[(Math.random() * hs.length) | 0], a = Math.random() * Math.PI * 2, d = rnd(38, 52), x = h.pos.x + Math.cos(a) * d, z = h.pos.z + Math.sin(a) * d;
    if (Math.abs(x) > W.half - 3 || Math.abs(z) > W.half - 3 || W.pitIndexXZ(x, z) >= 0 || !W.reachable(x, z)) continue;
    if (hs.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < 32)) continue;
    P.pos.set(x, 0, z); P.vel.set(0, 0, 0); P.yaw = Math.atan2(-(h.pos.x - x), -(h.pos.z - z)); P.pitch = 0;
    return true;
  }
  return false;
}
// zb — zombi bo'lib qaytish; bonus — yutqazayotgan o'yinchiga beriladigan kuchli qurol darajasi (0 — yo'q)
// o (zombi rejimi) — server xabari: rv — defibrillyator bilan tiriltirgan sherik (x, y, z — yiqilgan joy); cb — ratsiya orqali chaqirgan sherik (ri — chodir)
export function respawnMe(zb, bonus = 0, o = null) {
  const P = player;
  leaveVehicleLocal(); dropSpecial(false); G.chute = false; G.platform = null; G.insideVeh = null;
  if (G.mpMode === 'zombie') {   // zombi rejimi: halok bo'lgan odam zombi bo'lib qaytadi (yoki sheriklari uni tiriltiradi)
    if (zb) becomeZombie(); else if (G.isZ) becomeHuman();   // (ratsiya orqali chaqirildi — yana odam)
    const tent = o && o.cb && G.world.revivePts ? G.world.revivePts[o.ri | 0] : null;
    if (tent) { tentFront(tent, P.pos); P.vel.set(0, 0, 0); G.world.collideCircle(P.pos, 0.4, 0, 1.98); P.yaw = tent.yaw + Math.PI; }
    else if (o && o.rv && Number.isFinite(o.x) && Number.isFinite(o.z)) { P.pos.set(o.x, Number.isFinite(o.y) ? o.y : 0, o.z); P.vel.set(0, 0, 0); }
    else if (!(G.isZ && zombieSpot())) { const sp = G.world.spawns[(Math.random() * G.world.spawns.length) | 0]; P.pos.copy(sp); P.vel.set(0, 0, 0); G.world.collideCircle(P.pos, 0.4, 0, 1.98); }
    if (o && o.rv) banner('TIRILTIRILDINGIZ!', `${nameOf(o.rv)} sizni defibrillyator bilan qutqardi`, 4);
    else if (tent) banner('YANA ODAMSIZ!', `${nameOf(o.cb)} sizni ratsiya orqali tiriltirish punktiga (${tent.name}) chaqirdi`, 5);
    P.hp = G.isZ ? Z_HP : o && o.rv ? DEFIB_HP : 100; P.alive = true; P.deathT = 0; P.lastHurt = -99; P.eyeH = EYE_H; G.crouchToggle = false; G.proneToggle = false; G.vault = null; G.knifeT = 0; G.switchT = 0.4; G.netT = 0;
    return;
  }
  // o'lik paytda tanlangan klass shu yerda kuchga kiradi
  if (G.pick && G.pick.mode === 'respawn') { const sel = G.pick.sel; closePick(); if (setClass(sel)) applyLoadout(); }
  const others = [...remotes.values()].filter((r) => r.alive && r.hasPos && hostile(r));
  let best = null, bestScore = -1;
  for (const sp of G.world.spawns) {
    let md = 999;
    for (const r of others) md = Math.min(md, r.pos.distanceTo(sp));
    const score = md + Math.random() * 12;
    if (score > bestScore) { bestScore = score; best = sp; }
  }
  // zona bo'lsa — faqat XAVFSIZ joyda tug'ilamiz: hozirgi doira va (yana torayadigan bo'lsa) keyingi oq doira ichida.
  // Tayyor nuqtalardan raqiblardan eng uzog'i olinadi; ular tashqarida qolgan bo'lsa — doira ichidan bo'sh joy tanlanadi.
  if (G.zone) {
    let zb = null, zs = -1;
    for (const sp of G.world.spawns) {
      if (!inSafe(sp.x, sp.z, 6)) continue;
      let md = 999; for (const r of others) md = Math.min(md, r.pos.distanceTo(sp));
      const sc = Math.min(md, 80) + Math.random() * 12;
      if (sc > zs) { zs = sc; zb = sp; }
    }
    best = zb || zoneSpawn(others);
  }
  P.pos.copy(best || G.world.playerSpawn);
  G.world.collideCircle(P.pos, 0.4, 0, 1.98);
  if (G.zone && !inSafe(P.pos.x, P.pos.z, 1)) { P.pos.copy(zoneSpawn(others)); G.world.collideCircle(P.pos, 0.4, 0, 1.98); }   // (to'siqdan itarilib chiqib ketgan bo'lsa)
  P.vel.set(0, 0, 0);
  P.yaw = Math.atan2(P.pos.x, P.pos.z); P.pitch = 0;
  P.hp = 100; P.alive = true; P.deathT = 0; P.lastHurt = -99; P.eyeH = EYE_H;
  G.crouchToggle = false; G.proneToggle = false; G.vault = null;
  respawnAmmo();
  if (G.mpMode === 'gg') ggAmmo();
  if (bonus > 0) giveComeback(bonus);
  G.netT = 0;
  // tug'ilishdagi himoya (server ham shuni hisoblaydi): bir necha soniya jon ketmaydi; o'q uzsangiz — tugaydi
  if (G.mpMode !== 'br') { G.protUntil = G.time + SPAWN_PROT; popup(`HIMOYA: ${SPAWN_PROT} soniya jon ketmaydi (o'q uzsangiz — tugaydi)`); }
}

export function mpUpdate(dt) {
  modeUpdate(dt);
  G.netT -= dt;
  if (G.netT <= 0 && player.alive) {
    G.netT = 0.05;
    const P = player;
    net.send({ t: 'p', x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yw: +P.yaw.toFixed(3), pt: +P.pitch.toFixed(3), cr: P.prone ? 2 : P.crouch ? 1 : 0, w: G.wi, ch: G.chute ? 1 : 0,
      iv: G.insideVeh ? G.insideVeh.id : G.platform ? G.platform.id : -1 });   // iv — yuk bo'limida piyoda turgan transport
  }
  if (G.zg && G.zg.host) { G.zg.syncT -= dt; if (G.zg.syncT <= 0) { G.zg.syncT = 0.12; sendZombieState(); } }   // xost: zombilar holatini uzatadi
  updateFlagVisual(dt);
}

// --- Bayroq ---
export function flagTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 84;
  const g = c.getContext('2d');
  g.fillStyle = '#f2b320'; g.fillRect(0, 0, 128, 84);
  g.fillStyle = '#c8321e'; g.fillRect(0, 0, 128, 14); g.fillRect(0, 70, 128, 14);
  g.fillStyle = '#1c1c1c'; g.beginPath(); g.arc(64, 42, 20, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2b320'; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⚔', 64, 43);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function createFlag() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.8, 8), new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.8, roughness: 0.3 }));
  pole.position.y = 1.4; pole.castShadow = true; g.add(pole);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffcc33, metalness: 0.9, roughness: 0.2 }));
  top.position.y = 2.83; g.add(top);
  const cg = new THREE.PlaneGeometry(1.3, 0.85, 14, 6); cg.translate(0.65, 0, 0);
  const cloth = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.85 }));
  cloth.position.y = 2.33; cloth.castShadow = true; g.add(cloth);
  const mc = document.createElement('canvas'); mc.width = 256; mc.height = 64;
  const mg = mc.getContext('2d'); mg.font = 'bold 30px Arial'; mg.textAlign = 'center';
  mg.fillStyle = 'rgba(0,0,0,0.6)'; mg.fillText('⚑ BAYROQ', 129, 42); mg.fillStyle = '#ffcc33'; mg.fillText('⚑ BAYROQ', 128, 40);
  const mt = new THREE.CanvasTexture(mc); mt.colorSpace = THREE.SRGBColorSpace;
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, depthTest: false, transparent: true, fog: false }));
  marker.scale.set(2, 0.5, 1); marker.position.y = 3.4; marker.renderOrder = 999; g.add(marker);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.8, 40), new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  G.scene.add(g); G.scene.add(beam); G.scene.add(ring);
  G.flag = { g, cloth, beam, ring, marker, orig: cg.attributes.position.array.slice() };
}
export function updateFlagVisual() {
  const F = G.flag, f = G.mpFlag;
  if (!F || !f) return;
  const mine = f.h === G.myId;
  let x = f.x, z = f.z, y = 0, carried = false;
  if (f.h && !mine) {
    const r = remotes.get(f.h);
    if (r) {
      carried = true;
      x = r.pos.x - Math.sin(r.yaw) * 0.25; z = r.pos.z - Math.cos(r.yaw) * 0.25; y = r.pos.y + 0.5 - r.crouchAmt * 0.4;
    }
  }
  F.g.visible = !mine;
  F.g.position.set(x, y, z);
  F.g.scale.setScalar(carried ? 0.65 : 1);
  F.beam.visible = F.ring.visible = !f.h;
  F.beam.position.set(x, 30, z);
  F.ring.position.set(x, 0.04, z);
  F.ring.material.opacity = 0.45 + Math.sin(G.time * 4) * 0.2;
  const pos = F.cloth.geometry.attributes.position, a = pos.array, o = F.orig;
  for (let i = 0; i < a.length; i += 3) a[i + 2] = o[i + 2] + Math.sin(o[i] * 5 - G.time * 7) * 0.09 * o[i];
  pos.needsUpdate = true;
}

// --- HUD ---
export let boardT = 0;
// Zombi rejimi (tarmoq): odamga — keyingi punkt, zombiga — ov; tepada kim tirik qolgani
export function updateZombieMpHUD(dt) {
  const tl = Math.max(0, G.mpTL || 0), z = G.zg, tp = z.target, P = player;
  setText('waveLabel', 'ZOMBI REJIMI');
  setText('enemyLabel', `Vaqt: ${Math.floor(tl / 60)}:${Math.floor(tl % 60).toString().padStart(2, '0')}`);
  setText('scoreLabel', String(Math.round(G.score || 0)));
  const hum = G.mpPlayers.filter((p) => !p.zb), alive = hum.filter((p) => p.al).length, zp = G.mpPlayers.length - hum.length;
  const d = Math.round(Math.hypot(tp.x - P.pos.x, tp.z - P.pos.z));
  setText('objective', !P.alive ? "Qayta tug'ilishni kuting..." : G.isZ ? "Odamlarni toping va yuqtiring! Ular xaritada ko'k nuqta bilan ko'rsatilgan." : zObjective(d));
  setText('flagStatus', `☣ Bosqich ${Math.min(z.stage + 1, z.stages.length)}/${z.stages.length}: ${z.cur.name} · odamlar: ${alive}/${hum.length} · zombi-o'yinchilar: ${zp}`);
  $('flagStatus').className = G.isZ ? 'enemy' : '';
  boardT -= dt;
  if (boardT <= 0) {
    boardT = 0.25;
    const rows = G.mpPlayers.slice().sort((a, b) => (a.zb || 0) - (b.zb || 0) || b.sc - a.sc);
    $('mpBoard').innerHTML = rows.map((p) => `<div class="${p.id === G.myId ? 'me' : ''}"><span>${esc(p.id === G.myId ? (G.myName || 'Siz') : nameOf(p.id))}</span><span class="hold">${p.zb ? '☣ zombi' : p.al ? 'odam' : '✖'}</span><span>${p.k} ☠</span><span>${p.sc}</span></div>`).join('');
  }
}
const TEAM = ['', 'QIZIL', "KO'K"];
// Jamoaviy jang: jamoalar hisobi va jamoa bo'yicha guruhlangan jadval
export function updateTdmHUD(dt) {
  const tl = Math.max(0, G.mpTL || 0), tk = G.mpTk || [0, 0], my = G.myTeam || 1, en = my === 1 ? 2 : 1;
  setText('waveLabel', 'JAMOAVIY JANG');
  setText('enemyLabel', `Vaqt: ${Math.floor(tl / 60)}:${Math.floor(tl % 60).toString().padStart(2, '0')}`);
  setText('scoreLabel', String(Math.round(G.score || 0)));
  setText('objective', player.alive ? `Siz ${TEAM[my]} jamoadasiz. Raqib jamoani yo'q qiling — sheriklar ko'k yozuv bilan belgilangan.` : "Qayta tug'ilishni kuting...");
  setText('flagStatus', `⚔ BIZ (${TEAM[my]}) ${tk[my - 1]} : ${tk[en - 1]} RAQIB (${TEAM[en]}) · maqsad ${G.tdmTarget}`);
  $('flagStatus').className = tk[my - 1] > tk[en - 1] ? 'mine' : tk[my - 1] < tk[en - 1] ? 'enemy' : '';
  boardT -= dt;
  if (boardT <= 0) {
    boardT = 0.25;
    const rows = G.mpPlayers.slice().sort((a, b) => (a.tm === my ? 0 : 1) - (b.tm === my ? 0 : 1) || b.k - a.k || a.d - b.d);
    $('mpBoard').innerHTML = rows.map((p) => `<div class="${p.id === G.myId ? 'me' : p.tm === my ? 'mate' : 'foe'}"><span>${esc(p.id === G.myId ? (G.myName || 'Siz') : nameOf(p.id))}</span><span class="hold">${TEAM[p.tm] || ''}</span><span>${p.k}/${p.d}</span><span>${p.sc}</span></div>`).join('');
  }
}
export function updateMpHUD(dt) {
  if (G.mpMode === 'zombie' && G.zg) { updateZombieMpHUD(dt); return; }
  if (G.mpMode === 'tdm') { updateTdmHUD(dt); return; }
  if (modeHUD(dt, $)) return;
  const tl = Math.max(0, G.mpTL || 0), dm = G.mpMode === 'dm';
  setText('waveLabel', dm ? 'DEATHMATCH' : 'BAYROQ JANGI');
  setText('enemyLabel', `Vaqt: ${Math.floor(tl / 60)}:${Math.floor(tl % 60).toString().padStart(2, '0')}`);
  setText('scoreLabel', String(Math.round(G.score || 0)));
  const f = G.mpFlag, me = G.mpPlayers.find((p) => p.id === G.myId);
  let obj, fs, cls = '';
  if (dm) {
    const top = G.mpPlayers.slice().sort((a, b) => b.k - a.k || a.d - b.d)[0];
    obj = player.alive ? `Raqiblarni yo'q qiling! Birinchi bo'lib ${G.dmTarget} ta o'ldirgan g'olib.` : "Qayta tug'ilishni kuting...";
    fs = `☠ SIZ: ${me ? me.k : 0}/${G.dmTarget}` + (top && top.id !== G.myId && top.k > 0 ? ` · YETAKCHI: ${nameOf(top.id).toUpperCase()} — ${top.k}` : '');
    if (top && top.id === G.myId && top.k > 0) cls = 'mine';
  } else {
    const myHold = me ? Math.floor(me.ho) : 0;
    if (!player.alive) obj = "Qayta tug'ilishni kuting...";
    else if (f.h === G.myId) obj = "Bayroqni ushlab turing! Raqiblardan qoching yoki ularni yo'q qiling.";
    else if (f.h) obj = `${nameOf(f.h)} bayroqni olib ketdi — uni o'ldiring!`;
    else obj = 'Bayroqni oling! (sariq nur va ⚑ belgisi)';
    if (f.h === G.myId) { fs = `⚑ BAYROQ SIZDA · ${myHold}/${G.mpHold} s`; cls = 'mine'; }
    else if (f.h) { fs = `⚑ ${nameOf(f.h).toUpperCase()} BAYROQNI USHLAB TURIBDI`; cls = 'enemy'; }
    else fs = '⚑ BAYROQ ERKIN';
  }
  setText('objective', obj);
  setText('flagStatus', fs);
  $('flagStatus').className = cls;
  boardT -= dt;
  if (boardT <= 0) {
    boardT = 0.25;
    const rows = G.mpPlayers.slice().sort(dm ? (a, b) => b.k - a.k || a.d - b.d : (a, b) => b.ho - a.ho || b.sc - a.sc);
    $('mpBoard').innerHTML = rows.map((p) => {
      const c = (p.id === G.myId ? 'me ' : '') + (!dm && f.h === p.id ? 'carrier' : '');
      return `<div class="${c}"><span>${esc(p.id === G.myId ? (G.myName || 'Siz') : nameOf(p.id))}${p.st >= 3 ? ' 🔥' + p.st : ''}</span><span class="hold">${dm ? p.k + ' ☠' : Math.floor(p.ho) + 's'}</span><span>${p.k}/${p.d}</span><span>${p.sc}</span></div>`;
    }).join('');
  }
}

export function mpEnd(o) {
  G.state = 'over';
  // zombi rejimi: odam bo'lsangiz — faqat vertolyotda ketgan bo'lsangiz g'olibsiz; zombi bo'lsangiz — odamlar qutula olmasa
  const zme = (o.players || []).find((p) => p.id === G.myId), zwon = G.isZ ? o.side !== 'humans' : o.side === 'humans' && !!(zme && zme.ev);
  { const won = o.mode === 'zombie' ? zwon : o.mode === 'tdm' || o.team ? !!o.team && o.team === G.myTeam : o.winner === G.myId; addXp(XP.mpPlayed + (won ? XP.mpWin : 0)); }
  leaveVehicleLocal(); stopEngines(); closePick(); dropOwnTurrets(); endDrone('dead'); clearOverlays(); clearZone();   // (zona pardasi yakun oynasi ustida qolmasin)
  if (document.pointerLockElement) document.exitPointerLock();
  $('hud').classList.add('hidden'); $('scope').style.display = 'none'; $('pause').classList.add('hidden');
  if (o.mode === 'zombie') {   // zombi rejimi: tomonlar g'alabasi
    const hw = o.side === 'humans', mine = zwon, ps = (o.players || []).slice().sort((a, b) => (a.zb || 0) - (b.zb || 0) || (b.ev || 0) - (a.ev || 0) || b.score - a.score);
    const left = hw && !G.isZ && !(zme && zme.ev);   // odamlar qutuldi, lekin siz yerda qoldingiz
    $('endTitle').textContent = hw ? (G.isZ ? 'ODAMLAR QUTULIB KETDI' : left ? 'VERTOLYOT SIZSIZ KETDI' : 'EVAKUATSIYA QILINDINGIZ!') : G.isZ ? "ZOMBILAR G'OLIB!" : 'HAMMA ZOMBIGA AYLANDI';
    $('endTitle').style.color = mine ? '#ffcc55' : '#ff5b4b';
    $('endSub').textContent = hw ? `Vertolyot ${ps.filter((p) => p.ev).map((p) => p.name).join(', ')}ni olib, karantin zonasidan chiqib ketdi.` + (left ? " Siz rampaga ulgurmadingiz." : '') : `Odamlar "${(WILD.stages[Math.min(o.stage || 0, WILD.stages.length - 1)] || {}).name}" bosqichidan o'ta olmadi — tun zombilarniki.`;
    $('endStats').innerHTML = "<table><tr><th>O'yinchi</th><th>Tomon</th><th>O'ldirish</th><th>O'lim</th><th>Ball</th></tr>" +
      ps.map((p) => `<tr class="${hw ? (p.ev ? 'win' : '') : p.zb ? 'win' : ''}"><td>${esc(p.name)}${p.id === G.myId ? ' (siz)' : ''}</td><td>${p.zb ? '☣ zombi' : p.ev ? 'odam · qutqarildi 🚁' : 'odam'}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.score}</td></tr>`).join('') + '</table>';
    $('endSub').textContent += ` · Tajriba: +${G.xpGained || 0} XP (daraja ${level()})`;
    $('btnAgain').textContent = 'Lobbiga qaytish';
    show('end');
    if (mine) sound.victory(); else sound.defeat();
    return;
  }
  if (o.mode === 'tdm') {   // jamoaviy jang: jamoalar hisobi
    const my = G.myTeam || 1, tk = o.tk || [0, 0], won = o.team === my, draw = !o.team;
    const ps = (o.players || []).slice().sort((a, b) => (a.tm === my ? 0 : 1) - (b.tm === my ? 0 : 1) || b.kills - a.kills);
    $('endTitle').textContent = draw ? 'DURANG' : won ? "JAMOANGIZ G'OLIB!" : "RAQIB JAMOA G'OLIB";
    $('endTitle').style.color = won || draw ? '#ffcc55' : '#ff5b4b';
    $('endSub').textContent = `${TEAM[1]} ${tk[0]} : ${tk[1]} ${TEAM[2]} · siz ${TEAM[my]} jamoada edingiz · Tajriba: +${G.xpGained || 0} XP (daraja ${level()})`;
    $('endStats').innerHTML = "<table><tr><th>O'yinchi</th><th>Jamoa</th><th>O'ldirish</th><th>O'lim</th><th>Ball</th></tr>" +
      ps.map((p) => `<tr class="${p.tm === o.team ? 'win' : ''}"><td>${esc(p.name)}${p.id === G.myId ? ' (siz)' : ''}</td><td>${TEAM[p.tm] || '—'}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.score}</td></tr>`).join('') + '</table>';
    $('btnAgain').textContent = 'Lobbiga qaytish';
    show('end');
    if (won) sound.victory(); else sound.defeat();
    return;
  }
  if (o.mode === 'gg' || o.mode === 'br') {   // gun game va jang maydoni: g'olib o'yinchi (jamoa bo'lib o'ynalganda — uning jamoasi)
    const gg = o.mode === 'gg', N = GG_LADDER.length, wp = (o.players || []).find((p) => p.id === o.winner);
    const ps = (o.players || []).slice().sort(gg ? (a, b) => (b.gg || 0) - (a.gg || 0) || b.kills - a.kills : (a, b) => (a.place || 99) - (b.place || 99) || b.kills - a.kills);
    const iWon = o.team ? o.team === G.myTeam : o.winner === G.myId;
    $('endTitle').textContent = iWon ? (o.team ? "JAMOANGIZ G'OLIB!" : "SIZ G'OLIBSIZ!") : `G'OLIB: ${wp ? wp.name : '—'}${o.team ? ' (' + TEAM[o.team] + ')' : ''}`;
    $('endTitle').style.color = iWon ? '#ffcc55' : '#ff5b4b';
    $('endSub').textContent = (gg ? "Gun game: barcha darajalardan o'tib, pichoq bilan o'ldirgan o'yinchi g'alaba qozondi." : "Jang maydoni: oxirgi tirik qolgan g'alaba qozondi.") + ` · Tajriba: +${G.xpGained || 0} XP (daraja ${level()})`;
    $('endStats').innerHTML = `<table><tr><th>O'yinchi</th><th>${gg ? 'Daraja' : "O'rin"}</th><th>O'ldirish</th><th>O'lim</th></tr>` +
      ps.map((p) => `<tr class="${(o.team ? p.tm === o.team : p.id === o.winner) ? 'win' : ''}"><td>${p.id === o.winner ? '🏆 ' : ''}${esc(p.name)}${p.id === G.myId ? ' (siz)' : ''}${o.team && p.tm ? ' · ' + TEAM[p.tm] : ''}</td><td>${gg ? `${Math.min(N, (p.gg || 0) + 1)}/${N} · ${ggName(p.gg || 0)}` : (p.place || 1) + '-o\'rin'}</td><td>${p.kills}</td><td>${p.deaths}</td></tr>`).join('') + '</table>';
    $('btnAgain').textContent = 'Lobbiga qaytish';
    show('end');
    if (iWon) sound.victory(); else sound.defeat();
    return;
  }
  const dm = o.mode === 'dm';
  const players = (o.players || []).slice().sort(dm ? (a, b) => b.kills - a.kills || a.deaths - b.deaths : (a, b) => b.hold - a.hold || b.score - a.score);
  const win = players.find((p) => p.id === o.winner);
  const iWon = o.winner === G.myId;
  $('endTitle').textContent = iWon ? "SIZ G'OLIBSIZ!" : `G'OLIB: ${win ? win.name : '—'}`;
  $('endTitle').style.color = iWon ? '#ffcc55' : '#ff5b4b';
  $('endSub').textContent = dm ? "Deathmatch: eng ko'p raqibni yo'q qilgan o'yinchi g'alaba qozondi." : "Bayroqni eng uzoq ushlab turgan o'yinchi g'alaba qozondi.";
  $('endStats').innerHTML = '<table><tr><th>O\'yinchi</th><th>Bayroq</th><th>O\'ldirish</th><th>O\'lim</th><th>Ball</th></tr>' +
    players.map((p) => `<tr class="${p.id === o.winner ? 'win' : ''}"><td>${p.id === o.winner ? '🏆 ' : ''}${esc(p.name)}${p.id === G.myId ? ' (siz)' : ''}</td><td>${dm ? '—' : Math.floor(p.hold) + ' s'}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.score}</td></tr>`).join('') + '</table>';
  $('endSub').textContent += ` · Tajriba: +${G.xpGained || 0} XP (daraja ${level()})`;
  $('btnAgain').textContent = 'Lobbiga qaytish';
  show('end');
  if (iWon) sound.victory(); else sound.defeat();
}
