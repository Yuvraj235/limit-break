import { COMBAT } from '../config.js';

/**
 * Beam struggle. pos is the clash point between leftX (player) and rightX (opponent); each side's
 * push (0..1) moves it. Reaching the other fighter wins; on timeout the side that pushed it
 * further wins.
 */
export function createStruggle({ pos, leftX, rightX, ai }) {
  return { pos, leftX, rightX, ai, t: 0, winner: null, p1Push: 0, aiPush: 0 };
}

export function stepStruggle(s, p1Push, aiPush, dt) {
  if (s.winner) return s;
  s.t += dt;
  s.p1Push = p1Push;
  s.aiPush = aiPush;
  s.pos += (p1Push - aiPush) * COMBAT.STRUGGLE_RATE * (s.rightX - s.leftX) * dt;
  const margin = 40;
  if (s.pos >= s.rightX - margin) s.winner = 'p1';
  else if (s.pos <= s.leftX + margin) s.winner = 'p2';
  else if (s.t * 1000 >= COMBAT.STRUGGLE_MAX_MS) s.winner = s.pos - s.leftX >= s.rightX - s.pos ? 'p1' : 'p2';
  return s;
}

/** AI push with a little rhythm so the clash surges back and forth. */
export const aiStrugglePush = (s, strength) => strength + 0.12 * Math.sin(s.t * 2.3) + 0.06 * Math.sin(s.t * 7.1);
