import { TIMING } from '../config.js';
import { bus } from '../core/events.js';
import { el } from '../characters/parts.js';
import { CharacterRig } from '../characters/rig.js';
import { CHARACTERS } from '../characters/index.js';
import { PERSONAS } from '../dialogue/personas.js';

const PORTRAIT_DEF = { goku: 'goku', beerus: 'beerus', garrok: 'garrok', vessa: 'vessa', thornka: 'thornka', shadow: 'shadow' };

/** Letterboxed dialogue scenes with typewriter text and live SVG portraits. */
export class Cutscene {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="cs-bar cs-top"></div><div class="cs-bar cs-bottom"></div>
      <div class="cs-box" role="dialog" aria-live="polite">
        <div class="cs-portrait"></div>
        <div class="cs-body"><div class="cs-name"></div><div class="cs-text"></div></div>
        <div class="cs-next" aria-hidden="true">▼</div>
      </div>
      <button type="button" class="cs-skip">Skip ▸▸</button>`;
    this.box = root.querySelector('.cs-box');
    this.nameEl = root.querySelector('.cs-name');
    this.textEl = root.querySelector('.cs-text');
    this.portraitEl = root.querySelector('.cs-portrait');
    this.portraits = {};
    this.active = false;
    root.querySelector('.cs-skip').addEventListener('click', (e) => { e.stopPropagation(); this._skip = true; this._advance(); });
    root.addEventListener('pointerup', () => this._advance());
    bus.on('input:advance', () => this._advance());
  }

  _portrait(speaker) {
    const id = PORTRAIT_DEF[speaker];
    for (const k in this.portraits) this.portraits[k].svg.style.display = k === id ? '' : 'none';
    if (!id || !CHARACTERS[id]) return;
    if (!this.portraits[id]) {
      const svg = el('svg', { viewBox: '-60 -330 160 160', class: 'cs-svg' }, this.portraitEl);
      const layer = el('g', {}, svg);
      const rig = new CharacterRig(CHARACTERS[id], layer);
      rig.x = 0; rig.y = 0; rig.scale = 1;
      rig.setPose('stand', true);
      rig.g.shadow.style.display = 'none';
      this.portraits[id] = { svg, rig };
    }
    const p = this.portraits[id];
    if (this.form && id === 'goku') p.rig.setForm(this.form, true);
    p.rig.update(0.016);
    const h = p.rig.anchors.head;
    const r = p.rig.P.headR * p.rig.scale * 2.6;
    p.svg.setAttribute('viewBox', `${(h.x - r * 0.62).toFixed(1)} ${(h.y - r * 0.68).toFixed(1)} ${r * 1.3} ${r * 1.3}`);
    p.svg.style.display = '';
  }

  /** Plays lines; resolves when finished or skipped. opts.form sets Goku's portrait form. */
  play(lines, opts = {}) {
    this.lines = lines;
    this.i = -1;
    this.form = opts.form;
    this._skip = false;
    this.active = true;
    this.root.classList.add('is-open');
    bus.emit('cutscene:open');
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._next();
    });
  }

  _next() {
    clearInterval(this._typer);
    clearTimeout(this._auto);
    this.i++;
    if (this._skip || this.i >= this.lines.length) { this._close(); return; }
    const { s, t } = this.lines[this.i];
    const persona = PERSONAS[s];
    const narrator = s === 'narrator';
    this.box.classList.toggle('is-narrator', narrator);
    this.nameEl.textContent = narrator ? '' : persona?.name || s;
    this.nameEl.style.color = persona?.color || '';
    this._portrait(narrator ? null : s);
    this.full = t;
    this.shown = 0;
    this.typing = true;
    this.textEl.textContent = '';
    const stepMs = 1000 / TIMING.TYPE_CPS;
    this._typer = setInterval(() => {
      this.shown += 2;
      this.textEl.textContent = this.full.slice(0, this.shown);
      if (this.shown >= this.full.length) this._doneTyping();
    }, stepMs * 2);
    bus.emit('cutscene:line', { speaker: s, text: t });
  }

  _doneTyping() {
    clearInterval(this._typer);
    this.typing = false;
    this.textEl.textContent = this.full;
    this._auto = setTimeout(() => this._next(), TIMING.AUTO_ADVANCE_MS);
  }

  _advance() {
    if (!this.active) return;
    if (this._skip) { this._next(); return; }
    if (this.typing) this._doneTyping();
    else this._next();
  }

  _close() {
    clearInterval(this._typer);
    clearTimeout(this._auto);
    this.active = false;
    this.root.classList.remove('is-open');
    bus.emit('cutscene:close');
    const r = this._resolve;
    this._resolve = null;
    r?.();
  }
}
