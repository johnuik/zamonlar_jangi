import * as THREE from '../lib/three.module.js';

// ================= KEYINGI ISHLOV (post-processing) =================
// Sahna avval HDR teksturaga chiziladi, so'ng ketma-ket to'liq ekranli o'tishlar:
//   1) SSAO — burchak va tirqishlardagi yumshoq soya (chuqurlik teksturasidan hisoblanadi)
//   2) qurol (ko'rinish modeli) o'sha tasvir ustidan chiziladi
//   3) bloom — yorqin joylar (olov, chaqnash, quyosh aksi) atrofida yog'du
//   4) quyosh nurlari (kunduzi, quyosh ko'rinib turganda)
//   5) avto-ekspozitsiya: kadrning o'rtacha yorqinligiga qarab "ko'z moslashadi" (uy ichida yorishadi, quyoshga qaraganda xiralashadi)
//      va ACES ton xaritasi, rang tuzatish, vinyetka, plyonka doni
//   6) FXAA — qirralarni silliqlash
// Tashqi kutubxonasiz: hammasi shu faylda (three.js ning o'zi yetarli).

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const mk = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false });

const FS_SSAO = `
uniform sampler2D tDepth; uniform mat4 proj; uniform mat4 projInv; uniform vec2 texel; uniform float radius; uniform float intensity; varying vec2 vUv;
vec3 viewPos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 v = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  float d0 = texture2D(tDepth, vUv).x;
  if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 p = viewPos(vUv);
  // normal: har yo'nalishda chuqurligi yaqinroq qo'shni olinadi (jism chetlarida xato chiziq chiqmaydi)
  vec3 pl = viewPos(vUv - vec2(texel.x, 0.0)), pr = viewPos(vUv + vec2(texel.x, 0.0)), pd = viewPos(vUv - vec2(0.0, texel.y)), pu = viewPos(vUv + vec2(0.0, texel.y));
  vec3 dx = abs(pl.z - p.z) < abs(pr.z - p.z) ? p - pl : pr - p;
  vec3 dy = abs(pd.z - p.z) < abs(pu.z - p.z) ? p - pd : pu - p;
  vec3 n = normalize(cross(dx, dy));
  float ang = ign(gl_FragCoord.xy) * 6.2831853;
  vec3 rv = vec3(cos(ang), sin(ang), 0.0);
  vec3 t = normalize(rv - n * dot(rv, n)); vec3 b = cross(n, t);
  float rad = radius * clamp(-p.z * 0.14, 0.3, 1.0);   // yaqinda kichikroq radius
  float occ = 0.0;
  for (int i = 0; i < NS; i++) {
    float fi = float(i) + 0.5, r = fi / float(NS), a2 = fi * 2.399963;
    vec3 k = vec3(cos(a2) * r, sin(a2) * r, 0.2 + 0.8 * sqrt(1.0 - r * r)) * mix(0.3, 1.0, r);
    vec3 sp = p + (t * k.x + b * k.y + n * k.z) * rad;
    vec4 o = proj * vec4(sp, 1.0); vec2 suv = o.xy / o.w * 0.5 + 0.5;
    float sd = viewPos(suv).z;
    occ += step(sp.z + 0.025, sd) * smoothstep(0.0, 1.0, rad / (abs(p.z - sd) + 0.0001));
  }
  float ao = 1.0 - occ / float(NS) * intensity;
  ao = mix(ao, 1.0, smoothstep(50.0, 110.0, -p.z));   // uzoqda ta'sir yo'qoladi
  gl_FragColor = vec4(vec3(clamp(ao, 0.0, 1.0)), 1.0);
}`;
const FS_AOBLUR = `
uniform sampler2D tAO; uniform sampler2D tDepth; uniform vec2 dir; uniform float near; uniform float far; varying vec2 vUv;
float lin(float d){ return (2.0 * near * far) / (far + near - (d * 2.0 - 1.0) * (far - near)); }
void main(){
  float z0 = lin(texture2D(tDepth, vUv).x), sum = 0.0, wsum = 0.0;
  for (int i = -3; i <= 3; i++) {
    vec2 uv = vUv + dir * float(i);
    float z = lin(texture2D(tDepth, uv).x), w = exp(-abs(z - z0) * 1.6 / max(1.0, z0 * 0.05)) * (1.0 - abs(float(i)) * 0.2);
    sum += texture2D(tAO, uv).r * w; wsum += w;
  }
  gl_FragColor = vec4(vec3(sum / max(wsum, 0.0001)), 1.0);
}`;
const FS_AOMUL = `
uniform sampler2D tAO; uniform float aoK; varying vec2 vUv;
void main(){ gl_FragColor = vec4(vec3(mix(1.0, texture2D(tAO, vUv).r, aoK)), 1.0); }`;
const FS_BRIGHT = `
uniform sampler2D tColor; uniform vec2 texel; uniform float thr; uniform float knee; varying vec2 vUv;
void main(){
  vec3 c = (texture2D(tColor, vUv + texel * vec2(-0.5, -0.5)).rgb + texture2D(tColor, vUv + texel * vec2(0.5, -0.5)).rgb + texture2D(tColor, vUv + texel * vec2(-0.5, 0.5)).rgb + texture2D(tColor, vUv + texel * vec2(0.5, 0.5)).rgb) * 0.25;
  c = min(c, vec3(40.0));
  float l = max(max(c.r, c.g), c.b), soft = clamp(l - thr + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 0.0001);
  gl_FragColor = vec4(c * max(soft, l - thr) / max(l, 0.0001), 1.0);
}`;
const FS_DOWN = `
uniform sampler2D tColor; uniform vec2 texel; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tColor, vUv).rgb * 4.0;
  c += texture2D(tColor, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tColor, vUv + texel * vec2(1.0, -1.0)).rgb + texture2D(tColor, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tColor, vUv + texel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;
const FS_UP = `
uniform sampler2D tLow; uniform sampler2D tHigh; uniform vec2 texel; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tLow, vUv).rgb * 4.0;
  c += (texture2D(tLow, vUv + texel * vec2(-1.0, 0.0)).rgb + texture2D(tLow, vUv + texel * vec2(1.0, 0.0)).rgb + texture2D(tLow, vUv + texel * vec2(0.0, -1.0)).rgb + texture2D(tLow, vUv + texel * vec2(0.0, 1.0)).rgb) * 2.0;
  c += texture2D(tLow, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tLow, vUv + texel * vec2(1.0, -1.0)).rgb + texture2D(tLow, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tLow, vUv + texel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c / 16.0 + texture2D(tHigh, vUv).rgb, 1.0);
}`;
// quyosh nurlari: osmon ko'ringan joylardan quyosh tomon cho'zilgan yog'du
const FS_RAYMASK = `
uniform sampler2D tDepth; uniform vec2 sun; uniform float aspect; varying vec2 vUv;
void main(){
  float sky = step(0.99999, texture2D(tDepth, vUv).x);
  vec2 q = (vUv - sun) * vec2(aspect, 1.0);
  gl_FragColor = vec4(vec3(sky * pow(max(0.0, 1.0 - length(q) * 1.15), 3.0)), 1.0);
}`;
const FS_RAYS = `
uniform sampler2D tMask; uniform vec2 sun; varying vec2 vUv;
void main(){
  vec2 d = (sun - vUv) / 28.0 * 0.9; vec2 uv = vUv; float s = 0.0, w = 1.0;
  for (int i = 0; i < 28; i++) { s += texture2D(tMask, uv).r * w; w *= 0.955; uv += d; }
  gl_FragColor = vec4(s / 28.0, texture2D(tMask, vUv).r, 0.0, 1.0);
}`;
// avto-ekspozitsiya: kichik teksturaning eng mayda mip darajasi — butun kadrning o'rtacha rangi; natija oldingi kadr bilan silliq aralashadi
const FS_ADAPT = `
uniform sampler2D tLum; uniform sampler2D tPrev; uniform float k; uniform vec3 ae; varying vec2 vUv;
void main(){
  vec3 c = textureLod(tLum, vec2(0.5), 6.0).rgb;
  float L = dot(max(c, 0.0), vec3(0.2126, 0.7152, 0.0722));
  float target = clamp(ae.z / max(L, 0.02), ae.x, ae.y);
  float prev = texture2D(tPrev, vec2(0.5)).r;
  gl_FragColor = vec4(vec3(mix(prev, target, k)), 1.0);
}`;
const FS_TONE = `
uniform sampler2D tExp; uniform float aeOn;
uniform sampler2D tColor; uniform sampler2D tBloom; uniform sampler2D tRays; uniform float exposure; uniform float bloomK; uniform float raysK; uniform vec3 raysC;
uniform float sat; uniform float contrast; uniform vec3 tint; uniform float vig; uniform float grain; uniform float time; uniform vec2 res; varying vec2 vUv;
uniform float ca; uniform vec3 tintS; uniform vec3 tintH;
vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c){
  const mat3 mi = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 mo = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  return clamp(mo * fit(mi * (c / 0.6)), 0.0, 1.0);
}
vec3 srgb(vec3 c){ return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  // linza: kadr chetida ranglar bir oz ajraladi (markazda — yo'q)
  vec2 q = vUv - 0.5, co = q * dot(q, q) * ca;
  vec3 c = vec3(texture2D(tColor, vUv + co).r, texture2D(tColor, vUv).g, texture2D(tColor, vUv - co).b);
  // quyosh nurlari faqat to'siqlar ustiga tushadi: ochiq osmon o'z rangida qoladi (aks holda ko'k osmon pushti tusga kirardi)
  vec2 ry = texture2D(tRays, vUv).rg;
  c += texture2D(tBloom, vUv).rgb * bloomK + max(ry.r - ry.g * 0.7, 0.0) * raysC * raysK;
  c = srgb(aces(max(c, 0.0) * exposure * mix(1.0, texture2D(tExp, vec2(0.5)).r, aeOn)));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, sat);
  c = clamp(c, 0.0, 1.0); c = mix(c, c * c * (3.0 - 2.0 * c), contrast - 1.0);   // S-egri: qora va oq joyida qoladi, o'rta tonlar tiniqlashadi
  // kino uslubidagi rang: soyalar sovuqroq, yorug' joylar iliqroq
  c *= tint * mix(tintS, tintH, smoothstep(0.08, 0.72, l));
  c *= 1.0 - vig * smoothstep(0.3, 1.0, length(q) * 1.3);
  c += (hash(vUv * res + fract(time) * 91.7) - 0.5) * grain;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
// Yaqin maydon xiraligi (mo'ljalga olganda ko'zga juda yaqin qurol qismlari yumshaydi — nigoh nishonda):
// 1) yarim o'lchamli nusxa: rang + xiralik darajasi (qurol chuqurligidan; dunyo chizilgach chuqurlik tozalangan — 1.0 bo'lsa qurol emas)
const FS_DOFPRE = `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel; uniform vec2 nf; uniform vec2 rng; varying vec2 vUv;
float coc(vec2 uv){ float d = texture2D(tDepth, uv).x; float z = nf.x * nf.y / (nf.y - d * (nf.y - nf.x)); return (1.0 - smoothstep(rng.x, rng.y, z)) * step(d, 0.9999); }
void main(){
  vec4 o = texel.xyxy * vec4(-0.5, -0.5, 0.5, 0.5);
  vec3 c = (texture2D(tColor, vUv + o.xy).rgb + texture2D(tColor, vUv + o.zy).rgb + texture2D(tColor, vUv + o.xw).rgb + texture2D(tColor, vUv + o.zw).rgb) * 0.25;
  gl_FragColor = vec4(c, max(max(coc(vUv + o.xy), coc(vUv + o.zy)), max(coc(vUv + o.xw), coc(vUv + o.zw))));
}`;
// 2) yoyish (rang va daraja birga — xiralik qurol chetidan tashqariga ham chiqadi, keskin chegara qolmaydi)
const FS_DOFBLUR = `
uniform sampler2D tColor; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec4 s = texture2D(tColor, vUv) * 0.2270270;
  s += (texture2D(tColor, vUv + dir * 1.3846154) + texture2D(tColor, vUv - dir * 1.3846154)) * 0.3162162;
  s += (texture2D(tColor, vUv + dir * 3.2307692) + texture2D(tColor, vUv - dir * 3.2307692)) * 0.0702703;
  gl_FragColor = s;
}`;
// Yakuniy kattalashtirish (ichki aniqlik → ekran aniqligi): bikubik (Catmull-Rom, 5 ta chiziqli namuna) + mahalliy kontrastga moslashuvchi o'tkirlash (CAS g'oyasi).
// Brauzerning oddiy chiziqli cho'zishiga qaraganda chetlar va mayda tafsilotlar ancha tiniq chiqadi.
const FS_UPSCALE = `
uniform sampler2D tColor; uniform vec2 size; uniform float sharp; varying vec2 vUv;
vec3 cubic(vec2 uv){
  vec2 p = uv * size, c = floor(p - 0.5) + 0.5, f = p - c;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2, t0 = (c - 1.0) / size, t3 = (c + 2.0) / size, t12 = (c + w2 / w12) / size;
  vec4 r = vec4(texture2D(tColor, vec2(t12.x, t0.y)).rgb, 1.0) * (w12.x * w0.y);
  r += vec4(texture2D(tColor, vec2(t0.x, t12.y)).rgb, 1.0) * (w0.x * w12.y);
  r += vec4(texture2D(tColor, vec2(t12.x, t12.y)).rgb, 1.0) * (w12.x * w12.y);
  r += vec4(texture2D(tColor, vec2(t3.x, t12.y)).rgb, 1.0) * (w3.x * w12.y);
  r += vec4(texture2D(tColor, vec2(t12.x, t3.y)).rgb, 1.0) * (w12.x * w3.y);
  return r.rgb / r.a;
}
void main(){
  vec3 c = clamp(cubic(vUv), 0.0, 1.0);
  vec2 px = 1.0 / size;
  vec3 a = texture2D(tColor, vUv + vec2(0.0, -px.y)).rgb, b = texture2D(tColor, vUv + vec2(-px.x, 0.0)).rgb, d = texture2D(tColor, vUv + vec2(px.x, 0.0)).rgb, e = texture2D(tColor, vUv + vec2(0.0, px.y)).rgb;
  vec3 mn = min(c, min(min(a, b), min(d, e))), mx = max(c, max(max(a, b), max(d, e)));
  vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
  vec3 wgt = amp * (-1.0 / mix(8.0, 5.0, sharp));
  gl_FragColor = vec4(clamp((c + (a + b + d + e) * wgt) / (1.0 + 4.0 * wgt), 0.0, 1.0), 1.0);
}`;
const FS_FXAA = `
uniform sampler2D tColor; uniform vec2 texel; uniform float sharp; varying vec2 vUv;
uniform sampler2D tDof; uniform float dofK;
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
void main(){
  vec3 m = texture2D(tColor, vUv).rgb;
  vec3 cNW = texture2D(tColor, vUv + texel * vec2(-1.0, -1.0)).rgb, cNE = texture2D(tColor, vUv + texel * vec2(1.0, -1.0)).rgb;
  vec3 cSW = texture2D(tColor, vUv + texel * vec2(-1.0, 1.0)).rgb, cSE = texture2D(tColor, vUv + texel * vec2(1.0, 1.0)).rgb;
  float lNW = luma(cNW), lNE = luma(cNE), lSW = luma(cSW), lSE = luma(cSE), lM = luma(m);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125), rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
  dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * texel;
  vec3 a = 0.5 * (texture2D(tColor, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tColor, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture2D(tColor, vUv + dir * -0.5).rgb + texture2D(tColor, vUv + dir * 0.5).rgb);
  float lB = luma(b);
  vec3 c = (lB < lMin || lB > lMax) ? a : b;
  c += (m - (cNW + cNE + cSW + cSE) * 0.25) * sharp * (1.0 - smoothstep(0.04, 0.16, lMax - lMin));
  if (dofK > 0.0) { vec4 dq = texture2D(tDof, vUv); c = mix(c, dq.rgb, smoothstep(0.0, 0.5, dq.a) * dofK); }
  gl_FragColor = vec4(c, 1.0);
}`;

const DOF_RANGE = [0.07, 0.25];   // shu masofadan yaqini to'liq xira … shundan uzog'i tiniq (metr)

export class Post {
  constructor(renderer) {
    this.r = renderer; this.w = 0; this.h = 0; this.level = 'off'; this.samples = 4;
    this.scene = new THREE.Scene(); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.quad.frustumCulled = false; this.scene.add(this.quad);
    const T = () => ({ value: null }), V2 = () => ({ value: new THREE.Vector2() });
    this.m = {
      ssao: mk(FS_SSAO, { tDepth: T(), proj: { value: new THREE.Matrix4() }, projInv: { value: new THREE.Matrix4() }, texel: V2(), radius: { value: 0.8 }, intensity: { value: 1.35 } }),
      blur: mk(FS_AOBLUR, { tAO: T(), tDepth: T(), dir: V2(), near: { value: 0.05 }, far: { value: 700 } }),
      aomul: mk(FS_AOMUL, { tAO: T(), aoK: { value: 0.9 } }),
      bright: mk(FS_BRIGHT, { tColor: T(), texel: V2(), thr: { value: 1.1 }, knee: { value: 0.6 } }),
      down: mk(FS_DOWN, { tColor: T(), texel: V2() }),
      up: mk(FS_UP, { tLow: T(), tHigh: T(), texel: V2() }),
      mask: mk(FS_RAYMASK, { tDepth: T(), sun: V2(), aspect: { value: 1 } }),
      rays: mk(FS_RAYS, { tMask: T(), sun: V2() }),
      adapt: mk(FS_ADAPT, { tLum: T(), tPrev: T(), k: { value: 1 }, ae: { value: new THREE.Vector3(1, 1, 0.5) } }),
      tone: mk(FS_TONE, { tExp: T(), aeOn: { value: 0 }, tColor: T(), tBloom: T(), tRays: T(), exposure: { value: 1 }, bloomK: { value: 0.1 }, raysK: { value: 0 }, raysC: { value: new THREE.Color(1, 0.9, 0.7) },
        sat: { value: 1 }, contrast: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.25 }, grain: { value: 0.02 }, time: { value: 0 }, res: V2(),
        ca: { value: 0 }, tintS: { value: new THREE.Color(1, 1, 1) }, tintH: { value: new THREE.Color(1, 1, 1) } }),
      dofpre: mk(FS_DOFPRE, { tColor: T(), tDepth: T(), texel: V2(), nf: V2(), rng: V2() }),
      dofblur: mk(FS_DOFBLUR, { tColor: T(), dir: V2() }),
      fxaa: mk(FS_FXAA, { tColor: T(), texel: V2(), sharp: { value: 0.35 }, tDof: T(), dofK: { value: 0 } }),
      upscale: mk(FS_UPSCALE, { tColor: T(), size: V2(), sharp: { value: 0.75 } }),
    };
    this.m.ssao.defines = { NS: 10 };
    // AO sahna rangiga ko'paytiriladi: natija = sahna * ao
    Object.assign(this.m.aomul, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor });
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); this.black.needsUpdate = true;
    this._sun = new THREE.Vector3(); this._size = new THREE.Vector2(); this._one = new THREE.Color(1, 1, 1);
    this.rt = null; this.expI = 0; this.expInit = true; this.lastT = 0;
  }

  // level: 'off' (to'g'ridan-to'g'ri ekranga), 'medium' (bloom, ton, FXAA), 'high' (+ SSAO, quyosh nurlari), 'ultra' (+ ko'proq namuna)
  // samples — MSAA namunalari (core.js: msaaFor); berilmasa — o'rta: 2, yuqori/ultra: 4
  setLevel(level, samples) {
    if (level === this.level) return;
    this.level = level;
    const ns = level === 'ultra' ? 16 : 10, smp = samples ?? (level === 'medium' ? 2 : 4);
    if (this.m.ssao.defines.NS !== ns) { this.m.ssao.defines.NS = ns; this.m.ssao.needsUpdate = true; }
    if (smp !== this.samples) { this.samples = smp; this.dispose(); }
  }
  get enabled() { return this.level !== 'off'; }
  // Sinov va sozlash uchun: joriy avto-ekspozitsiya ko'paytuvchisi (yoqilmagan bo'lsa — 1)
  readExposure() {
    if (!this.rt) return 1;
    const b = new Uint16Array(4);
    try { this.r.readRenderTargetPixels(this.rt.exp[this.expI], 0, 0, 1, 1, b); return +THREE.DataUtils.fromHalfFloat(b[0]).toFixed(3); } catch (e) { return -1; }
  }

  dispose() { if (!this.rt) return; for (const k in this.rt) { const t = this.rt[k]; if (Array.isArray(t)) t.forEach((x) => x.dispose()); else t.dispose(); } this.rt = null; }
  alloc(w, h) {
    this.dispose();
    this.w = w; this.h = h;
    const HDR = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, stencilBuffer: false };
    const mkRT = (ww, hh, o) => new THREE.WebGLRenderTarget(Math.max(2, ww | 0), Math.max(2, hh | 0), Object.assign({}, HDR, o));
    const depth = new THREE.DepthTexture(w, h); depth.type = THREE.UnsignedIntType; depth.minFilter = depth.magFilter = THREE.NearestFilter;
    const rt = (this.rt = {});
    rt.scene = mkRT(w, h, { depthBuffer: true, depthTexture: depth, samples: this.samples });
    rt.ao = mkRT(w / 2, h / 2, { type: THREE.UnsignedByteType, depthBuffer: false });
    rt.ao2 = mkRT(w / 2, h / 2, { type: THREE.UnsignedByteType, depthBuffer: false });
    rt.down = []; rt.up = [];
    let bw = w / 2, bh = h / 2;
    for (let i = 0; i < 5; i++) { rt.down.push(mkRT(bw, bh, { depthBuffer: false })); if (i < 4) rt.up.push(mkRT(bw, bh, { depthBuffer: false })); bw /= 2; bh /= 2; }
    rt.mask = mkRT(w / 4, h / 4, { type: THREE.UnsignedByteType, depthBuffer: false });
    rt.rays = mkRT(w / 4, h / 4, { type: THREE.UnsignedByteType, depthBuffer: false });
    rt.ldr = mkRT(w, h, { type: THREE.UnsignedByteType, depthBuffer: false });
    rt.aa = mkRT(w, h, { type: THREE.UnsignedByteType, depthBuffer: false });   // FXAA natijasi (ichki aniqlik ekrannikidan farq qilganda — yakuniy kattalashtirish uchun)
    // (yuqori aniqlikdagi ekranda chorak o'lcham — xiralik ekranda bir xil kattalikda ko'rinadi)
    const ds = (this.dofDiv = h > 1250 ? 4 : 2);
    rt.dofA = mkRT(w / ds, h / ds, { type: THREE.UnsignedByteType, depthBuffer: false }); rt.dofB = mkRT(w / ds, h / ds, { type: THREE.UnsignedByteType, depthBuffer: false });
    // avto-ekspozitsiya: 64×64 (mip zanjiri bilan — eng maydasi kadrning o'rtacha rangi) va ikkita 1×1 (joriy / oldingi qiymat)
    rt.lum = mkRT(64, 64, { depthBuffer: false, minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true });
    rt.exp = [mkRT(1, 1, { depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }), mkRT(1, 1, { depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })];
    this.expInit = true;
  }
  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }

  // o: { scene, camera, gunScene, gunCamera, sunDir (Vector3 yoki null), grade: { exposure, sat, contrast, tint, tintS, tintH, ca, bloom, rays, raysC, vig, grain, ao }, time,
  //      dof (0..1 — yaqin maydon xiraligi kuchi), dofRange: [to'liq xira masofa, tiniq masofa] (metr, qurol kamerasidan) }
  render(o) {
    // ekran (chiqish) o'lchami va ichki o'lcham: o.scale — ichki aniqlikning ekrannikiga nisbati (1 — bir xil; <1 — tezlik uchun pastroq; >1 — ortiqcha namunali)
    const r = this.r, size = r.getDrawingBufferSize(this._size), ow = size.x, oh = size.y, sc = Math.max(0.3, Math.min(2, o.scale || 1));
    const iw = Math.abs(sc - 1) < 0.01 ? ow : Math.max(2, Math.round(ow * sc)), ih = Math.abs(sc - 1) < 0.01 ? oh : Math.max(2, Math.round(oh * sc));
    if (!this.rt || iw !== this.w || ih !== this.h) this.alloc(iw, ih);
    const rt = this.rt, m = this.m, w = this.w, h = this.h, high = this.level === 'high' || this.level === 'ultra', g = o.grade || {};
    // 1) sahna → HDR (silliqlangan qirralar bilan)
    r.setRenderTarget(rt.scene); r.clear();
    r.render(o.scene, o.camera);
    let raysK = 0;
    if (high) {
      // 2) SSAO: burchak va tirqishlar qorayadi
      const dt = rt.scene.depthTexture, u = m.ssao.uniforms;
      u.tDepth.value = dt; u.proj.value.copy(o.camera.projectionMatrix); u.projInv.value.copy(o.camera.projectionMatrixInverse); u.texel.value.set(1 / w, 1 / h);
      this.pass(m.ssao, rt.ao);
      m.blur.uniforms.tDepth.value = dt; m.blur.uniforms.near.value = o.camera.near; m.blur.uniforms.far.value = o.camera.far;
      m.blur.uniforms.tAO.value = rt.ao.texture; m.blur.uniforms.dir.value.set(2 / w, 0); this.pass(m.blur, rt.ao2);
      m.blur.uniforms.tAO.value = rt.ao2.texture; m.blur.uniforms.dir.value.set(0, 2 / h); this.pass(m.blur, rt.ao);
      // 3) quyosh nurlari uchun niqob (qurol chizilishidan oldin — chuqurlik hali dunyoniki)
      if (o.sunDir && (g.rays || 0) > 0) {
        const s = this._sun.copy(o.camera.position).addScaledVector(o.sunDir, 400).project(o.camera);
        if (s.z < 1 && Math.abs(s.x) < 1.5 && Math.abs(s.y) < 1.5) {
          const sx = s.x * 0.5 + 0.5, sy = s.y * 0.5 + 0.5;
          m.mask.uniforms.tDepth.value = dt; m.mask.uniforms.sun.value.set(sx, sy); m.mask.uniforms.aspect.value = w / h;
          this.pass(m.mask, rt.mask);
          m.rays.uniforms.tMask.value = rt.mask.texture; m.rays.uniforms.sun.value.set(sx, sy);
          this.pass(m.rays, rt.rays);
          raysK = g.rays * Math.max(0, 1 - Math.max(Math.abs(s.x), Math.abs(s.y)) / 1.5);
        }
      }
      m.aomul.uniforms.tAO.value = rt.ao.texture; m.aomul.uniforms.aoK.value = g.ao ?? 0.9;
      this.pass(m.aomul, rt.scene);
    }
    // 4) qurol (ko'rinish modeli) — dunyo ustidan, o'sha nishonga
    if (o.gunScene) { r.setRenderTarget(rt.scene); r.clearDepth(); r.render(o.gunScene, o.gunCamera); }
    // 4b) avto-ekspozitsiya: kadrning o'rtacha yorqinligidan yangi qiymat (bir-ikki soniyada moslashadi)
    const ae = g.ae || null, nowT = performance.now(), dtE = Math.min(0.1, Math.max(0.001, (nowT - this.lastT) / 1000));
    this.lastT = nowT;
    if (ae) {
      m.down.uniforms.tColor.value = rt.scene.texture; m.down.uniforms.texel.value.set(1 / w, 1 / h);
      this.pass(m.down, rt.lum);
      const ua = m.adapt.uniforms, prev = rt.exp[this.expI], next = rt.exp[1 - this.expI];
      ua.tLum.value = rt.lum.texture; ua.tPrev.value = prev.texture; ua.ae.value.set(ae[0], ae[1], ae[2]);
      ua.k.value = this.expInit ? 1 : 1 - Math.exp(-dtE * 1.3);
      this.pass(m.adapt, next);
      this.expI = 1 - this.expI; this.expInit = false;
    }
    // 5) bloom: yorqin joylar atrofida yog'du
    m.bright.uniforms.tColor.value = rt.scene.texture; m.bright.uniforms.texel.value.set(1 / w, 1 / h);
    this.pass(m.bright, rt.down[0]);
    for (let i = 1; i < rt.down.length; i++) { m.down.uniforms.tColor.value = rt.down[i - 1].texture; m.down.uniforms.texel.value.set(1 / rt.down[i - 1].width, 1 / rt.down[i - 1].height); this.pass(m.down, rt.down[i]); }
    let low = rt.down[rt.down.length - 1];
    for (let i = rt.up.length - 1; i >= 0; i--) { m.up.uniforms.tLow.value = low.texture; m.up.uniforms.tHigh.value = rt.down[i].texture; m.up.uniforms.texel.value.set(1 / low.width, 1 / low.height); this.pass(m.up, rt.up[i]); low = rt.up[i]; }
    // 6) ton, rang, vinyetka, don → LDR
    const u = m.tone.uniforms;
    u.tExp.value = ae ? rt.exp[this.expI].texture : this.black; u.aeOn.value = ae ? 1 : 0;
    u.tColor.value = rt.scene.texture; u.tBloom.value = rt.up[0].texture; u.tRays.value = raysK > 0 ? rt.rays.texture : this.black;
    u.exposure.value = g.exposure ?? 1; u.bloomK.value = g.bloom ?? 0.1; u.raysK.value = raysK; if (g.raysC) u.raysC.value.copy(g.raysC);
    u.sat.value = g.sat ?? 1; u.contrast.value = g.contrast ?? 1; if (g.tint) u.tint.value.copy(g.tint); u.vig.value = g.vig ?? 0.25; u.grain.value = g.grain ?? 0.02;
    u.time.value = o.time || 0; u.res.value.set(w, h);
    u.ca.value = g.ca ?? 0; u.tintS.value.copy(g.tintS || this._one); u.tintH.value.copy(g.tintH || this._one);
    this.pass(m.tone, rt.ldr);
    // 6b) yaqin maydon xiraligi (faqat yuqori sifatda va qurol chizilganda)
    let dofK = 0;
    if (high && o.gunScene && (o.dof || 0) > 0.01) {
      const ud = m.dofpre.uniforms, rg = o.dofRange || DOF_RANGE;
      ud.tColor.value = rt.ldr.texture; ud.tDepth.value = rt.scene.depthTexture; ud.texel.value.set(this.dofDiv / 2 / w, this.dofDiv / 2 / h);
      ud.nf.value.set(o.gunCamera.near, o.gunCamera.far); ud.rng.value.set(rg[0], rg[1]);
      this.pass(m.dofpre, rt.dofA);
      const ub = m.dofblur.uniforms, tx = 1 / rt.dofA.width, ty = 1 / rt.dofA.height;
      for (let k = 1; k <= 2; k++) {
        ub.tColor.value = rt.dofA.texture; ub.dir.value.set(tx * k, 0); this.pass(m.dofblur, rt.dofB);
        ub.tColor.value = rt.dofB.texture; ub.dir.value.set(0, ty * k); this.pass(m.dofblur, rt.dofA);
      }
      dofK = Math.min(1, o.dof);
    }
    m.fxaa.uniforms.tDof.value = dofK > 0 ? rt.dofA.texture : this.black; m.fxaa.uniforms.dofK.value = dofK;
    // 7) FXAA → ekran (ichki aniqlik ekrannikidan farq qilsa: avval oraliq tasvirga, so'ng o'tkirlashtiruvchi kattalashtirish bilan ekranga)
    const same = w === ow && h === oh;
    m.fxaa.uniforms.tColor.value = rt.ldr.texture; m.fxaa.uniforms.texel.value.set(1 / w, 1 / h); m.fxaa.uniforms.sharp.value = same ? 0.45 : 0.2;
    this.pass(m.fxaa, same ? null : rt.aa);
    if (!same) { const uu = m.upscale.uniforms; uu.tColor.value = rt.aa.texture; uu.size.value.set(w, h); uu.sharp.value = sc < 1 ? 0.6 : 0.25; this.pass(m.upscale, null); }
    this.outW = ow; this.outH = oh;
  }
}
