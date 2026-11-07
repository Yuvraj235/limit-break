import { FORMS, STAGE, TIMING } from '../config.js';
import { bus } from '../core/events.js';
import { quality } from '../core/quality.js';
import { clamp } from '../core/math.js';
import { GESTURE_LABELS, GESTURE_IDS, GESTURE_ICONS } from '../input/gestureDefs.js';
import { beamOf } from '../combat/combat.js';
import { PERSONAS } from '../dialogue/personas.js';

const SOURCE_LABEL = { gemini: 'Gemini', mock: 'Offline lines', 'mock-error': 'Offline (Gemini error)', 'mock-rate': 'Offline (rate cap)' };
const CAMERA_TEXT = {
  off: 'Camera off', requesting: 'Waiting for camera…', denied: 'Camera blocked: using touch/keys', nocamera: 'No camera found',
  unsupported: 'Camera not supported here', error: 'Camera error', loading: 'Loading hand tracker…', idle: 'Starting…', tracking: '', ready: '',
};

/** Fight HUD, speech bubbles, banners, tutorial panel, gesture chip and debug overlay. */
export class HUD {
  constructor(app) {
    this.app = app;
    const root = (this.root = document.getElementById('hud'));
    root.innerHTML = `
      <div class="hud-top">
        <div class="fbar p1"><div class="fname"><span class="name"></span><span class="form"></span></div>
          <div class="hp"><i class="lag"></i><i class="fill"></i></div><div class="ki"><i class="fill"></i><b>KI</b></div></div>
        <div class="timer"><span class="t">--</span><span class="ch"></span></div>
        <div class="fbar p2"><div class="fname"><span class="name"></span><span class="form"></span></div>
          <div class="hp"><i class="lag"></i><i class="fill"></i></div></div>
      </div>
      <div class="hud-charge"><div class="label"></div><div class="meter"><i></i></div><div class="hint"></div></div>
      <div class="hud-struggle"><div class="label">BEAM STRUGGLE</div><div class="meter"><i class="p1"></i><i class="p2"></i><b></b></div><div class="hint">PUSH! Shake your fists · mash Space · tap</div></div>
      <div class="hud-ui-ring"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"></circle><circle class="arc" cx="20" cy="20" r="17"></circle></svg><span>UI</span></div>
      <div class="hud-banner"></div>
      <div class="hud-announce"></div>
      <div class="hud-warn">DODGE!</div>
      <div class="hud-bubbles"></div>
      <div class="hud-dialogue-src" title="Where fight dialogue comes from"></div>`;
    const q = (s) => root.querySelector(s);
    this.el = {
      top: q('.hud-top'),
      p1: { name: q('.p1 .name'), form: q('.p1 .form'), hp: q('.p1 .hp .fill'), lag: q('.p1 .hp .lag'), ki: q('.p1 .ki .fill'), bar: q('.fbar.p1') },
      p2: { name: q('.p2 .name'), form: q('.p2 .form'), hp: q('.p2 .hp .fill'), lag: q('.p2 .hp .lag'), bar: q('.fbar.p2') },
      timer: q('.timer .t'), chapter: q('.timer .ch'),
      charge: q('.hud-charge'), chargeLabel: q('.hud-charge .label'), chargeFill: q('.hud-charge .meter i'), chargeHint: q('.hud-charge .hint'),
      struggle: q('.hud-struggle'), sP1: q('.hud-struggle .p1'), sP2: q('.hud-struggle .p2'), sMark: q('.hud-struggle b'),
      ring: q('.hud-ui-ring'), ringArc: q('.hud-ui-ring .arc'), ringLabel: q('.hud-ui-ring span'),
      banner: q('.hud-banner'), announce: q('.hud-announce'), warn: q('.hud-warn'), bubbles: q('.hud-bubbles'), src: q('.hud-dialogue-src'),
    };
    this.info = document.getElementById('hud-info');
    this.info.innerHTML = `
      <div class="tut" hidden><div class="tut-head"><span class="tut-step"></span><button type="button" class="tut-skip">Skip step</button></div>
        <div class="tut-title"></div><div class="tut-text"></div><div class="tut-keys"></div><div class="tut-bar"><i></i></div></div>
      <div class="toast" hidden></div>`;
    this.tut = {
      box: this.info.querySelector('.tut'), step: this.info.querySelector('.tut-step'), title: this.info.querySelector('.tut-title'),
      text: this.info.querySelector('.tut-text'), keys: this.info.querySelector('.tut-keys'), bar: this.info.querySelector('.tut-bar i'),
    };
    this.info.querySelector('.tut-skip').addEventListener('click', () => app.director.skipStep());
    this.toastEl = this.info.querySelector('.toast');
    this.chip = document.getElementById('gesture-chip');
    this.debugEl = document.getElementById('debug');
    this.debugOn = false;
    this.bubbles = [];
    this._lastHp = {};

    bus.on('dialogue:line', (l) => this.say(l));
    bus.on('dialogue:status', () => this.updateSource());
    bus.on('ui:toggleDebug', () => { this.debugOn = !this.debugOn; this.debugEl.hidden = !this.debugOn; });
    bus.on('combat:fight', () => this.banner('FIGHT!', 'fight', 900));
    bus.on('combat:start', () => this.banner(app.director.chapter?.tutorial ? 'TRAINING' : 'ROUND START', 'start', 1400));
    bus.on('combat:transform', ({ fighter, form }) => fighter.isPlayer && this.banner(FORMS[form].name.toUpperCase(), form.startsWith('ui') ? 'ui' : 'ssj', 1500));
    bus.on('combat:ringout', () => this.banner('ELIMINATED', 'ko', 2000));
    bus.on('combat:fusion', ({ fighter, on, name }) => {
      if (!fighter.isPlayer) return;
      this.el.p1.name.textContent = fighter.def.name.toUpperCase();
      if (on) this.banner(`${fighter.fused?.perks.method === 'potara' ? 'POTARA' : 'FUSION'}! ${name.toUpperCase()}`, 'ui', 1800);
      else this.toast('The fusion wore off.', 2500);
    });
    bus.on('combat:surge', ({ fighter, name }) => this.banner(`${fighter.def.name.toUpperCase()}: ${name}`, 'ko', 1800));
    bus.on('combat:ultimate', ({ fighter, name }) => fighter.isPlayer && this.banner(name.toUpperCase(), 'ssj', 1500));
    bus.on('combat:purify', ({ fighter }) => this.toast(`${fighter.def.name}'s power surge was purged!`, 2500));
    bus.on('combat:burnout', () => this.toast('Vegito burned through the Potara\'s power: the fusion split!', 3500));
    bus.on('combat:end', ({ method, winner }) => {
      if (method === 'ko') this.banner('K.O.', 'ko', 2000);
      else if (method === 'time') this.banner('TIME UP', 'ko', 2000);
      else if (method === 'test') this.banner('TEST PASSED', 'ssj', 2000);
      else if (method === 'training') this.banner('TRAINING COMPLETE', 'ssj', 2000);
    });
    bus.on('combat:lowki', ({ fighter }) => fighter.isPlayer && this.toast('Low ki! Make fists to power up.', 1800));
    bus.on('combat:telegraph', ({ fighter, unblockable }) => {
      if (fighter.isPlayer || !unblockable) return;
      this.el.warn.classList.remove('is-on');
      void this.el.warn.offsetWidth;
      this.el.warn.classList.add('is-on');
    });
    bus.on('cutscene:open', () => root.classList.add('is-cutscene'));
    bus.on('cutscene:close', () => root.classList.remove('is-cutscene'));
    this.updateSource();
  }

  bind(combat, chapter) {
    const { p1, p2 } = combat;
    this.el.p1.name.textContent = p1.def.name.toUpperCase();
    this.el.p2.name.textContent = p2.def.name.toUpperCase();
    this.el.p2.form.textContent = p2.def.title || '';
    this.el.chapter.textContent = chapter ? (chapter.num ? `Chapter ${chapter.num}` : chapter.title) : '';
    this.clearBubbles();
    this._lastHp = {};
    this.root.classList.add('is-fight');
  }

  hide() { this.root.classList.remove('is-fight'); this.tutorial(null); this.clearBubbles(); }

  update(combat, input, camInput, cam) {
    if (!combat) return;
    const { p1, p2 } = combat;
    this._bar(this.el.p1, p1);
    this._bar(this.el.p2, p2);
    this.el.p1.ki.style.width = `${(p1.ki / p1.maxKi) * 100}%`;
    this.el.p1.bar.classList.toggle('ki-low', p1.ki < 15);
    let formText = FORMS[p1.form]?.name || '';
    if (p1.fused) {
      if (Number.isFinite(p1.fused.t)) formText += ` · ${p1.fused.perks.label || 'fusion'} ${Math.ceil(p1.fused.t)}s`;
      const u = p1.fused.perks.ultimate;
      if (u) formText += p1.cd.ultimate > 0 ? ` · ${u.name} ${Math.ceil(p1.cd.ultimate)}s` : p1.ki >= u.cost ? ` · ✦ ${u.name} ready (👉👈)` : '';
    }
    if (p1.rage > 0.01) formText += ` · rage +${Math.round(p1.rage * 100)}%`;
    if (this.el.p1.form.textContent !== formText) this.el.p1.form.textContent = formText;
    this.el.timer.textContent = combat.opts.timeLimit ? Math.ceil(combat.timeLeft) : '∞';

    const charging = p1.state === 'charge_kame' || p1.state === 'charge_spirit';
    this.el.charge.classList.toggle('is-on', charging);
    if (charging) {
      const spirit = p1.state === 'charge_spirit';
      this.el.chargeLabel.textContent = (spirit ? (p1.def.moves?.bomb.name || 'Spirit Bomb') : beamOf(p1, p1.charge).name).toUpperCase();
      this.el.chargeFill.style.width = `${p1.charge * 100}%`;
      const ready = p1.charge >= (spirit ? 0.3 : 0.25);
      this.el.chargeHint.textContent = ready ? (spirit ? 'Lower your hands to throw' : 'Push forward to fire') : 'Charging…';
      this.el.charge.classList.toggle('is-ready', ready);
    }

    const s = combat.struggle;
    this.el.struggle.classList.toggle('is-on', !!s);
    if (s) {
      const k = clamp((s.pos - s.leftX) / (s.rightX - s.leftX));
      this.el.sP1.style.width = `${k * 100}%`;
      this.el.sP2.style.width = `${(1 - k) * 100}%`;
      this.el.sMark.style.left = `${k * 100}%`;
    }

    // Next-form meter: which form the next full power-up leads to, filling while you hold ✊ at full ki.
    const next = combat.state === 'fight' ? combat.nextFormOf(p1) : null;
    this.el.ring.classList.toggle('is-on', !!next);
    if (next) {
      this.el.ringArc.style.strokeDashoffset = `${(1 - clamp(p1.transformMeter / TIMING.TRANSFORM_HOLD_MS)) * 106.8}`;
      if (this._ringForm !== next) { this.el.ringLabel.textContent = FORMS[next].short; this.el.ring.title = `Next: ${FORMS[next].name}. Hold ✊ at full ki.`; this._ringForm = next; }
    }

    this._positionBubbles(combat, cam);
    this.updateChip(input, camInput);
    if (this.debugOn) this.updateDebug(input, camInput);
  }

  _bar(el, f) {
    const k = clamp(f.hp / f.maxHp);
    el.hp.style.width = `${k * 100}%`;
    el.hp.classList.toggle('is-low', k < 0.25);
    if (this._lastHp[f.side] !== k) { el.lag.style.width = `${k * 100}%`; this._lastHp[f.side] = k; }
  }

  /* ── speech ───────────────────────────────────────────────────────────── */
  say({ speaker, text, source }) {
    const persona = PERSONAS[speaker];
    if (speaker === 'arbiter') {
      this.el.announce.textContent = text;
      this.el.announce.classList.remove('is-on');
      void this.el.announce.offsetWidth;
      this.el.announce.classList.add('is-on');
      this.lastSource = source;
      this.updateSource();
      return;
    }
    const c = this.app.combat;
    if (!c) return;
    const fighter = [c.p1, c.p2].find((f) => f.def.id === speaker);
    if (!fighter) return;
    for (const b of this.bubbles.filter((b) => b.fighter === fighter)) this._removeBubble(b);
    const el = document.createElement('div');
    el.className = `bubble ${fighter.isPlayer ? 'left' : 'right'}`;
    el.style.setProperty('--accent', persona?.color || '#fff');
    el.textContent = text;
    this.el.bubbles.appendChild(el);
    const b = { el, fighter, until: performance.now() + 2900 };
    this.bubbles.push(b);
    this._positionBubbles(c, this.app.cam);
    this.lastSource = source;
    this.updateSource();
  }

  _removeBubble(b) {
    b.el.remove();
    this.bubbles.splice(this.bubbles.indexOf(b), 1);
  }

  clearBubbles() { for (const b of [...this.bubbles]) this._removeBubble(b); }

  _positionBubbles(combat, cam) {
    const now = performance.now();
    for (const b of [...this.bubbles]) {
      if (now > b.until) { this._removeBubble(b); continue; }
      const a = b.fighter.rig.anchors.top;
      if (!a) continue;
      const { x, y } = this.app.project(a.x, a.y - 20);
      b.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  updateSource() {
    const d = this.app.dialogue;
    let label;
    if (!d.hasKey) label = 'Dialogue: offline lines';
    else if (d.status === 'error') label = `Dialogue: offline fallback (${d.lastError || 'Gemini error'})`;
    else label = `Dialogue: ${SOURCE_LABEL[this.lastSource] || 'Gemini'}`;
    this.el.src.textContent = label;
    this.el.src.dataset.state = !d.hasKey ? 'offline' : d.status;
  }

  /* ── banners & toasts ─────────────────────────────────────────────────── */
  banner(text, kind = 'start', ms = 1400) {
    const el = this.el.banner;
    el.textContent = text;
    el.dataset.kind = kind;
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => el.classList.remove('is-on'), ms);
  }

  toast(text, ms = 2500) {
    this.toastEl.textContent = text;
    this.toastEl.hidden = false;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { this.toastEl.hidden = true; }, ms);
  }

  /* ── tutorial ─────────────────────────────────────────────────────────── */
  tutorial(info) {
    const t = this.tut;
    if (!info) { t.box.hidden = true; return; }
    t.box.hidden = false;
    t.box.classList.remove('is-done');
    t.step.textContent = `Step ${info.index + 1} / ${info.total}`;
    t.title.textContent = info.step.title;
    t.text.textContent = info.step.text;
    t.keys.textContent = info.step.keys;
    t.bar.style.width = '0%';
  }
  tutorialText(text) { this.tut.text.textContent = text; }
  tutorialProgress(k) { this.tut.bar.style.width = `${clamp(k) * 100}%`; }
  tutorialDone() { this.tut.box.classList.add('is-done'); }

  /* ── gesture chip & debug ─────────────────────────────────────────────── */
  updateChip(input, camInput) {
    const status = camInput.status;
    const msg = CAMERA_TEXT[status];
    let text;
    const framing = camInput.F?.body?.framing;
    document.getElementById('app').dataset.framing = camInput.camera.live ? framing || '' : '';
    if (input.source !== 'none') text = `${GESTURE_ICONS[input.pose]} ${GESTURE_LABELS[input.pose]} · ${input.source}`;
    else if (framing === 'close') text = '📏 Too close: sit back so both hands fit';
    else if (framing === 'far') text = '📏 Too far: come a little closer';
    else if (msg) text = msg;
    else text = camInput.state.hands ? `${GESTURE_ICONS[input.pose]} ${GESTURE_LABELS[input.pose]} · ${camInput.state.hands} hand${camInput.state.hands > 1 ? 's' : ''}` : 'Show your hands to the camera';
    if (this._chipText !== text) { this.chip.textContent = text; this._chipText = text; }
    this.chip.dataset.active = input.pose !== 'idle' ? '1' : '0';
  }

  updateDebug(input, camInput) {
    const d = camInput.debug;
    const lat = this.app.latency;
    const rows = GESTURE_IDS.map((id) => {
      const v = d.scores?.[id] || 0;
      return `<div class="dbg-row"><span>${GESTURE_LABELS[id]}</span><i style="width:${(v * 100).toFixed(0)}%"></i><em>${v.toFixed(2)}</em></div>`;
    }).join('');
    this.debugEl.innerHTML = `
      <div><b>Render</b> ${quality.fps.toFixed(0)} fps · ${quality.preset}</div>
      <div><b>Camera</b> ${camInput.status} · ${d.fps.toFixed(0)} fps · ${camInput.tracker.delegate || '-'}</div>
      <div><b>Inference</b> ${d.inferenceMs.toFixed(1)} ms</div>
      <div><b>Frame → screen</b> ${lat ? `${lat.toFixed(0)} ms` : '-'}</div>
      <div><b>Pose</b> ${GESTURE_LABELS[input.pose]} (${input.source}) · shake ${input.shake.toFixed(2)} · push ${input.push.toFixed(2)} · hands ${camInput.state.hands}</div>
      ${(camInput.F?.hands || []).map((h, i) => `<div><b>Hand ${i + 1}</b> fist ${h.fistness.toFixed(2)} · spread ${h.spread.toFixed(2)} · height ${h.palm.y.toFixed(2)}${h.track.stale ? ' · hidden' : ''}</div>`).join('')}
      ${rows}`;
  }
}
