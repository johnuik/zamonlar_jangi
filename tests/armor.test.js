// Tank zirhi (orqa/yon/yonish/gusenitsa), ikki xil tank, kvadrotsikl, o'rin tanlash, qo'lda ochiladigan parashyut,
// balanddan yiqilish, Chinuk ichida yurish.
// Ishlatish: PORT=8191 node server.js   so'ng   node tests/armor.test.js
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191;
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };
const until = async (fn, ms = 12000, step = 200) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await sleep(step); } return v; };

async function single() {
  L('=== YAKKA REJIM');
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9390, dir: 'p_armor' });
  const { ev, shot } = pg;
  await sleep(2500);
  L('boshlash:', await ev(`(() => { const G = window.__G, D = window.__dbg; document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 99999;
    for (const s of G.soldiers) { s.alive = false; s.root.visible = false; }
    return G.vehicles.map(v => v.type + ':' + v.T.hp).join(','); })()`));
  // T: ifoda ichida G, D, P va H (og'ir tank), LT (yengil tank), CH (Chinuk), V3 mavjud
  const T = (expr) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, H = G.vehicles[6], LT = G.vehicles[7], CH = G.vehicles[1], V3 = P.pos.constructor; return ${expr}; })()`);
  const key = (code) => ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' })), window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' })), 1`);
  const keys = (o) => ev(`Object.assign(window.__dbg.keys, ${JSON.stringify(o)}), 1`);
  const gtime = () => T(`G.time`);
  const waitGame = async (sec) => { const t0 = await gtime(); await until(async () => (await gtime()) - t0 >= sec, 30000, 150); };
  const types = await T(`G.vehicles.map(v => v.type).join(',')`);
  ok('transport: jip + kvadrotsikl, og\'ir + yengil tank, Chinuk joni 2100', types === 'heli,chinook,jeep,quad,cannon,cannon,tank,ltank,truck' && (await T(`CH.T.hp`)) === 2100, types);

  // --- Zirh: old va orqa ---
  const place = (x, z, yaw) => T(`(H.pos.set(${x}, 0, ${z}), H.yaw = ${yaw}, H.aimYaw = ${yaw}, H.speed = 0, H.hp = 1000, H.setTracks(0), 1)`);
  await place(-40, 0, Math.PI / 2);   // tank +x tomonga qaragan
  const fireAt = async (px, pz, yaw) => {
    await T(`(P.pos.set(${px}, 0, ${pz}), P.vel.set(0, 0, 0), P.yaw = ${yaw}, P.pitch = -0.04, D.mouse.R = true, 1)`);
    await waitGame(0.6);
    const h0 = await T(`H.hp`);
    await T(`(G.switchT = 0, G.fireT = 0, G.reloadT = 0, G.weapons[0].mag = 5, D.tryFire(), D.mouse.R = false, 1)`);
    await sleep(150);
    return h0 - (await T(`H.hp`));
  };
  const dFront = await fireAt(-30, 0, Math.PI / 2);     // oldidan
  const dRear = await fireAt(-50, 0, -Math.PI / 2);     // orqasidan
  // kutilgan zarar qo'ldagi qurolga bog'liq: old zirh 0.5 × 0.08, orqa zirh 0.5 × 0.5 (yonguncha)
  const wd = await T(`G.weapons[0].def.dmg`), about = (v, e) => Math.abs(v - e) <= Math.max(1.01, e * 0.12);
  ok("orqadan o'q old tomondagidan ancha ko'p jon oladi", about(dFront, wd * 0.04) && about(dRear, wd * 0.25) && dRear > dFront * 4, `qurol zarari=${wd} · old=${dFront.toFixed(1)} orqa=${dRear.toFixed(1)}`);
  await T(`(H.hp = 290, 1)`);   // yonish darajasidan past (300)
  const dRearBurn = await fireAt(-50, 0, -Math.PI / 2);
  ok("yonish darajasidan keyin orqa ham oddiy zirhdek (tez jon ketishi faqat yonguncha)", about(dRearBurn, wd * 0.04) && (await T(`H.burning`)) === true, `orqa (yonayotgan)=${dRearBurn.toFixed(1)}`);

  // --- Yonayotgan tank yurmaydi, lekin minora va pushka ishlaydi ---
  await T(`(P.pos.set(-40, 0, 4), 1)`); await sleep(300);
  await ev(`window.__dbg.tryEnterVehicle(), 1`); await sleep(300);
  ok("og'ir tankka o'tirildi", (await T(`G.inVeh === H && G.seat === 0`)) === true);
  await keys({ KeyW: true }); await waitGame(2);
  const burnMove = await T(`[+H.pos.x.toFixed(2), H.immobile, document.getElementById('vehName').textContent]`);
  await T(`(P.yaw += 1.2, 1)`); await waitGame(1.5);
  const tur = await T(`+Math.abs(H.aimYaw - H.yaw).toFixed(2)`);
  ok('yonayotgan tank yurmaydi, minorasi buriladi', Math.abs(burnMove[0] + 40) < 0.3 && burnMove[1] === true && /YONMOQDA.*YURMAYDI/.test(burnMove[2]) && tur > 0.8, JSON.stringify(burnMove) + ' minora=' + tur);
  await shot('armor_burning');
  await T(`(H.hp = 1000, 1)`); await waitGame(2);
  const okMove = await T(`+H.pos.x.toFixed(1)`);
  await keys({ KeyW: false });
  ok('tuzalgan tank yana yuradi', okMove > -38, 'x=' + okMove);
  await ev(`window.__dbg.exitVehicle(), 1`); await sleep(300);

  // --- Yengil tank: boshqa tur; yondan pushka -> gusenitsa, orqadan pushka -> yonadi ---
  await T(`(LT.pos.set(-62, 0, 0), LT.yaw = Math.PI / 2, LT.aimYaw = Math.PI / 2, P.pos.set(-62, 0, 3.6), P.vel.set(0, 0, 0), 1)`); await sleep(400);
  await ev(`window.__dbg.tryEnterVehicle(), 1`); await sleep(300);
  ok("yengil tank: alohida tur (tezroq, 650 jon, tez otar pushka)", (await T(`G.inVeh === LT && LT.T.name + '|' + LT.T.hp + '|' + LT.T.tank.max + '|' + LT.T.tank.reload`)) === 'Yengil tank|650|14|1.3');
  const shoot = async () => { await T(`(P.yaw = -Math.PI / 2, P.pitch = -0.1, G.vAltT = 0, 1)`); await waitGame(1.2); await T(`(D.mouse.L = true, 1)`); await sleep(200); await T(`(D.mouse.L = false, 1)`); await waitGame(0.6); };
  await place(-40, 0, 0);            // og'ir tank +z ga qaragan: g'arbdan kelgan snaryad YONiga tegadi
  await shoot();
  const side = await T(`[H.trackBroken, Math.round(H.hp), H.immobile, H.burning, H.trackDrop[1].visible, H.trackMesh[1][0].visible]`);
  ok("yonga tekkan snaryad gusenitsani uzdi, tank yurmaydi (yonmayapti)", side[0] === 2 && side[1] < 1000 && side[1] > 600 && side[2] === true && side[3] === false && side[4] === true && side[5] === false, JSON.stringify(side));
  await shot('armor_track');
  await place(-40, 0, Math.PI / 2);  // endi orqasi bilan turibdi
  await shoot();
  const rear = await T(`[H.trackBroken, Math.round(H.hp), H.burning, H.immobile]`);
  ok("orqaga tekkan snaryad tankni darhol yondirdi", rear[0] === 0 && rear[1] <= 300 && rear[1] > 150 && rear[2] === true && rear[3] === true, JSON.stringify(rear));
  await keys({ KeyW: true }); await waitGame(1.4);
  const lspeed = await T(`[+LT.speed.toFixed(1), +LT.pos.x.toFixed(1)]`);
  await keys({ KeyW: false });
  ok("yengil tank og'irdan tez yuradi (>9 m/s)", lspeed[0] > 9.5 && lspeed[0] <= 14.1, JSON.stringify(lspeed));
  await ev(`window.__dbg.exitVehicle(), 1`); await sleep(300);

  // --- Tank yonida portlagan bomba gusenitsani uzadi; uzoqdagisi — yo'q ---
  await place(-40, 0, Math.PI / 2);
  await T(`(P.pos.set(-20, 0, 20), D.spawnProjectile(new V3(-40, 4, 12), new V3(0, -30, 0), 'gl', 'player', null, false), 1)`);
  await waitGame(0.8);
  const far = await T(`[H.trackBroken, Math.round(H.hp)]`);
  await T(`(D.spawnProjectile(new V3(-40, 4, 3.6), new V3(0, -30, 0), 'gl', 'player', null, false), 1)`);
  await waitGame(0.8);
  const near = await T(`[H.trackBroken, Math.round(H.hp)]`);
  ok("yonida portlagan bomba gusenitsani uzdi (12 m naridagisi — yo'q)", far[0] === 0 && near[0] !== 0 && near[1] < 1000, `uzoq=${JSON.stringify(far)} yaqin=${JSON.stringify(near)}`);
  await place(-62, 0, Math.PI / 2);

  // --- Kvadrotsikl ---
  await T(`(P.pos.set(-58, 0, 52.2), P.vel.set(0, 0, 0), 1)`); await sleep(400);
  L('  prompt:', await ev(`document.getElementById('prompt').textContent`));
  await ev(`window.__dbg.tryEnterVehicle(), 1`); await sleep(300);
  await keys({ KeyW: true }); await waitGame(1.6);
  await shot('armor_quad');
  const q = await T(`[G.inVeh ? G.inVeh.type + G.seat : 'yoq', +G.vehicles[3].speed.toFixed(1), G.vehicles[3].T.name]`);
  await keys({ KeyW: false });
  ok('kvadrotsikl: tez (>16 m/s)', q[0] === 'quad0' && q[1] > 16 && q[2] === 'Kvadrotsikl', JSON.stringify(q));
  await ev(`window.__dbg.exitVehicle(), 1`); await sleep(300);

  // --- O'tirishdan oldin o'rin tanlash ---
  await T(`(P.pos.set(-55, 0, -55.5), P.vel.set(0, 0, 0), 1)`); await sleep(500);
  const p1 = await ev(`document.getElementById('prompt').textContent`);
  await key('KeyQ'); await sleep(400);
  const p2 = await ev(`document.getElementById('prompt').textContent`);
  await key('KeyF'); await sleep(400);
  const seat = await T(`G.inVeh ? G.inVeh.type + G.seat + ':' + G.inVeh.seats.map(s => s == null ? 0 : 1).join('') : 'yoq'`);
  ok("[Q] bilan uchuvchi o'rniga bort o'qchisi tanlandi", /uchuvchi/.test(p1) && /\[Q\]/.test(p1) && /bort o'qchisi/.test(p2) && seat === 'heli1:0100', `"${p1}" -> "${p2}" -> ${seat}`);
  await ev(`window.__dbg.exitVehicle(), 1`); await sleep(300);

  // --- Parashyut faqat tugma bilan; balanddan yiqilish zarar beradi ---
  await T(`(P.pos.set(0, 45, 40), P.vel.set(0, 0, 0), P.onGround = false, P.hp = 100, 1)`);
  await waitGame(1.3);
  const f1 = await T(`[G.chute, +P.vel.y.toFixed(1), document.getElementById('prompt').textContent]`);
  await key('Space'); await sleep(300);
  const f2 = await T(`G.chute`);
  await until(() => T(`P.onGround`), 40000, 300);
  const f3 = await T(`[P.alive, Math.round(P.hp), G.chute]`);
  ok("parashyut o'zi ochilmaydi; PROBEL bilan ochiladi va sog' qo'ndiradi", f1[0] === false && f1[1] < -15 && /PROBEL/.test(f1[2]) && f2 === true && f3[0] === true && f3[1] === 100 && f3[2] === false, JSON.stringify(f1) + ' -> ' + f2 + ' -> ' + JSON.stringify(f3));
  await T(`(P.pos.set(0, 12, 40), P.vel.set(0, 0, 0), P.onGround = false, P.hp = 100, 1)`);
  await until(() => T(`P.onGround`), 15000, 100);
  const f4 = await T(`[P.alive, Math.round(P.hp)]`);
  ok('12 m dan parashyutsiz tushish: jarohat (halok emas)', f4[0] === true && f4[1] > 25 && f4[1] < 60, JSON.stringify(f4));
  await T(`(P.pos.set(0, 3.4, 40), P.vel.set(0, 0, 0), P.onGround = false, P.hp = 100, 1)`);
  await until(() => T(`P.onGround`), 8000, 100);
  ok("3.4 m dan (uy tomi) sakrash zararsiz", (await T(`Math.round(P.hp)`)) === 100);

  // --- Chinuk ichiga orqa rampadan yurib kirish ---
  // Chinuk (58,58), yaw = -135°: orqasi shimoli-sharqqa qaragan. O'yinchi rampa ortida, vertolyot tomonga qarab turadi.
  await T(`(CH.local(0, 0, -8.3, P.pos), P.vel.set(0, 0, 0), P.yaw = CH.yaw + Math.PI, P.pitch = 0, P.hp = 100, 1)`);
  await sleep(400);
  const w0 = await T(`[+CH.toLocal(P.pos, new V3()).z.toFixed(1), +P.pos.y.toFixed(2)]`);
  await keys({ KeyW: true });
  await until(async () => (await T(`CH.toLocal(P.pos, new V3()).z`)) > 2.5, 20000, 150);
  await keys({ KeyW: false }); await sleep(300);
  const w1 = await T(`(() => { const l = CH.toLocal(P.pos, new V3()); return [+l.x.toFixed(1), +l.y.toFixed(2), +l.z.toFixed(1), G.insideVeh === CH, G.platform === CH, !G.inVeh, P.onGround]; })()`);
  ok("rampadan yurib yuk bo'limiga kirildi (polda, o'rindiqsiz)", w0[0] < -8 && w0[1] === 0 && Math.abs(w1[1] - 0.8) < 0.02 && w1[2] > 2.5 && w1[2] < 3.9 && w1[3] && w1[4] && w1[5] && w1[6], `boshida ${JSON.stringify(w0)} ichida ${JSON.stringify(w1)}`);
  await T(`(P.yaw = CH.yaw, P.pitch = -0.05, 1)`); await sleep(400);
  await shot('chinook_inside');
  // devorlar ushlab turadi: yon tomonga yurib chiqib bo'lmaydi
  await T(`(P.yaw = CH.yaw + Math.PI / 2, 1)`); await keys({ KeyW: true }); await waitGame(1.5); await keys({ KeyW: false });
  const w2 = await T(`+Math.abs(CH.toLocal(P.pos, new V3()).x).toFixed(2)`);
  ok('devor ushlab turadi', w2 < 0.95 && (await T(`G.insideVeh === CH`)), '|x|=' + w2);
  // ichkaridan otilgan o'q o'z vertolyotiga tegmaydi
  const hpC = await T(`CH.hp`);
  await T(`(P.yaw = CH.yaw, P.pitch = 0, G.switchT = 0, G.fireT = 0, G.weapons[0].mag = 5, D.tryFire(), 1)`); await sleep(200);
  ok("ichkaridan otilgan o'q o'z vertolyotiga tegmaydi", (await T(`CH.hp`)) === hpC);
  // vertolyot ko'tarilsa, ichidagi piyoda u bilan birga ko'tariladi (bu yerda vertolyotni qo'lda ko'taramiz)
  await T(`(window.__lift = setInterval(() => { CH.pos.y += 0.25; CH.vel.set(0, 0, 0); CH.onGround = false; }, 16), 1)`);
  await until(async () => (await T(`CH.pos.y`)) > 25, 20000, 200);
  const w3 = await T(`(() => { const l = CH.toLocal(P.pos, new V3()); return [+CH.pos.y.toFixed(0), +l.y.toFixed(2), G.platform === CH, G.insideVeh === CH, Math.round(P.hp)]; })()`);
  // (vertolyot bu yerda kadrlar orasida sun'iy ko'tariladi, shuning uchun o'lchov paytida pol bir oz oldinda bo'lishi mumkin;
  //  aniq 0.8 m — tarmoq qismida, haqiqiy parvozda tekshiriladi)
  ok("ko'tarilayotgan vertolyot piyodani o'zi bilan olib chiqdi", w3[0] > 25 && w3[1] > -2 && w3[1] < 1.0 && w3[2] && w3[3] && w3[4] === 100, JSON.stringify(w3));
  // orqa rampadan yurib sakrash
  await T(`(P.yaw = CH.yaw, 1)`);   // vertolyot orqasiga qarab
  await keys({ KeyW: true });
  await until(async () => (await T(`!P.onGround && G.platform === null && CH.toLocal(P.pos, new V3()).z < -6.5`)), 20000, 150);
  await keys({ KeyW: false });
  await T(`(clearInterval(window.__lift), 1)`);
  await waitGame(0.7);
  const j1 = await T(`[G.chute, +P.vel.y.toFixed(1), G.insideVeh === null]`);
  await key('Space'); await sleep(300);
  const j2 = await T(`G.chute`);
  await until(() => T(`P.onGround`), 40000, 300);
  const j3 = await T(`[P.alive, Math.round(P.hp)]`);
  ok("rampadan sakrash: erkin tushish, PROBEL bilan parashyut, sog' qo'nish", j1[0] === false && j1[1] < -6 && j1[2] === true && j2 === true && j3[0] === true && j3[1] === 100, JSON.stringify(j1) + ' -> ' + j2 + ' -> ' + JSON.stringify(j3));

  // --- 40 m dan parashyutsiz: halokat ---
  await T(`(P.pos.set(0, 40, 40), P.vel.set(0, 0, 0), P.onGround = false, P.hp = 100, 1)`);
  await until(() => T(`!P.alive`), 15000, 150);
  ok('40 m dan parashyutsiz tushish halokatli', (await T(`P.alive`)) === false);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close();
}

async function multi() {
  L('=== TARMOQ');
  const bot = await wsConnect(`http://localhost:${PORT}/ws`);
  let code = null, botId = 0, state = null; const events = [];
  bot.on = (o) => { if (o.t === 'joined') { code = o.code; botId = o.id; } else if (o.t === 's') state = o; else events.push(o); };
  const got = (t) => events.filter((e) => e.t === t);
  let bp = [30, 0, 0], bv = null;
  const iv = setInterval(() => { bot.send({ t: 'p', x: bp[0], y: bp[1], z: bp[2], yw: 0, pt: 0, cr: 0, w: 0 }); if (bv) bot.send({ t: 'v', ...bv }); }, 50);
  bot.send({ t: 'create', name: 'Bot', era: 'historical' });
  await sleep(300);
  const pg = await openPage(`http://localhost:${PORT}/?kod=${code}&ism=Ali`, { port: 9391, dir: 'p_armor2' });
  const { ev, shot } = pg;
  await sleep(2800);
  bot.send({ t: 'start' });
  await sleep(1800);
  await ev(`(() => { const G = window.__G; window.__dbg.pickConfirm(); document.getElementById('pause').classList.add('hidden'); G.state = 'playing'; return 1; })()`);
  const me = () => state.p.find((p) => p.id !== botId);
  const T = (expr) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, CH = G.vehicles[1], V3 = P.pos.constructor; return ${expr}; })()`);
  const key = (code2) => ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code2}' })), window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code2}' })), 1`);
  ok('server transport ro\'yxati', got('start')[0].veh.map((v) => v.type).join(',') === 'heli,chinook,jeep,quad,cannon,cannon,tank,ltank,truck' && state.v[1].hp === 2100, 'chinuk hp=' + state.v[1].hp);

  // o'rin tanlab o'tirish (uchuvchi bo'sh bo'lsa ham o'qchi)
  await T(`(P.pos.set(-55, 0, -55.5), P.vel.set(0, 0, 0), 1)`); await sleep(500);
  await key('KeyQ'); await sleep(300); await key('KeyF'); await sleep(600);
  ok("tarmoq: tanlangan o'rin (o'qchi) server tomonidan berildi", JSON.stringify(state.v[0].s) === JSON.stringify([0, me().id, 0, 0]) && (await T(`G.inVeh ? G.inVeh.type + G.seat : 'yoq'`)) === 'heli1', JSON.stringify(state.v[0].s));
  await ev(`window.__dbg.exitVehicle(), 1`); await sleep(400);

  // gusenitsa holati serverdan barcha o'yinchilarga
  bot.send({ t: 'vhit', v: 6, dmg: 100, tr: 2 }); await sleep(500);
  ok('gusenitsa uzilishi server orqali sinxron', state.v[6].tr === 2 && state.v[6].hp === 900 && (await T(`G.vehicles[6].trackBroken === 2 && G.vehicles[6].immobile`)) === true, 'tr=' + state.v[6].tr);

  // balanddan yiqilish — server orqali
  await T(`(P.pos.set(0, 12, 40), P.vel.set(0, 0, 0), P.onGround = false, 1)`);
  await sleep(2500);
  ok('yiqilish jarohati serverda', me().al && me().hp > 25 && me().hp < 75, 'hp=' + me().hp);
  await sleep(6500);   // tiklanish
  // Chinuk: bot uchuvchi, Chrome yuk bo'limida piyoda
  bp = [54, 0, 54]; await sleep(300);
  bot.send({ t: 'venter', v: 1, seat: 0 }); await sleep(300);
  await T(`(CH.local(0, 0.8, 0, P.pos), P.vel.set(0, 0, 0), P.yaw = CH.yaw, 1)`); await sleep(600);
  ok("Chrome yuk bo'limida piyoda; server buni biladi (iv)", (await T(`G.insideVeh === CH && !G.inVeh`)) === true && me().vh === -1 && state.v[1].s[0] === botId, 'vh=' + me().vh);
  bv = { id: 1, x: 58, y: 0, z: 58, yw: (-Math.PI * 3) / 4, pt: 0, rl: 0, ay: 0, ap: 0 };
  for (let i = 0; i < 80; i++) { bv.y = Math.min(24, bv.y + 0.4); if (i > 40) { bv.x -= 0.4; bv.z -= 0.4; } bp = [bv.x, bv.y + 1.3, bv.z]; await sleep(50); }
  await sleep(1200);
  const c1 = await T(`(() => { const l = CH.toLocal(P.pos, new V3()); return [+P.pos.x.toFixed(0), +P.pos.y.toFixed(1), +P.pos.z.toFixed(0), +l.y.toFixed(2), G.insideVeh === CH, P.alive]; })()`);
  ok("uchayotgan Chinuk piyodani olib yurdi", c1[1] > 22 && Math.abs(c1[0] - bv.x) < 3 && Math.abs(c1[2] - bv.z) < 3 && Math.abs(c1[3] - 0.8) < 0.3 && c1[4] && c1[5], JSON.stringify(c1) + ' heli=' + JSON.stringify([bv.x, bv.y, bv.z].map((n) => +n.toFixed(0))));
  await shot('chinook_inside_flight');
  // yuk bo'limida piyoda turgan o'yinchi vertolyot bilan birga halok bo'ladi
  bot.send({ t: 'vhit', v: 1, dmg: 2500 }); bv = null;
  await sleep(900);
  const k = got('kill');
  ok("Chinuk portladi: ichidagi piyoda ham halok bo'ldi", !state.v[1].al && k.some((x) => x.victim === me().id && x.kind === 'vehicle'), JSON.stringify(k));
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
