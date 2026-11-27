// Zombi rejimi: TIRILTIRISH — defibrillyator va tiriltirish punktlari (tibbiy chodirlar, js/wild.js: medTent).
// Tarmoqda: odam halok bo'lgach Z_DOWN soniya yerda yotadi; defibrillyatori bor sherigi uning yoniga borib [E] bossa — shu yerning
// o'zida tiriladi. Ulgurilmasa zombiga aylanadi — shunda tirik odam ochilgan chodirdagi ratsiyadan [E] bilan uni chaqira oladi:
// u yana odam bo'lib chodir oldida paydo bo'ladi (har chodir Z_CALL_CD soniyada bir marta).
// Yakka o'yinda: defibrillyator halok bo'lganda o'zingizni shu joyda tiriltiradi; imkoniyatlar esa oxirgi ochilgan chodirdan davom ettiradi.
import * as THREE from '../lib/three.module.js';
import { WILD, Z_DOWN } from './shared.mjs';
import { G, player, sound } from './core.js';
import { buildSlots, popup } from './hud.js';
import { setupWeapons } from './arsenal.js';
import { nameOf, net, remotes } from './mp.js';
import { XP, addXp } from './progress.js';

// Chodir ochiqmi (bosqichga qarab: halokat joyi — boshidan, qolganlari o'sha joyga yetilgach)
export const tentOn = (R) => !!G.zg && G.zg.stage >= R.from;
// Oxirgi ochilgan chodir (yakka o'yinda shu yerdan davom etiladi)
export function activeTent() { let best = null; for (const R of (G.world && G.world.revivePts) || []) if (tentOn(R)) best = R; return best; }
// Chodir oldidagi joy (paydo bo'lish nuqtasi)
export function tentFront(R, out) { return out.set(R.x + Math.sin(R.yaw) * 3.1, 0, R.z + Math.cos(R.yaw) * 3.1); }
export function nearTent() {
  if (!G.zg || G.isZ || !G.world || !G.world.revivePts) return null;
  const P = player.pos;
  for (const R of G.world.revivePts) if (tentOn(R) && Math.hypot(R.x - P.x, R.z - P.z) < 3.4 && P.y < 2) return R;
  return null;
}
const tentIdx = (R) => WILD.revive.findIndex((w) => w.id === R.id);
// Ratsiya orqali chaqirsa bo'ladigan sheriklar: odam bo'lib yiqilib, zombiga aylanganlar
export function fallenMates() { const out = []; for (const r of remotes.values()) if (r.isZ && r.fl) out.push(r); return out; }
// Yerda yotgan (hali zombiga aylanmagan) sheriklar
export function downedMates() { const out = []; for (const r of remotes.values()) if (r.downAt !== undefined && r.downPos && !r.alive && !r.isZ && G.time - r.downAt < Z_DOWN) out.push(r); return out; }
export function nearDowned() {
  let best = null, bd = 2.6;
  for (const r of downedMates()) { const d = Math.hypot(r.downPos.x - player.pos.x, r.downPos.z - player.pos.z); if (d < bd && Math.abs(r.downPos.y - player.pos.y) < 2) { bd = d; best = r; } }
  return best;
}

// [E]: defibrillyator (yerda yotgan sherik yonida) yoki chodir ratsiyasi. Qaytaradi: tugma shu yerda ishlatildimi.
export function tryRevive() {
  if (!G.zg || G.isZ || !player.alive) return false;
  if (G.mp) {
    const r = nearDowned();
    if (r) {
      if (!(G.defib > 0)) { popup("Defibrillyator yo'q — chodirlardan qidiring", true); return true; }
      net.send({ t: 'zrev', id: r.id }); sound.ping();
      return true;
    }
  }
  const R = nearTent();
  if (!R) return false;
  if (!G.mp) { popup("Tiriltirish punkti: halok bo'lsangiz — shu chodir oldida o'zingizga kelasiz"); return true; }
  const i = tentIdx(R), cd = (G.tentCd && G.tentCd[i]) || 0, f = fallenMates();
  if (G.time < cd) { popup(`Ratsiya band — ${Math.ceil(cd - G.time)} soniyadan keyin`, true); return true; }
  if (!f.length) { popup("Chaqiradigan sherik yo'q — hamma hali odam", true); return true; }
  net.send({ t: 'zcall', i, id: f[0].id }); sound.ping();
  return true;
}
// Ekrandagi [E] maslahati (bo'lmasa — bo'sh)
export function revivePrompt() {
  if (!G.zg || G.isZ || !player.alive) return '';
  if (G.mp) {
    const r = nearDowned();
    if (r) {
      const left = Math.max(0, Math.ceil(Z_DOWN - (G.time - r.downAt)));
      return G.defib > 0 ? `[E] ${r.name} — defibrillyator bilan tiriltirish (${left} s)` : `${r.name} yiqildi — defibrillyator bo'lsa tiriltirsa bo'ladi (${left} s)`;
    }
  }
  const R = nearTent();
  if (!R) return '';
  if (!G.mp) return "Tiriltirish punkti — halok bo'lsangiz shu yerda o'zingizga kelasiz";
  const i = tentIdx(R), cd = (G.tentCd && G.tentCd[i]) || 0, f = fallenMates();
  if (G.time < cd) return `Tiriltirish punkti — ratsiya ${Math.ceil(cd - G.time)} soniyadan keyin yana ishlaydi`;
  return f.length ? `[E] Ratsiya: ${f[0].name}ni qayta chaqirish — odam bo'lib shu yerga qaytadi` : 'Tiriltirish punkti — zombiga aylangan sherikni shu yerdan qayta chaqirish mumkin';
}

// Tarmoq: boshqa o'yinchi tiriltirildi (rv — defibrillyator bilan kim, cb — ratsiya orqali kim chaqirdi)
export function onMateRevived(o) {
  const by = o.rv || o.cb, who = nameOf(o.id);
  const r = remotes.get(o.id); if (r) { r.downAt = undefined; r.fl = false; }
  if (by === G.myId) {
    if (o.rv) { G.defib = 0; buildSlots(); }
    popup(o.rv ? `${who}ni tiriltirdingiz! +100` : `${who} qaytdi — chodir oldida! +100`); sound.ping();
    addXp(XP.stage);
  } else popup(`${nameOf(by)} ${who}ni ${o.rv ? 'defibrillyator bilan tiriltirdi' : 'ratsiya orqali qayta chaqirdi'}`);
}

// O'yinchi yana odam bo'ldi (ratsiya orqali chaqirildi): zombi panjalari o'rniga boshlang'ich qurollar, fonar, kunduzgi ko'rish
export function becomeHuman() {
  if (!G.isZ) return;
  G.isZ = false;
  setupWeapons(G.era);   // (zombi rejimi to'plami: o'qi tugamaydigan to'pponcha, pichoq, granata)
  for (const w of G.weapons) w.vm.group.visible = false;
  G.wi = 1; G.weapons[1].vm.group.visible = true;
  G.grenades_n = 1; G.bandages = Math.max(G.bandages || 0, 1); G.defib = 0; G.armor = 0; G.helm = 0;
  G.reloadT = 0; G.ads = 0; G.knifeT = 0; G.throwT = 0; G.cookT = -1; G.switchT = 0.4;
  G.torchOn = !!G.torch;
  if (G.zg && G.world.setDark) G.world.setDark(G.zg.dark, false);
  buildSlots();
}

// Har kadr: ochiq chodirlar ustidagi qizil xoch, yerda yotgan sheriklar ustidagi miltillovchi belgi
const marks = new Map();
export function updateRevive() {
  if (!G.zg || !G.world || !G.world.revivePts) return;
  for (const R of G.world.revivePts) { const on = tentOn(R) && !G.isZ; R.cross.visible = on; if (on) R.cross.position.y = 4.3 + Math.sin(G.time * 2 + R.from) * 0.15; }
  const down = G.mp && !G.isZ ? downedMates() : [];
  for (const r of down) {
    let m = marks.get(r.id);
    if (m && m.parent !== G.scene) { marks.delete(r.id); m = null; }
    if (!m) {
      m = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.world.revivePts[0].cross.material.map, depthWrite: false, depthTest: false, transparent: true, fog: false }));
      m.scale.set(0.9, 0.9, 1); m.renderOrder = 5; G.scene.add(m); marks.set(r.id, m);
    }
    m.position.set(r.downPos.x, r.downPos.y + 1.3 + Math.sin(G.time * 5) * 0.08, r.downPos.z);
    m.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(G.time * 4));
  }
  for (const [id, m] of marks) if (!down.some((r) => r.id === id)) { if (m.parent) m.parent.remove(m); m.material.dispose(); marks.delete(id); }
}
