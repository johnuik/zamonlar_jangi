// Eskirgan serverni aniqlash va avtomatik qayta ishga tushish sinovi.
// Loyihaning vaqtinchalik nusxasida ishlaydi (haqiqiy server.js va ishlab turgan serverga tegmaydi).
// Ishlatish: node tests/restart.test.js
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = 8193;
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };
const info = () => new Promise((res) => http.get(`http://localhost:${PORT}/api/info`, (r) => { let d = ''; r.on('data', (x) => (d += x)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { res(null); } }); }).on('error', () => res(null)));
async function waitInfo(pred, ms) { const t0 = Date.now(); let i = null; while (Date.now() - t0 < ms) { i = await info(); if (i && pred(i)) return i; await sleep(300); } return i; }

(async () => {
  const src = path.join(__dirname, '..'), copy = path.join(os.tmpdir(), 'zj-test', 'gamecopy');
  fs.rmSync(copy, { recursive: true, force: true });
  fs.cpSync(src, copy, { recursive: true, filter: (p) => !p.includes(`${path.sep}tests`) && !p.includes(`${path.sep}.git`) });
  let log = '';
  const srv = spawn('sh', ['start.sh'], { cwd: copy, env: { ...process.env, PORT: String(PORT), ZJ_NO_BROWSER: '1', REJOIN_GRACE: '2' }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stdout.on('data', (d) => (log += d)); srv.stderr.on('data', (d) => (log += d));
  const stop = () => { try { process.kill(-srv.pid); } catch (e) { /* tugagan */ } };
  process.on('exit', stop);

  const i1 = await waitInfo((i) => !!i.build, 6000);
  ok('server ishga tushdi, kod izi bor, eskirmagan', i1 && i1.build && i1.stale === false, JSON.stringify(i1 && { build: i1.build, stale: i1.stale }));

  // jang paytida kod o'zgaradi -> server jang tugashini kutadi, lekin o'zini "eskirgan" deb biladi
  const mk = async (name, code) => { const w = await wsConnect(`http://localhost:${PORT}/ws`); const b = { w, ev: [], code: null }; w.on = (o) => { if (o.t === 'joined') b.code = o.code; b.ev.push(o.t); }; w.send(code ? { t: 'join', name, code } : { t: 'create', name, era: 'modern' }); await sleep(300); return b; };
  const A = await mk('A'), B = await mk('B', A.code);
  A.w.send({ t: 'start' }); await sleep(500);
  ok('jang boshlandi', A.ev.includes('start'));
  fs.appendFileSync(path.join(copy, 'server.js'), '\n// sinov: kod yangilandi\n');
  await sleep(5000);
  const i2 = await info();
  ok("jang paytida: server qayta ishga tushmadi, lekin 'eskirgan' deb xabar beradi", i2 && i2.build === i1.build && i2.stale === true && !/qayta ishga tushmoqda/.test(log), JSON.stringify(i2 && { build: i2.build, stale: i2.stale }));

  // brauzer: eskirgan serverda xona ochishga yo'l qo'ymaydi va sababini aytadi
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9380, dir: 'p_restart' });
  await sleep(2500);
  const m1 = await pg.ev(`document.getElementById('mpErr').textContent`);
  await pg.ev(`(document.getElementById('mpName').value = 'Ali', document.getElementById('btnCreate').click(), 1)`);
  await sleep(1200);
  const m2 = await pg.ev(`[document.getElementById('mpErr').textContent, document.getElementById('lobby').classList.contains('hidden')]`);
  ok("brauzer: 'server eski' ogohlantirishi, xona ochilmadi", /eski kod/.test(m1) && /eski kod/.test(m2[0]) && m2[1] === true, m2[0].slice(0, 60));
  await pg.shot('stale_warning');

  // jang tugaydi -> server o'zi qayta ishga tushadi
  // (aloqasi uzilgan o'yinchi REJOIN_GRACE soniya kutiladi — sinovda 2 s; shundan keyin xonadan chiqariladi va jang tugaydi)
  B.w.close();
  const i3 = await waitInfo((i) => i.build && i.build !== i1.build, 12000);
  ok("jang tugagach server o'zi qayta ishga tushdi (yangi kod, eskirmagan)", i3 && i3.build !== i1.build && i3.stale === false && /qayta ishga tushmoqda/.test(log), JSON.stringify(i3 && { build: i3.build, stale: i3.stale }));
  await sleep(500);

  // yangilangan serverda xona ochiladi
  await pg.ev(`location.reload(), 1`); await sleep(3000);
  const m3 = await pg.ev(`document.getElementById('mpErr').textContent`);
  await pg.ev(`(document.getElementById('mpName').value = 'Ali', document.getElementById('btnCreate').click(), 1)`);
  await sleep(1500);
  const m4 = await pg.ev(`[document.getElementById('lobby').classList.contains('hidden'), document.getElementById('lobbyCode').textContent]`);
  ok('qayta ishga tushgan serverda xona ochildi', m3 === '' && m4[0] === false && /^[A-Z0-9]{4}$/.test(m4[1]), JSON.stringify(m4));

  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close(); A.w.close(); stop();
  L(fails ? `YAKUN: ${fails} ta xato` : "YAKUN: hammasi o'tdi");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
