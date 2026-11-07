import { el, limb, buildHands } from './parts.js';
import { HUMAN_POSES } from './poses.js';
import { saiyanHead } from './goku.js';

const sp = (a, len, w, dir, curve) => ({ a, len, w, dir, curve });

/* Upswept flame hair. Same spike count in every form so transformations morph. */
const BASE = [
  sp(-115, 0.9, 13, -70), sp(-95, 1.3, 14, -46), sp(-72, 1.68, 14, -28), sp(-48, 1.98, 14, -14),
  sp(-24, 2.12, 13, -4), sp(0, 2.02, 13, 6), sp(22, 1.72, 12, 14), sp(42, 1.28, 11, 22),
  sp(58, 0.72, 9, 40), sp(72, 0.36, 8, 92), sp(84, 0.26, 7, 150),
];
const ASCENDED = BASE.map((s, i) => ({ ...s, len: s.len * (i < 8 ? 1.06 : 1), w: s.w + 1 }));
const SSJ = BASE.map((s, i) => ({ ...s, len: s.len * (i < 8 ? 1.16 : 1), dir: s.dir * 0.7 }));
const SSJ2 = BASE.map((s, i) => ({ ...s, len: s.len * (i < 8 ? 1.22 : 1), dir: s.dir * 0.62, w: s.w + 1 }));
const SSJ4 = BASE.map((s, i) => ({ ...s, len: s.len * (i < 8 ? 1.05 : 1.2), dir: s.dir * 0.9, w: s.w + 1 }));
const GOD = BASE.map((s, i) => ({ ...s, len: s.len * (i < 8 ? 0.98 : 1), w: s.w - 1 }));
const EVOLVED = BASE.map((s, i) => ({ ...s, len: s.len * (i < 8 ? 1.2 : 1), dir: s.dir * 0.65, w: s.w + 1 }));
const BLUE = BASE.map((s, i) => ({ ...s, len: s.len * (i < 8 ? 1.12 : 1), dir: s.dir * 0.75 }));
const EGO = BASE.map((s, i) => ({ ...s, len: s.len * (i < 8 ? 1.2 : 1), dir: s.dir * 0.6, w: s.w + 1 }));

// Widow's peak: the hairline dips to a point over the brow.
const HAIRLINE = [[0.86, -0.44], [0.6, -0.34], [0.4, -0.04], [0.2, -0.36], [-0.12, -0.12], [-0.5, 0.2], [-0.86, 0.52]];

/** Hair shapes and hairline, shared with Vegito (fusion.js). */
export const VEGETA_HAIR = { BASE, SSJ, BLUE, EGO, HAIRLINE };

const C = {
  skin: '#f6c79a', skinShade: '#d9a27a', stroke: '#1c1220',
  suit: '#2b3a9e', suitShade: '#1d2873', armor: '#f4f5f8', armorShade: '#cfd3de', pad: '#e8b829', padShade: '#b98c12',
  glove: '#f6f6f8', gloveShade: '#d6d6de',
};

export const parts = {
  head: saiyanHead,
  torso(g, P, Cp) {
    const T = P.torso, w = P.torsoW;
    el('path', {
      d: `M${-17 * w},0 C${-23 * w},${-T * 0.35} ${-27 * w},${-T * 0.7} ${-22 * w},${-T + 14} Q${-18 * w},${-T - 3} ${-2 * w},${-T - 2} Q${18 * w},${-T} ${22 * w},${-T + 10} C${28 * w},${-T * 0.6} ${24 * w},${-T * 0.25} ${17 * w},0Z`,
      fill: C.suit, stroke: Cp.stroke, 'stroke-width': 2.4, 'stroke-linejoin': 'round',
    }, g);
    // Saiyan chest armor with gold shoulder straps
    el('path', {
      d: `M${-19 * w},${-T * 0.3} C${-24 * w},${-T * 0.56} ${-23 * w},${-T * 0.86} ${-15 * w},${-T + 6} Q0,${-T - 4} ${17 * w},${-T + 6} C${26 * w},${-T * 0.82} ${26 * w},${-T * 0.5} ${20 * w},${-T * 0.3} Q0,${-T * 0.18} ${-19 * w},${-T * 0.3}Z`,
      fill: C.armor, stroke: Cp.stroke, 'stroke-width': 2.4, 'stroke-linejoin': 'round',
    }, g);
    el('path', { d: `M${-14 * w},${-T * 0.42} Q0,${-T * 0.34} ${16 * w},${-T * 0.42}`, fill: 'none', stroke: C.armorShade, 'stroke-width': 2.4 }, g);
    el('path', { d: `M${-17 * w},${-T + 6} Q${-26 * w},${-T + 2} ${-27 * w},${-T + 18} L${-18 * w},${-T + 24}Z`, fill: C.pad, stroke: Cp.stroke, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
    el('path', { d: `M${15 * w},${-T + 6} Q${27 * w},${-T + 2} ${28 * w},${-T + 18} L${19 * w},${-T + 24}Z`, fill: C.pad, stroke: Cp.stroke, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
  },
  belt(g, P, Cp) {
    const w = P.torsoW;
    el('path', { d: `M${-19 * w},-6 L${19 * w},-6 L${22 * w},12 L${-22 * w},12Z`, fill: C.suit, stroke: Cp.stroke, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g);
  },
  forearm(g, P, Cp, back) {
    const w = P.limbW;
    limb(g, P.forearm, 14 * w, 11.5 * w, back ? Cp.skinShade : Cp.skin, Cp.stroke, 1);
    el('path', { d: `M${-9 * w},${P.forearm * 0.42} L${9 * w},${P.forearm * 0.42} L${8 * w},${P.forearm} L${-8 * w},${P.forearm}Z`, fill: back ? C.gloveShade : C.glove, stroke: Cp.stroke, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
  },
  hand(g, P, Cp, back) { return buildHands(g, P.handR, back ? C.gloveShade : C.glove, Cp.stroke); },
  foot(g, P, Cp, back) {
    el('path', { d: 'M-12,-30 L12,-30 L12,4 Q30,4 32,10 L32,15 L-12,15Z', fill: back ? C.gloveShade : C.glove, stroke: Cp.stroke, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g);
    el('path', { d: 'M14,3 Q30,3 32,10 L32,15 L14,15Z', fill: back ? C.padShade : C.pad, stroke: Cp.stroke, 'stroke-width': 1.8 }, g);
  },
};

const GALICK = { core: [255, 228, 255], glow: [176, 64, 255] };
const FINAL_FLASH = { core: [255, 255, 226], glow: [255, 214, 40] };
const SUPERNOVA = { core: [255, 250, 236], glow: [255, 150, 50] };

export const vegeta = {
  id: 'vegeta',
  name: 'Vegeta',
  title: 'Prince of Saiyans',
  scale: 0.79,
  proportions: {
    thigh: 62, shin: 60, footH: 15, torso: 82, neck: 11, headR: 29, upperArm: 50, forearm: 47, handR: 9,
    shoulderF: { x: 9, y: 12 }, shoulderB: { x: -9, y: 14 }, hipF: 6, hipB: -8, torsoW: 1.1, limbW: 1.14,
  },
  palette: {
    skin: C.skin, skinShade: C.skinShade, stroke: C.stroke,
    gi: C.suit, giShade: C.suitShade, under: C.suit, underShade: C.suitShade, wrist: C.glove,
    belt: C.suit, pants: C.suit, pantsShade: C.suitShade, boot: C.glove, bootShade: C.gloveShade, bootTrim: C.pad,
  },
  parts,
  hairline: HAIRLINE,
  defaultForm: 'base',
  ladder: ['base', 'ascended', 'ssj', 'ssj2', 'ssj4', 'ssj_god', 'ssj_blue', 'blue_evolved'],
  godForms: ['ultra_ego'],
  moves: {
    beam: { name: 'Galick Gun', colors: GALICK, full: { at: 0.75, name: 'Final Flash', colors: FINAL_FLASH } },
    bomb: { name: 'Big Bang Supernova', colors: SUPERNOVA },
    blast: { core: [255, 246, 220], glow: [255, 190, 70] },
  },
  ki: GALICK,
  forms: {
    base:      { hair: BASE,     hairTop: '#2a2a3a', hairBottom: '#0d0d15', hairStroke: '#000000', eye: '#1b1b1b', aura: { inner: [255, 255, 255], outer: [150, 170, 255] } },
    ascended:  { hair: ASCENDED, hairTop: '#2e2c40', hairBottom: '#0d0d15', hairStroke: '#000000', eye: '#1b1b1b', aura: { inner: [250, 250, 255], outer: [200, 210, 255] }, lightning: true },
    ssj:       { hair: SSJ,      hairTop: '#fff6a8', hairBottom: '#f2b81c', hairStroke: '#a86a00', eye: '#1fa78f', aura: { inner: [255, 250, 210], outer: [255, 196, 40] } },
    ssj2:      { hair: SSJ2,     hairTop: '#fffbc4', hairBottom: '#f6c21e', hairStroke: '#a06200', eye: '#1fa78f', aura: { inner: [255, 252, 220], outer: [255, 205, 50] }, lightning: true },
    ssj4:      { hair: SSJ4,     hairTop: '#3a1a22', hairBottom: '#0a0406', hairStroke: '#000000', eye: '#f2b81c', aura: { inner: [255, 215, 190], outer: [225, 35, 35] }, lightning: true },
    ssj_god:   { hair: GOD,      hairTop: '#ff7a7a', hairBottom: '#b3122a', hairStroke: '#5a0010', eye: '#c2182b', aura: { inner: [255, 225, 200], outer: [255, 80, 50] } },
    blue_evolved: { hair: EVOLVED, hairTop: '#6fb2ff', hairBottom: '#0b2f8a', hairStroke: '#06194d', eye: '#1a4fd0', aura: { inner: [210, 230, 255], outer: [30, 90, 255] }, lightning: true },
    ssj_blue:  { hair: BLUE,     hairTop: '#c8fbff', hairBottom: '#1f9be6', hairStroke: '#0b5a96', eye: '#2a8fd8', aura: { inner: [225, 250, 255], outer: [40, 170, 255] } },
    ultra_ego: { hair: EGO,      hairTop: '#d38bff', hairBottom: '#5d1aa0', hairStroke: '#2c0a52', eye: '#e34cff', aura: { inner: [255, 220, 255], outer: [170, 60, 255] }, lightning: true },
  },
  exprBrow: { calm: 10, focus: 14, shout: 16, strain: 16, hurt: -4, smirk: 10 },
  poses: HUMAN_POSES,
  portrait: { form: 'base' },
};
