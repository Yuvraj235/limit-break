// Tiny pub/sub bus. Layers talk only through events, never by reaching into each other.
export class EventBus {
  constructor() { this.handlers = new Map(); }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }

  emit(type, payload) {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error(`[bus] ${type} handler failed`, err); }
    }
  }
}

export const bus = new EventBus();
