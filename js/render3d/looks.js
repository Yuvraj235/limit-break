// How each fighter is dressed in 3D. Gi-wearing fighters read straight from their 2D palette; the
// others list their own outfit pieces. All designs are original to this game except the licensed
// characters' general outfits, which stay stylized (see README licensing note).

const PONYTAIL = [
  { a: -110, len: 2.4, w: 14, dir: -122, curve: 0.18 }, { a: -80, len: 1.3, w: 16, dir: -96 }, { a: -45, len: 0.6, w: 18, dir: -50 },
  { a: -10, len: 0.35, w: 18, dir: -5 }, { a: 25, len: 0.35, w: 16, dir: 40 }, { a: 55, len: 0.5, w: 12, dir: 130, curve: 0.1 }, { a: 72, len: 0.62, w: 10, dir: 168, curve: 0.08 },
];

const SPECIAL = {
  vegeta: {
    top: '#2b3a9e', vneck: null, sleeve: null, wrist: null, belt: null, glove: '#f6f6f8', boot: '#f6f6f8', bootToe: '#e8b829', bootTrim: null,
    armor: { chest: '#f4f5f8', pad: '#e8b829' },
  },
  gogeta: { sleeve: null, vest: true },
  vegito: {
    vneck: '#1f2a7a', sleeve: '#1f2a7a', wrist: null, glove: '#f6f6f8', boot: '#f6f6f8', bootToe: '#e8b829', bootTrim: null,
    belt: '#1f2a7a', beltTails: true, earrings: '#d6f04f', earringBall: true,
  },
  aurex: { sleeve: null, wrist: '#e8c45a', boot: '#e9eef8', bootToe: '#e8c45a', bootTrim: null, halo: '#9ff8ff' },
  beerus: {
    skin: '#8e6fc1', top: '#1d2142', vneck: null, sleeve: null, wrist: '#e8b938', armband: '#e8b938', belt: '#c62f3c', beltTails: true,
    pants: '#1c1c27', boot: '#1c1c27', bootToe: '#e8b938', bootTrim: null, collar: '#e8b938', ears: true, tail: '#6d529c', earrings: '#e8b938',
    hair: 'none', eyes: { kind: 'anime', iris: '#f2d14a' }, outline: '#1a0f26',
  },
  garrok: {
    skin: '#7f8f6b', top: '#7a2a2a', vneck: null, sleeve: null, wrist: null, belt: '#353c49', buckle: '#c9a94a', pants: '#7a2a2a',
    boot: '#4b5566', bootTrim: null, plates: '#4b5566', plateEdge: '#8592a8', chestPlate: '#4b5566',
    helm: { color: '#4b5566', horn: '#d9cfb8' }, hair: 'none', eyes: { kind: 'glow', iris: '#ff3b2f' }, outline: '#14140f',
  },
  vessa: {
    skin: '#d9a988', top: '#eef3f6', vneck: null, sleeve: null, wrist: null, belt: '#138a7e', pants: '#eef3f6',
    boot: '#1fc2b0', bootTrim: null, stripe: '#1fc2b0', fins: '#1fc2b0', scarf: '#1fc2b0', visor: '#6ff5e4',
    hair: 'spikes', hairSpikes: PONYTAIL, hairColor: ['#5b4596', '#2a1d55'], hairSpread: [-48, -20, 0, 20, 48], eyes: { kind: 'visor' }, outline: '#14202a',
  },
  thornka: {
    skin: '#a8283e', top: '#a8283e', vneck: null, sleeve: null, wrist: null, belt: '#c43a55', pants: '#2b2233', boot: '#a8283e', bootTrim: null,
    crystals: '#ff7b90', core: '#ffd34d', hair: 'none', eyes: { kind: 'glow', iris: '#ffe066' }, outline: '#2a0710',
  },
  brakk: { hairSpread: [-34, 34] },
  zelbrakk: { hairSpread: [-50, -18, 18, 50] },
  zeltra: { hairSpread: [-62, -30, 0, 30, 62] },
  shadow: { eyes: { kind: 'glow', iris: '#8ff3ff' } },
};

/** Resolved 3D outfit for a fighter definition. */
export function lookOf(def) {
  const P = def.palette || {};
  const base = {
    skin: P.skin || '#f6c79a', top: P.gi || '#888888', vneck: P.under || null, sleeve: P.under || null, wrist: P.wrist || null,
    belt: P.belt || null, beltTails: !!P.belt, pants: P.pants || P.gi || '#666666', boot: P.boot || '#333333', bootTrim: P.bootTrim || null,
    hair: def.forms ? 'spikes' : 'none', eyes: { kind: 'anime' }, outline: P.stroke || '#14101c',
    hairSpread: [-58, -28, 0, 28, 58],
  };
  return { ...base, ...(SPECIAL[def.id] || {}) };
}
