// Shared SVG part builders. Every character is assembled from these unless its definition
// overrides a part, so swapping in final art later means replacing one builder at a time.
import { DEG } from '../core/math.js';

export const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

const f = (n) => Math.round(n * 100) / 100;

/** Tapered capsule from (0,0) down to (0,L). */
export function limbPath(L, w0, w1, bulge = 0) {
  const a = w0 / 2, b = w1 / 2;
  return `M${f(-a)},0 Q${f(-a - bulge)},${f(L * 0.45)} ${f(-b)},${f(L)} A${f(b)},${f(b)} 0 0 0 ${f(b)},${f(L)}`
    + ` Q${f(a + bulge)},${f(L * 0.45)} ${f(a)},0 A${f(a)},${f(a)} 0 0 0 ${f(-a)},0Z`;
}

export function limb(g, L, w0, w1, fill, stroke, bulge = 0, sw = 2.2) {
  return el('path', { d: limbPath(L, w0, w1, bulge), fill, stroke, 'stroke-width': sw, 'stroke-linejoin': 'round' }, g);
}

/** Outlined "stroke shape" (fingers, horns, ribbons): dark outline under a colored stroke. */
export function strokeShape(g, d, width, color, outline, sw = 2.2) {
  el('path', { d, fill: 'none', stroke: outline, 'stroke-width': width + sw * 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  return el('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
}

/** Hand shapes in the wrist frame (hand extends along +y). Returns groups keyed by shape. */
export function buildHands(g, R, skin, stroke) {
  const shapes = {};
  const fist = el('g', {}, g);
  el('path', { d: `M${-0.8 * R},0 L${0.8 * R},0 Q${1.08 * R},${0.25 * R} ${1.02 * R},${1.2 * R} Q${0.95 * R},${1.8 * R} 0,${1.85 * R} Q${-1.02 * R},${1.8 * R} ${-1.02 * R},${1.1 * R} Q${-1.06 * R},${0.25 * R} ${-0.8 * R},0Z`, fill: skin, stroke, 'stroke-width': 2 }, fist);
  el('path', { d: `M${-0.5 * R},${1.25 * R} L${0.6 * R},${1.25 * R}`, stroke, 'stroke-width': 1.4, fill: 'none', opacity: 0.6 }, fist);
  el('ellipse', { cx: 0.9 * R, cy: 0.75 * R, rx: 0.32 * R, ry: 0.55 * R, fill: skin, stroke, 'stroke-width': 1.6 }, fist);
  shapes.fist = fist;

  const open = el('g', {}, g);
  for (const x of [-0.6, -0.2, 0.2, 0.6]) {
    const len = x === -0.2 || x === 0.2 ? 2.35 : 2.1;
    strokeShape(open, `M${x * R},${0.9 * R} L${x * 1.15 * R},${len * R}`, 0.4 * R, skin, stroke, 1.4);
  }
  strokeShape(open, `M${0.75 * R},${0.35 * R} L${1.45 * R},${1.05 * R}`, 0.42 * R, skin, stroke, 1.4);
  el('path', { d: `M${-0.8 * R},0 L${0.8 * R},0 L${0.9 * R},${1.15 * R} L${-0.9 * R},${1.15 * R}Z`, fill: skin, stroke, 'stroke-width': 2, 'stroke-linejoin': 'round' }, open);
  shapes.open = open;

  const claw = el('g', {}, g);
  for (const x of [-0.6, -0.2, 0.2, 0.6]) {
    strokeShape(claw, `M${x * R},${0.9 * R} L${x * R},${1.65 * R} L${(x + 0.4) * R},${2.0 * R}`, 0.4 * R, skin, stroke, 1.4);
  }
  strokeShape(claw, `M${0.75 * R},${0.35 * R} L${1.3 * R},${1.0 * R} L${1.2 * R},${1.45 * R}`, 0.42 * R, skin, stroke, 1.4);
  el('path', { d: `M${-0.8 * R},0 L${0.8 * R},0 L${0.9 * R},${1.15 * R} L${-0.9 * R},${1.15 * R}Z`, fill: skin, stroke, 'stroke-width': 2 }, claw);
  shapes.claw = claw;

  const point = el('g', {}, g);
  strokeShape(point, `M${0.45 * R},${1.0 * R} L${0.5 * R},${2.7 * R}`, 0.42 * R, skin, stroke, 1.4);
  el('path', { d: `M${-0.8 * R},0 L${0.8 * R},0 Q${1.05 * R},${0.25 * R} ${1.0 * R},${1.15 * R} Q${0.9 * R},${1.7 * R} 0,${1.75 * R} Q${-1.0 * R},${1.7 * R} ${-1.0 * R},${1.1 * R} Q${-1.05 * R},${0.25 * R} ${-0.8 * R},0Z`, fill: skin, stroke, 'stroke-width': 2 }, point);
  shapes.point = point;

  return shapes;
}

/**
 * Spiky hair outline in the head-center frame. Each spike: a = base angle around the scalp
 * (0 = up, + = toward the face), w = half-width (deg), len = length in head radii, dir = tip
 * direction (deg). Forms share a spike count so hair morphs by interpolating parameters.
 */
export function hairPath(spikes, R, t = 0, sway = 0, closure = DEFAULT_HAIRLINE) {
  const pt = (a, r) => [Math.sin(a * DEG) * r, -Math.cos(a * DEG) * r];
  let d = '';
  spikes.forEach((s, i) => {
    const bl = pt(s.a - s.w, R * 0.97);
    const br = pt(s.a + s.w, R * 0.97);
    const wobble = sway ? Math.sin(t * 9 + i * 1.7) * sway * (6 + s.len * 4) : 0;
    const dir = (s.dir + wobble) * DEG;
    const base = pt(s.a, R * 0.9);
    const L = s.len * R;
    const tip = [base[0] + Math.sin(dir) * L, base[1] - Math.cos(dir) * L];
    const bend = (s.curve ?? 0.16) * L;
    const nx = -Math.cos(dir), ny = -Math.sin(dir);
    const c1 = [(bl[0] + tip[0]) / 2 + nx * bend, (bl[1] + tip[1]) / 2 + ny * bend];
    const c2 = [(br[0] + tip[0]) / 2 + nx * bend * 0.35, (br[1] + tip[1]) / 2 + ny * bend * 0.35];
    d += `${i === 0 ? 'M' : 'L'}${f(bl[0])},${f(bl[1])}Q${f(c1[0])},${f(c1[1])} ${f(tip[0])},${f(tip[1])}Q${f(c2[0])},${f(c2[1])} ${f(br[0])},${f(br[1])}`;
  });
  for (const [x, y] of closure) d += `L${f(x * R)},${f(y * R)}`;
  return d + 'Z';
}
export const DEFAULT_HAIRLINE = [[0.74, -0.14], [0.32, -0.24], [0.04, 0.1], [-0.36, 0.28], [-0.8, 0.62]];

export const lerpSpikes = (a, b, t) => a.map((s, i) => {
  const o = b[i] || s;
  return { a: s.a + (o.a - s.a) * t, w: s.w + (o.w - s.w) * t, len: s.len + (o.len - s.len) * t, dir: s.dir + (o.dir - s.dir) * t, curve: (s.curve ?? 0.16) + ((o.curve ?? 0.16) - (s.curve ?? 0.16)) * t };
});

/* ── default humanoid (gi-wearing martial artist) ─────────────────────────── */
export const humanoid = {
  torso(g, P, C) {
    const T = P.torso, w = P.torsoW;
    el('path', {
      d: `M${-17 * w},0 C${-23 * w},${-T * 0.35} ${-27 * w},${-T * 0.7} ${-22 * w},${-T + 14} Q${-18 * w},${-T - 3} ${-2 * w},${-T - 2} Q${18 * w},${-T} ${22 * w},${-T + 10} C${28 * w},${-T * 0.6} ${24 * w},${-T * 0.25} ${17 * w},0Z`,
      fill: C.gi, stroke: C.stroke, 'stroke-width': 2.4, 'stroke-linejoin': 'round',
    }, g);
    el('path', { d: `M${-3 * w},${-T - 1} L${15 * w},${-T + 3} L${6 * w},${-T + 26}Z`, fill: C.under, stroke: C.stroke, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, g);
    el('path', { d: `M${6 * w},${-T + 26} L${-2 * w},${-T * 0.32} M${-14 * w},${-T * 0.62} Q${-8 * w},${-T * 0.45} ${-12 * w},${-T * 0.25}`, fill: 'none', stroke: C.giShade, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, g);
  },
  neck(g, P, C) {
    el('rect', { x: -6.5, y: -P.torso - P.neck - 4, width: 13, height: P.neck + 8, rx: 4, fill: C.skin, stroke: C.stroke, 'stroke-width': 2 }, g);
  },
  belt(g, P, C) {
    const w = P.torsoW;
    el('path', { d: `M${-19 * w},-4 L${19 * w},-4 L${23 * w},14 L${-23 * w},14Z`, fill: C.gi, stroke: C.stroke, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g);
    el('rect', { x: -20 * w, y: -12, width: 40 * w, height: 11, rx: 3, fill: C.belt, stroke: C.stroke, 'stroke-width': 2 }, g);
    strokeShape(g, `M${15 * w},-4 Q${19 * w},10 ${14 * w},24`, 5, C.belt, C.stroke, 1.6);
    strokeShape(g, `M${15 * w},-4 Q${23 * w},8 ${22 * w},20`, 5, C.belt, C.stroke, 1.6);
  },
  upperArm(g, P, C, back) {
    const w = P.limbW;
    limb(g, P.upperArm, 17 * w, 14 * w, back ? C.skinShade : C.skin, C.stroke, 1);
    limb(g, 17, 22 * w, 20 * w, back ? C.underShade : C.under, C.stroke);
  },
  forearm(g, P, C, back) {
    const w = P.limbW;
    limb(g, P.forearm, 14 * w, 11.5 * w, back ? C.skinShade : C.skin, C.stroke, 1);
    el('rect', { x: -7.5 * w, y: P.forearm - 18, width: 15 * w, height: 16, rx: 3, fill: back ? C.underShade : C.wrist, stroke: C.stroke, 'stroke-width': 2 }, g);
  },
  hand(g, P, C, back) { return buildHands(g, P.handR, back ? C.skinShade : C.skin, C.stroke); },
  thigh(g, P, C, back) { limb(g, P.thigh, 31 * P.limbW, 25 * P.limbW, back ? C.pantsShade : C.pants, C.stroke, 3); },
  shin(g, P, C, back) { limb(g, P.shin, 26 * P.limbW, 20 * P.limbW, back ? C.pantsShade : C.pants, C.stroke, 4); },
  foot(g, P, C, back) {
    el('path', { d: 'M-11,-24 L11,-24 L12,4 Q30,4 32,10 L32,15 L-12,15Z', fill: back ? C.bootShade : C.boot, stroke: C.stroke, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g);
    el('path', { d: 'M1,-24 L1,3', stroke: C.bootTrim, 'stroke-width': 3 }, g);
  },
};
