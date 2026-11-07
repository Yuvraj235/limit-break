import { TIMING, STAGE } from '../config.js';
import { springStep, M, DEG, lerpColor, rgb, hex, snoise1, ease, clamp } from '../core/math.js';
import { el, hairPath, lerpSpikes, humanoid } from './parts.js';

const JOINTS = ['lean', 'head', 'aF', 'eF', 'wF', 'aB', 'eB', 'wB', 'hF', 'kF', 'fF', 'hB', 'kB', 'fB', 'lift', 'rot', 'dx'];

/**
 * Pose values are degrees, "forward positive": arms/legs 0 = hanging straight down, 90 = pointing
 * forward, 180 = straight up; elbows/knees are relative to the parent bone (knees bend with negative
 * values). lean tilts the torso forward, head nods forward. lift raises the body (px), rot spins the
 * whole body about the feet, dx shifts it forward.
 */
export const BASE_POSE = {
  lean: 4, head: 0, aF: 15, eF: 30, wF: 0, aB: -10, eB: 25, wB: 0,
  hF: 14, kF: -18, fF: 6, hB: -12, kB: -14, fB: 4, lift: 0, rot: 0, dx: 0,
  handF: 'fist', handB: 'fist', expr: 'calm', bob: 0, stiff: TIMING.POSE_STIFFNESS,
};

let rigCount = 0;

/** Rigs drawn into RIG_OPTS.headlessLayer skip their SVG updates: the 3D view (render3d/) draws them instead. */
export const RIG_OPTS = { headlessLayer: null };
const n2 = (v) => Math.round(v * 100) / 100;

/**
 * Generic skeletal SVG character. A definition supplies proportions, palette, part builders,
 * poses, forms and expressions; the rig handles the joint hierarchy, spring-eased pose
 * transitions, auto-grounding, hair morphing, after-images and world-space anchors for effects.
 */
export class CharacterRig {
  constructor(def, layer) {
    this.def = def;
    this.P = def.proportions;
    this.C = def.palette;
    this.layer = layer;
    this.id = `rig-${def.id}-${++rigCount}`;
    this.x = 0;
    this.y = STAGE.GROUND_Y;
    this.facing = 1;
    this.scale = def.scale ?? 1;
    this.j = {};
    this.target = {};
    for (const k of JOINTS) { this.j[k] = { x: 0, v: 0 }; this.target[k] = 0; }
    this.omega = TIMING.POSE_STIFFNESS;
    this.bobAmp = 0;
    this.breath = 1;
    this.tremble = 0;
    this.hairSway = 0;
    this.t = Math.random() * 10;
    this.afterimages = [];
    this.anchors = {};
    this._hand = {};
    this._hairDirty = true;
    this._formCache = {};
    this.opacity = 1;
    this.visible = true;
    this.flashUntil = 0;
    this.ghostQueue = []; // afterimages waiting for the 3D view
    this.build();
    this.form = null;
    if (def.defaultForm) this.setForm(def.defaultForm, true);
    this.setPose('idle', true);
    this.update(0);
  }

  build() {
    const { P, C, def } = this;
    const parts = { ...humanoid, ...(def.parts || {}) };
    const g = (this.g = {});
    this.hands = {};
    g.root = el('g', { class: 'fighter', id: this.id }, this.layer);
    g.shadow = el('ellipse', { cx: 0, cy: 3, rx: 52, ry: 10, fill: 'rgba(0,0,0,0.4)' }, g.root);
    g.body = el('g', {}, g.root);
    g.pelvis = el('g', {}, g.body);

    g.torsoB = el('g', {}, g.pelvis);
    this._buildArm('B', g.torsoB, parts);
    this._buildLeg('B', g.pelvis, parts);
    if (parts.tail) { g.tail = el('g', {}, g.pelvis); this.tail = parts.tail(g.tail, P, C, this); }

    g.torsoM = el('g', {}, g.pelvis);
    parts.neck(g.torsoM, P, C, this);
    parts.torso(g.torsoM, P, C, this);
    g.neck = el('g', {}, g.torsoM);
    g.headInner = el('g', { transform: `translate(0,${-P.headR * 0.95})` }, g.neck);
    this.head = parts.head(g.headInner, P, C, this);

    this._buildLeg('F', g.pelvis, parts);
    g.torsoF = el('g', {}, g.pelvis);
    parts.belt(g.torsoF, P, C, this);
    this._buildArm('F', g.torsoF, parts);
    if (parts.extras) this.extras = parts.extras(g, P, C, this);
  }

  _buildArm(side, parent, parts) {
    const { P, C } = this;
    const back = side === 'B';
    const sh = el('g', {}, parent);
    parts.upperArm(sh, P, C, back, this);
    const elbow = el('g', {}, sh);
    parts.forearm(elbow, P, C, back, this);
    const wrist = el('g', {}, elbow);
    this.hands[side] = parts.hand(wrist, P, C, back, this);
    Object.assign(this.g, { [`sh${side}`]: sh, [`el${side}`]: elbow, [`wr${side}`]: wrist });
  }

  _buildLeg(side, parent, parts) {
    const { P, C } = this;
    const back = side === 'B';
    const hip = el('g', {}, parent);
    parts.thigh(hip, P, C, back, this);
    const knee = el('g', {}, hip);
    parts.shin(knee, P, C, back, this);
    const ankle = el('g', {}, knee);
    parts.foot(ankle, P, C, back, this);
    Object.assign(this.g, { [`hip${side}`]: hip, [`knee${side}`]: knee, [`ankle${side}`]: ankle });
  }

  /* ── state ─────────────────────────────────────────────────────────────── */

  setPose(name, instant = false, overrides = null) {
    const p = this.def.poses[name] || this.def.poses.idle;
    this.poseName = name;
    const full = { ...BASE_POSE, ...p, ...(overrides || {}) };
    for (const k of JOINTS) {
      this.target[k] = full[k];
      if (instant) { this.j[k].x = full[k]; this.j[k].v = 0; }
    }
    this.omega = full.stiff;
    this.bobAmp = full.bob;
    this.setHands(full.handF, full.handB);
    this.setExpression(full.expr);
  }

  /** Adjust a few targets without changing the pose (aiming, recoil). */
  nudge(values) { for (const k in values) if (k in this.target) this.target[k] += values[k]; }

  setHands(front, back) {
    for (const [side, shape] of [['F', front], ['B', back]]) {
      if (this._hand[side] === shape) continue;
      this._hand[side] = shape;
      const set = this.hands[side];
      for (const k in set) set[k].style.display = k === shape ? '' : 'none';
    }
  }

  setExpression(name) {
    if (this._expr === name || !this.head) return;
    this._expr = name;
    const mouths = this.head.mouths || {};
    const show = mouths[name] ? name : 'calm';
    for (const k in mouths) mouths[k].style.display = k === show ? '' : 'none';
    if (this.head.brows) {
      const a = this.def.exprBrow?.[name] ?? 0;
      const [px, py] = this.head.browPivot || [0, 0];
      this.head.brows.setAttribute('transform', `rotate(${a},${px},${py})`);
    }
  }

  _formVisual(id) {
    if (!this._formCache[id]) {
      const F = this.def.forms[id];
      this._formCache[id] = { ...F, top: hex(F.hairTop), bottom: hex(F.hairBottom), stroke: hex(F.hairStroke), eye: hex(F.eye) };
    }
    return this._formCache[id];
  }

  setForm(id, instant = false) {
    if (!this.def.forms?.[id]) return;
    const to = this._formVisual(id);
    this.formFrom = this.form ? this._formVisual(this.form) : to;
    this.formTo = to;
    this.hairFrom = this._hairNow || to.hair;
    this.morphT = instant ? 1 : 0;
    this.form = id;
    if (this.head?.brows) this.head.brows.style.display = to.brows === false ? 'none' : '';
    this._hairDirty = true;
  }

  get morphing() { return this.morphT < 1; }

  get headless() { return this.layer === RIG_OPTS.headlessLayer; }

  flash(ms = 90) {
    this.flashUntil = performance.now() + ms;
    this.g.root.classList.add('hit-flash');
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => this.g.root.classList.remove('hit-flash'), ms);
  }

  setVisible(v) { this.visible = v; this.g.root.style.display = v ? '' : 'none'; }
  setOpacity(o) { this.opacity = o; this.g.root.setAttribute('opacity', o); }

  spawnAfterimage(offsetX = 0, opacity = 0.45, life = 0.35, cls = '') {
    if (this.ghostQueue.length < 8) this.ghostQueue.push({ offsetX, opacity, life, cls });
    if (this.headless) return;
    const u = el('use', { href: `#${this.id}`, opacity, transform: `translate(${n2(offsetX)},0)`, class: `afterimage ${cls}` });
    this.layer.insertBefore(u, this.g.root);
    this.afterimages.push({ el: u, life, max: life, op: opacity });
  }

  /* ── per-frame ─────────────────────────────────────────────────────────── */

  /** Spin around the vertical axis (whole turns end facing the same way). */
  spin(turns = 1, dur = 0.6) { this._spin = { t: 0, turns, dur }; }

  update(dt) {
    this.t += dt;
    for (const k of JOINTS) springStep(this.j[k], this.target[k], this.omega, dt);
    const v = {};
    for (const k of JOINTS) v[k] = this.j[k].x;

    const br = Math.sin(this.t * 2.1) * this.breath;
    v.lean += br * 1.2; v.aF += br * 2; v.aB += br * 2; v.head -= br * 0.8;
    if (this.bobAmp) {
      const b = (Math.sin(this.t * 4.4) * 0.5 + 0.5) * this.bobAmp;
      v.kF -= b * 2.2; v.kB -= b * 2.2; v.hF += b * 1.1; v.hB += b * 1.1;
    }
    if (this.tremble > 0.01) {
      const tr = this.tremble * 2.6;
      v.lean += snoise1(this.t * 38) * tr; v.head += snoise1(this.t * 41 + 7) * tr;
      v.aF += snoise1(this.t * 36 + 3) * tr * 1.5; v.aB += snoise1(this.t * 39 + 11) * tr * 1.5;
    }

    const P = this.P;
    const hipH = P.thigh + P.shin + P.footH;
    let rootY = -v.lift;
    if (Math.abs(v.rot) < 5) {
      const ankle = (h, k) => P.thigh * Math.cos(h * DEG) + P.shin * Math.cos((h + k) * DEG);
      rootY += P.thigh + P.shin - Math.max(ankle(v.hF, v.kF), ankle(v.hB, v.kB));
    }

    const dom = !this.headless;
    this.rootY = rootY;
    this.hipH = hipH;
    this.lunge = Math.max(0, (this.lunge || 0) - dt * 3.2); // strikes lunge toward the camera, then settle back
    this.depth = 1 + 0.16 * Math.sin(Math.min(1, this.lunge) * Math.PI / 2);
    const s = this.scale * this.depth;
    let sx = 1; // a 3D turn: the sprite's width follows cos(angle), flipping through its back
    if (this._spin) {
      this._spin.t += dt;
      const k = this._spin.t / this._spin.dur;
      if (k >= 1) this._spin = null;
      else { sx = Math.cos(k * this._spin.turns * Math.PI * 2); if (Math.abs(sx) < 0.08) sx = sx < 0 ? -0.08 : 0.08; }
    }
    this.spinAngle = this._spin ? (this._spin.t / this._spin.dur) * this._spin.turns * Math.PI * 2 : 0;
    if (dom) this._writeDom(v, rootY, hipH, s, sx);
    this._anchors(v, rootY, hipH);
    this._updateHair(dt, dom);
    this._updateAfterimages(dt);
    this.pose = v;
  }

  _writeDom(v, rootY, hipH, s, sx) {
    const g = this.g, P = this.P;
    g.root.setAttribute('transform', `translate(${n2(this.x)},${n2(this.y)}) scale(${n2(this.facing * s * sx)},${s})`);
    g.body.setAttribute('transform', `translate(${n2(v.dx)},${n2(rootY)}) rotate(${n2(v.rot)})`);
    g.pelvis.setAttribute('transform', `translate(0,${-hipH})`);
    const lean = `rotate(${n2(v.lean)})`;
    g.torsoB.setAttribute('transform', lean);
    g.torsoM.setAttribute('transform', lean);
    g.torsoF.setAttribute('transform', lean);
    g.neck.setAttribute('transform', `translate(0,${-P.torso - P.neck}) rotate(${n2(v.head)})`);
    for (const side of ['F', 'B']) {
      const sh = P[`shoulder${side}`];
      g[`sh${side}`].setAttribute('transform', `translate(${sh.x},${-P.torso + sh.y}) rotate(${n2(-v[`a${side}`])})`);
      g[`el${side}`].setAttribute('transform', `translate(0,${P.upperArm}) rotate(${n2(-v[`e${side}`])})`);
      g[`wr${side}`].setAttribute('transform', `translate(0,${P.forearm}) rotate(${n2(-v[`w${side}`])})`);
      g[`hip${side}`].setAttribute('transform', `translate(${P[`hip${side}`]},0) rotate(${n2(-v[`h${side}`])})`);
      g[`knee${side}`].setAttribute('transform', `translate(0,${P.thigh}) rotate(${n2(-v[`k${side}`])})`);
      g[`ankle${side}`].setAttribute('transform', `translate(0,${P.shin}) rotate(${n2(-v[`f${side}`])})`);
    }

    // Shadow stays on the platform and shrinks with height.
    const air = Math.max(0, -rootY + Math.max(0, STAGE.GROUND_Y - this.y) / s);
    const shrink = 1 - clamp(air / 320) * 0.6;
    g.shadow.setAttribute('transform', `translate(${n2(v.dx)},${n2((STAGE.GROUND_Y - this.y) / s)}) scale(${n2(shrink)},${n2(shrink)})`);
    g.shadow.style.display = this.y > STAGE.GROUND_Y + 30 ? 'none' : '';

    if (this.tail) this.tail.update?.(this.t, v);
    if (this.extras?.update) this.extras.update(this.t, v);
  }

  _anchors(v, rootY, hipH) {
    const P = this.P;
    let m = M.translate(M.identity(), this.x, this.y);
    m = M.scale(m, this.facing * this.scale * (this.depth || 1), this.scale * (this.depth || 1));
    m = M.translate(m, v.dx, rootY);
    m = M.rotate(m, v.rot);
    m = M.translate(m, 0, -hipH);
    const torso = M.rotate(m, v.lean);
    const hand = (side) => {
      const sh = P[`shoulder${side}`];
      let a = M.translate(torso, sh.x, -P.torso + sh.y);
      a = M.rotate(a, -v[`a${side}`]);
      a = M.translate(a, 0, P.upperArm);
      a = M.rotate(a, -v[`e${side}`]);
      a = M.translate(a, 0, P.forearm);
      a = M.rotate(a, -v[`w${side}`]);
      return M.apply(a, 0, P.handR * 1.2);
    };
    const A = this.anchors;
    A.handF = hand('F');
    A.handB = hand('B');
    A.hands = { x: (A.handF.x + A.handB.x) / 2, y: (A.handF.y + A.handB.y) / 2 };
    let h = M.translate(torso, 0, -P.torso - P.neck);
    h = M.rotate(h, v.head);
    A.head = M.apply(h, 0, -P.headR * 0.95);
    A.chest = M.apply(torso, 6, -P.torso * 0.62);
    A.pelvis = M.apply(m, 0, 0);
    A.top = M.apply(h, 0, -P.headR * 2.4);
    this.height = (hipH + P.torso + P.neck + P.headR * 2.2) * this.scale;
  }

  _updateHair(dt, dom = true) {
    const head = this.head;
    if (!head?.hair || !this.formTo) return;
    const morphing = this.morphT < 1;
    if (morphing) this.morphT = Math.min(1, this.morphT + (dt * 1000) / TIMING.TRANSFORM_MS);
    if (!morphing && this.hairSway < 0.01 && !this._hairDirty) return;
    const t = this.morphT;
    const spikes = t < 1 ? lerpSpikes(this.hairFrom, this.formTo.hair, ease.outBack(t)) : this.formTo.hair;
    this._hairNow = spikes;
    if (!dom) { this._hairDirty = false; return; }
    head.hair.setAttribute('d', hairPath(spikes, this.P.headR, this.t, this.hairSway, this.def.hairline));
    if (morphing || this._hairDirty) {
      const a = this.formFrom, b = this.formTo;
      head.hairStops?.[0].setAttribute('stop-color', rgb(lerpColor(a.top, b.top, t)));
      head.hairStops?.[1].setAttribute('stop-color', rgb(lerpColor(a.bottom, b.bottom, t)));
      head.hair.setAttribute('stroke', rgb(lerpColor(a.stroke, b.stroke, t)));
      const eye = rgb(lerpColor(a.eye, b.eye, t));
      for (const p of head.pupils || []) p.setAttribute('fill', eye);
    }
    this._hairDirty = false;
  }

  _updateAfterimages(dt) {
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const a = this.afterimages[i];
      a.life -= dt;
      if (a.life <= 0) { a.el.remove(); this.afterimages.splice(i, 1); continue; }
      a.el.setAttribute('opacity', n2(a.op * (a.life / a.max)));
    }
  }

  destroy() {
    for (const a of this.afterimages) a.el.remove();
    this.afterimages = [];
    this.g.root.remove();
  }
}
