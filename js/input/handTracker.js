import { MEDIAPIPE } from '../config.js';

/**
 * MediaPipe Hands via the Tasks API (HandLandmarker, 21 landmarks per hand), plus an optional body
 * tracker (PoseLandmarker lite) for kicks and body-relative "hands raised". The body model loads after
 * the hands are ready and never blocks them; if it fails, the game simply plays without kicks.
 * The module comes from the import map in index.html; an older pinned build is the fallback.
 */
export class HandTracker {
  constructor() {
    this.landmarker = null;
    this.status = 'idle'; // idle | loading | ready | error
    this.delegate = null;
    this.inferenceMs = 0;
    this.error = null;
    this._lastTs = 0;
    this._fails = 0;
    this.pose = null;          // PoseLandmarker, once loaded
    this.poseStatus = 'off';   // off | loading | ready | error
    this.poseMs = 0;
    this._poseTs = 0;
  }

  async init() {
    if (this.status === 'ready' || this.status === 'loading') return;
    this.status = 'loading';
    if (await this._initWorker()) { this.status = 'ready'; return; }
    try {
      let vision;
      let wasm = MEDIAPIPE.WASM;
      try {
        vision = await import('@mediapipe/tasks-vision');
      } catch (err) {
        console.warn('[hands] primary MediaPipe build failed, using fallback', err);
        vision = await import(MEDIAPIPE.MODULE_FALLBACK);
        wasm = MEDIAPIPE.WASM_FALLBACK;
      }
      const fileset = await vision.FilesetResolver.forVisionTasks(wasm);
      const options = (delegate) => ({
        baseOptions: { modelAssetPath: MEDIAPIPE.MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numHands: MEDIAPIPE.NUM_HANDS,
        minHandDetectionConfidence: MEDIAPIPE.MIN_DETECT_CONF,
        minHandPresenceConfidence: MEDIAPIPE.MIN_PRESENCE_CONF,
        minTrackingConfidence: MEDIAPIPE.MIN_TRACK_CONF,
      });
      // Prefer the gesture recognizer (landmarks + a trained per-hand gesture); fall back to the landmarker.
      const recognizer = (delegate) => vision.GestureRecognizer.createFromOptions(fileset, { ...options(delegate), baseOptions: { modelAssetPath: MEDIAPIPE.GESTURE_MODEL_URL, delegate } });
      const landmarker = (delegate) => vision.HandLandmarker.createFromOptions(fileset, options(delegate));
      this._create = async (delegate) => {
        if (vision.GestureRecognizer) {
          try { const r = await recognizer(delegate); this.kind = 'recognizer'; return r; } catch (err) { console.warn('[hands] gesture recognizer unavailable', err); }
        }
        this.kind = 'landmarker';
        return landmarker(delegate);
      };
      try {
        this.landmarker = await this._create('GPU');
        this.delegate = 'GPU';
      } catch (err) {
        console.warn('[hands] GPU delegate unavailable, using CPU', err);
        this.landmarker = await this._create('CPU');
        this.delegate = 'CPU';
      }
      this.status = 'ready';
      this._loadPose(vision, fileset);
    } catch (err) {
      this.status = 'error';
      this.error = err;
      console.error('[hands] failed to load', err);
    }
  }

  async _loadPose(vision, fileset) {
    if (!vision.PoseLandmarker) return;
    this.poseStatus = 'loading';
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: MEDIAPIPE.POSE_MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    try {
      try { this.pose = await vision.PoseLandmarker.createFromOptions(fileset, options(this.delegate || 'GPU')); }
      catch { this.pose = await vision.PoseLandmarker.createFromOptions(fileset, options('CPU')); }
      this.poseStatus = 'ready';
    } catch (err) {
      this.poseStatus = 'error';
      console.warn('[body] body tracking unavailable; kicks need the keyboard or buttons', err);
    }
  }

  /** Start the models in a Web Worker (js/input/visionWorker.js). Returns false to use the main thread. */
  async _initWorker() {
    if (!MEDIAPIPE.WORKER || typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') return false;
    let w;
    try {
      w = new Worker(new URL('./visionWorker.js', import.meta.url), { type: 'module' });
      const ready = await new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error('worker start timed out')), 25000);
        w.onmessage = (e) => {
          if (e.data.type === 'ready') { clearTimeout(timer); res(e.data); } else if (e.data.type === 'error') { clearTimeout(timer); rej(new Error(e.data.error)); }
        };
        w.onerror = (e) => { clearTimeout(timer); rej(new Error(e.message || 'worker failed')); };
        w.postMessage({
          type: 'init', moduleUrl: MEDIAPIPE.MODULE, wasmUrl: MEDIAPIPE.WASM, gestureModel: MEDIAPIPE.GESTURE_MODEL_URL,
          handModel: MEDIAPIPE.MODEL_URL, poseModel: MEDIAPIPE.POSE_MODEL_URL, numHands: MEDIAPIPE.NUM_HANDS,
          minDetect: MEDIAPIPE.MIN_DETECT_CONF, minPresence: MEDIAPIPE.MIN_PRESENCE_CONF, minTrack: MEDIAPIPE.MIN_TRACK_CONF,
        });
      });
      this.worker = w;
      this.mode = 'worker';
      this.kind = ready.kind;
      this.delegate = ready.delegate;
      this.poseStatus = 'loading';
      w.onmessage = (e) => this._onWorker(e.data);
      return true;
    } catch (err) {
      console.warn('[hands] background tracking unavailable, using the main thread', err);
      w?.terminate();
      return false;
    }
  }

  _onWorker(m) {
    if (m.type === 'pose-ready') { this.poseStatus = 'ready'; this.pose = 'worker'; return; }
    if (m.type === 'pose-error') { this.poseStatus = 'error'; console.warn('[body] body tracking unavailable:', m.error); return; }
    if (m.type !== 'result') return;
    this.inferenceMs = m.inferMs;
    if (m.poseMs) this.poseMs = m.poseMs;
    const done = this._pending;
    this._pending = null;
    done?.(m.error ? null : { hands: m.hands, pose: m.pose });
  }

  /** One frame → {hands, pose} (pose only when asked and loaded), in the worker or on the main thread. */
  run(source, now, wantPose) {
    if (this.mode === 'worker') {
      if (this._pending) return Promise.resolve(null);
      return createImageBitmap(source).then((bitmap) => new Promise((res) => {
        this._pending = res;
        this.worker.postMessage({ type: 'frame', bitmap, ts: Math.round(now), wantPose: wantPose && this.poseStatus === 'ready' }, [bitmap]);
      }), () => null);
    }
    const hands = this.detect(source, now);
    if (!hands) return Promise.resolve(null);
    return Promise.resolve({ hands, pose: wantPose && this.pose ? this.detectPose(source, now) : null });
  }

  /** Body landmarks (33 points, raw image coordinates, with visibility) or null. */
  detectPose(source, now) {
    if (!this.pose) return null;
    const ts = Math.max(Math.round(now), this._poseTs + 1);
    this._poseTs = ts;
    const t0 = performance.now();
    try {
      const res = this.pose.detectForVideo(source, ts);
      this.poseMs = performance.now() - t0;
      return res.landmarks?.[0] || [];
    } catch (err) {
      this.poseStatus = 'error';
      this.pose = null;
      console.warn('[body] body tracking stopped', err);
      return null;
    }
  }

  async _rebuild(delegate) {
    const old = this.landmarker;
    this.landmarker = null;
    this.status = 'loading';
    try {
      this.landmarker = await this._create(delegate);
      this.delegate = delegate;
      this.status = 'ready';
      this._fails = 0;
      old?.close?.();
    } catch (err) {
      this.status = 'error';
      this.error = err;
      console.error('[hands] CPU fallback failed', err);
    }
  }

  /** Returns [{landmarks, handedness, score}] in raw (unmirrored) image coordinates, or null. */
  detect(video, now) {
    if (!this.landmarker || video.readyState < 2) return null;
    const ts = Math.max(Math.round(now), this._lastTs + 1); // must be strictly increasing
    this._lastTs = ts;
    const t0 = performance.now();
    let result;
    try {
      result = this.kind === 'recognizer' ? this.landmarker.recognizeForVideo(video, ts) : this.landmarker.detectForVideo(video, ts);
      this._fails = 0;
    } catch (err) {
      // Some mobile GPUs create the GPU delegate fine and then fail on every frame: rebuild on CPU.
      if (++this._fails === 3) {
        console.warn('[hands] detection keeps failing, switching delegate', err);
        if (this.delegate === 'GPU') this._rebuild('CPU');
        else { this.status = 'error'; this.error = err; }
      }
      return null;
    }
    this.inferenceMs = performance.now() - t0;
    const hd = result.handedness || result.handednesses || [];
    return (result.landmarks || []).map((landmarks, i) => ({
      landmarks,
      gesture: result.gestures?.[i]?.[0] ? { name: result.gestures[i][0].categoryName, score: result.gestures[i][0].score } : null,
      handedness: hd[i]?.[0]?.categoryName || '?',
      score: hd[i]?.[0]?.score ?? 1,
    }));
  }
}
