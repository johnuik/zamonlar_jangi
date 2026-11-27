// "Hamma joyni yurib chiqish" sinovi: har bir davr × xaritada (yakka o'yin), zombi rejimida va tarmoq jangida o'yin boshlanadi,
// botlar jang qiladi, o'yinchi esa hamma klass va qurolni ishlatadi, yotadi/oshib o'tadi, vositalarni va xonadagi qurollarni oladi,
// noyob qurollarni (bazuka, turel, tankbuzar, dron) qo'llaydi, har bir transportning har bir o'rniga o'tiradi, halok bo'ladi.
// Hech qayerda JS xatosi, NaN yoki qotib qolgan kadr bo'lmasligi kerak.
// Ishlatish: PORT=8191 ZJ_SEED=424242 ZJ_ZONE=1 node server.js   so'ng   node tests/smoke.test.js
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191;
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };

// Sahifa ichida bajariladigan harakatlar ketma-ketligi. Har bir qadam alohida ushlanadi: bittasi xato bersa ham qolganlari tekshiriladi.
const ACTIONS = (zombie) => `(async () => {
  const G = window.__G, D = window.__dbg, P = D.player, V3 = P.pos.constructor, W = G.world;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [], step = async (name, fn) => { try { await fn(); } catch (e) { log.push(name + ': ' + (e && e.stack ? e.stack.split('\\n').slice(0, 3).join(' | ') : e)); } };
  const key = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); };
  const keep = setInterval(() => { if (P.alive && !G.mp) P.hp = 100; }, 80);
  const home = () => { const s = W.playerSpawn || W.spawns[0]; P.pos.set(s.x, s.y || 0, s.z); P.vel.set(0, 0, 0); };
  const fireAll = async () => { for (let i = 0; i < G.weapons.length; i++) { D.switchWeapon(i); G.switchT = 0; G.fireT = 0; D.mouse.L = true; await sleep(120); D.mouse.L = false; D.mouse.R = true; await sleep(100); D.mouse.R = false; key('KeyR'); await sleep(40); G.reloadT = 0; } };
  await step("to'lqin", async () => { if (!G.mp && !${zombie}) G.waveTimer = 0.3; await sleep(2200); });
  if (${zombie}) {
    await step('zombi: otish va fonar', async () => { await fireAll(); D.toggleTorch(); await sleep(200); D.toggleTorch(); });
    await step('zombi: yashik qurollari', async () => { for (const k of ['smg', 'shotgun', 'ar', 'lmg', 'sniper']) { D.giveCrateWeapon(k); G.switchT = 0; G.fireT = 0; D.mouse.L = true; await sleep(150); D.mouse.L = false; } });
    await step('zombi: yashikni ochish', async () => { const c = W.crates && W.crates[0]; if (c) { const p = c.pos || c; P.pos.set(p.x + 0.8, 0, p.z); await sleep(200); D.interact(); await sleep(300); } });
    await step('zombi: xonadagi qurollar va shovqin', async () => { for (const l of (G.loot || []).filter((q) => !q.dead).slice(0, 3)) { P.pos.set(l.pos.x, l.pos.y, l.pos.z); await sleep(120); D.interact(); await sleep(140); await fireAll(); } D.spawnGrenade(new V3(P.pos.x + 8, 1, P.pos.z), new V3(1, 3, 0), 'player', null, 0.4); await sleep(700); });
    await step('zombi: vazifalar zanjiri', async () => { const Z = G.zg;
      const go = async (x, z, y = 0) => { P.pos.set(x, y, z); P.vel.set(0, 0, 0); await sleep(700); };
      await go(Z.stages[0].x, Z.stages[0].z + 2);
      for (let i = 0; i < Z.spots.length; i++) { const s = Z.spots[i]; await go(s[0] + 0.5, s[1] + 0.4, s[2]); D.interact(); await sleep(300); }
      await go(Z.stages[2].x, Z.stages[2].z + 3); await sleep(1500); Z.hold = Math.min(Z.hold, 0.5); await sleep(900);
      await go(Z.stages[3].x, Z.stages[3].z); await go(Z.stages[4].x, Z.stages[4].z + 3); await sleep(2000);
      if (Z.stage !== 4) throw new Error('bosqich ' + Z.stage + ' (kutilgan 4), qismlar ' + Z.got.join()); });
  } else {
    await step('klasslar va qurollar', async () => { for (let c = 0; c < 6; c++) { if (D.setClass(c) !== false) D.applyLoadout(); await fireAll(); } D.setClass(0); D.applyLoadout(); });
    await step("qo'shimchalar", async () => { for (const a of ['grip', 'extmag', 'optic', 'supp', 'laser']) { D.prog.toggleAttach(a); } D.applyLoadout(); await fireAll(); for (const a of ['grip', 'extmag', 'optic', 'supp', 'laser']) D.prog.toggleAttach(a); D.applyLoadout(); });
    await step('holatlar', async () => { D.toggleCrouch(); await sleep(200); D.toggleProne(); await sleep(400); D.keys.KeyW = true; await sleep(300); D.keys.KeyW = false; D.mouse.L = true; await sleep(100); D.mouse.L = false;
      D.setStance(0); await sleep(350); D.keys.Space = true; await sleep(100); D.keys.Space = false; await sleep(450); D.tryVault(); await sleep(500); D.keys.ShiftLeft = true; D.keys.KeyW = true; await sleep(300); D.keys.ShiftLeft = false; D.keys.KeyW = false; });
    await step('vositalar', async () => { for (const k of ['med', 'band', 'armor', 'adr', 'ammo', 'nade']) D.applyItem(k); D.useBandage(); await sleep(250); for (const it of (G.items || []).slice(0, 3)) { P.pos.set(it.pos.x, it.pos.y, it.pos.z); await sleep(160); } });
    await step('xonadagi qurollar', async () => { for (const l of (G.loot || []).filter((q) => !q.dead).slice(0, 4)) { P.pos.set(l.pos.x, l.pos.y, l.pos.z); P.vel.set(0, 0, 0); await sleep(120); D.interact(); await sleep(140); await fireAll(); } });
    await step('derazadan oshish', async () => { const g = W.panes && W.panes.find((q) => !q.broken && q.y0 < 2); if (!g) return; const x = g.ax === 'x';
      for (const sd of [-1, 1]) { P.pos.set(x ? g.c : g.f + sd * 0.75, 0, x ? g.f + sd * 0.75 : g.c); P.vel.set(0, 0, 0); P.yaw = x ? (sd > 0 ? 0 : Math.PI) : (sd > 0 ? Math.PI / 2 : -Math.PI / 2); await sleep(120); if (D.tryVault()) { await sleep(900); break; } } });
    await step('noyob qurollar', async () => { for (let i = 0; i < Math.min(4, G.pickups.length); i++) { home(); P.yaw = i * 1.3; P.pitch = 0.1; D.giveSpecial(i); G.switchT = 0; G.fireT = 0; D.mouse.R = true; await sleep(150); D.mouse.R = false; D.tryFire(); await sleep(450);
      if (G.drone) { D.keys.KeyW = true; D.keys.Space = true; await sleep(700); D.mouse.L = true; await sleep(150); D.mouse.L = false; D.keys.KeyW = false; D.keys.Space = false; D.keys.ShiftLeft = true; await sleep(2300); D.keys.ShiftLeft = false; if (G.drone) D.endDrone('quit'); } } });
    await step('granata, raketa, pichoq', async () => { home(); D.spawnGrenade(new V3(P.pos.x + 7, 1, P.pos.z), new V3(2, 3, 0), 'player', null, 0.4); D.spawnProjectile(new V3(P.pos.x, 2.2, P.pos.z), new V3(40, 1, 3), 'rocket', 'player', null, false);
      D.spawnProjectile(new V3(P.pos.x, 2.2, P.pos.z), new V3(-20, 6, 3), 'gl', 'enemy', null, false); for (let i = 0; i < G.weapons.length; i++) if (G.weapons[i].def.kind === 'grenade') { D.switchWeapon(i); G.switchT = 0; D.throwGrenade(); } D.knifeAttack('slash'); await sleep(900); D.knifeAttack('stab'); await sleep(300); });
    await step('oynalar', async () => { W.breakGlass(new V3(-90, 1.6, -90), new V3(90, 1.6, 90)); W.breakGlassNear(P.pos, 40); await sleep(200); });
    await step('transport', async () => { const seen = new Set();
      for (const v of G.vehicles.slice()) { if (!v.alive || seen.has(v.type)) continue; seen.add(v.type);
        for (let seat = 0; seat < v.T.roles.length; seat++) { if (!v.alive || !P.alive) break; if (G.inVeh) D.exitVehicle(); P.pos.set(v.pos.x + v.T.r + 1.2, v.pos.y, v.pos.z); P.vel.set(0, 0, 0); await sleep(60);
          D.enterVehicle(v, seat); await sleep(140); if (!G.inVeh) continue;
          D.keys.KeyW = true; if (seat === 0) D.keys.Space = true; D.mouse.L = true; await sleep(seat === 0 ? 650 : 220); D.mouse.L = false; D.mouse.R = true; await sleep(120); D.mouse.R = false; D.keys.KeyW = false; D.keys.Space = false;
          D.toggleVehView(); D.cycleSeatGun(); await sleep(80); D.toggleVehView(); if (G.inVeh) D.exitVehicle(); await sleep(140); } }
      if (G.inVeh) D.exitVehicle(); home(); await sleep(300); });
    await step('xarita, belgi, chat', async () => { key('KeyM'); await sleep(200); key('KeyM'); D.doPing(); if (G.mp) { D.openChat(); await sleep(100); key('Escape'); } await sleep(150); });
  }
  clearInterval(keep);
  const fin = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z), bad = [];
  if (!fin(P.pos) || !fin(P.vel) || !Number.isFinite(P.yaw) || !Number.isFinite(P.pitch) || !Number.isFinite(P.hp) || !Number.isFinite(P.eyeH)) bad.push("o'yinchi");
  for (const s of G.soldiers) if (!fin(s.pos)) bad.push('askar ' + s.name);
  for (const v of G.vehicles) if (!fin(v.pos) || !Number.isFinite(v.hp)) bad.push('transport ' + v.type);
  if (!fin(D.camera.position) || !Number.isFinite(D.camera.fov)) bad.push('kamera');
  return { log, bad, state: G.state, time: +G.time.toFixed(1), soldiers: G.soldiers.length, veh: G.vehicles.length, loot: (G.loot || []).length, panes: W.panes ? W.panes.length : 0, inVeh: !!G.inVeh, drone: !!G.drone };
})()`;

(async () => {
  const pg = await openPage(`http://localhost:${PORT}/?urug=31337`, { port: 9531, dir: 'p_smoke', map: 'city' });
  const { ev, shot } = pg;
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, V3 = P.pos.constructor, W = G.world; return ${body}; })()`);
  let seen = 0;
  const round = async (title, startExpr, zombie = false) => {
    const st = await T(startExpr);
    await sleep(700);
    const t0 = await T(`G.time`);
    const r = (await ev(ACTIONS(zombie))) || { log: ['harakatlar natija bermadi'], bad: [] };
    const t1 = await T(`G.time`);
    // halok bo'lish va yakun oynasi
    const dead = zombie ? null : await T(`(D.damagePlayer(9999, null, null, true), [P.alive, G.state])`);
    await sleep(1300);
    const after = await T(`[P.alive, G.state, document.getElementById('end') && !document.getElementById('end').classList.contains('hidden')]`);
    const newErr = pg.errors.slice(seen); seen = pg.errors.length;
    ok(`${title}: xatosiz o'ynaldi (JS xatosi, NaN va qotish yo'q)`, r.log.length === 0 && r.bad.length === 0 && newErr.length === 0 && t1 > t0 + 5 && !r.inVeh && !r.drone,
      JSON.stringify({ start: st, log: r.log, bad: r.bad, xato: newErr.map((e) => String(e).slice(0, 300)), vaqt: [t0, t1], askar: r.soldiers, transport: r.veh, qurol: r.loot, oyna: r.panes, halok: dead, keyin: after }));
  };
  const sp = (era, map, seed, veh = true) => `(() => { G.era = '${era}'; G.spMode = 'waves'; G.spMap = '${map}'; G.spVeh = ${veh}; G.seedNext = ${seed}; D.createScene('${era}'); document.getElementById('menu').classList.add('hidden'); document.getElementById('end').classList.add('hidden'); D.startGame(); return [G.state, W ? G.world.map : '', G.lootSeed]; })()`;
  // ZJ_SMOKE=quick — qisqa variant (bitta davrda uch xarita); odatda hammasi
  const QUICK = process.env.ZJ_SMOKE === 'quick';
  let seed = 1000;
  for (const era of QUICK ? ['modern'] : ['modern', 'historical']) for (const map of ['city', 'town', 'big']) await round(`yakka o'yin · ${era} · ${map}`, sp(era, map, ++seed));
  if (!QUICK) await round("yakka o'yin · historical · wild (karantin zonasi, to'lqinlar)", sp('historical', 'wild', ++seed));
  await shot('smoke_sp');
  await round("yakka o'yin · transportsiz · modern · city", sp('modern', 'city', ++seed, false));
  for (const era of QUICK ? ['historical'] : ['modern', 'historical']) await round(`zombi rejimi · ${era}`, `(() => { G.era = '${era}'; G.spMode = 'zombie'; G.spVeh = true; D.createScene('${era}'); document.getElementById('menu').classList.add('hidden'); document.getElementById('end').classList.add('hidden'); D.startGame(); return [G.state, G.world.map, G.zombie]; })()`, true);
  await T(`(G.spMode = 'waves', G.spVeh = true, 1)`);
  L('JS xatolari soni (yakka):', pg.errors.length);
  pg.close();

  // --- tarmoq: bot xona ochadi, sahifa qo'shiladi; uch xil rejim va xarita ---
  const mk = async () => { const w = await wsConnect(`http://localhost:${PORT}/ws`); const b = { w, ev: [], code: null, id: 0, state: null, lobby: null };
    w.on = (o) => { if (o.t === 'joined') { b.code = o.code; b.id = o.id; } else if (o.t === 's') b.state = o; else if (o.t === 'lobby') b.lobby = o; else b.ev.push(o); }; return b; };
  let n = 0;
  for (const [mode, map, era] of [['flag', 'city', 'modern'], ['tdm', 'big', 'historical'], ['dm', 'wild', 'modern'], ['dm', 'town', 'modern']].slice(0, process.env.ZJ_SMOKE === 'quick' ? 1 : 4)) {
    const A = await mk();
    A.w.send({ t: 'create', name: 'Bot', era }); await sleep(300);
    A.w.send({ t: 'mode', mode }); A.w.send({ t: 'map', map }); A.w.send({ t: 'zone', on: 1 }); A.w.send({ t: 'team', tm: 2 }); await sleep(300);   // bot — ikkinchi jamoada (jamoaviy jangda raqib bo'lishi uchun)
    const p2 = await openPage(`http://localhost:${PORT}/?kod=${A.code}&ism=Sinov&urug=1`, { port: 9532 + n, dir: 'p_smoke' + (2 + n), map });
    n++;
    await sleep(1200);
    const iv = setInterval(() => A.w.send({ t: 'p', x: 20, y: 0, z: 20, yw: 0, pt: 0, cr: 0, w: 0 }), 60);
    A.w.send({ t: 'start' }); await sleep(2200);
    const T2 = (body) => p2.ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, V3 = P.pos.constructor, W = G.world; return ${body}; })()`);
    const st = await T2(`(D.pickSelect(0), D.pickConfirm && D.pickConfirm(), G.state = 'playing', [G.mp, G.mpMode, G.world.map, G.lootSeed, !!G.zone])`);
    await sleep(500);
    const t0 = await T2(`G.time`);
    const r = (await p2.ev(ACTIONS(false))) || { log: ['harakatlar natija bermadi'], bad: [] };
    const t1 = await T2(`G.time`);
    // bot sahifadagi o'yinchini o'ldiradi → qayta tug'iladi; jang oxirigacha davom etadi
    // (sahifaning portlashlari botni o'ldirgan bo'lishi mumkin — u qayta tug'ilguncha kutamiz: o'lik o'yinchining zarbasi hisobga olinmaydi)
    const me = () => (A.state ? A.state.p.find((q) => q.id !== A.id) : null), bot = () => (A.state ? A.state.p.find((q) => q.id === A.id) : null);
    for (let i = 0; i < 100 && !(bot() && bot().al && me() && me().al); i++) await sleep(150);
    if (me()) A.w.send({ t: 'hit', target: me().id, dmg: 500, head: true, kind: 'bullet', wn: 'Sinov' });
    await sleep(1500);
    const dead = await T2(`[P.alive, document.getElementById('killCard').innerText.length > 0]`);
    for (let i = 0; i < 80 && !(await T2(`P.alive`)); i++) await sleep(150);
    const back = await T2(`[P.alive, G.state, D.inSafe(P.pos.x, P.pos.z)]`);
    clearInterval(iv);
    ok(`tarmoq · ${mode} · ${map} · ${era}: xatosiz o'ynaldi, halok bo'lib qayta tug'ildi (zona ichida)`,
      st[0] === true && st[1] === mode && r.log.length === 0 && r.bad.length === 0 && p2.errors.length === 0 && t1 > t0 + 5 && dead[0] === false && back[0] === true && back[2] === true,
      JSON.stringify({ start: st, log: r.log, bad: r.bad, xato: p2.errors.map((e) => String(e).slice(0, 300)), vaqt: [t0, t1], halok: dead, qaytdi: back, transport: r.veh, qurol: r.loot }));
    p2.close(); A.w.close(); await sleep(400);
  }
  L(fails ? `YAKUN: ${fails} ta xato` : "YAKUN: hammasi o'tdi");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
