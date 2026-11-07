export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
/** Linear 0..1 ramp from a to b (a may be greater than b for a falling ramp). */
export const ramp = (v, a, b) => clamp(invLerp(a, b, v));
export const smoothstep = (a, b, v) => { const t = ramp(v, a, b); return t * t * (3 - 2 * t); };
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist2 = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const DEG = Math.PI / 180;
export const sign = (v) => (v < 0 ? -1 : 1);

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
};

/** Frame-rate independent exponential approach. */
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

/**
 * Critically damped spring step (in place on an {x, v} pair). Uses the closed-form solution, so it
 * stays stable at any dt (a throttled tab or a slow phone can't make poses explode).
 */
export function springStep(s, target, omega, dt) {
  const x0 = s.x - target;
  const c = s.v + omega * x0;
  const e = Math.exp(-omega * dt);
  s.x = target + (x0 + c * dt) * e;
  s.v = (s.v - omega * c * dt) * e;
}

/* Smooth 1D value noise, deterministic per seed. */
const PERM = new Float32Array(512);
for (let i = 0; i < 512; i++) PERM[i] = Math.abs(Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1;
export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const a = PERM[i & 511], b = PERM[(i + 1) & 511];
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u; // 0..1
}
export const snoise1 = (x) => noise1(x) * 2 - 1;

/* Minimal 2D affine matrix [a b c d e f] matching SVG's matrix(a,b,c,d,e,f). */
export const M = {
  identity: () => [1, 0, 0, 1, 0, 0],
  mul(m, n) {
    return [
      m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
    ];
  },
  translate: (m, x, y) => M.mul(m, [1, 0, 0, 1, x, y]),
  rotate(m, deg) { const r = deg * DEG, c = Math.cos(r), s = Math.sin(r); return M.mul(m, [c, s, -s, c, 0, 0]); },
  scale: (m, sx, sy = sx) => M.mul(m, [sx, 0, 0, sy, 0, 0]),
  apply: (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }),
};

export function lerpColor(a, b, t) {
  return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
}
export const rgb = (c, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
export function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
