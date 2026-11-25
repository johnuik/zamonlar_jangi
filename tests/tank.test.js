// Tank sinovi: yakka rejim (haydash, pushka, zirh, botlar raketasi, bosib ketish, komandir o'rni) + tarmoq
// Ishlatish: PORT=8191 node server.js   so'ng   PORT=8191 node tests/tank.test.js [historical|modern]
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const era = process.argv[2] || 'historical';
const PORT = process.env.PORT || 8191;
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };

async function single() {
  L('=== YAKKA REJIM');
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9350, dir: 'p_tank' });
  const { ev, shot } = pg;
  await sleep(2500);
  if (era === 'modern') { await ev(`document.querySelector('.era[data-era=modern]').click(), 1`); await sleep(1200); }
  L('boshlash:', await ev(`(() => { const G = window.__G, D = window.__dbg; document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 9999;
    for (const s of G.soldiers) s.hp = 1e9;
    return 'veh=' + G.vehicles.map(v => v.type).join(','); })()`));
  const keys = (o) => ev(`Object.assign(window.__dbg.keys, ${JSON.stringify(o)}), 1`);
  const T = (expr) => ev(`(() => { const G = window.__G, D = window.__dbg, v = G.vehicles[6], P = D.player; return ${expr}; })()`);

  await T(`(P.pos.set(-60, 0, 3.2), P.vel.set(0, 0, 0), 1)`);
  await sleep(400);
  L('  prompt:', await ev(`document.getElementById('prompt').textContent`));
  await ev(`window.__dbg.tryEnterVehicle(), 1`);
  await sleep(400);
  ok("tankka o'tirildi", (await T(`G.inVeh ? G.inVeh.type + G.seat : 'yoq'`)) === 'tank0');
  await shot(`tank_${era}_enter`);
  await keys({ KeyW: true }); await sleep(3200); await keys({ KeyW: false });
  let st = await T(`[+v.pos.x.toFixed(1), +v.pos.z.toFixed(1), +v.speed.toFixed(1), +v.yaw.toFixed(2)]`);
  ok('tank oldinga yurdi', st[0] > -52, JSON.stringify(st));
  await sleep(1200);
  await keys({ KeyA: true }); await sleep(1500); await keys({ KeyA: false });
  const yaw2 = await T(`+v.yaw.toFixed(2)`);
  ok('joyida burildi', Math.abs(yaw2 - st[3]) > 0.8, `yaw ${st[3]} -> ${yaw2}`);

  // Pushka: 22 m oldindagi jipni bir o'q bilan yo'q qilish
  await T(`(v.pos.set(-40, 0, 0), v.yaw = Math.PI / 2, v.speed = 0, G.vehicles[2].pos.set(-18, 0, 0), G.vehicles[2].yaw = -Math.PI / 2, P.yaw = -Math.PI / 2, P.pitch = -0.14, 1)`);
  await sleep(1800);
  await shot(`tank_${era}_aim`);
  const aim = await T(`[+v.aimYaw.toFixed(2), +v.aimPitch.toFixed(3), G.aimPt.toArray().map(n => +n.toFixed(1))]`);
  await T(`(D.mouse.L = true, 1)`); await sleep(150); await T(`(D.mouse.L = false, 1)`);
  const rel = await T(`+G.vAltT.toFixed(1)`);
  await sleep(900);
  ok("pushka jipni bir o'q bilan yo'q qildi", (await T(`G.vehicles[2].alive`)) === false, 'nishon=' + JSON.stringify(aim) + ' qayta o\'qlash=' + rel + 's');
  await shot(`tank_${era}_fired`);
  L('  HUD:', await ev(`document.getElementById('vehName').textContent`));
  const s0 = await T(`G.shots`);
  // otish tezligi kadr tezligiga bog'liq (sekin renderda kadriga bitta o'q), shuning uchun vaqt emas, o'qlar soni kutiladi
  await T(`(D.mouse.R = true, 1)`); for (let i = 0; i < 50 && (await T(`G.shots`)) - s0 < 3; i++) await sleep(100); await T(`(D.mouse.R = false, 1)`);
  ok('juft pulemyot otdi', (await T(`G.shots`)) - s0 >= 3, 'o\'qlar=' + ((await T(`G.shots`)) - s0));

  // Zirh: oddiy o'q deyarli ta'sir qilmaydi
  const hp0 = await T(`v.hp`);
  await T(`(G.damagePlayer(100, P.pos.clone(), null), 1)`);
  const hp1 = await T(`v.hp`);
  ok("zirh: 100 lik o'q tankka 8 shikast beradi, o'yinchiga 0", Math.abs(hp0 - hp1 - 8) < 0.01 && (await T(`P.hp`)) === 100, `${hp0} -> ${hp1}`);

  // Botlar tankka raketa otadimi?
  // ittifoqchilar dushmanni tez o'ldirib qo'ymasligi uchun ularni chetga olamiz
  await T(`(() => { for (const s of G.soldiers) if (s.team === 'ally') { s.alive = false; s.root.visible = false; } G.waveTimer = 0; return 1; })()`);
  let rockets = 0, hpMin = hp1;
  for (let i = 0; i < 130 && !(rockets > 0 && hpMin < hp1 - 200); i++) {
    await sleep(300);
    const r = await T(`[G.projectiles.filter(p => p.team === 'enemy').length, (G.waveState === 'intermission' && (G.waveTimer = Math.min(G.waveTimer, 0.5)), v.alive ? v.hp : 0), G.soldiers.filter(s => s.alive && s.team === 'enemy' && s.visible && s.target === P).length]`);
    rockets = Math.max(rockets, r[0]); hpMin = Math.min(hpMin, r[1]);
  }
  ok('botlar tankka raketa otdi', rockets > 0, 'bir vaqtda uchgan raketalar=' + rockets);
  ok('raketa tankni shikastladi', hpMin < hp1 - 200, `hp ${hp1} -> ${Math.round(hpMin)}`);
  await shot(`tank_${era}_battle`);

  // Bosib ketish
  await T(`(() => { for (const s of G.soldiers) if (s.team === 'enemy' && s.alive) s.damage(9999, null, false, null, 'x'); G.waveState = 'none'; G.toSpawn = 0; v.hp = 1000; v.setTracks(0);
    v.pos.set(-40, 0, 0); v.yaw = Math.PI / 2; v.speed = 0; return 1; })()`);
  await sleep(300);
  const k0 = await T(`G.kills`);
  await ev(`(async () => { const m = await import('./js/soldier.js'); const G = window.__G; const THREE_V = G.player.pos.constructor;
    const s = new m.Soldier(G, 'enemy', 'rifle', new THREE_V(-32, 0, 0)); s.update = function () { this.root.position.copy(this.pos); }; G.soldiers.push(s); window.__rk = s; return 1; })()`);
  await keys({ KeyW: true }); await sleep(2600); await keys({ KeyW: false });
  ok('tank dushmanni bosib ketdi', (await ev(`window.__rk.alive`)) === false && (await T(`G.kills`)) === k0 + 1, 'kills ' + k0 + ' -> ' + (await T(`G.kills`)));

  // Komandir o'rni (ikkinchi o'yinchi pulemyoti)
  await ev(`window.__dbg.exitVehicle(), 1`); await sleep(300);
  const out = await T(`[!G.inVeh, P.pos.toArray().map(n => +n.toFixed(1)), +P.pos.distanceTo(v.pos).toFixed(1)]`);
  ok('tankdan chiqildi (yonida)', out[0] && out[2] > 2 && out[2] < 6, JSON.stringify(out));
  await T(`(D.enterVehicle(v, 1), P.pitch = -0.1, 1)`); await sleep(400);
  const s1 = await T(`G.shots`);
  await T(`(D.mouse.L = true, 1)`); await sleep(600);
  await shot(`tank_${era}_commander`);
  await T(`(D.mouse.L = false, 1)`);
  ok('komandir pulemyoti otdi', (await T(`G.seat`)) === 1 && (await T(`G.shots`)) - s1 >= 3 && (await T(`G.mountVM.group.visible`)) === true, 'o\'qlar=' + ((await T(`G.shots`)) - s1));
  await ev(`window.__dbg.exitVehicle(), 1`);
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
  bot.send({ t: 'create', name: 'Bot', era });
  await sleep(300);
  const pg = await openPage(`http://localhost:${PORT}/?kod=${code}&ism=Tankchi`, { port: 9351, dir: 'p_tank2' });
  const { ev } = pg;
  await sleep(2800);
  bot.send({ t: 'start' });
  await sleep(1800);
  await ev(`(() => { const G = window.__G; window.__dbg.pickConfirm(); document.getElementById('pause').classList.add('hidden'); G.state = 'playing'; return 1; })()`);
  const iv = setInterval(() => bot.send({ t: 'p', x: 30, y: 0, z: 20, yw: 0, pt: 0, cr: 0, w: 0 }), 50);
  const me = () => state.p.find((p) => p.id !== botId);
  ok("serverda 9 ta transport, 2 tasi tank (og'ir va yengil)", state.v.length === 9 && got('start')[0].veh.filter((v) => v.type === 'tank' || v.type === 'ltank').length === 2);
  await ev(`(() => { const p = window.__dbg.player; p.pos.set(-60, 0, 3.2); p.vel.set(0,0,0); return 1; })()`);
  await sleep(400);
  await ev(`window.__dbg.tryEnterVehicle(), 1`); await sleep(500);
  ok("chrome tankda (server tasdiqladi)", (await ev(`window.__G.inVeh ? window.__G.inVeh.type + window.__G.seat : 'yoq'`)) === 'tank0' && state.v[6].s[0] === me().id && me().vh === 6, JSON.stringify(state.v[6].s));
  await ev(`Object.assign(window.__dbg.keys, { KeyW: true }), 1`); await sleep(2500);
  await ev(`Object.assign(window.__dbg.keys, { KeyW: false }), 1`); await sleep(300);
  ok('tank holati serverga yetdi', state.v[6].x > -58, 'x=' + state.v[6].x + ' hp=' + state.v[6].hp);
  // bot tankni yo'q qiladi -> ichidagi o'yinchi halok bo'ladi
  bot.send({ t: 'vhit', v: 6, dmg: 800 }); await sleep(300);
  ok('tank 800 shikastdan omon qoldi', state.v[6].al && state.v[6].hp === 200, 'hp=' + state.v[6].hp);
  bot.send({ t: 'vhit', v: 6, dmg: 800 }); await sleep(600);
  const k = got('kill');
  ok("tank portladi, ichidagi o'yinchi halok bo'ldi", !state.v[6].al && got('vboom').length === 1 && k.length === 1 && k[0].victim === me().id && k[0].killer === botId, JSON.stringify(k));
  ok('chrome tomoni: halok, transportdan chiqarilgan', await ev(`!window.__dbg.player.alive && !window.__G.inVeh && !window.__G.vehicles[6].alive`));
  clearInterval(iv);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close(); bot.close();
}

(async () => {
  await single();
  await multi();
  L(fails ? `YAKUN: ${fails} ta xato` : 'YAKUN: hammasi o\'tdi');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
