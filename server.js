// ZAMONLAR JANGI — mahalliy tarmoq (LAN) serveri
// Statik fayllarni tarqatadi va o'yinchilarni WebSocket orqali bog'laydi. Tashqi kutubxonasiz.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = +process.env.PORT || 8080;
const ROOT = __dirname;

// ---------- Eskirgan serverni aniqlash ----------
// Server kodi xotirada turadi: server.js diskda o'zgarsa-yu, jarayon qayta ishga tushmasa, o'yinchilar
// yangi brauzer kodi bilan eski server mantig'ida o'ynab qoladi (masalan, eski transport ro'yxati).
// BUILD — ishga tushgan paytdagi kod izi. start.sh orqali ishga tushganda (ZJ_AUTORESTART=1) server
// kod o'zgarganini sezib, jang bo'lmayotgan paytda o'zi qayta ishga tushadi (chiqish kodi 75).
const SHARED = path.join(__dirname, 'js', 'shared.mjs');   // mijoz bilan umumiy jadvallar — u ham server mantig'ining bir qismi
const fileHash = () => { try { return crypto.createHash('sha1').update(fs.readFileSync(__filename)).update(fs.readFileSync(SHARED)).digest('hex').slice(0, 12); } catch (e) { return ''; } };
const BUILD = fileHash();
const isStale = () => { const h = fileHash(); return h !== '' && h !== BUILD; };
let restarting = false;
function maybeRestart() {
  if (restarting || !isStale()) return;
  for (const r of rooms.values()) if (r.state === 'playing') return;   // jang tugashini kutamiz
  if (process.env.ZJ_AUTORESTART !== '1') { console.log("\n  DIQQAT: server.js yangilandi. Yangi kod ishlashi uchun serverni qayta ishga tushiring (Ctrl+C, so'ng ./start.sh).\n"); restarting = true; return; }
  restarting = true;
  console.log("\n  server.js yangilandi — server qayta ishga tushmoqda...\n");
  for (const r of rooms.values()) r.broadcast({ t: 'error', m: 'Server yangilandi. Bir necha soniyadan keyin xonani qaytadan yarating.' });
  setTimeout(() => process.exit(75), 400);
}
fs.watchFile(__filename, { interval: 2000 }, maybeRestart);
fs.watchFile(SHARED, { interval: 2000 }, maybeRestart);
const MATCH_TIME = 480;      // jang davomiyligi (soniya)
const WIDE_TIME = 840;       // katta xaritada (karantin zonasi) jang uzoqroq davom etadi
const HOLD_TARGET = 90;      // g'alaba uchun bayroqni ushlab turish vaqti (soniya)
const FLAG_BASE = { x: 0, z: 2 };
const PICK_R = 1.8;
const MAX_PLAYERS = 8;
const DM_TARGET = +process.env.DM_TARGET || 15;        // deathmatch: g'alaba uchun o'ldirishlar soni
const TDM_TARGET = +process.env.TDM_TARGET || 30;      // jamoaviy jang: g'alaba uchun jamoaning o'ldirishlari soni
const VEH_RESPAWN = 40;      // yo'q qilingan transport qayta paydo bo'lishi (soniya)
const PICKUP_RESPAWN = 15;   // noyob qurol podvalga qaytishi (soniya)
// Transport joylari, xaritalar, zombi punktlari, transport joni/o'rinlari — js/shared.mjs da (brauzer bilan bitta manba).
// Server ishga tushganda yuklanadi (pastda: import()).
let SH = null;
// Ketma-ket yutqazayotgan o'yinchiga yordam: raqib qo'lida shuncha marta ketma-ket (o'zi hech kimni o'ldirmay) halok bo'lsa,
// keyingi tug'ilishda kuchliroq qurol beriladi (1-daraja, 2-daraja). Birinchi o'ldirishdayoq hisob nolga qaytadi.
const COMEBACK = [3, 5];
const comebackTier = (ds) => (ds >= COMEBACK[1] ? 2 : ds >= COMEBACK[0] ? 1 : 0);
const Z_HUMANS = 4;          // zombi rejimi: odam bo'lib o'ynaydiganlar soni (qolganlar zombi bo'lib qo'shiladi)
const Z_TIME = 1500;         // zombi rejimi davomiyligi (soniya) — ulgurmasa, zombilar yutadi
const Z_HOLD = +process.env.Z_HOLD || 0;    // nuqtani ushlab turish vaqti (0 — vazifa jadvalidagi qiymat; sinovlar uchun qisqartirsa bo'ladi)
// evakuatsiya bosqichlari vaqti (js/shared.mjs: EVAC_T); Z_EVAC — sinovlar uchun hammasini qisqartiruvchi ko'paytuvchi
const evacT = (k) => SH.EVAC_T[k] * (+process.env.Z_EVAC || 1);   // (SH umumiy kod yuklangach chaqiriladi)

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary',
};

function lanIPs() {
  const real = [], virt = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    const isVirt = /^(docker|br-|veth|virbr|vboxnet|vmnet|tun|tap|zt|tailscale|wg|lxc|lxd)/i.test(name);
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) (isVirt ? virt : real).push(a.address);
  }
  return real.length ? real : virt;
}

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); res.end(); return; }
  if (url === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ips: lanIPs(), port: PORT, build: BUILD, stale: isStale() }));
    return;
  }
  if (url === '/') url = '/index.html';
  const fp = path.join(ROOT, path.normalize(url));
  const ext = path.extname(fp);
  if (!fp.startsWith(ROOT + path.sep) || !MIME[ext] || path.basename(fp).startsWith('.')) { res.writeHead(404); res.end('Topilmadi'); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Topilmadi'); return; }
    // foto-tekstura va modellar (assets/) o'zgarmaydi — brauzer ularni keshda saqlaydi; kod va ro'yxat (json) fayllari har safar qayta tekshiriladi
    res.writeHead(200, { 'Content-Type': MIME[ext], 'Cache-Control': url.startsWith('/assets/') && ext !== '.json' ? 'public, max-age=604800' : 'no-cache' });
    res.end(data);
  });
});

// ---------- Minimal WebSocket (RFC 6455) ----------
// Ulanishlar ro'yxati va "tirikmi" tekshiruvi. Server uzilishni faqat yozganda yoki ulanish to'g'ri yopilganda sezadi;
// lobbida esa hech narsa yozilmaydi — Wi-Fi uzilgan yoki noutbuki uxlab qolgan o'yinchi ro'yxatda abadiy qolib ketardi (xost bo'lsa — hech kim jangni boshlay olmasdi).
// Shuning uchun har 5 soniyada "ping" yuboriladi (brauzer o'zi "pong" qaytaradi); ALIVE_MS davomida hech narsa kelmasa — ulanish uzilgan hisoblanadi.
const clients = new Set(), ALIVE_MS = +process.env.ALIVE_MS || 25000;
setInterval(() => {
  const t = Date.now();
  for (const c of clients) {
    if (!c.open) { clients.delete(c); continue; }
    if (t - c.seen > ALIVE_MS) { try { c.sock.destroy(); } catch (e) { /* e'tiborsiz */ } c.onClose(); }
    else { try { c.frame(9, Buffer.alloc(0)); } catch (e) { /* e'tiborsiz */ } }
  }
}, 5000).unref();

class Client {
  constructor(sock) {
    this.sock = sock; this.buf = Buffer.alloc(0); this.frag = []; this.open = true; this.room = null; this.seen = Date.now();
    clients.add(this);
    sock.on('data', (d) => this.onData(d));
    sock.on('close', () => this.onClose());
    sock.on('error', () => this.onClose());
    sock.on('end', () => { try { sock.end(); } catch (e) { /* e'tiborsiz */ } this.onClose(); });   // narigi tomon ulanishni yopdi (yopish kadrisiz)
  }
  onData(d) {
    this.seen = Date.now();
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) { this.close(); return; }
      const mOff = off;
      if (masked) off += 4;
      if (this.buf.length < off + len) return;
      let payload = Buffer.from(this.buf.subarray(off, off + len));
      if (masked) { const m = this.buf.subarray(mOff, mOff + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      this.buf = this.buf.subarray(off + len);
      if (op === 8) { this.close(); return; }
      if (op === 9) { this.frame(10, payload); continue; }
      if (op === 10) continue;
      this.frag.push(payload);
      if (fin) {
        const text = Buffer.concat(this.frag).toString('utf8');
        this.frag = [];
        let msg;
        try { msg = JSON.parse(text); } catch (e) { continue; }
        if (msg && typeof msg === 'object') { try { handle(this, msg); } catch (e) { console.error('Xato:', e); } }
      }
    }
  }
  frame(op, data) {
    if (!this.open) return;
    const len = data.length;
    let h;
    if (len < 126) h = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); }
    else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); }
    this.sock.write(Buffer.concat([h, data]));
  }
  sendRaw(text) { this.frame(1, Buffer.from(text, 'utf8')); }
  send(o) { this.sendRaw(JSON.stringify(o)); }
  close() {
    if (!this.open) return;
    try { this.frame(8, Buffer.alloc(0)); } catch (e) { /* e'tiborsiz */ }
    this.open = false;
    this.sock.end();
    this.onClose();
  }
  onClose() {
    this.open = false; clients.delete(this);
    if (this.room) this.room.dropped(this);   // aloqa uzildi: o'yinchi bir muddat xonada saqlanadi (qayta ulanishi mumkin)
  }
}

server.on('upgrade', (req, socket) => {
  if (req.url !== '/ws' || String(req.headers.upgrade).toLowerCase() !== 'websocket' || !req.headers['sec-websocket-key']) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  new Client(socket);
});

// ---------- Xonalar ----------
const rooms = new Map();
let nextId = 1;
const now = () => Date.now() / 1000;
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const cleanName = (s) => String(s || '').replace(/[<>&"'`\\]/g, '').trim().slice(0, 16) || 'Askar';
const cleanText = (s, n) => String(s || '').replace(/[<>&"'`\\\u0000-\u001f]/g, '').trim().slice(0, n);
const REJOIN_GRACE = +process.env.REJOIN_GRACE || 20;   // aloqasi uzilgan o'yinchi shuncha soniya kutiladi
// ---------- Torayuvchi zona (PUBG uslubida) ----------
// Xarita katta bo'lgani uchun o'yinchilar bir-birini topishi qiyin: xavfsiz doira bosqichma-bosqich torayadi, tashqarida qolgan o'yinchi jon yo'qotadi.
// Bosqich: [kutish (s), torayish (s), yangi radius (xarita yarim o'lchamiga nisbatan), tashqaridagi zarar (jon/s)]
const ZONE_PHASES = [[50, 40, 0.95, 3], [40, 35, 0.62, 5], [35, 30, 0.38, 8], [30, 25, 0.24, 12], [25, 20, 0.15, 18]];
const ZONE_MIN_R = 24;                                  // eng kichik doira (metr)
// Jang maydoni rejimi: oxirida doira butunlay yopiladi — jang albatta tugaydi
const BR_PHASES = [...ZONE_PHASES, [20, 25, 0.05, 22], [10, 25, 0, 30]];
const ZONE_DEFAULT = process.env.ZJ_ZONE !== '0';       // sinovlarda o'chiriladi (ZJ_ZONE=0)
const ZONE_SPEED = +process.env.ZONE_SPEED || 1;        // sinovlar uchun tezlashtirish

function genCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = ''; for (let i = 0; i < 4; i++) c += A[crypto.randomInt(A.length)]; } while (rooms.has(c));
  return c;
}

class Room {
  constructor(era) {
    this.code = genCode(); this.era = era; this.players = new Map(); this.hostId = null; this.state = 'lobby';
    this.mode = 'flag'; this.map = SH.mapId(process.env.ZJ_MAP || 'city'); this.vehOn = true; this.teamOn = false;   // teamOn — jang maydoni va gun game jamoa bo'lib o'ynaladimi   // standart xarita — yangi shahar (sinovlar ZJ_MAP=town bilan ishlaydi)
    this.vehDefs = SH.VEHICLE_SPAWNS; this.veh = [];
    this.tk = [0, 0];   // jamoaviy rejim: jamoalarning o'ldirishlari (1-jamoa, 2-jamoa)
    this.zoneOn = ZONE_DEFAULT; this.zone = null;   // torayuvchi zona (lobbida o'chirsa bo'ladi)
    this.picks = []; this.pendingEnd = null; this.forfeit = 0;   // forfeit — jamoaviy jangda raqibsiz qolgan jamoa (texnik g'alaba)
    this.zs = { stage: 0, hold: 0, got: [], spots: [], flashT: 12, evac: null, callT: [] };   // zombi rejimi holati: bosqich, ushlab turish sanog'i, topilgan qismlar va ularning joylari
    this.flag = { holder: null, x: FLAG_BASE.x, z: FLAG_BASE.z, groundT: 0 };
    this.items = {};
    this.timer = null; this.timeLeft = MATCH_TIME;
    rooms.set(this.code, this);
  }
  resetPlayer(p) {
    p.hp = 100; p.alive = true; p.score = 0; p.kills = 0; p.deaths = 0; p.hold = 0; p.respT = 0; p.lastHurt = -99;
    p.x = null; p.y = 0; p.z = null; p.yaw = 0; p.pitch = 0; p.cr = 0; p.w = 0; p.ch = 0; p.veh = -1; p.seat = -1; p.iv = -1;
    p.streak = 0;   // o'lmasdan ketma-ket o'ldirishlar
    p.ds = 0;       // hech kimni o'ldirmay ketma-ket (raqib qo'lida) halok bo'lishlar
    p.ar = 0;       // zirh nimcha (qolgan sig'imi)
    p.zb = false; p.turn = false;   // zb — zombi-o'yinchimi; turn — o'lgach zombiga aylanadi (faqat zombi rejimida)
    p.fl = false; p.ev = false; p.df = 0; p.dx = null;   // fl — odam bo'lib yiqilgan (tiriltirish punktidan chaqirsa bo'ladi); ev — evakuatsiya vertolyotida; df — defibrillyatori bor; dx/dy/dz — yiqilgan joyi
    p.tm = 0;                       // jamoa (jamoaviy rejimda 1 yoki 2)
    p.gg = 0;                       // gun game: qurol darajasi
    p.hm = 0; p.hl = 0;             // shlem: qolgan zaxirasi va darajasi (jang maydoni)
    p.out = false; p.place = 0;     // jang maydoni: o'yindan chiqqan (qayta tug'ilmaydi) va egallagan o'rni
  }
  get zombie() { return this.mode === 'zombie'; }
  get tdm() { return SH.teamMode(this.mode, this.teamOn); }   // jamoalar bormi (jamoaviy jang; jang maydoni va gun game — tanlovga ko'ra)
  get br() { return this.mode === 'br'; }
  get gg() { return this.mode === 'gg'; }
  get zph() { return this.br ? BR_PHASES : ZONE_PHASES; }
  // kichikroq jamoa (yangi qo'shilgan o'yinchi shunga tushadi)
  smallerTeam() { let a = 0, b = 0; for (const p of this.players.values()) { if (p.tm === 1) a++; else if (p.tm === 2) b++; } return a <= b ? 1 : 2; }
  // zombi rejimi: tirik odamlar
  humans() { return [...this.players.values()].filter((p) => !p.zb); }
  resetVehicle(v, i) {
    const d = this.vehDefs[i];
    Object.assign(v, { id: i, type: d.type, x: d.x, y: 0, z: d.z, yw: d.yaw, pt: 0, rl: 0, ay: d.yaw, ap: 0, hp: SH.VEH_STATS[d.type].hp, al: true, seats: new Array(SH.VEH_STATS[d.type].seats).fill(0), owner: 0, respT: 0,
      rk: d.type === 'heli' ? 12 : 0, rr: 0, ht: 0, oh: 0, tr: 0, fu: undefined, aa: undefined, ab: undefined });   // tr — uzilgan gusenitsalar (bit 1 — chap, 2 — o'ng)   // qurol holati (raketalar, qayta o'qlash, qizish) — egasidan keladi
    return v;
  }
  leaveSeat(p) {
    if (p.veh < 0) return;
    const v = this.veh[p.veh], seat = p.seat;
    p.veh = -1; p.seat = -1;
    if (!v || v.seats[seat] !== p.id) return;
    v.seats[seat] = 0;
    if (seat === 0) this.promote(v);
  }
  // Chinuk: uchuvchi halok bo'lsa yoki o'rnidan ketsa, ikkinchi uchuvchi boshqaruvni avtomatik oladi
  promote(v) {
    if (v.type !== 'chinook' || !v.al || v.seats[0] || !v.seats[1]) return;
    const q = this.players.get(v.seats[1]);
    if (!q || !q.alive) return;
    v.seats[0] = q.id; v.seats[1] = 0; q.seat = 0; v.owner = q.id;
    q.send({ t: 'vseat', v: v.id, seat: 0, promoted: 1 });
  }
  releasePicks(p) { for (const pk of this.picks) if (pk.holder === p.id) { pk.holder = 0; pk.respT = PICKUP_RESPAWN; } }
  // Jang maydoni: bitta o'yinchi (yoki bitta jamoa) qolsa — jang tugaydi. last — hozirgina halok bo'lgan (hamma birdan o'lsa, g'olib u)
  brCheck(last) {
    if (!this.br || this.state !== 'playing' || this.pendingEnd) return;
    const live = [...this.players.values()].filter((p) => p.alive && !p.out);
    const over = this.tdm ? new Set(live.map((p) => p.tm)).size <= 1 : live.length <= 1;
    if (!over) return;
    const w = live.slice().sort((a, b) => b.kills - a.kills)[0] || last || [...this.players.values()][0];
    if (w) { for (const p of live) p.place = 1; this.pendingEnd = w; }
  }
  killPlayer(v, killer, head, kind, wn) {
    if (!v.alive) return;
    v.alive = false; v.hp = 0; v.ar = 0; v.hm = 0; v.hl = 0; v.deaths++; v.respT = this.gg ? +process.env.GG_RESPAWN || SH.GG_RESPAWN : SH.RESPAWN; v.streak = 0;
    if (killer && killer !== v) { killer.streak++; killer.ds = 0; v.ds++; }   // o'zi yiqilgan/portlagan o'yinchiga yordam hisoblanmaydi
    this.leaveSeat(v); this.releasePicks(v);
    const carrier = this.mode === 'flag' && this.flag.holder === v.id;
    if (killer && killer !== v) { killer.kills++; killer.score += (this.zombie && killer.zb ? 200 : 100) + (head ? 50 : 0) + (carrier ? 50 : 0); }
    if (this.zombie && !v.zb) {   // halok bo'lgan odam zombi bo'lib qayta tug'iladi — undan oldin Z_DOWN soniya yerda yotadi (sherigi defibrillyator bilan tiriltira oladi)
      v.turn = true; v.fl = true; v.df = 0; v.respT = SH.Z_DOWN; v.dx = v.x; v.dy = v.y; v.dz = v.z;
    }
    if (carrier) this.dropFlag(v);
    this.broadcast({ t: 'kill', killer: killer && killer !== v ? killer.id : 0, victim: v.id, head: !!head, kind: String(kind || 'bullet').slice(0, 10),
      wn: killer && killer !== v ? cleanText(wn, 28) : undefined, khp: killer && killer !== v ? Math.max(0, Math.ceil(killer.hp)) : undefined });
    if (this.mode === 'dm' && killer && killer !== v && killer.kills >= DM_TARGET) this.pendingEnd = killer;
    if (this.mode === 'tdm' && killer && killer !== v && killer.tm && killer.tm !== v.tm) { this.tk[killer.tm - 1]++; if (this.tk[killer.tm - 1] >= TDM_TARGET) this.pendingEnd = killer; }
    if (this.gg && killer && killer !== v) {
      // gun game: o'qotar qurol yoki pichoq bilan o'ldirish darajani oshiradi (transport, granata, zona hisobga kirmaydi); oxirgi darajada faqat pichoq g'alaba keltiradi
      const last = SH.GG_LADDER.length - 1, knife = kind === 'knife';
      if (killer.gg >= last) { if (knife) this.pendingEnd = killer; }
      else if (knife || kind === 'bullet' || !kind) { killer.gg++; this.broadcast({ t: 'gg', id: killer.id, lv: killer.gg }); }
      if (knife && v.gg > 0 && !this.pendingEnd) { v.gg--; this.broadcast({ t: 'gg', id: v.id, lv: v.gg, down: 1 }); }
    }
    if (this.br) {
      // jang maydoni: qayta tug'ilish yo'q; o'rni — o'sha paytda tirik qolganlar soni + 1
      v.out = true; v.place = [...this.players.values()].filter((p) => p.alive && !p.out).length + 1;
      this.brCheck(v);
    }
  }
  vhit(c, o) {
    if (this.state !== 'playing') return;
    const v = this.veh[num(o.v, -1)];
    if (!v || !v.al) return;
    // jamoaviy rejim: sherik o'tirgan transportga zarar yetkazib bo'lmaydi (o'zi ichida bo'lsa — urilish/qulash hisoblanadi)
    if (this.tdm && c.veh !== v.id && v.seats.some((id) => { const q = id && this.players.get(id); return q && q.tm === c.tm; })) return;
    v.hp -= Math.max(0, Math.min(3000, num(o.dmg)));
    v.tr |= num(o.tr) & 3;
    if (v.hp > 0) return;
    v.al = false; v.hp = 0; v.respT = VEH_RESPAWN;
    const occ = v.seats.filter(Boolean).map((id) => this.players.get(id)).filter(Boolean);
    // yuk bo'limida piyoda turganlar ham (o'rindiqsiz) transport bilan birga halok bo'ladi
    for (const p of this.players.values()) if (p.alive && p.iv === v.id && !occ.includes(p)) occ.push(p);
    v.seats = v.seats.map(() => 0); v.owner = 0;
    this.broadcast({ t: 'vboom', v: v.id, by: c.id });
    // zombi rejimi: sun'iy zombilarning zarbasini xost uzatadi (z belgisi bilan) — bu uning o'ldirishi emas
    const zk = this.zombie && !!o.z && c.id === this.hostId, inside = occ.includes(c);
    for (const p of occ) this.killPlayer(p, inside || zk ? null : c, false, zk ? 'zombie' : 'vehicle');
  }
  add(c, name) {
    c.id = nextId++; c.name = cleanName(name); c.room = this; c.gone = 0; c.pick = 0;   // pick — lobbida tanlangan jamoa (0 — avtomatik)
    c.key = crypto.randomBytes(9).toString('base64url');   // qayta ulanish kaliti (faqat shu o'yinchiga yuboriladi)
    let n = 2; const base = c.name;
    while ([...this.players.values()].some((p) => p.name === c.name)) c.name = base.slice(0, 13) + ' ' + n++;
    this.resetPlayer(c);
    this.players.set(c.id, c);
    { const h = this.hostId && this.players.get(this.hostId); if (!h || h.gone) this.hostId = c.id; }   // xost yo'q yoki aloqasi uzilgan — boshqaruv yangi o'yinchiga
    c.send({ t: 'joined', id: c.id, name: c.name, code: this.code, era: this.era, key: c.key });
    if (this.state === 'playing' && this.zombie) { c.zb = true; c.hp = SH.Z_HP; }   // jang ketayotganda qo'shilgan o'yinchi — zombi
    if (this.state === 'playing' && this.tdm) { c.tm = 0; c.tm = this.smallerTeam(); }
    if (this.state === 'playing' && this.br) { c.alive = false; c.hp = 0; c.out = true; c.place = 0; }   // jang maydoniga kech qo'shilgan — kuzatuvchi
    this.lobby();
    if (this.state === 'playing') c.send(this.startMsg());
    console.log(`[${this.code}] ${c.name} qo'shildi (${this.players.size} o'yinchi)`);
  }
  // Aloqa uzildi: o'yinchi ro'yxatda qoladi, lekin bayroq/transport/xostlik bo'shatiladi. REJOIN_GRACE ichida qaytmasa — chiqariladi.
  dropped(c) {
    if (this.players.get(c.id) !== c || c.gone) return;
    c.gone = now();
    if (this.flag.holder === c.id) this.dropFlag(c);
    this.leaveSeat(c); this.releasePicks(c);
    const live = [...this.players.values()].filter((p) => !p.gone);
    for (const v of this.veh) if (v.owner === c.id) v.owner = live.length ? live[0].id : 0;
    if (this.hostId === c.id && live.length) this.hostId = live[0].id;
    this.broadcast({ t: 'away', id: c.id, name: c.name });
    if (!live.length) { this.leave(c); for (const p of [...this.players.values()]) this.leave(p); return; }   // hech kim qolmadi — xona yopiladi
    c.goneTimer = setTimeout(() => { if (this.players.get(c.id) === c && c.gone) { c.room = null; this.leave(c); } }, REJOIN_GRACE * 1000);
    this.lobby();
  }
  // Qayta ulanish: yangi ulanish eski o'yinchining o'rnini egallaydi (raqami, hisobi, jamoasi saqlanadi)
  rejoin(c, old) {
    clearTimeout(old.goneTimer);
    for (const k of Object.keys(old)) if (!['sock', 'buf', 'frag', 'open', 'goneTimer'].includes(k)) c[k] = old[k];
    c.gone = 0; c.room = this; old.room = null;
    this.players.set(c.id, c);   // o'rni (tartibi) o'zgarmaydi
    if (!this.hostId || !this.players.get(this.hostId) || this.players.get(this.hostId).gone) this.hostId = c.id;
    c.send({ t: 'joined', id: c.id, name: c.name, code: this.code, era: this.era, key: c.key, re: 1 });
    this.broadcast({ t: 'back', id: c.id, name: c.name }, c);
    this.lobby();
    if (this.state === 'playing') { c.veh = -1; c.seat = -1; c.x = null; c.send(this.startMsg()); }
    console.log(`[${this.code}] ${c.name} qayta ulandi`);
  }
  leave(c) {
    clearTimeout(c.goneTimer);
    if (!this.players.delete(c.id)) return;
    if (this.flag.holder === c.id) this.dropFlag(c);
    this.leaveSeat(c); this.releasePicks(c);
    // voris — aloqada bo'lgan birinchi o'yinchi (aloqasi uzilgan "arvoh" xost bo'lib qolsa, hech kim jangni boshlay olmasdi)
    const live = [...this.players.values()].filter((p) => !p.gone);
    const heir = live.length ? live[0].id : this.players.size ? this.players.keys().next().value : 0;
    for (const v of this.veh) if (v.owner === c.id) v.owner = heir;
    if (this.hostId === c.id) this.hostId = heir || null;
    this.broadcast({ t: 'left', id: c.id, name: c.name });
    console.log(`[${this.code}] ${c.name} chiqdi`);
    if (!this.players.size) { clearInterval(this.timer); rooms.delete(this.code); maybeRestart(); return; }
    if (this.state === 'playing' && this.players.size < 2 && !this.zombie) this.end();   // zombi rejimida yolg'iz odam ham davom etadi
    else if (this.state === 'playing' && this.br) this.brCheck(null);
    else if (this.state === 'playing' && this.tdm) {   // jamoaviy jang: bir jamoada hech kim qolmasa — ikkinchisi g'olib (aks holda sheriklar bir-biriga zarar bera olmay, jang tugamay qolardi)
      const n1 = [...this.players.values()].filter((p) => p.tm === 1).length, n2 = this.players.size - n1;
      if (!n1 || !n2) { if (this.mode === 'tdm') this.forfeit = n1 ? 1 : 2; this.end(); }   // (gun game jamoa bo'lib: raqib jamoa qolmadi — yetakchi g'olib)
    }
    this.lobby();
  }
  lobby() {
    this.broadcast({ t: 'lobby', code: this.code, era: this.era, mode: this.mode, map: this.zombie ? 'wild' : this.map, veh: this.vehOn ? 1 : 0, zone: this.zoneOn ? 1 : 0, team: this.teamOn ? 1 : 0, host: this.hostId, state: this.state,
      players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, gone: p.gone ? 1 : undefined, tm: this.tdm ? (this.state === 'playing' ? p.tm : p.pick) || 0 : undefined })) });
  }
  broadcast(o, except) {
    const s = JSON.stringify(o);
    for (const p of this.players.values()) if (p !== except) p.sendRaw(s);
  }
  // Zona holati (mijozga): [x, z, r, keyingi x, z, r, vaqt, toraymoqdami, zarar/s, yana torayadimi]
  zoneArr() { return this.zone ? [+this.zone.x.toFixed(1), +this.zone.z.toFixed(1), +this.zone.r.toFixed(1), +this.zone.tx.toFixed(1), +this.zone.tz.toFixed(1), +this.zone.tr.toFixed(1), Math.max(0, Math.ceil(this.zone.t * ZONE_SPEED)), this.zone.sh, this.zone.dmg, this.zph[this.zone.i] ? 1 : 0] : undefined; }
  matchTime() { return this.zombie ? Z_TIME : this.br ? SH.BR_TIME : this.gg ? SH.GG_TIME : SH.MAPS[this.map].half > 200 ? WIDE_TIME : MATCH_TIME; }
  startMsg() {
    return { t: 'start', era: this.era, mode: this.mode, map: this.zombie ? 'wild' : this.map, holdTarget: HOLD_TARGET, dmTarget: DM_TARGET, tdmTarget: TDM_TARGET, matchTime: this.matchTime(),
      base: FLAG_BASE, veh: this.vehDefs, nv: this.vehOn ? 0 : 1, seed: this.seed | 0, teams: this.tdm ? 1 : 0, zn: this.state === 'playing' ? this.zoneArr() : undefined, zstage: this.zs.stage, zpt: this.zombie ? this.zParts() : undefined, zev: this.zombie ? this.evacInfo() : undefined };
  }
  start() {
    this.state = 'playing'; this.timeLeft = this.matchTime();
    this.flag = { holder: null, x: FLAG_BASE.x, z: FLAG_BASE.z, groundT: 0 };
    for (const p of this.players.values()) this.resetPlayer(p);
    // katta xaritada transport joylari har jangda tasodifiy
    this.vehDefs = !this.vehOn ? [] : SH.vehiclesFor(this.zombie ? 'wild' : this.map, Math.random, this.zombie);   // transportsiz jang — ro'yxat bo'sh
    this.tk = [0, 0];
    if (this.tdm) {
      // jamoalar: lobbida tanlaganlar o'z jamoasida; tanlamaganlar kichikroq jamoaga qo'shiladi. Bir jamoa bo'sh qolsa — oxirgi o'yinchi o'sha tomonga o'tkaziladi.
      const ps = [...this.players.values()];
      for (const p of ps) p.tm = p.pick === 1 || p.pick === 2 ? p.pick : 0;
      for (const p of ps) if (!p.tm) p.tm = this.smallerTeam();
      for (const t of [1, 2]) if (ps.length > 1 && !ps.some((p) => p.tm === t)) ps[ps.length - 1].tm = t;
    }
    if (this.zombie) {
      // birinchi 4 o'yinchi — odam, qolganlari zombi bo'lib boshlaydi
      let i = 0;
      for (const p of this.players.values()) { p.zb = i++ >= Z_HUMANS; if (p.zb) p.hp = SH.Z_HP; }
    }
    this.veh = this.vehDefs.map((d, i) => this.resetVehicle({}, i));
    this.picks = Array.from({ length: SH.MAPS[this.zombie ? 'wild' : this.map].pickups }, () => ({ taken: false, holder: 0, respT: 0 }));   // har bir podvalda bitta noyob qurol
    this.items = {};   // olingan vositalar: id → qayta paydo bo'lishgacha qolgan vaqt
    // zona: butun xaritani qoplagan doiradan boshlanadi; yakuniy markaz har jangda boshqa joyda (bayroq rejimida — bayroq yonida)
    this.zone = null;
    if ((this.zoneOn || this.br) && !this.zombie) {   // (jang maydonida zona doim bor)
      const hf = SH.MAPS[this.map].half, flag = this.mode === 'flag', a = Math.random() * Math.PI * 2, d = flag ? 0 : Math.random() * hf * 0.3;
      this.zone = { hf, x: 0, z: 0, r: hf * 1.5, fx: 0, fz: 0, fr: hf * 1.5, tx: 0, tz: 0, tr: hf * 1.5, cx: Math.cos(a) * d, cz: flag ? FLAG_BASE.z : Math.sin(a) * d, i: 0, sh: 0, k: hf > 200 ? 2 : 1, t: (this.zph[0][0] / ZONE_SPEED) * (hf > 200 ? 2 : 1), dmg: 0,   /* k — katta xaritada bosqichlar ikki baravar uzoq (yurib yetib olish uchun) */ hurtT: 0, minR: flag ? 40 : this.br ? 0 : ZONE_MIN_R };
      this.zoneTarget();
    }
    // xonalardagi qurollar va noyob qurollar har jangda boshqacha joylashadi: hamma mijozlar shu urug'dan foydalanadi (sinovlarda ZJ_SEED=0 — o'zgarmas)
    this.seed = process.env.ZJ_SEED !== undefined ? +process.env.ZJ_SEED | 0 : 1 + ((Math.random() * 1e9) | 0);
    if (this.zombie) this.zs = { stage: 0, hold: 0, got: SH.WILD.parts.map(() => 0), spots: SH.wildParts(this.seed), flashT: 30 + Math.random() * 20, evac: null, callT: [] };   // qismlar joyi urug' bo'yicha (mijozlar ham shunday hisoblaydi)
    this.pendingEnd = null;
    this.broadcast(this.startMsg());
    this.lobby();
    clearInterval(this.timer);
    this.last = now();
    this.timer = setInterval(() => { const t = now(); const dt = Math.min(0.2, t - this.last); this.last = t; this.tick(dt); }, 50);
    console.log(`[${this.code}] jang boshlandi (${this.era}, ${this.mode})`);
  }
  // Zonaning navbatdagi doirasi: radius kichrayadi, markaz yakuniy markazga yaqinlashadi (yangi doira doim eskisining ichida)
  zoneTarget() {
    const z = this.zone;
    let ph = this.zph[z.i];
    // eng kichik radiusga yetib bo'lgan: keyingi bosqichlar doirani o'zgartirmaydi — ular o'tkazib yuboriladi (aks holda "zona toraymoqda" degan soxta ogohlantirish chiqardi)
    if (ph && Math.max(z.minR, ph[2] * z.hf) >= z.r - 0.5) { z.i = this.zph.length; ph = undefined; }
    if (!ph) { z.tx = z.x; z.tz = z.z; z.tr = z.r; return; }
    z.tr = Math.max(z.minR, ph[2] * z.hf);
    const k = (z.i + 1) / this.zph.length, tx = z.cx * k, tz = z.cz * k, lim = Math.max(0, z.r - z.tr), d = Math.hypot(tx - z.x, tz - z.z);
    z.tx = d > lim && d > 0 ? z.x + ((tx - z.x) / d) * lim : tx; z.tz = d > lim && d > 0 ? z.z + ((tz - z.z) / d) * lim : tz;
  }
  tickZone(dt) {
    const z = this.zone;
    if (!z) return;
    const ph = this.zph[z.i];
    if (ph) {
      z.t -= dt;
      if (z.sh) {   // toraymoqda
        const dur = (ph[1] / ZONE_SPEED) * z.k, k = Math.min(1, 1 - z.t / dur);
        z.x = z.fx + (z.tx - z.fx) * k; z.z = z.fz + (z.tz - z.fz) * k; z.r = z.fr + (z.tr - z.fr) * k;
        if (z.t <= 0) { z.x = z.tx; z.z = z.tz; z.r = z.tr; z.sh = 0; z.i++; const nx = this.zph[z.i]; z.t = nx ? (nx[0] / ZONE_SPEED) * z.k : 0; this.zoneTarget(); }
      } else if (z.t <= 0) { z.sh = 1; z.t = (ph[1] / ZONE_SPEED) * z.k; z.fx = z.x; z.fz = z.z; z.fr = z.r; z.dmg = ph[3]; this.broadcast({ t: 'zone', ev: 'shrink', i: z.i }); }
    }
    // tashqarida qolganlar har soniyada jon yo'qotadi (zirh himoya qilmaydi)
    z.hurtT -= dt;
    if (z.hurtT <= 0 && z.dmg > 0) {
      z.hurtT = 1;
      for (const p of this.players.values()) {
        if (!p.alive || p.gone || p.x === null || Math.hypot(p.x - z.x, p.z - z.z) <= z.r || p.prot > now()) continue;
        p.hp -= z.dmg; p.lastHurt = now();
        p.send({ t: 'hurt', hp: Math.max(0, Math.ceil(p.hp)), fx: null, fz: null, zone: 1 });
        if (p.hp <= 0) this.killPlayer(p, null, false, 'zone');
      }
    }
  }
  dropFlag(p) {
    const f = this.flag;
    f.holder = null; f.groundT = 0;
    if (p && p.x !== null) { f.x = p.x; f.z = p.z; }
    this.broadcast({ t: 'flag', ev: 'drop', id: p ? p.id : 0 });
  }
  tick(dt) {
    if (this.state !== 'playing') return;
    if (!(this.zombie && this.zs.evac)) this.timeLeft -= dt;   // (evakuatsiya paytida jang vaqti to'xtaydi)
    const t = now();
    for (const p of this.players.values()) {
      if (!p.alive) {
        if (p.out) continue;   // jang maydoni: halok bo'lgan o'yinchi qaytmaydi (kuzatuvchi bo'lib qoladi)
        p.respT -= dt;
        if (p.respT <= 0) {
          if (p.turn) { p.turn = false; p.zb = true; }
          p.alive = true; p.hp = p.zb ? SH.Z_HP : 100; p.lastHurt = -99; p.x = null;
          p.prot = now() + SH.SPAWN_PROT;   // qayta tug'ilgandan keyin bir necha soniya jon ketmaydi (tug'ilishi bilan o'ldirib qo'yilmasin)
          // bo — yutqazayotgan o'yinchiga beriladigan kuchli qurol darajasi (zombi rejimida yo'q)
          this.broadcast({ t: 'respawn', id: p.id, zb: p.zb ? 1 : 0, bo: this.zombie || this.gg ? 0 : comebackTier(p.ds) });
        }
      } else if (p.zb && t - p.lastHurt > 4.5 && p.hp < SH.Z_HP) p.hp = Math.min(SH.Z_HP, p.hp + 24 * dt);   // odamlarning joni o'zi tiklanmaydi — faqat aptechka/bint; zombi-o'yinchilar vosita ola olmaydi, shuning uchun ularniki tiklanadi
    }
    for (let i = 0; i < this.veh.length; i++) {
      const v = this.veh[i];
      if (!v.al) { v.respT -= dt; if (v.respT <= 0) this.resetVehicle(v, i); }
    }
    for (const pk of this.picks) if (pk.taken && !pk.holder) { pk.respT -= dt; if (pk.respT <= 0) pk.taken = false; }
    for (const id in this.items) { this.items[id] -= dt; if (this.items[id] <= 0) delete this.items[id]; }
    this.tickZone(dt);
    if (this.pendingEnd) { const w = this.pendingEnd; this.pendingEnd = null; this.end(w); return; }
    if (this.zombie && this.tickZombie(dt)) return;
    const f = this.flag;
    if (this.mode !== 'flag') { /* deathmatch va zombi — bayroq yo'q */ }
    else if (f.holder) {
      const h = this.players.get(f.holder);
      if (!h || !h.alive || h.iv >= 0) this.dropFlag(h);   // bayroq bilan transport ichida yurib bo'lmaydi
      else {
        if (h.x !== null) { f.x = h.x; f.z = h.z; }
        h.hold += dt; h.score += 10 * dt;
        if (h.hold >= HOLD_TARGET) { this.end(h); return; }
      }
    } else {
      f.groundT += dt;
      const atBase = Math.hypot(f.x - FLAG_BASE.x, f.z - FLAG_BASE.z) < 0.5;
      if (f.groundT > 25 && !atBase) { f.x = FLAG_BASE.x; f.z = FLAG_BASE.z; f.groundT = 0; this.broadcast({ t: 'flag', ev: 'return' }); }
      let best = null, bd = PICK_R;
      for (const p of this.players.values()) {
        if (!p.alive || p.gone || p.x === null || p.y > 3 || p.veh >= 0 || p.iv >= 0) continue;
        const d = Math.hypot(p.x - f.x, p.z - f.z);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) { f.holder = best.id; f.groundT = 0; this.broadcast({ t: 'flag', ev: 'take', id: best.id }); }
    }
    if (this.timeLeft <= 0) { this.end(); return; }
    this.broadcast({
      t: 's', tl: Math.max(0, this.timeLeft), f: { h: f.holder, x: f.x, z: f.z },
      zm: this.zombie ? { st: this.zs.stage, ho: +this.zs.hold.toFixed(1), host: this.hostId, pt: this.zParts(), ev: this.evacInfo() } : undefined,
      tk: this.mode === 'tdm' ? this.tk : undefined,
      zn: this.zoneArr(),   // zona: x, z, r, keyingi x, z, r, vaqt, toraymoqdami, zarar, yana torayadimi
      v: this.veh.map((v) => ({ x: v.x, y: v.y, z: v.z, yw: v.yw, pt: v.pt, rl: v.rl, ay: v.ay, ap: v.ap, hp: Math.ceil(v.hp), al: v.al, s: v.seats, ow: v.owner, rk: v.rk, rr: v.rr, ht: v.ht, oh: v.oh, tr: v.tr, fu: v.fu, aa: v.aa, ab: v.ab })),
      pk: this.picks.map((pk) => (pk.taken ? 1 : 0)),
      it: this.br ? undefined : Object.keys(this.items).map(Number),   // (jang maydonida o'lja ko'p — olingani alohida xabar bilan boradi)
      p: [...this.players.values()].map((p) => ({
        id: p.id, x: p.x, y: p.y, z: p.z, yw: p.yaw, pt: p.pitch, cr: p.cr, w: p.w, al: p.alive,
        hp: Math.ceil(p.hp), sc: Math.round(p.score), k: p.kills, d: p.deaths, ho: +p.hold.toFixed(1), vh: p.veh, se: p.seat, ch: p.ch, zb: p.zb ? 1 : 0, st: p.streak, ar: Math.ceil(p.ar || 0), tm: p.tm || undefined,
        g: this.gg ? p.gg : undefined, o: p.out ? 1 : undefined, hl: p.hl || undefined, fl: p.fl ? 1 : undefined, ev: p.ev ? 1 : undefined,
      })),
    });
  }
  // Zombi rejimi: punktlar (A → B → C → D), evakuatsiya, chaqmoq. true qaytarsa — jang tugadi.
  // Topilgan ratsiya qismlari (bit niqobi)
  zParts() { let m = 0; this.zs.got.forEach((g, i) => { if (g) m |= 1 << i; }); return m; }
  // Keyingi bosqichga o'tish (p — bosqichni bajargan o'yinchi, bo'lsa). Qaytaradi: jang tugadimi.
  zNext(p) {
    const z = this.zs, S = SH.WILD.stages;
    z.stage++;
    if (p) p.score += 150; else for (const q of this.humans()) if (q.alive) q.score += 80;
    this.broadcast({ t: 'zstage', st: z.stage, by: p ? p.id : 0 });
    if (z.stage >= S.length) { z.evac = { ph: 'arrive', t: evacT('arrive') }; this.broadcast({ t: 'zevac', ph: 'arrive', d: evacT('arrive') }); return false; }   // vertolyot uchib kelmoqda
    if (S[z.stage].k === 'hold') z.hold = Z_HOLD || S[z.stage].t;
    if (z.stage === 2) z.flashT = Math.min(z.flashT, 3);   // tun kirdi — birinchi chaqmoq tez orada
    return false;
  }
  // Zombi rejimi vazifalari (js/shared.mjs: WILD.stages): nuqtaga yetish, qismlarni topish ('zpart' xabari), nuqtani ushlab turish
  tickZombie(dt) {
    const z = this.zs, S = SH.WILD.stages, hs = this.humans().filter((p) => p.alive && p.x !== null);
    z.flashT -= dt;
    if (z.flashT <= 0) { z.flashT = 15 + Math.random() * 15; if (z.stage >= 2) this.broadcast({ t: 'flash', k: +(0.75 + Math.random() * 0.25).toFixed(2) }); }   // chaqmoq — tun kirgach
    if (z.evac) return this.tickEvac(dt);
    const c = S[z.stage];
    if (c && c.k !== 'parts') {
      const near = (r) => hs.find((p) => p.y < 6 && Math.hypot(p.x - c.x, p.z - c.z) < r);
      if (c.k === 'reach') { const p = near(c.r); if (p && this.zNext(p)) return true; }
      else if (near(c.r * 1.4)) { z.hold -= dt; if (z.hold <= 0 && this.zNext(null)) return true; }
    }
    // tirik odam qolmadi (hammasi zombiga aylangan yoki chiqib ketgan) — zombilar yutdi
    if (!this.humans().length) { this.end(null, 'zombies'); return true; }
    if (this.timeLeft <= 0) { this.end(null, 'zombies'); return true; }
    return false;
  }
  // Evakuatsiya: vertolyot qo'nadi (arrive) → tirik odamlarni kutadi (board; 'zboard' xabari bilan bortga chiqiladi) →
  // hamma tirik odam bortda bo'lsa yoki kutish vaqti tugasa — uchib ketadi (leave; mijozlarda yakuniy "kino") → jang tugaydi.
  // Bortdagilar g'olib (ev); yerda qolganlar — yutqazgan. Qaytaradi: jang tugadimi.
  tickEvac(dt) {
    const e = this.zs.evac;
    e.t -= dt;
    if (e.ph !== 'leave' && !this.humans().length) { this.end(null, 'zombies'); return true; }   // vertolyot yetib kelguncha hamma zombiga aylandi
    if (e.ph === 'arrive') { if (e.t <= 0) { e.ph = 'board'; e.t = evacT('board'); this.broadcast({ t: 'zevac', ph: 'board', d: e.t, ev: this.evIds() }); } }
    else if (e.ph === 'board') {
      const alive = this.humans().filter((p) => p.alive), on = alive.filter((p) => p.ev).length;
      if ((on && on === alive.length) || e.t <= 0) { e.ph = 'leave'; e.t = evacT('leave'); this.broadcast({ t: 'zevac', ph: 'leave', d: e.t, ev: this.evIds() }); }
    } else if (e.t <= 0) { this.end(null, this.evIds().length ? 'humans' : 'zombies'); return true; }
    return false;
  }
  evIds() { return [...this.players.values()].filter((p) => p.ev).map((p) => p.id); }
  evacInfo() { const e = this.zs.evac; return e ? { ph: e.ph, d: +Math.max(0, e.t).toFixed(1), ev: this.evIds() } : undefined; }
  // Zirh nimcha zararning bir qismini o'ziga oladi (tugaguncha). Qaytaradi: jonga yetadigan zarar.
  armored(v, dmg) {
    if (!(v.ar > 0)) return dmg;
    const a = Math.min(v.ar, dmg * SH.ARMOR_ABSORB);
    v.ar -= a;
    return dmg - a;
  }
  hit(c, o) {
    if (this.state !== 'playing' || !c.alive) return;
    c.prot = 0;   // himoyadagi o'yinchi o'zi hujum qilsa — himoyasi tugaydi
    const v = this.players.get(num(o.target));
    if (!v || !v.alive || v === c) return;
    if (v.prot > now() || v.ev) return;   // yangi tug'ilgan — himoyada; evakuatsiya vertolyotidagi odamga zarar yetmaydi
    if (this.zombie && !!v.zb === !!c.zb) return;   // odam odamga, zombi zombiga zarar bermaydi
    if (this.tdm && v.tm === c.tm) return;           // jamoaviy rejim: sherikka zarar yetmaydi
    let dmg = Math.max(0, Math.min(this.zombie && c.zb ? 50 : 1000, num(o.dmg)));
    const helm = o.head && v.hm > 0;
    if (helm) { const a = Math.min(v.hm, dmg * SH.HELM_ABSORB); v.hm -= a; dmg -= a; if (v.hm <= 0.5) { v.hm = 0; v.hl = 0; } }   // shlem boshga tekkan zararning bir qismini oladi (tugaguncha)
    v.hp -= this.armored(v, dmg); v.lastHurt = now();
    v.send({ t: 'hurt', hp: Math.max(0, Math.ceil(v.hp)), fx: c.x, fz: c.z, hl: helm ? v.hl : undefined });
    if (v.hp <= 0) this.killPlayer(v, c, o.head, o.kind, o.wn);
  }
  end(winner, side) {
    this.state = 'lobby';
    clearInterval(this.timer); this.timer = null;
    const list = [...this.players.values()];
    // jang holati tozalanadi: yakun oynasida kimdir chiqib ketsa, "bayroq tushdi" yoki "o'rin almashdi" kabi jang xabarlari yuborilmasin
    this.flag.holder = null;
    for (const p of list) { p.veh = -1; p.seat = -1; }
    for (const v of this.veh) { v.seats = v.seats.map(() => 0); v.owner = 0; }
    if (this.zombie) {
      this.broadcast({ t: 'end', winner: 0, mode: 'zombie', side: side || 'zombies', stage: this.zs.stage,
        players: list.map((p) => ({ id: p.id, name: p.name, hold: 0, score: Math.round(p.score), kills: p.kills, deaths: p.deaths, zb: p.zb ? 1 : 0, ev: p.ev ? 1 : 0 })) });
      this.lobby();
      console.log(`[${this.code}] zombi jangi tugadi. G'olib: ${side === 'humans' ? 'odamlar' : 'zombilar'}`);
      setTimeout(maybeRestart, 2500);
      return;
    }
    if (this.mode === 'tdm') {
      const team = this.forfeit || (this.tk[0] === this.tk[1] ? 0 : this.tk[0] > this.tk[1] ? 1 : 2);   // 0 — durang; forfeit — raqib jamoa chiqib ketgan
      this.forfeit = 0;
      this.broadcast({ t: 'end', winner: 0, mode: 'tdm', team, tk: this.tk,
        players: list.map((p) => ({ id: p.id, name: p.name, hold: 0, score: Math.round(p.score), kills: p.kills, deaths: p.deaths, tm: p.tm })) });
      this.lobby();
      console.log(`[${this.code}] jamoaviy jang tugadi: ${this.tk[0]} : ${this.tk[1]}`);
      setTimeout(maybeRestart, 2500);
      return;
    }
    if (this.br) for (const p of list) if (p.alive && !p.out) p.place = 1;   // vaqt tugadi: tirik qolganlar — birinchi o'rinda
    if (!winner) winner = list.slice().sort(this.gg ? (a, b) => b.gg - a.gg || b.kills - a.kills : this.br ? (a, b) => (a.place || 99) - (b.place || 99) || b.kills - a.kills
      : this.mode === 'dm' ? (a, b) => b.kills - a.kills || a.deaths - b.deaths : (a, b) => b.hold - a.hold || b.score - a.score)[0];
    this.broadcast({
      t: 'end', winner: winner ? winner.id : 0, mode: this.mode, team: this.tdm && winner ? winner.tm : undefined,
      players: list.map((p) => ({ id: p.id, name: p.name, hold: +p.hold.toFixed(1), score: Math.round(p.score), kills: p.kills, deaths: p.deaths, tm: this.tdm ? p.tm : undefined,
        gg: this.gg ? p.gg : undefined, place: this.br ? p.place || 1 : undefined })),
    });
    this.lobby();
    console.log(`[${this.code}] jang tugadi. G'olib: ${winner ? winner.name : '-'}`);
    setTimeout(maybeRestart, 2500);   // kod yangilangan bo'lsa, jang tugagach qayta ishga tushamiz
  }
}

function handle(c, o) {
  const r = c.room;
  switch (o.t) {
    case 'create': {
      if (r) return;
      new Room(o.era === 'modern' ? 'modern' : 'historical').add(c, o.name);
      break;
    }
    case 'rejoin': {   // aloqa uzilgandan keyin qaytish: xona kodi, o'yinchi raqami va kaliti mos kelishi kerak
      if (r) return;
      const room = rooms.get(String(o.code || '').toUpperCase().trim()), old = room && room.players.get(num(o.id, -1));
      if (!old || !o.key || old.key !== o.key) { c.send({ t: 'error', m: "Qayta ulanib bo'lmadi — xona yopilgan yoki kutish vaqti tugagan", fatal: 1 }); return; }
      // Server eski ulanish uzilganini hali sezmagan bo'lishi mumkin (Wi-Fi uzilishi, noutbuk uyqusi): kalit to'g'ri — eski ulanish shu yerda yopiladi
      if (!old.gone) { if (room.flag.holder === old.id) room.dropFlag(old); room.leaveSeat(old); room.releasePicks(old); }
      const stale = old.gone ? null : old;
      room.rejoin(c, old);
      if (stale) { try { stale.close(); } catch (e) { /* allaqachon yopilgan */ } }
      break;
    }
    case 'chat': {   // matnli xabar: jamoaviy rejimda — faqat jamoaga, boshqa rejimlarda — hammaga
      if (!r) return;
      const m = cleanText(o.m, 120), t = now();
      if (!m || t - (c.chatAt || 0) < 0.7) return;
      c.chatAt = t;
      const msg = { t: 'chat', id: c.id, name: c.name, m, tm: r.tdm && r.state === 'playing' ? 1 : undefined };
      for (const p of r.players.values()) if (!msg.tm || p.tm === c.tm) p.send(msg);
      break;
    }
    case 'ping': {   // xaritaga belgi qo'yish: sheriklarga ko'rsatiladi (jamoaviy rejim; zombi rejimida — o'z tomoniga)
      if (!r || r.state !== 'playing' || !c.alive) return;
      const t = now();
      if (t - (c.pingAt || 0) < 0.8 || !Array.isArray(o.p) || o.p.length !== 3 || !o.p.every(Number.isFinite)) return;
      c.pingAt = t;
      const msg = { t: 'ping', id: c.id, p: o.p.map((v) => +v.toFixed(1)) };
      for (const p of r.players.values()) if (p !== c && (r.tdm ? p.tm === c.tm : r.zombie ? !!p.zb === !!c.zb : false)) p.send(msg);
      break;
    }
    case 'join': {
      if (r) return;
      const room = rooms.get(String(o.code || '').toUpperCase().trim());
      if (!room) { c.send({ t: 'error', m: 'Bunday kodli xona topilmadi' }); return; }
      if (room.players.size >= MAX_PLAYERS) { c.send({ t: 'error', m: "Xona to'la" }); return; }
      room.add(c, o.name);
      break;
    }
    case 'era':
      if (r && r.hostId === c.id && r.state === 'lobby') { r.era = o.era === 'modern' ? 'modern' : 'historical'; r.lobby(); }
      break;
    case 'mode':
      if (r && r.hostId === c.id && r.state === 'lobby') { r.mode = SH.MODES.includes(o.mode) ? o.mode : 'flag'; r.lobby(); }
      break;
    case 'teams':   // jang maydoni va gun game: jamoa bo'lib yoki har kim o'zi uchun (xost, lobbida)
      if (r && r.hostId === c.id && r.state === 'lobby') { r.teamOn = !!o.on; r.lobby(); }
      break;
    case 'map':
      if (r && r.hostId === c.id && r.state === 'lobby') { r.map = SH.mapId(o.map); r.lobby(); }
      break;
    case 'zone':   // torayuvchi zonani yoqish/o'chirish (xost, lobbida)
      if (r && r.hostId === c.id && r.state === 'lobby') { r.zoneOn = !!o.on; r.lobby(); }
      break;
    case 'team':   // jamoaviy rejim: lobbida jamoa tanlash (1 — Qizil, 2 — Ko'k, 0 — avtomatik)
      if (r && r.state === 'lobby') { c.pick = o.tm === 1 || o.tm === 2 ? o.tm : 0; r.lobby(); }
      break;
    case 'drone':   // boshqariladigan dron: egasi joyini uzatadi (off — dron yo'q bo'ldi)
      if (r && r.state === 'playing') r.broadcast({ t: 'drone', id: c.id, off: o.off ? 1 : undefined, boom: o.boom === 2 ? 2 : o.boom ? 1 : undefined, p: Array.isArray(o.p) && o.p.length === 3 && o.p.every(Number.isFinite) ? o.p : undefined, yw: num(o.yw) }, c);
      break;
    case 'dkill': {  // raqib dronini urib tushirish: egasiga xabar beriladi (jamoadoshnikiga tegmaydi)
      if (!r || r.state !== 'playing' || !c.alive) return;
      const q = r.players.get(num(o.id));
      if (q && q !== c && !(r.tdm && q.tm === c.tm) && !(r.zombie && !!q.zb === !!c.zb)) q.send({ t: 'dkill', by: c.id });
      break;
    }
    case 'thit': {   // raqib tureliga zarar: egasiga uzatiladi (jonini egasi hisoblaydi)
      if (!r || r.state !== 'playing' || !c.alive) return;
      const q = r.players.get(num(o.id));
      if (q && q !== c && !(r.tdm && q.tm === c.tm) && !(r.zombie && !!q.zb === !!c.zb)) q.send({ t: 'thit', n: num(o.n) | 0, dmg: Math.max(0, Math.min(500, num(o.dmg))), by: c.id });
      break;
    }
    case 'veh':   // transportli / transportsiz jang
      if (r && r.hostId === c.id && r.state === 'lobby') { r.vehOn = !!o.on; r.lobby(); }
      break;
    // --- zombi rejimi: zombilarni xost (hostId) mijozi boshqaradi, server faqat uzatadi va hisobni yuritadi ---
    case 'zpart': {   // ratsiya qismini olish: joyi yonida turgan tirik odamgina oladi; hammasi topilsa — keyingi bosqich
      if (!r || !r.zombie || r.state !== 'playing' || !c.alive || c.zb || c.x === null) return;
      const z = r.zs, S = SH.WILD.stages, i = num(o.i, -1), sp = z.spots[i];
      if (z.stage >= S.length || S[z.stage].k !== 'parts' || !sp || z.got[i]) return;
      if (Math.hypot(c.x - sp[0], c.z - sp[1]) > 5 || Math.abs(c.y - sp[2]) > 3) return;
      z.got[i] = 1; c.score += 80;
      r.broadcast({ t: 'zpart', i, by: c.id });
      if (z.got.every(Boolean)) r.zNext(null);
      break;
    }
    case 'zrev': {  // defibrillyator: yerda yotgan sherikni (zombiga aylanmasidan oldin) shu joyning o'zida tiriltirish
      if (!r || !r.zombie || r.state !== 'playing' || !c.alive || c.zb || !c.df || c.x === null) return;
      const v = r.players.get(num(o.id));
      if (!v || v === c || v.alive || v.zb || !v.turn || v.dx === null || Math.hypot(c.x - v.dx, c.z - v.dz) > 4.5) return;
      c.df = 0; c.score += 100;
      v.turn = false; v.fl = false; v.alive = true; v.hp = SH.DEFIB_HP; v.lastHurt = -99; v.respT = 0; v.prot = now() + SH.SPAWN_PROT;
      v.x = v.dx; v.y = v.dy; v.z = v.dz;
      r.broadcast({ t: 'respawn', id: v.id, zb: 0, bo: 0, rv: c.id, x: v.dx, y: v.dy, z: v.dz });
      break;
    }
    case 'zcall': { // tiriltirish punkti: ratsiya orqali zombiga aylangan sherikni yana odam qilib shu punktga chaqirish
      if (!r || !r.zombie || r.state !== 'playing' || !c.alive || c.zb || c.x === null || r.zs.evac) return;
      const z = r.zs, i = num(o.i, -1), pt = SH.WILD.revive[i];
      if (!pt || z.stage < pt.from || Math.hypot(c.x - pt.x, c.z - pt.z) > 7 || now() < (z.callT[i] || 0)) return;
      const cand = [...r.players.values()].filter((p) => p.zb && p.fl && !p.gone), want = r.players.get(num(o.id));
      const v = want && cand.includes(want) ? want : cand[0];
      if (!v) return;
      z.callT[i] = now() + SH.Z_CALL_CD; c.score += 100;
      r.leaveSeat(v);
      v.zb = false; v.fl = false; v.turn = false; v.alive = true; v.hp = 100; v.ar = 0; v.hm = 0; v.hl = 0; v.df = 0; v.lastHurt = -99; v.respT = 0; v.prot = now() + SH.SPAWN_PROT;
      v.x = pt.x; v.y = 0; v.z = pt.z;
      r.broadcast({ t: 'zcall', i, by: c.id, id: v.id, cd: SH.Z_CALL_CD });
      r.broadcast({ t: 'respawn', id: v.id, zb: 0, bo: 0, cb: c.id, ri: i, x: pt.x, y: 0, z: pt.z });
      break;
    }
    case 'zboard': { // evakuatsiya: tirik odam vertolyot rampasiga yetdi — bortga chiqadi (birinchi chiqqanidan keyin qolganlarga evacT('wait') soniya qoladi)
      if (!r || !r.zombie || r.state !== 'playing' || !c.alive || c.zb || c.ev || c.x === null) return;
      const e = r.zs.evac, E = SH.WILD.evac;
      if (!e || e.ph !== 'board' || Math.hypot(c.x - E.bx, c.z - E.bz) > E.br + 2.5 || c.y > 4) return;
      c.ev = true; c.score += 200; r.leaveSeat(c);
      e.t = Math.min(e.t, evacT('wait'));
      r.broadcast({ t: 'zevac', ph: 'board', d: +e.t.toFixed(1), ev: r.evIds(), by: c.id });
      break;
    }
    case 'zs':      // zombilar holati (xostdan boshqalarga)
      if (r && r.zombie && r.state === 'playing' && c.id === r.hostId) r.broadcast({ t: 'zs', z: o.z }, c);
      break;
    case 'zhit': {  // odam zombiga o'q tekkizdi — jon hisobi xostda
      if (!r || !r.zombie || r.state !== 'playing' || !c.alive || c.zb) return;
      const h = r.players.get(r.hostId);
      if (h) h.send({ t: 'zhit', z: num(o.z), dmg: Math.max(0, Math.min(1000, num(o.dmg))), head: o.head ? 1 : 0, kind: String(o.kind || 'bullet').slice(0, 10), by: c.id });
      break;
    }
    case 'zdead': { // xost: zombi o'ldi
      if (!r || !r.zombie || r.state !== 'playing' || c.id !== r.hostId) return;
      const k = r.players.get(num(o.by));
      if (k && !k.zb) { k.kills++; k.score += 20 + (o.head ? 10 : 0); }
      r.broadcast({ t: 'zdead', z: num(o.z), by: k ? k.id : 0, head: o.head ? 1 : 0 });
      break;
    }
    case 'zatk': {  // xost: zombi odamga zarba berdi
      if (!r || !r.zombie || r.state !== 'playing' || c.id !== r.hostId) return;
      const v = r.players.get(num(o.target));
      if (!v || !v.alive || v.zb || v.prot > now() || v.ev) return;
      v.hp -= r.armored(v, Math.max(0, Math.min(40, num(o.dmg)))); v.lastHurt = now();
      v.send({ t: 'hurt', hp: Math.max(0, Math.ceil(v.hp)), fx: num(o.x, null), fz: num(o.z, null) });
      if (v.hp <= 0) r.killPlayer(v, null, false, 'zombie');
      break;
    }
    case 'venter': {
      if (!r || r.state !== 'playing' || !c.alive || c.veh >= 0 || c.x === null || c.zb) return;   // zombilar transportga o'tira olmaydi
      const v = r.veh[num(o.v, -1)];
      if (!v || !v.al || Math.hypot(c.x - v.x, c.z - v.z) > 10 || Math.abs(c.y - v.y) > 6) return;
      // o'yinchi o'rinni o'zi tanlashi mumkin (masalan, uchuvchi emas — o'qchi); band yoki noto'g'ri bo'lsa — birinchi bo'sh o'rin
      const want = Number.isInteger(o.seat) ? o.seat : -1;
      const seat = want >= 0 && want < v.seats.length && !v.seats[want] ? want : v.seats.findIndex((s) => !s);
      if (seat < 0) return;
      v.seats[seat] = c.id; c.veh = v.id; c.seat = seat;
      if (seat === 0) v.owner = c.id;
      if (r.mode === 'flag' && r.flag.holder === c.id) r.dropFlag(c);
      c.send({ t: 'vseat', v: v.id, seat });
      break;
    }
    case 'vswap': {   // transport ichida boshqa bo'sh o'ringa o'tish
      if (!r || r.state !== 'playing' || !c.alive || c.veh < 0) return;
      const v = r.veh[c.veh], seat = num(o.seat, -1);
      if (!v || !v.al || !Number.isInteger(seat) || seat < 0 || seat >= v.seats.length || v.seats[seat]) return;
      const old = c.seat;
      v.seats[seat] = c.id; c.seat = seat;
      if (v.seats[old] === c.id) v.seats[old] = 0;
      if (seat === 0) v.owner = c.id;
      c.send({ t: 'vseat', v: v.id, seat });
      if (old === 0 && seat !== 1) r.promote(v);
      break;
    }
    case 'vexit':
      if (r) r.leaveSeat(c);
      break;
    case 'v': {
      if (!r || r.state !== 'playing') return;
      const v = r.veh[num(o.id, -1)];
      if (!v || !v.al || v.owner !== c.id) return;
      v.x = num(o.x); v.y = num(o.y); v.z = num(o.z); v.yw = num(o.yw); v.pt = num(o.pt); v.rl = num(o.rl); v.ay = num(o.ay); v.ap = num(o.ap);
      if (o.rk !== undefined) { v.rk = Math.max(0, Math.min(12, num(o.rk))); v.rr = Math.max(0, num(o.rr)); v.ht = Math.max(0, Math.min(1, num(o.ht))); v.oh = o.oh ? 1 : 0; }
      if (o.fu !== undefined) { v.fu = Math.max(0, Math.min(1, num(o.fu))); v.aa = Math.max(0, num(o.aa)); v.ab = Math.max(0, num(o.ab)); }   // zombi rejimi: yoqilg'i va o'q-dori
      break;
    }
    case 'vhit':
      if (r) r.vhit(c, o);
      break;
    case 'pick': {
      if (!r || r.state !== 'playing' || !c.alive || c.zb) return;
      const pk = r.picks[num(o.id, -1)];
      if (!pk || pk.taken) return;
      r.releasePicks(c);
      pk.taken = true; pk.holder = c.id;
      r.broadcast({ t: 'pick', id: num(o.id), by: c.id });
      break;
    }
    case 'unpick':
      if (r) r.releasePicks(c);
      break;
    case 'item': {   // yerdagi vosita (aptechka, zirh ...): birinchi so'ragan oladi; jon va zirh shu yerda hisoblanadi
      if (!r || r.state !== 'playing' || !c.alive || c.zb) return;
      const id = num(o.id, -1), k = String(o.k || '');
      if (r.br) {   // jang maydoni: o'lja qaytmaydi; jon, zirh va shlem shu yerda hisoblanadi
        if (!Number.isInteger(id) || id < SH.BR_BASE || id >= SH.BR_BASE + SH.BR_MAX || r.items[id] || !SH.BR_KINDS.includes(k)) return;
        r.items[id] = 1e9;
        if (k === 'med') c.hp = 100; else if (k === 'armor') c.ar = SH.ARMOR_MAX; else if (k === 'adr') c.hp = Math.min(100, c.hp + 30);
        else if (k === 'helm') { const lv = Math.max(1, Math.min(3, num(o.lv, 1) | 0)); if (lv >= c.hl || c.hm <= 0) { c.hl = lv; c.hm = SH.BR_HELM[lv]; } }
        r.broadcast({ t: 'item', id, by: c.id });
        return;
      }
      if (!Number.isInteger(id) || id < 0 || id > 1023 || r.items[id] || !SH.ITEM_KINDS.includes(k)) return;
      if ((k === 'gun') !== (id >= SH.LOOT_BASE)) return;   // xonadagi qurollar alohida raqamlarda
      r.items[id] = r.zombie ? 1e9 : k === 'gun' ? SH.LOOT_RESPAWN : SH.ITEM_RESPAWN;   // zombi rejimida zaxira tanqis — olingan narsa qaytmaydi
      if (k === 'med') c.hp = 100; else if (k === 'armor') c.ar = SH.ARMOR_MAX; else if (k === 'adr') c.hp = Math.min(100, c.hp + 30); else if (k === 'defib') c.df = 1;
      r.broadcast({ t: 'item', id, by: c.id });
      break;
    }
    case 'heal': {   // bint bog'lash
      if (!r || r.state !== 'playing' || !c.alive || c.zb) return;
      const t = now();
      if (t - (c.healAt || 0) < 1) return;
      c.healAt = t; c.hp = Math.min(100, c.hp + Math.max(0, Math.min(60, num(o.amt))));
      break;
    }
    case 'rocket':
      if (r && r.state === 'playing') r.broadcast({ t: 'rocket', id: c.id, p: o.p, v: o.v, k: String(o.k || 'rocket').slice(0, 10),
        tg: o.tg && typeof o.tg === 'object' ? { v: Number.isInteger(o.tg.v) ? o.tg.v : undefined, p: Number.isInteger(o.tg.p) ? o.tg.p : undefined } : undefined }, c);   // tg — raketa/dron quvadigan nishon
      break;
    case 'turret':   // avtomatik turel o'rnatildi / yig'ildi (egasi hisoblaydi, boshqalarga ko'rinishi uzatiladi)
      if (r && r.state === 'playing' && c.alive && !c.zb) r.broadcast({ t: 'turret', id: c.id, n: num(o.n) | 0, off: o.off ? 1 : undefined, p: Array.isArray(o.p) && o.p.length === 3 && o.p.every(Number.isFinite) ? o.p : undefined, yw: num(o.yw) }, c);
      break;
    case 'start':
      if (!r || r.hostId !== c.id || r.state === 'playing') return;
      if (r.players.size < 2 && !r.zombie) { c.send({ t: 'error', m: "Jang uchun kamida 2 o'yinchi kerak" }); return; }   // zombi rejimini yolg'iz ham boshlasa bo'ladi
      r.start();
      break;
    case 'p':   // o'yinchi holati (cr: 1 — cho'kkalagan, 2 — yotgan)
      if (!r || !c.alive) return;
      c.x = num(o.x); c.y = num(o.y); c.z = num(o.z); c.yaw = num(o.yw); c.pitch = num(o.pt); c.cr = o.cr === 2 ? 2 : o.cr ? 1 : 0; c.w = num(o.w); c.ch = o.ch ? 1 : 0; c.iv = Number.isInteger(o.iv) ? o.iv : -1;
      break;
    case 'shot':
      c.prot = 0;   // o'q uzdi — tug'ilishdagi himoya tugadi
      if (r && r.state === 'playing' && c.alive) r.broadcast({ t: 'shot', id: c.id, a: o.a, b: o.b, s: String(o.s || 'ar').slice(0, 10) }, c);
      break;
    case 'nade':
      if (r && r.state === 'playing' && c.alive) r.broadcast({ t: 'nade', id: c.id, p: o.p, v: o.v, f: Math.max(0, Math.min(5, num(o.f))) }, c);   // f — portlashgacha qolgan vaqt (qo'lda ushlab turilgan granata)
      break;
    case 'fall': {   // balanddan parashyutsiz tushish
      if (!r || r.state !== 'playing' || !c.alive || c.prot > now() || c.ev) return;
      c.hp -= Math.max(0, Math.min(1000, num(o.dmg))); c.lastHurt = now();
      c.send({ t: 'hurt', hp: Math.max(0, Math.ceil(c.hp)), fx: null, fz: null });
      if (c.hp <= 0) r.killPlayer(c, null, false, 'fall');
      break;
    }
    case 'hit':
      if (r) r.hit(c, o);
      break;
    case 'leave':
      if (r) { c.room = null; r.leave(c); }
      break;
  }
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`\n  ${PORT}-port band. Eski serverni yoping yoki boshqa port tanlang:  PORT=8081 ./start.sh\n`);
  else console.error(e);
  process.exit(1);
});
// Umumiy jadvallar yuklangach server tinglashni boshlaydi (shared.mjs — ES modul, shuning uchun import())
import('./js/shared.mjs').then((m) => {
  SH = m;
  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n  ZAMONLAR JANGI serveri ishga tushdi\n');
    console.log(`  Shu kompyuterda:   http://localhost:${PORT}`);
    for (const ip of lanIPs()) console.log(`  Do'stingiz uchun:  http://${ip}:${PORT}`);
    console.log('\n  To\'xtatish: Ctrl+C\n');
  });
}).catch((e) => { console.error("js/shared.mjs yuklanmadi:", e); process.exit(1); });
