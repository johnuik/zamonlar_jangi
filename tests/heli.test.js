// Vertolyotlar sinovi: raketa limiti + qayta o'qlash, pulemyot qizishi, Chinuk (o'rinlar, ikkinchi uchuvchi),
// kabina oynasi orqali uchuvchini o'ldirish.
// Ishlatish: PORT=8191 node server.js   so'ng   node tests/heli.test.js
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191;
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };

async function single() {
  L('=== YAKKA REJIM');
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9360, dir: 'p_heli' });
  const { ev, shot } = pg;
  await sleep(2500);
  L('boshlash:', await ev(`(() => { const G = window.__G, D = window.__dbg; document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 9999;
    for (const s of G.soldiers) { s.alive = false; s.root.visible = false; }
    return G.vehicles.map(v => v.type + ':' + v.T.seats).join(','); })()`));
  const T = (expr, i = 0) => ev(`(() => { const G = window.__G, D = window.__dbg, v = G.vehicles[${i}], P = D.player; return ${expr}; })()`);
  const key = (code) => ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' })), window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' })), 1`);

  // --- Hujumchi vertolyot: raketa limiti ---
  await T(`(P.pos.set(-55, 0, -55.5), P.vel.set(0, 0, 0), 1)`); await sleep(300);
  await ev(`window.__dbg.tryEnterVehicle(), 1`); await sleep(300);
  ok("hujumchi vertolyot: uchuvchi", (await T(`G.inVeh.type + G.seat + ' raketa=' + v.rockets`)) === 'heli0 raketa=12');
  await T(`(P.pitch = 0.5, D.mouse.R = true, 1)`);
  for (let i = 0; i < 40 && (await T(`v.rockets`)) > 0; i++) { await sleep(250); }
  const pod0 = await T(`v.pod`);
  await sleep(1500);   // tugma hali bosiq: endi raketa chiqmasligi kerak (pod — har uchirishda almashadi)
  const r0 = await T(`[v.rockets, +v.rocketReload.toFixed(1), v.pod]`);
  ok("12 ta raketadan keyin zaxira tugadi, 15 s qayta o'qlash boshlandi", r0[0] === 0 && r0[1] > 12 && r0[1] <= 15 && r0[2] === pod0, JSON.stringify(r0));
  L('  HUD:', await ev(`document.getElementById('vehRk').textContent + ' | ' + document.getElementById('vehHint').textContent.slice(0, 60)`));
  await shot('heli_reload');
  await T(`(D.mouse.R = false, 1)`);
  // vaqtni tezlashtiramiz: qayta o'qlash tugashidan 0.5 s oldin va keyin
  const left = await T(`v.rocketReload`);
  await T(`(() => { for (let t = 0; t < ${left} - 0.6; t += 0.05) v.simulate(0.05, null); return 1; })()`);
  const mid = await T(`[v.rockets, +v.rocketReload.toFixed(2)]`);
  await sleep(900);
  const end = await T(`[v.rockets, +v.rocketReload.toFixed(2)]`);
  ok("qayta o'qlash 15 soniyada tugaydi (undan oldin 0 ta, keyin 12 ta)", mid[0] === 0 && end[0] === 12 && end[1] === 0, `oldin ${JSON.stringify(mid)} keyin ${JSON.stringify(end)}`);

  // --- Pulemyot qizishi ---
  const s0 = await T(`G.shots`);
  await T(`(P.pitch = 0.3, D.mouse.L = true, 1)`);
  // Headless brauzer sekin chizadi, shuning uchun devor soati emas, o'yin vaqti (G.time) bo'yicha kutamiz.
  // Har o'q +0.022 qizish => ~46 o'qdan keyin qizib ketadi.
  let hot = false;
  for (let i = 0; i < 80 && !hot; i++) { await sleep(250); hot = await T(`v.gun.hot`); }
  const h1 = await T(`[G.shots - ${s0}, v.gun.hot, +v.gun.heat.toFixed(2), +G.time.toFixed(2)]`);
  ok("pulemyot ~46 o'qdan keyin qizib ketdi", h1[1] === true && h1[0] >= 44 && h1[0] <= 48, JSON.stringify(h1));
  L('  HUD:', await ev(`document.getElementById('vehHeatTxt').textContent`));
  await shot('heli_overheat');
  // tugma bosiq turibdi: sovumaguncha otmasligi kerak
  let cooled = null;
  for (let i = 0; i < 80 && !cooled; i++) { await sleep(200); const r = await T(`[v.gun.hot, G.shots - ${s0}, +G.time.toFixed(2)]`); if (!r[0]) cooled = r; else if (r[1] !== h1[0]) { cooled = r; break; } }
  const coolTime = cooled ? cooled[2] - h1[3] : -1;
  ok("qizigan paytda otmaydi; sovushga ~2.9 s (o'yin vaqti) ketadi", cooled && cooled[0] === false && coolTime > 2.3 && coolTime < 3.8, `sovush vaqti=${coolTime.toFixed(2)} s, holat=${JSON.stringify(cooled)}`);
  await sleep(600);
  const h3 = await T(`(D.mouse.L = false, G.shots - ${s0})`);
  ok('sovugach yana otadi', h3 > h1[0], `yangi o'qlar=${h3 - h1[0]}`);

  // --- Oyna: old tomondan kelgan o'qlarning bir qismi uchuvchiga tegadi, orqadan — faqat vertolyotga ---
  const res = await T(`(() => { P.hp = 1e6; v.hp = 1e6;
    const f = new P.pos.constructor(v.pos.x + Math.sin(v.yaw) * 30, 1, v.pos.z + Math.cos(v.yaw) * 30), b = new P.pos.constructor(v.pos.x - Math.sin(v.yaw) * 30, 1, v.pos.z - Math.cos(v.yaw) * 30);
    let pf = 0, vf = 0, pb = 0;
    for (let i = 0; i < 300; i++) { const a = P.hp, c = v.hp; G.damagePlayer(10, f, null); if (P.hp < a) pf++; if (v.hp < c) vf++; }
    for (let i = 0; i < 300; i++) { const a = P.hp; G.damagePlayer(10, b, null); if (P.hp < a) pb++; }
    P.hp = 100; v.hp = 900; G.hurtPulse = 0; return [pf, vf, pb]; })()`);
  ok("oyna: old tomondan ~30% o'q uchuvchiga, qolgani vertolyotga; orqadan uchuvchiga 0", res[0] > 50 && res[0] < 140 && res[1] === 300 - res[0] && res[2] === 0, '[uchuvchiga, vertolyotga, orqadan uchuvchiga]=' + JSON.stringify(res));
  await ev(`window.__dbg.exitVehicle(), 1`); await sleep(300);

  // --- Chinuk ---
  await T(`(P.pos.set(52.9, 0, 54.5), P.vel.set(0, 0, 0), 1)`, 1); await sleep(400);
  L('  prompt:', await ev(`document.getElementById('prompt').textContent`));
  await ev(`window.__dbg.tryEnterVehicle(), 1`); await sleep(300);
  ok("Chinuk: uchuvchi o'rni", (await T(`G.inVeh ? G.inVeh.type + G.seat : 'yoq'`, 1)) === 'chinook0');
  await key('Digit3'); await sleep(300);
  const g0 = await T(`G.shots`, 1);
  await T(`(D.mouse.L = true, 1)`, 1);
  for (let i = 0; i < 30 && (await T(`G.shots`, 1)) - g0 < 5; i++) await sleep(200);
  await shot('chinook_gunner');
  await T(`(D.mouse.L = false, 1)`, 1);
  const gs = await T(`[G.seat, G.shots - ${g0}, G.mountVM.group.visible, +G.gunHeat.heat.toFixed(2), v.seats.map(s => s == null ? 0 : 1).join('')]`, 1);
  ok("3-tugma: chap bort o'qchisi, pulemyot otadi va qiziydi", gs[0] === 2 && gs[1] >= 4 && gs[2] === true && gs[3] > 0.05 && gs[4] === '001000', JSON.stringify(gs));
  await key('Digit5'); await sleep(300);
  const ps0 = await T(`G.shots`, 1);
  await T(`(D.mouse.L = true, D.mouse.R = true, 1)`, 1); await sleep(500); await T(`(D.mouse.L = false, D.mouse.R = false, 1)`, 1);
  ok("5-tugma: yo'lovchi, qurolsiz", (await T(`G.seat`, 1)) === 4 && (await T(`G.shots`, 1)) === ps0 && (await T(`G.projectiles.length`, 1)) === 0);
  await key('Digit1'); await sleep(300);
  ok("1-tugma: yana uchuvchi", (await T(`G.seat`, 1)) === 0);
  await ev(`Object.assign(window.__dbg.keys, { Space: true }), 1`);
  for (let i = 0; i < 80 && (await T(`v.pos.y`, 1)) < 14; i++) await sleep(250);
  await shot('chinook_fly');
  await ev(`Object.assign(window.__dbg.keys, { KeyW: true }), 1`);
  const tw = await T(`G.time`, 1);
  for (let i = 0; i < 80 && (await T(`G.time`, 1)) - tw < 4; i++) await sleep(250);
  await ev(`Object.assign(window.__dbg.keys, { Space: false, KeyW: false }), 1`);
  const cf = await T(`[+v.pos.y.toFixed(1), +Math.hypot(v.vel.x, v.vel.z).toFixed(1), G.shots - ${ps0}, v.rotor > 0.9]`, 1);
  ok('Chinuk uchdi (sekinroq, qurolsiz)', cf[0] > 12 && cf[1] > 6 && cf[1] <= 17.5 && cf[2] === 0, JSON.stringify(cf));
  await ev(`window.__dbg.exitVehicle(), 1`); await sleep(500);
  // Chinuk havoda: o'rindiqdan turgan uchuvchi yuk bo'limida qoladi (parashyut o'zi ochilmaydi)
  ok("Chinukdan chiqish: yuk bo'limida piyoda", await T(`G.platform === v && G.insideVeh === v && !G.inVeh && !G.chute`, 1));
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close();
}

async function makeBot(name, join) {
  const ws = await wsConnect(`http://localhost:${PORT}/ws`);
  const b = { ws, id: 0, code: null, state: null, events: [], pos: null, veh: null, timer: null };
  ws.on = (o) => { if (o.t === 'joined') { b.id = o.id; b.code = o.code; } else if (o.t === 's') b.state = o; else b.events.push(o); };
  b.got = (t) => b.events.filter((e) => e.t === t);
  b.send = (o) => ws.send(o);
  if (join) b.send({ t: 'join', name, code: join }); else b.send({ t: 'create', name, era: 'historical' });
  b.timer = setInterval(() => {
    if (b.pos) b.send({ t: 'p', x: b.pos[0], y: b.pos[1], z: b.pos[2], yw: 0, pt: 0, cr: 0, w: 0 });
    if (b.veh) b.send({ t: 'v', ...b.veh });
  }, 50);
  await sleep(300);
  return b;
}

async function multi() {
  L('=== TARMOQ');
  const A = await makeBot('BotA');
  const pg = await openPage(`http://localhost:${PORT}/?kod=${A.code}&ism=Ali`, { port: 9361, dir: 'p_heli2' });
  const { ev, shot } = pg;
  await sleep(2800);
  const B = await makeBot('BotB', A.code);
  A.send({ t: 'start' });
  await sleep(1800);
  // Snayper klassi: kabina oynasi orqali uchuvchini bir o'q bilan yiqitish uchun
  await ev(`(() => { const G = window.__G; window.__dbg.pickSelect(2); document.getElementById('pause').classList.add('hidden'); G.state = 'playing'; return 1; })()`);
  const st = () => A.state;
  const cid = () => st().p.find((p) => p.id !== A.id && p.id !== B.id).id;
  const pl = (id) => st().p.find((p) => p.id === id);
  ok('server: 0-hujumchi (4 o\'rin, 12 raketa), 1-Chinuk (6 o\'rin)', st().v[0].s.length === 4 && st().v[0].rk === 12 && st().v[1].s.length === 6 && A.got('start')[0].veh[1].type === 'chinook');

  // --- Kabina oynasi orqali uchuvchini o'ldirish ---
  A.pos = [30, 0, 0];
  B.pos = [-55, 0, -55.5]; await sleep(300);
  B.send({ t: 'venter', v: 0 }); await sleep(400);
  ok('BotB hujumchi vertolyot uchuvchisi', st().v[0].s[0] === B.id);
  B.pos = [-58, 0.8, -56.4];
  await ev(`(() => { const p = window.__dbg.player; p.pos.set(-50, 0, -50); p.vel.set(0,0,0); p.yaw = Math.PI / 4; p.pitch = 0.021; window.__dbg.mouse.R = true; return 1; })()`);
  await sleep(1200);
  await shot('glass_aim');
  const wh = await ev(`(() => { const G = window.__G, v = G.vehicles[0], V3 = G.player.pos.constructor;
    const f = new V3(Math.sin(v.yaw), 0, Math.cos(v.yaw));
    const front = v.windowHit(new V3(v.pos.x + f.x * 12, 1.8, v.pos.z + f.z * 12), f.clone().multiplyScalar(-1), 50);
    const back = v.windowHit(new V3(v.pos.x - f.x * 12, 1.8, v.pos.z - f.z * 12), f.clone(), 50);
    const r = G.soldiers.find(s => s.team === 'remote' && s.veh === v);
    return [front ? front.seat : -1, back ? back.seat : -1, r ? r.root.visible : null, r ? r.hidden : null]; })()`);
  ok("oyna zonasi: old tomondan — uchuvchi, orqadan — yo'q; uchuvchi kabinada ko'rinadi", wh[0] === 0 && wh[1] === -1 && wh[2] === true && wh[3] === true, JSON.stringify(wh));
  // snayper tanaga ikki o'qda o'ldiradi: ikkinchi o'q oldidan nishon qayta to'g'rilanadi (tepki ko'tarib yuborgan)
  await ev(`(() => { const G = window.__G, D = window.__dbg; G.switchT = 0; G.fireT = 0; D.tryFire(); return 1; })()`);
  await sleep(500);
  const kHalf = A.got('kill').length, hpHalf = pl(B.id).hp;
  await ev(`(() => { const G = window.__G, D = window.__dbg, p = D.player; G.recoilAcc = 0; p.yaw = Math.PI / 4; p.pitch = 0.021; G.fireT = 0; D.tryFire(); D.mouse.R = false; return 1; })()`);
  await sleep(700);
  const k1 = A.got('kill');
  ok("snayper: oynadan birinchi o'q uchuvchini yaraladi (o'ldirmadi)", kHalf === 0 && hpHalf <= 35 && hpHalf >= 25, 'jon=' + hpHalf);
  ok("oynaga otilgan ikkinchi o'q uchuvchini o'ldirdi, vertolyot shikastlanmadi", k1.length === 1 && k1[0].victim === B.id && k1[0].killer === cid() && st().v[0].hp === 900 && st().v[0].al && !st().v[0].s[0], JSON.stringify(k1) + ' heli hp=' + st().v[0].hp);
  L('  chrome killfeed:', await ev(`document.getElementById('killfeed').innerText.replace(/\\n/g,' | ')`));

  // --- Raketa/qizish holati serverga yetadimi ---
  await ev(`(() => { const p = window.__dbg.player; p.pos.set(-55, 0, -55.5); p.vel.set(0,0,0); return 1; })()`); await sleep(400);
  await ev(`window.__dbg.tryEnterVehicle(), 1`); await sleep(500);
  await ev(`(() => { const D = window.__dbg; D.player.pitch = 0.5; D.mouse.R = true; D.mouse.L = true; return 1; })()`); await sleep(1000);
  await ev(`(() => { const D = window.__dbg; D.mouse.R = false; D.mouse.L = false; return 1; })()`); await sleep(300);
  ok('raketa soni va qizish serverda', st().v[0].s[0] === cid() && st().v[0].rk === 10 && st().v[0].ht > 0.1, `rk=${st().v[0].rk} ht=${st().v[0].ht}`);
  await ev(`window.__dbg.exitVehicle(), 1`);
  await sleep(4200);   // BotB qayta tug'iladi

  // --- Chinuk: ikki uchuvchi, boshqaruvning avtomatik o'tishi ---
  A.pos = [54, 0, 54]; B.pos = [54, 0, 55]; await sleep(300);
  A.send({ t: 'venter', v: 1 }); await sleep(300);
  await ev(`(() => { const p = window.__dbg.player; p.pos.set(52.9, 0, 54.5); p.vel.set(0,0,0); return 1; })()`); await sleep(400);
  await ev(`window.__dbg.tryEnterVehicle(), 1`); await sleep(500);
  B.send({ t: 'venter', v: 1 }); await sleep(400);
  ok("o'rinlar: BotA uchuvchi, Chrome ikkinchi uchuvchi, BotB bort o'qchisi", JSON.stringify(st().v[1].s) === JSON.stringify([A.id, cid(), B.id, 0, 0, 0]) && (await ev(`window.__G.inVeh.type + window.__G.seat`)) === 'chinook1', JSON.stringify(st().v[1].s));
  // BotA Chinukni ko'taradi
  A.veh = { id: 1, x: 58, y: 0, z: 58, yw: (-Math.PI * 3) / 4, pt: 0, rl: 0, ay: 0, ap: 0 };
  for (let i = 0; i < 50; i++) { A.veh.y = Math.min(25, A.veh.y + 0.6); A.pos = [58, A.veh.y + 1.3, 58]; B.pos = [58, A.veh.y + 1, 58]; await sleep(50); }
  await sleep(600);
  const before = await ev(`(() => { const G = window.__G, v = G.vehicles[1]; return [+v.pos.y.toFixed(1), G.seat, v.owner, +G.player.pos.y.toFixed(1)]; })()`);
  await shot('chinook_copilot');
  // uchuvchi halok bo'ladi
  B.send({ t: 'hit', target: A.id, dmg: 300, head: false, kind: 'bullet' });
  A.veh = null;
  await sleep(900);
  const after = await ev(`(() => { const G = window.__G, v = G.vehicles[1]; return [G.seat, v.owner, document.getElementById('cmTitle').innerText, v.alive, +v.pos.y.toFixed(1)]; })()`);
  ok("uchuvchi halok bo'ldi -> ikkinchi uchuvchi boshqaruvni avtomatik oldi", after[0] === 0 && after[1] === cid() && /BOSHQARUV/.test(after[2]) && st().v[1].ow === cid() && st().v[1].s[0] === cid() && st().v[1].s[1] === 0 && !pl(A.id).al, `oldin ${JSON.stringify(before)} keyin ${JSON.stringify(after)} server=${JSON.stringify(st().v[1].s)}`);
  await sleep(1500);
  const y1 = st().v[1].y;
  await ev(`Object.assign(window.__dbg.keys, { Space: true }), 1`); await sleep(2000);
  await ev(`Object.assign(window.__dbg.keys, { Space: false }), 1`); await sleep(300);
  ok("Chinuk qulamadi, yangi uchuvchi uni ko'tardi", st().v[1].al && y1 > 20 && st().v[1].y > y1 + 4, `y ${y1} -> ${st().v[1].y}`);
  await shot('chinook_promoted');
  // o'rin almashtirish (server)
  B.send({ t: 'vswap', seat: 4 }); await sleep(300);
  ok("server: BotB yo'lovchi o'rniga o'tdi", st().v[1].s[2] === 0 && st().v[1].s[4] === B.id && pl(B.id).se === 4, JSON.stringify(st().v[1].s));
  clearInterval(A.timer); clearInterval(B.timer);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close(); A.ws.close(); B.ws.close();
}

(async () => {
  await single();
  await multi();
  L(fails ? `YAKUN: ${fails} ta xato` : "YAKUN: hammasi o'tdi");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
