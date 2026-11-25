// Zombi rejimi (tarmoq): 4 odam + 5-o'yinchi zombi, xost boshqaradigan zombilar, o'lgan odam zombiga aylanadi,
// punktlar server tomonida, ikkala yakun (odamlar evakuatsiyasi / hamma zombiga aylanishi), jang ketayotganda qo'shilgan o'yinchi — zombi.
// Ishlatish: PORT=8191 Z_HOLD=4 node server.js   so'ng   node tests/zombie-mp.test.js
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191;
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };
const KEY = (code) => `window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' })), window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' })), 1`;

async function makeBot(name, code) {
  const b = await wsConnect(`http://localhost:${PORT}/ws`);
  b.id = 0; b.state = null; b.events = []; b.pos = [-96, 0, 96];
  b.on = (o) => { if (o.t === 'joined') b.id = o.id; else if (o.t === 's') b.state = o; else b.events.push(o); };
  b.got = (t) => b.events.filter((e) => e.t === t);
  b.iv = setInterval(() => { if (b.pos) b.send({ t: 'p', x: b.pos[0], y: b.pos[1], z: b.pos[2], yw: 0, pt: 0, cr: 0, w: 0 }); }, 50);
  b.send({ t: 'join', name, code });
  await sleep(250);
  return b;
}

(async () => {
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9471, dir: 'p_zmp' });
  const { ev, shot } = pg;
  await sleep(2500);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, Z = G.zg, W = G.world; return ${body}; })()`);
  const until = async (cond, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  const wait = async (fn, ms = 9000) => { for (let i = 0; i < ms / 100; i++) { if (fn()) return true; await sleep(100); } return false; };
  // sahifa xona yaratadi (xost) — zombilarni u boshqaradi
  await ev(`(document.querySelectorAll('.era').forEach(e => { if (e.dataset.era === 'modern') e.click(); }), document.getElementById('mpName').value = 'Xost', document.getElementById('btnCreate').click(), 1)`);
  await until(`G.mpRoom && G.mpRoom.code`, 8000);
  const code = await T(`G.mpRoom.code`), myId = await T(`G.myId`);
  const B = [];
  for (const n of ['Bir', 'Ikki', 'Uch', 'Tort']) B.push(await makeBot(n, code));
  const A = B[0], st = () => A.state, pl = (id) => st().p.find((p) => p.id === id);
  await T(`(G.net.send({ t: 'mode', mode: 'zombie' }), 1)`); await sleep(400);
  const lob = await ev(`[document.querySelector('.lobbyMode.sel').dataset.mode, document.querySelector('.lobbyMap.sel').dataset.map, document.querySelector('.lobbyMap[data-map=town]').disabled, document.getElementById('lobbyRules').textContent.slice(0, 60), document.querySelectorAll('#lobbyPlayers div').length]`);
  ok('lobbi: zombi rejimi tanlandi, xarita — katta (o\'zgartirib bo\'lmaydi), 5 o\'yinchi', lob[0] === 'zombie' && lob[1] === 'big' && lob[2] === true && lob[4] === 5, lob[3]);
  await T(`(G.net.send({ t: 'start' }), 1)`);
  await wait(() => A.got('start').length > 0 && A.state);
  await sleep(1500);
  const sm = A.got('start')[0];
  const s0 = await T(`[G.state, !!G.pick, !document.getElementById('pause').classList.contains('hidden'), G.zombie, G.night, W.half, G.weapons.map(w => w.def.id).join(','), G.wi, JSON.stringify(G.vehicles.map(v => [v.type, v.pos.x, v.pos.z]))]`);
  ok('jang boshlandi: katta xarita, tun, klass tanlovi yo\'q, to\'pponcha va pichoq', sm.mode === 'zombie' && sm.map === 'big' && sm.veh.length === 9 && s0[0] === 'paused' && !s0[1] && s0[2] && s0[3] && s0[4] && s0[5] === 120 && s0[6] === 'none,pistol,knife,nade' && s0[7] === 1, s0[6]);
  ok('transport joylari serverdagi tasodifiy taqsimot bilan bir xil', s0[8] === JSON.stringify(sm.veh.map((v) => [v.type, v.x, v.z])));
  await T(`(document.getElementById('pause').classList.add('hidden'), G.state = 'playing', G.bannerT = 0.01, 1)`);
  await sleep(600);
  ok('birinchi 4 o\'yinchi — odam, 5-chi — zombi (joni 60)', pl(myId).zb === 0 && pl(B[0].id).zb === 0 && pl(B[1].id).zb === 0 && pl(B[2].id).zb === 0 && pl(B[3].id).zb === 1 && pl(B[3].id).hp === 60,
    st().p.map((p) => `${p.id}:${p.zb ? 'zombi' : 'odam'}`).join(' '));
  const looks = await T(`[...G.soldiers.filter(s => s.team === 'remote')].map(r => (r.isZ ? 'Z' : 'H') + (r.zombie ? 'z' : 'h')).sort().join(',')`);
  ok('sahifada: sheriklar odam ko\'rinishida, zombi-o\'yinchi zombi ko\'rinishida', looks === 'Hh,Hh,Hh,Zz', looks);
  // xost zombilarni yaratadi va holatini boshqalarga uzatadi
  await until(`Z.host === true`, 4000);
  await wait(() => { const z = A.got('zs'); return z.length && z[z.length - 1].z.length >= 2; }, 15000);
  const zs = A.got('zs'), lastZ = zs.length ? zs[zs.length - 1].z : [];
  ok('xost (sahifa) zombilarni boshqaradi va holatini uzatadi', (await T(`Z.host`)) === true && lastZ.length >= 2 && lastZ[0].length >= 6, `zombilar: ${lastZ.length}, xabarlar: ${zs.length}`);
  // odam zombiga o'q tekkizdi: jon hisobi xostda, o'ldirish serverda hisoblanadi
  const zid = lastZ[0][0];
  B[0].send({ t: 'zhit', z: zid, dmg: 100, head: 1, kind: 'bullet' });
  await wait(() => A.got('zdead').some((e) => e.z === zid), 5000);
  await sleep(300);
  const zd = A.got('zdead').find((e) => e.z === zid);
  ok("tarmoq: boshqa o'yinchi zombini o'ldirdi (xost orqali), o'ldirish unga yozildi", !!zd && zd.by === B[0].id && pl(B[0].id).k === 1 && (await T(`G.soldiers.some(s => s.isZombie && s.zid === ${zid} && s.alive)`)) === false, JSON.stringify(zd));
  // zombi odamga hujum qiladi: xost → server → o'sha o'yinchi
  B[1].pos = [-80, 0, 96];
  await sleep(400);
  await T(`(() => { Z.spawnT = 1e9; G.soldiers.filter(s => s.isZombie).forEach(s => { s.alive = false; s.dispose(); }); const z = Z.spawn('walker', -80, 94.4); G.zA = z; return 1; })()`);
  await wait(() => B[1].got('hurt').length > 0, 9000);
  await sleep(200);
  ok('zombi boshqa o\'yinchiga zarba berdi (server orqali)', B[1].got('hurt').length > 0 && pl(B[1].id).hp < 100, `jon=${pl(B[1].id).hp}`);
  await T(`(G.soldiers.filter(s => s.isZombie).forEach(s => { s.alive = false; s.dispose(); }), 1)`);
  // o'z tomoniga zarar yo'q; zombi-o'yinchi odamni o'ldiradi → u zombi bo'lib qaytadi
  B[0].send({ t: 'hit', target: myId, dmg: 60, head: false, kind: 'bullet' });
  await sleep(400);
  const ff = pl(myId).hp;
  B[3].pos = [-70, 0, 70]; B[2].pos = [-70, 0, 72]; await sleep(300);
  B[3].send({ t: 'hit', target: B[2].id, dmg: 500, head: false, kind: 'claw' }); await sleep(300);
  const h1 = pl(B[2].id).hp;
  B[3].send({ t: 'hit', target: B[2].id, dmg: 500, head: false, kind: 'claw' }); await sleep(400);
  const dead = !pl(B[2].id).al, kills = A.got('kill').filter((k) => k.victim === B[2].id);
  await wait(() => pl(B[2].id).al && pl(B[2].id).zb === 1, 8000);
  const resp = B[2].got('respawn').find((r) => r.id === B[2].id);
  ok('odam odamga zarar bermaydi; zombi-o\'yinchining zarbasi cheklangan (50)', ff === 100 && h1 === 50, `sherik otgandan keyin jon ${ff}; zombi zarbasidan keyin ${h1}`);
  ok('halok bo\'lgan odam zombi bo\'lib qayta tug\'iladi', dead && kills.length === 1 && pl(B[2].id).zb === 1 && pl(B[2].id).hp === 60 && resp && resp.zb === 1, JSON.stringify(resp));
  await sleep(300);
  ok('sahifada u endi zombi ko\'rinishida', (await T(`(() => { const r = [...G.soldiers].find(s => s.team === 'remote' && s.id === ${B[2].id}); return r.isZ === true && r.zombie === true; })()`)) === true);
  // punktlar: B → C → D, evakuatsiya (server 4 soniyaga sozlangan)
  const P1 = sm.veh && [{ x: -56, z: 8 }, { x: 20, z: -62 }, { x: 98, z: -72 }];
  B[1].pos = [P1[0].x + 1, 0, P1[0].z + 1];
  await wait(() => A.got('zstage').some((e) => e.st === 1), 5000); await sleep(400);
  const g1 = await T(`[Z.stage, G.grenades_n, document.getElementById('objective').textContent, document.getElementById('flagStatus').textContent]`);
  ok('B punkti (server): hammaga e\'lon qilinadi, odamlarga granata beriladi', g1[0] === 1 && g1[1] === 3 && /C punktiga/.test(g1[2]) && /odamlar: \d\/3/.test(g1[3]), g1[3]);
  await shot('zmp_stage');
  B[1].pos = [P1[1].x + 1, 0, P1[1].z + 1]; await wait(() => A.got('zstage').some((e) => e.st === 2), 5000);
  B[1].pos = [P1[2].x + 1, 0, P1[2].z + 1]; await wait(() => A.got('zstage').some((e) => e.st === 3), 5000);
  await wait(() => A.got('end').length > 0, 12000);
  await sleep(500);
  const e1 = A.got('end')[0] || {}, t1 = await ev(`[document.getElementById('endTitle').textContent, document.getElementById('endStats').innerText.replace(/\\s+/g, ' ').slice(0, 120)]`);
  ok("D punktida 4 soniya turilgach — odamlar g'alabasi", e1.mode === 'zombie' && e1.side === 'humans' && /EVAKUATSIYA QILINDINGIZ/.test(t1[0]), `${t1[0]} · ${t1[1]}`);
  ok('jang davomida chaqmoq serverdan keldi (hammada bir vaqtda)', A.got('flash').length >= 1, `chaqmoqlar: ${A.got('flash').length}`);

  // ---- ikkinchi jang: sahifa zombiga aylanadi, so'ng hamma zombi bo'ladi ----
  for (const b of B) { b.events.length = 0; b.pos = [-96, 0, 96]; }
  await ev(`(document.getElementById('btnAgain').click(), 1)`); await sleep(500);
  await T(`(G.net.send({ t: 'start' }), 1)`);
  await wait(() => A.got('start').length > 0, 6000); await sleep(1500);
  await T(`(document.getElementById('pause').classList.add('hidden'), G.state = 'playing', G.bannerT = 0.01, Z.spawnT = 1e9, 1)`);
  await sleep(500);
  // jang ketayotganda qo'shilgan o'yinchi — zombi
  const late = await makeBot('Kech', code);
  await sleep(600);
  ok("jang ketayotganda qo'shilgan o'yinchi zombi bo'lib qo'shiladi", late.got('start').length === 1 && pl(late.id) && pl(late.id).zb === 1, 'zb=' + (pl(late.id) && pl(late.id).zb));
  // zombi-o'yinchi sahifadagi odamni o'ldiradi
  B[3].send({ t: 'hit', target: myId, dmg: 50, kind: 'claw' }); await sleep(250);
  B[3].send({ t: 'hit', target: myId, dmg: 50, kind: 'claw' });
  await until(`!P.alive`, 4000);
  const dz = await ev(`[document.getElementById('cmTitle').textContent, document.getElementById('cmSub').textContent]`);
  await until(`P.alive && G.isZ`, 9000); await sleep(500);
  const zme = await T(`[G.isZ, G.weapons[G.wi].def.id, G.weapons[0].locked && G.weapons[1].locked, G.torchOn, W.env.fog.far, Math.round(P.hp), document.getElementById('weaponSlots').innerText.replace(/\\n/g, ' | '), document.getElementById('objective').textContent,
    Math.min(...[...G.soldiers].filter(s => s.team === 'remote' && !s.isZ && s.alive).map(r => Math.hypot(r.pos.x - P.pos.x, r.pos.z - P.pos.z)))]`);
  ok('sahifa o\'ldi: "zombi bo\'lib qaytasiz" xabari', /YUQTIRISHDI/.test(dz[0]) && /ZOMBI/.test(dz[1]), dz[1]);
  ok('sahifa zombi bo\'lib qaytdi: panjalar, fonar yo\'q, uzoqroq ko\'radi, odamlardan uzoqroqda paydo bo\'ldi', zme[0] && zme[1] === 'claw' && zme[2] && zme[3] === false && zme[4] === 70 && zme[5] === 60 && /zombi/i.test(zme[6]) && !/G-19/.test(zme[6]) && /yuqtiring/.test(zme[7]) && zme[8] > 30, `${zme[6]} · eng yaqin odam ${Math.round(zme[8])} m`);
  await shot('zmp_zombie_view');
  // zombi transportga o'tira olmaydi; panjasi odamga zarar beradi
  await T(`(() => { const v = G.vehicles[2]; P.pos.set(v.pos.x + 2.2, 0, v.pos.z); P.vel.set(0, 0, 0); return 1; })()`); await sleep(400);
  await ev(KEY('KeyF')); await sleep(300);
  const nv = [await T(`G.inVeh === null`), await ev(`(document.getElementById('popups').lastElementChild || { textContent: '' }).textContent`)];
  B[0].pos = [-60, 0, 60]; await sleep(300);
  await T(`(P.pos.set(-60, 0, 61.4), P.vel.set(0, 0, 0), P.yaw = 0, P.pitch = 0, G.switchT = 0, G.knifeT = 0, 1)`); await sleep(500);
  const hb = pl(B[0].id).hp;
  await T(`(D.mouse.L = true, 1)`); await until(`G.knifeT > 0`); await T(`(D.mouse.L = false, 1)`); await until(`G.knifeT <= 0`); await sleep(400);
  const ha = pl(B[0].id).hp;
  ok("zombi-o'yinchi transportga o'tira olmaydi (xabar chiqadi)", nv[0] === true && /o'tira olmaydi/.test(nv[1]), nv[1]);
  ok("zombi-o'yinchining panjasi odamga zarar beradi (26)", hb - ha >= 24 && hb - ha <= 27, `${hb} → ${ha}`);
  // qolgan odamlar ham o'ldiriladi → hamma zombi → zombilar g'alabasi
  for (const victim of [B[0], B[1], B[2]]) { for (let i = 0; i < 3; i++) { B[3].send({ t: 'hit', target: victim.id, dmg: 50, kind: 'claw' }); await sleep(120); } }
  await wait(() => A.got('end').length > 0, 12000);
  await sleep(500);
  const e2 = A.got('end')[0] || {}, t2 = await ev(`[document.getElementById('endTitle').textContent, document.getElementById('endSub').textContent]`);
  ok("hamma odam zombiga aylangach — zombilar g'alabasi", e2.side === 'zombies' && e2.players.every((p) => p.zb === 1) && /ZOMBILAR G'OLIB/.test(t2[0]), `${t2[0]} · ${t2[1]}`);
  for (const b of B.concat([late])) { clearInterval(b.iv); b.close(); }
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  L(fails ? `YAKUN: ${fails} ta xato` : "YAKUN: hammasi o'tdi");
  pg.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
