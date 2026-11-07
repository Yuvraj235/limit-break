import { SMOOTHING, MOTION } from '../config.js';
import { OneEuro } from './oneEuro.js';
import { handSize } from './features.js';

const HISTORY_MS = 700;

/**
 * Keeps hand identity stable across frames (MediaPipe's output order can swap), filters every
 * landmark with a One-Euro filter, mirrors x so it matches the player's view, and keeps a short
 * wrist/size history for motion gestures. A hand that briefly vanishes is kept for LOST_GRACE_MS, or
 * up to MERGE_HOLD_MS when it disappeared next to the other hand.
 */
export class HandTracks {
  constructor() {
    this.tracks = [];
    this.nextId = 1;
  }

  _newTrack(now) {
    const f = () => new OneEuro(SMOOTHING.ONE_EURO_MIN_CUTOFF, SMOOTHING.ONE_EURO_BETA, SMOOTHING.ONE_EURO_D_CUTOFF);
    return { id: this.nextId++, born: now, lastSeen: now, stale: false, filters: Array.from({ length: 63 }, f), lm: null, hist: [], size: 0.1 };
  }

  update(rawHands, aspect, now) {
    const t = now / 1000;
    const incoming = rawHands.map((h) => ({
      lm: h.landmarks.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z })),
      raw: h.landmarks,
      handedness: h.handedness,
      gesture: h.gesture,
    }));

    const assignment = this._match(incoming);
    const next = [];
    incoming.forEach((inc, i) => {
      const tr = assignment[i] || this._newTrack(now);
      tr.lm = inc.lm.map((p, j) => ({
        x: tr.filters[j * 3].filter(p.x, t),
        y: tr.filters[j * 3 + 1].filter(p.y, t),
        z: tr.filters[j * 3 + 2].filter(p.z, t),
      }));
      tr.handedness = inc.handedness;
      // The trained gesture label, smoothed so one odd frame can't flip it.
      if (inc.gesture) {
        const g = tr.gesture;
        tr.gesture = g && g.name === inc.gesture.name ? { name: g.name, score: g.score + (inc.gesture.score - g.score) * 0.5 } : g && g.score > 0.55 ? { name: g.name, score: g.score * 0.6 } : { ...inc.gesture };
      } else tr.gesture = null;
      // A hand resting at the bottom edge or mostly out of frame is ignored for gestures.
      const outside = inc.raw.filter((p) => p.x < -0.02 || p.x > 1.02 || p.y < -0.02 || p.y > 1.02).length;
      tr.resting = outside > 5 || tr.lm[0].y > SMOOTHING.REST_WRIST_Y;
      tr.lastSeen = now;
      tr.stale = false;
      tr.size = handSize(tr.lm, aspect);
      tr.hist.push({ t: now, x: tr.lm[0].x, y: tr.lm[0].y, size: tr.size });
      while (tr.hist.length && now - tr.hist[0].t > HISTORY_MS) tr.hist.shift();
      next.push(tr);
    });

    // Keep hands that just disappeared for a moment. A hand that vanished right next to the other one
    // is usually hidden behind it (Kamehameha), so it is kept for as long as the other hand stays close.
    for (const tr of this.tracks) {
      if (next.includes(tr) || next.length >= 2) continue;
      const age = now - tr.lastSeen;
      const hidden = tr.partner && next.includes(tr.partner) && age < MOTION.MERGE_HOLD_MS && this._near(tr, tr.partner, aspect);
      if (age < MOTION.LOST_GRACE_MS || hidden) { tr.stale = true; next.push(tr); }
    }
    const seen = next.filter((tr) => !tr.stale);
    if (seen.length === 2) {
      const close = this._near(seen[0], seen[1], aspect);
      seen[0].partner = close ? seen[1] : null;
      seen[1].partner = close ? seen[0] : null;
    }

    next.sort((a, b) => a.lm[0].x - b.lm[0].x);
    this.tracks = next;
    return next;
  }

  _near(a, b, aspect) {
    const d = Math.hypot((a.lm[0].x - b.lm[0].x) * aspect, a.lm[0].y - b.lm[0].y);
    return d / ((a.size + b.size) / 2) < MOTION.MERGE_DIST;
  }

  // Minimum-total-distance assignment of incoming hands to existing tracks (n ≤ 2, so brute force).
  _match(incoming) {
    const tracks = this.tracks;
    const result = new Array(incoming.length).fill(null);
    if (!tracks.length || !incoming.length) return result;
    const d = (tr, inc) => Math.hypot(tr.lm[0].x - inc.lm[0].x, tr.lm[0].y - inc.lm[0].y);
    const MAX = 0.3;
    if (incoming.length === 1 || tracks.length === 1) {
      let best = null;
      for (let i = 0; i < incoming.length; i++) {
        for (const tr of tracks) {
          const dd = d(tr, incoming[i]);
          if (dd < MAX && (!best || dd < best.dd)) best = { i, tr, dd };
        }
      }
      if (best) result[best.i] = best.tr;
      return result;
    }
    const [a, b] = tracks;
    const straight = d(a, incoming[0]) + d(b, incoming[1]);
    const swapped = d(b, incoming[0]) + d(a, incoming[1]);
    const [t0, t1] = straight <= swapped ? [a, b] : [b, a];
    if (d(t0, incoming[0]) < MAX) result[0] = t0;
    if (d(t1, incoming[1]) < MAX) result[1] = t1;
    return result;
  }

  clear() { this.tracks = []; }
}
