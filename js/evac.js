// Zombi rejimi yakuni — EVAKUATSIYA.
// Oxirgi bosqich (vertolyot maydonini ushlab turish) bajarilgach katta vertolyot (Chinuk) uzoqdan uchib kelib maydonga qo'nadi
// va orqa rampasini tushiradi. Tirik odamlar rampa oldidagi yashil doiraga kirib bortga chiqadi (kamera rampadan ichkariga yuradi).
// Hamma tirik odam bortda bo'lsa (yoki kutish vaqti tugasa) vertolyot ko'tarilib uchib ketadi — buni HAMMA o'yinchi (bortdagilar,
// yerda qolganlar va zombilar) "kino" ko'rinishida tomosha qiladi: keng ekran chiziqlari, to'rt xil kamera rakursi, tong otishi va yakuniy yozuv.
// Yakka o'yinda bosqichlarni shu yer hisoblaydi; tarmoqda server boshqaradi ('zevac' xabarlari: arrive → board → leave, so'ng 'end').
import * as THREE from '../lib/three.module.js';
import { EVAC_T, WILD } from './shared.mjs';
import { $, G, camera, clamp, glintTex, lerp, player, sound } from './core.js';
import { banner, popup } from './hud.js';
import { Vehicle } from './vehicles.js';
import { evacModel, loadVeh } from './vehskin.js';
import { nameOf, net, remotes } from './mp.js';
import { endGame } from './game.js';

const E = WILD.evac;
const SEATS = [[0.9, -1.0], [-0.9, -1.0], [0.9, 0.4], [-0.9, 0.4], [0.9, 1.8], [-0.9, 1.8], [0.9, -2.4], [-0.9, -2.4]];   // bortdagi o'rindiqlar (x, z — vertolyot koordinatasida)
const FLOOR = 0.8;            // yuk bo'limi poli balandligi
const RAMP_OPEN = -0.34, RAMP_SHUT = 1.42;   // rampa burchagi: ochiq (uchi yerga tegadi) va yopiq (tik)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Vector3();
const ss = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const easeOut = (x) => 1 - (1 - clamp(x, 0, 1)) ** 3;
let EV = null;   // joriy evakuatsiya holati (yo'q bo'lsa — null)

export const evacOn = () => !!EV;
export const evacAboard = () => !!(EV && EV.aboard);
export const evacHas = (id) => !!(EV && EV.ev.has(id));   // shu o'yinchi vertolyotdami
// O'yinchi boshqaruvi to'xtatilganmi (bortda yoki yakuniy "kino" ketmoqda)
export const evacFreeze = () => !!(EV && (EV.aboard || EV.ph === 'leave'));
const scaleK = () => (G.mp ? 1 : G.evacK || 1);   // (yakka o'yin sinovlari uchun vaqtni qisqartirish)

// ---------- Vertolyot va uning atrofi ----------
function build() {
  const v = new Vehicle(G, -1, 'chinook', E.x, E.z, E.yaw, evacModel());
  G.world.removeBox(v.box);   // (to'qnashuv qutisi yo'q — rampaga yurib chiqiladi, odamlar bortda "o'tirgan" holatda ko'chiriladi)
  v.rotor = 1;
  // ochiladigan orqa rampa (lo'lasi pol orqasida): ochiq holatda uchi yerga tegadi
  const M = new THREE.MeshStandardMaterial({ color: 0x3a3d33, roughness: 0.8, metalness: 0.4, side: THREE.DoubleSide });
  const ramp = new THREE.Group(); ramp.position.set(0, FLOOR, -4.25); v.hull.add(ramp);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 2.45), M); plate.position.z = -1.22; plate.castShadow = true; ramp.add(plate);
  for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 2.4), M); rail.position.set(s * 1.12, 0.1, -1.2); ramp.add(rail); }
  ramp.rotation.x = RAMP_SHUT;
  // yuk bo'limi ichi: pol, yon o'rindiqlar (qizil to'r), shiftdagi tungi qizil chiroqlar — kabina kadrlari "o'qiladigan" bo'lsin
  const IN = new THREE.MeshStandardMaterial({ color: 0x2e3130, roughness: 0.9, metalness: 0.3 }), NET = new THREE.MeshStandardMaterial({ color: 0x6e2a22, roughness: 0.95 });
  const LIT = new THREE.MeshBasicMaterial({ color: 0xc8301e, fog: false }), WHITE = new THREE.MeshBasicMaterial({ color: 0xfff0d8, fog: false });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = true; v.hull.add(m); return m; };
  add(new THREE.BoxGeometry(2.3, 0.06, 8.3), IN, 0, FLOOR - 0.03, -0.2);
  for (const sd of [-1, 1]) {
    add(new THREE.BoxGeometry(0.44, 0.07, 6.2), NET, sd * 1.0, FLOOR + 0.42, -0.6); add(new THREE.BoxGeometry(0.05, 0.55, 6.2), NET, sd * 1.21, FLOOR + 0.78, -0.6);
    for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.04, 0.42, 0.04), IN, sd * 0.8, FLOOR + 0.21, -3.2 + i * 1.05);
    add(new THREE.BoxGeometry(0.05, 0.05, 0.05), WHITE, sd * 1.05, FLOOR + 1.7, -4.15);
  }
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.16, 0.04, 0.16), LIT, 0, FLOOR + 1.86, -3 + i * 1.7);   // shiftdagi tungi qizil plafonlar
  // tunda ko'rinadigan chiroqlar: qizil/yashil yon chiroqlar, oq miltillovchi, kabina ichidagi qizil yorug'lik
  const spr = (hex, s, x, y, z, op = 0.9) => {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, color: hex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op, fog: false }));
    m.scale.set(s, s, 1); m.position.set(x, y, z); v.hull.add(m); return m;
  };
  const nav = [spr(0xff3a2a, 1.1, 1.75, 1.6, 2.6), spr(0x3aff6a, 1.1, -1.75, 1.6, 2.6)];
  const strobe = spr(0xffffff, 2.2, 0, 5.9, -3.2, 0);
  const beamM = new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 18, 20, 1, true), beamM);   // projektor nuri (havodagi chang ko'rinishida)
  beam.geometry.translate(0, -9, 0); beam.position.set(0, 0.4, 3.8); beam.rotation.x = 0.25; beam.renderOrder = 2; v.hull.add(beam);
  // tong shu'lasi: uchib ketish yo'nalishida, ufq ortida (yakuniy kadrlarda asta yorishadi)
  const dawn = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: 0xffa25a, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0, fog: false }));
  const dy = E.yaw - 0.55; dawn.position.set(E.x + Math.sin(dy) * 650, 25, E.z + Math.cos(dy) * 650); dawn.scale.set(620, 220, 1); dawn.renderOrder = -1; G.scene.add(dawn);
  return { v, ramp, nav, strobe, beam, dawn, rampA: RAMP_SHUT };
}

// yumshoq doira (tong shu'lasi uchun — yulduzsimon nursiz)
let _soft = null;
function softTex() {
  if (_soft) return _soft;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (_soft = new THREE.CanvasTexture(c));
}
// Uchib kelish yo'li (u = 0..1): sharqdan, baza ustidan aylanib, maydon tepasida to'xtaydi va tik pastga tushadi
const ARR = [new THREE.Vector3(E.x + 380, 100, E.z + 120), new THREE.Vector3(E.x + 150, 72, E.z + 150), new THREE.Vector3(E.x + 12, 40, E.z + 70), new THREE.Vector3(E.x, 24, E.z)];
const FLY = 0.68;   // yo'lning qancha qismi — uchish (qolgani — tik qo'nish)
function arrivePos(u, out) {
  if (u < FLY) {
    const s = easeOut(u / FLY), r = 1 - s;
    return out.set(0, 0, 0).addScaledVector(ARR[0], r * r * r).addScaledVector(ARR[1], 3 * r * r * s).addScaledVector(ARR[2], 3 * r * s * s).addScaledVector(ARR[3], s * s * s);
  }
  const w = ss((u - FLY) / (1 - FLY));
  return out.set(E.x, lerp(24, 0, w), E.z);
}
// Uchib ketish yo'li (t — soniya, k — vaqt ko'paytuvchisi): tik ko'tarilish, so'ng oldinga tezlashib, o'ngga burilib balandlaydi
function leavePos(t, k, out) {
  const lift = 3.5 * k, y0 = 9 * ss(t / lift);
  if (t <= lift) return out.set(E.x, y0, E.z);
  const tn = (t - lift) / k;   // (asl soniyalarda)
  let x = E.x, z = E.z, prev = 0;
  for (let s = 0.05; s <= tn + 1e-6; s += 0.05) {
    const d = s < 6 ? 3.2 * s * s : 115.2 + 38.4 * (s - 6), yw = E.yaw - 0.55 * ss(s / 9);
    x += Math.sin(yw) * (d - prev); z += Math.cos(yw) * (d - prev); prev = d;
  }
  return out.set(x, 9 + 95 * ss(tn / 13), z);   // (xaritani o'rab turgan tizmalardan baland)
}
// Vertolyot holati shu paytda: joyi, burchaklari (tezlik va tezlanishdan: oldinga — tumshug'i pastga, burilishda — yonboshlaydi)
function pose(t, out) {
  const ph = EV.ph, D = EV.d, k = EV.k, at = (tt, o) => (ph === 'arrive' ? arrivePos(clamp(tt / D, 0, 1), o) : ph === 'leave' ? leavePos(Math.max(0, tt), k, o) : o.set(E.x, 0, E.z));
  at(t, out.p);
  if (ph === 'board') { out.yaw = E.yaw; out.pitch = 0; out.roll = 0; return out; }
  const h = 0.25 * k;
  at(t - h, _a); at(t + h, _b);
  const vx = (_b.x - _a.x) / (2 * h), vz = (_b.z - _a.z) / (2 * h), sp = Math.hypot(vx, vz);
  const ax = (_b.x - 2 * out.p.x + _a.x) / (h * h), az = (_b.z - 2 * out.p.z + _a.z) / (h * h);
  let yaw = E.yaw;
  if (ph === 'arrive') {
    const u = t / D, head = (uu) => { arrivePos(Math.min(uu, FLY - 0.001), _c); arrivePos(Math.min(uu, FLY - 0.001) + 0.002, _d); return Math.atan2(_d.x - _c.x, _d.z - _c.z); };
    if (u < FLY) yaw = head(u);
    else { const y0 = head(FLY - 0.003); let dy = E.yaw - y0; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; yaw = y0 + dy * ss((u - FLY) / (1 - FLY) * 1.6); }
  } else if (sp > 2) yaw = Math.atan2(vx, vz);
  const aF = (ax * Math.sin(yaw) + az * Math.cos(yaw)) * k * k, aL = (ax * Math.cos(yaw) - az * Math.sin(yaw)) * k * k;
  out.yaw = yaw; out.pitch = clamp(sp * k * 0.0042 + aF * 0.045, -0.22, 0.24); out.roll = clamp(-aL * 0.05, -0.32, 0.32);
  return out;
}
const POSE = { p: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0 };
// vertolyot koordinatasidagi nuqtani dunyo koordinatasiga
function toWorld(v, x, y, z, out) { v.hull.updateWorldMatrix(true, false); return out.set(x, y, z).applyMatrix4(v.hull.matrixWorld); }

// ---------- Bosqichlar ----------
// ph — 'arrive' | 'board' | 'leave'; d — bosqich davomiyligi (s); ev — bortdagi o'yinchilar (tarmoq)
export function evacPhase(ph, d, ev) {
  if (!G.world || !G.zg) return;
  if (!EV) {
    EV = { ph: '', t0: G.time, d: 1, k: 1, h: build(), snd: null, aboard: false, seat: 0, walk: -1, askT: -9, ev: new Set(), dark0: G.zg.dark, dustT: 0, shots: -1 };
    G.zg.evac = true;
    $('cine').classList.remove('hidden');
  }
  if (Array.isArray(ev)) {
    for (const id of ev) if (!EV.ev.has(id)) { EV.ev.add(id); if (id !== G.myId && G.mp) popup(`${nameOf(id)} vertolyotga chiqdi`); }
    if (G.mp && ev.includes(G.myId) && !EV.aboard) boardMe();
  }
  if (ph === EV.ph) { if (ph === 'board' && d) { EV.t0 = G.time; EV.d = d; } return; }   // (kutish vaqti qisqardi)
  EV.ph = ph; EV.t0 = G.time; EV.d = Math.max(0.5, d || 1); EV.k = ph === 'leave' ? EV.d / EVAC_T.leave : 1;
  if (ph === 'arrive') {
    banner('VERTOLYOT YETIB KELMOQDA!', "Maydonni bo'shating va ushlab turing — qo'ngach orqa rampadan bortga chiqing", 6);
    sound.horn();
  } else if (ph === 'board') {
    EV.h.rampA = RAMP_OPEN;
    banner("VERTOLYOT QO'NDI!", G.isZ ? "Odamlarni bortga chiqarmang!" : "Orqa rampaga chiqing (yashil doira) — hamma chiqqach uchib ketadi", 6);
    sound.ping();
  } else if (ph === 'leave') startCine();
}
// Zombi jangi boshida: vertolyot modeli oldindan tayyorlanadi (yakunda qotib qolmasin)
export function evacPreload() { const d = evacModel(); if (d) loadVeh(d); }
// Yakka o'yin: oxirgi bosqich bajarildi
export function evacStartSP() { evacPhase('arrive', EVAC_T.arrive * scaleK()); }
// Tarmoq: serverdan kelgan holat (jang o'rtasida qo'shilgan yoki xabarni o'tkazib yuborgan o'yinchi uchun)
export function evacSync(info) {
  if (!info || !G.zg) return;
  if (!EV || EV.ph !== info.ph) evacPhase(info.ph, info.d, info.ev);
  else if (Array.isArray(info.ev) && info.ev.some((id) => !EV.ev.has(id))) evacPhase(info.ph, 0, info.ev);
}

// Bortga chiqish: kamera rampa bo'ylab ichkariga yuradi va o'rindiqqa o'tiradi
function boardMe() {
  if (EV.aboard) return;
  EV.aboard = true; EV.walk = 0; EV.from = player.pos.clone();
  EV.seat = Math.max(0, EV.ev.size - 1) % SEATS.length;
  if (!G.mp) EV.ev.add(G.myId || 0);
  player.vel.set(0, 0, 0); G.ads = 0; G.reloadT = 0;
  banner('SIZ BORTDASIZ!', G.mp ? 'Qolganlarni kuting — hamma chiqqach uchamiz' : 'Uchishga tayyorlaning...', 4);
  sound.ping();
}

// ---------- Har kadr ----------
export function updateEvac(dt) {
  if (!EV) return;
  const P = player, h = EV.h, v = h.v, t = G.time - EV.t0;
  // vertolyot joyi va burchaklari
  if (EV.ph === 'board') pose(0, POSE); else pose(Math.min(t, EV.d), POSE);
  v.pos.copy(POSE.p);
  const sm = Math.min(1, dt * 5);
  v.yaw = EV.ph === 'board' ? E.yaw : POSE.yaw; v.pitch = lerp(v.pitch, POSE.pitch, sm); v.roll = lerp(v.roll, POSE.roll, sm);
  v.rotor = EV.ph === 'board' ? 0.82 : 1;
  v.visual(dt);
  // rampa: qo'ngach ochiladi; uchishda (kabinadan ko'rinadigan kadrdan keyin) yopiladi
  const want = EV.ph === 'board' || (EV.ph === 'leave' && t < 7.6 * EV.k) ? RAMP_OPEN : RAMP_SHUT;
  if (EV.ph === 'arrive') h.rampA = t / EV.d > 0.92 ? RAMP_OPEN : RAMP_SHUT;
  else h.rampA = want;
  h.ramp.rotation.x += (h.rampA - h.ramp.rotation.x) * Math.min(1, dt * (EV.ph === 'leave' ? 1.6 : 1.1));
  // chiroqlar: yon chiroqlar doim, oq chiroq miltillaydi; qo'nayotganda projektor nuri yerga tushadi
  h.strobe.material.opacity = (G.time * 1.1) % 1 < 0.08 ? 1 : 0;
  const alt = v.pos.y;
  h.beam.material.opacity = EV.ph === 'arrive' ? 0.045 * ss((t / EV.d - 0.45) / 0.2) : EV.ph === 'leave' ? 0.04 * (1 - ss(t / (6 * EV.k))) : 0.025;
  // parraklar shamoli: pastda chang to'zoni
  EV.dustT -= dt;
  if (alt < 16 && G.fx && EV.dustT <= 0) {
    EV.dustT = 0.05;
    for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * (9 - alt * 0.3); G.fx.smokePuff(_q.set(v.pos.x + Math.cos(a) * r, 0.3, v.pos.z + Math.sin(a) * r), 0.3 * (1 - alt / 16), true); }
  }
  // ovoz: uzoqdan eshitiladi, yaqinlashgani sari kuchayadi
  if (!EV.snd && sound.ctx) EV.snd = sound.engine('heli');
  if (EV.snd) { const dist = camera.position.distanceTo(v.pos); EV.snd.set(Math.min(1.3, 2.2 / (1 + dist * 0.02)) * (EV.fade ?? 1), EV.ph === 'board' ? 0.8 : 1); }
  // zombilar vertolyot shovqinini eshitib maydonga yopiriladi
  EV.noiseT = (EV.noiseT || 0) - dt;
  if (G.zg && G.zg.host && EV.ph !== 'arrive' && EV.noiseT <= 0) { EV.noiseT = 0.6; G.zg.noise(E.x, E.z, 70, null, EV.ph === 'leave'); }
  // bortga chiqish joyi belgisi: yashil ustun va halqa (qo'ngandan keyin, odamlarga)
  { const mk = G.zg && G.zg.mk, on = EV.ph === 'board' && !G.isZ && !EV.aboard;
    if (mk) { mk.beam.visible = mk.ring.visible = on; if (on) { mk.beam.material.color.setHex(0x7dff9a); mk.ring.material.color.setHex(0x7dff9a); mk.beam.position.set(E.bx, 45, E.bz); mk.ring.position.set(E.bx, 0.06, E.bz); mk.ring.scale.set(E.br, E.br, 1); } } }
  // bortga chiqish: tirik odam yashil doiraga kirsa
  if (EV.ph === 'board' && !EV.aboard && P.alive && !G.isZ && !G.inVeh && P.pos.y < 3 && Math.hypot(P.pos.x - E.bx, P.pos.z - E.bz) < E.br) {
    if (!G.mp) { boardMe(); EV.leaveT = Math.max(3.1, 3.2 * scaleK()); }   // (o'rindiqqa o'tirib olguncha kutadi)
    else if (G.time - EV.askT > 1.2) { EV.askT = G.time; net.send({ t: 'zboard' }); }
  }
  // yakka o'yin: bortga chiqqach bir soniyadan keyin uchadi
  if (!G.mp && EV.ph === 'board' && EV.aboard) { EV.leaveT -= dt; if (EV.leaveT <= 0) evacPhase('leave', EVAC_T.leave * scaleK()); }
  if (!G.mp && EV.ph === 'arrive' && t >= EV.d) evacPhase('board', 0);
  // bortdagi o'yinchi vertolyot bilan birga ko'chadi (tarmoqda boshqalar uni kabina ichida ko'radi)
  if (EV.aboard) {
    const s = SEATS[EV.seat];
    toWorld(v, s[0], FLOOR, s[1], _a);
    if (EV.walk >= 0 && EV.walk < 1) {
      EV.walk = Math.min(1, EV.walk + dt / 1.9);
      toWorld(v, 0, 0.02, -6.7, _b); toWorld(v, 0, FLOOR, -4.2, _c);
      const w = ss(EV.walk);
      if (w < 0.4) P.pos.lerpVectors(EV.from, _b, w / 0.4); else if (w < 0.7) P.pos.lerpVectors(_b, _c, (w - 0.4) / 0.3); else P.pos.lerpVectors(_c, _a, (w - 0.7) / 0.3);
    } else P.pos.copy(_a);
    P.vel.set(0, 0, 0); P.crouch = true;
  }
  // tarmoq: bortdagi boshqa o'yinchilar uchib ketishda ko'rinmaydi (ular yopiq kabina ichida)
  if (G.mp && EV.ph === 'leave') for (const r of remotes.values()) if (EV.ev.has(r.id) && r.root) r.root.visible = false;
  // yakuniy "kino": tong otadi, oxirida qorong'ilashadi
  if (EV.ph === 'leave') {
    const tl = G.time - EV.t0, u = tl / EV.d;   // (bosqich shu kadrda almashgan bo'lishi mumkin — vaqt qayta hisoblanadi)
    if (G.zg) { G.zg.darkHold = lerp(EV.dark0, 0.35, ss((u - 0.35) / 0.55)); }
    h.dawn.material.opacity = 0.32 * ss((u - 0.4) / 0.45) * (1 - ss((u - 0.93) / 0.07));
    cineText(u);
    // kino uchun tuman siyraklashadi (tunda 34 m dan narisi ko'rinmasdi)
    const fog = G.world.env && G.world.env.fog;
    if (fog) { fog.far = Math.max(fog.far, lerp(70, 210, ss(u / 0.55))); fog.near = Math.max(fog.near, 18); }
    if (!G.mp && tl >= EV.d && !EV.ended) { EV.ended = true; endGame(true); clearEvac(); }
  }
}

// ---------- Yakuniy "kino" ----------
function startCine() {
  EV.shots = 0; EV.fade = 1;
  const cine = $('cine'); cine.classList.add('on'); cine.classList.remove('fade', 'titles');
  $('hud').classList.add('cineHide');
  const mine = EV.ev.has(G.myId || 0) || EV.aboard, names = [...EV.ev].map((id) => (id === (G.myId || 0) ? G.myName || 'Siz' : nameOf(id)));
  $('cineTitle').textContent = EV.ev.size || !G.mp ? 'EVAKUATSIYA' : "VERTOLYOT BO'SH UCHIB KETDI";
  $('cineSub').textContent = !G.mp ? 'Karantin zonasi ortda qoldi. Tong otmoqda.'
    : EV.ev.size ? `Qutqarildi: ${names.join(', ')}${mine ? '' : ' · siz yerda qoldingiz'}` : 'Hech kim ulgurmadi — zonani zombilar egalladi';
  G.ads = 0; player.vel.set(0, 0, 0);
}
function cineText(u) {
  const c = $('cine');
  if (u > 0.74 && !c.classList.contains('titles')) c.classList.add('titles');
  if (u > 0.92 && !c.classList.contains('fade')) c.classList.add('fade');
  if (EV.fade !== undefined) EV.fade = 1 - ss((u - 0.9) / 0.1);
}
// Kamera: bortdagi o'yinchi — kabina ichidan (sichqoncha bilan atrofga qarasa bo'ladi); uchib ketishda — hamma uchun kino rakurslari.
// Qaytaradi: kamerani shu yer boshqardimi.
export function evacCamera() {
  if (!EV) return false;
  const v = EV.h.v, P = player;
  if (EV.ph === 'leave') {
    const t = (G.time - EV.t0) / EV.k;   // (asl soniyalarda)
    camera.fov = 50;
    if (t < 4.5) {   // 1) yerdan, rampa tomondan: vertolyot chang ichida ko'tariladi, zombilar yugurib keladi
      const s = t / 4.5;
      if (!EV.cam1) EV.cam1 = pickCam();
      camera.position.copy(EV.cam1).lerp(_d.set(E.x, EV.cam1.y + 0.6, E.z), s * 0.12); camera.lookAt(_b.copy(v.pos).add(_c.set(0, 3, 0)));
    } else if (t < 9) {   // 2) kabina oldi yonidan dum tomonga: vertolyot ko'tarilmoqda, pastda baza chiroqlari va maydonga yopirilgan zombilar
      const s = (t - 4.5) / 4.5;
      toWorld(v, -4.6 - s * 0.8, 2.2 + s * 0.6, 7.8, _a); camera.position.copy(_a); toWorld(v, 0.5, -7 - s * 5, -16, _b); camera.lookAt(_b);
      camera.fov = 58;
    } else if (t < 14.5) {   // 3) yonma-yon uchib: vertolyot burilib balandlaydi
      const s = (t - 9) / 5.5;
      toWorld(v, -24, 2.5 + s * 3, 8 - s * 12, _a); camera.position.copy(_a); camera.lookAt(_b.copy(v.pos).add(_c.set(0, 2.2, 0)));
    } else {   // 4) orqadan va tepadan: vertolyot tong otayotgan osmonga uchib ketadi, kamera asta ortda qoladi
      const s = (t - 14.5) / 6.5;
      toWorld(v, -6, 6 + s * 5, -21 - s * 15, _a); camera.position.lerp(_a, EV.shot4 ? 0.25 : 1); EV.shot4 = true;
      toWorld(v, 0, -3, 40, _b); camera.lookAt(_b);
      camera.fov = 46;
    }
    camera.updateProjectionMatrix();
    return true;
  }
  if (EV.aboard) {   // kabina ichida: o'tirgan joydan
    const s = SEATS[EV.seat], walking = EV.walk >= 0 && EV.walk < 1;
    if (walking) camera.position.set(P.pos.x, P.pos.y + 1.7, P.pos.z);
    else toWorld(v, s[0] * 0.92, FLOOR + 1.08, s[1], camera.position);
    // rampadan ichkariga qarab yuradi, o'rindiqqa yetgach orqaga — ochiq rampaga qarab o'tiradi (keyin sichqoncha bilan atrofga qarasa bo'ladi)
    if (walking) { P.yaw = E.yaw + Math.PI * (1 - ss((ss(EV.walk) - 0.7) / 0.3)); P.pitch = -0.06; }
    camera.rotation.set(P.pitch, P.yaw, 0);
    camera.fov = lerp(camera.fov, 70, 0.2); camera.updateProjectionMatrix();
    return true;
  }
  return false;
}

// Tozalash (jang tugadi yoki yangi jang boshlandi)
export function clearEvac() {
  if (EV) {
    if (EV.snd) { EV.snd.stop(); EV.snd = null; }
    EV.h.v.dispose(); G.scene.remove(EV.h.dawn);
    if (G.zg) { G.zg.evac = false; G.zg.darkHold = undefined; }
    EV = null;
  }
  const c = $('cine');
  if (c) c.classList.remove('on', 'titles', 'fade');
  if (c) c.classList.add('hidden');
  $('hud').classList.remove('cineHide');
}
// Birinchi kino kadri uchun kamera joyi: rampa tomonda, maydondan ~19 m narida, vertolyot ko'rinadigan (bino, qop, devor to'smaydigan) nuqta
function pickCam() {
  const W = G.world, back = Math.atan2(-Math.sin(E.yaw), -Math.cos(E.yaw));
  for (const da of [0.6, -0.6, 1.0, -1.0, 1.5, -1.5, 2.2, -2.2]) {
    const a = back + da, c = new THREE.Vector3(E.x + Math.sin(a) * 19, 1.5, E.z + Math.cos(a) * 19);
    if (W.pointInBox(c) || !W.los(c, _q.set(E.x, 3, E.z)) || !W.los(c, _q.set(E.x, 9, E.z))) continue;
    return c;
  }
  return new THREE.Vector3(E.x + Math.sin(back + 0.6) * 19, 1.5, E.z + Math.cos(back + 0.6) * 19);
}
// HUD uchun: vazifa matni (bo'sh — evakuatsiya yo'q)
export function evacObjective(d) {
  if (!EV) return '';
  const left = Math.max(0, Math.ceil(EV.d - (G.time - EV.t0)));
  if (G.isZ) return EV.ph === 'board' ? `Vertolyot qo'ndi — odamlarni bortga chiqarmang! (${left} s)` : 'Vertolyot yaqinlashmoqda — odamlarni maydonda ushlab qoling!';
  if (EV.ph === 'arrive') return `Vertolyot yaqinlashmoqda — qo'nish maydonini himoya qiling (${left} s)`;
  if (EV.ph === 'board') {
    if (EV.aboard) return G.mp ? `Siz bortdasiz — qolganlarni kuting (${left} s ichida uchadi)` : 'Siz bortdasiz';
    return `VERTOLYOTGA CHIQING: orqa rampa — ${d} m` + (G.mp ? ` · bortda ${EV.ev.size} kishi · ${left} s` : '');
  }
  return '';
}
// HUD va xarita uchun: bortga chiqish nuqtasi
export const evacTarget = { x: E.bx, z: E.bz, r: E.br, id: 'E', name: 'Vertolyot rampasi' };
export const evacPhaseNow = () => (EV ? EV.ph : '');
export const evacState = () => EV;   // (sinovlar uchun)
