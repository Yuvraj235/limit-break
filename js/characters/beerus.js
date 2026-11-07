import { el, limb, strokeShape, buildHands } from './parts.js';
import { HUMAN_POSES } from './poses.js';

const C = {
  skin: '#8e6fc1', skinShade: '#6d529c', stroke: '#1a0f26', inner: '#d3a8de',
  top: '#1d2142', topShade: '#14172f', gold: '#e8b938', goldShade: '#a87f15',
  pants: '#1c1c27', pantsShade: '#121219', sash: '#c62f3c', eye: '#f2d14a',
};

function head(g, P, C2, rig) {
  const R = P.headR;
  // ears behind the skull
  el('path', { d: `M${-0.62 * R},${-0.55 * R} L${-0.58 * R},${-2.3 * R} L${0.12 * R},${-0.96 * R}Z`, fill: C.skinShade, stroke: C.stroke, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g);
  el('path', { d: `M${-0.4 * R},${-0.8 * R} L${-0.5 * R},${-1.95 * R} L${-0.05 * R},${-1.0 * R}Z`, fill: C.inner, opacity: 0.7 }, g);
  el('path', {
    d: `M0,${-1.05 * R} C${0.6 * R},${-1.05 * R} ${0.95 * R},${-0.6 * R} ${0.95 * R},${-0.1 * R} C${0.98 * R},${0.15 * R} ${1.06 * R},${0.28 * R} ${0.98 * R},${0.36 * R}`
      + ` C${0.9 * R},${0.55 * R} ${0.75 * R},${0.9 * R} ${0.35 * R},${1.05 * R} C${0.05 * R},${1.1 * R} ${-0.4 * R},${0.85 * R} ${-0.62 * R},${0.55 * R}`
      + ` C${-0.9 * R},${0.2 * R} ${-0.95 * R},${-0.45 * R} ${-0.7 * R},${-0.8 * R} C${-0.5 * R},${-1.0 * R} ${-0.25 * R},${-1.05 * R} 0,${-1.05 * R}Z`,
    fill: C.skin, stroke: C.stroke, 'stroke-width': 2.4,
  }, g);
  el('path', { d: `M${-0.05 * R},${-0.9 * R} L${0.28 * R},${-2.35 * R} L${0.72 * R},${-0.62 * R}Z`, fill: C.skin, stroke: C.stroke, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g);
  el('path', { d: `M${0.14 * R},${-0.9 * R} L${0.3 * R},${-1.95 * R} L${0.55 * R},${-0.78 * R}Z`, fill: C.inner, opacity: 0.75 }, g);
  // brow ridge wrinkles
  el('path', { d: `M${0.1 * R},${-0.55 * R} Q${0.4 * R},${-0.62 * R} ${0.7 * R},${-0.5 * R} M${0.15 * R},${-0.42 * R} Q${0.4 * R},${-0.48 * R} ${0.62 * R},${-0.38 * R}`, fill: 'none', stroke: C.skinShade, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
  // earring
  el('circle', { cx: -0.32 * R, cy: 0.5 * R, r: 0.16 * R, fill: 'none', stroke: C.gold, 'stroke-width': 0.08 * R }, g);

  const pupils = [];
  el('path', { d: `M${0.3 * R},${0.02 * R} Q${0.56 * R},${-0.22 * R} ${0.84 * R},${-0.03 * R} Q${0.58 * R},${0.17 * R} ${0.3 * R},${0.02 * R}Z`, fill: C.eye, stroke: C.stroke, 'stroke-width': 1.8 }, g);
  pupils.push(el('ellipse', { cx: 0.63 * R, cy: -0.02 * R, rx: 0.055 * R, ry: 0.11 * R, fill: '#111' }, g));
  el('path', { d: `M${0.3 * R},${0.02 * R} L${0.1 * R},${-0.12 * R}`, stroke: '#111', 'stroke-width': 0.09 * R, 'stroke-linecap': 'round' }, g);
  el('path', { d: `M${0.86 * R},${-0.02 * R} Q${0.92 * R},${-0.1 * R} ${0.97 * R},${-0.03 * R} Q${0.92 * R},${0.04 * R} ${0.86 * R},${-0.02 * R}Z`, fill: C.eye, stroke: C.stroke, 'stroke-width': 1.3 }, g);
  const brows = el('g', {}, g);
  el('path', { d: `M${0.32 * R},${-0.2 * R} Q${0.55 * R},${-0.3 * R} ${0.8 * R},${-0.17 * R}`, fill: 'none', stroke: '#2a1838', 'stroke-width': 0.06 * R, 'stroke-linecap': 'round' }, brows);

  const mouths = {};
  const m = (name, d, extra = {}) => { mouths[name] = el('path', { d, fill: 'none', stroke: C.stroke, 'stroke-width': 1.8, 'stroke-linecap': 'round', ...extra }, g); };
  m('calm', `M${0.5 * R},${0.66 * R} L${0.78 * R},${0.62 * R}`);
  m('focus', `M${0.52 * R},${0.66 * R} L${0.8 * R},${0.64 * R}`);
  m('smirk', `M${0.48 * R},${0.66 * R} Q${0.66 * R},${0.7 * R} ${0.84 * R},${0.56 * R}`);
  m('hurt', `M${0.5 * R},${0.7 * R} Q${0.65 * R},${0.6 * R} ${0.8 * R},${0.7 * R}`);
  m('strain', `M${0.48 * R},${0.6 * R} L${0.84 * R},${0.58 * R} L${0.82 * R},${0.7 * R} L${0.5 * R},${0.72 * R}Z`, { fill: '#fff' });
  m('shout', `M${0.46 * R},${0.56 * R} Q${0.68 * R},${0.5 * R} ${0.88 * R},${0.56 * R} Q${0.82 * R},${0.92 * R} ${0.62 * R},${0.88 * R} Q${0.48 * R},${0.78 * R} ${0.46 * R},${0.56 * R}Z M${0.52 * R},${0.58 * R} L${0.56 * R},${0.68 * R} L${0.6 * R},${0.57 * R} M${0.76 * R},${0.56 * R} L${0.79 * R},${0.66 * R} L${0.83 * R},${0.56 * R}`, { fill: '#3a0d22' });
  return { pupils, brows, browPivot: [0.55 * R, -0.24 * R], mouths };
}

const parts = {
  head,
  torso(g, P) {
    const T = P.torso, w = P.torsoW;
    el('path', {
      d: `M${-16 * w},0 C${-21 * w},${-T * 0.35} ${-24 * w},${-T * 0.7} ${-20 * w},${-T + 12} Q${-16 * w},${-T - 3} ${-2 * w},${-T - 2} Q${17 * w},${-T} ${20 * w},${-T + 10} C${26 * w},${-T * 0.6} ${22 * w},${-T * 0.25} ${16 * w},0Z`,
      fill: C.top, stroke: C.stroke, 'stroke-width': 2.4, 'stroke-linejoin': 'round',
    }, g);
    // broad gold collar
    el('path', { d: `M${-20 * w},${-T + 6} Q${0},${-T + 30} ${21 * w},${-T + 8} L${18 * w},${-T - 2} Q0,${-T + 12} ${-18 * w},${-T - 3}Z`, fill: C.gold, stroke: C.stroke, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
    el('path', { d: `M${-14 * w},${-T + 8} Q0,${-T + 22} ${15 * w},${-T + 9}`, fill: 'none', stroke: C.goldShade, 'stroke-width': 2 }, g);
  },
  neck(g, P) { el('rect', { x: -6, y: -P.torso - P.neck - 4, width: 12, height: P.neck + 8, rx: 4, fill: C.skin, stroke: C.stroke, 'stroke-width': 2 }, g); },
  belt(g, P) {
    const w = P.torsoW;
    el('rect', { x: -19 * w, y: -14, width: 38 * w, height: 16, rx: 4, fill: C.sash, stroke: C.stroke, 'stroke-width': 2 }, g);
    el('circle', { cx: 12 * w, cy: -6, r: 6, fill: C.gold, stroke: C.stroke, 'stroke-width': 1.6 }, g);
    strokeShape(g, `M${12 * w},0 Q${18 * w},18 ${10 * w},34`, 7, C.sash, C.stroke, 1.6);
  },
  upperArm(g, P, _C, back) {
    limb(g, P.upperArm, 15 * P.limbW, 12 * P.limbW, back ? C.skinShade : C.skin, C.stroke, 1);
    el('rect', { x: -9, y: 10, width: 18, height: 7, rx: 3, fill: back ? C.goldShade : C.gold, stroke: C.stroke, 'stroke-width': 1.6 }, g);
  },
  forearm(g, P, _C, back) {
    limb(g, P.forearm, 12 * P.limbW, 10 * P.limbW, back ? C.skinShade : C.skin, C.stroke, 1);
    el('rect', { x: -8, y: P.forearm - 20, width: 16, height: 18, rx: 3, fill: back ? C.goldShade : C.gold, stroke: C.stroke, 'stroke-width': 1.8 }, g);
  },
  hand(g, P, _C, back) { return buildHands(g, P.handR, back ? C.skinShade : C.skin, C.stroke); },
  thigh(g, P, _C, back) { limb(g, P.thigh, 32 * P.limbW, 30 * P.limbW, back ? C.pantsShade : C.pants, C.stroke, 5); },
  shin(g, P, _C, back) {
    limb(g, P.shin, 30 * P.limbW, 18 * P.limbW, back ? C.pantsShade : C.pants, C.stroke, 6);
    el('rect', { x: -9, y: P.shin - 12, width: 18, height: 9, rx: 3, fill: back ? C.goldShade : C.gold, stroke: C.stroke, 'stroke-width': 1.6 }, g);
  },
  foot(g, P, _C, back) {
    el('path', { d: 'M-9,-6 L9,-6 L10,4 Q26,2 34,8 Q30,13 -10,13Z', fill: back ? '#3a2b55' : '#4b3870', stroke: C.stroke, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
    el('circle', { cx: 32, cy: 8, r: 3, fill: C.gold }, g);
  },
  tail(g, P, _C, rig) {
    const path = el('path', { fill: 'none', stroke: C.stroke, 'stroke-width': 9.5, 'stroke-linecap': 'round' }, g);
    const fill = el('path', { fill: 'none', stroke: C.skinShade, 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
    return {
      update(t) {
        const s = Math.sin(t * 1.7) * 14, s2 = Math.sin(t * 1.7 + 1.2) * 18;
        const d = `M-14,-6 C-48,${10 + s} -70,${40 + s2} -60,${70 + s} S-30,${96 + s2} -38,${118 + s}`;
        path.setAttribute('d', d);
        fill.setAttribute('d', d);
      },
    };
  },
};

const poses = {
  ...HUMAN_POSES,
  idle: { lean: -3, head: -6, aF: -34, eF: 66, aB: -38, eB: 60, hF: 8, kF: -8, hB: -6, kB: -6, lift: 10, expr: 'smirk', bob: 0, stiff: 10 },
  idle_serious: { ...HUMAN_POSES.idle, handF: 'open', handB: 'open', expr: 'focus', lift: 12, bob: 1.2 },
};

export const beerus = {
  id: 'beerus',
  name: 'Beerus',
  title: 'God of Destruction',
  scale: 0.86,
  proportions: {
    thigh: 66, shin: 66, footH: 13, torso: 80, neck: 14, headR: 28, upperArm: 54, forearm: 50, handR: 8.5,
    shoulderF: { x: 7, y: 12 }, shoulderB: { x: -7, y: 14 }, hipF: 5, hipB: -7, torsoW: 0.86, limbW: 0.84,
  },
  palette: C,
  parts,
  aura: { inner: [240, 210, 255], outer: [150, 60, 230] },
  ki: { core: [255, 240, 255], glow: [170, 70, 255] },
  exprBrow: { calm: 0, focus: 6, shout: 10, strain: 12, hurt: -8, smirk: -4 },
  poses,
};
