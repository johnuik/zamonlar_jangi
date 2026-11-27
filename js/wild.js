// ================= KARANTIN ZONASI =================
// Zombi rejimi xaritasi (800 × 800 m): shaharcha, ikki qishloq, ferma, yoqilg'i shoxobchasi, temir yo'l bekati,
// radio minora, harbiy baza, ular orasida asfalt va tuproq yo'llar, o'rmonlar, dalalar, elektr uzatish liniyasi.
// Hamma binolar belgilangan joyda turadi (hamma o'yinchida bir xil); daraxt va toshlar urug'li tasodif bilan sochiladi.
// Joy nomlari, vazifalar va transport joylari — js/shared.mjs (WILD, WILD_VEH); bu yerda faqat dunyoning o'zi quriladi.
// W — World nusxasi (js/world.js): uning quruvchi funksiyalaridan (house, house2, warehouse, bunker, tower ...) foydalaniladi.
import * as THREE from '../lib/three.module.js';
import { WILD } from './shared.mjs';

const tex = (w, h, draw, rx = 1, ry = 1) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t;
};

// Xarita quruvchilar uchun umumiy "asboblar": yo'l, taxta devor, pichan, xarsang, archa, o'rmon, qum qoplari, olovli bochka va materiallar.
// (Karantin zonasi va Aerodrom shulardan foydalanadi.) k: 'a' — asfalt, 'd' — tuproq yo'l, 'r' — temir yo'l, 'w' — uchish yo'lagi, 'c' — beton maydon.
export function mapKit(W) {
  const H = W.H, hf = W.half, M = W.mat, S = W.scene, PI = Math.PI;
  const box = (x0, y0, z0, x1, y1, z1) => W.boxes.push(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));
  if (!W.roads) W.roads = [];
  // ---------- materiallar ----------
  const dirtM = new THREE.MeshStandardMaterial({ map: tex(128, 128, (g, w, h) => {
    g.fillStyle = H ? '#8d8a84' : '#a58a62'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${H ? '60,58,54' : '90,66,40'},${0.08 + Math.random() * 0.2})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); }
    g.fillStyle = 'rgba(40,30,20,0.22)'; g.fillRect(w * 0.22, 0, w * 0.1, h); g.fillRect(w * 0.68, 0, w * 0.1, h);   // g'ildirak izlari
  }), roughness: 1 });
  const fieldM = new THREE.MeshStandardMaterial({ map: tex(64, 64, (g, w, h) => {
    g.fillStyle = H ? '#b9bcc0' : '#8f7a4e'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { g.fillStyle = H ? 'rgba(70,64,56,0.55)' : 'rgba(64,46,24,0.55)'; g.fillRect(x, 0, 3, h); g.fillStyle = H ? 'rgba(255,255,255,0.35)' : 'rgba(120,134,60,0.5)'; g.fillRect(x + 4, 0, 2, h); }
  }), roughness: 1 });
  const railM = new THREE.MeshStandardMaterial({ map: tex(64, 64, (g, w, h) => {
    g.fillStyle = H ? '#6c6a66' : '#77706a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '30,30,30' : '170,165,155'},0.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#3a2c20'; for (let y = 6; y < h; y += 16) g.fillRect(w * 0.14, y, w * 0.72, 6);   // shpallar
  }), roughness: 1 });
  const padM = new THREE.MeshStandardMaterial({ map: tex(256, 256, (g, w, h) => {
    g.fillStyle = '#4a4a48'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, PI * 2); g.fill();
    g.strokeStyle = '#e8d44a'; g.lineWidth = 9; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 14, 0, PI * 2); g.stroke();
    g.fillStyle = '#f2f2ee'; g.font = 'bold 150px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', w / 2, h / 2 + 8);
  }), transparent: true, roughness: 0.9 });
  if (W.photo && !W.lite && W.quality !== 'low') W.photo(dirtM, 'dirt', H ? 0x8d8a84 : 0xa58a62);   // tuproq yo'l — suratdan (foto-teksturalar bo'lsa)
  const hayM = new THREE.MeshStandardMaterial({ color: H ? 0xa8975e : 0xc8a94e, roughness: 1 });
  const pineM = new THREE.MeshStandardMaterial({ color: H ? 0x2f4a2c : 0x5f6f34, roughness: 1, flatShading: true });
  const wireM = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6, metalness: 0.5 });

  // ---------- quruvchi yordamchilar ----------
  // Yo'l: a → b kesma (istalgan yo'nalishda). k: 'a' — asfalt, 'd' — tuproq yo'l, 'r' — temir yo'l to'shamasi
  const road = (ax, az, bx, bz, w, k = 'a') => {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), g = new THREE.PlaneGeometry(w, len), uv = g.attributes.uv, hard = k === 'a' || k === 'w' || k === 'c';
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (hard ? w / 4 : 1), uv.getY(i) * (len / (k === 'r' ? 2.6 : 4)));
    const m = new THREE.Mesh(g, k === 'c' ? M.concrete : hard ? M.road : k === 'r' ? railM : dirtM);
    m.rotation.order = 'YXZ'; m.rotation.set(-PI / 2, Math.atan2(-dx, -dz), 0);
    m.position.set((ax + bx) / 2, k === 'a' ? 0.016 : k === 'w' ? 0.018 : k === 'c' ? 0.013 : k === 'r' ? 0.02 : 0.011, (az + bz) / 2); m.receiveShadow = true; S.add(m);
    W.roads.push({ ax, az, bx, bz, w, k });
  };
  // Taxta devor (o'qqa to'siq, [PROBEL] bilan oshib o'tiladi). O'qlarga parallel kesma.
  const fence = (ax, az, bx, bz, h = 1.15) => {
    const lx = Math.abs(bx - ax), lz = Math.abs(bz - az);
    W.solid((ax + bx) / 2, 0, (az + bz) / 2, Math.max(lx, 0.1), h, Math.max(lz, 0.1), M.crate, { uv: 1.6, map: false });
  };
  const hay = (x, z, rot) => {   // pichan g'arami: yumaloq toy (ortiga berkinsa bo'ladi)
    W.deco(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 12), hayM, x, 0.75, z, PI / 2, rot ? PI / 2 : 0, 0);
    box(x - (rot ? 0.65 : 0.75), 0, z - (rot ? 0.75 : 0.65), x + (rot ? 0.65 : 0.75), 1.5, z + (rot ? 0.75 : 0.65));
  };
  const rock = (x, z, s) => {   // katta xarsang
    W.deco(new THREE.IcosahedronGeometry(1, 0), M.rock, x, s * 0.45, z, W.r(0, 3), W.r(0, 3), W.r(0, 3)).scale.set(s * W.r(0.9, 1.3), s * W.r(0.6, 0.9), s * W.r(0.9, 1.3));
    box(x - s * 0.7, 0, z - s * 0.7, x + s * 0.7, s * 0.85, z + s * 0.7);
    W.clear.push({ x, z, r: s + 0.5 });
  };
  // Archa / buta daraxt (palmadan tashqari ikkinchi tur): tanasi va uch qavat konus
  const pine = (x, z) => {
    const h = W.r(5, 9), r = h * 0.2;
    W.deco(new THREE.CylinderGeometry(0.12, 0.2, h * 0.5, 6), M.bark, x, h * 0.25, z);
    for (let i = 0; i < 3; i++) W.deco(new THREE.ConeGeometry(r * (1.25 - i * 0.3), h * 0.4, 7), pineM, x, h * (0.42 + i * 0.22), z, 0, W.r(0, 3), 0);
    box(x - 0.22, 0, z - 0.22, x + 0.22, 5, z + 0.22);
  };
  const anyTree = (x, z) => { if (W.rand() < (H ? 0.6 : 0.3)) pine(x, z); else W.tree(x, z); };
  // Maydonga daraxt sochish (bo'sh joylargagina; yo'l, bino va transport joylari chetlab o'tiladi)
  const forest = (x0, z0, x1, z1, n, m = 2.2) => {
    for (let i = 0, t = 0; i < n && t < n * 14; t++) {
      const x = W.r(x0, x1), z = W.r(z0, z1);
      if (Math.abs(x) > hf - 3 || Math.abs(z) > hf - 3 || !W.freeSpot(x, z, m)) continue;
      anyTree(x, z); W.clear.push({ x, z, r: 0.6 }); i++;
    }
  };
  const bags = (x, z, w, d) => W.solid(x, 0, z, w, 1.12, d, M.sandbag, { uv: 1.2 });
  const fire = (x, z, light = true) => {   // yonib turgan bochka — yorug'lik manbai
    W.solid(x, 0, z, 0.7, 0.95, 0.7, M.metal, { map: false });
    W.fires.push(new THREE.Vector3(x, 1.0, z));
    if (light) { const L = new THREE.PointLight(0xff8a3a, 30, 22, 2); L.position.set(x, 2.0, z); S.add(L); W.fireLights.push(L); }
  };

  return { road, fence, hay, rock, pine, anyTree, forest, bags, fire, box, dirtM, fieldM, railM, padM, hayM, pineM, wireM };
}

export function buildWild(W) {
  const H = W.H, hf = W.half, M = W.mat, S = W.scene, PI = Math.PI;
  W.roads = []; W.pois = WILD.poi; W.points = [];
  const { road, fence, hay, rock, anyTree, forest, bags, fire, box, fieldM, padM, wireM } = mapKit(W);
  W.playerSpawn = new THREE.Vector3(WILD.start.x, 0, WILD.start.z);

  // ---------- bo'sh qoldiriladigan joylar: transport, vazifa nuqtalari, boshlang'ich lager ----------
  for (const v of W.vehSpawns) W.clear.push({ x: v.x, z: v.z, r: v.type === 'truck' || v.type === 'ltank' ? 7 : 5 });
  for (const st of WILD.stages) if (st.x !== undefined) W.clear.push({ x: st.x, z: st.z, r: 6 });
  W.clear.push({ x: WILD.start.x, z: WILD.start.z, r: 5 });

  // ================= 1) BINOLAR (podvallar yer qoplamasidan oldin quriladi) =================
  // --- Shaharcha: to'rt mahalla, o'rtasida chorraha ---
  for (const hd of [
    { x: 34, z: -70, w: 12, d: 10, two: 1 }, { x: 54, z: -70, w: 10, d: 9, base: 1 }, { x: 33, z: -47, w: 11, d: 9 }, { x: 54, z: -47, w: 10, d: 10, two: 1 },
    { x: 90, z: -46, w: 12, d: 10, two: 1 }, { x: 113, z: -46, w: 10, d: 9 },
    { x: 34, z: -8, w: 12, d: 10, two: 1 }, { x: 54, z: -10, w: 10, d: 9 }, { x: 35, z: 14, w: 10, d: 9 }, { x: 55, z: 14, w: 10, d: 10, two: 1 },
    { x: 91, z: -10, w: 11, d: 9 }, { x: 112, z: -8, w: 12, d: 10, two: 1 }, { x: 92, z: 14, w: 10, d: 9 }, { x: 114, z: 14, w: 12, d: 10, two: 1 },
    // --- Oqtepa qishlog'i ---
    { x: -262, z: 168, w: 10, d: 9 }, { x: -240, z: 167, w: 11, d: 9 }, { x: -196, z: 168, w: 10, d: 9 }, { x: -174, z: 167, w: 10, d: 9 },
    { x: -256, z: 205, w: 10, d: 9 }, { x: -232, z: 206, w: 12, d: 10, two: 1 }, { x: -198, z: 205, w: 10, d: 9 }, { x: -176, z: 206, w: 10, d: 9 },
    // --- Ferma uyi, shoxobcha do'koni, bekat binosi ---
    { x: -240, z: -52, w: 10, d: 9 }, { x: -30, z: 150, w: 10, d: 8 }, { x: 204, z: 4, w: 12, d: 8 },
    // --- Chorvoq qishlog'i ---
    { x: 216, z: 190, w: 10, d: 9 }, { x: 264, z: 189, w: 11, d: 9 }, { x: 286, z: 190, w: 10, d: 9 },
    { x: 222, z: 224, w: 10, d: 9 }, { x: 246, z: 225, w: 12, d: 10, two: 1 }, { x: 272, z: 224, w: 10, d: 9 },
    // --- Harbiy baza: kazarmalar va shtab ---
    { x: 262, z: -216, w: 14, d: 8 }, { x: 284, z: -216, w: 14, d: 8 }, { x: 334, z: -222, w: 12, d: 10, two: 1 },
  ]) { if (hd.two) W.house2(hd); else W.house(hd); }
  // omborlar: shaharcha ombori (noyob qurol), ferma molxonasi, baza angarlari
  W.warehouse({ x: 103, z: -68, w: 22, d: 14, sp: 0 });
  W.warehouse({ x: -272, z: -82, w: 22, d: 14 });
  W.warehouse({ x: 330, z: -306, w: 24, d: 16 });
  W.warehouse({ x: 262, z: -306, w: 22, d: 14 });

  W.buildGround();

  // ================= 2) YO'LLAR =================
  road(-hf, 110, hf, 110, 7);                     // asosiy yo'l (g'arb — sharq)
  road(70, 110, 70, -262, 7);                     // shaharcha orqali shimolga
  road(70, -262, 226, -262, 7);                   // harbiy baza darvozasiga
  road(12, -30, 172, -30, 6);                     // shaharcha ko'ndalang ko'chasi (bekatgacha)
  road(-215, 110, -215, 183, 4, 'd'); road(-276, 186, -160, 186, 5, 'd');     // Oqtepa
  road(-322, 302, -322, 110, 4, 'd'); road(-322, 300, -272, 190, 4, 'd');     // lager → yo'l va qishloq
  road(-270, 110, -270, -44, 4, 'd');             // fermaga
  road(70, -200, -122, -272, 4, 'd');             // radio minoraga (o'rmon orqali)
  road(250, 110, 250, 203, 4, 'd'); road(204, 206, 296, 206, 5, 'd');         // Chorvoq
  road(296, -110, 296, -194, 4, 'd'); road(296, -110, 190, -110, 4, 'd');     // bazaning janubiy darvozasi
  road(190, -hf, 190, hf, 4.2, 'r');              // temir yo'l (shimol — janub)
  for (const s of [-0.72, 0.72]) W.deco(new THREE.BoxGeometry(0.07, 0.13, hf * 2), M.steel, 190 + s, 0.085, 0, 0, 0, 0, false);   // relslar

  // ================= 3) CHEGARA =================
  { const wh = 4.5, L = hf * 2 + 2;
    W.solid(0, 0, -hf - 0.5, L, wh, 1, M.wall, { uv: 4, map: false }); W.solid(0, 0, hf + 0.5, L, wh, 1, M.wall, { uv: 4, map: false });
    W.solid(-hf - 0.5, 0, 0, 1, wh, L, M.wall, { uv: 4, map: false }); W.solid(hf + 0.5, 0, 0, 1, wh, L, M.wall, { uv: 4, map: false }); }

  // ================= 4) JOYLAR =================
  // --- Halokat joyi (boshlang'ich lager) ---
  { const x = WILD.start.x, z = WILD.start.z;
    W.truckWreck(x + 7, z + 8, false); W.carWreck(x - 9, z + 6, true);
    bags(x + 3, z - 6, 4, 0.7); bags(x - 6, z - 3, 0.7, 3.4);
    W.crateStack(x - 5, z + 9); fire(x + 2, z + 4);
    W.supplyPos = new THREE.Vector3(x + 6, 0, z - 2); W.solid(x + 6, 0, z - 2, 1.4, 0.9, 0.9, M.supply, { mapColor: '#3c8a3c' });   // o'q-dori qutisi (oddiy rejimlar uchun)
    W.weaponCrate(x - 3, z - 4, 'smg'); W.itemSpot(x + 4, z + 1); W.itemSpot(x - 2, z + 6); }

  // --- Oqtepa qishlog'i ---
  { fence(-268, 214, -246, 214); fence(-238, 214, -206, 214); fence(-204, 212, -170, 212); fence(-268, 200, -268, 214);
    fence(-268, 160, -246, 160); fence(-234, 160, -219, 160); fence(-211, 160, -202, 160); fence(-190, 160, -168, 160);   // (x = −215 da yo'l uchun ochiq joy)
    W.solid(-208, 0, 194, 1.6, 0.9, 1.6, M.concrete, { uv: 1.2 }); W.deco(new THREE.BoxGeometry(2.2, 0.12, 2.2), M.trim, -208, 2.2, 194); for (const a of [-1, 1]) W.deco(new THREE.BoxGeometry(0.12, 1.3, 0.12), M.trim, -208 + a * 0.9, 1.55, 194);   // quduq
    W.shed(-222, 150, 8, 6); hay(-250, 190, false); hay(-248.4, 191.6, true); W.carWreck(-200, 181, false);
    W.weaponCrate(-221, 193, 'shotgun'); W.crateStack(-188, 194); W.barrels(-236, 180);
    for (const [x, z] of [[-228, 176], [-204, 176], [-166, 176], [-270, 196], [-214, 216], [-186, 220]]) if (W.freeSpot(x, z, 1.5)) anyTree(x, z); }

  // --- Ferma ---
  { W.shed(-300, -50, 8, 6);
    W.deco(new THREE.CylinderGeometry(2.6, 2.6, 11, 16), M.metal, -292, 5.5, -98); W.deco(new THREE.ConeGeometry(2.8, 1.6, 16), M.roof, -292, 11.8, -98); box(-294.4, 0, -100.4, -289.6, 11, -95.6); W.clear.push({ x: -292, z: -98, r: 4 });   // silos
    W.plane(fieldM, -338, 0.013, -128, 84, 64).material.map.repeat.set(21, 16);
    const f2 = W.plane(fieldM.clone(), -206, 0.013, -128, 56, 64); f2.material.map = fieldM.map.clone(); f2.material.map.needsUpdate = true; f2.material.map.repeat.set(14, 16);
    W.clearRect(-338, -128, 84, 64); W.clearRect(-206, -128, 56, 64);
    fence(-296, -160, -234, -160); fence(-380, -96, -296, -96); fence(-234, -96, -178, -96); fence(-296, -160, -296, -96, 1.15); fence(-234, -160, -234, -96);
    fence(-312, -40, -312, -64); fence(-312, -34, -290, -34); fence(-228, -34, -228, -66);
    for (const [x, z, r] of [[-262, -60, 0], [-260.3, -61.6, 1], [-258.5, -60, 0], [-282, -64, 1], [-330, -84, 0], [-350, -84, 1], [-210, -84, 0]]) hay(x, z, r);
    W.carWreck(-252, -70, true); W.weaponCrate(-262, -68, 'ar'); W.barrels(-286, -72); W.crateStack(-246, -64); fire(-256, -46, false); }

  // --- Yoqilg'i shoxobchasi ---
  { const x = -30, z = 128;
    for (const a of [-1, 1]) for (const b of [-1, 1]) W.solid(x + a * 6, 0, z + b * 4, 0.4, 4.4, 0.4, M.steel, { map: false, uv: 2 });
    W.solid(x, 4.4, z, 14, 0.35, 10, M.metal, { uv: 2.6, map: false }); W.mapBlds.push({ x, z, w: 14, d: 10, k: 'roof' });
    for (const a of [-1, 1]) { W.solid(x + a * 3, 0, z, 0.6, 1.5, 1.0, M.metal, { map: false }); W.deco(new THREE.BoxGeometry(0.5, 0.35, 0.06), M.trim, x + a * 3, 1.15, z + 0.53); W.solid(x + a * 3, 0, z, 1.6, 0.18, 2.4, M.concrete, { map: false, collide: false }); }
    W.clearRect(x, z, 16, 12);
    W.deco(new THREE.CylinderGeometry(1.3, 1.3, 5.2, 14), M.metal, -46, 1.5, 150, PI / 2, 0, 0); box(-47.3, 0, 147.4, -44.7, 2.8, 152.6); W.clear.push({ x: -46, z: 150, r: 3.5 });   // yoqilg'i sisternasi
    W.solid(-16, 0, 117, 0.25, 6.5, 0.25, M.steel, { map: false }); W.deco(new THREE.BoxGeometry(2.6, 1.3, 0.2), M.containers[0], -16, 6, 117);   // narx ustuni
    W.carWreck(-42, 119, false); W.carWreck(-16, 133, true); W.barrels(-22, 144); W.crateStack(-40, 142);
    W.weaponCrate(-22, 136, 'smg'); bags(-38, 122, 0.7, 3.4); }

  // --- Shaharcha: chorraha, bozor rastalari, to'siqlar ---
  { W.colonnade(84, -22, 3, false); W.shed(60, -24, 4, 3); W.shed(60, -37, 4, 3); W.shed(80, -38, 4, 3);
    W.carWreck(70, -52, true); W.carWreck(66, -4, true); W.carWreck(98, -30, false); W.truckWreck(44, -30, false);
    W.barrier(76, -14, true, 2); W.barrier(64, -44, true, 2); bags(74.5, 22, 4, 0.7); bags(22, -31, 0.7, 4);
    W.weaponCrate(77, -24, 'ar'); W.weaponCrate(44, -58, 'shotgun'); W.crateStack(100, -34); W.barrels(46, 2); W.crateStack(120, -26); W.barrels(122, 4);
    W.container(128, -52, true); W.container(128, -45, true);
    for (const [x, z] of [[46, -84], [24, -22], [124, -22], [78, 24], [26, 26], [126, 26], [62, -84], [100, -86]]) if (W.freeSpot(x, z, 1.5)) anyTree(x, z); }

  // --- Temir yo'l bekati: perron, vagonlar ---
  { W.solid(195, 0, 4, 3.4, 0.5, 44, M.concrete, { uv: 2.4 }); W.shed(197, -24, 4.6, 8, 3.2);
    for (const z of [-36, -28.6, -21.2, 30, 37.4]) { W.container(190, z, true); for (const a of [-2.3, 2.3]) W.deco(new THREE.BoxGeometry(2.2, 0.5, 1.1), M.metal, 190, 0.25, z + a, 0, 0, 0, false); }
    W.solid(190, 0, 46.4, 2.8, 3.3, 9, M.burnt, { uv: 2.4, map: false }); W.solid(190, 3.3, 49, 2.6, 0.9, 3.4, M.burnt, { map: false });   // teplovoz
    W.crateStack(199, 14); W.barrels(199.4, -6); W.weaponCrate(200, 22, 'smg'); W.carWreck(212, -10, false); fence(210, 12, 226, 12); fence(226, -8, 226, 12); }

  // --- Radio minora ---
  { const x = -130, z = -296, m = M.steel;
    for (const a of [-1, 1]) for (const b of [-1, 1]) { const leg = W.deco(new THREE.BoxGeometry(0.22, 34, 0.22), m, x + a * 1.1, 17, z + b * 1.1); leg.rotation.set(-b * 0.062, 0, a * 0.062); }
    for (let i = 1; i < 8; i++) { const y = i * 4, s = 2.2 * (1 - i / 9.5) + 0.25; W.deco(new THREE.BoxGeometry(s, 0.1, 0.1), m, x, y, z - s / 2, 0, 0, 0, false); W.deco(new THREE.BoxGeometry(s, 0.1, 0.1), m, x, y, z + s / 2, 0, 0, 0, false); W.deco(new THREE.BoxGeometry(0.1, 0.1, s), m, x - s / 2, y, z, 0, 0, 0, false); W.deco(new THREE.BoxGeometry(0.1, 0.1, s), m, x + s / 2, y, z, 0, 0, 0, false); }
    W.deco(new THREE.CylinderGeometry(0.05, 0.05, 6, 6), m, x, 37, z); W.deco(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3020, fog: false }), x, 40.1, z);
    box(x - 1.4, 0, z - 1.4, x + 1.4, 30, z + 1.4); W.clear.push({ x, z, r: 4 });
    W.bunker(-146, -294, 1, 3); W.tower(-114, -278);
    W.solid(-126, 0, -299, 1.8, 1.2, 1.1, M.metal, { map: false }); W.solid(-123.8, 0, -299, 1.1, 1.1, 1.1, M.crate, { map: false });   // generator
    bags(-130, -268, 5, 0.7); bags(-112, -292, 0.7, 4.5); bags(-148, -276, 0.7, 4.5); W.barrier(-136, -306, false, 2);
    W.weaponCrate(-123, -286, 'lmg'); fire(-136, -282); W.itemSpot(-128, -290); W.itemSpot(-120, -296);
    W.clear.push({ x: -130, z: -286, r: 13 }); }

  // --- Chorvoq qishlog'i ---
  { W.shed(292, 222, 8, 6); fence(208, 234, 240, 234); fence(254, 236, 280, 236); fence(206, 180, 232, 180); fence(256, 180, 294, 180);
    hay(280, 208, false); hay(281.6, 209.6, true); W.carWreck(228, 204, false); W.barrels(262, 212); W.crateStack(210, 208);
    W.weaponCrate(258, 199, 'sniper');
    for (const [x, z] of [[240, 178], [204, 216], [298, 200], [264, 236], [232, 236]]) if (W.freeSpot(x, z, 1.5)) anyTree(x, z); }

  // --- Harbiy baza: devor, darvozalar, dotlar, minoralar, vertolyot maydoni ---
  { const x0 = 232, x1 = 360, z0 = -332, z1 = -198, h = 3.2, t = 0.6, wall = (ax, az, bx, bz) => W.solid((ax + bx) / 2, 0, (az + bz) / 2, Math.abs(bx - ax) + t, h, Math.abs(bz - az) + t, M.concrete, { uv: 3 });
    wall(x0, z0, x1, z0); wall(x1, z0, x1, z1); wall(x0, z0, x0, -266.5); wall(x0, -257.5, x0, z1); wall(x0, z1, 292.5, z1); wall(299.5, z1, x1, z1);
    for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x0, z0, x0, -266.5], [x0, -257.5, x0, z1], [x0, z1, 292.5, z1], [299.5, z1, x1, z1]])
      W.deco(new THREE.BoxGeometry(Math.abs(bx - ax) + 0.2, 0.28, Math.abs(bz - az) + 0.2), wireM, (ax + bx) / 2, h + 0.2, (az + bz) / 2, 0, 0, 0, false);   // tikanli sim
    // dotlar: darvoza yo'lagining ikki yonida (tuynuklari yo'lakka qaragan) va maydon ortida; burchaklarda minoralar
    W.bunker(242, -250, 0); W.bunker(242, -274, 2); W.bunker(346, -262, 3, 2); W.tower(240, -324); W.tower(352, -206);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(10, 48), padM); pad.rotation.x = -PI / 2; pad.position.set(300, 0.03, -275); pad.receiveShadow = true; S.add(pad);
    W.clear.push({ x: 300, z: -275, r: 13 });
    bags(300, -289, 6, 0.7); bags(286, -275, 0.7, 6); bags(314, -275, 0.7, 6); bags(292, -262, 4, 0.7); bags(308, -262, 4, 0.7);
    W.container(322, -250, false); W.container(322, -246.9, false); W.container(322, -248.4, false, 1); W.container(350, -290, true); W.container(346, -240, true);
    W.tankWreck(280, -246, false); W.hedgehog(222, -252); W.hedgehog(222, -272); W.teeth(216, -240, true, 5); W.teeth(216, -284, true, 5);
    W.barrier(250, -262, true, 1); W.barrier(296, -206, false, 1);
    W.deco(new THREE.CylinderGeometry(1.4, 1.4, 6, 14), M.metal, 352, 1.6, -322, PI / 2, 0, 0); box(350.6, 0, -325, 353.4, 3, -319); W.clear.push({ x: 352, z: -322, r: 4 });
    W.solid(300, 0, -240, 0.2, 9, 0.2, M.steel, { map: false });   // bayroq ustuni
    W.weaponCrate(290, -252, 'lmg'); W.weaponCrate(318, -294, 'ar'); W.weaponCrate(270, -226, 'sniper');
    W.crateStack(312, -298); W.barrels(274, -296); W.crateStack(342, -300); fire(290, -286); fire(310, -264, false);
    W.itemSpot(296, -268); W.itemSpot(304, -282); W.itemSpot(250, -240); }

  // ================= 5) ELEKTR UZATISH LINIYASI (janubi-g'arbdan harbiy bazagacha) =================
  { const pts = []; for (let i = 0; i <= 9; i++) pts.push([-380 + i * 68, 60 - i * 26]);
    const top = 19, armW = 5.2;
    pts.forEach(([x, z], i) => {
      if (!W.freeSpot(x, z, 1.6)) { x += 7; z += 5; pts[i] = [x, z]; }
      for (const a of [-1, 1]) for (const b of [-1, 1]) { const leg = W.deco(new THREE.BoxGeometry(0.2, top, 0.2), M.steel, x + a * 0.8, top / 2, z + b * 0.8); leg.rotation.set(-b * 0.075, 0, a * 0.075); }
      W.deco(new THREE.BoxGeometry(0.16, 0.16, armW * 2), M.steel, x, top, z); W.deco(new THREE.BoxGeometry(0.16, 0.16, armW * 1.3), M.steel, x, top - 3.2, z);
      box(x - 1.1, 0, z - 1.1, x + 1.1, 12, z + 1.1); W.clear.push({ x, z, r: 2.5 });
    });
    for (let i = 0; i < pts.length - 1; i++) {   // simlar (ikki ustun orasida biroz osilgan)
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
      for (const o of [-armW + 0.3, 0, armW - 0.3]) for (const half of [0, 1]) {
        const w = W.deco(new THREE.BoxGeometry(0.035, 0.035, len / 2 + 0.05), wireM, 0, 0, 0, 0, 0, 0, false), t = half ? 0.75 : 0.25;
        w.position.set(ax + (bx - ax) * t, top - 0.7, az + (bz - az) * t + o); w.rotation.order = 'YXZ'; w.rotation.set(half ? -0.045 : 0.045, yaw, 0);
      }
    } }

  // ================= 6) TABIAT: o'rmonlar, yakka daraxtlar, xarsanglar =================
  forest(-392, -392, -168, -150, 210); forest(206, -170, 392, 150, 150); forest(-120, 232, 170, 392, 130);
  forest(-392, 36, -250, 292, 50, 3); forest(-392, -392, 392, 392, 110, 4); forest(-160, -150, 20, 80, 30, 5);
  for (let i = 0, t = 0; i < 46 && t < 900; t++) { const x = W.r(-hf + 8, hf - 8), z = W.r(-hf + 8, hf - 8); if (!W.freeSpot(x, z, 4)) continue; rock(x, z, W.r(1.1, 2.6)); i++; }
  // yo'l chetlaridagi tashlandiq mashinalar va to'siqlar
  for (const [x, z, r] of [[-150, 114, 0], [-96, 106, 0], [150, 114, 0], [310, 106, 0], [74, 70, 1], [66, -120, 1], [74, -180, 1], [140, -258, 0], [-322, 200, 1]]) { if (W.freeSpot(x, z, 0.5) || true) W.carWreck(x, z, !!r); }
  W.barrier(60, 96, false, 2); W.barrier(110, -262, true, 2); W.hedgehog(-60, 110); W.hedgehog(-56, 113);

  // ================= 7) TUNGI CHIROQLAR (12 ta — shader chegarasi): muhim joylarda =================
  if (W.night) for (const [x, z] of [[-212, 180], [-34, 122], [-26, 134], [66, -26], [74, -34], [194, 14], [-262, -44], [-126, -280], [228, -270], [294, -266], [306, -284], [254, 200]]) W.lampPost(x, z);

  // ================= 7.5) TIRILTIRISH PUNKTLARI: tibbiy chodirlar (zombi rejimi) =================
  W.revivePts = WILD.revive.map((R) => Object.assign({}, R, medTent(W, R)));

  // ================= 8) VOSITALAR (ochiq joylarda) VA PAYDO BO'LISH NUQTALARI =================
  for (const [x, z] of [[-290, 250], [-150, 150], [-100, 20], [0, -120], [150, 60], [-300, -200], [-40, -260], [120, -200], [320, 60], [150, 300], [-60, 300], [340, -120], [200, -80], [-180, -60]]) if (W.freeSpot(x, z, 1.2)) W.itemSpot(x, z);
  for (let x = -hf + 30; x < hf; x += 52) for (let z = -hf + 30; z < hf; z += 52) if (W.freeSpot(x, z, 2)) W.spawns.push(new THREE.Vector3(x, 0, z));

  // har chodir stolida bitta defibrillyator (raqamlari oxirida — boshqa vositalar raqami o'zgarmasin)
  for (const R of W.revivePts) W.itemSpots.push({ x: R.tx, y: 0.8, z: R.tz, kind: 'defib' });
  W.backdrop();
}

// Tiriltirish punkti: tibbiy chodir — tomida qizil xoch, ichida ratsiya va dori-darmon stoli, zambil, chiroq.
// R — WILD.revive yozuvi (js/shared.mjs). Ochiq old tomoni (R.fx, R.fz) nuqtaga qaraydi.
// Qaytaradi: { cross — tepadagi belgi (faol punktda ko'rinadi), tx, tz — stol (defibrillyator) joyi, yaw — chodir yo'nalishi }
let _glow = null;
const glowTex = () => _glow || (_glow = tex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
const crossTex = () => tex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d0141c'; g.fillRect(w * 0.4, h * 0.18, w * 0.2, h * 0.64); g.fillRect(w * 0.18, h * 0.4, w * 0.64, h * 0.2); });
function medTent(W, R) {
  const S = W.scene, H = W.H, yaw = Math.atan2(R.fx - R.x, R.fz - R.z), c = Math.cos(yaw), s = Math.sin(yaw);
  const P = (lx, lz) => [R.x + lx * c + lz * s, R.z - lx * s + lz * c];
  const col = H ? '#c3c6b8' : '#d2c9ae';
  const canvasM = new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, side: THREE.DoubleSide });
  const roofM = new THREE.MeshStandardMaterial({ map: tex(128, 128, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(80,70,50,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#f4f2ea'; g.fillRect(w * 0.29, h * 0.2, w * 0.42, h * 0.6);
    g.fillStyle = '#c8141c'; g.fillRect(w * 0.44, h * 0.27, w * 0.12, h * 0.46); g.fillRect(w * 0.36, h * 0.43, w * 0.28, h * 0.14);
  }), roughness: 0.95, side: THREE.DoubleSide });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x2b2f2a, roughness: 0.8, metalness: 0.4 }), olive = new THREE.MeshStandardMaterial({ color: 0x46503a, roughness: 0.7, metalness: 0.3 });
  const whiteM = new THREE.MeshStandardMaterial({ color: 0xe8e6de, roughness: 0.6 }), tarpM = new THREE.MeshStandardMaterial({ color: 0x3c4632, roughness: 1 });
  const place = (geo, mat, lx, y, lz, shadow = true) => { geo.rotateY(yaw); const [x, z] = P(lx, lz); return W.deco(geo, mat, x, y, z, 0, 0, 0, shadow); };
  // pol, tom (ikki qiya panel), orqa va yon devorlar, uchburchak peshtoqlar, old tomonda o'ralgan eshik pardasi
  place(new THREE.BoxGeometry(4.4, 0.02, 3.6), tarpM, 0, 0.01, 0, false);
  for (const sd of [1, -1]) { const g = new THREE.BoxGeometry(4.75, 0.05, 2.2); g.rotateX(sd * 0.568); place(g, roofM, 0, 2.12, sd * 0.9); }
  place(new THREE.BoxGeometry(4.6, 1.55, 0.05), canvasM, 0, 0.775, -1.8);
  for (const sd of [-1, 1]) {
    place(new THREE.BoxGeometry(0.05, 1.55, 3.6), canvasM, sd * 2.3, 0.775, 0);
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.55, -1.8, 0, 1.55, 1.8, 0, 2.7, 0], 3)); tri.computeVertexNormals();
    place(tri, canvasM, sd * 2.3, 0, 0);
    const pole = new THREE.CylinderGeometry(0.035, 0.035, 2.7, 6); pole.translate(0, 1.35, 0); place(pole, darkM, sd * 2.25, 0, 0);
  }
  { const g = new THREE.CylinderGeometry(0.1, 0.1, 4.5, 8); g.rotateZ(Math.PI / 2); place(g, canvasM, 0, 1.5, 1.8); }
  // stol: ratsiya (ochiq quti, antenna) va oq tibbiy quti; yonida zambil
  const tl = -1.05;
  place(new THREE.BoxGeometry(1.6, 0.05, 0.72), olive, 0, 0.78, tl);
  for (const [a, b] of [[-0.72, -0.3], [0.72, -0.3], [-0.72, 0.3], [0.72, 0.3]]) place(new THREE.BoxGeometry(0.05, 0.78, 0.05), darkM, a, 0.39, tl + b);
  place(new THREE.BoxGeometry(0.46, 0.3, 0.3), olive, -0.45, 0.955, tl - 0.08);
  place(new THREE.BoxGeometry(0.36, 0.12, 0.02), darkM, -0.45, 1.0, tl + 0.075);
  { const g = new THREE.CylinderGeometry(0.008, 0.012, 1.1, 4); g.translate(0, 0.55, 0); place(g, darkM, -0.62, 1.1, tl - 0.15); }
  place(new THREE.BoxGeometry(0.5, 0.22, 0.32), whiteM, 0.55, 0.92, tl);
  place(new THREE.BoxGeometry(0.7, 0.05, 1.95), olive, 1.55, 0.42, 0.25);
  place(new THREE.BoxGeometry(0.62, 0.04, 1.8), new THREE.MeshStandardMaterial({ color: 0x6a7058, roughness: 1 }), 1.55, 0.465, 0.25);
  for (const [a, b] of [[-0.3, -0.9], [0.3, -0.9], [-0.3, 0.9], [0.3, 0.9]]) place(new THREE.BoxGeometry(0.04, 0.42, 0.04), darkM, 1.55 + a, 0.21, 0.25 + b);
  // chiroq (tunda ko'rinadi) va tepadagi qizil xoch belgisi (punkt faol bo'lganda)
  const [lx, lz] = P(0, 0.3);
  const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75 }));
  lamp.scale.set(1.6, 1.6, 1); lamp.position.set(lx, 2.35, lz); lamp.userData.dyn = true; S.add(lamp);
  W.deco(new THREE.BoxGeometry(0.14, 0.2, 0.14), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }), lx, 2.4, lz, 0, 0, 0, false);
  const cross = new THREE.Sprite(new THREE.SpriteMaterial({ map: crossTex(), depthWrite: false, transparent: true, fog: false }));
  cross.scale.set(1.05, 1.05, 1); cross.position.set(R.x, 4.3, R.z); cross.userData.dyn = true; cross.visible = false; S.add(cross);
  W.clear.push({ x: R.x, z: R.z, r: 3.4 });
  const [tx, tz] = P(0.55, tl);
  return { cross, tx, tz, yaw };
}
