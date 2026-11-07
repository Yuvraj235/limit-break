import { bus } from '../core/events.js';
import { G } from './gestureDefs.js';

const POSE_KEYS = { KeyK: G.KAME, KeyS: G.SPIRIT, KeyP: G.POWER, KeyG: G.GUARD, KeyF: G.KIBLAST };

/** Laptop controls. Hold a pose key; Space fires; arrows / T teleport; J punch, L kick; U = god form (UI or Ultra Ego). */
export class KeyboardInput {
  constructor() {
    this.held = new Map();   // pose → press time
    this.events = [];
    this.mash = [];
    window.addEventListener('keydown', (e) => this._down(e));
    window.addEventListener('keyup', (e) => this._up(e));
    window.addEventListener('blur', () => this.held.clear());
  }

  _typing(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  _down(e) {
    if (this._typing(e)) return;
    const now = performance.now();
    const pose = POSE_KEYS[e.code];
    if (pose) {
      if (!e.repeat) { this.held.set(pose, now); if (pose === G.POWER) this.mash.push(now); }
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    switch (e.code) {
      case 'Space': this.events.push({ type: 'fire' }); this.mash.push(now); bus.emit('input:advance'); e.preventDefault(); break;
      case 'Enter': bus.emit('input:advance'); break;
      case 'ArrowLeft': this.events.push({ type: 'dodge', dir: -1 }); e.preventDefault(); break;
      case 'ArrowRight': this.events.push({ type: 'dodge', dir: 1 }); e.preventDefault(); break;
      case 'KeyT': this.events.push({ type: 'dodge', dir: 0 }); break;
      case 'KeyJ': this.events.push({ type: 'punch' }); this.mash.push(now); break;
      case 'KeyL': this.events.push({ type: 'kick' }); break;
      case 'KeyX': this.events.push({ type: 'fuse' }); break;
      case 'KeyU': this.events.push({ type: 'ui' }); break;
      case 'KeyD': bus.emit('ui:toggleDebug'); break;
      case 'KeyM': bus.emit('audio:toggleMute'); break;
      case 'Escape': bus.emit('game:pauseToggle'); break;
      default: break;
    }
  }

  _up(e) {
    const pose = POSE_KEYS[e.code];
    if (pose) this.held.delete(pose);
  }

  /** Most recently pressed held pose, or null. */
  pose() {
    let best = null, t = -1;
    for (const [p, at] of this.held) if (at > t) { t = at; best = p; }
    return best;
  }

  since(pose) { return this.held.get(pose) ?? 0; }

  mashRate(now) {
    while (this.mash.length && now - this.mash[0] > 1000) this.mash.shift();
    return this.mash.length;
  }

  drain() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
