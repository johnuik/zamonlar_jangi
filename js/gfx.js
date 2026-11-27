import * as THREE from '../lib/three.module.js';

// ================= GRAFIKA YORDAMCHILARI =================
// - hook(): standart materialga qo'shimchalar — uy ichida osmon yorug'ligi kamayadi (tom xaritasi),
//           katta masshtabli rang o'zgarishi (takrorlanish ko'rinmaydi), devor tagidagi kir, ho'l yer va ko'lmaklar
// - normalFrom(): rasm teksturasidan relyef (normal) xaritasi
// - roofMap(): to'qnashuv qutilaridan "tom balandligi" xaritasi
// - makeSky(): bulutli osmon; makeEnv(): shu osmondan atrof-muhit yorug'ligi (metall va silliq yuzalarda aks etadi)

// Yengil rejim: GPU tezlatishi yo'q bo'lsa (dasturiy chizish) har pikselda hisoblanadigan qimmat effektlar o'chiriladi
export const GFX = { lite: false, night: false };

// Hamma materiallar bo'lishadigan o'zgaruvchilar (dunyo almashganda qiymati yangilanadi)
export const GU = {
  uRoof: { value: null },                                        // tom balandligi xaritasi
  uRoofInfo: { value: new THREE.Vector4(74, 1 / 148, 40, 0) },   // yarim o'lcham, 1/o'lcham, balandlik masshtabi, yoqilganmi
  uWet: { value: 0 },                                            // 0 — quruq, 1 — yomg'ir
  uTime: { value: 0 },
  uLamps: { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, 0, 0, 0)) },   // tungi chiroqlar: xyz — joyi, w — yoritish radiusi (0 — o'chiq)
  uLampC: { value: new THREE.Color(1.5, 1.18, 0.74) },
  // Yer qoplami xaritasi (world.js: buildSplat): R — yeyilgan yer (yo'l va bino atrofi), G — o't o'sgan joylar, B — qattiq yuza (yo'l, bino ichi — o't o'smaydi)
  uSplat: { value: null },
  uSplatInfo: { value: new THREE.Vector4(74, 1 / 148, 0, 0) },   // yarim o'lcham, 1/o'lcham, yoqilganmi
  uGDirt: { value: null }, uGGrass: { value: null },             // tuproq va o't teksturalari (yer shu uchtasining aralashmasi)
  uGDirtC: { value: new THREE.Color(1, 1, 1) }, uGGrassC: { value: new THREE.Color(1, 1, 1) },   // ularning rang ko'paytuvchisi (foto-tekstura asl rangga keltiriladi)
  uCloud: { value: 0 },                                          // bulut soyalari kuchi (0 — yo'q: tun, yengil rejim)
};
export const LAMP_N = 12;

// ================= GLOBAL SHADER O'ZGARTIRISHLARI (three.js ning hamma materiallariga ta'sir qiladi) =================
// 1) Tuman: balandlikka qarab siyraklashadi (yer bag'irlab quyuq, tom va tepaliklar tiniqroq) va quyosh tomonda yorishadi.
//    Kunduzi yaqin-o'rta masofa tiniq qoladi, tuman faqat uzoqda quyuqlashadi (havo istiqboli) — tasvir "sutli" bo'lib qolmaydi.
//    (tunda — fogFar kichik — o'zgarishsiz: qorong'ulik hamma narsani bir xil yashirishi kerak)
THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    vec3 zjFogC = fogColor;
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    vec3 zjFogC = fogColor;
    float zjDay = smoothstep( 40.0, 80.0, fogFar );
    fogFactor = mix( fogFactor, fogFactor * sqrt( fogFactor ), zjDay );
    #if defined( STANDARD )
      vec3 zjWp = cameraPosition + ( vec4( - vViewPosition, 0.0 ) * viewMatrix ).xyz;
      fogFactor *= mix( 1.0, 0.42 + 0.58 * exp( - max( zjWp.y, 0.0 ) * 0.05 ), zjDay );
      #if NUM_DIR_LIGHTS > 0
        vec3 zjSc = directionalLights[ 0 ].color;
        float zjSm = max( max( zjSc.r, zjSc.g ), max( zjSc.b, 0.001 ) );
        float zjS = max( dot( normalize( - vViewPosition ), directionalLights[ 0 ].direction ), 0.0 );
        zjFogC += ( zjSc / zjSm ) * pow( zjS, 6.0 ) * 0.2 * zjDay * min( 1.0, zjSm );
      #endif
    #endif
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, zjFogC, fogFactor );
#endif`;
// 2) Kaskadli soya: ikkinchi yo'naltirilgan chiroq (kuchi 0, faqat soya xaritasi uchun) o'yinchi atrofidagi kichik maydonni
//    yuqori aniqlikda qamraydi; quyosh soyasi shu maydon ichida o'shaniki bilan almashtiriladi (chetida silliq o'tadi).
{
  const a = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
  const b = `
		#if UNROLLED_LOOP_INDEX == 0
			float zjSh = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ 0 ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ 0 ] ) : 1.0;
			#if NUM_DIR_LIGHT_SHADOWS > 1
			if ( receiveShadow ) {
				vec3 zjC = vDirectionalShadowCoord[ 1 ].xyz / vDirectionalShadowCoord[ 1 ].w;
				vec2 zjE = abs( zjC.xy - 0.5 ) * 2.0;
				float zjIn = ( 1.0 - smoothstep( 0.84, 0.98, max( zjE.x, zjE.y ) ) ) * step( 0.0, zjC.z ) * step( zjC.z, 1.0 );
				if ( zjIn > 0.0 ) {
					DirectionalLightShadow zjS1 = directionalLightShadows[ 1 ];
					zjSh = mix( zjSh, getShadow( directionalShadowMap[ 1 ], zjS1.shadowMapSize, zjS1.shadowBias, zjS1.shadowRadius, vDirectionalShadowCoord[ 1 ] ), zjIn );
				}
			}
			#endif
			directLight.color *= zjSh;
		#endif`;
  if (THREE.ShaderChunk.lights_fragment_begin.includes(a)) THREE.ShaderChunk.lights_fragment_begin = THREE.ShaderChunk.lights_fragment_begin.replace(a, b);
  else console.warn('kaskadli soya ulanmadi: three.js shader matni kutilganidan boshqacha');
}

const VERT = `#include <project_vertex>
{ vec4 wp_ = vec4(transformed, 1.0); vec3 wn_ = objectNormal;
#ifdef USE_INSTANCING
  wp_ = instanceMatrix * wp_; wn_ = mat3(instanceMatrix) * wn_;
#endif
  vWPos = (modelMatrix * wp_).xyz; vWNrm = normalize(mat3(modelMatrix) * wn_); }`;
// Shamol: o't tutamlari (har biri alohida nusxa) — ildizi joyida, uchi tebranadi; AMP — kuchi
const WIND = `#include <begin_vertex>
{
#ifdef USE_INSTANCING
  vec2 ph_ = vec2( instanceMatrix[3][0], instanceMatrix[3][2] );
#else
  vec2 ph_ = vec2( modelMatrix[3][0], modelMatrix[3][2] );
#endif
  float k_ = max( position.y, 0.0 ); k_ *= k_;
  float g_ = sin( uTime * 0.7 + ph_.x * 0.11 + ph_.y * 0.07 ) * 0.5 + 0.5;   // sekin o'tadigan shamol to'lqini
  transformed.x += ( sin( uTime * 2.3 + ph_.x * 1.7 + ph_.y * 1.3 ) * 0.5 + g_ ) * AMP * k_;
  transformed.z += cos( uTime * 1.9 + ph_.y * 1.5 ) * AMP * 0.6 * k_;
}`;
// Shamol: daraxt barglari (birlashtirilgan geometriya, dunyo koordinatasida) — tanadan balanddagi qismi shitirlaydi
const WIND_W = `#include <begin_vertex>
{ float k_ = smoothstep( 3.6, 6.5, position.y );
  transformed.x += sin( uTime * 1.7 + position.x * 0.9 + position.z * 0.6 + position.y * 1.3 ) * 0.07 * k_;
  transformed.z += cos( uTime * 1.4 + position.z * 0.8 + position.y * 1.1 ) * 0.06 * k_;
  transformed.y += sin( uTime * 2.1 + position.x * 1.1 + position.z * 0.9 ) * 0.03 * k_; }`;
// Tungi chiroqlar: dunyo materiallariga arzon qo'shimcha yorug'lik (soyasiz, masofaga qarab so'nadi).
// Tom ostidagi yuzalarga deyarli tushmaydi — aks holda ko'cha chirog'i devordan o'tib, uy ichini yoritib yuborardi.
const LAMPS = `#include <lights_fragment_end>
{ vec3 nl_ = normalize( vWNrm );
  float lo_ = 0.08 + 0.92 * clamp( ( zjSky( vWPos, nl_, 1.0 ) - 0.54 ) / 0.46, 0.0, 1.0 );
  for ( int i = 0; i < 12; i ++ ) {
    vec4 L_ = uLamps[ i ];
    if ( L_.w > 0.0 ) {
      vec3 d_ = L_.xyz - vWPos; float r_ = length( d_ ); float a_ = clamp( 1.0 - r_ / L_.w, 0.0, 1.0 ); a_ *= a_;
      reflectedLight.directDiffuse += material.diffuseColor * uLampC * a_ * lo_ * ( max( dot( nl_, d_ / max( r_, 0.001 ) ), 0.0 ) * 0.75 + 0.25 );
    }
  } }`;
const FRAG_HEAD = `#include <common>
varying vec3 vWPos; varying vec3 vWNrm;
uniform sampler2D uRoof; uniform vec4 uRoofInfo; uniform float uWet; uniform float uTime; uniform vec4 uLamps[12]; uniform vec3 uLampC;
uniform sampler2D uSplat; uniform vec4 uSplatInfo; uniform sampler2D uGDirt; uniform sampler2D uGGrass; uniform vec3 uGDirtC; uniform vec3 uGGrassC; uniform float uCloud;
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
// Yer: qum (asosiy tekstura) ustiga yo'l va binolar atrofida yeyilgan tuproq, ochiq joylarda o't yamoqlari aralashadi.
// Chegaralari shovqin bilan "yirtilgan" — to'g'ri chiziqli o'tish yo'q; uzoqdan ham yer bir xil takrorlanmaydi.
const GROUND = `
if (uSplatInfo.z > 0.5) {
  vec4 sp_ = texture2D(uSplat, (vWPos.xz + uSplatInfo.x) * uSplatInfo.y);
  float bn_ = zjNoise(vWPos.xz * 0.37) * 0.55 + zjNoise(vWPos.xz * 1.9 + 3.1) * 0.3 + zjNoise(vWPos.xz * 7.3 + 1.7) * 0.15;
  float wear_ = smoothstep(0.28, 0.6, sp_.r * 0.95 + (bn_ - 0.5) * 0.6);
  float gr_ = smoothstep(0.3, 0.58, sp_.g + (bn_ - 0.5) * 0.75) * (1.0 - wear_);
  vec3 dirt_ = texture2D(uGDirt, vWPos.xz * 0.23).rgb * uGDirtC * (0.82 + 0.36 * bn_);
  vec3 grs_ = texture2D(uGGrass, vWPos.xz * 0.29).rgb * uGGrassC * (0.78 + 0.44 * bn_);
  diffuseColor.rgb = mix(diffuseColor.rgb, dirt_, wear_ * 0.88);
  diffuseColor.rgb = mix(diffuseColor.rgb, grs_, gr_ * 0.92);
}`;
// O't halqasi: tutamlar kamera atrofidagi RS × RS metrli kvadratda "o'raladi" (kamera yursa, orqada qolgani oldinga o'tadi) —
// shuning uchun butun xaritaga emas, faqat o'yinchi atrofiga zich o't yetarli. Har bir tutamning dunyodagi joyi o'zgarmas.
// Yo'l, bino ichi va to'siq ustida o'smaydi (yer qoplami va tom xaritasidan); chetga borgan sari pasayib yo'qoladi.
const RING = `#include <begin_vertex>
{
  vec2 rel_ = mod( aOff.xy - cameraPosition.xz, RS ) - RS * 0.5;
  vec2 wxz_ = cameraPosition.xz + rel_;
  float fade_ = 1.0 - smoothstep( RS * 0.34, RS * 0.48, length( rel_ ) );
  vec4 sp_ = texture2D( uSplat, ( wxz_ + uSplatInfo.x ) * uSplatInfo.y );
  float roof_ = texture2D( uRoof, ( wxz_ + uRoofInfo.x ) * uRoofInfo.y ).r;
  vec2 in_ = step( abs( wxz_ ), vec2( uSplatInfo.x - 1.0 ) );
  float grow_ = smoothstep( 0.22, 0.5, sp_.g + ( aOff.z - 0.5 ) * 0.55 ) * ( 1.0 - smoothstep( 0.08, 0.3, sp_.b ) ) * ( 1.0 - smoothstep( 0.2, 0.5, sp_.r ) * 0.75 ) * step( roof_, 0.004 ) * fade_ * in_.x * in_.y * step( 0.5, uSplatInfo.z );
  float a_ = aOff.z * 37.7; float ca_ = cos( a_ ), sa_ = sin( a_ );
  vec3 p_ = vec3( position.x * ca_ - position.z * sa_, position.y, position.x * sa_ + position.z * ca_ );
  p_.xz *= 0.5 + fract( aOff.z * 7.31 ) * 0.55;
  p_.y *= ( 0.3 + fract( aOff.z * 3.17 ) * 0.5 ) * grow_;
  float k_ = position.y * position.y * grow_;
  float gust_ = sin( uTime * 0.7 + wxz_.x * 0.11 + wxz_.y * 0.07 ) * 0.5 + 0.5;
  p_.x += ( sin( uTime * 2.3 + wxz_.x * 1.7 + wxz_.y * 1.3 ) * 0.5 + gust_ ) * 0.2 * k_;
  p_.z += cos( uTime * 1.9 + wxz_.y * 1.5 ) * 0.12 * k_;
  transformed = vec3( wxz_.x, 0.0, wxz_.y ) + p_ * step( 0.02, grow_ );
}`;
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

// o: macro (rang o'zgarishi), grime (devor tagidagi kir), wet (ho'llik), dyn (harakatlanuvchi jism — normal bo'yicha siljitilmaydi),
//    ground (yer: tuproq va o't aralashmasi), ring (kamera atrofidagi o't halqasi; qiymati — kvadrat tomoni, m),
//    wind (o't tutamlari shamolda tebranadi; qiymati — kuchi), windW (birlashtirilgan daraxt barglari shitirlaydi)
export function hook(mat, o = {}) {
  if (GFX.lite) o = { dyn: o.dyn };   // faqat tom soyasi qoladi (bitta tekstura so'rovi)
  const lamps = GFX.night && !GFX.lite;   // tungi chiroqlar faqat tunda hisoblanadi
  const key = 'zj4' + (o.macro ? 'm' : '') + (o.grime ? 'g' : '') + (o.wet ? 'w' : '') + (o.dyn ? 'd' : '') + (o.wind ? 'W' + o.wind : '') + (o.windW ? 'V' : '') + (lamps ? 'L' : '') + (o.ground ? 'G' : '') + (o.ring ? 'R' + o.ring : '');
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (sh) => {
    for (const k in GU) sh.uniforms[k] = GU[k];
    let v = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm; uniform float uTime;' + (o.ring ? '\nattribute vec3 aOff; uniform sampler2D uSplat; uniform vec4 uSplatInfo; uniform sampler2D uRoof; uniform vec4 uRoofInfo;' : '')).replace('#include <project_vertex>', VERT);
    if (o.ring) v = v.replace('#include <begin_vertex>', RING.replace(/RS/g, (+o.ring).toFixed(1)));
    else if (o.wind) v = v.replace('#include <begin_vertex>', WIND.replace(/AMP/g, (+o.wind).toFixed(4)));
    else if (o.windW) v = v.replace('#include <begin_vertex>', WIND_W);
    sh.vertexShader = v;
    let f = sh.fragmentShader.replace('#include <common>', FRAG_HEAD);
    if (lamps) f = f.replace('#include <lights_fragment_end>', LAMPS);
    if (o.macro || o.grime || o.ground) f = f.replace('#include <map_fragment>', (o.macro ? MACRO : '#include <map_fragment>') + (o.ground ? GROUND : '') + (o.grime ? GRIME : ''));
    if (o.wet) f = f.replace('#include <roughnessmap_fragment>', WET_A).replace('#include <normal_fragment_maps>', WET_B);
    f = f.replace('#include <aomap_fragment>', `#include <aomap_fragment>
{ float so_ = zjSky(vWPos, normalize(vWNrm), ${o.dyn ? '0.0' : '1.0'}); reflectedLight.indirectDiffuse *= so_; reflectedLight.indirectSpecular *= so_ * so_; }
// bulut soyalari: yer bo'ylab sekin suzib o'tadigan katta yumshoq soya dog'lari (faqat to'g'ridan-to'g'ri yorug'likni kamaytiradi)
if (uCloud > 0.0) { float cl_ = zjNoise(vWPos.xz * 0.011 + vec2(uTime * 0.013, uTime * 0.008)) * 0.65 + zjNoise(vWPos.xz * 0.033 - vec2(uTime * 0.011, 0.0)) * 0.35;
  cl_ = 1.0 - uCloud * smoothstep(0.5, 0.74, cl_); reflectedLight.directDiffuse *= cl_; reflectedLight.directSpecular *= cl_; }`);
    sh.fragmentShader = f;
  };
  mat.needsUpdate = true;
  return mat;
}

// ---------- Qirralari yumaloqlangan quti ----------
// Oddiy quti o'rniga: har bir qirra va burchak r radius bilan yumaloqlanadi, normallar silliq o'tadi — qirralarda yorug'lik "o'ynaydi",
// jism o'tkir qirrali "quticha"ga emas, quyma detalga o'xshaydi (transport korpusi, qurol, anjomlar). minD dan ingichka detal oddiy quti bo'lib qoladi.
export function rbox(w, h, d, r, minD = 0.05) {
  const m = Math.min(w, h, d);
  if (r === undefined) r = Math.min(0.09, m * 0.22);
  r = Math.min(r, m * 0.45);
  if (m < minD || r < 1e-4) return new THREE.BoxGeometry(w, h, d);
  const g = new THREE.BoxGeometry(w, h, d, 3, 3, 3), p = g.attributes.position, n = g.attributes.normal, H = [w / 2, h / 2, d / 2], v = [0, 0, 0], c = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    v[0] = p.getX(i); v[1] = p.getY(i); v[2] = p.getZ(i);
    let l = 0;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(v[a]) < H[a] - 1e-7) v[a] = Math.sign(v[a]) * (H[a] - r);   // ichki to'r chizig'i — yumaloqlash boshlanadigan joyga suriladi
      c[a] = Math.max(-(H[a] - r), Math.min(H[a] - r, v[a]));
      l += (v[a] - c[a]) * (v[a] - c[a]);
    }
    l = Math.sqrt(l);
    if (l > 1e-9) { const k = r / l; p.setXYZ(i, c[0] + (v[0] - c[0]) * k, c[1] + (v[1] - c[1]) * k, c[2] + (v[2] - c[2]) * k); n.setXYZ(i, (v[0] - c[0]) / l, (v[1] - c[1]) / l, (v[2] - c[2]) / l); }
    else p.setXYZ(i, v[0], v[1], v[2]);
  }
  return g;
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

// ---------- Silliqlik (roughness) xaritasi: rasmning yorqinligidan ----------
// To'q joylar (zang, kir, tirqish) g'adir-budur, och joylar (bo'yoq, yalang'och metall) silliqroq — yuza bir tekis yaltiramaydi.
// base — materialning o'rtacha silliqligi; k — farq kuchi. Natija materialning roughnessMap iga qo'yiladi (roughness = 1 bilan).
const roughCache = new Map();
export function roughFrom(src, base = 0.85, k = 0.5) {
  const c = src.image || src, key = (src.uuid || '') + '|' + base.toFixed(2) + '|' + k;
  let t = roughCache.get(key);
  if (!t) {
    const w = c.width, h = c.height, d0 = c.getContext('2d').getImageData(0, 0, w, h).data;
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const g = out.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    let avg = 0;
    for (let i = 0; i < w * h; i++) avg += d0[i * 4] * 0.299 + d0[i * 4 + 1] * 0.587 + d0[i * 4 + 2] * 0.114;
    avg /= w * h * 255;
    for (let i = 0; i < w * h; i++) {
      const l = (d0[i * 4] * 0.299 + d0[i * 4 + 1] * 0.587 + d0[i * 4 + 2] * 0.114) / 255;
      const r = Math.max(0.06, Math.min(1, base + (avg - l) * k * 2.2)) * 255;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = r; d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    t = new THREE.CanvasTexture(out);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    roughCache.set(key, t);
    if (roughCache.size > 80) roughCache.delete(roughCache.keys().next().value);
  }
  const r = t.clone(); r.needsUpdate = true;
  if (src.isTexture) r.repeat.copy(src.repeat);
  return r;
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
uniform vec3 mid; uniform float midK; uniform float hz;
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
  if (midK > 0.0) {
    // tiniq osmon: zenitda to'q ko'k, pastroqda och ko'k; chang-tuman faqat ufq yaqinidagi tor tasmada (quyosh tomonda u iliqroq va yorug'roq)
    vec3 c1 = mix(mid, top, smoothstep(0.0, 0.8, pow(h, 0.72)));
    vec3 hzC = bottom + sunColor * pow(s, 4.0) * 0.14 * sunAmt;
    c = mix(c, mix(c1, hzC, exp(-h * hz)), midK);
  }
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
// p: { top, bottom, ground, sunDir, sunColor, sunAmt, cloudLit, cloudDark, cover, cloudK, oct, mid (berilsa — uch rangli tiniq osmon), hz (ufq tumanining torligi) }
export function makeSky(p) {
  const C = (h) => new THREE.Color(h);
  const mat = new THREE.ShaderMaterial({
    defines: { OCT: p.oct || 5 },
    uniforms: {
      top: { value: C(p.top) }, bottom: { value: C(p.bottom) }, mid: { value: C(p.mid ?? p.top) }, midK: { value: p.mid === undefined ? 0 : 1 }, hz: { value: p.hz ?? 8 }, ground: { value: C(p.ground) }, sunDir: { value: p.sunDir.clone() }, sunColor: { value: C(p.sunColor) },
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
