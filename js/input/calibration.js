import { GESTURE } from '../config.js';
import { clamp, lerp } from '../core/math.js';
import { storage } from '../core/storage.js';

/**
 * Per-player tuning. Phones and laptops frame the player very differently, so the "hands raised"
 * line is learned in the tutorial from the player's own neutral and raised palm heights.
 * (Stored as 'calib2': the older 'calib' measured wrists.)
 */
/** The per-hand vector templates compare: four finger curls, finger spread and thumb reach. */
export const shapeVector = (h) => [...h.curls, h.spread / 1.5, h.thumbOut / 1.5];
export const SHAPES = ['open', 'fist', 'point', 'peace', 'wide'];

export const calibration = {
  raiseY: storage.get('calib2')?.raiseY ?? GESTURE.RAISE_Y,
  /** {shape: {mean, sd}} recorded from the player's own hands in the calibration screen, or null. */
  templates: storage.get('handTpl2') || null, // v2: older recordings could contain mislabelled frames

  saveTemplates(samples) {
    const tpl = {};
    for (const [shape, vecs] of Object.entries(samples)) {
      if (vecs.length < 8) continue;
      const n = vecs[0].length;
      // median per feature: a few stray frames can't drag the template
      const mean = Array.from({ length: n }, (_, i) => { const xs = vecs.map((v) => v[i]).sort((a, b) => a - b); return xs[xs.length >> 1]; });
      const sd = mean.map((m, i) => Math.sqrt(vecs.reduce((s, v) => s + (v[i] - m) ** 2, 0) / vecs.length));
      tpl[shape] = { mean, sd };
    }
    // Two shapes that came out nearly the same would only confuse each other: drop both and let
    // geometry plus the trained model handle them.
    const conflicts = [];
    const names = Object.keys(tpl);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = tpl[names[i]], b = tpl[names[j]];
        if (!a || !b) continue;
        // distinguishable if ANY measurement differs clearly (e.g. finger spread alone separates relaxed from wide)
        let d = 0;
        for (let k = 0; k < a.mean.length; k++) d = Math.max(d, Math.abs(a.mean[k] - b.mean[k]) / Math.max(a.sd[k], b.sd[k], 0.12));
        if (d < 1.5) conflicts.push([names[i], names[j]]); // e.g. a ✌️ recorded identical to 👉
      }
    }
    for (const [x, y] of conflicts) { delete tpl[x]; delete tpl[y]; }
    this.conflicts = conflicts;
    this.templates = Object.keys(tpl).length >= 2 ? tpl : null;
    storage.set('handTpl2', this.templates);
    return this.templates;
  },

  /** Similarity 0..1 of a hand to each recorded shape (1 = within one standard deviation). */
  match(h) {
    return this.templates ? this.matchVector(shapeVector(h)) : null;
  },

  matchVector(v) {
    if (!this.templates) return null;
    const out = {};
    for (const [shape, { mean, sd }] of Object.entries(this.templates)) {
      let d = 0;
      for (let i = 0; i < v.length; i++) d += ((v[i] - mean[i]) / Math.max(sd[i], 0.09)) ** 2;
      out[shape] = Math.exp(-(d / v.length) / 2);
    }
    return out;
  },

  clearTemplates() {
    this.templates = null;
    this.raiseBody = null;
    storage.remove('handTpl');
    storage.remove('handTpl2');
    storage.remove('raiseBody');
  },

  raiseBody: storage.get('raiseBody') || null,

  get cfg() { return { ...GESTURE, RAISE_Y: this.raiseY, ...(this.raiseBody || {}) }; },

  /** Shoulder-relative raise thresholds from the player's own chest and raised hand heights. */
  saveBody(chestRel, raisedRel) {
    if (!(raisedRel > chestRel + 0.2)) return false;
    this.raiseBody = { RAISE_BODY_MIN: chestRel + 0.35 * (raisedRel - chestRel), RAISE_BODY_FULL: chestRel + 0.75 * (raisedRel - chestRel) };
    storage.set('raiseBody', this.raiseBody);
    return true;
  },

  save(neutralY, raisedY) {
    if (!(neutralY > raisedY)) return false;
    this.raiseY = clamp(lerp(raisedY, neutralY, 0.45), 0.18, 0.62);
    storage.set('calib2', { raiseY: this.raiseY });
    return true;
  },

  reset() {
    this.raiseY = GESTURE.RAISE_Y;
    storage.remove('calib2');
  },
};
