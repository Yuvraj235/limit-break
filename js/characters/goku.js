import { el } from './parts.js';
import { HUMAN_POSES } from './poses.js';

const sp = (a, len, w, dir, curve) => ({ a, len, w, dir, curve });

/* Hair forms. Same spike count everywhere so every transformation is a true shape morph. */
const BASE = [
  sp(-122, 0.78, 13, -150), sp(-97, 1.05, 15, -116), sp(-70, 1.18, 15, -80), sp(-42, 1.28, 15, -46),
  sp(-14, 1.15, 14, -14), sp(14, 1.0, 14, 22), sp(37, 0.82, 12, 56), sp(54, 0.56, 10, 108, 0.1),
  sp(65, 0.46, 9, 150, 0.08), sp(75, 0.38, 8, 172, 0.06), sp(85, 0.3, 7, 182, 0.05),
];
const SSJ = [
  sp(-122, 0.62, 13, -128), sp(-97, 1.05, 15, -86), sp(-70, 1.42, 15, -50), sp(-42, 1.65, 15, -24),
  sp(-14, 1.72, 14, -4), sp(14, 1.55, 14, 16), sp(37, 1.2, 12, 38), sp(54, 0.82, 10, 70),
  sp(65, 0.62, 9, 150, 0.12), sp(75, 0.3, 8, 165), sp(85, 0.24, 7, 180),
];
const SSJ2 = [
  sp(-122, 0.7, 12, -130), sp(-97, 1.15, 13, -88), sp(-70, 1.58, 13, -52), sp(-42, 1.82, 12, -26),
  sp(-14, 1.9, 12, -6), sp(14, 1.7, 12, 15), sp(37, 1.32, 11, 36), sp(54, 0.9, 9, 66),
  sp(65, 0.95, 7, 168, 0.22), sp(75, 0.3, 7, 165), sp(85, 0.24, 6, 180),
];
const SSJ3 = [
  sp(-122, 4.3, 22, -177, 0.04), sp(-97, 4.0, 24, -165, 0.05), sp(-70, 3.3, 22, -148, 0.07), sp(-42, 2.5, 18, -124, 0.09),
  sp(-14, 1.6, 14, -66), sp(14, 1.25, 14, -12), sp(37, 0.92, 12, 34), sp(54, 0.6, 10, 96),
  sp(65, 0.66, 9, 160, 0.12), sp(75, 0.5, 8, 176), sp(85, 0.44, 7, 186),
];
const KAIOKEN = BASE.map((s, i) => ({ ...s, len: s.len * 1.06, dir: s.dir + (i < 6 ? 4 : 0) }));
const SSJ4 = BASE.map((s, i) => ({ ...s, len: s.len * (i < 7 ? 1.45 : 1.6), dir: s.dir - (i < 7 ? 18 : -10), w: s.w + 2 })); // wild, long, black
const GOD = BASE.map((s, i) => ({ ...s, len: s.len * (i < 7 ? 0.92 : 1), w: s.w - 1, dir: s.dir + (i < 6 ? 6 : 0) })); // slimmer, swept
const BLUE = SSJ.map((s, i) => ({ ...s, len: s.len * (i < 7 ? 0.94 : 1), dir: s.dir - (i < 7 ? 6 : 0) }));
const UI_SIGN = BASE.map((s, i) => ({ ...s, len: s.len * 1.08, dir: s.dir + (i < 6 ? 8 : 0) }));
const MUI = SSJ.map((s, i) => ({ ...s, len: s.len * (i < 7 ? 0.96 : 1), dir: s.dir - (i < 7 ? 10 : 0) }));

export function saiyanHead(g, P, C, rig) {
  const R = P.headR;
  const defs = el('defs', {}, g);
  const grad = el('linearGradient', { id: `${rig.id}-hair`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  const s0 = el('stop', { offset: '0%', 'stop-color': '#2b2b3b' }, grad);
  const s1 = el('stop', { offset: '100%', 'stop-color': '#0e0e16' }, grad);

  el('path', {
    d: `M0,${-R} C${0.62 * R},${-R} ${1.0 * R},${-0.6 * R} ${0.98 * R},${-0.05 * R} C${1.02 * R},${0.2 * R} ${1.12 * R},${0.3 * R} ${1.02 * R},${0.38 * R}`
      + ` C${0.95 * R},${0.5 * R} ${0.85 * R},${0.85 * R} ${0.45 * R},${0.98 * R} C${0.15 * R},${1.05 * R} ${-0.35 * R},${0.9 * R} ${-0.6 * R},${0.62 * R}`
      + ` C${-0.95 * R},${0.3 * R} ${-1.0 * R},${-0.3 * R} ${-0.8 * R},${-0.65 * R} C${-0.6 * R},${-0.95 * R} ${-0.3 * R},${-R} 0,${-R}Z`,
    fill: C.skin, stroke: C.stroke, 'stroke-width': 2.4,
  }, g);
  const hair = el('path', { fill: `url(#${rig.id}-hair)`, stroke: '#000', 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, g);
  el('path', { d: `M${-0.02 * R},${0.02 * R} C${-0.32 * R},${-0.08 * R} ${-0.4 * R},${0.36 * R} ${-0.1 * R},${0.42 * R}`, fill: C.skin, stroke: C.stroke, 'stroke-width': 2 }, g);

  const pupils = [];
  el('path', { d: `M${0.36 * R},${0.08 * R} Q${0.55 * R},${-0.08 * R} ${0.75 * R},${0.05 * R} Q${0.57 * R},${0.21 * R} ${0.36 * R},${0.08 * R}Z`, fill: '#fff', stroke: C.stroke, 'stroke-width': 1.6 }, g);
  pupils.push(el('ellipse', { cx: 0.63 * R, cy: 0.08 * R, rx: 0.075 * R, ry: 0.095 * R, fill: '#1b1b1b' }, g));
  el('path', { d: `M${0.84 * R},${0.06 * R} Q${0.9 * R},${-0.03 * R} ${0.97 * R},${0.05 * R} Q${0.9 * R},${0.12 * R} ${0.84 * R},${0.06 * R}Z`, fill: '#fff', stroke: C.stroke, 'stroke-width': 1.4 }, g);
  pupils.push(el('ellipse', { cx: 0.93 * R, cy: 0.06 * R, rx: 0.035 * R, ry: 0.05 * R, fill: '#1b1b1b' }, g));

  const brows = el('g', {}, g);
  el('path', { d: `M${0.3 * R},${-0.15 * R} L${0.74 * R},${-0.05 * R}`, stroke: '#111', 'stroke-width': 0.085 * R, 'stroke-linecap': 'round' }, brows);
  el('path', { d: `M${0.83 * R},${-0.07 * R} L${0.98 * R},${-0.13 * R}`, stroke: '#111', 'stroke-width': 0.07 * R, 'stroke-linecap': 'round' }, brows);
  el('path', { d: `M${1.0 * R},${0.27 * R} L${0.93 * R},${0.34 * R}`, stroke: C.stroke, 'stroke-width': 1.5, 'stroke-linecap': 'round' }, g);

  const mouths = {};
  const m = (name, d, extra = {}) => { mouths[name] = el('path', { d, fill: 'none', stroke: C.stroke, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra }, g); };
  m('calm', `M${0.54 * R},${0.62 * R} Q${0.64 * R},${0.66 * R} ${0.76 * R},${0.6 * R}`);
  m('focus', `M${0.56 * R},${0.64 * R} L${0.76 * R},${0.62 * R}`);
  m('smirk', `M${0.54 * R},${0.64 * R} Q${0.68 * R},${0.66 * R} ${0.8 * R},${0.55 * R}`);
  m('hurt', `M${0.54 * R},${0.67 * R} Q${0.65 * R},${0.58 * R} ${0.78 * R},${0.66 * R}`);
  m('strain', `M${0.52 * R},${0.58 * R} L${0.82 * R},${0.56 * R} L${0.82 * R},${0.68 * R} L${0.52 * R},${0.7 * R}Z M${0.52 * R},${0.64 * R} L${0.82 * R},${0.62 * R}`, { fill: '#fff' });
  m('shout', `M${0.5 * R},${0.54 * R} Q${0.68 * R},${0.48 * R} ${0.86 * R},${0.55 * R} Q${0.8 * R},${0.9 * R} ${0.62 * R},${0.86 * R} Q${0.5 * R},${0.76 * R} ${0.5 * R},${0.54 * R}Z`, { fill: '#5a0f14' });

  return { hair, hairStops: [s0, s1], pupils, brows, browPivot: [0.55 * R, -0.1 * R], mouths };
}

export const goku = {
  id: 'goku',
  name: 'Goku',
  title: 'Saiyan of Earth',
  ki: { core: [210, 245, 255], glow: [60, 160, 255] },
  scale: 0.82,
  proportions: {
    thigh: 64, shin: 62, footH: 15, torso: 84, neck: 12, headR: 30, upperArm: 52, forearm: 48, handR: 9,
    shoulderF: { x: 9, y: 12 }, shoulderB: { x: -9, y: 14 }, hipF: 6, hipB: -8, torsoW: 1.1, limbW: 1.16,
  },
  palette: {
    skin: '#f6c79a', skinShade: '#d9a27a', stroke: '#24130d',
    gi: '#ff8a1f', giShade: '#cc5d08', under: '#2347c4', underShade: '#18308a', wrist: '#2347c4',
    belt: '#2347c4', pants: '#ff8a1f', pantsShade: '#d8670f', boot: '#22307a', bootShade: '#172259', bootTrim: '#d8312b',
  },
  parts: { head: saiyanHead },
  hairline: undefined,
  defaultForm: 'base',
  ladder: ['base', 'kaioken', 'ssj', 'ssj2', 'ssj3', 'ssj4', 'ssj_god', 'ssj_blue', 'blue_kaioken'],
  godForms: ['ui_sign', 'ui'],
  moves: {
    beam: { name: 'Kamehameha', colors: { core: [210, 245, 255], glow: [60, 160, 255] } },
    bomb: { name: 'Spirit Bomb', colors: { core: [220, 242, 255], glow: [90, 175, 255] } },
    blast: { core: [210, 245, 255], glow: [60, 160, 255] },
  },
  forms: {
    base:    { hair: BASE,    hairTop: '#2b2b3b', hairBottom: '#0e0e16', hairStroke: '#000000', eye: '#1b1b1b', aura: { inner: [255, 255, 255], outer: [130, 190, 255] } },
    kaioken: { hair: KAIOKEN, hairTop: '#3a1d24', hairBottom: '#120709', hairStroke: '#000000', eye: '#1b1b1b', aura: { inner: [255, 220, 220], outer: [255, 40, 40] } },
    ssj:     { hair: SSJ,     hairTop: '#fff6a8', hairBottom: '#f2b81c', hairStroke: '#a86a00', eye: '#1fa78f', aura: { inner: [255, 250, 210], outer: [255, 196, 40] } },
    ssj4:    { hair: SSJ4,    hairTop: '#3a1a1a', hairBottom: '#0a0404', hairStroke: '#000000', eye: '#f2b81c', aura: { inner: [255, 215, 190], outer: [225, 35, 35] }, lightning: true },
    blue_kaioken: { hair: BLUE, hairTop: '#c8fbff', hairBottom: '#1f9be6', hairStroke: '#0b5a96', eye: '#2a8fd8', aura: { inner: [255, 200, 210], outer: [255, 30, 60] }, lightning: true },
    ssj_god: { hair: GOD,     hairTop: '#ff7a7a', hairBottom: '#b3122a', hairStroke: '#5a0010', eye: '#c2182b', aura: { inner: [255, 225, 200], outer: [255, 80, 50] } },
    ssj_blue: { hair: BLUE,   hairTop: '#c8fbff', hairBottom: '#1f9be6', hairStroke: '#0b5a96', eye: '#2a8fd8', aura: { inner: [225, 250, 255], outer: [40, 170, 255] } },
    ssj2:    { hair: SSJ2,    hairTop: '#fffbc4', hairBottom: '#f6c21e', hairStroke: '#a06200', eye: '#1fa78f', aura: { inner: [255, 252, 220], outer: [255, 205, 50] }, lightning: true },
    ssj3:    { hair: SSJ3,    hairTop: '#fff3a0', hairBottom: '#e9a90f', hairStroke: '#9a5d00', eye: '#2aa58e', brows: false, aura: { inner: [255, 248, 200], outer: [255, 180, 30] }, lightning: true },
    ui_sign: { hair: UI_SIGN, hairTop: '#2d2f45', hairBottom: '#0e0f1c', hairStroke: '#000000', eye: '#c9d4ff', aura: { inner: [235, 240, 255], outer: [80, 110, 255] }, ui: true },
    ui:      { hair: MUI,     hairTop: '#ffffff', hairBottom: '#aab4d0', hairStroke: '#6f7a96', eye: '#dfe6ff', aura: { inner: [255, 255, 255], outer: [170, 190, 255] }, ui: true },
  },
  exprBrow: { calm: 0, focus: 8, shout: 12, strain: 14, hurt: -10, smirk: 3 },
  poses: HUMAN_POSES,
  portrait: { form: 'base' },
};

/** Training partner: a living echo of Goku's ki (same rig, ki-dark palette). */
export const shadow = {
  ...goku,
  id: 'shadow',
  name: 'Ki Shadow',
  palette: {
    skin: '#3a2f63', skinShade: '#2a2149', stroke: '#0b0716',
    gi: '#4d3c86', giShade: '#352a62', under: '#2a2149', underShade: '#1d1735', wrist: '#6d5bd0',
    belt: '#6d5bd0', pants: '#4d3c86', pantsShade: '#352a62', boot: '#1d1735', bootShade: '#150f28', bootTrim: '#8f7dff',
  },
  forms: {
    base: { hair: goku.forms.base.hair, hairTop: '#5b4aa8', hairBottom: '#241a4a', hairStroke: '#0b0716', eye: '#8ff3ff', aura: { inner: [220, 210, 255], outer: [120, 90, 255] } },
    ssj: { hair: goku.forms.ssj.hair, hairTop: '#c9bfff', hairBottom: '#6d5bd0', hairStroke: '#2a2149', eye: '#8ff3ff', aura: { inner: [230, 220, 255], outer: [140, 110, 255] } },
  },
  ki: { core: [230, 220, 255], glow: [130, 100, 255] },
  aura: { inner: [220, 210, 255], outer: [120, 90, 255] },
};
