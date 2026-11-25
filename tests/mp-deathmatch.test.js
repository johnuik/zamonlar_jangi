// Tarmoq sinovi: deathmatch + transport + noyob qurol
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191;
const L = (...a) => console.log(...a);
const ok = (name, cond, extra = '') => L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`);

(async () => {
  const bot = await wsConnect(`http://localhost:${PORT}/ws`);
  let code = null, botId = 0, state = null, lobby = null; const events = [];
  bot.on = (o) => {
    if (o.t === 'joined') { code = o.code; botId = o.id; }
    else if (o.t === 's') state = o;
    else if (o.t === 'lobby') lobby = o;
    else events.push(o);
  };
  const got = (t) => events.filter((e) => e.t === t);
  bot.send({ t: 'create', name: 'Bot', era: 'modern' });
  await sleep(300);
  bot.send({ t: 'mode', mode: 'dm' });
  await sleep(200);
  ok('rejim deathmatch', lobby && lobby.mode === 'dm', 'kod=' + code);

  const pg = await openPage(`http://localhost:${PORT}/?kod=${code}&ism=Ali`, { port: 9341, dir: 'p_mp2' });
  const { ev, shot } = pg;
  await sleep(2800);
  ok('lobbida rejim ko\'rinadi', (await ev(`(document.querySelector('.lobbyMode.sel') || {dataset:{}}).dataset.mode`)) === 'dm', await ev(`document.getElementById('lobbyRules').innerText.slice(0, 40)`));
  await shot('mp2_lobby');
  bot.send({ t: 'start' });
  await sleep(1800);
  L('chrome:', await ev(`(() => { const G = window.__G; window.__dbg.pickConfirm(); document.getElementById('pause').classList.add('hidden'); G.state = 'playing'; return 'mp=' + G.mp + ' mode=' + G.mpMode + ' veh=' + G.vehicles.length + ' flag=' + !!G.flag + ' pickups=' + G.pickups.length; })()`));
  const me = () => state.p.find((p) => p.id !== botId);
  const meBot = () => state.p.find((p) => p.id === botId);

  // Bot vertolyotga uchuvchi bo'lib o'tiradi
  let bp = { x: -55, y: 0, z: -55.5 }, heli = { x: -58, y: 0, z: -58, yw: Math.PI / 4 }, flying = false;
  const iv = setInterval(() => {
    bot.send({ t: 'p', x: bp.x, y: bp.y, z: bp.z, yw: 0, pt: 0, cr: 0, w: 0 });
    if (flying) bot.send({ t: 'v', id: 0, x: heli.x, y: heli.y, z: heli.z, yw: heli.yw, pt: 0, rl: 0, ay: 0, ap: 0 });
  }, 50);
  await sleep(300);
  bot.send({ t: 'venter', v: 0 });
  await sleep(300);
  const vs = got('vseat')[0];
  ok('bot uchuvchi o\'rindig\'ida', vs && vs.seat === 0 && state.v[0].s[0] === botId, JSON.stringify(state.v[0].s));
  flying = true;

  // Chrome o'sha vertolyotga o'tiradi -> bort o'qchisi
  await ev(`(() => { const p = window.__dbg.player; p.pos.set(-55, 0, -55.5); p.vel.set(0,0,0); return 1; })()`);
  await sleep(400);
  await ev(`window.__dbg.tryEnterVehicle(), 1`);
  await sleep(500);
  ok("chrome bort o'qchisi (seat 1)", (await ev(`window.__G.inVeh ? window.__G.inVeh.type + window.__G.seat : 'yoq'`)) === 'heli1', 'server: ' + JSON.stringify(state.v[0].s));
  // bot vertolyotni ko'taradi va uchiradi
  for (let i = 0; i < 60; i++) { heli.y = Math.min(22, heli.y + 0.4); if (i > 30) { heli.x += 0.5; heli.z += 0.5; } bp = { x: heli.x, y: heli.y + 0.8, z: heli.z }; await sleep(50); }
  const cp = await ev(`(() => { const p = window.__dbg.player; return p.pos.toArray().map(v => +v.toFixed(1)); })()`);
  ok("o'qchi vertolyot bilan birga uchmoqda", cp[1] > 15, JSON.stringify(cp) + ' heli=' + JSON.stringify([heli.x, heli.y, heli.z].map((v) => +v.toFixed(1))));
  await ev(`(() => { const D = window.__dbg; D.player.yaw = 2.2; D.player.pitch = -0.35; D.mouse.L = true; return 1; })()`);
  await sleep(900);
  await shot('mp2_gunner');
  const shots = await ev(`(() => { window.__dbg.mouse.L = false; return window.__G.shots; })()`);
  ok("bort pulemyoti otdi", shots > 3, 'shots=' + shots + ' bot ko\'rgan shot xabarlari=' + got('shot').length);
  // parashyut
  await ev(`window.__dbg.exitVehicle(), 1`);
  await sleep(500);
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })), 1`);   // parashyut endi faqat tugma bilan ochiladi
  await sleep(500);
  ok('parashyut (server ham ko\'radi)', (await ev(`window.__G.chute`)) === true && me().ch === 1 && me().vh === -1, 'ch=' + me().ch + ' vh=' + me().vh);
  await shot('mp2_chute');

  // Chrome podvaldan RPG oladi
  await ev(`(() => { const G = window.__G, p = window.__dbg.player; G.chute = false; p.pos.set(-28.4, -3, -27.3); p.vel.set(0,0,0); return 1; })()`);
  await sleep(400);
  await ev(`window.__dbg.interact(), 1`);
  await sleep(500);
  const wn = await ev(`(() => { const G = window.__G; return G.weapons.length + ' ' + G.weapons[G.wi].def.name; })()`);
  ok('noyob qurol server orqali olindi', /^5 RPG/.test(wn) && got('pick').length === 1 && state.pk[0] === 1, wn + ' pk=' + JSON.stringify(state.pk));

  // Bot vertolyotni past osilib turadi, Chrome RPG bilan uradi
  heli.x = -20; heli.y = 6; heli.z = -10; bp = { x: -20, y: 6.8, z: -10 };
  await ev(`(() => { const p = window.__dbg.player; p.pos.set(-20, 0, -26); p.vel.set(0,0,0); p.yaw = Math.PI; p.pitch = 0.36; return 1; })()`);
  await sleep(1500);
  await shot('mp2_aim_heli');
  for (let i = 0; i < 3 && state.v[0].al; i++) {
    await ev(`(() => { const G = window.__G, D = window.__dbg; G.weapons[4] && (G.weapons[4].mag = 1); G.switchT = 0; G.fireT = 0; G.reloadT = 0; D.tryFire(); return 1; })()`);
    await sleep(900);
    L('   raketa', i + 1, '-> vertolyot hp', state.v[0].hp, 'al', state.v[0].al);
  }
  await sleep(400);
  const kills = got('kill');
  ok('vertolyot urib tushirildi', !state.v[0].al && got('vboom').length === 1, 'vboom=' + got('vboom').length);
  ok('uchuvchi halok bo\'ldi, o\'ldirish hisoblandi', kills.length === 1 && kills[0].victim === botId && kills[0].kind === 'vehicle' && me().k === 1, JSON.stringify(kills));
  await shot('mp2_boom');
  L('  chrome killfeed:', await ev(`document.getElementById('killfeed').innerText.replace(/\\n/g,' | ')`));
  L('  chrome HUD:', await ev(`document.getElementById('flagStatus').innerText + ' || ' + document.getElementById('mpBoard').innerText.replace(/\\n/g,' ')`));

  // Ikkinchi o'ldirish -> DM_TARGET=2 da jang tugaydi
  flying = false; bp = { x: -20, y: 0, z: -10 };
  await sleep(4600);
  ok('bot qayta tug\'ildi, transportda emas', meBot().al && meBot().vh === -1);
  await sleep(300);
  await ev(`(() => { const G = window.__G; const r = G.soldiers.find(s => s.team === 'remote'); r.damage(200, G.player.pos, true, 'player', 'bullet'); return 1; })()`);
  await sleep(900);
  const end = got('end')[0];
  ok('deathmatch tugadi, g\'olib Chrome', end && end.mode === 'dm' && end.winner === me().id, end ? JSON.stringify(end.players) : 'end yo\'q');
  L('  yakun:', await ev(`document.getElementById('endTitle').innerText + ' / ' + document.getElementById('endSub').innerText`));
  await shot('mp2_end');
  clearInterval(iv);
  L('JS xatolari soni:', pg.errors.length);
  pg.close(); bot.close();
  process.exit(0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
