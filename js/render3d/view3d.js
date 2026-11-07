// The 3D view (Three.js): replaces the SVG arena, SVG fighters and effect canvases with a lit,
// cel-shaded 3D scene. Gameplay is untouched: combat still runs on the 2D stage plane and the
// existing Camera2D (follow, zoom, shake, orbit swings) drives a real perspective camera here.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { STAGE } from '../config.js';
import { quality } from '../core/quality.js';
import { rgb } from '../core/math.js';
import { U, wx, wy, DEG, color } from './common.js';
import { Arena3D } from './arena3d.js';
import { Fighter3D } from './fighter3d.js';
import { FX3D } from './fx3d.js';
import { beamOf } from '../combat/combat.js';

const FOV = 36;
const BASE_PITCH = 6;          // the camera sits a little above the fighters, looking down onto the ring
const SWING = { yaw: 1.7, pitch: 1.4 }; // 3D swings are wider than the old CSS tilt
const DPR = { high: 1.5, medium: 1.25, low: 1 };

export class View3D {
  constructor(app) {
    this.app = app;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'gl';
    this.canvas.setAttribute('aria-hidden', 'true');
    app.stage.prepend(this.canvas);
    this.q = quality.preset;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: this.q !== 'low', powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = this.q === 'high';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 1200);
    this.arena = new Arena3D(this.scene, this.q);
    this.fx3d = new FX3D(this.scene, this);
    this.fighters = new Map();
    this.lights = [0, 1].map(() => { const l = new THREE.PointLight('#ffffff', 0, 7, 1.6); this.scene.add(l); return l; });
    this._setupComposer();
    this.overlay = app.fx.front.getContext('2d');
    this.active = true;
    this._v = new THREE.Vector3();
    this.w = this.h = 1;
  }

  _setupComposer() {
    this.composer?.dispose?.();
    this.composer = null;
    if (this.q === 'low') return;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 288), this.q === 'high' ? 0.75 : 0.65, 0.45, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setQuality(q) {
    if (q === this.q) return;
    this.q = q;
    this._setupComposer();
    this.resize(this.w, this.h);
  }

  resize(w, h) {
    this.w = w; this.h = h;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR[this.q] || 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    if (this.composer) { this.composer.setPixelRatio(dpr); this.composer.setSize(w, h); }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  beamColors(f) { return beamOf(f, f.charge).colors; }

  /** Drive the perspective camera from Camera2D (target, zoom, shake, yaw/pitch swings). */
  _camera(cam) {
    const z = cam.cz ?? 1;
    const m = cam.matrix;
    const cx = cam.cx ?? cam.x, cy = cam.cy ?? cam.y;
    const sx = (m[4] - (STAGE.W / 2 - z * cx)) / z, sy = (m[5] - (STAGE.H / 2 - z * cy)) / z;
    const tx = wx(cx - sx), ty = wy(cy - sy);
    const dist = ((STAGE.H / 2) * U / z) / Math.tan((FOV / 2) * DEG);
    const yaw = cam.yaw * SWING.yaw * DEG, pitch = (BASE_PITCH + cam.pitch * SWING.pitch) * DEG;
    const c = this.camera;
    c.position.set(tx + dist * Math.sin(yaw) * Math.cos(pitch), ty + dist * Math.sin(pitch), dist * Math.cos(yaw) * Math.cos(pitch));
    c.lookAt(tx, ty, 0);
    c.updateMatrixWorld();
  }

  _syncFighters(combat) {
    const live = new Set();
    for (const f of combat?.fighters || []) {
      live.add(f.rig);
      if (!this.fighters.has(f.rig)) this.fighters.set(f.rig, new Fighter3D(f.rig, this.scene, this.q));
    }
    for (const [rig, f3] of this.fighters) if (!live.has(rig)) { f3.dispose(); this.fighters.delete(rig); }
  }

  render(combat, cam, fx, dt) {
    this._syncFighters(combat);
    this._camera(cam);
    this.arena.update(dt);
    if (combat) {
      this.arena.setDamage(combat.arenaDamage);
      const p1 = combat.p1;
      const tint = p1.def.forms?.[p1.form]?.aura?.outer;
      this.arena.setTint(tint ? rgb(tint) : '#ffffff', p1.form !== 'base' ? 0.05 + p1.aura.level * 0.05 : 0);
    }
    let li = 0;
    for (const [rig, f3] of this.fighters) {
      const aura = fx.auras.get(rig);
      f3.update(dt, aura);
      const light = this.lights[li++];
      if (light) {
        const lv = aura?.level || 0;
        light.intensity = lv * 2.6;
        if (lv > 0.01) color(aura.outer, light.color);
        light.position.set(wx(rig.x), wy(rig.y) + rig.height * U * 0.35, 2.2);
      }
    }
    for (; li < this.lights.length; li++) this.lights[li].intensity = 0;
    const pxScale = (this.renderer.getDrawingBufferSize(this._v2 || (this._v2 = new THREE.Vector2())).y) / (2 * Math.tan((FOV / 2) * DEG));
    this.fx3d.update(dt, combat, fx, this.fighters, pxScale);
    this.arena.hemi.intensity = 1.6 + fx.flashA * 1.5;
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    this._overlay(combat, fx, dt);
  }

  /** Stage point → canvas pixel of the overlay (device pixels when dpr is given). */
  project(x, y, w = this.w, h = this.h, z = 0) {
    const v = this._v.set(wx(x), wy(y), z).project(this.camera);
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, behind: v.z > 1 };
  }

  /** Screen-space extras on the front canvas: damage numbers, attack warnings, speed lines, flash. */
  _overlay(combat, fx, dt) {
    const ctx = this.overlay, cv = ctx.canvas;
    const W = cv.width, H = cv.height, k = W / STAGE.W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const P = (x, y) => this.project(x, y, W, H);
    if (combat) {
      for (const im of combat.impacts) {
        im.t += dt;
        const e = im.t / im.dur;
        if (e >= 1) continue;
        const c = P(im.x, im.y);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,255,255,${(1 - e) * 0.85})`;
        ctx.lineCap = 'round';
        const n = Math.round(14 + 14 * im.power);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + im.x * 0.01;
          const r0 = (40 + 140 * e * im.power) * k, r1 = r0 + (90 + 160 * im.power) * (1 - e * 0.5) * (0.6 + ((i * 7) % 5) / 10) * k;
          ctx.lineWidth = (1 - e) * (2 + 4 * im.power) * (i % 3 ? 0.6 : 1) * k * 1.4;
          ctx.beginPath();
          ctx.moveTo(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0);
          ctx.lineTo(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1);
          ctx.stroke();
        }
        ctx.restore();
      }
      combat.impacts = combat.impacts.filter((im) => im.t < im.dur);
      const t = performance.now() / 1000;
      for (const f of combat.fighters) {
        if (!f.tele) continue;
        const a = f.rig.anchors.top;
        const c = P(a.x, a.y - 30);
        const pulse = 0.6 + 0.4 * Math.sin(t * 18);
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(k * 1.15, k * 1.15);
        ctx.lineWidth = 5;
        ctx.strokeStyle = f.tele.unblockable ? `rgba(255,60,80,${pulse})` : `rgba(255,190,60,${pulse})`;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f.tele.k);
        ctx.stroke();
        ctx.fillStyle = f.tele.unblockable ? '#ff4a5e' : '#ffc23d';
        ctx.font = '900 30px "Bangers", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.tele.unblockable ? '!!' : '!', 0, 2);
        ctx.restore();
      }
    }
    for (const n of fx.numbers) {
      const c = P(n.x, n.y);
      const size = (n.big ? 46 : 32) * k * 1.2;
      ctx.globalAlpha = Math.min(1, (n.life / n.max) * 2);
      ctx.font = `900 ${size}px "Bangers", "Impact", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6 * k;
      ctx.strokeStyle = 'rgba(10,6,20,0.9)';
      ctx.strokeText(n.text, c.x, c.y);
      ctx.fillStyle = rgb(n.color);
      ctx.fillText(n.text, c.x, c.y);
    }
    ctx.globalAlpha = 1;
    if (fx.flashA > 0.01) {
      ctx.globalAlpha = Math.min(1, fx.flashA) * 0.85;
      ctx.fillStyle = rgb(fx.flashColor);
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  clear() {
    for (const [, f3] of this.fighters) f3.dispose();
    this.fighters.clear();
    this.fx3d.clear();
  }
}
