import { clamp, ramp } from '../core/math.js';
import { raiseOfBody } from './features.js';

export const G = {
  IDLE: 'idle',
  POWER: 'power',
  KAME: 'kame',
  SPIRIT: 'spirit',
  GUARD: 'guard',
  KIBLAST: 'kiblast',
  TELEPORT: 'teleport',
  FUSE: 'fuse',
};

/** The seven moves. Beam and bomb names change per fighter (see each character's `moves`). */
export const GESTURE_LABELS = {
  idle: 'Neutral Stance',
  power: 'Power Up',
  kame: 'Ultimate Beam',
  spirit: 'Spirit Bomb',
  guard: 'Energy Barrier',
  kiblast: 'Ki Blast',
  teleport: 'Instant Transmission',
  fuse: 'Fusion',
};

export const GESTURE_ICONS = { idle: '🥋', power: '✊', kame: '👐', spirit: '🙌', guard: '🖐️', kiblast: '👉', teleport: '✌️', fuse: '👉👈' };

const fistScore = (h) => h.shape.fist;
const openScore = (h) => h.shape.open;
const wideScore = (h) => h.shape.wide;
const notFist = (h) => Math.min(ramp(h.fistness, 0.66, 0.48), 1 - 0.8 * h.shape.fist); // claws allowed
const seen = (F) => F.hands.filter((h) => !h.track?.stale); // hands actually visible this frame
/** 👉👈 Fusion Dance finish: both index fingers pointing at each other, tips (nearly) touching. */
const fuseScore = (F) => {
  const hs = seen(F);
  if (hs.length < 2) return 0;
  const [a, b] = hs;
  const ta = a.track.lm[8], tb = b.track.lm[8];
  const d = Math.hypot((ta.x - tb.x) * F.aspect, ta.y - tb.y) / ((a.size + b.size) / 2);
  return Math.min(a.shape.point, b.shape.point) * ramp(d, 0.9, 0.45);
};
const kameClose = (F, c) => (F.count >= 2 ? ramp(F.pair.wristDist, c.KAME_WRIST_MAX, c.KAME_WRIST_FULL) : 0);
/** How far a hand is raised, 0..1: against the eyes when the body is tracked, else the calibrated line. */
const raisedOf = (h, F, c) => (F.body
  ? ramp(raiseOfBody(h.palm.y, F.body), c.RAISE_BODY_MIN, c.RAISE_BODY_FULL)
  : ramp(h.palm.y, c.RAISE_Y + c.RAISE_SOFT, c.RAISE_Y - c.RAISE_SOFT));
const bothRaised = (F, c) => (F.count >= 2 ? Math.min(...F.hands.slice(0, 2).map((h) => openScore(h, c) * raisedOf(h, F, c))) : 0);

/**
 * Pose registry. Each definition maps frame features (see features.js) to a 0..1 score.
 * Add a gesture by appending a definition; the state machine and HUD pick it up automatically.
 */
export const GESTURE_DEFS = [
  {
    id: G.POWER, // ✊ one or two fists
    score(F, c) {
      const hs = seen(F);
      if (!hs.length) return 0;
      const fs = hs.map((h) => fistScore(h, c));
      const best = Math.max(...fs);
      return hs.length >= 2 ? Math.max(best * 0.9, Math.min(fs[0], fs[1])) : best * 0.95;
    },
    intensity(F, c) {
      return F.count >= 2 && F.hands.every((h) => fistScore(h, c) > 0.5) ? 1 : 0.6;
    },
  },
  {
    id: G.KAME, // 👐 cupped hands, wrists close, not raised
    score(F, c) {
      if (F.count < 2) return 0;
      const [a, b] = F.hands;
      const noPoint = 1 - Math.max(a.shape.point, b.shape.point, a.shape.peace, b.shape.peace) * 0.8;
      const low = 1 - Math.max(raisedOf(a, F, c), raisedOf(b, F, c));
      return Math.min(notFist(a), notFist(b)) * kameClose(F, c) * low * noPoint;
    },
  },
  {
    id: G.SPIRIT, // 🙌 BOTH open hands raised high (one hand never makes a Spirit Bomb)
    score(F, c) {
      return bothRaised(F, c);
    },
  },
  {
    id: G.GUARD, // 🖐️ a wide-open palm facing the camera (one hand is enough, at any height)
    score(F, c) {
      const hs = seen(F);
      if (!hs.length) return 0;
      const best = Math.max(...hs.map((h) => wideScore(h, c)));
      return best * (1 - kameClose(F, c)) * (1 - bothRaised(F, c)) * 0.95;
    },
  },
  {
    id: G.KIBLAST, // 👉 pointing finger
    score(F) {
      const hs = seen(F);
      if (!hs.length) return 0;
      const best = Math.max(...hs.map((h) => h.shape.point));
      return (hs.length >= 2 ? best * 0.9 : best) * (1 - fuseScore(F));
    },
  },
  {
    id: G.TELEPORT, // ✌️ two-finger sign
    score(F) {
      const hs = seen(F);
      if (!hs.length) return 0;
      return Math.max(...hs.map((h) => h.shape.peace));
    },
  },
  {
    id: G.FUSE, // 👉👈 the Fusion Dance's finishing pose (only does something when fusion is available)
    score(F) { return fuseScore(F); },
  },
];

export const GESTURE_IDS = GESTURE_DEFS.map((d) => d.id);

export function scoreGestures(F, cfg) {
  const out = {};
  for (const d of GESTURE_DEFS) out[d.id] = clamp(d.score(F, cfg));
  return out;
}

export function gestureIntensity(id, F, cfg) {
  const def = GESTURE_DEFS.find((d) => d.id === id);
  return def?.intensity ? def.intensity(F, cfg) : 1;
}
