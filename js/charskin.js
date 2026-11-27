import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/addons/GLTFLoader.js';
import { hook } from './gfx.js';

// ================= SKINLI (SUYAKLI) ASKAR MODELLARI — assets/models/chars =================
// Harakat tizimi o'zgarmaydi: soldiermodel.js dagi ko'rinmas bo'g'im guruhlari (son, boldir, tana, bosh, qo'llar + qurol) avvalgidek
// harakatlanadi, bu yerda esa ularning burchaklari modelning suyaklariga ko'chiriladi. Qo'llar qurol dastasi va old qismiga
// ikki bo'g'imli IK bilan yetkaziladi (yelka → tirsak → bilak). Qurol — kodda qurilgan (o'q chiqadigan joy o'zgarmaydi).
// Model yuklanmasa yoki manzilda ?foto=0 bo'lsa — kodda qurilgan oddiy askar qoladi.
const off = typeof location !== 'undefined' && new URLSearchParams(location.search).get('foto') === '0';

// Bizning bo'g'imlar → model suyaklari. Qator — aniq nom, RegExp — nom qolipi (eksportchilar nomga raqam qo'shadi).
// three.js suyak nomidagi nuqta va ikki nuqtani olib tashlaydi: "DEF-leg.L" → "DEF-legL", "mixamorig:Hips" → "mixamorigHips".
const RIGIFY = {
  pelvis: 'DEF-pelvis', spine: 'DEF-spine', chest: 'DEF-Chest', neck: 'DEF-neck', head: 'DEF-head',
  legL: 'DEF-legL', shinL: 'DEF-shin-L', footL: 'DEF-footL', toeL: 'DEF-toesL', legR: 'DEF-legR', shinR: 'DEF-shin-R', footR: 'DEF-footR', toeR: 'DEF-toesR',
  shL: 'DEF-shoulderL', armL: 'DEF-armL', foreL: 'DEF-lowerarmL', handL: 'DEF-handL',
  shR: 'DEF-shoulderR', armR: 'DEF-armR', foreR: 'DEF-lowerarmR', handR: 'DEF-handR',
};
const UE = {   // Unreal (Epic) skeleti: pelvis, spine_01..03, thigh_l, calf_l ...
  pelvis: /^pelvis(_\d+)?$/, spine: /^spine_01(_\d+)?$/, chest: /^spine_03(_\d+)?$/, neck: /^neck_01(_\d+)?$/, head: /^head(_\d+)?$/,
  legL: /^thigh_l(_\d+)?$/, shinL: /^calf_l(_\d+)?$/, footL: /^foot_l(_\d+)?$/, toeL: /^ball_l(_\d+)?$/,
  legR: /^thigh_r(_\d+)?$/, shinR: /^calf_r(_\d+)?$/, footR: /^foot_r(_\d+)?$/, toeR: /^ball_r(_\d+)?$/,
  shL: /^clavicle_l(_\d+)?$/, armL: /^upperarm_l(_\d+)?$/, foreL: /^lowerarm_l(_\d+)?$/, handL: /^hand_l(_\d+)?$/,
  shR: /^clavicle_r(_\d+)?$/, armR: /^upperarm_r(_\d+)?$/, foreR: /^lowerarm_r(_\d+)?$/, handR: /^hand_r(_\d+)?$/,
};
const MIXAMO = {
  pelvis: /^mixamorigHips(_\d+)?$/, spine: /^mixamorigSpine(_\d+)?$/, chest: /^mixamorigSpine2(_\d+)?$/, neck: /^mixamorigNeck(_\d+)?$/, head: /^mixamorigHead(_\d+)?$/,
  legL: /^mixamorigLeftUpLeg(_\d+)?$/, shinL: /^mixamorigLeftLeg(_\d+)?$/, footL: /^mixamorigLeftFoot(_\d+)?$/, toeL: /^mixamorigLeftToeBase(_\d+)?$/,
  legR: /^mixamorigRightUpLeg(_\d+)?$/, shinR: /^mixamorigRightLeg(_\d+)?$/, footR: /^mixamorigRightFoot(_\d+)?$/, toeR: /^mixamorigRightToeBase(_\d+)?$/,
  shL: /^mixamorigLeftShoulder(_\d+)?$/, armL: /^mixamorigLeftArm(_\d+)?$/, foreL: /^mixamorigLeftForeArm(_\d+)?$/, handL: /^mixamorigLeftHand(_\d+)?$/,
  shR: /^mixamorigRightShoulder(_\d+)?$/, armR: /^mixamorigRightArm(_\d+)?$/, foreR: /^mixamorigRightForeArm(_\d+)?$/, handR: /^mixamorigRightHand(_\d+)?$/,
};
// Barmoqlar (bosh barmoqdan tashqari) — qurol dastasini ushlash uchun bukiladi
const FINGERS = { rigify: /^DEF-finger0(0[1-9]|1[0-2])$/, ue: /^(index|middle|ring|pinky)_0[1-3]_[lr](_\d+)?$/, mixamo: /^mixamorig(Left|Right)Hand(Index|Middle|Ring|Pinky)[1-3](_\d+)?$/ };
// Kiyim rangini o'zgartirish: sovet gimnastyorkasi → nemis feldgrau (kulrang-yashil). Teksturadagi yorqinlik saqlanadi.
function feldgrau(px) {
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2], l = 0.3 * r + 0.59 * g + 0.11 * b, sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (l < 34 || sat < 6) continue;   // qora (etik, kamar) va kulrang joylar o'zgarmaydi
    const k = l / 112;
    px[i] = Math.min(255, 88 * k); px[i + 1] = Math.min(255, 93 * k); px[i + 2] = Math.min(255, 83 * k);
  }
}
// Modellar va ularning mualliflari — assets/models/CREDITS.txt
export const CHARS = {
  operator: { url: 'assets/models/chars/operator.glb', bones: RIGIFY, fingers: FINGERS.rigify, rig: 'GameRig', rough: 0.86 },
  soldier2: { url: 'assets/models/chars/soldier2.glb', bones: RIGIFY, fingers: FINGERS.rigify, rig: 'GameRig', rough: 0.88 },
  soviet: { url: 'assets/models/chars/soviet.glb', bones: UE, fingers: FINGERS.ue, skip: /Eyelashes/, rough: 0.9 },
  german: { url: 'assets/models/chars/soviet.glb', bones: UE, fingers: FINGERS.ue, skip: /Eyelashes/, rough: 0.9, recolor: { Clothes: feldgrau, Material003: feldgrau, 'Material.003': feldgrau } },
  zombie: { url: 'assets/models/chars/zombie.glb', bones: MIXAMO, fingers: FINGERS.mixamo, skip: /Eyelashes/, rough: 0.8, curl: 0.35, tints: [0xc9d2c0, 0xc4b8a6, 0xaebcc4] },
};
// Qaysi askar qaysi model bilan chiziladi (davr, tomon, tur → model nomi; null — kodda qurilgan askar)
export function charFor(era, team, type) {
  if (off) return null;
  if (type === 'zombie') return 'zombie';
  if (era === 'modern') return team === 'ally' ? 'operator' : 'soldier2';
  return team === 'ally' ? 'soviet' : 'german';
}

const tpl = new Map();   // nom → { ready, ... } yoki { failed }
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _n3 = new THREE.Matrix3();
// Teksturani kichraytirish (videoxotira tejaladi) va kerak bo'lsa piksellarini o'zgartirish (kiyim rangi)
function shrink(tex, max, fn) {
  if (!tex || !tex.image) return null;
  const im = tex.image, w = im.width || 1, h = im.height || 1, k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext('2d', { willReadFrequently: !!fn }); g.drawImage(im, 0, 0, c.width, c.height);
  if (fn) { const d = g.getImageData(0, 0, c.width, c.height); fn(d.data); g.putImageData(d, 0, 0); }
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.anisotropy = 4;
  tex.dispose();
  return t;
}
function convertMat(def, src) {
  const rc = def.recolor && (def.recolor[src.name] || def.recolor[(src.name || '').replace(/\./g, '')]);
  const m = new THREE.MeshStandardMaterial({
    map: shrink(src.map, 1024, rc), normalMap: shrink(src.normalMap, 1024), roughnessMap: shrink(src.roughnessMap, 512),
    roughness: src.roughnessMap ? 1 : def.rough || 0.85, metalness: 0, color: rc ? 0xffffff : src.color,
  });
  if (m.normalMap && src.normalScale) m.normalScale.copy(src.normalScale);
  m.userData.shared = true;
  return hook(m, { dyn: true });
}
// Barcha skelet suyaklarining eng yaqin umumiy ajdodi (shu tugun nusxalanadi)
function lca(bones) {
  const chain = (o) => { const a = []; for (let x = o; x; x = x.parent) a.push(x); return a; };
  let common = chain(bones[0]);
  for (const b of bones.slice(1)) { const c = new Set(chain(b)); common = common.filter((x) => c.has(x)); }
  return common[0];
}
const findBone = (all, pat) => all.find((b) => (typeof pat === 'string' ? b.name === pat : pat.test(b.name)));
// Barcha qismlarni dam olish holatida bitta to'rga yig'ish
function bake(meshes, byObj) {
  let nv = 0, ni = 0;
  for (const m of meshes) { const g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), idx = new Uint32Array(ni);
  const srcMats = [], matIdx = new Map(), groups = [];
  const Mb = new THREE.Matrix4(), Mj = new THREE.Matrix4(), e = Mb.elements;
  let vo = 0, io = 0;
  for (const m of meshes) {
    const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
    const bones = m.skeleton.bones, inv = m.skeleton.boneInverses, remap = bones.map((b) => byObj.get(b));
    for (let i = 0; i < P.count; i++) {
      const k = vo + i;
      e.fill(0); let ws = 0;
      for (let c = 0; c < 4; c++) {
        const w = SW.getComponent(i, c), j = SI.getComponent(i, c);
        si[k * 4 + c] = remap[j] || 0; sw[k * 4 + c] = w; ws += w;
        if (w <= 0) continue;
        Mj.multiplyMatrices(bones[j].matrixWorld, inv[j]).multiply(m.bindMatrix);
        for (let q = 0; q < 16; q++) e[q] += Mj.elements[q] * w;
      }
      if (ws > 0) { for (let c = 0; c < 4; c++) sw[k * 4 + c] /= ws; for (let q = 0; q < 16; q++) e[q] /= ws; } else Mb.copy(m.matrixWorld);
      _v.fromBufferAttribute(P, i).applyMatrix4(Mb); pos[k * 3] = _v.x; pos[k * 3 + 1] = _v.y; pos[k * 3 + 2] = _v.z;
      _n3.getNormalMatrix(Mb); _v.fromBufferAttribute(N, i).applyMatrix3(_n3).normalize(); nor[k * 3] = _v.x; nor[k * 3 + 1] = _v.y; nor[k * 3 + 2] = _v.z;
      if (U) { uv[k * 2] = U.getX(i); uv[k * 2 + 1] = U.getY(i); }
    }
    const i0 = io;
    if (g.index) for (let j = 0; j < g.index.count; j++) idx[io++] = g.index.getX(j) + vo; else for (let j = 0; j < P.count; j++) idx[io++] = j + vo;
    vo += P.count;
    const src = Array.isArray(m.material) ? m.material[0] : m.material;
    if (!matIdx.has(src)) { matIdx.set(src, srcMats.length); srcMats.push(src); }
    const mi = matIdx.get(src), last = groups[groups.length - 1];
    if (last && last.mi === mi && last.end === i0) last.end = io; else groups.push({ start: i0, end: io, mi });
  }
  return { pos, nor, uv, si, sw, idx, groups, srcMats };
}
// Modelni yuklab, uni bitta skinli to'rga birlashtiradi (har askar — har material uchun bitta chizish chaqiruvi)
function build(def, gltf) {
  const sc = gltf.scene; sc.updateMatrixWorld(true);
  const meshes = []; sc.traverse((o) => { if (o.isSkinnedMesh && !(def.skip && def.skip.test(o.name))) meshes.push(o); });
  if (!meshes.length) throw new Error('skinli to\'r yo\'q');
  const allBones = [...new Set(meshes.flatMap((m) => m.skeleton.bones))];
  const bn = {};
  for (const k in def.bones) { const b = findBone(allBones, def.bones[k]); if (b) bn[k] = b; else if (!/^toe/.test(k)) throw new Error('suyak topilmadi: ' + k); }
  // yo'nalish va o'lcham: model tik turishi (tos → bosh = +y), +z tomonga qarashi (oyoq barmog'i tovondan oldinda) va bo'yi ~1.8 m bo'lishi kerak
  const fp = new THREE.Vector3(), tp = new THREE.Vector3(), hp = new THREE.Vector3(), pp0 = new THREE.Vector3();
  bn.head.getWorldPosition(hp); bn.pelvis.getWorldPosition(pp0);
  const up = hp.clone().sub(pp0).normalize();
  if (up.y < 0.95) { sc.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(0, 1, 0))); sc.updateMatrixWorld(true); }
  if (bn.toeL) { bn.footL.getWorldPosition(fp); bn.toeL.getWorldPosition(tp); if (tp.z < fp.z) { sc.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)); sc.updateMatrixWorld(true); } }
  bn.head.getWorldPosition(hp); bn.footL.getWorldPosition(fp);
  const hgt = (hp.y - fp.y + 0.09) / 0.9;   // (bosh suyagi tepa nuqtadan ~10% pastda; to'piq yerdan ~9 sm yuqorida)
  if (hgt < 1.5 || hgt > 2.1) { sc.scale.multiplyScalar(1.78 / hgt); sc.updateMatrixWorld(true); }
  // Har uch dam olish holatida o'z skini bilan hisoblanadi (qismlarning bog'lash matritsalari har xil bo'lishi mumkin),
  // so'ng hammasi umumiy skeletga bog'lanadi: suyak teskarisi = dam olish holatidagi suyak matritsasining teskarisi.
  const names = allBones.map((b) => b.name), byObj = new Map(allBones.map((b, i) => [b, i]));
  let B = bake(meshes, byObj);
  let minY = Infinity; for (let k = 1; k < B.pos.length; k += 3) minY = Math.min(minY, B.pos[k]);
  if (Math.abs(minY) > 0.01) { sc.position.y -= minY; sc.updateMatrixWorld(true); B = bake(meshes, byObj); }   // oyoq tagi y = 0 da bo'lsin
  const { pos, nor, uv, si, sw, idx, groups, srcMats } = B;
  const mats = srcMats.map((m) => convertMat(def, m));
  const inverses = allBones.map((b) => new THREE.Matrix4().copy(b.matrixWorld).invert());
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  for (const gr of groups) geo.addGroup(gr.start, gr.end - gr.start, gr.mi);
  geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.25;   // (yotgan, o'tirgan holatlar ham sig'sin)
  geo.userData.shared = true;
  // skelet nusxasi uchun: barcha suyaklarning umumiy ajdodi va uning ota tugunining (o'zgarmas) holati
  const top = lca(allBones), restQ = {}, boneName = {};
  for (const k in bn) { restQ[k] = bn[k].getWorldQuaternion(new THREE.Quaternion()); boneName[k] = bn[k].name; }
  const pp = bn.pelvis.parent;
  return {
    ready: true, geo, mat: mats.length === 1 ? mats[0] : mats, names, inverses, restQ, boneName, def, top,
    alignM: top.parent ? top.parent.matrixWorld.clone() : new THREE.Matrix4(),
    rigQ: pp.getWorldQuaternion(new THREE.Quaternion()), rigInv: new THREE.Matrix4().copy(pp.matrixWorld).invert(),
    upperA: bn.foreL.getWorldPosition(new THREE.Vector3()).distanceTo(bn.armL.getWorldPosition(new THREE.Vector3())),
    tris: idx.length / 3,
  };
}
export function loadChar(name) {
  if (tpl.has(name)) return tpl.get(name).p;
  const def = CHARS[name], rec = { ready: false };
  rec.p = new GLTFLoader().loadAsync(def.url).then((g) => { Object.assign(rec, build(def, g)); return rec; })
    .catch((e) => { console.warn('askar modeli yuklanmadi:', name, e && e.message); rec.failed = true; return null; });
  tpl.set(name, rec);
  return rec.p;
}
export function preloadChars() { if (!off) for (const k in CHARS) loadChar(k); }
const ready = (name) => { const r = tpl.get(name); return r && r.ready ? r : null; };

// ---------- askarga ulash ----------
// Rang variantlari (masalan, zombilarning teri tusi): teksturalar umumiy, faqat rang ko'paytuvchisi boshqa
function tinted(t, v) {
  const tn = t.def.tints;
  if (!tn) return t.mat;
  t.matV = t.matV || [];
  const i = v % tn.length;
  if (!t.matV[i]) {
    const one = (m) => { const n = hook(new THREE.MeshStandardMaterial({ map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, roughness: m.roughness, metalness: m.metalness, color: tn[i] }), { dyn: true }); n.userData.shared = true; return n; };
    t.matV[i] = Array.isArray(t.mat) ? t.mat.map(one) : one(t.mat);
  }
  return t.matV[i];
}
export function attachChar(s, name, handR, handL) {
  const t = ready(name);
  if (!t) return false;
  const box = new THREE.Group(); box.name = 'skin';
  const align = new THREE.Group(); align.matrixAutoUpdate = false; align.matrix.copy(t.alignM); box.add(align);
  const rig = t.top.clone(true);
  const drop = []; rig.traverse((o) => { if (o.isMesh) drop.push(o); }); for (const o of drop) o.parent.remove(o);
  align.add(rig);
  const byName = {}; rig.traverse((o) => { if (o.isBone) byName[o.name] = o; });
  const mesh = new THREE.SkinnedMesh(t.geo, tinted(t, s.variant | 0)); mesh.castShadow = true; mesh.receiveShadow = true;
  box.add(mesh);
  mesh.bind(new THREE.Skeleton(t.names.map((n) => byName[n]), t.inverses), new THREE.Matrix4());
  s.root.add(box);
  // kodda qurilgan tana yashiriladi (qurol qoladi)
  for (const g of [s.legL, s.shinL, s.legR, s.shinR, s.upper, s.torso, s.head, s.armsG]) for (const c of g.children) if (c.isMesh) c.visible = false;
  const B = {}; for (const k in t.boneName) B[k] = byName[t.boneName[k]];
  const rest = {}; for (const k in B) rest[k] = { q: B[k].quaternion.clone(), p: B[k].position.clone() };
  // qo'l nishonlari: qurol guruhi bilan birga harakatlanadi
  const mk = (p) => { const o = new THREE.Object3D(); o.position.copy(p); s.armsG.add(o); return o; };
  // barmoqlar dastani ushlaydi (bir marta bukiladi)
  const curl = t.def.curl ?? 0.85;
  rig.traverse((o) => { if (o.isBone && t.def.fingers && t.def.fingers.test(o.name)) o.quaternion.multiply(_qa.setFromAxisAngle(_X, curl)); });
  s.skin = { t, box, mesh, B, rest, tR: mk(handR), tL: mk(handL), name };
  return true;
}

// ---------- har kadr: bo'g'im burchaklarini suyaklarga ko'chirish ----------
const _X = new THREE.Vector3(1, 0, 0), _Y = new THREE.Vector3(0, 1, 0);
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _eu = new THREE.Euler();
const D = {}, W = {};
for (const k of Object.keys(RIGIFY)) { D[k] = new THREE.Quaternion(); W[k] = new THREE.Quaternion(); }
const qE = (out, r) => out.setFromEuler(r);
const local = (bone, parentW, w) => bone.quaternion.copy(_qi.copy(parentW).invert()).multiply(w);
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _H = new THREE.Vector3(), _T = new THREE.Vector3(), _P = new THREE.Vector3(), _d = new THREE.Vector3(), _u0 = new THREE.Vector3(), _u1 = new THREE.Vector3();
const _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _fq = new THREE.Quaternion();
const POLE_R = new THREE.Vector3(-0.55, -1, -0.35).normalize(), POLE_L = new THREE.Vector3(0.45, -1, -0.05).normalize();

export function poseChar(s) {
  const K = s.skin;
  if (!K) return;
  const t = K.t, B = K.B, R = t.restQ;
  // aylanishlar ildiz (askar) koordinatasida: W = D · dam olish holati
  D.pelvis.setFromAxisAngle(_Y, s.upper.rotation.y);
  qE(_qa, s.torso.rotation); D.chest.copy(D.pelvis).multiply(_qa); D.spine.copy(D.pelvis).multiply(_qb.identity().slerp(_qa, 0.5));
  qE(_qa, s.head.rotation); D.head.copy(D.chest).multiply(_qa); D.neck.copy(D.chest).multiply(_qb.identity().slerp(_qa, 0.4));
  const c = s.crouchAmt || 0;
  for (const [L, sg, sh, ft] of [[s.legL, 'legL', 'shinL', 'footL'], [s.legR, 'legR', 'shinR', 'footR']]) {
    const shin = L === s.legL ? s.shinL : s.shinR;
    qE(D[sg], L.rotation); qE(_qa, shin.rotation); D[sh].copy(D[sg]).multiply(_qa);
    D[ft].copy(D[sh]).multiply(_qb.setFromAxisAngle(_X, -(L.rotation.x + shin.rotation.x) * 0.55 * (1 - c)));   // tik turganda tovon yerga parallelroq
  }
  D.shL.copy(D.chest); D.shR.copy(D.chest);
  for (const k in D) if (R[k]) W[k].copy(D[k]).multiply(R[k]);
  local(B.pelvis, t.rigQ, W.pelvis);
  local(B.spine, W.pelvis, W.spine); local(B.chest, W.spine, W.chest);
  local(B.neck, W.chest, W.neck); local(B.head, W.neck, W.head);
  local(B.legL, W.pelvis, W.legL); local(B.shinL, W.legL, W.shinL); local(B.footL, W.shinL, W.footL);
  local(B.legR, W.pelvis, W.legR); local(B.shinR, W.legR, W.shinR); local(B.footR, W.shinR, W.footR);
  local(B.shL, W.chest, W.shL); local(B.shR, W.chest, W.shR);
  // tos pastga tushadi (cho'kkalash, yurish tebranishi): siljish rig koordinatasiga o'tkaziladi
  _d.set(0, s.upper.position.y, 0).applyMatrix3(_n3.setFromMatrix4(t.rigInv));
  B.pelvis.position.copy(K.rest.pelvis.p).add(_d);
  for (const k of ['armL', 'foreL', 'handL', 'armR', 'foreR', 'handR']) B[k].quaternion.copy(K.rest[k].q);
  // qo'llar: IK (dunyo koordinatasida)
  s.root.updateMatrixWorld(true);
  s.armsG.getWorldQuaternion(_pq);
  arm(K, B.armR, B.foreR, B.handR, K.tR, _P.copy(POLE_R).applyQuaternion(_pq));
  arm(K, B.armL, B.foreL, B.handL, K.tL, _P.copy(POLE_L).applyQuaternion(_pq));
}
// Ikki bo'g'imli IK: yelka (arm) → tirsak (fore) → bilak (hand); nishon — dastadagi nuqta (kaft markazi bilakdan ~7 sm oldinda)
function arm(K, A, F, H, tgt, pole) {
  A.getWorldPosition(_S); F.getWorldPosition(_E); H.getWorldPosition(_H); tgt.getWorldPosition(_T);
  const a = _S.distanceTo(_E), b = _E.distanceTo(_H), sc = a / K.t.upperA;   // (suyak uzunligi askar masshtabida)
  for (let it = 0; it < 2; it++) {
    // bilak nishoni: kaft dastada bo'lishi uchun nishondan bilak yo'nalishida biroz orqaga
    const goal = it === 0 ? _T : _d.copy(_T).addScaledVector(_u1.copy(_T).sub(_E).normalize(), -0.075 * sc);
    _d.copy(goal).sub(_S);
    const dist = _d.length(), L = Math.min(Math.max(dist, 1e-4), (a + b) * 0.999), dir = _d.multiplyScalar(1 / Math.max(dist, 1e-4));
    const x = (a * a - b * b + L * L) / (2 * L), h = Math.sqrt(Math.max(0, a * a - x * x));
    _u0.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
    _E.copy(_S).addScaledVector(dir, x).addScaledVector(_u0, h);
    _H.copy(_S).addScaledVector(dir, L);
  }
  // yelka suyagi: joriy yo'nalishdan yangi tirsak tomon
  F.getWorldPosition(_u0).sub(_S).normalize(); _u1.copy(_E).sub(_S).normalize();
  _qa.setFromUnitVectors(_u0, _u1);
  A.getWorldQuaternion(_wq); _wq.premultiply(_qa);
  A.parent.getWorldQuaternion(_pq); A.quaternion.copy(_pq.invert()).multiply(_wq);
  // bilak suyagi
  H.getWorldPosition(_u0); F.getWorldPosition(_d); _u0.sub(_d).normalize().applyQuaternion(_qa);
  _u1.copy(_H).sub(_E).normalize();
  _qb.setFromUnitVectors(_u0, _u1);
  F.getWorldQuaternion(_fq); _fq.premultiply(_qa).premultiply(_qb);
  F.quaternion.copy(_qi.copy(_wq).invert()).multiply(_fq);
}
