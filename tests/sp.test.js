// Yakka rejim sinovi: uy, podval, noyob qurol, vertolyot, parashyut, jip, pushka
const { openPage, sleep } = require('./lib_cdp.js');
const era = process.argv[2] || 'historical';
const PORT = process.env.PORT || 8191;
const L = (...a) => console.log(...a);
const ok = (name, cond, extra = '') => L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`);

(async () => {
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9340, dir: 'p_sp' });
  const { ev, shot } = pg;
  await sleep(2500);
  await ev(`(() => { const G = window.__G; if ('${era}' === 'modern') document.querySelector('.era[data-era=modern]').click(); return 1; })()`);
  await sleep(1200);
  L('boshlash:', await ev(`(() => { const G = window.__G, D = window.__dbg; document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 9999;
    for (const s of G.soldiers) s.hp = 1e9;
    return G.state + ' boxes=' + G.world.boxes.length + ' pits=' + G.world.pits.length + ' veh=' + G.vehicles.length + ' pickups=' + G.pickups.length + ' spawns=' + G.world.spawns.length; })()`));
  const P = (x, y, z, yaw, pitch = 0) => ev(`(() => { const p = window.__dbg.player; p.pos.set(${x},${y},${z}); p.vel.set(0,0,0); p.yaw = ${yaw}; p.pitch = ${pitch}; return 1; })()`);
  const keys = (o) => ev(`Object.assign(window.__dbg.keys, ${JSON.stringify(o)}), 1`);
  const pos = () => ev(`(() => { const p = window.__dbg.player; return p.pos.toArray().map(v => +v.toFixed(2)); })()`);
  await sleep(800);
  await shot(`sp_${era}_spawn`);

  // --- Uy ichi ---
  await P(-48, 0, -12, -Math.PI / 2, -0.05);
  await sleep(500);
  await shot(`sp_${era}_house`);
  // eshikdan chiqish: H7 (-48,-12) eshiklari: janub (z+) va sharq (x+). Sharqqa yuramiz.
  // belgilangan vaqt emas, shart kutiladi: dasturiy renderda o'yin vaqti devor soatidan sekin o'tadi
  await keys({ KeyW: true }); for (let i = 0; i < 70 && (await pos())[0] <= -42.8; i++) await sleep(100); await keys({ KeyW: false });
  let p = await pos();
  ok('eshikdan chiqish (x > -43)', p[0] > -42.8, JSON.stringify(p));
  // devor orqali o'tib bo'lmasligi: uy ichidan g'arbga (deraza tomon)
  await P(-48, 0, -12, Math.PI / 2); await keys({ KeyW: true }); await sleep(1500); await keys({ KeyW: false });
  p = await pos();
  ok("devor to'sadi (x > -53)", p[0] > -52.8 && p[0] < -51, JSON.stringify(p));

  // --- Podval (H1: -32,-30) ---
  await P(-36.65, 0, -33.95, -Math.PI / 2);
  await keys({ KeyW: true }); await sleep(2200); await keys({ KeyW: false });
  p = await pos();
  ok('zinadan podvalga tushish (y = -3)', Math.abs(p[1] + 3) < 0.05, JSON.stringify(p) + ' pit=' + await ev('window.__G.playerPit'));
  await P(-33, -3, -30.5, -2.2, -0.05);
  await sleep(400);
  await shot(`sp_${era}_basement`);
  // noyob qurol
  await P(-28.4, -3, -27.3, 0);
  await sleep(300);
  L('  prompt:', await ev(`document.getElementById('prompt').textContent`));
  await ev(`window.__dbg.interact(), 1`);
  await sleep(700);
  const wname = await ev(`(() => { const G = window.__G; return G.weapons.length + ' ' + G.weapons[G.wi].def.name + ' wi=' + G.wi; })()`);
  ok('noyob qurol olindi', /^5 /.test(wname), wname);
  await shot(`sp_${era}_special`);
  // podvaldan chiqish
  await P(-33.2, -3, -33.95, Math.PI / 2);
  await keys({ KeyW: true }); await sleep(2600); await keys({ KeyW: false });
  p = await pos();
  ok('zinadan chiqish (y = 0)', Math.abs(p[1]) < 0.05, JSON.stringify(p));
  // RPG otish
  await P(-20, 0, -20, -Math.PI / 4, 0);
  await sleep(600);
  // uchirilganini o'q-dori va shu zahoti paydo bo'lgan snaryad bo'yicha aniqlaymiz (yaqin to'siqqa tez tegishi mumkin)
  const pr = await ev(`(() => { const D = window.__dbg, G = window.__G; G.switchT = 0; G.fireT = 0; const m0 = G.weapons[4].mag; D.tryFire(); return [m0, G.weapons[4].mag, G.projectiles.length]; })()`);
  await sleep(3500);
  ok('raketa uchdi va portladi', pr[0] === 1 && pr[1] === 0 && pr[2] === 1 && (await ev(`window.__G.projectiles.length`)) === 0, '[oldin, keyin, snaryadlar]=' + JSON.stringify(pr));

  // --- Dushmanlar podvalga tushadimi? ---
  await P(-30, -3, -29, 0);
  // ittifoqchilar sinovda o'lmas — dushmanni chalg'itmasligi uchun bu bosqichda chetga olinadi
  await ev(`(() => { const G = window.__G; for (const s of G.soldiers) if (s.team === 'ally') { s.alive = false; s.root.visible = false; }
    G.waveTimer = 0; G.godT = setInterval(() => { window.__dbg.player.hp = 100; }, 100); return 1; })()`);
  let down = 0, seen = '';
  for (let i = 0; i < 70 && !down; i++) {
    await sleep(1500);
    const r = await ev(`(() => { const G = window.__G; const en = G.soldiers.filter(s => s.alive && s.team === 'enemy'); const d = en.filter(s => s.pos.y < -1).length; const al = G.soldiers.filter(s => s.team === 'ally' && s.pos.y < -1).length;
      const near = en.map(s => Math.hypot(s.pos.x + 32, s.pos.z + 30)).sort((a,b)=>a-b)[0]; return [d, en.length, al, near ? +near.toFixed(1) : -1]; })()`);
    down = r[0]; seen = JSON.stringify(r);
  }
  ok('dushman podvalga tushdi', down > 0, '[podvalda, jami, ittifoqchi podvalda, eng yaqin masofa]=' + seen);
  await P(-30, -3, -29, 2.5, 0.1); await sleep(300);
  await shot(`sp_${era}_basement_fight`);
  await ev(`(() => { const G = window.__G; for (const s of G.soldiers) if (s.team === 'enemy') s.damage(9999, null, false, null, 'x'); G.waveState = 'none'; G.toSpawn = 0; return 1; })()`);

  // --- Vertolyot ---
  await P(-55, 0, -55.5, Math.PI + Math.PI / 4, -0.1);
  await sleep(300);
  L('  prompt:', await ev(`document.getElementById('prompt').textContent`));
  await ev(`window.__dbg.tryEnterVehicle(), 1`);
  await sleep(300);
  ok("vertolyotga o'tirildi", (await ev(`window.__G.inVeh ? window.__G.inVeh.type + window.__G.seat : 'yoq'`)) === 'heli0');
  await keys({ Space: true }); await sleep(4500);
  await shot(`sp_${era}_heli_takeoff`);
  await keys({ KeyW: true }); await sleep(3500); await keys({ Space: false });
  let hv = await ev(`(() => { const v = window.__G.inVeh; return [+(v.pos.x).toFixed(1), +(v.pos.y).toFixed(1), +(v.pos.z).toFixed(1), +v.rotor.toFixed(2), +Math.hypot(v.vel.x, v.vel.z).toFixed(1)]; })()`);
  ok('vertolyot uchdi (y > 15, tezlik > 10)', hv[1] > 15 && hv[4] > 10, JSON.stringify(hv));
  await ev(`(() => { const D = window.__dbg; D.player.pitch = -0.45; D.mouse.L = true; D.mouse.R = true; return 1; })()`);
  await sleep(1500);
  await shot(`sp_${era}_heli_fire`);
  const fired = await ev(`(() => { const D = window.__dbg, G = window.__G; D.mouse.L = false; D.mouse.R = false; return [G.shots, G.projectiles.length]; })()`);
  ok('vertolyot pulemyoti va raketalari', fired[0] > 5 && fired[1] > 0, JSON.stringify(fired));
  await keys({ KeyW: false });
  // parashyut
  await ev(`window.__dbg.exitVehicle(), 1`);
  await sleep(600);
  const auto = await ev(`window.__G.chute`);   // parashyut o'zi ochilmasligi kerak
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })), 1`);
  await sleep(300);
  ok("parashyut o'zi ochilmadi, PROBEL bilan ochildi", auto === false && (await ev(`window.__G.chute === true && !window.__G.inVeh`)), 'vy=' + await ev(`+window.__dbg.player.vel.y.toFixed(1)`));
  await keys({ Space: false });   // tugma qo'yib yuboriladi — aks holda qo'ngach o'yinchi to'xtovsiz sakrayveradi va "yerda" holati deyarli ushlanmaydi
  await ev(`window.__dbg.player.pitch = 1.2, 1`);
  await sleep(700);
  await shot(`sp_${era}_chute`);
  let landed = false;
  for (let i = 0; i < 90 && !landed; i++) { await sleep(700); landed = await ev(`window.__dbg.player.onGround && !window.__G.chute`); }
  ok("parashyut bilan qo'nish (tirik)", landed && (await ev(`window.__dbg.player.alive && window.__dbg.player.hp > 0`)), JSON.stringify(await pos()));
  await sleep(1500);
  ok('uchuvchisiz vertolyot qulab portladi', (await ev(`window.__G.vehicles[0].alive`)) === false);

  // --- Jip ---
  await P(55.5, 0, -48.5, 0); await sleep(300);
  await ev(`window.__dbg.tryEnterVehicle(), 1`); await sleep(200);
  ok("jipga o'tirildi", (await ev(`window.__G.inVeh ? window.__G.inVeh.type + window.__G.seat : 'yoq'`)) === 'jeep0');
  await keys({ KeyW: true }); await sleep(2500);
  await shot(`sp_${era}_jeep`);
  await keys({ KeyA: true }); await sleep(1200); await keys({ KeyW: false, KeyA: false });
  const jv = await ev(`(() => { const v = window.__G.vehicles[2]; return [+v.pos.x.toFixed(1), +v.pos.z.toFixed(1), +v.speed.toFixed(1), +v.yaw.toFixed(2)]; })()`);
  ok('jip yurdi va burildi', Math.hypot(jv[0] - 58, jv[1] + 50) > 15, JSON.stringify(jv));
  await ev(`window.__dbg.exitVehicle(), 1`); await sleep(300);
  ok('jipdan chiqildi', await ev(`!window.__G.inVeh && window.__dbg.player.onGround !== undefined`), JSON.stringify(await pos()));

  // --- Zenit pushkasi: ikkinchi vertolyotni urib tushirish ---
  await P(-14, 0, -15.5, 0); await sleep(300);
  await ev(`window.__dbg.tryEnterVehicle(), 1`); await sleep(200);
  ok("pushkaga o'tirildi", (await ev(`window.__G.inVeh ? window.__G.inVeh.type : 'yoq'`)) === 'cannon');
  // ikkinchi vertolyot (58,58) tomonga qaraymiz
  await ev(`(() => { const G = window.__G, D = window.__dbg, v = G.vehicles[1]; v.pos.set(-14, 0, 12); const dx = v.pos.x - (-14), dz = v.pos.z - (-18); D.player.yaw = Math.atan2(-dx, -dz); D.player.pitch = 0.0; return 1; })()`);
  await sleep(900);
  await shot(`sp_${era}_cannon`);
  await ev(`window.__dbg.mouse.L = true, 1`);
  let hp1 = 900, boom = false;
  for (let i = 0; i < 16 && !boom; i++) { await sleep(700); const r = await ev(`(() => { const v = window.__G.vehicles[1]; return [v.alive, Math.round(v.hp)]; })()`); boom = !r[0]; hp1 = r[1]; }
  await ev(`window.__dbg.mouse.L = false, 1`);
  ok('pushka vertolyotni shikastladi/yo\'q qildi', boom || hp1 < 900, 'hp=' + hp1 + ' portladi=' + boom);
  await ev(`window.__dbg.exitVehicle(), 1`);

  L('JS xatolari soni:', pg.errors.length);
  pg.close();
  process.exit(0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
