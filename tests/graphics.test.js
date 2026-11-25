// Grafika: keyingi ishlov (post.js) har bir darajada xatosiz chizadi, kadr qora emas, o'lcham o'zgarsa moslashadi;
// uy ichida osmon yorug'ligi kamayadi (tom xaritasi), qo'ldagi qurol soyada qorayadi, tun qorong'i va chaqmoq yoritadi.
// Ishlatish: PORT=8191 node server.js   so'ng   node tests/graphics.test.js [historical|modern]
// Haqiqiy videokartada: ZJ_GL=gl node tests/graphics.test.js   (aks holda dasturiy chizish — sekin, lekin har yerda bir xil)
const { openPage, sleep } = require('./lib_cdp.js');
const PORT = process.env.PORT || 8191, era = process.argv[2] || 'modern';
const L = (...a) => console.log(...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; L(`${cond ? '  OK  ' : '  XATO'} ${name} ${extra}`); };

(async () => {
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9481, dir: 'p_gfx', size: '960,540' });
  const { ev, shot } = pg;
  await sleep(2500);
  const T = (body) => ev(`(() => { const G = window.__G, D = window.__dbg, P = D.player, K = D.keys; return ${body}; })()`);
  // bir kadr chizib, ekranning o'rtacha yorqinligini o'lchaydi (0..255)
  // pre — o'lchashdan oldin shu kadrning o'zida bajariladigan amal (chaqmoq kabi tez so'nadigan hodisalar uchun)
  const lum = (pre = '0') => T(`(() => { const gl = D.renderer.getContext(); ${pre}; D.tick(0.016); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4); let s = 0, n = 0;
    for (let y = 1; y < 8; y++) for (let x = 1; x < 12; x++) { gl.readPixels((w * x / 12) | 0, (h * y / 8) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); s += px[0] * 0.3 + px[1] * 0.59 + px[2] * 0.11; n++; }
    return +(s / n).toFixed(1); })()`);

  const soft = await T(`D.SOFT_GL`);
  L('grafik protsessor:', await T(`D.GL_NAME`));
  if (soft) ok("dasturiy chizishda og'ir effektlar o'z-o'zidan o'chiq", (await T(`D.postLevel()`)) === 'off');
  if (soft) ok("dasturiy chizishda dunyo yengil variantda (relyef, osmon aksi, o't yo'q)", (await T(`[G.world.lite, !!G.world.mat.ground.normalMap, !!G.scene.environment, G.scene.children.filter(o => o.isInstancedMesh).length]`)).join() === 'true,false,false,0');
  await T(`(D.settings.quality = 'high', D.setPost('high'), 1)`);   // majburlab yoqamiz: sinov to'liq grafikani tekshiradi
  await ev(`(() => { const G = window.__G, D = window.__dbg; document.querySelectorAll('.era').forEach(e => { if (e.dataset.era === '${era}') e.click(); }); document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 9999;
    for (const s of G.soldiers) { s.alive = false; s.root.visible = false; } return 1; })()`);
  await sleep(600);
  await T(`(P.pos.set(16, 0, 22), P.yaw = 0.9, P.pitch = -0.05, 1)`);

  // 1) har bir daraja: xatosiz, qora emas, ranglar bir-biriga yaqin
  const base = {};
  for (const lvl of ['off', 'medium', 'high', 'ultra']) {
    await T(`(D.setPost('${lvl}'), 1)`);
    const e0 = pg.errors.length; await lum(); const v = await lum();
    base[lvl] = v;
    ok(`daraja "${lvl}": kadr chizildi`, v > 40 && v < 235 && pg.errors.length === e0 && (await T(`D.postLevel()`)) === lvl, `yorqinlik=${v}`);
  }
  ok("keyingi ishlov ranglarni buzmaydi (to'g'ridan-to'g'ri chizishga yaqin)", Math.abs(base.high - base.off) < 45 && Math.abs(base.medium - base.off) < 45, JSON.stringify(base));
  await T(`(D.setPost('high'), 1)`); await lum();
  const rt = await T(`[D.post.w, D.post.h, D.renderer.getContext().drawingBufferWidth, D.renderer.getContext().drawingBufferHeight, D.post.rt.scene.samples, !!D.post.rt.scene.depthTexture]`);
  ok("oraliq tasvir ekran o'lchamida, silliqlash va chuqurlik bilan", rt[0] === rt[2] && rt[1] === rt[3] && rt[4] === 4 && rt[5], JSON.stringify(rt));
  await shot(`gfx_${era}_high`);

  // 2) oyna o'lchami o'zgarsa — yangi o'lchamga moslashadi
  await T(`(D.renderer.setSize(640, 360), 1)`);
  const e1 = pg.errors.length, v2 = await lum();
  const rt2 = await T(`[D.post.w, D.renderer.getContext().drawingBufferWidth]`);
  ok("o'lcham o'zgardi: qayta moslashdi", rt2[0] === rt2[1] && rt2[0] !== rt[0] && v2 > 40 && pg.errors.length === e1, `${rt[0]} -> ${rt2[0]}, yorqinlik=${v2}`);
  await T(`(D.renderer.setSize(innerWidth, innerHeight), 1)`);

  // 3) materiallar: relyef xaritasi, atrof-muhit yorug'ligi, yer qoplami
  const mats = await T(`[!!G.world.mat.ground.normalMap, !!G.world.mat.walls[0].normalMap, !!G.scene.environment, G.scene.children.filter(o => o.isInstancedMesh).map(o => o.count), G.world.staticMeshes, G.world.sun.shadow.mapSize.x]`);
  ok("relyef xaritalari, osmon yorug'ligi, tosh va o't", mats[0] && mats[1] && mats[2] && mats[3].length === 2 && mats[3].every((c) => c > 50) && mats[5] === 4096, JSON.stringify(mats));

  // 4) uy ichi: osmon yorug'ligi kamayadi, qo'ldagi qurol qorayadi
  const house = await T(`(() => { const b = G.world.boxes.filter(b => Math.abs(b.min.y - 3.2) < 0.01 && b.max.y - b.min.y < 0.3)[0]; return [(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2]; })()`);
  const sky = await ev(`(async () => { const g = await import('/js/gfx.js'), W = window.__G.world; return [g.skyAt(W.roof, ${house[0]}, 1.6, ${house[1]}), g.skyAt(W.roof, 3, 1.6, 12), g.skyAt(W.roof, ${house[0]}, 3.6, ${house[1]})]; })()`);
  ok("tom xaritasi: uy ichi yopiq, ko'cha va tom usti ochiq", sky[0] < 0.7 && sky[1] === 1 && sky[2] === 1, JSON.stringify(sky));
  const gunL = () => T(`(() => { for (let i = 0; i < 40; i++) D.tick(0.03); return D.wScene.children.filter(o => o.isLight && !o.isPointLight).map(o => +o.intensity.toFixed(2)); })()`);
  await T(`(P.pos.set(3, 0, 12), P.vel.set(0, 0, 0), 1)`); const gOut = await gunL();
  await T(`(P.pos.set(${house[0] + 1}, 0, ${house[1] + 1}), P.vel.set(0, 0, 0), 1)`); const gIn = await gunL();
  ok("qurol uy ichida qorong'iroq yoritiladi", gIn.every((v, i) => v < gOut[i] * 0.8), `tashqarida ${gOut} | ichkarida ${gIn}`);
  await shot(`gfx_${era}_inside`);

  // 5) past sifat: relyef va soyasiz, lekin ishlaydi
  await T(`(D.setPost(null), D.settings.quality = 'low', D.createScene(G.era), 1)`); await sleep(300);
  const low = await T(`[!!G.world.mat.ground.normalMap, D.renderer.shadowMap.enabled, D.postLevel(), G.scene.children.filter(o => o.isInstancedMesh).length]`);
  const vLow = await lum();
  ok("past sifat: yengil rejim", !low[0] && !low[1] && low[2] === 'off' && low[3] === 0 && vLow > 40, JSON.stringify(low) + ` yorqinlik=${vLow}`);

  // 6) tun (zombi rejimi): qorong'i; chaqmoq yoritadi; fonar soya tashlaydi
  await T(`(D.settings.quality = 'high', D.setPost('high'), 1)`);
  await ev(`(location.reload(), 1)`); await sleep(2500);
  await T(`(D.settings.quality = 'high', D.setPost('high'), 1)`);
  await ev(`(() => { const G = window.__G, D = window.__dbg; document.querySelectorAll('.era').forEach(e => { if (e.dataset.era === '${era}') e.click(); }); document.querySelector('#spModes [data-m=zombie]').click(); document.getElementById('menu').classList.add('hidden'); D.startGame(); return 1; })()`);
  await sleep(600);
  await T(`(P.pos.set(-80, 0, 70), P.yaw = -0.9, P.pitch = 0.5, G.torchOn = false, G.torch.intensity = 0, 1)`);
  await lum(); const dark = await lum();
  const fl = await lum('G.world.flash(1)');
  ok("tun qorong'i, chaqmoq butun xaritani yoritadi", dark < 40 && fl > dark * 2 + 15, `qorong'i=${dark} chaqmoq=${fl}`);
  const night = await T(`[G.torch.castShadow, G.torch.shadow.mapSize.x, G.world.sunDir === null, G.world.grade.rays]`);
  ok("fonar soya tashlaydi; tunda quyosh nurlari yo'q", night[0] === true && night[1] === 1024 && night[2] && night[3] === 0, JSON.stringify(night));
  await shot(`gfx_${era}_night`);

  ok("konsolda xato yo'q (sheyder xatolari ham shu yerda ko'rinadi)", pg.errors.length === 0, pg.errors.slice(0, 3).map((e) => String(e).slice(0, 300)).join(' | '));
  L(fails ? `\n${fails} ta XATO` : '\nHAMMASI OK');
  pg.close(); process.exit(fails ? 1 : 0);
})();
