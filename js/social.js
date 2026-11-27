// Tarmoqdagi qulayliklar: matnli chat [T], xaritaga belgi qo'yish [X], halok bo'lganda kim o'ldirgani haqida kartochka.
import * as THREE from '../lib/three.module.js';
import { $, G, _dir, _f, _o, _wh, camBasis, camera, keys, mouse, player, sound } from './core.js';
import { esc, hostile, nameOf, net, remotes } from './mp.js';

// ---------- Chat ----------
const box = $('chatBox'), log = $('chatLog');
export const chatOpen = () => document.activeElement === box;
export function openChat() {
  if (!G.mp || chatOpen()) return;
  box.style.display = 'block'; box.value = ''; box.focus();
  for (const k in keys) keys[k] = false;
  mouse.L = mouse.R = false;
}
export function closeChat() { box.blur(); box.style.display = 'none'; }
box.addEventListener('keydown', (e) => {
  e.stopPropagation();   // yozayotganda o'yin tugmalari ishlamaydi
  if (e.key === 'Enter') { const m = box.value.trim(); if (m) net.send({ t: 'chat', m }); closeChat(); }
  else if (e.key === 'Escape') closeChat();
});
box.addEventListener('keyup', (e) => e.stopPropagation());
export function addChat(name, text, cls = '') {
  const d = document.createElement('div');
  d.className = 'cl ' + cls;
  d.innerHTML = `<b>${esc(name)}:</b> ${esc(text)}`;
  log.appendChild(d);
  while (log.children.length > 7) log.firstChild.remove();
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 600); }, 9000);
}
export function onChat(o) {
  const mine = o.id === G.myId;
  addChat((o.tm ? '[JAMOA] ' : '') + (mine ? (G.myName || 'Siz') : o.name), o.m, mine ? 'me' : hostileId(o.id) ? 'en' : 'al');
  if (!mine) sound.click();
}
function hostileId(id) { const r = remotes.get(id); return !!r && hostile(r); }

// ---------- Belgilar (ping) ----------
// Ekran markazi qaragan nuqtaga belgi qo'yiladi: 7 soniya devor ortidan ham ko'rinadi, mini xaritada ham chiqadi.
function pingTexture(label, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.font = 'bold 26px Arial'; g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillText(label, 129, 30);
  g.fillStyle = color; g.fillText(label, 128, 28);
  g.beginPath(); g.moveTo(128, 92); g.lineTo(108, 52); g.lineTo(128, 62); g.lineTo(148, 52); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function addPing(pos, label, color = '#ffd24a') {
  if (!G.scene) return;
  G.pings = (G.pings || []).filter((p) => { if (p.label !== label) return true; G.scene.remove(p.sp); p.sp.material.map.dispose(); p.sp.material.dispose(); return false; });   // har kimning bitta belgisi
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pingTexture(label, color), depthTest: false, transparent: true, fog: false }));
  sp.renderOrder = 997; sp.position.copy(pos); sp.position.y += 1.0;
  G.scene.add(sp);
  G.pings.push({ sp, pos: pos.clone(), t: 7, label });
  sound.ping();
}
export function doPing() {
  if (!player.alive || G.state !== 'playing') return;
  camBasis();
  const wh = G.world.rayCast(_o.copy(camera.position), _dir.copy(_f), 300, _wh, player.vehBox || undefined);
  if (!wh) return;
  addPing(wh.point, G.mp ? (G.myName || 'Siz') : 'Belgi');
  if (G.mp) net.send({ t: 'ping', p: [wh.point.x, wh.point.y, wh.point.z] });
}
export function onPing(o) {
  if (!Array.isArray(o.p) || o.p.length !== 3 || !o.p.every(Number.isFinite)) return;
  addPing(new THREE.Vector3(o.p[0], o.p[1], o.p[2]), nameOf(o.id), '#7fd3ff');
}
export function updateSocial(dt) {
  if (G.pings && G.pings.length) {
    for (let i = G.pings.length - 1; i >= 0; i--) {
      const p = G.pings[i];
      p.t -= dt;
      if (p.t <= 0 || p.sp.parent !== G.scene) { if (p.sp.parent) p.sp.parent.remove(p.sp); p.sp.material.map.dispose(); p.sp.material.dispose(); G.pings.splice(i, 1); continue; }
      const d = camera.position.distanceTo(p.pos), k = Math.max(1.2, d * 0.055);   // uzoqdan ham o'qiladigan o'lcham
      p.sp.scale.set(k * 2.4, k * 0.9, 1); p.sp.material.opacity = Math.min(1, p.t);
    }
  }
  // o'ldirgan o'yinchi kartochkasi: tirilguncha ko'rinadi
  const kc = $('killCard');
  if (G.killInfo && !player.alive) {
    const k = G.killInfo;
    if (kc.dataset.k !== k.key) {
      kc.dataset.k = k.key; kc.style.display = 'block';
      kc.innerHTML = `<div class="kcT">SIZNI O'LDIRDI</div><div class="kcN">${esc(k.name)}</div>` +
        `<div class="kcR">${k.weapon ? 'Qurol: <b>' + esc(k.weapon) + '</b> · ' : ''}${k.head ? "boshga o'q · " : ''}masofa <b>${Math.round(k.dist)} m</b>${k.hp != null ? ' · uning joni <b>' + k.hp + '</b>' : ''}</div>`;
    }
  } else if (kc.style.display !== 'none') { kc.style.display = 'none'; kc.dataset.k = ''; G.killInfo = null; }
}
// Halok bo'lganda kamera o'ldirgan tomonga buriladi (movement.js chaqiradi). Qaytaradi: yaw yoki null.
export function killerYaw() {
  const k = G.killInfo;
  if (!k || !k.pos) return null;
  const src = k.ref && k.ref.pos ? k.ref.pos : k.pos;
  return Math.atan2(-(src.x - player.pos.x), -(src.z - player.pos.z));
}
export function setKillInfo(name, pos, o = {}) {
  G.killInfo = { key: name + '|' + G.time.toFixed(2), name, pos: pos ? pos.clone() : null, ref: o.ref || null, weapon: o.weapon || '', head: !!o.head, hp: o.hp,
    dist: pos ? Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z) : 0 };
}
