// Personal hand calibration. Records the player's own relaxed hand, fist, point, ✌️ and wide palm,
// plus chest-height and raised hand positions, then saves them (input/calibration.js). Gesture
// recognition then matches against these templates, so it fits this player's hands and camera.
import { calibration, shapeVector } from '../input/calibration.js';
import { raiseOfBody } from '../input/features.js';

const FRAMING_TEXT = { close: '📏 Too close: sit back until both hands fit', far: '📏 Too far: come a little closer', good: '✅ Distance is good' };

const STEPS = [
  { shape: 'open', icon: '🥋', text: 'Hold ONE hand up, relaxed and open (fingers loose)' },
  { shape: 'fist', icon: '✊', text: 'Make a FIST' },
  { shape: 'point', icon: '👉', text: 'POINT one finger, the way you naturally do (thumb in or out)' },
  { shape: 'peace', icon: '✌️', text: 'TWO fingers up' },
  { shape: 'wide', icon: '🖐️', text: 'Palm to the camera, fingers spread as WIDE as you can' },
  { height: 'chest', icon: '👐', text: 'BOTH hands open, in front of your chest' },
  { height: 'raised', icon: '🙌', text: 'BOTH hands open, raised above your head' },
];
/** Does this hand plausibly show the requested shape? Frames that don't are not recorded. */
const FITS = {
  open: (h) => h.fistness < 0.45 && h.shape.point < 0.5 && h.shape.peace < 0.5,
  fist: (h) => h.fistness > 0.55 || h.track.gesture?.name === 'Closed_Fist',
  point: (h) => h.curls[0] < 0.4 && Math.min(h.curls[2], h.curls[3]) > 0.5 && h.track.gesture?.name !== 'Victory',
  peace: (h) => (h.curls[0] < 0.45 && h.curls[1] < 0.45 && Math.min(h.curls[2], h.curls[3]) > 0.45) || (h.track.gesture?.name === 'Victory' && h.track.gesture.score > 0.6),
  wide: (h) => h.fistness < 0.3,
};
const READY_MS = 2200;
const CAPTURE_MS = 2600;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runHandCalibration(app) {
  const cam = app.cameraInput;
  const root = document.getElementById('app');
  const box = document.createElement('div');
  box.className = 'calib';
  root.appendChild(box);
  root.classList.add('calibrating');
  const show = (html) => { box.innerHTML = html; };
  const cancel = { on: false };
  const close = () => { root.classList.remove('calibrating'); box.remove(); };

  try {
    if (!cam.camera.live) await app.enableCamera();
    for (let i = 0; i < 40 && cam.status !== 'tracking'; i++) {
      show(`<h2>Hand calibration</h2><p>Waiting for the camera… (${cam.status})</p>`);
      await wait(250);
    }
    if (cam.status !== 'tracking') {
      show('<h2>Hand calibration</h2><p>The camera isn\'t available, so there\'s nothing to calibrate. Allow camera access and try again.</p><button class="btn" data-x>OK</button>');
      await new Promise((r) => box.querySelector('[data-x]').addEventListener('click', r));
      return null;
    }

    const shapes = {};
    const heights = {};
    for (let i = 0; i < STEPS.length && !cancel.on; i++) {
      const step = STEPS[i];
      const head = `<div class="calib-step">Step ${i + 1} of ${STEPS.length}</div><div class="calib-icon">${step.icon}</div><div class="calib-text">${step.text}</div>`;
      for (let t = READY_MS; t > 0; t -= 100) {
        const fr = cam.F?.body?.framing;
        show(`${head}<div class="calib-sub">Get ready… ${Math.ceil(t / 1000)}</div>${fr ? `<div class="calib-sub ${fr === 'good' ? 'ok' : 'warn'}">${FRAMING_TEXT[fr]}</div>` : ''}`);
        await wait(100);
      }
      const got = [];
      let rejected = 0;
      const t0 = performance.now();
      let lastF = null;
      while (performance.now() - t0 < CAPTURE_MS) {
        const F = cam.F;
        if (F && F !== lastF) {
          lastF = F;
          if (step.shape && F.hands.length) {
            const h = F.hands.reduce((a, b) => (b.size > a.size ? b : a)); // the hand nearest the camera
            if (FITS[step.shape](h)) got.push(shapeVector(h)); else rejected++;
          } else if (step.height && F.hands.length >= 2) {
            const [a, b] = F.hands;
            const y = (a.palm.y + b.palm.y) / 2;
            got.push({ y, rel: F.body ? raiseOfBody(y, F.body) : null });
          }
        }
        const k = (performance.now() - t0) / CAPTURE_MS;
        const need = step.height ? 'both hands' : 'your hand';
        const fr = cam.F?.body?.framing;
        show(`${head}<div class="calib-bar"><i style="width:${Math.round(k * 100)}%"></i></div>`
          + `<div class="calib-sub ${got.length ? 'ok' : 'warn'}">${got.length ? `Recording… ${got.length} frames` : rejected ? `Not matching yet: make it exactly like the prompt` : `Show ${need} to the camera`}</div>`
          + (fr ? `<div class="calib-sub ${fr === 'good' ? 'ok' : 'warn'}">${FRAMING_TEXT[fr]}</div>` : ''));
        await wait(40);
      }
      if (step.shape) shapes[step.shape] = got;
      else heights[step.height] = got;
    }

    // Save shapes, then the "hands raised" line (frame-based and, when the body is tracked, shoulder-based).
    calibration.saveTemplates(shapes);
    const avg = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
    const chest = heights.chest || [], raised = heights.raised || [];
    if (chest.length > 4 && raised.length > 4) {
      calibration.save(avg(chest.map((h) => h.y)), avg(raised.map((h) => h.y)));
      const cr = chest.filter((h) => h.rel != null), rr = raised.filter((h) => h.rel != null);
      if (cr.length > 4 && rr.length > 4) calibration.saveBody(avg(cr.map((h) => h.rel)), avg(rr.map((h) => h.rel)));
    }

    // Self-check: how cleanly do the recorded shapes separate from each other?
    const rows = Object.entries(shapes).map(([shape, vecs]) => {
      if (vecs.length < 5) return { shape, rate: null };
      const ok = vecs.filter((v) => {
        const sims = calibration.matchVector(v);
        return sims && Object.entries(sims).sort((a, b) => b[1] - a[1])[0][0] === shape;
      }).length;
      return { shape, rate: ok / vecs.length };
    });
    const icon = Object.fromEntries(STEPS.filter((s) => s.shape).map((s) => [s.shape, s.icon]));
    // Best effort: log the result to the dev server (tools/devserver.py, also reached through the phone
    // tunnel) so it can be reviewed. Static hosts like GitHub Pages have no such endpoint, so skip it there.
    if (/^(localhost|127\.0\.0\.1|\[::1\])$|\.trycloudflare\.com$/.test(location.hostname)) fetch('/__report', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ at: Date.now(), kind: 'calibration', rows, frames: Object.fromEntries(Object.entries(shapes).map(([k, v]) => [k, v.length])),
        templates: calibration.templates && Object.fromEntries(Object.entries(calibration.templates).map(([k, t]) => [k, t.mean.map((x) => Math.round(x * 100) / 100)])),
        heights: { chest: chest.length, raised: raised.length, raiseY: calibration.raiseY, raiseBody: calibration.raiseBody } }]),
    }).catch(() => {});
    const dropped = new Set((calibration.conflicts || []).flat());
    for (const r of rows) if (dropped.has(r.shape)) r.rate = 0;
    const weak = rows.filter((r) => r.rate == null || r.rate < 0.8);
    show(`<h2>Calibration saved</h2>
      <div class="calib-results">${rows.map((r) => `<div class="${r.rate == null || r.rate < 0.8 ? 'warn' : 'ok'}">${icon[r.shape]} ${r.rate == null ? 'not seen' : `${Math.round(r.rate * 100)}%`}</div>`).join('')}
      <div class="${heights.raised?.length > 4 ? 'ok' : 'warn'}">🙌 raise line ${heights.raised?.length > 4 ? 'set' : 'not set'}</div></div>
      <p class="calib-sub">${rows.every((r) => r.rate == null) ? 'Your hands weren\'t visible, so nothing was saved. Sit back until both hands fit in the preview, then recalibrate.'
        : weak.length ? `Yellow shapes were missed or looked too similar to another one${dropped.size ? ` (${[...dropped].map((s) => icon[s]).join(' ')} came out alike)` : ''}, so the game uses its built-in detection for them. Recalibrate to try again.`
          : 'Every shape is clearly distinct. The game now reads gestures against your own hands.'}</p>
      <div class="menu row"><button class="btn primary" data-x>Done</button><button class="btn" data-again>Recalibrate</button></div>`);
    const again = await new Promise((r) => {
      box.querySelector('[data-x]').addEventListener('click', () => r(false));
      box.querySelector('[data-again]').addEventListener('click', () => r(true));
    });
    if (again) { close(); return runHandCalibration(app); }
    return rows;
  } finally {
    close();
  }
}
