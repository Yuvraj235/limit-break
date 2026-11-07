import { STAGE, TIMING } from './config.js';
import { bus } from './core/events.js';
import { storage } from './core/storage.js';
import { quality, device } from './core/quality.js';
import { CameraInput } from './input/cameraInput.js';
import { KeyboardInput } from './input/keyboard.js';
import { TouchControls } from './input/touchControls.js';
import { InputRouter } from './input/inputRouter.js';
import { FX } from './fx/index.js';
import { Camera2D } from './arena/camera2d.js';
import { Arena } from './arena/arena.js';
import { CHARACTERS, FUSIONS } from './characters/index.js';
import { RIG_OPTS } from './characters/rig.js';
import { ladderOf } from './combat/moves.js';
import { Combat } from './combat/combat.js';
import { DialogueService } from './dialogue/service.js';
import { attachBarks } from './dialogue/barks.js';
import { Voices } from './audio/voice.js';
import { SFX } from './audio/sfx.js';
import { Cutscene } from './story/cutscene.js';
import { Director } from './story/director.js';
import { HUD } from './ui/hud.js';
import { Screens } from './ui/screens.js';

const STEP = 1 / 60;
const $ = (id) => document.getElementById(id);

/**
 * App shell: owns the layers and runs the loop. Simulation runs at a fixed 60 Hz; rendering,
 * camera and effects run per animation frame. Hand tracking runs on its own per-video-frame loop.
 */
const app = {
  scene: 'boot',
  combat: null,
  stageRect: { x: 0, y: 0, w: STAGE.W, h: STAGE.H },
  latency: 0,
  _paused: false,

  init() {
    this.root = $('app');
    this.stage = $('stage');
    this.fighterLayer = $('fighters-layer');
    this.fx = new FX($('fx-back'), $('fx-front'));
    this.cam = new Camera2D();
    this.arena = new Arena($('arena-svg'));
    this.keyboard = new KeyboardInput();
    this.touch = new TouchControls($('touch-controls'), this.stage);
    this.cameraInput = new CameraInput($('cam-video'));
    this.input = new InputRouter({ camera: this.cameraInput, keyboard: this.keyboard, touch: this.touch });
    this.dialogue = new DialogueService();
    this.sfx = new SFX();
    this.sfx.attach();
    this.cutscene = new Cutscene($('cutscene'));
    this.director = new Director(this);
    this.hud = new HUD(this);
    this.screens = new Screens(this);
    attachBarks(this);
    this.voices = new Voices(this);
    this.camOverlay = $('cam-overlay');
    this.camCtx = this.camOverlay.getContext('2d');

    const unlock = () => this.sfx.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('resize', () => this.layout());
    window.visualViewport?.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 150));
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.scene === 'fight' && !this.screens.current) this.screens.pause(); });
    bus.on('camera:status', (s) => {
      this.screens.refreshStatus();
      this.applyTouchMode();
      if (s === 'denied') this.hud.toast('Camera blocked. Use the on-screen buttons or keyboard, or allow the camera in your browser settings.', 5000);
    });
    bus.on('dialogue:status', () => this.screens.refreshStatus());
    // 3D camera swings on big moves
    bus.on('combat:fire', ({ fighter, kind, power }) => {
      if (kind === 'kame') this.cam.orbit(-10 * fighter.facing, -2, 0.35 + power * 0.4);
      else if (kind === 'spirit') this.cam.orbit(4 * fighter.facing, 6, 0.6);
    });
    bus.on('combat:charge', ({ fighter, kind }) => { if (kind === 'spirit') this.cam.orbit(-3 * fighter.facing, 8, 1.2); else if (kind === 'kame') this.cam.orbit(6 * fighter.facing, 0, 0.9); });
    bus.on('combat:transform', () => this.cam.orbit(12, -4, 0.6));
    bus.on('combat:strike', ({ fighter, kind }) => { this.cam.orbit((kind === 'kick' ? 9 : 5) * fighter.facing, kind === 'kick' ? -3 : 0, 0.08); this.cam.punch(0.6); });
    bus.on('combat:dodge', ({ fighter, teleport }) => { if (teleport) this.cam.orbit(-7 * fighter.facing, 3, 0.1); });
    bus.on('combat:ui', () => this.cam.orbit(-14, -3, 0.9));
    bus.on('combat:fusion', ({ fighter }) => {
      if (fighter.isPlayer) this._fusionButtons(fighter);
    });
    bus.on('quality:change', (q) => { this.view3d?.setQuality(q); this.layout(); });
    $('cam-panel').addEventListener('click', () => bus.emit('ui:toggleDebug')); // phones have no D key
    $('btn-pause').addEventListener('click', () => { bus.emit('ui:click'); this.scene === 'fight' ? this.screens.pause() : this.screens.settings(); });
    $('btn-sound').addEventListener('click', () => { this.sfx.unlock(); this.sfx.setMuted(!this.sfx.muted); });
    bus.on('audio:muted', (m) => { $('btn-sound').textContent = m ? '🔇' : '🔊'; });
    $('btn-sound').textContent = this.sfx.muted ? '🔇' : '🔊';
    const fs = $('btn-fullscreen');
    if (document.fullscreenEnabled && !device.iOS) {
      fs.addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : this.root.requestFullscreen?.()).catch?.(() => {}));
    } else fs.hidden = true;

    this.gfx3d = false;
    this.layout();
    this.applyTouchMode();
    this.toTitle();
    this._init3d();
    if (!this.dialogue.hasKey && !storage.get('keyPrompted')) this.screens.keyPrompt();
    this.enableCamera();
    this._last = performance.now();
    this._acc = 0;
    requestAnimationFrame((t) => this.frame(t));
    window.__lb = this; // handy for debugging in the console
    if (new URLSearchParams(location.search).has('check')) import('../tests/livecheck.js').then((m) => m.startLiveCheck(this));
  },

  /* ── layout ──────────────────────────────────────────────────────────── */
  layout() {
    const vv = window.visualViewport;
    const vw = vv?.width || window.innerWidth;
    const vh = vv?.height || window.innerHeight;
    const portrait = vh > vw * 1.05;
    const safeTop = this._safeTop();
    let w, h, x, y;
    if (portrait) {
      w = vw;
      h = Math.round((vw * 9) / 16);
      x = 0;
      y = safeTop;
    } else {
      const s = Math.min(vw / 16, vh / 9);
      w = Math.round(16 * s);
      h = Math.round(9 * s);
      x = Math.round((vw - w) / 2);
      y = Math.round((vh - h) / 2);
    }
    this.stageRect = { x, y, w, h };
    Object.assign(this.stage.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    const r = this.root.style;
    r.setProperty('--stage-x', `${x}px`);
    r.setProperty('--stage-y', `${y}px`);
    r.setProperty('--stage-w', `${w}px`);
    r.setProperty('--stage-h', `${h}px`);
    r.setProperty('--s', (w / STAGE.W).toFixed(4));
    this.root.classList.toggle('is-portrait', portrait);
    for (const q of ['high', 'medium', 'low']) this.root.classList.toggle(`q-${q}`, quality.preset === q);
    if (quality.preset === 'low' || this.gfx3d) this.stage.style.transform = '';
    this.root.classList.toggle('is-landscape', !portrait);
    this.fx.resize(w, h);
    this.view3d?.resize(w, h);
    const info = $('hud-info');
    const target = portrait ? $('dock-info') : $('hud');
    if (info.parentElement !== target) target.prepend(info);
  },

  /* ── 3D view ─────────────────────────────────────────────────────────── */
  /** Load the Three.js view unless the player chose Classic 2D or WebGL is missing; 2D stays as the fallback. */
  async _init3d() {
    if (storage.get('gfx', '3d') !== '3d' || this.view3d || this._loading3d) return;
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) { console.info('[3d] no WebGL: classic 2D'); return; }
    this._loading3d = true;
    try {
      const { View3D } = await import('./render3d/view3d.js');
      this.view3d = new View3D(this);
      this.view3d.arena.setTheme(this.theme || 'void');
      this._set3d(true);
    } catch (err) {
      console.warn('[3d] could not start, using classic 2D', err);
      this.view3d = null;
      this._set3d(false);
    } finally { this._loading3d = false; }
  },

  _set3d(on) {
    this.gfx3d = !!on && !!this.view3d;
    if (this.view3d) this.view3d.active = this.gfx3d;
    RIG_OPTS.headlessLayer = this.gfx3d ? this.fighterLayer : null;
    this.root.classList.toggle('gfx-3d', this.gfx3d);
    if (this.gfx3d) this.stage.style.transform = '';
    else {
      this.view3d?.clear();
      for (const f of this.combat?.fighters || []) f.rig._hairDirty = true;
    }
    this.layout();
  },

  setGraphics(mode) {
    storage.set('gfx', mode);
    if (mode === '3d') { if (this.view3d) this._set3d(true); else this._init3d(); } else this._set3d(false);
  },

  setTheme(name) {
    this.theme = name;
    this.arena.setTheme(name);
    this.view3d?.arena.setTheme(name);
  },

  /** Stage point → page pixel (speech bubbles), in whichever view is showing. */
  project(x, y) {
    const st = this.stageRect;
    if (this.gfx3d) { const p = this.view3d.project(x, y, st.w, st.h); return { x: st.x + p.x, y: st.y + p.y }; }
    const m = this.cam.matrix, s = st.w / STAGE.W;
    return { x: st.x + (m[0] * x + m[4]) * s, y: st.y + (m[3] * y + m[5]) * s };
  },

  _safeTop() {
    if (!this._probe) {
      this._probe = document.createElement('div');
      this._probe.style.cssText = 'position:fixed;top:0;left:0;height:env(safe-area-inset-top,0px);width:1px;visibility:hidden;pointer-events:none';
      document.body.appendChild(this._probe);
    }
    return this._probe.offsetHeight || 0;
  },

  applyTouchMode() {
    const mode = storage.get('touchMode', 'auto');
    const camOk = this.cameraInput.status === 'tracking' || this.cameraInput.status === 'loading' || this.cameraInput.status === 'requesting';
    const show = mode === 'on' || (mode === 'auto' && (device.touch || !camOk && this.cameraInput.status !== 'idle'));
    this.root.classList.toggle('has-touch', !!show);
    this.root.classList.toggle('cam-live', this.cameraInput.camera.live);
  },

  async enableCamera() {
    this.cameraInput.enabled = true;
    await this.cameraInput.start();
    this.applyTouchMode();
  },

  disableCamera() {
    this.cameraInput.stop();
    this.applyTouchMode();
  },

  /* ── scenes ──────────────────────────────────────────────────────────── */
  _teardown() {
    if (this.combat) { this.combat.destroy(); this.combat = null; }
    this.fx.clear();
    this.cam.reset();
    this.hud.hide();
    this.touch.release();
    this._releaseWakeLock();
  },

  toTitle() {
    this._teardown();
    this.scene = 'title';
    this.setTheme('void');
    this.arena.setDamage(0);
    const showcase = new Combat({ fx: this.fx, camera: this.cam, layer: this.fighterLayer, p1Def: CHARACTERS.goku, p2Def: CHARACTERS.beerus, ai: 'beerus1', opts: { timeLimit: 0 } });
    showcase.paused = true;
    showcase.p1.form = 'ssj';
    showcase.p1.rig.setForm('ssj', true);
    this.combat = showcase;
    this.cam.follow(showcase.p1, showcase.p2);
    this.screens.title();
    this.root.classList.add('is-menu');
  },

  startFight(ch) {
    this._teardown();
    this.screens.hide();
    this.root.classList.remove('is-menu');
    this.scene = 'fight';
    this.setTheme(ch.theme);
    this.arena.setDamage(0);
    const combat = new Combat({
      fx: this.fx, camera: this.cam, layer: this.fighterLayer,
      p1Def: CHARACTERS[ch.player || 'goku'], p2Def: CHARACTERS[ch.opponent], ai: ch.ai,
      opts: {
        tier: ch.tier ?? 0, uiUnlocked: !!ch.uiUnlocked, muiUnlocked: !!ch.muiUnlocked, timeLimit: ch.timeLimit ?? TIMING.ROUND_TIME_S,
        fusionDef: this._fusionFor(ch), fusionTime: ch.fusionTime,
        plotArmor: ch.plotArmor, p2PlotArmor: ch.p2PlotArmor, p2IdlePose: ch.p2IdlePose, p2Form: ch.p2Form,
      },
    });
    if (ch.foeSerious) combat.p2.flags.serious = true;
    this.combat = combat;
    this._fusionButtons(combat.p1);
    this.hud.bind(combat, ch);
    this.cam.follow(combat.p1, combat.p2);
    this._requestWakeLock();
    return combat;
  },

  /** Label for the god-form shortcut button (UI for Goku, EGO for Vegeta, UI·EGO for a fusion). */
  godLabel(def) {
    const top = ladderOf(def).at(-1);
    return top === 'ultra_ego' ? 'EGO' : top === 'ui_ego' ? 'UI·EGO' : 'UI';
  },

  /** Which fusion this fight offers: the chapter's, or in Battle the one picked on the Battle screen. */
  _fusionFor(ch) {
    if (ch.fusion) return CHARACTERS[ch.fusion === true ? 'gogeta' : ch.fusion];
    if (ch.battle && ['goku', 'vegeta'].includes(ch.player)) return CHARACTERS[FUSIONS.includes(storage.get('fusionPick')) ? storage.get('fusionPick') : 'gogeta'];
    return null;
  },

  /** FUSE button before fusing; ULT (the fusion's signature attack) while fused; god-form button when allowed. */
  _fusionButtons(f) {
    const c = this.combat;
    if (!c) return;
    const god = (f.def.godForms || []).length > 0 && !!c.opts.uiUnlocked;
    this.touch.setUIUnlocked(god, this.godLabel(f.def));
    if (f.fused) this.touch.setFusion(!!f.fused.perks.ultimate, 'ULT');
    else this.touch.setFusion(!!c.opts.fusionDef, 'FUSE');
  },

  setPaused(p) {
    this._paused = p;
    this.touch.release();
  },

  async _requestWakeLock() {
    try { this._wake = await navigator.wakeLock?.request('screen'); } catch { /* not allowed right now */ }
  },
  _releaseWakeLock() { try { this._wake?.release(); } catch { /* ignore */ } this._wake = null; },

  /* ── loop ────────────────────────────────────────────────────────────── */
  frame(now) {
    const rawDt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;
    quality.sample(rawDt, now);
    const input = this.input.poll(now);
    const c = this.combat;
    const running = c && this.scene === 'fight' && !c.paused && !this._paused && !this.cutscene.active;
    const scale = running ? this.cam.timeScale(rawDt) : 1;
    const dt = rawDt * scale;

    if (running) {
      this._acc += dt;
      let first = true;
      while (this._acc >= STEP) {
        c.update(STEP, first ? input : { ...input, events: [] });
        first = false;
        this._acc -= STEP;
      }
    } else this._acc = 0;

    this.cam.update(rawDt);
    if (c) {
      c.syncRigs(running ? dt : rawDt);
      this.fx.update(running ? dt : rawDt);
      if (this.gfx3d) this.view3d.render(c, this.cam, this.fx, running ? dt : rawDt);
      else {
        this.arena.applyCamera(this.cam);
        this.fighterLayer.setAttribute('transform', `matrix(${this.cam.matrix.map((v) => v.toFixed(3)).join(',')})`);
        if (quality.preset !== 'low') this.stage.style.transform = this.cam.css3d;
        this.arena.setDamage(c.arenaDamage);
        const tint = c.p1.def.forms?.[c.p1.form]?.aura?.outer;
        this.arena.setTint(tint ? `rgb(${tint.join(',')})` : '#fff', c.p1.form !== 'base' ? 0.05 + c.p1.aura.level * 0.05 : 0);
        this.fx.render(this.cam.matrix, (ctx, t) => c.drawBack(ctx, t), (ctx, t) => c.drawFront(ctx, t));
      }
      if (this.scene === 'fight') this.hud.update(c, input, this.cameraInput, this.cam);
      this.sfx.tick(c);
    }

    if (this.cameraInput.camera.live) {
      const v = this.cameraInput.camera.video;
      const w = this.camOverlay.clientWidth, h = this.camOverlay.clientHeight;
      if (w && (this.camOverlay.width !== w || this.camOverlay.height !== h)) { this.camOverlay.width = w; this.camOverlay.height = h; }
      if (v.videoWidth) this.cameraInput.drawPreview(this.camCtx, this.camOverlay.width, this.camOverlay.height);
    }
    if (this.scene !== 'fight') this.hud.updateChip(input, this.cameraInput);

    const frameAt = this.input.frameAt;
    if (frameAt && frameAt !== this._lastFrameAt) {
      this._lastFrameAt = frameAt;
      const lat = now - frameAt;
      if (lat > 0 && lat < 1000) this.latency = this.latency ? this.latency * 0.9 + lat * 0.1 : lat;
    }
    requestAnimationFrame((t) => this.frame(t));
  },
};

app.init();
