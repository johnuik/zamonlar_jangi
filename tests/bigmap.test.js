// Katta xarita oddiy rejimlarda: yakka o'yin (to'lqinlar) va tarmoq (deathmatch) — o'lcham, tasodifiy transport joylari, navigatsiya.
// Ishlatish: PORT=8191 node server.js   so'ng   node tests/bigmap.test.js [historical|modern]
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191, era = process.argv[2] || 'modern';
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };
const KEY = (code) => `window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' })), window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' })), 1`;

async function single() {
  L(`=== YAKKA REJIM (${era})`);
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9481, dir: 'p_big1' });
  const { ev, shot } = pg;
  await sleep(2500);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, W = G.world; return ${body}; })()`);
  const until = async (cond, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  await ev(`(document.querySelectorAll('.era').forEach(e => { if (e.dataset.era === '${era}') e.click(); }), document.querySelector('#spMaps [data-map=big]').click(), 1)`);
  await sleep(1200);
  await shot(`bigmap_${era}_menu`);
  await ev(`(document.getElementById('btnPlay').click(), 1)`); await sleep(300);
  await ev(`(document.getElementById('briefing').click(), 1)`); await sleep(400);
  const pk = await ev(`!document.getElementById('classPick').classList.contains('hidden')`);
  await ev(KEY('Digit1')); await sleep(1200);
  const st = await T(`({ state: G.state, half: W.half, night: G.night, zombie: G.zombie, houses: W.pits.length, spawns: W.spawns.length, veh: G.vehicles.map(v => v.type).join(','), pads: G.vehicles.map(v => [v.pos.x, v.pos.z]),
    allies: G.soldiers.filter(s => s.team === 'ally').length, lim: G.vehicles.some(v => v.limited), w: G.weapons.map(w => w.def.id).join(',') })`);
  const PADS = [[-102, -102], [102, 102], [102, -102], [-102, 102], [0, -104], [0, 104], [-104, 0], [104, 0], [-64, -64], [64, 64], [64, -64], [-64, 64], [-20, -74], [20, 74], [-74, 22], [74, -22]];
  const onPads = st.pads.every((p) => PADS.some((q) => q[0] === p[0] && q[1] === p[1])), uniq = new Set(st.pads.map((p) => p.join(','))).size === 9;
  ok('katta xaritada to\'lqinlar rejimi: klass tanlanadi, kunduzi, 240×240 m', pk && st.state === 'playing' && st.half === 120 && !st.night && !st.zombie && st.allies === 2 && st.w === 'ar,pistol,knife,nade', `spawn=${st.spawns}`);
  ok('9 transport turli tasodifiy joylarda; yoqilg\'i cheklanmagan', st.veh === 'heli,chinook,jeep,quad,cannon,cannon,tank,ltank,truck' && onPads && uniq && !st.lim, JSON.stringify(st.pads));
  // dushman uzoqdan o'yinchi tomon yo'l topib keladi
  await T(`(G.waveTimer = 99999, P.hp = 1e9, D.spawnEnemy('rifle'), G.foe = G.soldiers[G.soldiers.length - 1], G.d0 = G.foe.pos.distanceTo(P.pos), 1)`);
  await until(`G.foe.pos.distanceTo(P.pos) < G.d0 - 8`, 25000);
  const mv = await T(`[+G.d0.toFixed(0), +G.foe.pos.distanceTo(P.pos).toFixed(0), G.foe.alive]`);
  ok('dushman xarita chetidan o\'yinchi tomon yuradi (navigatsiya ishlaydi)', mv[0] > 60 && mv[1] <= mv[0] - 8, `${mv[0]} m → ${mv[1]} m`);
  // transport o'z (tasodifiy) joyida turibdi va unga o'tirsa bo'ladi
  await T(`(() => { const v = G.vehicles[2]; P.pos.set(v.pos.x + 2.1, 0, v.pos.z + 0.4); P.vel.set(0, 0, 0); return 1; })()`); await sleep(450);
  await ev(KEY('KeyF')); await sleep(400);
  ok('tasodifiy joydagi jipga o\'tirildi', (await T(`G.inVeh === G.vehicles[2] && G.seat === 0`)) === true);
  await shot(`bigmap_${era}_jeep`);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close();
}

async function multi() {
  L('=== TARMOQ (deathmatch, katta xarita)');
  const bot = await wsConnect(`http://localhost:${PORT}/ws`);
  let code = null, botId = 0, state = null; const events = [];
  bot.on = (o) => { if (o.t === 'joined') { code = o.code; botId = o.id; } else if (o.t === 's') state = o; else events.push(o); };
  const iv = setInterval(() => bot.send({ t: 'p', x: 30, y: 0, z: 0, yw: 0, pt: 0, cr: 0, w: 0 }), 50);
  bot.send({ t: 'create', name: 'Bot', era });
  await sleep(300);
  bot.send({ t: 'mode', mode: 'dm' }); bot.send({ t: 'map', map: 'big' });
  const pg = await openPage(`http://localhost:${PORT}/?kod=${code}&ism=Ali`, { port: 9482, dir: 'p_big2' });
  const { ev } = pg;
  await sleep(2800);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, W = G.world; return ${body}; })()`);
  const lob = await ev(`[document.querySelector('.lobbyMap.sel').dataset.map, document.querySelector('.lobbyMode.sel').dataset.mode, document.querySelector('.lobbyMap[data-map=big]').disabled]`);
  ok('lobbi: xost tanlagan xarita (katta) va rejim ko\'rinadi; mehmon o\'zgartira olmaydi', lob[0] === 'big' && lob[1] === 'dm' && lob[2] === true, JSON.stringify(lob));
  bot.send({ t: 'start' });
  await sleep(1800);
  const sm = events.find((e) => e.t === 'start');
  const s0 = await T(`[!!G.pick && G.pick.mode, W.half, G.night, G.zombie, JSON.stringify(G.vehicles.map(v => [v.type, v.pos.x, v.pos.z])), Math.abs(P.pos.x) <= 117 && Math.abs(P.pos.z) <= 117 && (Math.abs(P.pos.x) > 100 || Math.abs(P.pos.z) > 100)]`);
  ok('deathmatch katta xaritada: klass tanlovi, kunduzi, transport serverdagi joylarda', sm.map === 'big' && sm.mode === 'dm' && s0[0] === 'mpstart' && s0[1] === 120 && !s0[2] && !s0[3] && s0[4] === JSON.stringify(sm.veh.map((v) => [v.type, v.x, v.z])));
  ok('o\'yinchi katta xarita chetida paydo bo\'ladi', s0[5] === true);
  await T(`(D.pickSelect(0), G.state = 'playing', 1)`);
  await T(`(() => { const v = G.vehicles[3]; P.pos.set(v.pos.x + 1.4, 0, v.pos.z); P.vel.set(0, 0, 0); return 1; })()`); await sleep(500);
  await ev(KEY('KeyF')); await sleep(600);
  const me = state.p.find((p) => p.id !== botId);
  ok('tarmoq: tasodifiy joydagi kvadrotsiklga o\'tirildi (server ham)', (await T(`G.inVeh === G.vehicles[3]`)) === true && state.v[3].s[0] === me.id, JSON.stringify(state.v[3].s));
  ok('server transportni katta xaritadagi joyida saqlaydi', state.v[3].x === sm.veh[3].x && state.v[3].z === sm.veh[3].z);
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
