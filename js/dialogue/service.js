import { GEMINI, DIALOGUE } from '../config.js';
import { bus } from '../core/events.js';
import { storage } from '../core/storage.js';
import { PERSONAS, EVENT_DESCRIPTIONS } from './personas.js';
import { mockLine } from './mock.js';
import { generateLine } from './gemini.js';

/**
 * Dialogue for fights and cutscenes. Uses Gemini when a key is set and falls back to the offline
 * mock per line on any failure, so the game never waits on the network.
 */
export class DialogueService {
  constructor() {
    this.key = GEMINI.API_KEY || storage.get(GEMINI.STORAGE_KEY) || '';
    this.history = [];
    this.lastShown = 0;
    this.speakerAt = {};
    this.inflight = new Set();
    this.requestTimes = [];
    this.status = this.key ? 'gemini' : 'offline'; // gemini | offline | error | rate
    this.lastError = null;
  }

  get hasKey() { return !!this.key; }

  setKey(key) {
    this.key = (key || '').trim();
    if (!GEMINI.API_KEY) {
      if (this.key) storage.set(GEMINI.STORAGE_KEY, this.key);
      else storage.remove(GEMINI.STORAGE_KEY);
    }
    this._setStatus(this.key ? 'gemini' : 'offline');
  }

  _setStatus(s, err) {
    this.status = s;
    this.lastError = err || null;
    bus.emit('dialogue:status', { status: s, error: err });
  }

  _prompt(speaker, event, ctx) {
    const lines = [`Event: ${EVENT_DESCRIPTIONS[event] || event}`];
    if (ctx.chapter) lines.push(`Story chapter: ${ctx.chapter}`);
    if (ctx.self) lines.push(`You: ${ctx.self.name}${ctx.self.form ? `, form ${ctx.self.form}` : ''}, health ${ctx.self.hp}%`);
    if (ctx.foe) lines.push(`Opponent: ${ctx.foe.name}, health ${ctx.foe.hp}%`);
    if (ctx.detail) lines.push(ctx.detail);
    const recent = this.history.slice(-DIALOGUE.HISTORY).map((h) => `${PERSONAS[h.speaker]?.name}: ${h.text}`);
    if (recent.length) lines.push(`Recent lines, do not repeat them: ${recent.join(' | ')}`);
    lines.push(`Say one new line now, at most ${DIALOGUE.MAX_WORDS} words.`);
    return lines.join('\n');
  }

  _rateOk() {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter((t) => now - t < 60000);
    return this.requestTimes.length < GEMINI.MAX_RPM;
  }

  /** Always resolves with a line: Gemini when possible, otherwise the mock. */
  async line(speaker, event, ctx = {}) {
    if (!this.key) return { text: mockLine(speaker, event, ctx), source: 'mock' };
    if (!this._rateOk()) return { text: mockLine(speaker, event, ctx), source: 'mock-rate' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), GEMINI.TIMEOUT_MS);
    this.requestTimes.push(Date.now());
    try {
      const text = await generateLine({ apiKey: this.key, system: PERSONAS[speaker]?.system || PERSONAS.goku.system, prompt: this._prompt(speaker, event, ctx), signal: ctrl.signal });
      if (this.status !== 'gemini') this._setStatus('gemini');
      return { text, source: 'gemini' };
    } catch (err) {
      const reason = err.name === 'AbortError' ? 'timeout' : err.message;
      console.warn('[dialogue] Gemini failed, using mock:', reason);
      this._setStatus('error', reason);
      return { text: mockLine(speaker, event, ctx), source: 'mock-error' };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Throttled fight bark: emits dialogue:line when ready, drops it if it arrives too late. */
  say(speaker, event, ctx = {}, { force = false } = {}) {
    const now = performance.now();
    if (!force) {
      if (now - this.lastShown < DIALOGUE.GLOBAL_GAP_MS) return;
      if (now - (this.speakerAt[speaker] || 0) < DIALOGUE.SPEAKER_COOLDOWN_MS) return;
      if (this.inflight.has(speaker)) return;
    }
    this.speakerAt[speaker] = now;
    this.lastShown = now;
    this.inflight.add(speaker);
    this.line(speaker, event, ctx).then(({ text, source }) => {
      this.inflight.delete(speaker);
      if (performance.now() - now > DIALOGUE.MAX_STALE_MS && !force) return;
      this.history.push({ speaker, text });
      if (this.history.length > 12) this.history.shift();
      bus.emit('dialogue:line', { speaker, text, source, event });
    });
  }
}
