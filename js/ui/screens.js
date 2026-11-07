import { GEMINI, FORMS } from '../config.js';
import { bus } from '../core/events.js';
import { storage } from '../core/storage.js';
import { quality, device } from '../core/quality.js';
import { calibration } from '../input/calibration.js';
import { CHAPTERS, BATTLE_FOES } from '../story/chapters.js';
import { CHARACTERS, PLAYABLE, FUSIONS } from '../characters/index.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Menus: title, chapter select, settings, Gemini key prompt, pause and results. */
export class Screens {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('screens');
    this.current = null;
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      bus.emit('ui:click');
      this._act(btn.dataset.act, btn.dataset);
    });
    bus.on('game:pauseToggle', () => {
      if (this.current === 'pause') this._act('resume');
      else if (!this.current && app.scene === 'fight') this.pause();
      else if (this.current === 'settings' || this.current === 'chapters' || this.current === 'battle') this.back();
    });
  }

  _render(name, html) {
    this.current = name;
    this.root.innerHTML = `<div class="screen screen-${name}" role="dialog" aria-modal="true">${html}</div>`;
    this.root.classList.add('is-open');
    this.root.dataset.screen = name;
    const first = this.root.querySelector('button, input');
    if (first && !device.touch) first.focus({ preventScroll: true });
  }

  hide() {
    this.current = null;
    this.root.classList.remove('is-open');
    this.root.innerHTML = '';
    delete this.root.dataset.screen;
  }

  back() {
    if (this._backTo === 'pause') this.pause();
    else this.title();
  }

  title() {
    this._backTo = null;
    const d = this.app.director;
    const started = d.progress.unlocked > 0 || d.progress.cleared.length > 0;
    const next = CHAPTERS[d.continueIndex];
    this._render('title', `
      <div class="logo"><span class="logo-top">LIMIT BREAK</span><span class="logo-sub">Tournament of Power · hand-gesture saga</span></div>
      <div class="menu">
        <button type="button" class="btn primary" data-act="continue">${started ? `Continue · ${esc(next.title)}` : 'Start story'}</button>
        <button type="button" class="btn" data-act="chapters">Chapters</button>
        <button type="button" class="btn ${calibration.templates ? '' : 'glow'}" data-act="calibrate">${calibration.templates ? 'Recalibrate hands' : '✋ Calibrate your hands (recommended)'}</button>
        <button type="button" class="btn" data-act="battle">Battle · Goku, Vegeta, Gogeta or Vegito</button>
        <button type="button" class="btn" data-act="training">Training</button>
        <button type="button" class="btn" data-act="settings">Settings</button>
      </div>
      <div class="title-status">${this._statusLine()}</div>
      <div class="title-help">${device.touch ? 'Prop your phone up so the camera sees both hands, or play with the on-screen buttons.' : 'Webcam gestures: ✊ power up · 👐 beam · 🙌 bomb · ✌️ teleport · 👉 ki blast · 🖐️ barrier · 🥋 relax. Keys: P K S T F G, Space fires, ←/→ teleport, U god form.'}</div>
      <div class="legal">Fan-made prototype. Characters belong to their rights holders; not for commercial use without a license.</div>`);
  }

  _statusLine() {
    const cam = this.app.cameraInput.status;
    const camText = { tracking: '● Hand tracking on', loading: '◌ Loading hand tracker…', requesting: '◌ Waiting for camera…', denied: '○ Camera blocked: touch/keys only', nocamera: '○ No camera: touch/keys only', unsupported: '○ Camera unavailable: touch/keys only', error: '○ Camera error', off: '○ Camera off' }[cam] || cam;
    const dlg = this.app.dialogue.hasKey ? '● Gemini dialogue' : '○ Offline dialogue';
    return `<span>${esc(camText)}</span><span>${dlg}</span>`;
  }

  refreshStatus() {
    const el = this.root.querySelector('.title-status');
    if (el) el.innerHTML = this._statusLine();
  }

  chapters() {
    const d = this.app.director;
    const cards = CHAPTERS.map((ch, i) => {
      const locked = i > d.progress.unlocked;
      const cleared = d.progress.cleared.includes(ch.id);
      const fresh = d.newForms(i).filter((f) => f !== 'base');
      const forms = fresh.length ? `<span class="forms">New form: ${fresh.map((f) => esc(FORMS[f].name)).join(', ')}</span>` : '';
      return `<button type="button" class="chapter ${locked ? 'locked' : ''} ${cleared ? 'cleared' : ''}" data-act="play" data-index="${i}" ${locked ? 'disabled' : ''}>
        <span class="num">${ch.num === 0 ? 'PROLOGUE' : `CHAPTER ${ch.num}`}</span><span class="ttl">${esc(ch.title)}</span><span class="sub">${locked ? 'Locked' : esc(ch.subtitle)}</span>${forms}${cleared ? '<span class="tick">✓</span>' : ''}
      </button>`;
    }).join('');
    this._render('chapters', `<h2>Chapters</h2><div class="chapter-grid">${cards}</div><div class="menu row"><button type="button" class="btn" data-act="back">Back</button></div>`);
  }

  battle() {
    const pick = this._battle || (this._battle = { player: 'goku', foe: 'vegeta' });
    if (pick.foe === pick.player) pick.foe = BATTLE_FOES.find((f) => f.id !== pick.player).id;
    const fighters = PLAYABLE.map((id) => `<button type="button" class="btn ${pick.player === id ? 'primary' : ''}" data-act="pickPlayer" data-id="${id}">${esc(CHARACTERS[id].name)}</button>`).join('');
    const foes = BATTLE_FOES.filter((f) => f.id !== pick.player).map((f) => `<button type="button" class="btn ${pick.foe === f.id ? 'primary' : ''}" data-act="pickFoe" data-id="${f.id}">${esc(CHARACTERS[f.id].name)}</button>`).join('');
    const ladder = [...CHARACTERS[pick.player].ladder, ...CHARACTERS[pick.player].godForms].map((f) => esc(FORMS[f].name)).join(' → ');
    const pdef = CHARACTERS[pick.player];
    const fusionPick = FUSIONS.includes(storage.get('fusionPick')) ? storage.get('fusionPick') : 'gogeta';
    const perks = (d) => `${esc(d.fusion.label)} · ${d.fusion.seconds}s · ${esc(d.fusion.perkText)} · 👉👈 again: <b>${esc(d.fusion.ultimate.name)}</b> (${esc(d.fusion.ultimate.text)})`;
    const fusionRow = pdef.fusion
      ? `<p class="muted">Fused for the whole fight. ${perks(pdef)}</p>`
      : `<h3>Fusion (👉👈 / X)</h3><div class="menu row">${FUSIONS.map((id) => `<button type="button" class="btn ${fusionPick === id ? 'primary' : ''}" data-act="pickFusion" data-id="${id}">${esc(CHARACTERS[id].name)} · ${esc(CHARACTERS[id].fusion.label)}</button>`).join('')}</div>
        <p class="muted">${perks(CHARACTERS[fusionPick])}</p>`;
    this._render('battle', `
      <h2>Battle</h2>
      <p class="muted">Every form unlocked: ${ladder}</p>
      <h3>Your fighter</h3><div class="menu row wrap">${fighters}</div>
      ${fusionRow}
      <h3>Opponent</h3><div class="menu row wrap">${foes}</div>
      <div class="menu row">
        <button type="button" class="btn primary" data-act="startBattle">Fight!</button>
        <button type="button" class="btn ghost" data-act="back">Back</button>
      </div>`);
  }

  settings(from) {
    this._backTo = from || (this.current === 'pause' ? 'pause' : null);
    const d = this.app.dialogue;
    const touchMode = storage.get('touchMode', 'auto');
    const qual = quality.locked ? quality.preset : 'auto';
    const fromConst = !!GEMINI.API_KEY;
    this._render('settings', `
      <h2>Settings</h2>
      <section>
        <h3>Gemini dialogue</h3>
        <p class="muted">${fromConst ? 'Using the key set in js/config.js.' : 'Optional. Lines come from Gemini when a key is set and fall back to offline lines on any error. The key stays in this browser only.'}</p>
        ${fromConst ? '' : `<div class="field"><input id="key-input" type="password" autocomplete="off" spellcheck="false" placeholder="Paste a Gemini API key" value="${d.hasKey ? '••••••••' : ''}">
        <button type="button" class="btn small" data-act="saveKey">Save</button><button type="button" class="btn small ghost" data-act="clearKey">Clear</button></div>`}
        <p class="muted">Status: ${d.hasKey ? (d.status === 'error' ? `Gemini error (${esc(d.lastError || 'unknown')}): using offline lines` : `Gemini · ${esc(GEMINI.MODEL)}`) : 'Offline lines'}</p>
      </section>
      <section>
        <h3>Controls</h3>
        <div class="opts">
          <label>Voices <select id="opt-voice"><option value="auto" ${this.app.voices?.mode === 'auto' ? 'selected' : ''}>${this.app.dialogue.hasKey ? 'Gemini voices' : 'Built-in voices (add a Gemini key for realistic ones)'}</option><option value="builtin" ${this.app.voices?.mode === 'builtin' ? 'selected' : ''}>Built-in voices</option><option value="off" ${this.app.voices?.mode === 'off' ? 'selected' : ''}>Off</option></select></label>
          <label>Camera <select id="opt-camera"><option value="on" ${this.app.cameraInput.camera.live || this.app.cameraInput.status === 'requesting' ? 'selected' : ''}>On</option><option value="off" ${!this.app.cameraInput.camera.live ? 'selected' : ''}>Off</option></select></label>
          <label>On-screen buttons <select id="opt-touch"><option value="auto" ${touchMode === 'auto' ? 'selected' : ''}>Auto</option><option value="on" ${touchMode === 'on' ? 'selected' : ''}>Always</option><option value="off" ${touchMode === 'off' ? 'selected' : ''}>Hidden</option></select></label>
          <label>Graphics <select id="opt-gfx"><option value="3d" ${storage.get('gfx', '3d') === '3d' ? 'selected' : ''}>3D (WebGL)</option><option value="2d" ${storage.get('gfx', '3d') === '2d' ? 'selected' : ''}>Classic 2D</option></select></label>
          <label>Quality <select id="opt-quality"><option value="auto" ${qual === 'auto' ? 'selected' : ''}>Auto</option><option value="high" ${qual === 'high' ? 'selected' : ''}>High</option><option value="medium" ${qual === 'medium' ? 'selected' : ''}>Medium</option><option value="low" ${qual === 'low' ? 'selected' : ''}>Low</option></select></label>
          <label>Sound <select id="opt-sound"><option value="on" ${!this.app.sfx.muted ? 'selected' : ''}>On</option><option value="off" ${this.app.sfx.muted ? 'selected' : ''}>Off</option></select></label>
        </div>
        <div class="menu row">
          <button type="button" class="btn small" data-act="recalibrate">Reset raise-line calibration</button>
          <button type="button" class="btn small" data-act="debug">Toggle debug (D)</button>
          <button type="button" class="btn small ghost" data-act="resetProgress">Reset story progress</button>
        </div>
      </section>
      <div class="menu row"><button type="button" class="btn primary" data-act="back">Done</button></div>`);
    const on = (id, fn) => this.root.querySelector(id)?.addEventListener('change', (e) => fn(e.target.value));
    on('#opt-voice', (v) => this.app.voices.setMode(v));
    on('#opt-camera', (v) => (v === 'on' ? this.app.enableCamera() : this.app.disableCamera()));
    on('#opt-touch', (v) => { storage.set('touchMode', v); this.app.applyTouchMode(); });
    on('#opt-gfx', (v) => this.app.setGraphics(v));
    on('#opt-quality', (v) => { if (v === 'auto') { storage.remove('quality'); quality.locked = false; } else quality.set(v); this.app.layout(); });
    on('#opt-sound', (v) => { this.app.sfx.unlock(); this.app.sfx.setMuted(v === 'off'); });
    const input = this.root.querySelector('#key-input');
    input?.addEventListener('focus', () => { if (input.value.startsWith('•')) input.value = ''; });
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._act('saveKey'); });
  }

  keyPrompt() {
    this._render('key', `
      <h2>Gemini dialogue (optional)</h2>
      <p>Paste a Gemini API key to have fighters' lines written live by <b>${esc(GEMINI.MODEL)}</b>. Without one, the game uses built-in offline lines and works fully.</p>
      <div class="field"><input id="key-input" type="password" autocomplete="off" spellcheck="false" placeholder="Gemini API key"><button type="button" class="btn small" data-act="saveKey">Save</button></div>
      <p class="muted">Stored only in this browser. You can change it any time in Settings.</p>
      <div class="menu row"><button type="button" class="btn primary" data-act="skipKey">Play with offline lines</button></div>`);
    storage.set('keyPrompted', true);
    this.root.querySelector('#key-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._act('saveKey'); });
  }

  pause() {
    this._backTo = null;
    this.app.setPaused(true);
    this._render('pause', `
      <h2>Paused</h2>
      <div class="menu">
        <button type="button" class="btn primary" data-act="resume">Resume</button>
        <button type="button" class="btn" data-act="retry">Restart chapter</button>
        <button type="button" class="btn" data-act="settings" data-from="pause">Settings</button>
        <button type="button" class="btn ghost" data-act="quit">Quit to title</button>
      </div>`);
  }

  results({ won, method, chapter, index, stats, hasNext }) {
    this._lastResult = { index, hasNext };
    const head = won ? (method === 'training' ? 'TRAINING COMPLETE' : method === 'test' ? 'TEST PASSED' : 'VICTORY') : method === 'ringout' ? 'ELIMINATED' : 'DEFEAT';
    const fresh = won && hasNext ? this.app.director.newForms(index + 1).filter((f) => f !== 'base') : [];
    const unlock = fresh.length ? ` · unlocks ${fresh.map((f) => esc(FORMS[f].name)).join(', ')}` : '';
    const line = index < 0 ? (won ? 'Pick another matchup from Battle.' : 'Try again, or switch fighters!')
      : won
        ? hasNext ? `Next: ${esc(CHAPTERS[index + 1].title)}${unlock}` : 'You finished the story. Replay any chapter from the menu, or try Battle mode as Vegeta.'
        : 'Get up, Goku. Try again!';
    this._render('results', `
      <div class="result-head ${won ? 'won' : 'lost'}">${head}</div>
      <div class="result-sub">${esc(chapter.title)}</div>
      <div class="stats">
        <div><b>${stats.damage ?? 0}</b><span>damage dealt</span></div>
        <div><b>${stats.hits ?? 0}</b><span>hits landed</span></div>
        <div><b>${stats.blocked ?? 0}</b><span>blocks</span></div>
        <div><b>${stats.dodges ?? 0}</b><span>dodges</span></div>
      </div>
      <p class="muted">${line}</p>
      <div class="menu row">
        ${won && hasNext ? '<button type="button" class="btn primary" data-act="next">Next chapter</button>' : ''}
        <button type="button" class="btn ${won && hasNext ? '' : 'primary'}" data-act="retry">${won ? 'Replay' : 'Retry'}</button>
        <button type="button" class="btn ghost" data-act="quit">Title</button>
      </div>`);
  }

  _act(act, data = {}) {
    const app = this.app;
    switch (act) {
      case 'continue': this.hide(); app.director.play(app.director.continueIndex); break;
      case 'training': this.hide(); app.director.play(0); break;
      case 'chapters': this.chapters(); break;
      case 'play': this.hide(); app.director.play(Number(data.index)); break;
      case 'settings': this.settings(data.from); break;
      case 'back': this.back(); break;
      case 'resume': this.hide(); app.setPaused(false); break;
      case 'retry': this.hide(); app.setPaused(false); app.director.replay(); break;
      case 'battle': this.battle(); break;
      case 'calibrate': this.hide(); import('./handCalibration.js').then((m) => m.runHandCalibration(app)).finally(() => this.title()); break;
      case 'resetHands': calibration.clearTemplates(); this.settings(this._backTo); break;
      case 'pickPlayer': this._battle.player = data.id; this.battle(); break;
      case 'pickFoe': this._battle.foe = data.id; this.battle(); break;
      case 'pickFusion': storage.set('fusionPick', data.id); this.battle(); break;
      case 'startBattle': this.hide(); app.director.playBattle(this._battle.player, this._battle.foe); break;
      case 'next': this.hide(); app.director.play(this._lastResult.index + 1); break;
      case 'quit': this.hide(); app.setPaused(false); app.toTitle(); break;
      case 'saveKey': {
        const v = this.root.querySelector('#key-input')?.value.trim();
        if (v && !v.startsWith('•')) app.dialogue.setKey(v);
        if (this.current === 'key') this.title(); else this.settings(this._backTo);
        app.hud.toast(app.dialogue.hasKey ? 'Gemini key saved. Fighters will use live lines.' : 'No key saved: offline lines.', 2600);
        break;
      }
      case 'clearKey': app.dialogue.setKey(''); this.settings(this._backTo); break;
      case 'skipKey': this.title(); break;
      case 'recalibrate': calibration.reset(); calibration.clearTemplates(); app.hud.toast('Hand calibration reset. Use "Calibrate your hands" on the title screen.', 3000); break;
      case 'debug': bus.emit('ui:toggleDebug'); break;
      case 'resetProgress': app.director.resetProgress(); app.hud.toast('Story progress reset.', 2000); this.settings(this._backTo); break;
      default: break;
    }
  }
}
