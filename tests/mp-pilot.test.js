// Tarmoq: Chrome o'yinchisi uchuvchi — holat serverga yetib boradimi, tashlab ketilgan vertolyot qulaydimi
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191;
const L = (...a) => console.log(...a);
const ok = (name, cond, extra = '') => L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`);
(async () => {
  const bot = await wsConnect(`http://localhost:${PORT}/ws`);
  let code = null, botId = 0, state = null; const events = [];
  bot.on = (o) => { if (o.t === 'joined') { code = o.code; botId = o.id; } else if (o.t === 's') state = o; else events.push(o); };
  const got = (t) => events.filter((e) => e.t === t);
  bot.send({ t: 'create', name: 'Bot', era: 'historical' });
  await sleep(300);
  const pg = await openPage(`http://localhost:${PORT}/?kod=${code}&ism=Vali`, { port: 9343, dir: 'p_mp3' });
  const { ev, shot } = pg;
  await sleep(2800);
  bot.send({ t: 'start' });
  await sleep(1800);
  await ev(`(() => { const G = window.__G; window.__dbg.pickConfirm(); document.getElementById('pause').classList.add('hidden'); G.state = 'playing'; return 1; })()`);
  const iv = setInterval(() => bot.send({ t: 'p', x: 30, y: 0, z: 0, yw: 0, pt: 0, cr: 0, w: 0 }), 50);
  const me = () => state.p.find((p) => p.id !== botId);
  // Chrome ikkinchi vertolyotga uchuvchi bo'lib o'tiradi
  await ev(`(() => { const p = window.__dbg.player; p.pos.set(55, 0, 55.5); p.vel.set(0,0,0); return 1; })()`);
  await sleep(400);
  await ev(`window.__dbg.tryEnterVehicle(), 1`);
  await sleep(500);
  ok('chrome uchuvchi', (await ev(`window.__G.inVeh ? window.__G.inVeh.type + window.__G.seat : 'yoq'`)) === 'chinook0' && state.v[1].ow === me().id, 'owner=' + state.v[1].ow + ' seats=' + JSON.stringify(state.v[1].s));
  await ev(`Object.assign(window.__dbg.keys, { Space: true }), 1`);
  for (let i = 0; i < 80 && state.v[1].y < 36; i++) await sleep(250);   // o'yin vaqti bo'yicha kutamiz; 36 m dan qulagan Chinuk (2100 jon) aniq portlaydi
  await ev(`Object.assign(window.__dbg.keys, { KeyW: true }), 1`);
  for (let i = 0; i < 60 && Math.hypot(state.v[1].x - 58, state.v[1].z - 58) < 12; i++) await sleep(250);
  await ev(`Object.assign(window.__dbg.keys, { Space: false, KeyW: false }), 1`);
  ok('server vertolyot holatini oldi', state.v[1].y > 15 && Math.hypot(state.v[1].x - 58, state.v[1].z - 58) > 8, JSON.stringify([state.v[1].x, state.v[1].y, state.v[1].z]));
  ok("o'yinchi pozitsiyasi o'rindiqda (server)", me().y > 15 && me().vh === 1 && me().se === 0, 'y=' + me().y);
  await shot('mp3_pilot');
  // bayroq rejimi: transportdagi o'yinchi bayroqni ola olmaydi (vertolyot bayroq ustidan pastlab o'tsa ham) — bu yerda faqat chiqishni sinaymiz
  await ev(`window.__dbg.exitVehicle(), 1`);
  await sleep(600);
  // Chinuk havoda: uchuvchi o'rindiqdan turib yuk bo'limida qoladi; orqa rampadan sakrab, PROBEL bilan parashyut ochadi
  const inCab = await ev(`(() => { const G = window.__G; return G.platform === G.vehicles[1] && G.insideVeh === G.vehicles[1] && !G.inVeh && !G.chute; })()`);
  await ev(`(() => { const G = window.__G, v = G.vehicles[1], P = window.__dbg.player; v.local(0, -1, -9, P.pos); P.vel.set(0, -4, 0); P.onGround = false; G.platform = null; return 1; })()`);
  await sleep(500);
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })), 1`);
  await sleep(400);
  ok("chiqdi: yuk bo'limida qoldi, rampadan sakrab parashyut ochdi", inCab === true && (await ev(`window.__G.chute`)) === true && me().vh === -1, 'ichkarida=' + inCab);
  let boom = false;
  for (let i = 0; i < 12 && !boom; i++) { await sleep(600); boom = !state.v[1].al; }
  ok('tashlab ketilgan vertolyot qulab portladi (server)', boom && got('vboom').length === 1, 'kill xabarlari=' + got('kill').length + ' (0 bo\'lishi kerak)');
  ok("parashyutchi tirik", me().al && got('kill').length === 0);
  // jip: Chrome haydaydi, bot ko'radi
  await ev(`(() => { const G = window.__G, p = window.__dbg.player; G.chute = false; p.pos.set(55.5, 0, -48.5); p.vel.set(0,0,0); return 1; })()`);
  await sleep(400);
  await ev(`window.__dbg.tryEnterVehicle(), 1`); await sleep(400);
  await ev(`Object.assign(window.__dbg.keys, { KeyW: true }), 1`); await sleep(2000);
  await ev(`Object.assign(window.__dbg.keys, { KeyW: false }), 1`);
  ok('jip holati serverda', state.v[2].x < 50 && state.v[2].s[0] === me().id, JSON.stringify([state.v[2].x, state.v[2].z]) + ' cr=' + me().cr);
  await sleep(45000 - 2000 > 0 ? 100 : 0);
  clearInterval(iv);
  L('JS xatolari soni:', pg.errors.length);
  pg.close(); bot.close(); process.exit(0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
