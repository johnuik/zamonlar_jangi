// Transport ko'rinishi: [V] — 1-shaxs / 3-shaxs. Har bir transportning har bir o'rnida ishlaydi, eslatmada ko'rsatiladi,
// ikkala ko'rinishda ham qurol otadi. Piyoda [V] — avvalgidek pichoq zarbasi.
// Ishlatish: PORT=8191 node server.js   so'ng   node tests/view.test.js [historical|modern]
const { openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191, era = process.argv[2] || 'modern';
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };
const KEY = (code) => `window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' })), window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' })), 1`;

(async () => {
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9431, dir: 'p_view' });
  const { ev, shot } = pg;
  await sleep(2500);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, K = D.keys; return ${body}; })()`);
  const until = async (cond, ms = 6000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  await ev(`(() => { localStorage.removeItem('zj_view'); return 1; })()`);
  await ev(`location.reload(), 1`); await sleep(2500);
  await ev(`(() => { const G = window.__G, D = window.__dbg; document.querySelectorAll('.era').forEach(e => { if (e.dataset.era === '${era}') e.click(); }); document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 99999; G.bannerT = 0.01;
    for (const s of G.soldiers) { s.alive = false; s.root.visible = false; } return 1; })()`);
  await sleep(500);
  // kamera va ko'z orasidagi masofa; eslatma; ko'rinish holati
  const view = () => T(`(() => { const v = G.inVeh, e = v.eyePos(G.seat, P.pos.clone()); return [D.vehFP(), +D.camera.position.distanceTo(e).toFixed(2), document.getElementById('vehHint').textContent, v.T.roles[G.seat], v.T.seatNames[G.seat]]; })()`);
  // otish: o'q/snaryad/qizish o'zgardimi?
  const fired = async (btn) => {
    const a = await T(`[G.shots, G.projectiles.length, G.inVeh.gun.heat, G.gunHeat.heat]`);
    await T(`(G.vFireT = 0, G.vAltT = 0, G.switchT = 0, G.fireT = 0, G.reloadT = 0, G.weapons[0].mag = G.weapons[0].def.mag, D.mouse.${btn} = true, 1)`); await sleep(450); await T(`(D.mouse.${btn} = false, 1)`);
    // snaryad 0,4 soniyada nishonga yetib portlab bo'lishi mumkin, shuning uchun qurolning qayta o'qlanish taymeri ham hisobga olinadi
    const b = await T(`[G.shots, G.projectiles.length, G.inVeh.gun.heat, G.gunHeat.heat, G.vFireT, G.vAltT]`);
    return b[0] > a[0] || b[1] > a[1] || b[2] > a[2] || b[3] > a[3] || b[4] > 0.02 || b[5] > 0.02;
  };
  const list = await T(`G.vehicles.map(v => [v.id, v.type, v.T.seats, v.T.name])`);
  for (const [id, type, seats, name] of list) {
    if (id === 5) continue;   // ikkinchi zenit pushkasi birinchisi bilan bir xil
    for (let seat = 0; seat < seats; seat++) {
      await T(`(D.enterVehicle(G.vehicles[${id}], ${seat}), 1)`);
      await sleep(350);
      const a = await view();
      const pass = a[3] === 'pass';   // yo'lovchi o'z qurolidan otadi — faqat 1-shaxs ko'rinishida
      const armed = pass || a[3] === 'gunner' || (seat === 0 && (type === 'heli' || type === 'cannon' || type === 'tank' || type === 'ltank'));
      const f1 = armed ? await fired('L') : null;
      await ev(KEY('KeyV')); await sleep(350);
      const b = await view();
      const f2 = armed ? await fired('L') : null;
      if (id === 0 && seat === 0) await shot(`view_${era}_heli_pilot_fp`);
      if (id === 8 && seat === 0) await shot(`view_${era}_truck_fp`);
      if (id === 6 && seat === 0) await shot(`view_${era}_tank_fp`);
      if (id === 2 && seat === 0) await shot(`view_${era}_jeep_fp`);
      if (id === 2 && seat === 1) await shot(`view_${era}_jeep_gunner_tp`);
      await ev(KEY('KeyV')); await sleep(300);
      const c = await view();
      const defFP = a[3] === 'gunner' || pass;
      const fpOf = (x) => x[0] === true && x[1] < 0.2, tpOf = (x) => x[0] === false && x[1] > 3;
      const good = a[0] === defFP && b[0] === !defFP && c[0] === defFP && (defFP ? fpOf(a) && tpOf(b) && fpOf(c) : tpOf(a) && fpOf(b) && tpOf(c))
        && /V — ko'rinish \(hozir (1|3)-shaxs\)/.test(a[2]) && a[2].includes(defFP ? 'hozir 1-shaxs' : 'hozir 3-shaxs') && b[2].includes(defFP ? 'hozir 3-shaxs' : 'hozir 1-shaxs')
        && (!armed || (pass ? f1 === true && f2 === false : f1 === true && f2 === true));
      ok(`${name} · ${a[4]}: [V] ko'rinishni almashtiradi${armed ? ', ikkala ko\'rinishda ham otadi' : ''}`, good,
        `${a[0] ? '1-shaxs' : '3-shaxs'} (${a[1]} m) → ${b[0] ? '1-shaxs' : '3-shaxs'} (${b[1]} m) → ${c[0] ? '1-shaxs' : '3-shaxs'}${armed ? ` · otdi: ${f1}/${f2}` : ''}`);
      await T(`(D.exitVehicle(), G.projectiles.forEach(p => p.kill()), 1)`);
      await sleep(200);
    }
  }
  // tanlov eslab qolinadi: uchuvchi 1-shaxsga o'tkazilgach, qayta o'tirganda ham shunday
  await T(`(D.enterVehicle(G.vehicles[0], 0), 1)`); await sleep(300);
  await ev(KEY('KeyV')); await sleep(300);
  await T(`(D.exitVehicle(), 1)`); await sleep(300);
  await T(`(D.enterVehicle(G.vehicles[1], 0), 1)`); await sleep(300);
  const keep = await view();
  await ev(KEY('KeyV')); await sleep(200);
  await T(`(D.exitVehicle(), 1)`); await sleep(300);
  ok('tanlangan ko\'rinish vazifa bo\'yicha eslab qolinadi (uchuvchi — 1-shaxs)', keep[0] === true && keep[3] === 'pilot', `${keep[4]}: ${keep[0] ? '1-shaxs' : '3-shaxs'}`);
  // 1-shaxsda uchayotgan vertolyot: kamera kabina bilan birga ko'tariladi va og'adi
  await T(`(D.enterVehicle(G.vehicles[0], 0), 1)`); await sleep(300);
  await ev(KEY('KeyV')); await sleep(200);
  await T(`(K.Space = true, 1)`); await until(`G.inVeh.pos.y > 8`, 12000);
  await T(`(K.KeyD = true, 1)`); await sleep(1500);
  const fl = await T(`(() => { const v = G.inVeh, e = v.eyePos(0, P.pos.clone()); return [D.vehFP(), +D.camera.position.distanceTo(e).toFixed(2), +D.camera.position.y.toFixed(1), +v.roll.toFixed(2), +D.camera.rotation.z.toFixed(2)]; })()`);
  await shot(`view_${era}_heli_fly_fp`);
  await T(`(K.Space = false, K.KeyD = false, 1)`);
  ok('1-shaxsda uchish: kamera kabinada, vertolyot og\'ganda ufq ham og\'adi', fl[0] === true && fl[1] < 0.2 && fl[2] > 8 && Math.abs(fl[3]) > 0.05 && Math.abs(fl[4]) > 0.04, JSON.stringify(fl));
  await ev(KEY('KeyV')); await sleep(200);
  await T(`(G.inVeh.pos.y = 0, G.inVeh.vel.set(0, 0, 0), D.exitVehicle(), 1)`); await sleep(400);
  // piyoda [V] — pichoq zarbasi (o'zgarmagan)
  await T(`(P.pos.set(3, 0, 30), G.switchT = 0, 1)`); await sleep(300);
  await ev(KEY('KeyV')); await sleep(150);
  ok('piyoda [V] — pichoq zarbasi', (await T(`G.knifeT > 0 && !G.inVeh`)) === true);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  L(fails ? `YAKUN: ${fails} ta xato` : "YAKUN: hammasi o'tdi");
  pg.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
