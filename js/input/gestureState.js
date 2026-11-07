import { SMOOTHING } from '../config.js';
import { G } from './gestureDefs.js';

/**
 * Debounce with low latency: per-gesture scores are smoothed with an EMA (fast rise, slower fall),
 * then hysteresis decides switches. A new pose must beat ENTER and the current pose by MARGIN; the
 * current pose holds until it drops under EXIT. MIN_DWELL_MS blocks rapid back-and-forth flicker between
 * two moves; a move entered from neutral needs no dwell, which keeps the common path fast.
 */
export class GestureStateMachine {
  constructor(ids, cfg = SMOOTHING) {
    this.cfg = cfg;
    this.ids = ids;
    this.reset();
  }

  reset() {
    this.scores = Object.fromEntries(this.ids.map((id) => [id, 0]));
    this.current = G.IDLE;
    this.since = 0;
    this.lastSwitch = -Infinity;
  }

  update(raw, now) {
    const c = this.cfg;
    let best = null;
    let bestScore = 0;
    for (const id of this.ids) {
      const r = raw[id] ?? 0;
      const s = this.scores[id];
      this.scores[id] = s + (r - s) * (r > s ? c.EMA_ALPHA : c.EMA_FALL);
      if (id !== this.current && this.scores[id] > bestScore) { bestScore = this.scores[id]; best = id; }
    }
    const curScore = this.current === G.IDLE ? 0 : this.scores[this.current];

    let next = this.current;
    const dwell = this.current === G.IDLE ? 0 : c.MIN_DWELL_MS; // react instantly from neutral
    if (now - this.lastSwitch >= dwell) {
      if (best && bestScore > c.ENTER && bestScore > curScore + c.MARGIN) next = best;
      else if (this.current !== G.IDLE && curScore < c.EXIT) next = G.IDLE;
    }
    if (next !== this.current) {
      const prev = this.current;
      this.current = next;
      this.since = now;
      this.lastSwitch = now;
      return { changed: true, prev, current: next };
    }
    return { changed: false, current: this.current };
  }
}
