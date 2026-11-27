// Yangi rejimlar: gun game (qurol darajalari, pichoq bilan g'alaba) va jang maydoni (qurolsiz tushish, o'lja, shlem,
// qayta tug'ilmaslik, oxirgi tirik qolgan g'olib). 1-qism — faqat server (WebSocket botlar); 2-qism — brauzerdagi mijoz.
// Ishlatish: PORT=8191 GG_RESPAWN=0.3 ZJ_SEED=7 ZJ_MAP=town node server.js   so'ng   node tests/modes.test.js   (ZJ_NO_PAGE=1 — faqat 1-qism)
const { wsConnect, openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191, era = process.argv[2] || 'modern';
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };
const mk = async () => { const w = await wsConnect(`http://localhost:${PORT}/ws`); const b = { w, ev: [], code: null, id: 0, state: null, lobby: null };
  w.on = (o) => { if (o.t === 'joined') { b.code = o.code; b.id = o.id; } else if (o.t === 's') b.state = o; else if (o.t === 'lobby') b.lobby = o; else b.ev.push(o); }; return b; };
const wait = async (fn, ms = 6000) => { for (let i = 0; i < ms / 40; i++) { if (fn()) return true; await sleep(40); } return false; };

(async () => {
  const SH = await import('../js/shared.mjs'), N = SH.GG_LADDER.length;
  // ================= 1-qism: server =================
  // --- gun game: har kim o'zi uchun ---
  {
    const A = await mk(), B = await mk();
    A.w.send({ t: 'create', name: 'A', era }); await wait(() => A.code);
    A.w.send({ t: 'mode', mode: 'gg' }); B.w.send({ t: 'join', name: 'B', code: A.code }); await wait(() => B.id && A.lobby && A.lobby.mode === 'gg' && A.lobby.players.length === 2);
    A.w.send({ t: 'start' }); await wait(() => A.state && B.state);
    const st = A.ev.find((e) => e.t === 'start');
    ok('gun game boshlandi: jamoasiz, hamma 1-darajada', !!st && st.mode === 'gg' && !st.teams && A.state.p.every((p) => p.g === 0), JSON.stringify(st && [st.mode, st.teams, A.state.p.map((p) => p.g)]));
    const iv = setInterval(() => { A.w.send({ t: 'p', x: 0, y: 0, z: 0, yw: 0, pt: 0 }); B.w.send({ t: 'p', x: 5, y: 0, z: 0, yw: 0, pt: 0 }); }, 60);
    const P = (X) => A.state.p.find((p) => p.id === X.id) || {};
    // (qayta tug'ilgan o'yinchi bir necha soniya himoyada — o'shanda o'q ta'sir qilmaydi; himoya o'tishini kutamiz)
    const kill = async (K, V, kind) => { await wait(() => P(V).al && P(K).al, 5000); if (V.dead) { await sleep(SH.SPAWN_PROT * 1000 + 120); V.dead = false; } K.w.send({ t: 'hit', target: V.id, dmg: 500, kind }); await wait(() => !P(V).al, 2500); V.dead = true; await sleep(90); };
    await kill(A, B, 'bullet');
    ok("o'q bilan o'ldirish darajani oshiradi", P(A).g === 1 && A.ev.some((e) => e.t === 'gg' && e.id === A.id && e.lv === 1 && !e.down), JSON.stringify(P(A).g));
    await kill(A, B, 'grenade');
    ok("granata bilan o'ldirish darajani oshirmaydi", P(A).g === 1, JSON.stringify(P(A).g));
    await kill(B, A, 'knife');
    ok("pichoq: o'ldirgan ko'tariladi, o'ldirilgan bir daraja tushadi", P(B).g === 1 && P(A).g === 0 && A.ev.some((e) => e.t === 'gg' && e.id === A.id && e.down), JSON.stringify([P(B).g, P(A).g]));
    const t0 = Date.now();
    for (let i = P(A).g; i < N - 1; i++) await kill(A, B, 'bullet');
    ok(`ketma-ket o'ldirishlar bilan oxirgi (${N}-) darajaga yetiladi; qayta tug'ilish tez`, P(A).g === N - 1 && Date.now() - t0 < N * (SH.GG_RESPAWN * 1000 + SH.SPAWN_PROT * 1000 + 1500), JSON.stringify([P(A).g, Date.now() - t0]));
    await kill(A, B, 'bullet');
    ok("oxirgi darajada o'q bilan o'ldirish g'alaba keltirmaydi", P(A).g === N - 1 && !A.ev.some((e) => e.t === 'end'), '');
    await kill(A, B, 'knife');
    await wait(() => A.ev.some((e) => e.t === 'end'), 3000);
    const end = A.ev.find((e) => e.t === 'end');
    ok("oxirgi darajada pichoq bilan o'ldirish — g'alaba", !!end && end.mode === 'gg' && end.winner === A.id && end.players.find((p) => p.id === A.id).gg === N - 1 && A.lobby.state === 'lobby', JSON.stringify(end && [end.mode, end.winner, end.players.map((p) => p.gg)]));
    clearInterval(iv); A.w.close(); B.w.close(); await sleep(200);
  }
  // --- gun game: jamoa bo'lib (sherikka o'q tegmaydi) ---
  {
    const A = await mk(), B = await mk(), C = await mk();
    A.w.send({ t: 'create', name: 'A', era }); await wait(() => A.code);
    A.w.send({ t: 'mode', mode: 'gg' }); A.w.send({ t: 'teams', on: 1 });
    B.w.send({ t: 'join', name: 'B', code: A.code }); C.w.send({ t: 'join', name: 'C', code: A.code }); await wait(() => B.id && C.id && A.lobby.team === 1);
    A.w.send({ t: 'team', tm: 1 }); B.w.send({ t: 'team', tm: 1 }); C.w.send({ t: 'team', tm: 2 }); await sleep(200);
    A.w.send({ t: 'start' }); await wait(() => A.state && C.state);
    const st = A.ev.find((e) => e.t === 'start'), P = (X) => A.state.p.find((p) => p.id === X.id) || {};
    const iv = setInterval(() => { for (const X of [A, B, C]) X.w.send({ t: 'p', x: X.id, y: 0, z: 0, yw: 0, pt: 0 }); }, 60);
    await sleep(200);
    A.w.send({ t: 'hit', target: B.id, dmg: 500, kind: 'bullet' }); await sleep(300);
    const mate = [P(B).al, P(B).hp, P(A).g];
    A.w.send({ t: 'hit', target: C.id, dmg: 500, kind: 'bullet' }); await wait(() => !P(C).al, 2000); await sleep(100);
    ok("gun game jamoa bo'lib: sherikka zarar yetmaydi, raqibni o'ldirish darajani oshiradi", st.teams === 1 && mate[0] === true && mate[1] === 100 && mate[2] === 0 && P(A).g === 1 && P(A).tm === 1 && P(C).tm === 2, JSON.stringify([st.teams, mate, P(A).g]));
    clearInterval(iv); A.w.close(); B.w.close(); C.w.close(); await sleep(200);
  }
  // --- jang maydoni ---
  {
    const A = await mk(), B = await mk(), C = await mk();
    A.w.send({ t: 'create', name: 'A', era }); await wait(() => A.code);
    A.w.send({ t: 'mode', mode: 'br' }); A.w.send({ t: 'zone', on: 0 });
    B.w.send({ t: 'join', name: 'B', code: A.code }); C.w.send({ t: 'join', name: 'C', code: A.code }); await wait(() => B.id && C.id && A.lobby.mode === 'br');
    A.w.send({ t: 'start' }); await wait(() => A.state && B.state && C.state);
    const st = A.ev.find((e) => e.t === 'start'), P = (X) => A.state.p.find((p) => p.id === X.id) || {};
    ok("jang maydoni boshlandi: zona doim bor (o'chirilgan bo'lsa ham), hamma tirik", st.mode === 'br' && Array.isArray(A.state.zn) && A.state.p.every((p) => p.al && !p.o) && A.state.it === undefined, JSON.stringify([st.mode, !!A.state.zn, A.state.p.map((p) => [p.al, p.o])]));
    const iv = setInterval(() => { for (const X of [A, B, C]) X.w.send({ t: 'p', x: X.id, y: 0, z: 0, yw: 0, pt: 0 }); }, 60);
    await sleep(150);
    // o'lja: faqat jang maydoni raqamlari, bir marta olinadi; shlem boshga tekkan zararning yarmini oladi
    const id = SH.BR_BASE + 5;
    A.w.send({ t: 'item', id: 3, k: 'med' }); A.w.send({ t: 'item', id, k: 'helm', lv: 2 }); B.w.send({ t: 'item', id, k: 'helm', lv: 3 }); await sleep(300);
    const items = B.ev.filter((e) => e.t === 'item');
    ok("o'lja: eski raqamlar rad etiladi; har narsani faqat birinchi so'ragan oladi", items.length === 1 && items[0].id === id && items[0].by === A.id, JSON.stringify(items));
    B.w.send({ t: 'hit', target: A.id, dmg: 100, head: true, kind: 'bullet' }); await wait(() => A.ev.some((e) => e.t === 'hurt'), 2000);
    const hurt = A.ev.find((e) => e.t === 'hurt');
    ok("shlem (2-daraja): boshga 100 zarardan 50 tasi o'tadi", !!hurt && hurt.hp === 50 && hurt.hl === 2 && P(A).al, JSON.stringify(hurt));
    A.w.send({ t: 'hit', target: B.id, dmg: 100, head: true, kind: 'bullet' }); await wait(() => !P(B).al, 2000);
    await sleep(SH.RESPAWN * 1000 + 700);
    ok("halok bo'lgan o'yinchi qayta tug'ilmaydi (3-o'rin), jang davom etadi", P(B).al === false && P(B).o === 1 && !B.ev.some((e) => e.t === 'respawn') && !A.ev.some((e) => e.t === 'end'), JSON.stringify([P(B).al, P(B).o]));
    // kech qo'shilgan o'yinchi — kuzatuvchi
    const D = await mk(); D.w.send({ t: 'join', name: 'D', code: A.code }); await wait(() => D.state && P(D).id);
    ok("jang o'rtasida qo'shilgan o'yinchi kuzatuvchi bo'ladi", P(D).al === false && P(D).o === 1 && D.ev.some((e) => e.t === 'start'), JSON.stringify([P(D).al, P(D).o]));
    A.w.send({ t: 'hit', target: C.id, dmg: 500, kind: 'bullet' }); await wait(() => A.ev.some((e) => e.t === 'end'), 3000);
    const end = A.ev.find((e) => e.t === 'end'), pl = (X) => (end.players.find((p) => p.id === X.id) || {}).place;
    ok("oxirgi tirik qolgan g'olib; o'rinlar to'g'ri", !!end && end.mode === 'br' && end.winner === A.id && pl(A) === 1 && pl(C) === 2 && pl(B) === 3, JSON.stringify(end && [end.winner, end.players.map((p) => [p.name, p.place])]));
    clearInterval(iv); for (const X of [A, B, C, D]) X.w.close(); await sleep(200);
  }
  // --- jang maydoni: tirik o'yinchi chiqib ketsa, qolgan yagona o'yinchi g'olib ---
  {
    const A = await mk(), B = await mk(), C = await mk();
    A.w.send({ t: 'create', name: 'A', era }); await wait(() => A.code);
    A.w.send({ t: 'mode', mode: 'br' });
    B.w.send({ t: 'join', name: 'B', code: A.code }); C.w.send({ t: 'join', name: 'C', code: A.code }); await wait(() => B.id && C.id);
    A.w.send({ t: 'start' }); await wait(() => A.state && C.state);
    const iv = setInterval(() => { for (const X of [A, B, C]) X.w.send({ t: 'p', x: X.id, y: 0, z: 0, yw: 0, pt: 0 }); }, 60);
    await sleep(150);
    A.w.send({ t: 'hit', target: B.id, dmg: 500, kind: 'bullet' }); await sleep(300);
    C.w.send({ t: 'leave' }); await wait(() => A.ev.some((e) => e.t === 'end'), 3000);
    const end = A.ev.find((e) => e.t === 'end');
    ok("raqib chiqib ketsa, yagona tirik o'yinchi g'olib", !!end && end.mode === 'br' && end.winner === A.id, JSON.stringify(end && [end.mode, end.winner]));
    clearInterval(iv); for (const X of [A, B, C]) X.w.close(); await sleep(200);
  }
  if (process.env.ZJ_NO_PAGE) { L(fails ? `\n${fails} ta xato` : '\nHammasi joyida'); process.exit(fails ? 1 : 0); }
  // ================= 2-qism: brauzerdagi mijoz =================
  const A = await mk(), B = await mk();
  A.w.send({ t: 'create', name: 'Bot', era }); await wait(() => A.code);
  A.w.send({ t: 'mode', mode: 'gg' }); await wait(() => A.lobby && A.lobby.mode === 'gg');
  const pg = await openPage(`http://localhost:${PORT}/?kod=${A.code}&ism=Ali`, { port: 9541, dir: 'p_modes' });
  const { ev, shot } = pg;
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player; return ${body}; })()`);
  const until = async (cond, ms = 6000) => { for (let i = 0; i < ms / 100; i++) { if (await T(cond)) return true; await sleep(100); } return false; };
  await until(`!!(G.mpRoom && G.mpRoom.players.length === 2)`, 9000);
  const lob = await T(`[[...document.querySelectorAll('.lobbyMode')].map((b) => b.dataset.mode).join(), (document.querySelector('.lobbyMode.sel') || { dataset: {} }).dataset.mode, getComputedStyle(document.getElementById('lobbyTeamsRow')).display, /Gun game/.test(document.getElementById('lobbyRules').innerText)]`);
  ok("lobbida yangi rejimlar; gun game tanlangan, 'jamoa / har kim' tanlovi ko'rinadi", /br/.test(lob[0]) && /gg/.test(lob[0]) && lob[1] === 'gg' && lob[2] !== 'none' && lob[3], JSON.stringify(lob));
  const pid = await T(`G.myId`), alive = (id) => ((A.state && A.state.p.find((p) => p.id === id)) || {}).al;
  // --- gun game ---
  A.w.send({ t: 'start' });
  await until(`G.mp && G.mpMode === 'gg' && G.state === 'paused'`, 9000); await sleep(500);
  const g0 = await T(`[G.ggLv, G.weapons[0].def.id, G.weapons[0].inf === true, G.grenades_n, G.wi, document.getElementById('pauseTitle').textContent, G.loot.length, G.pickups.length]`);
  ok('gun game: birinchi daraja quroli (eng kuchlisi), o\'qi cheksiz, granata va xonalardagi qurollar yo\'q', g0[0] === 0 && g0[1] === SH.GG_LADDER[0] && g0[2] && g0[3] === 0 && g0[4] === 0 && /GUN GAME/.test(g0[5]) && g0[6] === 0 && g0[7] === 0, JSON.stringify(g0));
  await T(`(document.getElementById('pause').classList.add('hidden'), G.state = 'playing', 1)`);
  const iv = setInterval(() => { A.w.send({ t: 'p', x: 3, y: 0, z: 3, yw: 0, pt: 0 }); if (B.id) B.w.send({ t: 'p', x: -3, y: 0, z: 3, yw: 0, pt: 0 }); }, 60);
  await sleep(300);
  await T(`(G.net.send({ t: 'hit', target: ${A.id}, dmg: 500, kind: 'bullet' }), 1)`);
  await until(`G.ggLv === 1`, 4000); await sleep(200);
  const g1 = await T(`[G.ggLv, G.weapons[0].def.id, document.getElementById('scoreLabel').textContent, document.getElementById('waveLabel').textContent]`);
  ok("o'ldirgach keyingi qurol beriladi (2-daraja), HUD da daraja ko'rinadi", g1[0] === 1 && g1[1] === SH.GG_LADDER[1] && g1[2] === `2/${N}` && /GUN GAME/.test(g1[3]), JSON.stringify(g1));
  await shot(`modes_${era}_gg`);
  await wait(() => alive(A.id), 4000);
  A.w.send({ t: 'hit', target: pid, dmg: 500, kind: 'knife' });
  await until(`!P.alive`, 3000); await until(`P.alive`, 5000); await sleep(200);
  const g2 = await T(`[G.ggLv, G.weapons[0].def.id, P.alive, G.grenades_n]`);
  ok("pichoq yegach bir daraja pastga tushadi va tez qayta tug'iladi", g2[0] === 0 && g2[1] === SH.GG_LADDER[0] && g2[2] && g2[3] === 0, JSON.stringify(g2));
  // bot hamma darajalardan o'tib, pichoq bilan g'alaba qozonadi
  // (qayta tug'ilgan o'yinchi SPAWN_PROT soniya himoyada — har gal shuni kutamiz)
  const prot = () => sleep(SH.SPAWN_PROT * 1000 + 150);
  for (let i = 0; i < N - 1; i++) { await wait(() => alive(pid) && alive(A.id), 4000); await prot(); A.w.send({ t: 'hit', target: pid, dmg: 500, kind: 'bullet' }); await wait(() => !alive(pid), 3000); }
  await wait(() => alive(pid), 4000); await prot(); A.w.send({ t: 'hit', target: pid, dmg: 500, kind: 'knife' });
  await until(`G.state === 'over'`, 5000); await sleep(300);
  const ge = await T(`[document.getElementById('endTitle').textContent, document.getElementById('endStats').innerText.replace(/\\s+/g, ' ').slice(0, 160), !document.getElementById('end').classList.contains('hidden')]`);
  ok("gun game yakuni: g'olib va darajalar jadvali", /G'OLIB: Bot/.test(ge[0]) && ge[2] && new RegExp(`${N}/${N}`).test(ge[1]) && /Daraja/.test(ge[1]), JSON.stringify(ge));
  // --- jang maydoni (3 o'yinchi: 2 bot + sahifa) ---
  B.w.send({ t: 'join', name: 'Bot2', code: A.code }); await wait(() => B.id);
  A.w.send({ t: 'mode', mode: 'br' }); await wait(() => A.lobby.mode === 'br' && A.lobby.players.length === 3);
  A.state = null; A.w.send({ t: 'start' });
  await until(`G.mpMode === 'br' && G.state === 'paused'`, 9000); await sleep(700);
  const b0 = await T(`[Math.round(P.pos.y), G.weapons[0].locked, G.weapons[1].locked, G.wi, G.loot.length, G.loot.every((l) => !l.mesh || Math.hypot(l.pos.x - P.pos.x, l.pos.z - P.pos.z) < 46), G.items.length, [...new Set(G.items.map((i) => i.kind))].sort().join(), document.getElementById('pauseTitle').textContent, G.grenades_n, G.chute]`);
  ok("jang maydoni: qurolsiz, balandda paydo bo'ladi; uylarda qurol, shlem, qo'shimcha va boshqa o'lja", b0[0] > 140 && b0[1] && b0[2] && b0[3] === 2 && b0[4] > 5 && b0[5] && b0[6] > 10 && /helm/.test(b0[7]) && /att/.test(b0[7]) && /ammo/.test(b0[7]) && /SAKRASH/.test(b0[8]) && b0[9] === 0 && !b0[10], JSON.stringify(b0));
  await T(`(document.getElementById('pause').classList.add('hidden'), G.state = 'playing', 1)`);
  await until(`G.chute`, 20000);
  const c0 = await T(`[G.chute, Math.round(P.pos.y), G.brDropping, document.getElementById('waveLabel').textContent, document.getElementById('enemyLabel').textContent]`);
  ok("parashyut pastda o'zi ochiladi; HUD: tiriklar soni", c0[0] && c0[1] < 64 && c0[1] > 3 && /JANG MAYDONI/.test(c0[3]) && /Tirik: 3/.test(c0[4]), JSON.stringify(c0));
  await shot(`modes_${era}_br_chute`);
  await until(`P.onGround`, 40000);
  // qurol topish (birinchi qavatdagi xonadan; qurol ko'rinishi faqat yaqinlashganda yasaladi)
  const lt = await T(`(() => { const l = G.loot.find((q) => q.pos.y < 1 && !q.taken); P.pos.set(l.pos.x + 0.7, l.pos.y, l.pos.z); P.vel.set(0, 0, 0); P.yaw = Math.PI / 2; P.pitch = -0.5; return [l.id, l.def.id]; })()`);
  const slot = /pistol/.test(lt[1]) ? 1 : 0;
  await sleep(500);
  const took = await T(`D.tryLoot()`);
  await until(`!G.weapons[${slot}].locked`, 3000); await sleep(200);
  const w0 = await T(`(() => { const w = G.weapons[${slot}]; return [w.def.id, w.mag === w.def.mag, w.reserve, w.def.reserve, G.wi, !!G.loot.find((q) => q.id === ${lt[0]}).taken]; })()`);
  ok("uydan qurol olinadi: to'la magazin va bir zaxira", took && w0[0] === lt[1] && w0[1] && w0[2] > 0 && w0[2] <= w0[3] && w0[4] === slot && w0[5], JSON.stringify([took, w0]));
  // shlem, qo'shimcha va o'q-dori: ustidan yurib o'tganda olinadi
  const grab = async (kind, extra = 'true') => {
    const it = await T(`(() => { const it = G.items.find((i) => i.kind === '${kind}' && !i.taken && i.pos.y < 1 && (${extra})); if (!it) return null; P.pos.set(it.pos.x, it.pos.y, it.pos.z); P.vel.set(0, 0, 0); return [it.id, it.sub || null, it.lv || 0]; })()`);
    if (it) await until(`G.itemById.get(${it[0]}).taken`, 3000);
    await sleep(250);
    return it;
  };
  const hm = await grab('helm');
  const h1 = await T(`[G.helm, document.getElementById('meds').textContent]`);
  ok("shlem olinadi va HUD da ko'rinadi", !!hm && h1[0] === hm[2] && /SHLEM/.test(h1[1]), JSON.stringify([hm, h1]));
  const W = await ev(`import('/js/weapons.js').then((m) => Object.keys(m.ATTACH).filter((a) => m.attachFits(a, '${lt[1]}')))`);
  const at = await grab('att', `${JSON.stringify(W)}.includes(i.sub)`);
  const a1 = await T(`[G.brAtt && [...G.brAtt], G.weapons[${slot}].def.att || [], G.weapons[${slot}].def.id]`);
  ok("qo'shimcha (pritsel, magazin...) qurolga o'rnatiladi", !!at && a1[0].includes(at[1]) && a1[1].includes(at[1]) && a1[2] === lt[1], JSON.stringify([at, a1]));
  const r0 = await T(`G.weapons[${slot}].reserve`);
  const am = await grab('ammo');
  const r1 = await T(`[G.weapons[${slot}].reserve, G.weapons[${slot}].def.reserve]`);
  ok("o'q-dori qutisi zaxirani to'ldiradi", !!am && (r1[0] > r0 || r1[0] === r1[1]), JSON.stringify([r0, r1]));
  await shot(`modes_${era}_br_loot`);
  // halok bo'lish: qayta tug'ilmaydi, o'ldirganni kuzatadi; so'ng bot2 ham o'ladi — jang tugaydi
  await wait(() => alive(pid), 3000);
  A.w.send({ t: 'hit', target: pid, dmg: 500, kind: 'bullet' });
  await until(`!P.alive && G.brOut`, 4000); await sleep(1200);
  const sp = await T(`[G.brOut, G.spec, G.brPlace, +Math.hypot(D.camera.position.x - 3, D.camera.position.z - 3).toFixed(1), document.getElementById('objective').textContent]`);
  ok("halok bo'lgach qayta tug'ilmaydi: 3-o'rin, o'ldirgan o'yinchini kuzatadi", sp[0] && sp[1] === A.id && sp[2] === 3 && sp[3] < 6 && /Kuzatuv/.test(sp[4]), JSON.stringify(sp));
  await shot(`modes_${era}_br_spec`);
  await sleep(SH.RESPAWN * 1000 + 500);
  const still = await T(`[P.alive, G.brOut]`);
  ok("bir necha soniyadan keyin ham qayta tug'ilmagan", still[0] === false && still[1], JSON.stringify(still));
  A.w.send({ t: 'hit', target: B.id, dmg: 500, kind: 'bullet' });
  await until(`G.state === 'over'`, 5000); await sleep(300);
  const be = await T(`[document.getElementById('endTitle').textContent, document.getElementById('endStats').innerText.replace(/\\s+/g, ' ').slice(0, 200)]`);
  ok("jang maydoni yakuni: oxirgi tirik qolgan g'olib, o'rinlar jadvali", /G'OLIB: Bot/.test(be[0]) && /1-o'rin/.test(be[1]) && /3-o'rin/.test(be[1]), JSON.stringify(be));
  ok("konsolda xato yo'q", pg.errors.length === 0, pg.errors.slice(0, 3).map((e) => String(e).slice(0, 300)).join(' | '));
  clearInterval(iv); A.w.close(); B.w.close(); pg.close();
  L(fails ? `\n${fails} ta xato` : '\nHammasi joyida');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
