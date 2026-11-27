// Zombi rejimi (tarmoq) — Karantin zonasi: 4 odam + 5-o'yinchi zombi, xost boshqaradigan zombilar, o'lgan odam zombiga aylanadi,
// vazifalar zanjiri server tomonida (qishloq → ratsiya qismlari → minora → baza → vertolyot maydoni),
// yiqilgan odamni defibrillyator bilan tiriltirish, tiriltirish punkti ratsiyasidan zombiga aylangan sherikni chaqirish,
// ikkala yakun (vertolyot evakuatsiyasi: qo'nish → bortga chiqish → kino → yakun / hamma zombiga aylanishi), jang ketayotganda qo'shilgan o'yinchi — zombi.
// Ishlatish: PORT=8191 Z_HOLD=4 Z_EVAC=0.2 node server.js   so'ng   node tests/zombie-mp.test.js
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191;
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };
const KEY = (code) => `window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' })), window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' })), 1`;

async function makeBot(name, code) {
  const b = await wsConnect(`http://localhost:${PORT}/ws`);
  b.id = 0; b.state = null; b.events = []; b.pos = [-320, 0, 316];   // halokat joyi (boshlang'ich lager)
  b.on = (o) => { if (o.t === 'joined') b.id = o.id; else if (o.t === 's') b.state = o; else b.events.push(o); };
  b.got = (t) => b.events.filter((e) => e.t === t);
  b.iv = setInterval(() => { if (b.pos) b.send({ t: 'p', x: b.pos[0], y: b.pos[1], z: b.pos[2], yw: 0, pt: 0, cr: 0, w: 0 }); }, 50);
  b.send({ t: 'join', name, code });
  await sleep(250);
  return b;
}

(async () => {
  const SH0 = await import('../js/shared.mjs');
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
  const lob = await ev(`[document.querySelector('.lobbyMode.sel').dataset.mode, (document.querySelector('.lobbyMap.sel') || { dataset: { map: '-' } }).dataset.map, document.querySelector('.lobbyMap[data-map=town]').disabled, document.getElementById('lobbyRules').textContent.slice(0, 60), document.querySelectorAll('#lobbyPlayers div').length]`);
  ok("lobbi: zombi rejimi tanlandi, xarita — o'ziniki (karantin zonasi; tanlab bo'lmaydi), 5 o'yinchi", lob[0] === 'zombie' && lob[1] === 'wild' && lob[2] === true && /Karantin zonasi/.test(lob[3]) && lob[4] === 5, lob[3]);
  await T(`(G.net.send({ t: 'start' }), 1)`);
  await wait(() => A.got('start').length > 0 && A.state);
  await sleep(1500);
  const sm = A.got('start')[0];
  const s0 = await T(`[G.state, !!G.pick, !document.getElementById('pause').classList.contains('hidden'), G.zombie, G.night, W.half, G.weapons.map(w => w.def.id).join(','), G.wi, JSON.stringify(G.vehicles.map(v => [v.type, v.pos.x, v.pos.z]))]`);
  ok("jang boshlandi: karantin zonasi (800 m), kech, klass tanlovi yo'q, to'pponcha va pichoq", sm.mode === 'zombie' && sm.map === 'wild' && sm.veh.length === 6 && sm.zstage === 0 && sm.zpt === 0 && s0[0] === 'paused' && !s0[1] && s0[2] && s0[3] && s0[4] && s0[5] === 400 && s0[6] === 'none,pistol,knife,nade' && s0[7] === 1, s0[6]);
  ok('transport joylari serverdagi ro\'yxat bilan bir xil', s0[8] === JSON.stringify(sm.veh.map((v) => [v.type, v.x, v.z])));
  await T(`(document.getElementById('pause').classList.add('hidden'), G.state = 'playing', G.bannerT = 0.01, 1)`);
  await sleep(600);
  ok('birinchi 4 o\'yinchi — odam, 5-chi — zombi (joni 120)', pl(myId).zb === 0 && pl(B[0].id).zb === 0 && pl(B[1].id).zb === 0 && pl(B[2].id).zb === 0 && pl(B[3].id).zb === 1 && pl(B[3].id).hp === 120,
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
  B[0].send({ t: 'zhit', z: zid, dmg: 400, head: 1, kind: 'bullet' });   // (zombilar kuchaytirilgan: bahaybatining joni 340)
  await wait(() => A.got('zdead').some((e) => e.z === zid), 5000);
  await sleep(300);
  const zd = A.got('zdead').find((e) => e.z === zid);
  ok("tarmoq: boshqa o'yinchi zombini o'ldirdi (xost orqali), o'ldirish unga yozildi", !!zd && zd.by === B[0].id && pl(B[0].id).k === 1 && (await T(`G.soldiers.some(s => s.isZombie && s.zid === ${zid} && s.alive)`)) === false, JSON.stringify(zd));
  // zombi odamga hujum qiladi: xost → server → o'sha o'yinchi
  B[1].pos = [-300, 0, 316];
  await sleep(400);
  await T(`(() => { Z.dirT = 1e9; G.soldiers.filter(s => s.isZombie).forEach(s => { s.alive = false; s.dispose(); }); const z = Z.spawn('walker', -300, 314.4); G.zA = z; return 1; })()`);
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
  ok('odam odamga zarar bermaydi; zombi-o\'yinchining zarbasi cheklangan (50)', ff === 100 && h1 === 50, `sherik otgandan keyin jon ${ff}; zombi zarbasidan keyin ${h1}`);
  // yiqilgan odam Z_DOWN soniya yerda yotadi: sahifada belgi va maslahat; defibrillyatorsiz tiriltirib bo'lmaydi, defibrillyator bilan — shu joyda tiriladi
  await T(`(P.pos.set(-68.6, 0, 72), P.vel.set(0, 0, 0), 1)`); await sleep(400);
  const dn = await T(`[D.revive.downedMates().map((r) => r.id).join(), document.getElementById('prompt').textContent]`);
  B[1].pos = [-69.5, 0, 72.5]; await sleep(300);
  B[1].send({ t: 'zrev', id: B[2].id }); await sleep(400);
  const noDefib = !pl(B[2].id).al;
  const defId = await T(`G.items.find((i) => i.kind === 'defib').id`);
  B[1].send({ t: 'item', id: defId, k: 'defib' }); await sleep(250);
  B[1].send({ t: 'zrev', id: B[2].id }); await wait(() => pl(B[2].id).al, 3000); await sleep(300);
  const rv = B[2].got('respawn').find((r) => r.id === B[2].id) || {};
  ok("yiqilgan odam yerda yotadi: sahifada belgi va maslahat; defibrillyatorsiz tiriltirib bo'lmaydi", dead && kills.length === 1 && dn[0] === String(B[2].id) && /Uch yiqildi — defibrillyator/.test(dn[1]) && noDefib, JSON.stringify(dn));
  ok('defibrillyator bilan sherik shu joyning o\'zida tiriladi (60 jon, odam bo\'lib)', rv.rv === B[1].id && rv.zb === 0 && Math.abs(rv.x + 70) < 0.6 && pl(B[2].id).hp === SH0.DEFIB_HP && pl(B[2].id).zb === 0 && (await T(`D.revive.downedMates().length`)) === 0, JSON.stringify(rv));
  // ikkinchi marta: hech kim tiriltirmasa — Z_DOWN soniyadan keyin zombi bo'lib qaytadi
  B[2].events.length = 0;
  await sleep(SH0.SPAWN_PROT * 1000 + 200);   // (tiriltirilgandan keyingi himoya o'tsin)
  const tK = Date.now();
  B[3].send({ t: 'hit', target: B[2].id, dmg: 50, head: false, kind: 'claw' }); await sleep(150); B[3].send({ t: 'hit', target: B[2].id, dmg: 50, head: false, kind: 'claw' });
  await wait(() => pl(B[2].id).al && pl(B[2].id).zb === 1, 14000);
  const resp = B[2].got('respawn').find((r) => r.id === B[2].id), tTurn = (Date.now() - tK) / 1000;
  ok(`halok bo'lgan odam ${SH0.Z_DOWN} soniyadan keyin zombi bo'lib qayta tug'iladi`, pl(B[2].id).zb === 1 && pl(B[2].id).hp === 120 && resp && resp.zb === 1 && tTurn > SH0.Z_DOWN - 1 && pl(B[2].id).fl === 1, `${tTurn.toFixed(1)} s · ` + JSON.stringify(resp));
  await sleep(300);
  ok('sahifada u endi zombi ko\'rinishida', (await T(`(() => { const r = [...G.soldiers].find(s => s.team === 'remote' && s.id === ${B[2].id}); return r.isZ === true && r.zombie === true; })()`)) === true);
  // tiriltirish punkti: sahifa halokat joyidagi chodirga borib [E] bosadi — zombiga aylangan sherik yana odam bo'lib chodir oldida paydo bo'ladi
  await T(`(() => { const R = W.revivePts[0]; P.pos.set(R.x + Math.sin(R.yaw) * 1.5, 0, R.z + Math.cos(R.yaw) * 1.5); P.vel.set(0, 0, 0); return 1; })()`); await sleep(500);
  const tp = await T(`[document.getElementById('prompt').textContent, W.revivePts[0].cross.visible, W.revivePts[1].cross.visible]`);
  await ev(KEY('KeyE')); await wait(() => pl(B[2].id).zb === 0, 4000); await sleep(400);
  const cb = B[2].got('respawn').filter((r) => r.id === B[2].id).pop() || {};
  const tc = await T(`[(() => { const r = [...G.soldiers].find(s => s.team === 'remote' && s.id === ${B[2].id}); return r.isZ; })(), Math.ceil(G.tentCd[0] - G.time), document.getElementById('prompt').textContent]`);
  ok("tiriltirish punkti: [E] — ratsiya orqali zombiga aylangan sherik yana odam bo'lib chodir oldida paydo bo'ladi", /Ratsiya: Uchni qayta chaqirish/.test(tp[0]) && tp[1] && !tp[2] && cb.cb === myId && cb.ri === 0 && cb.zb === 0 && pl(B[2].id).zb === 0 && pl(B[2].id).hp === 100 && !pl(B[2].id).fl && tc[0] === false && tc[1] > 30 && /ratsiya \d+ soniyadan/.test(tc[2]), JSON.stringify([tp, cb, tc]));
  // vazifalar (server): qishloq → uch qism → minora → darvoza → vertolyot maydoni (ushlab turish serverda 4 soniyaga sozlangan)
  const SH = SH0, S = SH.WILD.stages, spots = SH.wildParts(sm.seed);
  B[1].pos = [S[0].x + 1, 0, S[0].z + 1];
  await wait(() => A.got('zstage').some((e) => e.st === 1), 5000); await sleep(400);
  const g1 = await T(`[Z.stage, G.grenades_n, document.getElementById('objective').textContent, document.getElementById('flagStatus').textContent]`);
  ok("qishloq (server): hammaga e'lon qilinadi, odamlarga granata beriladi, keyingi vazifa — qismlar", g1[0] === 1 && g1[1] === 2 && /Akkumulyator — Ferma/.test(g1[2]) && /Bosqich 2\/5/.test(g1[3]) && /odamlar: \d\/\d/.test(g1[3]), g1[3]);
  await shot('zmp_stage');
  // qismni faqat yonida turgan odam oladi; uchalasi topilsa — keyingi bosqich
  B[0].send({ t: 'zpart', i: 0 }); await sleep(300);
  const farTake = A.got('zpart').length;
  for (let i = 0; i < 3; i++) { B[1].pos = [spots[i][0], spots[i][2], spots[i][1]]; await sleep(250); B[1].send({ t: 'zpart', i }); await wait(() => A.got('zpart').some((e) => e.i === i), 4000); }
  await wait(() => A.got('zstage').some((e) => e.st === 2), 5000); await sleep(400);
  const g2 = await T(`[Z.stage, Z.got.join(), document.getElementById('objective').textContent]`);
  ok("ratsiya qismlari (server): uzoqdagi o'yinchi ola olmaydi; yonidagi oladi; uchalasi topilgach — radio minora", farTake === 0 && A.got('zpart').length === 3 && A.got('zpart').every((e) => e.by === B[1].id) && g2[0] === 2 && g2[1] === 'true,true,true' && /Radio minora/.test(g2[2]) && st().zm.pt === 7, JSON.stringify([farTake, g2, st().zm]));
  B[1].pos = [S[2].x, 0, S[2].z + 2]; await wait(() => A.got('zstage').some((e) => e.st === 3), 9000);
  B[1].pos = [S[3].x, 0, S[3].z]; await wait(() => A.got('zstage').some((e) => e.st === 4), 5000); await sleep(300);
  const g4 = await T(`[Z.stage, document.getElementById('objective').textContent, +Z.dark.toFixed(2)]`);
  ok("minora ushlab turildi, baza darvozasiga yetildi: oxirgi vazifa — vertolyot maydoni; tun quyuqlashmoqda", g4[0] === 4 && /Vertolyot maydoni/.test(g4[1]) && g4[2] > 0.02, JSON.stringify(g4));
  await T(`(G.soldiers.filter(s => s.isZombie).forEach(s => { s.alive = false; s.dispose(); }), Z.dirT = 1e9, 1)`);   // (zombilar sinovga xalaqit bermasin)
  B[1].pos = [S[4].x, 0, S[4].z + 2];
  // evakuatsiya: vertolyot uchib keladi → qo'nadi → bortga chiqiladi (birinchi chiqqanidan keyin qolganlarga 'wait' soniya) → kino → yakun
  await wait(() => A.got('zevac').some((e) => e.ph === 'arrive'), 12000); await sleep(600);
  const ea = await T(`[!!D.evac(), D.evac() && D.evac().ph, D.evac() && +D.evac().h.v.pos.y.toFixed(1), document.getElementById('objective').textContent]`);
  ok("oxirgi bosqichdan keyin vertolyot uchib keladi (hamma uchun), jang tugamaydi", ea[0] && ea[1] === 'arrive' && ea[2] > 15 && /Vertolyot yaqinlashmoqda/.test(ea[3]) && A.got('end').length === 0, JSON.stringify(ea));
  await wait(() => A.got('zevac').some((e) => e.ph === 'board'), 9000); await sleep(400);
  const eb = await T(`[D.evac().ph, +D.evac().h.v.pos.y.toFixed(2), Z.mk.ring.visible, document.getElementById('objective').textContent]`);
  ok("vertolyot qo'ndi: rampa oldida yashil doira, vazifa — bortga chiqish", eb[0] === 'board' && eb[1] === 0 && eb[2] && /VERTOLYOTGA CHIQING/.test(eb[3]), JSON.stringify(eb));
  const EV = SH.WILD.evac;
  B[0].send({ t: 'zboard' }); await sleep(300);   // (uzoqdagi odam chiqa olmaydi)
  const farBoard = A.got('zevac').filter((e) => e.ph === 'board' && (e.ev || []).includes(B[0].id)).length;
  B[1].pos = [EV.bx, 0, EV.bz + 1]; await sleep(250); B[1].send({ t: 'zboard' });
  await wait(() => A.got('zevac').some((e) => (e.ev || []).includes(B[1].id)), 3000);
  await T(`(P.pos.set(${EV.bx}, 0, ${EV.bz + 1.5}), P.vel.set(0, 0, 0), 1)`);
  await until(`D.evac() && D.evac().aboard`, 4000); await sleep(2300);
  const ec = await T(`[D.evac().aboard, D.evac().walk, +Math.hypot(P.pos.x - D.evac().h.v.pos.x, P.pos.z - D.evac().h.v.pos.z).toFixed(1), document.getElementById('objective').textContent, D.evac().ev.size]`);
  await shot('zmp_evac_cabin');
  ok("bortga chiqish: uzoqdagi odam chiqa olmaydi; rampaga yetgan bot va sahifa bortda (kamera kabinada)", farBoard === 0 && ec[0] && ec[1] >= 1 && ec[2] < 3 && /Siz bortdasiz/.test(ec[3]) && ec[4] === 2, JSON.stringify(ec));
  await wait(() => A.got('zevac').some((e) => e.ph === 'leave'), 12000); await sleep(700);
  const el = await T(`[D.evac().ph, document.getElementById('cine').className, document.getElementById('hud').classList.contains('cineHide'), +D.evac().h.v.pos.y.toFixed(1)]`);
  await shot('zmp_evac_cine');
  ok("qolgan odam (Bir) yetib kelmadi — kutish vaqti tugagach vertolyot uchadi: hammada kino (keng ekran, HUD yashirin)", el[0] === 'leave' && /on/.test(el[1]) && el[2] && el[3] > 0, JSON.stringify(el));
  await wait(() => A.got('end').length > 0, 12000);
  await sleep(500);
  const e1 = A.got('end')[0] || {}, t1 = await ev(`[document.getElementById('endTitle').textContent, document.getElementById('endStats').innerText.replace(/\\s+/g, ' ').slice(0, 160), document.getElementById('cine').className]`);
  const evOf = (id) => ((e1.players || []).find((p) => p.id === id) || {}).ev;
  ok("evakuatsiya yakuni: odamlar g'alabasi; bortdagilar qutqarildi, yerda qolgan — yo'q", e1.mode === 'zombie' && e1.side === 'humans' && evOf(myId) === 1 && evOf(B[1].id) === 1 && evOf(B[0].id) === 0 && /EVAKUATSIYA QILINDINGIZ/.test(t1[0]) && /qutqarildi/.test(t1[1]) && /hidden/.test(t1[2]), `${t1[0]} · ${t1[1]}`);
  ok('tun kirgach chaqmoq serverdan keldi (hammada bir vaqtda)', A.got('flash').length >= 1, `chaqmoqlar: ${A.got('flash').length}`);

  // ---- ikkinchi jang: sahifa zombiga aylanadi, so'ng hamma zombi bo'ladi ----
  for (const b of B) { b.events.length = 0; b.pos = [-320, 0, 316]; }
  await ev(`(document.getElementById('btnAgain').click(), 1)`); await sleep(500);
  await T(`(G.net.send({ t: 'start' }), 1)`);
  await wait(() => A.got('start').length > 0, 6000); await sleep(1500);
  await T(`(document.getElementById('pause').classList.add('hidden'), G.state = 'playing', G.bannerT = 0.01, Z.dirT = 1e9, 1)`);
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
  ok('sahifa zombi bo\'lib qaytdi: panjalar, fonar yo\'q, uzoqroq ko\'radi, odamlardan uzoqroqda paydo bo\'ldi', zme[0] && zme[1] === 'claw' && zme[2] && zme[3] === false && zme[4] >= 70 && zme[5] === SH0.Z_HP && /zombi/i.test(zme[6]) && !/G-19/.test(zme[6]) && /yuqtiring/.test(zme[7]) && zme[8] > 30, `${zme[6]} · eng yaqin odam ${Math.round(zme[8])} m`);
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
