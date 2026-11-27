// Yangi imkoniyatlar: yotish, oshib o'tish (derazadan kirish), vositalar (aptechka, bint, zirh), yangi klass va qurollar,
// daraja va qo'shimchalar, snayperning transportga zarari, noyob qurollar (qulflanadigan bazuka, turel, boshqariladigan dron),
// jon o'zi tiklanmasligi, katta xarita, jamoa tanlash va sheriklarni uzoqdan tanish,
// yangi shahar (ikki qavatli uy), transportsiz jang; tarmoqda — jamoaviy rejim, chat, qayta ulanish, vositalar.
// Ishlatish: PORT=8191 ZJ_MAP=town TDM_TARGET=2 REJOIN_GRACE=6 node server.js   so'ng   node tests/features.test.js [historical|modern]
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191, era = process.argv[2] || 'modern';
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };

async function single() {
  L(`=== YAKKA REJIM (${era})`);
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9511, dir: 'p_feat' });
  const { ev, shot } = pg;
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, V3 = P.pos.constructor, W = G.world; return ${body}; })()`);
  const until = async (cond, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  const start = (extra = '') => T(`(() => { G.era = '${era}'; ${extra} D.createScene('${era}'); document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 99999; for (const s of G.soldiers) s.hp = 1e9; return G.state; })()`);
  await start();
  await sleep(500);

  // --- yotish ---
  await T(`(P.pos.set(20, 0, 30), P.vel.set(0, 0, 0), P.yaw = 0, D.toggleProne(), 1)`);
  await until(`P.prone && P.eyeH < 0.47`);
  const pr = await T(`[P.prone, +P.eyeH.toFixed(2), document.getElementById('stance').textContent, P.hitTest(new V3(20, 1.2, 40), new V3(0, 0, -1), 50) === null, !!P.hitTest(new V3(20, 0.3, 40), new V3(0, 0, -1), 50)]`);
  ok("[Z] yotish: ko'z balandligi ~0.4 m, ekranda holat ko'rsatiladi, bel balandligidagi o'q tegmaydi, yer bo'ylab kelgani tegadi", pr[0] && pr[1] < 0.5 && /YOTGAN/.test(pr[2]) && pr[3] && pr[4], JSON.stringify(pr));
  await T(`(D.keys.KeyW = true, 1)`); await sleep(1500); const sp1 = await T(`(D.keys.KeyW = false, Math.hypot(P.vel.x, P.vel.z))`);
  ok('yotgan holda sekin emaklaydi (tezlik < 1.8 m/s)', sp1 > 0.3 && sp1 < 1.8, 'tezlik=' + (sp1 || 0).toFixed(2));
  await T(`(D.keys.Space = true, 1)`); await until(`!P.prone && P.crouch`, 3000); const st1 = await T(`[P.prone, P.crouch, P.onGround]`);
  await T(`(D.keys.Space = false, 1)`); await sleep(200);
  ok("[PROBEL] yotgan holatdan cho'kkalashga o'tkazadi (sakramaydi)", !st1[0] && st1[1] && st1[2], JSON.stringify(st1));
  await T(`(D.setStance(0), 1)`); await until(`!P.crouch && P.eyeH > 1.5`, 3000);

  // --- derazadan kirish: H7 uyi (-48, -12), g'arbiy devoridagi (x = -52.85) deraza; tashqaridan sharqqa qarab ---
  const wn = await T(`(() => { const g = G.world.panes.find((q) => q.ax === 'z' && Math.abs(q.f + 52.85) < 0.2 && Math.abs(q.c + 12) < 4 && q.y0 < 2); return g ? [g.f, g.c] : null; })()`);
  await T(`(P.pos.set(${wn ? wn[0] - 0.9 : -53.75}, 0, ${wn ? wn[1] : -12}), P.vel.set(0, 0, 0), P.yaw = -Math.PI / 2, P.pitch = 0, 1)`); await sleep(300);
  const v0 = await T(`[D.tryVault(), !!G.vault]`);
  await until(`!G.vault`, 4000);
  const v1 = await T(`[+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2), P.onGround]`);
  ok("deraza tokchasi oldida [PROBEL] — o'yinchi derazadan uy ichiga o'tadi", !!wn && v0[0] === true && v0[1] && v1[0] > -52.5 && v1[0] < -50.3 && Math.abs(v1[1]) < 0.1, JSON.stringify([wn, v0, v1]));
  // uylarda deraza kam (har devorda ko'pi bilan ikkita) va har biridan ichkaridan tashqariga chiqsa bo'ladi: oldi yashik yoki zina bilan to'silmagan
  const wins = await T(`(() => { const W = G.world, V3 = P.pos.constructor, v = new V3(); let blocked = 0; const per = {};
    for (const g of W.panes) { const wx = g.ax === 'x' ? g.c : g.f, wz = g.ax === 'x' ? g.f : g.c, yF = g.y0 - 1.03;
      const b = W.mapBlds.find((m) => Math.abs(wx - m.x) < m.w / 2 + 0.3 && Math.abs(wz - m.z) < m.d / 2 + 0.3); if (!b) continue;
      const k = W.mapBlds.indexOf(b) + ':' + g.ax + Math.round(g.f) + ':' + Math.round(yF); per[k] = (per[k] || 0) + 1;
      const nx = g.ax === 'x' ? 0 : Math.sign(b.x - wx), nz = g.ax === 'x' ? Math.sign(b.z - wz) : 0;
      for (const h of [0.4, 1.0, 1.6]) if (W.pointInBox(v.set(wx + nx * 0.75, yF + h, wz + nz * 0.75))) { blocked++; break; } }
    return [W.panes.length, W.mapBlds.filter((m) => /house|base/.test(m.k)).length, Math.max(...Object.values(per)), blocked]; })()`);
  ok("derazalar kam va oldi ochiq", wins[0] > 0 && wins[0] <= wins[1] * 9 && wins[2] <= 2 && wins[3] === 0, JSON.stringify(wins));
  await shot(`feat_${era}_window`);
  // yaxlit devor oldida oshib o'tib bo'lmaydi
  const v2 = await T(`(P.pos.set(-42.1, 0, -11.2), P.vel.set(0, 0, 0), P.yaw = Math.PI / 2, D.tryVault())`);
  // (-11.2 — eshik: u yerda to'siq yo'q) va devorning yaxlit qismi z = -15.6
  const v3 = await T(`(P.pos.set(-42.1, 0, -15.5), P.vel.set(0, 0, 0), P.yaw = Math.PI / 2, D.tryVault())`);
  ok("ochiq eshik va yaxlit devor oldida oshib o'tish ishlamaydi", v2 === false && v3 === false, JSON.stringify([v2, v3]));
  // qum qoplari ustidan (maydondagi to'siq: (8, -7), 4 × 1.0 × 0.7)
  await T(`(P.pos.set(8, 0, -5.8), P.vel.set(0, 0, 0), P.yaw = 0, 1)`); await sleep(200);
  const v4 = await T(`D.tryVault()`); await until(`!G.vault`, 4000);
  const v5 = await T(`[+P.pos.z.toFixed(2), +P.pos.y.toFixed(2)]`);
  ok("qum qoplari ustidan oshib o'tadi", v4 === true && v5[0] < -7.6 && Math.abs(v5[1]) < 0.1, JSON.stringify([v4, v5]));

  // --- vositalar ---
  const it0 = await T(`[G.items.length, G.items.map((i) => i.kind).join(','), G.bandages]`);
  ok('xaritada vositalar bor (aptechka, zirh, bint, adrenalin, o\'q-dori, granata)', it0[0] >= 10 && /med/.test(it0[1]) && /armor/.test(it0[1]) && /band/.test(it0[1]) && /adr/.test(it0[1]) && it0[2] === 2, it0[0] + ' ta · ' + it0[1]);
  const med = await T(`(() => { const it = G.items.find((i) => i.kind === 'med'); P.hp = 40; P.lastHurt = G.time; P.pos.set(it.pos.x, it.pos.y, it.pos.z); P.vel.set(0, 0, 0); return it.id; })()`);
  await until(`G.items[${med}].taken`, 3000);
  const m1 = await T(`[P.hp, G.items[${med}].taken, G.items[${med}].mesh.visible, G.bandages]`);
  ok("aptechka ustidan o'tilsa olinadi: jon to'ladi, +1 bint, quti yo'qoladi", m1[0] === 100 && m1[1] && !m1[2] && m1[3] === 3, JSON.stringify(m1));
  await T(`(P.pos.set(20, 0, 30), P.vel.set(0, 0, 0), P.hp = 50, P.lastHurt = G.time, D.useBandage(), 1)`);
  await sleep(250);
  const b0 = await T(`[G.healT > 0, document.getElementById('reloadHint').textContent]`);
  await until(`G.healT <= 0`, 5000);
  const b1 = await T(`[P.hp, G.bandages]`);
  ok("[H] bint: 1,5 soniyada 40 jon qaytaradi, bintlar kamayadi", b0[0] && /BINT/.test(b0[1]) && b1[0] >= 90 && b1[0] < 100 && b1[1] === 2, JSON.stringify([b0, b1]));
  const ar = await T(`(() => { D.applyItem('armor'); P.hp = 100; const a0 = G.armor; D.damagePlayer(40, null, null); return [a0, G.armor, P.hp, document.getElementById('armorBar').style.display]; })()`);
  await sleep(300);
  ok('zirh nimcha zararning yarmini yutadi (40 zarar → jon −20, zirh −20)', ar[0] === 60 && Math.abs(ar[1] - 40) < 0.01 && Math.abs(ar[2] - 80) < 0.01, JSON.stringify(ar));
  await T(`(P.hp = 100, G.armor = 0, 1)`);

  // --- klasslar va qurollar ---
  const cl = await T(`(() => { const out = []; for (let i = 0; i < 6; i++) { D.setClass(i); D.applyLoadout(); out.push(G.weapons[0].def.id + ':' + G.weapons[0].def.mag + (G.weapons[0].def.scope ? ':optika' : '')); } D.setClass(0); D.applyLoadout(); return out; })()`);
  ok('olti klass: avtomat, PP, snayper, drobovik, pulemyot, mergan miltig\'i', cl.length === 6 && /^ar:/.test(cl[0]) && /^lmg:/.test(cl[4]) && /^dmr:.*optika/.test(cl[5]), cl.join(' '));
  // daraja va qo'shimchalar
  const pg0 = await T(`[D.prog.level(), D.prog.loadoutFor(0).p, D.prog.setLoadout(0, { p: 'ar2', s: 'pistol2' }), D.prog.loadoutFor(0).p, D.prog.toggleAttach(0, 'supp')]`);
  ok("1-darajada muqobil qurol va qo'shimchalar yopiq", pg0[0] === 1 && pg0[1] === 'ar' && pg0[3] === 'ar' && pg0[4] === false, JSON.stringify(pg0));
  const pg1 = await T(`(() => { D.prog.addXp(4000); D.prog.setLoadout(0, { p: 'ar2', s: 'pistol2' }); D.prog.toggleAttach(0, 'supp'); D.prog.toggleAttach(0, 'extmag'); D.setClass(0); D.applyLoadout();
    const d = G.weapons[0].def; return [D.prog.level(), d.id, !!d.quiet, d.mag, G.weapons[1].def.id, (d.att || []).join('+'), document.getElementById('progBox').textContent.slice(0, 12)]; })()`);
  ok("tajriba to'plangach daraja oshadi: SCAR/FG-42, og'ir to'pponcha, so'ndirgich va katta magazin ochiladi", pg1[0] >= 6 && pg1[1] === 'ar2' && pg1[2] === true && pg1[3] === 28 && pg1[4] === 'pistol2' && pg1[5] === 'supp+extmag', JSON.stringify(pg1));
  await T(`(D.prog.setLoadout(0, { p: 'ar', s: 'pistol', a: [] }), D.setClass(0), D.applyLoadout(), 1)`);

  // --- oddiy snayper transportga kuchli: jip (600 jon) ---
  const sn = await T(`(() => { D.setClass(2); D.applyLoadout(); const v = G.vehicles[2], h0 = v.hp, d = G.weapons[0].def; const c = v.center(new V3());
    D.hitscan(new V3(c.x + 9, c.y, c.z), new V3(-1, 0, 0), d); const h1 = v.hp;
    const tk = G.vehicles[6], t0 = tk.hp, cc = tk.center(new V3()); D.hitscan(new V3(cc.x + 20, cc.y, cc.z), new V3(-1, 0, 0), d); const t1 = tk.hp;
    v.hp = h0; tk.hp = t0; D.setClass(0); D.applyLoadout(); return [d.dmg, h0 - h1, +(t0 - t1).toFixed(1)]; })()`);
  ok("oddiy snayper: jipga bir o'qda ~200 zarar, og'ir tank zirhini ham qisman teshadi (~90)", sn[0] === 92 && Math.abs(sn[1] - 202.4) < 1 && sn[2] > 80 && sn[2] < 100, JSON.stringify(sn));

  // --- xonalardagi tasodifiy qurollar ---
  const lo0 = await T(`(() => { const bad = G.loot.filter((l) => W.pointInBox(new V3(l.pos.x, l.pos.y + 0.4, l.pos.z)) || W.los(new V3(l.pos.x, l.pos.y + 0.5, l.pos.z), new V3(l.pos.x, l.pos.y + 14, l.pos.z))).length;
    const a = D.seeded(77), b = D.seeded(77), c = D.seeded(78); const sa = [a(), a(), a()].join(), sb = [b(), b(), b()].join(), sc = [c(), c(), c()].join();
    return [G.loot.length, W.roomSpots.length, G.loot.every((l) => l.id >= 300 && !l.taken && l.def && l.def.dmg > 0), bad, new Set(G.loot.map((l) => l.def.id)).size, sa === sb && sa !== sc]; })()`);
  ok("xonalarda qurollar: har bir xona joyida bitta, hammasi tom ostida va bo'sh joyda, kamida 5 xil; bir xil urug' — bir xil tartib", lo0[0] >= 8 && lo0[0] === lo0[1] && lo0[2] && lo0[3] === 0 && lo0[4] >= 5 && lo0[5], JSON.stringify(lo0));
  // boshqa urug' — boshqa joylashuv (har jangda tasodifiy), noyob qurol turlari ham joyini almashtiradi
  const lo1 = await T(`(() => { const o0 = G.loot.map((l) => l.def.id).join(), p0 = G.pickups.map((p) => p.def.id).join(); let dl = 0, dp = 0;
    for (const sd of [11, 222, 3333]) { for (const l of G.loot) G.scene.remove(l.mesh); G.lootSeed = sd; D.setupLoot(); if (G.loot.map((l) => l.def.id).join() !== o0) dl++; }
    for (const l of G.loot) G.scene.remove(l.mesh); G.lootSeed = 0; D.setupLoot();
    return [dl, G.loot.map((l) => l.def.id).join() === o0, p0]; })()`);
  ok("har jangda qurollar boshqacha joylashadi (uch xil urug' — uch xil tartib), urug' 0 — o'zgarmas", lo1[0] === 3 && lo1[1] === true, JSON.stringify(lo1));
  // olish: [E] — asosiy qurol almashadi, xonadagi qurol yo'qoladi; to'pponcha — ikkinchi o'ringa
  const lo2 = await T(`(() => { const l = G.loot.find((q) => !['pistol', 'pistol2'].includes(q.def.id) && q.def.id !== G.weapons[0].def.id); window.__l = l;
    P.pos.set(l.pos.x, l.pos.y, l.pos.z); P.vel.set(0, 0, 0); return [l.def.id, G.weapons[0].def.id, G.weapons[1].def.id]; })()`);
  await sleep(350);
  const lo3 = await T(`[document.getElementById('prompt').textContent, D.nearestLoot() === window.__l]`);
  await T(`(D.interact(), 1)`); await sleep(250);
  const lo4 = await T(`[G.weapons[0].def.id, G.wi, window.__l.taken, window.__l.mesh.visible, G.weapons[0].mag === window.__l.def.mag, G.weapons[1].def.id, D.nearestLoot() === window.__l]`);
  ok("xonadagi qurol yonida [E] eslatmasi chiqadi; olinganda asosiy qurol almashadi (to'la o'q bilan), qurol xonadan yo'qoladi, to'pponcha joyida qoladi",
    /\[E\]/.test(lo3[0]) && lo3[0].includes('olish') && lo3[1] && lo4[0] === lo2[0] && lo4[0] !== lo2[1] && lo4[1] === 0 && lo4[2] === true && lo4[3] === false && lo4[4] && lo4[5] === lo2[2] && !lo4[6], JSON.stringify([lo2, lo3, lo4]));
  // tez uloqtirish boshlanib, granata hali qo'ldan chiqmagan paytda qurol almashsa — granata yo'qolmaydi (qaytarib beriladi)
  const gr = await T(`(() => { D.setClass(0); D.applyLoadout(); G.switchT = 0; G.knifeT = 0; G.throwT = 0; const n0 = G.grenades_n; D.throwGrenade(); const n1 = G.grenades_n, mid = G.throwT > 0 && !G.thrown;
    const l = G.loot.find((q) => !q.taken && !['pistol', 'pistol2'].includes(q.def.id) && q.def.id !== G.weapons[0].def.id); P.pos.set(l.pos.x, l.pos.y, l.pos.z); const got = D.tryLoot(); return [n0, n1, mid, got, G.grenades_n, G.throwT]; })()`);
  ok("uloqtirilayotgan granata qurol almashganda yo'qolmaydi", gr[1] === gr[0] - 1 && gr[2] === true && gr[3] === true && gr[4] === gr[0] && gr[5] === 0, JSON.stringify(gr));
  // boshqa o'yinchining (tarmoqdagi) portlashi faqat ko'rinish: o'z turelimizga bu yerda zarar yozilmaydi; dushman granatasi esa zarar beradi
  const tb = await T(`(() => { D.setClass(0); D.applyLoadout(); P.pos.set(20, 0, 30); P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = 0; for (const t of (G.turrets || []).slice()) t.t = 0; return D.deployTurret(); })()`);
  await sleep(200);
  const tb0 = await T(`(() => { const t = G.turrets.find((q) => q.own); window.__tt = t; P.pos.set(20, 0, 62);   /* o'yinchi portlashdan uzoqda */ D.spawnGrenade(new V3(t.pos.x + 1.5, 0.3, t.pos.z), new V3(0, 0, 0), 'remote', null, 0.05); return [t.hp, G.turrets.length]; })()`);
  await sleep(500);
  const tb1 = await T(`(() => { const t = window.__tt, hp = t.hp, alive = G.turrets.includes(t); D.spawnGrenade(new V3(t.pos.x + 1.5, 0.3, t.pos.z), new V3(0, 0, 0), 'enemy', null, 0.05); return [hp, alive]; })()`);
  await sleep(500);
  const tb2 = await T(`[window.__tt.hp, G.turrets.includes(window.__tt)]`);
  ok("turel: boshqa o'yinchining portlashi (ko'rinish) zarar yozmaydi, dushman granatasi zarar beradi", tb === true && tb1[0] === tb0[0] && tb1[1] === true && (tb2[0] < tb0[0] || tb2[1] === false), JSON.stringify([tb0, tb1, tb2]));
  await T(`(() => { for (const t of (G.turrets || []).slice()) t.t = 0; return 1; })()`);
  // transport ichidan dron uchirib bo'lmaydi (kamera transportda qolardi)
  const dv = await T(`(() => { const v = G.vehicles.find((q) => q.alive && q.type === 'jeep'); D.enterVehicle(v, 1); const inV = !!G.inVeh, r = D.launchDrone(); const out = [inV, r, !!G.drone, G.droneCtl]; D.exitVehicle(); return out; })()`);
  ok("transport ichidan dron uchirilmaydi", dv[0] === true && dv[1] === false && dv[2] === false && dv[3] === false, JSON.stringify(dv));
  await T(`(D.setClass(0), D.applyLoadout(), P.pos.set(20, 0, 30), 1)`);

  // --- aqlli noyob qurollar ---
  // bazuka: faqat ko'rib turgan transport belgilanadi (mo'ljalga olish shart emas), raketa o'shani quvadi
  // 1) to'siq ortidagi (ko'rinmayotgan) transport belgilanmaydi
  const hid = await T(`(() => { D.giveSpecial(0); G.switchT = 0; G.lock = null; const v = G.vehicles[2], c = v.center(new V3());
    for (const R of [40, 30, 55]) for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, x = c.x + Math.sin(a) * R, z = c.z + Math.cos(a) * R, e = new V3(x, P.eyeH, z);
      if (Math.abs(x) > 66 || Math.abs(z) > 66 || W.pointInBox(new V3(x, 1, z)) || W.los(e, c, v.box) || W.los(e, new V3(c.x, c.y + 0.5, c.z), v.box)) continue;
      P.pos.set(x, 0, z); P.vel.set(0, 0, 0); P.yaw = Math.atan2(-(c.x - x), -(c.z - z)); P.pitch = Math.atan2(c.y - P.eyeH, R); return 1; }
    return 0; })()`);
  await sleep(1500);
  const hid1 = await T(`[!!G.lock, document.getElementById('lockBox').style.display]`);
  ok("bazuka: to'siq ortidagi (ko'rinmayotgan) transport belgilanmaydi", hid === 1 && !hid1[0] && hid1[1] === 'none', JSON.stringify([hid, hid1]));
  // 2) ko'rinib turgan, lekin o'yinchi boshqa tomonga qarab turgan transport ham belgilanmaydi
  // (o'yinchi jipdan 40 m narida, oradagi ko'rinish ochiq bo'lgan tomonga qo'yiladi — daraxt yoki to'siq belgilashga xalaqit beradi)
  await T(`(() => { G.switchT = 0; const v = G.vehicles[2], c = v.center(new V3());
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, x = c.x + Math.sin(a) * 40, z = c.z + Math.cos(a) * 40;
      if (Math.abs(x) > 66 || Math.abs(z) > 66 || W.pointInBox(new V3(x, 1, z)) || !W.los(new V3(x, P.eyeH, z), c, v.box)) continue;
      P.pos.set(x, 0, z); P.vel.set(0, 0, 0); window.__yaw0 = Math.atan2(-(c.x - x), -(c.z - z)); window.__pit0 = Math.atan2(c.y - P.eyeH, 40); P.yaw = window.__yaw0 + 0.25; P.pitch = window.__pit0; break; }
    return G.weapons[G.wi].def.id; })()`);
  await sleep(1400);
  const away = await T(`[!!G.lock, G.ads]`);
  // 3) nishon belgisi transport ustiga keltirilsa (o'ng tugmasiz) — belgilanadi
  await T(`(P.yaw = window.__yaw0, 1)`);
  const lk = await until(`G.lock && G.lock.locked`, 6000);
  const lk1 = await T(`[!!G.lock, G.lock && G.lock.veh.type, document.getElementById('lockTxt').textContent, document.getElementById('lockBox').className, G.ads]`);
  ok("bazuka: chetga qarab turganda belgilanmaydi; ko'rib turgan transportga nishon keltirilsa (mo'ljalga olmasdan) belgilanadi", !away[0] && lk && lk1[1] === 'jeep' && /BELGILANDI/.test(lk1[2]) && lk1[3] === 'on' && lk1[4] < 0.1, JSON.stringify([away, lk1]));
  // nishondan chetga qarab otiladi — raketa baribir transportga boradi
  const jh0 = await T(`(() => { const v = G.vehicles[2]; v.hp = 600; P.yaw = window.__yaw0 + 0.06; P.pitch += 0.04; G.fireT = 0; G.switchT = 0; D.tryFire(); return [v.hp, G.projectiles.length, !!(G.projectiles[0] && G.projectiles[0].target)]; })()`);
  await until(`G.vehicles[2].hp < 600 || !G.vehicles[2].alive`, 8000);
  const jh1 = await T(`[G.vehicles[2].alive, Math.round(G.vehicles[2].hp)]`);
  ok("qulflangan raketa nishonni o'zi quvib tegadi (jip yo'q qilindi yoki og'ir shikastlandi)", jh0[1] === 1 && jh0[2] === true && (!jh1[0] || jh1[1] <= 60), JSON.stringify([jh0, jh1]));
  // dron: o'yinchi o'zi boshqaradi — bitta dron, bitta bomba; nishonga tez borib urilsa portlaydi; bitta o'q tegsa yo'q bo'ladi
  await T(`(() => { for (const s of G.soldiers.slice()) if (s.team === 'enemy') { s.alive = false; s.dispose(); } P.pos.set(0, 0, 40); P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = 0;
    D.giveSpecial(3); G.switchT = 0; G.fireT = 0; D.tryFire(); return 1; })()`);
  await sleep(300);
  const dr0 = await T(`[!!G.drone, G.droneCtl, G.drone && G.drone.bombs, G.projectiles.length, document.getElementById('droneHud').style.display, G.weapons[G.wi].def.id]`);
  ok("dron uchirildi: boshqaruv dronga o'tdi, 1 ta bomba, o'zi hech narsaga otilmadi", dr0[0] && dr0[1] === true && dr0[2] === 1 && dr0[3] === 0 && dr0[4] === 'block', JSON.stringify(dr0));
  await T(`(D.keys.KeyW = true, D.keys.Space = true, 1)`); await sleep(1600);
  const dr1 = await T(`(D.keys.KeyW = false, D.keys.Space = false, [+G.drone.pos.z.toFixed(1), +G.drone.pos.y.toFixed(1), +P.pos.z.toFixed(1), +P.pos.y.toFixed(2), D.camera.position.distanceTo(G.drone.pos) < 0.3])`);
  ok("W va PROBEL dronni uchiradi (oldinga va tepaga); o'yinchining o'zi joyida qoladi, kamera — dronda", dr1[0] < 34 && dr1[1] > 5 && dr1[2] === 40 && Math.abs(dr1[3]) < 0.05 && dr1[4] === true, JSON.stringify(dr1));
  // bomba: pastga qarab tashlanadi — dron ostidagi dushman halok bo'ladi
  await sleep(700);
  await T(`(() => { const d = G.drone; D.spawnEnemy('rifle'); const s = G.soldiers[G.soldiers.length - 1]; s.pos.set(d.pos.x, 0, d.pos.z - 0.5); s.hp = 100; s.update = function () { this.root.position.copy(this.pos); }; window.__tgt = s;
    d.shotT = 99; P.pitch = -1.5; D.mouse.L = true; return 1; })()`);
  await until(`G.drone && G.drone.bombs === 0`, 3000); await T(`(D.mouse.L = false, 1)`);
  await until(`!window.__tgt.alive`, 6000);
  const dr2 = await T(`[G.drone ? G.drone.bombs : -1, !window.__tgt.alive, G.droneCtl]`);
  ok("chap tugma yagona bombani tashlaydi (1 → 0), ostidagi dushman halok bo'ladi; dron uchishda davom etadi", dr2[0] === 0 && dr2[1] === true && dr2[2] === true, JSON.stringify(dr2));
  // yana bosilsa — boshqa bomba yo'q; sekin tegsa (qo'nsa) portlamaydi
  await T(`(G.drone.shotT = 99, G.drone.fireT = 0, D.mouse.L = true, 1)`); await sleep(500);
  const dr2b = await T(`(D.mouse.L = false, [G.drone ? G.drone.bombs : -1, G.projectiles.length])`);
  const yKeep = await T(`(() => { const d = G.drone; window.__dy = d.pos.y; d.shotT = 99; d.pos.y = W.baseHeight(d.pos.x, d.pos.z) + 0.9; d.vel.set(0, -3, 0); return 1; })()`);
  await sleep(600);
  const dr2c = await T(`[!!G.drone, G.droneCtl]`);
  ok("bomba bitta: qayta bosilsa hech narsa otilmaydi; sekin tegsa (qo'nsa) dron portlamaydi", dr2b[0] === 0 && dr2b[1] === 0 && yKeep === 1 && dr2c[0] === true && dr2c[1] === true, JSON.stringify([dr2b, dr2c]));
  // borib urilsa portlaydi: dron tepadan [SHIFT] bilan raqib ustiga sho'ng'iydi — o'zi portlaydi, raqib halok bo'ladi, boshqaruv o'yinchiga qaytadi
  await T(`(() => { const d = G.drone; d.shotT = 99; d.pos.y = window.__dy; d.vel.set(0, 0, 0); D.spawnEnemy('rifle'); const s = G.soldiers[G.soldiers.length - 1]; s.pos.set(d.pos.x + 0.4, 0, d.pos.z); s.hp = 100; s.update = function () { this.root.position.copy(this.pos); }; window.__tgt2 = s;
    D.keys.ShiftLeft = true; return 1; })()`);
  await until(`!G.drone`, 6000);
  const dr3 = await T(`(D.keys.ShiftLeft = false, [!!G.drone, G.droneCtl, +P.yaw.toFixed(2), +P.pitch.toFixed(2), !window.__tgt2.alive, document.getElementById('droneHud').style.display, P.hp])`);
  ok("dron raqibga tez borib urilsa portlaydi: raqib halok, dron yo'q, boshqaruv va qarash yo'nalishi o'yinchiga qaytadi", dr3[0] === false && dr3[1] === false && dr3[2] === 0 && dr3[3] === 0 && dr3[4] === true && dr3[5] === 'none' && dr3[6] === 100, JSON.stringify(dr3));
  // dushman dronni ko'rsa — bitta o'q bilan urib tushiradi
  await T(`(() => { P.pos.set(0, 0, 40); P.yaw = 0; P.pitch = 0; D.giveSpecial(3); G.switchT = 0; G.fireT = 0; D.tryFire();
    D.spawnEnemy('rifle'); const s = G.soldiers[G.soldiers.length - 1]; s.pos.set(4, 0, 30); s.hp = 1e9; s.update = function () { this.root.position.copy(this.pos); }; return 1; })()`);   // (jon katta: ittifoqchi botlar uni dron urilguncha o'ldirib qo'ymasin)
  await sleep(200);
  const dr4 = await T(`!!G.drone && G.droneCtl`);
  await until(`!G.drone`, 20000);
  ok("dushman askar ko'rgan dronni urib tushiradi (joni yo'q)", dr4 === true && (await T(`!G.drone && !G.droneCtl`)) === true, 'uchirildi=' + dr4);
  await T(`(() => { for (const s of G.soldiers.slice()) if (s.team === 'enemy') { s.alive = false; s.dispose(); } return 1; })()`);
  // jon o'zi tiklanmaydi
  const hp0 = await T(`(P.hp = 50, P.lastHurt = G.time - 30, G.time)`); await until(`G.time - ${hp0} > 2`, 9000);
  ok("jon o'zi tiklanmaydi (2 soniyadan keyin ham 50)", (await T(`P.hp`)) === 50, 'jon=' + await T(`P.hp`));
  await T(`(P.hp = 100, 1)`);
  // katta xarita [M] va ko'rib qolingan raqib
  await T(`(() => { D.spawnEnemy('rifle'); const s = G.soldiers[G.soldiers.length - 1]; s.hp = 1e9; s.update = function () { this.root.position.copy(this.pos); }; window.__tgt = s; P.pos.set(0, 0, 40); P.yaw = 0; P.pitch = 0; s.pos.set(0, 0, 22); return 1; })()`);
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })), 1`); await sleep(600);
  const mp1 = await T(`[document.getElementById('bigmap').style.display, G.bigMap, G.time - (window.__tgt.seenAt || -99) < 3, document.getElementById('minimap').width]`);
  await shot(`feat_${era}_bigmap`);
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })), 1`); await sleep(200);
  ok("[M] katta xaritani ochadi/yopadi; ko'z oldidagi raqib xaritada belgilanadi; mini xarita kattalashgan (260)", mp1[0] === 'block' && mp1[1] === true && mp1[2] === true && mp1[3] === 260 && (await T(`G.bigMap`)) === false, JSON.stringify(mp1));
  await T(`(() => { for (const s of G.soldiers.slice()) if (s.team === 'enemy') { s.alive = false; s.dispose(); } return 1; })()`);
  // turel: o'rnatiladi va o'zi otadi
  await T(`(() => { P.pos.set(0, 0, 40); P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = 0; D.giveSpecial(1); G.switchT = 0; G.fireT = 0; D.tryFire(); P.yaw = Math.PI;   // o'yinchi orqaga qarab turadi: raqibni turel ko'radi
    D.spawnEnemy('rifle'); const s = G.soldiers[G.soldiers.length - 1]; s.pos.set(3, 0, 26); s.hp = 100; s.seenAt = 0; s.update = function () { this.root.position.copy(this.pos); }; window.__tgt = s; return 1; })()`);
  const tu0 = await T(`[G.turrets.length, G.turrets[0] && G.turrets[0].own, G.weapons[G.wi].mag]`);
  await until(`!window.__tgt.alive`, 9000);
  await shot(`feat_${era}_turret`);
  const tu1 = await T(`[!window.__tgt.alive, window.__tgt.seenAt > 0, G.turrets[0] && G.turrets[0].hp]`);
  ok("avtomatik turel: yaqindagi dushmanni o'zi otib o'ldiradi va uni xaritada belgilaydi (razvedka); joni bor (yo'q qilsa bo'ladi)", tu0[0] === 1 && tu0[1] === true && tu0[2] === 0 && tu1[0] === true && tu1[1] === true && tu1[2] === 140, JSON.stringify([tu0, tu1]));
  await T(`(P.yaw = 0, 1)`);
  // tovush belgilari: yurgan raqibning qadami va o'q uzilgan joy xaritada qoladi; cho'kkalab yurgan — sassiz
  const nz = await T(`(() => { G.noises.length = 0; D.spawnEnemy('rifle'); const s = G.soldiers[G.soldiers.length - 1]; s.hp = 1e9; s.update = function () { this.root.position.copy(this.pos); }; s.pos.set(6, 0, 30); P.pos.set(0, 0, 40);
    s.crouchAmt = 1; s.footstep(1, 4); s.footstep(1, 4); const quiet = G.noises.length; s.crouchAmt = 0; s.footstep(1, 4); s.footstep(1, 4); const steps = G.noises.filter((n) => n.kind === 'step').length;
    s.pos.set(60, 0, 30); s.stepD = 0; s.footstep(1, 4); s.footstep(1, 4); const far = G.noises.filter((n) => n.kind === 'step').length;
    G.noise(new V3(50, 0, -50), 'shot'); G.noise(new V3(50.5, 0, -50), 'shot'); const shots = G.noises.filter((n) => n.kind === 'shot').length; s.alive = false; s.dispose(); return [quiet, steps, far, shots]; })()`);
  ok("qadam tovushi: yaqindagi raqib xaritada iz qoldiradi, cho'kkalagan yoki uzoqdagi — yo'q; bir joydan otilgan o'qlar bitta belgi", nz[0] === 0 && nz[1] >= 1 && nz[2] === nz[1] && nz[3] === 1, JSON.stringify(nz));

  // --- yangi shahar ---
  const ct = await T(`(() => { G.spMap = 'city'; D.createScene('${era}'); document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 99999;
    return [G.world.map, G.world.half, G.pickups.length, G.world.pits.length, G.world.boxes.length > 1000, G.vehicles.length, G.items.length, G.world.spawns.every((s) => G.world.reachable(s.x, s.z))]; })()`);
  ok("yangi shahar: 200×200 m, 12 ta noyob qurol (6 ta podval), transport va vositalar joyida, barcha paydo bo'lish nuqtalari ochiq", ct[0] === 'city' && ct[1] === 100 && ct[2] === 12 && ct[3] === 6 && ct[4] && ct[5] === 9 && ct[6] > 40 && ct[7], JSON.stringify(ct));
  // ikki qavatli uy (-26, -27): zinadan ikkinchi qavatga chiqish (zina shimoliy devor bo'ylab, g'arbdan sharqqa)
  await T(`(P.pos.set(-31.2, 0, -31.05), P.vel.set(0, 0, 0), P.yaw = -Math.PI / 2, P.pitch = 0, D.keys.KeyW = true, 1)`);
  await until(`P.pos.y > 3.4`, 9000);
  const up = await T(`(D.keys.KeyW = false, [+P.pos.x.toFixed(1), +P.pos.y.toFixed(2), +P.pos.z.toFixed(1)])`);
  ok('ikki qavatli uy: zinadan ikkinchi qavatga chiqiladi (y = 3.45)', Math.abs(up[1] - 3.45) < 0.06, JSON.stringify(up));
  await shot(`feat_${era}_floor2`);
  // dot ichida tuynukdan tashqari ko'rinadi, devor esa o'qni to'sadi
  const bk = await T(`[W.los(new V3(26.3, 1.62, 25.3), new V3(10, 1.5, 25.3)), W.los(new V3(26.3, 1.0, 25.3), new V3(10, 1.0, 25.3)), !!W.pointInBox(new V3(25, 2.8, 25))]`);
  ok("dot: tuynukdan (ko'z balandligida) tashqari ko'rinadi, undan pastda devor to'sadi, tepasi tom bilan yopiq", bk[0] === true && bk[1] === false && bk[2] === true, JSON.stringify(bk));
  // --- transportsiz jang ---
  const nv = await T(`(() => { G.spVeh = false; D.createScene('${era}'); D.startGame(); G.waveTimer = 99999; const a = [G.vehicles.length, G.world.vehSpawns.length]; G.spVeh = true; G.spMap = 'town'; return a; })()`);
  ok("transportsiz jang: xaritada transport yo'q", nv[0] === 0 && nv[1] === 0, JSON.stringify(nv));
  // --- jang tugaganda/yangi jang boshlanganda oldingi jangdan hech narsa qolmaydi ---
  const eo0 = await T(`(() => { G.lastEnemyRocket = G.time + 500; G.droneWarnT = G.time + 500; D.damagePlayer(9999, null, null, true); return [P.alive, +document.getElementById('hurt').style.opacity]; })()`);
  await until(`G.state === 'over'`, 9000); await sleep(200);
  const eo1 = await T(`[G.state, +document.getElementById('hurt').style.opacity, +document.getElementById('flashbang').style.opacity, +document.getElementById('adsVig').style.opacity, !!G.drone]`);
  const eo2 = await T(`(() => { document.getElementById('end').classList.add('hidden'); D.createScene('${era}'); D.startGame(); G.waveTimer = 99999; for (const s of G.soldiers) s.hp = 1e9; return [G.lastEnemyRocket, G.droneWarnT, G.state, P.alive]; })()`);
  ok("halok bo'lgach yakun oynasida qizil parda qolmaydi; yangi jangda oldingi jangning vaqt belgilari tozalanadi", eo0[0] === false && eo1[0] === 'over' && eo1[1] === 0 && eo1[2] === 0 && eo1[3] === 0 && eo1[4] === false && eo2[0] === -99 && eo2[1] < 0 && eo2[3] === true, JSON.stringify([eo0, eo1, eo2]));
  // --- noyob qurollar ham tasodifiy xonalarda: ikki xil urug' bilan ikki jang (yangi shahar) ---
  const rs = [];
  for (const sd of [4242, 90017]) rs.push(await T(`(() => { G.spMap = 'city'; G.seedNext = ${sd}; D.createScene('${era}'); D.startGame(); G.waveTimer = 99999; for (const s of G.soldiers) s.hp = 1e9;
    const W = G.world, cnt = {}; for (const p of G.pickups) cnt[p.def.id] = (cnt[p.def.id] || 0) + 1;
    const inRoom = G.pickups.filter((p) => W.roomSpots.some((r) => Math.hypot(r.x - p.pos.x, r.z - p.pos.z) < 0.01 && Math.abs(r.y + 0.95 - p.pos.y) < 0.01)).length;
    const bad = G.pickups.filter((p) => W.pointInBox(p.pos)).length, dead = G.loot.filter((l) => l.dead).length;
    const clash = G.loot.filter((l) => !l.dead && G.pickups.some((p) => Math.hypot(p.pos.x - l.pos.x, p.pos.z - l.pos.z) < 0.3 && Math.abs(p.pos.y - l.pos.y) < 1.5)).length;
    return [G.lootSeed, G.pickups.length, Object.values(cnt).join(), inRoom, G.specialRooms.size, dead, bad, clash, G.pickups.map((p) => p.def.id[0] + Math.round(p.pos.x) + ':' + Math.round(p.pos.z)).join(' ')]; })()`));
  ok("noyob qurollar har jangda tasodifiy joylashadi: bir qismi xonalarda, turlari teng (3 tadan), to'siq ichida emas, o'sha xonada oddiy qurol yo'q",
    rs.every((r) => r[1] === 12 && r[2] === '3,3,3,3' && r[3] >= 3 && r[3] === r[4] && r[5] === r[4] && r[6] === 0 && r[7] === 0) && rs[0][8] !== rs[1][8], JSON.stringify(rs.map((r) => r.slice(0, 8))));
  // noyob qurolni xonadan olish
  const rp = await T(`(() => { const W = G.world, p = G.pickups.find((q) => W.roomSpots.some((r) => Math.hypot(r.x - q.pos.x, r.z - q.pos.z) < 0.01 && Math.abs(r.y + 0.95 - q.pos.y) < 0.01));
    P.pos.set(p.pos.x, p.pos.y - 0.95, p.pos.z); P.vel.set(0, 0, 0); window.__sp = p; return [p.id, p.def.id]; })()`);
  await sleep(300); await T(`(D.interact(), 1)`); await sleep(250);
  const rp1 = await T(`[G.weapons.length, G.weapons[G.wi].def.id, window.__sp.taken]`);
  ok("xonaga tushgan noyob qurol [E] bilan olinadi (5-o'ringa)", rp1[0] === 5 && rp1[1] === rp[1] && rp1[2] === true, JSON.stringify([rp, rp1]));
  await T(`(G.spMap = 'town', 1)`);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close();
}

async function multi() {
  L('=== TARMOQ');
  const mk = async (name) => { const w = await wsConnect(`http://localhost:${PORT}/ws`); const b = { w, ev: [], code: null, id: 0, key: null, state: null, lobby: null, pos: [30, 0, 0] };
    w.on = (o) => { if (o.t === 'joined') { b.code = o.code; b.id = o.id; b.key = o.key; b.re = o.re; } else if (o.t === 's') b.state = o; else if (o.t === 'lobby') b.lobby = o; else b.ev.push(o); }; b.name = name; return b; };
  const A = await mk('BotA');
  A.w.send({ t: 'create', name: 'BotA', era });
  await sleep(300);
  A.w.send({ t: 'mode', mode: 'tdm' }); A.w.send({ t: 'veh', on: 0 });
  await sleep(200);
  ok("lobbi: jamoaviy rejim va transportsiz jang tanlandi", A.lobby && A.lobby.mode === 'tdm' && A.lobby.veh === 0, JSON.stringify(A.lobby && [A.lobby.mode, A.lobby.veh, A.lobby.map]));
  const pg = await openPage(`http://localhost:${PORT}/?kod=${A.code}&ism=Ali`, { port: 9512, dir: 'p_feat2' });
  const { ev } = pg;
  await sleep(1500);
  let B = await mk('BotB');
  B.w.send({ t: 'join', name: 'BotB', code: A.code });
  await sleep(500);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, V3 = P.pos.constructor; return ${body}; })()`);
  const wait = async (fn, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (fn()) return true; await sleep(100); } return false; };
  const iv = setInterval(() => { for (const b of [A, B]) if (b.w) b.w.send({ t: 'p', x: b.pos[0], y: b.pos[1], z: b.pos[2], yw: 0, pt: 0, cr: 0, w: 0 }); }, 50);
  A.pos = [30, 0, 0]; B.pos = [30, 0, 6];
  ok("lobbida transportsiz jang va jamoaviy rejim qoidasi ko'rsatiladi", /Jamoaviy jang/.test(await ev(`document.getElementById('lobbyRules').innerText`)) && /Transportsiz/.test(await ev(`document.getElementById('lobbyRules').innerText`)));
  // jamoa tanlash: BotA — Ko'k (2); BotB va sahifa — Qizil (1); sahifa lobbidagi tugma orqali tanlaydi
  A.w.send({ t: 'team', tm: 2 }); B.w.send({ t: 'team', tm: 1 });
  const row = await ev(`getComputedStyle(document.getElementById('lobbyTeamRow')).display`);
  await ev(`document.querySelector('.lobbyTeam[data-tm="1"]').click(), 1`); await sleep(500);
  const lt = await ev(`[document.querySelector('.lobbyTeam.sel') && document.querySelector('.lobbyTeam.sel').dataset.tm, document.getElementById('lobbyPlayers').innerText.replace(/\\n+/g, ' | ')]`);
  ok("lobbida jamoa tanlanadi: tugma belgilanadi, ro'yxatda har kimning jamoasi ko'rinadi", row === 'flex' && lt[0] === '1' && /BotA.*KO'K/.test(lt[1]) && /BotB.*QIZIL/.test(lt[1]) && /Ali.*QIZIL/.test(lt[1]), JSON.stringify([row, lt]));
  A.w.send({ t: 'start' });
  await sleep(2200);
  await T(`(D.pickSelect(0), G.state = 'playing', 1)`);
  await sleep(600);
  const st = () => A.state, me = () => st().p.find((p) => p.id !== A.id && p.id !== B.id), pa = () => st().p.find((p) => p.id === A.id), pb = () => st().p.find((p) => p.id === B.id);
  const tms = [pa().tm, me().tm, pb().tm];
  ok("jang tanlangan jamoalar bilan boshlanadi: BotA — 2, sahifa va BotB — 1; transport yo'q", tms[0] === 2 && tms[1] === 1 && tms[2] === 1 && st().v.length === 0 && (await T(`G.vehicles.length`)) === 0, JSON.stringify(tms));
  // sherikka o'q tegmaydi, raqibga tegadi
  await T(`(G.net.send({ t: 'hit', target: ${B.id}, dmg: 60, head: false, kind: 'bullet' }), 1)`); await sleep(350);
  const ff = pb().hp;
  A.w.send({ t: 'hit', target: me().id, dmg: 30, head: false, kind: 'bullet' }); await sleep(350);
  ok("sherikka zarar yetmaydi (100), raqibdan zarar yetadi (70)", ff === 100 && me().hp === 70, `sherik=${ff} o'zim=${me().hp}`);
  // sherik uzoqdan ham taniladi: belgisi devor ortidan ko'rinadi va masofaga qarab kattalashadi; raqibniki — yo'q
  await T(`(P.pos.set(-40, 0, 6), P.vel.set(0, 0, 0), 1)`); await sleep(700);
  const look = await T(`(() => { const rs = G.soldiers.filter((s) => s.team === 'remote'), fr = rs.find((r) => !G.hostile(r)), foe = rs.find((r) => G.hostile(r));
    return [G.myTeam, rs.length, !!fr && fr.id === ${B.id}, fr && fr.marker.visible, fr && fr.marker.material.depthTest, fr && +fr.marker.scale.x.toFixed(1), foe && foe.marker.visible, foe && foe.marker.material.depthTest, document.getElementById('flagStatus').textContent, document.getElementById('waveLabel').textContent]; })()`);
  ok("sherik belgisi 70 m dan ham ko'rinadi (devor ortidan, kattalashgan); raqib belgisi yashirin; ekranda jamoalar hisobi", look[0] === 1 && look[1] === 2 && look[2] === true && look[3] === true && look[4] === false && look[5] > 5 && look[6] === false && look[7] === true && /BIZ \(QIZIL\)/.test(look[8]) && /JAMOAVIY/.test(look[9]), JSON.stringify(look));
  // yotish holati serverga yetadi
  await T(`(D.toggleProne(), 1)`); await wait(() => me().cr === 2, 3000);
  const cr = me().cr; await T(`(D.setStance(0), 1)`);
  ok("yotgan holat serverga uzatiladi (cr = 2)", cr === 2, 'cr=' + cr);
  // chat: jamoaviy rejimda faqat jamoaga boradi
  B.w.send({ t: 'chat', m: 'salom <b>jamoa</b>' }); await sleep(500);
  const chP = await ev(`document.getElementById('chatLog').innerText`), chA = A.ev.filter((e) => e.t === 'chat').length;
  await T(`(G.net.send({ t: 'chat', m: 'men sherikman' }), 1)`); await sleep(500);
  const chB = B.ev.filter((e) => e.t === 'chat'), chA2 = A.ev.filter((e) => e.t === 'chat').length;
  ok("chat: jamoadoshga yetadi (belgilar tozalangan), raqib jamoaga yetmaydi", /salom bjamoa\/b/.test(chP) && chA === 0 && chA2 === 0 && chB.some((e) => e.m === 'men sherikman' && e.tm === 1), JSON.stringify([chP, chA, chB.map((e) => e.m)]));
  // jon o'zi tiklanmaydi: zarardan 5 soniya o'tgach ham 70
  await sleep(4200);
  ok("tarmoqda ham jon o'zi tiklanmaydi (70 bo'lib turibdi)", me().hp === 70, 'jon=' + me().hp);
  // dron: sahifa uchiradi → botlar joyini oladi; sherik urib tushira olmaydi, raqib — bitta o'q bilan
  await T(`(P.pos.set(-40, 0, 6), P.vel.set(0, 0, 0), P.yaw = 0, P.pitch = 0, D.giveSpecial(3), G.switchT = 0, G.fireT = 0, D.tryFire(), 1)`); await sleep(700);
  const dm = A.ev.filter((e) => e.t === 'drone' && e.id === me().id && Array.isArray(e.p));
  B.w.send({ t: 'dkill', id: me().id }); await sleep(400);
  const dAlive = await T(`!!G.drone && G.droneCtl`);
  A.w.send({ t: 'dkill', id: me().id }); await sleep(600);
  const dOff = A.ev.filter((e) => e.t === 'drone' && e.id === me().id && e.off && e.boom).length;
  ok("tarmoqda dron: joyi boshqalarga uzatiladi; sherik tegolmaydi; raqibning bitta o'qi yo'q qiladi", dm.length > 2 && dAlive === true && (await T(`!G.drone && !G.droneCtl`)) === true && dOff === 1, `xabarlar=${dm.length} sherikdan keyin tirik=${dAlive} portlash=${dOff}`);
  // raqib (BotA) droni: drobovikning bitta o'qi (ko'p sochma) — egasiga bitta xabar boradi, o'ntalab emas
  await T(`(D.setClass(3), D.applyLoadout(), P.pos.set(-40, 0, 6), P.vel.set(0, 0, 0), P.yaw = 0, P.pitch = 0, G.switchT = 0, G.fireT = 0, 1)`);
  const dk0 = A.ev.filter((e) => e.t === 'dkill').length;
  for (let i = 0; i < 6; i++) { A.w.send({ t: 'drone', p: [-40, me().y + 1.81, 6 - 5], yw: 0 }); await sleep(80); }
  const shotInfo = await T(`(() => { const r = G.rdrones && [...G.rdrones.values()][0]; if (!r) return null; r.pos.copy(r.to); D.camera.updateMatrixWorld(); G.switchT = 0; G.fireT = 0; G.reloadT = 0; D.tryFire(); return [G.weapons[G.wi].def.id, G.weapons[G.wi].def.pellets || 1, r.dead === true]; })()`);
  await sleep(500);
  const dk1 = A.ev.filter((e) => e.t === 'dkill').length - dk0;
  A.w.send({ t: 'drone', off: 1, boom: 1 }); await sleep(200);
  ok("tarmoqda raqib droniga sochma o'q: egasiga faqat bitta 'urib tushirildi' xabari boradi", !!shotInfo && shotInfo[1] > 1 && shotInfo[2] === true && dk1 === 1, JSON.stringify([shotInfo, dk1]));
  await T(`(D.setClass(0), D.applyLoadout(), 1)`);
  // dron yerga tez urilsa portlaydi — boshqalarga portlash joyi bilan uzatiladi (boom: 2)
  await T(`(P.pos.set(-40, 0, 6), P.vel.set(0, 0, 0), P.yaw = 0, P.pitch = 0, D.giveSpecial(3), G.switchT = 0, G.fireT = 0, D.tryFire(), 1)`); await sleep(1300);
  await T(`(G.drone && (D.keys.ShiftLeft = true), 1)`);
  await wait(() => A.ev.some((e) => e.t === 'drone' && e.id === me().id && e.off && e.boom === 2), 5000);
  const ram = A.ev.find((e) => e.t === 'drone' && e.id === me().id && e.off && e.boom === 2);
  ok("tarmoqda dron: yerga tez urilsa portlaydi va bu boshqalarga joyi bilan uzatiladi", !!ram && Array.isArray(ram.p) && ram.p[1] < 1.5 && (await T(`(D.keys.ShiftLeft = false, !G.drone && !G.droneCtl)`)) === true, JSON.stringify(ram));
  // turel: sahifa o'rnatadi → sherik unga zarar bera olmaydi, raqib otib yo'q qiladi
  await T(`(P.pos.set(-40, 0, 6), P.vel.set(0, 0, 0), P.yaw = 0, P.pitch = 0, D.giveSpecial(1), G.switchT = 0, G.fireT = 0, D.tryFire(), 1)`); await sleep(600);
  const tm0 = A.ev.filter((e) => e.t === 'turret' && e.id === me().id && Array.isArray(e.p)).pop();
  await sleep(2400);   // turel har 2 soniyada qayta e'lon qilinadi (jang o'rtasida qo'shilganlar ham ko'rishi uchun)
  const tmN = A.ev.filter((e) => e.t === 'turret' && e.id === me().id && Array.isArray(e.p) && tm0 && e.n === tm0.n).length;
  B.w.send({ t: 'thit', id: me().id, n: tm0 ? tm0.n : 0, dmg: 400 }); await sleep(400);
  const tAlive = await T(`G.turrets.filter((t) => t.own).length`);
  A.w.send({ t: 'thit', id: me().id, n: tm0 ? tm0.n : 0, dmg: 400 }); await sleep(600);
  ok("tarmoqda turel: boshqalarga ko'rinadi va qayta e'lon qilinadi; sherik zarar bera olmaydi; raqib otib yo'q qiladi", !!tm0 && tmN >= 2 && tAlive === 1 && (await T(`G.turrets.filter((t) => t.own).length`)) === 0 && A.ev.some((e) => e.t === 'turret' && e.id === me().id && e.off), `sherikdan keyin=${tAlive} e'lonlar=${tmN}`);
  // vosita: sahifa aptechkani oladi — serverda jon to'ladi, vosita band
  const itId = await T(`(() => { const it = G.items.find((i) => i.kind === 'med'); P.pos.set(it.pos.x, it.pos.y, it.pos.z); P.vel.set(0, 0, 0); return it.id; })()`);
  await wait(() => st().it && st().it.includes(itId) && me().hp === 100, 5000);
  ok("tarmoqda aptechka: serverda jon 100 ga to'ladi, vosita hamma uchun band bo'ladi", st().it.includes(itId) && me().hp === 100 && A.ev.some((e) => e.t === 'item' && e.id === itId && e.by === me().id), `it=${JSON.stringify(st().it)} jon=${me().hp}`);
  // zirh: server zararning yarmini zirhga yozadi
  const arId = await T(`(() => { const it = G.items.find((i) => i.kind === 'armor'); P.pos.set(it.pos.x, it.pos.y, it.pos.z); P.vel.set(0, 0, 0); return it.id; })()`);
  await wait(() => me().ar === 60, 5000);
  A.w.send({ t: 'hit', target: me().id, dmg: 40, head: false, kind: 'bullet' }); await sleep(400);
  ok("tarmoqda zirh nimcha: 40 zarar → jon 80, zirh 40", me().hp === 80 && me().ar === 40, `jon=${me().hp} zirh=${me().ar} (zirh vositasi ${arId})`);
  // xonadagi qurol: sahifa oladi — server tasdiqlaydi, hamma uchun band bo'ladi, sahifada asosiy qurol almashadi
  const lg = await T(`(() => { const l = G.loot.find((q) => !q.taken && !['pistol', 'pistol2'].includes(q.def.id) && q.def.id !== G.weapons[0].def.id); P.pos.set(l.pos.x, l.pos.y, l.pos.z); P.vel.set(0, 0, 0); return [l.id, l.def.id, G.lootSeed, G.loot.length]; })()`);
  await sleep(300); await T(`(D.interact(), 1)`);
  await wait(() => st().it && st().it.includes(lg[0]), 4000); await sleep(250);
  const lg1 = await T(`[G.weapons[0].def.id, G.loot[${lg[0]} - 300].taken, G.loot[${lg[0]} - 300].mesh.visible]`);
  B.w.send({ t: 'item', id: lg[0], k: 'gun' }); B.w.send({ t: 'item', id: lg[0] + 1, k: 'med' }); await sleep(350);   // band qurolni boshqa o'yinchi ola olmaydi; qurol raqami bilan vosita so'rab bo'lmaydi
  ok("tarmoqda xonadagi qurol: server tasdiqlaydi, hamma uchun band bo'ladi, sahifada asosiy qurol almashadi (urug' serverdan keladi)",
    lg[0] >= 300 && lg[3] >= 8 && st().it.includes(lg[0]) && !st().it.includes(lg[0] + 1) && lg1[0] === lg[1] && lg1[1] === true && lg1[2] === false && A.ev.filter((e) => e.t === 'item' && e.id === lg[0]).length === 1 && A.ev.some((e) => e.t === 'start' && e.seed === 0),
    JSON.stringify([lg, lg1, st().it]));
  // halok bo'lganda kim o'ldirgani ko'rsatiladi
  A.w.send({ t: 'hit', target: me().id, dmg: 500, head: true, kind: 'bullet', wn: 'Sinov miltig\'i' }); await wait(() => !me().al, 3000);
  let kc = '';   // kartochka keyingi kadrda chiziladi — sekin mashinada biroz kutamiz
  for (let i = 0; i < 40 && !kc; i++) { await sleep(100); kc = await ev(`document.getElementById('killCard').innerText.replace(/\\n+/g, ' | ')`); }
  ok("halok bo'lganda kim, qaysi qurol bilan o'ldirgani ko'rsatiladi", /BotA/.test(kc) && /Sinov miltig/.test(kc) && /masofa/.test(kc), kc);
  // qayta ulanish: BotB aloqani yo'qotadi va qaytadi — raqami va jamoasi saqlanadi
  const killsA = pa().k, oldB = { id: B.id, key: B.key };
  B.w.close(); B.w = null; await sleep(700);
  const gone = A.lobby.players.find((p) => p.id === oldB.id);
  ok("aloqasi uzilgan o'yinchi xonada saqlanadi (kutilmoqda deb belgilanadi)", !!gone && gone.gone === 1 && A.ev.some((e) => e.t === 'away' && e.id === oldB.id), JSON.stringify(gone));
  B = await mk('BotB');
  B.w.send({ t: 'rejoin', code: A.code, id: oldB.id, key: oldB.key }); await sleep(600);
  const back = A.lobby.players.find((p) => p.id === oldB.id);
  ok("qayta ulanish: o'sha raqam va jamoa bilan qaytadi, jang holati yuboriladi", B.id === oldB.id && B.re === 1 && !!back && !back.gone && B.ev.some((e) => e.t === 'start') && pb().tm === 1, `id=${B.id} re=${B.re} jamoa=${pb().tm}`);
  const C = await mk('Begona');
  C.w.send({ t: 'rejoin', code: A.code, id: A.id, key: 'notogri' }); await sleep(400);
  ok("noto'g'ri kalit bilan birovning o'rniga ulanib bo'lmaydi", C.id === 0 && C.ev.some((e) => e.t === 'error'), JSON.stringify(C.ev.slice(0, 1)));
  C.w.close();
  // jamoa hisobi: ikkinchi o'ldirishda (TDM_TARGET=2) jang tugaydi — BotA ning jamoasi (2) g'olib (qayta tug'ilgandagi 2 soniyalik himoya o'tgach)
  await wait(() => me().al, 9000); await sleep(2300);
  A.w.send({ t: 'hit', target: me().id, dmg: 500, head: false, kind: 'bullet' });
  await wait(() => A.ev.some((e) => e.t === 'end'), 5000);
  const end = A.ev.find((e) => e.t === 'end');
  ok("jamoaviy jang: 2 ta o'ldirishda 2-jamoa g'olib (hisob 0 : 2)", !!end && end.mode === 'tdm' && end.team === 2 && end.tk[0] === 0 && end.tk[1] === 2 && killsA === 1, JSON.stringify(end && [end.mode, end.team, end.tk]));
  await sleep(700);
  const et = await ev(`[document.getElementById('endTitle').textContent, document.getElementById('endSub').textContent]`);
  ok("sahifa: yakun oynasida raqib jamoa g'olibligi va tajriba ko'rsatiladi", /RAQIB JAMOA/.test(et[0]) && /Tajriba/.test(et[1]), JSON.stringify(et));
  clearInterval(iv);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close(); A.w.close(); B.w && B.w.close();
}

(async () => {
  await single();
  await multi();
  L(fails ? `YAKUN: ${fails} ta xato` : "YAKUN: hammasi o'tdi");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
