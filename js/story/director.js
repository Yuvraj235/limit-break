import { TIMING, FORMS } from '../config.js';
import { bus } from '../core/events.js';
import { storage } from '../core/storage.js';
import { calibration } from '../input/calibration.js';
import { CHAPTERS, TUTORIAL, battleChapter } from './chapters.js';
import { CHARACTERS } from '../characters/index.js';
import { unlockedForms } from '../combat/moves.js';

const CALIBRATE_GIVE_UP_S = 14;

/** Runs story mode: intro cutscene → fight (with mid-fight triggers/tutorial) → outro → results. */
export class Director {
  constructor(app) {
    this.app = app;
    this.progress = { unlocked: 0, cleared: [], flags: {}, ...storage.get('progress', {}) };
    this.chapter = null;
    this.index = 0;
    this.flags = {};
    this.counters = {};
    this.tut = null;
    this.busy = false;
    bus.on('combat:hit', (e) => this._countHit(e));
    bus.on('combat:dodge', ({ fighter }) => { if (this.tut && fighter === this.app.combat?.p1) this._inc('dodge'); });
    bus.on('combat:end', (e) => this._onEnd(e));
  }

  save() { storage.set('progress', this.progress); }

  resetProgress() {
    this.progress = { unlocked: 0, cleared: [], flags: {} };
    this.save();
  }

  get continueIndex() { return Math.min(this.progress.unlocked, CHAPTERS.length - 1); }

  play(index) { return this._run(CHAPTERS[index], index); }

  playBattle(player, foe) {
    this.lastBattle = { player, foe };
    return this._run(battleChapter(player, foe), -1);
  }

  replay() { return this.index < 0 ? this.playBattle(this.lastBattle.player, this.lastBattle.foe) : this.play(this.index); }

  /** Forms this chapter adds over the previous one (story only), for the "new form" callout. */
  newForms(index) {
    const ch = CHAPTERS[index];
    const def = CHARACTERS[ch?.player || 'goku'];
    const at = (i) => (i < 0 ? [] : unlockedForms(def, { tier: CHAPTERS[i].tier, god: !!CHAPTERS[i].uiUnlocked }));
    // compare with the last chapter played by the same fighter
    let prev = index - 1;
    while (prev >= 0 && (CHAPTERS[prev].player || 'goku') !== (ch?.player || 'goku')) prev--;
    const before = at(prev);
    return at(index).filter((f) => !before.includes(f));
  }

  async _run(ch, index) {
    this.index = index;
    this.chapter = ch;
    this.flags = {};
    this.counters = {};
    this.tut = null;
    this.ending = false;
    this.busy = false;
    const combat = this.app.startFight(ch);
    combat.paused = true;
    if (ch.intro.length) await this.app.cutscene.play(ch.intro, { form: combat.p1.form });
    if (this.app.combat !== combat) return;
    combat.paused = false;
    combat.onTick = (c, dt) => this._tick(c, dt);
    combat.start();
    const fresh = index >= 0 ? this.newForms(index).filter((f) => f !== 'base') : [];
    if (fresh.length) {
      this.app.hud.toast(`NEW FORM UNLOCKED: ${fresh.map((f) => FORMS[f].name).join(', ')}! Hold ✊ at full ki to evolve.`, 5500);
      if (ch.tip) setTimeout(() => { if (this.app.combat === combat) this.app.hud.toast(ch.tip, 7000); }, 5800);
    } else if (ch.tip) this.app.hud.toast(ch.tip, 7000);
    else if (ch.battle) this.app.hud.toast('Battle mode: every form is unlocked. ✊ power up to climb the ladder, or press U / tap the god-form button.', 6000);
    if (ch.tutorial) this._startTutorial();
  }

  _tick(c, dt) {
    const ch = this.chapter;
    if (c.state !== 'fight' || this.busy) return;
    const p1 = c.p1.hp / c.p1.maxHp;
    const p2 = c.p2.hp / c.p2.maxHp;
    for (const trg of ch.triggers || []) {
      if (this.flags[trg.id]) continue;
      if ((trg.when.p1HpBelow && p1 < trg.when.p1HpBelow) || (trg.when.p2HpBelow && p2 < trg.when.p2HpBelow)) {
        this.flags[trg.id] = true;
        this._runTrigger(c, trg);
        return;
      }
    }
    if (ch.winAtFoeHp && p2 < ch.winAtFoeHp) { c.end('p1', 'test'); return; }
    if (this.tut) this._tutorialTick(c, dt);
  }

  async _runTrigger(c, trg) {
    this.busy = true;
    c.paused = true;
    c.cancelCharge(c.p1);
    await this.app.cutscene.play(trg.cutscene, { form: { mui: 'ui', ego: undefined, uiEgo: 'ui_ego' }[trg.effect] ?? 'ui_sign' });
    if (this.app.combat !== c) return;
    const p = c.p1;
    p.setState('idle');
    p.ki = p.maxKi;
    if (trg.effect === 'uiSign') {
      c.opts.uiUnlocked = true;
      p.flags.plotArmor = false;
      p.hp = Math.max(p.hp, p.maxHp * 0.6);
      c.activateUI(p);
      this.progress.flags.ui = true;
    } else if (trg.effect === 'ego') {
      c.opts.uiUnlocked = true;
      p.flags.plotArmor = false;
      p.hp = Math.max(p.hp, p.maxHp * 0.6);
      c.transform(p, 'ultra_ego');
      this.progress.flags.ego = true;
    } else if (trg.effect === 'uiEgo') {
      // Ultra Instinct and Ultra Ego merge inside the fused warrior (fusing first if needed)
      c.opts.uiUnlocked = true;
      if (!p.fused) c.fuse(p, true);
      p.hp = Math.max(p.hp, p.maxHp * 0.6);
      c.transform(p, 'ui_ego');
      p.ki = p.maxKi;
      this.progress.flags.uiEgo = true;
    } else if (trg.effect === 'mui') {
      c.opts.uiUnlocked = true;
      c.opts.muiUnlocked = true;
      c.transform(p, 'ui');
      this.progress.flags.mui = true;
    }
    this.app.touch?.setUIUnlocked(true);
    this.save();
    c.paused = false;
    this.busy = false;
  }

  _onEnd({ combat, winner, method }) {
    if (combat !== this.app.combat || this.ending || !this.chapter) return;
    this.ending = true;
    this.tut = null;
    this.app.hud.tutorial(null);
    setTimeout(async () => {
      if (this.app.combat !== combat) return;
      const won = winner === 'p1';
      if (this.chapter.battle) {
        this.app.screens.results({ won, method, chapter: this.chapter, index: -1, stats: combat.result?.stats || {}, hasNext: false });
        return;
      }
      if (won) {
        await this.app.cutscene.play(this.chapter.outro, { form: combat.p1.form });
        this.progress.cleared = [...new Set([...this.progress.cleared, this.chapter.id])];
        this.progress.unlocked = Math.max(this.progress.unlocked, Math.min(this.index + 1, CHAPTERS.length - 1));
        this.save();
      }
      if (this.app.combat !== combat) return;
      this.app.screens.results({
        won, method, chapter: this.chapter, index: this.index,
        stats: combat.result?.stats || {}, hasNext: won && this.index < CHAPTERS.length - 1,
      });
    }, TIMING.RESULT_DELAY_MS);
  }

  /* ── tutorial ──────────────────────────────────────────────────────────── */
  _startTutorial() {
    this.tut = { i: -1, step: null, forceT: 0, doneAt: 0, calib: { phase: 0, t: 0, ys: [] } };
    this._enterStep(0);
  }

  skipStep() {
    if (this.tut) this._enterStep(this.tut.i + 1);
  }

  _enterStep(i) {
    if (!this.tut) return;
    if (i >= TUTORIAL.length) {
      this.tut = null;
      this.app.hud.tutorial(null);
      this.app.combat?.end('p1', 'training');
      return;
    }
    const step = TUTORIAL[i];
    if (step.cameraOnly && !this.app.cameraInput.camera.live) return this._enterStep(i + 1);
    Object.assign(this.tut, { i, step, forceT: 1.2, doneAt: 0, stepT: 0 });
    if (step.counter) this.counters[step.counter] = 0;
    this.app.hud.tutorial({ step, index: i, total: TUTORIAL.length, progress: 0 });
  }

  _inc(name) { this.counters[name] = (this.counters[name] || 0) + 1; }

  _countHit({ target, attacker, kind, blocked }) {
    const c = this.app.combat;
    if (!this.tut || !c) return;
    if (attacker === c.p1 && !blocked) {
      if (kind === 'blast') this._inc('kiblast');
      else if (kind === 'punch' || kind === 'kick') { this._inc('punch'); if (kind === 'kick') this._inc('kick'); }
      else if (kind === 'beam') this._inc('kame');
      else if (kind === 'spirit') this._inc('spirit');
    }
    if (target === c.p1 && blocked) this._inc('block');
  }

  _tutorialTick(c, dt) {
    const t = this.tut;
    const step = t.step;
    if (!step) return;
    let progress = 0;
    let done = false;
    if (step.id === 'calibrate') {
      const F = this.app.cameraInput.F;
      const cal = t.calib;
      const open = F && F.count >= 2 && F.hands.every((h) => h.fistness < 0.45);
      cal.total = (cal.total || 0) + dt;
      if (cal.total > CALIBRATE_GIVE_UP_S) {
        // Never block training on calibration: fall back to the default raise height.
        this.app.hud.toast(F?.count ? 'Calibration skipped: using the default height for raised hands.' : 'No hands seen yet. Check the camera preview, sit back so both hands fit, or use the buttons/keys.', 5000);
        this._enterStep(t.i + 1);
        return;
      }
      if (cal.phase === 0) {
        if (open) { cal.t += dt; cal.ys.push(F.pair.avgY); } else cal.t = Math.max(0, cal.t - dt);
        progress = Math.min(1, cal.t) * 0.5;
        if (cal.t >= 1) {
          cal.neutral = cal.ys.reduce((a, b) => a + b, 0) / cal.ys.length;
          cal.phase = 1; cal.t = 0; cal.ys = [];
          this.app.hud.tutorialText('Great! Now raise both open palms high above your head.');
        }
      } else {
        if (open && F.pair.lowY < cal.neutral - 0.12) { cal.t += dt; cal.ys.push(F.pair.lowY); } else cal.t = Math.max(0, cal.t - dt);
        progress = 0.5 + Math.min(1, cal.t / 0.8) * 0.5;
        if (cal.t >= 0.8) { calibration.save(cal.neutral, cal.ys.reduce((a, b) => a + b, 0) / cal.ys.length); done = true; }
      }
    } else if (step.done) {
      done = step.done({ combat: c });
      progress = done ? 1 : Math.min(0.95, c.p1.ki / c.p1.maxKi * 0.7 + c.p1.transformMeter / TIMING.TRANSFORM_HOLD_MS * 0.3);
    } else if (step.counter) {
      progress = Math.min(1, (this.counters[step.counter] || 0) / step.target);
      done = progress >= 1;
    }
    t.stepT = (t.stepT || 0) + dt;
    if (step.giveUpS && !done && t.stepT > step.giveUpS) {
      this.app.hud.toast(step.giveUpText || 'Skipped for now: you can practise this one any time.', 5000);
      t.stepT = 0;
      this._enterStep(t.i + 1);
      return;
    }
    if (step.force && !t.doneAt) {
      t.forceT -= dt;
      if (t.forceT <= 0 && !c.ai.action) { c.ai.force(step.force); t.forceT = 3.2; }
    }
    this.app.hud.tutorialProgress(progress);
    if (done && !t.doneAt) { t.doneAt = performance.now(); this.app.hud.tutorialDone(); bus.emit('ui:click'); }
    if (t.doneAt && performance.now() - t.doneAt > 1000) this._enterStep(t.i + 1);
  }
}
