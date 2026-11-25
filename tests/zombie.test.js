// Zombi rejimi (yakka o'yin): tun va ko'rinish, fonar, chaqmoq, boshlang'ich qurollar, yashiklar, punktlar (A → B → C → D),
// zombilarning hujumi va oson o'lishi, transportda yoqilg'i va cheklangan o'q-dori, g'alaba va mag'lubiyat.
// Ishlatish: PORT=8191 node server.js   so'ng   node tests/zombie.test.js [historical|modern]
const { openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191, era = process.argv[2] || 'modern';
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };
const KEY = (code) => `window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' })), window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' })), 1`;

(async () => {
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9461, dir: 'p_zombie' });
  const { ev, shot } = pg;
  await sleep(2500);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, K = D.keys, Z = G.zg, W = G.world; return ${body}; })()`);
  const until = async (cond, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  const popupTxt = () => ev(`(document.getElementById('popups').lastElementChild || { textContent: '' }).textContent`);
  // menyu: zombi rejimi tanlanganda xarita "Katta shahar"ga o'tadi
  await ev(`(document.querySelectorAll('.era').forEach(e => { if (e.dataset.era === '${era}') e.click(); }), document.querySelector('#spModes [data-m=zombie]').click(), 1)`);
  await sleep(1200);
  const menu = await ev(`[window.__G.spMode, window.__G.world.half, window.__G.night, document.querySelector('#spMaps [data-map=big]').classList.contains('sel'), document.querySelector('#spMaps [data-map=town]').disabled]`);
  ok('menyu: zombi rejimi — katta xarita, tun', menu[0] === 'zombie' && menu[1] === 120 && menu[2] === true && menu[3] && menu[4], JSON.stringify(menu));
  await ev(`(document.getElementById('btnPlay').click(), 1)`); await sleep(300);
  const brief = await ev(`document.getElementById('briefTitle').textContent`);
  await ev(`(document.getElementById('briefing').click(), 1)`); await sleep(1200);
  const st = await T(`({ state: G.state, pick: !!G.pick, pos: [P.pos.x, P.pos.z], w: G.weapons.map(w => w.def.id).join(','), locked: !!G.weapons[0].locked, inf: !!G.weapons[1].inf, wi: G.wi, nades: G.grenades_n,
    pts: W.points.map(p => p.id).join(''), crates: W.crates.length, veh: G.vehicles.map(v => v.type).join(','), padsOk: G.vehicles.every(v => W.points.every(p => Math.hypot(p.x - v.pos.x, p.z - v.pos.z) > 15)), lim: G.vehicles.every(v => v.limited),
    fog: W.env.fog.far, torch: G.torchOn, slots: document.getElementById('weaponSlots').innerText.replace(/\\n/g, ' | '), obj: document.getElementById('objective').textContent })`);
  ok('brifingdan keyin klass tanlovisiz A punktida boshlanadi', /TUN/.test(brief) && st.state === 'playing' && !st.pick && st.pos[0] === -98 && st.pos[1] === 98, brief);
  ok("boshlang'ich qurollar: faqat to'pponcha (o'qi tugamaydi) va pichoq, granata yo'q", st.w === 'none,pistol,knife,nade' && st.locked && st.inf && st.wi === 1 && st.nades === 0, st.slots);
  ok('xarita: 4 punkt, 27 yashik, 9 transport tasodifiy joylarda (punktlardan uzoqda), yoqilg\'i/o\'q cheklangan', st.pts === 'ABCD' && st.crates === 27 && st.veh === 'heli,chinook,jeep,quad,cannon,cannon,tank,ltank,truck' && st.padsOk && st.lim, st.obj);
  await T(`(G.bannerT = 0.01, 1)`);
  await ev(KEY('Digit1')); await sleep(150);
  const p1 = [await T(`G.wi`), await popupTxt()];
  ok("[1] bosilganda: asosiy qurol yo'qligi aytiladi", p1[0] === 1 && /yashiklardan/.test(p1[1]), p1[1]);
  // to'pponcha o'qi tugamaydi
  const inf = await T(`(() => { const w = G.weapons[1], r0 = w.reserve; w.mag = 0; G.reloadT = 0.01; G.reloadDur = 1; return r0; })()`);
  await until(`G.weapons[1].mag === G.weapons[1].def.mag`);
  const inf2 = await T(`[G.weapons[1].reserve, document.getElementById('reserve').textContent]`);
  ok("to'pponcha: qayta o'qlaganda zaxira kamaymaydi (∞)", inf2[0] === inf && /∞/.test(inf2[1]), `${inf} → ${inf2[0]} "${inf2[1]}"`);

  // qorong'ilik: uzoqdagi zombi ko'rinmaydi, yaqindagisi ko'rinadi; chaqmoq chaqqanda hammasi bir lahzaga ko'rinadi
  await T(`(() => { P.hp = 1e9; G.soldiers.filter(s => s.isZombie).forEach(s => { s.alive = false; s.dispose(); }); Z.spawnT = 1e9;
    const f = { x: -Math.sin(P.yaw), z: -Math.cos(P.yaw) }; G.zFar = Z.spawn('walker', P.pos.x + f.x * 55, P.pos.z + f.z * 55); G.zNear = Z.spawn('walker', P.pos.x + f.x * 18, P.pos.z + f.z * 18);
    for (const z of [G.zFar, G.zNear]) z.think = () => 0; return 1; })()`);
  await sleep(500);
  const v0 = await T(`[G.zFar.root.visible, G.zNear.root.visible, W.env.fog.far]`);
  await shot(`zombie_${era}_dark`);
  await T(`(Z.lightning(1), 1)`); await until(`G.zFar.root.visible`, 800);   // ko'rinish keyingi kadrda yangilanadi
  const v1 = await T(`[G.zFar.root.visible, +W.env.fog.far.toFixed(0), +(W.flashF || 0).toFixed(2)]`);
  await shot(`zombie_${era}_flash`);
  await until(`W.flashT < 0`, 8000); await sleep(300);
  const v2 = await T(`[G.zFar.root.visible, G.zNear.root.visible, W.env.fog.far]`);
  ok("30+ m naridagi zombi qorong'ida ko'rinmaydi, yaqindagisi ko'rinadi", v0[0] === false && v0[1] === true && v0[2] === 34, JSON.stringify(v0));
  ok('chaqmoq: uzoqdagi zombi bir lahzaga ko\'rinadi, so\'ng yana ko\'rinmaydi', v1[0] === true && v1[1] > 60 && v2[0] === false && v2[1] === true && v2[2] === 34, `${JSON.stringify(v1)} → ${JSON.stringify(v2)}`);
  // fonar
  const t0 = await T(`[G.torchOn, +G.torch.intensity.toFixed(0)]`);
  await ev(KEY('KeyL')); await sleep(500);
  const t1 = await T(`[G.torchOn, +G.torch.intensity.toFixed(0), document.getElementById('objective').textContent]`);
  await ev(KEY('KeyL')); await sleep(500);
  const t2 = await T(`[G.torchOn, +G.torch.intensity.toFixed(0)]`);
  ok('[L] — fonar yonadi/o\'chadi (o\'chiq bo\'lsa, ekranda eslatma)', t0[0] === true && t0[1] > 30 && t1[0] === false && t1[1] === 0 && /\[L\]/.test(t1[2]) && t2[0] === true && t2[1] > 30, `${t0[1]} → ${t1[1]} → ${t2[1]}`);

  // zombi oson o'ladi: to'pponchadan tanaga 2 o'q, boshga 1 o'q
  // (zombi otuvchiga qaratib qo'yiladi: boshi oldinga engashgan va nishon hajmi shu joyda hisoblanadi)
  const kz = await T(`(() => { const V3 = P.pos.constructor, def = G.weapons[1].def, out = []; const k0 = G.kills;
    for (const y of [1.2, 1.63]) { const z = Z.spawn('walker', P.pos.x, P.pos.z - 12); z.think = () => 0; z.pos.y = 0; z.yaw = 0; let n = 0; while (z.alive && n < 6) { D.hitscan(new V3(P.pos.x, y, P.pos.z - 4), new V3(0, 0, -1), def); n++; } out.push(n); }
    return [out, G.kills - k0, def.dmg]; })()`);
  ok("zombi oson o'ladi: to'pponchadan tanaga 2 o'q, boshga 1 o'q", kz[0][0] === 2 && kz[0][1] === 1 && kz[1] === 2, JSON.stringify(kz));
  // zombi quvib yetadi va uradi
  await T(`(() => { G.soldiers.filter(s => s.isZombie).forEach(s => { s.alive = false; s.dispose(); }); P.hp = 100; P.pos.set(-96, 0, 90); const z = Z.spawn('runner', -96, 78); G.zA = z; return 1; })()`);
  const hurt = await until(`P.hp < 100`, 12000);
  const at = await T(`[Math.round(P.hp), +Math.hypot(G.zA.pos.x - P.pos.x, G.zA.pos.z - P.pos.z).toFixed(1), G.zA.alive]`);
  ok('zombi odamni quvib yetadi va uradi', hurt && at[1] < 2.6, `jon ${at[0]}, masofa ${at[1]} m`);
  await T(`(P.hp = 1e9, G.soldiers.filter(s => s.isZombie).forEach(s => { s.alive = false; s.dispose(); }), 1)`);

  // yashiklar: [E] — o'qi cheklangan qurol
  const crate = async (i) => {
    await T(`(P.pos.set(W.crates[${i}].x, 0, W.crates[${i}].z + 1.4), P.vel.set(0, 0, 0), 1)`); await sleep(350);
    const pr = await ev(`document.getElementById('prompt').textContent`);
    await ev(KEY('KeyE')); await sleep(350);
    return [pr, ...(await T(`[G.weapons[0].def.id, G.weapons[0].mag + G.weapons[0].reserve, G.wi, W.crates[${i}].open, W.crates[${i}].kind]`))];
  };
  const c0 = await crate(0), c5 = await crate(5), c2 = await crate(2), c1 = await crate(1);
  ok('yashik: [E] bilan ochiladi, qurol darhol qo\'lga olinadi', /yashigini ochish/.test(c0[0]) && c0[1] === 'smg' && c0[3] === 0 && c0[4] === true, c0[0]);
  ok("o'q-dori cheklangan: PP 300, snayper 20, avtomat 300, drobovik 40 (jami)", c0[2] === 300 && c5[1] === 'sniper' && c5[2] === 20 && c2[1] === 'ar' && c2[2] === 300 && c1[1] === 'shotgun' && c1[2] === 40, JSON.stringify([c0[2], c5[2], c2[2], c1[2]]));
  await T(`(P.pos.set(W.crates[0].x, 0, W.crates[0].z + 1.4), 1)`); await sleep(300);
  ok('ochilgan yashik qayta ochilmaydi', (await ev(`getComputedStyle(document.getElementById('prompt')).display`)) === 'none' || !/yashig/.test(await ev(`document.getElementById('prompt').textContent`)));
  await shot(`zombie_${era}_crate`);

  // transport: yoqilg'i va o'q-dori
  const veh = await T(`(() => { const j = G.vehicles[2]; P.pos.set(j.pos.x + 2.2, 0, j.pos.z); P.vel.set(0, 0, 0); return [j.fuel, j.limited]; })()`);
  await sleep(400); await ev(KEY('KeyF')); await sleep(400);
  await T(`(K.KeyW = true, 1)`); await until(`G.inVeh && G.inVeh.fuel < 0.985`, 15000);
  const f1 = await T(`[G.inVeh && G.inVeh.type, +G.inVeh.fuel.toFixed(3), document.getElementById('vehName').textContent]`);
  await T(`(G.inVeh.fuel = 0.0005, 1)`); await until(`G.inVeh.fuel <= 0 && Math.abs(G.inVeh.speed) < 0.3`, 9000);
  const f2 = await T(`[G.inVeh.fuel, +G.inVeh.speed.toFixed(2), G.inVeh.immobile, document.getElementById('vehName').textContent]`);
  await T(`(K.KeyW = false, 1)`);
  ok("jip: yurganda yoqilg'i kamayadi va ekranda ko'rsatiladi", f1[0] === 'jeep' && f1[1] <= 0.985 && /yoqilg'i \d+%/.test(f1[2]), f1[2]);
  ok("yoqilg'i tugasa transport to'xtaydi", f2[0] === 0 && Math.abs(f2[1]) < 0.3 && f2[2] === true && /TUGADI/.test(f2[3]), f2[3]);
  await ev(KEY('KeyF')); await sleep(400);
  const am = await T(`(() => { const h = G.vehicles[0]; D.enterVehicle(h, 0); return [h.ammo.a, h.rockets]; })()`);
  await sleep(300);
  await T(`(G.vFireT = 0, D.mouse.L = true, 1)`); await until(`G.vehicles[0].ammo.a < ${am[0]} - 2`); await T(`(D.mouse.L = false, 1)`);
  const am1 = await T(`[G.vehicles[0].ammo.a, document.getElementById('vehName').textContent]`);
  const s0 = await T(`(G.vehicles[0].ammo.a = 0, G.vehicles[0].gun.heat = 0, G.vehicles[0].gun.hot = false, G.vFireT = 0, G.shots)`);
  await T(`(D.mouse.L = true, 1)`); await sleep(700); await T(`(D.mouse.L = false, 1)`);
  const am2 = [await T(`G.shots`), await popupTxt()];
  await T(`(G.vehicles[0].rockets = 1, G.vAltT = 0, D.mouse.R = true, 1)`); await until(`G.vehicles[0].rockets === 0`); await sleep(300); await T(`(D.mouse.R = false, 1)`);
  const rk = await T(`[G.vehicles[0].rockets, G.vehicles[0].rocketReload]`);
  ok("vertolyot: pulemyot o'qi sanoqli (500), tugasa otmaydi va xabar chiqadi; raketalar qayta o'qlanmaydi", am[0] === 500 && am1[0] < 498 && /o'q \d+/.test(am1[1]) && am2[0] === s0 && /tugadi/.test(am2[1]) && rk[0] === 0 && rk[1] === 0, `${am[0]} → ${am1[0]} · "${am2[1]}"`);
  await T(`(D.exitVehicle(), 1)`); await sleep(400);

  // punktlar: B — granata; yaqindagi transportga yoqilg'i; C; D — evakuatsiya
  await T(`(() => { const j = G.vehicles[2], b = W.points[1]; j.pos.set(b.x + 14, 0, b.z + 6); j.fuel = 0.1; G.grenades_n = 0; P.pos.set(b.x + 2, 0, b.z + 2); P.vel.set(0, 0, 0); return 1; })()`);
  await until(`Z.stage === 1`);
  const sb = await T(`[Z.stage, G.grenades_n, +G.vehicles[2].fuel.toFixed(2), document.getElementById('cmTitle').textContent, document.getElementById('cmSub').textContent, document.getElementById('objective').textContent]`);
  ok("B punkti: granata beriladi, yaqindagi transportga yoqilg'i quyiladi, keyingi nishon — C", sb[0] === 1 && sb[1] === 3 && Math.abs(sb[2] - 0.6) < 0.02 && /B PUNKTI/.test(sb[3]) && /C punktiga/.test(sb[5]), `"${sb[4].slice(0, 70)}"`);
  await T(`(P.pos.set(W.points[2].x + 1, 0, W.points[2].z + 1), 1)`); await until(`Z.stage === 2`);
  const sc = await T(`[G.grenades_n, document.getElementById('objective').textContent]`);
  await T(`(P.pos.set(W.points[3].x + 1, 0, W.points[3].z + 1), 1)`); await until(`Z.stage === 3`);
  const h0 = await T(`[+Z.hold.toFixed(1), document.getElementById('objective').textContent]`);
  await sleep(1200);
  const h1 = await T(`+Z.hold.toFixed(1)`);
  await T(`(P.pos.set(W.points[3].x + 40, 0, W.points[3].z), 1)`); await sleep(600);
  const h2 = [await T(`+Z.hold.toFixed(1)`)]; await sleep(800); h2.push(await T(`+Z.hold.toFixed(1)`), await ev(`document.getElementById('objective').textContent`));
  ok('C va D punktlari: granata to\'ldiriladi; D da evakuatsiya sanog\'i ketadi, punktdan chiqilsa to\'xtaydi', sc[0] === 4 && /D punktiga/.test(sc[1]) && /EVAKUATSIYA/.test(h0[1]) && h1 < h0[0] && Math.abs(h2[0] - h2[1]) < 0.05 && /qayting/.test(h2[2]), `${h0[0]} → ${h1} · tashqarida ${h2[0]} = ${h2[1]}`);
  // bosqichga qarab zombilar ko'payadi va odamdan 34+ m narida paydo bo'ladi
  const sp = await T(`(() => { Z.spawnT = 0; let min = 1e9, n = 0; const orig = Z.spawn.bind(Z); Z.spawn = (k, x, z, id) => { min = Math.min(min, Math.hypot(x - P.pos.x, z - P.pos.z)); n++; return orig(k, x, z, id); };
    for (let i = 0; i < 400; i++) { Z.spawnT = 0; Z.update(0.05); } Z.spawn = orig; return [n, +min.toFixed(1), Z.zombies().length]; })()`);
  ok("zombilar odamdan 34+ m narida (qorong'ida) paydo bo'ladi, soni cheklangan", sp[0] >= 10 && sp[1] >= 34 && sp[2] <= 36, JSON.stringify(sp));
  await T(`(P.pos.set(W.points[3].x + 1, 0, W.points[3].z + 1), Z.hold = 0.4, 1)`);
  await until(`G.state === 'over'`, 6000);
  const win = await ev(`[document.getElementById('endTitle').textContent, document.getElementById('endSub').textContent, !document.getElementById('end').classList.contains('hidden')]`);
  ok("D punktida vaqt tugasa — g'alaba", /EVAKUATSIYA QILINDINGIZ/.test(win[0]) && win[2], win[0]);
  // qayta jang: klass tanlovisiz yangidan boshlanadi; halok bo'lsa — mag'lubiyat
  await ev(`(document.getElementById('btnAgain').click(), 1)`); await sleep(1500);
  const again = await T(`[G.state, G.zombie, Z && Z.stage, G.weapons[0].locked, G.grenades_n, W.crates.every(c => !c.open)]`);
  ok('"Qayta jang" — zombi rejimi boshidan boshlanadi', again[0] === 'playing' && again[1] && again[2] === 0 && again[3] === true && again[4] === 0 && again[5], JSON.stringify(again));
  await T(`(P.hp = 5, Z.spawn('runner', P.pos.x + 1.2, P.pos.z), 1)`);
  await until(`G.state === 'over'`, 15000);
  const lose = await ev(`[document.getElementById('endTitle').textContent, document.getElementById('endSub').textContent]`);
  ok("halok bo'lsa — mag'lubiyat (zombiga aylandingiz)", /ZOMBIGA AYLANDINGIZ/.test(lose[0]), lose[0] + ' · ' + lose[1].slice(0, 60));
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  L(fails ? `YAKUN: ${fails} ta xato` : "YAKUN: hammasi o'tdi");
  pg.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
