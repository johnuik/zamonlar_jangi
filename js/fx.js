import * as THREE from '../lib/three.module.js';

const VS = `
attribute float psize; attribute float palpha; attribute vec3 pcolor;
uniform float uScale; varying vec3 vC; varying float vA;
void main(){ vC = pcolor; vA = palpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = psize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FS = `
varying vec3 vC; varying float vA; uniform float uSoft;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
  float a = vA * pow(1.0 - d * 2.0, uSoft); gl_FragColor = vec4(vC, a); }`;

class Particles {
  constructor(scene, max, additive, soft) {
    this.max = max; this.i = 0; this.alive = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max); this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.a0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    const mk = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    this.aPos = mk(this.pos, 3); this.aCol = mk(this.col, 3); this.aSize = mk(this.size, 1); this.aAlpha = mk(this.alpha, 1);
    g.setAttribute('position', this.aPos); g.setAttribute('pcolor', this.aCol);
    g.setAttribute('psize', this.aSize); g.setAttribute('palpha', this.aAlpha);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 }, uSoft: { value: soft } },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, size, grow, r, g, b, alpha, grav = 0, drag = 0) {
    const i = this.i; this.i = (i + 1) % this.max;
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.col[k] = r; this.col[k + 1] = g; this.col[k + 2] = b;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.grow[i] = grow;
    this.a0[i] = alpha; this.alpha[i] = alpha; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    const n = this.max;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      const k = i * 3;
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[k] *= dr; this.vel[k + 1] = this.vel[k + 1] * dr - this.grav[i] * dt; this.vel[k + 2] *= dr;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0.02 && this.grav[i] > 0) { this.pos[k + 1] = 0.02; this.vel[k + 1] *= -0.2; this.vel[k] *= 0.5; this.vel[k + 2] *= 0.5; }
      this.size[i] += this.grow[i] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = this.a0[i] * Math.min(1, t * 2.2) * Math.min(1, (1 - t) * 12 + 0.25);
    }
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true; this.aAlpha.needsUpdate = true;
  }
}

function radialTex(stops, size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function flashTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  for (let i = 0; i < 7; i++) {
    g.rotate((Math.PI * 2) / 7 + Math.random() * 0.3);
    const gr = g.createLinearGradient(0, 0, 0, -60);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,140,20,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(-7, 0); g.lineTo(0, -40 - Math.random() * 22); g.lineTo(7, 0); g.fill();
  }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30);
  gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(1, 'rgba(255,160,40,0)');
  g.fillStyle = gr; g.fillRect(-30, -30, 60, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class FX {
  constructor(scene, era) {
    this.scene = scene; this.era = era;
    this.add = new Particles(scene, 2500, true, 1.2);
    this.norm = new Particles(scene, 3500, false, 1.0);

    // Iz o'qlari (tracer)
    this.tracers = [];
    const tg = new THREE.BoxGeometry(1, 1, 1); tg.translate(0, 0, 0.5);
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.visible = false; m.frustumCulled = false; scene.add(m);
      this.tracers.push({ mesh: m, from: new THREE.Vector3(), dir: new THREE.Vector3(), len: 0, d: 0, active: false, seg: 3 });
    }
    this.ti = 0;

    // O'q izlari (decal)
    const holeTex = radialTex([[0, 'rgba(0,0,0,1)'], [0.35, 'rgba(15,12,10,0.95)'], [0.55, 'rgba(40,35,30,0.6)'], [1, 'rgba(40,35,30,0)']]);
    const holeMat = new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const hg = new THREE.PlaneGeometry(0.16, 0.16);
    this.decals = [];
    for (let i = 0; i < 160; i++) { const m = new THREE.Mesh(hg, holeMat); m.visible = false; scene.add(m); this.decals.push(m); }
    this.di = 0;
    const scorchTex = radialTex([[0, 'rgba(10,8,6,0.95)'], [0.5, 'rgba(20,16,12,0.7)'], [1, 'rgba(20,16,12,0)']], 128);
    const scorchMat = new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const sg = new THREE.PlaneGeometry(4, 4);
    this.scorches = [];
    for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(sg, scorchMat); m.visible = false; m.rotation.x = -Math.PI / 2; scene.add(m); this.scorches.push(m); }
    this.si = 0;

    // Chaqnash chiroqlari
    this.lights = [];
    for (let i = 0; i < 4; i++) {
      const L = new THREE.PointLight(0xffb060, 0, 16, 2);
      scene.add(L); this.lights.push({ L, t: 0, dur: 1, peak: 0 });
    }
    this.li = 0;

    // Dushman qurolining chaqnashi (sprite)
    this.flashMat = new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    this.flashes = [];
    for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(this.flashMat); s.visible = false; scene.add(s); this.flashes.push({ s, t: 0 }); }
    this.fi = 0;

    this.dustColor = era === 'historical' ? [0.88, 0.9, 0.92] : [0.78, 0.66, 0.48];
  }

  setScale(camera, height) {
    const s = height / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.add.mat.uniforms.uScale.value = s;
    this.norm.mat.uniforms.uScale.value = s;
  }

  flash(p, color, peak, dur, dist = 16) {
    const l = this.lights[this.li]; this.li = (this.li + 1) % this.lights.length;
    l.L.position.copy(p); l.L.color.setHex(color); l.L.distance = dist; l.peak = peak; l.t = dur; l.dur = dur; l.L.intensity = peak;
  }

  muzzle(p, scale = 1) {
    const f = this.flashes[this.fi]; this.fi = (this.fi + 1) % this.flashes.length;
    f.s.position.copy(p); f.s.visible = true; f.t = 0.05;
    const s = (0.45 + Math.random() * 0.3) * scale; f.s.scale.set(s, s, s);
    f.s.material.rotation = Math.random() * Math.PI;
    this.flash(p, 0xffb050, 6 * scale, 0.06, 9);
    this.norm.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 0.4, 0.4, (Math.random() - 0.5) * 0.4, 0.8, 0.15, 0.5, 0.6, 0.6, 0.6, 0.18, -0.2, 1);
  }

  tracer(from, to, color = 0xffe2a0, speed = 320) {
    const t = this.tracers[this.ti]; this.ti = (this.ti + 1) % this.tracers.length;
    t.from.copy(from); t.dir.subVectors(to, from); t.len = t.dir.length();
    if (t.len < 1) return;
    t.dir.multiplyScalar(1 / t.len); t.d = 0; t.active = true; t.speed = speed; t.seg = Math.min(4, t.len * 0.5);
    t.mesh.material.color.setHex(color);
    t.mesh.visible = true;
    t.mesh.position.copy(from);
    t.mesh.lookAt(to);
    t.mesh.scale.set(0.035, 0.035, 0.01);
  }

  decal(p, n) {
    const m = this.decals[this.di]; this.di = (this.di + 1) % this.decals.length;
    m.position.copy(p).addScaledVector(n, 0.015);
    m.lookAt(p.x + n.x, p.y + n.y, p.z + n.z);
    m.rotateZ(Math.random() * 6.28);
    const s = 0.7 + Math.random() * 0.6; m.scale.set(s, s, s);
    m.visible = true;
  }

  impact(p, n, surface = 'wall') {
    const ground = surface === 'ground';
    const dc = ground ? this.dustColor : [0.55, 0.52, 0.48];
    for (let i = 0; i < 6; i++) {
      this.add.emit(p.x, p.y, p.z, n.x * 3 + (Math.random() - 0.5) * 5, n.y * 3 + Math.random() * 3, n.z * 3 + (Math.random() - 0.5) * 5, 0.2 + Math.random() * 0.2, 0.04, 0, 1, 0.75, 0.35, 1, 12, 1);
    }
    for (let i = 0; i < 5; i++) {
      this.norm.emit(p.x, p.y, p.z, n.x * 1.5 + (Math.random() - 0.5) * 1.4, n.y * 1.5 + Math.random() * 1.2, n.z * 1.5 + (Math.random() - 0.5) * 1.4, 0.7 + Math.random() * 0.6, 0.12, 0.9, dc[0], dc[1], dc[2], 0.55, 1.5, 2.5);
    }
    if (ground) for (let i = 0; i < 4; i++) {
      this.norm.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 2, 2 + Math.random() * 3, (Math.random() - 0.5) * 2, 0.6, 0.06, 0, dc[0] * 0.8, dc[1] * 0.8, dc[2] * 0.8, 0.9, 12, 0.5);
    }
  }

  blood(p, dir, big = false) {
    const n = big ? 22 : 10;
    for (let i = 0; i < n; i++) {
      this.norm.emit(p.x, p.y, p.z, dir.x * 2 + (Math.random() - 0.5) * 2.5, dir.y * 2 + Math.random() * 1.5, dir.z * 2 + (Math.random() - 0.5) * 2.5, 0.35 + Math.random() * 0.4, 0.08 + Math.random() * 0.1, 0.25, 0.45 + Math.random() * 0.2, 0.02, 0.02, 0.9, 8, 1);
    }
    this.norm.emit(p.x, p.y, p.z, dir.x * 0.5, 0.2, dir.z * 0.5, 0.5, 0.25, 0.8, 0.5, 0.05, 0.05, 0.5, 0, 2);
  }

  explosion(p, scale = 1) {
    this.flash(new THREE.Vector3(p.x, p.y + 1.5, p.z), 0xff9a40, 260 * scale, 0.45, 30);
    for (let i = 0; i < 45 * scale; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 0.9 + 0.1, sp = 6 + Math.random() * 16;
      this.add.emit(p.x, p.y + 0.3, p.z, Math.cos(a) * sp * (1 - u * 0.5), u * sp, Math.sin(a) * sp * (1 - u * 0.5), 0.5 + Math.random() * 0.7, 0.07, 0, 1, 0.7, 0.3, 1, 14, 1.2);
    }
    for (let i = 0; i < 14 * scale; i++) {
      this.add.emit(p.x + (Math.random() - 0.5) * 1.5, p.y + 0.6 + Math.random(), p.z + (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 5, 2 + Math.random() * 5, (Math.random() - 0.5) * 5, 0.35 + Math.random() * 0.35, 1.4 * scale, 4 * scale, 1, 0.55 + Math.random() * 0.2, 0.15, 0.95, -2, 3);
    }
    for (let i = 0; i < 22 * scale; i++) {
      const g = 0.18 + Math.random() * 0.15;
      this.norm.emit(p.x + (Math.random() - 0.5) * 2, p.y + 0.5 + Math.random() * 2, p.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 6, 1 + Math.random() * 4, (Math.random() - 0.5) * 6, 2.5 + Math.random() * 2.5, 1.5 * scale, 2.2, g, g * 0.95, g * 0.9, 0.75, -0.6, 1.5);
    }
    const dc = this.dustColor;
    for (let i = 0; i < 30 * scale; i++) {
      this.norm.emit(p.x, p.y + 0.2, p.z, (Math.random() - 0.5) * 12, 5 + Math.random() * 10, (Math.random() - 0.5) * 12, 1.2 + Math.random(), 0.12, 0, dc[0] * 0.5, dc[1] * 0.45, dc[2] * 0.4, 1, 14, 0.3);
    }
    if (p.y < 0.5) {
      const s = this.scorches[this.si]; this.si = (this.si + 1) % this.scorches.length;
      s.position.set(p.x, 0.03 + this.si * 0.0008, p.z); s.rotation.z = Math.random() * 6; s.scale.setScalar(scale * (0.8 + Math.random() * 0.5)); s.visible = true;
    }
  }

  fire(p) {
    this.add.emit(p.x + (Math.random() - 0.5) * 1.2, p.y, p.z + (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.4, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.4, 0.6 + Math.random() * 0.5, -0.6, 1, 0.45 + Math.random() * 0.25, 0.1, 0.85, -1, 0.5);
  }
  smokePuff(p, alpha, big = false) {
    const g = 0.12 + Math.random() * 0.12;
    const s = big ? 5 : 1.2;
    this.norm.emit(p.x + (Math.random() - 0.5) * s * 0.4, p.y + 0.5, p.z + (Math.random() - 0.5) * s * 0.4, 0.6 + Math.random() * 0.5, big ? 3 + Math.random() * 2 : 1.5 + Math.random(), 0.3 + Math.random() * 0.4, big ? 12 + Math.random() * 6 : 5, s, big ? 1.6 : 0.8, g, g, g * 0.95, alpha, 0, 0.05);
  }

  update(dt) {
    this.add.update(dt); this.norm.update(dt);
    for (const t of this.tracers) {
      if (!t.active) continue;
      t.d += t.speed * dt;
      const tail = t.d - t.seg;
      if (tail >= t.len) { t.active = false; t.mesh.visible = false; continue; }
      const a = Math.max(0, tail), b = Math.min(t.d, t.len);
      t.mesh.position.copy(t.from).addScaledVector(t.dir, a);
      t.mesh.scale.z = Math.max(0.01, b - a);
    }
    for (const l of this.lights) {
      if (l.t <= 0) continue;
      l.t -= dt;
      l.L.intensity = l.t > 0 ? l.peak * (l.t / l.dur) : 0;
    }
    for (const f of this.flashes) {
      if (!f.s.visible) continue;
      f.t -= dt; if (f.t <= 0) f.s.visible = false;
    }
  }
}

// ---------- Ob-havo (qor / chang) ----------
// Yomg'ir: tez tushadigan qisqa chiziqlar (kamera atrofida aylanib turadi)
class Rain {
  constructor(scene) {
    const n = (this.n = 2600), R = (this.R = 26), Hh = (this.H = 20);
    const pos = (this.pos = new Float32Array(n * 6));
    this.sp = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * R * 2, y = Math.random() * Hh, z = (Math.random() - 0.5) * R * 2, k = i * 6;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z; pos[k + 3] = x; pos[k + 4] = y + 0.55; pos[k + 5] = z;
      this.sp[i] = 19 + Math.random() * 8;
    }
    this.geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(pos, 3); this.attr.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.attr);
    this.mat = new THREE.LineBasicMaterial({ color: 0xa9bcd4, transparent: true, opacity: 0.34, depthWrite: false });
    this.lines = new THREE.LineSegments(this.geo, this.mat);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
  }
  update(dt, cam) {
    const p = this.pos, R = this.R, Hh = this.H, wx = 2.2 * dt;
    for (let i = 0; i < this.n; i++) {
      const k = i * 6, d = this.sp[i] * dt;
      p[k + 1] -= d; p[k + 4] -= d; p[k] += wx; p[k + 3] += wx;
      if (p[k + 1] < 0) { p[k + 1] += Hh; p[k + 4] += Hh; }
      let dx = p[k] - cam.x; if (dx > R) { p[k] -= R * 2; p[k + 3] -= R * 2; } else if (dx < -R) { p[k] += R * 2; p[k + 3] += R * 2; }
      let dz = p[k + 2] - cam.z; if (dz > R) { p[k + 2] -= R * 2; p[k + 5] -= R * 2; } else if (dz < -R) { p[k + 2] += R * 2; p[k + 5] += R * 2; }
    }
    this.attr.needsUpdate = true;
  }
}

export class Weather {
  constructor(scene, era, rain = false) {
    if (rain) { this.rain = new Rain(scene); return; }
    this.era = era;
    const snow = era === 'historical';
    const n = snow ? 5000 : 1200;
    this.n = n; this.R = 40;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this.R * 2;
      pos[i * 3 + 1] = Math.random() * 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * this.R * 2;
    }
    this.pos = pos;
    this.geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(pos, 3); this.attr.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.attr);
    const tex = radialTex([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']], 32);
    this.mat = new THREE.PointsMaterial({ size: snow ? 0.11 : 0.06, map: tex, transparent: true, depthWrite: false, color: snow ? 0xffffff : 0xd8c29a, opacity: snow ? 0.9 : 0.45 });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.t = 0;
  }
  update(dt, cam) {
    if (this.rain) { this.rain.update(dt, cam); return; }
    this.t += dt;
    const snow = this.era === 'historical';
    const p = this.pos, R = this.R;
    const wind = Math.sin(this.t * 0.3) * 0.8 + 0.6;
    for (let i = 0; i < this.n; i++) {
      const k = i * 3;
      if (snow) {
        p[k + 1] -= dt * (1.3 + (i % 7) * 0.12);
        p[k] += dt * (wind + Math.sin(this.t * 1.3 + i) * 0.35);
        p[k + 2] += dt * Math.cos(this.t * 1.1 + i * 0.7) * 0.3;
      } else {
        p[k] += dt * (wind * 2.2);
        p[k + 1] += dt * Math.sin(this.t + i) * 0.25;
      }
      if (p[k + 1] < 0) p[k + 1] += 25;
      if (p[k + 1] > 25) p[k + 1] -= 25;
      let dx = p[k] - cam.x; if (dx > R) p[k] -= R * 2; else if (dx < -R) p[k] += R * 2;
      let dz = p[k + 2] - cam.z; if (dz > R) p[k + 2] -= R * 2; else if (dz < -R) p[k + 2] += R * 2;
    }
    this.attr.needsUpdate = true;
  }
}
