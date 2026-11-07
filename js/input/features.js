import { GESTURE, MEDIAPIPE } from '../config.js';
import { calibration } from './calibration.js';
import { ramp } from '../core/math.js';

// Landmark indices: 0 wrist; fingers are [mcp, pip, dip, tip].
const FINGERS = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];

// Landmarks are normalized to the frame; x and z scale with width, y with height. Multiply x/z by the
// aspect ratio so every distance is in frame-heights.
const d3 = (a, b, k) => Math.hypot((a.x - b.x) * k, a.y - b.y, (a.z - b.z) * k);

export const handSize = (lm, aspect) => d3(lm[0], lm[9], aspect) || 1e-3;

/** Per-hand geometry. lm is mirrored (x grows to the player's right). */
export function handFeatures(lm, aspect, cfg = GESTURE) {
  const size = handSize(lm, aspect);
  const curls = FINGERS.map(([, pip, , tip]) => {
    const ratio = d3(lm[0], lm[tip], aspect) / (d3(lm[0], lm[pip], aspect) || 1e-3);
    return ramp(ratio, cfg.CURL_OPEN_RATIO, cfg.CURL_CLOSED_RATIO);
  });
  const fistness = (curls[0] + curls[1] + curls[2] + curls[3]) / 4;
  const point = ramp(curls[0], cfg.POINT_INDEX_MAX + 0.12, cfg.POINT_INDEX_MAX)
    * ramp(Math.min(curls[1], curls[2], curls[3]), cfg.POINT_OTHERS_MIN - 0.15, cfg.POINT_OTHERS_MIN + 0.05);
  const ids = [0, 5, 9, 13, 17];
  const palm = {
    x: ids.reduce((s, i) => s + lm[i].x, 0) / ids.length,
    y: ids.reduce((s, i) => s + lm[i].y, 0) / ids.length,
  };
  return {
    size,
    curls,
    fistness,
    openCount: curls.filter((c) => c < 0.35).length,
    point,
    // ✌️: index AND middle clearly straight, ring and pinky curled. The thumb is never counted, so a
    // finger-gun (index + thumb out) stays a point, not a two.
    peace: ramp(Math.max(curls[0], curls[1]), 0.34, 0.2) * ramp(Math.min(curls[2], curls[3]), 0.5, 0.7),
    spread: d3(lm[8], lm[20], aspect) / size,   // index tip ↔ pinky tip, in hand units (fingers fanned out = large)
    wrist: lm[0],
    palm,
    thumbOut: d3(lm[4], lm[5], aspect) / size,
  };
}

/**
 * What a single hand is doing, 0..1 per shape, from three opinions: finger geometry, Google's trained
 * gesture classifier (when the recognizer model is loaded) and the player's own recorded templates
 * (after calibration). Gestures in gestureDefs.js read these instead of raw geometry.
 */
export function handShape(h, gesture, cfg = GESTURE, tpl = null) {
  const open = ramp(h.fistness, cfg.OPEN_MAX + 0.1, cfg.OPEN_MAX - 0.08);
  const s = {
    fist: ramp(h.fistness, cfg.FIST_MIN - 0.12, cfg.FIST_MIN + 0.1) * (1 - h.point) * (1 - h.peace),
    point: h.point,
    peace: h.peace,
    open,
    wide: open * ramp(h.spread, cfg.SPREAD_MIN, cfg.SPREAD_FULL),
  };
  if (gesture && gesture.score > 0.5) {
    const g = gesture.score;
    const damp = (...keys) => { for (const k of keys) s[k] *= 1 - g; };
    switch (gesture.name) {
      case 'Closed_Fist': s.fist = Math.max(s.fist, g); damp('point', 'peace', 'open', 'wide'); break;
      case 'Thumb_Up': case 'Thumb_Down': if (h.point < 0.5) { s.fist = Math.max(s.fist, g * 0.9); damp('peace', 'open', 'wide'); } break;
      case 'Pointing_Up': s.point = Math.max(s.point, g); damp('peace', 'fist'); break;
      case 'Victory': s.peace = Math.max(s.peace, g); damp('point', 'fist'); break;
      case 'Open_Palm': s.open = Math.max(s.open, g); damp('fist', 'point', 'peace'); break;
      default: break;
    }
  }
  if (tpl) {
    // The player's own recorded shapes count when one clearly wins, and never overrule a confident
    // trained label that says something else.
    const ranked = Object.entries(tpl).sort((a, b) => b[1] - a[1]);
    const [best, sim] = ranked[0];
    const margin = sim - (ranked[1]?.[1] ?? 0);
    const ML = { Closed_Fist: 'fist', Pointing_Up: 'point', Victory: 'peace', Open_Palm: 'open' };
    const mlSays = gesture && gesture.score > 0.7 ? ML[gesture.name] : null;
    const clash = mlSays && mlSays !== best && !(mlSays === 'open' && best === 'wide');
    if (sim > 0.45 && margin > 0.2 && !clash) {
      for (const k of Object.keys(s)) if (k !== best && !(best === 'wide' && k === 'open')) s[k] *= 1 - 0.7 * sim;
      if (best !== 'open') s[best] = Math.max(s[best], 0.55 + 0.45 * sim);
      else s.wide *= 1 - 0.7 * sim;
    }
  }
  return s;
}

/**
 * Body features from MediaPipe Pose (33 raw landmarks): shoulder line and width, and each visible
 * leg's knee height and ankle reach. Distances are in shoulder-widths so they don't depend on how far
 * the player stands from the camera. Returns null when the shoulders aren't visible.
 */
export function bodyFeatures(raw, aspect, cfg = MEDIAPIPE) {
  if (!raw || raw.length < 29) return null;
  const vis = (i) => (raw[i].visibility ?? 1) >= cfg.POSE_MIN_VISIBILITY;
  const P = (i) => ({ x: 1 - raw[i].x, y: raw[i].y }); // mirrored like the hands
  if (!vis(11) || !vis(12)) return null;
  const a = P(11), b = P(12);
  const sw = Math.hypot((a.x - b.x) * aspect, a.y - b.y) || 1e-3;
  const legs = [];
  for (const [hip, knee, ankle] of [[23, 25, 27], [24, 26, 28]]) {
    if (!vis(hip) || !vis(knee)) { legs.push(null); continue; }
    const H = P(hip), K = P(knee);
    const A = vis(ankle) ? P(ankle) : null;
    legs.push({ kneeDrop: (K.y - H.y) / sw, reach: A ? (Math.abs(A.x - H.x) * aspect) / sw : 0 });
  }
  const eyes = [2, 5].filter(vis).map((i) => P(i).y);
  const eyeY = eyes.length ? eyes.reduce((s, y) => s + y, 0) / eyes.length : vis(0) ? P(0).y : (a.y + b.y) / 2 - sw * 0.55;
  const shoulderY = (a.y + b.y) / 2;
  const framing = sw > cfg.FRAME_TOO_CLOSE_SW || shoulderY > cfg.FRAME_TOO_CLOSE_Y ? 'close' : sw < cfg.FRAME_TOO_FAR_SW ? 'far' : 'good';
  return { shoulderY, eyeY, sw, legs, framing, points: raw.map((p) => ({ x: 1 - p.x, y: p.y, v: p.visibility ?? 1 })) };
}

/** How far a palm is above the eyes, in shoulder-widths (positive = above). */
export function raiseOfBody(palmY, body) {
  return (body.eyeY - palmY) / body.sw;
}

/** Features for the whole frame: every hand plus two-hand relations (and the body, when tracked). */
export function frameFeatures(tracks, aspect, cfg = GESTURE, body = null) {
  const hands = tracks.filter((t) => !t.resting).map((t) => {
    const h = { ...handFeatures(t.lm, aspect, cfg), track: t };
    h.shape = handShape(h, t.gesture, cfg, calibration.match(h));
    return h;
  });
  let pair = null;
  if (hands.length >= 2) {
    const [a, b] = hands;
    const avgSize = (a.size + b.size) / 2;
    // Heights use the palm centre, not the wrist: with hands raised, real wrists sit well below the fingers.
    pair = {
      avgSize,
      wristDist: Math.hypot((a.wrist.x - b.wrist.x) * aspect, a.wrist.y - b.wrist.y) / avgSize,
      avgY: (a.palm.y + b.palm.y) / 2,
      lowY: Math.max(a.palm.y, b.palm.y),     // the lower palm (larger y)
      highY: Math.min(a.palm.y, b.palm.y),
      cx: (a.palm.x + b.palm.x) / 2,
      cy: (a.palm.y + b.palm.y) / 2,
    };
  }
  return { count: hands.length, hands, pair, aspect, body };
}
