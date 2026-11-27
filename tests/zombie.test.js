// Zombi rejimi (yakka o'yin) — Karantin zonasi: katta xarita, shomdan tunga o'tish, fonar, boshlang'ich qurollar,
// zombilarning sezgisi (ko'rish, shovqin, chinqiroq), binolardagi qurollar va yashiklar, vazifalar zanjiri
// (qishloq → ratsiya qismlari → radio minora → harbiy baza → vertolyot maydoni), qo'shimcha imkoniyatlar, transport yoqilg'isi.
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
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, K = D.keys, Z = G.zg, W = G.world, V3 = P.pos.constructor; return ${body}; })()`);
  const until = async (cond, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  const popupTxt = () => ev(`(document.getElementById('popups').lastElementChild || { textContent: '' }).textContent`);
  // zombilarsiz tinch holat: rejissyor to'xtatiladi, mavjud zombilar olib tashlanadi (alohida narsani o'lchash uchun)
  const calm = () => T(`(() => { Z.host = false; for (const s of G.soldiers.slice()) if (s.isZombie) { s.alive = false; s.dispose(); } Z.noises.length = 0; return 1; })()`);
  // menyu: zombi rejimi tanlanganda o'z xaritasi (karantin zonasi) yuklanadi
  await ev(`(document.querySelectorAll('.era').forEach(e => { if (e.dataset.era === '${era}') e.click(); }), document.querySelector('#spModes [data-m=zombie]').click(), 1)`);
  await sleep(1500);
  const menu = await ev(`[window.__G.spMode, window.__G.world.map, window.__G.world.half, window.__G.night, document.querySelector('#spMaps [data-map=town]').disabled, [...document.querySelectorAll('#spMaps .sel')].map((b) => b.dataset.map).join()]`);
  ok('menyu: zombi rejimi — karantin zonasi (800 × 800 m), kech', menu[0] === 'zombie' && menu[1] === 'wild' && menu[2] === 400 && menu[3] === true && menu[4] === true && menu[5] === 'wild', JSON.stringify(menu));
  await ev(`(document.getElementById('btnPlay').click(), 1)`); await sleep(300);
  const brief = await ev(`document.getElementById('briefTitle').textContent + ' | ' + document.getElementById('briefText').textContent.slice(0, 40)`);
  await ev(`(document.getElementById('briefing').click(), 1)`); await sleep(1200);
  const st = await T(`({ state: G.state, pick: !!G.pick, pos: [Math.round(P.pos.x), Math.round(P.pos.z)], w: G.weapons.map(w => w.def.id).join(','), locked: !!G.weapons[0].locked, inf: !!G.weapons[1].inf, wi: G.wi, nades: G.grenades_n,
    pois: W.pois.length, roads: W.roads.length, blds: W.mapBlds.length, crates: W.crates.length, veh: G.vehicles.map(v => v.type).join(','), lim: G.vehicles.every(v => v.limited), guns: G.loot.filter(l => !l.dead).length, items: G.items.length,
    stage: Z.stage, stages: Z.stages.length, lives: Z.lives, fog: Math.round(W.env.fog.far), dark: Z.dark, slots: document.getElementById('weaponSlots').innerText.replace(/\\n/g, ' | '), obj: document.getElementById('objective').textContent, lbl: document.getElementById('enemyLabel').textContent })`);
  ok("brifingdan keyin klass tanlovisiz halokat joyida boshlanadi", /SHOM/.test(brief) && st.state === 'playing' && !st.pick && st.pos[0] === -322 && st.pos[1] === 318, brief);
  ok("boshlang'ich qurollar: faqat to'pponcha (o'qi tugamaydi) va pichoq, granata yo'q", st.w === 'none,pistol,knife,nade' && st.locked && st.inf && st.wi === 1 && st.nades === 0, st.slots);
  ok("xarita: 9 ta joy, yo'llar, 50+ bino, 12 qurol yashigi, 45+ xonadagi qurol, 6 transport (yoqilg'isi cheklangan)",
    st.pois === 9 && st.roads >= 12 && st.blds >= 50 && st.crates === 12 && st.guns >= 45 && st.items >= 60 && st.veh === 'jeep,quad,truck,jeep,quad,ltank' && st.lim, JSON.stringify([st.pois, st.roads, st.blds, st.crates, st.guns, st.items, st.veh]));
  ok("vazifa: 5 bosqich, birinchisi — qishloqqa yetish; 2 ta qo'shimcha imkoniyat; shomda uzoq ko'rinadi (170 m)", st.stage === 0 && st.stages === 5 && st.lives === 2 && /Oqtepa/.test(st.obj) && /1\/5/.test(st.lbl) && st.fog >= 160 && st.dark === 0, `${st.obj} · ${st.lbl} · tuman ${st.fog}`);
  await T(`(G.bannerT = 0.01, Z.auth = false, 1)`);   // (vazifa bosqichlari keyinroq, alohida tekshiriladi — ungacha o'yinchini xarita bo'ylab ko'chirish ularni ishga tushirmasin)
  await ev(KEY('Digit1')); await sleep(150);
  const p1 = [await T(`G.wi`), await popupTxt()];
  ok("[1] bosilganda: asosiy qurol yo'qligi aytiladi", p1[0] === 1 && /uylardan/.test(p1[1]), p1[1]);
  const inf = await T(`(G.weapons[1].mag = 3, G.weapons[1].reserve)`);
  await ev(KEY('KeyR')); await until(`G.reloadT <= 0 && G.weapons[1].mag === G.weapons[1].def.mag`, 6000);
  const inf2 = await T(`[G.weapons[1].reserve, document.getElementById('reserve').textContent]`);
  ok("to'pponcha: qayta o'qlaganda zaxira kamaymaydi (∞)", inf2[0] === inf && /∞/.test(inf2[1]), `${inf} → ${inf2[0]} "${inf2[1]}"`);

  // --- shom va tun: ko'rinish, chaqmoq, fonar ---
  await calm();
  await T(`(() => { P.pos.set(-322, 0, 250); P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = 0; const a = Z.spawn('walker', -322, 190), b = Z.spawn('walker', -322, 236); for (const z of [a, b]) { z.think = () => 0; z.local = true; } window.__za = a; window.__zb = b; return 1; })()`);
  await sleep(500);
  const v0 = await T(`[window.__za.root.visible, window.__zb.root.visible, Math.round(W.env.fog.far)]`);
  await T(`(Z.dark = 1, 1)`); await sleep(600);
  const v1 = await T(`[window.__za.root.visible, window.__zb.root.visible, Math.round(W.env.fog.far), +W.env.hemi.intensity.toFixed(2)]`);
  ok("shomda 60 m naridagi zombi ko'rinadi; tun kirgach (34 m) ko'rinmaydi, yaqindagisi ko'rinadi", v0[0] === true && v0[1] === true && v0[2] >= 160 && v1[0] === false && v1[1] === true && v1[2] === 34, `${JSON.stringify(v0)} → ${JSON.stringify(v1)}`);
  await T(`(Z.lightning(1), 1)`); await sleep(120);
  const v2 = await T(`[window.__za.root.visible, Math.round(W.env.fog.far)]`);
  await sleep(2600);
  const v3 = await T(`[window.__za.root.visible, Math.round(W.env.fog.far)]`);
  ok("tunda chaqmoq: uzoqdagi zombi bir lahzaga ko'rinadi, so'ng yana ko'rinmaydi", v2[0] === true && v2[1] > 60 && v3[0] === false && v3[1] === 34, `${JSON.stringify(v2)} → ${JSON.stringify(v3)}`);
  const t0 = await T(`[G.torchOn, Math.round(G.torch.intensity)]`);
  await ev(KEY('KeyL')); await sleep(500);
  const t1 = await T(`[G.torchOn, Math.round(G.torch.intensity), document.getElementById('objective').textContent]`);
  await ev(KEY('KeyL')); await sleep(500);
  const t2 = await T(`[G.torchOn, Math.round(G.torch.intensity)]`);
  ok("[L] — fonar yonadi/o'chadi (tunda o'chiq bo'lsa, ekranda eslatma)", t0[0] === true && t0[1] > 30 && t1[0] === false && t1[1] === 0 && /\[L\]/.test(t1[2]) && t2[0] === true && t2[1] > 30, `${t0[1]} → ${t1[1]} → ${t2[1]} · ${t1[2].slice(-24)}`);
  await T(`(Z.dark = 0, W.setDark(0), 1)`);

  // --- zombi oson o'ladi ---
  await calm();
  // (zombi otuvchiga qaratib qo'yiladi: boshi oldinga engashgan va nishon hajmi shu joyda hisoblanadi)
  const kz = await T(`(() => { const def = G.weapons[1].def, out = []; const k0 = G.kills; P.pos.set(-322, 0, 250); Z.host = true; Z.dirT = 1e9;
    for (const y of [1.2, 1.83]) { const z = Z.spawn('walker', P.pos.x, P.pos.z - 12); z.think = () => 0; z.pos.y = 0; z.yaw = 0; let n = 0; while (z.alive && n < 6) { D.hitscan(new V3(P.pos.x, y, P.pos.z - 4), new V3(0, 0, -1), def); n++; } out.push(n); }
    return [out, G.kills - k0, def.dmg]; })()`);
  // (zombilar kuchaytirilgan: oddiy zombining joni 120 — to'pponcha bilan tanaga 3–4, boshga 2 o'q kerak)
  ok("zombi chidamli: to'pponchadan tanaga 3–4 o'q, boshga 2 o'q", kz[0][0] === Math.ceil(120 / kz[2]) && kz[0][1] === 2 && kz[1] === 2, JSON.stringify(kz));

  // --- sezgi: ko'rish (holatga bog'liq), shovqin, chinqiroq ---
  const sense = async (setup, ms = 1500) => { await calm(); await T(`(() => { Z.host = true; Z.dirT = 1e9; P.pos.set(-322, 0, 250); P.vel.set(0, 0, 0); D.setStance(0); ${setup}; return 1; })()`); await sleep(ms); return T(`G.soldiers.filter((s) => s.isZombie && s.alive).map((s) => [s.aware, +(Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z)).toFixed(1), s.heardT > 0])`); };
  const far = await sense(`Z.spawn('walker', -322, 190)`);                                   // 60 m: ko'rish masofasidan (44 m) uzoq
  const seen = await sense(`Z.spawn('walker', -322, 224)`);                                  // 26 m, tik turgan odam
  const prone = await sense(`D.toggleProne(); P.prone = true; Z.spawn('walker', -322, 224)`);  // 26 m, yotgan odam (15 m dan yaqinda ko'rinadi)
  ok("zombi tik turgan odamni 26 m dan ko'radi va quvadi; 60 m dan ko'rmaydi; yotgan odamni 26 m dan payqamaydi", far[0][0] === false && seen[0][0] === true && seen[0][1] < 26 && prone[0][0] === false, JSON.stringify([far, seen, prone]));
  const shotN = await sense(`D.toggleProne(); P.prone = true; Z.spawn('walker', -322, 232); Z.spawn('walker', -322, 216); G.zNoise(P.pos.x, P.pos.z, 44)`, 1200);   // 18 m va 34 m: o'q ovozi (44 m)
  ok("o'q ovozi: yaqindagi zombi (18 m) darhol quvadi, uzoqrog'i (34 m) ovoz kelgan joyga boradi", shotN[0][0] === true && shotN[1][0] === false && shotN[1][2] === true, JSON.stringify(shotN));
  const scr = await sense(`D.toggleProne(); P.prone = true; const s = Z.spawn('screamer', -322, 228); Z.spawn('walker', -300, 222); Z.spawn('walker', -340, 220); s.wake()`, 1300);
  ok("chinqiroq zombi baqirsa — atrofdagi (55 m) zombilar ham uyg'onadi", scr.length === 3 && scr.every((z) => z[0] === true), JSON.stringify(scr));
  await T(`(D.setStance(0), 1)`);
  await calm();
  await T(`(() => { Z.host = true; Z.dirT = 1e9; P.pos.set(-322, 0, 250); P.hp = 100; Z.spawn('runner', P.pos.x + 9, P.pos.z); return 1; })()`);
  const hurt = await until(`P.hp < 100`, 9000);
  const at = await T(`[P.hp, +Math.min(...G.soldiers.filter((s) => s.isZombie && s.alive).map((s) => Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z))).toFixed(1)]`);
  ok('zombi odamni quvib yetadi va uradi', hurt && at[1] < 2.6, `jon ${at[0]}, masofa ${at[1]} m`);
  await calm(); await T(`(P.hp = 100, 1)`);

  // --- qurollar: yashik (o'qi sanoqli) va uylardagi qurollar (o'qi tanqis) ---
  await T(`(() => { const c = W.crates[0]; P.pos.set(c.x + 0.4, 0, c.z + 1.3); P.vel.set(0, 0, 0); return c.kind; })()`); await sleep(400);
  const pr0 = await ev(`document.getElementById('prompt').textContent`);
  await ev(KEY('KeyE')); await sleep(300);
  const c0 = await T(`[G.weapons[0].def.id, G.weapons[0].mag + G.weapons[0].reserve, G.wi, W.crates[0].open, !!G.weapons[0].locked]`);
  ok("yashik: [E] bilan ochiladi, qurol darhol qo'lga olinadi; o'qi sanoqli (PP — jami 300)", /yashigini ochish/.test(pr0) && c0[0] === 'smg' && c0[1] === 300 && c0[2] === 0 && c0[3] === true && c0[4] === false, pr0 + ' ' + JSON.stringify(c0));
  const lg = await T(`(() => { const l = G.loot.find((q) => !q.dead && !q.taken && !['pistol', 'pistol2'].includes(q.def.id) && q.def.id !== G.weapons[0].def.id), pl = G.loot.find((q) => !q.dead && !q.taken && q.def.id === 'pistol2');
    P.pos.set(l.pos.x, l.pos.y, l.pos.z); const a = D.tryLoot(), w = G.weapons[0], r1 = [l.def.id, a, w.def.id, w.mag, w.reserve, l.def.mag * 2];
    let r2 = null; if (pl) { P.pos.set(pl.pos.x, pl.pos.y, pl.pos.z); D.tryLoot(); r2 = [G.weapons[1].def.id, !!G.weapons[1].inf]; }
    return [r1, r2, [...new Set(G.loot.map((q) => q.def.id))].length]; })()`);
  ok("uydagi qurol [E] bilan olinadi: zaxirasi ikki magazin; topilgan to'pponchaning o'qi ham tugamaydi; qurollar har xil", lg[0][1] === true && lg[0][2] === lg[0][0] && lg[0][3] === lg[0][5] / 2 && lg[0][4] === lg[0][5] && (!lg[1] || (lg[1][0] === 'pistol2' && lg[1][1] === true)) && lg[2] >= 6, JSON.stringify(lg));

  // --- transport: yoqilg'i ---
  await T(`(() => { const j = G.vehicles[0]; P.pos.set(j.pos.x + 2.2, 0, j.pos.z); P.vel.set(0, 0, 0); return [j.fuel, j.limited]; })()`);
  await sleep(400); await ev(KEY('KeyF')); await sleep(400);
  await T(`(K.KeyW = true, 1)`); await until(`G.inVeh && G.inVeh.fuel < 0.985`, 15000);
  const f1 = await T(`[G.inVeh && G.inVeh.type, +G.inVeh.fuel.toFixed(3), document.getElementById('vehName').textContent]`);
  await T(`(G.inVeh.fuel = 0.0005, 1)`); await until(`G.inVeh.fuel <= 0 && Math.abs(G.inVeh.speed) < 0.3`, 9000);
  const f2 = await T(`[G.inVeh.fuel, +G.inVeh.speed.toFixed(2), G.inVeh.immobile, document.getElementById('vehName').textContent]`);
  await T(`(K.KeyW = false, 1)`);
  ok("jip: yurganda yoqilg'i kamayadi va ekranda ko'rsatiladi; tugasa transport to'xtaydi", f1[0] === 'jeep' && f1[1] <= 0.985 && /yoqilg'i \d+%/.test(f1[2]) && f2[0] === 0 && Math.abs(f2[1]) < 0.3 && f2[2] === true && /TUGADI/.test(f2[3]), `${f1[2]} → ${f2[3]}`);
  await ev(KEY('KeyF')); await sleep(400);

  // --- vazifalar zanjiri ---
  await calm(); await T(`(Z.host = true, Z.auth = true, Z.dirT = 0.2, 1)`);
  // 1) qishloq
  await T(`(G.vehicles[0].fuel = 0.1, G.vehicles[0].pos.set(-180, 0, 186), P.pos.set(-215, 0, 190), P.vel.set(0, 0, 0), 1)`);
  await until(`Z.stage === 1`, 4000); await sleep(300);
  const sb = await T(`[Z.stage, G.grenades_n, +G.vehicles[0].fuel.toFixed(2), document.getElementById('cmTitle').textContent, document.getElementById('objective').textContent, Z.cp.x, document.getElementById('enemyLabel').textContent]`);
  ok("qishloqqa yetildi: granata beriladi, yaqindagi transportga yoqilg'i quyiladi, keyingi vazifa — uchta qism", sb[0] === 1 && sb[1] === 2 && Math.abs(sb[2] - 0.6) < 0.02 && /OQTEPA/.test(sb[3]) && /Akkumulyator — Ferma \(\d+ m\)/.test(sb[4]) && /Ratsiya bloki — Shaharcha/.test(sb[4]) && sb[5] === -215 && /2\/5/.test(sb[6]), JSON.stringify(sb));
  await sleep(2600);
  const amb = await T(`(() => { const zs = G.soldiers.filter((s) => s.isZombie && s.alive), ds = zs.map((s) => Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z)); return [zs.length, Math.round(Math.min(...ds)), zs.filter((s) => s.rage).length, zs.filter((s) => W.pointInBox(new V3(s.pos.x, s.pos.y + 1, s.pos.z))).length]; })()`);
  ok("qishloq atrofida tentirab yuruvchi zombilar paydo bo'ladi (odamdan 30+ m narida, to'siq ichida emas, to'da emas)", amb[0] >= 3 && amb[0] <= 40 && amb[1] >= 30 && amb[2] === 0 && amb[3] === 0, JSON.stringify(amb));
  await shot(`zombie_${era}_village`);
  // 2) ratsiya qismlari
  const parts = [];
  for (let i = 0; i < 3; i++) {
    await T(`(() => { const s = Z.spots[${i}]; P.pos.set(s[0] + 0.6, s[2], s[1] + 0.4); P.vel.set(0, 0, 0); return 1; })()`); await sleep(350);
    const pr = await ev(`document.getElementById('prompt').textContent`);
    await ev(KEY('KeyE')); await sleep(350);
    parts.push([pr, await T(`[Z.got.filter(Boolean).length, Z.stage, G.soldiers.filter((s) => s.isZombie && s.alive && s.rage).length, document.getElementById('cmTitle').textContent]`)]);
  }
  ok("ratsiya qismlari: joyida [E] bilan olinadi, shovqin to'dani chaqiradi, uchalasi topilgach keyingi bosqich",
    /Akkumulyator — olish/.test(parts[0][0]) && parts[0][1][0] === 1 && parts[0][1][1] === 1 && parts[0][1][2] >= 2 && /TOPILDI/.test(parts[0][1][3]) && /kanistri/.test(parts[1][0]) && parts[1][1][0] === 2 && parts[2][1][0] === 3 && parts[2][1][1] === 2, JSON.stringify(parts));
  // 3) radio minora: ushlab turish (sanoq nuqtada ketadi, tashqarida to'xtaydi), to'da hujumi
  await calm(); await T(`(Z.host = true, Z.dirT = 0.2, P.pos.set(-130, 0, -282), P.vel.set(0, 0, 0), 1)`); await sleep(2200);
  const h0 = await T(`[+Z.hold.toFixed(1), document.getElementById('objective').textContent, G.soldiers.filter((s) => s.isZombie && s.alive && s.rage).length, Z.holdMax]`);
  await T(`(P.pos.set(-130, 0, -220), 1)`); await sleep(500); const hA = await T(`Z.hold`); await sleep(900); const hB = await T(`[Z.hold, document.getElementById('objective').textContent]`);
  ok("radio minora: ichkarida sanoq ketadi va to'da hujum qiladi; tashqarida sanoq to'xtaydi", h0[3] === 75 && h0[0] < 74 && /ushlab turing/.test(h0[1]) && h0[2] >= 4 && hA === hB[0] && /qayting/.test(hB[1]), `${h0[0]} s · to'da ${h0[2]} · ${hB[1]}`);
  await T(`(P.pos.set(-130, 0, -282), Z.hold = 0.6, 1)`); await until(`Z.stage === 3`, 5000); await sleep(300);
  const s3 = await T(`[Z.stage, document.getElementById('cmTitle').textContent, document.getElementById('objective').textContent, G.grenades_n]`);
  ok("signal yuborildi: keyingi vazifa — harbiy baza darvozasi", s3[0] === 3 && /Harbiy baza darvozasi/.test(s3[2]) && s3[3] === 4, `${s3[1]} · ${s3[2]}`);
  // 4) baza darvozasi → 5) vertolyot maydoni
  await calm(); await T(`(P.pos.set(224, 0, -262), 1)`); await until(`Z.stage === 4`, 4000);
  await T(`(P.pos.set(300, 0, -272), Z.dark = 1, 1)`); await sleep(1500);
  const s4 = await T(`[Z.stage, Z.holdMax, document.getElementById('objective').textContent, Math.round(W.env.fog.far)]`);
  ok("harbiy baza: vertolyot maydonini 90 soniya ushlab turish kerak; tun to'liq kirgan", s4[0] === 4 && s4[1] === 90 && /Vertolyot maydoni: ushlab turing/.test(s4[2]) && s4[3] === 34, JSON.stringify(s4));
  await shot(`zombie_${era}_base`);
  // evakuatsiya: vertolyot uchib keladi → qo'nadi, rampa ochiladi → o'yinchi rampaga chiqadi → kino → g'alaba (sinovda vaqt 5 baravar tez)
  await T(`(Z.hold = 0.8, G.evacK = 0.2, G._zAtk = G.zAttack, G.zAttack = () => {}, 1)`);   // (zombi zarbalari vaqtincha o'chiriladi — keyin qaytariladi)
  await until(`!!D.evac()`, 4000); await sleep(300);
  const ev1 = await T(`[D.evac().ph, +D.evac().h.v.pos.y.toFixed(1), G.state, document.getElementById('objective').textContent, document.getElementById('cmTitle').textContent]`);
  ok("vazifa bajarildi: jang tugamaydi — evakuatsiya vertolyoti uchib kelmoqda", ev1[0] === 'arrive' && ev1[1] > 20 && ev1[2] === 'playing' && /Vertolyot yaqinlashmoqda/.test(ev1[3]) && /VERTOLYOT/.test(ev1[4]), JSON.stringify(ev1));
  await until(`D.evac() && D.evac().ph === 'board'`, 8000); await until(`D.evac().h.ramp.rotation.x < 0`, 3000); await sleep(200);
  const ev2 = await T(`[+D.evac().h.v.pos.y.toFixed(2), +D.evac().h.ramp.rotation.x.toFixed(2), Z.mk.ring.visible, document.getElementById('objective').textContent]`);
  ok("vertolyot qo'ndi, rampa ochildi; bortga chiqish joyi belgilangan", ev2[0] === 0 && ev2[1] < 0 && ev2[2] && /VERTOLYOTGA CHIQING/.test(ev2[3]), JSON.stringify(ev2));
  await T(`(P.pos.set(Z.target.x + 4, 0, Z.target.z + 9), P.yaw = Math.atan2(4, 9), P.pitch = 0.05, G.bannerT = 0.01, 1)`); await sleep(500);
  await shot(`zombie_${era}_evac_landed`);
  await T(`(P.pos.set(Z.target.x, 0, Z.target.z + 1.5), P.vel.set(0, 0, 0), 1)`);
  await until(`D.evac() && D.evac().aboard`, 3000); await sleep(2200);
  const ev3 = await T(`[D.evac().aboard, D.evac().walk, document.getElementById('objective').textContent, G.weapons.every(w => !w.vm.group.visible)]`);
  ok("rampaga chiqqan o'yinchi bortda: kamera kabinada, qurol ko'rinmaydi", ev3[0] && ev3[1] >= 1 && /bortdasiz/.test(ev3[2]) && ev3[3], JSON.stringify(ev3));
  const lv = await until(`D.evac() && D.evac().ph === 'leave'`, 6000); await sleep(900);
  const ev4 = await T(`[document.getElementById('cine').className, document.getElementById('hud').classList.contains('cineHide'), D.evac() ? +D.evac().h.v.pos.y.toFixed(1) : -1, G.state]`); ev4.push(lv);
  await shot(`zombie_${era}_evac_cine`);
  ok("uchib ketish — kino: keng ekran chiziqlari, HUD yashirin, vertolyot ko'tarilmoqda", /on/.test(ev4[0]) && ev4[1] && ev4[2] > 0.5, JSON.stringify(ev4));
  await until(`G.state === 'over'`, 9000);
  const win = await ev(`[document.getElementById('endTitle').textContent, !document.getElementById('end').classList.contains('hidden'), document.getElementById('endStats').innerText.replace(/\\n+/g, ' '), !window.__dbg.evac(), document.getElementById('cine').className]`);
  await T(`(G.zAttack = G._zAtk, G.evacK = 1, 1)`);
  ok("kino tugagach — g'alaba oynasi (vertolyot va kino tozalangan)", /EVAKUATSIYA QILINDINGIZ/.test(win[0]) && win[1] && /5\/5/.test(win[2]) && win[3] && /hidden/.test(win[4]), win[0] + ' · ' + win[2].slice(0, 80));

  // --- qayta jang; imkoniyatlar; mag'lubiyat ---
  await ev(`(document.getElementById('btnAgain').click(), 1)`); await sleep(1500);
  const again = await T(`[G.state, G.zombie, Z && Z.stage, G.weapons[0].locked, G.grenades_n, W.crates.every(c => !c.open), Z.lives, Z.got.some(Boolean), Math.round(W.env.fog.far)]`);
  ok('"Qayta jang" — zombi rejimi boshidan boshlanadi (shom, bosqich 1, qismlar topilmagan)', again[0] === 'playing' && again[1] && again[2] === 0 && again[3] === true && again[4] === 0 && again[5] && again[6] === 2 && again[7] === false && again[8] >= 160, JSON.stringify(again));
  await T(`(P.pos.set(-215, 0, 190), 1)`); await until(`G.zg.stage === 1`, 4000);
  await T(`(P.pos.set(-120, 0, 40), D.damagePlayer(9999, null, null, true), 1)`);
  await until(`P.alive`, 6000); await sleep(200);
  const rv = await T(`[P.alive, G.state, Z.lives, +P.pos.x.toFixed(1), +P.pos.z.toFixed(1), P.hp, document.getElementById('cmTitle').textContent, document.getElementById('cmSub').textContent,
    ...(() => { const R = W.revivePts[1]; return [+(R.x + Math.sin(R.yaw) * 3.1).toFixed(1), +(R.z + Math.cos(R.yaw) * 3.1).toFixed(1)]; })()]`);
  ok("halok bo'lgach oxirgi ochilgan tiriltirish punkti (qishloqdagi chodir) oldidan davom etiladi — imkoniyat bittaga kamayadi", rv[0] === true && rv[1] === 'playing' && rv[2] === 1 && Math.hypot(rv[3] - rv[8], rv[4] - rv[9]) < 1.5 && rv[5] === 100 && /IMKONIYAT/.test(rv[6]) && /Tiriltirish punkti \(Oqtepa/.test(rv[7]), JSON.stringify(rv));
  // defibrillyator: halok bo'lganda shu joyning o'zida tiriltiradi (imkoniyat sarflanmaydi)
  await T(`(P.pos.set(-150, 0, 120), P.vel.set(0, 0, 0), G.defib = 1, 1)`); await sleep(300);
  await T(`(D.damagePlayer(9999, null, null, true), 1)`); await until(`P.alive`, 6000); await sleep(200);
  const df = await T(`[P.alive, Z.lives, Math.round(P.pos.x), Math.round(P.pos.z), P.hp, G.defib, document.getElementById('cmTitle').textContent]`);
  ok("defibrillyator: halok bo'lsangiz shu joyda tiriltiradi (60 jon, imkoniyat sarflanmaydi)", df[0] && df[1] === 1 && df[2] === -150 && df[3] === 120 && df[4] === 60 && df[5] === 0 && /DEFIBRILLYATOR/.test(df[6]), JSON.stringify(df));
  await T(`(D.damagePlayer(9999, null, null, true), 1)`); await until(`P.alive`, 6000); await sleep(200);
  await T(`(P.hp = 5, Z.host = true, Z.spawn('runner', P.pos.x + 1.2, P.pos.z), 1)`);
  await until(`G.state === 'over'`, 15000);
  const lose = await ev(`[document.getElementById('endTitle').textContent, document.getElementById('endSub').textContent, window.__G.zg.lives]`);
  ok("imkoniyatlar tugagach halok bo'lsa — mag'lubiyat (zombiga aylandingiz)", /ZOMBIGA AYLANDINGIZ/.test(lose[0]) && /bosqichida \(2\/5\)/.test(lose[1]) && lose[2] === 0, lose[0] + ' · ' + lose[1].slice(0, 70));
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  L(fails ? `YAKUN: ${fails} ta xato` : "YAKUN: hammasi o'tdi");
  pg.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
