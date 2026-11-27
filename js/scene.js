// Sahna: dunyoni yaratish/tozalash va qo'ldagi qurolning yoritilishi.
import * as THREE from '../lib/three.module.js';
import { preloadVehicles } from './vehskin.js';
import { G, applyQuality, camera, effQ, liteNow, player, renderer, sound, wAmb, wEnvDefault, wHemi, wScene, wSun, wTorch } from './core.js';
import { setupTorch } from './zmode.js';
import { stopEngines } from './transport.js';
import { FX, Weather } from './fx.js';
import { GFX, makeEnv, skyAt } from './gfx.js';
import { World } from './world.js';
import { clearDrones } from './drone.js';
import { relToPlayer, toggleBigMap } from './hud.js';
import { clearZone } from './zone.js';

// ---------- Sahna ----------
export function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) { if (m.map) m.map.dispose(); if (m.normalMap) m.normalMap.dispose(); m.dispose(); }
    }
  });
}
// Yakka o'yin uchun sahna sozlamalari: xarita va rejim menyuda tanlanadi (zombi rejimi doim katta xaritada, tunda)
export function spSceneOpts() { const z = G.spMode === 'zombie'; return { map: z ? 'wild' : G.spMap, night: z, zombie: z, noVeh: !G.spVeh }; }
// opts: { map, night, zombie, veh } — tarmoqda server yuborgan qiymatlar
export function createScene(era, opts = spSceneOpts()) {
  stopEngines(); clearDrones(); clearZone();
  if (G.scene) disposeScene(G.scene);
  if (G.world) G.world.dispose();
  applyQuality();
  const scene = new THREE.Scene();
  G.scene = scene;
  GFX.lite = liteNow();
  preloadVehicles(era);   // transport modellari (vehskin.js) — jang boshlanguncha yuklanib ulguradi
  G.world = new World(scene, era, effQ(), opts);
  // oyna singanda tovushi (masofa va tomoniga qarab)
  { const gp = new THREE.Vector3(); G.world.onGlass = (x, y, z) => { const rp = relToPlayer(gp.set(x, y, z)); sound.glass(rp.dist, rp.pan); }; }
  // atrof-muhit yorug'ligi: osmonning o'zidan olinadi — metall va silliq yuzalarda osmon aks etadi, soyalar osmon rangida to'ladi
  try {
    if (G.envRT) { G.envRT.dispose(); G.envRT = null; }
    if (GFX.lite) wScene.environment = wEnvDefault;
    else { G.envRT = makeEnv(renderer, G.world.sky, G.world.envGain); scene.environment = G.envRT.texture; wScene.environment = G.envRT.texture; }
  } catch (e) { console.warn('atrof-muhit xaritasi yaratilmadi', e); }
  G.zombie = !!opts.zombie; G.night = !!opts.night;
  G.fx = new FX(scene, era);
  G.weather = new Weather(scene, era, G.night);
  G.torch = null; G.torchOn = false; G.zg = null;
  if (G.night) setupTorch();
  G.soldiers = []; G.grenades = []; G.planes = []; G.strikes = []; G.flag = null; G.turrets = []; G.pings = []; G.noises.length = 0; G.lock = null; G.killInfo = null; toggleBigMap(false);
  G.vehicles = []; G.projectiles = []; G.pickups = []; G.inVeh = null; G.seat = -1; G.chute = false; G.chuteMesh = null; player.vehBox = null;
  G.platform = null; G.insideVeh = null;
  wHemi.color.setHex(G.night ? 0x7f95bd : era === 'historical' ? 0xc4ccd6 : 0xe6eeff);
  wSun.color.setHex(G.night ? 0xa8bce0 : era === 'historical' ? 0xe4eaf2 : 0xfff0d4);
  G.gunSun = era === 'historical' ? 1.6 : 2.6; G.gunK = 1; G.gunLit = 1; G.gunT = 0;
}
// Qo'ldagi qurolning yoritilishi atrofga mos: soyada va uy ichida qorayadi, tunda deyarli ko'rinmaydi (fonar va chaqmoq yoritadi)
export const _sunTo = new THREE.Vector3();
export function updateGunLight(dt) {
  const W = G.world; if (!W) return;
  const cp = camera.position;
  G.gunT -= dt;
  if (G.gunT <= 0) {
    G.gunT = 0.12;
    let lit = skyAt(W.roof, cp.x, cp.y, cp.z) > 0.9 ? 1 : 0;
    if (lit && W.sunDir) lit = W.los(cp, _sunTo.copy(cp).addScaledVector(W.sunDir, 140)) ? 1 : 0.12;   // quyosh to'silgan — soyadamiz
    G.gunLitT = lit; G.gunOpenT = skyAt(W.roof, cp.x, cp.y, cp.z);
  }
  const k = Math.min(1, dt * 7), f = W.flashF || 0;
  G.gunLit += ((G.gunLitT ?? 1) - G.gunLit) * k; G.gunK += ((G.gunOpenT ?? 1) - G.gunK) * k;
  const amb = G.night ? 0.07 + f * 1.4 : G.gunK;
  wSun.intensity = G.night ? 0.12 * G.gunK + f * 3 : G.gunSun * G.gunLit;
  wHemi.intensity = 0.9 * amb; wAmb.intensity = 0.35 * amb;
  wTorch.intensity = G.torch ? G.torch.intensity * 0.05 : 0;
}
