// Visuals for energy attacks. Pure drawing: combat owns the state and passes it in.
import { rgb, rand } from '../core/math.js';
import { glowSprite, sprite } from './particles.js';
import { drawBolt } from './lightning.js';
import { quality } from '../core/quality.js';

function glow(ctx, x, y, r, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite(glowSprite(color)), x - r, y - r, r * 2, r * 2);
}

/** Ball of energy between the hands while charging. */
export function drawChargeBall(ctx, x, y, r, { core = [255, 255, 255], glow: gc = [80, 170, 255] }, t, crackle = 0.5) {
  if (r < 1) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, r * 4.2, gc, 0.55);
  glow(ctx, x, y, r * 2.2, gc, 0.9);
  const pulse = 1 + Math.sin(t * 24) * 0.06;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * pulse);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, rgb(core, 0.95));
  g.addColorStop(1, rgb(gc, 0));
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * pulse * 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (quality.settings.lightning && Math.random() < crackle) {
    const a = rand(0, Math.PI * 2), d = r * rand(1.2, 2.2);
    drawBolt(ctx, x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, { color: gc, width: 1.4, depth: 3 });
  }
}

/** Horizontal energy beam from (x0,y) to x1 with wobbling, tapered edges. */
export function drawBeam(ctx, b, t) {
  const { x0, y, x1, width, colors, alpha = 1 } = b;
  const dir = Math.sign(x1 - x0) || 1;
  const len = Math.abs(x1 - x0);
  if (len < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const layers = [
    { w: 2.6, a: 0.16, c: colors.glow },
    { w: 1.6, a: 0.32, c: colors.glow },
    { w: 0.95, a: 0.85, c: colors.core },
    { w: 0.42, a: 1, c: [255, 255, 255] },
  ];
  const step = 26;
  const segs = Math.max(2, Math.ceil(len / step));
  for (const L of layers) {
    const half = (width * L.w) / 2;
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const d = (i / segs) * len;
      const taper = Math.min(1, 0.45 + d / 110);
      const wob = 1 + 0.1 * Math.sin(d * 0.045 - t * 38 + L.w) + 0.06 * Math.sin(d * 0.13 + t * 21);
      const x = x0 + dir * d;
      const yy = y - half * taper * wob;
      if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    for (let i = segs; i >= 0; i--) {
      const d = (i / segs) * len;
      const taper = Math.min(1, 0.45 + d / 110);
      const wob = 1 + 0.1 * Math.sin(d * 0.05 - t * 33 + L.w * 2) + 0.06 * Math.sin(d * 0.11 + t * 17);
      ctx.lineTo(x0 + dir * d, y + half * taper * wob);
    }
    ctx.closePath();
    ctx.globalAlpha = L.a * alpha;
    ctx.fillStyle = rgb(L.c);
    ctx.fill();
  }
  // head and origin flare
  glow(ctx, x1, y, width * 2.2 * (1 + Math.sin(t * 30) * 0.08), colors.glow, 0.9 * alpha);
  glow(ctx, x1, y, width * 1.1, colors.core, alpha);
  glow(ctx, x0, y, width * 1.5, colors.glow, 0.8 * alpha);
  ctx.restore();
}

/** Spirit Bomb (or any big orb): glowing sphere with a rotating swirl texture. */
export function drawSphere(ctx, x, y, r, colors, t, alpha = 1) {
  if (r < 1) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, r * 2.6, colors.glow, 0.5 * alpha);
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.05, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(0.45, rgb(colors.core, 0.9 * alpha));
  g.addColorStop(0.9, rgb(colors.glow, 0.75 * alpha));
  g.addColorStop(1, rgb(colors.glow, 0));
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a0 = t * (1.4 + i * 0.35) + i * 1.3;
    ctx.globalAlpha = 0.35 * alpha;
    ctx.strokeStyle = rgb(i % 2 ? [255, 255, 255] : colors.core);
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.beginPath();
    ctx.ellipse(x, y, r * (0.5 + i * 0.09), r * (0.22 + i * 0.12), a0 * 0.3, a0, a0 + 2.2);
    ctx.stroke();
  }
  ctx.restore();
}

/** God-of-Destruction "Hakai": rune circle telegraph, then a collapsing void burst. */
export function drawHakai(ctx, x, y, r, t, phase, k) {
  ctx.save();
  if (phase === 'telegraph') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.scale(1, 0.28);
    ctx.strokeStyle = `rgba(190,90,255,${0.4 + 0.5 * k})`;
    ctx.lineWidth = 5;
    ctx.setLineDash([18, 12]);
    ctx.lineDashOffset = -t * 120;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * (1 - k * 0.6), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const px = x + Math.sin(t * 3 + i * 2) * r * 0.7;
      glow(ctx, px, y - ((t * 160 + i * 40) % 220), 26, [160, 60, 255], 0.5 * k);
    }
  } else {
    const rr = r * (1.3 - k);
    const g = ctx.createRadialGradient(x, y - 80, 0, x, y - 80, rr * 1.4);
    g.addColorStop(0, `rgba(20,0,40,${0.9 * (1 - k)})`);
    g.addColorStop(0.6, `rgba(150,50,255,${0.6 * (1 - k)})`);
    g.addColorStop(1, 'rgba(120,40,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y - 80, rr * 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawKiBlast(ctx, p, colors) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const tail = Math.sign(p.vx) * -1;
  for (let i = 3; i >= 1; i--) glow(ctx, p.x + tail * i * p.r * 0.9, p.y, p.r * (1.6 - i * 0.25), colors.glow, 0.25);
  glow(ctx, p.x, p.y, p.r * 2.4, colors.glow, 0.9);
  glow(ctx, p.x, p.y, p.r * 1.1, [255, 255, 255], 1);
  ctx.restore();
}

export function drawShockwave(ctx, s) {
  const k = s.t / s.dur;
  const r = s.r0 + (s.r1 - s.r0) * (1 - Math.pow(1 - k, 3));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(s.x, s.y);
  ctx.scale(1, s.flat || 1);
  ctx.globalAlpha = (1 - k) * (s.alpha ?? 1);
  ctx.strokeStyle = rgb(s.color);
  ctx.lineWidth = s.width * (1 - k * 0.7);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
