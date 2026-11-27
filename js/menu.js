// Menyu: davr/rejim/xarita tanlash, sozlamalar, brifing, klass tanlash, pauza va yakun tugmalari.
import { $, BRIEF, G, GL_NAME, SOFT_GL, applyQuality, clamp, saveSettings, settings, sound } from './core.js';
import { createScene } from './scene.js';
import { buildSlots, clearOverlays, setText } from './hud.js';
import { setupWeapons } from './arsenal.js';
import { startGame } from './game.js';
import { stopEngines } from './transport.js';
import { clearRemotes, net, rejoinStop, showLobby } from './mp.js';
import { requestLock } from './input.js';
import { ATTACH, CLASSES, MAX_ATTACH, SIDEARMS, WEAPONS, attachFits, weaponAdv, withAttachments } from './weapons.js';
import { RESPAWN } from './shared.mjs';
import { MAX_LEVEL, UNLOCKS, levelInfo, loadoutFor, setLoadout, toggleAttach, unlockLevel, unlockName } from './progress.js';

// ---------- Menyu ----------
export function selectEra(era) {
  G.era = era;
  document.querySelectorAll('.era').forEach((e) => e.classList.toggle('sel', e.dataset.era === era));
  createScene(era);
  updateRecords();
}
document.querySelectorAll('.era').forEach((e) => e.addEventListener('click', () => { sound.init(); sound.ui(); if (G.era !== e.dataset.era) selectEra(e.dataset.era); }));
document.querySelectorAll('#diffs button').forEach((b) => b.addEventListener('click', () => {
  sound.init(); sound.ui();
  G.diffIdx = +b.dataset.d;
  document.querySelectorAll('#diffs button').forEach((x) => x.classList.toggle('sel', x === b));
}));
$('btnPlay').addEventListener('click', () => { sound.init(); sound.ui(); showBriefing(); });
// Yakka o'yin: rejim (to'lqinlar / zombi) va xarita. Zombi rejimi doim katta xaritada, tunda o'ynaladi.
export function spOptions() {
  document.querySelectorAll('#spModes button').forEach((b) => b.classList.toggle('sel', b.dataset.m === G.spMode));
  document.querySelectorAll('#spMaps button').forEach((b) => { b.classList.toggle('sel', b.dataset.map === (G.spMode === 'zombie' ? 'wild' : G.spMap)); b.disabled = G.spMode === 'zombie'; });   // zombi rejimi — faqat katta shaharda
  document.querySelectorAll('#diffs button').forEach((b) => { b.disabled = G.spMode === 'zombie'; });
  document.querySelectorAll('#spVeh button').forEach((b) => b.classList.toggle('sel', (b.dataset.v === '1') === G.spVeh));
}
spOptions();   // boshlang'ich holat (masalan, ?xarita=town bilan ochilganda to'g'ri tugma belgilanadi)
document.querySelectorAll('#spModes button').forEach((b) => b.addEventListener('click', () => { sound.init(); sound.ui(); if (G.spMode !== b.dataset.m) { G.spMode = b.dataset.m; spOptions(); createScene(G.era); } }));
document.querySelectorAll('#spMaps button').forEach((b) => b.addEventListener('click', () => { sound.init(); sound.ui(); if (G.spMap !== b.dataset.map) { G.spMap = b.dataset.map; spOptions(); createScene(G.era); } }));
document.querySelectorAll('#spVeh button').forEach((b) => b.addEventListener('click', () => { sound.init(); sound.ui(); const on = b.dataset.v === '1'; if (G.spVeh !== on) { G.spVeh = on; spOptions(); createScene(G.era); } }));
export let settingsReturn = 'menu';
$('btnSettings').addEventListener('click', () => { sound.ui(); settingsReturn = 'menu'; show('settings'); });
$('btnControls').addEventListener('click', () => { sound.ui(); show('controls'); });
document.querySelectorAll('.back').forEach((b) => b.addEventListener('click', () => {
  sound.ui();
  $('settings').classList.add('hidden'); $('controls').classList.add('hidden');
  if (settingsReturn === 'pause') { $('pause').classList.remove('hidden'); settingsReturn = 'menu'; }
}));
$('btnPauseSettings').addEventListener('click', () => { sound.ui(); settingsReturn = 'pause'; $('pause').classList.add('hidden'); show('settings'); });
export function show(id) { $(id).classList.remove('hidden'); }

export function bindSlider(id, vid, key, fmt, onChange) {
  const el = $(id); el.value = settings[key];
  const upd = () => { $(vid).textContent = fmt(settings[key]); };
  upd();
  el.addEventListener('input', () => { settings[key] = +el.value; upd(); saveSettings(); onChange && onChange(); });
}
bindSlider('sSens', 'vSens', 'sens', (v) => v.toFixed(2));
bindSlider('sFov', 'vFov', 'fov', (v) => v + '°');
bindSlider('sVol', 'vVol', 'vol', (v) => Math.round(v * 100) + '%', () => sound.setVolume(settings.vol));
$('sQual').value = settings.quality;
$('sQual').addEventListener('change', () => { settings.quality = $('sQual').value; saveSettings(); });
$('sRes').value = settings.res || 'auto';
$('sRes').addEventListener('change', () => { settings.res = $('sRes').value; saveSettings(); applyQuality(); });
if ($('gpuInfo')) $('gpuInfo').textContent = 'Grafik protsessor: ' + (GL_NAME.replace(/^ANGLE \((.*)\)$/, '$1').slice(0, 90) || "noma'lum") + (SOFT_GL ? ' — GPU tezlatishi yo\'q, effektlar o\'chirilgan' : '');

// Menyudagi daraja ko'rsatkichi va keyingi ochiladigan narsa
export function updateProgBox() {
  const li = levelInfo(), next = UNLOCKS.find((u) => u.lvl > li.lvl);
  $('progBox').innerHTML = `<b>DARAJA ${li.lvl}</b><i><b style="width:${Math.round(li.frac * 100)}%"></b></i><span>${li.lvl >= MAX_LEVEL ? 'eng yuqori daraja' : li.into + ' / ' + li.need + ' XP'}</span>` +
    (next ? `<em>Keyingi: ${next.lvl}-darajada — ${UNLOCKS.filter((u) => u.lvl === next.lvl).map((u) => unlockName(u, G.era)).join(', ')}</em>` : '');
}
export function updateRecords() {
  updateProgBox();
  const rec = JSON.parse(localStorage.getItem('zj_rec') || '{}');
  const f = (e, n) => rec[e] ? `${n}: <b>${rec[e].score}</b> ochko (to'lqin ${rec[e].wave})` : `${n}: —`;
  $('records').innerHTML = 'REKORDLAR<br>' + f('historical', '1944 Qishki front') + '<br>' + f('modern', "2026 Cho'l bo'roni");
}

export let briefTimer = null;
export function showBriefing() {
  $('menu').classList.add('hidden');
  show('briefing');
  G.state = 'briefing';
  const b = G.spMode === 'zombie' ? BRIEF.zombie : BRIEF[G.era];
  $('briefEra').textContent = b.era; $('briefTitle').textContent = b.title; $('briefText').textContent = '';
  let i = 0;
  clearInterval(briefTimer);
  briefTimer = setInterval(() => {
    i += 2; $('briefText').textContent = b.text.slice(0, i);
    if (i % 6 === 0) sound.tone && sound.ctx && sound.tone(sound.bus(0, 0, 0, 0.15), sound.t, 0.02, { type: 'square', freq: 1800, gain: 0.05 });
    if (i >= b.text.length) clearInterval(briefTimer);
  }, 22);
  createScene(G.era);
}
$('briefing').addEventListener('click', () => {
  clearInterval(briefTimer);
  $('briefing').classList.add('hidden');
  if (G.spMode === 'zombie') { startGame(); requestLock(); return; }   // zombi rejimida klass yo'q: hamma to'pponcha va pichoq bilan boshlaydi
  openClassPick('start', () => { startGame(); requestLock(); });
});

// ---------- Klass tanlash (har safar jangga kirishdan oldin) ----------
// mode: 'start' — yakka o'yin boshlanishi; 'mpstart' — tarmoq jangi boshlanishi; 'respawn' — o'lgandan keyingi 4 soniya ichida
export const RESPAWN_T = RESPAWN;
G.pick = null;
export function renderPick() {
  const pk = G.pick, W = WEAPONS[G.era];
  $('cpCards').innerHTML = CLASSES.map((c, i) => {
    const lo = loadoutFor(i), d = withAttachments(W[lo.p], lo.a);
    const bars = [['Zarar', clamp((d.dmg * (d.pellets || 1)) / 180, 0.08, 1)], ['Masofa', clamp((d.falloff ? d.falloff[1] : d.range) / 300, 0.08, 1)], ['Tezlik', clamp(d.rpm / 900, 0.06, 1)]];
    return `<div class="cpCard${i === pk.sel ? ' sel' : ''}" data-i="${i}"><div class="cpKey">${i + 1}</div><div class="cpName">${c.name}</div><div class="cpGun">${d.name}${lo.a.length ? ' <i>+' + lo.a.map((a) => ATTACH[a].name).join(', ') + '</i>' : ''}</div><div class="cpDesc">${c.desc}</div>` +
      bars.map(([n, v]) => `<div class="cpBar"><span>${n}</span><i><b style="width:${Math.round(v * 100)}%"></b></i></div>`).join('') + '</div>';
  }).join('');
  $('cpTitle').textContent = pk.mode === 'respawn' ? 'KEYINGI HAYOT UCHUN KLASS' : pk.mode === 'mpstart' ? 'JANG BOSHLANDI — KLASSNI TANLANG' : 'KLASSNI TANLANG';
  $('cpGo').style.display = pk.mode === 'respawn' ? 'none' : '';
  $('cpGo').textContent = `${CLASSES[pk.sel].name.toUpperCase()} BO'LIB JANGGA KIRISH ▶`;
  $('classPick').classList.toggle('respawn', pk.mode === 'respawn');
  renderLoadout();
  pickTick();
}
// Tanlangan klass uchun qurollar to'plami: asosiy qurol varianti, to'pponcha, qo'shimchalar (ochilmaganlari — qaysi darajada ochilishi bilan)
export function renderLoadout() {
  const pk = G.pick, el = $('cpLoadout');
  if (!pk || pk.mode === 'respawn') { el.innerHTML = ''; return; }
  const W = WEAPONS[G.era], c = CLASSES[pk.sel], lo = loadoutFor(pk.sel), li = levelInfo();
  const btn = (kind, id, label, on, title = '') => {
    const need = unlockLevel(kind === 'a' ? 'att' : 'weapon', id), locked = li.lvl < need;
    return `<button class="lo${on ? ' sel' : ''}" data-k="${kind}" data-id="${id}" ${locked ? 'disabled' : ''} title="${title}">${label}${locked ? ' 🔒' + need : ''}</button>`;
  };
  let h = `<div class="loRow"><span>ASOSIY</span>` + c.alts.map((id) => btn('p', id, W[id].short, lo.p === id, W[id].name)).join('') + `</div>`;
  h += `<div class="loRow"><span>TO'PPONCHA</span>` + SIDEARMS.map((id) => btn('s', id, W[id].short, lo.s === id, W[id].name)).join('') + `</div>`;
  const fit = Object.keys(ATTACH).filter((a) => attachFits(a, lo.p));
  h += `<div class="loRow"><span>QO'SHIMCHA (${MAX_ATTACH} tagacha)</span>` + (fit.length ? fit.map((a) => btn('a', a, ATTACH[a].name, lo.a.includes(a), ATTACH[a].desc)).join('') : '<em>bu qurolga qo\'shimcha o\'rnatilmaydi</em>') + `</div>`;
  h += `<div class="loAdv"><b>${W[lo.p].short}:</b> ${weaponAdv(lo.p, G.era)}<br><b>${W[lo.s].short}:</b> ${weaponAdv(lo.s, G.era)}</div>`;
  h += `<div class="loLvl">DARAJA ${li.lvl} · ${li.lvl >= MAX_LEVEL ? 'eng yuqori daraja' : li.into + ' / ' + li.need + ' XP'}<i><b style="width:${Math.round(li.frac * 100)}%"></b></i></div>`;
  el.innerHTML = h;
}
export function pickTick() {
  const pk = G.pick;
  if (!pk) return;
  setText('cpSub', pk.mode === 'respawn'
    ? `Qayta tug'ilishgacha ${Math.max(0, pk.until - G.time).toFixed(1)} s · [1–${CLASSES.length}] bilan almashtiring · hozir: ${CLASSES[pk.sel].name}`
    : `[1–${CLASSES.length}] — klassni darhol tanlash · sichqoncha bilan klass va qurollarni sozlang · Enter — jangga kirish`);
}
export function openClassPick(mode, done) {
  // jang boshidagi tanlov hali ochiq bo'lsa (o'yinchi tanlab ulgurmasdan o'ldirilgan), u almashtirilmaydi — aks holda jangga kirish tugmasi yo'qolardi
  if (mode === 'respawn' && G.pick && G.pick.mode !== 'respawn') return;
  G.pick = { mode, sel: G.cls, done: done || null, until: G.time + RESPAWN_T };
  renderPick();
  show('classPick');
}
export function closePick() { G.pick = null; $('classPick').classList.add('hidden'); }
export function setClass(i) {
  i = clamp(i | 0, 0, CLASSES.length - 1);
  const changed = i !== G.cls;
  G.cls = i; localStorage.setItem('zj_class', i);
  return changed;
}
// Klass almashganda qurollar to'plamini yangilash (jang ichida)
export function applyLoadout() { setupWeapons(G.era); buildSlots(); }
export function pickSelect(i) {
  const pk = G.pick;
  if (!pk || i < 0 || i >= CLASSES.length) return;
  pk.sel = i; sound.ui();
  if (pk.mode === 'respawn') renderPick();   // tug'ilish vaqti kelganda qo'llanadi
  else pickConfirm();
}
export function pickConfirm() {
  const pk = G.pick;
  if (!pk || pk.mode === 'respawn') return;
  closePick();
  setClass(pk.sel);
  if (pk.done) pk.done();
}
// Sichqoncha bilan: klass faqat belgilanadi (qurollarni sozlash uchun), tasdiqlash — tugma yoki Enter
export function pickFocus(i) {
  const pk = G.pick;
  if (!pk || i < 0 || i >= CLASSES.length) return;
  if (pk.mode === 'respawn') { pickSelect(i); return; }
  pk.sel = i; sound.ui(); renderPick();
}
export function pickKey(e) {
  if (/^Digit[1-9]$/.test(e.code) && +e.code.slice(5) <= CLASSES.length) { if (!e.repeat) pickSelect(+e.code.slice(5) - 1); return true; }
  if (G.pick.mode === 'respawn') return false;
  if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) { e.preventDefault(); pickConfirm(); }
  return true;   // boshlang'ich tanlov paytida boshqa tugmalar o'yinga o'tmaydi
}
$('cpCards').addEventListener('click', (e) => { const c = e.target.closest('.cpCard'); if (c) pickFocus(+c.dataset.i); });
$('cpLoadout').addEventListener('click', (e) => {
  const b = e.target.closest('button.lo'), pk = G.pick;
  if (!b || !pk || b.disabled) return;
  sound.ui();
  if (b.dataset.k === 'a') toggleAttach(pk.sel, b.dataset.id); else setLoadout(pk.sel, { [b.dataset.k]: b.dataset.id });
  renderPick();
});
$('cpGo').addEventListener('click', () => pickConfirm());

$('btnResume').addEventListener('click', () => { sound.ui(); requestLock(); });
$('btnQuit').addEventListener('click', () => { sound.ui(); toMenu(); });
$('btnAgain').addEventListener('click', () => {
  sound.ui(); $('end').classList.add('hidden');
  if (G.mp || net.connected) { G.mp = false; G.state = 'menu'; showLobby(); return; }
  createScene(G.era); G.state = 'briefing';
  if (G.spMode === 'zombie') { startGame(); requestLock(); return; }
  openClassPick('start', () => { startGame(); requestLock(); });
});
$('btnMenu').addEventListener('click', () => { sound.ui(); toMenu(); });

export function toMenu() {
  rejoinStop(); G.myKey = null;
  if (G.mp || net.connected) net.close();
  G.mp = false; clearRemotes(); stopEngines(); closePick();
  $('lobby').classList.add('hidden');
  G.state = 'menu';
  $('pause').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.add('hidden');
  $('scope').style.display = 'none'; clearOverlays();
  show('menu');
  sound.stopAmbient();
  if (document.pointerLockElement) document.exitPointerLock();
  createScene(G.era);
  updateRecords();
}
