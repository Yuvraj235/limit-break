import { STAGE } from '../config.js';
import { damp, snoise1, clamp } from '../core/math.js';

/**
 * Stage camera: follow, zoom, trauma-based screen shake, hit-stop, slow motion, and 3D swings: the
 * stage is tilted in CSS 3D (perspective + rotate) while its layers sit at different depths, so big
 * moves read as a camera moving around the fighters.
 */
export class Camera2D {
  constructor() { this.reset(); }

  reset() {
    this.x = STAGE.W / 2; this.y = STAGE.H / 2; this.z = 1;
    this.tx = this.x; this.ty = this.y; this.tz = 1;
    this.trauma = 0; this.punchK = 0; this.t = 0;
    this.hitStop = 0; this.slowFactor = 1; this.slowT = 0;
    this.override = null;
    this.yaw = 0; this.pitch = 0; this.orb = null;
  }

  /** A quick 3D camera swing in degrees (yaw turns around the fighters, pitch looks up/down). */
  orbit(yaw, pitch = 0, hold = 0.3) {
    if (this.orb && Math.abs(this.orb.yaw) + Math.abs(this.orb.pitch) > Math.abs(yaw) + Math.abs(pitch) && this.orbT < 0.12 + this.orb.hold) return;
    this.orb = { yaw, pitch, hold };
    this.orbT = 0;
  }

  /** CSS transform for the stage element. */
  get css3d() {
    const s = 1 + (Math.abs(this.yaw) + Math.abs(this.pitch)) * 0.007;
    return `perspective(1300px) rotateX(${this.pitch.toFixed(2)}deg) rotateY(${this.yaw.toFixed(2)}deg) scale(${s.toFixed(3)})`;
  }

  shake(amount) { this.trauma = clamp(this.trauma + amount); }
  punch(amount = 1) { this.punchK = Math.max(this.punchK, amount); }
  freeze(ms) { this.hitStop = Math.max(this.hitStop, ms / 1000); }
  slow(factor, ms) { this.slowFactor = factor; this.slowT = ms / 1000; }

  /** Hold a framing (cutscene beats, beam struggles) until released with null. */
  hold(x, y, z) { this.override = x == null ? null : { x, y, z }; }

  follow(a, b) {
    const midX = (a.x + b.x) / 2;
    const span = Math.abs(a.x - b.x);
    this.tz = clamp(1.32 - span / 2400, 1, 1.22);
    this.tx = midX;
    this.ty = STAGE.GROUND_Y - 250;
  }

  /** Returns the sim time scale for this frame (0 during hit-stop). */
  timeScale(dt) {
    if (this.hitStop > 0) { this.hitStop -= dt; return 0; }
    if (this.slowT > 0) { this.slowT -= dt; return this.slowFactor; }
    return 1;
  }

  update(dt) {
    this.t += dt;
    const target = this.override || { x: this.tx, y: this.ty, z: this.tz };
    this.x = damp(this.x, target.x, 4.5, dt);
    this.y = damp(this.y, target.y, 4.5, dt);
    this.z = damp(this.z, target.z, 3.5, dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    let k = 0;
    if (this.orb) {
      this.orbT += dt;
      const o = this.orb, a = 0.12, b = a + o.hold, c = b + 0.55;
      k = this.orbT < a ? this.orbT / a : this.orbT < b ? 1 : this.orbT < c ? 1 - (this.orbT - b) / (c - b) : 0;
      k = k * k * (3 - 2 * k);
      if (this.orbT >= c) this.orb = null;
    }
    // a slow idle drift keeps the scene feeling three-dimensional
    this.yaw = (this.orb ? this.orb.yaw * k : 0) + Math.sin(this.t * 0.35) * 1.6;
    this.pitch = (this.orb ? this.orb.pitch * k : 0) + Math.sin(this.t * 0.27 + 1) * 0.6;
    this.punchK = Math.max(0, this.punchK - dt * 3);
    // keep the view inside the stage
    const z = this.z * (1 + this.punchK * 0.05);
    const hw = STAGE.W / 2 / z, hh = STAGE.H / 2 / z;
    this.cx = clamp(this.x, hw, STAGE.W - hw);
    this.cy = clamp(this.y, hh, STAGE.H - hh + 40);
    this.cz = z;
  }

  get matrix() {
    const sh = this.trauma * this.trauma * 30;
    const sx = snoise1(this.t * 32) * sh;
    const sy = snoise1(this.t * 32 + 50) * sh;
    const z = this.cz ?? 1;
    return [z, 0, 0, z, STAGE.W / 2 - z * (this.cx ?? this.x) + sx, STAGE.H / 2 - z * (this.cy ?? this.y) + sy];
  }

  /** Parallax matrix for distant layers (factor 0 = static, 1 = full camera). */
  parallax(f) {
    const m = this.matrix;
    const z = 1 + (m[0] - 1) * f;
    const cx = STAGE.W / 2 + ((this.cx ?? this.x) - STAGE.W / 2) * f;
    const cy = STAGE.H / 2 + ((this.cy ?? this.y) - STAGE.H / 2) * f;
    return [z, 0, 0, z, STAGE.W / 2 - z * cx + (m[4] - (STAGE.W / 2 - m[0] * (this.cx ?? this.x))) * f, STAGE.H / 2 - z * cy + (m[5] - (STAGE.H / 2 - m[0] * (this.cy ?? this.y))) * f];
  }
}
