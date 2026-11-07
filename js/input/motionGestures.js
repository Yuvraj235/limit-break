import { MOTION, GESTURE } from '../config.js';
import { ramp } from '../core/math.js';
import { G } from './gestureDefs.js';

function sampleAgo(hist, now, ms) {
  for (let i = hist.length - 1; i >= 0; i--) if (now - hist[i].t >= ms) return hist[i];
  return null;
}

function pathSpeed(tr, now, ms, aspect) {
  // wrist path length over the window, in hand units per second
  let len = 0;
  let first = null;
  for (let i = 1; i < tr.hist.length; i++) {
    const a = tr.hist[i - 1], b = tr.hist[i];
    if (now - a.t > ms) continue;
    if (!first) first = a;
    len += Math.hypot((b.x - a.x) * aspect, b.y - a.y);
  }
  if (!first) return 0;
  const span = Math.max(0.05, (now - first.t) / 1000);
  return len / (tr.size || 0.1) / span;
}

/**
 * Motion gestures layered on top of poses: sideways swipe (a backup trigger for Instant Transmission),
 * forward push (fire the beam), fist jabs (punches), leg kicks (body tracking) and fist shaking
 * (power-up boost / beam-struggle push).
 * Ultra Instinct is no longer a stillness gesture: it is the top of the power-up ladder.
 */
export class MotionDetector {
  constructor(cfg = MOTION) {
    this.cfg = cfg;
    this.lastDodge = -Infinity;
    this.lastPush = -Infinity;
    this.lastPunch = -Infinity;
    this.lastKick = -Infinity;
    this.legs = [{ stoodAt: -Infinity, up: false }, { stoodAt: -Infinity, up: false }];
    this.stillness = 0;
    this.shake = 0;
  }

  update(tracks, F, pose, now, aspect) {
    const c = this.cfg;
    const events = [];
    const fresh = tracks.filter((t) => !t.stale && now - t.born > c.TRACK_MIN_AGE_MS);

    // Sideways swipe → dodge. Suppressed while charging so bringing the hands together never dodges.
    if (pose !== G.KAME && pose !== G.SPIRIT && pose !== G.TELEPORT && pose !== G.POWER && now - this.lastDodge > c.DODGE_COOLDOWN_MS) {
      for (const tr of fresh) {
        const then = sampleAgo(tr.hist, now, c.DODGE_WINDOW_MS);
        if (!then) continue;
        const last = tr.hist[tr.hist.length - 1];
        const secs = (last.t - then.t) / 1000;
        if (secs <= 0) continue;
        const vx = (last.x - then.x) / secs;           // frame widths per second
        const vy = (last.y - then.y) / secs;           // frame heights per second
        if (Math.abs(vx) > c.DODGE_SPEED && Math.abs(vx * aspect) > 1.6 * Math.abs(vy)) {
          events.push({ type: 'dodge', dir: Math.sign(vx) });
          this.lastDodge = now;
          break;
        }
      }
    }

    // Forward push during Kamehameha: the hands grow in the frame (one may be hidden behind the other).
    if (pose === G.KAME && fresh.length && now - this.lastPush > c.PUSH_COOLDOWN_MS) {
      const pushers = fresh.slice(0, 2);
      let ratio = 0;
      for (const tr of pushers) {
        let min = Infinity;
        for (const h of tr.hist) if (now - h.t <= c.PUSH_WINDOW_MS) min = Math.min(min, h.size);
        ratio += tr.size / (min || tr.size);
      }
      if (ratio / pushers.length > 1 + c.PUSH_SCALE) { events.push({ type: 'push' }); this.lastPush = now; }
    }

    // ✊ Punch: a fist that jabs toward the camera (grows in the frame) or snaps across it. Net
    // displacement, not speed, so shaking fists to power up doesn't count as punching.
    if (now - this.lastPunch > c.PUNCH_COOLDOWN_MS) {
      for (const h of F.hands) {
        const tr = h.track;
        if (tr.stale || now - tr.born < c.PUNCH_MIN_AGE_MS || h.shape.fist < 0.5) continue;
        if (tr.lm.some((p) => p.x < 0.02 || p.x > 0.98 || p.y < 0.02 || p.y > 0.98)) { tr.inViewSince = null; continue; }
        tr.inViewSince ??= now;
        if (now - tr.inViewSince < c.PUNCH_MIN_AGE_MS) continue; // fully in view for a moment first
        const then = sampleAgo(tr.hist, now, c.PUNCH_WINDOW_MS);
        if (!then) continue;
        const grow = tr.size / (then.size || tr.size);
        const net = Math.hypot((tr.lm[0].x - then.x) * aspect, tr.lm[0].y - then.y) / (tr.size || 0.1);
        const secs = Math.max(0.05, (now - then.t) / 1000);
        if (grow > 1 + c.PUNCH_GROWTH || (net > 1.3 && net * tr.size / secs > c.PUNCH_SPEED)) {
          events.push({ type: 'punch' });
          this.lastPunch = now;
          break;
        }
      }
    }

    // 🦵 Kick: a knee lifted toward hip height or a foot swung out to the side. A leg only counts after
    // it has been seen standing, so sitting down (knees at hip height) never fires kicks.
    if (F.body) {
      F.body.legs.forEach((leg, i) => {
        const st = this.legs[i];
        if (!leg) { st.up = false; return; }
        if (leg.kneeDrop > 0.85 && leg.reach < 0.6) st.stoodAt = now;
        const kicking = leg.kneeDrop < c.KICK_KNEE_LIFT || leg.reach > c.KICK_REACH;
        if (kicking && !st.up && now - st.stoodAt < c.KICK_STANCE_MS && now - this.lastKick > c.KICK_COOLDOWN_MS) {
          events.push({ type: 'kick', leg: i });
          this.lastKick = now;
        }
        st.up = kicking;
      });
    }

    // Fist shaking intensity.
    let shake = 0;
    for (const h of F.hands) {
      if (h.fistness < GESTURE.FIST_MIN - 0.1 || h.track.stale) continue;
      shake = Math.max(shake, ramp(pathSpeed(h.track, now, c.SHAKE_WINDOW_MS, aspect), c.SHAKE_LOW, c.SHAKE_HIGH));
    }
    this.shake += (shake - this.shake) * 0.35;

    return events;
  }
}
