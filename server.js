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
const fileHash = () => { try { return crypto.createHash('sha1').update(fs.readFileSync(__filename)).digest('hex').slice(0, 12); } catch (e) { return ''; } };
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
const MATCH_TIME = 480;      // jang davomiyligi (soniya)
const HOLD_TARGET = 90;      // g'alaba uchun bayroqni ushlab turish vaqti (soniya)
const RESPAWN = 4;           // qayta tug'ilish (soniya)
const FLAG_BASE = { x: 0, z: 2 };
const PICK_R = 1.8;
const MAX_PLAYERS = 8;
const DM_TARGET = +process.env.DM_TARGET || 15;        // deathmatch: g'alaba uchun o'ldirishlar soni
const VEH_RESPAWN = 40;      // yo'q qilingan transport qayta paydo bo'lishi (soniya)
const PICKUP_RESPAWN = 15;   // noyob qurol podvalga qaytishi (soniya)
const N_PICKUPS = 4;
// Transport joylashuvi (js/world.js dagi VEHICLE_SPAWNS bilan bir xil)
const VEHICLES = [
  { type: 'heli', x: -58, z: -58, yaw: Math.PI / 4 },
  { type: 'chinook', x: 58, z: 58, yaw: (-Math.PI * 3) / 4 },
  { type: 'jeep', x: 58, z: -50, yaw: -Math.PI / 2 },
  { type: 'quad', x: -58, z: 50, yaw: Math.PI / 2 },
  { type: 'cannon', x: -14, z: -18, yaw: 0 },
  { type: 'cannon', x: 14, z: 18, yaw: Math.PI },
  { type: 'tank', x: -62, z: 0, yaw: Math.PI / 2 },
  { type: 'ltank', x: 62, z: 0, yaw: -Math.PI / 2 },
  { type: 'truck', x: 0, z: -58, yaw: 0 },
];
// ---------- Katta xarita va zombi rejimi (js/world.js dagi BIG_PADS, BIG_POINTS, randomVehicles bilan bir xil) ----------
const VEH_TYPES = ['heli', 'chinook', 'jeep', 'quad', 'cannon', 'cannon', 'tank', 'ltank', 'truck'];
const BIG_PADS = [
  [-102, -102, Math.PI / 4], [102, 102, (-Math.PI * 3) / 4], [102, -102, -Math.PI / 4], [-102, 102, (Math.PI * 3) / 4],
  [0, -104, 0], [0, 104, Math.PI], [-104, 0, Math.PI / 2], [104, 0, -Math.PI / 2],
  [-64, -64, Math.PI / 4], [64, 64, (-Math.PI * 3) / 4], [64, -64, -Math.PI / 4], [-64, 64, (Math.PI * 3) / 4],
  [-20, -74, Math.PI / 2], [20, 74, -Math.PI / 2], [-74, 22, 0], [74, -22, Math.PI],
];
const BIG_POINTS = [{ id: 'A', x: -98, z: 98 }, { id: 'B', x: -56, z: 8 }, { id: 'C', x: 20, z: -62 }, { id: 'D', x: 98, z: -72 }];
function randomVehicles(zombie) {
  const pads = BIG_PADS.filter((p) => !zombie || BIG_POINTS.every((q) => Math.hypot(q.x - p[0], q.z - p[1]) > 16));
  for (let i = pads.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pads[i]; pads[i] = pads[j]; pads[j] = t; }
  return VEH_TYPES.map((type, i) => ({ type, x: pads[i][0], z: pads[i][1], yaw: pads[i][2] }));
}
// Kuchayib ketgan o'yinchi: 3-ketma-ket o'ldirishdan boshlab har biri uchun +8% ko'proq zarar oladi (40% gacha); o'lsa — nolga qaytadi
const handicap = (streak) => 1 + Math.min(0.4, 0.08 * Math.max(0, streak - 2));
const Z_HUMANS = 4;          // zombi rejimi: odam bo'lib o'ynaydiganlar soni (qolganlar zombi bo'lib qo'shiladi)
const Z_TIME = 900;          // zombi rejimi davomiyligi (soniya) — ulgurmasa, zombilar yutadi
const Z_HOLD = +process.env.Z_HOLD || 45;   // D punktini ushlab turish (evakuatsiya) vaqti (sinovlar uchun qisqartirsa bo'ladi)
const Z_POINT_R = 8;
const Z_HP = 60;             // zombi-o'yinchining joni (oson o'ladi)
const VEH_HP = { heli: 900, chinook: 2100, jeep: 600, quad: 300, cannon: 1500, tank: 1000, ltank: 650, truck: 1000 };
const VEH_SEATS = { heli: 4, chinook: 6, jeep: 2, quad: 2, cannon: 1, tank: 2, ltank: 2, truck: 2 };   // chinook: 2 uchuvchi, 2 o'qchi, 2 yo'lovchi

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon',
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
    res.writeHead(200, { 'Content-Type': MIME[ext], 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------- Minimal WebSocket (RFC 6455) ----------
class Client {
  constructor(sock) {
    this.sock = sock; this.buf = Buffer.alloc(0); this.frag = []; this.open = true; this.room = null;
    sock.on('data', (d) => this.onData(d));
    sock.on('close', () => this.onClose());
    sock.on('error', () => this.onClose());
  }
  onData(d) {
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
    this.open = false;
    if (this.room) { const r = this.room; this.room = null; r.leave(this); }
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

function genCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = ''; for (let i = 0; i < 4; i++) c += A[crypto.randomInt(A.length)]; } while (rooms.has(c));
  return c;
}

class Room {
  constructor(era) {
    this.code = genCode(); this.era = era; this.players = new Map(); this.hostId = null; this.state = 'lobby';
    this.mode = 'flag'; this.map = 'town'; this.vehDefs = VEHICLES; this.veh = []; this.picks = []; this.pendingEnd = null;
    this.zs = { stage: 0, hold: Z_HOLD, flashT: 12 };   // zombi rejimi holati
    this.flag = { holder: null, x: FLAG_BASE.x, z: FLAG_BASE.z, groundT: 0 };
    this.timer = null; this.timeLeft = MATCH_TIME;
    rooms.set(this.code, this);
  }
  resetPlayer(p) {
    p.hp = 100; p.alive = true; p.score = 0; p.kills = 0; p.deaths = 0; p.hold = 0; p.respT = 0; p.lastHurt = -99;
    p.x = null; p.y = 0; p.z = null; p.yaw = 0; p.pitch = 0; p.cr = 0; p.w = 0; p.ch = 0; p.veh = -1; p.seat = -1; p.iv = -1;
    p.streak = 0;   // o'lmasdan ketma-ket o'ldirishlar
    p.zb = false; p.turn = false;   // zb — zombi-o'yinchimi; turn — o'lgach zombiga aylanadi (faqat zombi rejimida)
  }
  get zombie() { return this.mode === 'zombie'; }
  // zombi rejimi: tirik odamlar
  humans() { return [...this.players.values()].filter((p) => !p.zb); }
  resetVehicle(v, i) {
    const d = this.vehDefs[i];
    Object.assign(v, { id: i, type: d.type, x: d.x, y: 0, z: d.z, yw: d.yaw, pt: 0, rl: 0, ay: d.yaw, ap: 0, hp: VEH_HP[d.type], al: true, seats: new Array(VEH_SEATS[d.type]).fill(0), owner: 0, respT: 0,
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
  killPlayer(v, killer, head, kind) {
    if (!v.alive) return;
    v.alive = false; v.hp = 0; v.deaths++; v.respT = RESPAWN; v.streak = 0;
    if (killer && killer !== v) killer.streak++;
    this.leaveSeat(v); this.releasePicks(v);
    const carrier = this.mode === 'flag' && this.flag.holder === v.id;
    if (killer && killer !== v) { killer.kills++; killer.score += (this.zombie && killer.zb ? 200 : 100) + (head ? 50 : 0) + (carrier ? 50 : 0); }
    if (this.zombie && !v.zb) v.turn = true;   // halok bo'lgan odam zombi bo'lib qayta tug'iladi
    if (carrier) this.dropFlag(v);
    this.broadcast({ t: 'kill', killer: killer && killer !== v ? killer.id : 0, victim: v.id, head: !!head, kind: String(kind || 'bullet').slice(0, 10) });
    if (this.mode === 'dm' && killer && killer !== v && killer.kills >= DM_TARGET) this.pendingEnd = killer;
  }
  vhit(c, o) {
    if (this.state !== 'playing') return;
    const v = this.veh[num(o.v, -1)];
    if (!v || !v.al) return;
    v.hp -= Math.max(0, Math.min(3000, num(o.dmg)));
    v.tr |= num(o.tr) & 3;
    if (v.hp > 0) return;
    v.al = false; v.hp = 0; v.respT = VEH_RESPAWN;
    const occ = v.seats.filter(Boolean).map((id) => this.players.get(id)).filter(Boolean);
    // yuk bo'limida piyoda turganlar ham (o'rindiqsiz) transport bilan birga halok bo'ladi
    for (const p of this.players.values()) if (p.alive && p.iv === v.id && !occ.includes(p)) occ.push(p);
    v.seats = v.seats.map(() => 0); v.owner = 0;
    this.broadcast({ t: 'vboom', v: v.id, by: c.id });
    const inside = occ.includes(c);
    for (const p of occ) this.killPlayer(p, inside ? null : c, false, 'vehicle');
  }
  add(c, name) {
    c.id = nextId++; c.name = cleanName(name); c.room = this;
    let n = 2; const base = c.name;
    while ([...this.players.values()].some((p) => p.name === c.name)) c.name = base.slice(0, 13) + ' ' + n++;
    this.resetPlayer(c);
    this.players.set(c.id, c);
    if (!this.hostId) this.hostId = c.id;
    c.send({ t: 'joined', id: c.id, name: c.name, code: this.code, era: this.era });
    if (this.state === 'playing' && this.zombie) { c.zb = true; c.hp = Z_HP; }   // jang ketayotganda qo'shilgan o'yinchi — zombi
    this.lobby();
    if (this.state === 'playing') c.send(this.startMsg());
    console.log(`[${this.code}] ${c.name} qo'shildi (${this.players.size} o'yinchi)`);
  }
  leave(c) {
    if (!this.players.delete(c.id)) return;
    if (this.flag.holder === c.id) this.dropFlag(c);
    this.leaveSeat(c); this.releasePicks(c);
    const heir = this.players.size ? this.players.keys().next().value : 0;
    for (const v of this.veh) if (v.owner === c.id) v.owner = heir;
    if (this.hostId === c.id) this.hostId = this.players.size ? this.players.keys().next().value : null;
    this.broadcast({ t: 'left', id: c.id, name: c.name });
    console.log(`[${this.code}] ${c.name} chiqdi`);
    if (!this.players.size) { clearInterval(this.timer); rooms.delete(this.code); maybeRestart(); return; }
    if (this.state === 'playing' && this.players.size < 2 && !this.zombie) this.end();   // zombi rejimida yolg'iz odam ham davom etadi
    this.lobby();
  }
  lobby() {
    this.broadcast({ t: 'lobby', code: this.code, era: this.era, mode: this.mode, map: this.zombie ? 'big' : this.map, host: this.hostId, state: this.state,
      players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name })) });
  }
  broadcast(o, except) {
    const s = JSON.stringify(o);
    for (const p of this.players.values()) if (p !== except) p.sendRaw(s);
  }
  startMsg() {
    return { t: 'start', era: this.era, mode: this.mode, map: this.zombie ? 'big' : this.map, holdTarget: HOLD_TARGET, dmTarget: DM_TARGET, matchTime: this.zombie ? Z_TIME : MATCH_TIME,
      base: FLAG_BASE, veh: this.vehDefs, zhold: Z_HOLD, zstage: this.zs.stage };
  }
  start() {
    this.state = 'playing'; this.timeLeft = this.zombie ? Z_TIME : MATCH_TIME;
    this.flag = { holder: null, x: FLAG_BASE.x, z: FLAG_BASE.z, groundT: 0 };
    for (const p of this.players.values()) this.resetPlayer(p);
    // katta xaritada transport joylari har jangda tasodifiy
    const big = this.zombie || this.map === 'big';
    this.vehDefs = big ? randomVehicles(this.zombie) : VEHICLES;
    if (this.zombie) {
      // birinchi 4 o'yinchi — odam, qolganlari zombi bo'lib boshlaydi
      let i = 0;
      for (const p of this.players.values()) { p.zb = i++ >= Z_HUMANS; if (p.zb) p.hp = Z_HP; }
      this.zs = { stage: 0, hold: Z_HOLD, flashT: 8 + Math.random() * 8 };
    }
    this.veh = this.vehDefs.map((d, i) => this.resetVehicle({}, i));
    this.picks = Array.from({ length: big ? N_PICKUPS * 2 : N_PICKUPS }, () => ({ taken: false, holder: 0, respT: 0 }));   // katta xaritada 8 ta podval
    this.pendingEnd = null;
    this.broadcast(this.startMsg());
    this.lobby();
    clearInterval(this.timer);
    this.last = now();
    this.timer = setInterval(() => { const t = now(); const dt = Math.min(0.2, t - this.last); this.last = t; this.tick(dt); }, 50);
    console.log(`[${this.code}] jang boshlandi (${this.era}, ${this.mode})`);
  }
  dropFlag(p) {
    const f = this.flag;
    f.holder = null; f.groundT = 0;
    if (p && p.x !== null) { f.x = p.x; f.z = p.z; }
    this.broadcast({ t: 'flag', ev: 'drop', id: p ? p.id : 0 });
  }
  tick(dt) {
    if (this.state !== 'playing') return;
    this.timeLeft -= dt;
    const t = now();
    for (const p of this.players.values()) {
      if (!p.alive) {
        p.respT -= dt;
        if (p.respT <= 0) {
          if (p.turn) { p.turn = false; p.zb = true; }
          p.alive = true; p.hp = p.zb ? Z_HP : 100; p.lastHurt = -99; p.x = null;
          this.broadcast({ t: 'respawn', id: p.id, zb: p.zb ? 1 : 0 });
        }
      } else if (t - p.lastHurt > 4.5 && p.hp < (p.zb ? Z_HP : 100)) p.hp = Math.min(p.zb ? Z_HP : 100, p.hp + 24 * dt);
    }
    for (let i = 0; i < this.veh.length; i++) {
      const v = this.veh[i];
      if (!v.al) { v.respT -= dt; if (v.respT <= 0) this.resetVehicle(v, i); }
    }
    for (const pk of this.picks) if (pk.taken && !pk.holder) { pk.respT -= dt; if (pk.respT <= 0) pk.taken = false; }
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
        if (!p.alive || p.x === null || p.y > 3 || p.veh >= 0 || p.iv >= 0) continue;
        const d = Math.hypot(p.x - f.x, p.z - f.z);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) { f.holder = best.id; f.groundT = 0; this.broadcast({ t: 'flag', ev: 'take', id: best.id }); }
    }
    if (this.timeLeft <= 0) { this.end(); return; }
    this.broadcast({
      t: 's', tl: Math.max(0, this.timeLeft), f: { h: f.holder, x: f.x, z: f.z },
      zm: this.zombie ? { st: this.zs.stage, ho: +this.zs.hold.toFixed(1), host: this.hostId } : undefined,
      v: this.veh.map((v) => ({ x: v.x, y: v.y, z: v.z, yw: v.yw, pt: v.pt, rl: v.rl, ay: v.ay, ap: v.ap, hp: Math.ceil(v.hp), al: v.al, s: v.seats, ow: v.owner, rk: v.rk, rr: v.rr, ht: v.ht, oh: v.oh, tr: v.tr, fu: v.fu, aa: v.aa, ab: v.ab })),
      pk: this.picks.map((pk) => (pk.taken ? 1 : 0)),
      p: [...this.players.values()].map((p) => ({
        id: p.id, x: p.x, y: p.y, z: p.z, yw: p.yaw, pt: p.pitch, cr: p.cr, w: p.w, al: p.alive,
        hp: Math.ceil(p.hp), sc: Math.round(p.score), k: p.kills, d: p.deaths, ho: +p.hold.toFixed(1), vh: p.veh, se: p.seat, ch: p.ch, zb: p.zb ? 1 : 0, st: p.streak,
      })),
    });
  }
  // Zombi rejimi: punktlar (A → B → C → D), evakuatsiya, chaqmoq. true qaytarsa — jang tugadi.
  tickZombie(dt) {
    const z = this.zs, hs = this.humans().filter((p) => p.alive && p.x !== null);
    z.flashT -= dt;
    if (z.flashT <= 0) { z.flashT = 15 + Math.random() * 15; this.broadcast({ t: 'flash', k: +(0.75 + Math.random() * 0.25).toFixed(2) }); }
    const tp = BIG_POINTS[Math.min(3, z.stage + 1)];
    const near = (r) => hs.find((p) => p.y < 6 && Math.hypot(p.x - tp.x, p.z - tp.z) < r);
    if (z.stage < 3) {
      const p = near(Z_POINT_R);
      if (p) { z.stage++; p.score += 150; this.broadcast({ t: 'zstage', st: z.stage, by: p.id }); }
    } else if (near(Z_POINT_R * 1.6)) {
      z.hold -= dt;
      if (z.hold <= 0) { this.end(null, 'humans'); return true; }
    }
    // tirik odam qolmadi (hammasi zombiga aylangan yoki chiqib ketgan) — zombilar yutdi
    if (!this.humans().length) { this.end(null, 'zombies'); return true; }
    if (this.timeLeft <= 0) { this.end(null, 'zombies'); return true; }
    return false;
  }
  hit(c, o) {
    if (this.state !== 'playing' || !c.alive) return;
    const v = this.players.get(num(o.target));
    if (!v || !v.alive || v === c) return;
    if (this.zombie && !!v.zb === !!c.zb) return;   // odam odamga, zombi zombiga zarar bermaydi
    let dmg = Math.max(0, Math.min(this.zombie && c.zb ? 50 : 1000, num(o.dmg)));
    if (!this.zombie) dmg = Math.round(dmg * handicap(v.streak));   // ketma-ket ko'p o'ldirgan o'yinchiga ko'proq zarar yetadi
    v.hp -= dmg; v.lastHurt = now();
    v.send({ t: 'hurt', hp: Math.max(0, Math.ceil(v.hp)), fx: c.x, fz: c.z });
    if (v.hp <= 0) this.killPlayer(v, c, o.head, o.kind);
  }
  end(winner, side) {
    this.state = 'lobby';
    clearInterval(this.timer); this.timer = null;
    const list = [...this.players.values()];
    if (this.zombie) {
      this.broadcast({ t: 'end', winner: 0, mode: 'zombie', side: side || 'zombies', stage: this.zs.stage,
        players: list.map((p) => ({ id: p.id, name: p.name, hold: 0, score: Math.round(p.score), kills: p.kills, deaths: p.deaths, zb: p.zb ? 1 : 0 })) });
      this.lobby();
      console.log(`[${this.code}] zombi jangi tugadi. G'olib: ${side === 'humans' ? 'odamlar' : 'zombilar'}`);
      setTimeout(maybeRestart, 2500);
      return;
    }
    if (!winner) winner = list.slice().sort(this.mode === 'dm' ? (a, b) => b.kills - a.kills || a.deaths - b.deaths : (a, b) => b.hold - a.hold || b.score - a.score)[0];
    this.broadcast({
      t: 'end', winner: winner ? winner.id : 0, mode: this.mode,
      players: list.map((p) => ({ id: p.id, name: p.name, hold: +p.hold.toFixed(1), score: Math.round(p.score), kills: p.kills, deaths: p.deaths })),
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
      if (r && r.hostId === c.id && r.state === 'lobby') { r.mode = o.mode === 'dm' || o.mode === 'zombie' ? o.mode : 'flag'; r.lobby(); }
      break;
    case 'map':
      if (r && r.hostId === c.id && r.state === 'lobby') { r.map = o.map === 'big' ? 'big' : 'town'; r.lobby(); }
      break;
    // --- zombi rejimi: zombilarni xost (hostId) mijozi boshqaradi, server faqat uzatadi va hisobni yuritadi ---
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
      if (!v || !v.alive || v.zb) return;
      v.hp -= Math.max(0, Math.min(40, num(o.dmg))); v.lastHurt = now();
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
    case 'rocket':
      if (r && r.state === 'playing') r.broadcast({ t: 'rocket', id: c.id, p: o.p, v: o.v, k: String(o.k || 'rocket').slice(0, 10) }, c);
      break;
    case 'start':
      if (!r || r.hostId !== c.id || r.state === 'playing') return;
      if (r.players.size < 2 && !r.zombie) { c.send({ t: 'error', m: "Jang uchun kamida 2 o'yinchi kerak" }); return; }   // zombi rejimini yolg'iz ham boshlasa bo'ladi
      r.start();
      break;
    case 'p':
      if (!r || !c.alive) return;
      c.x = num(o.x); c.y = num(o.y); c.z = num(o.z); c.yaw = num(o.yw); c.pitch = num(o.pt); c.cr = o.cr ? 1 : 0; c.w = num(o.w); c.ch = o.ch ? 1 : 0; c.iv = Number.isInteger(o.iv) ? o.iv : -1;
      break;
    case 'shot':
      if (r && r.state === 'playing' && c.alive) r.broadcast({ t: 'shot', id: c.id, a: o.a, b: o.b, s: String(o.s || 'ar').slice(0, 10) }, c);
      break;
    case 'nade':
      if (r && r.state === 'playing' && c.alive) r.broadcast({ t: 'nade', id: c.id, p: o.p, v: o.v, f: Math.max(0, Math.min(5, num(o.f))) }, c);   // f — portlashgacha qolgan vaqt (qo'lda ushlab turilgan granata)
      break;
    case 'fall': {   // balanddan parashyutsiz tushish
      if (!r || r.state !== 'playing' || !c.alive) return;
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
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ZAMONLAR JANGI serveri ishga tushdi\n');
  console.log(`  Shu kompyuterda:   http://localhost:${PORT}`);
  for (const ip of lanIPs()) console.log(`  Do'stingiz uchun:  http://${ip}:${PORT}`);
  console.log('\n  To\'xtatish: Ctrl+C\n');
});
