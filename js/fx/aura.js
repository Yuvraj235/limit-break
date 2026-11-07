import { damp, noise1, rand, rgb } from '../core/math.js';
import { quality } from '../core/quality.js';
import { KIND } from './particles.js';
import { drawBolt } from './lightning.js';

/**
 * Flame-shaped ki aura around a fighter. The flame body is drawn on the back canvas (behind the
 * character); rising embers and lightning go on the front canvas.
 */
export class Aura {
  constructor() {
    this.level = 0;
    this.target = 0;
    this.inner = [255, 255, 255];
    this.outer = [130, 190, 255];
    this.lightning = false;
    this.ui = false;
    this.t = Math.random() * 100;
    this._emit = 0;
    this.bolts = [];
  }

  set(level, colors, flags = {}) {
    this.target = level;
    if (colors) { this.inner = colors.inner; this.outer = colors.outer; }
    this.lightning = !!flags.lightning;
    this.ui = !!flags.ui;
  }

  update(dt, rig, particles) {
    this.t += dt;
    this.level = damp(this.level, this.target, this.target > this.level ? 7 : 3, dt);
    if (this.level < 0.02 || !rig) return;
    const h = rig.height;
    const cx = rig.x;
    const base = rig.y - (rig.pose?.lift || 0) * rig.scale;
    const density = quality.settings.auraDensity;
    this._emit += dt * this.level * 110 * density;
    while (this._emit >= 1) {
      this._emit -= 1;
      const u = rand(-1, 1);
      const ui = this.ui;
      particles.emit({
        x: cx + u * h * 0.26,
        y: base - rand(0, h * 0.9),
        vx: rand(-25, 25),
        vy: ui ? rand(-90, -30) : rand(-420, -200) * (0.6 + this.level * 0.6),
        life: ui ? rand(0.6, 1.1) : rand(0.25, 0.55),
        size: ui ? rand(4, 9) : rand(8, 20) * (0.6 + this.level * 0.5),
        size1: 1,
        drag: 1.5,
        color: Math.random() < 0.35 ? this.inner : this.outer,
        alpha: 0.85,
        kind: KIND.GLOW,
      });
    }
    if (this.lightning && quality.settings.lightning && Math.random() < dt * 9 * this.level) {
      const a = rand(-1, 1) * h * 0.25, b = rand(-1, 1) * h * 0.3;
      this.bolts.push({ x1: cx + a, y1: base - rand(0.2, 0.9) * h, x2: cx + b, y2: base - rand(0.1, 0.8) * h, life: 0.09 });
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) if ((this.bolts[i].life -= dt) <= 0) this.bolts.splice(i, 1);
  }

  /** Flame body (back canvas). */
  drawBack(ctx, rig) {
    if (this.level < 0.02 || !rig) return;
    const L = this.level;
    const h = rig.height;
    const cx = rig.x;
    const base = rig.y - (rig.pose?.lift || 0) * rig.scale;
    const cy = base - h * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const layer of [{ s: 1.18, a: 0.32 }, { s: 0.9, a: 0.5 }]) {
      const rx = h * 0.34 * layer.s * (0.85 + L * 0.25);
      const ry = h * 0.56 * layer.s * (0.85 + L * 0.25);
      ctx.beginPath();
      const N = 30;
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * Math.PI * 2;
        const up = Math.max(0, -Math.sin(th));
        const flick = noise1(this.t * (this.ui ? 3 : 7) + i * 3.1 + layer.s * 10);
        let r = 1 + 0.12 * flick;
        let x = cx + Math.cos(th) * rx * r;
        let y = cy + Math.sin(th) * ry * r - up * up * h * (0.18 + 0.32 * flick) * L;
        if (i % 2 === 1) { x = cx + (x - cx) * 0.9; y = cy + (y - cy) * 0.94; }
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy + h * 0.1, h * 0.05, cx, cy, ry * 1.25);
      g.addColorStop(0, rgb(this.inner, 0.08 * L));
      g.addColorStop(0.45, rgb(this.inner, 0.45 * L * layer.a));
      g.addColorStop(0.75, rgb(this.outer, 0.8 * L * layer.a));
      g.addColorStop(1, rgb(this.outer, 0));
      ctx.fillStyle = g;
      ctx.fill();
    }
    // ground glow
    const gg = ctx.createRadialGradient(cx, rig.y, 0, cx, rig.y, h * 0.6);
    gg.addColorStop(0, rgb(this.outer, 0.45 * L));
    gg.addColorStop(1, rgb(this.outer, 0));
    ctx.fillStyle = gg;
    ctx.save();
    ctx.translate(cx, rig.y);
    ctx.scale(1, 0.18);
    ctx.translate(-cx, -rig.y);
    ctx.fillRect(cx - h * 0.6, rig.y - h * 0.6, h * 1.2, h * 1.2);
    ctx.restore();
    ctx.restore();
  }

  /** Lightning (front canvas). */
  drawFront(ctx) {
    for (const b of this.bolts) drawBolt(ctx, b.x1, b.y1, b.x2, b.y2, { color: [170, 210, 255], width: 1.8, depth: 4 });
  }
}
