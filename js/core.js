// O'yinning umumiy holati va asosiy obyektlar: sozlamalar, renderer, kameralar, ovoz, o'yinchi, G (holat), chizish.
import * as THREE from '../lib/three.module.js';
import { SoundEngine } from './audio.js';
import { Post } from './post.js';
import { inv, rayAABB } from './world.js';
import { mapId } from './shared.mjs';

export const $ = (id) => document.getElementById(id);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const TOTAL_WAVES = 10;

export const DIFFS = [
  { name: 'Yangi askar', acc: 0.5, dmg: 0.45, reaction: 1.0, hpMul: 0.85, score: 0.75 },
  { name: 'Askar', acc: 0.78, dmg: 0.75, reaction: 0.7, hpMul: 1.0, score: 1.0 },
  { name: 'Qiyin', acc: 1.0, dmg: 1.05, reaction: 0.5, hpMul: 1.1, score: 1.5 },
  { name: 'Faxriy', acc: 1.25, dmg: 1.5, reaction: 0.32, hpMul: 1.2, score: 2.2 },
];
export const STREAKS = {
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
export const ALLY_NAMES = { historical: ['Karimov', 'Rustamov'], modern: ['Botir', 'Sardor'] };
export const BRIEF = {
  historical: {
    era: 'TARIXIY KAMPANIYA · 1944',
    title: 'QISHKI FRONT',
    text: "1944-yil, dekabr.\nSharqiy front, nomsiz shaharcha.\n\nDushman qo'shinlari shaharni qaytarib olish uchun\nkuchli hujumga tayyorlanmoqda. Sizning vzvodingiz\nmarkaziy maydonni har qanday holatda ushlab turishi kerak.\n\nVAZIFA: 10 ta hujum to'lqinini qaytaring.\nO'q-dori qutisi maydon markazida joylashgan.\nKetma-ket o'ldirishlar artilleriya yordamini ochadi.\n\nOmad, askar.",
  },
  zombie: {
    era: 'ZOMBI REJIMI · KARANTIN ZONASI',
    title: "SO'NGGI SHOM",
    text: "Kech kirmoqda. Yomg'ir. Karantin zonasi o'liklar qo'lida.\n\nKolonnangiz yo'lda halokatga uchradi. Qo'lingizda faqat\nto'pponcha va pichoq. Qurol, o'q-dori va dori — uylarda.\n\nVAZIFA: qishloqqa yeting, uch joydan ratsiya qismlarini toping,\nradio minoradan yordam chaqiring va harbiy bazada vertolyotni kuting.\n\nZombilar ko'rish va SHOVQINGA qarab sezadi: o'q ovozi, portlash,\ntransport va yugurish ularni chaqiradi. Cho'kkalab [C] yoki yotib [Z]\nchetlab o'tsa bo'ladi. Tun kirgach ular ko'payadi — fonar [L].\n\nXarita katta: [M] — to'liq xarita. Uch marta xato qilish mumkin.",
  },
  modern: {
    era: 'ZAMONAVIY KAMPANIYA · 2026',
    title: "CHO'L BO'RONI",
    text: "2026-yil, mart.\nCho'l shahri, \"Sarob\" operatsiyasi.\n\nRazvedka ma'lumotlariga ko'ra, qurolli guruh shaharni\nnazorat qilmoqda. Maxsus guruhingiz vertolyot\nmaydonchasiga tushirildi.\n\nVAZIFA: dushmanning 10 ta to'lqinini yo'q qiling.\nDron, raketa va havo hujumlarini ketma-ket\no'ldirishlar orqali qo'lga kiriting.\n\nAloqa tugadi.",
  },
};

// ---------- Sozlamalar ----------
// Ko'rish burchagi (vertikal). Avval 80° edi (16:9 ekranda gorizontal ≈112°): juda keng burchak odamlarni va uzoqdagi narsalarni maydalashtirib ko'rsatardi.
// Endi standart 62° (gorizontal ≈94°, PUBG'ning birinchi shaxs ko'rinishiga yaqin) — hamma narsa ekranda 1.4 baravar yirik.
// Qurollarning mo'ljal burchaklari (adsFov) 80° ga nisbatan yozilgan, shuning uchun FOV_BASE ga nisbatan o'lchanadi (movement.js: aimFov).
export const FOV_DEF = 62, FOV_BASE = 80;
const _saved = JSON.parse(localStorage.getItem('zj_settings') || '{}');
if (_saved.ver !== 2) { delete _saved.fov; _saved.ver = 2; }   // eski saqlangan 80° bir marta yangi standartga almashtiriladi
export const settings = Object.assign({ sens: 1, fov: FOV_DEF, vol: 0.8, quality: 'high', ver: 2 }, _saved);
export const saveSettings = () => localStorage.setItem('zj_settings', JSON.stringify(settings));

// ---------- Renderer ----------
// Ekran buferining o'z silliqlashi (antialias) faqat past sifatda kerak: qolgan darajalarda sahna oraliq tasvirga chiziladi va ekranga bitta to'rtburchak chiqadi —
// u yerda ko'p namunali bufer faqat vaqt oladi (Retina ekranda kadr vaqtining chorak qismi).
export const renderer = new THREE.WebGLRenderer({ antialias: settings.quality === 'low', powerPreference: 'high-performance' });
renderer.autoClear = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
export const canvas = renderer.domElement;

export const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 700);
camera.rotation.order = 'YXZ';
export const wScene = new THREE.Scene();
export const wCamera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 10);
export const wAmb = new THREE.AmbientLight(0xffffff, 0.35); wScene.add(wAmb);
export const wSun = new THREE.DirectionalLight(0xffffff, 2.2); wSun.position.set(0.6, 1.4, 0.8); wScene.add(wSun);
export const wHemi = new THREE.HemisphereLight(0xc8d4e0, 0x4a4438, 0.9); wScene.add(wHemi);
export const wTorch = new THREE.PointLight(0xfff0d2, 0, 3, 1.5); wTorch.position.set(0.1, -0.05, -0.9); wScene.add(wTorch);   // fonar nurining qurolga tushadigan qismi
export const W_FOV_TAN = Math.tan((55 * Math.PI) / 360);
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
export const wEnvDefault = wScene.environment;   // yengil rejimda qurol shu oddiy "osmon"ni aks ettiradi

// ---------- Grafika darajasi ----------
// Qaysi grafik protsessor ishlayotganini aniqlaymiz: dasturiy chizishda (GPU tezlatishi yo'q) og'ir effektlar o'chiriladi.
export const GL_NAME = (() => { try { const gl = renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return String(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch (e) { return ''; } })();
export const SOFT_GL = /swiftshader|llvmpipe|software|basic render/i.test(GL_NAME);
export const post = new Post(renderer);
export let postForce = new URLSearchParams(location.search).get('post'); export function setPostForce(v) { postForce = v; applyQuality(); }   // sinov uchun: ?post=off|medium|high|ultra
// Sozlamadagi sifat → keyingi ishlov darajasi (post.js): past — yo'q; o'rta — bloom, ton, FXAA; yuqori — + SSAO va quyosh nurlari; ultra — + ko'proq namuna
export function postLevel() {
  if (postForce) return postForce;
  if (SOFT_GL || !renderer.capabilities.isWebGL2) return 'off';
  const q = settings.quality;
  return q === 'low' ? 'off' : q;   // (dasturiy chizishda yuqorida 'off' qaytgan)
}
// Moslashuvchan aniqlik: kadr tezligi 45 dan pastga tushsa, tasvir aniqligi asta kamaytiriladi; tezlik yetarli bo'lsa qaytariladi.
// (o'yin silliq qoladi — kuchsiz videokartada ham, kuchlisida esa to'liq aniqlikda ishlaydi)
// Tasvir ikki bosqichda: sahna va effektlar "ichki" aniqlikda chiziladi, ekranga esa DOIM ekranning o'z aniqligida (Retina) o'tkirlashtiruvchi
// kattalashtirish bilan chiqariladi (post.js: FS_UPSCALE). Ilgari ichki aniqlik pasayganda butun tasvirni brauzer cho'zardi — xira ko'rinardi.
export let dynScale = 1, dynAcc = 0, dynN = 0, dynHold = 0, dynFails = 0, dynQ = '';
export let resScale = 1;   // ichki aniqlikning ekran aniqligiga nisbati (applyQuality hisoblaydi)
const APPLE_GPU = /apple/i.test(GL_NAME);
// Qirralarni silliqlash (MSAA) namunalari. Apple videokartalarida va zich (Retina) ekranlarda u kadr vaqtining 40% gacha qismini oladi —
// u yerda o'chiq: silliqlikni yuqori aniqlik, FXAA va o'tkirlash beradi.
export const msaaFor = (q) => (APPLE_GPU || (devicePixelRatio || 1) >= 1.5 ? 0 : q === 'ultra' || q === 'high' ? 4 : q === 'medium' ? 2 : 0);
// Sifat darajasi uchun ichki aniqlik (CSS pikseliga nisbatan)
const innerPR = (q, d) => (q === 'low' ? Math.min(d, 1) : q === 'medium' ? Math.min(d, 1.25) : q === 'ultra' ? Math.min(d * 1.5, 2.5) : Math.min(d, 2));
// GPU tezlatishi bo'lmasa (dasturiy chizish) dunyo "yengil" variantda quriladi (gfx.js: GFX.lite) — aks holda yuklanish va kadrlar juda sekin
export const effQ = () => settings.quality;
export const liteNow = () => SOFT_GL && !postForce;
export function applyQuality() {
  const q = effQ(), d = devicePixelRatio || 1;
  if (q !== dynQ) { dynQ = q; dynScale = 1; dynFails = 0; }
  // sozlamada aniqlik qo'lda tanlangan bo'lsa — moslashuvchan aniqlik ishlamaydi
  const fixed = settings.res === 'full' ? 1 : settings.res === 'p75' ? 0.75 : 0, sc = fixed || dynScale;
  // ultra: ekran aniqligidan 1.5 baravar yuqori chizib, kichraytiriladi (eng silliq tasvir)
  const inner = innerPR(q, d);
  if (postLevel() === 'off') { renderer.setPixelRatio(inner * sc); resScale = 1; }   // keyingi ishlovsiz: to'g'ridan-to'g'ri ekranga, shu aniqlikda
  else { const out = Math.min(d, 2); renderer.setPixelRatio(out); resScale = (inner * sc) / out; }   // ekran — o'z aniqligida, sahna — ichki aniqlikda
  renderer.shadowMap.enabled = q !== 'low';
  renderer.setSize(innerWidth, innerHeight);
}
export function dynRes(raw) {
  if (SOFT_GL || G.state !== 'playing' || document.hidden || raw > 0.25 || (settings.res && settings.res !== 'auto')) { dynAcc = 0; dynN = 0; return; }
  dynAcc += raw; dynN++; dynHold -= raw;
  if (dynAcc < 1.5) return;
  const avg = dynAcc / dynN; dynAcc = 0; dynN = 0;
  let sc = dynScale;
  if (avg > 0.024 && sc > 0.5) {
    if (dynHold > 0) dynFails++;                 // oshirish urinishi o'zini oqlamadi — keyingisi kechroq
    // chizish narxi piksellar soniga (masshtab kvadratiga) mutanosib: kerakli masshtab bir qadamda taxmin qilinadi (sekin-asta tushib, bir necha soniya qotib turmaslik uchun)
    sc = Math.max(0.5, Math.min(sc - 0.06, sc * Math.sqrt(0.0155 / avg))); dynHold = Math.min(90, 10 * 2 ** dynFails);
  } else if (avg < 0.0175 && sc < 1 && dynHold <= 0) { sc = Math.min(1, sc + 0.06); dynHold = 6; }
  if (sc !== dynScale) { dynScale = +sc.toFixed(2); applyQuality(); }
}
applyQuality();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = wCamera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix(); wCamera.updateProjectionMatrix();
});

export const sound = new SoundEngine();
sound.setVolume(settings.vol);

// Snayper yaltirashi teksturasi
export const glintTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,250,220,0.8)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 31, 64, 2); g.fillRect(31, 0, 2, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

// Sahnadan olib tashlangan jismning videoxotirasini bo'shatish (geometriya; mats = true — materiallar ham). Umumiy (shared) geometriyaga tegilmaydi.
export function disposeTree(o, mats = false) {
  o.traverse((m) => {
    if (m.geometry && !(m.geometry.userData && m.geometry.userData.shared)) m.geometry.dispose();
    if (mats && m.material) for (const mt of [].concat(m.material)) if (!(mt.userData && mt.userData.shared)) mt.dispose();
  });
}
// Tik turgan va cho'kkalagan o'yinchining ko'z balandligi: eski 1.62 va 1.05 × CHAR_K (personajlar o'lchami — shared.mjs)
export const EYE_H = 1.81, EYE_CROUCH = 1.18;

// ---------- O'yin holati ----------
export const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, hp: 100, alive: true,
  onGround: true, crouch: false, prone: false, sprinting: false, moving: false, eyeH: EYE_H, bob: 0, stepAcc: 0,
  lastHurt: -99, deathT: 0, isPlayer: true, vehBox: null,
  getAimPoint(out) { return out.set(this.pos.x, this.pos.y + Math.max(0.15, this.eyeH - 0.45), this.pos.z); },
  hitTest(o, d, maxD) {
    const b = this._box || (this._box = new THREE.Box3());
    const hw = this.prone ? 0.56 : 0.36;   // yotgan o'yinchi: past, lekin uzunroq nishon
    b.min.set(this.pos.x - hw, this.pos.y, this.pos.z - hw);
    b.max.set(this.pos.x + hw, this.pos.y + this.eyeH + 0.17, this.pos.z + hw);
    const t = rayAABB(o.x, o.y, o.z, inv(d.x), inv(d.y), inv(d.z), b);
    return t <= maxD ? { dist: t, head: false } : null;
  },
};

export const G = {
  state: 'menu', era: 'historical', diffIdx: 1, diff: DIFFS[1], time: 0, spMode: 'waves', spMap: mapId(new URLSearchParams(location.search).get('xarita') || 'city'), spVeh: true,   // standart xarita — yangi shahar (?xarita=town|big bilan o'zgartirsa bo'ladi)
  zombie: false, night: false,
  scene: null, world: null, fx: null, weather: null, soldiers: [], grenades: [], planes: [], strikes: [],
  player, glintTex, sound, menuT: 0,
};

export const keys = {};
export const mouse = { L: false, R: false };

export const _o = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _dir = new THREE.Vector3();
export const _wh = { point: new THREE.Vector3(), normal: new THREE.Vector3(), dist: 0 };
export const _mz = new THREE.Vector3(), _tmp = new THREE.Vector3();

export function camBasis() {
  camera.updateMatrixWorld();
  _f.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _r.set(1, 0, 0).applyQuaternion(camera.quaternion);
  _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
}

// Chizish: keyingi ishlov yoqilgan bo'lsa — post.js orqali (HDR → SSAO → bloom → ton → FXAA), aks holda to'g'ridan-to'g'ri ekranga
export function renderFrame() {
  const gun = G.state === 'playing' || G.state === 'paused', lvl = G.scene ? postLevel() : 'off';
  // mo'ljalga olganda qurolning ko'zga juda yaqin qismlari (qo'ndoq, zatvor qopqog'i) chizilmaydi — ular ko'rinishni to'sib qo'ymasin
  { const a = gun ? G.ads || 0 : 0, nr = 0.01 + a * a * 0.05; if (Math.abs(wCamera.near - nr) > 1e-4) { wCamera.near = nr; wCamera.updateProjectionMatrix(); } }
  post.setLevel(lvl, msaaFor(lvl));
  if (lvl !== 'off') {
    try {
      // dof: mo'ljalga olganda ko'zga yaqin qurol qismlari yumshaydi (optik mo'ljalda qurol ko'rinmaydi — kerak emas)
      post.render({ scene: G.scene, camera, gunScene: gun ? wScene : null, gunCamera: wCamera, sunDir: G.world.sunDir, grade: G.world.grade, time: G.time, dof: gun && !G.inVeh ? (G.ads || 0) : 0, dofRange: G.dofRange || undefined, scale: G.resScale || resScale });   // (G.resScale — sinov uchun qo'lda berilgan qiymat)
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
