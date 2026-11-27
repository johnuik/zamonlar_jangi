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
  const smp = await T(`D.post.samples`);
  ok("oraliq tasvir ekran o'lchamida, chuqurlik bilan; silliqlash namunalari videokartaga mos", rt[0] === rt[2] && rt[1] === rt[3] && rt[4] === smp && [0, 2, 4].includes(smp) && rt[5], JSON.stringify([rt, smp]));
  // ichki aniqlik pasaysa ham ekranga to'liq o'lchamda chiqadi (o'tkirlashtiruvchi kattalashtirish) — kadr qora emas
  await T(`(G.resScale = 0.7, 1)`); const lumLow = await lum();
  const up = await T(`[D.post.w, D.post.outW, D.renderer.getContext().drawingBufferWidth, D.post.h, D.post.outH]`);
  await T(`(G.resScale = 0, 1)`); const lumFull = await lum();
  ok("ichki aniqlik 70%: ekran to'liq o'lchamda, yorqinlik o'zgarmaydi", Math.abs(up[0] - up[2] * 0.7) < 2 && up[1] === up[2] && up[4] > up[3] && lumLow > 8 && Math.abs(lumLow - lumFull) < 6, JSON.stringify([up, lumLow, lumFull]));
  await shot(`gfx_${era}_high`);

  // 2) oyna o'lchami o'zgarsa — yangi o'lchamga moslashadi
  await T(`(D.renderer.setSize(640, 360), 1)`);
  const e1 = pg.errors.length, v2 = await lum();
  const rt2 = await T(`[D.post.w, D.renderer.getContext().drawingBufferWidth]`);
  ok("o'lcham o'zgardi: qayta moslashdi", rt2[0] === rt2[1] && rt2[0] !== rt[0] && v2 > 40 && pg.errors.length === e1, `${rt[0]} -> ${rt2[0]}, yorqinlik=${v2}`);
  await T(`(D.renderer.setSize(innerWidth, innerHeight), 1)`);

  // 3) materiallar: relyef xaritasi, atrof-muhit yorug'ligi, yer qoplami
  const mats = await T(`[!!G.world.mat.ground.normalMap, !!G.world.mat.walls[0].normalMap, !!G.scene.environment, G.scene.children.filter(o => o.isInstancedMesh && o.userData.dyn).map(o => o.count), G.world.staticMeshes, G.world.sun.shadow.mapSize.x, !!G.world.mat.ground.roughnessMap, !!G.world.sunNear]`);
  // yer qoplami: toshlar, o't tutamlari va (yuqori sifatda) baland o't/butalar; silliqlik xaritasi va yaqin soya kaskadi ham yuqori sifatda
  ok("relyef va silliqlik xaritalari, osmon yorug'ligi, tosh, o't va butalar, yaqin soya kaskadi", mats[0] && mats[1] && mats[2] && mats[3].length === 3 && mats[3].every((c) => c > 50) && mats[5] === 4096 && mats[6] && mats[7], JSON.stringify(mats));

  // 3b) avto-ekspozitsiya: kunduzi belgilangan chegarada, ochiq havoda 1 ga yaqin
  const ex = await T(`[D.post.readExposure(), G.world.grade.ae]`);
  ok("avto-ekspozitsiya ishlaydi (qiymat belgilangan chegarada)", Array.isArray(ex[1]) && ex[0] >= ex[1][0] - 0.02 && ex[0] <= ex[1][1] + 0.02, JSON.stringify(ex));

  // 3c) foto-skanerlangan modellar yuklanib, oddiy shakllar o'rnini egallaydi; linza va rang effektlari ulangan
  let mdl = [0, 0];
  for (let i = 0; i < 20; i++) { mdl = await T(`[G.world.props.length, G.world.modelsOn || 0, G.scene.children.filter(o => o.isInstancedMesh && o.userData.model).length]`); if (mdl[0] && mdl[1] === mdl[0]) break; await sleep(250); }
  ok("bochkalar skanerlangan modelga almashdi", mdl[0] > 0 && mdl[1] === mdl[0] && mdl[2] > 0, JSON.stringify(mdl));
  // 3d) mo'ljalga olganda yaqin maydon xiraligi yoqiladi, qo'yib yuborilganda o'chadi
  await T(`(D.mouse.R = true, 1)`); await sleep(1100);
  const dofOn = await T(`[+G.ads.toFixed(2), D.post.m.fxaa.uniforms.dofK.value, D.post.m.tone.uniforms.ca.value, D.post.m.tone.uniforms.tintS.value.b > D.post.m.tone.uniforms.tintS.value.r]`);
  await T(`(D.mouse.R = false, 1)`); await sleep(900);
  const dofOff = await T(`D.post.m.fxaa.uniforms.dofK.value`);
  ok("mo'ljalda yaqin maydon xiraligi; linza va kino rangi ulangan", dofOn[0] > 0.9 && dofOn[1] > 0.9 && dofOn[2] > 0 && dofOn[3] === true && dofOff < 0.05, JSON.stringify([dofOn, dofOff]));
  // 3e) qo'ldagi qurollar haqiqiy modelda: model yuklanadi, kod bilan qurilgan tana yashiriladi, mo'ljal chizig'i old va orqa mo'ljal ustidan o'tadi
  const guns = await pg.ev(`(async () => {
    const wp = await import('/js/weapons.js'), gs = await import('/js/gunskin.js');
    await Promise.all(Object.keys(gs.GMODELS).map((k) => gs.loadGun(gs.GMODELS[k])));
    const out = [];
    for (const key of Object.keys(gs.GMODELS)) {
      const [era, id] = key === 'knife' ? ['modern', 'knife'] : key.split('|');
      const def = id === 'knife' ? null : wp.WEAPONS[era][id] || wp.specialWeapons(era).find((d) => d.id === id);
      if (id !== 'knife' && !def) continue;   // (faqat askarlar qo'lidagi model — ko'rinish modeli yo'q)
      const vm = id === 'knife' ? wp.buildKnife(era) : wp.buildViewmodel(def, era, true), gun = id === 'knife' ? vm.knife : vm.gun;
      if (vm.skinLater) vm.skinLater();
      const sk = gun.children.find((c) => c.userData && c.userData.dbg), d = sk && sk.userData.dbg;
      let hid = 0; gun.traverse((o) => { if (o.isMesh && o.material && o.material.visible === false) hid++; });
      const iron = d && d.a && d.b && typeof gs.GMODELS[key].sight !== 'number', f = (p) => +((p[0] - d.box[0][2]) / d.size[2]).toFixed(2);
      // mo'ljalda: ko'z mo'ljal chizig'ida va orqa mo'ljaldan (optikadan) kamida 8 sm orqada (qurol ichida emas)
      const A = sk && sk.userData.ads, auto = def && !def.scope && !wp.SIDEARMS.includes(id) && !['rpg', 'turret', 'drone'].includes(id) && !gs.GMODELS[key].keep;
      const adsOk = !auto || (!!A && Math.abs(vm.ads.x) < 1e-6 && Math.abs(vm.ads.y) < 1e-6 && Math.abs(vm.ads.z + A.z) < 1e-6 && A.z - A.rear >= 0.08);
      out.push([key, !!sk, hid, iron ? [f(d.a), f(d.b), +d.rotX.toFixed(3)] : null, adsOk]);
    }
    return out;
  })()`);
  // (old mo'ljal stvol uchidan 40 % ichida: uzun stvolli SCAR-H va raketali RPG-7 da u orqaroqda)
  ok("qo'ldagi qurollar haqiqiy modelda, mo'ljal chizig'i old va orqa mo'ljal ustidan; mo'ljalda ko'z orqa mo'ljal ortida", guns.length >= 24 && guns.every((g) => g[1] && g[2] > 0 && g[4] && (!g[3] || (g[3][0] < 0.4 && g[3][1] - g[3][0] > 0.2 && Math.abs(g[3][2]) < 0.13))), JSON.stringify(guns));   // (Saiga — AK uslubi: mo'ljallar orasi qisqa)
  // askarlar qo'lidagi qurol ham haqiqiy model (soddalashtirilgan bitta to'r)
  const tp = await pg.ev(`(async () => {
    const THREE = await import('/lib/three.module.js'), gs = await import('/js/gunskin.js'), out = [];
    for (const [era, kind] of [['modern', 'ar'], ['modern', 'ak'], ['modern', 'smgM'], ['modern', 'svd'], ['modern', 'mg'], ['modern', 'pistol'], ['historical', 'bolt'], ['historical', 'boltScope'], ['historical', 'ppsh'], ['historical', 'mp'], ['historical', 'mg'], ['historical', 'pistol']]) {
      const def = gs.tpModelFor(era, kind); await gs.loadGun(def);
      const g = gs.tpGunGeo(def, kind + '_t', new THREE.Box3(new THREE.Vector3(-0.03, -0.1, -0.3), new THREE.Vector3(0.03, 0.05, 0.6)), 0.01);
      out.push([kind, g && g.index ? g.index.count / 3 : 0]);
    }
    return out;
  })()`);
  ok("askarlar qo'lidagi qurollar haqiqiy modeldan (soddalashtirilgan: har biri 3200 uchburchakdan kam)", tp.every((t) => t[1] > 200 && t[1] <= 3200), JSON.stringify(tp));
  // o'rnatiladigan turel: taglik joyida, pulemyot (bosh) alohida aylanadi; 1944 yilgi dron — xaki-zaytun rangli model
  const dep = await pg.ev(`(async () => {
    const vs = await import('/js/vehskin.js'), out = [];
    await vs.loadVeh(vs.DRONE_DEF);
    for (const era of ['modern', 'historical']) {
      await vs.loadTurret(vs.TURRET_DEFS[era]);
      const t = vs.turretVisual(era); let heads = 0, base = 0; t.head.traverse((o) => { if (o.isMesh) heads++; }); for (const c of t.g.children) if (c.isMesh) base++;
      const d = vs.droneVisual(era); let col = null; d.g.traverse((o) => { if (o.isMesh && !col) col = o.material.color.toArray().map((v) => +v.toFixed(2)); });
      out.push([era, heads, base, +t.eyeH.toFixed(2), col]);
    }
    return out;
  })()`);
  ok("turel modeli: taglik joyida, pulemyot aylanadi (stvol balandligi 0,4–1,2 m); dron modelda, 1944 yilda boshqa rangda", dep.every((d) => d[1] > 0 && d[2] > 0 && d[3] > 0.4 && d[3] < 1.2) && JSON.stringify(dep[0][4]) !== JSON.stringify(dep[1][4]), JSON.stringify(dep));


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
  const low = await T(`[!!G.world.mat.ground.normalMap, D.renderer.shadowMap.enabled, D.postLevel(), G.scene.children.filter(o => o.isInstancedMesh && o.userData.dyn).length, !!G.world.sunNear]`);
  const vLow = await lum();
  ok("past sifat: yengil rejim (relyef, soya, yer qoplami va soya kaskadi yo'q)", !low[0] && !low[1] && low[2] === 'off' && low[3] === 0 && !low[4] && vLow > 40, JSON.stringify(low) + ` yorqinlik=${vLow}`);

  // 6) tun (zombi rejimi): qorong'i; chaqmoq yoritadi; fonar soya tashlaydi
  await T(`(D.settings.quality = 'high', D.setPost('high'), 1)`);
  await ev(`(location.reload(), 1)`); await sleep(2500);
  await T(`(D.settings.quality = 'high', D.setPost('high'), 1)`);
  await ev(`(() => { const G = window.__G, D = window.__dbg; document.querySelectorAll('.era').forEach(e => { if (e.dataset.era === '${era}') e.click(); }); document.querySelector('#spModes [data-m=zombie]').click(); document.getElementById('menu').classList.add('hidden'); D.startGame(); return 1; })()`);
  await sleep(600);
  // zombi rejimi shomdan boshlanadi: avval shom yorqinligi o'lchanadi, so'ng tun to'liq kiritiladi
  await T(`(P.pos.set(-80, 0, 70), P.yaw = -0.9, P.pitch = 0.5, G.torchOn = false, G.torch.intensity = 0, G.zg.host = false, 1)`);
  await lum(); const dusk = await lum();
  await T(`(G.zg.dark = 1, G.world.setDark(1), 1)`); await sleep(300);
  await lum(); const dark = await lum();
  const fl = await lum('G.world.flash(1)');
  // (yaqinda ko'cha chirog'i bor: derazadan uning yorug'i ko'rinadi, shuning uchun to'liq zimiston emas — lekin baribir qorong'i)
  ok("shom tundan ancha yorug'; tun qorong'i, chaqmoq butun xaritani yoritadi", dusk > dark * 2.5 && dark < 25 && fl > dark + 10 && fl > dark * 2, `shom=${dusk} tun=${dark} chaqmoq=${fl}`);
  const night = await T(`[G.torch.castShadow, G.torch.shadow.mapSize.x, G.world.sunDir === null, G.world.grade.rays]`);
  ok("fonar soya tashlaydi; tunda quyosh nurlari yo'q", night[0] === true && night[1] === 1024 && night[2] && night[3] === 0, JSON.stringify(night));
  const lm = await T(`[G.world.lamps.length, G.world.grade.ae === null, G.scene.children.filter(o => o.isDirectionalLight).length]`);
  ok("tunda ko'cha chiroqlari yonadi, avto-ekspozitsiya o'chiq (qorong'ulik saqlanadi)", lm[0] >= 8 && lm[1] === true, JSON.stringify(lm));
  await shot(`gfx_${era}_night`);

  ok("konsolda xato yo'q (sheyder xatolari ham shu yerda ko'rinadi)", pg.errors.length === 0, pg.errors.slice(0, 3).map((e) => String(e).slice(0, 300)).join(' | '));
  L(fails ? `\n${fails} ta XATO` : '\nHAMMASI OK');
  pg.close(); process.exit(fails ? 1 : 0);
})();
