import * as THREE from '../lib/three.module.js';
import { World, MAPS, BIG_POINTS, randomVehicles } from './world.js';
import { FX, Weather } from './fx.js';
import { SoundEngine } from './audio.js';
import { Soldier, RemotePlayer, buildChute } from './soldier.js';
import { animateSoldier, makeSoldierModel } from './soldiermodel.js';
import { Vehicle, gunFire, gunCool, newGun, BURN_AT } from './vehicles.js';
import { Net } from './net.js';
import { Zombie, ZombieGame, VIS_R } from './zombie.js';
import { WEAPONS, CLASSES, KNIFE, NADE, EMPTY, CLAW, buildClaws, loadout, buildViewmodel, buildKnife, buildGrenadeHand, buildShell, specialWeapons, MOUNT_DEF } from './weapons.js';
import { rayAABB, inv } from './world.js';
import { Post } from './post.js';
import { makeEnv, skyAt, GFX } from './gfx.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const TOTAL_WAVES = 10;

const DIFFS = [
  { name: 'Yangi askar', acc: 0.5, dmg: 0.45, reaction: 1.0, hpMul: 0.85, score: 0.75 },
  { name: 'Askar', acc: 0.78, dmg: 0.75, reaction: 0.7, hpMul: 1.0, score: 1.0 },
  { name: 'Qiyin', acc: 1.0, dmg: 1.05, reaction: 0.5, hpMul: 1.1, score: 1.5 },
  { name: 'Faxriy', acc: 1.25, dmg: 1.5, reaction: 0.32, hpMul: 1.2, score: 2.2 },
];
const STREAKS = {
  historical: [
    { k: 3, id: 'recon', name: 'Razvedka samolyoti' },
    { k: 6, id: 'mortar', name: 'Artilleriya zarbasi' },
    { k: 10, id: 'bomber', name: 'Bombardimonchi' },
  ],
  modern: [
    { k: 3, id: 'recon', name: 'Razvedka droni' },
    { k: 6, id: 'mortar', name: 'Raketa zarbasi' },
    { k: 10, id: 'bomber', name: 'Havo hujumi' },
  ],
};
const ALLY_NAMES = { historical: ['Karimov', 'Rustamov'], modern: ['Botir', 'Sardor'] };
const BRIEF = {
  historical: {
    era: 'TARIXIY KAMPANIYA · 1944',
    title: 'QISHKI FRONT',
    text: "1944-yil, dekabr.\nSharqiy front, nomsiz shaharcha.\n\nDushman qo'shinlari shaharni qaytarib olish uchun\nkuchli hujumga tayyorlanmoqda. Sizning vzvodingiz\nmarkaziy maydonni har qanday holatda ushlab turishi kerak.\n\nVAZIFA: 10 ta hujum to'lqinini qaytaring.\nO'q-dori qutisi maydon markazida joylashgan.\nKetma-ket o'ldirishlar artilleriya yordamini ochadi.\n\nOmad, askar.",
  },
  zombie: {
    era: 'ZOMBI REJIMI · TUN',
    title: "O'LIK TUN",
    text: "Tun. Yomg'ir. Shahar o'liklar qo'lida.\n\nSizni A punktiga tushirishdi. Qo'lingizda faqat\nto'pponcha va pichoq. Fonaringiz bor — [L].\n\nVAZIFA: B, C va D punktlariga ketma-ket yetib boring.\nYo'ldagi yashiklarda qurol bor, lekin o'qi sanoqli.\nB punktida granata beriladi. D punktida vertolyot kutadi.\n\nZombilar 30 metrdan narida ko'rinmaydi — faqat ovozi eshitiladi.\nChaqmoq chaqqanda atrofga qarang.",
  },
  modern: {
    era: 'ZAMONAVIY KAMPANIYA · 2026',
    title: "CHO'L BO'RONI",
    text: "2026-yil, mart.\nCho'l shahri, \"Sarob\" operatsiyasi.\n\nRazvedka ma'lumotlariga ko'ra, qurolli guruh shaharni\nnazorat qilmoqda. Maxsus guruhingiz vertolyot\nmaydonchasiga tushirildi.\n\nVAZIFA: dushmanning 10 ta to'lqinini yo'q qiling.\nDron, raketa va havo hujumlarini ketma-ket\no'ldirishlar orqali qo'lga kiriting.\n\nAloqa tugadi.",
  },
};

// ---------- Sozlamalar ----------
const settings = Object.assign({ sens: 1, fov: 80, vol: 0.8, quality: 'high' }, JSON.parse(localStorage.getItem('zj_settings') || '{}'));
const saveSettings = () => localStorage.setItem('zj_settings', JSON.stringify(settings));

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.autoClear = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
const canvas = renderer.domElement;

const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 700);
camera.rotation.order = 'YXZ';
const wScene = new THREE.Scene();
const wCamera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 10);
const wAmb = new THREE.AmbientLight(0xffffff, 0.35); wScene.add(wAmb);
const wSun = new THREE.DirectionalLight(0xffffff, 2.2); wSun.position.set(0.6, 1.4, 0.8); wScene.add(wSun);
const wHemi = new THREE.HemisphereLight(0xc8d4e0, 0x4a4438, 0.9); wScene.add(wHemi);
const wTorch = new THREE.PointLight(0xfff0d2, 0, 3, 1.5); wTorch.position.set(0.1, -0.05, -0.9); wScene.add(wTorch);   // fonar nurining qurolga tushadigan qismi
const W_FOV_TAN = Math.tan((55 * Math.PI) / 360);
// Qurol metallida aks etadigan oddiy "osmon": tepada yorug', ufqda iliq, pastda qorong'i (teksturasiz, kodda yasaladi)
try {
  const es = new THREE.Scene(), eg = new THREE.SphereGeometry(10, 24, 16), col = [];
  const pa = eg.attributes.position, c0 = new THREE.Color(0x1c1a17), c1 = new THREE.Color(0xd8c8a8), c2 = new THREE.Color(0x9fc0e8), cc = new THREE.Color();
  for (let i = 0; i < pa.count; i++) {
    const y = pa.getY(i) / 10;
    if (y < 0) cc.copy(c0).lerp(c1, Math.max(0, 1 + y * 3)); else cc.copy(c1).lerp(c2, Math.min(1, y * 1.6));
    col.push(cc.r, cc.g, cc.b);
  }
  eg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  es.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const lamp = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  lamp.position.set(4, 8, 3); lamp.lookAt(0, 0, 0); es.add(lamp);
  const pm = new THREE.PMREMGenerator(renderer);
  wScene.environment = pm.fromScene(es, 0.03).texture;
  pm.dispose(); eg.dispose();
} catch (e) { /* atrof-muhit xaritasi bo'lmasa ham o'yin ishlaydi */ }
const wEnvDefault = wScene.environment;   // yengil rejimda qurol shu oddiy "osmon"ni aks ettiradi

// ---------- Grafika darajasi ----------
// Qaysi grafik protsessor ishlayotganini aniqlaymiz: dasturiy chizishda (GPU tezlatishi yo'q) og'ir effektlar o'chiriladi.
const GL_NAME = (() => { try { const gl = renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return String(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch (e) { return ''; } })();
const SOFT_GL = /swiftshader|llvmpipe|software|basic render/i.test(GL_NAME);
const post = new Post(renderer);
let postForce = new URLSearchParams(location.search).get('post');   // sinov uchun: ?post=off|medium|high|ultra
// Sozlamadagi sifat → keyingi ishlov darajasi (post.js): past — yo'q; o'rta — bloom, ton, FXAA; yuqori — + SSAO va quyosh nurlari; ultra — + ko'proq namuna
function postLevel() {
  if (postForce) return postForce;
  if (SOFT_GL || !renderer.capabilities.isWebGL2) return 'off';
  const q = settings.quality;
  return q === 'low' ? 'off' : q;   // (dasturiy chizishda yuqorida 'off' qaytgan)
}
// Moslashuvchan aniqlik: kadr tezligi 45 dan pastga tushsa, tasvir aniqligi asta kamaytiriladi; tezlik yetarli bo'lsa qaytariladi.
// (o'yin silliq qoladi — kuchsiz videokartada ham, kuchlisida esa to'liq aniqlikda ishlaydi)
let dynScale = 1, dynAcc = 0, dynN = 0, dynHold = 0, dynFails = 0, dynQ = '';
// GPU tezlatishi bo'lmasa (dasturiy chizish) dunyo "yengil" variantda quriladi (gfx.js: GFX.lite) — aks holda yuklanish va kadrlar juda sekin
const effQ = () => settings.quality;
const liteNow = () => SOFT_GL && !postForce;
function applyQuality() {
  const q = effQ(), d = devicePixelRatio || 1;
  if (q !== dynQ) { dynQ = q; dynScale = 1; dynFails = 0; }
  // ultra: ekran aniqligidan 1.5 baravar yuqori chizib, kichraytiriladi (eng silliq tasvir)
  const base = q === 'low' ? Math.min(d, 1) : q === 'medium' ? Math.min(d, 1.25) : q === 'ultra' ? Math.min(d * 1.5, 2.5) : Math.min(d, 2);
  renderer.setPixelRatio(base * dynScale);
  renderer.shadowMap.enabled = q !== 'low';
  renderer.setSize(innerWidth, innerHeight);
}
function dynRes(raw) {
  if (SOFT_GL || G.state !== 'playing' || document.hidden || raw > 0.25) { dynAcc = 0; dynN = 0; return; }
  dynAcc += raw; dynN++; dynHold -= raw;
  if (dynAcc < 1.5) return;
  const avg = dynAcc / dynN; dynAcc = 0; dynN = 0;
  let sc = dynScale;
  if (avg > 0.024 && sc > 0.5) {
    if (dynHold > 0) dynFails++;                 // oshirish urinishi o'zini oqlamadi — keyingisi kechroq
    sc = Math.max(0.5, sc - (avg > 0.034 ? 0.2 : 0.1)); dynHold = Math.min(90, 10 * 2 ** dynFails);
  } else if (avg < 0.0175 && sc < 1 && dynHold <= 0) { sc = Math.min(1, sc + 0.1); dynHold = 6; }
  if (sc !== dynScale) { dynScale = +sc.toFixed(2); applyQuality(); }
}
applyQuality();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = wCamera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix(); wCamera.updateProjectionMatrix();
});

const sound = new SoundEngine();
sound.setVolume(settings.vol);

// Snayper yaltirashi teksturasi
const glintTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,250,220,0.8)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 31, 64, 2); g.fillRect(31, 0, 2, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

// ---------- O'yin holati ----------
const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, hp: 100, alive: true,
  onGround: true, crouch: false, sprinting: false, moving: false, eyeH: 1.62, bob: 0, stepAcc: 0,
  lastHurt: -99, deathT: 0, isPlayer: true, vehBox: null,
  getAimPoint(out) { return out.set(this.pos.x, this.pos.y + this.eyeH - 0.4, this.pos.z); },
  hitTest(o, d, maxD) {
    const b = this._box || (this._box = new THREE.Box3());
    b.min.set(this.pos.x - 0.32, this.pos.y, this.pos.z - 0.32);
    b.max.set(this.pos.x + 0.32, this.pos.y + this.eyeH + 0.15, this.pos.z + 0.32);
    const t = rayAABB(o.x, o.y, o.z, inv(d.x), inv(d.y), inv(d.z), b);
    return t <= maxD ? { dist: t, head: false } : null;
  },
};

const G = {
  state: 'menu', era: 'historical', diffIdx: 1, diff: DIFFS[1], time: 0, spMode: 'waves', spMap: 'town', zombie: false, night: false,
  scene: null, world: null, fx: null, weather: null, soldiers: [], grenades: [], planes: [], strikes: [],
  player, glintTex, sound, menuT: 0,
};
G.relToPlayer = relToPlayer;
G.damagePlayer = damagePlayer;
G.onSoldierKilled = onSoldierKilled;
G.spawnGrenade = spawnGrenade;
G.canEnemyGrenade = () => {
  if (G.time - (G.lastEnemyNade || -99) < 7) return false;
  G.lastEnemyNade = G.time; return true;
};

const keys = {};
const mouse = { L: false, R: false };
let locked = false;

// ---------- Sahna ----------
function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) { if (m.map) m.map.dispose(); if (m.normalMap) m.normalMap.dispose(); m.dispose(); }
    }
  });
}
// Yakka o'yin uchun sahna sozlamalari: xarita va rejim menyuda tanlanadi (zombi rejimi doim katta xaritada, tunda)
function spSceneOpts() { const z = G.spMode === 'zombie'; return { map: z ? 'big' : G.spMap, night: z, zombie: z }; }
// opts: { map, night, zombie, veh } — tarmoqda server yuborgan qiymatlar
function createScene(era, opts = spSceneOpts()) {
  stopEngines();
  if (G.scene) disposeScene(G.scene);
  if (G.world) G.world.dispose();
  applyQuality();
  const scene = new THREE.Scene();
  G.scene = scene;
  GFX.lite = liteNow();
  G.world = new World(scene, era, effQ(), opts);
  // atrof-muhit yorug'ligi: osmonning o'zidan olinadi — metall va silliq yuzalarda osmon aks etadi, soyalar osmon rangida to'ladi
  try {
    if (G.envRT) { G.envRT.dispose(); G.envRT = null; }
    if (GFX.lite) wScene.environment = wEnvDefault;
    else { G.envRT = makeEnv(renderer, G.world.sky, G.world.envGain); scene.environment = G.envRT.texture; wScene.environment = G.envRT.texture; }
  } catch (e) { console.warn('atrof-muhit xaritasi yaratilmadi', e); }
  G.zombie = !!opts.zombie; G.night = !!opts.night;
  G.fx = new FX(scene, era);
  G.weather = new Weather(scene, era, G.night);
  G.torch = null; G.torchOn = false; G.zg = null;
  if (G.night) setupTorch();
  G.soldiers = []; G.grenades = []; G.planes = []; G.strikes = []; G.flag = null;
  G.vehicles = []; G.projectiles = []; G.pickups = []; G.inVeh = null; G.seat = -1; G.chute = false; G.chuteMesh = null; player.vehBox = null;
  G.platform = null; G.insideVeh = null;
  wHemi.color.setHex(G.night ? 0x7f95bd : era === 'historical' ? 0xc4ccd6 : 0xfff0d8);
  wSun.color.setHex(G.night ? 0xa8bce0 : era === 'historical' ? 0xe4eaf2 : 0xfff0d4);
  G.gunSun = era === 'historical' ? 1.6 : 2.6; G.gunK = 1; G.gunLit = 1; G.gunT = 0;
}
// Qo'ldagi qurolning yoritilishi atrofga mos: soyada va uy ichida qorayadi, tunda deyarli ko'rinmaydi (fonar va chaqmoq yoritadi)
const _sunTo = new THREE.Vector3();
function updateGunLight(dt) {
  const W = G.world; if (!W) return;
  const cp = camera.position;
  G.gunT -= dt;
  if (G.gunT <= 0) {
    G.gunT = 0.12;
    let lit = skyAt(W.roof, cp.x, cp.y, cp.z) > 0.9 ? 1 : 0;
    if (lit && W.sunDir) lit = W.los(cp, _sunTo.copy(cp).addScaledVector(W.sunDir, 140)) ? 1 : 0.12;   // quyosh to'silgan — soyadamiz
    G.gunLitT = lit; G.gunOpenT = skyAt(W.roof, cp.x, cp.y, cp.z);
  }
  const k = Math.min(1, dt * 7), f = W.flashF || 0;
  G.gunLit += ((G.gunLitT ?? 1) - G.gunLit) * k; G.gunK += ((G.gunOpenT ?? 1) - G.gunK) * k;
  const amb = G.night ? 0.07 + f * 1.4 : G.gunK;
  wSun.intensity = G.night ? 0.12 * G.gunK + f * 3 : G.gunSun * G.gunLit;
  wHemi.intensity = 0.9 * amb; wAmb.intensity = 0.35 * amb;
  wTorch.intensity = G.torch ? G.torch.intensity * 0.05 : 0;
}

// ---------- Qurollar ----------
const vmRoot = new THREE.Group(); wScene.add(vmRoot);
let knifeVM = null, nadeVM = null;
G.cls = clamp(+(localStorage.getItem('zj_class') || 0) | 0, 0, CLASSES.length - 1);
const isGun = (w) => !w.def.kind;
function makeWeapon(def, era) {
  if (def.kind === 'none') return { def, locked: true, vm: { group: new THREE.Group() } };   // bo'sh o'rin
  if (def.kind === 'melee') return { def, vm: buildKnife(era) };
  if (def.kind === 'throw') return { def, vm: buildGrenadeHand(era) };
  const vm = buildViewmodel(def, era);
  if (vm.shell) { vm.loader = buildShell(era, true); vm.gun.add(vm.loader); }   // drobovik: qo'lda solinadigan patron
  return { def, mag: def.mag, reserve: def.reserve, vm };
}
function setupWeapons(era) {
  while (vmRoot.children.length) { const c = vmRoot.children[0]; vmRoot.remove(c); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  // Klass to'plami: 1 — asosiy qurol, 2 — to'pponcha, 3 — pichoq, 4 — granata (5 — podvaldan topilgan noyob qurol)
  // Zombi rejimi: faqat to'pponcha (o'qi tugamaydi) va pichoq; asosiy qurol yashiklardan topiladi
  const defs = G.zombie ? [EMPTY, WEAPONS[era].pistol, KNIFE, NADE] : loadout(era, G.cls);
  G.weapons = defs.map((def) => { const w = makeWeapon(def, era); w.vm.group.visible = false; vmRoot.add(w.vm.group); return w; });
  if (G.zombie) G.weapons[1].inf = true;
  knifeVM = G.weapons[2].vm; nadeVM = G.weapons[3].vm;
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
const cur = () => G.weapons[G.wi];
// asosiy qurol o'rni (bo'sh bo'lsa — to'pponcha)
function mainSlot() { return G.weapons[0].locked ? 1 : 0; }

// ---------- Menyu ----------
function selectEra(era) {
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
function spOptions() {
  document.querySelectorAll('#spModes button').forEach((b) => b.classList.toggle('sel', b.dataset.m === G.spMode));
  document.querySelectorAll('#spMaps button').forEach((b) => { b.classList.toggle('sel', b.dataset.map === (G.spMode === 'zombie' ? 'big' : G.spMap)); b.disabled = G.spMode === 'zombie'; });
  document.querySelectorAll('#diffs button').forEach((b) => { b.disabled = G.spMode === 'zombie'; });
}
document.querySelectorAll('#spModes button').forEach((b) => b.addEventListener('click', () => { sound.init(); sound.ui(); if (G.spMode !== b.dataset.m) { G.spMode = b.dataset.m; spOptions(); createScene(G.era); } }));
document.querySelectorAll('#spMaps button').forEach((b) => b.addEventListener('click', () => { sound.init(); sound.ui(); if (G.spMap !== b.dataset.map) { G.spMap = b.dataset.map; spOptions(); createScene(G.era); } }));
let settingsReturn = 'menu';
$('btnSettings').addEventListener('click', () => { sound.ui(); settingsReturn = 'menu'; show('settings'); });
$('btnControls').addEventListener('click', () => { sound.ui(); show('controls'); });
document.querySelectorAll('.back').forEach((b) => b.addEventListener('click', () => {
  sound.ui();
  $('settings').classList.add('hidden'); $('controls').classList.add('hidden');
  if (settingsReturn === 'pause') { $('pause').classList.remove('hidden'); settingsReturn = 'menu'; }
}));
$('btnPauseSettings').addEventListener('click', () => { sound.ui(); settingsReturn = 'pause'; $('pause').classList.add('hidden'); show('settings'); });
function show(id) { $(id).classList.remove('hidden'); }

function bindSlider(id, vid, key, fmt, onChange) {
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
if ($('gpuInfo')) $('gpuInfo').textContent = 'Grafik protsessor: ' + (GL_NAME.replace(/^ANGLE \((.*)\)$/, '$1').slice(0, 90) || "noma'lum") + (SOFT_GL ? ' — GPU tezlatishi yo\'q, effektlar o\'chirilgan' : '');

function updateRecords() {
  const rec = JSON.parse(localStorage.getItem('zj_rec') || '{}');
  const f = (e, n) => rec[e] ? `${n}: <b>${rec[e].score}</b> ochko (to'lqin ${rec[e].wave})` : `${n}: —`;
  $('records').innerHTML = 'REKORDLAR<br>' + f('historical', '1944 Qishki front') + '<br>' + f('modern', "2026 Cho'l bo'roni");
}

let briefTimer = null;
function showBriefing() {
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
const RESPAWN_T = 4;
G.pick = null;
function renderPick() {
  const pk = G.pick, W = WEAPONS[G.era];
  $('cpCards').innerHTML = CLASSES.map((c, i) => {
    const d = W[c.primary];
    const bars = [['Zarar', clamp((d.dmg * (d.pellets || 1)) / 180, 0.08, 1)], ['Masofa', clamp((d.falloff ? d.falloff[1] : d.range) / 300, 0.08, 1)], ['Tezlik', clamp(d.rpm / 900, 0.06, 1)]];
    return `<div class="cpCard${i === pk.sel ? ' sel' : ''}" data-i="${i}"><div class="cpKey">${i + 1}</div><div class="cpName">${c.name}</div><div class="cpGun">${d.name}</div><div class="cpDesc">${c.desc}</div>` +
      bars.map(([n, v]) => `<div class="cpBar"><span>${n}</span><i><b style="width:${Math.round(v * 100)}%"></b></i></div>`).join('') + '</div>';
  }).join('');
  $('cpTitle').textContent = pk.mode === 'respawn' ? 'KEYINGI HAYOT UCHUN KLASS' : pk.mode === 'mpstart' ? 'JANG BOSHLANDI — KLASSNI TANLANG' : 'KLASSNI TANLANG';
  $('cpGo').style.display = pk.mode === 'respawn' ? 'none' : '';
  $('cpGo').textContent = `${CLASSES[pk.sel].name.toUpperCase()} BO'LIB JANGGA KIRISH ▶`;
  $('classPick').classList.toggle('respawn', pk.mode === 'respawn');
  pickTick();
}
function pickTick() {
  const pk = G.pick;
  if (!pk) return;
  setText('cpSub', pk.mode === 'respawn'
    ? `Qayta tug'ilishgacha ${Math.max(0, pk.until - G.time).toFixed(1)} s · [1–4] bilan almashtiring · hozir: ${CLASSES[pk.sel].name}`
    : '[1–4] yoki sichqoncha bilan tanlang · Enter — tasdiqlash');
}
function openClassPick(mode, done) {
  // jang boshidagi tanlov hali ochiq bo'lsa (o'yinchi tanlab ulgurmasdan o'ldirilgan), u almashtirilmaydi — aks holda jangga kirish tugmasi yo'qolardi
  if (mode === 'respawn' && G.pick && G.pick.mode !== 'respawn') return;
  G.pick = { mode, sel: G.cls, done: done || null, until: G.time + RESPAWN_T };
  renderPick();
  show('classPick');
}
function closePick() { G.pick = null; $('classPick').classList.add('hidden'); }
function setClass(i) {
  i = clamp(i | 0, 0, CLASSES.length - 1);
  const changed = i !== G.cls;
  G.cls = i; localStorage.setItem('zj_class', i);
  return changed;
}
// Klass almashganda qurollar to'plamini yangilash (jang ichida)
function applyLoadout() { setupWeapons(G.era); buildSlots(); }
function pickSelect(i) {
  const pk = G.pick;
  if (!pk || i < 0 || i >= CLASSES.length) return;
  pk.sel = i; sound.ui();
  if (pk.mode === 'respawn') renderPick();   // tug'ilish vaqti kelganda qo'llanadi
  else pickConfirm();
}
function pickConfirm() {
  const pk = G.pick;
  if (!pk || pk.mode === 'respawn') return;
  closePick();
  setClass(pk.sel);
  if (pk.done) pk.done();
}
function pickKey(e) {
  if (/^Digit[1-4]$/.test(e.code)) { if (!e.repeat) pickSelect(+e.code.slice(5) - 1); return true; }
  if (G.pick.mode === 'respawn') return false;
  if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) { e.preventDefault(); pickConfirm(); }
  return true;   // boshlang'ich tanlov paytida boshqa tugmalar o'yinga o'tmaydi
}
$('cpCards').addEventListener('click', (e) => { const c = e.target.closest('.cpCard'); if (c) pickSelect(+c.dataset.i); });
$('cpGo').addEventListener('click', () => pickConfirm());

function requestLock() {
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* e'tiborsiz */ }
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) {
    if (G.state === 'paused') { G.state = 'playing'; $('pause').classList.add('hidden'); }
  } else if (G.state === 'playing' && (player.alive || G.mp)) pauseGame();
});
function pauseGame() {
  G.state = 'paused';
  mouse.L = mouse.R = false;
  for (const k in keys) keys[k] = false;
  $('pauseTitle').textContent = G.mp ? 'PAUZA · jang davom etmoqda!' : 'PAUZA';
  $('btnResume').textContent = 'Davom etish';
  show('pause');
}
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

function toMenu() {
  if (G.mp || net.connected) net.close();
  G.mp = false; clearRemotes(); stopEngines(); closePick();
  $('lobby').classList.add('hidden');
  G.state = 'menu';
  $('pause').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.add('hidden');
  $('scope').style.display = 'none';
  show('menu');
  sound.stopAmbient();
  if (document.pointerLockElement) document.exitPointerLock();
  createScene(G.era);
  updateRecords();
}

// ---------- O'yinni boshlash ----------
function startGame() {
  G.diff = DIFFS[G.diffIdx];
  G.time = 0; G.score = 0; G.kills = 0; G.headshots = 0; G.shots = 0; G.hits = 0;
  G.wave = 0; G.waveState = G.mp ? 'mp' : G.zombie ? 'zombie' : 'intermission'; G.waveTimer = 6; G.toSpawn = 0; G.spawnT = 0; G.maxAlive = 6;
  G.streak = 0; G.streakReady = []; G.uavT = 0; G.shake = 0; G.hurtPulse = 0; G.hbT = 0;
  G.supplyReady = !G.zombie; G.grenades_n = G.zombie ? 0 : 3; G.lastKillT = -9; G.multi = 0; G.flowT = 0; G.ambT = 5; G.dmgInds = [];
  G.lastEnemyNade = -99; G.bannerT = 0; G.heat = 0; G.heatT = 0; G.mpStreak = 0;
  const P = player;
  P.pos.copy(G.world.playerSpawn); P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = 0; P.hp = 100; P.alive = true;
  if (G.zombie) { const A = G.world.points[0], B = G.world.points[1]; P.pos.set(A.x, 0, A.z); P.yaw = Math.atan2(-(B.x - A.x), -(B.z - A.z)); }   // A punktida, B tomonga qarab
  P.eyeH = 1.62; P.deathT = 0; P.lastHurt = -99; P.crouch = false;
  G.crouchToggle = false;
  setupWeapons(G.era);
  setupExtras(G.world.vehSpawns);
  G.world.updateFlow(P.pos.x, P.pos.z);
  if (!G.mp && !G.zombie) spawnAllies();
  G.zg = G.zombie ? new ZombieGame(zApi) : null; G.isZ = false;
  if (G.torch) { G.torchOn = true; G.torch.intensity = 0; }
  if (G.zg && G.zg.host) for (let i = 0; i < 5; i++) G.zg.spawnOne();
  $('killfeed').innerHTML = ''; $('popups').innerHTML = ''; $('dmgInd').innerHTML = '';
  $('hud').classList.remove('hidden');
  buildSlots(); updateStreakHUD();
  if (G.mp || G.zombie) $('streaks').innerHTML = '';
  $('mpBoard').style.display = $('flagStatus').style.display = G.mp ? 'block' : 'none';
  $('hud').classList.toggle('mp', !!G.mp);   // tarmoqda killfeed hisob jadvali ostiga tushadi
  G.state = 'playing';
  sound.init(); sound.startAmbient(G.era, G.night);
  if (G.zombie && !G.mp) banner('ZOMBI REJIMI', "B punktiga yetib boring · [L] — fonar · yashiklardan qurol toping", 5.5);
  else if (G.mp) banner(G.mpMode === 'dm' ? 'DEATHMATCH' : 'BAYROQ JANGI', G.mpMode === 'dm' ? `Birinchi bo'lib ${G.dmTarget} ta raqibni yo'q qiling!` : 'Markazdagi bayroqni oling va ushlab turing!', 4);
  else banner(G.era === 'historical' ? 'QISHKI FRONT' : "CHO'L BO'RONI", 'Pozitsiyani egallang. Dushman yaqinlashmoqda...', 4);
}

function spawnAllies() {
  const names = ALLY_NAMES[G.era];
  for (let i = 0; i < 2; i++) {
    const existing = G.soldiers.find((s) => s.team === 'ally' && s.name === names[i] && s.alive);
    if (existing) { existing.hp = existing.maxHp; continue; }
    const p = player.pos.clone().add(new THREE.Vector3(i === 0 ? -2 : 2, 0, 1.5));
    G.world.collideCircle(p, 0.4, 0, 1.7);
    G.soldiers.push(new Soldier(G, 'ally', 'ally', p, names[i]));
  }
}

// ---------- Kiritish ----------
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (G.pick && pickKey(e)) return;                       // klass tanlash oynasi (o'lik paytda ham ishlaydi)
  if (G.state !== 'playing' || !player.alive) return;
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (G.inVeh) {
    if (e.code === 'KeyF' && !e.repeat) exitVehicle();
    else if (e.code === 'KeyQ' && !e.repeat) cycleSeat();                                    // keyingi bo'sh o'rin
    else if (e.code === 'KeyV' && !e.repeat) toggleVehView();                                // 1-shaxs / 3-shaxs ko'rinish
    else if (e.code === 'KeyR' && ownGunActive()) startReload();                             // o'z qurolini o'qlash
    else if (e.code === 'KeyL' && !e.repeat) toggleTorch();                                  // fonar
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
    case 'KeyC': G.crouchToggle = !G.crouchToggle; break;
    case 'KeyL': if (!e.repeat) toggleTorch(); break;
    case 'Space': tryChute(); break;
    case 'KeyQ': if (!e.repeat && nearestVehicle()) { G.seatPick++; sound.ui(); } break;   // o'tirishdan oldin o'rin tanlash
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('mousedown', (e) => {
  if (G.state === 'playing' && !locked) { requestLock(); return; }
  if (e.button === 0) mouse.L = true;
  if (e.button === 2) mouse.R = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) { mouse.L = false; G.triggerHeld = false; } if (e.button === 2) mouse.R = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
  if (G.state !== 'playing' || !player.alive) return;
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

// ---------- Qurol harakatlari ----------
// Raqam tugmasi: rad etilsa, sababi ekranda ko'rsatiladi
function selectSlot(i) {
  if (i >= G.weapons.length) { if (i === 4) popup("Noyob qurol yo'q — podvallardan toping", true); return; }
  if (G.weapons[i].locked) { popup("Asosiy qurol yo'q — yashiklardan toping", true); return; }
  if (G.weapons[i].def.kind === 'throw' && G.grenades_n <= 0) { popup('Granata qolmadi', true); return; }
  switchWeapon(i);
}
function switchWeapon(i) {
  if (i === G.wi || i < 0 || i >= G.weapons.length || G.weapons[i].locked || G.knifeT > 0 || G.throwT > 0 || G.cookT >= 0) return;
  cur().vm.group.visible = false;
  G.wi = i; G.reloadT = 0; G.switchT = 0.45; G.fireT = Math.max(G.fireT, 0.1); G.ads = 0;
  cur().vm.group.visible = true;
  sound.reload('out');
  buildSlots();
}
function startReload() {
  const W = cur();
  if (!isGun(W) || G.reloadT > 0 || G.switchT > 0 || W.mag >= W.def.mag || W.reserve <= 0 || G.knifeT > 0 || G.throwT > 0) return;
  // drobovik patronlarni bittalab oladi: birinchi patron oldidan qurolni burish uchun biroz vaqt
  G.reloadT = G.reloadDur = W.def.reload + (W.def.shells ? 0.3 : 0); G.reloadIn = false;
  sound.reload('out');
}
function finishReload() {
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
function throwGrenade() {
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
function releaseNade(inHand) {
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
function meleeDef() { const d = G.weapons[2].def; return d.kind === 'melee' ? d : KNIFE; }
function knifeAttack(kind = 'stab') {
  if (G.knifeT > 0 || G.throwT > 0 || G.cookT >= 0) return;
  const M = meleeDef();
  G.knifeKind = kind; G.knifeDur = kind === 'slash' ? M.slashT : M.stabT;
  G.knifeT = G.knifeDur; G.knifeHit = false; G.reloadT = 0;
  sound.knife();
}
function knifeStrike() {
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

const _o = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _dir = new THREE.Vector3();
const _wh = { point: new THREE.Vector3(), normal: new THREE.Vector3(), dist: 0 };
const _mz = new THREE.Vector3(), _tmp = new THREE.Vector3();

function camBasis() {
  camera.updateMatrixWorld();
  _f.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _r.set(1, 0, 0).applyQuaternion(camera.quaternion);
  _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
}
function muzzleWorld(out) {
  const vm = cur().vm;
  vm.group.updateMatrixWorld(true);
  vm.muzzle.getWorldPosition(out);
  const k = Math.tan((camera.fov * Math.PI) / 360) / W_FOV_TAN;
  out.x *= k; out.y *= k;
  return camera.localToWorld(out);
}
function falloff(def, d) {
  const f = def.falloff;
  if (!f || d <= f[0]) return 1;
  if (d >= f[1]) return f[2];
  return 1 - ((d - f[0]) / (f[1] - f[0])) * (1 - f[2]);
}
function currentSpread() {
  const d = cur().def, P = player;
  if (d.kind) return 0.02;
  let s = lerp(d.hip, d.spread, G.ads);
  const hs = Math.min(8, Math.hypot(P.vel.x, P.vel.z));   // transportda ketayotganda ham tarqalish cheksiz o'smaydi
  s += (hs / 5) * 0.025 * (1 - G.ads * 0.75);
  if (!P.onGround) s += 0.06;
  if (P.crouch) s *= 0.75;
  if (d.scope && G.ads < 0.95) s = Math.max(s, 0.06);
  return s + G.bloom;
}

function tryFire() {
  const W = cur(), d = W.def, P = player;
  if (d.kind || G.fireT > 0 || G.switchT > 0 || G.knifeT > 0 || G.throwT > 0) return;
  if (G.reloadT > 0) {
    if (d.pump && W.mag > 0) G.reloadT = 0; else return;
  }
  if (W.mag <= 0) {
    sound.empty(); G.fireT = 0.25;
    if (W.reserve > 0) startReload();
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
    spawnProjectile(start, vel, d.projectile, 'player', player.vehBox, false);
    if (G.mp) net.send({ t: 'rocket', p: v3arr(start), v: v3arr(vel), k: d.projectile });
    if (d.projectile === 'rocket') for (let i = 0; i < 6; i++) G.fx.smokePuff(_o.clone().addScaledVector(_f, -0.8 - i * 0.3), 0.35);
  }
  if (anyHit) { G.hits++; hitmarker(anyKill && !G.mp); sound.hit(anyHead); }
  if (G.mp && firstEnd) net.send({ t: 'shot', a: v3arr(_mz), b: v3arr(firstEnd), s: d.sound });
  // tepki
  const rm = (G.ads > 0.5 ? 0.65 : 1) * (P.crouch ? 0.8 : 1);
  const kickV = d.recoil * rm * (0.85 + Math.random() * 0.3);
  P.pitch = clamp(P.pitch + kickV, -1.5, 1.5);
  G.recoilAcc += kickV;
  P.yaw += (Math.random() - 0.5) * 2 * d.recoilH * rm;
  G.kick = Math.min(1.4, G.kick + 1);
  G.kickPitch += kickV * 0.6;
  G.bloom = Math.min(d.bloomMax || 0.06, G.bloom + (d.bloom || 0));
  G.flashT = 0.045;
  G.fx.flash(_mz, 0xffb050, 8, 0.06, 10);
  sound.shot(d.sound, 0, 0, false);
  G.kickRoll = (Math.random() - 0.5) * 0.06;
  if (d.bolt || d.pump) { G.cycleT = 60 / d.rpm; G.cycleEject = true; }
  else { G.boltT = 0.085; ejectShell(W.vm); }
}

function hitscan(o, dir, d, ignore) {
  const wh = G.world.rayCast(o, dir, d.range, _wh, ignore);
  const lim = wh ? wh.dist : d.range;
  let best = null;
  for (const s of G.soldiers) {
    if (!s.alive || !hostile(s)) continue;
    const h = s.hitTest(o, dir, lim);
    if (h && (!best || h.dist < best.dist)) best = h;
  }
  if (best) {
    const end = o.clone().addScaledVector(dir, best.dist);
    // boshga — qurolning bosh ko'paytuvchisi; oyoq/qo'lga — kamroq zarar (best.mul)
    const dmg = d.dmg * (best.head ? d.head : best.mul || 1) * falloff(d, best.dist);
    const s = best.soldier;
    // zenit pushkasi qalqoni: olddan otilgan o'q to'pchiga emas, pushkaga tegadi
    if (s.veh && s.veh.alive && s.veh.T.shield && shieldBlocks(s.veh, dir)) {
      G.fx.impact(end, dir.clone().multiplyScalar(-1), 'wall');
      damageVehicle(s.veh, d.dmg * (d.vehMul || 0.5) * armorMul(s.veh, dir, d.ap), 'player');
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
      damageVehicle(veh, d.dmg * (d.vehMul || 0.5) * armorMul(veh, dir, d.ap), 'player');
      return { end: wh.point.clone(), hit: true };
    }
    G.fx.impact(wh.point, wh.normal, wh.ground ? 'ground' : 'wall');
    G.fx.decal(wh.point, wh.normal);
    return { end: wh.point.clone(), hit: false };
  }
  return { end: o.clone().addScaledVector(dir, d.range), hit: false };
}

// ---------- Zombi rejimi: fonar, yashikdagi qurol, punktlar ----------
function setupTorch() {
  const L = new THREE.SpotLight(0xfff0d2, 0, 60, 0.5, 0.6, 1.0);   // qorong'ida oldinga yoritadi
  // yuqori sifatda fonar soya tashlaydi: zombilar va to'siqlarning uzun soyalari
  if (!GFX.lite && (effQ() === 'high' || effQ() === 'ultra')) {
    L.castShadow = true; const ms = effQ() === 'ultra' ? 2048 : 1024;
    L.shadow.mapSize.set(ms, ms); L.shadow.camera.near = 0.6; L.shadow.camera.far = 60; L.shadow.bias = -0.0015; L.shadow.normalBias = 0.02;
  }
  G.scene.add(L); G.scene.add(L.target);
  G.torch = L; G.torchOn = true;
}
function toggleTorch() {
  if (!G.torch) { popup('Fonar faqat tungi rejimda ishlaydi', true); return; }
  if (G.isZ) return;
  G.torchOn = !G.torchOn; sound.click();
  popup(G.torchOn ? 'Fonar yoqildi' : "Fonar o'chirildi");
}
const TORCH_I = 46;
function updateTorch(dt) {
  const L = G.torch;
  if (!L) return;
  camBasis();
  L.position.copy(camera.position).addScaledVector(_r, 0.14).addScaledVector(_u, -0.12);
  L.target.position.copy(camera.position).addScaledVector(_f, 12);
  L.intensity += ((G.torchOn && player.alive && !G.isZ ? TORCH_I : 0) - L.intensity) * Math.min(1, dt * 14);
}
// Yashikdan topilgan qurol: o'q-dorisi cheklangan (jami). Shu turdagi qurol qo'lda bo'lsa — o'q-dori to'ldiriladi.
const ZAMMO = { ar: 300, smg: 300, shotgun: 40, sniper: 20 };
function giveCrateWeapon(kind) {
  const def = WEAPONS[G.era][kind] || WEAPONS[G.era].ar, total = ZAMMO[def.id] || 120, old = G.weapons[0];
  if (!old.locked && old.def.id === def.id) { old.mag = def.mag; old.reserve = total - def.mag; }
  else {
    old.vm.group.visible = false; vmRoot.remove(old.vm.group);
    const w = makeWeapon(def, G.era); w.vm.group.visible = false; vmRoot.add(w.vm.group);
    w.mag = def.mag; w.reserve = total - def.mag;
    G.weapons[0] = w;
  }
  // topilgan qurol darhol qo'lga olinadi
  G.knifeT = 0; G.throwT = 0; G.cookT = -1;
  cur().vm.group.visible = false;
  G.wi = 0; G.reloadT = 0; G.switchT = 0.45; G.ads = 0;
  cur().vm.group.visible = true;
  buildSlots();
  banner(def.name.toUpperCase(), `Jami ${total} ta o'q — tejab ishlating · [1] tugmasi`, 2.8);
  sound.ping();
}
// Punktga yetib kelindi: granata, davolanish, yaqin atrofdagi transportga yoqilg'i va o'q-dori
function zOnPoint(id) {
  const pt = G.world.points.find((p) => p.id === id);
  if (!G.mp && player.alive) player.hp = 100;
  let fed = 0;
  if (pt) for (const v of G.vehicles) if (v.alive && Math.hypot(v.pos.x - pt.x, v.pos.z - pt.z) < 32) { v.refill(0.5); fed++; }
  const veh = fed ? " · yaqindagi transportga yoqilg'i va o'q-dori quyildi" : '';
  if (id === 'B') { if (!G.isZ) G.grenades_n = Math.max(G.grenades_n, 3); banner('B PUNKTI', 'Granatalar berildi [4 / G] · yashiklarda yangi qurollar · endi C punktiga' + veh, 5.5); }
  else if (id === 'C') { if (!G.isZ) G.grenades_n = Math.min(4, G.grenades_n + 2); banner('C PUNKTI', "Granatalar to'ldirildi · oxirgi punkt — D (evakuatsiya)" + veh, 5.5); }
  else if (id === 'D') banner('EVAKUATSIYA', `Vertolyot yo'lda — D punktini ${G.zg ? G.zg.holdMax : 45} soniya ushlab turing!`, 5.5);
  sound.horn();
  buildSlots();
}
// Zombilar quvadigan odamlar ro'yxati: yakka o'yinda — o'yinchi; tarmoqda — barcha tirik odam-o'yinchilar
const meHuman = { pos: player.pos, me: true, get alive() { return player.alive && !G.isZ; }, get veh() { return G.inVeh; }, get id() { return ME(); } };
function zHumans() {
  const out = [meHuman];
  if (G.mp) for (const r of remotes.values()) if (!r.isZ && r.hasPos) out.push(r.human || (r.human = { pos: r.pos, get alive() { return r.alive && !r.isZ; }, get veh() { return r.veh; }, id: r.id }));
  return out;
}
const zApi = { G, player, sound, get net() { return net; }, humans: zHumans, giveCrateWeapon, onPoint: zOnPoint, endZombie: (victory) => { if (!G.mp) endGame(victory); } };
G.camPos = camera.position;
G.zTargets = () => (G.zg ? G.zg.humans() : []);
G.zGroan = () => { if (!G.zg || G.zg.groanGate > 0) return false; G.zg.groanGate = 0.4; return true; };
// Zombi zarbasi: yakka o'yinda — to'g'ridan-to'g'ri (yopiq transport himoyalaydi); tarmoqda — server orqali
G.zAttack = (z, t, dmg) => {
  const pd = relToPlayer(z.pos); sound.zombieHit(pd.dist, pd.pan);
  if (G.mp) {
    if (t.veh && t.veh.alive && t.veh.T.enclosed) damageVehicle(t.veh, dmg * (t.veh.T.bulletMul ?? 1), 'player');
    else net.send({ t: 'zatk', target: t.id, dmg, x: +z.pos.x.toFixed(1), z: +z.pos.z.toFixed(1) });
    return;
  }
  damagePlayer(dmg, z.pos, z);
};

// O'yinchi zombiga aylandi (tarmoq): qurollar o'rniga panjalar, fonar yo'q, qorong'ida uzoqroq ko'radi
function becomeZombie() {
  if (G.isZ) return;
  G.isZ = true;
  leaveVehicleLocal(); dropSpecial(false);
  for (const w of G.weapons) w.vm.group.visible = false;
  G.weapons[0].locked = true; G.weapons[1].locked = true; G.weapons[3].locked = true;
  vmRoot.remove(G.weapons[2].vm.group);
  const cw = { def: CLAW, vm: buildClaws(G.era) }; vmRoot.add(cw.vm.group);
  G.weapons[2] = cw; knifeVM = cw.vm;
  G.wi = 2; G.grenades_n = 0; G.reloadT = 0; G.ads = 0; G.knifeT = 0; G.throwT = 0; G.cookT = -1; G.switchT = 0.4; G.torchOn = false;
  const E = G.world.env;   // zombi tunda yaxshiroq ko'radi (odamlarni topishi uchun)
  if (E) { E.far = 70; E.fog.far = 70; E.hemiI = 1.15; E.hemi.intensity = 1.15; E.hemi.color.setHex(0x8fd09a); }
  buildSlots();
  banner('SIZ ZOMBISIZ', "Odamlarni toping va yuqtiring · chap tugma — panja · o'ng tugma — tishlash", 5.5);
}
// Zombilarni kim boshqarishi o'zgardi (xost chiqib ketsa, keyingi o'yinchi davom ettiradi)
function setZHost(host) {
  const z = G.zg;
  if (!z || z.host === host) return;
  z.host = host;
  for (const s of G.soldiers) if (s.isZombie) { s.local = host; if (host) { s.vel.set(0, 0, 0); z.zid = Math.max(z.zid, s.zid + 1); } else if (s.alive) z.remote.set(s.zid, s); }
  if (host) z.remote.clear();
}
// Xostdan kelgan zombilar holati: yangilarini yaratadi, ro'yxatdan chiqqanlarini olib tashlaydi
const ZK = ['walker', 'runner', 'brute'];
function onZombieState(list) {
  const z = G.zg;
  if (!z || z.host || !Array.isArray(list)) return;
  const seen = new Set();
  for (const st of list) {
    if (!Array.isArray(st) || st.length < 6) continue;
    seen.add(st[0]);
    let zb = z.remote.get(st[0]);
    if (!zb) { zb = new Zombie(G, new THREE.Vector3(st[1], st[2], st[3]), ZK[st[6]] || 'walker', st[0], false); zb.yaw = st[4]; G.soldiers.push(zb); z.remote.set(st[0], zb); }
    zb.setNet(st);
  }
  for (const [id, zb] of z.remote) if (!seen.has(id)) { z.remote.delete(id); if (zb.alive) { zb.alive = false; zb.dispose(); } }
}
function sendZombieState() {
  const out = [];
  for (const s of G.soldiers) if (s.isZombie && s.alive) out.push([s.zid, +s.pos.x.toFixed(2), +s.pos.y.toFixed(2), +s.pos.z.toFixed(2), +s.yaw.toFixed(2), s.atkT > 0 ? 1 : 0, ZK.indexOf(s.kind)]);
  net.send({ t: 'zs', z: out });
}
// Boshqa o'yinchining o'qi zombiga tegdi (jon hisobi xostda yuritiladi)
function onZombieHit(o) {
  const z = G.zg;
  if (!z || !z.host) return;
  const zb = G.soldiers.find((s) => s.isZombie && s.zid === o.z && s.alive);
  const r = remotes.get(o.by);
  if (zb) zb.damage(o.dmg, r ? r.pos : null, !!o.head, { id: o.by, team: 'remote' }, o.kind);
}
function onZombieDead(o) {
  const zb = G.soldiers.find((s) => s.isZombie && s.zid === o.z);
  if (zb && zb.alive) { zb.alive = false; zb.deadT = 0; zb.fallDir = Math.random() < 0.5 ? 1 : -1; zb.fallSpin = (Math.random() - 0.5) * 0.8; for (const m of zb.mats) if (m.emissive) m.emissive.setHex(0); }
  if (G.zg) G.zg.remote.delete(o.z);
  if (o.by === G.myId) { G.kills++; if (o.head) G.headshots++; popup(o.head ? '+30' : '+20'); hitmarker(true); sound.kill(); }
  if (o.by) feed(nameOf(o.by), o.by === G.myId ? 'me' : 'al', 'Zombi', 'en', o.head ? '⦿' : '☠');
}

// ---------- Granatalar ----------
class Grenade {
  constructor(pos, vel, team, owner, fuse) {
    this.pos = pos.clone(); this.vel = vel.clone(); this.team = team; this.owner = owner;
    this.fuse = fuse > 0 ? fuse : team === 'enemy' ? 3.3 : 2.8; this.dead = false;
    const g = new THREE.Group();
    if (G.era === 'historical') {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 8), new THREE.MeshStandardMaterial({ color: 0x333833 }));
      h.position.y = 0.08; g.add(h);
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0x6a4a2a })));
    } else {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3e4a32, roughness: 0.6 })));
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.mesh = g; G.scene.add(g);
  }
  update(dt) {
    this.fuse -= dt;
    if (this.fuse <= 0) {
      this.dead = true; G.scene.remove(this.mesh);
      explode(this.pos, this.team === 'enemy' ? 'enemy' : this.team === 'remote' ? 'remote' : 'player', { owner: this.owner, kind: 'grenade', visual: this.team === 'remote', friendly: G.mp });
      return;
    }
    this.vel.y -= 18 * dt;
    for (const ax of ['x', 'y', 'z']) {
      const old = this.pos[ax];
      this.pos[ax] += this.vel[ax] * dt;
      if (G.world.pointInBox(this.pos)) {
        this.pos[ax] = old;
        if (Math.abs(this.vel[ax]) > 2) sound.bounce(relToPlayer(this.pos).dist);
        this.vel[ax] *= -0.35;
        for (const o of ['x', 'y', 'z']) if (o !== ax) this.vel[o] *= 0.8;
      }
    }
    const gy = G.world.baseHeight(this.pos.x, this.pos.z) + 0.07;
    if (this.pos.y < gy) {
      this.pos.y = gy;
      if (this.vel.y < -2.5) sound.bounce(relToPlayer(this.pos).dist);
      this.vel.y *= -0.3; this.vel.x *= 0.65; this.vel.z *= 0.65;
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.x += this.vel.length() * dt * 2;
  }
}
function spawnGrenade(pos, vel, team, owner, fuse) { G.grenades.push(new Grenade(pos, vel, team, owner, fuse)); }

function explode(pos, team, o = {}) {
  const R = o.radius || 7, D = o.dmg || 230;
  G.fx.explosion(pos, o.scale || 1);
  const rp = relToPlayer(pos);
  sound.explosion(rp.dist, rp.pan, o.scale > 1);
  G.shake = Math.max(G.shake, clamp(1.5 - rp.dist / 22, 0, 1.5));
  if (rp.dist < 9) G.flashA = Math.max(G.flashA || 0, 0.5 * (1 - rp.dist / 9));
  if (o.visual) return;
  const c = _tmp.copy(pos); c.y += 0.5;
  const cc = c.clone();
  for (const s of G.soldiers) {
    if (!s.alive) continue;
    if (team === 'player' && s.team === 'ally') continue;
    if (team === 'enemy' && s.team === 'enemy') continue;
    const ap = s.getAimPoint(new THREE.Vector3());
    const d = cc.distanceTo(ap);
    if (d < R && G.world.los(cc, ap)) s.damage((D * (1 - d / R) + 15) * (s.veh && s.veh.T.shield ? 0.5 : 1), pos, false, team === 'player' ? 'player' : o.owner, o.kind || 'grenade');   // zenit to'pchisini qalqon va qum qoplari yarim himoya qiladi
  }
  if (player.alive && !o.friendly && !(G.inVeh && G.inVeh.T.enclosed)) {
    const ap = player.getAimPoint(new THREE.Vector3());
    const d = cc.distanceTo(ap);
    if (d < R && G.world.los(cc, ap, player.vehBox)) damagePlayer(D * (1 - d / R) * 0.85, pos, null);
  }
  for (const v of G.vehicles) {
    if (!v.alive) continue;
    let dmg = 0, tr = 0;
    const direct = o.directVeh === v;
    if (direct) dmg = o.vdmg || D;
    else { const d = cc.distanceTo(v.center(new THREE.Vector3())), RR = R + 2.5; if (d < RR) dmg = (o.vdmg || D) * 0.5 * (1 - d / RR); }
    if (dmg <= 0 || (G.mp && v === G.inVeh)) continue;
    dmg *= v.T.explMul ?? 1;
    if (v.T.tank) {
      if (direct && o.dir) {
        const f = v.facing(o.dir.x, o.dir.z);
        if (f.zone === 'rear') dmg = Math.max(dmg, v.hp - v.T.hp * BURN_AT + 1);   // orqaga tekkan snaryad tankni darhol yondiradi
        else if (f.zone === 'side') tr = f.bit;                                    // yonga (g'ildirakka) tekkani gusenitsani uzadi
      } else if (!direct && D >= 150 && Math.hypot(pos.x - v.pos.x, pos.z - v.pos.z) < v.T.r + 3.2) tr = v.sideOf(pos);   // yonida portlagan bomba ham
    }
    damageVehicle(v, dmg, team === 'player' ? 'player' : 'enemy', tr);
  }
}

// ---------- Ketma-ket o'ldirish mukofotlari ----------
function buildPlane(era, scale = 1) {
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
function useStreak() {
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
function updateStrikes(dt) {
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
function pickType() {
  const w = G.wave, r = Math.random();
  if (w >= 4 && r < 0.06 + w * 0.012) return 'heavy';
  if (w >= 6 && r < 0.22) return 'sniper';
  if (w >= 5 && r < 0.32) return 'officer';
  if (w >= 2 && r < 0.55) return 'smg';
  return 'rifle';
}
function spawnEnemy(type) {
  const P = player;
  let cand = G.world.spawns.filter((s) => s.distanceTo(P.pos) > 30 && G.world.reachable(s.x, s.z));
  if (!cand.length) cand = G.world.spawns.filter((s) => G.world.reachable(s.x, s.z));
  if (!cand.length) cand = G.world.spawns;
  cand.sort(() => Math.random() - 0.5);
  const eye = new THREE.Vector3(P.pos.x, P.pos.y + P.eyeH, P.pos.z);
  let pick = cand[0];
  for (const c of cand.slice(0, 6)) { if (!G.world.los(eye, new THREE.Vector3(c.x, 1.5, c.z))) { pick = c; break; } }
  const pos = pick.clone().add(new THREE.Vector3(rnd(-1.2, 1.2), 0, rnd(-1.2, 1.2)));
  G.world.collideCircle(pos, 0.4, 0, 1.7);
  G.soldiers.push(new Soldier(G, 'enemy', type, pos));
}
function startWave() {
  G.wave++;
  G.toSpawn = 4 + G.wave * 2 + (G.wave === TOTAL_WAVES ? 6 : 0);
  G.maxAlive = Math.min(4 + G.wave, 12);
  G.waveState = 'fight'; G.spawnT = 0;
  for (const pk of G.pickups) if (pk.taken && !G.weapons.some((w) => w.pid === pk.id)) pk.taken = false;
  if (G.wave === TOTAL_WAVES) { spawnEnemy('heavy'); spawnEnemy('heavy'); spawnEnemy('officer'); }
  sound.horn();
  banner(`TO'LQIN ${G.wave}`, G.wave === TOTAL_WAVES ? "SO'NGGI HUJUM! Barcha kuchlar!" : 'Dushman hujum qilmoqda!', 3);
}
function updateWaves(dt) {
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
    if (G.wave >= TOTAL_WAVES) { endGame(true); return; }
    G.waveState = 'intermission'; G.waveTimer = 12;
    G.supplyReady = true;
    G.grenades_n = Math.max(G.grenades_n, 3);
    spawnAllies();
    banner("TO'LQIN QAYTARILDI", `+${bonus} bonus · Keyingi hujumga tayyorlaning`, 3.5);
    sound.victory();
  }
}

// ---------- Hodisalar ----------
function onSoldierKilled(s, attacker, info) {
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
      if (info.kind !== 'bullet') hitmarker(true);
      sound.kill();
      const icon = { knife: '🔪', grenade: '💣', strike: '✈', rocket: '🚀', shell: '🚀', roadkill: '🚙' }[info.kind] || ((G.inVeh ? G.inVeh.T.name : cur().def.name) + (info.head ? ' ⦿' : ''));
      feed('Siz', 'me', s.name, 'en', icon);
      if (!G.zombie) { G.heat = Math.min(12, (G.heat || 0) + 1); G.heatT = 10; }   // ketma-ket o'ldirishlar dushman zarbasini kuchaytiradi
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
function shieldBlocks(v, dir) {
  const L = Math.hypot(dir.x, dir.z) || 1;
  return -(dir.x * Math.sin(v.aimYaw) + dir.z * Math.cos(v.aimYaw)) / L > Math.cos(v.T.shield);
}
// Kuchayib ketgan o'yinchi (yakka o'yin): ketma-ket o'ldirishlar "qizish"ni oshiradi — dushman zarbasi 40% gacha kuchayadi; tinch turilsa pasayadi
const heatMul = () => (G.mp || G.zombie ? 1 : 1 + Math.min(0.4, 0.06 * Math.max(0, (G.heat || 0) - 3)));
function damagePlayer(amount, from, src, direct) {
  const P = player;
  if (!P.alive || G.state !== 'playing') return;
  if (!direct) amount *= heatMul();
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
  P.hp -= amount; P.lastHurt = G.time;
  hitPunch(amount);
  G.hurtPulse = Math.min(1, G.hurtPulse + amount / 35);
  G.shake = Math.max(G.shake, 0.22);
  sound.hurt();
  if (from) addDmgIndicator(from);
  if (P.hp <= 0) { P.hp = 0; P.alive = false; P.deathT = 0; sound.defeat(); mouse.L = mouse.R = false; }
}

function endGame(victory) {
  G.state = 'over';
  stopEngines();
  if (document.pointerLockElement) document.exitPointerLock();
  $('hud').classList.add('hidden'); $('scope').style.display = 'none';
  const rec = JSON.parse(localStorage.getItem('zj_rec') || '{}');
  const isRec = !G.zombie && G.score > 0 && (!rec[G.era] || G.score > rec[G.era].score);
  if (isRec) { rec[G.era] = { score: G.score, wave: G.wave }; localStorage.setItem('zj_rec', JSON.stringify(rec)); }
  $('btnAgain').textContent = 'Qayta jang';
  $('endTitle').textContent = G.zombie ? (victory ? 'EVAKUATSIYA QILINDINGIZ!' : 'SIZ ZOMBIGA AYLANDINGIZ') : victory ? "G'ALABA!" : 'SIZ HALOK BO\'LDINGIZ';
  $('endTitle').style.color = victory ? '#ffcc55' : '#ff5b4b';
  $('endSub').textContent = G.zombie
    ? (victory ? "Vertolyot sizni olib ketdi. Tun ortda qoldi." : `Siz ${'ABCD'[Math.min(3, G.zg ? G.zg.stage : 0)]} va ${G.zg ? G.zg.target.id : 'B'} punktlari orasida halok bo'ldingiz. Yana urinib ko'ring!`)
    : victory
    ? (G.era === 'historical' ? "Shaharcha ozod qilindi. Vzvodingiz qahramonlik ko'rsatdi!" : 'Operatsiya muvaffaqiyatli yakunlandi. Baza zararsizlantirildi!')
    : `To'lqin ${G.wave} da halok bo'ldingiz. Yana urinib ko'ring, askar!`;
  const acc = G.shots ? Math.round((G.hits / G.shots) * 100) : 0;
  const mm = Math.floor(G.time / 60), ss = Math.floor(G.time % 60).toString().padStart(2, '0');
  $('endStats').innerHTML = [
    ['Ochko', G.score + (isRec ? ' ★' : '')], G.zombie ? ['Punkt', G.zg ? 'ABCD'[Math.min(3, G.zg.stage)] : 'A'] : ["To'lqin", `${G.wave}/${TOTAL_WAVES}`],
    ["O'ldirishlar", G.kills], ["Boshga o'qlar", G.headshots],
    ['Aniqlik', acc + '%'], ['Vaqt', `${mm}:${ss}`],
    ['Qiyinlik', G.diff.name], ['Davr', G.era === 'historical' ? '1944' : '2026'],
  ].map(([a, b]) => `<div>${a}<span>${b}</span></div>`).join('');
  show('end');
  if (victory) sound.victory();
}

// O'q tekkanda nishon siljiydi (zarba kuchiga qarab)
function hitPunch(amount) {
  const k = Math.min(1, amount / 40);
  G.kickPitch += 0.035 * k * (0.6 + Math.random() * 0.8);
  player.yaw += (Math.random() - 0.5) * 0.03 * k;
}

// ---------- HUD yordamchilari ----------
function banner(title, sub, dur) {
  $('cmTitle').textContent = title; $('cmSub').textContent = sub;
  $('centerMsg').style.opacity = 1; G.bannerT = dur;
}
function popup(text, hs = false) {
  const d = document.createElement('div');
  d.textContent = text; if (hs) d.className = 'hs';
  $('popups').appendChild(d);
  setTimeout(() => d.remove(), 1200);
}
function feed(a, ac, b, bc, icon) {
  const d = document.createElement('div');
  d.className = 'kf';
  d.innerHTML = `<span class="${ac}">${esc(a)}</span><span class="ic">[${esc(icon)}]</span><span class="${bc}">${esc(b)}</span>`;
  $('killfeed').appendChild(d);
  while ($('killfeed').children.length > 6) $('killfeed').firstChild.remove();
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 500); }, 5000);
}
let hmT = 0;
function hitmarker(kill) {
  hmT = kill ? 0.3 : 0.15;
  const h = $('hitmarker'); h.classList.toggle('kill', !!kill); h.style.opacity = 1;
}
function addDmgIndicator(from) {
  const el = document.createElement('div'); el.className = 'di';
  $('dmgInd').appendChild(el);
  G.dmgInds.push({ el, pos: from.clone(), t: 1.4 });
}
function buildSlots() {
  $('weaponSlots').innerHTML = `<div class="cls">${G.isZ ? '☣ Zombi' : G.zombie ? 'Tirik qolgan' : CLASSES[G.cls].name}</div>` + G.weapons.map((w, i) => G.isZ && w.locked ? '' :   // zombi-o'yinchida faqat panjalar ko'rsatiladi
    `<div class="${i === G.wi ? 'on' : ''}${w.def.kind === 'throw' && G.grenades_n <= 0 ? ' empty' : ''}">${i + 1} ${w.def.short || w.def.name}${w.def.kind === 'throw' ? ' ×' + G.grenades_n : ''}</div>`).join('');
}
function updateStreakHUD() {
  const list = STREAKS[G.era];
  let html = G.streakReady.map((s) => `<div class="rdy">[B] ${s.name}</div>`).join('');
  const next = list.find((s) => s.k > G.streak);
  if (next) html += `<div class="prog">${next.name}: ${G.streak}/${next.k}</div>`;
  $('streaks').innerHTML = html;
}
function relToPlayer(p) {
  const P = player;
  const rx = p.x - P.pos.x, rz = p.z - P.pos.z;
  const dist = Math.sqrt(rx * rx + rz * rz + (p.y - P.pos.y) ** 2);
  const right = rx * Math.cos(P.yaw) - rz * Math.sin(P.yaw);
  const fwd = -rx * Math.sin(P.yaw) - rz * Math.cos(P.yaw);
  return { dist, pan: dist > 0.1 ? right / Math.max(dist, 1) : 0, angle: Math.atan2(right, fwd) };
}
function useSupply() {
  if (G.zombie || !G.supplyReady || player.pos.distanceTo(G.world.supplyPos) > 2.8) return;   // zombi rejimida o'q-dori cheklangan
  for (const w of G.weapons) { if (isGun(w) && !w.def.special) w.reserve = w.def.reserve; }
  G.grenades_n = 4;
  G.supplyReady = false;
  sound.reload('in');
  popup("O'Q-DORI TO'LDIRILDI");
}

// ---------- Mini xarita va kompas ----------
const mm = $('minimap').getContext('2d');
const cp = $('compass').getContext('2d');
function drawMinimap() {
  const P = player, ctx = mm, S = 200, sc = 1.15, hf = G.world.half;
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = G.era === 'historical' ? 'rgba(30,36,40,0.78)' : 'rgba(50,42,30,0.78)'; ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2); ctx.scale(sc, sc); ctx.rotate(P.yaw); ctx.translate(-P.pos.x, -P.pos.z);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(-4, -hf, 8, hf * 2); ctx.fillRect(-hf, -4, hf * 2, 8);
  for (const r of G.world.mapRects) { ctx.fillStyle = r.c || (r.h > 3 ? 'rgba(180,180,170,0.55)' : 'rgba(150,150,140,0.35)'); ctx.fillRect(r.x, r.z, r.w, r.d); }
  ctx.strokeStyle = 'rgba(255,200,80,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(-hf, -hf, hf * 2, hf * 2);
  if (G.supplyReady) { ctx.fillStyle = '#5f5'; ctx.fillRect(G.world.supplyPos.x - 1.2, G.world.supplyPos.z - 1.2, 2.4, 2.4); }
  if (G.zg) {
    // punktlar (joriy nishon yorqinroq) va ochilmagan qurol yashiklari
    const tp = G.zg.target;
    for (const pt of G.world.points) { ctx.globalAlpha = pt === tp ? 1 : 0.35; ctx.strokeStyle = ctx.fillStyle = pt.id === 'D' ? '#7dff9a' : '#ffcc55'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(pt.x, pt.z, 6, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(pt.x, pt.z, 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (!G.isZ) for (const c of G.world.crates) { if (c.open) continue; ctx.fillStyle = '#9dff7a'; ctx.fillRect(c.x - 1.2, c.z - 1.2, 2.4, 2.4); }
  }
  for (const s of G.soldiers) {
    if (!s.alive || s.hidden) continue;
    if (G.zombie) {
      const zomb = !!(s.isZombie || s.isZ), far = Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z) > 24 && !((G.world.flashF || 0) > 0.05);
      if (G.isZ) { if (zomb) continue; ctx.fillStyle = '#7fd3ff'; }       // zombi-o'yinchi odamlarni ko'radi
      else if (zomb) { if (far) continue; ctx.fillStyle = '#ff4433'; }   // odam: faqat yaqindagi zombilar (chaqmoqda — hammasi)
      else ctx.fillStyle = '#7fe08a';                                     // sheriklar
      ctx.beginPath(); ctx.arc(s.pos.x, s.pos.z, 1.6, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    if (s.team === 'ally') { ctx.fillStyle = '#7fe08a'; }
    else {
      const recent = G.time - s.lastFired < 1.8;
      if (!(G.uavT > 0 || recent || (G.mp && (G.mpFlag.h === s.id || s.streak >= 3)))) continue;   // 3+ ketma-ket o'ldirgan o'yinchi xaritada ko'rinadi
      ctx.fillStyle = '#ff4433';
    }
    ctx.beginPath(); ctx.arc(s.pos.x, s.pos.z, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  if (G.mp && G.flag && G.flag.g.visible) {
    const fp = G.flag.g.position;
    ctx.fillStyle = '#ffcc33'; ctx.fillRect(fp.x - 0.3, fp.z - 3.2, 0.6, 3.6); ctx.fillRect(fp.x, fp.z - 3.2, 2.6, 1.7);
    ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(fp.x, fp.z, 2.4, 0, Math.PI * 2); ctx.stroke();
  }
  for (const pk of G.pickups) { if (pk.taken) continue; ctx.fillStyle = '#c98bff'; ctx.fillRect(pk.pos.x - 1.3, pk.pos.z - 1.3, 2.6, 2.6); }
  for (const v of G.vehicles) {
    if (!v.alive) continue;
    const occ = v.seats.some((s) => s != null);
    ctx.fillStyle = ctx.strokeStyle = v === G.inVeh ? '#7fd3ff' : G.mp && occ ? '#ff4433' : '#f0f0f0';
    if (v.type === 'heli') { ctx.fillRect(v.pos.x - 3.2, v.pos.z - 0.6, 6.4, 1.2); ctx.fillRect(v.pos.x - 0.6, v.pos.z - 3.2, 1.2, 6.4); }
    else if (v.type === 'chinook') { const sx = Math.sin(v.yaw) * 3, sz = Math.cos(v.yaw) * 3; for (const k of [-1, 1]) { ctx.fillRect(v.pos.x + sx * k - 2.6, v.pos.z + sz * k - 0.5, 5.2, 1); ctx.fillRect(v.pos.x + sx * k - 0.5, v.pos.z + sz * k - 2.6, 1, 5.2); } }
    else if (v.T.tank) {
      ctx.fillRect(v.pos.x - 2.3, v.pos.z - 2.3, 4.6, 4.6);
      ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(v.pos.x, v.pos.z); ctx.lineTo(v.pos.x + Math.sin(v.aimYaw) * 5.5, v.pos.z + Math.cos(v.aimYaw) * 5.5); ctx.stroke();
    }
    else if (v.type === 'truck') { ctx.save(); ctx.translate(v.pos.x, v.pos.z); ctx.rotate(-v.yaw); ctx.fillRect(-1.5, -4.4, 3, 8.2); ctx.restore(); }
    else if (v.T.car) { const h = v.type === 'quad' ? 1.0 : 1.6; ctx.fillRect(v.pos.x - h, v.pos.z - h, h * 2, h * 2); }
    else { ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(v.pos.x, v.pos.z, 1.7, 0, Math.PI * 2); ctx.stroke(); }
  }
  for (const g of G.grenades) { ctx.fillStyle = g.team === 'enemy' ? '#ffaa00' : '#ffee88'; ctx.beginPath(); ctx.arc(g.pos.x, g.pos.z, 1.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // o'yinchi
  ctx.save(); ctx.translate(S / 2, S / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 90, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (G.uavT > 0) { ctx.fillStyle = '#ff6655'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('RAZVEDKA ' + Math.ceil(G.uavT), S / 2, S - 14); }
}
function drawCompass() {
  const ctx = cp, W = 480, Hh = 34;
  ctx.clearRect(0, 0, W, Hh);
  const grd = ctx.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.2, 'rgba(0,0,0,0.35)'); grd.addColorStop(0.8, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, Hh);
  const h = ((-player.yaw * 180) / Math.PI % 360 + 360) % 360;
  const ppd = W / 180;
  ctx.textAlign = 'center'; ctx.font = 'bold 13px Arial';
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let a = 0; a < 360; a += 15) {
    let d = a - h; while (d > 180) d -= 360; while (d < -180) d += 360;
    if (Math.abs(d) > 88) continue;
    const x = W / 2 + d * ppd, al = 1 - Math.abs(d) / 90;
    ctx.globalAlpha = al;
    ctx.fillStyle = labels[a] && a % 90 === 0 ? '#ffcc55' : '#fff';
    if (labels[a]) ctx.fillText(labels[a], x, 22);
    else { ctx.fillRect(x - 0.5, 14, 1, 8); }
  }
  ctx.globalAlpha = 1;
  if (G.mp && G.flag && G.flag.g.visible) {
    const d = (relToPlayer(G.flag.g.position).angle * 180) / Math.PI;
    if (Math.abs(d) < 88) { ctx.fillStyle = '#ffcc33'; ctx.font = 'bold 16px Arial'; ctx.fillText('⚑', W / 2 + d * ppd, 16); }
  }
  if (G.zg && !G.isZ) {   // zombi rejimi: keyingi punkt yo'nalishi
    const tp = G.zg.target, d = (relToPlayer(new THREE.Vector3(tp.x, player.pos.y, tp.z)).angle * 180) / Math.PI;
    ctx.fillStyle = tp.id === 'D' ? '#7dff9a' : '#ffcc55'; ctx.font = 'bold 15px Arial';
    ctx.fillText(tp.id, W / 2 + clamp(d, -86, 86) * ppd, 16);
  }
  ctx.fillStyle = '#ffcc55'; ctx.beginPath(); ctx.moveTo(W / 2 - 5, 0); ctx.lineTo(W / 2 + 5, 0); ctx.lineTo(W / 2, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.fillText(Math.round(h) + '°', W / 2, 33);
}

// ---------- O'yinchi yangilanishi ----------
function updatePlayer(dt) {
  const P = player;
  if (!P.alive) {
    P.deathT += dt;
    if (P.deathT > 3 && G.state === 'playing' && !G.mp) endGame(false);
    $('prompt').style.display = 'none';
    return;
  }
  if (G.inVeh && !G.inVeh.alive) leaveVehicleLocal();
  if (G.inVeh) {
    // transport ichida: o'rindiqqa bog'langan
    const v = G.inVeh;
    v.seatPos(G.seat, P.pos); P.vel.copy(v.vel); P.onGround = true; P.sprinting = false;
    P.moving = v.vel.lengthSq() > 9; P.crouch = !!(v.T.sit && v.T.sit[G.seat]);
    P.eyeH += ((P.crouch ? 1.05 : 1.62) - P.eyeH) * Math.min(1, dt * 10);
    G.platform = null; G.insideVeh = null;
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
    if (keys.KeyW) fz += 1; if (keys.KeyS) fz -= 1; if (keys.KeyD) fx += 1; if (keys.KeyA) fx -= 1;
    P.crouch = !!G.crouchToggle && !G.chute;
    const shift = keys.ShiftLeft || keys.ShiftRight;
    if (shift && fz > 0 && P.crouch) { G.crouchToggle = false; P.crouch = false; }
    P.sprinting = shift && fz > 0 && !mouse.R && !mouse.L && !P.crouch && G.knifeT <= 0 && G.throwT <= 0 && G.cookT < 0 && !G.chute;
    const def = cur().def;
    let speed = 5.0 * (def.move || 1);
    if (P.sprinting) speed *= 1.6;
    if (P.crouch) speed *= 0.5;
    speed *= 1 - G.ads * 0.45;
    if (G.chute) speed = 5.5;
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    let wx = -sy * fz + cy * fx, wz = -cy * fz - sy * fx;
    const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    const acc = P.onGround ? 11 : 2.5;
    P.vel.x += (wx * speed - P.vel.x) * Math.min(1, acc * dt);
    P.vel.z += (wz * speed - P.vel.z) * Math.min(1, acc * dt);
    if (keys.Space && P.onGround) {
      if (P.crouch) G.crouchToggle = false;
      else { P.vel.y = 6.3; P.onGround = false; }
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
    P.eyeH += ((P.crouch ? 1.05 : 1.62) - P.eyeH) * Math.min(1, dt * 10);
    const hs = Math.hypot(P.vel.x, P.vel.z);
    P.moving = hs > 1;
    if (P.onGround && hs > 1.2) {
      P.bob += hs * dt * 1.9;
      P.stepAcc += hs * dt;
      if (P.stepAcc > (P.sprinting ? 2.7 : 2.1)) { P.stepAcc = 0; sound.step(G.era, P.sprinting); }
    }
  }
  // sog'liq tiklanishi
  if (!G.mp && G.time - P.lastHurt > 4.5 && P.hp < 100) P.hp = Math.min(100, P.hp + 24 * dt);
  if (P.hp < 35) { G.hbT -= dt; if (G.hbT <= 0) { sound.heartbeat(); G.hbT = 0.85; } }
  updatePrompt();
}

// ---------- Parashyut va balanddan yiqilish ----------
function walkVehicleNear() {
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
function groundBelow() {
  const P = player, wv = walkVehicleNear();
  let g = G.world.groundHeight(P.pos.x, P.pos.z, 0.38, P.pos.y, wv ? wv.box : undefined);
  if (wv) g = Math.max(g, wv.walkGround(P.pos, 0.38, P.pos.y));
  return g;
}
// Parashyut o'zi ochilmaydi: havoda [PROBEL] bosilganda ochiladi
function tryChute() {
  const P = player;
  if (G.chute || P.onGround || G.inVeh || !P.alive || P.vel.y > -3) return;
  if (P.pos.y - groundBelow() < 3.5) return;
  G.chute = true; sound.chute();
  banner('PARASHYUT OCHILDI', 'W/A/S/D bilan boshqaring', 2);
}
function fallDamage(dmg) {
  if (!(dmg > 0)) return;
  popup('BALANDDAN YIQILDINGIZ', true);
  if (G.mp) { net.send({ t: 'fall', dmg: Math.round(dmg) }); G.hurtPulse = 1; G.shake = Math.max(G.shake, 0.7); sound.hurt(); }
  else { G.shake = Math.max(G.shake, 0.7); damagePlayer(dmg, null, null, true); }
}

function updateCamera(dt) {
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
    roll = t * 1.1;
  }
  camera.position.set(P.pos.x, eyeY, P.pos.z);
  camera.rotation.set(P.pitch + G.kickPitch + sy + (Math.random() - 0.5) * sh * 0.03, P.yaw + sx + (Math.random() - 0.5) * sh * 0.03, roll);
  aimFov(dt, def, scoped && P.alive);
}
// Mo'ljalga olishdagi yaqinlashtirish, optika qoplamasi va chetlarning qorayishi (piyoda ham, transportda o'z qurolidan otganda ham)
function aimFov(dt, def, sc) {
  const P = player;
  const adsFov = def.adsFov || settings.fov;
  const targetFov = lerp(settings.fov, def.scope ? (G.ads > 0.92 ? adsFov : lerp(settings.fov, 40, G.ads)) : adsFov, def.scope ? 1 : G.ads) * (P.sprinting ? 1.06 : 1);
  camera.fov = lerp(camera.fov, targetFov, Math.min(1, dt * 18));
  camera.updateProjectionMatrix();
  $('scope').style.display = sc ? 'block' : 'none';
  if (sc) {
    // nafas zaxirasi: [Shift] bosib turilganda optika tebranmaydi
    $('scopeBreath').style.width = Math.round((G.breath / 4) * 100) + '%';
    setText('scopeInfo', `${(settings.fov / def.adsFov).toFixed(1)}×  ·  SHIFT — nafasni ushlash`);
  }
  // mo'ljalga olganda ekran chetlari biroz qorayadi — diqqat nishonda
  const av = def.scope ? 0 : G.ads * 0.55;
  if (hudCache.adsVig !== av) { hudCache.adsVig = av; $('adsVig').style.opacity = av; }
}

// ---------- Gilzalar (ko'rinish modeli sahnasida) ----------
const _sv = new THREE.Vector3();
function ejectShell(vm) {
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
function updateShells(dt) {
  for (const sh of G.shells) {
    if (sh.t <= 0) continue;
    sh.t -= dt; sh.v.y -= 6.5 * dt;
    sh.m.position.addScaledVector(sh.v, dt);
    sh.m.rotation.x += sh.r.x * dt; sh.m.rotation.y += sh.r.y * dt; sh.m.rotation.z += sh.r.z * dt;
    if (sh.t <= 0) sh.m.visible = false;
  }
}

function updateWeapon(dt) {
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
  if (hmT > 0) { hmT -= dt; if (hmT <= 0) $('hitmarker').style.opacity = 0; }
  updateShells(dt);

  const busy = G.knifeT > 0 || G.throwT > 0;
  const wantAds = gun && mouse.R && P.alive && G.reloadT <= 0 && G.switchT <= 0 && !busy && !P.sprinting;
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

// O'qotar qurolning ko'rinish modeli: holat (son/mo'ljal), yurish tebranishi, tepki, zatvor, qayta o'qlash
function animGun(dt, W, lower) {
  const d = W.def, vm = W.vm, P = player;
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
function animKnife(equipped) {
  if (knifeVM.claws) { animClaws(); return; }
  const g = knifeVM.group, P = player;
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
function animClaws() {
  const vm = knifeVM, g = vm.group, P = player;
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
function animNade(equipped) {
  const g = nadeVM.group, P = player;
  const quick = !equipped && G.throwT > 0 && !G.thrown;
  const flying = equipped && G.throwT > 0;
  g.visible = P.alive && (quick || (equipped && G.grenades_n > 0 && !(flying && G.throwT < 0.24)));
  if (!g.visible) return;
  nadeVM.pin.visible = !(G.cookT >= 0 || flying || quick);
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

// ---------- HUD ----------
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHUD(dt) {
  const P = player, W = cur();
  updateVehHUD();
  setText('healthNum', Math.ceil(P.hp));
  $('healthFill').style.width = P.hp + '%';
  const gun = isGun(W), kind = W.def.kind;
  setText('weaponName', W.def.name);
  setText('mag', gun ? W.mag : kind === 'throw' ? '×' + G.grenades_n : '—'); setText('reserve', gun ? (W.inf ? '/ ∞' : '/ ' + W.reserve) : '');
  $('mag').classList.toggle('low', gun ? W.mag <= Math.ceil(W.def.mag * 0.25) : kind === 'throw' && G.grenades_n <= 0);
  setText('grenades', G.isZ ? '' : `[G] GRANATA ×${G.grenades_n}`);
  // qo'ldagi qurolning tugmalari doim ekranda
  setText('weaponHint', G.inVeh && !ownGunActive() ? '' : W.def.id === 'claw' ? "Chap tugma — panja urish · O'ng tugma — tishlash · Shift — yugurish" : kind === 'melee' ? "Chap tugma — kesish · O'ng tugma — sanchish"
    : kind === 'throw' ? "Chap tugma — uloqtirish (bosib tursangiz ushlab turiladi) · O'ng tugma — yaqinga"
    : W.def.scope ? "O'ng tugma — optika · Shift — nafasni ushlash · R — o'qlash" : "O'ng tugma — mo'ljalga olish · R — o'qlash · V — pichoq zarbasi");
  if (hudCache.slotN !== G.grenades_n) { hudCache.slotN = G.grenades_n; buildSlots(); }
  if (G.mp) updateMpHUD(dt);
  else if (G.zg) zombieHUD();
  else {
  const alive = G.soldiers.filter((s) => s.alive && s.team === 'enemy').length;
  setText('waveLabel', `TO'LQIN ${Math.max(1, G.wave)}/${TOTAL_WAVES}`);
  setText('enemyLabel', G.waveState === 'fight' ? `Dushmanlar: ${alive + G.toSpawn}` : 'Tanaffus');
  setText('scoreLabel', G.score.toLocaleString('ru-RU'));
  setText('objective', (G.waveState === 'intermission'
    ? `Keyingi to'lqin: ${Math.ceil(G.waveTimer)} s${G.supplyReady ? " · O'q-dori qutisi markazda [E]" : ''}`
    : G.wave === TOTAL_WAVES ? "So'nggi to'lqin — maydonni ushlab turing!" : 'Dushman hujumini qaytaring')
    + (heatMul() > 1.001 ? ` · 🔥 Ketma-ket ${G.heat}: dushman zarbasi +${Math.round((heatMul() - 1) * 100)}%` : ''));
  }
  let hint = '';
  if (G.inVeh && !ownGunActive()) hint = '';
  else if (G.cookT >= 0) hint = `HALQA SUG'URILDI — ${Math.max(0, NADE.fuse - G.cookT).toFixed(1)} s`;
  else if (!gun) hint = '';
  else if (G.reloadT > 0) hint = "QAYTA O'QLANMOQDA...";
  else if (W.mag === 0 && W.reserve === 0) hint = "O'Q-DORI YO'Q";
  else if (W.mag < W.def.mag && W.mag <= Math.floor(W.def.mag * 0.25) && W.reserve > 0) hint = "[R] QAYTA O'QLASH";
  setText('reloadHint', hint);
  // shikastlanish effektlari
  G.hurtPulse = Math.max(0, G.hurtPulse - dt * 1.4);
  $('hurt').style.opacity = Math.max(G.hurtPulse, (1 - P.hp / 100) * 0.9);
  G.flashA = Math.max(0, (G.flashA || 0) - dt * 1.2);
  $('flashbang').style.opacity = G.flashA;
  if (G.bannerT > 0) { G.bannerT -= dt; if (G.bannerT <= 0) $('centerMsg').style.opacity = 0; }
  // zarar ko'rsatkichlari
  for (let i = G.dmgInds.length - 1; i >= 0; i--) {
    const d = G.dmgInds[i];
    d.t -= dt;
    if (d.t <= 0) { d.el.remove(); G.dmgInds.splice(i, 1); continue; }
    d.el.style.transform = `rotate(${relToPlayer(d.pos).angle}rad)`;
    d.el.style.opacity = Math.min(1, d.t);
  }
  // granata ogohlantirishi
  let near = null, nd = 8;
  for (const g of G.grenades) { if (g.team === 'player') continue; const dd = g.pos.distanceTo(P.pos); if (dd < nd) { nd = dd; near = g; } }
  const gi = $('grenadeInd');
  if (near) {
    const a = relToPlayer(near.pos).angle;
    gi.style.display = 'block';
    gi.style.transform = `translate(${Math.sin(a) * 110}px, ${-Math.cos(a) * 110}px)`;
  } else gi.style.display = 'none';
  drawMinimap(); drawCompass();
}

// Zombi rejimi (yakka o'yin): qaysi punktga borish kerakligi, masofa, evakuatsiya sanog'i
function zombieHUD() {
  const z = G.zg, tp = z.target, P = player;
  const d = Math.round(Math.hypot(tp.x - P.pos.x, tp.z - P.pos.z));
  setText('waveLabel', 'ZOMBI REJIMI');
  setText('enemyLabel', `Punkt: ${'ABCD'[Math.min(3, z.stage)]} → ${tp.id}`);
  setText('scoreLabel', `☠ ${G.kills}`);
  setText('objective', zObjective(d));
}
function zObjective(d) {
  const z = G.zg, tp = z.target;
  if (z.stage >= 3) return d > tp.r * 1.6 ? `D punktiga qayting — evakuatsiya to'xtab turibdi (${d} m)` : `EVAKUATSIYA: D punktini ushlab turing — ${Math.ceil(z.hold)} s`;
  return `${tp.id} punktiga boring — ${d} m (yorug' ustun)` + (tp.id === 'B' ? ' · u yerda granata va yangi qurollar' : tp.id === 'D' ? ' · evakuatsiya' : '') + (G.torchOn ? '' : " · [L] fonarni yoqing");
}

// ---------- Asosiy sikl ----------
function updateGame(dt) {
  G.time += dt;
  updateVehicles(dt);
  updatePlayer(dt);
  updateCamera(dt);
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
  if (G.chuteMesh) { G.chuteMesh.visible = G.chute && player.alive; G.chuteMesh.position.copy(player.pos); }
  updateStrikes(dt);
  if (G.uavT > 0) G.uavT -= dt;
  if (G.heat > 0) { G.heatT -= dt; if (G.heatT <= 0) { G.heat--; G.heatT = 5; } }   // o'ldirmasdan turilsa "qizish" pasayadi
  if (G.zg) G.zg.update(dt);
  if (G.mp) mpUpdate(dt); else if (!G.zombie) updateWaves(dt);
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
    G.weather.update(dt, camera.position);
  }
  G.fx && G.fx.setScale(camera, renderer.domElement.height);
  updateGunLight(dt);
  renderFrame();
}
// Chizish: keyingi ishlov yoqilgan bo'lsa — post.js orqali (HDR → SSAO → bloom → ton → FXAA), aks holda to'g'ridan-to'g'ri ekranga
function renderFrame() {
  const gun = G.state === 'playing' || G.state === 'paused', lvl = G.scene ? postLevel() : 'off';
  post.setLevel(lvl);
  if (lvl !== 'off') {
    try {
      post.render({ scene: G.scene, camera, gunScene: gun ? wScene : null, gunCamera: wCamera, sunDir: G.world.sunDir, grade: G.world.grade, time: G.time });
      return;
    } catch (e) { console.warn("keyingi ishlov o'chirildi:", e); postForce = 'off'; renderer.setRenderTarget(null); }
  }
  renderer.setRenderTarget(null);
  renderer.clear();
  if (G.scene) renderer.render(G.scene, camera);
  if (gun) {
    renderer.clearDepth();
    renderer.render(wScene, wCamera);
  }
}

// ================= TRANSPORT, RAKETALAR, NOYOB QUROLLAR =================
const PROJ = {
  rocket:  { speed: 75, grav: 0, radius: 6, dmg: 300, vdmg: 600, scale: 1.3, kind: 'rocket' },
  hrocket: { speed: 100, grav: 0, radius: 5, dmg: 200, vdmg: 320, scale: 1.1, kind: 'rocket' },
  shell:   { speed: 190, grav: 3, radius: 5, dmg: 260, vdmg: 450, scale: 1.1, kind: 'shell' },   // zenit pushkasi
  gl:      { speed: 40, grav: 12, radius: 5, dmg: 240, vdmg: 260, scale: 1.0, kind: 'grenade' },
  tshell:  { speed: 150, grav: 2, radius: 6, dmg: 320, vdmg: 700, scale: 1.4, kind: 'shell' },
  lshell:  { speed: 165, grav: 2, radius: 4, dmg: 170, vdmg: 380, scale: 1.0, kind: 'shell' },   // yengil tank pushkasi
};
const VW = {
  heliMg: { dmg: 24, head: 1.5, range: 350, vehMul: 0.8, rpm: 750, spread: 0.012, sound: 'mg', heat: 0.022 },   // ~3.6 s uzluksiz otishda qizib ketadi
  doorMg: { dmg: 30, head: 1.5, range: 300, vehMul: 0.8, rpm: 650, spread: 0.01, sound: 'mg', heat: 0.02 },
  tankMg: { dmg: 26, head: 1.5, range: 300, vehMul: 0.6, rpm: 600, spread: 0.012, sound: 'mg' },
};
const SEAT_HINTS = {
  heli0: "W/S/A/D — uchish · PROBEL/SHIFT — balandlik · Chap tugma: pulemyot (qiziydi) · O'ng tugma: raketa (12 ta) · F — chiqish",
  heli1: 'Sichqoncha — nishon · Chap tugma: bort pulemyoti (qiziydi) · F — chiqish',
  heli2: 'Chap eshik oldida · F — chiqish',
  heli3: "O'ng eshik oldida · F — chiqish",
  chinook0: "W/S/A/D — uchish · PROBEL/SHIFT — balandlik · Qurolsiz transport · F — o'rindan turish",
  chinook1: "Ikkinchi uchuvchi: uchuvchi safdan chiqsa, boshqaruv avtomatik sizga o'tadi · F — o'rindan turish",
  chinook2: "Sichqoncha — nishon · Chap tugma: bort pulemyoti (qiziydi) · F — o'rindan turish",
  chinook3: "Sichqoncha — nishon · Chap tugma: bort pulemyoti (qiziydi) · F — o'rindan turish",
  chinook4: "Yo'lovchi · F — o'rindan turish (orqa rampadan sakrash mumkin)",
  chinook5: "Yo'lovchi · F — o'rindan turish (orqa rampadan sakrash mumkin)",
  jeep0: 'W/S — gaz/tormoz · A/D — burilish · F — chiqish',
  jeep1: 'Sichqoncha — nishon · Chap tugma: pulemyot · F — chiqish',
  cannon0: "Sichqoncha — nishon · Chap tugma: o'q uzish · qalqon olddan kelgan o'qdan to'sadi · F — chiqish",
  tank0: "W/S — oldinga/orqaga · A/D — burilish · Sichqoncha — minora · Chap tugma: pushka · O'ng tugma: pulemyot · F — chiqish",
  tank1: 'Sichqoncha — nishon · Chap tugma: komandir pulemyoti · F — chiqish',
  ltank0: "W/S — oldinga/orqaga · A/D — burilish · Sichqoncha — minora · Chap tugma: tez otar pushka · O'ng tugma: pulemyot · F — chiqish",
  ltank1: 'Sichqoncha — nishon · Chap tugma: komandir pulemyoti · F — chiqish',
  quad0: 'W/S — gaz/tormoz · A/D — burilish · F — chiqish',
  quad1: "Yo'lovchi · F — chiqish",
  truck0: "W/S — gaz/tormoz · A/D — burilish · Kuzovga orqa zinadan yurib chiqiladi · F — chiqish",
  truck1: "Yo'lovchi (kabinada) · F — chiqish",
};
// ---------- Ko'rinish: 1-shaxs / 3-shaxs (har bir vazifa uchun alohida eslab qolinadi) ----------
G.viewPref = (() => { try { return JSON.parse(localStorage.getItem('zj_view') || '{}') || {}; } catch (e) { return {}; } })();
function vehFP(v = G.inVeh, seat = G.seat) {
  if (!v) return false;
  const role = v.T.roles[seat], pref = G.viewPref[role];
  return pref === undefined ? role === 'gunner' || role === 'pass' : !!pref;   // boshlang'ich holat: o'qchi va yo'lovchi — 1-shaxs (qurol qo'lda), haydovchi/uchuvchi — 3-shaxs
}
// Transport ichida o'z qurolidan otish: yo'lovchi o'rnida — doim, o'qchi o'rnida — g'ildirak bilan tanlanganda. Faqat 1-shaxs ko'rinishida.
function ownGunActive() {
  const v = G.inVeh;
  if (!v || !player.alive || !vehFP()) return false;
  const role = v.T.roles[G.seat];
  return role === 'pass' || (role === 'gunner' && !!G.ownGun);
}
function seatGuns() { const out = []; G.weapons.forEach((w, i) => { if (isGun(w) && !w.locked) out.push(i); }); return out; }
// G'ildirak: yo'lovchi — o'z qurollari orasida; o'qchi — bort pulemyoti va o'z qurollari orasida almashtiradi
function cycleSeatGun(dir) {
  const v = G.inVeh, role = v.T.roles[G.seat];
  if (role !== 'pass' && role !== 'gunner') return;
  if (!vehFP()) { popup("Otish uchun 1-shaxs ko'rinishiga o'ting — [V]", true); return; }
  const guns = seatGuns();
  if (!guns.length) return;
  const list = role === 'gunner' ? [-1].concat(guns) : guns;   // −1 — bort pulemyoti
  let k = list.indexOf(role === 'gunner' && !G.ownGun ? -1 : G.wi);
  k = ((k < 0 ? 0 : k) + dir + list.length) % list.length;
  if (list[k] < 0) { G.ownGun = false; G.reloadT = 0; popup('Bort pulemyoti'); sound.reload('out'); return; }
  G.ownGun = true;
  if (list[k] !== G.wi) switchWeapon(list[k]); else G.switchT = 0.3;
  popup(cur().def.name);
}
// ---------- Transportdagi o'z personajimiz (3-shaxs ko'rinishida) ----------
function setupAvatar() {
  const av = { s: 1, crouchAmt: 0, walkPhase: 0, gunKick: 0, fallDir: 1, fallSpin: 0 };
  // boshqalar bizni qanday ko'rsa, o'zimiz ham shunday ko'ramiz
  const lk = G.mp && G.mpMode !== 'zombie' ? ['remote', 'rifle'] : ['ally', 'ally'];
  av.root = makeSoldierModel(av, G.era, lk[0], lk[1]);
  av.root.visible = false; G.scene.add(av.root);
  G.avatar = av;
}
function updateAvatar(dt) {
  const av = G.avatar, v = G.inVeh;
  if (!av) return;
  const show = !!v && v.alive && player.alive && !vehFP();
  av.root.visible = show;
  if (!show) return;
  const role = v.T.roles[G.seat], aimer = role === 'gunner' || role === 'pass';
  v.seatPos(G.seat, av.root.position);
  av.root.rotation.y = aimer ? player.yaw + Math.PI : v.type === 'cannon' ? v.aimYaw : v.yaw;
  av.crouchAmt = v.T.sit && v.T.sit[G.seat] ? 1 : 0; av.sit = av.crouchAmt === 1;
  animateSoldier(av, dt, 0, aimer, aimer ? player.pitch : 0);
}
function toggleVehView() {
  const v = G.inVeh;
  if (!v) return;
  const fp = !vehFP();
  G.viewPref[v.T.roles[G.seat]] = fp ? 1 : 0;
  localStorage.setItem('zj_view', JSON.stringify(G.viewPref));
  G.vAim = null;
  popup(fp ? "1-shaxs ko'rinishi" : "3-shaxs ko'rinishi");
  sound.ui();
}
G.vehicles = []; G.projectiles = []; G.pickups = []; G.inVeh = null; G.seat = -1; G.chute = false; G.playerPit = -1;
G.aimPt = new THREE.Vector3(); G.vAim = null; G.chuteMesh = null;
G.vehicleCrash = (v, dmg) => damageVehicle(v, dmg, 'self');
G.spawnProjectile = (pos, vel, kind, team) => spawnProjectile(pos, vel, kind, team, null, false);
G.canEnemyRocket = () => {
  if (G.time - (G.lastEnemyRocket || -99) < 5) return false;
  G.lastEnemyRocket = G.time; return true;
};
const ME = () => (G.mp ? G.myId : 1);
const _pd = new THREE.Vector3(), _pwh = { point: new THREE.Vector3(), normal: new THREE.Vector3(), dist: 0 };

function stopEngines() { for (const v of G.vehicles) if (v.snd) { v.snd.stop(); v.snd = null; } }

function setupExtras(spawns) {
  stopEngines();
  G.vehicles = (spawns || []).map((s, i) => new Vehicle(G, i, s.type, s.x, s.z, s.yaw));
  G.projectiles = []; G.inVeh = null; G.seat = -1; G.chute = false; G.vFireT = 0; G.vAltT = 0; G.enterT = -9; G.seatT = -9; G.alarmT = 0; G.playerPit = -1; G.vAim = null; G.gunHeat = newGun();
  G.platform = null; G.insideVeh = null; G.seatPick = 0; G.pickVeh = null;
  player.vehBox = null;
  G.pickups = G.world.pickups.map((p) => {
    const def = G.specials[p.id % G.specials.length];
    const g = new THREE.Group();
    const vm = buildViewmodel(def, G.era, true);
    vm.group.scale.setScalar(1.5); vm.group.position.set(0, 0.1, 0.45);
    g.add(vm.group);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, color: 0xc98bff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    glow.scale.set(2.2, 2.2, 1); g.add(glow);
    g.position.copy(p.pos); G.scene.add(g);
    return { id: p.id, pos: p.pos, def, taken: false, respT: 0, mesh: g };
  });
  G.chuteMesh = buildChute(G.era); G.scene.add(G.chuteMesh);
  setupAvatar();
}

// ---------- O'tirish / chiqish ----------
function freeSeat(v) { for (let i = 0; i < v.T.seats; i++) if (v.seats[i] == null) return i; return -1; }
// Transportning shu o'rnida o'tirgan raqib (tarmoqda). O'zimiz yoki bo'sh o'rin — null.
function occupantAt(v, seat) {
  const id = v.seats[seat];
  if (id == null || id === ME()) return null;
  const r = remotes.get(id);
  return r && r.alive ? r : null;
}
function nearestVehicle() {
  let best = null, bd = 1e9;
  for (const v of G.vehicles) {
    if (!v.alive || freeSeat(v) < 0) continue;
    const d = v.pos.distanceTo(player.pos);
    if (d < v.T.enterR && d < bd) { bd = d; best = v; }
  }
  return best;
}
function tryEnterVehicle() {
  const v = nearestVehicle();
  if (!v || !player.alive) return;
  if (G.isZ) { popup("Zombilar transportga o'tira olmaydi", true); return; }
  const seat = pickedSeat(v);
  if (seat < 0) return;
  if (G.mp) { net.send({ t: 'venter', v: v.id, seat }); return; }
  enterVehicle(v, seat);
}
// O'tirishdan oldin tanlangan o'rin: [Q] bo'sh o'rinlar orasida almashtiradi (masalan, uchuvchi emas — o'qchi)
function pickedSeat(v) {
  const free = [];
  for (let i = 0; i < v.T.seats; i++) if (v.seats[i] == null) free.push(i);
  return free.length ? free[G.seatPick % free.length] : -1;
}
// seat — yangi o'rin. Shu transport ichida bo'lsak, bu o'rin almashtirish (yoki boshqaruvni qabul qilish).
function enterVehicle(v, seat, promoted) {
  if (!v || !v.alive || seat < 0 || seat >= v.T.seats) return;
  const change = G.inVeh === v;
  if (G.inVeh && !change) leaveVehicleLocal();
  if (change && v.seats[G.seat] === ME()) v.seats[G.seat] = null;
  if (!change) { G.enterT = G.time; G.gunHeat = newGun(); }
  G.inVeh = v; G.seat = seat; G.seatT = G.time; G.platform = null; G.insideVeh = null;
  v.seats[seat] = ME();
  if (seat === 0) v.owner = ME();
  player.vehBox = v.box;
  G.reloadT = 0; G.ads = 0; G.chute = false; G.crouchToggle = false; G.knifeT = 0; G.throwT = 0; G.cookT = -1;
  mouse.L = mouse.R = false;
  G.vAim = null; G.ownGun = false;
  const role = v.T.roles[seat];
  if (seat === 0) {
    // kamera transport ortida turadi (boshqaruvni qabul qilganda vertolyot yo'nalishini saqlaydi)
    player.yaw = (v.type === 'cannon' || v.T.tank ? v.aimYaw : v.yaw) + Math.PI;
    player.pitch = v.type === 'cannon' ? 0.05 : v.T.tank ? -0.1 : -0.18;
  } else if (role === 'gunner') {
    // bort o'qchisi o'z eshigi tomonga qaraydi
    v.gunPos(_tmp, seat);
    const c = Math.cos(v.yaw), s = Math.sin(v.yaw), lat = (_tmp.x - v.pos.x) * c - (_tmp.z - v.pos.z) * s;
    player.yaw = lat > 0.8 ? Math.atan2(-c, s) : lat < -0.8 ? Math.atan2(c, -s) : v.yaw + Math.PI;
    player.pitch = -0.15;
  } else { player.yaw = v.yaw + Math.PI; player.pitch = -0.18; }
  sound.door();
  if (promoted) { banner('BOSHQARUV SIZDA!', "Uchuvchi safdan chiqdi — vertolyotni endi siz boshqarasiz", 3.5); sound.alarm(); }
  else banner(v.T.name.toUpperCase(), v.T.seatNames[seat], 2);
}
// Transport ichida o'rin almashtirish: [1–6] — aniq o'rin, [Q] — keyingi bo'sh o'rin
function requestSeat(i) {
  const v = G.inVeh;
  if (!v || i === G.seat || i < 0 || i >= v.T.seats) return;
  if (v.seats[i] != null) { popup(`${i + 1}-o'rin band`, true); return; }
  if (G.mp) net.send({ t: 'vswap', seat: i });
  else enterVehicle(v, i);
}
function cycleSeat() {
  const v = G.inVeh;
  if (!v || v.T.seats < 2) return;
  for (let k = 1; k < v.T.seats; k++) {
    const i = (G.seat + k) % v.T.seats;
    if (v.seats[i] == null) { requestSeat(i); return; }
  }
  popup("Bo'sh o'rin yo'q", true);
}
function leaveVehicleLocal() {
  const v = G.inVeh;
  if (!v) return;
  if (v.seats[G.seat] === ME()) v.seats[G.seat] = null;
  for (const m of v.fpHide) m.visible = true;
  G.inVeh = null; G.seat = -1; player.vehBox = null; G.switchT = 0.4;
  mouse.L = mouse.R = false;
  if (G.weapons) cur().vm.group.visible = true;
}
function exitVehicle() {
  const v = G.inVeh, P = player;
  if (!v) return;
  const high = v.T.fly && v.pos.y - G.world.groundHeight(v.pos.x, v.pos.z, 0.4, v.pos.y, v.box) > 4;
  let stay = null;
  if (high && v.T.walk) {
    // Chinuk havoda: o'rindiqdan turib yuk bo'limida qolamiz — orqa rampadan yurib sakrash mumkin
    v.standPos(G.seat, P.pos); P.vel.set(0, 0, 0); P.onGround = true; stay = v;
    banner("YUK BO'LIMI", 'Orqa rampadan sakrang · havoda [PROBEL] — parashyut', 3);
    sound.door();
  } else if (high) {
    // havoda sakrash: parashyut o'zi ochilmaydi
    v.exitPos(G.seat, P.pos);
    P.pos.y = v.pos.y - 0.5; P.vel.copy(v.vel); P.vel.y = Math.min(P.vel.y, -1); P.onGround = false;
    banner('SAKRADINGIZ!', '[PROBEL] — parashyutni oching', 3);
  } else {
    v.exitPos(G.seat, P.pos);
    P.pos.y = v.pos.y; P.vel.set(0, 0, 0);
    G.world.collideCircle(P.pos, 0.4, P.pos.y, P.pos.y + 1.8);
    sound.door();
  }
  if (G.mp) net.send({ t: 'vexit' });
  leaveVehicleLocal();
  G.platform = stay;
}

// ---------- Shikast va portlash ----------
// Zirh: o'q qaysi tomondan tekkaniga qarab ko'paytuvchi. dir — o'q UCHAYOTGAN yo'nalish ({x, z}).
function armorMul(v, dir, ap) {
  const K = v.T.tank;
  if (K && dir && !v.burning && v.facing(dir.x, dir.z).zone === 'rear') return ap ? 1.6 : K.rearMul;   // orqa zirh yupqa — yonish darajasigacha jon tez ketadi
  return ap ? 1 : v.T.bulletMul ?? 1;
}
// Gusenitsa uzilganda / transport yona boshlaganda effekt va ogohlantirish
function vehicleStatusFx(v, what) {
  if (what === 'track') {
    const up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3();
    for (let i = 0; i < 12; i++) G.fx.impact(p.set(v.pos.x + rnd(-2, 2), v.pos.y + 0.3, v.pos.z + rnd(-2, 2)), up, 'wall');
    const rp = relToPlayer(v.pos);
    if (rp.dist < 60) sound.land();
  }
  if (G.inVeh === v) {
    if (what === 'track') popup('GUSENITSA UZILDI — tank yurmaydi!', true);
    else popup(`${v.T.name.toUpperCase()} YONMOQDA${v.immobile ? ' — yurmaydi' : ''}!`, true);
    sound.alarm();
  }
}
// tr — uzilgan gusenitsa bitlari (1 — chap, 2 — o'ng)
function damageVehicle(v, dmg, by, tr = 0) {
  if (!v || !v.alive || !(dmg > 0 || tr)) return;
  dmg = Math.max(0, dmg);
  if (G.mp) { if (by === 'player' || by === 'self') net.send({ t: 'vhit', v: v.id, dmg: Math.round(dmg), tr }); return; }
  const wasBurning = v.burning;
  v.hp -= dmg;
  if (tr && (v.trackBroken | tr) !== v.trackBroken) { v.setTracks(v.trackBroken | tr); vehicleStatusFx(v, 'track'); }
  if (v.hp <= 0) { v.respT = 45; boomVehicle(v); }
  else if (!wasBurning && v.burning) vehicleStatusFx(v, 'burn');
}
function boomVehicle(v) {
  if (!v.alive) return;
  // o'rindiqda o'tirgan ham, yuk bo'limida piyoda turgan ham halok bo'ladi
  const inside = G.inVeh === v || G.insideVeh === v || G.platform === v;
  const p = v.pos.clone(); p.y += 1.2;
  if (v.snd) { v.snd.stop(); v.snd = null; }
  v.destroy();
  explode(p, 'neutral', { visual: true, scale: 1.7 });
  if (G.inVeh === v) leaveVehicleLocal();
  if (G.platform === v) G.platform = null;
  if (G.insideVeh === v) G.insideVeh = null;
  if (inside && !G.mp) damagePlayer(150, null, null, true);
}
// Zombi rejimi: yoqilg'i va shu o'rindagi qurolning qolgan o'q-dorisi
function vehSupply(v, role) {
  if (!v.limited) return '';
  let s = v.T.fly || v.T.car || v.T.tank ? ` · yoqilg'i ${Math.round(v.fuel * 100)}%${v.fuel <= 0 ? " — TUGADI" : ''}` : '';
  if (role === 'gunner') s += ` · o'q ${v.ammo.d}`;
  else if (G.seat === 0 && v.type === 'heli') s += ` · o'q ${v.ammo.a}`;
  else if (G.seat === 0 && v.T.tank) s += ` · snaryad ${v.ammo.b} · o'q ${v.ammo.a}`;
  else if (v.type === 'cannon') s += ` · snaryad ${v.ammo.b}`;
  return s;
}
function vehStatus(v) {
  let s = '';
  if (v.trackBroken) s += ' · GUSENITSA UZILDI';
  if (v.burning) s += ' · YONMOQDA';
  if (s && v.immobile) s += ' — YURMAYDI';
  return s;
}

// ---------- Har kadr: transport ----------
function updateVehicles(dt) {
  G.vFireT -= dt; G.vAltT -= dt;
  const me = ME(), k = keys;
  for (const v of G.vehicles) {
    if (!v.alive) { if (!G.mp) { v.respT -= dt; if (v.respT <= 0) v.respawn(); } continue; }
    const mine = !G.mp || v.owner === me;
    if (mine) {
      let inp = null;
      if (G.inVeh === v && G.seat === 0) {
        if (player.alive && G.state === 'playing') {
          inp = { fwd: (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), strafe: (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), steer: (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0),
            up: (k.Space ? 1 : 0) - (k.ShiftLeft || k.ShiftRight ? 1 : 0), yaw: player.yaw + Math.PI, pitch: player.pitch };
          if (v.type === 'cannon' && G.vAim) { inp.yaw = G.vAim.yaw; inp.pitch = G.vAim.pitch; }
          if (v.T.tank) { inp.aimYaw = G.vAim ? G.vAim.yaw : player.yaw + Math.PI; inp.aimPitch = G.vAim ? G.vAim.pitch : player.pitch; }
        } else if (v.T.fly) inp = { fwd: 0, strafe: 0, steer: 0, up: 0, yaw: v.yaw, pitch: 0 };   // pauza: joyida osilib turadi
      }
      const yaw0 = v.yaw;
      v.simulate(dt, inp);
      if (inp && v.T.car) player.yaw += v.yaw - yaw0 > Math.PI ? v.yaw - yaw0 - Math.PI * 2 : v.yaw - yaw0 < -Math.PI ? v.yaw - yaw0 + Math.PI * 2 : v.yaw - yaw0;
      if (G.mp && v.alive) {
        v.netT = (v.netT || 0) - dt;
        const moving = !!inp || v.vel.lengthSq() > 0.01 || v.rocketReload > 0 || v.gun.heat > 0.01;
        if (v.netT <= 0 && (moving || !v.sentRest)) {
          v.netT = 0.05; v.sentRest = !moving;
          net.send({ t: 'v', id: v.id, x: +v.pos.x.toFixed(2), y: +v.pos.y.toFixed(2), z: +v.pos.z.toFixed(2), yw: +v.yaw.toFixed(3), pt: +v.pitch.toFixed(3), rl: +v.roll.toFixed(3), ay: +v.aimYaw.toFixed(3), ap: +v.aimPitch.toFixed(3),
            rk: v.rockets, rr: +v.rocketReload.toFixed(1), ht: +v.gun.heat.toFixed(2), oh: v.gun.hot ? 1 : 0,
            fu: v.limited ? +v.fuel.toFixed(3) : undefined, aa: v.limited ? v.ammo.a : undefined, ab: v.limited ? v.ammo.b : undefined });
        }
      }
    } else v.remote(dt);
    v.trackMotion();
    if (!v.alive) continue;
    v.visual(dt);
    // dvigatel ovozi
    const active = v.T.fly ? v.rotor > 0.05 : (v.T.car || v.T.tank) && (v.seats[0] != null || Math.abs(v.speed) > 0.5);
    if (active && !v.snd) v.snd = sound.engine(v.T.fly ? 'heli' : v.T.tank || v.type === 'truck' ? 'tank' : 'jeep');
    if (v.snd) {
      if (!active) { v.snd.stop(); v.snd = null; }
      else {
        const dist = G.inVeh === v ? 0 : relToPlayer(v.pos).dist;
        const base = v.T.fly ? v.rotor * (v.type === 'chinook' ? 0.7 : 0.55) : v.T.tank ? 0.45 : v.type === 'truck' ? 0.36 : 0.3;
        v.snd.set((G.inVeh === v ? base * 0.7 : base * 1.6 / (1 + dist * 0.07)), v.T.fly ? v.rotor * (v.type === 'chinook' ? 0.75 : 1) : Math.min(1, Math.abs(v.speed) / (v.T.tank ? v.T.tank.max : v.T.car ? v.T.car.max : 16)));
      }
    }
    // jip bilan bosib ketish
    const tk = !!v.T.tank;
    if ((tk || v.T.car) && mine && G.inVeh === v && G.seat === 0 && Math.abs(v.speed) > (tk ? 2.5 : 6)) {
      const sg = Math.sign(v.speed), fo = tk ? 3.0 : (v.T.car.front || 1.7), fx = v.pos.x + Math.sin(v.yaw) * fo * sg, fz = v.pos.z + Math.cos(v.yaw) * fo * sg;
      for (const s of G.soldiers) {
        if (!s.alive || !hostile(s) || s.hidden || Math.abs(s.pos.y - v.pos.y) > 1.5 || G.time - (s.rkT || -9) < 0.7) continue;
        if (Math.hypot(s.pos.x - fx, s.pos.z - fz) < (tk ? 2.1 : (v.T.car.hitR || 1.6))) { s.rkT = G.time; s.damage(260, v.pos, false, 'player', 'roadkill'); sound.stab(); if (!tk) v.speed *= 0.8; }
      }
    }
  }
  gunCool(G.gunHeat, dt);
  // o'z transportimiz shikastlanganda ogohlantirish
  const mv = G.inVeh;
  if (mv && mv.alive && mv.hp < mv.T.hp * 0.35) { G.alarmT -= dt; if (G.alarmT <= 0) { G.alarmT = 0.9; sound.alarm(); } }
}

// ---------- Transport ichidagi kamera ----------
function vehicleCamera(dt) {
  const v = G.inVeh, P = player;
  G.shake = Math.max(0, G.shake - dt * 1.8);
  G.landDip = 0;
  const own = ownGunActive();   // o'z qurolidan otayotgan yo'lovchi: tepki va mo'ljal piyodadagidek ishlaydi
  if (own) {
    G.kickPitch *= Math.max(0, 1 - dt * 14);
    if (G.time - G.lastShot > 0.12 && G.recoilAcc > 0) { const r = Math.min(G.recoilAcc, G.recoilAcc * dt * 7 + 0.0005); P.pitch -= r * 0.85; G.recoilAcc -= r; }
  } else { G.kickPitch = 0; G.recoilAcc = 0; }
  const sh = G.shake * G.shake, jx = (Math.random() - 0.5) * sh * 0.03, jy = (Math.random() - 0.5) * sh * 0.03;
  const fp = vehFP();
  let roll = 0;
  if (fp) {
    v.eyePos(G.seat, camera.position);
    // uchayotgan vertolyot egilganda ufq ham og'adi
    if (v.T.fly) { const dl = P.yaw - (v.yaw + Math.PI); roll = -(v.roll * Math.cos(dl) + v.pitch * Math.sin(dl)); }
  } else {
    const cpit = Math.cos(P.pitch);
    _f.set(-Math.sin(P.yaw) * cpit, Math.sin(P.pitch), -Math.cos(P.yaw) * cpit);
    const tgt = _tmp.set(v.pos.x, v.pos.y + v.T.camH, v.pos.z);
    _dir.copy(_f).multiplyScalar(-1);
    let dist = v.T.camDist;
    const wh = G.world.rayCast(tgt, _dir, dist + 0.5, _wh, v.box);
    if (wh) dist = Math.max(1.2, wh.dist - 0.4);
    camera.position.copy(tgt).addScaledVector(_dir, dist);
    camera.position.y += 1.3 * (dist / v.T.camDist);
    const floorY = G.world.baseHeight(camera.position.x, camera.position.z) + 0.3;
    if (camera.position.y < floorY) camera.position.y = floorY;
  }
  camera.rotation.set(P.pitch + G.kickPitch + jx, P.yaw + jy, roll);
  if (own) aimFov(dt, cur().def, !!cur().def.scope && G.ads > 0.92);
  else {
    camera.fov = lerp(camera.fov, settings.fov, Math.min(1, dt * 10));
    camera.updateProjectionMatrix();
    $('scope').style.display = 'none';
    if (hudCache.adsVig !== 0) { hudCache.adsVig = 0; $('adsVig').style.opacity = 0; }
  }
  // nishon nuqtasi (ekran markazi qayerga qarayapti)
  camBasis();
  const start = _o.copy(camera.position).addScaledVector(_f, fp ? 0.5 : v.T.camDist + 2.5);
  const hit = G.world.rayCast(start, _f, 500, _wh, v.box);
  let d = hit ? hit.dist : 500;
  for (const s of G.soldiers) { if (!s.alive || !hostile(s)) continue; const h = s.hitTest(start, _f, d); if (h) d = h.dist; }
  G.aimPt.copy(start).addScaledVector(_f, d);
  if (v.type === 'cannon' || v.T.tank) {
    const dx = G.aimPt.x - v.pos.x, dy = G.aimPt.y - (v.pos.y + (v.T.tank ? v.T.tank.pivotY : 1.35)), dz = G.aimPt.z - v.pos.z;
    G.vAim = { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
  }
}

// ---------- Transport qurollari ----------
function vehicleShot(v, mz, W, fromCam) {
  const o = fromCam ? camera.position.clone() : mz.clone();
  _dir.copy(G.aimPt).sub(o).normalize();
  _dir.x += (Math.random() - 0.5) * 2 * W.spread; _dir.y += (Math.random() - 0.5) * 2 * W.spread; _dir.z += (Math.random() - 0.5) * 2 * W.spread;
  _dir.normalize();
  const res = hitscan(o, _dir, W, v.box);
  if (Math.random() < 0.7) G.fx.tracer(mz, res.end, 0xffe6a8, 380);
  if (!fromCam) G.fx.muzzle(mz, 1.1); else G.fx.flash(mz, 0xffb050, 8, 0.06, 10);
  sound.shot(W.sound, 0, 0, false);
  G.shots++;
  if (res.hit) { G.hits++; hitmarker(res.kill && !G.mp); sound.hit(res.head); }
  if (G.mp) net.send({ t: 'shot', a: v3arr(mz), b: v3arr(res.end), s: W.sound });
}
function vehicleProjectile(v, mz, kind, dir) {
  const pr = PROJ[kind];
  if (dir) _dir.copy(dir).normalize(); else _dir.copy(G.aimPt).sub(mz).normalize();
  const vel = _dir.clone().multiplyScalar(pr.speed);
  spawnProjectile(mz, vel, kind, 'player', v.box, false);
  G.fx.muzzle(mz, 1.8);
  sound.shot(pr.kind === 'shell' ? 'cannon' : 'rocket', 0, 0, false);
  G.shake = Math.max(G.shake, 0.25);
  if (G.mp) net.send({ t: 'rocket', p: v3arr(mz), v: v3arr(vel), k: kind });
}
function updateVehicleSeat(dt) {
  const v = G.inVeh, P = player;
  if (hmT > 0) { hmT -= dt; if (hmT <= 0) $('hitmarker').style.opacity = 0; }
  G.ads = 0; G.reloadT = 0; G.kick = Math.max(0, G.kick - dt * 9);
  if (G.flashT > 0) G.flashT -= dt;
  for (const w of G.weapons) w.vm.group.visible = false;
  for (const sh of G.shells) { sh.t = 0; sh.m.visible = false; }
  const role = v.T.roles[G.seat], gunner = role === 'gunner', fp = vehFP();
  const mvm = G.mountVM;
  mvm.group.visible = gunner && fp;
  for (const m of v.fpHide) m.visible = !fp;
  if (gunner && fp) {
    mvm.group.position.set(0, -0.17 + G.kick * 0.006, -0.5 + G.kick * 0.04);
    mvm.group.rotation.set(G.kick * 0.02, 0, 0);
    mvm.flash.visible = G.flashT > 0;
    if (mvm.flash.visible) mvm.flash.rotation.z = Math.random() * 6;
  }
  if (P.alive && G.state === 'playing') {
    if (v.type === 'heli' && G.seat === 0) {
      // Uchuvchi: pulemyot qiziydi; raketa 12 ta, tugagach 15 soniya qayta o'qlanadi
      if (mouse.L && G.vFireT <= 0) {
        if (!useVehAmmo(v, 'a')) G.vFireT = 0.4;
        else if (gunFire(v.gun, VW.heliMg.heat)) {
          G.vFireT = 60 / VW.heliMg.rpm;
          vehicleShot(v, v.muzzle('mg', _mz), VW.heliMg, false);
          if (v.gun.hot) { sound.alarm(); popup('PULEMYOT QIZIB KETDI!', true); }
        } else { G.vFireT = 0.35; sound.empty(); }
      }
      if (mouse.R && G.vAltT <= 0) {
        if (v.rockets > 0) {
          G.vAltT = 0.6; v.rockets--;
          vehicleProjectile(v, v.muzzle('rocket', _mz), 'hrocket');
          if (v.rockets === 0 && v.limited) popup('Raketalar tugadi', true);   // zombi rejimida qayta o'qlanmaydi
          else if (v.rockets === 0) { v.rocketReload = v.T.rocketReload; popup(`Raketalar tugadi — ${v.T.rocketReload} soniya qayta o'qlanadi`, true); }
        } else { G.vAltT = 0.5; sound.empty(); }
      }
    } else if (gunner) {
      if (mouse.L && G.vFireT <= 0) {
        // vertolyotlarning bort pulemyotlari ham qiziydi
        if (!useVehAmmo(v, 'd')) G.vFireT = 0.4;
        else if (!v.T.fly || gunFire(G.gunHeat, VW.doorMg.heat)) {
          G.vFireT = 60 / VW.doorMg.rpm;
          camBasis();
          if (fp) {
            _mz.copy(camera.position).addScaledVector(_f, 0.9).addScaledVector(_u, -0.15);
            vehicleShot(v, _mz, VW.doorMg, true);
          } else {
            // 3-shaxs ko'rinishida o'q kameradan emas, pulemyotning o'zidan chiqadi
            v.gunPos(_mz, G.seat);
            _mz.addScaledVector(_dir.copy(G.aimPt).sub(_mz).normalize(), 0.9);
            vehicleShot(v, _mz, VW.doorMg, false);
          }
          G.kick = Math.min(1.4, G.kick + 1); G.flashT = 0.045;
          if (v.T.fly && G.gunHeat.hot) { sound.alarm(); popup('PULEMYOT QIZIB KETDI!', true); }
        } else { G.vFireT = 0.35; sound.empty(); }
      }
    } else if (v.type === 'cannon') {
      if (mouse.L && G.vFireT <= 0) { G.vFireT = 0.6; if (useVehAmmo(v, 'b')) vehicleProjectile(v, v.muzzle('shell', _mz), 'shell'); }
    } else if (v.T.tank) {
      // haydovchi-to'pchi: asosiy pushka stvol qaragan tomonga otadi (minora nishonga burilib ulgurishi kerak)
      if (mouse.L && G.vAltT <= 0 && !useVehAmmo(v, 'b')) G.vAltT = 0.5;
      else if (mouse.L && G.vAltT <= 0) {
        G.vAltT = v.T.tank.reload;
        const ca = Math.cos(v.aimPitch);
        const bd = new THREE.Vector3(Math.sin(v.aimYaw) * ca, Math.sin(v.aimPitch), Math.cos(v.aimYaw) * ca);
        vehicleProjectile(v, v.muzzle('shell', _mz), v.T.tank.gun, bd);
        G.shake = Math.max(G.shake, v.type === 'tank' ? 0.55 : 0.3);
      }
      if (mouse.R && G.vFireT <= 0) { G.vFireT = 60 / VW.tankMg.rpm; if (useVehAmmo(v, 'a')) vehicleShot(v, v.muzzle('mg', _mz), VW.tankMg, false); else G.vFireT = 0.4; }
    }
  }
  const armed = gunner || (G.seat === 0 && (v.type === 'cannon' || v.type === 'heli' || !!v.T.tank));
  const ch = $('crosshair');
  ch.style.opacity = P.alive && armed ? 1 : 0;
  ch.children[0].style.top = '-21px'; ch.children[1].style.top = '12px';
  ch.children[2].style.left = '-21px'; ch.children[3].style.left = '12px';
}

// Transport o'q-dorisi (faqat zombi rejimida cheklangan): bitta o'q sarflaydi; tugagan bo'lsa false qaytaradi va xabar beradi
function useVehAmmo(v, key) {
  if (!v.limited) return true;
  if (v.ammo[key] > 0) { v.ammo[key]--; return true; }
  sound.empty();
  if (G.time - (G.vEmptyT || -9) > 2.5) { G.vEmptyT = G.time; popup(key === 'b' ? 'Snaryad tugadi' : "Pulemyot o'qi tugadi", true); }
  return false;
}

// ---------- Raketa / snaryad ----------
class Projectile {
  constructor(pos, vel, kind, team, ignore, visual) {
    this.pos = pos.clone(); this.vel = vel.clone(); this.kind = kind; this.P = PROJ[kind] || PROJ.rocket;
    this.team = team; this.ignore = ignore || null; this.visual = !!visual; this.life = 7; this.dead = false;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, kind === 'gl' ? 0.14 : 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x2a2c2a, roughness: 0.5, metalness: 0.5 }));
    body.rotation.x = Math.PI / 2; g.add(body);
    if (kind !== 'gl') {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      glow.scale.set(1.4, 1.4, 1); glow.position.z = -0.3; g.add(glow);
    }
    this.mesh = g; G.scene.add(g);
  }
  kill() { this.dead = true; G.scene.remove(this.mesh); }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.kill(); return; }
    const sp = this.vel.length();
    if (sp < 0.01) { this.kill(); return; }
    const step = sp * dt;
    _pd.copy(this.vel).multiplyScalar(1 / sp);
    const wh = G.world.rayCast(this.pos, _pd, step, _pwh, this.ignore);
    let t = wh ? wh.dist : step, hit = !!wh, veh = wh && wh.box && wh.box.vehicle ? wh.box.vehicle : null;
    if (this.team === 'player') {
      for (const s of G.soldiers) { if (!s.alive || !hostile(s)) continue; const h = s.hitTest(this.pos, _pd, t); if (h) { t = h.dist; hit = true; veh = null; } }
    } else if (player.alive && !G.inVeh) {
      const h = player.hitTest(this.pos, _pd, t);
      if (h) { t = h.dist; hit = true; veh = null; }
    }
    if (hit) {
      const pt = this.pos.clone().addScaledVector(_pd, Math.max(0, t - 0.05));
      this.kill();
      const P = this.P;
      explode(pt, this.team, { radius: P.radius, dmg: P.dmg, vdmg: P.vdmg, scale: P.scale, kind: P.kind, visual: this.visual, friendly: G.mp, directVeh: veh, dir: _pd.clone() });
      return;
    }
    this.pos.addScaledVector(this.vel, dt);
    this.vel.y -= this.P.grav * dt;
    this.mesh.position.copy(this.pos);
    this.mesh.lookAt(this.pos.x + this.vel.x, this.pos.y + this.vel.y, this.pos.z + this.vel.z);
    if (this.kind !== 'gl') {
      const g = 0.75;
      G.fx.norm.emit(this.pos.x, this.pos.y, this.pos.z, (Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 0.6, 0.35, 1.3, g, g, g, 0.5, -0.2, 0.8);
      G.fx.add.emit(this.pos.x, this.pos.y, this.pos.z, 0, 0, 0, 0.12, 0.5, -1, 1, 0.6, 0.2, 0.9, 0, 0);
    }
  }
}
function spawnProjectile(pos, vel, kind, team, ignore, visual) { G.projectiles.push(new Projectile(pos, vel, kind, team, ignore, visual)); }

// ---------- Noyob qurollar ----------
function nearestPickup() {
  const P = player;
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.pos.x - P.pos.x, pk.pos.z - P.pos.z) < 2.3 && Math.abs(pk.pos.y - (P.pos.y + 1.2)) < 1.6) return pk;
  }
  return null;
}
function tryPickup() {
  const pk = nearestPickup();
  if (!pk || G.isZ) return false;
  if (G.mp) net.send({ t: 'pick', id: pk.id });
  else { pk.taken = true; giveSpecial(pk.id); }
  return true;
}
function giveSpecial(id) {
  dropSpecial(false);
  const def = G.specials[id % G.specials.length];
  const vm = buildViewmodel(def, G.era);
  vm.group.visible = false; vmRoot.add(vm.group);
  G.weapons.push({ def, mag: def.mag, reserve: def.reserve, vm, pid: id });
  switchWeapon(G.weapons.length - 1);
  banner(def.name.toUpperCase(), "Noyob qurol qo'lga kiritildi · [5] tugmasi", 3);
  sound.ping();
}
function dropSpecial(notify) {
  if (!G.weapons || G.weapons.length <= 4) return;
  const w = G.weapons.pop();
  vmRoot.remove(w.vm.group);
  if (G.wi >= G.weapons.length) { G.wi = mainSlot(); G.switchT = 0.45; G.reloadT = 0; }
  buildSlots();
  if (G.mp) { if (notify) net.send({ t: 'unpick' }); }
  else { const pk = G.pickups.find((p) => p.id === w.pid); if (pk) pk.respT = 25; }
  if (notify) popup(`${w.def.name}: o'q tugadi`);
}
function updatePickups(dt) {
  for (const pk of G.pickups) {
    if (!G.mp && pk.taken && pk.respT > 0) { pk.respT -= dt; if (pk.respT <= 0) pk.taken = false; }
    pk.mesh.visible = !pk.taken;
    if (pk.taken) continue;
    pk.mesh.rotation.y += dt * 1.2;
    pk.mesh.position.y = pk.pos.y + Math.sin(G.time * 2 + pk.id) * 0.08;
  }
}
function interact() { if (G.zg && !G.isZ && G.zg.tryCrate()) return; if (!tryPickup()) useSupply(); }

function updatePrompt() {
  const pr = $('prompt'), P = player;
  let text = '';
  if (!G.inVeh && P.alive) {
    if (!P.onGround && !G.chute && P.vel.y < -6 && P.pos.y - groundBelow() > 6) text = '[PROBEL] — PARASHYUTNI OCHISH';
    else {
      const v = nearestVehicle();
      if (v !== G.pickVeh) { G.pickVeh = v; G.seatPick = 0; }
      if (v) {
        let free = 0;
        for (let i = 0; i < v.T.seats; i++) if (v.seats[i] == null) free++;
        text = `[F] ${v.T.name} — ${v.T.seatNames[pickedSeat(v)]}` + (free > 1 ? " · [Q] boshqa o'rin" : '') + (v.type === 'truck' ? ' · kuzovga orqadagi zinadan chiqing' : '');
      } else {
        const pk = nearestPickup();
        if (G.zg && !G.isZ && G.zg.nearCrate()) text = '[E] Qurol yashigini ochish';
        else if (pk) text = `[E] ${pk.def.name} — noyob qurolni olish`;
        else if (G.supplyReady && P.pos.distanceTo(G.world.supplyPos) < 2.8) text = "[E] O'q-dori va granatalarni olish";
      }
    }
  }
  if (text) { pr.style.display = 'block'; if (pr.textContent !== text) pr.textContent = text; }
  else pr.style.display = 'none';
}
function updateVehHUD() {
  const el = $('vehHud'), v = G.inVeh;
  if (!v) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
  el.style.display = 'block';
  const pct = Math.max(0, (v.hp / v.T.hp) * 100), role = v.T.roles[G.seat];
  setText('vehName', `${v.T.name.toUpperCase()} · ${v.T.seatNames[G.seat]}${v.T.fly ? ` · balandlik ${Math.round(v.pos.y)} m` : ''}${v.T.tank && G.seat === 0 ? (G.vAltT > 0 ? ` · pushka o'qlanmoqda ${G.vAltT.toFixed(1)} s` : ' · pushka TAYYOR') : ''}${vehStatus(v)}${vehSupply(v, role)}`);
  $('vehFill').style.width = pct + '%';
  $('vehFill').style.background = pct < 35 ? '#ff4433' : pct < 65 ? '#ffb02e' : '#7fd36a';
  // qurol holati: raketalar va pulemyot qizishi
  let rk = '', gun = null;
  if (v.type === 'heli' && G.seat === 0) {
    rk = v.rocketReload > 0 ? `RAKETA: qayta o'qlanmoqda ${Math.ceil(v.rocketReload)} s` : `RAKETA ${v.rockets}/${v.T.rockets}`;
    gun = v.gun;
  } else if (role === 'gunner' && v.T.fly && !ownGunActive()) gun = G.gunHeat;
  const am = $('vehAmmo');
  if (gun) {
    am.style.display = 'block';
    setText('vehRk', rk);
    setText('vehHeatTxt', gun.hot ? 'PULEMYOT QIZIB KETDI — sovumoqda' : 'Pulemyot qizishi');
    $('vehHeatTxt').style.color = gun.hot ? '#ff5b4b' : '';
    $('vehHeatFill').style.width = Math.round(gun.heat * 100) + '%';
    $('vehHeatFill').style.background = gun.hot ? '#ff4433' : gun.heat > 0.7 ? '#ffb02e' : '#7fd3ff';
  } else if (am.style.display !== 'none') am.style.display = 'none';
  // uchuvchisiz qolgan vertolyot
  const noPilot = v.T.fly && G.seat !== 0 && v.seats[0] == null && !v.onGround;
  // o'rinlar ro'yxati: qaysi o'rindamiz, qaysilari bo'sh/band — va ularni qanday almashtirish
  const vs = $('vehSeats');
  if (v.T.seats > 1) {
    let html = '';
    for (let i = 0; i < v.T.seats; i++) html += `<span class="${i === G.seat ? 'me' : v.seats[i] != null ? 'busy' : 'free'}">${i + 1} ${v.T.seatNames[i]}</span>`;
    if (hudCache.vehSeats !== html) { hudCache.vehSeats = html; vs.innerHTML = html; }
    if (vs.style.display !== 'flex') vs.style.display = 'flex';
  } else if (vs.style.display !== 'none') vs.style.display = 'none';
  const ownH = role === 'pass' ? (vehFP() ? " · O'z qurolingiz: chap tugma — otish, o'ng — mo'ljal, R — o'qlash, g'ildirak — qurol" : " · O'z qurolingizdan otish uchun 1-shaxsga o'ting")
    : role === 'gunner' ? ` · G'ildirak — bort pulemyoti / o'z qurolingiz (hozir ${G.ownGun && vehFP() ? cur().def.short || cur().def.name : 'bort pulemyoti'})` : '';
  const swap = ownH + (v.T.seats > 1 ? ` · Q yoki 1–${v.T.seats} — o'rin almashtirish` : '') + ` · V — ko'rinish (hozir ${vehFP() ? '1-shaxs' : '3-shaxs'})`;
  setText('vehHint', noPilot ? "UCHUVCHI YO'Q! [F] — sakrang (PROBEL — parashyut) · [1] — boshqaruvni oling" : (SEAT_HINTS[v.type + G.seat] || '') + swap);
  $('vehHint').style.color = noPilot ? '#ff5b4b' : '';
}

// ================= TARMOQ REJIMI (LAN) =================
const net = new Net();
G.net = net;
const remotes = new Map();
G.mp = false; G.myId = 0; G.mpFlag = { h: null, x: 0, z: 2 }; G.mpPlayers = []; G.mpRoom = null; G.mpTL = 0; G.netT = 0; G.mpMode = 'flag'; G.dmTarget = 15; G.vehSpawns = [];
function esc(v) { return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
// Kimga o'q/zarba tegadi: odatda — dushman askarlar va raqib o'yinchilar; zombi rejimida (tarmoq) — faqat qarama-qarshi tomon
function hostile(s) {
  if (G.mp && G.mpMode === 'zombie') return G.isZ ? s.team === 'remote' && !s.isZ : !!s.isZombie || (s.team === 'remote' && !!s.isZ);
  return s.team === 'enemy' || s.team === 'remote';
}
function v3arr(v) { return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; }
function arrV3(a) { return Array.isArray(a) && a.length === 3 && a.every(Number.isFinite) ? new THREE.Vector3(a[0], a[1], a[2]) : null; }
function nameOf(id) {
  if (id === G.myId) return 'Siz';
  const r = remotes.get(id); if (r) return r.name;
  const p = G.mpRoom && G.mpRoom.players.find((x) => x.id === id);
  return p ? p.name : '?';
}
function ensureRemote(id, name) {
  if (id === G.myId || !G.scene) return null;
  let r = remotes.get(id);
  if (!r) {
    r = new RemotePlayer(G, id, name || nameOf(id)); remotes.set(id, r); G.soldiers.push(r);
    if (G.mpMode === 'zombie') { r.isZ = false; r.setLook('ally', 'ally', '#7fd3ff'); }   // zombi rejimida boshqa odamlar — sheriklar
  }
  return r;
}
function clearRemotes() {
  for (const r of remotes.values()) r.dispose();
  remotes.clear();
  G.soldiers = G.soldiers.filter((s) => s.team !== 'remote');
}

// --- Menyu ---
$('mpName').value = localStorage.getItem('zj_name') || '';
// Server eski kod bilan ishlayaptimi? (server.js yangilangan, lekin jarayon qayta ishga tushirilmagan)
// Bunday serverda tarmoq o'yini noto'g'ri ishlaydi — masalan, transport ro'yxati eski bo'ladi.
const STALE_MSG = "Server eski kod bilan ishlayapti. Terminalda Ctrl+C bosing va ./start.sh ni qayta ishga tushiring, so'ng sahifani yangilang.";
async function serverStale() {
  if (location.protocol === 'file:') return false;
  try { const i = await (await fetch('/api/info', { cache: 'no-store' })).json(); return i.build === undefined || !!i.stale; }
  catch (e) { return false; }
}
serverStale().then((st) => { if (st) $('mpErr').textContent = STALE_MSG; });
function mpError(m) { $('mpErr').textContent = m; }
async function mpConnect() {
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
document.querySelectorAll('.lobbyMode').forEach((b) => b.addEventListener('click', () => { sound.ui(); net.send({ t: 'mode', mode: b.dataset.mode }); }));
document.querySelectorAll('.lobbyMap').forEach((b) => b.addEventListener('click', () => { sound.ui(); net.send({ t: 'map', map: b.dataset.map }); }));

function showLobby() {
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
function renderLobby() {
  const o = G.mpRoom;
  if (!o) return;
  $('lobbyCode').textContent = o.code;
  const isHost = o.host === G.myId;
  document.querySelectorAll('.lobbyEra').forEach((b) => { b.classList.toggle('sel', b.dataset.era === o.era); b.disabled = !isHost; });
  document.querySelectorAll('.lobbyMode').forEach((b) => { b.classList.toggle('sel', b.dataset.mode === o.mode); b.disabled = !isHost; });
  document.querySelectorAll('.lobbyMap').forEach((b) => { b.classList.toggle('sel', b.dataset.map === (o.map || 'town')); b.disabled = !isHost || o.mode === 'zombie'; });   // zombi rejimi doim katta xaritada
  $('lobbyRules').innerHTML = o.mode === 'zombie'
    ? "<b>Zombi rejimi (tun, katta xarita):</b> birinchi <b>4 o'yinchi</b> — odamlar, qolganlar zombi bo'lib qo'shiladi. Odamlar A punktidan B → C → D ga borib, D da 45 soniya evakuatsiyani kutadi. Boshida faqat to'pponcha va pichoq; yashiklarda [E] o'qi cheklangan qurollar; B da granata beriladi. Halok bo'lgan odam zombi bo'lib qaytadi. Hamma zombiga aylansa yoki 15 daqiqa o'tsa — zombilar yutadi. Transportda yoqilg'i va o'q-dori cheklangan."
    : o.mode === 'dm'
    ? "<b>Deathmatch:</b> har kim o'zi uchun. Birinchi bo'lib <b>15 ta</b> raqibni o'ldirgan yoki 8 daqiqa tugaganda eng ko'p o'ldirgan o'yinchi g'olib. Har tug'ilishdan oldin klass tanlanadi. Ikki xil tank, hujumchi vertolyot, Chinuk, Kamaz, jip, kvadrotsikl, zenit pushkasi va podvallardagi noyob qurollardan foydalaning."
    : "<b>Bayroq:</b> markazdagi bayroqni oling va ushlab turing. <b>90 soniya</b> ushlagan yoki 8 daqiqa tugaganda eng ko'p ushlagan o'yinchi g'olib. O'ldirish +100, boshga +50, bayroq tashuvchini o'ldirish +50, bayroq har soniyada +10 ball. Bayroq bilan transportga o'tirib bo'lmaydi.";
  if (o.mode !== 'zombie') $('lobbyRules').innerHTML += " <b>Muvozanat:</b> o'lmasdan 3 va undan ko'p raqibni o'ldirgan o'yinchi xaritada ko'rinadi va har bir keyingi o'ldirish uchun 8% ko'proq zarar oladi (40% gacha).";
  $('lobbyPlayers').innerHTML = o.players.map((p) =>
    `<div class="${p.id === G.myId ? 'me' : ''}">${esc(p.name)}${p.id === o.host ? ' ★ xost' : ''}${p.id === G.myId ? ' (siz)' : ''}</div>`).join('');
  $('btnLobbyStart').style.display = isHost ? '' : 'none';
  $('lobbyMsg').textContent = isHost
    ? (o.players.length < 2 && o.mode !== 'zombie' ? "Do'stingiz kodni kiritib qo'shilishini kuting..." : 'Hamma tayyor! Jangni boshlang.')
    : 'Xost jangni boshlashini kuting...';
}

// --- Server xabarlari ---
net.onclose = () => {
  if (G.mp || !$('lobby').classList.contains('hidden')) { toMenu(); mpError('Server bilan aloqa uzildi.'); }
};
net.onmsg = (o) => {
  switch (o.t) {
    case 'error': mpError(o.m); $('lobbyMsg').textContent = o.m; break;
    case 'joined': G.myId = o.id; G.myName = o.name; showLobby(); break;
    case 'lobby': G.mpRoom = o; renderLobby(); break;
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
    case 'respawn': if (G.mp && o.id === G.myId) respawnMe(!!o.zb); break;
    case 'zs': if (G.mp) onZombieState(o.z); break;
    case 'zhit': if (G.mp) onZombieHit(o); break;
    case 'zdead': if (G.mp) onZombieDead(o); break;
    case 'zstage': if (G.mp && G.zg) { G.zg.setStage(o.st, true); if (o.by && o.by !== G.myId) popup(`${nameOf(o.by)} punktga yetib keldi`); } break;
    case 'flash': if (G.mp && G.zg) G.zg.lightning(o.k || 1); break;
    case 'flag': if (G.mp) onFlag(o); break;
    case 'vseat': if (G.mp) enterVehicle(G.vehicles[o.v], o.seat, !!o.promoted); break;
    case 'vboom': if (G.mp) onVehicleBoom(o); break;
    case 'pick': if (G.mp) onPick(o); break;
    case 'rocket': if (G.mp) onRemoteRocket(o); break;
    case 'left': {
      const r = remotes.get(o.id);
      if (r) { r.dispose(); remotes.delete(o.id); G.soldiers = G.soldiers.filter((s) => s !== r); }
      if (G.mp) popup(`${o.name} jangni tark etdi`);
      break;
    }
    case 'end': if (G.mp) mpEnd(o); break;
  }
};

function mpStart(o) {
  G.mp = true; G.era = o.era; G.mpHold = o.holdTarget; G.mpTL = o.matchTime;
  G.mpMode = o.mode === 'dm' || o.mode === 'zombie' ? o.mode : 'flag'; G.dmTarget = o.dmTarget || 15; G.vehSpawns = o.veh || [];
  G.mpFlag = { h: null, x: o.base.x, z: o.base.z }; G.mpPlayers = [];
  $('lobby').classList.add('hidden'); $('end').classList.add('hidden'); $('menu').classList.add('hidden');
  clearRemotes();
  createScene(o.era, { map: o.map, night: o.mode === 'zombie', zombie: o.mode === 'zombie', veh: o.veh });
  startGame();
  if (G.mpMode === 'flag') createFlag();
  for (const p of (G.mpRoom && G.mpRoom.players) || []) ensureRemote(p.id, p.name);
  if (G.mpMode === 'zombie') {
    // zombi rejimi: klass tanlanmaydi; odamlar A punktida yonma-yon paydo bo'ladi (startGame joylagan), zombilar — birinchi holat kelganda ko'chiriladi
    const P = player; P.pos.x += rnd(-3, 3); P.pos.z += rnd(-3, 3); G.world.collideCircle(P.pos, 0.4, 0, 1.8);
    if (G.zg) { G.zg.stage = o.zstage || 0; G.zg.hold = G.zg.holdMax = o.zhold || 45; }
    G.state = 'paused';
    $('pauseTitle').textContent = 'ZOMBI REJIMI BOSHLANDI!'; $('btnResume').textContent = 'JANGGA KIRISH ▶';
    show('pause');
    return;
  }
  respawnMe();
  // jang boshlandi: avval klass tanlanadi (o'yin fonda davom etadi), so'ng sichqoncha qulflanadi
  G.state = 'paused';
  $('pause').classList.add('hidden');
  openClassPick('mpstart', () => { applyLoadout(); respawnAmmo(); G.state = 'playing'; requestLock(); });
}

function mpState(o) {
  G.mpTL = o.tl; G.mpFlag = o.f; G.mpPlayers = o.p;
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
  if (o.zm && G.zg) {   // zombi rejimi: bosqich, evakuatsiya sanog'i, zombilarni boshqaruvchi xost
    if (o.zm.st > G.zg.stage) G.zg.setStage(o.zm.st, false);
    G.zg.hold = o.zm.ho; setZHost(o.zm.host === G.myId);
  }
  const seen = new Set();
  for (const p of o.p) {
    if (p.id === G.myId) {
      G.score = p.sc; G.mpStreak = p.st || 0;
      if (p.zb && !G.isZ && G.zg) { becomeZombie(); G.zNeedSpot = !zombieSpot(); }
      if (player.alive && p.al) player.hp = p.hp;
      if (G.inVeh && p.vh !== G.inVeh.id && G.time - G.enterT > 0.6) leaveVehicleLocal();
      else if (G.inVeh && p.vh === G.inVeh.id && p.se >= 0 && p.se !== G.seat && G.time - G.seatT > 0.6) enterVehicle(G.inVeh, p.se, p.se === 0);   // o'tkazib yuborilgan xabar
      continue;
    }
    seen.add(p.id);
    const r = ensureRemote(p.id);
    if (r && G.zg && !!p.zb !== !!r.isZ) { r.isZ = !!p.zb; if (r.isZ) r.setLook('enemy', 'zombie', '#ff6b5b'); else r.setLook('ally', 'ally', '#7fd3ff'); }
    if (r) { r.streak = p.st || 0; r.setState(p, p.vh >= 0 ? G.vehicles[p.vh] : null); }
  }
  for (const [id, r] of remotes) if (!seen.has(id)) { r.dispose(); remotes.delete(id); G.soldiers = G.soldiers.filter((s) => s !== r); }
  if (G.isZ && G.zNeedSpot && zombieSpot()) G.zNeedSpot = false;   // jang boshida zombi bo'lib qo'shilgan o'yinchi odamlardan uzoqroqqa ko'chiriladi
}

function onVehicleBoom(o) {
  const v = G.vehicles[o.v];
  if (!v) return;
  boomVehicle(v);
  if (o.by === G.myId) popup(`${v.T.name} yo'q qilindi!`, true);
}
function onPick(o) {
  const pk = G.pickups[o.id];
  if (!pk) return;
  pk.taken = true;
  if (o.by === G.myId) giveSpecial(o.id);
  else popup(`${nameOf(o.by)} noyob qurolni oldi: ${pk.def.name}`, true);
}
function onRemoteRocket(o) {
  const p = arrV3(o.p), v = arrV3(o.v);
  if (!p || !v) return;
  const sv = G.vehicles.find((x) => x.alive && x.seats.includes(o.id));
  spawnProjectile(p, v, PROJ[o.k] ? o.k : 'rocket', 'remote', sv ? sv.box : null, true);
  const rp = relToPlayer(p);
  sound.shot(PROJ[o.k] && PROJ[o.k].kind === 'shell' ? 'cannon' : o.k === 'gl' ? 'gl' : 'rocket', rp.dist, rp.pan, true);
  G.fx.muzzle(p, 1.6);
}

function onRemoteShot(o) {
  const A = arrV3(o.a), B = arrV3(o.b);
  if (!A || !B) return;
  const r = remotes.get(o.id);
  if (r) { r.gunKick = 1; r.lastFired = G.time; }
  G.fx.muzzle(A, 1);
  G.fx.tracer(A, B, 0xff9a70);
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

function onHurt(o) {
  const P = player;
  if (!P.alive) return;
  const dmg = Math.max(0, P.hp - o.hp);
  P.hp = o.hp; P.lastHurt = G.time;
  hitPunch(dmg);
  G.hurtPulse = Math.min(1, G.hurtPulse + dmg / 35);
  G.shake = Math.max(G.shake, 0.22);
  sound.hurt();
  if (Number.isFinite(o.fx) && Number.isFinite(o.fz)) addDmgIndicator(new THREE.Vector3(o.fx, 0, o.fz));
}

function onKill(o) {
  const kn = o.killer ? nameOf(o.killer) : '', vn = nameOf(o.victim);
  const icon = { knife: '🔪', claw: '☣', zombie: '☣', grenade: '💣', rocket: '🚀', shell: '🚀', vehicle: '💥', roadkill: '🚙', fall: '⤓' }[o.kind] || (o.head ? '⦿' : '⌖');
  if (o.kind === 'zombie') feed('Zombi', 'en', vn, o.victim === G.myId ? 'me' : 'al', '☣');
  else if (o.killer) feed(kn, o.killer === G.myId ? 'me' : 'en', vn, o.victim === G.myId ? 'me' : 'en', icon);
  else feed(vn, o.victim === G.myId ? 'me' : 'en', o.kind === 'fall' ? 'balanddan yiqildi' : "halok bo'ldi", 'ic', o.kind === 'fall' ? '⤓' : '💥');
  if (o.killer === G.myId) {
    G.kills++; if (o.head) G.headshots++;
    popup(o.head ? '+150' : '+100');
    if (o.head) popup("BOSHGA O'Q", true);
    hitmarker(true); sound.kill();
  }
  if (o.victim === G.myId) {
    const P = player;
    leaveVehicleLocal(); G.chute = false; G.platform = null; G.insideVeh = null;
    P.alive = false; P.deathT = 0; P.hp = 0;
    mouse.L = mouse.R = false;
    sound.hurt();
    if (G.mpMode === 'zombie') banner(G.isZ ? "YO'Q QILINDINGIZ" : 'SIZNI YUQTIRISHDI', G.isZ ? '4 soniyada yana zombi bo\'lib qaytasiz' : '4 soniyada ZOMBI bo\'lib qaytasiz — endi odamlarni ovlaysiz', 3.5);
    else {
      banner("HALOK BO'LDINGIZ", `${kn ? kn + " sizni o'ldirdi" : o.kind === 'fall' ? 'Balanddan yiqildingiz' : 'Transport halokati'} · 4 soniyada qayta tug'ilasiz`, 3.5);
      openClassPick('respawn');   // kutish o'rniga shu 4 soniyada klass tanlanadi
    }
  }
}

function onFlag(o) {
  if (o.ev === 'take') {
    if (o.id === G.myId) { banner('BAYROQ SIZDA!', 'Uni iloji boricha uzoq ushlab turing', 2.5); sound.ping(); }
    else { popup(`${nameOf(o.id)} bayroqni oldi!`, true); sound.horn(); }
  } else if (o.ev === 'drop') popup('Bayroq yerga tushdi!', true);
  else if (o.ev === 'return') popup('Bayroq markazga qaytdi');
}

function respawnAmmo() {
  for (const w of G.weapons) if (isGun(w)) { w.mag = w.def.mag; w.reserve = w.def.reserve; }
  G.grenades_n = 2; G.cookT = -1; G.supplyReady = true; G.reloadT = 0; G.switchT = 0.45; G.knifeT = 0; G.throwT = 0;
  G.recoilAcc = 0; G.kickPitch = 0; G.ads = 0;
  buildSlots();
}
// Zombi-o'yinchi odamlardan uzoqroqda (qorong'ida) paydo bo'ladi
function zombieSpot() {
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
function respawnMe(zb) {
  const P = player;
  leaveVehicleLocal(); dropSpecial(false); G.chute = false; G.platform = null; G.insideVeh = null;
  if (G.mpMode === 'zombie') {   // zombi rejimi: halok bo'lgan odam zombi bo'lib qaytadi
    if (zb) becomeZombie();
    if (!(G.isZ && zombieSpot())) { const sp = G.world.spawns[(Math.random() * G.world.spawns.length) | 0]; P.pos.copy(sp); P.vel.set(0, 0, 0); G.world.collideCircle(P.pos, 0.4, 0, 1.8); }
    P.hp = G.isZ ? 60 : 100; P.alive = true; P.deathT = 0; P.lastHurt = -99; P.eyeH = 1.62; G.crouchToggle = false; G.knifeT = 0; G.switchT = 0.4; G.netT = 0;
    return;
  }
  // o'lik paytda tanlangan klass shu yerda kuchga kiradi
  if (G.pick && G.pick.mode === 'respawn') { const sel = G.pick.sel; closePick(); if (setClass(sel)) applyLoadout(); }
  const others = [...remotes.values()].filter((r) => r.alive && r.hasPos);
  let best = null, bestScore = -1;
  for (const sp of G.world.spawns) {
    let md = 999;
    for (const r of others) md = Math.min(md, r.pos.distanceTo(sp));
    const score = md + Math.random() * 12;
    if (score > bestScore) { bestScore = score; best = sp; }
  }
  P.pos.copy(best || G.world.playerSpawn);
  G.world.collideCircle(P.pos, 0.4, 0, 1.8);
  P.vel.set(0, 0, 0);
  P.yaw = Math.atan2(P.pos.x, P.pos.z); P.pitch = 0;
  P.hp = 100; P.alive = true; P.deathT = 0; P.lastHurt = -99; P.eyeH = 1.62;
  G.crouchToggle = false;
  respawnAmmo();
  G.netT = 0;
}

function mpUpdate(dt) {
  G.netT -= dt;
  if (G.netT <= 0 && player.alive) {
    G.netT = 0.05;
    const P = player;
    net.send({ t: 'p', x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yw: +P.yaw.toFixed(3), pt: +P.pitch.toFixed(3), cr: P.crouch ? 1 : 0, w: G.wi, ch: G.chute ? 1 : 0,
      iv: G.insideVeh ? G.insideVeh.id : G.platform ? G.platform.id : -1 });   // iv — yuk bo'limida piyoda turgan transport
  }
  if (G.zg && G.zg.host) { G.zg.syncT -= dt; if (G.zg.syncT <= 0) { G.zg.syncT = 0.12; sendZombieState(); } }   // xost: zombilar holatini uzatadi
  updateFlagVisual(dt);
}

// --- Bayroq ---
function flagTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 84;
  const g = c.getContext('2d');
  g.fillStyle = '#f2b320'; g.fillRect(0, 0, 128, 84);
  g.fillStyle = '#c8321e'; g.fillRect(0, 0, 128, 14); g.fillRect(0, 70, 128, 14);
  g.fillStyle = '#1c1c1c'; g.beginPath(); g.arc(64, 42, 20, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2b320'; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⚔', 64, 43);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function createFlag() {
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
function updateFlagVisual() {
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
let boardT = 0;
// Zombi rejimi (tarmoq): odamga — keyingi punkt, zombiga — ov; tepada kim tirik qolgani
function updateZombieMpHUD(dt) {
  const tl = Math.max(0, G.mpTL || 0), z = G.zg, tp = z.target, P = player;
  setText('waveLabel', 'ZOMBI REJIMI');
  setText('enemyLabel', `Vaqt: ${Math.floor(tl / 60)}:${Math.floor(tl % 60).toString().padStart(2, '0')}`);
  setText('scoreLabel', String(Math.round(G.score || 0)));
  const hum = G.mpPlayers.filter((p) => !p.zb), alive = hum.filter((p) => p.al).length, zp = G.mpPlayers.length - hum.length;
  const d = Math.round(Math.hypot(tp.x - P.pos.x, tp.z - P.pos.z));
  setText('objective', !P.alive ? "Qayta tug'ilishni kuting..." : G.isZ ? "Odamlarni toping va yuqtiring! Ular xaritada ko'k nuqta bilan ko'rsatilgan." : zObjective(d));
  setText('flagStatus', `☣ Punkt ${'ABCD'[Math.min(3, z.stage)]} → ${tp.id} · odamlar: ${alive}/${hum.length} · zombi-o'yinchilar: ${zp}`);
  $('flagStatus').className = G.isZ ? 'enemy' : '';
  boardT -= dt;
  if (boardT <= 0) {
    boardT = 0.25;
    const rows = G.mpPlayers.slice().sort((a, b) => (a.zb || 0) - (b.zb || 0) || b.sc - a.sc);
    $('mpBoard').innerHTML = rows.map((p) => `<div class="${p.id === G.myId ? 'me' : ''}"><span>${esc(p.id === G.myId ? (G.myName || 'Siz') : nameOf(p.id))}</span><span class="hold">${p.zb ? '☣ zombi' : p.al ? 'odam' : '✖'}</span><span>${p.k} ☠</span><span>${p.sc}</span></div>`).join('');
  }
}
function updateMpHUD(dt) {
  if (G.mpMode === 'zombie' && G.zg) { updateZombieMpHUD(dt); return; }
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
  if (G.mpStreak >= 3 && player.alive) obj += ` · 🔥 Ketma-ket ${G.mpStreak}: sizga +${Math.round(Math.min(0.4, 0.08 * (G.mpStreak - 2)) * 100)}% ko'proq zarar yetadi, xaritada ko'rinasiz`;
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

function mpEnd(o) {
  G.state = 'over';
  leaveVehicleLocal(); stopEngines(); closePick();
  if (document.pointerLockElement) document.exitPointerLock();
  $('hud').classList.add('hidden'); $('scope').style.display = 'none'; $('pause').classList.add('hidden');
  if (o.mode === 'zombie') {   // zombi rejimi: tomonlar g'alabasi
    const hw = o.side === 'humans', mine = hw !== G.isZ, ps = (o.players || []).slice().sort((a, b) => (a.zb || 0) - (b.zb || 0) || b.score - a.score);
    $('endTitle').textContent = hw ? (G.isZ ? 'ODAMLAR QUTULIB KETDI' : 'EVAKUATSIYA QILINDINGIZ!') : G.isZ ? "ZOMBILAR G'OLIB!" : 'HAMMA ZOMBIGA AYLANDI';
    $('endTitle').style.color = mine ? '#ffcc55' : '#ff5b4b';
    $('endSub').textContent = hw ? "Odamlar D punktida evakuatsiyani kutib oldi." : `Odamlar ${'ABCD'[Math.min(3, (o.stage || 0) + 1)]} punktiga yetolmadi — tun zombilarniki.`;
    $('endStats').innerHTML = "<table><tr><th>O'yinchi</th><th>Tomon</th><th>O'ldirish</th><th>O'lim</th><th>Ball</th></tr>" +
      ps.map((p) => `<tr class="${hw === !p.zb ? 'win' : ''}"><td>${esc(p.name)}${p.id === G.myId ? ' (siz)' : ''}</td><td>${p.zb ? '☣ zombi' : 'odam'}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.score}</td></tr>`).join('') + '</table>';
    $('btnAgain').textContent = 'Lobbiga qaytish';
    show('end');
    if (mine) sound.victory(); else sound.defeat();
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
  $('btnAgain').textContent = 'Lobbiga qaytish';
  show('end');
  if (iWon) sound.victory(); else sound.defeat();
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
// Ishga tushirish
selectEra('historical');
$('loading').classList.add('hidden');
requestAnimationFrame(frame);
window.__G = G;
window.__anim = animateSoldier;   // sinovlar uchun: askar pozasini qo'lda hisoblash
window.__dbg = { dyn: () => dynScale, post, postLevel, setPost: (v) => { postForce = v; }, GL_NAME, SOFT_GL, wScene, keys, mouse, player, camera, renderer, tick, startGame, createScene, settings, enterVehicle, exitVehicle, tryEnterVehicle, giveSpecial, spawnProjectile, damageVehicle, switchWeapon, selectSlot, tryFire, interact, knifeAttack, throwGrenade,
  openClassPick, pickSelect, pickConfirm, setClass, applyLoadout, giveCrateWeapon, toggleTorch, damagePlayer, toggleVehView, vehFP, ownGunActive, cycleSeatGun, hitscan, spawnEnemy, spawnGrenade, setLocked: (v) => { locked = v; } };

