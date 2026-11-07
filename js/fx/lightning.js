import { rand } from '../core/math.js';

function bolt(x1, y1, x2, y2, jag, depth, out) {
  if (depth === 0) { out.push(x2, y2); return; }
  const mx = (x1 + x2) / 2 + rand(-jag, jag);
  const my = (y1 + y2) / 2 + rand(-jag, jag);
  bolt(x1, y1, mx, my, jag / 2, depth - 1, out);
  bolt(mx, my, x2, y2, jag / 2, depth - 1, out);
}

/** Jagged electric arc: wide soft stroke under a thin bright core. */
export function drawBolt(ctx, x1, y1, x2, y2, { color = [180, 220, 255], width = 2.5, jag = 0, depth = 4, alpha = 1 } = {}) {
  const pts = [x1, y1];
  bolt(x1, y1, x2, y2, jag || Math.hypot(x2 - x1, y2 - y1) * 0.25, depth, pts);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  };
  path();
  ctx.globalAlpha = 0.35 * alpha;
  ctx.strokeStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  ctx.lineWidth = width * 4;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}
