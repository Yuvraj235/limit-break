// Fusions and the new arc's enemies. All reuse the humanoid rig with their own hair, palette and build.
import { HUMAN_POSES } from './poses.js';
import { goku, saiyanHead } from './goku.js';
import { VEGETA_HAIR, parts as vegetaParts } from './vegeta.js';

const sp = (a, len, w, dir, curve) => ({ a, len, w, dir, curve });
const P = goku.proportions;

/* ── Gogeta: Goku + Vegeta, fused by the Fusion Dance ───────────────────── */
const GOGETA = [
  sp(-122, 0.85, 13, -140), sp(-97, 1.15, 15, -100), sp(-70, 1.32, 15, -62), sp(-42, 1.42, 15, -30),
  sp(-14, 1.3, 14, -6), sp(14, 1.05, 14, 24), sp(37, 0.8, 12, 70), sp(54, 0.62, 10, 130, 0.12),
  sp(65, 0.5, 9, 160, 0.1), sp(75, 0.4, 8, 175, 0.06), sp(85, 0.3, 7, 184, 0.05),
];
const G_SSJ = GOGETA.map((s, i) => ({ ...s, len: s.len * (i < 7 ? 1.22 : 1), dir: s.dir * (i < 7 ? 0.7 : 1) }));
const G_SSJ4 = GOGETA.map((s, i) => ({ ...s, len: s.len * (i < 7 ? 1.5 : 1.3), dir: s.dir - (i < 7 ? 20 : 0), w: s.w + 2 }));
const G_BLUE = G_SSJ.map((s, i) => ({ ...s, len: s.len * (i < 7 ? 0.96 : 1) }));
const G_UIEGO = G_SSJ.map((s, i) => ({ ...s, len: s.len * (i < 7 ? 1.08 : 1), dir: s.dir * (i < 7 ? 0.85 : 1) }));

/* Ultra Instinct Ego: a fused warrior's god form (silver hair bleeding into Ultra Ego's violet). */
const UI_EGO_LOOK = { hairTop: '#f6f2ff', hairBottom: '#8a4ce0', hairStroke: '#33125f', eye: '#e8dcff', aura: { inner: [248, 244, 255], outer: [176, 116, 255] }, lightning: true, ui: true };

export const gogeta = {
  id: 'gogeta',
  name: 'Gogeta',
  title: 'Fusion Warrior',
  scale: 0.84,
  proportions: { ...P, torso: 86, torsoW: 1.16, limbW: 1.2 },
  palette: {
    skin: '#f6c79a', skinShade: '#d9a27a', stroke: '#1c1220',
    gi: '#1f1f27', giShade: '#121218', under: '#ecebe6', underShade: '#c8c6be', wrist: '#e8701a',
    belt: '#2b6bd6', pants: '#ecebe6', pantsShade: '#c8c6be', boot: '#1f1f27', bootShade: '#121218', bootTrim: '#e8701a',
  },
  parts: { head: saiyanHead },
  defaultForm: 'base',
  ladder: ['base', 'ssj', 'ssj4', 'ssj_blue'],
  godForms: ['ui_ego'],
  /** Fusion Dance: short and explosive. Twin homing blasts; 👉👈 again = Soul Punisher. */
  fusion: {
    method: 'dance', label: 'Fusion Dance', seconds: 60, power: 1.42, guard: 0.8, kiRegen: 2.4, heal: 0.3,
    perk: 'twin', perkText: 'every ki blast fires from both hands',
    ultimate: { id: 'soul_punisher', name: 'Soul Punisher', cost: 50, text: 'unblockable, and purges the foe\'s power surge' },
    flash: [255, 226, 150],
  },
  moves: {
    beam: { name: 'Big Bang Kamehameha', colors: { core: [255, 250, 220], glow: [80, 170, 255] }, full: { at: 0.75, name: 'Big Bang Kamehameha ×100', colors: { core: [255, 255, 235], glow: [255, 200, 60] } } },
    bomb: { name: 'Stardust Breaker', colors: { core: [255, 255, 255], glow: [200, 140, 255] } },
    blast: { core: [255, 245, 220], glow: [255, 170, 60] },
  },
  ki: { core: [255, 250, 220], glow: [80, 170, 255] },
  forms: {
    base: { hair: GOGETA, hairTop: '#2b2b3b', hairBottom: '#0e0e16', hairStroke: '#000000', eye: '#1b1b1b', aura: { inner: [255, 255, 255], outer: [150, 190, 255] } },
    ssj: { hair: G_SSJ, hairTop: '#fff6a8', hairBottom: '#f2b81c', hairStroke: '#a86a00', eye: '#1fa78f', aura: { inner: [255, 250, 210], outer: [255, 196, 40] } },
    ssj4: { hair: G_SSJ4, hairTop: '#5a1a1a', hairBottom: '#1a0606', hairStroke: '#000000', eye: '#f2b81c', aura: { inner: [255, 220, 200], outer: [230, 40, 40] }, lightning: true },
    ssj_blue: { hair: G_BLUE, hairTop: '#c8fbff', hairBottom: '#1f9be6', hairStroke: '#0b5a96', eye: '#2a8fd8', aura: { inner: [225, 250, 255], outer: [40, 170, 255] } },
    ui_ego: { hair: G_UIEGO, ...UI_EGO_LOOK },
  },
  exprBrow: { calm: 6, focus: 10, shout: 14, strain: 14, hurt: -6, smirk: 8 },
  poses: HUMAN_POSES,
  portrait: { form: 'base' },
};

/* ── Vegito: Goku + Vegeta, fused by the Potara earrings ─────────────────── */
const V = VEGETA_HAIR;
const lock = (hair) => hair.map((s, i) => (i === 8 ? { ...s, len: 1.25, w: 8, dir: 172, curve: 0.14 } : s)); // Goku's stray front lock
const V_BASE = lock(V.BASE), V_SSJ = lock(V.SSJ), V_BLUE = lock(V.BLUE), V_UIEGO = lock(V.EGO);

export const vegito = {
  id: 'vegito',
  name: 'Vegito',
  title: 'Potara Warrior',
  scale: 0.83,
  proportions: { ...P, torso: 86, torsoW: 1.14, limbW: 1.18 },
  palette: {
    skin: '#f6c79a', skinShade: '#d9a27a', stroke: '#1c1220',
    gi: '#f07a1c', giShade: '#c45a0c', under: '#1f2a7a', underShade: '#141d58', wrist: '#f6f6f8',
    belt: '#1f2a7a', pants: '#1f2a7a', pantsShade: '#141d58', boot: '#f6f6f8', bootShade: '#d6d6de', bootTrim: '#e8b829',
  },
  parts: { head: saiyanHead, forearm: vegetaParts.forearm, hand: vegetaParts.hand, foot: vegetaParts.foot },
  hairline: V.HAIRLINE,
  defaultForm: 'base',
  ladder: ['base', 'ssj', 'ssj_blue'],
  godForms: ['ui_ego'],
  /** Potara: lasts longer and hits like a wall. Spirit Sword strikes; 👉👈 again = Spirit Sword Barrage. */
  fusion: {
    method: 'potara', label: 'Potara', seconds: 90, power: 1.32, guard: 0.72, kiRegen: 1.8, heal: 0.35,
    perk: 'sword', perkText: 'punches and kicks become Spirit Sword slashes (longer reach, +45% damage)',
    ultimate: { id: 'sword_barrage', name: 'Spirit Sword Barrage', cost: 45, text: 'blinks in for five unstoppable slashes' },
    flash: [200, 240, 120],
    burnsOut: true, // running out of ki in Blue or UI·Ego splits the fusion early
  },
  moves: {
    beam: { name: 'Final Kamehameha', colors: { core: [255, 255, 230], glow: [255, 210, 60] }, full: { at: 0.75, name: 'Final Kamehameha · Full Power', colors: { core: [255, 255, 245], glow: [255, 230, 110] } } },
    bomb: { name: 'Spirit Excalibur', shape: 'blade', colors: { core: [235, 250, 255], glow: [90, 190, 255] } },
    blast: { core: [255, 250, 225], glow: [255, 200, 70] },
  },
  ki: { core: [235, 250, 255], glow: [90, 190, 255] },
  forms: {
    base: { hair: V_BASE, hairTop: '#2a2a3a', hairBottom: '#0d0d15', hairStroke: '#000000', eye: '#1b1b1b', aura: { inner: [255, 255, 255], outer: [150, 190, 255] } },
    ssj: { hair: V_SSJ, hairTop: '#fff6a8', hairBottom: '#f2b81c', hairStroke: '#a86a00', eye: '#1fa78f', aura: { inner: [255, 250, 210], outer: [255, 196, 40] } },
    ssj_blue: { hair: V_BLUE, hairTop: '#c8fbff', hairBottom: '#1f9be6', hairStroke: '#0b5a96', eye: '#2a8fd8', aura: { inner: [225, 250, 255], outer: [40, 170, 255] } },
    ui_ego: { hair: V_UIEGO, ...UI_EGO_LOOK },
  },
  exprBrow: { calm: 8, focus: 12, shout: 15, strain: 15, hurt: -4, smirk: 9 },
  poses: HUMAN_POSES,
  portrait: { form: 'base' },
};

/* ── Aurex, the Fallen Angel: the final boss of Arc 3 ───────────────────── */
const AUREX_HAIR = [
  sp(-122, 1.3, 13, -170, 0.05), sp(-97, 1.4, 14, -160, 0.06), sp(-70, 1.3, 14, -146, 0.08), sp(-42, 1.05, 14, -124),
  sp(-14, 0.75, 13, -100), sp(14, 0.45, 12, -70), sp(37, 0.3, 11, -40), sp(54, 0.22, 10, -10),
  sp(65, 0.2, 9, 120), sp(75, 0.18, 8, 160), sp(85, 0.16, 7, 180),
];
export const aurex = {
  id: 'aurex',
  name: 'Aurex',
  title: 'The Fallen Angel',
  scale: 0.88,
  proportions: { ...P, torso: 88, headR: 28, torsoW: 1.0, limbW: 0.96 },
  palette: {
    skin: '#c9d6f2', skinShade: '#a3b2d6', stroke: '#10142a',
    gi: '#1b2a4f', giShade: '#121d38', under: '#e9eef8', underShade: '#c3cbe0', wrist: '#e8c45a',
    belt: '#e8c45a', pants: '#1b2a4f', pantsShade: '#121d38', boot: '#e9eef8', bootShade: '#c3cbe0', bootTrim: '#e8c45a',
  },
  parts: { head: saiyanHead },
  defaultForm: 'base',
  forms: { base: { hair: AUREX_HAIR, hairTop: '#ffffff', hairBottom: '#9fb3e6', hairStroke: '#2a3560', eye: '#7ff6ff', aura: { inner: [230, 250, 255], outer: [90, 220, 255] } } },
  ki: { core: [235, 255, 255], glow: [80, 220, 255] },
  aura: { inner: [230, 250, 255], outer: [90, 220, 255] },
  exprBrow: { calm: 4, focus: 8, shout: 12, strain: 12, hurt: -6, smirk: 6 },
  poses: { ...HUMAN_POSES, idle: { ...HUMAN_POSES.ui_stance, lift: 22, expr: 'calm' } },
  portrait: { form: 'base' },
};

/* ── Brakk the Berserker: a horned brute from Universe 6 ─────────────────── */
const BRAKK_HAIR = [
  sp(-122, 0.25, 12, -150), sp(-97, 0.3, 12, -110), sp(-70, 0.3, 10, -80), sp(-42, 1.2, 7, -38, 0.32), // left horn
  sp(-14, 0.22, 10, -10), sp(14, 0.22, 10, 12), sp(37, 1.2, 7, 40, 0.32), // right horn
  sp(54, 0.25, 9, 110), sp(65, 0.22, 8, 150), sp(75, 0.2, 8, 172), sp(85, 0.18, 7, 182),
];
export const brakk = {
  id: 'brakk',
  name: 'Brakk',
  title: 'The Berserker',
  scale: 0.98,
  proportions: { ...P, thigh: 70, shin: 64, torso: 92, headR: 28, upperArm: 56, forearm: 52, handR: 11, torsoW: 1.5, limbW: 1.55 },
  palette: {
    skin: '#b4503c', skinShade: '#8d3a2b', stroke: '#1a0a06',
    gi: '#3a2a22', giShade: '#271b15', under: '#b4503c', underShade: '#8d3a2b', wrist: '#6b6b70',
    belt: '#6b6b70', pants: '#2b2622', pantsShade: '#1b1714', boot: '#3a2a22', bootShade: '#271b15', bootTrim: '#c9a94a',
  },
  parts: { head: saiyanHead },
  defaultForm: 'base',
  forms: { base: { hair: BRAKK_HAIR, hairTop: '#e8dcc0', hairBottom: '#8c7c5a', hairStroke: '#2a1f10', eye: '#ffd23f', aura: { inner: [255, 210, 190], outer: [255, 70, 40] } } },
  ki: { core: [255, 220, 200], glow: [255, 70, 40] },
  aura: { inner: [255, 210, 190], outer: [255, 70, 40] },
  exprBrow: { calm: 14, focus: 16, shout: 18, strain: 18, hurt: 0, smirk: 12 },
  poses: HUMAN_POSES,
  portrait: { form: 'base' },
};

/* ── Zeltra, the Void Empress: a sorceress who bends space ──────────────── */
const ZELTRA_HAIR = [
  sp(-122, 2.4, 16, -175, 0.08), sp(-97, 2.2, 16, -168, 0.08), sp(-70, 1.9, 15, -158, 0.1), sp(-42, 1.5, 14, -140, 0.12),
  sp(-14, 1.1, 13, -110), sp(14, 0.7, 12, -40), sp(37, 0.6, 11, 60), sp(54, 0.9, 10, 150, 0.1),
  sp(65, 1.4, 9, 172, 0.08), sp(75, 1.8, 9, 178, 0.06), sp(85, 2.1, 8, 184, 0.05),
];
export const zeltra = {
  id: 'zeltra',
  name: 'Zeltra',
  title: 'The Void Empress',
  scale: 0.84,
  proportions: { ...P, torso: 82, headR: 28, upperArm: 50, forearm: 46, torsoW: 0.92, limbW: 0.9 },
  palette: {
    skin: '#d9c8f0', skinShade: '#b6a2d4', stroke: '#1b0f2c',
    gi: '#2a1145', giShade: '#1a0a2e', under: '#8a4dff', underShade: '#5f2fc0', wrist: '#ffd23f',
    belt: '#ffd23f', pants: '#2a1145', pantsShade: '#1a0a2e', boot: '#1a0a2e', bootShade: '#10061e', bootTrim: '#8a4dff',
  },
  parts: { head: saiyanHead },
  defaultForm: 'base',
  forms: { base: { hair: ZELTRA_HAIR, hairTop: '#c49bff', hairBottom: '#4b1b9a', hairStroke: '#1b0a3a', eye: '#ff4df0', aura: { inner: [240, 210, 255], outer: [170, 60, 255] } } },
  ki: { core: [245, 220, 255], glow: [170, 60, 255] },
  aura: { inner: [240, 210, 255], outer: [170, 60, 255] },
  exprBrow: { calm: 4, focus: 8, shout: 12, strain: 12, hurt: -8, smirk: 6 },
  poses: HUMAN_POSES,
  portrait: { form: 'base' },
};

/* ── Zelbrakk: Brakk and Zeltra, fused. Brakk's bulk, Zeltra's mane and void ki ── */
export const zelbrakk = {
  ...brakk,
  id: 'zelbrakk',
  name: 'Zelbrakk',
  title: 'The Fused Calamity',
  scale: 1.04,
  palette: { ...brakk.palette, skin: '#8f5aa8', skinShade: '#6c3f84', gi: '#2a1145', giShade: '#1a0a2e', belt: '#ffd23f', bootTrim: '#ff4df0' },
  forms: { base: { hair: ZELTRA_HAIR.map((s, i) => (i === 3 || i === 6 ? { ...BRAKK_HAIR[i], len: 1.5 } : s)), hairTop: '#ff8af0', hairBottom: '#5a1290', hairStroke: '#1b0a3a', eye: '#ffd23f', aura: { inner: [255, 210, 250], outer: [220, 50, 200] } } },
  ki: { core: [255, 220, 250], glow: [220, 50, 200] },
  aura: { inner: [255, 210, 250], outer: [220, 50, 200] },
};
