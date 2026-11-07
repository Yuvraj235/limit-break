// Synthetic MediaPipe-style hands for the self-test. Built with simple finger kinematics so the
// geometry (curl ratios, hand size, wrist spacing) matches what the real model reports.

const MCP = [[-0.3, -0.93], [0, -1], [0.25, -0.92], [0.47, -0.8]];
const PHALANX = [[0.45, 0.27, 0.22], [0.5, 0.3, 0.23], [0.46, 0.28, 0.22], [0.36, 0.21, 0.2]];
const FLEX = [80, 95, 70];
const D = Math.PI / 180;

/**
 * @param {object} o
 * @param {number} o.cx  wrist x, normalized to frame width, already mirrored (player's view)
 * @param {number} o.cy  wrist y, normalized to frame height
 * @param {number} [o.size=0.16] wrist→middle knuckle, in frame heights
 * @param {number[]} [o.curls=[0,0,0,0]] per-finger flex 0..1
 * @param {number} [o.thumb=0] 0 = out, 1 = tucked
 * @param {number} [o.splay=0] fan the fingers apart, degrees between neighbours (🖐️ wide palm ≈ 8)
 * @param {number} [o.angle=0] in-plane rotation, degrees (0 = fingers up)
 * @param {boolean} [o.flip=false] mirror the hand (the other hand)
 * @param {number} [o.aspect=4/3]
 */
export function makeHand({ cx, cy, size = 0.16, curls = [0, 0, 0, 0], thumb = 0, splay = 0, angle = 0, flip = false, aspect = 4 / 3 }) {
  const local = [[0, 0, 0]]; // wrist
  const t = thumb;
  const thumbPts = [[-0.35, -0.25, 0], [-0.6 + 0.3 * t, -0.45 - 0.1 * t, -0.1 * t], [-0.78 + 0.5 * t, -0.65, -0.2 * t], [-0.9 + 0.65 * t, -0.85 + 0.15 * t, -0.3 * t]];
  local.push(...thumbPts);
  for (let f = 0; f < 4; f++) {
    let [x, y] = MCP[f];
    let z = 0;
    local.push([x, y, z]);
    let theta = 0;
    const phi = splay * (f - 1.2) * D; // finger direction in the palm plane
    for (let j = 0; j < 3; j++) {
      theta += FLEX[j] * curls[f] * D;
      const len = PHALANX[f][j];
      x += Math.sin(phi) * Math.cos(theta) * len;
      y += -Math.cos(phi) * Math.cos(theta) * len;
      z += -Math.sin(theta) * len;
      local.push([x, y, z]);
    }
  }
  const r = angle * D, c = Math.cos(r), s = Math.sin(r);
  return local.map(([x, y, z]) => {
    const lx = flip ? -x : x;
    const rx = lx * c - y * s, ry = lx * s + y * c;
    const hx = cx * aspect + rx * size;
    return { x: hx / aspect, y: cy + ry * size, z: (z * size) / aspect };
  });
}

export const OPEN = [0, 0, 0, 0];
export const FIST = [1, 1, 1, 1];
export const CLAW = [0.3, 0.3, 0.3, 0.3];
export const POINT = [0, 1, 1, 1];
export const PEACE = [0, 0, 1, 1];
export const RELAXED = [0.15, 0.2, 0.25, 0.3];

/** Wrap landmark arrays as the tracks frameFeatures() expects. */
export const asTracks = (...hands) => hands.map((lm, i) => ({ id: i + 1, lm, stale: false, hist: [], size: 0.16 }));
