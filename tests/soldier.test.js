// Askar modeli: har bir tur xatosiz yig'iladi, bo'g'imlari ishlaydi (tizza, tirsak-qurol, bosh), nishon qutisi o'z joyida,
// umumiy geometriya bitta askar o'chirilganda buzilmaydi, halok bo'lgan askar yerga yotadi.
// Ishlatish: PORT=8191 node server.js   so'ng   node tests/soldier.test.js [historical|modern]
const { openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191, era = process.argv[2] || 'modern';
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };

(async () => {
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9441, dir: 'p_soldier' });
  const { ev, shot } = pg;
  await sleep(2500);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, A = window.__anim; return ${body}; })()`);
  await ev(`(() => { const G = window.__G, D = window.__dbg; document.querySelectorAll('.era').forEach(e => { if (e.dataset.era === '${era}') e.click(); }); document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 99999; G.bannerT = 0.01; D.player.hp = 1e9;
    D.player.pos.set(0, 0, 36); D.player.yaw = Math.PI; D.player.vel.set(0, 0, 0);
    for (const s of G.soldiers) if (s.team === 'enemy') { s.alive = false; s.root.visible = false; s.remove = true; }
    G.soldiers = G.soldiers.filter(s => s.team !== 'enemy');
    for (const t of ['rifle', 'smg', 'heavy', 'sniper', 'officer', 'rifle', 'rifle', 'rifle']) D.spawnEnemy(t);   // 4 ta 'rifle': uch xil variantdan kamida ikkitasi bir xil chiqadi
    G.T = G.soldiers.filter(s => s.team === 'enemy').concat(G.soldiers.filter(s => s.team === 'ally').slice(0, 1));
    G.T.forEach((s, i) => { s.update = () => {}; s.pos.set((i - 4) * 1.3, 0, 41); s.yaw = Math.PI; s.vel.set(0, 0, 0); s.root.position.copy(s.pos); s.root.rotation.y = s.yaw; });
    return G.T.length; })()`);
  await sleep(400);
  // suyakli model (assets/models/chars) yuklanishini kutamiz: modellar menyu paytida yuklanadi
  for (let i = 0; i < 40 && !(await T(`G.T.every((s) => !s.charName || s.skin)`)); i++) { await T(`(G.T.forEach((s) => A(s, 0.016, 0, false, 0)), 1)`); await sleep(150); }
  // kodda qurilgan bo'g'imlar har doim bor (harakat va nishon hisobi shularda); suyakli model bo'lsa — ko'rinadigani faqat model va qurol
  const parts = await T(`G.T.map(s => { let m = 0, tri = 0, vis = 0; s.root.traverse(o => { if (o.isMesh) { m++; const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; let v = true; for (let x = o; x && x !== s.root; x = x.parent) v = v && x.visible; if (v) { vis++; tri += n; } } });
    return [s.type, s.team, !!(s.legL && s.shinL && s.legR && s.shinR && s.upper && s.torso && s.head && s.armsG && s.gun), m, Math.round(tri), +s.muzzleLocal.z.toFixed(2), s.skin ? s.skin.name : null, vis]; })`);
  ok("har bir tur bo'g'imli model bilan yig'iladi (oyoq, boldir, tana, bosh, qo'l, qurol); suyakli model ulangan, ko'rinadigan uchburchaklar me'yorda", parts.length === 9 && parts.every((p) => p[2] && p[3] >= 12 && p[3] <= 40 && p[4] > 1500 && p[4] < 40000 && p[5] > 0.3 && p[6]),
    parts.map((p) => `${p[0]}:${p[6] || 'kod'} ${p[7]}/${p[3]} bo'lak, ${p[4]} uchb.`).join(' · '));
  // yurish: tizza bukiladi (boldir burchagi o'zgaradi), oyoqlar qarama-qarshi fazada
  const walk = await T(`(() => { const s = G.T[0]; s.crouchAmt = 0; let minL = 9, maxL = -9, opp = 0, maxSw = 0;
    for (let i = 0; i < 80; i++) { A(s, 0.03, 3.5, false, 0); minL = Math.min(minL, s.shinL.rotation.x); maxL = Math.max(maxL, s.shinL.rotation.x); maxSw = Math.max(maxSw, Math.abs(s.legL.rotation.x)); if (Math.sign(s.legL.rotation.x + 0.04) !== Math.sign(s.legR.rotation.x + 0.04)) opp++; }
    return [+minL.toFixed(2), +maxL.toFixed(2), opp, +maxSw.toFixed(2)]; })()`);
  ok('yurganda tizza bukiladi, oyoqlar navbat bilan harakatlanadi', walk[1] - walk[0] > 0.5 && walk[0] >= 0 && walk[2] > 60 && walk[3] > 0.3 && walk[3] < 0.7, JSON.stringify(walk));
  // nishonga olish: qurol yelkaga ko'tariladi va nishon balandligiga qaratiladi; bo'sh paytda pastga tushirilgan
  const aim = await T(`(() => { const s = G.T[0]; for (let i = 0; i < 60; i++) A(s, 0.05, 0, false, 0); const ready = s.armsG.rotation.x;
    for (let i = 0; i < 60; i++) A(s, 0.05, 0, true, 0); const flat = s.armsG.rotation.x;
    for (let i = 0; i < 60; i++) A(s, 0.05, 0, true, 0.4); const up = s.armsG.rotation.x + s.torso.rotation.x;
    return [+ready.toFixed(2), +flat.toFixed(2), +up.toFixed(2)]; })()`);
  ok('qurol: bo\'sh paytda pastda, nishonda — yelkada, baland nishonga — yuqoriga', aim[0] > 0.35 && Math.abs(aim[1]) < 0.08 && aim[2] < -0.2, JSON.stringify(aim));
  // cho'kkalash: tana 0,45 m pastga tushadi, old oyoq tovoni yerda, orqa tizza yerda
  const cr = await T(`(() => { const s = G.T[0]; s.crouchAmt = 1; A(s, 0.01, 0, true, 0); s.root.updateMatrixWorld(true);
    const V3 = P.pos.constructor, f = new V3(), k = new V3(); s.shinL.localToWorld(f.set(0, -0.5, 0.05)); s.shinR.getWorldPosition(k);
    const r = [+s.upper.position.y.toFixed(2), +f.y.toFixed(2), +k.y.toFixed(2)]; s.crouchAmt = 0; A(s, 0.01, 0, true, 0); return r; })()`);
  ok('cho\'kkalash: bir tizzada (old oyoq tagi va orqa tizza yer sathida)', Math.abs(cr[0] + 0.45) < 0.02 && Math.abs(cr[1]) < 0.09 && Math.abs(cr[2]) < 0.12, JSON.stringify(cr));
  // nishon qutisi: bosh balandligidagi o'q — boshga, ko'krak balandligidagi — tanaga, bosh ustidan — tegmaydi
  const hit = await T(`(() => { const s = G.T[5], V3 = P.pos.constructor, d = new V3(0, 0, 1), o = (y) => new V3(s.pos.x, s.pos.y + y, s.pos.z - 5);
    const a = s.hitTest(o(1.65 * s.s), d, 50), b = s.hitTest(o(1.2 * s.s), d, 50), c = s.hitTest(o(1.95 * s.s), d, 50); return [a ? a.head : null, b ? b.head : null, c === null]; })()`);
  ok('nishon qutisi modelga mos: bosh / tana / bosh ustidan o\'tadi', hit[0] === true && hit[1] === false && hit[2] === true, JSON.stringify(hit));
  await shot(`soldier_${era}_lineup`);
  // umumiy geometriya: bir xil turdagi ikki askar bittasini ishlatadi; biri o'chirilganda ikkinchisi buzilmaydi
  const sh = await T(`(() => { const r = G.T.filter(s => s.type === 'rifle' && s.team === 'enemy'); const geo = (s) => { const out = new Set(); s.root.traverse(o => { if (o.isMesh) out.add(o.geometry.uuid); }); return out; };
    // bir xil variantli juftlik (ko'rinishi aynan bir xil ikki askar)
    let one = null, keep = null; for (const x of r) for (const y of r) if (x !== y && x.variant === y.variant && !one) { one = x; keep = y; }
    const a = geo(one); let shared = 0; for (const u of geo(keep)) if (a.has(u)) shared++;
    one.dispose();
    let cnt = 0; keep.root.traverse(o => { if (o.isMesh) cnt += o.geometry.attributes.position.count; }); return [shared > 5, one.remove, cnt > 3000, keep.root.parent !== null]; })()`);
  await sleep(500);
  ok('geometriya bir xil turdagi askarlar uchun umumiy; biri o\'chirilganda boshqasi saqlanadi', sh[0] && sh[1] && sh[2] && sh[3], JSON.stringify(sh));
  // halok bo'lish: tana yerga yotadi (old yoki orqa tomonga), qurol tana bo'ylab
  const dead = await T(`(() => { const out = []; [G.T[1], G.T[2]].forEach((s, i) => { const from = P.pos.clone(); if (i) { from.x = s.pos.x; from.z = s.pos.z + 5; } s.damage(9999, from, false, 'player', 'bullet'); for (let k = 0; k < 60; k++) s.updateDead(0.05);
    out.push([s.alive, +s.root.rotation.x.toFixed(2), +s.armsG.rotation.x.toFixed(2), +s.root.position.y.toFixed(2)]); }); return out; })()`);
  ok('halok bo\'lgan askar yerga yotadi (biri yuztuban, biri chalqancha)', dead.every((d) => d[0] === false && Math.abs(Math.abs(d[1]) - 1.51) < 0.05 && Math.abs(d[2]) > 1.2 && d[3] < 0.15) && Math.sign(dead[0][1]) !== Math.sign(dead[1][1]), JSON.stringify(dead));
  await sleep(300);
  await shot(`soldier_${era}_dead`);
  L('JS xatolari soni:', pg.errors.length);
  fails += pg.errors.length;
  L(fails ? `YAKUN: ${fails} ta xato` : "YAKUN: hammasi o'tdi");
  pg.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
