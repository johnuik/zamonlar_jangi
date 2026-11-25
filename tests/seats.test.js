// Transport ICHIDA o'rin almashtirish: [Q] — keyingi bo'sh o'rin, [1–6] — aniq o'rin. Har bir ko'p o'rinli transportda,
// yakka rejimda ham, tarmoqda ham (haqiqiy klaviatura hodisalari bilan).
// Ishlatish: PORT=8191 node server.js   so'ng   node tests/seats.test.js
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191;
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };
const KEY = (code) => `window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' })), window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' })), 1`;

async function single() {
  L('=== YAKKA REJIM');
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9395, dir: 'p_seats' });
  const { ev, shot } = pg;
  await sleep(2500);
  await ev(`(() => { const G = window.__G, D = window.__dbg; document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 99999;
    for (const s of G.soldiers) { s.alive = false; s.root.visible = false; } return 1; })()`);
  const st = () => ev(`(() => { const G = window.__G, v = G.inVeh; return v ? [v.type, G.seat, v.seats.map(s => s == null ? 0 : 1).join('')] : ['yoq', -1, '']; })()`);
  // [transport indeksi, o'yinchi turadigan joy, o'rinlar soni]
  const cases = [[0, [-55, -55.5], 4], [1, [52.9, 54.5], 6], [2, [55.5, -48.5], 2], [3, [-58, 52.2], 2], [6, [-62, 3.4], 2], [7, [62, 3.2], 2]];
  for (const [idx, at, n] of cases) {
    await ev(`(() => { const p = window.__dbg.player; p.pos.set(${at[0]}, 0, ${at[1]}); p.vel.set(0, 0, 0); return 1; })()`);
    await sleep(450);
    await ev(KEY('KeyF')); await sleep(350);
    const a = await st();
    await ev(KEY('KeyQ')); await sleep(350);
    const b = await st();
    await ev(KEY('KeyQ')); await sleep(350);
    const c = await st();
    await ev(KEY('Digit' + n)); await sleep(350);
    const d = await st();
    await ev(KEY('Digit1')); await sleep(350);
    const e = await st();
    const hud = await ev(`[document.getElementById('vehSeats').innerText.replace(/\\n/g, ' | '), document.getElementById('vehHint').textContent, document.querySelectorAll('#vehSeats .me').length]`);
    const want2 = n === 2 ? 0 : 2;
    const mask = (i) => Array.from({ length: n }, (_, k) => (k === i ? 1 : 0)).join('');
    ok(`${a[0]}: F=1-o'rin, Q=2-o'rin, Q=${want2 + 1}-o'rin, [${n}]=oxirgi, [1]=birinchi`,
      a[1] === 0 && b[1] === 1 && b[2] === mask(1) && c[1] === want2 && d[1] === n - 1 && d[2] === mask(n - 1) && e[1] === 0 && e[2] === mask(0),
      `${a[1]} → ${b[1]} → ${c[1]} → ${d[1]} → ${e[1]}`);
    ok(`${a[0]}: ekranda o'rinlar ro'yxati va [Q] eslatmasi`, hud[2] === 1 && /Q/.test(hud[1]) && hud[0].split('|').length === n, hud[0]);
    if (idx === 1) await shot('seats_hud');
    await ev(KEY('KeyF')); await sleep(350);
  }
  // bir o'rinli transportda (zenit pushkasi) o'rinlar ro'yxati ko'rsatilmaydi va Q xato bermaydi
  await ev(`(() => { const p = window.__dbg.player; p.pos.set(-14, 0, -15.5); p.vel.set(0, 0, 0); return 1; })()`); await sleep(450);
  await ev(KEY('KeyF')); await sleep(300); await ev(KEY('KeyQ')); await sleep(300);
  const cn = await ev(`[window.__G.inVeh ? window.__G.inVeh.type + window.__G.seat : 'yoq', getComputedStyle(document.getElementById('vehSeats')).display]`);
  ok("zenit pushkasi: bitta o'rin, ro'yxat yashirin", cn[0] === 'cannon0' && cn[1] === 'none', JSON.stringify(cn));
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
  bot.send({ t: 'create', name: 'Bot', era: 'modern' });
  await sleep(300);
  const pg = await openPage(`http://localhost:${PORT}/?kod=${code}&ism=Ali`, { port: 9396, dir: 'p_seats2' });
  const { ev } = pg;
  await sleep(2800);
  bot.send({ t: 'start' });
  await sleep(1800);
  await ev(`(() => { const G = window.__G; window.__dbg.pickConfirm(); document.getElementById('pause').classList.add('hidden'); G.state = 'playing'; return 1; })()`);
  const me = () => state.p.find((p) => p.id !== botId).id;
  const seat = () => ev(`window.__G.inVeh ? window.__G.seat : -1`);
  const tp = (x, z) => ev(`(() => { const p = window.__dbg.player; p.pos.set(${x}, 0, ${z}); p.vel.set(0, 0, 0); return 1; })()`);
  const lastPopup = () => ev(`(document.getElementById('popups').lastElementChild || { textContent: '' }).textContent`);

  // hujumchi vertolyot: uchuvchi -> Q -> o'qchi -> 1 -> uchuvchi
  await tp(-55, -55.5); await sleep(500);
  await ev(KEY('KeyF')); await sleep(600);
  const s0 = [await seat(), JSON.stringify(state.v[0].s)];
  await ev(KEY('KeyQ')); await sleep(600);
  const s1 = [await seat(), JSON.stringify(state.v[0].s)];
  await ev(KEY('Digit1')); await sleep(600);
  const s2 = [await seat(), JSON.stringify(state.v[0].s)];
  ok("tarmoq: ichkarida Q va [1] o'rinni almashtiradi (server ham)", s0[0] === 0 && s0[1] === `[${me()},0,0,0]` && s1[0] === 1 && s1[1] === `[0,${me()},0,0]` && s2[0] === 0 && s2[1] === `[${me()},0,0,0]`, `${s0[1]} → ${s1[1]} → ${s2[1]}`);

  await ev(KEY('KeyF')); await sleep(400);
  // boshqa o'rin band bo'lsa: tushunarli xabar, o'rin o'zgarmaydi (ikki o'rinli jipda sinaladi)
  bp = [55.5, 0, -48.5]; await sleep(300);
  await tp(55.5, -48.5); await sleep(500);
  await ev(KEY('KeyF')); await sleep(600);
  bot.send({ t: 'venter', v: 2, seat: 1 }); await sleep(500);
  await ev(KEY('KeyQ')); await sleep(500);
  const q = [await seat(), await lastPopup()];
  await ev(KEY('Digit2')); await sleep(500);
  const d = [await seat(), await lastPopup()];
  ok("band o'ringa o'tib bo'lmaydi va bu haqda xabar chiqadi", q[0] === 0 && /Bo'sh o'rin yo'q/.test(q[1]) && d[0] === 0 && /band/.test(d[1]) && JSON.stringify(state.v[2].s) === `[${me()},${botId}]`, `Q: "${q[1]}" · [2]: "${d[1]}"`);
  await ev(KEY('KeyF')); await sleep(400);
  bot.send({ t: 'vexit' }); await sleep(300);

  // Chinuk: uchuvchi Q bosadi -> band (ikkinchi uchuvchi) o'rinni o'tkazib, keyingi bo'sh o'ringa; ikkinchi uchuvchi boshqaruvni oladi
  bp = [54, 0, 54]; await sleep(300);
  await tp(52.9, 54.5); await sleep(500);
  await ev(KEY('KeyF')); await sleep(600);
  bot.send({ t: 'venter', v: 1, seat: 1 }); await sleep(500);
  const c0 = JSON.stringify(state.v[1].s);
  await ev(KEY('KeyQ')); await sleep(700);
  const c1 = [await seat(), JSON.stringify(state.v[1].s), state.v[1].ow];
  ok("Chinuk: Q band o'rinni o'tkazib yuboradi; bo'shagan uchuvchi o'rnini ikkinchi uchuvchi oladi", c0 === `[${me()},${botId},0,0,0,0]` && c1[0] === 2 && c1[1] === `[${botId},0,${me()},0,0,0]` && c1[2] === botId, `${c0} → ${c1[1]}`);
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
