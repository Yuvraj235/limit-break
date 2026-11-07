import { STAGE } from '../config.js';
import { rand, rgb } from '../core/math.js';
import { quality } from '../core/quality.js';
import { Particles, KIND } from './particles.js';
import { Aura } from './aura.js';
import { drawShockwave } from './energy.js';

/**
 * Effects manager. Two canvases sandwich the fighters SVG: the back canvas holds aura flames and
 * ground runes; the front canvas holds attacks, particles, shockwaves, damage numbers and flashes.
 */
export class FX {
  constructor(backCanvas, frontCanvas) {
    this.back = backCanvas;
    this.front = frontCanvas;
    this.bctx = backCanvas.getContext('2d');
    this.fctx = frontCanvas.getContext('2d');
    this.particles = new Particles(3200);
    this.auras = new Map();
    this.waves = [];
    this.numbers = [];
    this.flashA = 0;
    this.flashColor = [255, 255, 255];
    this.flashDecay = 4;
    this.t = 0;
    this.k = 1;
  }

  resize(cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, quality.settings.dpr);
    for (const c of [this.back, this.front]) {
      c.width = Math.max(1, Math.round(cssW * dpr));
      c.height = Math.max(1, Math.round(cssH * dpr));
    }
    this.k = this.front.width / STAGE.W;
  }

  aura(rig) {
    let a = this.auras.get(rig);
    if (!a) { a = new Aura(); this.auras.set(rig, a); }
    return a;
  }

  forget(rig) { this.auras.delete(rig); }

  shockwave(x, y, o = {}) {
    this.waves.push({ x, y, t: 0, dur: o.dur ?? 0.5, r0: o.r0 ?? 10, r1: o.r1 ?? 220, width: o.width ?? 12, color: o.color ?? [255, 255, 255], flat: o.flat ?? 1, alpha: o.alpha ?? 1 });
  }

  flash(color = [255, 255, 255], amount = 0.8, decay = 4) {
    if (amount >= this.flashA) { this.flashColor = color; this.flashDecay = decay; }
    this.flashA = Math.max(this.flashA, amount);
  }

  burst(x, y, color, n = 24, speed = 650, size = 6) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.3, 1) * speed;
      this.particles.emit({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.18, 0.45), size, drag: 4, color, kind: KIND.STREAK });
    }
    for (let i = 0; i < n / 3; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.1, 0.5) * speed;
      this.particles.emit({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.2, 0.5), size: rand(14, 30), drag: 3, color, kind: KIND.GLOW });
    }
  }

  debris(x, y, n = 12, color = [96, 88, 120]) {
    for (let i = 0; i < n; i++) {
      this.particles.emit({ x: x + rand(-30, 30), y, vx: rand(-380, 380), vy: rand(-900, -350), grav: 2200, drag: 0.4, life: rand(0.6, 1.1), size: rand(6, 16), size1: 4, rot: rand(0, 6), vr: rand(-12, 12), color, kind: KIND.DEBRIS });
    }
  }

  dust(x, y, n = 10, color = [120, 110, 140]) {
    for (let i = 0; i < n; i++) {
      this.particles.emit({ x: x + rand(-40, 40), y: y - rand(0, 20), vx: rand(-220, 220), vy: rand(-90, -10), drag: 2.4, life: rand(0.5, 1.0), size: rand(14, 30), size1: rand(30, 60), alpha: 0.6, color, kind: KIND.SMOKE });
    }
  }

  number(x, y, text, color = [255, 255, 255], big = false) {
    this.numbers.push({ x: x + rand(-14, 14), y, text: String(text), color, life: 0.9, max: 0.9, big });
  }

  update(dt) {
    this.t += dt;
    this.particles.update(dt);
    for (const [rig, aura] of this.auras) aura.update(dt, rig, this.particles);
    for (let i = this.waves.length - 1; i >= 0; i--) if ((this.waves[i].t += dt) >= this.waves[i].dur) this.waves.splice(i, 1);
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.life -= dt;
      n.y -= dt * 90;
      if (n.life <= 0) this.numbers.splice(i, 1);
    }
    this.flashA = Math.max(0, this.flashA - dt * this.flashDecay);
  }

  render(cam, drawBack, drawFront) {
    const k = this.k;
    const m = cam;
    for (const ctx of [this.bctx, this.fctx]) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.setTransform(k * m[0], k * m[1], k * m[2], k * m[3], k * m[4], k * m[5]);
    }
    const b = this.bctx, f = this.fctx;
    for (const [rig, aura] of this.auras) aura.drawBack(b, rig);
    drawBack?.(b, this.t);

    drawFront?.(f, this.t);
    for (const [, aura] of this.auras) aura.drawFront(f);
    this.particles.draw(f);
    for (const w of this.waves) drawShockwave(f, w);
    for (const n of this.numbers) {
      const a = Math.min(1, n.life / n.max * 2);
      const size = n.big ? 46 : 32;
      f.globalAlpha = a;
      f.font = `900 ${size}px "Bangers", "Impact", system-ui, sans-serif`;
      f.textAlign = 'center';
      f.lineWidth = 6;
      f.strokeStyle = 'rgba(10,6,20,0.9)';
      f.strokeText(n.text, n.x, n.y);
      f.fillStyle = rgb(n.color);
      f.fillText(n.text, n.x, n.y);
    }
    f.globalAlpha = 1;
    if (this.flashA > 0.01) {
      f.setTransform(1, 0, 0, 1, 0, 0);
      f.globalAlpha = Math.min(1, this.flashA);
      f.fillStyle = rgb(this.flashColor);
      f.fillRect(0, 0, f.canvas.width, f.canvas.height);
      f.globalAlpha = 1;
    }
  }

  clear() {
    this.particles.clear();
    this.waves = [];
    this.numbers = [];
    this.flashA = 0;
    this.auras.clear();
  }
}
