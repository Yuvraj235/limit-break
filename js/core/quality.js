import { QUALITY } from '../config.js';
import { storage } from './storage.js';
import { bus } from './events.js';

export const device = (() => {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const ua = navigator.userAgent || '';
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const iOS = /iPhone|iPad|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  return { touch: coarse || mobileUA, mobile: mobileUA, iOS };
})();

const ORDER = ['low', 'medium', 'high'];

function initialPreset() {
  const saved = storage.get('quality');
  if (saved && ORDER.includes(saved)) return { preset: saved, locked: true };
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (device.mobile) return { preset: mem >= 6 && cores >= 6 ? 'medium' : 'low', locked: false };
  return { preset: mem >= 8 || cores >= 8 ? 'high' : 'medium', locked: false };
}

/** Picks a preset by device class, then steps it down at runtime if FPS sags. */
export const quality = {
  ...initialPreset(),
  fps: 60,
  _lowSince: 0,
  get settings() { return QUALITY[this.preset]; },

  set(preset, persist = true) {
    if (!ORDER.includes(preset)) return;
    this.preset = preset;
    this.locked = persist;
    if (persist) storage.set('quality', preset);
    bus.emit('quality:change', preset);
  },

  sample(dt, now) {
    if (dt <= 0 || dt > 0.25) return;
    this.fps += (1 / dt - this.fps) * 0.05;
    if (this.locked) return;
    if (this.fps < QUALITY.MIN_FPS) {
      if (!this._lowSince) this._lowSince = now;
      if (now - this._lowSince > QUALITY.DOWNGRADE_AFTER_MS) {
        const i = ORDER.indexOf(this.preset);
        if (i > 0) { this.set(ORDER[i - 1], false); console.info('[quality] stepped down to', this.preset); }
        this._lowSince = 0;
      }
    } else this._lowSince = 0;
  },
};
