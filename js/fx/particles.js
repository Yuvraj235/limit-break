import { quality } from '../core/quality.js';

const sprites = [];
const spriteIndex = new Map();

/** Pre-rendered radial glow per color: drawImage is far cheaper than per-particle gradients. */
export function glowSprite(c) {
  const key = `${c[0] >> 3},${c[1] >> 3},${c[2] >> 3}`;
  let id = spriteIndex.get(key);
  if (id !== undefined) return id;
  const s = document.createElement('canvas');
  s.width = s.height = 64;
  const x = s.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, `rgba(${c[0]},${c[1]},${c[2]},0.95)`);
  g.addColorStop(0.5, `rgba(${c[0]},${c[1]},${c[2]},0.35)`);
  g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  id = sprites.length;
  sprites.push(s);
  spriteIndex.set(key, id);
  return id;
}
export const sprite = (id) => sprites[id];

export const KIND = { GLOW: 0, DEBRIS: 1, SMOKE: 2, STREAK: 3 };

/** Pooled particle system (struct-of-arrays, swap-remove; no per-frame allocation). */
export class Particles {
  constructor(capacity = 3000) {
    this.cap = capacity;
    this.n = 0;
    const F = (n) => new Float32Array(n);
    Object.assign(this, {
      x: F(capacity), y: F(capacity), z: F(capacity), vz: F(capacity), vx: F(capacity), vy: F(capacity), life: F(capacity), max: F(capacity),
      s0: F(capacity), s1: F(capacity), drag: F(capacity), grav: F(capacity), alpha: F(capacity),
      tx: F(capacity), ty: F(capacity), pull: F(capacity), rot: F(capacity), vr: F(capacity),
      kind: new Uint8Array(capacity), spr: new Uint16Array(capacity), col: new Uint32Array(capacity),
    });
  }

  emit(o) {
    const limit = Math.min(this.cap, quality.settings.particles);
    if (this.n >= limit) return;
    const i = this.n++;
    this.x[i] = o.x; this.y[i] = o.y;
    this.vx[i] = o.vx || 0; this.vy[i] = o.vy || 0;
    // Depth for the 3D view (the 2D canvas ignores it): a little scatter, and bursts spread in depth too.
    this.z[i] = o.z ?? (Math.random() - 0.5) * 50;
    this.vz[i] = o.vz ?? (o.pull ? 0 : (Math.random() - 0.5) * 0.7 * Math.hypot(this.vx[i], this.vy[i]));
    this.life[i] = this.max[i] = o.life || 0.5;
    this.s0[i] = o.size || 10; this.s1[i] = o.size1 ?? (o.size || 10) * 0.2;
    this.drag[i] = o.drag ?? 1; this.grav[i] = o.grav || 0;
    this.alpha[i] = o.alpha ?? 1;
    this.pull[i] = o.pull || 0; this.tx[i] = o.tx || 0; this.ty[i] = o.ty || 0;
    this.rot[i] = o.rot || 0; this.vr[i] = o.vr || 0;
    this.kind[i] = o.kind || KIND.GLOW;
    const c = o.color || [255, 255, 255];
    this.col[i] = (c[0] << 16) | (c[1] << 8) | c[2];
    if (this.kind[i] === KIND.GLOW) this.spr[i] = glowSprite(c);
  }

  _kill(i) {
    const j = --this.n;
    if (i === j) return;
    for (const k of ['x', 'y', 'z', 'vz', 'vx', 'vy', 'life', 'max', 's0', 's1', 'drag', 'grav', 'alpha', 'tx', 'ty', 'pull', 'rot', 'vr', 'kind', 'spr', 'col']) this[k][i] = this[k][j];
  }

  update(dt) {
    for (let i = this.n - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this._kill(i); continue; }
      if (this.pull[i]) {
        const dx = this.tx[i] - this.x[i], dy = this.ty[i] - this.y[i];
        const d = Math.hypot(dx, dy) || 1;
        this.vx[i] += (dx / d) * this.pull[i] * dt;
        this.vy[i] += (dy / d) * this.pull[i] * dt;
        if (d < 14) { this._kill(i); continue; }
      }
      const k = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= k;
      this.vy[i] = this.vy[i] * k + this.grav[i] * dt;
      this.vz[i] *= k;
      this.z[i] += this.vz[i] * dt;
      if (this.pull[i]) this.z[i] *= Math.exp(-6 * dt);
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.rot[i] += this.vr[i] * dt;
    }
  }

  draw(ctx) {
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < this.n; i++) {
      const kind = this.kind[i];
      if (kind !== KIND.DEBRIS && kind !== KIND.SMOKE) continue;
      const t = this.life[i] / this.max[i];
      const s = this.s1[i] + (this.s0[i] - this.s1[i]) * t;
      const c = this.col[i];
      ctx.globalAlpha = this.alpha[i] * (kind === KIND.SMOKE ? t * 0.5 : Math.min(1, t * 3));
      ctx.fillStyle = `rgb(${c >> 16},${(c >> 8) & 255},${c & 255})`;
      if (kind === KIND.SMOKE) {
        ctx.beginPath(); ctx.arc(this.x[i], this.y[i], s, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.save(); ctx.translate(this.x[i], this.y[i]); ctx.rotate(this.rot[i]);
        ctx.fillRect(-s / 2, -s / 2, s, s * 0.7); ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.n; i++) {
      const kind = this.kind[i];
      const t = this.life[i] / this.max[i];
      if (kind === KIND.GLOW) {
        const s = this.s1[i] + (this.s0[i] - this.s1[i]) * t;
        ctx.globalAlpha = this.alpha[i] * Math.min(1, t * 2.5);
        ctx.drawImage(sprites[this.spr[i]], this.x[i] - s, this.y[i] - s, s * 2, s * 2);
      } else if (kind === KIND.STREAK) {
        const c = this.col[i];
        ctx.globalAlpha = this.alpha[i] * t;
        ctx.strokeStyle = `rgb(${c >> 16},${(c >> 8) & 255},${c & 255})`;
        ctx.lineWidth = this.s0[i] * (0.4 + t * 0.6);
        ctx.beginPath();
        ctx.moveTo(this.x[i], this.y[i]);
        ctx.lineTo(this.x[i] - this.vx[i] * 0.04, this.y[i] - this.vy[i] * 0.04);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  clear() { this.n = 0; }
}
