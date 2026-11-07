import { bus } from '../core/events.js';
import { CameraSource } from './camera.js';
import { HandTracker } from './handTracker.js';
import { HandTracks } from './tracks.js';
import { frameFeatures, bodyFeatures } from './features.js';
import { MEDIAPIPE } from '../config.js';
import { GESTURE_IDS, G, scoreGestures, gestureIntensity } from './gestureDefs.js';
import { GestureStateMachine } from './gestureState.js';
import { MotionDetector } from './motionGestures.js';
import { calibration } from './calibration.js';

const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

/** Camera → MediaPipe → tracks → features → pose state machine + motion events. */
export class CameraInput {
  constructor(video) {
    this.camera = new CameraSource(video);
    this.tracker = new HandTracker();
    this.tracks = new HandTracks();
    this.sm = new GestureStateMachine(GESTURE_IDS);
    this.motion = new MotionDetector();
    this.enabled = true;
    this.state = { pose: G.IDLE, since: 0, intensity: 0, shake: 0, stillness: 0, hands: 0 };
    this.F = null;
    this.events = [];
    this.debug = { inferenceMs: 0, raw: {}, scores: this.sm.scores, fps: 0, frameAt: 0 };
    this._lastFrame = 0;
  }

  get status() {
    if (!this.camera.live) return this.camera.status;
    return this.tracker.status === 'ready' ? 'tracking' : this.tracker.status;
  }

  async start() {
    const ok = await this.camera.start();
    bus.emit('camera:status', this.status);
    if (!ok) return false;
    this.tracker.init().then(() => bus.emit('camera:status', this.status));
    this.camera.onFrame((now, meta) => this._onFrame(now, meta));
    return true;
  }

  stop() {
    this.camera.stop();
    this.tracks.clear();
    this.sm.reset();
    this.state = { ...this.state, pose: G.IDLE, hands: 0, stillness: 0, shake: 0 };
    bus.emit('camera:status', this.status);
  }

  _onFrame(now, meta) {
    if (this._busy) return; // a frame is still being read: drop this one, so latency stays at one frame
    this._busy = true;
    this.process(this.camera.video, now, performance.now(), meta).finally(() => { this._busy = false; });
  }

  /** One frame through the pipeline. Tests call this directly with an image source and virtual time. */
  async process(source, now, t, meta) {
    if (!this.enabled || this.tracker.status !== 'ready') return;
    const wantPose = (this._n = (this._n || 0) + 1) % MEDIAPIPE.POSE_EVERY === 0;
    const res = await this.tracker.run(source, now, wantPose);
    if (!res) return;
    const hands = res.hands;
    const aspect = source.videoWidth ? source.videoWidth / source.videoHeight : source.width / source.height;
    const cfg = calibration.cfg;
    const tracks = this.tracks.update(hands, aspect, t);
    if (res.pose) { this.body = bodyFeatures(res.pose, aspect); this._bodyAt = t; }
    if (this.body && t - this._bodyAt > 400) this.body = null; // stale: body left the frame
    const F = frameFeatures(tracks, aspect, cfg, this.body);
    const raw = scoreGestures(F, cfg);
    const change = this.sm.update(raw, t);
    this.events.push(...this.motion.update(tracks, F, this.sm.current, t, aspect));
    if (change.changed) bus.emit('gesture:change', { source: 'camera', ...change });

    this.F = F;
    this.state = {
      pose: this.sm.current,
      since: this.sm.since,
      intensity: gestureIntensity(this.sm.current, F, cfg),
      shake: this.motion.shake,
      stillness: this.motion.stillness,
      hands: F.count,
    };
    this.debug.raw = raw;
    this.debug.scores = this.sm.scores;
    this.debug.inferenceMs = this.tracker.inferenceMs;
    this.debug.frameAt = meta?.captureTime || now;
    if (this._lastFrame) this.debug.fps += (1000 / Math.max(1, t - this._lastFrame) - this.debug.fps) * 0.1;
    this._lastFrame = t;
  }

  drain() {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Landmark skeleton over the mirrored preview (landmarks are already mirrored). */
  drawPreview(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    if (!this.F) return;
    const pose = this.state.pose;
    const color = pose === G.IDLE ? 'rgba(255,255,255,0.85)' : '#ffd23f';
    ctx.lineWidth = Math.max(1.5, w / 160);
    this._disp ??= new Map();
    if (this._disp.size > 8) this._disp.clear(); // forget hands that are long gone
    for (const hand of this.F.hands) {
      // display-only easing toward the latest landmarks: smooth on screen, no extra lag for gameplay
      const tr = hand.track;
      let lm = this._disp.get(tr.id);
      if (!lm) { lm = tr.lm.map((p) => ({ ...p })); this._disp.set(tr.id, lm); }
      for (let i = 0; i < lm.length; i++) { lm[i].x += (tr.lm[i].x - lm[i].x) * 0.55; lm[i].y += (tr.lm[i].y - lm[i].y) * 0.55; }
      ctx.strokeStyle = hand.track.stale ? 'rgba(255,255,255,0.3)' : color;
      ctx.beginPath();
      for (const [a, b] of BONES) {
        ctx.moveTo(lm[a].x * w, lm[a].y * h);
        ctx.lineTo(lm[b].x * w, lm[b].y * h);
      }
      ctx.stroke();
      ctx.fillStyle = '#4fc3ff';
      for (const i of [4, 8, 12, 16, 20]) {
        ctx.beginPath();
        ctx.arc(lm[i].x * w, lm[i].y * h, ctx.lineWidth * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // body: shoulders, hips and legs, faint
    const pts = this.F.body?.points;
    if (pts) {
      ctx.strokeStyle = 'rgba(120,220,255,0.55)';
      ctx.beginPath();
      for (const [a, b] of [[11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [11, 13], [13, 15], [12, 14], [14, 16]]) {
        if (pts[a].v < 0.5 || pts[b].v < 0.5) continue;
        ctx.moveTo(pts[a].x * w, pts[a].y * h);
        ctx.lineTo(pts[b].x * w, pts[b].y * h);
      }
      ctx.stroke();
    }
    // the calibrated "raised" line
    ctx.strokeStyle = 'rgba(255,210,63,0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, calibration.raiseY * h);
    ctx.lineTo(w, calibration.raiseY * h);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
