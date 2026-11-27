// Torayuvchi zona (tarmoq): doira bosqichma-bosqich kichrayadi, tashqarida qolgan o'yinchi jon yo'qotadi va halok bo'ladi,
// sahifada devor/xabar/ogohlantirish ko'rinadi, qayta tug'ilish zona ichida; lobbida o'chirsa — zona bo'lmaydi.
// Ishlatish: PORT=8191 ZJ_MAP=town ZJ_ZONE=1 ZONE_SPEED=12 node server.js   so'ng   node tests/zone.test.js
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191;
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };

(async () => {
  const mk = async () => { const w = await wsConnect(`http://localhost:${PORT}/ws`); const b = { w, ev: [], code: null, id: 0, state: null, lobby: null, pos: [0, 0, 0] };
    w.on = (o) => { if (o.t === 'joined') { b.code = o.code; b.id = o.id; } else if (o.t === 's') b.state = o; else if (o.t === 'lobby') b.lobby = o; else b.ev.push(o); }; return b; };
  const wait = async (fn, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (fn()) return true; await sleep(100); } return false; };
  const A = await mk();
  A.w.send({ t: 'create', name: 'Bot', era: 'modern' }); await sleep(300);
  A.w.send({ t: 'mode', mode: 'dm' }); await sleep(200);
  ok('lobbida zona yoqilgan', A.lobby && A.lobby.zone === 1 && A.lobby.mode === 'dm', JSON.stringify(A.lobby && [A.lobby.mode, A.lobby.zone]));
  const pg = await openPage(`http://localhost:${PORT}/?kod=${A.code}&ism=Ali`, { port: 9521, dir: 'p_zone' });
  const { ev, shot } = pg;
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player; return ${body}; })()`);
  await sleep(1500);
  const rules = await ev(`[document.querySelector('.lobbyZone.sel') && document.querySelector('.lobbyZone.sel').dataset.v, /Zona:/.test(document.getElementById('lobbyRules').innerText)]`);
  ok("lobbida zona tugmasi belgilangan va qoidasi yozilgan", rules[0] === '1' && rules[1] === true, JSON.stringify(rules));
  A.pos = [66, 0, 66];   // bot xarita burchagida — zona torayganda tashqarida qoladi
  const iv = setInterval(() => A.w.send({ t: 'p', x: A.pos[0], y: A.pos[1], z: A.pos[2], yw: 0, pt: 0, cr: 0, w: 0 }), 50);
  A.w.send({ t: 'start' }); await sleep(2000);
  await T(`(D.pickSelect(0), G.state = 'playing', P.pos.set(0, 0, 9), P.vel.set(0, 0, 0), 1)`); await sleep(500);
  const z0 = A.state.zn, me = () => A.state.p.find((p) => p.id !== A.id), bot = () => A.state.p.find((p) => p.id === A.id);
  ok("jang boshida zona butun xaritani qoplaydi (radius ≈ 105 m), hali toraymayapti", Array.isArray(z0) && z0[2] > 100 && z0[7] === 0 && z0[9] === 1, JSON.stringify(z0));
  const h0 = await T(`[!!G.zone, document.getElementById('zoneInfo').textContent, getComputedStyle(document.getElementById('zoneInfo')).display, G.zoneOut]`);
  ok("sahifa: zona holati va ekrandagi xabar ko'rinadi", h0[0] === true && /torayadi/.test(h0[1]) && h0[2] === 'block' && h0[3] === false, JSON.stringify(h0));
  // torayish boshlanadi
  await wait(() => A.state.zn[7] === 1, 9000);
  const r1 = A.state.zn[2]; await sleep(1200); const r2 = A.state.zn[2];
  const b1 = await T(`[document.getElementById('cmTitle').textContent, document.getElementById('zoneInfo').className]`);
  ok("zona toraya boshlaydi: radius kichrayadi, sahifada ogohlantirish chiqadi", A.ev.some((e) => e.t === 'zone' && e.ev === 'shrink') && r2 < r1 && /ZONA TORAYMOQDA/.test(b1[0]), `r ${r1} → ${r2} · ${JSON.stringify(b1)}`);
  // toraya turgan paytda qayta tug'ilish: 40 marta — har safar keyingi (oq) doira ichida, ya'ni torayib bo'lgach ham xavfsiz joyda
  const rsp = await T(`(() => { const Z = G.zone, hp = P.hp, bad = []; let n = 0;
    for (let i = 0; i < 40; i++) { D.respawnMe(); n++; const d = Math.hypot(P.pos.x - Z.tx, P.pos.z - Z.tz), dc = Math.hypot(P.pos.x - Z.sx, P.pos.z - Z.sz); if (d > Z.tr || dc > Z.sr || !D.inSafe(P.pos.x, P.pos.z)) bad.push([+P.pos.x.toFixed(1), +P.pos.z.toFixed(1), +d.toFixed(1)]); }
    P.pos.set(0, 0, 9); P.vel.set(0, 0, 0); return [n, bad.length, Z.sh, +Z.tr.toFixed(1), +Z.sr.toFixed(1), JSON.stringify(bad.slice(0, 3))]; })()`);
  ok("toraya turgan zonada qayta tug'ilish (40 marta): doim keyingi doira ichida", rsp[0] === 40 && rsp[1] === 0 && rsp[2] === true && rsp[3] < rsp[4], JSON.stringify(rsp));
  // burchakdagi bot tashqarida qoladi: jon yo'qotadi va oxiri halok bo'ladi
  await wait(() => bot().hp < 100, 9000);
  const hb = bot().hp;
  await wait(() => A.ev.some((e) => e.t === 'kill' && e.victim === A.id && e.kind === 'zone'), 30000);
  const kz = A.ev.find((e) => e.t === 'kill' && e.victim === A.id);
  ok("zonadan tashqaridagi o'yinchi jon yo'qotadi va halok bo'ladi (hech kim o'ldirmagan)", hb < 100 && !!kz && kz.kind === 'zone' && kz.killer === 0, `jon=${hb} ${JSON.stringify(kz)}`);
  A.pos = [A.state.zn[3], 0, A.state.zn[4]];   // bot endi doira markazida turadi
  // sahifa: markazda — xavfsiz; tashqariga chiqsa — ogohlantirish va jon ketadi
  await T(`(P.pos.set(${A.state.zn[0]}, 0, ${A.state.zn[1]} + 3), P.vel.set(0, 0, 0), 1)`); await sleep(600);
  const in0 = await T(`[G.zoneOut, +document.getElementById('zoneTint').style.opacity]`), hpIn = me().hp;
  await T(`(P.pos.set(66, 0, -66), P.vel.set(0, 0, 0), 1)`); await sleep(1500);
  const out0 = await T(`[G.zoneOut, +document.getElementById('zoneTint').style.opacity > 0.2, document.getElementById('zoneInfo').className, document.getElementById('zoneInfo').textContent]`);
  await shot('zone_out');
  await wait(() => me().hp < hpIn, 4000);
  ok("sahifa: doira ichida xavfsiz; tashqarida — qizil ogohlantirish, ko'k parda va jon ketadi", in0[0] === false && in0[1] === 0 && out0[0] === true && out0[1] === true && out0[2] === 'out' && /TASHQARIDASIZ/.test(out0[3]) && me().hp < hpIn, JSON.stringify([in0, out0, hpIn, me().hp]));
  // tashqarida qolib halok bo'ladi → zona ichida qayta tug'iladi
  await wait(() => !me().al, 30000);
  await wait(() => me().al, 9000); await sleep(900);
  const rs = await T(`[+P.pos.x.toFixed(1), +P.pos.z.toFixed(1), P.alive]`), zn = A.state.zn, dist = Math.hypot(rs[0] - zn[0], rs[1] - zn[1]);
  ok("qayta tug'ilish zona ichida", rs[2] === true && dist < zn[2], `joy=${rs[0]},${rs[1]} masofa=${dist.toFixed(1)} radius=${zn[2]}`);
  // oxirgi doira: kichik, lekin belgilangan chegaradan kichraymaydi
  await wait(() => A.state.zn[9] === 0, 40000);
  const zf = A.state.zn;
  ok("oxirgi doira: 24 m dan kichraymaydi, markazi xarita ichida", zf[2] >= 23.9 && zf[2] <= 27 && Math.abs(zf[0]) < 70 && Math.abs(zf[1]) < 70 && zf[9] === 0, JSON.stringify(zf));
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })), 1`); await sleep(500); await shot('zone_map');
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })), 1`);
  // oxirgi (eng kichik) doirada 40 marta qayta tug'ilish — hammasi ichkarida va to'siq ichida emas
  const rsf = await T(`(() => { const Z = G.zone, V3 = P.pos.constructor; let bad = 0, box = 0;
    for (let i = 0; i < 40; i++) { D.respawnMe(); if (Math.hypot(P.pos.x - Z.sx, P.pos.z - Z.sz) > Z.sr) bad++; if (G.world.pointInBox(new V3(P.pos.x, P.pos.y + 1, P.pos.z))) box++; }
    return [bad, box, +Z.sr.toFixed(1), G.world.spawns.filter((s) => D.inSafe(s.x, s.z, 6)).length]; })()`);
  ok("oxirgi doirada qayta tug'ilish (40 marta): doim ichkarida, to'siq ichida emas", rsf[0] === 0 && rsf[1] === 0, JSON.stringify(rsf));
  // jang o'rtasida qo'shilgan (sahifani yangilagan) o'yinchi: zona holati darhol keladi va u torayib bo'lgan doira ichida paydo bo'ladi
  const B2 = await mk();
  B2.w.send({ t: 'join', name: 'Kech', code: A.code }); await sleep(500);
  const st2 = B2.ev.find((e) => e.t === 'start');
  ok("jang o'rtasida qo'shilganga zona holati 'start' xabarida keladi", !!st2 && Array.isArray(st2.zn) && st2.zn[2] <= 27, JSON.stringify(st2 && st2.zn));
  B2.w.close();
  await ev(`(location.reload(), 1)`).catch(() => {});
  let lj = null;
  for (let i = 0; i < 150 && !lj; i++) { await sleep(200); lj = await ev(`(() => { const G = window.__G, D = window.__dbg; return G && D && G.mp && G.world && G.zone && G.scene ? [+D.player.pos.x.toFixed(1), +D.player.pos.z.toFixed(1), +G.zone.sr.toFixed(1), +G.zone.sx.toFixed(1), +G.zone.sz.toFixed(1)] : null; })()`).catch(() => null); }
  const ljd = lj ? Math.hypot(lj[0] - lj[3], lj[1] - lj[4]) : 999;
  ok("sahifani yangilab qayta kirgan o'yinchi ham zona ichida paydo bo'ladi", !!lj && ljd < lj[2], JSON.stringify([lj, +ljd.toFixed(1)]));
  // zona bor jangda avtomatik turel yo'q: yerda ham ko'rinmaydi va olinmaydi, yutqazayotgan o'yinchiga yordam sifatida ham berilmaydi (dron beriladi)
  const zt = await ev(`(() => { const G = window.__G, D = window.__dbg, tp = G.pickups.filter((p) => p.def && p.def.id === 'turret');
    const P = D.player; let near = null; if (tp[0]) { P.pos.set(tp[0].pos.x, tp[0].pos.y - 1.2, tp[0].pos.z); near = D.nearestPickup ? D.nearestPickup() : null; }
    const n0 = G.weapons.length; D.giveComeback(2); const got = G.weapons.length > n0 ? G.weapons[G.weapons.length - 1].def.id : null;
    return [tp.length, tp.every((p) => !p.mesh.visible), near && near.def ? near.def.id : null, got]; })()`);
  ok("zona bor jangda avtomatik turel yo'q (yerda ko'rinmaydi, yordam sifatida dron beriladi)", zt[0] > 0 && zt[1] === true && zt[2] !== 'turret' && zt[3] === 'drone', JSON.stringify(zt));
  clearInterval(iv);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close(); A.w.close();
  // zonasiz jang: lobbida o'chirilsa — holatda zona bo'lmaydi
  const C = await mk(), D2 = await mk();
  C.w.send({ t: 'create', name: 'C', era: 'modern' }); await sleep(300);
  C.w.send({ t: 'mode', mode: 'dm' }); C.w.send({ t: 'zone', on: 0 }); await sleep(200);
  D2.w.send({ t: 'join', name: 'D', code: C.code }); await sleep(300);
  C.w.send({ t: 'start' }); await sleep(800);
  ok("lobbida o'chirilsa — zonasiz jang", C.lobby.zone === 0 && !!C.state && C.state.zn === undefined, JSON.stringify([C.lobby.zone, C.state && C.state.zn]));
  C.w.close(); D2.w.close();
  L(fails ? `YAKUN: ${fails} ta xato` : "YAKUN: hammasi o'tdi");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
