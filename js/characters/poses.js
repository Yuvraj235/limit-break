import { TIMING } from '../config.js';

const FAST = TIMING.POSE_FAST, SLOW = TIMING.POSE_SLOW;

/** Shared humanoid pose library (see BASE_POSE in rig.js for the angle conventions). */
export const HUMAN_POSES = {
  idle: { lean: 6, head: -4, aF: 52, eF: 88, aB: 32, eB: 98, hF: 24, kF: -34, fF: 10, hB: -20, kB: -24, fB: 8, expr: 'focus', bob: 2.2 },
  stand: { lean: 0, head: 0, aF: 6, eF: 14, aB: -6, eB: 12, hF: 6, kF: -6, fF: 2, hB: -6, kB: -4, handF: 'open', handB: 'open', expr: 'calm', stiff: SLOW },
  guard: { lean: 12, head: -10, aF: 72, eF: 122, aB: 86, eB: 108, hF: 26, kF: -42, hB: -22, kB: -30, expr: 'strain', stiff: FAST },
  kame_charge: { lean: -10, head: 10, aF: -42, eF: 74, wF: 24, aB: -52, eB: 64, wB: 24, hF: 38, kF: -58, fF: 14, hB: -30, kB: -38, handF: 'claw', handB: 'claw', expr: 'strain' },
  kame_fire: { lean: 14, head: -6, aF: 92, eF: 2, wF: -78, aB: 88, eB: 6, wB: -78, hF: 42, kF: -42, fF: 10, hB: -36, kB: -22, handF: 'open', handB: 'open', expr: 'shout', stiff: FAST },
  spirit_raise: { lean: -4, head: -22, aF: 168, eF: 6, wF: -8, aB: 162, eB: 10, wB: -8, hF: 12, kF: -14, hB: -10, kB: -8, handF: 'open', handB: 'open', expr: 'focus', stiff: SLOW },
  spirit_throw: { lean: 20, head: 4, aF: 112, eF: 10, wF: -30, aB: 100, eB: 16, wB: -30, hF: 46, kF: -52, hB: -40, kB: -16, handF: 'open', handB: 'open', expr: 'shout', stiff: FAST },
  powerup: { lean: -6, head: -24, aF: 22, eF: 42, aB: 16, eB: 48, hF: 32, kF: -48, fF: 12, hB: -30, kB: -38, fB: 10, expr: 'shout', stiff: SLOW },
  kiblast: { lean: 8, head: -4, aF: 90, eF: 2, wF: -72, aB: 40, eB: 92, hF: 26, kF: -32, hB: -22, kB: -24, handF: 'open', handB: 'fist', expr: 'focus', stiff: FAST },
  kiblast2: { lean: 10, head: -4, aF: 40, eF: 92, aB: 90, eB: 2, wB: -72, hF: 26, kF: -32, hB: -22, kB: -24, handF: 'fist', handB: 'open', expr: 'shout', stiff: FAST },
  hit: { lean: -24, head: 18, aF: -28, eF: 42, aB: -46, eB: 32, hF: -6, kF: -22, hB: -30, kB: -12, dx: -10, handF: 'open', handB: 'open', expr: 'hurt', stiff: FAST },
  knockdown: { lean: -6, head: 10, aF: 150, eF: 20, aB: 120, eB: 30, hF: 10, kF: -10, hB: -4, kB: -6, rot: -84, lift: 16, handF: 'open', handB: 'open', expr: 'hurt' },
  getup: { lean: 40, head: 10, aF: 60, eF: 30, aB: 40, eB: 30, hF: 95, kF: -110, hB: -10, kB: -100, expr: 'strain', stiff: SLOW },
  dodge: { lean: -16, head: 10, aF: -22, eF: 62, aB: -32, eB: 52, hF: 32, kF: -62, hB: -12, kB: -52, lift: 26, handF: 'open', handB: 'open', expr: 'focus', stiff: FAST },
  victory: { lean: 2, head: -10, aF: 174, eF: 10, aB: -8, eB: 30, hF: 8, kF: -6, hB: -6, kB: -4, handF: 'fist', handB: 'fist', expr: 'smirk', stiff: SLOW },
  defeat: { lean: 32, head: 30, aF: 22, eF: 10, aB: 12, eB: 22, hF: 92, kF: -98, hB: -14, kB: -96, handF: 'open', handB: 'open', expr: 'hurt', stiff: SLOW },
  ui_stance: { lean: 4, head: -2, aF: 42, eF: 52, wF: -32, aB: -18, eB: 26, hF: 12, kF: -16, hB: -10, kB: -10, lift: 8, handF: 'open', handB: 'open', expr: 'calm', stiff: SLOW },
  rush: { lean: 36, head: -16, aF: 82, eF: 10, aB: -42, eB: 62, hF: 62, kF: -32, hB: -52, kB: -52, lift: 26, expr: 'shout', stiff: FAST },
  punch: { lean: 22, head: -4, aF: 96, eF: 0, aB: -22, eB: 82, hF: 42, kF: -42, hB: -36, kB: -16, expr: 'shout', stiff: FAST },
  punch2: { lean: 24, head: -4, aF: -20, eF: 80, aB: 96, eB: 0, hF: 42, kF: -42, hB: -36, kB: -16, expr: 'shout', stiff: FAST },
  kick: { lean: -14, head: -4, aF: 30, eF: 80, aB: 20, eB: 90, hF: 105, kF: -6, fF: -20, hB: -8, kB: -10, expr: 'shout', stiff: FAST },
  telegraph: { lean: -12, head: 4, aF: -62, eF: 92, aB: 30, eB: 92, hF: 28, kF: -48, hB: -26, kB: -36, expr: 'shout', stiff: SLOW },
  cast: { lean: -2, head: -6, aF: 162, eF: 10, wF: -20, aB: 12, eB: 30, hF: 12, kF: -12, hB: -8, kB: -8, handF: 'open', handB: 'fist', expr: 'smirk', stiff: SLOW },
  point: { lean: 4, head: -2, aF: 88, eF: 0, wF: 0, aB: -12, eB: 22, hF: 10, kF: -10, hB: -8, kB: -6, handF: 'point', handB: 'fist', expr: 'smirk', stiff: SLOW },
  beam_charge: { lean: -6, head: 2, aF: 60, eF: 20, wF: -60, aB: 50, eB: 30, wB: -60, hF: 34, kF: -46, hB: -28, kB: -34, handF: 'claw', handB: 'claw', expr: 'strain', stiff: SLOW },
  fall: { lean: -30, head: 30, aF: 160, eF: 30, aB: 120, eB: 40, hF: 40, kF: -60, hB: -30, kB: -50, handF: 'open', handB: 'open', expr: 'hurt' },
};
