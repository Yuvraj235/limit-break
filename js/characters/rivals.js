// Original tournament rivals. Each reuses the humanoid rig with its own silhouette and palette.
import { el, limb, strokeShape, buildHands, hairPath } from './parts.js';
import { HUMAN_POSES } from './poses.js';

const mouthSet = (g, R, stroke) => {
  const mouths = {};
  const m = (name, d, extra = {}) => { mouths[name] = el('path', { d, fill: 'none', stroke, 'stroke-width': 1.8, 'stroke-linecap': 'round', ...extra }, g); };
  m('calm', `M${0.52 * R},${0.64 * R} L${0.78 * R},${0.62 * R}`);
  m('smirk', `M${0.5 * R},${0.66 * R} Q${0.66 * R},${0.68 * R} ${0.8 * R},${0.56 * R}`);
  m('hurt', `M${0.52 * R},${0.7 * R} Q${0.65 * R},${0.6 * R} ${0.78 * R},${0.7 * R}`);
  m('strain', `M${0.5 * R},${0.6 * R} L${0.82 * R},${0.58 * R} L${0.82 * R},${0.7 * R} L${0.5 * R},${0.72 * R}Z`, { fill: '#fff' });
  m('shout', `M${0.48 * R},${0.55 * R} Q${0.68 * R},${0.5 * R} ${0.86 * R},${0.56 * R} Q${0.8 * R},${0.9 * R} ${0.62 * R},${0.86 * R} Q${0.5 * R},${0.76 * R} ${0.48 * R},${0.55 * R}Z`, { fill: '#3a0d14' });
  mouths.focus = mouths.calm;
  return mouths;
};

const faceShape = (R) => `M0,${-R} C${0.62 * R},${-R} ${1.0 * R},${-0.6 * R} ${0.98 * R},${-0.05 * R} C${1.02 * R},${0.25 * R} ${1.0 * R},${0.6 * R} ${0.7 * R},${0.95 * R}`
  + ` C${0.4 * R},${1.08 * R} ${-0.35 * R},${0.95 * R} ${-0.6 * R},${0.62 * R} C${-0.95 * R},${0.3 * R} ${-1.0 * R},${-0.3 * R} ${-0.8 * R},${-0.65 * R} C${-0.6 * R},${-0.95 * R} ${-0.3 * R},${-R} 0,${-R}Z`;

/* ── Garrok, the armored brawler ─────────────────────────────────────────── */
const GC = { skin: '#7f8f6b', skinShade: '#63714f', stroke: '#14140f', armor: '#4b5566', armorLight: '#8592a8', armorShade: '#353c49', cloth: '#7a2a2a', clothShade: '#561c1c', eye: '#ff3b2f' };

const garrokParts = {
  head(g, P) {
    const R = P.headR;
    el('path', { d: faceShape(R), fill: GC.skin, stroke: GC.stroke, 'stroke-width': 2.4 }, g);
    // horned helm
    strokeShape(g, `M${-0.3 * R},${-0.7 * R} Q${0.4 * R},${-1.9 * R} ${1.3 * R},${-1.6 * R}`, 0.24 * R, '#d9cfb8', GC.stroke, 2);
    el('path', { d: `M${-0.95 * R},${0.2 * R} C${-1.05 * R},${-0.8 * R} ${-0.3 * R},${-1.2 * R} ${0.4 * R},${-1.1 * R} C${0.9 * R},${-1.0 * R} ${1.1 * R},${-0.5 * R} ${1.05 * R},${-0.1 * R} L${0.2 * R},${-0.12 * R} L${-0.2 * R},${0.5 * R} L${-0.8 * R},${0.6 * R}Z`, fill: GC.armor, stroke: GC.stroke, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, g);
    el('path', { d: `M${-0.6 * R},${-0.7 * R} Q${0.2 * R},${-1.05 * R} ${0.8 * R},${-0.6 * R}`, fill: 'none', stroke: GC.armorLight, 'stroke-width': 2.4 }, g);
    const pupils = [el('path', { d: `M${0.3 * R},${-0.02 * R} L${0.95 * R},${-0.06 * R} L${0.92 * R},${0.06 * R} L${0.32 * R},${0.08 * R}Z`, fill: GC.eye }, g)];
    const brows = el('g', {}, g);
    el('path', { d: `M${0.2 * R},${0.2 * R} L${0.95 * R},${0.25 * R}`, stroke: GC.skinShade, 'stroke-width': 2 }, g);
    return { pupils, brows, browPivot: [0.6 * R, 0], mouths: mouthSet(g, R, GC.stroke) };
  },
  torso(g, P) {
    const T = P.torso, w = P.torsoW;
    el('path', { d: `M${-17 * w},0 C${-24 * w},${-T * 0.4} ${-26 * w},${-T * 0.75} ${-20 * w},${-T + 8} Q0,${-T - 8} ${22 * w},${-T + 8} C${28 * w},${-T * 0.6} ${24 * w},${-T * 0.25} ${17 * w},0Z`, fill: GC.cloth, stroke: GC.stroke, 'stroke-width': 2.4 }, g);
    el('path', { d: `M${-15 * w},${-T * 0.18} L${-18 * w},${-T * 0.8} Q0,${-T - 2} ${20 * w},${-T * 0.8} L${18 * w},${-T * 0.18} Q0,${-T * 0.05} ${-15 * w},${-T * 0.18}Z`, fill: GC.armor, stroke: GC.stroke, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, g);
    el('path', { d: `M${-10 * w},${-T * 0.5} L${12 * w},${-T * 0.5} M${-11 * w},${-T * 0.32} L${13 * w},${-T * 0.32} M${0},${-T * 0.85} L0,${-T * 0.2}`, stroke: GC.armorShade, 'stroke-width': 2.4 }, g);
    el('path', { d: `M${-12 * w},${-T * 0.78} Q${0},${-T * 0.92} ${14 * w},${-T * 0.78}`, fill: 'none', stroke: GC.armorLight, 'stroke-width': 2.4 }, g);
  },
  neck(g, P) { el('rect', { x: -10, y: -P.torso - P.neck - 4, width: 20, height: P.neck + 8, rx: 4, fill: GC.skin, stroke: GC.stroke, 'stroke-width': 2 }, g); },
  belt(g, P) {
    const w = P.torsoW;
    el('rect', { x: -21 * w, y: -14, width: 42 * w, height: 16, rx: 3, fill: GC.armorShade, stroke: GC.stroke, 'stroke-width': 2 }, g);
    el('rect', { x: -7, y: -15, width: 14, height: 18, rx: 2, fill: '#c9a94a', stroke: GC.stroke, 'stroke-width': 2 }, g);
  },
  upperArm(g, P, _C, back) {
    limb(g, P.upperArm, 22 * P.limbW, 17 * P.limbW, back ? GC.skinShade : GC.skin, GC.stroke, 2);
    el('path', { d: 'M-22,-6 Q0,-24 22,-6 L18,18 Q0,10 -18,18Z', fill: back ? GC.armorShade : GC.armor, stroke: GC.stroke, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g);
    el('path', { d: 'M-14,-4 Q0,-14 14,-4', fill: 'none', stroke: GC.armorLight, 'stroke-width': 2 }, g);
  },
  forearm(g, P, _C, back) {
    limb(g, P.forearm, 19 * P.limbW, 16 * P.limbW, back ? GC.skinShade : GC.skin, GC.stroke, 2);
    el('rect', { x: -13, y: P.forearm - 30, width: 26, height: 28, rx: 4, fill: back ? GC.armorShade : GC.armor, stroke: GC.stroke, 'stroke-width': 2 }, g);
  },
  hand(g, P, _C, back) { return buildHands(g, P.handR, back ? GC.skinShade : GC.skin, GC.stroke); },
  thigh(g, P, _C, back) { limb(g, P.thigh, 36 * P.limbW, 29 * P.limbW, back ? GC.clothShade : GC.cloth, GC.stroke, 3); },
  shin(g, P, _C, back) {
    limb(g, P.shin, 30 * P.limbW, 24 * P.limbW, back ? GC.clothShade : GC.cloth, GC.stroke, 3);
    el('rect', { x: -15, y: 6, width: 30, height: P.shin - 4, rx: 5, fill: back ? GC.armorShade : GC.armor, stroke: GC.stroke, 'stroke-width': 2 }, g);
  },
  foot(g, P, _C, back) {
    el('path', { d: 'M-14,-10 L14,-10 L15,4 Q34,4 36,12 L36,17 L-15,17Z', fill: back ? GC.armorShade : GC.armor, stroke: GC.stroke, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g);
  },
};

export const garrok = {
  id: 'garrok',
  name: 'Garrok',
  title: 'The Iron Bull of Universe 4',
  scale: 0.9,
  proportions: {
    thigh: 60, shin: 56, footH: 17, torso: 92, neck: 10, headR: 29, upperArm: 54, forearm: 50, handR: 11,
    shoulderF: { x: 12, y: 14 }, shoulderB: { x: -12, y: 16 }, hipF: 8, hipB: -10, torsoW: 1.4, limbW: 1.3,
  },
  palette: GC,
  parts: garrokParts,
  aura: { inner: [255, 220, 200], outer: [230, 70, 40] },
  ki: { core: [255, 236, 210], glow: [255, 90, 40] },
  exprBrow: {},
  poses: { ...HUMAN_POSES, idle: { ...HUMAN_POSES.idle, lean: 14, head: 6, aF: 40, eF: 70, aB: 30, eB: 80, hF: 30, kF: -40, hB: -26, kB: -30, bob: 1.4 } },
};

/* ── Vessa, the wind-blade speedster ─────────────────────────────────────── */
const VC = { skin: '#d9a988', skinShade: '#b9876a', stroke: '#14202a', suit: '#eef3f6', suitShade: '#c2ced8', accent: '#1fc2b0', accentShade: '#138a7e', hair: '#3a2a66', hairDark: '#1e1540', visor: '#6ff5e4' };
const PONYTAIL = [
  { a: -110, len: 2.4, w: 14, dir: -122, curve: 0.18 }, { a: -80, len: 1.3, w: 16, dir: -96 }, { a: -45, len: 0.6, w: 18, dir: -50 },
  { a: -10, len: 0.35, w: 18, dir: -5 }, { a: 25, len: 0.35, w: 16, dir: 40 }, { a: 55, len: 0.5, w: 12, dir: 130, curve: 0.1 }, { a: 72, len: 0.62, w: 10, dir: 168, curve: 0.08 },
];

const vessaParts = {
  head(g, P, _C, rig) {
    const R = P.headR;
    el('path', { d: faceShape(R), fill: VC.skin, stroke: VC.stroke, 'stroke-width': 2.2 }, g);
    const hair = el('path', { fill: VC.hair, stroke: VC.hairDark, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g);
    rig._vessaHair = hair;
    el('path', { d: `M${0.25 * R},${-0.12 * R} L${1.04 * R},${-0.1 * R} L${1.0 * R},${0.18 * R} L${0.28 * R},${0.16 * R}Z`, fill: VC.visor, stroke: VC.stroke, 'stroke-width': 1.8, opacity: 0.95 }, g);
    const pupils = [el('path', { d: `M${0.5 * R},${0.03 * R} L${0.9 * R},${0.03 * R}`, stroke: '#ffffff', 'stroke-width': 0.06 * R, 'stroke-linecap': 'round' }, g)];
    return { pupils: [], brows: null, mouths: mouthSet(g, R, VC.stroke), visorLine: pupils[0] };
  },
  torso(g, P) {
    const T = P.torso, w = P.torsoW;
    el('path', { d: `M${-15 * w},0 C${-20 * w},${-T * 0.35} ${-24 * w},${-T * 0.7} ${-19 * w},${-T + 12} Q${-15 * w},${-T - 3} ${-2 * w},${-T - 2} Q${16 * w},${-T} ${19 * w},${-T + 10} C${25 * w},${-T * 0.6} ${21 * w},${-T * 0.25} ${15 * w},0Z`, fill: VC.suit, stroke: VC.stroke, 'stroke-width': 2.2 }, g);
    el('path', { d: `M${-18 * w},${-T * 0.62} L${20 * w},${-T * 0.3} L${18 * w},${-T * 0.18} L${-17 * w},${-T * 0.5}Z`, fill: VC.accent, stroke: VC.stroke, 'stroke-width': 1.6 }, g);
  },
  neck(g, P) { el('rect', { x: -5.5, y: -P.torso - P.neck - 4, width: 11, height: P.neck + 8, rx: 4, fill: VC.skin, stroke: VC.stroke, 'stroke-width': 2 }, g); },
  belt(g, P) {
    const w = P.torsoW;
    el('rect', { x: -17 * w, y: -10, width: 34 * w, height: 9, rx: 3, fill: VC.accentShade, stroke: VC.stroke, 'stroke-width': 1.8 }, g);
  },
  upperArm(g, P, _C, back) { limb(g, P.upperArm, 14 * P.limbW, 12 * P.limbW, back ? VC.suitShade : VC.suit, VC.stroke, 1); },
  forearm(g, P, _C, back) {
    limb(g, P.forearm, 12 * P.limbW, 10 * P.limbW, back ? VC.suitShade : VC.suit, VC.stroke, 1);
    // wind blade fin
    el('path', { d: `M4,${P.forearm * 0.2} L16,${P.forearm * 0.55} L4,${P.forearm * 0.85}Z`, fill: back ? VC.accentShade : VC.accent, stroke: VC.stroke, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
  },
  hand(g, P, _C, back) { return buildHands(g, P.handR, back ? VC.skinShade : VC.skin, VC.stroke); },
  thigh(g, P, _C, back) { limb(g, P.thigh, 22 * P.limbW, 17 * P.limbW, back ? VC.suitShade : VC.suit, VC.stroke, 2); },
  shin(g, P, _C, back) {
    limb(g, P.shin, 18 * P.limbW, 13 * P.limbW, back ? VC.suitShade : VC.suit, VC.stroke, 2);
    el('path', { d: `M-8,${P.shin * 0.45} L8,${P.shin * 0.45} L7,${P.shin} L-7,${P.shin}Z`, fill: back ? VC.accentShade : VC.accent, stroke: VC.stroke, 'stroke-width': 1.6 }, g);
  },
  foot(g, P, _C, back) {
    el('path', { d: 'M-8,-8 L8,-8 L9,3 Q26,3 30,9 L30,12 L-9,12Z', fill: back ? VC.accentShade : VC.accent, stroke: VC.stroke, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
  },
  extras(g, P, _C, rig) {
    // trailing scarf from the neck
    const scarf = el('g', {}, g.torsoM);
    scarf.parentNode.insertBefore(scarf, scarf.parentNode.firstChild);
    const outline = el('path', { fill: 'none', stroke: VC.stroke, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, scarf);
    const cloth = el('path', { fill: 'none', stroke: VC.accent, 'stroke-width': 7.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, scarf);
    const T = P.torso;
    return {
      update(t, v) {
        const lag = Math.max(-1, Math.min(1, v.lean / 30));
        const w1 = Math.sin(t * 7) * 8, w2 = Math.sin(t * 7 + 1.4) * 12, w3 = Math.sin(t * 7 + 2.6) * 14;
        const d = `M-4,${-T + 4} C-30,${-T + 2 + w1} -55,${-T + 14 + w2 + lag * 10} -80,${-T + 8 + w3} S-120,${-T + 22 + w2} -138,${-T + 12 + w3}`;
        outline.setAttribute('d', d);
        cloth.setAttribute('d', d);
        rig._vessaHair?.setAttribute('d', hairPath(PONYTAIL, P.headR, t, 0.25));
      },
    };
  },
};

export const vessa = {
  id: 'vessa',
  name: 'Vessa',
  title: 'The Gale of Universe 9',
  scale: 0.8,
  proportions: {
    thigh: 66, shin: 64, footH: 12, torso: 78, neck: 13, headR: 26, upperArm: 52, forearm: 48, handR: 8,
    shoulderF: { x: 7, y: 12 }, shoulderB: { x: -7, y: 14 }, hipF: 5, hipB: -6, torsoW: 0.8, limbW: 0.8,
  },
  palette: VC,
  parts: vessaParts,
  aura: { inner: [220, 255, 250], outer: [30, 210, 190] },
  ki: { core: [235, 255, 252], glow: [40, 220, 200] },
  exprBrow: {},
  poses: { ...HUMAN_POSES, idle: { ...HUMAN_POSES.idle, lean: 10, aF: 70, eF: 40, wF: -40, handF: 'open', aB: -20, eB: 30, handB: 'open', lift: 18, bob: 3.4, kF: -50, hF: 40, kB: -40 } },
};

/* ── Thorn-Ka, the crystal colossus ──────────────────────────────────────── */
const TC = { skin: '#a8283e', skinShade: '#7e1b2d', stroke: '#2a0710', crystal: '#ff7b90', crystalDark: '#c43a55', core: '#ffd34d', pants: '#2b2233', pantsShade: '#1c1622', eye: '#ffe066' };

const shard = (g, x, y, h, w, back) => el('path', { d: `M${x - w},${y} L${x},${y - h} L${x + w},${y}Z`, fill: back ? TC.crystalDark : TC.crystal, stroke: TC.stroke, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);

const thornParts = {
  head(g, P) {
    const R = P.headR;
    for (const [x, h, w] of [[-0.6, 1.0, 0.22], [-0.25, 1.35, 0.24], [0.15, 1.2, 0.22], [0.5, 0.85, 0.18]]) shard(g, x * R, -0.75 * R, h * R, w * R, false);
    el('path', { d: faceShape(R), fill: TC.skin, stroke: TC.stroke, 'stroke-width': 2.6 }, g);
    el('path', { d: `M${0.25 * R},${0.48 * R} L${0.98 * R},${0.42 * R} L${0.75 * R},${0.95 * R} L${0.2 * R},${0.85 * R}Z`, fill: TC.skinShade, stroke: TC.stroke, 'stroke-width': 2 }, g);
    const pupils = [
      el('path', { d: `M${0.35 * R},${0.02 * R} L${0.8 * R},${-0.06 * R} L${0.76 * R},${0.1 * R} L${0.38 * R},${0.12 * R}Z`, fill: TC.eye }, g),
    ];
    const brows = el('g', {}, g);
    el('path', { d: `M${0.25 * R},${-0.16 * R} L${0.85 * R},${-0.2 * R}`, stroke: TC.stroke, 'stroke-width': 0.12 * R, 'stroke-linecap': 'round' }, brows);
    const mouths = {};
    for (const k of ['calm', 'focus', 'smirk', 'hurt', 'strain', 'shout']) mouths[k] = el('path', { d: `M${0.4 * R},${0.66 * R} L${0.8 * R},${0.64 * R}`, stroke: TC.core, 'stroke-width': k === 'shout' ? 4 : 1.5, 'stroke-linecap': 'round' }, g);
    return { pupils, brows, browPivot: [0.55 * R, -0.18 * R], mouths };
  },
  torso(g, P) {
    const T = P.torso, w = P.torsoW;
    el('path', { d: `M${-17 * w},0 C${-25 * w},${-T * 0.4} ${-28 * w},${-T * 0.78} ${-20 * w},${-T + 6} Q0,${-T - 10} ${22 * w},${-T + 6} C${30 * w},${-T * 0.62} ${25 * w},${-T * 0.25} ${17 * w},0Z`, fill: TC.skin, stroke: TC.stroke, 'stroke-width': 2.6 }, g);
    el('path', { d: `M${-6 * w},${-T * 0.75} L${14 * w},${-T * 0.52} M${-10 * w},${-T * 0.42} L${12 * w},${-T * 0.28}`, stroke: TC.skinShade, 'stroke-width': 3 }, g);
    el('circle', { cx: 6 * w, cy: -T * 0.6, r: 11, fill: TC.core, stroke: TC.stroke, 'stroke-width': 2.2 }, g);
    el('circle', { cx: 6 * w, cy: -T * 0.6, r: 5, fill: '#fff8d6' }, g);
  },
  neck(g, P) { el('rect', { x: -11, y: -P.torso - P.neck - 4, width: 22, height: P.neck + 8, rx: 4, fill: TC.skin, stroke: TC.stroke, 'stroke-width': 2 }, g); },
  belt(g, P) {
    const w = P.torsoW;
    el('path', { d: `M${-20 * w},-14 L${20 * w},-14 L${24 * w},16 L${-24 * w},16Z`, fill: TC.pants, stroke: TC.stroke, 'stroke-width': 2.2 }, g);
    el('rect', { x: -20 * w, y: -16, width: 40 * w, height: 10, rx: 3, fill: TC.crystalDark, stroke: TC.stroke, 'stroke-width': 2 }, g);
  },
  upperArm(g, P, _C, back) {
    limb(g, P.upperArm, 24 * P.limbW, 18 * P.limbW, back ? TC.skinShade : TC.skin, TC.stroke, 2);
    shard(g, -6, 2, 30, 8, back); shard(g, 8, 4, 22, 7, back);
  },
  forearm(g, P, _C, back) {
    limb(g, P.forearm, 20 * P.limbW, 17 * P.limbW, back ? TC.skinShade : TC.skin, TC.stroke, 2);
    el('path', { d: `M-12,${P.forearm - 22} L12,${P.forearm - 22} L10,${P.forearm - 4} L-10,${P.forearm - 4}Z`, fill: back ? TC.crystalDark : TC.crystal, stroke: TC.stroke, 'stroke-width': 2 }, g);
  },
  hand(g, P, _C, back) { return buildHands(g, P.handR, back ? TC.skinShade : TC.skin, TC.stroke); },
  thigh(g, P, _C, back) { limb(g, P.thigh, 36 * P.limbW, 30 * P.limbW, back ? TC.pantsShade : TC.pants, TC.stroke, 3); },
  shin(g, P, _C, back) { limb(g, P.shin, 30 * P.limbW, 24 * P.limbW, back ? TC.skinShade : TC.skin, TC.stroke, 2); shard(g, 10, P.shin * 0.5, 18, 6, back); },
  foot(g, P, _C, back) {
    el('path', { d: 'M-15,-8 L15,-8 L16,4 Q36,4 38,12 L38,17 L-16,17Z', fill: back ? TC.skinShade : TC.skin, stroke: TC.stroke, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g);
  },
};

export const thornka = {
  id: 'thornka',
  name: 'Thorn-Ka',
  title: 'The Colossus of Universe 2',
  scale: 1.12,
  proportions: {
    thigh: 62, shin: 58, footH: 17, torso: 96, neck: 10, headR: 28, upperArm: 56, forearm: 52, handR: 12,
    shoulderF: { x: 12, y: 16 }, shoulderB: { x: -12, y: 18 }, hipF: 9, hipB: -10, torsoW: 1.5, limbW: 1.4,
  },
  palette: TC,
  parts: thornParts,
  aura: { inner: [255, 230, 200], outer: [255, 60, 90] },
  ki: { core: [255, 245, 200], glow: [255, 70, 100] },
  exprBrow: {},
  poses: { ...HUMAN_POSES, idle: { ...HUMAN_POSES.idle, lean: 4, aF: 30, eF: 60, aB: 20, eB: 60, hF: 16, kF: -20, hB: -14, kB: -16, bob: 0.8, stiff: 10 } },
};
