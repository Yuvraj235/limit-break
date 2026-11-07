// 3D effects. Combat and fx/ keep owning all effect state (particles, auras, beams, projectiles,
// hazards, shockwaves); this layer only draws that state in 3D: flame-shell auras, layered beam
// cylinders, swirling energy spheres, glowing ki blasts, a barrier dome, shockwave rings and
// particles with real depth.
import * as THREE from 'three';
import { STAGE } from '../config.js';
import { KIND } from '../fx/particles.js';
import { U, wx, wy, color, glowSprite, glowTexture } from './common.js';

const NOISE = `
  float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }`;

const FRESNEL_VS = `varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;

/** Swirling energy ball (Spirit Bomb, charge balls, clash point). */
function energyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { core: { value: new THREE.Color() }, glow: { value: new THREE.Color() }, time: { value: 0 }, alpha: { value: 1 } },
    vertexShader: FRESNEL_VS,
    fragmentShader: `uniform vec3 core; uniform vec3 glow; uniform float time; uniform float alpha; varying vec3 vN; varying vec3 vV; varying vec3 vP; ${NOISE}
      void main(){ float f = clamp(dot(vN, vV), 0.0, 1.0);
        float n = fbm(vP * 2.6 + vec3(time * 0.9, -time * 1.3, time * 0.7));
        float swirl = smoothstep(0.45, 0.8, fbm(vec3(vP.x * 4.0 + time * 1.7, vP.y * 4.0, vP.z * 4.0 - time)));
        vec3 col = mix(glow, core, smoothstep(0.3, 0.95, f)) + vec3(1.0) * pow(f, 8.0) * 0.5 + core * swirl * 0.35;
        float a = (0.55 + 0.45 * n) * mix(0.55, 1.0, f) * alpha;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

/** One layer of a beam: a cylinder along +x (0..1) that wobbles, tapers at the hands and streaks. */
function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { col: { value: new THREE.Color() }, time: { value: 0 }, len: { value: 1 }, alpha: { value: 1 }, edge: { value: 1.5 }, phase: { value: 0 } },
    vertexShader: `uniform float time; uniform float len; uniform float phase; varying vec3 vN; varying vec3 vV; varying float vX;
      void main(){ vec3 p = position; vX = p.x; float d = p.x * len;
        float wob = 1.0 + 0.1 * sin(d * 4.5 - time * 38.0 + phase) + 0.06 * sin(d * 13.0 + time * 21.0);
        p.yz *= wob * min(1.0, 0.45 + d / 1.1);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 col; uniform float time; uniform float len; uniform float alpha; uniform float edge; varying vec3 vN; varying vec3 vV; varying float vX;
      void main(){ float f = abs(dot(vN, vV)); float streak = 0.8 + 0.2 * sin(vX * len * 14.0 - time * 70.0);
        gl_FragColor = vec4(col * streak, pow(f, edge) * alpha);
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

/** Flame shell around a powered-up fighter: noisy tongues licking upward, brightest at the rim. */
function auraMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { inner: { value: new THREE.Color() }, outer: { value: new THREE.Color() }, time: { value: 0 }, level: { value: 0 }, speed: { value: 1 }, alpha: { value: 1 } },
    vertexShader: `uniform float time; uniform float level; uniform float speed; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vec3 p = position; float up = max(0.0, p.y);
        float n = sin(p.x * 7.0 + time * speed * 6.0) * sin(p.z * 6.0 - time * speed * 5.0) * 0.5 + 0.5;
        p.y += up * up * (0.3 + 0.9 * n) * (0.4 + level);
        p.xz *= 1.0 - up * 0.3;
        vP = position; vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 inner; uniform vec3 outer; uniform float time; uniform float level; uniform float speed; uniform float alpha; varying vec3 vN; varying vec3 vV; varying vec3 vP; ${NOISE}
      void main(){ float f = 1.0 - abs(dot(vN, vV));
        float n = fbm(vec3(vP.x * 3.2, vP.y * 2.2 - time * speed * 2.6, vP.z * 3.2));
        float flame = smoothstep(0.3, 0.95, pow(f, 1.4) + n * 0.7 - 0.2) * smoothstep(-1.0, -0.6, vP.y);
        vec3 c = mix(inner, outer, smoothstep(0.25, 0.95, f + n * 0.2));
        gl_FragColor = vec4(c, flame * level * alpha * (0.55 + 0.6 * n));
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

/** Energy Barrier dome: honeycomb-ish shimmer, bright rim, flashes when struck. */
function barrierMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { col: { value: new THREE.Color() }, time: { value: 0 }, hit: { value: 0 } },
    vertexShader: FRESNEL_VS,
    fragmentShader: `uniform vec3 col; uniform float time; uniform float hit; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ float f = 1.0 - abs(dot(vN, vV));
        vec2 h = vec2(atan(vP.z, vP.x) * 3.0, vP.y * 6.0);
        float cell = abs(sin(h.x * 3.0) * sin(h.y * 3.0 + time * 2.0));
        float a = pow(f, 2.2) * (0.6 + hit) + smoothstep(0.9, 1.0, cell) * 0.18 + hit * 0.25;
        gl_FragColor = vec4(mix(col, vec3(1.0), pow(f, 6.0) * 0.6 + hit * 0.4), a);
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

// sRGB → linear lookup for particle colors
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

/** Particles from fx/particles.js, drawn as soft points with depth. */
class ParticleLayer {
  constructor(scene, cap) {
    this.cap = cap;
    const mk = (additive) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('pcolor', new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('psize', new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('palpha', new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('pkind', new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage));
      const m = new THREE.ShaderMaterial({
        uniforms: { scale: { value: 500 } },
        vertexShader: `uniform float scale; attribute vec3 pcolor; attribute float psize; attribute float palpha; attribute float pkind;
          varying vec3 vC; varying float vA; varying float vK;
          void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
            gl_PointSize = max(1.0, psize * scale / -mv.z); vC = pcolor; vA = palpha; vK = pkind; }`,
        fragmentShader: `varying vec3 vC; varying float vA; varying float vK;
          void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
            if (vK < 0.5) { float a = pow(1.0 - r, 1.7); gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.35, 0.0, r) * 0.6), a * vA * 0.8); }
            else if (vK < 1.5) { gl_FragColor = vec4(vC * (0.7 + 0.3 * (1.0 - r)), vA * step(r, 0.85)); }
            else { gl_FragColor = vec4(vC, vA * smoothstep(1.0, 0.2, r)); }
            #include <colorspace_fragment>
          }`,
        transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const p = new THREE.Points(g, m);
      p.frustumCulled = false;
      scene.add(p);
      return p;
    };
    this.glow = mk(true);
    this.solid = mk(false);
  }

  update(P, scale) {
    let ng = 0, ns = 0;
    const G = this.glow.geometry.attributes, S = this.solid.geometry.attributes;
    for (let i = 0; i < P.n; i++) {
      const kind = P.kind[i];
      const t = P.life[i] / P.max[i];
      let size, alpha, k, A, j;
      if (kind === KIND.GLOW || kind === KIND.STREAK) {
        if (ng >= this.cap) continue;
        size = kind === KIND.GLOW ? (P.s1[i] + (P.s0[i] - P.s1[i]) * t) * 2 : P.s0[i] * (1 + t * 1.2);
        alpha = kind === KIND.GLOW ? P.alpha[i] * Math.min(1, t * 2.5) : P.alpha[i] * t;
        k = 0; A = G; j = ng++;
      } else {
        if (ns >= this.cap) continue;
        size = (P.s1[i] + (P.s0[i] - P.s1[i]) * t) * (kind === KIND.SMOKE ? 2.2 : 1.1);
        alpha = kind === KIND.SMOKE ? P.alpha[i] * t * 0.45 : P.alpha[i] * Math.min(1, t * 3);
        k = kind === KIND.SMOKE ? 2 : 1; A = S; j = ns++;
      }
      A.position.array[j * 3] = wx(P.x[i]);
      A.position.array[j * 3 + 1] = wy(P.y[i]);
      A.position.array[j * 3 + 2] = P.z[i] * U;
      const c = P.col[i];
      A.pcolor.array[j * 3] = LIN[c >> 16]; A.pcolor.array[j * 3 + 1] = LIN[(c >> 8) & 255]; A.pcolor.array[j * 3 + 2] = LIN[c & 255];
      A.psize.array[j] = size * U;
      A.palpha.array[j] = alpha;
      A.pkind.array[j] = k;
    }
    for (const [pts, n] of [[this.glow, ng], [this.solid, ns]]) {
      const a = pts.geometry.attributes;
      for (const key of ['position', 'pcolor', 'psize', 'palpha', 'pkind']) { a[key].needsUpdate = true; a[key].clearUpdateRanges?.(); }
      pts.geometry.setDrawRange(0, n);
      pts.material.uniforms.scale.value = scale;
    }
  }
}

/** Keeps one 3D object per live effect object (beam, projectile...), creating and dropping as needed. */
class Pool {
  constructor(scene, make) { this.scene = scene; this.make = make; this.map = new Map(); }
  get(key) {
    let o = this.map.get(key);
    if (!o) { o = this.make(); this.scene.add(o.obj); this.map.set(key, o); }
    o.seen = true;
    return o;
  }
  sweep() {
    for (const [k, o] of this.map) {
      if (!o.seen) { this.scene.remove(o.obj); o.dispose?.(); this.map.delete(k); } else o.seen = false;
    }
  }
  clear() { for (const [, o] of this.map) { this.scene.remove(o.obj); o.dispose?.(); } this.map.clear(); }
}

const SPH = new THREE.SphereGeometry(1, 40, 28);
const SPH_LO = new THREE.SphereGeometry(1, 16, 12);
const BEAM = new THREE.CylinderGeometry(1, 1, 1, 22, 28, true);
BEAM.rotateZ(-Math.PI / 2);
BEAM.translate(0.5, 0, 0);
const RING = new THREE.RingGeometry(0.86, 1, 72);
RING.rotateX(-Math.PI / 2);

export class FX3D {
  constructor(scene, view) {
    this.scene = scene;
    this.view = view;
    this.t = 0;
    this.particles = new ParticleLayer(scene, 3200);
    this.auras = new Pool(scene, () => this._makeAura());
    this.beams = new Pool(scene, () => this._makeBeam());
    this.blasts = new Pool(scene, () => this._makeBlast());
    this.spheres = new Pool(scene, () => this._makeSphere());
    this.charges = new Pool(scene, () => this._makeSphere(true));
    this.barriers = new Pool(scene, () => this._makeBarrier());
    this.waves = new Pool(scene, () => this._makeWave());
    this.hakai = new Pool(scene, () => this._makeHakai());
    this._bolts();
    this._v = new THREE.Vector3();
    this._c = new THREE.Color();
  }

  /* ── builders ──────────────────────────────────────────────────────────── */
  _makeAura() {
    const obj = new THREE.Group();
    const mats = [auraMaterial(), auraMaterial()];
    const outer = new THREE.Mesh(SPH, mats[0]); outer.scale.set(1.18, 1.08, 1.18);
    const inner = new THREE.Mesh(SPH, mats[1]); inner.scale.set(0.86, 0.9, 0.86);
    obj.add(outer, inner);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    ground.rotation.x = -Math.PI / 2;
    const wrap = new THREE.Group();
    wrap.add(obj);
    this.scene.add(ground);
    return { obj: wrap, body: obj, mats, ground, dispose: () => { this.scene.remove(ground); ground.material.dispose(); mats.forEach((m) => m.dispose()); } };
  }

  _makeBeam() {
    const obj = new THREE.Group();
    const layers = [[2.4, 0.38, 0.7, 'glow'], [1.5, 0.5, 0.9, 'glow'], [0.8, 0.6, 1.8, 'core'], [0.34, 0.9, 2.6, 'white']].map(([w, a, edge, key]) => {
      const m = beamMaterial();
      m.uniforms.edge.value = edge;
      m.uniforms.phase.value = w * 2;
      const mesh = new THREE.Mesh(BEAM, m);
      mesh.frustumCulled = false;
      obj.add(mesh);
      return { mesh, m, w, a, key };
    });
    const head = glowSprite('#ffffff', 1);
    const headCore = glowSprite('#ffffff', 1);
    const origin = glowSprite('#ffffff', 1);
    this.scene.add(head, headCore, origin);
    return { obj, layers, head, headCore, origin, dispose: () => { for (const s of [head, headCore, origin]) { this.scene.remove(s); s.material.dispose(); } layers.forEach((l) => l.m.dispose()); } };
  }

  _makeBlast() {
    const obj = new THREE.Group();
    const core = new THREE.Mesh(SPH_LO, new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    const glow = glowSprite('#ffffff', 1);
    const trail = [glowSprite('#ffffff', 1, 0.3), glowSprite('#ffffff', 1, 0.22), glowSprite('#ffffff', 1, 0.15)];
    obj.add(core, glow, ...trail);
    return { obj, core, glow, trail, dispose: () => { core.material.dispose(); glow.material.dispose(); trail.forEach((s) => s.material.dispose()); } };
  }

  _makeSphere(small = false) {
    const obj = new THREE.Group();
    const m = energyMaterial();
    const ball = new THREE.Mesh(SPH, m);
    const halo = glowSprite('#ffffff', 1, small ? 0.8 : 0.55);
    obj.add(halo, ball);
    const rings = [];
    if (!small) for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.018, 6, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      r.rotation.set(i ? 1.2 : 0.4, i ? 0.5 : -0.3, 0);
      obj.add(r);
      rings.push(r);
    }
    return { obj, m, ball, halo, rings, dispose: () => { m.dispose(); halo.material.dispose(); rings.forEach((r) => { r.geometry.dispose(); r.material.dispose(); }); } };
  }

  _makeBarrier() {
    const m = barrierMaterial();
    const obj = new THREE.Mesh(SPH, m);
    return { obj, m, dispose: () => m.dispose() };
  }

  _makeWave() {
    const flat = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const m = energyMaterial();
    const shell = new THREE.Mesh(SPH_LO, m);
    const obj = new THREE.Group();
    obj.add(flat, shell);
    return { obj, flat, shell, m, dispose: () => { flat.material.dispose(); m.dispose(); } };
  }

  _makeHakai() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    x.strokeStyle = '#ffffff';
    x.lineWidth = 6;
    x.setLineDash([22, 12]);
    x.beginPath(); x.arc(128, 128, 118, 0, Math.PI * 2); x.stroke();
    x.setLineDash([]);
    x.lineWidth = 3;
    x.beginPath(); x.arc(128, 128, 92, 0, Math.PI * 2); x.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; x.save(); x.translate(128 + Math.cos(a) * 105, 128 + Math.sin(a) * 105); x.rotate(a); x.fillStyle = '#fff'; x.fillRect(-4, -7, 8, 14); x.restore(); }
    const tex = new THREE.CanvasTexture(c);
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, color: '#b05aff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    rune.rotation.x = -Math.PI / 2;
    const voidBall = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: '#14001f', transparent: true }));
    const halo = glowSprite('#9b3cff', 1, 0.8);
    const wisps = Array.from({ length: 6 }, () => glowSprite('#a050ff', 0.5, 0.6));
    const obj = new THREE.Group();
    obj.add(rune, voidBall, halo, ...wisps);
    return { obj, rune, voidBall, halo, wisps, dispose: () => { tex.dispose(); rune.material.dispose(); voidBall.material.dispose(); halo.material.dispose(); wisps.forEach((w) => w.material.dispose()); } };
  }

  _bolts() {
    const max = 40 * 16;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.boltLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#d8ecff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.boltLines.frustumCulled = false;
    this.scene.add(this.boltLines);
    this._boltN = 0;
    this._boltMax = max;
  }

  _bolt(a, b, jag) {
    const pts = [a.clone(), b.clone()];
    for (let d = 0; d < 4; d++) {
      for (let i = pts.length - 1; i > 0; i--) {
        const m = pts[i - 1].clone().add(pts[i]).multiplyScalar(0.5);
        m.x += (Math.random() - 0.5) * jag; m.y += (Math.random() - 0.5) * jag; m.z += (Math.random() - 0.5) * jag;
        pts.splice(i, 0, m);
      }
      jag *= 0.5;
    }
    const arr = this.boltLines.geometry.attributes.position.array;
    for (let i = 0; i < pts.length - 1 && this._boltN < this._boltMax; i++, this._boltN++) {
      arr.set([pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z], this._boltN * 6);
    }
  }

  /* ── per frame ─────────────────────────────────────────────────────────── */
  update(dt, combat, fx, fighters, pxScale) {
    this.t += dt;
    const t = this.t;
    this._boltN = 0;
    this.particles.update(fx.particles, pxScale);

    // Auras
    for (const [rig, aura] of fx.auras) {
      const f3 = fighters.get(rig);
      if (!f3 || aura.level < 0.02) continue;
      const o = this.auras.get(rig);
      const h = rig.height * U;
      const lift = (rig.pose?.lift || 0) * rig.scale * U;
      o.obj.position.set(wx(rig.x), wy(rig.y) + lift + h * 0.5, f3.root.position.z);
      const grow = 0.9 + aura.level * 0.25;
      o.body.scale.set(h * 0.44 * grow, h * 0.58 * grow, h * 0.4 * grow);
      o.mats.forEach((m, i) => {
        color(aura.inner, m.uniforms.inner.value);
        color(aura.outer, m.uniforms.outer.value);
        m.uniforms.time.value = t + i * 3.1;
        m.uniforms.level.value = aura.level;
        m.uniforms.speed.value = aura.ui ? 0.35 : 1;
        m.uniforms.alpha.value = i ? 0.12 : 0.24;
      });
      o.ground.position.set(wx(rig.x), 0.012, f3.root.position.z);
      o.ground.scale.set(h * 1.3, h * 1.3, 1);
      color(aura.outer, o.ground.material.color);
      o.ground.material.opacity = 0.55 * aura.level * Math.max(0, 1 - lift / 3);
      o.ground.visible = rig.y < STAGE.GROUND_Y + 30;
      for (const b of aura.bolts) {
        const z = f3.root.position.z;
        this._bolt(this._v.set(wx(b.x1), wy(b.y1), z + (Math.random() - 0.5) * 0.5), new THREE.Vector3(wx(b.x2), wy(b.y2), z + (Math.random() - 0.5) * 0.5), h * 0.25);
      }
    }
    this.auras.sweep();
    if (!combat) { this._finish(); return; }

    // Charge balls and barriers
    for (const f of combat.fighters) {
      const f3 = fighters.get(f.rig);
      if (!f3) continue;
      let r = 0, colors = null;
      if (f.state === 'charge_kame') { r = 8 + 30 * f.charge; colors = this.view.beamColors(f); }
      else if (f.state === 'beam_charge' && f.tele) { r = 6 + 30 * f.tele.k; colors = f.def.ki || { core: [255, 236, 160], glow: [255, 96, 30] }; }
      if (r > 0) {
        const o = this.charges.get(f);
        const p = f3.handWorld('both', this._v);
        const pulse = 1 + Math.sin(t * 24) * 0.06;
        this._energy(o, p, r * U * 1.1 * pulse, colors, t);
        o.halo.scale.setScalar(r * U * 4.5);
        if (Math.random() < 0.25 + f.charge * 0.5) this._bolt(p, p.clone().add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(r * U * 4)), r * U);
      }
      if (f.state === 'guard') {
        const o = this.barriers.get(f);
        const c = f.center;
        const rr = (f.height * 0.62 + Math.sin(t * 9) * 3) * U;
        o.obj.position.set(wx(c.x), wy(c.y), f3.root.position.z);
        o.obj.scale.set(rr * 0.92, rr, rr * 0.92);
        color(f.def.forms?.[f.form]?.aura?.outer || f.def.ki?.glow || [140, 200, 255], o.m.uniforms.col.value);
        o.m.uniforms.time.value = t;
        o.m.uniforms.hit.value = f.barrierHit ? f.barrierHit / 0.25 : 0;
      }
    }
    this.barriers.sweep();

    // Beams: from the caster's actual hands to the tip
    for (const b of combat.beams) {
      const o = this.beams.get(b);
      const f3 = fighters.get(b.owner?.rig);
      const from = f3 ? f3.handWorld('both', this._v) : this._v.set(wx(b.x0), wy(b.y), 0);
      const to = new THREE.Vector3(wx(b.tip), wy(b.y), 0);
      const dir = to.clone().sub(from);
      const len = Math.max(0.02, dir.length());
      o.obj.position.copy(from);
      o.obj.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
      const R = (b.width / 2) * U;
      for (const L of o.layers) {
        L.mesh.scale.set(len, R * L.w, R * L.w);
        color(L.key === 'white' ? [255, 255, 255] : b.colors[L.key], L.m.uniforms.col.value);
        L.m.uniforms.time.value = t;
        L.m.uniforms.len.value = len;
        L.m.uniforms.alpha.value = L.a * (b.alpha ?? 1);
      }
      o.head.position.copy(to); o.headCore.position.copy(to); o.origin.position.copy(from);
      o.head.scale.setScalar(b.width * U * 3.2 * (1 + Math.sin(t * 30) * 0.08));
      o.headCore.scale.setScalar(b.width * U * 1.4);
      o.origin.scale.setScalar(b.width * U * 2.4);
      color(b.colors.glow, o.head.material.color); color(b.colors.core, o.headCore.material.color); color(b.colors.glow, o.origin.material.color);
      for (const s of [o.head, o.headCore, o.origin]) s.material.opacity = b.alpha ?? 1;
    }
    this.beams.sweep();

    // Projectiles
    for (const p of combat.projectiles) {
      if (p.kind === 'kiblast' || p.kind === 'volley') {
        const o = this.blasts.get(p);
        const f3 = fighters.get(p.owner?.rig);
        const z0 = f3 ? f3.handWorld(p.owner.blastAlt ? 'B' : 'F', this._v).z : 0;
        const z = z0 * Math.max(0, 1 - (p.t || 0) / 0.22);
        const r = p.r * U;
        o.obj.position.set(wx(p.x), wy(p.y), z);
        o.core.scale.setScalar(r * 0.9);
        o.glow.scale.setScalar(r * 5);
        color(p.colors.glow, o.glow.material.color);
        const tail = -Math.sign(p.vx || 1);
        o.trail.forEach((s, i) => { s.position.set(tail * r * 1.8 * (i + 1), 0, 0); s.scale.setScalar(r * (3.4 - i * 0.6)); color(p.colors.glow, s.material.color); });
      } else {
        const o = this.spheres.get(p);
        const r = p.r * U;
        this._energy(o, this._v.set(wx(p.x), wy(p.y), 0), r, p.colors, t, p.alpha ?? 1);
        if (p.shape === 'blade') {
          // Spirit Excalibur: a giant ki blade, held aloft while charging, then flying point-first
          o.ball.scale.set(r * 0.34, r * 2.8, r * 0.14);
          o.ball.rotation.z = p.to ? Math.atan2(wy(p.to.y) - wy(p.y), wx(p.to.x) - wx(p.x)) - Math.PI / 2 : 0;
          o.halo.scale.setScalar(r * 3.4);
          o.rings.forEach((g) => { g.visible = false; });
        } else {
          o.ball.rotation.z = 0;
          o.halo.scale.setScalar(r * 5.4);
          o.rings.forEach((g, i) => { g.visible = true; g.rotation.z = t * (0.8 + i * 0.5); g.scale.setScalar(r); color(i ? [255, 255, 255] : p.colors.core, g.material.color); });
        }
      }
    }
    this.blasts.sweep();
    this.spheres.sweep();

    // Hakai: rune circle on the ring, then a collapsing void
    for (const h of combat.hazards) {
      if (h.kind !== 'hakai') continue;
      const o = this.hakai.get(h);
      const R = h.r * U;
      o.obj.position.set(wx(h.x), 0.02, 0);
      if (h.phase === 'tele') {
        const k = Math.min(1, h.t / h.tele);
        o.rune.visible = true; o.voidBall.visible = false; o.halo.visible = false;
        o.rune.scale.setScalar(R);
        o.rune.rotation.z = t * 1.4;
        o.rune.material.opacity = 0.45 + 0.55 * k;
        o.wisps.forEach((w, i) => { w.visible = true; w.position.set(Math.sin(t * 3 + i * 2) * R * 0.7, ((t * 1.6 + i * 0.4) % 2.2), Math.cos(t * 2 + i) * R * 0.5); w.material.opacity = 0.6 * k; });
      } else {
        const k = Math.min(1, h.t / 0.55);
        o.rune.visible = false;
        o.wisps.forEach((w) => { w.visible = false; });
        o.voidBall.visible = o.halo.visible = true;
        const rr = R * (1.3 - k) * 1.2;
        o.voidBall.position.y = o.halo.position.y = 0.8;
        o.voidBall.scale.setScalar(Math.max(0.01, rr));
        o.voidBall.material.opacity = 0.9 * (1 - k);
        o.halo.scale.setScalar(rr * 4);
        o.halo.material.opacity = 0.8 * (1 - k);
      }
    }
    this.hakai.sweep();

    // Beam struggle clash point
    if (combat.struggle) {
      const s = combat.struggle;
      const o = this.charges.get(s);
      const p = new THREE.Vector3(wx(s.pos), wy(s.pb.y), 0);
      this._energy(o, p, (44 + Math.sin(t * 30) * 6) * U, { core: [255, 255, 255], glow: s.eo.colors.glow }, t);
      o.halo.scale.setScalar(4.5);
      for (let i = 0; i < 2; i++) this._bolt(p, p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.8, (Math.random() - 0.5) * 2.8, (Math.random() - 0.5) * 1.5)), 0.5);
    }

    // Shockwaves: ground waves lie on the ring, air waves expand as shells
    fx.waves.forEach((w, i) => {
      const o = this.waves.get(w);
      const k = w.t / w.dur;
      const r = (w.r0 + (w.r1 - w.r0) * (1 - Math.pow(1 - k, 3))) * U;
      const a = (1 - k) * (w.alpha ?? 1);
      const ground = (w.flat ?? 1) < 0.6;
      o.flat.visible = ground; o.shell.visible = !ground;
      if (ground) {
        o.obj.position.set(wx(w.x), Math.max(0.03, wy(w.y)), 0);
        o.flat.scale.setScalar(r);
        color(w.color, o.flat.material.color);
        o.flat.material.opacity = a;
      } else {
        o.obj.position.set(wx(w.x), wy(w.y), 0);
        o.shell.scale.setScalar(r);
        color(w.color, o.m.uniforms.glow.value);
        o.m.uniforms.core.value.setRGB(1, 1, 1);
        o.m.uniforms.alpha.value = a * 0.55;
        o.m.uniforms.time.value = t + i;
      }
    });
    this.waves.sweep();
    this.charges.sweep();
    this._finish();
  }

  _energy(o, pos, r, colors, t, alpha = 1) {
    o.obj.position.copy(pos);
    o.ball.scale.setScalar(Math.max(0.005, r));
    color(colors.core, o.m.uniforms.core.value);
    color(colors.glow, o.m.uniforms.glow.value);
    o.m.uniforms.time.value = t;
    o.m.uniforms.alpha.value = alpha;
    color(colors.glow, o.halo.material.color);
    o.halo.scale.setScalar(r * 4.2);
  }

  _finish() {
    const g = this.boltLines.geometry;
    g.attributes.position.needsUpdate = true;
    g.setDrawRange(0, this._boltN * 2);
  }

  clear() {
    for (const p of [this.auras, this.beams, this.blasts, this.spheres, this.charges, this.barriers, this.waves, this.hakai]) p.clear();
  }
}
