// Barcha sinovlarni ketma-ket ishga tushiradi: har biri uchun alohida server (o'z sozlamalari bilan), oxirida umumiy hisobot.
// Ishlatish: node tests/run.js [nom ...]     masalan: node tests/run.js sp tank     (nomsiz — hammasi)
//            ZJ_GL=metal node tests/run.js   — haqiqiy videokartada (tezroq); odatda dasturiy chizish
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..'), PORT = +process.env.PORT || 8191;
// sinovga kerakli server sozlamalari (qisqartirilgan jang)
const ENV = { 'mp-deathmatch': { DM_TARGET: '2' }, 'zombie-mp': { Z_HOLD: '4', Z_EVAC: '0.2' }, features: { TDM_TARGET: '2', REJOIN_GRACE: '6' }, zone: { ZJ_ZONE: '1', ZONE_SPEED: '12' }, smoke: { ZJ_SEED: '424242', ZJ_ZONE: '1' }, modes: { GG_RESPAWN: '0.3', ZJ_SEED: '7', ZJ_MAP: 'town' } };
const NO_SERVER = new Set(['restart']);   // o'z serverini o'zi ishga tushiradi
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const up = () => new Promise((res) => http.get(`http://localhost:${PORT}/api/info`, (r) => { r.resume(); res(r.statusCode === 200); }).on('error', () => res(false)));

const LONG = { smoke: 1500 };   // uzoq davom etadigan sinovlar uchun vaqt chegarasi (s)
async function runOne(name) {
  let srv = null;
  if (!NO_SERVER.has(name)) {
    srv = spawn('node', ['server.js'], { cwd: ROOT, env: { ZJ_MAP: 'town', ZJ_ZONE: '0', ZJ_SEED: '0', ...process.env, PORT: String(PORT), ...(ENV[name] || {}) }, stdio: 'ignore' });   // sinovlar kichik shaharcha koordinatalariga yozilgan; torayuvchi zona faqat o'z sinovida yoqiladi
    for (let i = 0; i < 50 && !(await up()); i++) await sleep(100);
  }
  const t0 = Date.now();
  let out = '';
  const code = await new Promise((res) => {
    const p = spawn('node', [path.join('tests', name + '.test.js'), ...(process.env.ZJ_ERA ? [process.env.ZJ_ERA] : [])], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } });
    const to = setTimeout(() => { out += '\n  XATO vaqt tugadi (sinov to\'xtatildi)\n'; p.kill('SIGKILL'); }, +(process.env.ZJ_TIMEOUT || LONG[name] || 600) * 1000);
    p.stdout.on('data', (d) => { out += d; if (process.env.ZJ_VERBOSE) process.stdout.write(d); });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (c) => { clearTimeout(to); res(c); });
  });
  if (srv) { srv.kill(); await sleep(300); }
  const ok = (out.match(/^ {2}OK {2}/gm) || []).length, bad = out.split('\n').filter((l) => /^ {2}XATO/.test(l) || /JS XATO|CONSOLE\.error|EVAL XATO/.test(l));
  return { name, ok, bad, code, sec: Math.round((Date.now() - t0) / 1000), out };
}

(async () => {
  const all = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).map((f) => f.replace('.test.js', '')).sort();
  const want = process.argv.slice(2), list = want.length ? all.filter((n) => want.includes(n)) : all;
  const res = [];
  for (const name of list) {
    const r = await runOne(name);
    res.push(r);
    console.log(`${r.bad.length || r.code ? 'XATO' : ' OK '}  ${name.padEnd(16)} ${String(r.ok).padStart(3)} ta tekshiruv o'tdi, ${r.bad.length} ta xato  (${r.sec} s)`);
    for (const l of r.bad) console.log('        ' + l.trim().slice(0, 260));
    fs.mkdirSync(path.join(require('os').tmpdir(), 'zj-test'), { recursive: true });
    fs.writeFileSync(path.join(require('os').tmpdir(), 'zj-test', name + '.log'), r.out);
  }
  const bad = res.filter((r) => r.bad.length || r.code);
  console.log(`\nJami: ${res.reduce((a, r) => a + r.ok, 0)} ta tekshiruv o'tdi, ${res.reduce((a, r) => a + r.bad.length, 0)} ta xato · muvaffaqiyatsiz sinovlar: ${bad.length ? bad.map((r) => r.name).join(', ') : "yo'q"}`);
  process.exit(bad.length ? 1 : 0);
})();
