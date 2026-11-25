// Kamaz: kuzovga orqa zinadan yurib chiqish, bortlar, o'q va granataning kuzov shakliga mos tegishi, haydash;
// tarmoqda — kuzovdagi yo'lovchini tashish, bortdan baland turgan odamga o'q tegishi, portlaganda kuzovdagilar halok bo'lishi.
// Ishlatish: PORT=8191 node server.js   so'ng   node tests/truck.test.js [historical|modern]
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191, era = process.argv[2] || 'modern';
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };
const KEY = (code) => `window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' })), window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' })), 1`;
const TI = 8;   // Kamazning transport ro'yxatidagi o'rni

async function single() {
  L(`=== YAKKA REJIM (${era})`);
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9421, dir: 'p_truck' });
  const { ev, shot } = pg;
  await sleep(2500);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, V = G.vehicles[${TI}], K = D.keys; return ${body}; })()`);
  const until = async (cond, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  await ev(`(() => { const G = window.__G, D = window.__dbg; document.querySelectorAll('.era').forEach(e => { if (e.dataset.era === '${era}') e.click(); }); document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 99999; G.bannerT = 0.01;
    for (const s of G.soldiers) { s.alive = false; s.root.visible = false; } return 1; })()`);
  await sleep(500);
  const v0 = await T(`[V.type, V.T.name, V.pos.x, V.pos.z, V.hp, V.alive, V.T.seats]`);
  ok('Kamaz xaritada turibdi', v0[0] === 'truck' && v0[1] === 'Kamaz' && v0[2] === 0 && v0[3] === -58 && v0[4] === 1000 && v0[5] === true && v0[6] === 2, JSON.stringify(v0));
  await T(`(P.pos.set(8, 0, -65), P.yaw = 2.36, P.pitch = -0.05, 1)`); await sleep(500);
  await shot(`truck_${era}_look`);

  // orqa zinadan kuzovga yurib chiqish
  await T(`(P.pos.set(0, 0, -64.6), P.vel.set(0, 0, 0), P.yaw = Math.PI, P.pitch = 0, K.KeyW = true, 1)`);
  const up = await until(`P.pos.y > 1.29 && P.pos.z > -60.8`, 8000);
  await T(`(K.KeyW = false, 1)`); await sleep(300);
  const b0 = await T(`[+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2), G.platform === V, G.insideVeh === null, P.onGround, G.inVeh === null]`);
  ok('orqa zinadan kuzovga yurib chiqildi (o\'rindiqsiz, pol ustida)', up && Math.abs(b0[1] - 1.3) < 0.02 && b0[3] && b0[4] && b0[5] && b0[6], JSON.stringify(b0));
  await shot(`truck_${era}_bed`);
  // yon bort va kabina to'sadi
  await T(`(K.KeyD = true, 1)`); await sleep(1300); await T(`(K.KeyD = false, K.KeyA = true, 1)`);
  const sx1 = await T(`+P.pos.x.toFixed(2)`);
  await sleep(2200); await T(`(K.KeyA = false, K.KeyW = true, 1)`);
  const sx2 = await T(`+P.pos.x.toFixed(2)`);
  await sleep(2600); await T(`(K.KeyW = false, 1)`);
  const sz = await T(`[+P.pos.z.toFixed(2), +P.pos.y.toFixed(2)]`);
  ok('yon bortlar va kabina kuzovda ushlab turadi', Math.abs(sx1) < 0.82 && Math.abs(sx1) > 0.6 && Math.abs(sx2) < 0.82 && Math.abs(sx2) > 0.6 && Math.sign(sx1) !== Math.sign(sx2) && sz[0] < -57.25 && sz[0] > -57.5 && Math.abs(sz[1] - 1.3) < 0.02, `x=${sx1} / ${sx2}, z=${sz[0]}`);

  // o'q kuzov shakliga mos tegadi: bortga — transportga, bort ustidagi bo'shliqdan — o'tib ketadi
  const ray = (x, y, z, dx, dy, dz) => T(`(() => { const o = P.pos.clone().set(${x}, ${y}, ${z}), d = P.pos.clone().set(${dx}, ${dy}, ${dz}).normalize(), hp = V.hp; const r = D.hitscan(o, d, G.weapons[0].def); return [r.hit, +r.end.x.toFixed(2), +(hp - V.hp).toFixed(1)]; })()`);
  const r1 = await ray(7, 1.6, -59.5, -1, 0, 0), r2 = await ray(7, 2.4, -59.5, -1, 0, 0), r3 = await ray(7, 1.5, -55.5, -1, 0, 0), r4 = await ray(7, 0.6, -59.5, -1, 0, 0);
  ok('o\'q: bortga tegadi, bort ustidan o\'tib ketadi, kabinaga va rama ostiga tegadi',
    r1[0] === true && Math.abs(r1[1] - 1.25) < 0.05 && r1[2] > 0 && r2[1] < -5 && r2[2] === 0 && r3[0] === true && Math.abs(r3[1] - 1.3) < 0.05 && r4[0] === true,
    `bort=${JSON.stringify(r1)} ustidan=${JSON.stringify(r2)} kabina=${JSON.stringify(r3)}`);
  const los = await T(`(() => { const a = P.pos.clone().set(7, 2.4, -59.5), b = P.pos.clone().set(-7, 2.4, -59.5), c = P.pos.clone().set(7, 1.6, -59.5), d = P.pos.clone().set(-7, 1.6, -59.5), e = P.pos.clone().set(7, 2.4, -55.5), f = P.pos.clone().set(-7, 2.4, -55.5);
    return [G.world.los(a, b), G.world.los(c, d), G.world.los(e, f)]; })()`);
  ok('ko\'rinish chizig\'i: kuzov ustidan ochiq, bort va kabina orqali yopiq', los[0] === true && los[1] === false && los[2] === false, JSON.stringify(los));
  // granata kuzov poliga tushadi (havoda "ko'rinmas tom"ga urilmaydi), kabina ustiga tashlangani tomda qoladi
  await T(`(G.grenades.length = 0, D.spawnGrenade(P.pos.clone().set(0.4, 4.5, -60), P.pos.clone().set(0, 0, 0), 'player', 'player', 30), D.spawnGrenade(P.pos.clone().set(0, 5, -55.5), P.pos.clone().set(0, 0, 0), 'player', 'player', 30), 1)`);
  await until(`G.grenades.length === 2 && Math.abs(G.grenades[0].vel.y) < 0.3 && Math.abs(G.grenades[1].vel.y) < 0.3 && G.grenades[0].pos.y < 3`, 6000);
  const gy = await T(`[+G.grenades[0].pos.y.toFixed(2), +G.grenades[1].pos.y.toFixed(2)]`);
  await T(`(G.grenades.forEach(g => { g.dead = true; G.scene.remove(g.mesh); }), 1)`);
  ok('granata kuzov poliga tushib qoladi; kabina ustiga tushgani tomda', gy[0] > 1.28 && gy[0] < 1.5 && gy[1] > 2.9 && gy[1] < 3.2, JSON.stringify(gy));

  // kabinaga o'tirish va haydash
  await T(`(P.pos.set(2.3, 0, -55.6), P.vel.set(0, 0, 0), 1)`); await sleep(450);
  const pr = await ev(`document.getElementById('prompt').textContent`);
  await ev(KEY('KeyF')); await sleep(400);
  const e0 = await T(`[G.inVeh === V, G.seat, document.getElementById('vehHint').textContent]`);
  ok('[F] — haydovchi o\'rni; taklifda kuzov haqida eslatma bor', e0[0] && e0[1] === 0 && /kuzov/.test(pr) && /Kamaz/.test(pr), pr);
  await T(`(K.KeyW = true, 1)`);
  await until(`V.pos.z > -50`, 9000);
  await shot(`truck_${era}_drive`);
  await T(`(K.KeyA = true, 1)`); await sleep(900);
  const d0 = await T(`[+V.pos.z.toFixed(1), +V.speed.toFixed(1), +V.yaw.toFixed(2)]`);
  await T(`(K.KeyW = false, K.KeyA = false, 1)`);
  ok('Kamaz yuradi va buriladi', d0[0] > -50 && d0[1] > 5 && Math.abs(d0[2]) > 0.2, JSON.stringify(d0));
  await ev(KEY('KeyQ')); await sleep(350);
  const q0 = await T(`[G.seat, V.T.seatNames[G.seat]]`);
  ok('[Q] — kabinadagi yo\'lovchi o\'rniga o\'tish', q0[0] === 1, q0[1]);
  await ev(KEY('KeyF')); await sleep(500);
  ok('[F] — chiqish', (await T(`G.inVeh === null && P.pos.y < 0.1`)) === true);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close();
}

async function multi() {
  L('=== TARMOQ');
  const bot = await wsConnect(`http://localhost:${PORT}/ws`);
  let code = null, botId = 0, state = null; const events = [];
  bot.on = (o) => { if (o.t === 'joined') { code = o.code; botId = o.id; } else if (o.t === 's') state = o; else events.push(o); };
  let bp = [30, 0, 0], biv = -1;
  const iv = setInterval(() => bot.send({ t: 'p', x: bp[0], y: bp[1], z: bp[2], yw: 0, pt: 0, cr: 0, w: 0, iv: biv }), 50);
  bot.send({ t: 'create', name: 'Bot', era });
  await sleep(300);
  const pg = await openPage(`http://localhost:${PORT}/?kod=${code}&ism=Ali`, { port: 9422, dir: 'p_truck2' });
  const { ev } = pg;
  await sleep(2800);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, V = G.vehicles[${TI}], K = D.keys; return ${body}; })()`);
  const until = async (cond, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  bot.send({ t: 'start' });
  await sleep(1800);
  await T(`(D.pickConfirm(), G.state = 'playing', 1)`);
  const me = () => state.p.find((p) => p.id !== botId);
  ok('server Kamazni biladi', state.v.length === 9 && state.v[TI].hp === 1000 && state.v[TI].s.length === 2, `transportlar=${state.v.length}`);

  // bot kuzovda turibdi: bortdan baland joyiga o'q tegadi, bort balandligidagi o'q esa Kamazga tegadi
  bp = [0, 1.3, -59.5]; biv = TI;
  await T(`(P.pos.set(9, 0, -59.5), P.vel.set(0, 0, 0), 1)`);
  await sleep(700);
  const hp0 = state.p.find((p) => p.id === botId).hp, vh0 = state.v[TI].hp;
  await T(`(() => { const o = P.pos.clone().set(9, 2.45, -59.5), d = P.pos.clone().set(-1, 0, 0); D.hitscan(o, d, G.weapons[0].def); return 1; })()`);
  await sleep(400);
  const hp1 = state.p.find((p) => p.id === botId).hp, vh1 = state.v[TI].hp;
  await T(`(() => { const o = P.pos.clone().set(9, 1.6, -59.5), d = P.pos.clone().set(-1, 0, 0); D.hitscan(o, d, G.weapons[0].def); return 1; })()`);
  await sleep(400);
  const hp2 = state.p.find((p) => p.id === botId).hp, vh2 = state.v[TI].hp;
  ok('kuzovdagi odam: bortdan baland joyiga o\'q tegadi; bortga otilgan o\'q Kamazga tegadi', hp1 < hp0 && vh1 === vh0 && hp2 === hp1 && vh2 < vh1, `odam ${hp0}→${hp1}→${hp2} · Kamaz ${vh0}→${vh1}→${vh2}`);

  // o'yinchi kuzovda, bot haydaydi: Kamaz yo'lovchini o'zi bilan olib ketadi
  bp = [2.3, 0, -55.6]; biv = -1;
  await T(`(P.pos.set(0, 1.3, -59.8), P.vel.set(0, 0, 0), P.onGround = true, 1)`);
  await sleep(600);
  bot.send({ t: 'venter', v: TI, seat: 0 });
  await sleep(400);
  const on0 = await T(`[G.platform === V, +P.pos.z.toFixed(2), +V.pos.z.toFixed(2)]`);
  let z = -58, yw = 0;
  for (let i = 0; i < 70; i++) { z += 0.3; if (i > 35) yw += 0.012; bot.send({ t: 'v', id: TI, x: +(Math.sin(yw) * (i > 35 ? (i - 35) * 0.3 : 0)).toFixed(2), y: 0, z: +z.toFixed(2), yw: +yw.toFixed(3), pt: 0, rl: 0, ay: 0, ap: 0 }); bp = [0.6, 1.35, z + 2.3]; await sleep(50); }
  await sleep(700);
  const on1 = await T(`(() => { const l = V.toLocal(P.pos, P.pos.clone()); return [G.platform === V, +l.x.toFixed(2), +l.y.toFixed(2), +l.z.toFixed(2), +V.pos.z.toFixed(1), +P.pos.z.toFixed(1), +V.yaw.toFixed(2)]; })()`);
  ok('haydalayotgan Kamaz kuzovdagi yo\'lovchini olib ketadi (burilishda ham)', on0[0] && on1[0] && Math.abs(on1[1]) < 0.4 && Math.abs(on1[2] - 1.3) < 0.05 && Math.abs(on1[3] + 1.8) < 0.5 && on1[4] > -40 && on1[6] > 0.2, `kuzovdagi joy x=${on1[1]} z=${on1[3]} · Kamaz z=${on1[4]} burilish=${on1[6]}`);
  ok('server: kuzovdagi yo\'lovchi transport ichida hisoblanadi (o\'rindiqsiz)', me().vh === -1 && state.v[TI].s[0] === botId, `vh=${me().vh}`);
  // Kamaz portlasa, kuzovdagi yo'lovchi ham halok bo'ladi
  await sleep(300);
  const kills0 = events.filter((e) => e.t === 'kill').length;
  bot.send({ t: 'vexit' }); await sleep(200);
  bot.send({ t: 'vhit', v: TI, dmg: 3000 });
  await sleep(800);
  const kl = events.filter((e) => e.t === 'kill').slice(kills0);
  ok('Kamaz portlaganda kuzovdagi yo\'lovchi halok bo\'ladi', kl.some((k) => k.victim === me().id && k.kind === 'vehicle') && state.v[TI].al === false, JSON.stringify(kl));
  clearInterval(iv);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close(); bot.close();
}

(async () => {
  await single();
  await multi();
  L(fails ? `YAKUN: ${fails} ta xato` : "YAKUN: hammasi o'tdi");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
