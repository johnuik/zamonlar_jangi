// ================= UMUMIY JADVALLAR =================
// Server (server.js) va brauzer (world.js, vehicles.js, mp.js ...) bitta manbadan foydalanadi:
// transport joylari, xaritalar, zombi punktlari, transport joni/o'rinlari. Bu yerda o'zgartirilgan qiymat ikkala tomonda ham o'zgaradi.
// (.mjs — Node ham, brauzer ham ES modul sifatida yuklashi uchun)

export const RESPAWN = 4;      // tarmoqda qayta tug'ilish vaqti (soniya)
export const Z_HP = 120;       // zombi-o'yinchining joni (kuchaytirilgan)
// Zombi rejimi: yiqilgan odam Z_DOWN soniya yerda yotadi — shu vaqtda sherigi defibrillyator bilan uni joyida tiriltira oladi (DEFIB_HP jon bilan),
// keyin zombiga aylanadi. Tiriltirish punktidagi ratsiya zombiga aylangan sherikni odam qilib chaqiradi — har punkt Z_CALL_CD soniyada bir marta.
export const Z_DOWN = 8, DEFIB_HP = 60, Z_CALL_CD = 40;
// Evakuatsiya (oxirgi bosqichdan keyin, soniya): arrive — vertolyot uchib kelib qo'nadi; board — tirik odamlarni kutadi
// (birinchi odam chiqqach qolganlarga wait soniya qoladi); leave — uchib ketish (hamma ko'radigan yakuniy "kino")
export const EVAC_T = { arrive: 18, board: 90, wait: 30, leave: 21 };
export const HALF = 70;        // kichik xaritaning yarim o'lchami (metr)
// Vositalar (aptechka, zirh ...): olingandan keyin qayta paydo bo'lish vaqti, zirh nimcha sig'imi va u yutadigan zarar ulushi
export const ITEM_RESPAWN = 30, ARMOR_MAX = 60, ARMOR_ABSORB = 0.5;
export const ITEM_KINDS = ['med', 'band', 'armor', 'adr', 'ammo', 'nade', 'gun', 'defib'];   // 'defib' — defibrillyator (zombi rejimi)   // 'gun' — xonadagi qurol
// Personajlar o'lchami. Dunyo yirik qurilgan (eshik 2.3 m, devor 3.2 m), shuning uchun eski 1.77 m li odamlar kichik va ozg'in ko'rinardi:
// endi bo'y 12% baland (≈1.98 m), gavda yana 8% kengroq. Model, nishon hajmlari va ko'z balandligi (core.js: EYE_H) birga o'zgaradi.
export const CHAR_K = 1.12, CHAR_BULK = 1.08;
export const LOOT_BASE = 300;   // xonalardagi qurollarning raqamlari shundan boshlanadi (vositalar bilan aralashmasligi uchun)
export const LOOT_RESPAWN = 60; // olingan qurol xonada qayta paydo bo'lishigacha (s)

// ---------- Rejimlar ----------
export const MODES = ['flag', 'dm', 'tdm', 'zombie', 'br', 'gg'];
// Jamoalar bormi: jamoaviy jangda doim; jang maydoni (br) va gun game (gg) da — lobbida tanlanadi
export const teamMode = (mode, teamOn) => mode === 'tdm' || ((mode === 'br' || mode === 'gg') && !!teamOn);
// Gun game (arena): har o'ldirishda navbatdagi qurol beriladi — eng kuchlisidan kuchsiziga; oxirgi daraja — pichoq, pichoq bilan o'ldirgan o'yinchi g'olib.
// Pichoq bilan o'ldirilgan o'yinchi bir daraja pastga tushadi.
export const GG_LADDER = ['lmg', 'ar2', 'ar', 'dmr', 'shotgun2', 'smg', 'smg2', 'shotgun', 'sniper', 'pistol2', 'pistol', 'knife'];
export const GG_RESPAWN = 2.5, GG_TIME = 600;
// Jang maydoni (PUBG uslubi): hamma qurolsiz parashyutda tushadi, qurol, o'q, shlem, zirh va qo'shimchalarni uylardan topadi; qayta tug'ilish yo'q, oxirgi tirik qolgan g'olib
export const BR_BASE = 1024, BR_MAX = 6000;   // o'lja raqamlari: BR_BASE … BR_BASE + BR_MAX
export const BR_DROP_H = 150;                  // tushish balandligi (m)
export const BR_TIME = 1500;                   // eng ko'p davomiyligi (zona undan oldin to'liq yopiladi)
export const BR_HELM = [0, 40, 70, 110];       // shlem darajalari: boshga tekkan zararning yarmini yutadigan zaxira
export const HELM_ABSORB = 0.5;
// Qayta tug'ilgandan keyingi himoya (soniya): shu vaqt ichida jon ketmaydi; o'yinchi o'zi o'q uzsa — himoya darhol tugaydi
export const SPAWN_PROT = 2;
export const BR_KINDS = ['gun', 'ammo', 'att', 'helm', 'armor', 'med', 'band', 'adr', 'nade'];

// Xaritalar: half — yarim o'lcham; pickups — noyob qurol joylari soni; spawns — transport joylari
// Yangi shahar: transport joylari (markazdan uzoqda, halqa yo'l va chetlarda)
export const CITY_SPAWNS = [
  { type: 'heli', x: -84, z: -84, yaw: Math.PI / 4 },
  { type: 'chinook', x: 84, z: 84, yaw: (-Math.PI * 3) / 4 },
  { type: 'jeep', x: 84, z: -72, yaw: -Math.PI / 2 },
  { type: 'quad', x: -84, z: 72, yaw: Math.PI / 2 },
  { type: 'cannon', x: -34, z: 8, yaw: 0 },
  { type: 'cannon', x: 34, z: -8, yaw: Math.PI },
  { type: 'tank', x: -88, z: 0, yaw: Math.PI / 2 },
  { type: 'ltank', x: 88, z: 0, yaw: -Math.PI / 2 },
  { type: 'truck', x: 0, z: -84, yaw: 0 },
];
// ---------- Aerodrom (280 × 280 m): transport joylari o'zgarmas — vertolyotlar beton maydonda, zenitlar dalada, tanklar rulyojka uchlarida ----------
// (turlar tartibi VEH_TYPES bilan bir xil — indeks bo'yicha murojaat qilinadi)
export const AIR_VEH = [
  { type: 'heli', x: -92, z: 38, yaw: 0 },
  { type: 'chinook', x: -52, z: 36, yaw: 0 },
  { type: 'jeep', x: 10, z: 82, yaw: Math.PI },
  { type: 'quad', x: 62, z: 104, yaw: Math.PI },
  { type: 'cannon', x: -60, z: -86, yaw: Math.PI },
  { type: 'cannon', x: 60, z: -86, yaw: Math.PI },
  { type: 'tank', x: -120, z: 10, yaw: Math.PI / 2 },
  { type: 'ltank', x: 120, z: 10, yaw: -Math.PI / 2 },
  { type: 'truck', x: 78, z: 50, yaw: Math.PI / 2 },
];

// ---------- Karantin zonasi (zombi rejimi xaritasi, 800 × 800 m) ----------
// Transport: joylari o'zgarmas (qishloq, ferma, shoxobcha, shaharcha, baza); yoqilg'isi cheklangan.
export const WILD_VEH = [
  { type: 'jeep', x: -180, z: 186, yaw: -Math.PI / 2 },
  { type: 'quad', x: -252, z: -38, yaw: 0 },
  { type: 'truck', x: -6, z: 120, yaw: Math.PI / 2 },
  { type: 'jeep', x: 70, z: 8, yaw: 0 },
  { type: 'quad', x: 236, z: 190, yaw: Math.PI },
  { type: 'ltank', x: 262, z: -232, yaw: Math.PI },
];
// Vazifalar zanjiri va joy nomlari. Server ham, mijoz ham shu jadvaldan foydalanadi (bosqichlarni server hisoblaydi).
//   poi    — joylar: nomi (katta xaritada yoziladi), markazi, radiusi va atrofida tentirab yuradigan zombilar soni (n)
//   stages — bosqichlar: k: 'reach' — nuqtaga yetish; 'parts' — qismlarni topish (istalgan tartibda); 'hold' — nuqtani t soniya ushlab turish
//   parts  — har bir qism o'z joyida; uchta joy variantidan biri har jangda urug' bo'yicha tanlanadi: [x, z, y]
export const WILD = {
  half: 400,
  start: { x: -322, z: 318, yaw: -0.68 },
  poi: [
    { id: 'camp', name: 'Halokat joyi', x: -322, z: 318, r: 34, n: 2 },
    { id: 'v1', name: "Oqtepa qishlog'i", x: -215, z: 186, r: 62, n: 9 },
    { id: 'farm', name: 'Ferma', x: -270, z: -72, r: 58, n: 8 },
    { id: 'gas', name: "Yoqilg'i shoxobchasi", x: -30, z: 138, r: 42, n: 7 },
    { id: 'town', name: 'Shaharcha', x: 72, z: -28, r: 78, n: 16 },
    { id: 'rail', name: "Temir yo'l bekati", x: 184, z: 4, r: 42, n: 6 },
    { id: 'tower', name: 'Radio minora', x: -130, z: -288, r: 42, n: 6 },
    { id: 'v2', name: "Chorvoq qishlog'i", x: 250, z: 212, r: 56, n: 8 },
    { id: 'base', name: 'Harbiy baza', x: 295, z: -265, r: 78, n: 14 },
  ],
  // Tiriltirish punktlari: from — shu bosqichga yetilgach ochiladi; faol punkt — ochilganlarning oxirgisi.
  // Tarmoqda: tirik odam punktda [E] bosib, zombiga aylangan sherigini odam qilib qaytara oladi (CALL_CD soniyada bir marta).
  // Evakuatsiya vertolyoti: qo'nish nuqtasi va burchagi (rampa shimolga — maydonga kiriladigan yo'lak tomonga qaraydi), rampa oldidagi bortga chiqish doirasi
  evac: { x: 300, z: -275, yaw: Math.PI, bx: 300, bz: -267.2, br: 4.2 },
  // (x, z — chodir markazi; fx, fz — ochiq old tomoni qaraydigan nuqta)
  revive: [
    { id: 'camp', name: 'Halokat joyi', x: -312.6, z: 309.5, fx: -260, fz: 262, from: 0 },
    { id: 'v1', name: "Oqtepa qishlog'i", x: -207, z: 179.5, fx: -215, fz: 186, from: 1 },
    { id: 'tower', name: 'Radio minora', x: -113, z: -285.6, fx: -130, fz: -286, from: 3 },
    { id: 'base', name: 'Harbiy baza', x: 252, z: -236, fx: 300, fz: -275, from: 4 },
  ],
  stages: [
    { k: 'reach', id: 'B', name: "Oqtepa qishlog'i", x: -215, z: 186, r: 16, text: "Qishloqqa yeting: u yerda qurol, o'q-dori va transport bor" },
    { k: 'parts', id: 'P', name: 'Ratsiya qismlari', text: "Yordam chaqirish uchun ratsiyani tiklash kerak — uchta qismni toping (istalgan tartibda)" },
    { k: 'hold', id: 'C', name: 'Radio minora', x: -130, z: -286, r: 18, t: 75, text: 'Qismlarni minoraga olib boring va signal yuborilguncha ushlab turing' },
    { k: 'reach', id: 'G', name: 'Harbiy baza darvozasi', x: 222, z: -262, r: 14, text: 'Vertolyot harbiy bazaga keladi — baza darvozasiga yeting' },
    { k: 'hold', id: 'D', name: 'Vertolyot maydoni', x: 300, z: -275, r: 18, t: 90, text: "Vertolyot kelguncha qo'nish maydonini ushlab turing" },
  ],
  parts: [
    { id: 'bat', name: 'Akkumulyator', at: 'Ferma', poi: 'farm', spots: [[-268, -84, 0], [-299, -51, 0], [-242, -53.5, 0]] },
    { id: 'fuel', name: "Yoqilg'i kanistri", at: "Yoqilg'i shoxobchasi", poi: 'gas', spots: [[-30, 126.5, 0], [-32, 151, 0], [-38, 159, 0]] },
    { id: 'radio', name: 'Ratsiya bloki', at: 'Shaharcha', poi: 'town', spots: [[111.8, 15, 3.47], [107, -70, 0], [35.5, -7, 0]] },
  ],
};
// Qismlarning shu jangdagi joylari (urug' bo'yicha; server va mijoz bir xil hisoblaydi). Qaytaradi: [[x, z, y], ...]
const mix32 = (v) => { v = Math.imul(v ^ (v >>> 16), 0x85ebca6b); v = Math.imul(v ^ (v >>> 13), 0xc2b2ae35); return (v ^ (v >>> 16)) >>> 0; };
export function wildParts(seed) { return WILD.parts.map((p, i) => p.spots[mix32(Math.imul((seed | 0) + 1, 0x9e3779b1) + i * 0x7f4a7c15) % p.spots.length]); }

export const MAPS = {
  city: { name: 'Yangi shahar', half: 100, pickups: 12, spawns: CITY_SPAWNS },   // ikki qavatli uylar, bunkerlar, omborlar, ayvonlar
  town: { name: 'Shaharcha', half: HALF, pickups: 4 },
  big: { name: 'Aerodrom', half: 140, pickups: 8, spawns: AIR_VEH },   // uchish yo'lagi, angarlar, dotlar (3 angar + 2 minora + 3 dot — noyob qurollar)
  wild: { name: 'Karantin zonasi', half: WILD.half, pickups: 4, spawns: WILD_VEH },   // zombi rejimi xaritasi (boshqa rejimlarda ham tanlasa bo'ladi)
};
export const mapId = (m) => (MAPS[m] ? m : 'town');

// Transport: jon va o'rinlar soni (chinook: 2 uchuvchi, 2 o'qchi, 2 yo'lovchi)
export const VEH_STATS = {
  heli: { hp: 900, seats: 4 }, chinook: { hp: 2100, seats: 6 }, jeep: { hp: 600, seats: 2 }, quad: { hp: 300, seats: 2 },
  cannon: { hp: 1500, seats: 1 }, tank: { hp: 1000, seats: 2 }, ltank: { hp: 650, seats: 2 }, truck: { hp: 1000, seats: 2 },
};

// Kichik xarita: transport joylashuvi
export const VEHICLE_SPAWNS = [
  { type: 'heli', x: -58, z: -58, yaw: Math.PI / 4 },
  { type: 'chinook', x: 58, z: 58, yaw: (-Math.PI * 3) / 4 },
  { type: 'jeep', x: 58, z: -50, yaw: -Math.PI / 2 },
  { type: 'quad', x: -58, z: 50, yaw: Math.PI / 2 },
  { type: 'cannon', x: -14, z: -18, yaw: 0 },
  { type: 'cannon', x: 14, z: 18, yaw: Math.PI },
  { type: 'tank', x: -62, z: 0, yaw: Math.PI / 2 },
  { type: 'ltank', x: 62, z: 0, yaw: -Math.PI / 2 },
  { type: 'truck', x: 0, z: -58, yaw: 0 },
];

// Transport turlari tartibi (kichik xaritalarda indeks bo'yicha murojaat qilinadi)
export const VEH_TYPES = ['heli', 'chinook', 'jeep', 'quad', 'cannon', 'cannon', 'tank', 'ltank', 'truck'];
MAPS.town.spawns = VEHICLE_SPAWNS;
// Xarita uchun transport ro'yxati (joylari har bir xaritada o'zgarmas)
export function vehiclesFor(map) { return MAPS[mapId(map)].spawns; }
