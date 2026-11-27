import * as THREE from '../lib/three.module.js';
import { rbox } from './gfx.js';
import { STEP_H } from './world.js';
import { VEH_STATS } from './shared.mjs';
import { attachVeh, vehModelFor } from './vehskin.js';

// roles — har bir o'rinning vazifasi; sit — o'tirgan holat; show — yopiq transportda ham tashqaridan ko'rinadigan o'rinlar
// zones — oyna/ochiq eshik zonalari [o'rin, x0,y0,z0, x1,y1,z1] (korpus koordinatasida): shu yerga tekkan o'q
//         transportga emas, o'sha o'rindagi odamga tegadi. body — korpus qutisi (o'q avval korpusga tegsa, oyna hisoblanmaydi).
// fly / car / tank — harakat turi va uning parametrlari.
// walk — ichida piyoda yursa bo'ladigan transport: qutilar [x0,y0,z0, x1,y1,z1] korpus koordinatasida (devor, pol, rampa pog'onalari).
export const BURN_AT = 0.3;   // joni shu ulushdan pastga tushgan transport yonadi (yer transporti yurmay qoladi)
export const VTYPES = {
  heli: {
    name: 'Hujumchi vertolyot', r: 2.3, box: [2.6, 3.0, 5.6], boxOff: -0.5, camDist: 14, camH: 2.4, enterR: 5.5, enclosed: true,
    // 2 va 3-o'rinlar — ochiq eshik oldidagi yo'lovchilar: ular o'z qurolidan otadi (chap va o'ng tomonga)
    seatNames: ['uchuvchi', "o'ng bort o'qchisi", "chap eshik (o'z quroli)", "o'ng eshik (o'z quroli)"], roles: ['pilot', 'gunner', 'pass', 'pass'], sit: [true, false, true, true], show: [true, true, true, true],
    fly: { maxH: 24, maxV: 9, turn: 2.0, acc: 1.4 }, rockets: 12, rocketReload: 15,
    body: [-1.0, 0.7, -1.9, 1.0, 2.4, 2.0],
    zones: [[0, -0.85, 1.2, 2.0, 0.85, 2.4, 3.5], [1, -1.4, 1.15, -0.55, -0.95, 2.15, 0.4], [2, 0.95, 1.15, -1.0, 1.4, 2.15, 0.4], [3, -1.4, 1.15, -1.9, -0.95, 2.15, -0.55]],
  },
  chinook: {
    name: 'Chinuk', r: 3.0, box: [3.4, 5.0, 9.6], boxOff: 0, camDist: 20, camH: 3.6, enterR: 7.5, enclosed: true,
    seatNames: ['uchuvchi', 'ikkinchi uchuvchi', "chap bort o'qchisi", "o'ng bort o'qchisi", "yo'lovchi", "yo'lovchi"],
    // 'rider' — yuk bo'limida o'tirgan yo'lovchi: quroldan otmaydi (yopiq korpus ichidan devor orqali o'q uzib bo'lmaydi); o'rnidan turib, rampa oldida otsa bo'ladi
    roles: ['pilot', 'copilot', 'gunner', 'gunner', 'rider', 'rider'], sit: [true, true, false, false, true, true], show: [true, true, true, true, false, false],
    fly: { maxH: 17, maxV: 7, turn: 1.3, acc: 1.0 },
    body: [-1.4, 0.8, -4.25, 1.4, 3.2, 3.9],
    zones: [[0, 0, 1.55, 3.9, 1.2, 2.85, 5.3], [1, -1.2, 1.55, 3.9, 0, 2.85, 5.3], [2, 1.35, 1.45, 1.6, 1.8, 2.75, 2.8], [3, -1.8, 1.45, 1.6, -1.35, 2.75, 2.8]],
    walk: {
      cabin: [-1.28, 0.8, -4.25, 1.28, 3.2, 3.9],   // yuk bo'limi: shu hajmda turgan piyoda "ichkarida"
      boxes: [
        [-1.4, 0, -4.25, 1.4, 0.8, 3.9],            // pol va uning osti
        [-1.4, 0, 3.9, 1.4, 3.3, 5.6],              // uchuvchilar kabinasi (yurib kirib bo'lmaydi)
        [-1.15, 0, -6.5, 1.15, 0.2, -5.75], [-1.15, 0, -5.75, 1.15, 0.4, -5.0], [-1.15, 0, -5.0, 1.15, 0.6, -4.25],   // orqa rampa (pog'onalar)
        [1.28, 0.8, -4.25, 1.4, 3.2, 1.6], [1.28, 0.8, 1.6, 1.4, 1.45, 2.8], [1.28, 2.75, 1.6, 1.4, 3.2, 2.8], [1.28, 0.8, 2.8, 1.4, 3.2, 3.9],        // chap devor (o'qchi eshigi bilan)
        [-1.4, 0.8, -4.25, -1.28, 3.2, 1.6], [-1.4, 0.8, 1.6, -1.28, 1.45, 2.8], [-1.4, 2.75, 1.6, -1.28, 3.2, 2.8], [-1.4, 0.8, 2.8, -1.28, 3.2, 3.9],  // o'ng devor
        [-1.4, 3.2, -4.25, 1.4, 3.4, 3.9],          // shift
        [1.4, 0.75, -3.4, 2.02, 1.65, 3.0], [-2.02, 0.75, -3.4, -1.4, 1.65, 3.0],   // yon baklar
      ],
      // havoda o'rindiqdan turganda yuk bo'limida paydo bo'ladigan joylar (o'rin bo'yicha)
      stand: [[0.5, 0.8, 3.2], [-0.5, 0.8, 3.2], [0.6, 0.8, 2.2], [-0.6, 0.8, 2.2], [0.5, 0.8, -1.0], [-0.5, 0.8, -1.0]],
    },
  },
  jeep: {
    name: 'Jip', r: 1.35, box: [2.0, 1.15, 4.2], boxOff: 0, camDist: 8, camH: 1.8, enterR: 4.2,
    seatNames: ['haydovchi', 'pulemyotchi'], roles: ['driver', 'gunner'], sit: [true, false],
    car: { max: 18, rev: 7, acc: 13, steer: 1.7, wheelR: 0.42 },
  },
  quad: {
    name: 'Kvadrotsikl', r: 0.85, box: [1.25, 1.05, 2.1], boxOff: 0, camDist: 6, camH: 1.5, enterR: 3.4,
    seatNames: ['haydovchi', "yo'lovchi"], roles: ['driver', 'pass'], sit: [true, true],
    car: { max: 25, rev: 6, acc: 19, steer: 2.4, wheelR: 0.3 },
  },
  // bulletMul / explMul — zirh: oddiy o'q deyarli ta'sir qilmaydi, portlash kuchsizroq ta'sir qiladi.
  // tank.rearMul — orqa zirh yupqa: yonish darajasigacha oddiy o'q ham shu ko'paytuvchi bilan ta'sir qiladi.
  tank: {
    name: "Og'ir tank", r: 2.0, box: [3.3, 2.4, 6.4], boxOff: 0, camDist: 11, camH: 3.0, enterR: 5.2, enclosed: true, bulletMul: 0.08, explMul: 0.7,
    seatNames: ["haydovchi-to'pchi", 'komandir pulemyoti'], roles: ['driver', 'gunner'], sit: [true, false], show: [true, true],
    tank: { max: 9, rev: 4.5, acc: 7, turn: 0.95, turret: 1.5, eyeY: 2.85, pivotY: 1.95, turretZ: 0.2, barBase: 1.6, barLen: 3.85, mgX: 0.3, gun: 'tshell', reload: 3.0, rearMul: 0.5, trackX: 1.42 },
  },
  ltank: {
    name: 'Yengil tank', r: 1.7, box: [2.8, 2.1, 5.4], boxOff: 0, camDist: 9.5, camH: 2.6, enterR: 4.8, enclosed: true, bulletMul: 0.14, explMul: 0.85,
    seatNames: ["haydovchi-to'pchi", 'komandir pulemyoti'], roles: ['driver', 'gunner'], sit: [true, false], show: [true, true],
    tank: { max: 14, rev: 6, acc: 11, turn: 1.4, turret: 2.2, eyeY: 2.42, pivotY: 1.7, turretZ: -0.3, barBase: 1.0, barLen: 3.0, mgX: 0.22, gun: 'lshell', reload: 1.3, rearMul: 0.6, trackX: 1.18 },
  },
  // Kamaz: kabinada haydovchi va yo'lovchi; ochiq kuzovga orqa zinadan yurib chiqiladi (u yerda o'z qurolingiz bilan otasiz).
  // openHull — o'q va granatalar AABB qutisiga emas, kuzovning haqiqiy shakliga (walk.boxes) tegadi: bortdan baland turgan odamga o'q tegadi.
  truck: {
    name: 'Kamaz', r: 1.7, box: [2.6, 2.95, 8.4], boxOff: -0.3, camDist: 13, camH: 3.0, enterR: 6.2, enclosed: true, openHull: true,
    seatNames: ['haydovchi', "yo'lovchi (kabinada)"], roles: ['driver', 'pass'], sit: [true, true], show: [true, true],
    car: { max: 15, rev: 5, acc: 7.5, steer: 1.05, wheelR: 0.55, front: 3.9, hitR: 2.0 },
    body: [-1.25, 0.9, 1.3, 1.25, 2.9, 3.7],
    zones: [[0, 0, 1.95, 3.55, 1.2, 2.75, 3.9], [1, -1.2, 1.95, 3.55, 0, 2.75, 3.9], [0, 1.15, 1.95, 1.9, 1.4, 2.7, 3.1], [1, -1.4, 1.95, 1.9, -1.15, 2.7, 3.1]],
    walk: {
      boxes: [
        [-1.25, 0, -3.6, 1.25, 1.3, 1.15],                                       // kuzov poli va uning osti
        [-1.3, 0, 1.15, 1.3, 2.95, 3.85],                                        // kabina (yurib kirib bo'lmaydi)
        [-1.0, 0, -4.5, 1.0, 0.45, -4.05], [-1.0, 0, -4.05, 1.0, 0.88, -3.6],    // orqa zina (ikki pog'ona)
        [1.17, 1.3, -3.6, 1.25, 1.85, 1.15], [-1.25, 1.3, -3.6, -1.17, 1.85, 1.15],   // yon bortlar
        [-1.25, 1.3, 1.07, 1.25, 2.1, 1.15],                                     // old bort
      ],
    },
  },
  cannon: {
    // shield — qalqon: stvol qaragan tomondan (shu burchak ichida) kelgan o'q to'pchiga emas, pushkaga tegadi
    name: 'Zenit pushkasi', r: 1.0, box: [1.7, 0.95, 1.7], boxOff: 0, camDist: 5.5, camH: 2.2, enterR: 3.6, bulletMul: 0.3, explMul: 0.6, shield: 1.2,
    seatNames: ["to'pchi"], roles: ['driver'], sit: [false],
  },
};

// jon (hp) va o'rinlar soni (seats) server bilan umumiy jadvaldan olinadi
for (const k in VTYPES) Object.assign(VTYPES[k], VEH_STATS[k]);

// O'rindiqlar (oyoq nuqtasi), o'qchining ko'zi va chiqish joylari — transportning mahalliy koordinatasida
const SEAT_POS = {
  heli: [[0, 0.8, 2.3], [-0.7, 0.75, -0.1], [0.72, 0.75, -0.3], [-0.72, 0.75, -1.25]],
  chinook: [[0.6, 1.3, 4.35], [-0.6, 1.3, 4.35], [1.0, 0.8, 2.2], [-1.0, 0.8, 2.2], [0.9, 0.8, -1.0], [-0.9, 0.8, -1.0]],
  // tank: haydovchi old lyukdan boshini chiqarib o'tiradi, komandir minora lyukida beligacha chiqib turadi (tashqaridan ko'rinadi)
  tank: [[0.78, 0.75, 2.2], [0, 1.3, -0.4]],
  ltank: [[0.62, 0.38, 1.7], [0, 0.85, -0.5]],
  jeep: [[0.45, 0.55, -0.15], [0, 0.75, -1.55]],
  quad: [[0, 0.45, -0.05], [0, 0.5, -0.6]],
  truck: [[0.62, 1.35, 2.3], [-0.62, 1.35, 2.3]],
};
// 1-shaxs ko'rinishidagi ko'z nuqtasi (korpus koordinatasida; korpus egilsa, ko'z ham u bilan birga egiladi).
// Bu yerda yo'q o'rinlar (o'qchilar) GUN_POS dan foydalanadi; tank haydovchisi va zenit pushkasi alohida hisoblanadi.
const EYE_POS = {
  heli: { 0: [0, 1.95, 2.5], 2: [1.02, 1.8, -0.3], 3: [-1.02, 1.8, -1.25] },
  chinook: { 0: [0.6, 2.4, 4.5], 1: [-0.6, 2.4, 4.5], 4: [0.9, 1.9, -1.0], 5: [-0.9, 1.9, -1.0] },
  jeep: { 0: [0.45, 1.62, -0.2] },
  quad: { 0: [0, 1.55, -0.15], 1: [0, 1.72, -0.7] },
  truck: { 0: [0.62, 2.45, 2.6], 1: [-0.62, 2.45, 2.6] },
};
const GUN_POS = {
  heli: { 1: [-1.25, 1.75, -0.2] },
  chinook: { 2: [1.65, 2.25, 2.2], 3: [-1.65, 2.25, 2.2] },
  tank: { 1: [0, 3.05, 0.1] },
  ltank: { 1: [0, 2.7, -0.3] },
  jeep: { 1: [0, 2.3, -1.5] },
};
const EXIT_POS = {
  heli: [[2.4, 0, 0.5], [-2.4, 0, 0.5], [2.4, 0, -0.8], [-2.4, 0, -1.6]],
  chinook: [[3.0, 0, 3.6], [-3.0, 0, 3.6], [3.0, 0, 2.0], [-3.0, 0, 2.0], [0.7, 0, -7.2], [-0.7, 0, -7.2]],
  tank: [[2.9, 0, -0.3], [-2.9, 0, -0.3]],
  ltank: [[2.5, 0, -0.3], [-2.5, 0, -0.3]],
  jeep: [[1.9, 0, -0.3], [-1.9, 0, -0.3]],
  quad: [[1.3, 0, 0], [-1.3, 0, -0.4]],
  truck: [[2.3, 0, 2.4], [-2.3, 0, 2.4]],
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _l = new THREE.Vector3();
const _inv = new THREE.Matrix4(), _ray = new THREE.Ray(), _zb = new THREE.Box3();

// ---------- Pulemyot qizishi ----------
// heat 0..1; 1 ga yetsa "hot" — sovumaguncha otib bo'lmaydi
export function newGun() { return { heat: 0, hot: false, idle: 9 }; }
export function gunFire(g, per) {
  if (g.hot) return false;
  g.heat = Math.min(1, g.heat + per); g.idle = 0;
  if (g.heat >= 1) g.hot = true;
  return true;
}
export function gunCool(g, dt) {
  g.idle += dt;
  if (g.idle > 0.35) g.heat = Math.max(0, g.heat - dt * (g.hot ? 0.3 : 0.24));
  if (g.hot && g.heat <= 0.25) g.hot = false;
}

export class Vehicle {
  constructor(game, id, type, x, z, yaw, skinDef) {   // skinDef — boshqa model ko'rinishi (berilmasa — turga mos model)
    this.g = game; this.id = id; this.type = type; this.T = VTYPES[type];
    this.spawn = { x, z, yaw };
    this.pos = new THREE.Vector3(x, 0, z); this.vel = new THREE.Vector3();
    this.yaw = yaw; this.pitch = 0; this.roll = 0; this.aimYaw = yaw; this.aimPitch = 0;
    this.hp = this.T.hp; this.alive = true; this.seats = new Array(this.T.seats).fill(null); this.owner = null;
    this.onGround = true; this.speed = 0; this.rotor = 0; this.respT = 0; this.pod = 0; this.smokeT = 0;
    this.rockets = this.T.rockets || 0; this.rocketReload = 0; this.gun = newGun();
    // Zombi rejimi: yoqilg'i (0..1) va o'q-dori cheklangan. a — uchuvchi/tank pulemyoti, b — snaryadlar, d — bort (o'qchi) pulemyoti
    this.limited = !!game.zombie; this.fuel = 1; this.ammo = this.fullAmmo();
    this.trackBroken = 0;   // bit 0 — chap (+x) gusenitsa uzilgan, bit 1 — o'ng (−x)
    this.lastPos = this.pos.clone(); this.lastYaw = yaw; this.dPos = new THREE.Vector3(); this.dYaw = 0;   // kadr ichidagi siljish (ustida turgan piyodani ko'chirish uchun)
    this.net = { pos: this.pos.clone(), yaw, pitch: 0, roll: 0, ay: yaw, ap: 0, has: false };
    this.box = new THREE.Box3(); this.box.vehicle = this;
    this.fpHide = [];   // o'qchining o'z ko'rinishida yashiriladigan qismlar (kamerani to'sib qo'ymasligi uchun)
    this.trackMesh = [[], []]; this.trackDrop = [];
    this.build();
    this.skinDef = skinDef !== undefined ? skinDef : vehModelFor(type, game.era); this.skin = null; this.tk = null;   // haqiqiy model (vehskin.js) — yuklangach ulanadi
    this.skinUp();
    this.updateBox();
    game.world.addBox(this.box);
    this.visual(0);
  }

  // modelni ulash (yuklanmagan bo'lsa — keyingi kadrlarda qayta uriniladi); jipdagi pulemyot kodda qurilgani bilan qoladi
  skinUp() { if (this.skinDef && !this.skin) attachVeh(this, this.skinDef, [this.mgG]); }
  get burning() { return this.alive && this.hp <= this.T.hp * BURN_AT; }
  get noFuel() { return this.limited && this.fuel <= 0; }
  // Yer transporti yonayotgan, gusenitsasi uzilgan yoki yoqilg'isi tugagan bo'lsa yurmaydi (minora va qurol ishlaydi)
  get immobile() { return !!(this.T.tank || this.T.car) && (this.burning || this.trackBroken !== 0 || this.noFuel); }
  fullAmmo() {
    const t = this.type;
    return { a: t === 'heli' ? 500 : this.T.tank ? 400 : 0, b: t === 'tank' ? 14 : t === 'ltank' ? 24 : t === 'cannon' ? 40 : 0, d: t === 'heli' || t === 'chinook' || t === 'jeep' || this.T.tank ? 300 : 0 };
  }
  // Yoqilg'i va o'q-dorini k ulushga to'ldirish (punktga yetib kelinganda)
  refill(k) {
    const F = this.fullAmmo();
    this.fuel = Math.min(1, this.fuel + k);
    for (const key of ['a', 'b', 'd']) this.ammo[key] = Math.min(F[key], this.ammo[key] + Math.ceil(F[key] * k));
    if (this.T.rockets) this.rockets = Math.min(this.T.rockets, this.rockets + Math.ceil(this.T.rockets * k));
  }

  build() {
    const H = this.g.era === 'historical', type = this.type;
    const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7, metalness: 0.3 }, o));
    // har bir tur o'z rangida — uzoqdan adashtirmaslik uchun
    const colors = {
      heli: H ? 0x4f5a3a : 0x3d4347, chinook: H ? 0x8a8a5c : 0xb09a6a, jeep: H ? 0x525a3c : 0x8c7c5a, quad: H ? 0x6a3a2a : 0x2f5a7a,
      tank: H ? 0x525a3c : 0x8c7c5a, ltank: H ? 0x6b7468 : 0x5f6b45, cannon: H ? 0x525a3c : 0x8c7c5a, truck: H ? 0x3f4a30 : 0xa08a5e,
    };
    const body = M(colors[type]);
    const dark = M(0x1b1d1f, { roughness: 0.6, metalness: 0.5 });
    const glass = M(0x2a3a48, { roughness: 0.15, metalness: 0.8, transparent: true, opacity: 0.55 });
    const lit = M(0x9fe8c0, { emissive: 0x2f8f5f, roughness: 0.4 });   // asboblar shkalasi
    const warn = M(0xffb060, { emissive: 0x9a4a10, roughness: 0.4 });
    const panel = M(0x2a2d31, { roughness: 0.85, metalness: 0.1 });
    const root = (this.root = new THREE.Group());
    const hull = (this.hull = new THREE.Group()); root.add(hull);
    const box = (w, h, d, m, x, y, z, parent = hull) => {
      const me = new THREE.Mesh(rbox(w, h, d), m);   // qirralari yumaloqlangan (gfx.js)
      me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me;
    };
    const cyl = (r1, r2, len, m, x, y, z, axis, parent = hull, seg = 12) => {
      const g = new THREE.CylinderGeometry(r1, r2, len, seg);
      if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(Math.PI / 2);
      const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me;
    };
    if (type === 'heli') {
      box(2.0, 1.7, 4.2, body, 0, 1.55, 0.2);
      box(1.7, 1.15, 1.5, glass, 0, 1.8, 2.75);
      box(1.6, 0.75, 1.5, body, 0, 1.05, 2.75);
      box(0.45, 0.5, 4.6, body, 0, 1.95, -4.1);
      box(0.12, 1.6, 0.9, body, 0, 2.7, -6.1);
      box(1.7, 0.08, 0.6, body, 0, 2.05, -5.7);
      box(0.9, 0.5, 1.8, dark, 0, 2.62, 0);
      cyl(0.09, 0.09, 0.5, dark, 0, 3.05, 0, 'y');
      this.rotorG = new THREE.Group(); this.rotorG.position.set(0, 3.3, 0); hull.add(this.rotorG);
      box(11.5, 0.05, 0.42, dark, 0, 0, 0, this.rotorG); box(0.42, 0.05, 11.5, dark, 0, 0, 0, this.rotorG);
      this.tailG = new THREE.Group(); this.tailG.position.set(0.22, 2.75, -6.15); hull.add(this.tailG);
      box(0.05, 1.9, 0.2, dark, 0, 0, 0, this.tailG); box(0.05, 0.2, 1.9, dark, 0, 0, 0, this.tailG);
      for (const s of [-1, 1]) {
        box(0.12, 0.1, 4.4, dark, s * 1.05, 0.05, 0.3);
        box(0.08, 0.75, 0.08, dark, s * 1.05, 0.42, 1.4); box(0.08, 0.75, 0.08, dark, s * 1.05, 0.42, -0.9);
        cyl(0.27, 0.27, 1.7, dark, s * 1.65, 1.2, 0.5, 'z');
        box(0.05, 1.0, 1.4, dark, s * 1.01, 1.65, -0.3);
      }
      box(3.7, 0.12, 0.8, body, 0, 1.38, 0.3);
      box(0.18, 0.18, 0.9, dark, 0, 0.72, 3.3);
      this.fpHide.push(box(0.08, 0.08, 1.0, dark, -1.3, 1.5, -0.1));
      // kabina ichi (1-shaxs ko'rinishida ko'rinadi): asboblar paneli, dasta, oyna ramkasi
      const pn = box(1.3, 0.32, 0.1, panel, 0, 1.52, 3.12); pn.rotation.x = -0.45;
      for (let i = 0; i < 4; i++) box(0.17, 0.17, 0.02, lit, -0.48 + i * 0.32, 0.02, -0.056, pn);
      for (let i = 0; i < 6; i++) box(0.05, 0.035, 0.02, i % 2 ? warn : lit, -0.4 + i * 0.16, -0.115, -0.056, pn);
      box(0.04, 0.42, 0.04, dark, 0, 1.2, 2.72); box(0.06, 1.15, 0.06, dark, 0, 1.8, 3.49);
      box(1.7, 0.06, 0.06, dark, 0, 2.37, 3.49);
    } else if (type === 'chinook') {
      // Og'ir transport vertolyot. Korpus ichi bo'sh: pol, devorlar va shift alohida — orqa rampadan yurib kirsa bo'ladi.
      const inner = M(H ? 0x5a5a40 : 0x6f6348, { roughness: 0.9 });
      box(2.8, 0.66, 8.15, body, 0, 0.47, -0.175);            // pol va korpus osti
      box(2.8, 0.14, 8.15, body, 0, 3.27, -0.175);            // shift
      for (const s of [-1, 1]) {
        box(0.12, 2.4, 5.85, body, s * 1.34, 2.0, -1.325);    // devor (orqa qism)
        box(0.12, 0.65, 1.2, body, s * 1.34, 1.125, 2.2);     // o'qchi eshigi osti
        box(0.12, 0.45, 1.2, body, s * 1.34, 2.975, 2.2);     // eshik usti
        box(0.12, 2.4, 1.1, body, s * 1.34, 2.0, 3.35);       // devor (old qism)
        box(0.34, 0.38, 4.6, inner, s * 1.08, 0.99, -1.6);    // ichki o'rindiqlar
        box(0.6, 0.85, 6.4, body, s * 1.72, 1.2, -0.2);       // yon baklar
        cyl(0.42, 0.42, 1.9, dark, s * 1.15, 3.6, -3.7, 'z');
        cyl(0.4, 0.4, 0.3, dark, s * 1.72, 0.4, 3.0, 'x', hull, 12); cyl(0.4, 0.4, 0.3, dark, s * 1.72, 0.4, -2.9, 'x', hull, 12);
        for (const wz of [0.4, -0.9, -2.2]) box(0.02, 0.5, 0.5, dark, s * 1.405, 2.5, wz);
        this.fpHide.push(box(0.9, 0.08, 0.08, dark, s * 1.85, 2.05, 2.2));
      }
      box(2.56, 2.4, 0.1, inner, 0, 2.0, 3.85);               // yuk bo'limi va kabina orasidagi to'siq
      box(2.8, 0.5, 0.12, body, 0, 2.95, -4.2);               // orqa eshik tepasi
      box(2.4, 1.3, 1.4, glass, 0, 2.2, 4.6);
      box(2.4, 0.85, 1.4, body, 0, 1.22, 4.6);
      box(2.0, 0.5, 0.5, body, 0, 1.1, 5.4);
      const pn = box(2.1, 0.34, 0.1, panel, 0, 1.78, 5.02); pn.rotation.x = -0.4;   // asboblar paneli
      for (let i = 0; i < 6; i++) box(0.18, 0.18, 0.02, lit, -0.85 + i * 0.34, 0.03, -0.056, pn);
      for (let i = 0; i < 10; i++) box(0.05, 0.035, 0.02, i % 3 ? lit : warn, -0.9 + i * 0.2, -0.12, -0.056, pn);
      box(0.06, 1.3, 0.06, dark, 0, 2.2, 5.29); box(0.3, 0.5, 0.9, dark, 0, 1.45, 4.5);   // o'rta ustun va konsol
      box(1.5, 0.9, 2.4, body, 0, 3.75, 3.1);
      box(1.5, 1.8, 2.8, body, 0, 4.2, -3.2);
      const ramp = box(2.3, 0.1, 2.4, dark, 0, 0.38, -5.375); ramp.rotation.x = -0.33;   // ochiq orqa rampa
      const blades = (g) => { for (let i = 0; i < 3; i++) { const b = box(0.4, 0.05, 4.9, dark, 0, 0, 0, g); b.rotation.y = (i / 3) * Math.PI * 2; b.translateZ(2.45); } cyl(0.25, 0.25, 0.3, dark, 0, 0, 0, 'y', g); };
      cyl(0.12, 0.12, 0.5, dark, 0, 4.4, 3.1, 'y'); cyl(0.12, 0.12, 0.5, dark, 0, 5.3, -3.2, 'y');
      this.rotorG = new THREE.Group(); this.rotorG.position.set(0, 4.65, 3.1); hull.add(this.rotorG); blades(this.rotorG);
      this.rotorG2 = new THREE.Group(); this.rotorG2.position.set(0, 5.55, -3.2); this.rotorG2.rotation.y = Math.PI / 3; hull.add(this.rotorG2); blades(this.rotorG2);
    } else if (type === 'jeep') {
      box(1.9, 0.5, 4.0, body, 0, 0.78, 0);
      box(1.8, 0.35, 1.3, body, 0, 1.18, 1.3);
      box(1.8, 0.6, 0.06, glass, 0, 1.62, 0.62);
      box(1.84, 0.06, 0.08, body, 0, 1.94, 0.62);
      for (const s of [-1, 1]) {
        box(0.6, 0.5, 0.6, dark, s * 0.45, 1.05, -0.15);
        box(0.08, 0.38, 1.9, body, s * 0.92, 1.2, -1.0);
        box(0.25, 0.14, 0.1, M(0xfff2c0, { emissive: 0x554422 }), s * 0.65, 1.1, 2.0);
      }
      box(1.9, 0.5, 0.1, body, 0, 1.22, -1.96);
      box(2.0, 0.16, 0.16, dark, 0, 0.6, 2.05);
      this.wheels = [];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.wheels.push(cyl(0.42, 0.42, 0.3, dark, sx * 0.98, 0.42, sz * 1.35, 'x', hull, 14));
      cyl(0.4, 0.4, 0.25, dark, 0, 1.3, -2.15, 'z');
      box(0.1, 0.85, 0.1, dark, 0, 1.45, -1.2);
      this.mgG = new THREE.Group(); this.mgG.position.set(0, 2.0, -1.2); hull.add(this.mgG);
      this.fpHide.push(this.mgG);
      box(0.1, 0.12, 1.1, dark, 0, 0, 0.3, this.mgG); box(0.16, 0.14, 0.2, dark, -0.12, -0.02, 0.1, this.mgG);
      // asboblar paneli va rul
      box(1.7, 0.2, 0.14, panel, 0, 1.36, 0.5); box(0.14, 0.1, 0.02, lit, 0.45, 1.4, 0.42); box(0.1, 0.1, 0.02, lit, 0.2, 1.4, 0.42);
      const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 16), dark); sw.position.set(0.45, 1.42, 0.28); sw.rotation.x = -0.35; hull.add(sw);
      box(0.04, 0.04, 0.3, dark, 0.45, 1.36, 0.4);
    } else if (type === 'truck') {
      // Kamaz: kapotsiz kabina, uch o'qli shassi, ochiq bortli kuzov va tent yoylari
      const plank = M(H ? 0x5c4a30 : 0x6e5c3e, { roughness: 0.92, metalness: 0 });
      box(1.0, 0.3, 7.9, dark, 0, 0.95, -0.2);                                      // rama
      box(2.5, 1.0, 2.4, body, 0, 1.4, 2.5);                                        // kabina pastki qismi
      box(2.5, 1.0, 0.1, body, 0, 2.4, 1.35);                                       // kabina orqa devori
      box(2.5, 0.12, 2.4, body, 0, 2.95, 2.5);                                      // tom
      box(2.36, 0.9, 0.06, glass, 0, 2.4, 3.67);                                    // old oyna
      box(0.06, 0.9, 0.06, dark, 0, 2.4, 3.69);
      for (const sd of [-1, 1]) {
        box(0.06, 0.8, 1.25, glass, sd * 1.22, 2.36, 2.5);                          // eshik oynasi
        box(0.1, 1.0, 0.14, body, sd * 1.2, 2.4, 3.62); box(0.1, 1.0, 0.45, body, sd * 1.2, 2.4, 1.62);   // ustunlar
        box(0.02, 0.06, 0.3, dark, sd * 1.26, 1.7, 2.9);                            // eshik tutqichi
        box(0.34, 0.2, 0.08, M(0xfff2c0, { emissive: 0x554422 }), sd * 0.85, 1.2, 3.72);
        box(0.06, 0.42, 0.26, dark, sd * 1.45, 2.3, 3.5); box(0.22, 0.04, 0.04, dark, sd * 1.34, 2.45, 3.5);     // yon ko'zgu
        box(0.5, 0.5, 1.2, dark, sd * 0.98, 0.9, 0.35);                             // yoqilg'i baki
        box(0.45, 0.06, 1.3, dark, sd * 1.05, 1.05, 2.6);                           // old g'ildirak qanoti
        box(0.4, 0.06, 2.9, dark, sd * 1.05, 1.16, -2.15);                          // orqa g'ildiraklar qanoti
      }
      box(2.2, 0.55, 0.06, dark, 0, 1.55, 3.71);                                    // radiator panjarasi
      for (let i = 0; i < 4; i++) box(2.1, 0.04, 0.02, body, 0, 1.36 + i * 0.13, 3.745);
      box(2.6, 0.3, 0.26, dark, 0, 0.75, 3.8);                                      // bamper
      cyl(0.07, 0.07, 1.7, dark, -1.1, 2.3, 1.22, 'y');                             // tutun trubasi
      // kabina ichi
      box(2.3, 0.3, 0.34, panel, 0, 2.02, 3.45);
      for (let i = 0; i < 3; i++) box(0.16, 0.14, 0.02, lit, 0.36 + i * 0.22, 2.08, 3.27);
      const sw = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.024, 6, 18), dark); sw.position.set(0.62, 2.08, 3.12); sw.rotation.x = -0.55; hull.add(sw);
      box(0.05, 0.05, 0.3, dark, 0.62, 2.0, 3.26);
      // kuzov: pol, bortlar, tent yoylari
      box(2.5, 0.16, 4.75, plank, 0, 1.22, -1.225);
      for (const sd of [-1, 1]) {
        box(0.08, 0.55, 4.75, body, sd * 1.21, 1.575, -1.225);
        for (let i = 0; i < 5; i++) box(0.05, 0.6, 0.1, dark, sd * 1.27, 1.56, -3.45 + i * 1.1);
        box(0.3, 0.06, 4.4, plank, sd * 0.98, 1.72, -1.2);                          // o'tirg'ich taxtasi
      }
      box(2.5, 0.8, 0.08, body, 0, 1.7, 1.11);
      // tent yoylari bosh ustidan ancha baland turadi — kuzovda tik turgan odamning ko'rishini to'smaydi
      for (let i = 0; i < 3; i++) { const hz = -3.45 + i * 2.2; for (const sd of [-1, 1]) box(0.06, 1.75, 0.06, dark, sd * 1.21, 2.72, hz); box(2.48, 0.06, 0.06, dark, 0, 3.6, hz); }
      for (const sd of [-1, 1]) box(0.05, 0.05, 4.46, dark, sd * 1.21, 3.6, -1.25);
      // pastga tushirilgan orqa bort va zina
      box(2.4, 0.5, 0.08, body, 0, 1.0, -3.64);
      box(2.0, 0.08, 0.45, dark, 0, 0.84, -3.825); box(2.0, 0.08, 0.45, dark, 0, 0.41, -4.275);
      for (const sd of [-1, 1]) { box(0.06, 0.9, 0.06, dark, sd * 1.0, 0.45, -4.47); box(0.06, 0.06, 0.9, dark, sd * 1.0, 0.86, -4.05); }
      this.wheels = [];
      for (const sx of [-1, 1]) for (const wz of [2.6, -1.5, -2.8]) {
        this.wheels.push(cyl(0.55, 0.55, 0.36, dark, sx * 1.08, 0.55, wz, 'x', hull, 16));
        cyl(0.24, 0.24, 0.38, body, sx * 1.08, 0.55, wz, 'x', hull, 10);
      }
    } else if (type === 'quad') {
      box(0.7, 0.34, 1.5, body, 0, 0.62, 0);
      box(0.78, 0.26, 0.55, body, 0, 0.86, 0.6);
      box(0.5, 0.2, 0.95, dark, 0, 0.9, -0.25);
      box(0.06, 0.32, 0.06, dark, 0, 1.08, 0.48); box(0.9, 0.05, 0.06, dark, 0, 1.24, 0.45);
      box(0.62, 0.04, 0.42, dark, 0, 0.84, -0.88);
      box(0.2, 0.12, 0.08, M(0xfff2c0, { emissive: 0x554422 }), 0, 0.92, 0.9);
      this.wheels = [];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        this.wheels.push(cyl(0.3, 0.3, 0.28, dark, sx * 0.52, 0.3, sz * 0.7, 'x', hull, 12));
        box(0.3, 0.05, 0.62, body, sx * 0.52, 0.66, sz * 0.7);
      }
    } else if (this.T.tank) {
      const hv = type === 'tank';
      // og'ir va yengil tank o'lchamlari
      const D = hv ? { hw: 3.1, hh: 0.9, hl: 6.2, hy: 1.05, tw: 0.62, th: 0.95, tl: 6.5, wn: 6, wz0: -2.6, wdz: 1.04, turW: 2.1, turH: 0.75, turL: 2.6, turY: 1.5, barY: 0.45, barL: 3.6, barR: 0.1 }
        : { hw: 2.45, hh: 0.75, hl: 5.0, hy: 0.95, tw: 0.5, th: 0.85, tl: 5.2, wn: 5, wz0: -2.0, wdz: 1.0, turW: 1.6, turH: 0.6, turL: 1.9, turY: 1.32, barY: 0.38, barL: 2.85, barR: 0.062 };
      const K = this.T.tank, tx = K.trackX;
      const wheel = M(0x34362f, { roughness: 0.8 });
      box(D.hw, D.hh, D.hl, body, 0, D.hy, 0);
      if (hv) { box(2.7, 0.3, 1.5, body, 0, 1.6, 2.1); box(1.2, 0.28, 1.0, dark, 0, 1.62, -2.4); box(0.5, 0.3, 0.5, dark, 1.0, 1.62, -2.6); }
      else {
        const gl = box(D.hw, 0.1, 1.5, body, 0, 1.2, 2.0); gl.rotation.x = 0.42;                // qiya old zirh
        box(1.6, 0.22, 1.1, dark, 0, 1.42, -1.9);                                              // dvigatel panjarasi
        box(0.05, 1.5, 0.05, dark, -0.9, 2.1, -2.2);                                           // antenna
        for (const s of [-1, 1]) box(0.08, 0.5, 4.4, body, s * (tx + 0.3), 0.95, 0);            // yon ekranlar
      }
      for (const s of [-1, 1]) {
        const side = s > 0 ? 0 : 1;
        this.trackMesh[side].push(box(D.tw, D.th, D.tl, dark, s * tx, D.th / 2 + 0.01, 0));     // gusenitsa lentasi
        box(D.tw + 0.12, 0.1, D.tl - 0.4, body, s * tx, D.th + 0.07, 0);
        for (let i = 0; i < D.wn; i++) cyl(0.4 * (hv ? 1 : 0.85), 0.4 * (hv ? 1 : 0.85), 0.08, wheel, s * (tx + D.tw / 2 + 0.02), 0.44, D.wz0 + i * D.wdz, 'x', hull, 10);
        box(0.3, 0.16, 0.12, M(0xfff2c0, { emissive: 0x554422 }), s * (D.hw / 2 - 0.5), D.hy + 0.25, D.hl / 2 + 0.02);
        // uzilgan gusenitsa yerda yotadi (faqat uzilganda ko'rinadi)
        const drop = box(D.tw, 0.07, D.tl * 0.75, dark, s * (tx + 1.0), 0.04, -0.6, root); drop.rotation.y = s * 0.22; drop.visible = false; drop.castShadow = false;
        this.trackDrop[side] = drop;
      }
      this.turret = new THREE.Group(); this.turret.position.set(0, D.turY, K.turretZ); hull.add(this.turret);
      box(D.turW, D.turH, D.turL, body, 0, D.turH / 2 + 0.02, 0, this.turret);
      box(D.turW * 0.7, D.turH * 0.8, 0.8, body, 0, D.turH / 2 + 0.02, D.turL / 2 + 0.2, this.turret);
      if (hv) box(1.6, 0.2, 1.8, body, 0, 0.82, -0.1, this.turret);
      else box(D.turW * 0.9, D.turH * 0.7, 0.7, body, 0, D.turH / 2, -D.turL / 2 - 0.3, this.turret);   // minora orqa qutisi
      cyl(0.34 * (hv ? 1 : 0.8), 0.34 * (hv ? 1 : 0.8), 0.14, dark, hv ? 0.5 : 0.35, D.turH + 0.2, -0.4, 'y', this.turret);
      const my = D.turH + (hv ? 0.4 : 0.3);
      this.fpHide.push(box(0.08, 0.5, 0.08, dark, -0.5, my, -0.3, this.turret), box(0.09, 0.11, 1.0, dark, -0.5, my + 0.27, 0.0, this.turret));
      this.barrel = new THREE.Group(); this.barrel.position.set(0, D.barY, K.barBase); this.turret.add(this.barrel);
      cyl(D.barR * 0.9, D.barR * 1.15, D.barL, dark, 0, 0, D.barL / 2, 'z', this.barrel, 10);
      cyl(D.barR * 1.5, D.barR * 1.5, hv ? 0.45 : 0.3, dark, 0, 0, D.barL - 0.05, 'z', this.barrel, 10);
      box(0.06, 0.06, 0.8, dark, K.mgX, 0.02, 0.5, this.barrel);
    } else {
      cyl(0.85, 1.0, 0.35, dark, 0, 0.175, 0, 'y', root, 14);
      this.turret = new THREE.Group(); this.turret.position.set(0, 0.35, 0); root.add(this.turret);
      box(1.3, 0.5, 1.0, body, 0, 0.3, 0, this.turret);
      box(0.6, 1.0, 0.08, body, -0.55, 1.05, 0.5, this.turret); box(0.6, 1.0, 0.08, body, 0.55, 1.05, 0.5, this.turret);
      box(0.5, 0.35, 0.5, dark, 0, 0.3, -0.9, this.turret);
      this.barrel = new THREE.Group(); this.barrel.position.set(0, 1.0, 0.2); this.turret.add(this.barrel);
      for (const s of [-1, 1]) { cyl(0.055, 0.065, 2.8, dark, s * 0.17, 0, 1.4, 'z', this.barrel, 10); cyl(0.09, 0.09, 0.25, dark, s * 0.17, 0, 2.8, 'z', this.barrel, 10); }
      box(0.6, 0.35, 0.8, dark, 0, 0, -0.1, this.barrel);
    }
    this.g.scene.add(root);
  }

  // Mahalliy koordinatadan dunyo koordinatasiga (egilishni hisobga olmaydi)
  local(lx, ly, lz, out, yaw = this.yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return out.set(this.pos.x + lx * c + lz * s, this.pos.y + ly, this.pos.z - lx * s + lz * c);
  }
  // Dunyo nuqtasini transportning mahalliy koordinatasiga o'tkazadi (faqat burilish, egilishsiz)
  toLocal(p, out) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return out.set(dx * c - dz * s, p.y - this.pos.y, dx * s + dz * c);
  }
  // Haqiqiy model qo'yilgan bo'lsa — uning o'z o'rindiqlari (vehskin.js: seats/guns/sit); to'rtinchi qiymat 1 — minora bilan birga aylanadi
  seatDef(tab, i) { const ov = this.skin && this.skinDef && this.skinDef[tab]; return ov ? (Array.isArray(ov) ? ov[i] || ov[0] : ov[i]) : null; }
  seatSit(i) { const ov = this.skin && this.skinDef && this.skinDef.sit; return !!(ov ? ov[i] : this.T.sit && this.T.sit[i]); }
  // yopiq transportda shu o'rindagi odam tashqaridan ko'rinadimi (model qo'yilgan tankda haydovchi ichkarida — ko'rinmaydi)
  seatShown(i) { const ov = this.skin && this.skinDef && this.skinDef.show; return !!(ov ? ov[i] : this.T.show && this.T.show[i]); }
  localSeat(s, out) {
    if (s[3] === 1 && this.T.tank) {
      this.local(0, s[1], this.T.tank.turretZ, out);
      const ca = Math.cos(this.aimYaw), sa = Math.sin(this.aimYaw);
      out.x += s[0] * ca + s[2] * sa; out.z += -s[0] * sa + s[2] * ca;
      return out;
    }
    return this.local(s[0], s[1], s[2], out);
  }
  seatPos(i, out) {
    const ov = this.seatDef('seats', i);
    if (ov) return this.localSeat(ov, out);
    const t = SEAT_POS[this.type];
    if (!t) return this.local(0, 0.1, -1.25, out, this.aimYaw);
    const s = t[i] || t[0];
    return this.local(s[0], s[1], s[2], out);
  }
  // O'qchining ko'z nuqtasi (birinchi shaxs)
  gunPos(out, seat = 1) {
    const ov = this.seatDef('guns', seat);
    if (ov) return this.localSeat(ov, out);
    const s = (GUN_POS[this.type] || {})[seat] || [0, 2.3, -1.5];
    return this.local(s[0], s[1], s[2], out);
  }
  // 1-shaxs ko'rinishi: shu o'rindagi odamning ko'zi
  eyePos(seat, out) {
    const K = this.T.tank;
    if (K && seat === 0) {
      // to'pchi minora ustidan qaraydi va minora bilan birga buriladi — stvol pastda ko'rinib turadi
      const f = 0.45;
      return out.set(this.pos.x + Math.sin(this.yaw) * K.turretZ + Math.sin(this.aimYaw) * f, this.pos.y + K.eyeY, this.pos.z + Math.cos(this.yaw) * K.turretZ + Math.cos(this.aimYaw) * f);
    }
    if (this.type === 'cannon') return this.local(0, 1.72, -0.85, out, this.aimYaw);
    const e = (EYE_POS[this.type] || {})[seat];
    if (!e) return this.gunPos(out, seat);
    this.root.updateMatrixWorld(true);
    return out.set(e[0], e[1], e[2]).applyMatrix4(this.hull.matrixWorld);
  }
  exitPos(i, out) {
    const t = EXIT_POS[this.type];
    if (!t) return this.local(0, 0, -2.2, out, this.aimYaw);
    const s = t[i] || t[0];
    return this.local(s[0], s[1], s[2], out);
  }
  // Havoda o'rindiqdan turganda yuk bo'limidagi joy (faqat ichida yursa bo'ladigan transport)
  standPos(i, out) { const s = this.T.walk.stand[i] || this.T.walk.stand[4]; return this.local(s[0], s[1], s[2], out); }
  muzzle(kind, out) {
    if (this.type === 'heli') {
      if (kind === 'mg') return this.local(0, 0.72, 3.8, out);
      this.pod ^= 1;
      return this.local(this.pod ? 1.65 : -1.65, 1.2, 1.5, out);
    }
    if (this.type === 'jeep') return this.local(0, 2.0, -0.3, out);
    const K = this.tk || this.T.tank;   // (tk — model stvoliga moslangan qiymatlar)
    if (K) {
      // minora o'z burchagida (aimYaw) aylanadi; 'mg' — juft pulemyot, aks holda asosiy pushka
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), sa = Math.sin(this.aimYaw), ca = Math.cos(this.aimYaw);
      const lx = kind === 'mg' ? K.mgX : 0, len = kind === 'mg' ? 1.0 : K.barLen, f = K.barBase + Math.cos(this.aimPitch) * len;
      return out.set(this.pos.x + sy * K.turretZ + lx * ca + f * sa, this.pos.y + K.pivotY + Math.sin(this.aimPitch) * len, this.pos.z + cy * K.turretZ - lx * sa + f * ca);
    }
    const cp = Math.cos(this.aimPitch), L = 3.0;
    this.pod ^= 1;
    this.local(this.pod ? 0.17 : -0.17, 1.35 + Math.sin(this.aimPitch) * L, 0.2 + cp * L, out, this.aimYaw);
    return out;
  }
  center(out) { return out.set(this.pos.x, this.pos.y + this.T.box[1] * 0.5, this.pos.z); }

  // ---------- Zirh zonalari ----------
  // (dx, dz) — o'q yoki snaryad UCHAYOTGAN yo'nalish. Qaytaradi: 'front' | 'side' | 'rear' va yon bo'lsa qaysi gusenitsa (bit).
  facing(dx, dz) {
    const L = Math.hypot(dx, dz) || 1, s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const along = (dx * s + dz * c) / L, lat = (dx * c - dz * s) / L;   // oldinga va chapga (+x) proyeksiya
    if (along > 0.5) return { zone: 'rear', bit: 0 };     // o'q tank yo'nalishida uchmoqda => orqadan tegdi
    if (along < -0.5) return { zone: 'front', bit: 0 };
    return { zone: 'side', bit: lat > 0 ? 2 : 1 };        // chapga uchayotgan o'q o'ng (−x) tomonga tegadi
  }
  // Portlash nuqtasi qaysi tomonda (yaqin portlash gusenitsani uzadi)
  sideOf(p) { return this.toLocal(p, _l).x >= 0 ? 1 : 2; }
  setTracks(bits) {
    this.trackBroken = bits;
    for (let i = 0; i < 2; i++) {
      const broken = !!(bits & (1 << i));
      for (const m of this.trackMesh[i]) m.visible = !broken;
      if (this.trackDrop[i]) this.trackDrop[i].visible = broken;
    }
  }

  // Nur oyna/eshik zonasiga tegadimi? Qaytaradi: { seat, dist } yoki null.
  // Korpusning haqiqiy egilishi (pitch/roll) hisobga olinadi, shuning uchun ko'ringan oyna bilan mos keladi.
  windowHit(o, d, maxDist) {
    const T = this.T;
    if (!T.zones || !this.alive) return null;
    this.root.updateMatrixWorld(true);
    _inv.copy(this.hull.matrixWorld).invert();
    _ray.origin.copy(o); _ray.direction.copy(d);
    _ray.applyMatrix4(_inv);
    const b = T.body;
    _zb.min.set(b[0], b[1], b[2]); _zb.max.set(b[3], b[4], b[5]);
    const bp = _ray.intersectBox(_zb, _q);
    const tBody = bp ? bp.distanceTo(_ray.origin) : Infinity;
    let best = null;
    for (const z of T.zones) {
      _zb.min.set(z[1], z[2], z[3]); _zb.max.set(z[4], z[5], z[6]);
      const p = _ray.intersectBox(_zb, _q);
      if (!p) continue;
      const t = p.distanceTo(_ray.origin);
      if (t > maxDist || t > tBody + 0.3) continue;   // o'q avval korpusga tegdi — oyna emas
      if (!best || t < best.dist) best = { seat: z[0], dist: t };
    }
    return best;
  }

  // ---------- Ochiq korpus (Kamaz): aniq shakl bo'yicha tekshiruv ----------
  // Nur korpusning qattiq qismlariga (pol, bortlar, kabina) tegadimi? Masofani qaytaradi yoki Infinity. nOut — tekkan yuzaning normali.
  rayHull(o, d, maxDist, nOut) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const ox = (o.x - this.pos.x) * c - (o.z - this.pos.z) * s, oy = o.y - this.pos.y, oz = (o.x - this.pos.x) * s + (o.z - this.pos.z) * c;
    const dx = d.x * c - d.z * s, dy = d.y, dz = d.x * s + d.z * c;
    let best = maxDist, axis = -2, sign = 1;
    for (const b of this.T.walk.boxes) {
      let t0 = 0, t1 = best, ax = -1, sg = 1, miss = false;
      for (let k = 0; k < 3 && !miss; k++) {
        const p = k === 0 ? ox : k === 1 ? oy : oz, v = k === 0 ? dx : k === 1 ? dy : dz, lo = b[k], hi = b[k + 3];
        if (Math.abs(v) < 1e-9) { if (p < lo || p > hi) miss = true; continue; }
        let a = (lo - p) / v, e = (hi - p) / v, sgn = -1;
        if (a > e) { const tmp = a; a = e; e = tmp; sgn = 1; }
        if (a > t0) { t0 = a; ax = k; sg = sgn; }
        if (e < t1) t1 = e;
        if (t0 > t1) miss = true;
      }
      if (!miss && t0 < best) { best = t0; axis = ax; sign = sg; }
    }
    if (axis === -2) return Infinity;
    if (nOut) {
      if (axis === 0) nOut.set(c * sign, 0, -s * sign); else if (axis === 2) nOut.set(s * sign, 0, c * sign); else nOut.set(0, axis === 1 ? sign : 1, 0);
    }
    return best;
  }
  // Nuqta korpusning qattiq qismi ichidami?
  solidAt(p) {
    const l = this.toLocal(p, _l);
    for (const b of this.T.walk.boxes) if (l.x > b[0] && l.x < b[3] && l.y > b[1] && l.y < b[4] && l.z > b[2] && l.z < b[5]) return true;
    return false;
  }

  // ---------- Ichida piyoda yurish (Chinuk, Kamaz) ----------
  // Dunyo AABB qutisi aylanmaydi, shuning uchun piyoda bilan to'qnashuv transportning o'z koordinatasida hisoblanadi.
  // Piyoda shu transport yaqinida bo'lganda uning dunyo qutisi e'tiborga olinmaydi va quyidagi funksiyalar ishlaydi.
  walkCollide(pos, r, feetY, headY) {
    const W = this.T.walk, l = this.toLocal(pos, _l), f = feetY - this.pos.y, hd = headY - this.pos.y;
    for (let it = 0; it < 2; it++) {
      for (const b of W.boxes) {
        if (b[4] <= f + STEP_H || b[1] >= hd) continue;
        if (l.x < b[0] - r || l.x > b[3] + r || l.z < b[2] - r || l.z > b[5] + r) continue;
        const cx = clamp(l.x, b[0], b[3]), cz = clamp(l.z, b[2], b[5]);
        const dx = l.x - cx, dz = l.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; l.x += dx * k; l.z += dz * k; }
        else {
          const a = l.x - b[0], c = b[3] - l.x, n = l.z - b[2], e = b[5] - l.z, m = Math.min(a, c, n, e);
          if (m === a) l.x = b[0] - r; else if (m === c) l.x = b[3] + r; else if (m === n) l.z = b[2] - r; else l.z = b[5] + r;
        }
      }
    }
    this.local(l.x, 0, l.z, _q);
    pos.x = _q.x; pos.z = _q.z;
  }
  // Oyoq ostidagi pol/rampa balandligi (dunyo Y) yoki −Infinity
  walkGround(pos, r, feetY) {
    const l = this.toLocal(pos, _l), f = feetY - this.pos.y;
    let g = -Infinity;
    for (const b of this.T.walk.boxes) {
      if (b[4] > f + STEP_H + 0.01 || b[4] <= g) continue;
      const dx = l.x - clamp(l.x, b[0], b[3]), dz = l.z - clamp(l.z, b[2], b[5]);
      if (dx * dx + dz * dz < r * r * 0.5) g = b[4];
    }
    return g === -Infinity ? g : this.pos.y + g;
  }
  walkCeiling(pos, r, headY) {
    const l = this.toLocal(pos, _l), hd = headY - this.pos.y;
    let c = Infinity;
    for (const b of this.T.walk.boxes) {
      if (b[1] < hd - 0.3 || b[1] >= c) continue;
      const dx = l.x - clamp(l.x, b[0], b[3]), dz = l.z - clamp(l.z, b[2], b[5]);
      if (dx * dx + dz * dz < r * r * 0.5) c = b[1];
    }
    return c === Infinity ? c : this.pos.y + c;
  }
  // Nuqta yuk bo'limi ichidami?
  inCabin(pos) {
    const c = this.T.walk.cabin;
    if (!c) return false;   // ochiq kuzov: u yerdagi odam korpus bilan himoyalanmagan
    const l = this.toLocal(pos, _l);
    return l.x > c[0] && l.x < c[3] && l.z > c[2] && l.z < c[5] && l.y > c[1] - 0.2 && l.y < c[4];
  }

  updateBox() {
    if (!this.alive) { this.box.min.set(0, -999, 0); this.box.max.set(0, -998, 0); return; }
    const [w, h, l] = this.T.box, c = Math.abs(Math.cos(this.yaw)), s = Math.abs(Math.sin(this.yaw));
    const hx = (c * w + s * l) / 2, hz = (s * w + c * l) / 2, off = this.T.boxOff;
    const cx = this.pos.x + Math.sin(this.yaw) * off, cz = this.pos.z + Math.cos(this.yaw) * off;
    this.box.min.set(cx - hx, this.pos.y, cz - hz);
    this.box.max.set(cx + hx, this.pos.y + h, cz + hz);
  }
  // Kadr boshida chaqiriladi: oxirgi kadrdan beri qancha siljiganini eslab qoladi
  trackMotion() {
    this.dPos.subVectors(this.pos, this.lastPos); this.dYaw = wrap(this.yaw - this.lastYaw);
    this.lastPos.copy(this.pos); this.lastYaw = this.yaw;
  }

  // Mahalliy fizika (transport egasi hisoblaydi). inp = null — boshqaruvchi yo'q.
  simulate(dt, inp) {
    if (!this.alive) return;
    const W = this.g.world, pos = this.pos, vel = this.vel, T = this.T;
    // yoqilg'i: dvigatel ishlaganda kamayadi; tugasa — yer transporti to'xtaydi, vertolyot asta pastlaydi
    if (this.limited && inp) {
      const use = T.fly ? (this.rotor > 0.3 ? 1 / 150 : 0) : (inp.fwd ? 1 : 0.12) / (T.tank ? 140 : 170);
      this.fuel = Math.max(0, this.fuel - use * dt);
      if (T.fly && this.fuel <= 0) inp = Object.assign({}, inp, { up: -0.55, fwd: 0, strafe: 0 });
    }
    // qurol holati: raketalarni qayta o'qlash va pulemyotning sovushi
    if (this.rocketReload > 0) { this.rocketReload -= dt; if (this.rocketReload <= 0) { this.rocketReload = 0; this.rockets = T.rockets || 0; } }
    gunCool(this.gun, dt);
    const stuck = this.immobile;
    if (T.fly) {
      const F = T.fly;
      this.rotor += ((inp ? 1 : 0) - this.rotor) * Math.min(1, dt * (inp ? 0.9 : 0.35));
      const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw);
      if (inp) {
        this.yaw = wrap(this.yaw + clamp(wrap(inp.yaw - this.yaw), -F.turn * dt, F.turn * dt));
        let tx = 0, tz = 0, ty = this.onGround ? 0 : -5;
        if (this.rotor > 0.55) {
          ty = inp.up * F.maxV;
          if (!this.onGround || inp.up > 0) {
            const f = inp.fwd * (inp.fwd < 0 ? 0.6 : 1), st = inp.strafe * 0.7;
            tx = (sn * f - cs * st) * F.maxH; tz = (cs * f + sn * st) * F.maxH;
          }
        }
        vel.x += (tx - vel.x) * Math.min(1, dt * F.acc);
        vel.z += (tz - vel.z) * Math.min(1, dt * F.acc);
        vel.y += (ty - vel.y) * Math.min(1, dt * 2.2);
        if (this.onGround && inp.up <= 0) { vel.x *= 0.8; vel.z *= 0.8; if (vel.y < 0) vel.y = 0; }
      } else {
        const dr = Math.max(0, 1 - dt * 0.6); vel.x *= dr; vel.z *= dr;
        if (!this.onGround) vel.y -= 11 * dt; else { vel.x = vel.z = 0; }
      }
      pos.x += vel.x * dt; pos.z += vel.z * dt;
      const px = pos.x, pz = pos.z;
      W.collideCircle(pos, T.r, pos.y, pos.y + T.box[1] - 0.2, this.box, W.half + 80);
      if (Math.hypot(pos.x - px, pos.z - pz) > 0.001) {
        const sp = Math.hypot(vel.x, vel.z);
        if (sp > 7) this.g.vehicleCrash(this, (sp - 7) * 14);
        vel.x *= 0.4; vel.z *= 0.4;
      }
      pos.y += vel.y * dt;
      const gh = W.groundHeight(pos.x, pos.z, T.r * 0.7, pos.y, this.box);
      if (pos.y <= gh) {
        if (vel.y < -7) this.g.vehicleCrash(this, (-vel.y - 7) * 110);
        pos.y = gh; vel.y = 0; this.onGround = true;
      } else this.onGround = pos.y < gh + 0.05;
      if (pos.y > 85) { pos.y = 85; if (vel.y > 0) vel.y = 0; }
      const fs = vel.x * sn + vel.z * cs, ss = -vel.x * cs + vel.z * sn;
      this.pitch += ((fs / F.maxH) * 0.32 - this.pitch) * Math.min(1, dt * 3);
      this.roll += ((ss / F.maxH) * 0.3 - this.roll) * Math.min(1, dt * 3);
    } else if (T.car) {
      const C = T.car, drive = inp && !stuck;
      if (drive) {
        if (inp.fwd > 0) this.speed += C.acc * dt;
        else if (inp.fwd < 0) this.speed -= (this.speed > 0 ? 24 : 8) * dt;
      }
      this.speed -= this.speed * (drive && inp.fwd ? 0.35 : stuck ? 4 : 1.6) * dt;
      this.speed = clamp(this.speed, -C.rev, C.max);
      if (drive) this.yaw = wrap(this.yaw + inp.steer * clamp(this.speed / 5, -1, 1) * C.steer * dt);
      const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw);
      vel.set(sn * this.speed, 0, cs * this.speed);
      pos.x += vel.x * dt; pos.z += vel.z * dt;
      const px = pos.x, pz = pos.z;
      W.collideCircle(pos, T.r, pos.y, pos.y + 1.4, this.box);
      if (Math.hypot(pos.x - px, pos.z - pz) > 0.004) {
        if (Math.abs(this.speed) > 9) this.g.vehicleCrash(this, (Math.abs(this.speed) - 9) * 6);
        this.speed *= 0.4;
      }
      const gh = W.groundHeight(pos.x, pos.z, Math.min(1.0, T.r * 0.75), pos.y, this.box);
      pos.y = gh > pos.y ? gh : Math.max(gh, pos.y - 12 * dt);
      this.onGround = true;
    } else if (T.tank) {
      const K = T.tank;
      if (inp) {
        if (!stuck) {
          if (inp.fwd > 0) this.speed += K.acc * dt;
          else if (inp.fwd < 0) this.speed -= (this.speed > 0 ? K.acc * 2 : K.acc * 0.7) * dt;
          // gusenitsali: joyida ham buriladi
          this.yaw = wrap(this.yaw + inp.steer * (K.turn - Math.min(0.4, Math.abs(this.speed) * 0.045)) * dt);
        }
        if (inp.aimYaw !== undefined) {
          this.aimYaw = wrap(this.aimYaw + clamp(wrap(inp.aimYaw - this.aimYaw), -K.turret * dt, K.turret * dt));
          this.aimPitch += clamp(clamp(inp.aimPitch, -0.14, 0.45) - this.aimPitch, -1.0 * dt, 1.0 * dt);
        }
      }
      this.speed -= this.speed * (stuck ? 5 : inp && inp.fwd ? 0.55 : 2.2) * dt;
      this.speed = clamp(this.speed, -K.rev, K.max);
      const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw);
      vel.set(sn * this.speed, 0, cs * this.speed);
      pos.x += vel.x * dt; pos.z += vel.z * dt;
      const px = pos.x, pz = pos.z;
      W.collideCircle(pos, T.r, pos.y, pos.y + 2.2, this.box);
      if (Math.hypot(pos.x - px, pos.z - pz) > 0.004) this.speed *= 0.3;
      const gh = W.groundHeight(pos.x, pos.z, 1.4, pos.y, this.box);
      pos.y = gh > pos.y ? gh : Math.max(gh, pos.y - 12 * dt);
      this.onGround = true;
    } else if (inp) {
      this.aimYaw = wrap(this.aimYaw + clamp(wrap(inp.yaw - this.aimYaw), -2.6 * dt, 2.6 * dt));
      this.aimPitch += clamp(clamp(inp.pitch, -0.12, 1.35) - this.aimPitch, -2 * dt, 2 * dt);
    }
    this.updateBox();
  }

  // Tarmoqdan kelgan holat (boshqa o'yinchi haydayotganda)
  setNet(st) {
    const n = this.net;
    n.pos.set(st.x, st.y, st.z); n.yaw = st.yw; n.pitch = st.pt || 0; n.roll = st.rl || 0; n.ay = st.ay || 0; n.ap = st.ap || 0;
    if (!n.has || this.pos.distanceTo(n.pos) > 12) { this.pos.copy(n.pos); this.yaw = n.yaw; }
    n.has = true;
    if (st.rk !== undefined) { this.rockets = st.rk; this.rocketReload = st.rr || 0; this.gun.heat = st.ht || 0; this.gun.hot = !!st.oh; }
    if (st.fu !== undefined && st.fu !== null) { this.fuel = st.fu; if (st.aa >= 0) this.ammo.a = st.aa; if (st.ab >= 0) this.ammo.b = st.ab; }
  }
  remote(dt) {
    if (!this.alive || !this.net.has) return;
    const n = this.net, k = Math.min(1, dt * 12), ox = this.pos.x, oy = this.pos.y, oz = this.pos.z;
    this.pos.lerp(n.pos, k);
    if (dt > 0) this.vel.set((this.pos.x - ox) / dt, (this.pos.y - oy) / dt, (this.pos.z - oz) / dt);
    this.yaw = wrap(this.yaw + wrap(n.yaw - this.yaw) * k);
    this.pitch += (n.pitch - this.pitch) * k; this.roll += (n.roll - this.roll) * k;
    this.aimYaw = wrap(this.aimYaw + wrap(n.ay - this.aimYaw) * k); this.aimPitch += (n.ap - this.aimPitch) * k;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.rotor += ((this.seats[0] != null ? 1 : 0) - this.rotor) * Math.min(1, dt * 0.9);
    this.onGround = this.pos.y < 0.2;
    this.updateBox();
  }

  visual(dt) {
    const r = this.root;
    r.visible = this.alive;
    if (!this.alive) return;
    if (this.skinDef && !this.skin) this.skinUp();
    r.position.copy(this.pos);
    if (this.type === 'cannon') {
      this.turret.rotation.y = this.aimYaw;
      this.barrel.rotation.x = -this.aimPitch;
    } else {
      r.rotation.y = this.yaw;
      this.hull.rotation.x = this.pitch; this.hull.rotation.z = this.roll;
      if (this.T.fly) {
        this.rotorG.rotation.y += this.rotor * dt * 34;
        if (this.rotorG2) this.rotorG2.rotation.y -= this.rotor * dt * 34;
        if (this.tailG) this.tailG.rotation.x += this.rotor * dt * 50;
      } else if (this.T.tank) { this.turret.rotation.y = this.aimYaw - this.yaw; this.barrel.rotation.x = -this.aimPitch; }
      else for (const w of this.wheels) w.rotation.x += (this.speed * dt) / this.T.car.wheelR;
    }
    // shikast: avval tutun, yonish darajasida — olov
    if (this.hp < this.T.hp * 0.5 && this.g.fx) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.06;
        const y = this.pos.y + Math.min(1.8, this.T.box[1] * 0.7);
        this.g.fx.smokePuff(_p.set(this.pos.x, y, this.pos.z), this.burning ? 0.6 : 0.35);
        if (this.burning) { this.g.fx.fire(_p); this.g.fx.fire(_p.set(this.pos.x - Math.sin(this.yaw) * 1.2, y - 0.2, this.pos.z - Math.cos(this.yaw) * 1.2)); }
      }
    }
  }

  resetWeapons() { this.rockets = this.T.rockets || 0; this.rocketReload = 0; this.gun = newGun(); this.fuel = 1; this.ammo = this.fullAmmo(); }
  destroy() {
    this.alive = false; this.seats.fill(null); this.owner = null;
    this.vel.set(0, 0, 0); this.speed = 0; this.rotor = 0;
    this.updateBox(); this.root.visible = false;
  }
  respawn() {
    this.pos.set(this.spawn.x, 0, this.spawn.z); this.vel.set(0, 0, 0);
    this.yaw = this.aimYaw = this.spawn.yaw; this.pitch = this.roll = this.aimPitch = 0;
    this.hp = this.T.hp; this.alive = true; this.speed = 0; this.rotor = 0; this.onGround = true;
    this.seats.fill(null); this.owner = null; this.net.has = false;
    this.lastPos.copy(this.pos); this.lastYaw = this.yaw; this.dPos.set(0, 0, 0); this.dYaw = 0;
    this.resetWeapons(); this.setTracks(0);
    this.updateBox(); this.visual(0);
  }
  dispose() { this.g.world.removeBox(this.box); this.g.scene.remove(this.root); }
}
