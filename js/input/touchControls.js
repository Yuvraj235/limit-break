import { G } from './gestureDefs.js';

const BUTTONS = [
  { id: 'dodgeL', label: '◀✌', event: 'dodge', dir: -1, group: 'left', title: 'Instant Transmission back' },
  { id: 'dodgeR', label: '✌▶', event: 'dodge', dir: 1, group: 'left', title: 'Instant Transmission forward' },
  { id: 'guard', label: 'BARRIER', pose: G.GUARD, group: 'left', title: 'Energy Barrier' },
  { id: 'punch', label: 'PUNCH', event: 'punch', group: 'left', mash: true },
  { id: 'kick', label: 'KICK', event: 'kick', group: 'left' },
  { id: 'ui', label: 'UI', event: 'ui', group: 'left', title: 'God form', hidden: true },
  { id: 'fuse', label: 'FUSE', event: 'fuse', group: 'left', title: 'Fusion', hidden: true },
  { id: 'kiblast', label: 'BLAST', pose: G.KIBLAST, group: 'right' },
  { id: 'power', label: 'POWER', pose: G.POWER, group: 'right', mash: true },
  { id: 'kame', label: 'BEAM', pose: G.KAME, group: 'right', title: 'Hold to charge, release to fire' },
  { id: 'spirit', label: 'BOMB', pose: G.SPIRIT, group: 'right', title: 'Hold to gather, release to throw' },
];

/** On-screen controls (always available on touch devices; also work with a mouse). */
export class TouchControls {
  constructor(container, swipeSurface) {
    this.container = container;
    this.held = new Map();
    this.events = [];
    this.mash = [];
    this.buttons = {};
    this._build();
    this._swipe(swipeSurface);
  }

  _build() {
    const groups = {};
    for (const name of ['left', 'right']) {
      groups[name] = document.createElement('div');
      groups[name].className = `tc-group tc-${name}`;
      this.container.appendChild(groups[name]);
    }
    for (const b of BUTTONS) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `tc-btn tc-${b.id}`;
      el.textContent = b.label;
      el.setAttribute('aria-label', b.title || b.label);
      if (b.hidden) el.hidden = true;
      groups[b.group].appendChild(el);
      this.buttons[b.id] = el;
      const down = (e) => {
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('is-down');
        const now = performance.now();
        if (b.pose) this.held.set(b.pose, now);
        if (b.event) this.events.push({ type: b.event, dir: b.dir });
        if (b.mash || b.pose === G.KAME) this.mash.push(now);
      };
      const up = (e) => {
        e.preventDefault();
        el.classList.remove('is-down');
        if (b.pose) this.held.delete(b.pose);
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  _swipe(surface) {
    if (!surface) return;
    let start = null;
    surface.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, input, a, .modal')) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    surface.addEventListener('pointerup', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y, dt = performance.now() - start.t;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 400) {
        this.events.push({ type: 'dodge', dir: Math.sign(dx) });
      } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        this.mash.push(performance.now()); // stage taps also count as beam-struggle pushes
      }
      start = null;
    });
  }

  setFusion(on, label = 'FUSE') { this.buttons.fuse.hidden = !on; this.buttons.fuse.textContent = label; }

  setUIUnlocked(on, label) {
    this.buttons.ui.hidden = !on;
    if (label) this.buttons.ui.textContent = label;
  }

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

  release() {
    this.held.clear();
    for (const el of Object.values(this.buttons)) el.classList.remove('is-down');
  }

  drain() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
