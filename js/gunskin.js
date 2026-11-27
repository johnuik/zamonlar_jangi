import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/addons/GLTFLoader.js';
import { components } from './vehskin.js';

// ================= QO'LDAGI QUROL MODELLARI (assets/models/guns — mualliflar: assets/models/CREDITS.txt) =================
// Qurolning harakati (tepki, qayta o'qlash, qo'llar, mo'ljalga olish) o'zgarmaydi — faqat qurol tanasi almashadi.
// Model kod bilan qurilgan qurol o'lchamiga moslanadi: stvol uchi o'sha joyda, old mo'ljal tepasi mo'ljal chizig'ida (qurol koordinatasida y = 0).
// Model yuklanmasa yoki manzilda ?foto=0 bo'lsa — kod bilan qurilgan qurol qoladi.
const off = typeof location !== 'undefined' && new URLSearchParams(location.search).get('foto') === '0';
const U = 'assets/models/guns/';
// rot — modelni yo'naltirish: ketma-ket aylanishlar [o'q, gradus] (uzun o'qi z ga). Stvol tomoni va tepasi keyin avtomatik aniqlanadi.
// ap — orqa mo'ljal teshigining tepasidan chuqurligi (metr; manfiy — ko'z mo'ljal ustidan qaraydi: teshigi modellashtirilmagan qurollar).
// sight — mo'ljal chizig'ini aniqlash: 'iron' (old ustuncha tepasi) yoki son (model balandligining ulushi — optika markazi).
// span — mo'ljal qidiriladigan qism (stvol uchidan, uzunlik ulushi; qo'ndoq hisobga olinmasligi uchun 0.82, to'pponchada 1).
// len — kod quroliga nisbatan uzunlik ko'paytuvchisi (1 — teng). dy/dz — qo'shimcha siljish (metr). riser — qoladigan optika ostidagi tirgak.
// skip — tashlab yuboriladigan tugunlar (nomi bo'yicha), mag — magazin (raketa) tugunlari: qayta o'qlashda kod magaziniga ergashadi,
// insert — mag qismini quvur old uchiga kiritish (dumining ulushi), paint — rangi saqlanmagan materiallar rangi, keep — kod qurolining optikasi qoladi,
// dx — yon tomonga siljish (granatomyot quvuri ko'zdan o'ngda). level — stvolni gorizontallash (oldingi qism ulushi bo'yicha),
// eyeD — mo'ljalda ko'zning orqa mo'ljaldan (optikadan) masofasi, metr (standart 0,11 / optikada 0,10).
// R — kod qurolining tayanch nuqtalarini almashtirish (qo'llar, stvol uchi, ko'z): shakli boshqacha qurol (bullpup) uchun.
const DRONE_HOLD = { muzzle: [0, -0.1, -0.72], grip: [0.17, -0.14, -0.52], fore: [-0.17, -0.14, -0.52], hip: [0.02, -0.18, -0.02], ads: [0, -0.06, 0.08] };
export const GMODELS = {
  'modern|ar': { url: U + 'm4a1.glb', ap: -0.003, dy: -0.012, keep: true, riser: [-0.144, -0.066, -0.034, 0.03], mag: /^Magazine$/ },
  'modern|ar2': { url: U + 'scarh.glb' },
  'modern|smg': { url: U + 'vityaz.glb', sight: 0.935, keepDir: true },
  'modern|smg2': { url: U + 'p90.glb', rot: [['y', 90]], sight: 0.84, len: 0.62, R: { muzzle: [0, -0.06, -0.42], grip: [0, -0.135, -0.24], fore: [0, -0.125, -0.355], eye: 0.0 } },
  'modern|sniper': { url: U + 'l118.glb', rot: [['y', 90]], sight: 0.84 },
  'modern|dmr': { url: U + 'svd.glb', rot: [['y', 90]], sight: 0.82, keepUp: true },
  'modern|shotgun': { url: U + 'r870.glb', rot: [['y', 90]] },
  'modern|shotgun2': { url: U + 'saiga.glb', span: 0.56 },
  'modern|lmg': { url: U + 'pkm.glb', rot: [['y', 90]], span: 0.6, eyeD: 0.22 },
  'modern|pistol': { url: U + 'g17.glb', rot: [['y', 90]], span: 1, paint: 0x2a2c30 },
  'modern|pistol2': { url: U + 'deagle.glb', span: 1, skip: /^Bullet(Case)?_low/, mag: /^(Magazine|MagazineBase|BaseInside)_low/ },
  'modern|rpg': { url: U + 'rpg7.glb', mag: /rocket/, insert: 0.42, dx: 0.075, dy: -0.025, len: 0.8 },
  'modern|amr': { url: U + 'm82.glb', rot: [['y', 90]], sight: 0.8, paint: 0x34373b },
  'historical|ar': { url: U + 'stg44.glb', mag: /Magazin/ },
  'historical|ar2': { url: U + 'fg42.glb', mag: /^Magazine/ },
  'historical|smg': { url: U + 'ppsh.glb', rot: [['y', 90]] },
  'historical|smg2': { url: U + 'mp40.glb', eyeD: 0.17 },
  'historical|sniper': { url: U + 'mosin.glb', rot: [['y', 90]], sight: 0.975 },
  'historical|dmr': { url: U + 'svt40.glb', rot: [['y', 90]], keep: true, dy: -0.03, riser: [-0.15, -0.03, -0.014, 0.018] },
  'historical|shotgun': { url: U + 'm97.glb', skip: /Bayoneta_(Hoja|Guardia|Mango)/ },
  'historical|shotgun2': { url: U + 'dbl.glb', rot: [['y', 90]] },
  'historical|lmg': { url: U + 'dp28.glb', skip: /^Bipods/ },
  'historical|pistol': { url: U + 'tt33.glb', rot: [['x', -90], ['y', -90]], span: 1 },
  'historical|pistol2': { url: U + 'nagant.glb', rot: [['y', 90]], keepUp: true, span: 0.52, level: 0.3, skip: /Chain|Case|Projectile/ },
  'historical|rpg': { url: U + 'bazooka.glb', rot: [['y', 90]], dx: 0.075, dy: -0.02, len: 0.85 },
  'historical|amr': { url: U + 'ptrd.glb', rot: [['y', 60]] },
  // qo'ldagi turel — faqat pulemyoti (o'rnatilganda butun model: vehskin.js, TURRET_DEFS)
  'modern|turret': { url: U + 'dshk.glb', part: 0.72 },
  'historical|turret': { url: U + 'maxim.glb', part: 0.47, level: 0.5 },
  // qo'ldagi dron: ikki qo'l bilan oldinda ushlab turiladi (uchirilganda — vehskin.js: droneVisual)
  'modern|drone': { url: 'assets/models/veh/drone.glb', keepYaw: true, keepDir: true, keepUp: true, sight: 0.5, len: 0.4, R: DRONE_HOLD },
  'historical|drone': { url: 'assets/models/veh/drone.glb', keepYaw: true, keepDir: true, keepUp: true, sight: 0.5, len: 0.4, R: DRONE_HOLD, tint: 0x8c9a62 },
  knife: { url: U + 'knife.glb', rot: [['y', 90]], sight: 0.5 },
  // faqat askarlar qo'lida (uchinchi shaxs): qo'zg'olonchilarning AK si va optikasiz miltiq
  'modern|ak': { url: U + 'ak47.glb', rot: [['y', 90]] },
  'historical|rifle': { url: U + 'mosin.glb', rot: [['y', 90]], skip: /scope/i },
};
export const gunModelFor = (id, era) => (off ? null : GMODELS[era + '|' + id] || null);
export const knifeModel = () => (off ? null : GMODELS.knife);

const tpl = new Map();
// faqat berilgan uchburchaklar (cho'qqi indekslari) va ular ishlatgan cho'qqilardan yangi geometriya; bo'sh bo'lsa — null
function compact(g, tri) {
  if (!tri.length) return null;
  const P = g.attributes.position, N = g.attributes.normal, T = g.attributes.uv, m = new Int32Array(P.count).fill(-1), pos = [], nor = [], uv = [], idx = [];
  for (const v of tri) { if (m[v] < 0) { m[v] = pos.length / 3; pos.push(P.getX(v), P.getY(v), P.getZ(v)); if (N) nor.push(N.getX(v), N.getY(v), N.getZ(v)); if (T) uv.push(T.getX(v), T.getY(v)); } idx.push(m[v]); }
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (N) o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); if (T) o.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  o.setIndex(idx); o.computeBoundingBox(); o.userData.shared = true;
  return o;
}
// tugun yoki uning ota-bobolaridan birining nomi mos keladimi
function nameHit(o, re, root) { for (let q = o; q && q !== root; q = q.parent) if (re.test(q.name || '')) return true; return false; }
function convertMat(src, def) {
  const m = new THREE.MeshStandardMaterial({
    map: src.map || null, normalMap: src.normalMap || null, roughnessMap: src.roughnessMap || null, metalnessMap: src.metalnessMap || null, aoMap: src.aoMap || null,
    color: src.color, roughness: src.roughness ?? 0.6, metalness: src.metalness ?? 0.5, envMapIntensity: 1.0,
    transparent: !!src.transparent, opacity: src.opacity ?? 1, alphaTest: src.alphaTest || 0, side: src.side,
  });
  if (m.normalMap && src.normalScale) m.normalScale.copy(src.normalScale);
  if (def && def.tint) m.color.multiply(new THREE.Color(def.tint));   // (1944 yilgi dron — xaki-zaytun rang)
  // paint — rangi faylda saqlanmagan (oq, teksturasiz) materiallar uchun rang (masalan, polimer qora)
  if (def && def.paint && !m.map && m.color.r > 0.75 && m.color.g > 0.75 && m.color.b > 0.75) { m.color.setHex(def.paint); m.roughness = 0.55; m.metalness = 0.35; }
  m.userData.shared = true;
  return m;
}
function build(def, gltf) {
  const sc = gltf.scene, q = new THREE.Quaternion(), ax = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  for (const [a, d] of def.rot || []) q.premultiply(new THREE.Quaternion().setFromAxisAngle(ax[a], THREE.MathUtils.degToRad(d)));
  sc.quaternion.copy(q); sc.updateMatrixWorld(true);
  const parts = [], mats = new Map(), box = new THREE.Box3();
  sc.traverse((o) => {
    if (!o.isMesh) return;
    if (def.skip && nameHit(o, def.skip, sc)) return;   // ortiqcha bo'laklar (yonidagi o'q, zanjir, nayza...)
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mats.has(src)) mats.set(src, convertMat(src, def));
    const g = o.geometry.clone();
    if (o.isSkinnedMesh) {
      // suyakli model: cho'qqilar suyaklar bilan joylashadi — ularni dunyo koordinatasiga "pishiramiz" (normallar ham o'sha o'zgarish bilan)
      const P = g.attributes.position, N = g.attributes.normal, v = new THREE.Vector3(), w = new THREE.Vector3(), p0 = new THREE.Vector3();
      for (let i = 0; i < P.count; i++) {
        p0.fromBufferAttribute(P, i);
        o.applyBoneTransform(i, v.copy(p0)).applyMatrix4(o.matrixWorld);
        if (N) { w.fromBufferAttribute(N, i).add(p0); o.applyBoneTransform(i, w).applyMatrix4(o.matrixWorld).sub(v).normalize(); N.setXYZ(i, w.x, w.y, w.z); }
        P.setXYZ(i, v.x, v.y, v.z);
      }
    } else g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.computeBoundingBox(); box.union(g.boundingBox); g.userData.shared = true;
    parts.push({ geo: g, mat: mats.get(src), mag: !!(def.mag && nameHit(o, def.mag, sc)) });
  });
  // part — modelning faqat yuqori qismi (masalan, turelning pulemyoti, uch oyog'i tashlanadi): bo'lak markazi balandlikning shu ulushidan yuqori
  if (def.part) {
    const thr = box.min.y + (box.max.y - box.min.y) * def.part;
    for (const p of parts) {
      const keep = []; for (const C of components(p.geo)) if (C.c.y > thr) for (const v of C.tris) keep.push(v);
      p.geo = compact(p.geo, keep);
    }
    for (let i = parts.length - 1; i >= 0; i--) if (!parts[i].geo) parts.splice(i, 1);
    box.makeEmpty(); for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
  }
  // uzun o'q z ga parallel bo'lsin: ustdan qaraganda (x–z tekisligi) cho'qqilarning bosh o'qi bo'yicha burish —
  // ba'zi fayllarda qurol bir necha gradus yonga burilgan holda saqlangan (stvol uchi yon tomonga qarab qoladi)
  let yawFix = 0;
  if (!def.keepYaw) {
    let n = 0, mx = 0, mz = 0, sxx = 0, szz = 0, sxz = 0;
    for (const p of parts) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); n++; mx += x; mz += z; sxx += x * x; szz += z * z; sxz += x * z; } }
    if (n) {
      mx /= n; mz /= n; const cxx = sxx / n - mx * mx, czz = szz / n - mz * mz, cxz = sxz / n - mx * mz;
      const phi = 0.5 * Math.atan2(2 * cxz, czz - cxx);   // bosh o'q bilan z o'qi orasidagi burchak (x tomonga)
      if (Math.abs(phi) > 0.008 && Math.abs(phi) < 0.45) {
        yawFix = phi;
        const m = new THREE.Matrix4().makeRotationY(-phi); box.makeEmpty();
        for (const p of parts) { p.geo.applyMatrix4(m); p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
      }
    }
  }
  // stvol uchi qaysi tomonda: ingichka (kichik kesimli) uchi — stvol. Kerak bo'lsa 180° buriladi.
  const L = box.max.z - box.min.z, slice = (z0, z1) => { const b = new THREE.Box3(); for (const p of parts) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) { const z = P.getZ(i); if (z >= z0 && z <= z1) b.expandByPoint(new THREE.Vector3(P.getX(i), P.getY(i), z)); } } return b.isEmpty() ? 0 : (b.max.y - b.min.y) * (b.max.x - b.min.x + 0.01 * L); };
  const aFront = slice(box.min.z, box.min.z + L * 0.08), aBack = slice(box.max.z - L * 0.08, box.max.z);
  const turn = (m) => { for (const p of parts) { p.geo.applyMatrix4(m); p.geo.computeBoundingBox(); } box.makeEmpty(); for (const p of parts) box.union(p.geo.boundingBox); };
  if (!def.keepDir && aBack < aFront) turn(new THREE.Matrix4().makeRotationY(Math.PI));
  // tepasi qayerda: stvol (old uchi) balandligidan pastga qarab chiqib turgan qism (dasta, magazin) ko'proq bo'lishi kerak — aks holda 180° ag'dariladi
  { let y0 = 1e9, y1 = -1e9; const zl = box.min.z + (box.max.z - box.min.z) * 0.06;
    for (const p of parts) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) if (P.getZ(i) <= zl) { y0 = Math.min(y0, P.getY(i)); y1 = Math.max(y1, P.getY(i)); } }
    const yb = (y0 + y1) / 2; if (!def.keepUp && box.max.y - yb > yb - box.min.y) turn(new THREE.Matrix4().makeRotationZ(Math.PI)); }
  // level — stvolni gorizontal qilish: oldingi qismdagi (stvol) kesimlar markazi bo'yicha qiyalik o'lchanadi (fayldagi model qiyshiq saqlangan bo'lsa)
  if (def.level) {
    const NB = 12, Lz = box.max.z - box.min.z, lo = new Array(NB).fill(1e9), hi = new Array(NB).fill(-1e9);
    for (const p of parts) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) { const f = (P.getZ(i) - box.min.z) / Lz; if (f > def.level) continue; const b = Math.min(NB - 1, Math.floor((f / def.level) * NB)); lo[b] = Math.min(lo[b], P.getY(i)); hi[b] = Math.max(hi[b], P.getY(i)); } }
    let n = 0, sz = 0, sy = 0, szz = 0, szy = 0;
    for (let b = 0; b < NB; b++) if (hi[b] > lo[b]) { const z = box.min.z + ((b + 0.5) / NB) * def.level * Lz, y = (lo[b] + hi[b]) / 2; n++; sz += z; sy += y; szz += z * z; szy += z * y; }
    if (n > 3) { const k = (n * szy - sz * sy) / (n * szz - sz * sz); turn(new THREE.Matrix4().makeRotationX(Math.atan(k))); }
  }
  // insert — alohida turgan o'q (raketa) quvurning old uchiga kiritiladi: o'qi quvur o'qiga, dumining ulushi (depth) ichkarida
  if (def.insert) {
    const R = parts.filter((p) => p.mag), L = parts.filter((p) => !p.mag), bx = (list) => { const b = new THREE.Box3(); for (const p of list) b.union(p.geo.boundingBox); return b; };
    if (R.length && L.length) {
      const lb = bx(L), rb = bx(R), fz = lb.min.z + (lb.max.z - lb.min.z) * 0.04;
      let n = 0, ax = 0, ay = 0; for (const p of L) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) if (P.getZ(i) <= fz) { ax += P.getX(i); ay += P.getY(i); n++; } }
      if (n) { ax /= n; ay /= n; }
      // jangovar qism (yo'g'on uchi) oldinga qarasin: aks holda raketa o'z markazi atrofida 180° buriladi
      const rl = rb.max.z - rb.min.z, ends = [0, 0];
      for (const p of R) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) { const f = (P.getZ(i) - rb.min.z) / rl, r = Math.hypot(P.getX(i) - (rb.min.x + rb.max.x) / 2, P.getY(i) - (rb.min.y + rb.max.y) / 2); if (f < 0.3) ends[0] = Math.max(ends[0], r); else if (f > 0.7) ends[1] = Math.max(ends[1], r); } }
      if (ends[1] > ends[0]) { const c = rb.getCenter(new THREE.Vector3()), f = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z)); for (const p of R) { p.geo.applyMatrix4(f); p.geo.computeBoundingBox(); } }
      const m = new THREE.Matrix4().makeTranslation(ax - (rb.min.x + rb.max.x) / 2, ay - (rb.min.y + rb.max.y) / 2, lb.min.z + rl * def.insert - rb.max.z);
      for (const p of R) { p.geo.applyMatrix4(m); p.geo.computeBoundingBox(); }
      box.makeEmpty(); for (const p of parts) box.union(p.geo.boundingBox);
    }
  }
  // o'rta chiziq: qurolning ustki sirti (stvol, ressiver, zatvor qopqog'i) kesimlari o'rtalarining medianasi —
  // butun model chegarasi yon tomondagi zatvor dastasi, tozalash shompoli va h.k. sababli siljigan bo'lishi mumkin
  const NZ = 60, Lz = box.max.z - box.min.z, tol = (box.max.y - box.min.y) * 0.015, tops = new Array(NZ).fill(-1e9), xr = [];
  const bin = (z) => Math.max(0, Math.min(NZ - 1, Math.floor(((z - box.min.z) / Lz) * NZ)));
  for (const p of parts) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) { const b = bin(P.getZ(i)); tops[b] = Math.max(tops[b], P.getY(i)); } }
  for (let b = 0; b < NZ; b++) xr.push([1e9, -1e9]);
  for (const p of parts) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) { const b = bin(P.getZ(i)); if (P.getY(i) >= tops[b] - tol) { const x = P.getX(i); xr[b][0] = Math.min(xr[b][0], x); xr[b][1] = Math.max(xr[b][1], x); } } }
  const mids = xr.slice(0, Math.ceil(NZ * 0.9)).filter((r) => r[1] >= r[0]).map((r) => (r[0] + r[1]) / 2).sort((a, b) => a - b);
  return { parts, box, def, yawFix, cx: mids.length ? mids[mids.length >> 1] : (box.min.x + box.max.x) / 2 };
}
export function loadGun(def) {
  if (tpl.has(def)) return tpl.get(def).p;
  const rec = { ready: false };
  rec.p = new GLTFLoader().loadAsync(def.url).then((g) => { Object.assign(rec, build(def, g), { ready: true }); return rec; })
    .catch((e) => { console.warn('qurol modeli yuklanmadi:', def.url, e && e.message); rec.failed = true; return null; });
  tpl.set(def, rec);
  return rec.p;
}
// ================= ASKARLAR QO'LIDAGI QUROL (uchinchi shaxs) =================
// Kod qurolining turi → model. Bitta to'r (rang — har cho'qqida teksturadan olinadi): hamma askar uchun umumiy material, bitta chizish chaqiruvi.
const TP = { ar: 'modern|ar', ak: 'modern|ak', bolt: 'historical|rifle', boltScope: 'historical|sniper', ppsh: 'historical|smg', mp: 'historical|smg2', smgM: 'modern|smg', svd: 'modern|dmr' };
export function tpModelFor(era, kind) {
  if (off || !kind || kind === 'none') return null;
  if (kind === 'mg') return GMODELS[era + '|lmg'] || null;
  if (kind === 'pistol') return GMODELS[era + '|pistol'] || null;
  return GMODELS[TP[kind]] || null;
}
function sampler(tex) {
  const img = tex && tex.image;
  if (!img || !img.width || typeof document === 'undefined') return null;
  const W = 64, H = 64, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, W, H);
  const d = cx.getImageData(0, 0, W, H).data, lin = (v) => Math.pow(v / 255, 2.2), fr = (t) => t - Math.floor(t);
  return (u, v, out) => { const i = ((Math.min(H - 1, (fr(v) * H) | 0) * W) + Math.min(W - 1, (fr(u) * W) | 0)) * 4; return out.setRGB(lin(d[i]), lin(d[i + 1]), lin(d[i + 2])); };
}
const tpCache = new Map();
// box — kod qurolining chegarasi (stvol +z tomonga, boshlang'ich nuqta — dasta ustida), my — stvol balandligi.
// Qaytaradi: geometriya; null — hali yuklanmagan; false — model yo'q (yuklanmadi)
export function tpGunGeo(def, key, box, my) {
  const ck = def.url + '|' + key;
  if (tpCache.has(ck)) return tpCache.get(ck);
  const t = tpl.get(def);
  if (!t) { loadGun(def); return null; }
  if (t.failed) return false;
  if (!t.ready) return null;
  const Lm = t.box.max.z - t.box.min.z, s = (box.max.z - box.min.z) / Lm, zf = t.box.min.z + Lm * 0.06;
  let yc = 0, n = 0;
  for (const p of t.parts) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) if (P.getZ(i) <= zf) { yc += P.getY(i); n++; } }
  yc = n ? yc / n : (t.box.min.y + t.box.max.y) / 2;
  const pos = [], col = [], c = new THREE.Color(), tc = new THREE.Color();
  for (const p of t.parts) {
    const g = p.geo, P = g.attributes.position, UV = g.attributes.uv, I = g.index, smp = p.mat.map && UV ? sampler(p.mat.map) : null, base = p.mat.color;
    const cnt = I ? I.count : P.count;
    for (let k = 0; k < cnt; k++) {
      const i = I ? I.getX(k) : k;
      // 180° burilish (stvol +z ga), o'lcham, joy: stvol uchi kod qurolining uchida, stvol o'qi — kod stvoli balandligida
      pos.push(-(P.getX(i) - t.cx) * s, (P.getY(i) - yc) * s + my, -(P.getZ(i) - t.box.min.z) * s + box.max.z);
      if (smp) { smp(UV.getX(i), UV.getY(i), tc); c.copy(tc).multiply(base); } else c.copy(base);
      col.push(c.r, c.g, c.b);
    }
  }
  // soddalashtirish (cho'qqilarni katakchalarga yig'ish): uzoqdan ko'rinadigan qurolga ~3 ming uchburchak yetadi — o'nlab askar bo'lsa ham kadr tezligi tushmaydi
  const L = box.max.z - box.min.z, lim = 3200;
  let cell = L / 140, P, C, idx;
  for (let it = 0; it < 6; it++) {
    const map = new Map(); P = []; C = []; idx = []; const cnt = [];
    const vid = (i) => {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], k = Math.round(x / cell) + ',' + Math.round(y / cell) + ',' + Math.round(z / cell);
      let v = map.get(k); if (v === undefined) { v = cnt.length; map.set(k, v); P.push(0, 0, 0); C.push(0, 0, 0); cnt.push(0); }
      P[v * 3] += x; P[v * 3 + 1] += y; P[v * 3 + 2] += z; C[v * 3] += col[i * 3]; C[v * 3 + 1] += col[i * 3 + 1]; C[v * 3 + 2] += col[i * 3 + 2]; cnt[v]++;
      return v;
    };
    for (let t = 0; t < pos.length / 9; t++) { const a = vid(t * 3), b = vid(t * 3 + 1), c3 = vid(t * 3 + 2); if (a !== b && b !== c3 && a !== c3) idx.push(a, b, c3); }
    for (let v = 0; v < cnt.length; v++) for (let d = 0; d < 3; d++) { P[v * 3 + d] /= cnt[v]; C[v * 3 + d] /= cnt[v]; }
    if (idx.length / 3 <= lim) break;
    cell *= 1.35;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((P.length / 3) * 2), 2)); out.setIndex(idx);
  out.computeVertexNormals(); out.computeBoundingSphere(); out.userData.shared = true;
  tpCache.set(ck, out);
  return out;
}
export function preloadGuns(era) { if (off) return; for (const k in GMODELS) if (k === 'knife' || k.startsWith(era + '|')) loadGun(GMODELS[k]); }

const HIDE = new THREE.MeshBasicMaterial({ visible: false });
const RISER = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.55, metalness: 0.4 });
const _b = new THREE.Box3(), _m = new THREE.Matrix4();
// Kod qismlarining qurol guruhi koordinatasidagi chegarasi
function codeBox(gun, list) {
  const box = new THREE.Box3();
  gun.updateMatrixWorld(true);
  _m.copy(gun.matrixWorld).invert();
  for (const c of list) c.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(_b.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(_m, o.matrixWorld)));
  });
  return box;
}
// Qurol tanasini modelga almashtirish. gun — qurol guruhi; parts — kod bilan qurilgan qurol qismlari; muzzleZ — stvol uchi (qurol koordinatasida);
// eyeZ — mo'ljalga olgandagi ko'z (qurol koordinatasida; bo'lmasa — yo'q)
export function skinGun(def, gun, parts, muzzleZ, eyeZ, opt = {}) {
  const t = tpl.get(def);
  if (!t) { loadGun(def); return null; }   // (oldindan yuklanmagan bo'lsa — endi yuklanadi; tayyor bo'lgach qurol almashadi)
  if (!t.ready) return null;
  const cb = codeBox(gun, parts);
  if (cb.isEmpty()) return null;
  const Lc = cb.max.z - cb.min.z, Lm = t.box.max.z - t.box.min.z, s = (Lc / Lm) * (def.len || 1);
  // Mo'ljal chizig'i: markaziy tasmaning (qo'ndoqsiz qismi) yuqori profili ustiga qo'yilgan "chizg'ich" — profilning yuqori qavariq
  // qobig'idagi eng uzun kesma: u old ustuncha va orqa mo'ljal ustidan o'tadi. Ko'z orqa mo'ljal teshigidan qaraydi — chiziq biroz pastroq.
  const cx = t.cx, strip = 0.012 / s, zMin = t.box.min.z, NB = 140, top = new Array(NB).fill(-1e9), span = def.span || 0.82;
  for (const p of t.parts) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) {
    if (Math.abs(P.getX(i) - cx) > strip) continue;
    const f = (P.getZ(i) - zMin) / Lm; if (f < 0 || f > span) continue;
    const bi = Math.min(NB - 1, (f / span * NB) | 0); top[bi] = Math.max(top[bi], P.getY(i));
  } }
  const pts = []; for (let i = 0; i < NB; i++) if (top[i] > -1e8) pts.push([zMin + ((i + 0.5) / NB) * span * Lm, top[i]]);
  const hull = [];
  for (const q of pts) { while (hull.length >= 2) { const a = hull[hull.length - 2], b = hull[hull.length - 1]; if ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) >= 0) hull.pop(); else break; } hull.push(q); }
  let best = null; for (let i = 1; i < hull.length; i++) { const d = hull[i][0] - hull[i - 1][0]; if (!best || d > best.d) best = { d, a: hull[i - 1], b: hull[i] }; }
  let sightY, rotX = 0;
  if (typeof def.sight === 'number' || !best) sightY = t.box.min.y + (t.box.max.y - t.box.min.y) * (typeof def.sight === 'number' ? def.sight : 0.7);   // optika markazi (taxminan)
  else {
    // a — old ustuncha tepasi; b — orqa mo'ljal tepasi (ko'z undan ap qadar pastdagi teshikdan qaraydi)
    const ap = (def.ap ?? 0.006) / s, k = (best.b[1] - ap - best.a[1]) / (best.b[0] - best.a[0]);
    const tl = def.tilt || 0.12; rotX = Math.max(-tl, Math.min(tl, Math.atan(k)));   // (tilt — fayldagi model qiyshiq saqlangan bo'lsa, kattaroq to'g'rilashga ruxsat)
    sightY = best.a[1] + (zMin - best.a[0]) * Math.tan(rotX) - 0.001 / s;   // (chiziqning stvol uchidagi balandligi — burilish o'qi shu nuqtada)
  }
  const grp = new THREE.Group();
  grp.scale.setScalar(s);
  grp.rotation.x = rotX;
  // old mo'ljal (yoki optika) — y = 0 chiziqda; stvol uchi — kod qurolining uchida; o'rtasi — x = 0
  const inner = new THREE.Group(); inner.position.set(-cx, -sightY, -zMin); grp.add(inner);
  grp.position.set(def.dx || 0, (def.dy || 0), muzzleZ + (def.dz || 0));
  const magParts = [];
  for (const p of t.parts) { const m = new THREE.Mesh(p.geo, p.mat); m.frustumCulled = false; m.castShadow = false; inner.add(m); if (p.mag) magParts.push(m); }
  // magazin (raketa): kod qurolining magazin guruhiga ko'chiriladi — qayta o'qlashda u bilan birga chiqib-kiradi, otilgach yashirinadi
  const magObj = opt.mag;
  if (magObj && magParts.length) {
    const was = magObj.position.clone(); if (opt.magBase) magObj.position.copy(opt.magBase);   // (o'qlash animatsiyasi o'rtasida bo'lsa ham — tinch holatiga nisbatan)
    gun.add(grp); grp.updateMatrixWorld(true); magObj.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(magObj.matrixWorld).invert();
    for (const m of magParts) { m.matrix.multiplyMatrices(inv, m.matrixWorld); m.matrix.decompose(m.position, m.quaternion, m.scale); m.parent.remove(m); magObj.add(m); }
    gun.remove(grp); magObj.position.copy(was);
  }
  // riser: kod qurolidan qoladigan optika (R.keep) model ustida havoda qolmasligi uchun — ostiga tirgak (def.riser: [z0, z1, optika tagi y, eni], qurol koordinatasida)
  if (def.riser) {
    const [z0, z1, yTop, w] = def.riser, v = new THREE.Vector3(); let yMax = -1e9;
    grp.updateMatrix(); inner.updateMatrix(); const M = new THREE.Matrix4().multiplyMatrices(grp.matrix, inner.matrix);
    for (const p of t.parts) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) {
      if (Math.abs(P.getX(i) - cx) > w / 2 / s) continue;
      v.fromBufferAttribute(P, i).applyMatrix4(M); if (v.z >= z0 && v.z <= z1 && v.y < yTop + 0.01) yMax = Math.max(yMax, v.y);
    } }
    if (yMax > -1e8 && yTop - yMax > 0.002) {
      const rb = new THREE.Mesh(new THREE.BoxGeometry(w, yTop - yMax + 0.002, z1 - z0), RISER); rb.position.set(0, (yTop + yMax) / 2, (z0 + z1) / 2); rb.frustumCulled = false; gun.add(rb);
    }
  }
  // kod bilan qurilgan qurol tanasi yashiriladi (def.keep bo'lmasa — saqlanadigan qismlar ham: optika va h.k.)
  for (const c of parts.concat(def.keep ? [] : opt.keepParts || [])) c.traverse((o) => { if (o.isMesh && (!magParts.length || !magParts.includes(o))) o.material = HIDE; });
  gun.add(grp);
  // mo'ljalda yaqin maydon xiraligi: orqa mo'ljal tiniq qolsin (aks holda uning teshigi xiralikda yo'qoladi) — faqat undan yaqinroq qismlar xira
  if (eyeZ != null && best && typeof def.sight !== 'number') { const d = eyeZ - (muzzleZ + (def.dz || 0) + (best.b[0] - zMin) * s); if (d > 0.03) grp.userData.dofRange = [Math.min(0.07, d * 0.45), d * 0.85]; }
  // Mo'ljalga olganda ko'z qayerda turadi (qurol koordinatasida, z): temir mo'ljalda — orqa mo'ljaldan eyeD orqada (u ko'rinib, old ustunchani
  // o'rab turadi; ko'z qurol ichiga kirib qolmaydi), optikada (kollimator) — optikaning orqa uchidan eyeD orqada.
  const toG = (mz) => muzzleZ + (def.dz || 0) + (mz - zMin) * s;
  if (best && typeof def.sight !== 'number') grp.userData.ads = { z: toG(best.b[0]) + (def.eyeD ?? 0.11), front: toG(best.a[0]), rear: toG(best.b[0]) };
  else if (typeof def.sight === 'number') {
    // optika: chiziqdan yuqoridagi (optika korpusi) qismning old va orqa chegarasi
    let o0 = 1e9, o1 = -1e9;
    for (const p of t.parts) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) if (P.getY(i) > sightY && Math.abs(P.getX(i) - cx) < 0.05 / s) { o0 = Math.min(o0, P.getZ(i)); o1 = Math.max(o1, P.getZ(i)); } }
    if (o1 > o0) grp.userData.ads = { z: toG(o1) + (def.eyeD ?? 0.1), front: toG(o0), rear: toG(o1), optic: true };
  }
  grp.userData.dbg = { s, rotX, sightY, a: best && best.a, b: best && best.b, hull, size: t.box.getSize(new THREE.Vector3()).toArray(), cx: t.cx, yaw: t.yawFix, box: [t.box.min.toArray(), t.box.max.toArray()] };   // (tekshiruv vositalari uchun)
  return grp;
}
