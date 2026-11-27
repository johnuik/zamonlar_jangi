// Sinov uchun yordamchi: minimal WebSocket mijozi + Chrome DevTools boshqaruvi.
// Ishlatish: 1) PORT=8191 node server.js   (mp-deathmatch uchun: DM_TARGET=2 qo'shing)
//            2) PORT=8191 node tests/sp.test.js [historical|modern]
// 8090 — o'yinning o'z porti (start.sh), sinovlar uni ishlatmaydi. Sinov serverini faqat o'z porti/PID bo'yicha to'xtating.
// Chrome kerak (macOS'da /Applications dan o'zi topiladi; boshqa joyda bo'lsa CHROME=/yo'l). Skrinshotlar va vaqtinchalik profil: $TMPDIR/zj-test
// Hammasini birdan ishga tushirish: node tests/run.js  (yoki npm test)
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), fs = require('fs');
const OUT = require('path').join(require('os').tmpdir(), 'zj-test');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function wsConnect(url) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13' } });
    req.on('upgrade', (r, sock) => {
      const c = { on: () => {}, buf: Buffer.alloc(0), frags: [] };
      c.send = (o) => {
        const d = Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)); const m = crypto.randomBytes(4);
        let h; if (d.length < 126) h = Buffer.from([0x81, 0x80 | d.length]);
        else if (d.length < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 0x80 | 126; h.writeUInt16BE(d.length, 2); }
        else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 0x80 | 127; h.writeBigUInt64BE(BigInt(d.length), 2); }
        const md = Buffer.from(d); for (let i = 0; i < md.length; i++) md[i] ^= m[i & 3];
        sock.write(Buffer.concat([h, m, md]));
      };
      c.close = () => sock.destroy();
      sock.on('data', (chunk) => {
        c.buf = Buffer.concat([c.buf, chunk]);
        for (;;) {
          if (c.buf.length < 2) return;
          const fin = c.buf[0] & 0x80, op = c.buf[0] & 15; let len = c.buf[1] & 127, off = 2;
          if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
          else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
          if (c.buf.length < off + len) return;
          const p = c.buf.subarray(off, off + len); c.buf = c.buf.subarray(off + len);
          if (op === 9) { const m = crypto.randomBytes(4), md = Buffer.from(p); for (let i = 0; i < md.length; i++) md[i] ^= m[i & 3]; try { sock.write(Buffer.concat([Buffer.from([0x8a, 0x80 | md.length]), m, md])); } catch (e) { /* yopilgan */ } }   // ping → pong (brauzer kabi)
          else if (op === 1 || op === 0) { c.frags.push(Buffer.from(p)); if (fin) { const t = Buffer.concat(c.frags).toString(); c.frags = []; try { c.on(JSON.parse(t)); } catch (e) { console.log('handler xato', e); } } }
        }
      });
      res(c);
    });
    req.on('error', rej); req.end();
  });
}
function getJSON(url) { return new Promise((res, rej) => http.get(url, (r) => { let d = ''; r.on('data', (x) => (d += x)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej)); }

// Chrome qayerda: CHROME o'zgaruvchisi, macOS'dagi odatiy joy yoki PATH dagi google-chrome / chromium
function chromeBin() {
  if (process.env.CHROME) return process.env.CHROME;
  const mac = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  if (process.platform === 'darwin') for (const f of mac) if (fs.existsSync(f)) return f;
  return 'google-chrome';
}

// Chrome'ni ishga tushiradi va sahifani boshqarish uchun obyekt qaytaradi
async function openPage(url, { port = 9333, dir = 'p_cdp', size = '1280,720', log = console.log, map = 'town' } = {}) {
  // sinovlar kichik shaharcha (town) koordinatalariga yozilgan; o'yinning standart xaritasi esa — yangi shahar
  if (map && !/[?&]xarita=/.test(url)) url += (url.includes('?') ? '&' : '?') + 'xarita=' + map;
  if (!/[?&]urug=/.test(url)) url += (url.includes('?') ? '&' : '?') + 'urug=0';   // qurollar tartibi o'zgarmas (aks holda har jangda tasodifiy)
  // shu portni avvalgi (yopilmay qolgan) sinov brauzeri band qilgan bo'lsa — uni CDP orqali yopamiz; aks holda sinov eski sahifaga ulanib qolardi
  try {
    const v = await getJSON(`http://localhost:${port}/json/version`);
    if (v && v.webSocketDebuggerUrl) { const b = await wsConnect(v.webSocketDebuggerUrl); b.send({ id: 1, method: 'Browser.close' }); for (let i = 0; i < 20; i++) { await sleep(150); try { await getJSON(`http://localhost:${port}/json/version`); } catch (e) { break; } } }
  } catch (e) { /* port bo'sh */ }
  fs.rmSync(`${OUT}/${dir}`, { recursive: true, force: true });
  // ZJ_GL=gl — haqiqiy videokarta bilan (grafika sinovi va skrinshotlar uchun); odatda dasturiy chizish (har qanday mashinada bir xil)
  const gl = process.env.ZJ_GL ? [`--use-angle=${process.env.ZJ_GL}`, '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  // (ekran o'chsa yoki oyna "ko'rinmas" deb hisoblansa ham sahifa sekinlashtirilmaydi — uzoq sinovlar o'rtada qotib qolmasligi uchun)
  // ZJ_HEADFUL=1 — brauzer oynasi ekranda ko'rinadi (sinovni kuzatish uchun); odatda ko'rinmas (headless)
  const chrome = spawn(chromeBin(), [...(process.env.ZJ_HEADFUL === '1' ? ['--new-window', '--window-position=60,60', '--no-first-run', '--no-default-browser-check'] : ['--headless=new']), '--no-sandbox', ...gl, `--window-size=${size}`, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    `--remote-debugging-port=${port}`, `--user-data-dir=${OUT}/${dir}`, '--autoplay-policy=no-user-gesture-required', ...(process.env.ZJ_CHROME_ARGS ? process.env.ZJ_CHROME_ARGS.split(' ') : []), url], { stdio: 'ignore' });   // ZJ_CHROME_ARGS — qo'shimcha bayroqlar (masalan, Retina ekranni taqlid qilish: --force-device-scale-factor=2)
  // sinov qanday tugashidan qat'i nazar brauzer yopiladi (aks holda fonda qolib, protsessorni band qiladi)
  process.on('exit', () => { try { chrome.kill(); } catch (e) { /* allaqachon yopilgan */ } });
  let page;
  for (let i = 0; i < 60 && !page; i++) { await sleep(250); try { page = (await getJSON(`http://localhost:${port}/json`)).find((t) => t.type === 'page'); } catch (e) { /* hali emas */ } }
  if (!page) throw new Error('Chrome ochilmadi');
  const cdp = await wsConnect(page.webSocketDebuggerUrl);
  let mid = 0; const pend = new Map(); const errors = [];
  cdp.on = (o) => {
    if (o.id && pend.has(o.id)) { pend.get(o.id)(o); pend.delete(o.id); }
    else if (o.method === 'Runtime.exceptionThrown') { const d = o.params.exceptionDetails; const m = (d.exception && d.exception.description) || d.text; errors.push(m); log('JS XATO:', String(m).slice(0, 700)); }
    else if (o.method === 'Runtime.consoleAPICalled' && o.params.type === 'error') { const m = o.params.args.map((a) => a.value || a.description).join(' '); errors.push(m); log('CONSOLE.error:', m.slice(0, 400)); }
  };
  const call = (method, params = {}) => new Promise((r) => { const id = ++mid; pend.set(id, r); cdp.send({ id, method, params }); });
  const ev = async (expr) => {
    const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) { const m = r.result.exceptionDetails.exception ? r.result.exceptionDetails.exception.description : r.result.exceptionDetails.text; errors.push(m); log('EVAL XATO:', String(m).slice(0, 600)); return undefined; }
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const shot = async (name) => { const r = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
  await call('Runtime.enable');
  // O'yin to'liq yuklanguncha kutamiz (sekin mashinada sahifa bir necha soniyada ochiladi) — sinovlar tayyor sahifa bilan ishlaydi
  for (let i = 0; i < 300; i++) { if (await ev('!!(window.__dbg && window.__G && window.__G.world)')) break; await sleep(100); }
  return { ev, shot, errors, close: () => { cdp.close(); chrome.kill(); } };
}
module.exports = { wsConnect, openPage, sleep };
