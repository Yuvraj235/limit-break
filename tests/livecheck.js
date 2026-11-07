// Live gesture check for a real person on a real webcam. Open the game with ?check
// (http://localhost:8000/?check). An on-screen guide walks through each gesture; what the camera
// pipeline sees is posted to the dev server (POST /__report, see tools/devserver.py), which appends
// it to a local file so the numbers can be read from a terminal while you play. Nothing leaves the
// machine: reports go to the same server that serves the game.

// [expected pose or motion, prompt, motion target]. Motion steps (punch, kick) count events instead of frames.
const STEPS = [
  ['idle', '🥋 Lower your hands out of view'],
  ['power', '✊ Make a fist and hold it'],
  ['punch', '✊ Jab your fist toward the camera, 3 times', 3],
  ['kiblast', '👉 Point one finger'],
  ['teleport', '✌️ Two-finger sign'],
  ['guard', '🖐️ ONE open palm, fingers spread wide'],
  ['kame', '👐 Cup both hands, wrists close together, at chest height'],
  ['spirit', '🙌 Raise BOTH open hands above your head'],
  ['kick', '🦵 Step back so your legs show, then lift a knee or kick', 1],
  ['power', '✊ Two fists'],
];
const READY_MS = 2500;
const HOLD_MS = 4000;
const SAMPLE_MS = 200;

const r2 = (v) => Math.round(v * 100) / 100;

function snapshot(app) {
  const cam = app.cameraInput;
  const F = cam.F;
  return {
    status: cam.status,
    delegate: cam.tracker.delegate,
    fps: Math.round(cam.debug.fps),
    inferMs: r2(cam.debug.inferenceMs),
    latencyMs: Math.round(app.latency || 0),
    pose: cam.state.pose,
    hands: cam.state.hands,
    scores: Object.fromEntries(Object.entries(cam.debug.raw || {}).map(([k, v]) => [k, r2(v)])),
    hand: (F?.hands || []).map((h) => ({
      fist: r2(h.fistness), curls: h.curls.map(r2), spread: r2(h.spread), point: r2(h.point), peace: r2(h.peace),
      palmY: r2(h.palm.y), size: r2(h.size), hidden: !!h.track.stale,
    })),
    pair: F?.pair ? { wristDist: r2(F.pair.wristDist), avgY: r2(F.pair.avgY), lowY: r2(F.pair.lowY) } : null,
    body: cam.tracker.poseStatus === 'ready'
      ? (F?.body ? { sw: r2(F.body.sw), shoulderY: r2(F.body.shoulderY), legs: F.body.legs.map((l) => l && { kneeDrop: r2(l.kneeDrop), reach: r2(l.reach) }) } : 'not in view')
      : cam.tracker.poseStatus,
  };
}

export function startLiveCheck(app) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;max-width:min(92vw,560px);'
    + 'padding:14px 18px;border-radius:14px;background:rgba(8,6,20,.88);color:#fff;font:600 18px/1.35 Inter,system-ui,sans-serif;'
    + 'text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.5);pointer-events:auto;cursor:pointer';
  document.body.appendChild(box);
  const show = (html) => { box.innerHTML = html; };

  let queue = [];
  const post = (entry) => { queue.push({ at: Date.now(), ...entry }); };
  setInterval(() => {
    if (!queue.length) return;
    const body = JSON.stringify(queue);
    queue = [];
    fetch('/__report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }, 1000);

  // Count motion events (punches, kicks) as the camera pipeline produces them.
  const seen = { punch: 0, kick: 0 };
  const motion = app.cameraInput.motion;
  const update = motion.update.bind(motion);
  motion.update = (...args) => {
    const events = update(...args);
    for (const e of events) if (e.type in seen) { seen[e.type]++; post({ kind: 'event', type: e.type }); }
    return events;
  };

  let running = false;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    if (running) return;
    running = true;
    const cam = app.cameraInput;
    if (!cam.camera.live) await app.enableCamera();
    while (cam.status !== 'tracking') {
      show(`Waiting for the camera… (${cam.status})<br><small>Allow camera access if Chrome asks.</small>`);
      post({ kind: 'waiting', status: cam.status });
      await wait(500);
    }
    post({ kind: 'start', ua: navigator.userAgent, video: `${cam.camera.video.videoWidth}x${cam.camera.video.videoHeight}` });
    const results = [];
    for (let i = 0; i < STEPS.length; i++) {
      const [expect, text, target] = STEPS[i];
      for (let t = READY_MS; t > 0; t -= 500) {
        show(`<div style="opacity:.7;font-size:14px">Gesture ${i + 1} of ${STEPS.length}: get ready</div><div style="font-size:24px;margin-top:4px">${text}</div><div style="opacity:.7">${Math.ceil(t / 1000)}…</div>`);
        await wait(500);
      }
      let hits = 0, n = 0;
      const t0 = performance.now();
      const ev0 = target ? seen[expect] : 0;
      const holdMs = target ? HOLD_MS + 2000 : HOLD_MS;
      while (performance.now() - t0 < holdMs) {
        const s = snapshot(app);
        n++;
        if (s.pose === expect) hits++;
        post({ kind: 'sample', step: i, expect, ...s });
        const got = target ? seen[expect] - ev0 : 0;
        const ok = target ? got >= target : s.pose === expect;
        const body = typeof s.body === 'string' ? s.body : 'tracked';
        show(`<div style="opacity:.7;font-size:14px">Gesture ${i + 1} of ${STEPS.length}: ${target ? 'GO' : 'HOLD IT'}</div><div style="font-size:24px;margin-top:4px">${text}</div>`
          + `<div style="margin-top:6px;color:${ok ? '#7dff9b' : '#ffd23f'}">${target ? `${expect === 'punch' ? 'Punches' : 'Kicks'} seen: ${got} of ${target}` : `Game sees: ${s.pose}`} · ${s.hands} hand${s.hands === 1 ? '' : 's'} · body ${body}</div>`);
        await wait(SAMPLE_MS);
      }
      const rate = target ? Math.min(1, (seen[expect] - ev0) / target) : n ? hits / n : 0;
      results.push({ expect, text, rate });
      post({ kind: 'step', step: i, expect, rate: r2(rate) });
    }
    post({ kind: 'done', results: results.map((r) => ({ expect: r.expect, rate: r2(r.rate) })) });
    show(`<div style="font-size:20px;margin-bottom:6px">Check complete</div>${results.map((r) => `<div>${r.text.split(' ')[0]} ${r.expect} ${Math.round(r.rate * 100)}%</div>`).join('')}<div style="opacity:.7;font-size:14px;margin-top:6px">Tap to run again</div>`);
    running = false;
  }

  box.addEventListener('click', run);
  show('Live gesture check<br><small>Tap here to start. Sit back so both hands fit in the camera preview.</small>');
  post({ kind: 'opened' });
  return { run };
}
