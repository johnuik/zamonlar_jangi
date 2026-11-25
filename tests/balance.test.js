// Muvozanat: o'q tegishi tana qismiga qarab, avtomatlar kuchi, zenit pushkasi (jon, qalqon), kuchayib ketgan o'yinchi,
// katta xaritadagi qo'shimcha qurollar.
// Ishlatish: PORT=8191 node server.js   so'ng   node tests/balance.test.js [historical|modern]
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191, era = process.argv[2] || 'modern';
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };

async function single() {
  L(`=== YAKKA REJIM (${era})`);
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9491, dir: 'p_bal' });
  const { ev } = pg;
  await sleep(2500);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, W = G.world, V3 = P.pos.constructor; return ${body}; })()`);
  const until = async (cond, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  await ev(`(() => { localStorage.removeItem('zj_class'); return 1; })()`); await ev(`location.reload(), 1`); await sleep(2500);
  await ev(`(() => { const G = window.__G, D = window.__dbg; document.querySelectorAll('.era').forEach(e => { if (e.dataset.era === '${era}') e.click(); }); document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 99999; G.bannerT = 0.01;
    for (const s of G.soldiers) { s.alive = false; s.root.visible = false; } D.player.pos.set(0, 0, 36); return 1; })()`);
  await sleep(400);
  // o'q tegishi: tana qismlari
  const hz = await T(`(() => { const def = G.weapons[0].def, d = new V3(0, 0, 1);
    const mk = () => { D.spawnEnemy('rifle'); const s = G.soldiers[G.soldiers.length - 1]; s.update = () => {}; s.hp = s.maxHp = 1000; s.pos.set(0, 0, 60); s.yaw = Math.PI; s.build = 1; s.root.position.copy(s.pos); return s; };   // oddiy bo'yli askar, joni ko'p (zararni o'lchash uchun)
    const shot = (x, y) => { const s = mk(), h0 = s.hp; const r = D.hitscan(new V3(x, y, 40), d, def); const out = [r.hit, +(h0 - s.hp).toFixed(1), s.flinch > 0]; s.alive = false; s.root.visible = false; return out; };
    const f = 1 - ((20 - 0) > def.falloff[0] ? 0 : 0);
    return { dmg: def.dmg, head: def.head, torso: shot(0, 1.25), headS: shot(0, 1.66), leg: shot(0.05, 0.45), arm: shot(0.26, 1.3), beside: shot(0.36, 1.25), besideLeg: shot(0.26, 0.45), over: shot(0, 1.86) }; })()`);
  ok(`avtomat kuchaytirildi (${era === 'modern' ? 'M4 35' : 'StG-44 40'})`, hz.dmg === (era === 'modern' ? 35 : 40), 'zarar=' + hz.dmg);
  ok("tanaga — to'liq zarar, boshga — ko'paytuvchi bilan", hz.torso[0] && Math.abs(hz.torso[1] - hz.dmg) < 0.2 && hz.headS[0] && Math.abs(hz.headS[1] - hz.dmg * hz.head) < 0.2, JSON.stringify([hz.torso, hz.headS]));
  ok("oyoqqa 75%, qo'lga 70% zarar", hz.leg[0] && Math.abs(hz.leg[1] - hz.dmg * 0.75) < 0.2 && hz.arm[0] && Math.abs(hz.arm[1] - hz.dmg * 0.7) < 0.2, JSON.stringify([hz.leg, hz.arm]));
  ok("tananing yonidan, oyoq yonidan va bosh ustidan o'tgan o'q tegmaydi", !hz.beside[0] && !hz.besideLeg[0] && !hz.over[0] && hz.beside[1] === 0, JSON.stringify([hz.beside, hz.besideLeg, hz.over]));
  ok("o'q tekkan askar seskanadi", hz.torso[2] === true && hz.beside[2] === false);
  // kuchayib ketgan o'yinchi: ketma-ket o'ldirishlar dushman zarbasini kuchaytiradi
  const heat = await T(`(() => { P.hp = 100; G.heat = 0; D.damagePlayer(10, null, null); const a = 100 - P.hp; P.hp = 100; G.heat = 8; G.heatT = 10; D.damagePlayer(10, null, null); const b = 100 - P.hp; P.hp = 100;
    G.heat = 0; const k0 = []; for (let i = 0; i < 5; i++) { D.spawnEnemy('rifle'); const s = G.soldiers[G.soldiers.length - 1]; s.update = () => {}; s.damage(9999, P.pos, false, 'player', 'bullet'); k0.push(G.heat); } return [a, b, k0]; })()`);
  await sleep(600);
  const hud = await ev(`document.getElementById('objective').textContent`);
  ok("ketma-ket o'ldirishlar: 3 tadan keyin dushman zarbasi kuchayadi (8 ta — +30%), ekranda ko'rsatiladi", Math.abs(heat[0] - 10) < 0.01 && Math.abs(heat[1] - 13) < 0.01 && heat[2].join(',') === '1,2,3,4,5' && /Ketma-ket 5/.test(hud), `${heat[0]} → ${heat[1]} · "${hud.slice(-50)}"`);
  await T(`(G.heatT = 0.01, 1)`); await until(`G.heat === 4`, 4000);
  ok("o'ldirmasdan turilsa pasayadi", (await T(`G.heat`)) <= 4);
  await T(`(G.heat = 0, P.hp = 100, 1)`);
  // zenit pushkasi: mustahkamroq, qalqon olddan to'sadi
  const cn = await T(`(() => { const v = G.vehicles[4]; D.enterVehicle(v, 0); v.aimYaw = 0; P.hp = 100; const h0 = v.hp;
    D.damagePlayer(40, new V3(v.pos.x, 1, v.pos.z + 20), null); const front = [100 - P.hp, +(h0 - v.hp).toFixed(1)];
    const h1 = v.hp; P.hp = 100; D.damagePlayer(40, new V3(v.pos.x, 1, v.pos.z - 20), null); const back = [100 - P.hp, +(h1 - v.hp).toFixed(1)];
    P.hp = 100; return [v.T.hp, v.T.bulletMul, front, back]; })()`);
  await sleep(400);
  cn.push(await ev(`document.getElementById('vehHint').textContent`));
  await T(`(D.exitVehicle(), G.vehicles[4].hp = 1500, 1)`);
  ok("zenit pushkasi: joni 1500; olddan kelgan zarba to'pchiga emas, qalqonga tegadi; orqadan — to'pchiga (75%)", cn[0] === 1500 && cn[2][0] === 0 && Math.abs(cn[2][1] - 12) < 0.1 && Math.abs(cn[3][0] - 30) < 0.1 && cn[3][1] === 0 && /qalqon/.test(cn[4]), JSON.stringify([cn[2], cn[3]]));
  // katta xarita: noyob qurollar va yashiklar ko'proq
  const big = await T(`(() => { G.spMap = 'big'; D.createScene('${era}'); D.startGame(); const a = [W === G.world, G.world.half, G.pickups.length, G.pickups.map(p => p.def.id).join(','), G.world.pits.length];
    G.spMode = 'zombie'; D.createScene('${era}'); D.startGame(); a.push(G.world.crates.length, G.pickups.length); G.spMode = 'waves'; G.spMap = 'town'; return a; })()`);
  ok('katta shahar: 8 ta podvalda noyob qurol (har turidan ikkitadan); zombi rejimida 27 ta yashik', big[1] === 120 && big[2] === 8 && big[4] === 8 && big[3].split(',').sort().join(',') === 'amr,amr,gl,gl,minigun,minigun,rpg,rpg' && big[5] === 27 && big[6] === 8, big[3]);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close();
}

async function multi() {
  L('=== TARMOQ');
  const bot = await wsConnect(`http://localhost:${PORT}/ws`);
  let code = null, botId = 0, state = null; const events = [];
  bot.on = (o) => { if (o.t === 'joined') { code = o.code; botId = o.id; } else if (o.t === 's') state = o; else events.push(o); };
  let bp = [30, 0, 0];
  const iv = setInterval(() => bot.send({ t: 'p', x: bp[0], y: bp[1], z: bp[2], yw: 0, pt: 0, cr: 0, w: 0 }), 50);
  bot.send({ t: 'create', name: 'Bot', era });
  await sleep(300);
  const pg = await openPage(`http://localhost:${PORT}/?kod=${code}&ism=Ali`, { port: 9492, dir: 'p_bal2' });
  const { ev } = pg;
  await sleep(2800);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, V3 = P.pos.constructor; return ${body}; })()`);
  bot.send({ t: 'start' });
  await sleep(1800);
  await T(`(D.pickSelect(0), G.state = 'playing', 1)`);
  const me = () => state.p.find((p) => p.id !== botId), bt = () => state.p.find((p) => p.id === botId);
  ok('server: zenit pushkasi joni 1500', state.v[4].hp === 1500 && state.v[5].hp === 1500);
  // zenit qalqoni tarmoqda: bot to'pchi; olddan otilgan o'q pushkaga, orqadan otilgani to'pchiga tegadi
  bp = [-14, 0, -16]; await sleep(300);
  bot.send({ t: 'venter', v: 4, seat: 0 }); await sleep(600);
  bp = [-14, 0.1, -19.25];
  await sleep(500);
  const h0 = bt().hp, c0 = state.v[4].hp;
  await T(`(D.hitscan(new V3(-14, 1.3, -8), new V3(0, 0, -1), G.weapons[0].def), 1)`); await sleep(400);
  const h1 = bt().hp, c1 = state.v[4].hp;
  await T(`(D.hitscan(new V3(-14, 1.3, -30), new V3(0, 0, 1), G.weapons[0].def), 1)`); await sleep(400);
  const h2 = bt().hp, c2 = state.v[4].hp;
  ok("tarmoq: olddan otilgan o'q to'pchiga emas, pushkaga tegadi; orqadan otilgani to'pchiga tegadi", h1 === h0 && c1 < c0 && h2 < h1 && c2 === c1, `to'pchi ${h0}→${h1}→${h2} · pushka ${c0}→${c1}→${c2}`);
  bot.send({ t: 'vexit' }); bp = [30, 0, 0]; await sleep(300);
  // kuchayib ketgan o'yinchi: sahifa botni 3 marta o'ldiradi → sahifaga yetadigan zarar 8% ko'p
  const wait = async (fn, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (fn()) return true; await sleep(100); } return false; };
  for (let i = 0; i < 3; i++) { await wait(() => bt().al, 9000); await sleep(200); await T(`(G.net.send({ t: 'hit', target: ${botId}, dmg: 500, head: false, kind: 'bullet' }), 1)`); await wait(() => !bt().al, 3000); }
  await wait(() => bt().al, 9000); await sleep(300);
  const st = me().st, hp0 = me().hp;
  bot.send({ t: 'hit', target: me().id, dmg: 50, head: false, kind: 'bullet' }); await sleep(400);
  const hp1 = me().hp, hud = await ev(`[document.getElementById('objective').textContent, document.getElementById('mpBoard').innerText.replace(/\\s+/g, ' ')]`);
  ok("3 ta ketma-ket o'ldirgan o'yinchi 8% ko'proq zarar oladi (50 → 54) va bu ekranda ko'rsatiladi", st === 3 && hp0 - hp1 === 54 && /Ketma-ket 3/.test(hud[0]) && /🔥3/.test(hud[1]), `ketma-ket=${st}, jon ${hp0} → ${hp1}`);
  // o'lgach nolga qaytadi
  bot.send({ t: 'hit', target: me().id, dmg: 500, head: false, kind: 'bullet' }); await wait(() => !me().al, 3000); await sleep(300);
  ok("o'lgach hisob nolga qaytadi; uni o'ldirganning hisobi boshlanadi", me().st === 0 && bt().st === 1, `sahifa=${me().st} bot=${bt().st}`);
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
