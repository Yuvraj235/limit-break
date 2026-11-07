// MediaPipe in a Web Worker: hand tracking (gesture recognizer, or plain landmarker) and body
// tracking run here, off the main thread, so drawing the fight never delays reading the player's
// hands and vice versa. The main thread sends one camera frame at a time as an ImageBitmap and gets
// plain landmark data back (see handTracker.js).

let hands = null, kind = null, pose = null, delegate = null;

async function init(o) {
  const vision = await import(o.moduleUrl);
  const fileset = await vision.FilesetResolver.forVisionTasks(o.wasmUrl);
  // MediaPipe's WebAssembly loader is a classic script; module workers can't importScripts it, so
  // evaluate it in the worker's global scope ourselves.
  const loader = await (await fetch(fileset.wasmLoaderPath)).text();
  (0, eval)(`${loader}\n;self.ModuleFactory = ModuleFactory;`);
  const factory = self.ModuleFactory; // each model consumes it, so hand every model its own reference
  const arm = () => { self.ModuleFactory = factory; };
  const common = {
    runningMode: 'VIDEO', numHands: o.numHands,
    minHandDetectionConfidence: o.minDetect, minHandPresenceConfidence: o.minPresence, minTrackingConfidence: o.minTrack,
  };
  const make = async (d) => {
    if (vision.GestureRecognizer) {
      try { arm(); kind = 'recognizer'; return await vision.GestureRecognizer.createFromOptions(fileset, { ...common, baseOptions: { modelAssetPath: o.gestureModel, delegate: d } }); } catch { /* fall through */ }
    }
    kind = 'landmarker';
    arm();
    return vision.HandLandmarker.createFromOptions(fileset, { ...common, baseOptions: { modelAssetPath: o.handModel, delegate: d } });
  };
  try { hands = await make('GPU'); delegate = 'GPU'; } catch { hands = await make('CPU'); delegate = 'CPU'; }
  self.postMessage({ type: 'ready', kind, delegate });
  if (o.poseModel && vision.PoseLandmarker) {
    const opts = (d) => ({ baseOptions: { modelAssetPath: o.poseModel, delegate: d }, runningMode: 'VIDEO', numPoses: 1 });
    let firstErr = null;
    for (const d of delegate === 'GPU' ? ['GPU', 'CPU'] : ['CPU']) {
      try {
        arm();
        pose = await vision.PoseLandmarker.createFromOptions(fileset, opts(d));
        self.postMessage({ type: 'pose-ready', delegate: d });
        return;
      } catch (err) { firstErr ??= String(err?.message || err); }
    }
    self.postMessage({ type: 'pose-error', error: firstErr });
  }
}

let lastTs = 0, lastPoseTs = 0;
function frame({ bitmap, ts, wantPose }) {
  const out = { type: 'result', hands: [], pose: null, inferMs: 0, poseMs: 0 };
  try {
    const t0 = performance.now();
    lastTs = Math.max(ts, lastTs + 1);
    const r = kind === 'recognizer' ? hands.recognizeForVideo(bitmap, lastTs) : hands.detectForVideo(bitmap, lastTs);
    out.inferMs = performance.now() - t0;
    const hd = r.handedness || r.handednesses || [];
    out.hands = (r.landmarks || []).map((lm, i) => ({
      landmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      handedness: hd[i]?.[0]?.categoryName || '?',
      gesture: r.gestures?.[i]?.[0] ? { name: r.gestures[i][0].categoryName, score: r.gestures[i][0].score } : null,
    }));
    if (wantPose && pose) {
      const t1 = performance.now();
      lastPoseTs = Math.max(ts, lastPoseTs + 1);
      const p = pose.detectForVideo(bitmap, lastPoseTs);
      out.poseMs = performance.now() - t1;
      out.pose = (p.landmarks?.[0] || []).map((q) => ({ x: q.x, y: q.y, z: q.z, visibility: q.visibility }));
    }
  } catch (err) {
    out.error = String(err?.message || err);
  } finally {
    bitmap.close();
  }
  self.postMessage(out);
}

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') init(m).catch((err) => self.postMessage({ type: 'error', error: String(err?.message || err) }));
  else if (m.type === 'frame') frame(m);
};
