import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/addons/GLTFLoader.js';
import { hook } from './gfx.js';

// ================= TRANSPORT MODELLARI (assets/models/veh, CC BY — assets/models/CREDITS.txt) =================
// Transport fizikasi, to'qnashuv qutisi, o'rindiqlar va qurollar o'zgarmaydi — faqat ko'rinish almashadi.
// Model transport o'lchamiga moslanadi; harakatlanuvchi qismlari (minora, parraklar, g'ildiraklar) transportning o'z guruhlariga
// (turret, rotorG, tailG, wheels) o'tkaziladi va o'sha guruhlar bilan aylanadi. Kodda qurilgan shakl yashiriladi.
// Model yuklanmasa yoki manzilda ?foto=0 bo'lsa — kodda qurilgan transport qoladi.
const off = typeof location !== 'undefined' && new URLSearchParams(location.search).get('foto') === '0';
const U = 'assets/models/veh/';
// yaw — modelni +z tomonga qaratish (gradus); len — moslash uzunligi (fitPart berilsa — shu qismning uzunligi), rotorD — parrak diametri;
// skip — tashlab yuboriladigan to'rlar; turret / rotor / rotor2 / tail / wheels — harakatlanuvchi qismlar (tugun nomi bo'yicha);
// split — minora alohida bo'lmasa geometriya bo'yicha ajratish: { y: kuzov usti balandligi, r: minora halqasi radiusi, bw: stvol yarim kengligi };
// drop — olib tashlanadigan uchburchaklar (masalan, yuk mashinasining brezent tomi): { y, zMax }; double — ikki tomonlama (ichidan ham ko'rinadi)
// Mi-24 kabinasi kichik (model o'yindagi vertolyot o'lchamiga moslangan): hamma ichkarida o'tiradi, hech kim korpusdan chiqib turmaydi
const MI24_SEATS = { seats: [[0, 0.66, 1.5], [-0.3, 0.66, 0.85], [0.3, 0.66, 0.35], [-0.3, 0.66, -0.25]], sit: [true, true, true, true] };
// seats — o'rindiqlar (oyoq nuqtasi, transport koordinatasida; 4-qiymat 1 — minora bilan aylanadi), guns — o'qchining ko'zi/pulemyoti, sit — o'tirib boradimi,
// show — tashqaridan ko'rinadimi (tankda haydovchi ichkarida, komandir lyukda beligacha)
export const VMODELS = {
  'tank|historical': { url: U + 't34.glb', yaw: 180, fitPart: /BODY/, len: 6.1, turret: /tower/i, seats: [[-0.45, 0.45, 1.8], [-0.4, 1.45, -0.6, 1]], guns: { 1: [-0.4, 3.3, -0.6, 1] }, show: [false, true] },
  'ltank|historical': { url: U + 'pz4.glb', yaw: 0, len: 5.9, turret: /DrawCall_(1|6|7)$/, unshear: 0.35, seats: [[-0.45, 0.3, 1.1], [0, 0.59, -0.6, 1]], guns: { 1: [0, 2.45, -0.6, 1] }, show: [false, true] },   // (fayldagi model ustdan qaraganda parallelogramm — ikki yo'nalishda to'g'rilanadi)
  'tank|modern': { url: U + 'abrams.glb', yaw: 90, len: 7.9, split: { y: 1.43, r: 2.25, bw: 0.3, px: 0, pz: -0.95 }, seats: [[0.55, 0.35, 1.9], [0.45, 0.91, -0.9, 1]], guns: { 1: [0.45, 2.76, -0.9, 1] }, show: [false, true] },
  'ltank|modern': { url: U + 't90.glb', yaw: 0, len: 6.9, split: { y: 1.05, r: 1.45, bw: 0.25, px: 0, pz: -0.8 }, seats: [[-0.5, 0.25, 1.2], [0.4, 0.5, -0.3, 1]], guns: { 1: [0.4, 2.35, -0.3, 1] }, show: [false, true] },
  'jeep|historical': { url: U + 'willys.glb', yaw: 180, len: 3.9, skip: /Outline|Ground|Plane001/, wheels: /^wheel\d/ },
  'jeep|modern': { url: U + 'humvee.glb', yaw: 90, len: 4.5 },
  'heli|historical': { url: U + 'mi24.glb', yaw: 0, rotorD: 12.5, rotor: /Top_Rotor/, tail: /Tail_Rotor/, ...MI24_SEATS },
  'heli|modern': { url: U + 'mi24.glb', yaw: 0, rotorD: 12.5, rotor: /Top_Rotor/, tail: /Tail_Rotor/, ...MI24_SEATS },
  'chinook|historical': { url: U + 'chinook.glb', yaw: 180, len: 12.6, fitPart: /^Plane$/, rotor: /^Plane002$/, rotor2: /^Plane003$/, double: true },
  'chinook|modern': { url: U + 'chinook.glb', yaw: 180, len: 12.6, fitPart: /^Plane$/, rotor: /^Plane002$/, rotor2: /^Plane003$/, double: true },
  'truck|historical': { url: U + 'ural.glb', yaw: 0, len: 7.9, drop: { y: 2.0, zMax: 0.12 } },
  'truck|modern': { url: U + 'ural.glb', yaw: 0, len: 7.9, drop: { y: 2.0, zMax: 0.12 } },
};
export const vehModelFor = (type, era) => (off ? null : VMODELS[type + '|' + era] || null);
// Evakuatsiya vertolyoti (zombi rejimi yakuni): o'sha Chinuk, faqat orqa devori o'yilgan — ochiq rampadan yuk bo'limiga kiriladi
export const EVAC_DEF = { ...VMODELS['chinook|modern'], cut: (x, y, z) => z < -4.9 && y > 0.3 && y < 3.7 && Math.abs(x) < 1.75 };
export const evacModel = () => (off ? null : EVAC_DEF);
// Zamonaviy davr dronining modeli (parraklar — har biri o'z markazi atrofida aylanadi)
export const DRONE_DEF = { url: U + 'drone.glb', yaw: 180, len: 0.5, wheels: /propeller/ };

const tpl = new Map();
const _v = new THREE.Vector3(), _b = new THREE.Box3();
// tugun (yoki uning ajdodlaridan biri) nomi qolipga mos keladimi
const nameIn = (o, re, stop) => { for (let x = o; x && x !== stop; x = x.parent) if (re.test(x.name)) return true; return false; };
function shrink(tex, max) {
  if (!tex || !tex.image) return null;
  const im = tex.image, w = im.width || 1, h = im.height || 1, k = Math.min(1, max / Math.max(w, h));
  if (k >= 1) return tex;
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.anisotropy = 4;
  tex.dispose();
  return t;
}
function convertMat(src, def) {
  const m = new THREE.MeshStandardMaterial({
    map: shrink(src.map, 2048), normalMap: shrink(src.normalMap, 1024), roughnessMap: shrink(src.roughnessMap, 1024),
    color: src.color, roughness: src.roughnessMap ? 1 : Math.max(0.55, src.roughness ?? 0.7), metalness: Math.min(0.35, src.metalness ?? 0.2),
    side: def.double ? THREE.DoubleSide : THREE.FrontSide, transparent: !!src.transparent && src.opacity < 0.99, opacity: src.opacity ?? 1,
  });
  if (m.normalMap && src.normalScale) m.normalScale.copy(src.normalScale);
  m.userData.shared = true;
  return hook(m, { dyn: true });
}
// To'rlarni (dunyo koordinatasida pishirilgan) bir geometriyaga yig'ish: faqat joy, normal, uv
function merge(list) {
  // faqat uchburchaklarda ishlatilgan cho'qqilar olinadi (bo'lib olingan qismlarda qolgan "begona" cho'qqilar chegaralarni buzmasin)
  const maps = list.map((g) => {
    const P = g.attributes.position;
    if (!g.index) return null;
    const m = new Int32Array(P.count).fill(-1); let k = 0;
    for (let j = 0; j < g.index.count; j++) { const v = g.index.getX(j); if (m[v] < 0) m[v] = k++; }
    return { m, k };
  });
  let nv = 0, ni = 0;
  list.forEach((g, gi) => { nv += maps[gi] ? maps[gi].k : g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  list.forEach((g, gi) => {
    const P = g.attributes.position, N = g.attributes.normal, T = g.attributes.uv, mp = maps[gi];
    for (let i = 0; i < P.count; i++) {
      const o = mp ? mp.m[i] : i;
      if (o < 0) continue;
      const w = vo + o;
      pos[w * 3] = P.getX(i); pos[w * 3 + 1] = P.getY(i); pos[w * 3 + 2] = P.getZ(i);
      if (N) { nor[w * 3] = N.getX(i); nor[w * 3 + 1] = N.getY(i); nor[w * 3 + 2] = N.getZ(i); }
      if (T) { uv[w * 2] = T.getX(i); uv[w * 2 + 1] = T.getY(i); }
    }
    if (g.index) for (let j = 0; j < g.index.count; j++) idx[io++] = mp.m[g.index.getX(j)] + vo; else for (let j = 0; j < P.count; j++) idx[io++] = j + vo;
    vo += mp ? mp.k : P.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  if (!list.some((g) => g.attributes.normal)) out.computeVertexNormals();
  out.computeBoundingSphere(); out.computeBoundingBox();
  out.userData.shared = true;
  return out;
}
// Indeksli geometriyadan uchburchaklarni ajratish: pick(ax, ay, az, bx, ..., cz) → qism nomi (yoki null — tashlab yuboriladi)
function splitTris(g, pick) {
  const P = g.attributes.position, idx = g.index ? g.index.array : null, n = idx ? idx.length : P.count, out = {};
  for (let t = 0; t < n; t += 3) {
    const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2;
    const cx = (P.getX(a) + P.getX(b) + P.getX(c)) / 3, cy = (P.getY(a) + P.getY(b) + P.getY(c)) / 3, cz = (P.getZ(a) + P.getZ(b) + P.getZ(c)) / 3;
    const k = pick(cx, cy, cz);
    if (k) (out[k] || (out[k] = [])).push(a, b, c);
  }
  const res = {};
  for (const k in out) { const ng = g.clone(); ng.setIndex(out[k]); res[k] = ng; }
  return res;
}
// Geometriyani bog'langan bo'laklarga (komponentlarga) ajratadi: bir xil joydagi cho'qqilar (UV choklari) bitta deb hisoblanadi.
// Qaytaradi: [{ tris: [a,b,c,...] (indekslar), c: markaz, min, max }]
export function components(g) {
  const P = g.attributes.position, idx = g.index ? g.index.array : null, n = idx ? idx.length : P.count;
  const key = new Map(), par = [], vid = new Int32Array(P.count);
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let i = 0; i < P.count; i++) {
    const k = Math.round(P.getX(i) * 400) + ',' + Math.round(P.getY(i) * 400) + ',' + Math.round(P.getZ(i) * 400);
    let r = key.get(k); if (r === undefined) { r = par.length; par.push(r); key.set(k, r); } vid[i] = r;
  }
  for (let t = 0; t < n; t += 3) {
    const a = find(vid[idx ? idx[t] : t]), b = find(vid[idx ? idx[t + 1] : t + 1]), c = find(vid[idx ? idx[t + 2] : t + 2]);
    par[b] = a; par[find(c)] = a;
  }
  const comps = new Map();
  for (let t = 0; t < n; t += 3) {
    const a = idx ? idx[t] : t, r = find(vid[a]);
    let C = comps.get(r); if (!C) comps.set(r, (C = { tris: [], c: new THREE.Vector3(), min: new THREE.Vector3(1e9, 1e9, 1e9), max: new THREE.Vector3(-1e9, -1e9, -1e9), nv: 0 }));
    for (let k = 0; k < 3; k++) { const v = idx ? idx[t + k] : t + k; C.tris.push(v); _v.fromBufferAttribute(P, v); C.c.add(_v); C.min.min(_v); C.max.max(_v); C.nv++; }
  }
  const list = [...comps.values()]; for (const C of list) C.c.divideScalar(C.nv);
  return list;
}
// Shablon: model o'lchamga moslanadi va qismlarga ajratiladi (har qism — material bo'yicha birlashtirilgan geometriyalar)
function build(def, gltf) {
  const sc = gltf.scene;
  if (def.skip) { const drop = []; sc.traverse((o) => { if (o.isMesh && nameIn(o, def.skip, sc)) drop.push(o); }); for (const o of drop) o.parent.remove(o); }
  sc.rotation.y = THREE.MathUtils.degToRad(def.yaw || 0); sc.updateMatrixWorld(true);
  const meshesOf = (re) => { const a = []; sc.traverse((o) => { if (o.isMesh && (!re || nameIn(o, re, sc))) a.push(o); }); return a; };
  const boxOf = (list) => { const b = new THREE.Box3(); for (const m of list) b.union(_b.setFromObject(m)); return b; };
  // o'lcham
  let k = 1;
  if (def.rotorD) { const s = boxOf(meshesOf(def.rotor)).getSize(_v); k = def.rotorD / Math.max(s.x, s.z); }
  else { const s = boxOf(meshesOf(def.fitPart || null)).getSize(_v); k = def.len / s.z; }
  sc.scale.setScalar(k); sc.updateMatrixWorld(true);
  const all = boxOf(meshesOf(null)), c = all.getCenter(new THREE.Vector3());
  sc.position.set(-c.x, -all.min.y, -c.z); sc.updateMatrixWorld(true);
  // ba'zi fayllarda model ustdan qaraganda parallelogramm (x z ga qarab siljigan): uzunlik bo'ylab kesimlar o'rtasining z ga bog'liqligi bo'yicha to'g'rilanadi
  let unshear = null, shearKJ = null;
  if (def.unshear) {
    const NB = 40, lo = new Array(NB).fill(1e9), hi = new Array(NB).fill(-1e9), sz = all.max.z - all.min.z;
    for (const m of meshesOf(null)) { const P = m.geometry.attributes.position; for (let i = 0; i < P.count; i++) { _v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); const b = Math.min(NB - 1, Math.max(0, Math.floor(((_v.z - all.min.z + c.z) / sz) * NB))); lo[b] = Math.min(lo[b], _v.x); hi[b] = Math.max(hi[b], _v.x); } }
    let n = 0, sz2 = 0, sx = 0, szz = 0, sxz = 0;
    for (let b = Math.floor(NB * 0.15); b < Math.ceil(NB * 0.85); b++) if (hi[b] > lo[b]) { const z = all.min.z - c.z + ((b + 0.5) / NB) * sz, x = (lo[b] + hi[b]) / 2; n++; sz2 += z; sx += x; szz += z * z; sxz += x * z; }
    const k = n > 3 ? (n * sxz - sz2 * sx) / (n * szz - sz2 * sz2) : 0;
    unshear = new THREE.Matrix4().set(1, 0, -k, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    // so'ng ikkinchi yo'nalish: ko'ndalang kesimlar (x bo'yicha) uzunlik o'rtasi x ga bog'liq bo'lmasin (chap va o'ng gusenitsa bir xil joyda)
    const NX = 24, zl = new Array(NX).fill(1e9), zh = new Array(NX).fill(-1e9), pts = [];
    for (const m of meshesOf(null)) { const P = m.geometry.attributes.position; for (let i = 0; i < P.count; i++) { _v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld).applyMatrix4(unshear); pts.push(_v.x, _v.z); } }
    let x0 = 1e9, x1 = -1e9; for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); }
    const sx0 = x1 - x0 || 1;
    for (let i = 0; i < pts.length; i += 2) { const b = Math.min(NX - 1, Math.max(0, Math.floor(((pts[i] - x0) / sx0) * NX))); zl[b] = Math.min(zl[b], pts[i + 1]); zh[b] = Math.max(zh[b], pts[i + 1]); }
    // faqat chetki (gusenitsa) kesimlari: o'rtadagi stvol va minora o'lchovni buzmasin
    const side = (b0, b1) => { let n2 = 0, xs = 0, zs = 0; for (let b = b0; b < b1; b++) if (zh[b] > zl[b]) { n2++; xs += x0 + ((b + 0.5) / NX) * sx0; zs += (zl[b] + zh[b]) / 2; } return n2 ? [xs / n2, zs / n2] : null; };
    const L1 = side(1, Math.round(NX * 0.25)), R1 = side(Math.round(NX * 0.75), NX - 1);
    const j = typeof def.unshear === 'number' ? def.unshear : L1 && R1 ? (R1[1] - L1[1]) / (R1[0] - L1[0]) : 0;   // (son berilgan bo'lsa — o'sha: gusenitsalar bo'yicha o'lchangan)
    if (Math.abs(j) > 0.01) unshear.premultiply(new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, -j, 0, 1, 0, 0, 0, 0, 1));
    shearKJ = [k, j, L1, R1];
    if (Math.abs(k) < 0.01 && Math.abs(j) < 0.01) unshear = null;
  }
  // qismlar: tugun nomi bo'yicha; qolgani — korpus
  const roles = ['turret', 'rotor', 'rotor2', 'tail', 'wheels'];
  const parts = {}, mats = new Map(), wheelList = [];
  const matOf = (src) => { if (!mats.has(src)) mats.set(src, convertMat(src, def)); return mats.get(src); };
  const add = (role, src, geo) => { const p = parts[role] || (parts[role] = new Map()); const m = matOf(src); if (!p.has(m)) p.set(m, []); p.get(m).push(geo); };
  sc.traverse((o) => {
    if (!o.isMesh) return;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (unshear) geo.applyMatrix4(unshear);
    for (const key of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(key)) geo.deleteAttribute(key);
    const role = roles.find((r) => def[r] && nameIn(o, def[r], sc)) || 'hull';
    if (role === 'wheels') { geo.computeBoundingBox(); wheelList.push({ geo, mat: matOf(src), c: geo.boundingBox.getCenter(new THREE.Vector3()), r: geo.boundingBox.getSize(new THREE.Vector3()).y / 2 }); return; }
    add(role, src, geo);
  });
  // minora alohida bo'lmasa — geometriya bo'yicha: kuzov ustidan yuqoridagi halqa ichi va old tomondagi ingichka stvol
  if (def.split && parts.hull) {
    const S = def.split, hull = parts.hull; parts.hull = new Map();
    // minora markazi: kuzov ustidagi (stvoldan tashqari) uchlar o'rtasi
    let sx = 0, sz = 0, n = 0;
    for (const [, list] of hull) for (const g of list) { const P = g.attributes.position; for (let i = 0; i < P.count; i++) if (P.getY(i) > S.y + 0.15 && Math.abs(P.getX(i)) > S.bw * 1.5) { sx += P.getX(i); sz += P.getZ(i); n++; } }
    const px = S.px ?? (n ? sx / n : 0), pz = S.pz ?? (n ? sz / n : 0);
    // bo'lak minoraga tegishli: markazi kuzov ustida (S.y dan yuqori) va minora halqasi (S.r) ichida; yoki stvol — uzun ingichka, o'rta chiziqda, oldinga qaragan
    const isTurret = (C) => {
      const L = C.max.z - C.min.z, w = Math.max(C.max.x - C.min.x, C.max.y - C.min.y);
      if (C.c.y > S.y && Math.hypot(C.c.x - px, C.c.z - pz) < S.r) return true;
      return L > 0.8 && L > 4 * w && Math.abs(C.c.x - px) < S.bw && C.c.z > pz && C.c.y > S.y - 0.25;
    };
    // stvol ichida yoki uning ustida turgan mayda bo'laklar (dulo tormozi, halqalar) ham stvol bilan birga aylanadi
    const comps = []; for (const [m, list] of hull) for (const g of list) comps.push([m, g, components(g)]);
    const bars = []; for (const [, , cl] of comps) for (const C of cl) if (isTurret(C) && C.c.y > S.y - 0.25 && C.max.z - C.min.z > 0.8 && C.c.z > pz) bars.push(new THREE.Box3(C.min.clone(), C.max.clone()).expandByScalar(0.03));
    const inBarrel = (C) => bars.some((b) => b.containsBox(new THREE.Box3(C.min, C.max)));
    for (const [m, g, cl] of comps) {
      const sp = { hull: [], turret: [] };
      for (const C of cl) { const dst = isTurret(C) || inBarrel(C) ? sp.turret : sp.hull; for (const v of C.tris) dst.push(v); }
      for (const role in sp) { if (!sp[role].length) continue; const ng = g.clone(); ng.setIndex(sp[role]); const p = parts[role] || (parts[role] = new Map()); if (!p.has(m)) p.set(m, []); p.get(m).push(ng); }
    }
  }
  // olib tashlanadigan uchburchaklar (brezent tom)
  if (def.drop) for (const [m, list] of parts.hull || []) parts.hull.set(m, list.map((g) => splitTris(g, (x, y, z) => (y > def.drop.y && z < def.drop.zMax ? null : 'k')).k).filter(Boolean));
  if (def.cut) for (const [m, list] of parts.hull || []) parts.hull.set(m, list.map((g) => splitTris(g, (x, y, z) => (def.cut(x, y, z) ? null : 'k')).k).filter(Boolean));   // (o'yiq: masalan, ochiq orqa eshik)
  const out = { def, parts: {}, wheels: [], shearKJ };
  for (const role in parts) out.parts[role] = [...parts[role]].filter(([, l]) => l.length).map(([m, l]) => ({ mat: m, geo: merge(l) }));
  for (const w of wheelList) out.wheels.push({ c: w.c, r: w.r, mat: w.mat, geo: merge([w.geo]) });
  // aylanish nuqtalari
  const bb = (role) => { const b = new THREE.Box3(); for (const p of out.parts[role] || []) b.union(p.geo.boundingBox); return b; };
  if (out.parts.turret) {
    const tb = bb('turret');
    let sx = 0, sz = 0, n = 0, tipZ = -1e9, ty = 0, tn = 0;
    for (const p of out.parts.turret) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (Math.abs(x - (tb.min.x + tb.max.x) / 2) > 0.35) { sx += x; sz += z; n++; } } }
    out.pivot = new THREE.Vector3(n ? sx / n : (tb.min.x + tb.max.x) / 2, tb.min.y, n ? sz / n : (tb.min.z + tb.max.z) / 2);
    if (def.split && def.split.pz !== undefined) { out.pivot.x = def.split.px || 0; out.pivot.z = def.split.pz; }   // minora halqasining markazi (aylanish o'qi) aniq berilgan
    // stvol uchi: minoraning eng oldingi nuqtasi (markaz chizig'i yaqinida)
    for (const p of out.parts.turret) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) if (Math.abs(P.getX(i) - out.pivot.x) < 0.3) tipZ = Math.max(tipZ, P.getZ(i)); }
    for (const p of out.parts.turret) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) if (Math.abs(P.getX(i) - out.pivot.x) < 0.3 && P.getZ(i) > tipZ - 0.3) { ty += P.getY(i); tn++; } }
    out.tip = new THREE.Vector3(out.pivot.x, tn ? ty / tn : tb.max.y - 0.3, tipZ);
  }
  for (const r of ['rotor', 'rotor2', 'tail']) if (out.parts[r]) out[r + 'Hub'] = bb(r).getCenter(new THREE.Vector3());
  out.tris = 0; for (const r in out.parts) for (const p of out.parts[r]) out.tris += p.geo.index.count / 3;
  return out;
}
export function loadVeh(def) {
  if (tpl.has(def)) return tpl.get(def).p;
  const rec = { ready: false };
  rec.p = new GLTFLoader().loadAsync(def.url).then((g) => { Object.assign(rec, build(def, g), { ready: true }); return rec; })
    .catch((e) => { console.warn('transport modeli yuklanmadi:', def.url, e && e.message); rec.failed = true; return null; });
  tpl.set(def, rec);
  return rec.p;
}
export function preloadVehicles(era) { if (off) return; for (const k in VMODELS) if (k.endsWith('|' + era)) loadVeh(VMODELS[k]); loadVeh(DRONE_DEF); loadTurret(TURRET_DEFS[era]); }
// Dron ko'rinishi: { g — guruh, rotors — aylanadigan parraklar } yoki null (model yuklanmagan)
// 1944 yil: o'sha dron, xaki-zaytun rangga bo'yalgan (materiallar bir marta nusxalanadi)
const droneTint = new Map();
const tintOf = (m) => { let c = droneTint.get(m); if (!c) { c = m.clone(); c.color = m.color.clone().multiply(new THREE.Color(0x8c9a62)); c.roughness = Math.max(c.roughness, 0.7); c.userData.shared = true; droneTint.set(m, c); } return c; };
export function droneVisual(era = 'modern') {
  const t = tpl.get(DRONE_DEF);
  if (off || !t || !t.ready) return null;
  const g = new THREE.Group(), rotors = [], H = era === 'historical', mt = (m) => (H ? tintOf(m) : m);
  for (const role in t.parts) for (const p of t.parts[role]) { const m = new THREE.Mesh(p.geo, mt(p.mat)); m.castShadow = true; g.add(m); }
  for (const w of t.wheels) { const pv = new THREE.Group(); pv.position.copy(w.c); const m = new THREE.Mesh(w.geo, mt(w.mat)); m.position.copy(w.c).negate(); m.castShadow = true; pv.add(m); g.add(pv); rotors.push(pv); }
  return { g, rotors };
}

// ================= TUREL (o'zi otadigan pulemyot) =================
// Taglik (uch oyoq / g'ildirakli stanok) joyida turadi, pulemyot (bosh) aylanadi. Bosh — markazi balandlikning `head` ulushidan yuqoridagi bo'laklar.
// height — umumiy balandlik (metr). Stvol +z tomonga buriladi (bosh aylanish o'qidan eng uzoq nuqtasi — stvol uchi).
export const TURRET_DEFS = {
  modern: { url: 'assets/models/guns/dshk.glb', height: 1.12, head: 0.72 },
  historical: { url: 'assets/models/guns/maxim.glb', height: 0.85, head: 0.47 },
};
const turTpl = new Map();
function buildTurret(def, gltf) {
  const sc = gltf.scene; sc.updateMatrixWorld(true);
  const mats = new Map(), geos = [];
  sc.traverse((o) => {
    if (!o.isMesh) return;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mats.has(src)) { const m = convertMat(src, def); m.userData.shared = true; mats.set(src, m); }
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
    geos.push({ g, m: mats.get(src) });
  });
  const box = new THREE.Box3(); for (const p of geos) { p.g.computeBoundingBox(); box.union(p.g.boundingBox); }
  const k = def.height / (box.max.y - box.min.y);
  const M = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
  const head = new Map(), base = new Map(), put = (map, m, g) => { if (!map.has(m)) map.set(m, []); map.get(m).push(g); };
  for (const p of geos) {
    p.g.applyMatrix4(M);
    const hi = [], lo = [];
    for (const C of components(p.g)) { const dst = C.c.y > def.height * def.head ? hi : lo; for (const v of C.tris) dst.push(v); }
    if (hi.length) { const ng = p.g.clone(); ng.setIndex(hi); put(head, p.m, ng); }
    if (lo.length) { const ng = p.g.clone(); ng.setIndex(lo); put(base, p.m, ng); }
  }
  const out = { head: [...head].map(([m, l]) => ({ mat: m, geo: merge(l) })), base: [...base].map(([m, l]) => ({ mat: m, geo: merge(l) })) };
  // aylanish o'qi: taglikning eng yuqori qismi (tirgak uchi) markazi
  let top = -1e9; for (const p of out.base) { p.geo.computeBoundingBox(); top = Math.max(top, p.geo.boundingBox.max.y); }
  let px = 0, pz = 0, n = 0;
  for (const p of out.base) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) if (P.getY(i) > top - def.height * 0.06) { px += P.getX(i); pz += P.getZ(i); n++; } }
  const hb = new THREE.Box3(); for (const p of out.head) { p.geo.computeBoundingBox(); hb.union(p.geo.boundingBox); }
  if (!n) { px = (hb.min.x + hb.max.x) / 2; pz = (hb.min.z + hb.max.z) / 2; top = hb.min.y; } else { px /= n; pz /= n; }
  // stvol +z ga: boshning aylanish o'qidan eng uzoq nuqtasi yo'nalishi bo'yicha burish (taglik ham birga)
  let far = 0, fx = 0, fz = 1;
  for (const p of out.head) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) { const dx = P.getX(i) - px, dz = P.getZ(i) - pz, d = dx * dx + dz * dz; if (d > far) { far = d; fx = dx; fz = dz; } } }
  const R = new THREE.Matrix4().makeTranslation(px, 0, pz).multiply(new THREE.Matrix4().makeRotationY(-Math.atan2(fx, fz))).multiply(new THREE.Matrix4().makeTranslation(-px, 0, -pz));
  for (const p of out.head.concat(out.base)) { p.geo.applyMatrix4(R); p.geo.computeBoundingBox(); p.geo.computeBoundingSphere(); p.geo.userData.shared = true; }
  // stvol balandligi (o'q chiqadigan nuqta): boshning old 10 % idagi cho'qqilar o'rtacha balandligi
  hb.makeEmpty(); for (const p of out.head) hb.union(p.geo.boundingBox);
  let ey = 0, en = 0; const zf = hb.max.z - (hb.max.z - hb.min.z) * 0.1;
  for (const p of out.head) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) if (P.getZ(i) >= zf) { ey += P.getY(i); en++; } }
  out.pivot = new THREE.Vector3(px, top, pz); out.eyeH = en ? ey / en : (hb.min.y + hb.max.y) / 2; out.headTop = hb.max.y;
  return out;
}
export function loadTurret(def) {
  if (!def || off) return null;
  if (turTpl.has(def)) return turTpl.get(def).p;
  const rec = { ready: false };
  rec.p = new GLTFLoader().loadAsync(def.url).then((g) => { Object.assign(rec, buildTurret(def, g), { ready: true }); return rec; })
    .catch((e) => { console.warn('turel modeli yuklanmadi:', def.url, e && e.message); rec.failed = true; return null; });
  turTpl.set(def, rec);
  return rec.p;
}
// Turel ko'rinishi: { g — butun guruh (taglik), head — aylanadigan bosh (aylanish o'qida), eyeH — stvol balandligi } yoki null
export function turretVisual(era) {
  const def = TURRET_DEFS[era], t = def && turTpl.get(def);
  if (off || !t || !t.ready) { if (def && !t) loadTurret(def); return null; }
  const g = new THREE.Group(), head = new THREE.Group();
  for (const p of t.base) { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  head.position.copy(t.pivot); g.add(head);
  for (const p of t.head) { const m = new THREE.Mesh(p.geo, p.mat); m.position.copy(t.pivot).negate(); m.castShadow = true; head.add(m); }
  return { g, head, eyeH: t.eyeH, headTop: t.headTop - t.pivot.y };
}

const HIDE = new THREE.MeshBasicMaterial({ visible: false });
// Transportga modelni ulash. keep — ko'rinib qoladigan kod qismlari (masalan, jipdagi pulemyot)
export function attachVeh(v, def, keep = []) {
  const t = tpl.get(def);
  if (!t || !t.ready) return false;
  const keepSet = new Set();
  for (const k of keep) if (k) k.traverse((o) => keepSet.add(o));
  v.root.traverse((o) => { if (o.isMesh && !keepSet.has(o)) { o.userData.codeMat = o.material; o.material = HIDE; o.castShadow = false; } });
  const mk = (p, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(p.geo, p.mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const K = v.T.tank;
  // modelning siljishi: minora markazi transportning minora o'qiga to'g'ri kelsin (tank) — aks holda markaz joyida
  const O = new THREE.Vector3();
  if (K && t.pivot) O.set(-t.pivot.x, 0, K.turretZ - t.pivot.z);
  const hullG = new THREE.Group(); hullG.position.copy(O); v.hull.add(hullG);
  for (const p of t.parts.hull || []) mk(p, hullG);
  if (t.parts.turret && v.turret) {
    const tp = v.turret.position;   // (korpus koordinatasida)
    for (const p of t.parts.turret) mk(p, v.turret, O.x - tp.x, O.y - tp.y, O.z - tp.z);
    // o'q chiqadigan joy: model stvolining uchi (har transportning o'z nusxasi — boshqa davrdagi shu turdagi transportga ta'sir qilmaydi)
    if (K && t.tip) v.tk = Object.assign({}, K, { barBase: 0, barLen: t.tip.z + O.z - K.turretZ, pivotY: t.tip.y });
  }
  const hubOn = (grp, part, hub) => { if (!grp || !t.parts[part]) return; grp.position.set(hub.x + O.x, hub.y, hub.z + O.z); for (const p of t.parts[part]) mk(p, grp, -hub.x, -hub.y, -hub.z); };
  hubOn(v.rotorG, 'rotor', t.rotorHub); hubOn(v.rotorG2, 'rotor2', t.rotor2Hub); hubOn(v.tailG, 'tail', t.tailHub);
  if (t.wheels.length && v.wheels) {
    v.wheels = t.wheels.map((w) => { const g = new THREE.Group(); g.position.set(w.c.x + O.x, w.c.y, w.c.z + O.z); v.hull.add(g); mk(w, g, -w.c.x, -w.c.y, -w.c.z); return g; });
  }
  v.skin = { def, tris: t.tris };
  return true;
}
