import { AUDIO } from '../config.js';
import { bus } from '../core/events.js';
import { storage } from '../core/storage.js';

/**
 * Synthesized sound effects (WebAudio, no asset files). The context is created on the first user
 * gesture, which iOS requires. Every voice is a short oscillator/noise patch.
 */
export class SFX {
  constructor() {
    this.ctx = null;
    this.muted = storage.get('muted2') ?? true; // sound is off unless the player turns it on (🔇 button)
    this.loops = {};
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.comp = this.ctx.createDynamicsCompressor();
        this.comp.threshold.value = -14;
        this.comp.ratio.value = 6;
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : AUDIO.MASTER;
        this.master.connect(this.comp).connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 2;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (err) { console.warn('[audio] unavailable', err); }
  }

  setMuted(m) {
    this.muted = m;
    storage.set('muted2', m);
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : AUDIO.MASTER, this.ctx.currentTime, 0.05);
    bus.emit('audio:muted', m);
  }

  get ready() { return this.ctx && this.ctx.state === 'running'; }

  _env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  tone(type, f0, f1, dur, peak = 0.3, attack = 0.005) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    this._env(g, t, attack, peak, dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  noise(dur, peak, type = 'bandpass', f0 = 800, f1 = 800, q = 1, attack = 0.005) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    this._env(g, t, attack, peak, dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + attack + dur + 0.05);
  }

  /* looping voices */
  loopStart(name, build) {
    if (!this.ready || this.loops[name]) return;
    const out = this.ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(this.master);
    const nodes = build(out);
    out.gain.setTargetAtTime(1, this.ctx.currentTime, 0.08);
    this.loops[name] = { out, nodes };
  }

  loopStop(name, fade = 0.15) {
    const l = this.loops[name];
    if (!l) return;
    delete this.loops[name];
    const t = this.ctx.currentTime;
    l.out.gain.setTargetAtTime(0.0001, t, fade / 3);
    setTimeout(() => { for (const n of l.nodes) { try { n.stop?.(); n.disconnect(); } catch { /* already stopped */ } } l.out.disconnect(); }, fade * 1000 + 200);
  }

  loopParam(name, fn) { const l = this.loops[name]; if (l) fn(l.nodes, this.ctx.currentTime); }

  chargeLoop() {
    this.loopStart('charge', (out) => {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 90;
      const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 180;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 6;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 9;
      const lg = this.ctx.createGain(); lg.gain.value = 120;
      lfo.connect(lg).connect(f.frequency);
      const g = this.ctx.createGain(); g.gain.value = 0.12;
      o.connect(f); o2.connect(f); f.connect(g).connect(out);
      o.start(); o2.start(); lfo.start();
      return [o, o2, lfo, f, g, lg];
    });
  }

  setCharge(k) {
    this.loopParam('charge', ([o, o2, , f], t) => {
      o.frequency.setTargetAtTime(90 + k * 160, t, 0.05);
      o2.frequency.setTargetAtTime(180 + k * 320, t, 0.05);
      f.frequency.setTargetAtTime(500 + k * 2200, t, 0.05);
    });
  }

  rumbleLoop(name = 'aura', level = 0.18) {
    this.loopStart(name, (out) => {
      const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
      const g = this.ctx.createGain(); g.gain.value = level;
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 48;
      const og = this.ctx.createGain(); og.gain.value = level * 0.35;
      src.connect(f).connect(g).connect(out);
      o.connect(og).connect(out);
      src.start(); o.start();
      return [src, o, f, g, og];
    });
  }

  /* one-shots */
  kiBlast() { this.tone('square', 1100, 180, 0.14, 0.12); this.noise(0.1, 0.12, 'highpass', 2000, 4000); }
  beam(power = 1) { this.noise(0.9 + power * 0.6, 0.35, 'lowpass', 3000, 400, 0.7, 0.02); this.tone('sawtooth', 160, 70, 1.0 + power * 0.5, 0.14, 0.02); }
  hit(heavy) { this.tone('sine', heavy ? 160 : 220, 40, heavy ? 0.35 : 0.18, heavy ? 0.6 : 0.35); this.noise(heavy ? 0.25 : 0.1, heavy ? 0.4 : 0.22, 'lowpass', 2400, 300); }
  block() { this.tone('triangle', 1400, 900, 0.18, 0.15); this.tone('triangle', 2100, 1500, 0.14, 0.08); }
  whoosh() { this.noise(0.22, 0.2, 'bandpass', 500, 2600, 1.2, 0.02); }
  swing() { this.noise(0.12, 0.12, 'bandpass', 900, 2200, 1.5); }
  explosion(scale = 1) { this.noise(1.2 * scale, 0.6, 'lowpass', 1800, 80, 0.7, 0.01); this.tone('sine', 90, 25, 1.1 * scale, 0.7); }
  transform() { this.tone('sawtooth', 70, 640, 0.9, 0.16, 0.05); this.noise(1.0, 0.25, 'bandpass', 300, 3200, 0.8, 0.05); setTimeout(() => this.explosion(0.8), 500); }
  ui() { [880, 1320, 1760, 2640].forEach((f, i) => setTimeout(() => this.tone('sine', f, f * 1.01, 1.4, 0.07, 0.15), i * 70)); }
  hakai() { this.noise(1.1, 0.35, 'lowpass', 120, 1200, 2, 0.9); this.tone('sawtooth', 55, 35, 1.4, 0.18, 0.4); }
  gong() { this.tone('sine', 220, 214, 2.2, 0.35, 0.005); this.tone('sine', 331, 327, 1.8, 0.2, 0.005); this.noise(0.25, 0.2, 'bandpass', 900, 600); }
  warn() { this.tone('square', 660, 660, 0.08, 0.08); setTimeout(() => this.tone('square', 660, 660, 0.08, 0.08), 120); }
  click() { this.tone('triangle', 900, 700, 0.05, 0.08); }
  deflect() { this.tone('square', 300, 1200, 0.2, 0.12); this.noise(0.4, 0.25, 'highpass', 1200, 3000); }

  attach() {
    const on = (t, fn) => bus.on(t, fn);
    on('audio:toggleMute', () => { this.unlock(); this.setMuted(!this.muted); });
    on('combat:charge', ({ fighter, kind }) => {
      if (!fighter.isPlayer) return;
      if (kind) this.chargeLoop(); else this.loopStop('charge');
    });
    on('combat:fire', ({ kind, power = 1, fighter }) => {
      if (fighter.isPlayer) this.loopStop('charge');
      if (kind === 'kiblast' || kind === 'volley') this.kiBlast();
      else if (kind === 'kame' || kind === 'beam') this.beam(power);
      else if (kind === 'spirit' || kind === 'sphere') this.whoosh();
    });
    on('combat:hit', ({ blocked, heavy }) => (blocked ? this.block() : this.hit(heavy)));
    on('combat:dodge', ({ auto }) => (auto ? this.ui() : this.whoosh()));
    on('combat:transform', () => this.transform());
    on('combat:ui', () => this.ui());
    on('combat:powerup', ({ fighter, on: active }) => { if (fighter.isPlayer) { if (active) this.rumbleLoop('aura'); else this.loopStop('aura', 0.4); } });
    on('combat:explode', ({ kind }) => (kind === 'hakai' ? this.hakai() : this.explosion(1.3)));
    on('combat:telegraph', ({ unblockable }) => unblockable && this.warn());
    on('combat:special', ({ kind }) => (kind === 'hakai' ? this.hakai() : kind === 'deflect' ? this.deflect() : null));
    on('combat:swing', () => this.swing());
    on('combat:slam', () => this.explosion(0.6));
    on('combat:struggle', ({ phase }) => { if (phase === 'start') this.rumbleLoop('struggle', 0.3); else { this.loopStop('struggle'); this.explosion(1.2); } });
    on('combat:fight', () => this.gong());
    on('combat:ringout', () => this.whoosh());
    on('combat:end', () => { for (const k of Object.keys(this.loops)) this.loopStop(k); });
    on('ui:click', () => this.click());
  }

  tick(combat) {
    const p = combat?.p1;
    if (p && p.state === 'charge_kame') this.setCharge(p.charge);
    else if (p && p.state === 'charge_spirit') this.setCharge(p.charge * 0.6);
    if (p && p.state !== 'powerup' && this.loops.aura) this.loopStop('aura', 0.4);
    if (p && p.state !== 'charge_kame' && p.state !== 'charge_spirit' && this.loops.charge) this.loopStop('charge');
  }
}
