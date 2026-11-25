// Uzoq jang sinovi: botlar bilan to'lqinlar, uy/podvalga yashirinish, tezlik o'lchovi
const { openPage, sleep } = require('./lib_cdp.js');
const era = process.argv[2] || 'modern';
const PORT = process.env.PORT || 8191;
const L = (...a) => console.log(...a);

(async () => {
  const pg = await openPage(`http://localhost:${PORT}/`, { port: 9342, dir: 'p_soak' });
  const { ev, shot } = pg;
  await sleep(2500);
  if (era === 'modern') { await ev(`document.querySelector('.era[data-era=modern]').click(), 1`); await sleep(1200); }
  await ev(`(() => { const G = window.__G, D = window.__dbg; document.getElementById('menu').classList.add('hidden'); D.startGame(); G.waveTimer = 0.5;
    setInterval(() => { D.player.hp = 100; }, 100); window.__hurt = 0; const dp = G.damagePlayer; return 1; })()`);
  // mantiq tezligi (rendersiz)
  L('tezlik (ms):', await ev(`(() => { const G = window.__G, W = G.world; const r = {};
    let t = performance.now(); for (let i = 0; i < 20; i++) W.updateFlow(Math.random() * 100 - 50, Math.random() * 100 - 50); r.flow = +((performance.now() - t) / 20).toFixed(2);
    const o = new G.player.pos.constructor(0, 1.6, 9), d = new G.player.pos.constructor(0.6, 0, -0.8).normalize();
    t = performance.now(); for (let i = 0; i < 2000; i++) W.rayCast(o, d, 300); r.ray1000 = +((performance.now() - t) / 2).toFixed(2);
    t = performance.now(); for (let i = 0; i < 2000; i++) W.los(o, {x: 40, y: 1.5, z: -40}); r.los1000 = +((performance.now() - t) / 2).toFixed(2);
    return JSON.stringify(r); })()`));
  const spots = [
    { n: 'markaz', x: 0, y: 0, z: 9 }, { n: 'uy ichi (H7)', x: -48, y: 0, z: -12 }, { n: 'podval (H2)', x: 30, y: -3, z: 30 },
    { n: 'tom usti', x: 14, y: 3.45, z: -46 }, { n: 'burchak', x: 60, y: 0, z: -62 },
  ];
  for (const s of spots) {
    await ev(`(() => { const p = window.__dbg.player; p.pos.set(${s.x}, ${s.y}, ${s.z}); p.vel.set(0,0,0); return 1; })()`);
    let best = 999, hits = 0, log = '';
    const lh0 = await ev(`window.__G.player.lastHurt`);
    for (let i = 0; i < 12; i++) {
      await sleep(1500);
      const r = await ev(`(() => { const G = window.__G, P = G.player; const en = G.soldiers.filter(s => s.alive && s.team === 'enemy');
        const ds = en.map(s => Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z, s.pos.y - P.pos.y)).sort((a, b) => a - b);
        const eng = en.filter(s => s.visible && s.target === P).length;
        if (G.waveState === 'intermission') G.waveTimer = Math.min(G.waveTimer, 0.5);
        return [en.length, ds.length ? +ds[0].toFixed(1) : -1, eng, +P.lastHurt.toFixed(1), G.wave, +P.pos.y.toFixed(1)]; })()`);
      best = Math.min(best, r[1] < 0 ? 999 : r[1]); hits = r[3]; log = JSON.stringify(r);
    }
    L(`${s.n}: eng yaqin dushman ${best} m, oxirgi holat [soni, yaqin, ko'rib otayotgan, oxirgi zarba vaqti, to'lqin, y]=${log}, zarba oldi: ${hits > lh0}`);
  }
  await shot(`soak_${era}`);
  L('yakuniy:', await ev(`(() => { const G = window.__G; return 'wave=' + G.wave + ' time=' + G.time.toFixed(0) + ' soldiers=' + G.soldiers.length + ' state=' + G.state; })()`));
  L('JS xatolari soni:', pg.errors.length);
  pg.close(); process.exit(0);
})().catch((e) => { console.error('SINOV XATOSI', e); process.exit(1); });
