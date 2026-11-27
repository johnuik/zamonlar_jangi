// Klasslar: jangga kirishdan oldin tanlash, qurollar to'plami (1 asosiy · 2 to'pponcha · 3 pichoq · 4 granata), mo'ljalga olish,
// qo'ldagi pichoq va granata, [G] tez uloqtirish; tarmoqda — o'lgandan keyingi 4 soniya ichida klass almashtirish.
// Ishlatish: PORT=8191 node server.js   so'ng   node tests/classes.test.js [historical|modern]
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191, era = process.argv[2] || 'modern';
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };
const KEY = (code) => `window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' })), window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' })), 1`;
const PRIMARY = ['ar', 'smg', 'sniper', 'shotgun'];

async function single() {
  L(`=== YAKKA REJIM (${era})`);
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9411, dir: 'p_cls' });
  const { ev, shot } = pg;
  await sleep(2500);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player; return ${body}; })()`);
  const until = async (cond, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  // menyu → brifing → klass tanlash oynasi
  await ev(`(() => { localStorage.removeItem('zj_class'); document.querySelectorAll('.era').forEach(e => { if (e.dataset.era === '${era}') e.click(); }); document.getElementById('btnPlay').click(); return 1; })()`);
  await sleep(400);
  await ev(`document.getElementById('briefing').click(), 1`);
  await sleep(300);
  const pk = await ev(`[!document.getElementById('classPick').classList.contains('hidden'), document.querySelectorAll('.cpCard').length, document.getElementById('cpCards').innerText.replace(/\\n+/g, ' | ').slice(0, 400), window.__G.state]`);
  ok('brifingdan keyin klass tanlash oynasi chiqadi (6 ta klass), jang hali boshlanmagan', pk[0] === true && pk[1] === 6 && pk[3] !== 'playing', pk[2].slice(0, 160));
  await shot(`cls_${era}_pick`);
  await ev(KEY('Digit2')); await sleep(600);
  const st = await T(`[G.state, G.cls, G.weapons.map(w => w.def.id).join(','), document.getElementById('classPick').classList.contains('hidden'), document.getElementById('weaponSlots').innerText.replace(/\\n/g, ' | ')]`);
  ok('[2] — Injener: PP, to\'pponcha, pichoq, granata bilan jang boshlanadi', st[0] === 'playing' && st[1] === 1 && st[2] === 'smg,pistol,knife,nade' && st[3] === true, st[2] + ' · ' + st[4]);
  await T(`(G.waveTimer = 99999, G.soldiers.forEach(s => { s.alive = false; s.root.visible = false; }), P.pos.set(3, 0, 30), P.yaw = 0.25, 1)`);

  // har bir klassning asosiy quroli va mo'ljal chizig'i: ADS da qurol o'qi aniq ekran markazida
  for (let c = 0; c < 4; c++) {
    await T(`(D.mouse.R = false, D.setClass(${c}), D.applyLoadout(), G.switchT = 0, 1)`);
    await sleep(150);
    await T(`(D.mouse.R = true, 1)`);
    await until(`G.ads >= 1`);
    await sleep(250);
    const a = await T(`(() => { const W = G.weapons[0], g = W.vm.group; return [W.def.id, W.def.name, +g.position.x.toFixed(4), +g.position.y.toFixed(4), +g.rotation.x.toFixed(4), +g.rotation.y.toFixed(4), +D.camera.fov.toFixed(1), +(W.def.adsFov * D.settings.fov / 80).toFixed(1),   // (mo'ljal burchagi tanlangan ko'rish burchagiga nisbatan: standart 62°, jadval 80° ga yozilgan)
      getComputedStyle(document.getElementById('crosshair')).opacity, getComputedStyle(document.getElementById('scope')).display, g.visible, !!W.def.scope]; })()`);
    const aligned = Math.abs(a[2]) < 0.0015 && Math.abs(a[3]) < 0.0015 && Math.abs(a[4]) < 0.004 && Math.abs(a[5]) < 0.004;
    ok(`klass ${c + 1}: ${a[1]} — mo'ljal ekran markazida, nishon belgisi yashirin, FOV ${a[7]}°`,
      a[0] === PRIMARY[c] && aligned && Math.abs(a[6] - a[7]) < 1.5 && a[8] === '0' && (a[11] ? a[9] === 'block' && a[10] === false : a[9] === 'none' && a[10] === true),
      `siljish x=${a[2]} y=${a[3]} burilish=${a[4]},${a[5]} fov=${a[6]} optika=${a[9]}`);
    await shot(`cls_${era}_ads${c}`);
    await T(`(D.mouse.R = false, 1)`);
    await until(`G.ads <= 0`);
  }

  // drobovik: patronlar bittalab solinadi va otish bilan to'xtatiladi
  await T(`(G.switchT = 0, G.weapons[0].mag = 2, 1)`);
  await ev(KEY('KeyR'));
  await until(`G.weapons[0].mag === 3`);
  const sh1 = await T(`[G.weapons[0].mag, G.reloadT > 0]`);
  await until(`G.weapons[0].mag === 4`);
  await T(`(G.fireT = 0, D.tryFire(), 1)`);
  await sleep(200);
  const sh2 = await T(`[G.weapons[0].mag, G.reloadT > 0]`);
  ok('drobovik: patronlar bittalab solinadi, otish o\'qlashni to\'xtatadi', sh1[0] === 3 && sh1[1] === true && sh2[0] === 3 && sh2[1] === false, `${JSON.stringify(sh1)} → ${JSON.stringify(sh2)}`);

  // 1-klass (avtomat) bilan davom etamiz
  await T(`(D.setClass(0), D.applyLoadout(), G.switchT = 0, G.grenades_n = 2, 1)`);
  // dushman ro'paramizda (qimirlamaydi): pichoq sinovi
  const foe = `(() => { D.spawnEnemy('rifle'); const s = G.soldiers[G.soldiers.length - 1]; s.update = () => {}; s.pos.set(P.pos.x - Math.sin(P.yaw) * 1.6, 0, P.pos.z - Math.cos(P.yaw) * 1.6); s.root.position.copy(s.pos); G.foe = s; return s.hp; })()`;
  const hp0 = await T(foe);
  await ev(KEY('Digit3')); await sleep(700);
  const k0 = await T(`[G.weapons[G.wi].def.id, G.weapons[2].vm.group.visible, document.getElementById('weaponHint').textContent, document.getElementById('mag').textContent]`);
  ok('[3] — pichoq qo\'lda, tugmalari ekranda', k0[0] === 'knife' && k0[1] === true && /kesish/.test(k0[2]) && /sanchish/.test(k0[2]), k0[2]);
  await shot(`cls_${era}_knife`);
  await T(`(D.mouse.L = true, 1)`); await until(`G.knifeT > 0`); await T(`(D.mouse.L = false, 1)`);
  await until(`G.knifeT <= 0`);
  const hp1 = await T(`[G.foe.hp, G.foe.alive]`);
  await T(`(D.mouse.R = true, 1)`); await until(`G.knifeT > 0`); await T(`(D.mouse.R = false, 1)`);
  await until(`G.knifeT <= 0`);
  const hp2 = await T(`[G.foe.hp, G.foe.alive]`);
  ok('pichoq: chap tugma — kesish (55 zarar), o\'ng tugma — sanchish (o\'ldiradi)', Math.abs(hp0 - hp1[0] - 55) < 1 && hp1[1] === true && hp2[1] === false, `${hp0} → ${hp1[0]} → o'lik=${!hp2[1]}`);
  // [V] — qurolni almashtirmasdan pichoq zarbasi
  await ev(KEY('Digit1')); await sleep(700);
  await T(foe);
  await ev(KEY('KeyV')); await until(`G.knifeT > 0`); await until(`G.knifeT <= 0`);
  const v1 = await T(`[G.weapons[G.wi].def.id, G.foe.alive]`);
  ok('[V] — qurol qo\'lda qolgan holda pichoq zarbasi', v1[0] === 'ar' && v1[1] === false, JSON.stringify(v1));

  // [4] — granata qo'lda: bosib turilganda halqa sug'uriladi, qo'yib yuborilganda uloqtiriladi
  await ev(KEY('Digit4')); await sleep(700);
  const n0 = await T(`[G.weapons[G.wi].def.id, G.weapons[3].vm.group.visible, G.weapons[3].vm.pin.visible, G.grenades_n, document.getElementById('weaponHint').textContent]`);
  ok('[4] — granata qo\'lda (halqasi joyida), tugmalari ekranda', n0[0] === 'nade' && n0[1] === true && n0[2] === true && n0[3] === 2 && /uloqtirish/.test(n0[4]), n0[4]);
  await shot(`cls_${era}_nade`);
  await T(`(G.gt0 = G.time, D.mouse.L = true, 1)`);
  await until(`G.cookT >= 0.6`);
  const n1 = await T(`[G.cookT >= 0, G.weapons[3].vm.pin.visible, G.grenades.length, G.grenades_n, document.getElementById('reloadHint').textContent]`);
  await T(`(D.mouse.L = false, 1)`);
  await until(`G.grenades.length > 0`, 3000);
  const n2 = await T(`[G.grenades.length, +G.grenades[0].fuse.toFixed(2), G.grenades_n, G.cookT, +G.grenades[0].vel.length().toFixed(1)]`);
  ok('granata: bosib turganda ushlab turiladi, qo\'yib yuborganda uchadi; portlash vaqti ushlab turilgan vaqtga kamaygan',
    n1[0] === true && n1[1] === false && n1[2] === 0 && n1[3] === 2 && /HALQA/.test(n1[4]) && n2[0] === 1 && n2[1] < 2.85 && n2[1] > 1.5 && n2[2] === 1 && n2[3] === -1 && n2[4] > 14,
    `ushlab turilganda: "${n1[4]}" · uchgandan keyin portlashgacha ${n2[1]} s, tezlik ${n2[4]}`);
  await until(`G.throwT <= 0 && G.switchT <= 0`);
  // o'ng tugma — yaqinga tashlash; oxirgi granatadan keyin asosiy qurolga qaytadi
  await T(`(G.grenades.length = 0, D.mouse.R = true, 1)`); await until(`G.cookT >= 0`); await T(`(D.mouse.R = false, 1)`);
  await until(`G.grenades.length > 0`, 3000);
  const n3 = await T(`[+G.grenades[0].vel.length().toFixed(1), G.grenades_n]`);
  await until(`G.wi === 0`, 4000);
  const n4 = await T(`[G.weapons[G.wi].def.id, G.grenades_n]`);
  ok('o\'ng tugma — yaqinga tashlash; granata tugagach asosiy qurolga qaytadi', n3[0] < 12 && n3[1] === 0 && n4[0] === 'ar', `tezlik ${n3[0]} · qurol ${n4[0]}`);
  // granata yo'q: [4] va [G] rad etiladi va sababi ko'rsatiladi
  await sleep(300);
  await ev(KEY('Digit4')); await sleep(200);
  const r1 = await T(`[G.wi, (document.getElementById('popups').lastElementChild || { textContent: '' }).textContent]`);
  await ev(KEY('KeyG')); await sleep(200);
  const r2 = await T(`[G.throwT > 0, (document.getElementById('popups').lastElementChild || { textContent: '' }).textContent]`);
  ok('granata qolmaganda [4] va [G] xabar beradi', r1[0] === 0 && /qolmadi/.test(r1[1]) && r2[0] === false && /qolmadi/.test(r2[1]), `"${r1[1]}"`);
  // [G] — tez uloqtirish (qurol almashmaydi)
  await T(`(G.grenades_n = 2, G.grenades.length = 0, G.switchT = 0, 1)`);
  await ev(KEY('KeyG'));
  await until(`G.grenades.length > 0`, 3000);
  const g1 = await T(`[G.wi, G.grenades_n, G.grenades.length]`);
  ok('[G] — granatani darhol otadi, qurol qo\'lda qoladi', g1[0] === 0 && g1[1] === 1 && g1[2] === 1, JSON.stringify(g1));
  // juda uzoq ushlab turilsa — qo'lda portlaydi
  await until(`G.throwT <= 0`);
  await T(`(G.grenades.length = 0, P.hp = 100, 1)`);
  await ev(KEY('Digit4')); await until(`G.wi === 3 && G.switchT <= 0`);
  await T(`(D.mouse.L = true, 1)`);
  await until(`G.cookT < 0 && G.grenades_n === 0`, 15000);
  await T(`(D.mouse.L = false, 1)`);
  await sleep(500);
  const b1 = await T(`[P.hp, P.alive, G.grenades_n]`);
  ok('granata juda uzoq ushlab turilsa qo\'lda portlaydi', b1[0] < 100 && b1[2] === 0, `jon ${Math.round(b1[0])}`);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  pg.close();
}

async function multi() {
  L('=== TARMOQ');
  const bot = await wsConnect(`http://localhost:${PORT}/ws`);
  let code = null, botId = 0, state = null; const events = [];
  bot.on = (o) => { if (o.t === 'joined') { code = o.code; botId = o.id; } else if (o.t === 's') state = o; else events.push(o); };
  const iv = setInterval(() => bot.send({ t: 'p', x: 30, y: 0, z: 0, yw: 0, pt: 0, cr: 0, w: 0 }), 50);
  bot.send({ t: 'create', name: 'Bot', era });
  await sleep(300);
  const pg = await openPage(`http://localhost:${PORT}/?kod=${code}&ism=Ali`, { port: 9412, dir: 'p_cls2' });
  const { ev, shot } = pg;
  await sleep(2800);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player; return ${body}; })()`);
  const until = async (cond, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  bot.send({ t: 'start' });
  await sleep(1800);
  const me = () => state.p.find((p) => p.id !== botId);
  const s0 = await T(`[!!G.pick && G.pick.mode, !document.getElementById('classPick').classList.contains('hidden'), document.getElementById('pause').classList.contains('hidden'), G.state, document.getElementById('cpTitle').textContent]`);
  ok('jang boshlanganda klass tanlash oynasi chiqadi', s0[0] === 'mpstart' && s0[1] === true && s0[2] === true, s0[4]);
  await ev(KEY('Digit3')); await sleep(500);
  const s1 = await T(`[G.state, G.cls, G.weapons[0].def.id, G.pick === null, G.grenades_n]`);
  ok('[3] — Snayper bo\'lib jangga kiriladi', s1[0] === 'playing' && s1[1] === 2 && s1[2] === 'sniper' && s1[3] === true && s1[4] === 2, JSON.stringify(s1));
  // ushlab turilgan granata vaqti raqibga ham yetib boradi
  await T(`(G.switchT = 0, 1)`);
  await ev(KEY('Digit4')); await until(`G.wi === 3 && G.switchT <= 0`);
  await T(`(D.mouse.L = true, 1)`); await until(`G.cookT >= 0.8`); await T(`(D.mouse.L = false, 1)`);
  await sleep(600);
  const nd = events.filter((e) => e.t === 'nade');
  ok('ushlab turilgan granataning qolgan vaqti raqibga uzatiladi', nd.length === 1 && nd[0].f > 1.5 && nd[0].f < 2.7, nd.length ? 'f=' + nd[0].f : 'xabar yo\'q');
  // bot bizni o'ldiradi: 4 soniya ichida klass tanlanadi
  await sleep(300);
  bot.send({ t: 'hit', target: me().id, dmg: 300, head: false, kind: 'bullet' });
  await until(`!P.alive && !!G.pick`, 4000);
  const d0 = await T(`[P.alive, !!G.pick && G.pick.mode, !document.getElementById('classPick').classList.contains('hidden'), document.getElementById('cpSub').textContent, getComputedStyle(document.getElementById('cpGo')).display]`);
  ok('o\'lgandan keyin kutish o\'rniga klass tanlash oynasi (sanoq bilan)', d0[0] === false && d0[1] === 'respawn' && d0[2] === true && /Qayta tug'ilishgacha/.test(d0[3]) && d0[4] === 'none', d0[3]);
  await ev(KEY('Digit4')); await sleep(300);
  const d1 = await T(`[G.pick && G.pick.sel, G.cls, document.querySelector('.cpCard.sel .cpName').textContent, document.getElementById('cpSub').textContent]`);
  await shot('cls_respawn_pick');
  ok('o\'lik paytda [4] bosilsa Shturmchi belgilanadi (hali qo\'llanmagan)', d1[0] === 3 && d1[1] === 2 && /Shturmchi/i.test(d1[2]), d1[3]);
  await until(`P.alive`, 8000);
  await sleep(300);
  const d2 = await T(`[P.alive, G.cls, G.weapons.map(w => w.def.id).join(','), G.weapons[0].mag === G.weapons[0].def.mag, G.pick === null, document.getElementById('classPick').classList.contains('hidden'), G.grenades_n, document.getElementById('weaponSlots').innerText.replace(/\\n/g, ' | ')]`);
  ok('qayta tug\'ilganda yangi klass qo\'llanadi: drobovik, to\'la o\'q-dori', d2[0] === true && d2[1] === 3 && d2[2] === 'shotgun,pistol,knife,nade' && d2[3] === true && d2[4] === true && d2[5] === true && d2[6] === 2, d2[7]);
  // hech narsa bosilmasa — klass o'zgarmaydi
  bot.send({ t: 'hit', target: me().id, dmg: 300, head: false, kind: 'bullet' });
  await until(`!P.alive`, 4000);
  await until(`P.alive`, 8000);
  await sleep(300);
  const d3 = await T(`[G.cls, G.weapons[0].def.id, G.pick === null]`);
  ok('tanlanmasa — avvalgi klass saqlanadi', d3[0] === 3 && d3[1] === 'shotgun' && d3[2] === true, JSON.stringify(d3));
  // pichoq zarbasi raqibga server orqali yetadi (kesish — 55)
  const bx = 30, bz = 0;
  await T(`(P.pos.set(${bx}, 0, ${bz + 1.5}), P.vel.set(0, 0, 0), P.yaw = 0, P.pitch = 0, 1)`);
  await sleep(500);
  await ev(KEY('Digit3')); await until(`G.wi === 2 && G.switchT <= 0`);
  const hpB = state.p.find((p) => p.id === botId).hp;
  await T(`(D.mouse.L = true, 1)`); await until(`G.knifeT > 0`); await T(`(D.mouse.L = false, 1)`);
  await until(`G.knifeT <= 0`); await sleep(400);
  const hpA = state.p.find((p) => p.id === botId).hp;
  ok('tarmoq: pichoq bilan kesish raqibning jonini 55 ga kamaytiradi', hpB - hpA >= 50 && hpB - hpA <= 56, `${hpB} → ${hpA}`);
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
