import { GESTURE, SMOOTHING, MOTION } from '../js/config.js';
import { frameFeatures, handFeatures } from '../js/input/features.js';
import { scoreGestures, gestureIntensity, GESTURE_IDS, G } from '../js/input/gestureDefs.js';
import { GestureStateMachine } from '../js/input/gestureState.js';
import { MotionDetector } from '../js/input/motionGestures.js';
import { HandTracks } from '../js/input/tracks.js';
import { calibration, shapeVector } from '../js/input/calibration.js';
import { makeHand, asTracks, OPEN, FIST, CLAW, POINT, PEACE, RELAXED } from './fixtures.js';

const A = 4 / 3;
const F = (...hands) => frameFeatures(asTracks(...hands), A, GESTURE);
const S = (...hands) => scoreGestures(F(...hands), GESTURE);
const top = (scores) => Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
const fmt = (s) => Object.entries(s).map(([k, v]) => `${k}:${v.toFixed(2)}`).join(' ');

export function gestureTests(t) {
  t.group('Hand features');
  const open = handFeatures(makeHand({ cx: 0.5, cy: 0.6, curls: OPEN }), A);
  t.ok('open hand reads open', open.fistness < 0.1 && open.openCount === 4, `fistness ${open.fistness.toFixed(2)}`);
  const fist = handFeatures(makeHand({ cx: 0.5, cy: 0.6, curls: FIST, thumb: 1 }), A);
  t.ok('fist reads closed', fist.fistness > 0.85, `fistness ${fist.fistness.toFixed(2)}`);
  const claw = handFeatures(makeHand({ cx: 0.5, cy: 0.6, curls: CLAW }), A);
  t.ok('Kamehameha claw is not a fist', claw.fistness < 0.45, `fistness ${claw.fistness.toFixed(2)}`);
  const point = handFeatures(makeHand({ cx: 0.5, cy: 0.6, curls: POINT, thumb: 1 }), A);
  t.ok('pointing detected', point.point > 0.9, `point ${point.point.toFixed(2)}`);
  const rotated = handFeatures(makeHand({ cx: 0.5, cy: 0.6, curls: FIST, thumb: 1, angle: 70 }), A);
  t.ok('fist detection survives hand rotation', rotated.fistness > 0.85, `fistness ${rotated.fistness.toFixed(2)}`);
  const far = handFeatures(makeHand({ cx: 0.5, cy: 0.6, size: 0.07, curls: FIST, thumb: 1 }), A);
  t.ok('fist detection is scale invariant (far from camera)', far.fistness > 0.85, `fistness ${far.fistness.toFixed(2)}`);

  t.group('Pose classification');
  const W = 16; // splay for a deliberately fanned 🖐️ palm (index↔pinky ≈ 1.5 hand units, as measured on a real webcam)
  const cases = [
    ['single relaxed open hand → Neutral Stance', () => S(makeHand({ cx: 0.5, cy: 0.7, curls: OPEN })), null],
    ['✊ single fist → Power Up', () => S(makeHand({ cx: 0.5, cy: 0.65, curls: FIST, thumb: 1 })), G.POWER],
    ['✊ two fists → Power Up', () => S(makeHand({ cx: 0.3, cy: 0.7, curls: FIST, thumb: 1 }), makeHand({ cx: 0.7, cy: 0.7, curls: FIST, thumb: 1, flip: true })), G.POWER],
    ['👉 pointing → Ki Blast', () => S(makeHand({ cx: 0.6, cy: 0.55, curls: POINT, thumb: 1, angle: 60 })), G.KIBLAST],
    ['✌️ two-finger sign → Instant Transmission', () => S(makeHand({ cx: 0.55, cy: 0.62, curls: PEACE, thumb: 1, splay: 6 })), G.TELEPORT],
    ['✌️ survives a tilted hand', () => S(makeHand({ cx: 0.55, cy: 0.62, curls: PEACE, thumb: 1, splay: 6, angle: -35 })), G.TELEPORT],
    ['👐 claws together at chest → Ultimate Beam', () => S(makeHand({ cx: 0.47, cy: 0.68, curls: CLAW, angle: 20 }), makeHand({ cx: 0.53, cy: 0.7, curls: CLAW, angle: -20, flip: true })), G.KAME],
    ['👐 fanned palms with wrists together → Ultimate Beam, not Barrier', () => S(makeHand({ cx: 0.46, cy: 0.75, curls: OPEN, splay: W }), makeHand({ cx: 0.54, cy: 0.75, curls: OPEN, splay: W, flip: true })), G.KAME],
    ['🙌 open palms raised high → Spirit Bomb', () => S(makeHand({ cx: 0.33, cy: 0.2, curls: OPEN }), makeHand({ cx: 0.67, cy: 0.22, curls: OPEN, flip: true })), G.SPIRIT],
    ['🙌 one raised hand is never a Spirit Bomb (fanned palm → Barrier)', () => S(makeHand({ cx: 0.6, cy: 0.18, curls: OPEN, splay: W })), G.GUARD],
    ['one relaxed open hand raised → Neutral Stance', () => S(makeHand({ cx: 0.6, cy: 0.18, curls: OPEN })), null],
    ['🖐️ one wide palm at chest → Energy Barrier', () => S(makeHand({ cx: 0.55, cy: 0.72, curls: OPEN, splay: W })), G.GUARD],
    ['🖐️ two wide palms apart → Energy Barrier', () => S(makeHand({ cx: 0.28, cy: 0.72, curls: OPEN, splay: W }), makeHand({ cx: 0.72, cy: 0.72, curls: OPEN, splay: W, flip: true })), G.GUARD],
    ['🥋 relaxed hands mid-distance → Neutral Stance', () => S(makeHand({ cx: 0.4, cy: 0.75, curls: RELAXED }), makeHand({ cx: 0.6, cy: 0.75, curls: RELAXED, flip: true })), null],
  ];
  for (const [name, run, expect] of cases) {
    const scores = run();
    const [id, val] = top(scores);
    if (expect === null) t.ok(name, val < SMOOTHING.ENTER, fmt(scores));
    else {
      const second = Object.entries(scores).filter(([k]) => k !== expect).reduce((m, [, v]) => Math.max(m, v), 0);
      t.ok(name, id === expect && val > 0.8 && second < SMOOTHING.EXIT, fmt(scores));
    }
  }
  {
    // With body tracking, "raised" is judged against the shoulders, wherever the player sits.
    const body = (shoulderY) => ({ shoulderY, eyeY: shoulderY - 0.18, sw: 0.3, legs: [], framing: 'good' });
    const Sb = (b, ...hands) => scoreGestures(frameFeatures(asTracks(...hands), A, GESTURE, b), GESTURE);
    const palmsAt = (cy) => [makeHand({ cx: 0.33, cy, curls: OPEN }), makeHand({ cx: 0.67, cy, curls: OPEN, flip: true })];
    const high = Sb(body(0.7), ...palmsAt(0.5)), shoulder = Sb(body(0.62), ...palmsAt(0.66));
    t.ok('body tracked: both palms well above the shoulders → Spirit Bomb', high.spirit > 0.9, fmt(high));
    t.ok('body tracked: palms at shoulder height → not a Spirit Bomb', shoulder.spirit < 0.2, fmt(shoulder));
    const face = Sb({ shoulderY: 0.95, eyeY: 0.45, sw: 0.75, legs: [], framing: 'close' }, ...palmsAt(0.6)); // real close-up numbers
    t.ok('sitting close to the camera: open hands in front of the face are not "raised"', face.spirit < 0.2, fmt(face));
  }
  {
    // 👉👈 the Fusion Dance's finish: index fingertips touching
    const touch = S(makeHand({ cx: 0.28, cy: 0.62, curls: POINT, thumb: 1, angle: 90 }), makeHand({ cx: 0.72, cy: 0.62, curls: POINT, thumb: 1, angle: -90, flip: true }));
    const apart = S(makeHand({ cx: 0.2, cy: 0.62, curls: POINT, thumb: 1, angle: 20 }), makeHand({ cx: 0.8, cy: 0.62, curls: POINT, thumb: 1, angle: -20, flip: true }));
    t.ok('👉👈 index fingertips touching → Fusion', touch.fuse > 0.8 && touch.kiblast < 0.3, fmt(touch));
    t.ok('two pointing hands far apart → Ki Blast, not Fusion', apart.kiblast > 0.8 && apart.fuse < 0.2, fmt(apart));
  }
  const twoFists = F(makeHand({ cx: 0.3, cy: 0.7, curls: FIST, thumb: 1 }), makeHand({ cx: 0.7, cy: 0.7, curls: FIST, thumb: 1, flip: true }));
  t.ok('two fists give full power-up intensity', gestureIntensity(G.POWER, twoFists, GESTURE) === 1);

  t.group('Debounce state machine');
  const raw = (id) => Object.fromEntries(GESTURE_IDS.map((g) => [g, g === id ? 1 : 0]));
  {
    const sm = new GestureStateMachine(GESTURE_IDS);
    let frame = 0, at = -1;
    for (; frame < 6; frame++) { sm.update(raw(G.KAME), 1000 + frame * 33); if (sm.current === G.KAME && at < 0) at = frame + 1; }
    t.ok('sustained pose switches within 3 frames (≤100 ms)', at > 0 && at <= 3, `switched on frame ${at}`);
  }
  {
    const sm = new GestureStateMachine(GESTURE_IDS);
    sm.update(raw(G.POWER), 1000);
    for (let i = 1; i < 6; i++) sm.update(raw(null), 1000 + i * 33);
    t.ok('single-frame spike is ignored', sm.current === G.IDLE);
  }
  {
    const sm = new GestureStateMachine(GESTURE_IDS);
    for (let i = 0; i < 8; i++) sm.update(raw(G.KAME), 1000 + i * 33);
    sm.update(raw(null), 1300); sm.update(raw(null), 1333);
    const held = sm.current === G.KAME;
    sm.update(raw(G.KAME), 1366);
    t.ok('two dropped frames do not end a held pose', held && sm.current === G.KAME);
  }
  {
    const sm = new GestureStateMachine(GESTURE_IDS);
    let switches = 0, prev = sm.current;
    for (let i = 0; i < 30; i++) {
      sm.update(raw(i % 2 ? G.KAME : G.GUARD), 1000 + i * 33);
      if (sm.current !== prev) { switches++; prev = sm.current; }
    }
    t.ok('alternating noisy input does not flicker', switches <= 2, `${switches} switches in 30 frames`);
  }

  t.group('Motion gestures');
  {
    const md = new MotionDetector(MOTION);
    const lm = makeHand({ cx: 0.5, cy: 0.6, curls: OPEN });
    const tr = { id: 1, born: 0, stale: false, lm, size: 0.16, hist: [] };
    let events = [];
    for (let i = 0; i <= 8; i++) {
      const now = 1000 + i * 33;
      tr.hist.push({ t: now, x: 0.3 + i * 0.06, y: 0.6, size: 0.16 });
      tr.lm = makeHand({ cx: 0.3 + i * 0.06, cy: 0.6, curls: OPEN });
      events = events.concat(md.update([tr], frameFeatures([tr], A), G.IDLE, now, A));
    }
    const dodge = events.find((e) => e.type === 'dodge');
    t.ok('fast sideways swipe → dodge to the right', dodge && dodge.dir === 1, JSON.stringify(events));
  }
  {
    const md = new MotionDetector(MOTION);
    const tr = { id: 1, born: 0, stale: false, lm: makeHand({ cx: 0.5, cy: 0.6 }), size: 0.16, hist: [] };
    let events = [];
    for (let i = 0; i <= 8; i++) {
      const now = 1000 + i * 33;
      tr.hist.push({ t: now, x: 0.5 + i * 0.004, y: 0.6, size: 0.16 });
      events = events.concat(md.update([tr], frameFeatures([tr], A), G.IDLE, now, A));
    }
    t.ok('slow drift does not dodge', !events.some((e) => e.type === 'dodge'));
  }
  {
    const md = new MotionDetector(MOTION);
    const mk = (x, size) => ({ id: x, born: 0, stale: false, lm: makeHand({ cx: x, cy: 0.7, curls: CLAW, size }), size, hist: [] });
    const a = mk(0.47, 0.15), b = mk(0.53, 0.15);
    let events = [];
    for (let i = 0; i <= 8; i++) {
      const now = 1000 + i * 33;
      const size = 0.15 * (1 + i * 0.03);
      for (const tr of [a, b]) { tr.size = size; tr.hist.push({ t: now, x: tr.id, y: 0.7, size }); }
      events = events.concat(md.update([a, b], frameFeatures([a, b], A), G.KAME, now, A));
    }
    t.ok('hands growing in frame during Kamehameha → push (fire)', events.some((e) => e.type === 'push'), JSON.stringify(events));
  }
  {
    const md = new MotionDetector(MOTION);
    const tr = { id: 1, born: 0, stale: false, lm: makeHand({ cx: 0.5, cy: 0.5, curls: FIST, thumb: 1 }), size: 0.15, hist: [] };
    let events = [];
    for (let i = 0; i <= 12; i++) {
      const now = 1000 + i * 33;
      const size = i < 8 ? 0.15 : 0.15 * (1 + (i - 7) * 0.08); // still, then a jab toward the camera
      tr.size = size;
      tr.lm = makeHand({ cx: 0.5, cy: 0.5, curls: FIST, thumb: 1, size });
      tr.hist.push({ t: now, x: tr.lm[0].x, y: tr.lm[0].y, size });
      events = events.concat(md.update([tr], frameFeatures([tr], A), G.POWER, now, A));
    }
    t.ok('✊ fist jabbed toward the camera → punch', events.filter((e) => e.type === 'punch').length === 1, JSON.stringify(events));
  }
  {
    const md = new MotionDetector(MOTION);
    const tr = { id: 1, born: 0, stale: false, lm: null, size: 0.15, hist: [] };
    let events = [];
    for (let i = 0; i <= 30; i++) {
      const now = 1000 + i * 33;
      const x = 0.5 + Math.sin(i * 1.3) * 0.03; // shaking fists to power up
      tr.lm = makeHand({ cx: x, cy: 0.5, curls: FIST, thumb: 1 });
      tr.hist.push({ t: now, x: tr.lm[0].x, y: tr.lm[0].y, size: 0.15 });
      events = events.concat(md.update([tr], frameFeatures([tr], A), G.POWER, now, A));
    }
    t.ok('shaking fists (power-up) is not punching', !events.some((e) => e.type === 'punch' || e.type === 'dodge'), JSON.stringify(events));
  }
  {
    const run = (drops) => {
      const md = new MotionDetector(MOTION);
      let events = [];
      drops.forEach((kneeDrop, i) => {
        const body = { shoulderY: 0.3, sw: 0.2, legs: [{ kneeDrop, reach: 0.2 }, { kneeDrop: 1.1, reach: 0.2 }] };
        events = events.concat(md.update([], frameFeatures([], A, GESTURE, body), G.IDLE, 1000 + i * 33, A));
      });
      return events.filter((e) => e.type === 'kick').length;
    };
    t.ok('🦵 standing, then a knee lifted to hip height → one kick', run([...Array(15).fill(1.1), ...Array(10).fill(0.3), ...Array(10).fill(1.1)]) === 1);
    t.ok('sitting (knees always at hip height) never kicks', run(Array(40).fill(0.2)) === 0);
  }

  t.group('Hand shape (thumb, resting hands, personal templates)');
  {
    const gun = S(makeHand({ cx: 0.55, cy: 0.6, curls: POINT, thumb: 0 }));
    t.ok('👉 pointing with the thumb out is still a point, never ✌️', gun.kiblast > 0.8 && gun.teleport < 0.1, fmt(gun));
    const rest = new HandTracks();
    for (let i = 0; i < 4; i++) rest.update([{ landmarks: makeHand({ cx: 0.5, cy: 0.97, curls: FIST, thumb: 1 }), handedness: '?' }], A, 1000 + i * 33);
    const Fr = frameFeatures(rest.tracks, A);
    t.ok('a hand resting at the bottom edge is ignored', Fr.count === 0, `hands ${Fr.count}`);
    // Personal templates: record a "relaxed" open hand that geometry alone might call wide, then check it reads neutral.
    const relaxed = Array.from({ length: 12 }, (_, i) => shapeVector(handFeatures(makeHand({ cx: 0.5, cy: 0.7, curls: [0.05, 0.05, 0.1, 0.12], splay: 16 + (i % 3) }), A)));
    const fist = Array.from({ length: 12 }, () => shapeVector(handFeatures(makeHand({ cx: 0.5, cy: 0.7, curls: FIST, thumb: 1 }), A)));
    const wide = Array.from({ length: 12 }, (_, i) => shapeVector(handFeatures(makeHand({ cx: 0.5, cy: 0.7, curls: OPEN, splay: 26 + (i % 3) }), A)));
    const saved = calibration.templates;
    calibration.saveTemplates({ open: relaxed, fist, wide });
    const mine = S(makeHand({ cx: 0.5, cy: 0.7, curls: [0.05, 0.05, 0.1, 0.12], splay: 17 }));
    const myWide = S(makeHand({ cx: 0.5, cy: 0.7, curls: OPEN, splay: 27 }));
    calibration.templates = saved;
    t.ok('after calibration, YOUR relaxed hand reads neutral and YOUR wide palm reads barrier', mine.guard < 0.4 && myWide.guard > 0.8, `relaxed ${fmt(mine)} · wide ${fmt(myWide)}`);
    // A bad recording (✌️ captured identical to 👉) must be thrown out, not trusted.
    const pointVecs = Array.from({ length: 12 }, () => shapeVector(handFeatures(makeHand({ cx: 0.5, cy: 0.7, curls: POINT, thumb: 1 }), A)));
    calibration.saveTemplates({ point: pointVecs, peace: pointVecs, fist });
    const dropped = !calibration.templates?.point && !calibration.templates?.peace;
    calibration.templates = saved;
    t.ok('look-alike recordings (✌️ saved identical to 👉) are discarded', dropped, JSON.stringify(calibration.conflicts));
  }

  t.group('Hand tracking');
  {
    // Two hands meet for a beam; MediaPipe then only reports one. The hidden one must be kept.
    const tracks = new HandTracks();
    const raw = (...xs) => xs.map((x) => ({ landmarks: makeHand({ cx: x, cy: 0.7, curls: CLAW }), handedness: '?' }));
    for (let i = 0; i < 5; i++) tracks.update(raw(0.47, 0.53), A, 1000 + i * 33);
    let kept = true;
    for (let i = 5; i < 28; i++) kept = kept && tracks.update(raw(0.47), A, 1000 + i * 33).length === 2;
    t.ok('a hand hidden behind the other is kept while they stay together', kept);
    let released = false;
    for (let i = 40; i < 80; i++) released = released || tracks.update(raw(0.47), A, 1000 + i * 33).length === 1;
    t.ok('…but not forever (a lowered hand is let go within ~1 s)', released);
    const far = new HandTracks();
    for (let i = 0; i < 5; i++) far.update(raw(0.2, 0.8), A, 1000 + i * 33);
    let n = 0;
    for (let i = 5; i < 30; i++) n = far.update(raw(0.2), A, 1000 + i * 33).length;
    t.ok('a hand that leaves the frame on its own is dropped quickly', n === 1);
  }
}
