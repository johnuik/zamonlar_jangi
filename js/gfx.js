import * as THREE from '../lib/three.module.js';

// ================= GRAFIKA YORDAMCHILARI =================
// - hook(): standart materialga qo'shimchalar — uy ichida osmon yorug'ligi kamayadi (tom xaritasi),
//           katta masshtabli rang o'zgarishi (takrorlanish ko'rinmaydi), devor tagidagi kir, ho'l yer va ko'lmaklar
// - normalFrom(): rasm teksturasidan relyef (normal) xaritasi
// - roofMap(): to'qnashuv qutilaridan "tom balandligi" xaritasi
// - makeSky(): bulutli osmon; makeEnv(): shu osmondan atrof-muhit yorug'ligi (metall va silliq yuzalarda aks etadi)

// Yengil rejim: GPU tezlatishi yo'q bo'lsa (dasturiy chizish) har pikselda hisoblanadigan qimmat effektlar o'chiriladi
export const GFX = { lite: false };

// Hamma materiallar bo'lishadigan o'zgaruvchilar (dunyo almashganda qiymati yangilanadi)
export const GU = {
  uRoof: { value: null },                                        // tom balandligi xaritasi
  uRoofInfo: { value: new THREE.Vector4(74, 1 / 148, 40, 0) },   // yarim o'lcham, 1/o'lcham, balandlik masshtabi, yoqilganmi
  uWet: { value: 0 },                                            // 0 — quruq, 1 — yomg'ir
  uTime: { value: 0 },
};

const VERT = `#include <project_vertex>
{ vec4 wp_ = vec4(transformed, 1.0); vec3 wn_ = objectNormal;
#ifdef USE_INSTANCING
  wp_ = instanceMatrix * wp_; wn_ = mat3(instanceMatrix) * wn_;
#endif
  vWPos = (modelMatrix * wp_).xyz; vWNrm = normalize(mat3(modelMatrix) * wn_); }`;
const FRAG_HEAD = `#include <common>
varying vec3 vWPos; varying vec3 vWNrm;
uniform sampler2D uRoof; uniform vec4 uRoofInfo; uniform float uWet; uniform float uTime;
float zjHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float zjNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(zjHash(i), zjHash(i + vec2(1.0, 0.0)), f.x), mix(zjHash(i + vec2(0.0, 1.0)), zjHash(i + vec2(1.0, 1.0)), f.x), f.y); }
// 1 = ochiq osmon ostida; kichikroq = tom yoki to'siq ostida
float zjSky(vec3 p, vec3 n, float off){
  if (uRoofInfo.w < 0.5) return 1.0;
  vec2 uv = (p.xz + n.xz * off + uRoofInfo.x) * uRoofInfo.y;
  float d = texture2D(uRoof, uv).r * uRoofInfo.z - p.y;
  float occ = smoothstep(0.05, 0.24, d) * mix(0.4, 1.0, smoothstep(0.4, 2.2, d));
  return 1.0 - occ * 0.46;
}`;
const MACRO = `#include <map_fragment>
{ float m1_ = zjNoise(vWPos.xz * 0.043 + 3.7), m2_ = zjNoise(vWPos.xz * 0.21 + vWPos.y * 0.17 + 11.0), m3_ = zjNoise(vWPos.xz * 1.3 + vWPos.y * 0.9);
  diffuseColor.rgb *= 0.80 + 0.26 * m1_ + 0.12 * m2_ + 0.06 * m3_; }`;
const GRIME = `
{ float side_ = 1.0 - smoothstep(0.3, 0.7, abs(vWNrm.y));
  float g_ = smoothstep(1.3, 0.0, vWPos.y) * step(-0.05, vWPos.y) * side_ * (0.45 + 0.55 * zjNoise(vec2(vWPos.x + vWPos.z, vWPos.y) * vec2(1.7, 0.6)));
  float st_ = side_ * smoothstep(0.6, 0.85, zjNoise(vec2((vWPos.x + vWPos.z) * 2.3, vWPos.y * 0.22))) * 0.10 * smoothstep(0.4, 3.0, vWPos.y);
  diffuseColor.rgb *= 1.0 - 0.34 * g_ - st_; }`;
const WET_A = `#include <roughnessmap_fragment>
float zjPud = 0.0;
if (uWet > 0.0) {
  float open_ = clamp((zjSky(vWPos, vec3(0.0), 0.0) - 0.54) / 0.46, 0.0, 1.0);   // tom ostida quruq
  float up_ = smoothstep(0.7, 0.95, vWNrm.y);
  float pn_ = zjNoise(vWPos.xz * 0.21) * 0.62 + zjNoise(vWPos.xz * 0.83 + 7.3) * 0.38;
  zjPud = smoothstep(0.5, 0.62, pn_) * up_ * uWet * open_;
  float damp_ = uWet * (0.5 + 0.5 * up_) * open_;
  diffuseColor.rgb *= mix(1.0, 0.6, damp_);
  roughnessFactor = mix(roughnessFactor, 0.45, damp_ * 0.8);
  roughnessFactor = mix(roughnessFactor, 0.05, zjPud);
  diffuseColor.rgb *= mix(1.0, 0.55, zjPud);
}`;
const WET_B = `#include <normal_fragment_maps>
if (zjPud > 0.0) {
  vec2 rp_ = vWPos.xz * 7.0; float tt_ = uTime * 2.4;
  vec3 rip_ = vec3(zjNoise(rp_ + tt_) - 0.5, 0.0, zjNoise(rp_.yx - tt_ + 4.1) - 0.5) * 0.07;   // yomg'ir tomchilaridan jimirlash
  normal = normalize(mix(normal, normalize(nonPerturbedNormal + (viewMatrix * vec4(rip_, 0.0)).xyz), zjPud));
}`;

// o: macro (rang o'zgarishi), grime (devor tagidagi kir), wet (ho'llik), dyn (harakatlanuvchi jism — normal bo'yicha siljitilmaydi)
export function hook(mat, o = {}) {
  if (GFX.lite) o = { dyn: o.dyn };   // faqat tom soyasi qoladi (bitta tekstura so'rovi)
  const key = 'zj2' + (o.macro ? 'm' : '') + (o.grime ? 'g' : '') + (o.wet ? 'w' : '') + (o.dyn ? 'd' : '');
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (sh) => {
    for (const k in GU) sh.uniforms[k] = GU[k];
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;').replace('#include <project_vertex>', VERT);
    let f = sh.fragmentShader.replace('#include <common>', FRAG_HEAD);
    if (o.macro || o.grime) f = f.replace('#include <map_fragment>', (o.macro ? MACRO : '#include <map_fragment>') + (o.grime ? GRIME : ''));
    if (o.wet) f = f.replace('#include <roughnessmap_fragment>', WET_A).replace('#include <normal_fragment_maps>', WET_B);
    f = f.replace('#include <aomap_fragment>', `#include <aomap_fragment>
{ float so_ = zjSky(vWPos, normalize(vWNrm), ${o.dyn ? '0.0' : '1.0'}); reflectedLight.indirectDiffuse *= so_; reflectedLight.indirectSpecular *= so_ * so_; }`);
    sh.fragmentShader = f;
  };
  mat.needsUpdate = true;
  return mat;
}

// ---------- Relyef (normal) xaritasi: rasmning yorqinligi balandlik deb olinadi ----------
export function normalFrom(src, strength = 2.2) {
  const c = src.image || src, w = c.width, h = c.height;
  const d0 = c.getContext('2d').getImageData(0, 0, w, h).data, H0 = new Float32Array(w * h), H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H0[i] = (d0[i * 4] * 0.299 + d0[i * 4 + 1] * 0.587 + d0[i * 4 + 2] * 0.114) / 255;
  // yengil yumshatish: bir pikselli shovqin relyefni "qum" qilib yubormasin
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xl = (x + w - 1) % w, xr = (x + 1) % w, yu = ((y + h - 1) % h) * w, yd = ((y + 1) % h) * w, ym = y * w;
    H[ym + x] = (H0[ym + x] * 4 + (H0[ym + xl] + H0[ym + xr] + H0[yu + x] + H0[yd + x]) * 2 + H0[yu + xl] + H0[yu + xr] + H0[yd + xl] + H0[yd + xr]) / 16;
  }
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const g = out.getContext('2d'), img = g.createImageData(w, h), d = img.data, k = strength * (w / 256);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xl = (x + w - 1) % w, xr = (x + 1) % w, yu = ((y + h - 1) % h) * w, yd = ((y + 1) % h) * w, ym = y * w;
    const dx = (H[ym + xr] - H[ym + xl]) * k, dy = (H[yd + x] - H[yu + x]) * k, l = 1 / Math.hypot(dx, dy, 1), i = (ym + x) * 4;
    d[i] = (-dx * l * 0.5 + 0.5) * 255; d[i + 1] = (dy * l * 0.5 + 0.5) * 255; d[i + 2] = (l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (src.isTexture) t.repeat.copy(src.repeat);
  return t;
}

// ---------- Tom xaritasi: har 0.5 m katakda eng baland to'siqning tepasi ----------
// Soyada turgan yuzaga osmon yorug'ligi kam tushadi: uy ichi, podval, yashik va konteyner tagi qorong'iroq bo'ladi.
export function roofMap(boxes, half) {
  const G = half + 4, N = Math.ceil((G * 2) / 0.5), HMAX = 40, data = new Uint8Array(N * N);
  for (const b of boxes) {
    if (b.vehicle || b.max.y < 0.4) continue;
    if (b.max.x - b.min.x < 0.9 || b.max.z - b.min.z < 0.9) continue;   // ingichka devor va ustunlar kirmaydi (tomlar baribir ularni yopadi)
    const x0 = Math.max(1, Math.ceil((b.min.x + G) / 0.5 - 0.5)), x1 = Math.min(N - 2, Math.floor((b.max.x + G) / 0.5 - 0.5));
    const z0 = Math.max(1, Math.ceil((b.min.z + G) / 0.5 - 0.5)), z1 = Math.min(N - 2, Math.floor((b.max.z + G) / 0.5 - 0.5));
    const v = Math.min(255, Math.round((b.max.y / HMAX) * 255));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const i = z * N + x; if (data[i] < v) data[i] = v; }
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return { tex: t, data, N, G, HMAX };
}
// Protsessorda xuddi shu so'rov (qo'ldagi qurol uy ichida qoraytirilishi uchun): 1 — ochiq, ~0.4 — tom ostida
export function skyAt(rm, x, y, z) {
  if (!rm) return 1;
  const ix = Math.floor((x + rm.G) / 0.5), iz = Math.floor((z + rm.G) / 0.5);
  if (ix < 0 || iz < 0 || ix >= rm.N || iz >= rm.N) return 1;
  const d = (rm.data[iz * rm.N + ix] / 255) * rm.HMAX - y;
  return d > 0.3 ? 0.54 : 1;
}

// ---------- Osmon ----------
const SKY_FS = `
uniform vec3 top; uniform vec3 bottom; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 cloudLit; uniform vec3 cloudDark; uniform vec3 flashC;
uniform float sunAmt; uniform float cover; uniform float cloudK; uniform float time; uniform float flash; uniform float envMode; uniform float gain;
varying vec3 vP;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < OCT; i++) { s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vP);
  float h = max(d.y, 0.0);
  vec3 c = mix(bottom, top, pow(min(1.0, h * 1.25 + 0.015), 0.5));
  float s = max(dot(d, sunDir), 0.0), vis = 1.0;
  if (cloudK > 0.0 && d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.14) * 0.9 + vec2(time * 0.006, time * 0.0035);
    float n = fbm(uv), e0 = 1.0 - cover;
    float dens = smoothstep(e0, e0 + 0.28, n);
    float n2 = fbm(uv + normalize(sunDir.xz + vec2(1e-4)) * 0.09);
    float lit = clamp(0.62 + (n - n2) * 3.2, 0.0, 1.0);          // quyosh tomonidagi cheti yorug'roq
    vec3 cc = mix(cloudDark, cloudLit, lit * (1.0 - dens * 0.45));
    cc += sunColor * pow(s, 5.0) * 0.35 * sunAmt * (1.0 - dens);
    cc += flashC * flash * (0.5 + 0.5 * n);                       // chaqmoq bulutlarni ichidan yoritadi
    float a = dens * smoothstep(0.0, 0.16, d.y) * cloudK;         // ufqda bulutlar tumanga singib ketadi
    c = mix(c, cc, a); vis = 1.0 - a;
  }
  c += sunColor * (pow(s, 6.0) * 0.16 + pow(s, 48.0) * 0.4) * sunAmt * (0.35 + 0.65 * vis);
  c += sunColor * smoothstep(0.99972, 0.99992, s) * 30.0 * sunAmt * vis * vis * (1.0 - envMode);
  c = mix(c, ground, smoothstep(0.0, -0.22, d.y));
  gl_FragColor = vec4(c * gain, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
// p: { top, bottom, ground, sunDir, sunColor, sunAmt, cloudLit, cloudDark, cover, cloudK, oct }
export function makeSky(p) {
  const C = (h) => new THREE.Color(h);
  const mat = new THREE.ShaderMaterial({
    defines: { OCT: p.oct || 5 },
    uniforms: {
      top: { value: C(p.top) }, bottom: { value: C(p.bottom) }, ground: { value: C(p.ground) }, sunDir: { value: p.sunDir.clone() }, sunColor: { value: C(p.sunColor) },
      cloudLit: { value: C(p.cloudLit) }, cloudDark: { value: C(p.cloudDark) }, flashC: { value: C(0x8fa2c8) },
      sunAmt: { value: p.sunAmt }, cover: { value: p.cover }, cloudK: { value: p.cloudK ?? 1 }, time: { value: 0 }, flash: { value: 0 }, envMode: { value: 0 }, gain: { value: 1 },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), mat);
  mesh.renderOrder = -10; mesh.frustumCulled = false;
  return mesh;
}
// Osmondan atrof-muhit xaritasi (quyosh gardishisiz — uning yaltirashini yo'naltirilgan chiroq beradi)
export function makeEnv(renderer, sky, gain = 1) {
  const pm = new THREE.PMREMGenerator(renderer), sc = new THREE.Scene(), u = sky.material.uniforms;
  sc.add(new THREE.Mesh(sky.geometry, sky.material));
  u.envMode.value = 1; u.gain.value = gain;
  const rt = pm.fromScene(sc, 0, 1, 1000);
  u.envMode.value = 0; u.gain.value = 1;
  pm.dispose();
  return rt;
}
