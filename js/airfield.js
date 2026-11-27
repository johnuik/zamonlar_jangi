// ================= AERODROM =================
// 280 × 280 m harbiy aerodrom. Tuzilishi boshqa xaritalarga o'xshamaydi: o'rtada uzun OCHIQ uchish yo'lagi (snayper va transport uchun),
// janubida beton maydon, uch angar, boshqaruv minorasi, terminal va yoqilg'i ombori; shimolida dala — dotlar, zenit pushkalari, radar.
// Yo'lakni kesib o'tish xavfli: pana — faqat samolyot qoldiqlari. Uy-ko'cha yo'q; janglar angarlar ichida va maydon chetlarida ketadi.
// Transport joylari — js/shared.mjs (AIR_VEH). W — World nusxasi (js/world.js).
import * as THREE from '../lib/three.module.js';
import { mapKit } from './wild.js';

export function buildAirfield(W) {
  const H = W.H, hf = W.half, M = W.mat, S = W.scene, PI = Math.PI;
  W.roads = [];
  const { road, fence, rock, anyTree, bags, fire, box, padM, wireM } = mapKit(W);
  W.playerSpawn = new THREE.Vector3(8, 0, 68);
  for (const v of W.vehSpawns) W.clear.push({ x: v.x, z: v.z, r: v.type === 'chinook' ? 11 : v.type === 'heli' ? 9 : v.type === 'truck' || v.type === 'tank' || v.type === 'ltank' ? 7 : 5 });
  W.clear.push({ x: 0, z: 2, r: 6 });   // bayroq joyi (bayroq rejimi)

  const markM = new THREE.MeshStandardMaterial({ color: 0xe6e3d6, roughness: 0.9 });
  const planeM = new THREE.MeshStandardMaterial({ color: H ? 0x566050 : 0xb4b8bc, roughness: 0.5, metalness: 0.45 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x1c2a33, roughness: 0.15, metalness: 0.6 });
  const mark = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), markM); m.rotation.x = -PI / 2; m.position.set(x, 0.024, z); m.receiveShadow = true; S.add(m); };

  // ================= 1) BINOLAR =================
  // uch angar (darvozalari shimolga — beton maydonga qaragan), terminal, kazarmalar
  W.warehouse({ x: -84, z: 90, w: 22, d: 26, sp: 0 });
  W.warehouse({ x: -52, z: 90, w: 22, d: 26, sp: 1 });
  W.warehouse({ x: -20, z: 90, w: 22, d: 26, sp: 2 });
  W.house2({ x: 30, z: 86, w: 14, d: 10 });
  for (const hd of [{ x: 82, z: 120, w: 14, d: 9 }, { x: 104, z: 120, w: 14, d: 9 }, { x: -118, z: 118, w: 12, d: 9 }]) W.house(hd);

  W.buildGround();

  // ================= 2) UCHISH YO'LAGI, RULYOJKA, BETON MAYDON, YO'LLAR =================
  road(-126, -40, 126, -40, 30, 'w');                                   // uchish yo'lagi (g'arb — sharq)
  road(-112, 10, 112, 10, 12, 'c');                                     // rulyojka
  for (const x of [-100, 0, 100]) road(x, -25, x, 4, 12, 'c');          // yo'lakka chiqishlar
  road(-112, 46, 64, 46, 60, 'c');                                      // beton maydon (angarlar oldi) — x: −112..64, z: 16..76
  road(0, 76, 0, hf, 7); road(-126, 132, 126, 132, 5, 'd'); road(64, 46, 124, 46, 6, 'd');   // darvoza yo'li, xizmat yo'llari
  // yo'lak belgilari: o'q chizig'i, chet chiziqlar, bo'sag'a yo'llari
  for (let x = -108; x <= 108; x += 14) mark(x, -40, 7, 0.5);
  mark(0, -54.4, 250, 0.35); mark(0, -25.6, 250, 0.35);
  for (const sx of [-1, 1]) for (let i = -5; i <= 5; i++) mark(sx * 120, -40 + i * 2.4, 8, 1.1);
  for (let x = -108; x <= 108; x += 9) mark(x, 10, 3.5, 0.22);
  // yo'lak chetidagi chiroqlar (past, to'siq emas)
  for (let x = -120; x <= 120; x += 20) for (const z of [-56.2, -23.8]) W.deco(new THREE.BoxGeometry(0.25, 0.3, 0.25), wireM, x, 0.15, z, 0, 0, 0, false);

  // ================= 3) CHEGARA =================
  { const wh = 5, L = hf * 2 + 2;
    W.solid(0, 0, -hf - 0.5, L, wh, 1, M.wall, { uv: 4 }); W.solid(0, 0, hf + 0.5, L, wh, 1, M.wall, { uv: 4 });
    W.solid(-hf - 0.5, 0, 0, 1, wh, L, M.wall, { uv: 4 }); W.solid(hf + 0.5, 0, 0, 1, wh, L, M.wall, { uv: 4 }); }

  // ================= 4) SAMOLYOTLAR =================
  // Yuk samolyoti: korpus (to'siq), baland qanotlar (ostidan o'tsa bo'ladi), dum. ax — korpus yo'nalishi ('x' yoki 'z'); wreck — halokatga uchragan.
  const aircraft = (x, z, ax, wreck) => {
    const m = wreck ? M.burnt : planeM, L = 17, R = 1.55, yc = 2.5, alongX = ax === 'x';
    const fus = W.deco(new THREE.CylinderGeometry(R, R, L, 14), m, x, yc, z, 0, 0, PI / 2); if (!alongX) fus.rotation.set(PI / 2, 0, 0);
    const nose = W.deco(new THREE.ConeGeometry(R, 3.2, 14), m, x + (alongX ? L / 2 + 1.6 : 0), yc, z + (alongX ? 0 : L / 2 + 1.6), 0, 0, -PI / 2); if (!alongX) nose.rotation.set(PI / 2, 0, 0);
    const tail = W.deco(new THREE.ConeGeometry(R, 4.4, 14), m, x - (alongX ? L / 2 + 2.2 : 0), yc + 0.3, z - (alongX ? 0 : L / 2 + 2.2), 0, 0, PI / 2); if (!alongX) tail.rotation.set(-PI / 2, 0, 0);
    W.deco(new THREE.BoxGeometry(alongX ? 3 : 0.25, 3.6, alongX ? 0.25 : 3), m, x - (alongX ? L / 2 + 2.4 : 0), yc + 2.6, z - (alongX ? 0 : L / 2 + 2.4));                    // kil (dum)
    W.deco(new THREE.BoxGeometry(alongX ? 2.2 : 7, 0.2, alongX ? 7 : 2.2), m, x - (alongX ? L / 2 + 2.6 : 0), yc + 0.9, z - (alongX ? 0 : L / 2 + 2.6));                     // dum qanotchasi
    box(x - (alongX ? L / 2 : R), 0.85, z - (alongX ? R : L / 2), x + (alongX ? L / 2 : R), yc + R, z + (alongX ? R : L / 2));                                                // korpus (ostidan yotib o'tsa bo'ladi)
    for (const s of [-1, 1]) {
      const wl = 11, drop = wreck && s > 0;   // halokatda bir qanot yerga tushgan
      const wx = x + (alongX ? 0.6 : s * (R + wl / 2 - 0.2)), wz = z + (alongX ? s * (R + wl / 2 - 0.2) : 0.6), wy = drop ? 0.35 : yc + 1.15;
      const wing = W.deco(new THREE.BoxGeometry(alongX ? 3.4 : wl, 0.28, alongX ? wl : 3.4), m, wx, wy, wz);
      if (drop) { wing.rotation.set(alongX ? 0.05 : 0, 0.18, alongX ? 0 : 0.05); box(wx - (alongX ? 1.7 : wl / 2), 0, wz - (alongX ? wl / 2 : 1.7), wx + (alongX ? 1.7 : wl / 2), 0.6, wz + (alongX ? wl / 2 : 1.7)); }
      else {
        const ex = x + (alongX ? 1.2 : s * (R + 3.6)), ez = z + (alongX ? s * (R + 3.6) : 1.2);
        const eng = W.deco(new THREE.CylinderGeometry(0.62, 0.62, 3, 10), m, ex, wy - 0.75, ez, 0, 0, PI / 2); if (!alongX) eng.rotation.set(PI / 2, 0, 0);
        W.solid(ex, 0, ez, 0.4, wy - 1.3, 0.4, M.steel, { map: false });   // shassi ustuni
        W.deco(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 10), wireM, ex, 0.45, ez, alongX ? PI / 2 : 0, 0, alongX ? 0 : PI / 2);
      }
    }
    W.solid(x + (alongX ? L / 2 - 1.5 : 0), 0, z + (alongX ? 0 : L / 2 - 1.5), 0.4, 0.9, 0.4, M.steel, { map: false });   // old shassi
    W.clear.push({ x, z, r: 11 });
    if (wreck) { W.fires.push(new THREE.Vector3(x + (alongX ? -3 : 1.8), 1.0, z + (alongX ? 1.8 : -3))); W.smokes.push(new THREE.Vector3(x, 3.5, z)); }
  };
  aircraft(-34, -42, 'x', true);     // yo'lak o'rtasida halokatga uchragan — yagona katta pana
  aircraft(74, -36, 'x', false);     // yo'lak sharqida turib qolgan
  aircraft(22, 40, 'z', false);      // beton maydonda turgan
  aircraft(40, -92, 'x', true);      // dalaga qulagan

  // ================= 5) BOSHQARUV MINORASI VA TERMINAL OLDI =================
  { const x = 50, z = 84;
    W.solid(x, 0, z, 5, 15, 5, M.concrete, { uv: 3 });
    W.solid(x, 15, z, 7.6, 0.4, 7.6, M.concrete, { map: false, uv: 3 }); W.solid(x, 15.4, z, 7, 2.6, 7, glassM, { map: false }); W.solid(x, 18, z, 8, 0.35, 8, M.metal, { map: false, uv: 2.6 });
    W.deco(new THREE.CylinderGeometry(0.05, 0.08, 5, 6), M.steel, x + 2, 20.8, z - 2); W.deco(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3020, fog: false }), x + 2, 23.4, z - 2);
    W.clear.push({ x, z, r: 6 });
    W.supplyPos = new THREE.Vector3(14, 0, 72); W.solid(14, 0, 72, 1.4, 0.9, 0.9, M.supply, { mapColor: '#3c8a3c' });
    bags(4, 62, 4, 0.7); bags(20, 60, 0.7, 3.4); W.barrier(-4, 70, true, 2); W.crateStack(40, 74); W.barrels(22, 76); }

  // ================= 6) BETON MAYDON: konteynerlar, yuk aravalari, pana joylar =================
  W.container(-104, 24, false); W.container(-104, 27.2, false); W.container(-104, 25.6, false, 1); W.container(52, 24, true); W.container(56, 24, true);
  W.truckWreck(-70, 62, false); W.carWreck(-36, 58, true); W.carWreck(46, 60, false);
  for (const [x, z] of [[-96, 56], [-66, 30], [-30, 30], [0, 50], [-8, 26], [56, 40]]) W.crateStack(x, z);
  W.barrels(-44, 30); W.barrels(8, 64); bags(-76, 22, 4, 0.7); bags(-18, 20, 4, 0.7); bags(36, 22, 0.7, 4); W.barrier(-58, 70, false, 2); W.barrier(-26, 70, false, 2);
  W.shed(-112, 62, 8, 6);

  // ================= 7) YOQILG'I OMBORI (sharq) =================
  { const tank = (x, z) => { W.deco(new THREE.CylinderGeometry(5.2, 5.2, 8.5, 20), M.metal, x, 4.25, z); W.deco(new THREE.ConeGeometry(5.4, 1.4, 20), M.roof, x, 9.2, z); box(x - 4.2, 0, z - 4.2, x + 4.2, 8.5, z + 4.2); box(x - 5.2, 0, z - 2, x + 5.2, 8.5, z + 2); box(x - 2, 0, z - 5.2, x + 2, 8.5, z + 5.2); W.clear.push({ x, z, r: 7 }); W.mapBlds.push({ x, z, w: 9, d: 9, k: 'bunker' }); };
    tank(98, 72); tank(116, 72); tank(107, 92);
    W.solid(107, 0.5, 80.5, 22, 0.3, 0.3, M.steel, { map: false, collide: false }); W.solid(98, 0.5, 86, 0.3, 0.3, 12, M.steel, { map: false, collide: false });   // quvurlar
    fence(86, 60, 86, 104, 1.6); fence(88, 104, 126, 104, 1.6); fence(92, 60, 126, 60, 1.6);
    W.barrels(90, 96); W.barrels(122, 84); W.carWreck(80, 70, true); }

  // ================= 8) SHIMOLIY DALA: dotlar, zenit joylari, radar, xandaq o'rnida qum qoplari =================
  W.bunker(0, -106, 2, 5); W.bunker(-100, -100, 2, 6); W.bunker(100, -100, 2, 7); W.bunker(-56, -70, 2); W.bunker(56, -70, 2);
  W.tower(-128, -126, 3); W.tower(128, -126, 4); W.tower(-128, 126); W.tower(126, 14);
  { const x = -24, z = -116;   // radar
    W.solid(x, 0, z, 6, 3, 5, M.concrete, { uv: 3 }); W.deco(new THREE.CylinderGeometry(0.25, 0.3, 4, 8), M.steel, x, 5, z);
    const dish = W.deco(new THREE.SphereGeometry(3.2, 14, 8, 0, PI * 2, 0, PI / 2.3), M.steel, x, 7.4, z + 0.6); dish.rotation.set(-1.15, 0.5, 0); dish.material = planeM;
    W.clear.push({ x, z, r: 6 }); W.mapBlds.push({ x, z, w: 6, d: 5, k: 'bunker' }); }
  for (const [x, z, w, d] of [[-30, -72, 6, 0.7], [30, -72, 6, 0.7], [-80, -84, 0.7, 5], [80, -84, 0.7, 5], [0, -88, 8, 0.7], [-118, -72, 5, 0.7], [118, -72, 5, 0.7], [20, -120, 5, 0.7]]) bags(x, z, w, d);
  W.tankWreck(-72, -108, false); W.hedgehog(-14, -68); W.hedgehog(14, -68); W.teeth(-110, -62, false, 5); W.teeth(110, -62, false, 5);
  for (let i = 0, t = 0; i < 14 && t < 300; t++) { const x = W.r(-hf + 8, hf - 8), z = W.r(-hf + 8, -66); if (!W.freeSpot(x, z, 3.5)) continue; rock(x, z, W.r(1.0, 2.2)); i++; }
  fire(-6, -100, false);

  // ================= 9) DARAXTLAR (faqat chetlarda — maydonning o'zi ochiq) =================
  for (let i = 0, t = 0; i < 46 && t < 900; t++) {
    const edge = (W.rand() * 3) | 0, x = edge === 0 ? W.r(-hf + 5, hf - 5) : edge === 1 ? W.r(-hf + 5, -hf + 16) : W.r(hf - 16, hf - 5), z = edge === 0 ? W.r(-hf + 5, -hf + 18) : W.r(-hf + 5, hf - 5);
    if (!W.freeSpot(x, z, 2.4)) continue;
    anyTree(x, z); W.clear.push({ x, z, r: 0.6 }); i++;
  }
  for (const [x, z] of [[-128, 100], [-100, 132], [-60, 124], [124, 134], [60, 126], [-30, 124], [12, 108]]) if (W.freeSpot(x, z, 2)) anyTree(x, z);

  // ================= 10) VERTOLYOT MAYDONCHALARI, VOSITALAR, PAYDO BO'LISH NUQTALARI =================
  for (const v of W.vehSpawns) if (v.type === 'heli' || v.type === 'chinook') { const pad = new THREE.Mesh(new THREE.CircleGeometry(v.type === 'chinook' ? 9 : 7, 40), padM); pad.rotation.x = -PI / 2; pad.position.set(v.x, 0.03, v.z); pad.receiveShadow = true; S.add(pad); }
  for (const [x, z] of [[-110, 0], [110, 0], [0, 22], [-60, -62], [60, -62], [-120, -40], [120, -40], [0, -70], [-90, 110], [70, 100], [-10, 122], [120, 30]]) if (W.freeSpot(x, z, 1.2)) W.itemSpot(x, z);
  for (let p = -(hf - 10); p <= hf - 10; p += 20) for (const s of [new THREE.Vector3(p, 0, -(hf - 4)), new THREE.Vector3(p, 0, hf - 4), new THREE.Vector3(-(hf - 4), 0, p), new THREE.Vector3(hf - 4, 0, p)]) {
    if (W.clear.every((c) => Math.hypot(c.x - s.x, c.z - s.z) > c.r + 3) && !W.pointInBox(new THREE.Vector3(s.x, 1, s.z))) W.spawns.push(s);
  }
  W.backdrop();
}
