// A fighter in 3D: a cel-shaded, ink-outlined body built from the character's proportions and outfit,
// posed every frame from the same joint angles the 2D rig animates (characters/rig.js stays the
// animation brain, so poses, springs, grounding and effect anchors are identical in both views).
import * as THREE from 'three';
import { lerpColor } from '../core/math.js';
import { U, wx, wy, DEG, color, toon, outlineMaterial, ringsGeometry, limbGeometry } from './common.js';
import { lookOf } from './looks.js';

/** How far fighters turn toward the camera (a 3/4 view instead of a flat profile). */
const TURN = 30 * DEG;
const EXPR_MOUTH = { calm: [0.32, 0.9, 0], focus: [0.24, 0.85, 0], smirk: [0.32, 0.8, 0.25], hurt: [0.5, 0.8, -0.1], strain: [0.62, 1, 0], shout: [1.5, 1.1, 0] };

const sphere = new THREE.SphereGeometry(1, 20, 14);
const sphereLo = new THREE.SphereGeometry(1, 12, 8);
const cone = new THREE.ConeGeometry(1, 1, 6);
cone.translate(0, 0.5, 0);
const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 18);

export class Fighter3D {
  constructor(rig, scene, quality) {
    this.rig = rig;
    this.def = rig.def;
    this.look = lookOf(this.def);
    this.scene = scene;
    this.shadows = quality === 'high';
    this.u = { rimColor: { value: new THREE.Color(1, 1, 1) }, rimStrength: { value: 0.35 }, flash: { value: 0 } };
    this.mats = new Map();
    this.allMats = [];
    this.outline = outlineMaterial(this.look.outline);
    this.ghosts = [];
    this.root = new THREE.Group();
    this.root.name = `f3d-${this.def.id}`;
    this._build();
    scene.add(this.root);
    this._hairColors = { top: new THREE.Color(), bottom: new THREE.Color() };
    this._tmp = new THREE.Vector3();
  }

  /* ── materials ─────────────────────────────────────────────────────────── */
  mat(c, opts = {}) {
    const key = `${c}|${opts.emissive || ''}|${opts.vertexColors ? 'v' : ''}|${opts.flatShading ? 'f' : ''}`;
    let m = this.mats.get(key);
    if (!m) {
      m = toon(opts.vertexColors ? '#ffffff' : c, this.u, opts.emissive ? { ...opts, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity ?? 0.6 } : opts);
      this.mats.set(key, m);
      this.allMats.push(m);
    }
    return m;
  }

  /** Mesh with an ink outline; casts a shadow on high quality. */
  part(geo, c, parent, { pos, scale, rot, outline = true, opts } = {}) {
    const m = new THREE.Mesh(geo, typeof c === 'string' ? this.mat(c, opts) : c);
    if (pos) m.position.set(...pos);
    if (scale) Array.isArray(scale) ? m.scale.set(...scale) : m.scale.setScalar(scale);
    if (rot) m.rotation.set(...rot);
    m.castShadow = this.shadows;
    if (outline) { const o = new THREE.Mesh(geo, this.outline); o.userData.outline = true; m.add(o); }
    parent.add(m);
    return m;
  }

  /* ── build ─────────────────────────────────────────────────────────────── */
  _build() {
    const { def, look: L } = this;
    const P = def.proportions;
    const w = P.torsoW ?? 1, lw = P.limbW ?? 1;
    const Dx = 19 * w, Wz = 30 * w; // torso half-depth (front–back) and half-width (side–side)
    this.dims = { Dx, Wz };
    const j = (this.j = {});
    j.body = new THREE.Group(); this.root.add(j.body);
    j.pelvis = new THREE.Group(); j.body.add(j.pelvis);
    j.torso = new THREE.Group(); j.pelvis.add(j.torso);

    // Hips and belt
    this.part(ringsGeometry([{ y: -16, rx: Dx * 0.62, rz: Wz * 0.52 }, { y: -8, rx: Dx * 0.86, rz: Wz * 0.68 }, { y: 4, rx: Dx * 0.84, rz: Wz * 0.66 }], 22), L.pants, j.pelvis);
    if (L.belt) {
      this.part(ringsGeometry([{ y: -5, rx: Dx * 0.9, rz: Wz * 0.71 }, { y: 6, rx: Dx * 0.88, rz: Wz * 0.7 }], 24), L.belt, j.pelvis);
      if (L.beltTails) for (const dz of [-1, 1]) this.part(box, L.belt, j.pelvis, { pos: [Dx * 0.72, -12, Wz * 0.28 + dz * 4], scale: [3, 24, 5], rot: [dz * 0.12, 0, -0.18] });
      if (L.buckle) this.part(box, L.buckle, j.pelvis, { pos: [Dx * 0.88, 0, 0], scale: [4, 14, 12] });
    }

    // Torso: one shaped tube, colored per outfit region
    const T = P.torso;
    const top = color(L.top), vneck = L.vneck && color(L.vneck), armor = L.armor && color(L.armor.chest);
    const stripe = L.stripe && color(L.stripe), plate = L.chestPlate && color(L.chestPlate);
    const torsoGeo = ringsGeometry([
      { y: 0, rx: Dx * 0.8, rz: Wz * 0.66 }, { y: T * 0.2, rx: Dx * 0.84, rz: Wz * 0.67, ox: 0.6 }, { y: T * 0.42, rx: Dx * 0.93, rz: Wz * 0.78, ox: 1.6 },
      { y: T * 0.62, rx: Dx, rz: Wz * 0.92, ox: 2.6 }, { y: T * 0.8, rx: Dx, rz: Wz, ox: 2 }, { y: T * 0.92, rx: Dx * 0.86, rz: Wz * 0.97 },
      { y: T, rx: Dx * 0.56, rz: Wz * 0.62, ox: -1 }, { y: T * 1.04, rx: Dx * 0.22, rz: Wz * 0.22, ox: -1 },
    ], 32, (t, th, out) => {
      const fx = Math.cos(th), sz = Math.sin(th);
      if (vneck && fx > 0.2 && t > 0.56 && Math.abs(sz) < (t - 0.56) * 1.1) return out.copy(vneck);
      if (armor && t > 0.36) return out.copy(armor);
      if (plate && fx > 0.1 && t > 0.2 && t < 0.86) return out.copy(plate);
      if (stripe && fx > 0 && Math.abs(t - (0.46 + sz * 0.16)) < 0.07) return out.copy(stripe);
      return out.copy(top);
    });
    this.part(torsoGeo, this.mat('#ffffff', { vertexColors: true }), j.torso);
    if (L.collar) this.part(new THREE.TorusGeometry(1, 0.32, 8, 24), L.collar, j.torso, { pos: [0, T * 0.99, 0], scale: [Dx * 0.7, Wz * 0.64, 9], rot: [Math.PI / 2, 0, 0] });
    if (L.core) this.part(sphere, L.core, j.torso, { pos: [Dx * 0.96, T * 0.6, 0], scale: [5, 10, 10], opts: { emissive: L.core, emissiveIntensity: 0.9 } });
    if (L.crystals) for (const [y, z, h, r] of [[T * 0.95, -0.7, 34, 7], [T * 0.98, 0.7, 30, 6], [T * 0.75, -0.95, 26, 6], [T * 0.75, 0.95, 24, 5]]) {
      this.part(cone, L.crystals, j.torso, { pos: [-Dx * 0.5, y, z * Wz], scale: [r, h, r], rot: [z * 0.4, 0, 0.5], opts: { emissive: L.crystals, emissiveIntensity: 0.25 } });
    }
    if (L.vest) { /* Gogeta: the dark vest is the top color; the white under-shirt shows through the V. */ }

    // Neck and head
    this.part(cyl, L.skin, j.torso, { pos: [0, T + P.neck * 0.4, 0], scale: [6.5 * w, P.neck + 10, 6.5 * w] });
    j.neck = new THREE.Group(); j.neck.position.y = T + P.neck; j.torso.add(j.neck);
    j.head = new THREE.Group(); j.head.position.y = P.headR * 0.95; j.neck.add(j.head);
    this._buildHead(j.head, P.headR);
    if (L.scarf) this._buildScarf(j.torso, T, Dx);

    // Arms
    for (const side of ['F', 'B']) {
      const sh = P[`shoulder${side}`] || { x: 0, y: 12 };
      const z = (side === 'F' ? 1 : -1) * Wz * 0.86;
      const s = new THREE.Group(); s.position.set(sh.x * 0.2, T - sh.y, z); j.torso.add(s);
      const sleeve = L.sleeve, skin = L.skin;
      this.part(sphereLo, sleeve || skin, s, { scale: 9.6 * lw });
      this.part(limbGeometry(P.upperArm, 8.6 * lw, 7 * lw, 1.6 * lw), skin, s);
      if (sleeve) this.part(limbGeometry(16, 11 * lw, 10.2 * lw, 0.5), sleeve, s);
      if (L.armband) this.part(cyl, L.armband, s, { pos: [0, -14, 0], scale: [9.4 * lw, 6, 9.4 * lw] });
      if (L.armor) this.part(sphere, L.armor.pad, s, { pos: [0, 4, 0], scale: [12 * w, 8, 12 * w] });
      if (L.plates) this.part(sphere, L.plates, s, { pos: [0, 2, 0], scale: [16 * lw, 10, 15 * lw] });
      if (L.crystals) this.part(cone, L.crystals, s, { pos: [-4, 4, 0], scale: [6, 28, 6], rot: [0, 0, 0.7] });
      const e = new THREE.Group(); e.position.y = -P.upperArm; s.add(e);
      this.part(sphereLo, skin, e, { scale: 7.2 * lw, outline: false });
      this.part(limbGeometry(P.forearm, 7.2 * lw, 5.8 * lw, 1.1 * lw), skin, e);
      if (L.glove) this.part(limbGeometry(P.forearm * 0.58, 8 * lw, 7.2 * lw, 0.5), L.glove, e, { pos: [0, -P.forearm * 0.42, 0] });
      if (L.wrist) this.part(cyl, L.wrist, e, { pos: [0, -P.forearm + 10, 0], scale: [7.6 * lw, 16, 7.6 * lw] });
      if (L.plates) this.part(cyl, L.plates, e, { pos: [0, -P.forearm + 15, 0], scale: [10 * lw, 26, 10 * lw] });
      if (L.armband) this.part(cyl, L.armband, e, { pos: [0, -P.forearm + 10, 0], scale: [7.4 * lw, 16, 7.4 * lw] });
      if (L.fins) this.part(box, L.fins, e, { pos: [-6, -P.forearm * 0.5, 0], scale: [12, P.forearm * 0.6, 2], rot: [0, 0, -0.2] });
      if (L.crystals) this.part(cyl, L.crystals, e, { pos: [0, -P.forearm + 13, 0], scale: [9.5 * lw, 18, 9.5 * lw] });
      const wr = new THREE.Group(); wr.position.y = -P.forearm; e.add(wr);
      const hands = this._buildHands(wr, (P.handR || 9) * Math.max(1, lw * 0.92), L.glove || skin);
      if (side === 'F' && this.def.fusion?.perk === 'sword') this._buildSword(wr, P.handR || 9);
      Object.assign(j, { [`sh${side}`]: s, [`el${side}`]: e, [`wr${side}`]: wr, [`hands${side}`]: hands });
    }

    // Legs
    for (const side of ['F', 'B']) {
      const z = (side === 'F' ? 1 : -1) * Wz * 0.4;
      const h = new THREE.Group(); h.position.set((P[`hip${side}`] || 0) * 0.25, 0, z); j.pelvis.add(h);
      this.part(sphereLo, L.pants, h, { scale: 14 * lw, outline: false });
      this.part(limbGeometry(P.thigh, 15.5 * lw, 12.4 * lw, 3 * lw), L.pants, h);
      const k = new THREE.Group(); k.position.y = -P.thigh; h.add(k);
      this.part(sphereLo, L.pants, k, { scale: 12.2 * lw, outline: false });
      this.part(limbGeometry(P.shin, 13 * lw, 9.6 * lw, 3.2 * lw), L.pants, k);
      if (L.plates) this.part(box, L.plates, k, { pos: [9 * lw, -P.shin * 0.55, 0], scale: [6, P.shin * 0.8, 20 * lw] });
      if (L.crystals) this.part(cone, L.crystals, k, { pos: [10, -P.shin * 0.5, 0], scale: [5, 20, 5], rot: [0, 0, -1.1] });
      const a = new THREE.Group(); a.position.y = -P.shin; k.add(a);
      this._buildBoot(a, P.footH || 15, lw);
      Object.assign(j, { [`hip${side}`]: h, [`knee${side}`]: k, [`ankle${side}`]: a });
    }
    if (L.tail) this._buildTail(j.pelvis, Dx);
  }

  _buildBoot(a, footH, lw) {
    const L = this.look;
    const r = 11 * Math.max(0.8, lw * 0.9);
    this.part(cyl, L.boot, a, { pos: [0, 12, 0], scale: [r, 28, r] });
    if (L.bootTrim) this.part(new THREE.TorusGeometry(1, 0.25, 6, 18), L.bootTrim, a, { pos: [0, 26, 0], scale: [r + 0.5, r + 0.5, 4], rot: [Math.PI / 2, 0, 0], outline: false });
    const foot = new THREE.CapsuleGeometry(1, 2.2, 4, 10);
    foot.rotateZ(Math.PI / 2);
    this.part(foot, L.boot, a, { pos: [9, -footH * 0.45, 0], scale: [9.5, footH * 0.6, r * 0.95] });
    if (L.bootToe) this.part(sphere, L.bootToe, a, { pos: [26, -footH * 0.5, 0], scale: [8, footH * 0.5, r * 0.9] });
  }

  _buildHands(wr, R, skin) {
    const shapes = {};
    const finger = new THREE.CapsuleGeometry(R * 0.21, R * 0.85, 3, 8);
    finger.translate(0, -R * 0.62, 0);
    const mk = (name) => { const g = new THREE.Group(); wr.add(g); shapes[name] = g; return g; };
    const palm = (g) => this.part(sphere, skin, g, { pos: [0, -R * 0.95, 0], scale: [R * 0.62, R * 1.0, R * 0.95] });
    const thumb = (g, open) => this.part(finger, skin, g, { pos: [R * 0.3, -R * 0.5, R * 0.75], rot: [open ? 0.9 : 0.4, 0, open ? 0.3 : 0.9], scale: [1, open ? 0.9 : 0.7, 1] });

    const fist = mk('fist');
    this.part(sphere, skin, fist, { pos: [R * 0.12, -R * 1.05, 0], scale: [R * 0.95, R * 0.98, R * 0.98] });
    thumb(fist, false);
    const open = mk('open');
    palm(open); thumb(open, true);
    for (const z of [-0.6, -0.2, 0.2, 0.6]) this.part(finger, skin, open, { pos: [0, -R * 1.75, z * R], rot: [z * 0.25, 0, 0.12] });
    const claw = mk('claw');
    palm(claw); thumb(claw, true);
    for (const z of [-0.6, -0.2, 0.2, 0.6]) this.part(finger, skin, claw, { pos: [R * 0.1, -R * 1.7, z * R], rot: [z * 0.3, 0, 0.95], scale: [1, 0.85, 1] });
    const point = mk('point');
    this.part(sphere, skin, point, { pos: [R * 0.12, -R * 1.05, 0], scale: [R * 0.92, R * 0.95, R * 0.95] });
    this.part(finger, skin, point, { pos: [0, -R * 1.75, R * 0.45], scale: [1, 1.5, 1] });
    thumb(point, false);
    for (const k in shapes) shapes[k].visible = false;
    return shapes;
  }

  /** Spirit Sword: a blade of ki extending from the hand (shown while Vegito slashes). */
  _buildSword(wr, R) {
    const g = new THREE.Group();
    g.position.y = -R * 1.6;
    const glow = this.def.ki?.glow || [120, 200, 255];
    const blade = new THREE.ConeGeometry(1, 1, 10, 1, true);
    blade.rotateZ(Math.PI); // wide end at the hand, point running out past the fingers
    blade.translate(0, -0.5, 0);
    const outer = new THREE.Mesh(blade, new THREE.MeshBasicMaterial({ color: color(glow), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    outer.scale.set(9, 150, 9);
    const core = new THREE.Mesh(blade, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.scale.set(3.6, 140, 3.6);
    g.add(outer, core);
    g.visible = false;
    wr.add(g);
    this.sword = g;
  }

  _buildHead(head, R) {
    const L = this.look;
    const skull = new THREE.SphereGeometry(R, 28, 20);
    const p = skull.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < 0) { const k = -y / R; z *= 1 - 0.3 * k * k; x *= 1 - 0.1 * k; if (x > 0) y *= 1 + 0.12 * k; }
      p.setXYZ(i, x * 0.98, y * 1.06, z * 0.9);
    }
    skull.computeVertexNormals();
    this.part(skull, L.skin, head);
    this.part(sphereLo, L.skin, head, { pos: [R * 0.97, -R * 0.12, 0], scale: [R * 0.12, R * 0.1, R * 0.09], outline: false }); // nose
    if (L.ears) {
      for (const s of [-1, 1]) this.part(cone, L.skin, head, { pos: [-R * 0.1, R * 0.55, s * R * 0.62], scale: [R * 0.32, R * 0.95, R * 0.2], rot: [s * 0.55, 0, -0.15] });
    } else for (const s of [-1, 1]) this.part(sphereLo, L.skin, head, { pos: [-R * 0.08, -R * 0.05, s * R * 0.88], scale: [R * 0.14, R * 0.24, R * 0.1] });
    if (L.earrings) for (const s of [-1, 1]) {
      if (L.earringBall) this.part(sphereLo, L.earrings, head, { pos: [-R * 0.05, -R * 0.52, s * R * 0.86], scale: R * 0.12, outline: false, opts: { emissive: L.earrings, emissiveIntensity: 0.5 } }); // Potara
      else this.part(new THREE.TorusGeometry(R * 0.14, R * 0.035, 6, 14), L.earrings, head, { pos: [-R * 0.05, -R * 0.42, s * R * 0.84], outline: false });
    }
    if (L.halo) {
      this.halo = this.part(new THREE.TorusGeometry(R * 0.8, R * 0.07, 8, 48), L.halo, head, { pos: [-R * 0.2, R * 1.55, 0], rot: [Math.PI / 2, 0.25, 0], outline: false, opts: { emissive: L.halo, emissiveIntensity: 1.5 } });
    }

    // Face: eyes, brows, mouth
    const face = (this.face = { eyes: [], irises: [], brows: [] });
    const E = L.eyes;
    if (E.kind === 'visor') {
      this.part(box, L.visor, head, { pos: [R * 0.84, R * 0.05, 0], scale: [R * 0.18, R * 0.26, R * 1.5], rot: [0, 0, -0.1], opts: { emissive: L.visor, emissiveIntensity: 0.8 } });
    } else {
      for (const s of [-1, 1]) {
        const g = new THREE.Group(); g.position.set(R * 0.8, R * 0.0, s * R * 0.38); g.rotation.y = -s * 0.45; head.add(g);
        if (E.kind === 'glow') {
          const iris = this.part(sphereLo, E.iris, g, { scale: [R * 0.06, R * 0.07, R * 0.2], rot: [s * 0.25, 0, 0], outline: false, opts: { emissive: E.iris, emissiveIntensity: 1.2 } });
          face.irises.push(iris);
        } else {
          this.part(sphereLo, '#ffffff', g, { scale: [R * 0.1, R * 0.2, R * 0.23], outline: false });
          const iris = new THREE.Mesh(sphereLo, toon('#1b1b1b', null, { emissive: '#000000' }));
          iris.scale.set(R * 0.07, R * 0.15, R * 0.12); iris.position.set(R * 0.05, -R * 0.01, -s * R * 0.03);
          g.add(iris);
          face.irises.push(iris);
          const pupil = new THREE.Mesh(sphereLo, new THREE.MeshBasicMaterial({ color: '#050508' }));
          pupil.scale.set(R * 0.025, R * 0.07, R * 0.05); pupil.position.set(R * 0.105, -R * 0.01, -s * R * 0.03);
          g.add(pupil);
          const shine = new THREE.Mesh(sphereLo, new THREE.MeshBasicMaterial({ color: '#ffffff' }));
          shine.scale.setScalar(R * 0.025); shine.position.set(R * 0.12, R * 0.05, -s * R * 0.05);
          g.add(shine);
        }
        const brow = this.part(box, '#15121c', head, { pos: [R * 0.88, R * 0.29, s * R * 0.37], scale: [R * 0.06, R * 0.07, R * 0.34], rot: [0, -s * 0.42, 0], outline: false });
        face.brows.push({ m: brow, s });
      }
    }
    const mouth = new THREE.Mesh(sphereLo, new THREE.MeshBasicMaterial({ color: '#4a0f16' }));
    mouth.position.set(R * 0.9, -R * 0.5, 0);
    mouth.scale.set(R * 0.05, R * 0.06, R * 0.22);
    head.add(mouth);
    face.mouth = mouth;
    const teeth = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: '#f4f2ee' }));
    teeth.position.set(R * 0.93, -R * 0.5, 0);
    teeth.scale.set(R * 0.04, R * 0.08, R * 0.32);
    teeth.visible = false;
    head.add(teeth);
    face.teeth = teeth;

    if (L.helm) {
      const cap = new THREE.SphereGeometry(R * 1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
      this.part(cap, L.helm.color, head, { rot: [0, 0, 0.32], pos: [-R * 0.04, R * 0.04, 0] });
      for (const s of [-1, 1]) {
        const horn = new THREE.Group(); horn.position.set(R * 0.1, R * 0.7, s * R * 0.72); horn.rotation.set(s * -0.7, 0, -0.5); head.add(horn);
        this.part(cone, L.helm.horn, horn, { scale: [R * 0.2, R * 1.2, R * 0.2] });
      }
    }
    if (L.crystals) for (const [x, h, z] of [[-0.4, 1.1, -0.35], [-0.1, 1.4, 0], [0.25, 1.15, 0.35], [-0.5, 0.9, 0.4]]) {
      this.part(cone, L.crystals, head, { pos: [x * R, R * 0.6, z * R], scale: [R * 0.24, R * h, R * 0.24], rot: [z * 0.6, 0, x * 0.5], opts: { emissive: L.crystals, emissiveIntensity: 0.3 } });
    }

    // Hair: a cap plus a single dynamic mesh of spikes, morphed between forms
    if (L.hair === 'spikes') {
      const capGeo = new THREE.SphereGeometry(R * 1.04, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
      this.hairMat = toon('#ffffff', this.u, { vertexColors: true, emissive: '#000000' });
      this.allMats.push(this.hairMat);
      this.capMat = toon('#222222', this.u, { emissive: '#000000' });
      this.allMats.push(this.capMat);
      this.part(capGeo, this.capMat, head, { rot: [0, 0, 0.42], pos: [-R * 0.06, R * 0.02, 0] });
      this.hair = new HairMesh(R, L.hairSpread);
      const hm = this.part(this.hair.geo, this.hairMat, head);
      hm.frustumCulled = false;
      this.hairR = R;
    }
  }

  _buildScarf(torso, T, Dx) {
    const segs = (this.scarf = []);
    let parent = torso;
    const g0 = new THREE.Group(); g0.position.set(-Dx * 0.5, T * 0.98, 0); torso.add(g0); parent = g0;
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      g.position.x = i ? -22 : 0;
      parent.add(g);
      this.part(box, this.look.scarf, g, { pos: [-11, 0, 0], scale: [24, 7, 2.5] });
      segs.push(g);
      parent = g;
    }
  }

  _buildTail(pelvis, Dx) {
    const segs = (this.tail = []);
    let parent = new THREE.Group();
    parent.position.set(-Dx * 0.8, -4, 0);
    pelvis.add(parent);
    const g0 = new THREE.CapsuleGeometry(4.5, 16, 3, 8);
    g0.translate(0, -12, 0);
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      g.position.y = i ? -22 : 0;
      parent.add(g);
      this.part(g0, this.look.tail, g, { scale: [1 - i * 0.07, 1, 1 - i * 0.07] });
      segs.push(g);
      parent = g;
    }
  }

  /* ── per frame ─────────────────────────────────────────────────────────── */
  update(dt, aura) {
    const r = this.rig, v = r.pose;
    if (!v) return;
    const j = this.j;
    const s = r.scale * U;
    const lunge = Math.sin(Math.min(1, r.lunge || 0) * Math.PI / 2);
    this.root.visible = r.visible !== false;
    this.root.position.set(wx(r.x), wy(r.y), lunge * 0.55);
    this.root.scale.set(r.facing * s, s, s);
    this.root.rotation.y = -TURN * r.facing * (1 - lunge * 0.5) - (r.spinAngle || 0) * r.facing;

    j.body.position.set(v.dx, -r.rootY, 0);
    j.body.rotation.z = -v.rot * DEG;
    j.pelvis.position.y = r.hipH;
    j.torso.rotation.z = -v.lean * DEG;
    j.torso.rotation.y = 0.12; // chest opens a little toward the camera
    j.neck.rotation.z = -v.head * DEG;
    for (const side of ['F', 'B']) {
      j[`sh${side}`].rotation.z = v[`a${side}`] * DEG;
      j[`el${side}`].rotation.z = v[`e${side}`] * DEG;
      j[`wr${side}`].rotation.z = v[`w${side}`] * DEG;
      j[`hip${side}`].rotation.z = v[`h${side}`] * DEG;
      j[`knee${side}`].rotation.z = v[`k${side}`] * DEG;
      j[`ankle${side}`].rotation.z = v[`f${side}`] * DEG;
      const shape = r._hand?.[side] || 'fist';
      const hs = j[`hands${side}`];
      if (hs._shown !== shape) { for (const k in hs) if (k !== '_shown') hs[k].visible = k === shape; hs._shown = shape; }
    }
    this._face(r);
    this._hair(r);
    if (this.halo) this.halo.rotation.z += dt * 0.8;
    if (this.sword) {
      this.sword.visible = !!r.sword;
      if (r.sword) this.sword.scale.set(1 + Math.sin(r.t * 60) * 0.12, 1, 1 + Math.cos(r.t * 55) * 0.12);
    }
    if (this.scarf) this.scarf.forEach((g, i) => { g.rotation.z = Math.sin(r.t * 7 + i * 0.9) * 0.22 + (i ? 0 : 0.35 + v.lean * 0.01); g.rotation.y = Math.sin(r.t * 5 + i) * 0.15; });
    if (this.tail) this.tail.forEach((g, i) => { g.rotation.z = (i ? 0.18 : 1.9) + Math.sin(r.t * 1.7 + i * 0.6) * 0.14; g.rotation.x = Math.sin(r.t * 1.3 + i * 0.5) * 0.12; });

    // Rim light follows the aura; a hit flashes the body white.
    const lv = aura?.level || 0;
    if (lv > 0.02) color(aura.outer, this.u.rimColor.value).lerp(new THREE.Color(1, 1, 1), 0.25);
    else this.u.rimColor.value.setRGB(0.75, 0.82, 1);
    this.u.rimStrength.value = 0.3 + lv * 0.55;
    const fl = Math.max(0, (r.flashUntil || 0) - performance.now());
    this.u.flash.value = fl > 0 ? Math.min(0.75, fl / 90) : 0;
    const op = r.opacity ?? 1;
    if (op !== this._op) {
      this._op = op;
      for (const m of this.allMats) { m.transparent = op < 1; m.opacity = op; }
      this.outline.uniforms.opacity.value = op;
      this.outline.transparent = op < 1;
    }
    this._ghosts(dt, aura);
  }

  _face(r) {
    const f = this.face;
    if (!f) return;
    const expr = r._expr || 'calm';
    if (expr !== this._expr) {
      this._expr = expr;
      const R = this.def.proportions.headR;
      const [h, wd, tilt] = EXPR_MOUTH[expr] || EXPR_MOUTH.calm;
      f.mouth.scale.set(R * 0.05, R * 0.06 * h, R * 0.22 * wd);
      f.mouth.rotation.x = tilt;
      f.mouth.position.y = -R * (0.5 + (h - 0.4) * 0.03);
      f.teeth.visible = expr === 'strain';
      const a = (this.def.exprBrow?.[expr] ?? 0) * DEG;
      for (const b of f.brows) b.m.rotation.x = b.s * a * 1.4;
    }
    const to = r.formTo, from = r.formFrom;
    if (to && f.irises.length && this.look.eyes.kind === 'anime') {
      const t = r.morphT ?? 1;
      const key = `${to.eye}|${from?.eye}|${t.toFixed(2)}`;
      if (key !== this._eyeKey) {
        this._eyeKey = key;
        const c = from ? lerpColor(from.eye, to.eye, t) : to.eye;
        const glowing = (c[0] + c[1] + c[2]) / 3 > 120;
        for (const m of f.irises) { color(c, m.material.color); color(glowing ? c : [0, 0, 0], m.material.emissive); m.material.emissiveIntensity = glowing ? 0.5 : 0; }
      }
    }
  }

  _hair(r) {
    if (!this.hair) return;
    const spikes = this.look.hairSpikes || r._hairNow || r.formTo?.hair;
    if (!spikes) return;
    const to = r.formTo, from = r.formFrom || to;
    const t = r.morphT ?? 1;
    const c = this._hairColors;
    if (this.look.hairColor) { color(this.look.hairColor[0], c.top); color(this.look.hairColor[1], c.bottom); }
    else if (to) { color(lerpColor(from.top, to.top, t), c.top); color(lerpColor(from.bottom, to.bottom, t), c.bottom); }
    this.capMat.color.copy(c.bottom).lerp(c.top, 0.35);
    const bright = (c.top.r + c.top.g + c.top.b) / 3;
    const glow = bright > 0.25 ? 0.1 + 0.15 * (r.hairSway || 0) : 0;
    this.hairMat.emissive.copy(c.top);
    this.hairMat.emissiveIntensity = glow;
    this.capMat.emissive.copy(c.top);
    this.capMat.emissiveIntensity = glow * 0.5;
    this.hair.update(spikes, c, r.t, r.hairSway || 0, this.look.hairSpikes ? 0.25 : 0);
  }

  _ghosts(dt, aura) {
    const q = this.rig.ghostQueue;
    while (q?.length) {
      const g = q.shift();
      if (this.ghosts.length >= 6) this._dropGhost(0);
      const tint = g.cls === 'ui' ? [220, 228, 255] : aura?.level > 0.05 ? aura.outer : [150, 200, 255];
      const mat = new THREE.MeshBasicMaterial({ color: color(tint), transparent: true, opacity: g.opacity * 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
      const clone = this.root.clone(true);
      clone.traverse((o) => { if (o.isMesh) { if (o.userData.outline) o.visible = false; else { o.material = mat; o.castShadow = false; } } });
      clone.position.x += g.offsetX * U;
      this.scene.add(clone);
      this.ghosts.push({ obj: clone, mat, life: g.life, max: g.life, op: g.opacity * 0.8 });
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.life -= dt;
      if (g.life <= 0) { this._dropGhost(i); continue; }
      g.mat.opacity = g.op * (g.life / g.max);
    }
  }

  _dropGhost(i) {
    const g = this.ghosts[i];
    this.scene.remove(g.obj);
    g.mat.dispose();
    this.ghosts.splice(i, 1);
  }

  /** World position of a hand (side 'F' or 'B') or of both hands ('both'). */
  handWorld(side, out = new THREE.Vector3()) {
    if (side === 'both') {
      this.handWorld('F', out);
      const b = this.handWorld('B', this._tmp.clone());
      return out.add(b).multiplyScalar(0.5);
    }
    const wr = this.j[`wr${side}`];
    wr.updateWorldMatrix(true, false);
    return out.set(0, -(this.def.proportions.handR || 9) * 1.1, 0).applyMatrix4(wr.matrixWorld);
  }

  dispose() {
    for (let i = this.ghosts.length - 1; i >= 0; i--) this._dropGhost(i);
    this.scene.remove(this.root);
    this.root.traverse((o) => { if (o.isMesh && o.geometry !== sphere && o.geometry !== sphereLo && o.geometry !== cone && o.geometry !== box && o.geometry !== cyl) o.geometry.dispose(); });
    for (const m of this.allMats) m.dispose();
    this.outline.dispose();
  }
}

/**
 * All of a fighter's hair spikes in one mesh. Each 2D spike (angle round the scalp, length, width,
 * tip direction, curve) is swept to several angles around the head's front–back axis, so the
 * profile hairdo becomes a full 3D one; forms morph by interpolating the same spike parameters.
 */
class HairMesh {
  constructor(R, spread) {
    this.R = R;
    this.spread = spread;
    this.max = 14 * spread.length;
    const V = 11; // 5 base + 5 mid + tip
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.max * V * 3);
    this.col = new Float32Array(this.max * V * 3);
    const idx = [];
    for (let s = 0; s < this.max; s++) {
      const o = s * V;
      for (let k = 0; k < 5; k++) {
        const a = o + k, b = o + ((k + 1) % 5), c = o + 5 + k, d = o + 5 + ((k + 1) % 5);
        idx.push(a, b, c, b, d, c, c, d, o + 10);
      }
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setIndex(idx);
    this.geo.setDrawRange(0, 0);
    this._v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  }

  update(spikes, colors, t, sway, extraSway) {
    const R = this.R, P = this.pos, C = this.col;
    const [base, dir, e1, e2, p] = this._v;
    const up = new THREE.Vector3(0, 0, 1);
    let s = 0;
    const tmp = new THREE.Color();
    const setCol = (i, y) => {
      const k = Math.min(1, Math.max(0, (y / R + 1.3) / 3.4));
      tmp.copy(colors.bottom).lerp(colors.top, k);
      C[i * 3] = tmp.r; C[i * 3 + 1] = tmp.g; C[i * 3 + 2] = tmp.b;
    };
    spikes.forEach((sp, i) => {
      const front = sp.a > 45 ? 0.62 : 1;
      for (const b0 of this.spread) {
        if (s >= this.max) return;
        const beta = b0 * front * DEG;
        const cb = Math.cos(beta), sb = Math.sin(beta);
        const wob = (sway + extraSway) ? Math.sin(t * 9 + i * 1.7 + b0) * (sway + extraSway) * (6 + sp.len * 4) : 0;
        const a = sp.a * DEG, d = (sp.dir + wob) * DEG;
        base.set(Math.sin(a), Math.cos(a) * cb, Math.cos(a) * sb).multiplyScalar(R * 0.88);
        dir.set(Math.sin(d), Math.cos(d) * cb, Math.cos(d) * sb).normalize();
        e1.crossVectors(dir, up);
        if (e1.lengthSq() < 1e-4) e1.set(1, 0, 0);
        e1.normalize();
        e2.crossVectors(dir, e1).normalize();
        const L = sp.len * R * (1 - Math.abs(b0) / 300) * (sp.a > 45 ? 0.5 : 1); // bangs stay short so the eyes show
        const rb = R * Math.sin(Math.max(4, sp.w) * DEG) * 1.25;
        const bend = (sp.curve ?? 0.16) * L;
        const o = s * 11;
        for (let k = 0; k < 5; k++) {
          const th = (k / 5) * Math.PI * 2;
          const cx = Math.cos(th), sx = Math.sin(th);
          p.copy(base).addScaledVector(e1, cx * rb).addScaledVector(e2, sx * rb * 0.75);
          P.set([p.x, p.y, p.z], (o + k) * 3); setCol(o + k, p.y);
          p.copy(base).addScaledVector(dir, L * 0.5).addScaledVector(e2, -bend * 0.5).addScaledVector(e1, cx * rb * 0.55).addScaledVector(e2, sx * rb * 0.42);
          P.set([p.x, p.y, p.z], (o + 5 + k) * 3); setCol(o + 5 + k, p.y);
        }
        p.copy(base).addScaledVector(dir, L);
        P.set([p.x, p.y, p.z], (o + 10) * 3); setCol(o + 10, p.y + R * 0.6);
        s++;
      }
    });
    this.geo.setDrawRange(0, s * 45);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}
