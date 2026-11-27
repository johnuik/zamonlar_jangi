import * as THREE from '../lib/three.module.js';
import { hook } from './gfx.js';

// ================= FOTO-SKANERLANGAN MODELLAR (Poly Haven, CC0 — assets/models) =================
// Modellar oldindan ixcham ko'rinishga keltirilgan: <nom>.bin (joy, normal, uv — float32; indekslar — uint32)
// va index.json (o'lcham, qismlar, teksturalar, ver — fayl o'zgarsa brauzer keshini chetlab o'tadigan raqam). Model yerda turadi: asosining markazi — koordinata boshi.
// Fayl topilmasa yoki manzilda ?foto=0 bo'lsa null qaytadi — kodda qurilgan oddiy shakl o'z joyida qoladi.
const off = typeof location !== 'undefined' && new URLSearchParams(location.search).get('foto') === '0';
const cache = new Map(), loader = new THREE.TextureLoader();
let indexP = null;
const getIndex = () => indexP || (indexP = fetch('assets/models/index.json').then((r) => (r.ok ? r.json() : null)).catch(() => null));

function tex(file, srgb, ver) {
  if (!file) return Promise.resolve(null);
  return loader.loadAsync('assets/models/' + file + '?v=' + ver).then((t) => {
    t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;   // (glTF: uv boshi yuqori chap burchakda)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }).catch(() => null);
}
async function build(d, buf) {
  const parts = [];
  for (const p of d.parts) {
    const g = new THREE.BufferGeometry(), f = (o, n) => new Float32Array(buf, o, n);
    g.setAttribute('position', new THREE.BufferAttribute(f(p.off, p.v * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(f(p.off + p.v * 12, p.v * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(f(p.off + p.v * 24, p.v * 2), 2));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, p.off + p.v * 32, p.i), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    g.userData.shared = true;   // dunyo almashganda o'chirilmaydi (core.js: disposeTree) — keyingi o'yinda qayta ishlatiladi
    const [map, normalMap, arm] = await Promise.all([tex(p.d, true, d.ver), tex(p.n, false, d.ver), tex(p.a, false, d.ver)]);
    if (!map) return null;
    // arm: R — burchak soyasi, G — g'adir-budurlik, B — metall
    const m = new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap: arm, metalnessMap: arm, aoMap: arm, roughness: 1, metalness: arm ? 1 : 0 });
    m.userData.shared = true;
    parts.push({ geo: g, mat: hook(m, { wet: true }) });
  }
  return { parts, size: d.size, tris: d.tris };
}
export function getModel(name) {
  if (off) return Promise.resolve(null);
  let p = cache.get(name);
  if (!p) {
    p = getIndex().then((ix) => {
      const d = ix && ix[name];
      return d ? fetch('assets/models/' + d.bin + '?v=' + d.ver).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? build(d, b) : null)) : null;
    }).catch(() => null);
    cache.set(name, p);
  }
  return p;
}

// Bir xil modelning ko'p nusxasi: katak bo'yicha guruhlanadi (har guruh — bitta chizish chaqiruvi, ko'rinmasa chizilmaydi).
// list: [{ x, y, z, rot, sx, sy, sz }] — sx/sy/sz: modelning asl o'lchamiga nisbatan masshtab
export function instances(M, list, cell = 48) {
  const out = [], groups = new Map(), d = new THREE.Object3D();
  for (const p of list) { const k = Math.floor(p.x / cell) + ',' + Math.floor(p.z / cell); let a = groups.get(k); if (!a) groups.set(k, (a = [])); a.push(p); }
  for (const a of groups.values()) for (const part of M.parts) {
    const im = new THREE.InstancedMesh(part.geo, part.mat, a.length);
    a.forEach((p, i) => { d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.rot || 0, 0); d.scale.set(p.sx, p.sy, p.sz); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    im.castShadow = true; im.receiveShadow = true; im.userData.model = true;
    out.push(im);
  }
  return out;
}
