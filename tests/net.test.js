// Tarmoq serverining chekka holatlari (brauzersiz, faqat WebSocket botlar bilan):
// jamoaviy jangda bir jamoa bo'shab qolishi, server sezmagan uzilishdan keyin qayta ulanish, xost almashishi,
// lobbidan chiqish, jang tugagach holat tozalanishi, zombi rejimida sun'iy zombi buzgan transport hisobi.
// Ishlatish: PORT=8191 ZJ_MAP=town ZJ_ZONE=0 node server.js   so'ng   node tests/net.test.js
const { wsConnect, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191;
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };
const mk = async () => { const w = await wsConnect(`http://localhost:${PORT}/ws`); const b = { w, ev: [], code: null, id: 0, key: null, re: 0, state: null, lobby: null };
  w.on = (o) => { if (o.t === 'joined') { b.code = o.code; b.id = o.id; b.key = o.key; b.re = o.re || 0; } else if (o.t === 's') b.state = o; else if (o.t === 'lobby') b.lobby = o; else b.ev.push(o); }; return b; };
const wait = async (fn, ms = 6000) => { for (let i = 0; i < ms / 50; i++) { if (fn()) return true; await sleep(50); } return false; };

(async () => {
  // --- 1) lobbidan chiqish (jang boshlanmasdan): server xatosiz, qolgan o'yinchi xost bo'ladi ---
  {
    const A = await mk(), B = await mk();
    A.w.send({ t: 'create', name: 'A', era: 'modern' }); await wait(() => A.code);
    B.w.send({ t: 'join', name: 'B', code: A.code }); await wait(() => B.id);
    A.w.send({ t: 'leave' }); await wait(() => B.lobby && B.lobby.host === B.id);
    ok("lobbidan chiqish: xona ishlashda davom etadi, qolgan o'yinchi xost bo'ladi", B.lobby && B.lobby.host === B.id && B.lobby.players.length === 1 && B.ev.some((e) => e.t === 'left' && e.id === A.id), JSON.stringify(B.lobby && [B.lobby.host, B.lobby.players.length]));
    A.w.close(); B.w.close(); await sleep(200);
  }
  // --- 2) xost chiqsa — boshqaruv aloqada bo'lgan o'yinchiga o'tadi (aloqasi uzilgan "arvoh"ga emas) ---
  {
    const A = await mk(), B = await mk(), C = await mk();
    A.w.send({ t: 'create', name: 'A', era: 'modern' }); await wait(() => A.code);
    B.w.send({ t: 'join', name: 'B', code: A.code }); await wait(() => B.id);
    C.w.send({ t: 'join', name: 'C', code: A.code }); await wait(() => C.id);
    B.w.close(); await wait(() => C.lobby && C.lobby.players.some((p) => p.id === B.id && p.gone));   // B aloqani yo'qotdi (kutish muddatida)
    A.w.send({ t: 'leave' }); await wait(() => C.lobby && C.lobby.host !== A.id);
    ok("xost chiqsa, boshqaruv aloqadagi o'yinchiga o'tadi (aloqasi uzilganiga emas)", C.lobby && C.lobby.host === C.id, JSON.stringify(C.lobby && [C.lobby.host, C.lobby.players.map((p) => [p.id, p.gone || 0])]));
    C.w.close(); await sleep(200);
  }
  // --- 3) jamoaviy jang: bir jamoa bo'shab qolsa jang tugaydi, qolgan jamoa g'olib ---
  {
    const A = await mk(), B = await mk(), C = await mk();
    A.w.send({ t: 'create', name: 'A', era: 'modern' }); await wait(() => A.code);
    A.w.send({ t: 'mode', mode: 'tdm' });
    B.w.send({ t: 'join', name: 'B', code: A.code }); C.w.send({ t: 'join', name: 'C', code: A.code }); await wait(() => B.id && C.id);
    A.w.send({ t: 'team', tm: 1 }); B.w.send({ t: 'team', tm: 1 }); C.w.send({ t: 'team', tm: 2 }); await sleep(200);
    A.w.send({ t: 'start' }); await wait(() => A.state);
    const tms = A.state ? A.state.p.map((p) => p.tm).sort().join() : '';
    C.w.send({ t: 'leave' });
    await wait(() => A.ev.some((e) => e.t === 'end'));
    const end = A.ev.find((e) => e.t === 'end');
    ok("jamoaviy jang: raqib jamoa chiqib ketsa jang tugaydi va qolgan jamoa g'olib", tms === '1,1,2' && !!end && end.mode === 'tdm' && end.team === 1 && A.lobby.state === 'lobby', JSON.stringify([tms, end && [end.mode, end.team, end.tk]]));
    // yangi jangni boshlash mumkin (holat tozalangan)
    B.w.send({ t: 'team', tm: 2 }); await sleep(150);
    A.ev.length = 0; A.state = null; A.w.send({ t: 'start' }); await wait(() => A.state);
    ok("jang tugagach yangi jang boshlanadi (hisob va texnik g'alaba belgisi tozalangan)", !!A.state && A.ev.some((e) => e.t === 'start') && (A.state.tk || []).join() === '0,0', JSON.stringify(A.state && A.state.tk));
    A.w.close(); B.w.close(); C.w.close(); await sleep(200);
  }
  // --- 4) qayta ulanish: server eski ulanish uzilganini hali sezmagan bo'lsa ham (kalit to'g'ri) qabul qiladi ---
  {
    const A = await mk(), B = await mk();
    A.w.send({ t: 'create', name: 'A', era: 'modern' }); await wait(() => A.code);
    A.w.send({ t: 'mode', mode: 'dm' });
    B.w.send({ t: 'join', name: 'B', code: A.code }); await wait(() => B.id);
    A.w.send({ t: 'start' }); await wait(() => A.state && B.state);
    const B2 = await mk();
    B2.w.send({ t: 'rejoin', code: A.code, id: B.id, key: B.key }); await wait(() => B2.id || B2.ev.some((e) => e.t === 'error'));
    await sleep(300);
    const n = A.lobby.players.length, g = A.lobby.players.find((p) => p.id === B.id);
    ok("qayta ulanish: eski ulanish hali ochiq bo'lsa ham to'g'ri kalit bilan qabul qilinadi (raqami saqlanadi, jang holati yuboriladi)",
      B2.id === B.id && B2.re === 1 && !B2.ev.some((e) => e.t === 'error') && B2.ev.some((e) => e.t === 'start') && n === 2 && !!g && !g.gone, JSON.stringify([B2.id, B.id, B2.re, B2.ev.filter((e) => e.t === 'error'), n]));
    const X = await mk();
    X.w.send({ t: 'rejoin', code: A.code, id: A.id, key: 'notogri-kalit' }); await wait(() => X.ev.some((e) => e.t === 'error'), 2000);
    ok("noto'g'ri kalit bilan (ulanish ochiq bo'lsa ham) birovning o'rnini egallab bo'lmaydi", X.id === 0 && X.ev.some((e) => e.t === 'error' && e.fatal), JSON.stringify(X.ev.slice(0, 1)));
    // jang tugagach yakun oynasidan chiqish jang xabarlarini yubormaydi (bayroq/o'rindiq holati tozalangan)
    A.ev.length = 0; B2.w.send({ t: 'leave' });
    await wait(() => A.ev.some((e) => e.t === 'end'));
    ok("ikki kishilik jangda biri chiqsa jang tugaydi; ortiqcha jang xabarlari (bayroq, o'rindiq) yuborilmaydi", A.ev.some((e) => e.t === 'end') && !A.ev.some((e) => e.t === 'flag' || e.t === 'vseat'), JSON.stringify(A.ev.map((e) => e.t)));
    A.w.close(); B.w.close(); X.w.close(); await sleep(200);
  }
  // --- 5) zombi rejimi: sun'iy zombilar buzgan transportdagi odam uchun xostga "o'ldirish" yozilmaydi ---
  {
    const A = await mk(), B = await mk();
    A.w.send({ t: 'create', name: 'A', era: 'modern' }); await wait(() => A.code);
    A.w.send({ t: 'mode', mode: 'zombie' });
    B.w.send({ t: 'join', name: 'B', code: A.code }); await wait(() => B.id);
    A.w.send({ t: 'start' }); await wait(() => A.state && B.state);
    const iv = setInterval(() => { for (const b of [A, B]) b.w.send({ t: 'p', x: 0, y: 0, z: 0, yw: 0, pt: 0, cr: 0, w: 0 }); }, 60);
    await sleep(300);
    const v = A.state.v.findIndex((q) => q && q.al !== 0 && q.s && q.s.length >= 1 && q.hp >= 200);
    const start = B.ev.find((e) => e.t === 'start'), def = start && start.veh && start.veh[v];
    if (def) { for (const b of [A, B]) b.w.send({ t: 'p', x: def.x, y: 0, z: def.z, yw: 0, pt: 0, cr: 0, w: 0 }); }
    clearInterval(iv);
    const iv2 = setInterval(() => { if (def) for (const b of [A, B]) b.w.send({ t: 'p', x: def.x, y: 0, z: def.z, yw: 0, pt: 0, cr: 0, w: 0 }); }, 60);
    await sleep(250);
    B.w.send({ t: 'venter', v, seat: 0 }); await wait(() => A.state.v[v] && A.state.v[v].s && A.state.v[v].s[0] === B.id, 3000);
    const seated = A.state.v[v] && A.state.v[v].s ? A.state.v[v].s[0] === B.id : false;
    for (let i = 0; i < 6; i++) A.w.send({ t: 'vhit', v, dmg: 3000, z: 1 });   // xost sun'iy zombilar zarbasini uzatadi
    await wait(() => A.ev.some((e) => e.t === 'kill' && e.victim === B.id), 4000);
    clearInterval(iv2);
    const k = A.ev.find((e) => e.t === 'kill' && e.victim === B.id), host = A.state.p.find((p) => p.id === A.id);
    ok("zombi rejimi: zombilar buzgan transportdagi odam \"zombi\" tomonidan o'ldirilgan deb yoziladi, xostga hisob qo'shilmaydi", seated && !!k && k.killer === 0 && k.kind === 'zombie' && host && host.k === 0, JSON.stringify([seated, k, host && host.k, v, def && [def.x, def.z]]));
    A.w.close(); B.w.close(); await sleep(200);
  }
  // --- tug'ilishdagi himoya: qayta tug'ilgan o'yinchiga 2 soniya o'q ta'sir qilmaydi; o'zi o'q uzsa — himoyasi darhol tugaydi ---
  {
    const A = await mk(), B = await mk();
    A.w.send({ t: 'create', name: 'A', era: 'modern' }); await wait(() => A.code);
    A.w.send({ t: 'mode', mode: 'dm' }); await sleep(150);
    B.w.send({ t: 'join', name: 'B', code: A.code }); await wait(() => B.id);
    A.w.send({ t: 'start' }); await wait(() => A.state && A.state.p && A.state.p.length === 2);
    const pos = (bot, x) => bot.w.send({ t: 'p', x, y: 0, z: 0, yw: 0, pt: 0, cr: 0, w: 0 });
    pos(A, 0); pos(B, 3); await sleep(200);
    const hp = () => (A.state.p.find((p) => p.id === B.id) || {}).hp;
    // birinchi tug'ilishdagi himoya o'tib ketsin, so'ng B ni o'ldiramiz
    await sleep(2300);
    for (let i = 0; i < 4; i++) A.w.send({ t: 'hit', target: B.id, dmg: 40, head: false, kind: 'bullet' });
    await wait(() => A.ev.some((e) => e.t === 'kill' && e.victim === B.id), 3000);
    await wait(() => A.ev.some((e) => e.t === 'respawn' && e.id === B.id), 8000);
    pos(B, 3); await sleep(150);
    A.w.send({ t: 'hit', target: B.id, dmg: 50, head: false, kind: 'bullet' }); await sleep(300);
    const hp1 = hp();
    await sleep(2100); pos(B, 3);
    A.w.send({ t: 'hit', target: B.id, dmg: 30, head: false, kind: 'bullet' }); await sleep(300);
    const hp2 = hp();
    // o'q uzsa himoya darhol tugaydi
    for (let i = 0; i < 4; i++) A.w.send({ t: 'hit', target: B.id, dmg: 40, head: false, kind: 'bullet' });
    await wait(() => A.ev.filter((e) => e.t === 'kill' && e.victim === B.id).length >= 2, 3000);
    const n0 = A.ev.filter((e) => e.t === 'respawn' && e.id === B.id).length;
    await wait(() => A.ev.filter((e) => e.t === 'respawn' && e.id === B.id).length > n0, 8000);
    pos(B, 3); await sleep(150);
    B.w.send({ t: 'shot', a: [3, 1.6, 0], b: [0, 1.6, 0], s: 'ar' }); await sleep(150);
    A.w.send({ t: 'hit', target: B.id, dmg: 25, head: false, kind: 'bullet' }); await sleep(300);
    const hp3 = hp();
    ok("qayta tug'ilgach 2 soniya jon ketmaydi, so'ng odatdagidek; o'zi o'q uzsa — himoya tugaydi", hp1 === 100 && hp2 === 70 && hp3 === 75, JSON.stringify({ hp1, hp2, hp3 }));
    A.w.close(); B.w.close(); await sleep(200);
  }
  L(fails ? `YAKUN: ${fails} ta xato` : "YAKUN: hammasi o'tdi");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
