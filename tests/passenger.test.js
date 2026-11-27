// Transportda o'z qurolidan otish (yo'lovchi o'rinlari, o'qchining g'ildirak bilan almashtirishi), kichik vertolyotning to'rt o'rni,
// transportda o'z personajini ko'rish, balans: snayper (boshga 1 o'q, tanaga 2 o'q) va tank joni.
// Ishlatish: PORT=8191 node server.js   so'ng   node tests/passenger.test.js [historical|modern]
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191, era = process.argv[2] || 'modern';
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };
const KEY = (code) => `window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' })), window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' })), 1`;
const WHEEL = (d) => `window.dispatchEvent(new WheelEvent('wheel', { deltaY: ${d} })), 1`;

async function single() {
  L(`=== YAKKA REJIM (${era})`);
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9451, dir: 'p_pass' });
  const { ev, shot } = pg;
  await sleep(2500);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, K = D.keys, HV = G.vehicles[0]; return ${body}; })()`);
  const until = async (cond, ms = 8000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  await ev(`(() => { localStorage.removeItem('zj_view'); localStorage.removeItem('zj_class'); return 1; })()`);
  await ev(`location.reload(), 1`); await sleep(2500);
  await ev(`(() => { const G = window.__G, D = window.__dbg; document.querySelectorAll('.era').forEach(e => { if (e.dataset.era === '${era}') e.click(); }); document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 99999; G.bannerT = 0.01; D.player.hp = 1e9;
    for (const s of G.soldiers) { s.alive = false; s.root.visible = false; } return 1; })()`);
  await sleep(500);
  // balans
  const bal = await T(`[G.vehicles[6].T.hp, G.vehicles[7].T.hp, HV.T.seats, HV.T.roles.join(','), G.weapons[0].def.id]`);
  ok("tank joni kamaytirilgan (og'ir 1000, yengil 650); kichik vertolyotda 4 o'rin", bal[0] === 1000 && bal[1] === 650 && bal[2] === 4 && bal[3] === 'pilot,gunner,pass,pass', JSON.stringify(bal));
  // snayper: tanaga ikki o'q, boshga bir o'q
  await T(`(D.setClass(2), D.applyLoadout(), G.switchT = 0, P.pos.set(0, 0, 36), 1)`);
  const sn = await T(`(() => { const V3 = P.pos.constructor, d = new V3(0, 0, 1), W = G.weapons[0].def, out = [];
    for (const y of [1.2, 1.86]) { D.spawnEnemy('rifle'); const s = G.soldiers[G.soldiers.length - 1]; s.update = () => {}; s.pos.set(0, 0, 60); s.root.position.copy(s.pos); const hp0 = s.hp;
      D.hitscan(new V3(0, y, 40), d, W); const a = [s.alive, Math.round(hp0 - s.hp)]; D.hitscan(new V3(0, y, 40), d, W); out.push([hp0, a[0], a[1], s.alive]); s.alive = false; s.root.visible = false; }
    return [W.dmg, W.head, out]; })()`);
  ok("snayper: tanaga birinchi o'q o'ldirmaydi, ikkinchisi o'ldiradi; boshga — bitta o'q", sn[2][0][1] === true && sn[2][0][3] === false && sn[2][1][1] === false, JSON.stringify(sn));
  const amr = await T(`G.specials.find(x => x.id === 'amr').dmg`);
  ok("noyob snayper (tankbuzar) kuchi o'zgarmagan", amr === 260, 'zarar=' + amr);
  await T(`(D.setClass(0), D.applyLoadout(), G.switchT = 0, 1)`);

  // chap eshikdagi yo'lovchi: o'z quroli qo'lda, otadi, mo'ljalga oladi, o'qlaydi
  await T(`(D.enterVehicle(HV, 2), 1)`); await sleep(500);
  const p0 = await T(`[G.seat, D.vehFP(), D.ownGunActive(), G.weapons[G.wi].def.id, G.weapons[G.wi].vm.group.visible, G.mountVM.group.visible, document.getElementById('vehHint').textContent]`);
  ok("yo'lovchi o'rni: 1-shaxs, o'z quroli qo'lda (bort pulemyoti emas), eslatmada yozilgan", p0[0] === 2 && p0[1] && p0[2] && p0[3] === 'ar' && p0[4] === true && p0[5] === false && /O'z qurolingiz/.test(p0[6]) && /g'ildirak/.test(p0[6]), p0[6].slice(0, 110));
  // 18 m naridagi dushman: o'z transportimiz o'qni to'smaydi
  const hit = await T(`(() => { const V3 = P.pos.constructor; D.spawnEnemy('rifle'); const s = G.soldiers[G.soldiers.length - 1]; s.update = () => {};
    const e = HV.eyePos(2, new V3()); s.pos.set(-52, 0, -40); s.root.position.copy(s.pos); G.foe = s;   // xarita ichkarisida (vertolyotning chap tomoni chegara devoriga qaragan)
    const tp = s.getAimPoint(new V3()); P.yaw = Math.atan2(-(tp.x - e.x), -(tp.z - e.z)); P.pitch = Math.atan2(tp.y - e.y, Math.hypot(tp.x - e.x, tp.z - e.z)); G.switchT = 0; G.fireT = 0; return [s.hp, G.weapons[0].mag]; })()`);
  await sleep(300);
  // mo'ljalga olib otamiz (bel balandligidan otilgan o'qlar 18 m da tarqalib ketadi) va zarba tekkuncha kutamiz
  await T(`(D.mouse.R = true, 1)`); await until(`G.ads >= 1`);
  await T(`(D.mouse.L = true, 1)`); await until(`G.foe.hp < ${hit[0]} || G.weapons[0].mag < 12`); await T(`(D.mouse.L = false, D.mouse.R = false, 1)`);
  await until(`G.ads <= 0`);
  const hit2 = await T(`[G.foe.hp, G.weapons[0].mag, HV.hp === HV.T.hp]`);
  ok("yo'lovchi o'z avtomatidan otadi: dushmanga tegadi, o'z vertolyotiga zarar yetmaydi", hit2[0] < hit[0] && hit2[1] < hit[1] && hit2[2] === true, `dushman joni ${hit[0]} → ${Math.round(hit2[0])}, o'qdon ${hit[1]} → ${hit2[1]}`);
  await T(`(D.mouse.R = true, 1)`); await until(`G.ads >= 1`); await sleep(200);
  const ads = await T(`[+D.camera.fov.toFixed(0), G.weapons[0].def.adsFov * D.settings.fov / 80, D.camera.position.distanceTo(HV.eyePos(2, P.pos.clone())) < 0.2]`);
  await shot(`pass_${era}_ads`);
  await T(`(D.mouse.R = false, 1)`); await until(`G.ads <= 0`);
  await ev(KEY('KeyR')); await sleep(200);
  const rel = await T(`G.reloadT > 0`);
  await until(`G.reloadT <= 0 && G.weapons[0].mag === G.weapons[0].def.mag`, 9000);
  ok("yo'lovchi: o'ng tugma — mo'ljal (yaqinlashadi), R — o'qlash", Math.abs(ads[0] - ads[1]) <= 1 && ads[2] && rel && (await T(`G.weapons[0].mag === G.weapons[0].def.mag`)), `FOV ${ads[0]}`);
  await ev(WHEEL(100)); await sleep(700);
  const wsw = await T(`[G.weapons[G.wi].def.id, D.ownGunActive()]`);
  ok("g'ildirak — o'z qurollari orasida almashtiradi (to'pponcha)", wsw[0] === 'pistol' && wsw[1] === true, JSON.stringify(wsw));
  // 3-shaxs: personaj ko'rinadi, otish yo'q
  await ev(KEY('KeyV')); await sleep(400);
  const tp3 = await T(`(() => { const s0 = G.shots; return [D.vehFP(), G.avatar.root.visible, +G.avatar.root.position.distanceTo(HV.seatPos(2, P.pos.clone())).toFixed(2), D.ownGunActive(), document.getElementById('vehHint').textContent]; })()`);
  await T(`(G.fireT = 0, D.mouse.L = true, 1)`); await sleep(400); await T(`(D.mouse.L = false, 1)`);
  ok("3-shaxs ko'rinishida o'z personajimiz o'rindiqda ko'rinadi; otish uchun 1-shaxs kerakligi yozilgan", tp3[0] === false && tp3[1] === true && tp3[2] < 0.05 && tp3[3] === false && /1-shaxsga o'ting/.test(tp3[4]), JSON.stringify(tp3.slice(0, 4)));
  await shot(`pass_${era}_tp`);
  await ev(KEY('KeyV')); await sleep(300);
  // o'ng eshik (4-o'rin) va o'qchi (2-o'rin): g'ildirak bort pulemyoti ↔ o'z quroli
  await ev(KEY('Digit4')); await sleep(400);
  const s4 = await T(`[G.seat, D.ownGunActive(), HV.T.seatNames[G.seat]]`);
  await ev(KEY('Digit2')); await sleep(400);
  const g0 = await T(`[G.seat, D.ownGunActive(), G.mountVM.group.visible, document.getElementById('vehHint').textContent]`);
  await ev(WHEEL(100)); await sleep(700);
  const g1 = await T(`[D.ownGunActive(), G.mountVM.group.visible, G.weapons[G.wi].vm.group.visible, G.weapons[G.wi].def.id, document.getElementById('vehHint').textContent]`);
  const m0 = await T(`(G.switchT = 0, G.fireT = 0, G.weapons[G.wi].mag)`);
  await T(`(D.mouse.L = true, 1)`); await until(`G.weapons[G.wi].mag < ${m0}`); await T(`(D.mouse.L = false, 1)`);
  const heat = await T(`G.gunHeat.heat`);
  await ev(WHEEL(-100)); await sleep(500);
  const g2 = await T(`[D.ownGunActive(), G.mountVM.group.visible]`);
  ok("o'ng eshik o'rni ham o'z qurolidan otadi", s4[0] === 3 && s4[1] === true, s4[2]);
  ok("o'qchi: g'ildirak bort pulemyotidan o'z quroliga va orqaga o'tkazadi", g0[0] === 1 && g0[1] === false && g0[2] === true && /G'ildirak/.test(g0[3]) && g1[0] === true && g1[1] === false && g1[2] === true && heat < 0.01 && g2[0] === false && g2[1] === true,
    `${g1[3]} · "${g1[4].slice(0, 90)}"`);
  await T(`(D.exitVehicle(), 1)`); await sleep(400);
  // o'z personajimiz har bir transportda (3-shaxs) ko'rinadi
  const av = await T(`(() => { const out = []; for (const [id, seat] of [[0, 0], [1, 0], [2, 0], [2, 1], [3, 0], [4, 0], [6, 0], [6, 1], [7, 0], [8, 0], [8, 1]]) { const v = G.vehicles[id]; D.enterVehicle(v, seat);
      if (D.vehFP()) D.toggleVehView(); D.tick(0.03); const e = v.seatPos(seat, P.pos.clone()); out.push([v.type + seat, G.avatar.root.visible === (v.skin ? v.seatShown(seat) || !v.T.enclosed : true), +G.avatar.root.position.distanceTo(e).toFixed(2), G.avatar.sit === true, G.avatar.root.visible]);
      if (seat !== 0 || false) D.toggleVehView(); D.exitVehicle(); } return out; })()`);
  // (haqiqiy model qo'yilgan tankda haydovchi korpus ichida — tashqaridan ko'rinmaydi; qolgan hamma o'rinda o'z joyida ko'rinadi)
  ok("o'z personaji transportlarda o'rindiq joyida ko'rinadi (tank haydovchisi — ichkarida)", av.length === 11 && av.every((a) => a[1] === true && (!a[4] || a[2] < 0.05)), av.map((a) => a[0] + (a[4] ? (a[3] ? ':o\'tirgan' : ':tik') : ':ichkarida')).join(' '));
  await T(`(localStorage.removeItem('zj_view'), G.viewPref = {}, 1)`);
  await T(`(D.enterVehicle(G.vehicles[6], 0), P.yaw = G.vehicles[6].yaw + Math.PI + 0.9, P.pitch = -0.25, 1)`); await sleep(600);
  await shot(`pass_${era}_tank_avatar`);
  await T(`(D.exitVehicle(), D.enterVehicle(G.vehicles[2], 0), P.yaw = G.vehicles[2].yaw + Math.PI + 0.8, P.pitch = -0.3, 1)`); await sleep(600);
  await shot(`pass_${era}_jeep_avatar`);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close();
}

async function multi() {
  L('=== TARMOQ');
  const bot = await wsConnect(`http://localhost:${PORT}/ws`);
  let code = null, botId = 0, state = null; const events = [];
  bot.on = (o) => { if (o.t === 'joined') { code = o.code; botId = o.id; } else if (o.t === 's') state = o; else events.push(o); };
  let bp = [-52, 0, -40];
  const iv = setInterval(() => bot.send({ t: 'p', x: bp[0], y: bp[1], z: bp[2], yw: 0, pt: 0, cr: 0, w: 0 }), 50);
  bot.send({ t: 'create', name: 'Bot', era });
  await sleep(300);
  const pg = await openPage(`http://localhost:${PORT}/?kod=${code}&ism=Ali`, { port: 9452, dir: 'p_pass2' });
  const { ev } = pg;
  await sleep(2800);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, HV = G.vehicles[0]; return ${body}; })()`);
  const until = async (cond, ms = 8000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  bot.send({ t: 'start' });
  await sleep(1800);
  await T(`(D.pickSelect(0), G.state = 'playing', 1)`);
  const me = () => state.p.find((p) => p.id !== botId);
  ok('server: kichik vertolyotda 4 o\'rin, tanklar joni 1000 / 650', state.v[0].s.length === 4 && state.v[6].hp === 1000 && state.v[7].hp === 650, JSON.stringify([state.v[0].s, state.v[6].hp, state.v[7].hp]));
  await T(`(P.pos.set(-55, 0, -55.5), P.vel.set(0, 0, 0), 1)`); await sleep(500);
  await T(`(G.net.send({ t: 'venter', v: 0, seat: 2 }), 1)`); await until(`G.inVeh === HV && G.seat === 2`); await sleep(300);
  ok('server chap eshik o\'rnini berdi', JSON.stringify(state.v[0].s) === `[0,0,${me().id},0]` && me().se === 2, JSON.stringify(state.v[0].s));
  // yo'lovchi vertolyotdan o'z qurolidan botga otadi: bot zarar ko'radi, vertolyot butun
  const hp0 = state.p.find((p) => p.id === botId).hp;
  await sleep(400);
  await T(`(() => { const V3 = P.pos.constructor, e = HV.eyePos(2, new V3()), r = G.soldiers.find(s => s.team === 'remote'); const tp = r.getAimPoint(new V3());
    P.yaw = Math.atan2(-(tp.x - e.x), -(tp.z - e.z)); P.pitch = Math.atan2(tp.y - e.y, Math.hypot(tp.x - e.x, tp.z - e.z)); G.switchT = 0; G.fireT = 0; D.mouse.R = true; return 1; })()`);
  await until(`G.ads >= 1`); await sleep(200);
  await T(`(D.mouse.L = true, 1)`);
  for (let i = 0; i < 40 && state.p.find((p) => p.id === botId).hp >= hp0; i++) await sleep(100);
  await T(`(D.mouse.L = false, D.mouse.R = false, 1)`);
  await sleep(300);
  const hp1 = state.p.find((p) => p.id === botId).hp, shots = events.filter((e) => e.t === 'shot').length;
  ok("tarmoq: vertolyotdagi yo'lovchining o'qi raqibga tegadi va boshqalarga ko'rinadi", hp1 < hp0 && shots > 0 && state.v[0].hp === 900, `raqib joni ${hp0} → ${hp1}, o'q izlari ${shots}`);
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
