import { STAGE, TIMING, COMBAT, FORMS } from '../config.js';
import { bus } from '../core/events.js';
import { quality } from '../core/quality.js';
import { clamp, rand, lerp, ease, damp } from '../core/math.js';
import { G } from '../input/gestureDefs.js';
import { KIND } from '../fx/particles.js';
import { drawChargeBall, drawBeam, drawSphere, drawHakai, drawKiBlast } from '../fx/energy.js';
import { drawBolt } from '../fx/lightning.js';
import { Fighter } from './fighter.js';
import { AIController, AI_PROFILES } from './ai.js';
import { computeDamage, kameStats, spiritStats, maxKameCharge, nextForm, prevForm, ladderOf, unlockedForms, isRingOut, ENEMY_ATTACKS, isEgoForm } from './moves.js';
import { createStruggle, stepStruggle, aiStrugglePush } from './beamStruggle.js';

const GOKU_KI = { core: [210, 245, 255], glow: [60, 160, 255] };
const SPIRIT_KI = { core: [220, 242, 255], glow: [90, 175, 255] };
const DEFAULT_MOVES = { beam: { name: 'Kamehameha', colors: GOKU_KI }, bomb: { name: 'Spirit Bomb', colors: SPIRIT_KI }, blast: GOKU_KI };
const DESTRUCTION = { core: [255, 236, 160], glow: [255, 96, 30] };
const LOCKED = new Set(['hit', 'knockdown', 'getup', 'teleport', 'falling', 'ko', 'struggle', 'dodge']);
const GROUNDED = new Set(['knockdown', 'getup', 'ko']);

const movesOf = (f) => f.def.moves || DEFAULT_MOVES;
/** The fighter's beam at this charge: e.g. Vegeta's Galick Gun turns into Final Flash when fully charged. */
export function beamOf(f, charge = 0) {
  const b = movesOf(f).beam;
  return b.full && charge >= b.full.at ? b.full : b;
}

/**
 * One fight: two fighters, their projectiles/beams/hazards, hit resolution, ring-outs, beam
 * struggles and the round timer. Emits bus events that audio, dialogue, HUD and story listen to.
 */
export class Combat {
  constructor({ fx, camera, layer, p1Def, p2Def, ai, opts = {} }) {
    this.fx = fx;
    this.cam = camera;
    const profile = AI_PROFILES[ai];
    this.opts = { tier: 0, uiUnlocked: false, muiUnlocked: false, timeLimit: TIMING.ROUND_TIME_S, ...opts };
    this.p1 = new Fighter({ def: p1Def, layer, side: 'p1', hp: COMBAT.HP, fx });
    this.p2 = new Fighter({ def: p2Def, layer, side: 'p2', hp: opts.p2Hp ?? profile.hp, fx });
    this.ai = new AIController(ai, { aggression: opts.aggression ?? 1 });
    this.p1.flags.plotArmor = !!opts.plotArmor;
    this.p2.flags.plotArmor = !!opts.p2PlotArmor;
    this.p2.flags.deflectSpirit = !!profile.deflectSpirit;
    if (opts.startForm) { this.p1.form = opts.startForm; this.p1.rig.setForm(opts.startForm, true); }
    if (opts.p2Form) { this.p2.form = opts.p2Form; this.p2.rig.setForm(opts.p2Form, true); }
    if (opts.p2IdlePose) this.p2.idlePose = opts.p2IdlePose;
    if (p1Def.fusion) this._fusionPerks(this.p1, p1Def, Infinity, null); // picked a fusion in Battle: fused for the whole fight
    this.projectiles = [];
    this.beams = [];
    this.hazards = [];
    this.actions = [];
    this.impacts = [];
    this.struggle = null;
    this.state = 'intro';
    this.t = 0;
    this.timeLeft = this.opts.timeLimit;
    this.paused = false;
    this.result = null;
    this.arenaDamage = 0;
    this.stats = { hits: 0, blocked: 0, dodges: 0, damage: 0, taken: 0 };
    this.onTick = null;
    this._lowKiAt = 0;
    this._gather = 0;
  }

  get fighters() { return [this.p1, this.p2]; }
  unlocked(f) { return unlockedForms(f.def, { tier: this.opts.tier, god: this.opts.uiUnlocked, mastered: this.opts.muiUnlocked }); }
  /** The form the next full power-up leads to, or null at the top of what is unlocked. */
  nextFormOf(f) { return nextForm(f.form, this.unlocked(f), ladderOf(f.def)); }
  opponentOf(f) { return f === this.p1 ? this.p2 : this.p1; }

  start() {
    this.state = 'intro';
    this.t = 0;
    bus.emit('combat:start', { combat: this });
  }

  /* ── main step (fixed dt) ─────────────────────────────────────────────── */
  update(dt, input) {
    if (this.paused) return;
    this.t += dt;
    if (this.state === 'intro' && this.t * 1000 > TIMING.INTRO_BANNER_MS) {
      this.state = 'fight';
      bus.emit('combat:fight', { combat: this });
    }
    if (this.state === 'fight' && this.opts.timeLimit) {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft === 0) this.end(this.p1.hp / this.p1.maxHp >= this.p2.hp / this.p2.maxHp ? 'p1' : 'p2', 'time');
    }
    for (const f of this.fighters) this.tickFighter(f, dt);
    const surge = this.ai.p.surge;
    if (surge && !this.p2.surged && this.p2.alive && this.state === 'fight' && this.p2.hp / this.p2.maxHp < surge.at) this.surgeUp(this.p2, surge);
    if (this.state === 'fight') {
      if (this.struggle) this.updateStruggle(dt, input);
      else {
        this.playerControl(this.p1, input, dt);
        this.ai.update(this.p2, this.p1, dt, this);
      }
    }
    for (const a of this.actions) this.updateAttack(a, dt);
    this.actions = this.actions.filter((a) => !a.done);
    this.updateProjectiles(dt);
    this.updateBeams(dt);
    this.updateHazards(dt);
    this.physics(dt);
    if (!this.struggle && this.state !== 'over') this.cam.follow(this.p1, this.p2);
    this.onTick?.(this, dt);
  }

  tickFighter(f, dt) {
    f.stateT += dt;
    f.invuln = Math.max(0, f.invuln - dt);
    f.cd.dodge = Math.max(0, f.cd.dodge - dt);
    f.cd.blast = Math.max(0, f.cd.blast - dt);
    f.cd.melee = Math.max(0, (f.cd.melee || 0) - dt);
    f.cd.fusion = Math.max(0, (f.cd.fusion || 0) - dt);
    f.cd.ultimate = Math.max(0, (f.cd.ultimate || 0) - dt);
    f.swordT = Math.max(0, (f.swordT || 0) - dt);
    if (f.fused && this.state === 'fight') {
      f.fused.t -= dt;
      if (f.fused.t <= 0) this.defuse(f);
      else {
        // a fused body never tires: ki keeps flowing back in (fighting, guarding, even transformed, a bit slower in god-tier forms)
        const slow = (FORMS[f.form]?.drain || 0) > 2 ? 0.6 : 1;
        if (f.alive && f.state !== 'powerup') f.ki = Math.min(f.maxKi, f.ki + COMBAT.KI_REGEN_IDLE * f.fused.perks.kiRegen * slow * dt);
        // Potara: burning the tank dry in Blue or UI·Ego splits the fusion early
        if (f.fused.perks.burnsOut && f.ki <= 0.5 && (f.form === 'ssj_blue' || f.form === 'ui_ego')) {
          bus.emit('combat:burnout', { fighter: f });
          this.defuse(f);
        }
      }
    }
    if (f.ultimate) this._tickUltimate(f, dt);
    if (f.state !== 'powerup') f.shake = Math.max(0, f.shake - dt * 2);
    const s = f.state;
    if (s === 'hit' && f.stateT >= f.stun) f.setState('idle');
    else if (s === 'knockdown' && f.stateT * 1000 >= TIMING.KNOCKDOWN_MS && !f.ko) f.setState('getup');
    else if (s === 'getup' && f.stateT >= 0.35) f.setState('idle');
    else if (s === 'transform' && f.stateT * 1000 >= TIMING.TRANSFORM_MS) f.setState('idle');
    else if (s === 'throwing' && f.stateT >= 0.55) f.setState('idle');
    else if (s === 'teleport' && f.stateT >= 0.22) { f.rig.setOpacity(1); f.setState('idle'); }
    else if (s === 'strike' && f.stateT >= (f.strikeKind === 'kick' ? 0.38 : 0.24)) f.setState('idle');
    else if (s === 'dodge') {
      const k = clamp(f.stateT * 1000 / TIMING.DODGE_MS);
      f.x = lerp(f.dodgeFrom, f.dodgeTo, ease.outCubic(k));
      if (k >= 1) f.setState('idle');
    } else if (s === 'falling') {
      f.vy += 2600 * dt;
      f.y += f.vy * dt;
      f.x += f.vx * dt * 0.4;
      f.spin += (f.vx >= 0 ? 1 : -1) * 520 * dt;
      if (f.stateT * 1000 >= TIMING.RINGOUT_FALL_MS && !f.out) {
        f.out = true;
        this.end(f === this.p1 ? 'p2' : 'p1', 'ringout');
      }
    }
    if (!f.alive) return;
    if (f.state === 'idle' && f.form === 'base') f.ki = Math.min(f.maxKi, f.ki + COMBAT.KI_REGEN_IDLE * dt);
    const drain = FORMS[f.form]?.drain || 0;
    if (drain && f.isPlayer && this.state === 'fight' && f.state !== 'powerup' && f.state !== 'transform') {
      f.ki -= drain * dt;
      if (f.ki <= 0) {
        f.ki = 0;
        const back = prevForm(f.form, ladderOf(f.def));
        f.form = back;
        f.rig.setForm(back);
        this.fx.burst(f.center.x, f.center.y, [200, 200, 220], 18, 400);
        bus.emit('combat:revert', { fighter: f, form: back });
      }
    }
  }

  /* ── player ───────────────────────────────────────────────────────────── */
  playerControl(f, input, dt) {
    for (const e of input.events) {
      if (e.type === 'dodge') this.instantTransmission(f, e.dir);
      else if ((e.type === 'push' || e.type === 'fire') && f.state === 'charge_kame' && f.charge >= TIMING.KAME_MIN_CHARGE) this.fireKame(f);
      else if (e.type === 'ui') this.activateUI(f);
      else if (e.type === 'punch' || e.type === 'kick') this.strike(f, e.type);
      else if (e.type === 'fuse') (f.fused ? this.fusionUltimate(f) : this.fuse(f));
    }
    const pose = input.pose;
    f.shake = Math.max(f.shake, input.shake || 0);
    if (f.needRelease && pose !== f.needRelease) f.needRelease = null;
    if (!f.canAct) return;

    if (f.state === 'charge_kame' && pose !== G.KAME) {
      if (f.charge >= TIMING.KAME_MIN_CHARGE) this.fireKame(f); else this.cancelCharge(f);
      return;
    }
    if (f.state === 'charge_spirit' && pose !== G.SPIRIT) {
      if (f.charge >= TIMING.SPIRIT_MIN_CHARGE) this.throwSpirit(f); else this.cancelCharge(f);
      return;
    }
    if (f.needRelease && f.needRelease === pose) {
      if (f.state !== 'idle') f.setState('idle');
      return;
    }
    switch (pose) {
      case G.KAME: this.chargeKame(f, dt); break;
      case G.SPIRIT: this.chargeSpirit(f, dt); break;
      case G.POWER: this.powerUp(f, dt, input); break;
      case G.GUARD:
        if (f.state !== 'guard') { f.setState('guard'); bus.emit('combat:guard', { fighter: f }); }
        f.ki = Math.max(0, f.ki - COMBAT.GUARD_KI_DRAIN * dt);
        break;
      case G.KIBLAST: this.kiBlast(f); break;
      case G.FUSE:
        if (f.fused) this.fusionUltimate(f); else this.fuse(f);
        f.needRelease = G.FUSE;
        break;
      case G.TELEPORT:
        this.instantTransmission(f, 0);
        f.needRelease = G.TELEPORT;
        break;
      default:
        if (f.state !== 'idle') {
          if (f.state === 'powerup') bus.emit('combat:powerup', { fighter: f, on: false });
          f.setState('idle');
        }
    }
  }

  lowKi(f) {
    if (this.t - this._lowKiAt < 1.5) return;
    this._lowKiAt = this.t;
    bus.emit('combat:lowki', { fighter: f });
  }

  chargeKame(f, dt) {
    if (f.state !== 'charge_kame') {
      if (f.ki < COMBAT.KAME.costBase + 2) { this.lowKi(f); f.needRelease = G.KAME; return; }
      f.setState('charge_kame');
      f.charge = 0;
      bus.emit('combat:charge', { fighter: f, kind: 'kame' });
    }
    f.charge = Math.min(maxKameCharge(f.ki), f.charge + (dt * 1000) / TIMING.KAME_CHARGE_MS);
    this._converge(f.rig.anchors.hands, beamOf(f, f.charge).colors.glow, dt, 50 + f.charge * 70);
  }

  fireKame(f) {
    const c = f.charge;
    const st = kameStats(c);
    const beam = beamOf(f, c);
    f.ki = Math.max(0, f.ki - st.cost);
    const h = f.rig.anchors.hands;
    this.beams.push({ owner: f, dir: f.facing, x0: h.x, y: h.y, tip: h.x + f.facing * 10, width: st.width, dmg: st.dmg, kb: st.kb, charge: c, phase: 'extend', t: 0, colors: beam.colors, name: beam.name, blockable: true, dodgeable: true, alpha: 1 });
    f.setState('firing');
    f.needRelease = G.KAME;
    f.charge = 0;
    this.cam.shake(0.25 + 0.35 * c);
    this.cam.punch(1);
    this.fx.flash([200, 235, 255], 0.15 + 0.25 * c, 5);
    bus.emit('combat:fire', { fighter: f, kind: 'kame', power: c, name: beam.name });
  }

  chargeSpirit(f, dt) {
    let sp = this.projectiles.find((p) => p.kind === 'spirit' && p.owner === f && p.phase === 'charging');
    if (f.state !== 'charge_spirit' || !sp) {
      f.setState('charge_spirit');
      f.charge = 0;
      sp = { kind: 'spirit', owner: f, phase: 'charging', x: f.x, y: f.y - 400, r: 10, t: 0, colors: movesOf(f).bomb.colors, blockable: false, dodgeable: true };
      this.projectiles.push(sp);
      bus.emit('combat:charge', { fighter: f, kind: 'spirit' });
    }
    f.charge = Math.min(1, f.charge + (dt * 1000) / TIMING.SPIRIT_CHARGE_MS);
    const target = spiritStats(f.charge).radius;
    sp.r = damp(sp.r, target, 6, dt);
    const h = f.rig.anchors.hands;
    sp.x = h.x;
    sp.y = h.y - sp.r - 12;
    // energy streams in from every edge of the view
    this._gather += dt * 70;
    while (this._gather >= 1) {
      this._gather -= 1;
      const side = Math.random();
      const x = side < 0.4 ? rand(0, STAGE.W) : side < 0.7 ? -40 : STAGE.W + 40;
      const y = side < 0.4 ? -60 : rand(0, STAGE.GROUND_Y);
      this.fx.particles.emit({ x, y, vx: rand(-40, 40), vy: rand(-40, 40), pull: 2600, tx: sp.x, ty: sp.y, drag: 1.4, life: 1.6, size: rand(6, 12), size1: 4, color: Math.random() < 0.3 ? [255, 255, 255] : sp.colors.glow, kind: KIND.GLOW });
    }
  }

  throwSpirit(f) {
    const sp = this.projectiles.find((p) => p.kind === 'spirit' && p.owner === f && p.phase === 'charging');
    if (!sp) { f.setState('idle'); return; }
    const target = this.opponentOf(f);
    const st = spiritStats(f.charge);
    Object.assign(sp, {
      phase: 'thrown', t: 0, dmg: st.dmg, kb: st.kb, charge: f.charge, shape: movesOf(f).bomb.shape,
      from: { x: sp.x, y: sp.y },
      to: { x: target.x, y: target.y - target.height * 0.45 },
      ctrl: { x: (sp.x + target.x) / 2, y: Math.min(sp.y, target.y - target.height) - 180 },
    });
    f.setState('throwing');
    f.needRelease = G.SPIRIT;
    f.charge = 0;
    this.cam.shake(0.3);
    bus.emit('combat:fire', { fighter: f, kind: 'spirit', power: sp.charge });
  }

  cancelCharge(f) {
    if (f.state === 'charge_spirit') {
      const sp = this.projectiles.find((p) => p.kind === 'spirit' && p.owner === f && p.phase === 'charging');
      if (sp) { sp.dead = true; this.fx.burst(sp.x, sp.y, sp.colors.glow, 20, 300); }
    }
    if (f.state === 'charge_kame' || f.state === 'charge_spirit') bus.emit('combat:charge', { fighter: f, kind: null });
    f.charge = 0;
    if (f.canAct) f.setState('idle');
  }

  kiBlast(f) {
    if (f.state !== 'kiblast') f.setState('kiblast');
    if (f.cd.blast > 0) return;
    if (f.ki < COMBAT.KIBLAST.cost) { this.lowKi(f); return; }
    f.ki -= COMBAT.KIBLAST.cost;
    f.cd.blast = TIMING.KIBLAST_REPEAT_MS / 1000;
    f.blastAlt = !f.blastAlt;
    f.poseHint = f.blastAlt ? 'kiblast2' : 'kiblast';
    const h = f.blastAlt ? f.rig.anchors.handB : f.rig.anchors.handF;
    const B = COMBAT.KIBLAST;
    this.projectiles.push({ kind: 'kiblast', owner: f, x: h.x + f.facing * 20, y: h.y, vx: f.facing * TIMING.KIBLAST_SPEED, vy: 0, r: B.radius, dmg: B.dmg, kb: B.kb, colors: movesOf(f).blast, homing: true, blockable: true, dodgeable: true, t: 0 });
    if (f.fused?.perks.perk === 'twin') {
      // Gogeta: the other hand fires too, curving in from above
      const h2 = f.blastAlt ? f.rig.anchors.handF : f.rig.anchors.handB;
      this.projectiles.push({ kind: 'kiblast', owner: f, x: h2.x + f.facing * 20, y: h2.y - 10, vx: f.facing * TIMING.KIBLAST_SPEED * 0.92, vy: -260, r: B.radius, dmg: B.dmg * 0.8, kb: B.kb, colors: movesOf(f).blast, homing: true, blockable: true, dodgeable: true, t: 0 });
    }
    bus.emit('combat:fire', { fighter: f, kind: 'kiblast' });
  }

  powerUp(f, dt, input) {
    if (f.state !== 'powerup') { f.setState('powerup'); bus.emit('combat:powerup', { fighter: f, on: true }); }
    const two = input.intensity >= 1 ? COMBAT.KI_TWO_FISTS : 1;
    const rate = COMBAT.KI_GAIN_POWER * two * (1 + (input.shake || 0) * COMBAT.KI_SHAKE_BONUS);
    f.ki = Math.min(f.maxKi, f.ki + rate * dt);
    if (f.ki >= f.maxKi - 0.5) {
      f.transformMeter += dt * 1000;
      const next = this.nextFormOf(f);
      if (next && f.transformMeter >= TIMING.TRANSFORM_HOLD_MS) this.transform(f, next);
    } else {
      f.transformMeter = Math.max(0, f.transformMeter - dt * 500);
    }
    this.cam.shake(dt * 0.5);
    if (Math.random() < dt * 14) {
      this.fx.particles.emit({ x: f.x + rand(-90, 90), y: STAGE.GROUND_Y - 4, vx: rand(-20, 20), vy: rand(-260, -120), grav: -60, drag: 0.6, life: rand(0.8, 1.4), size: rand(4, 9), size1: 3, rot: rand(0, 6), vr: rand(-4, 4), color: [110, 100, 140], kind: KIND.DEBRIS });
    }
  }

  transform(f, form) {
    f.form = form;
    f.defense = FORMS[form]?.defense ?? 1;
    f.rage = 0;
    f.rig.setForm(form);
    f.rig.spin(1, 0.65);
    f.setState('transform');
    f.invuln = TIMING.TRANSFORM_MS / 1000 + 0.1;
    f.transformMeter = 0;
    f.ki = f.maxKi;
    const c = f.def.forms?.[form]?.aura?.outer || [255, 220, 120];
    const cc = f.center;
    this.fx.flash(c, 0.7, 2.6);
    this.fx.shockwave(cc.x, STAGE.GROUND_Y, { r1: 520, dur: 0.7, width: 18, color: c, flat: 0.25 });
    this.fx.shockwave(cc.x, cc.y, { r1: 300, dur: 0.5, width: 10, color: [255, 255, 255] });
    this.fx.burst(cc.x, cc.y, c, 40, 900, 7);
    this.fx.dust(f.x, STAGE.GROUND_Y, 16);
    this.cam.shake(0.65);
    this.cam.punch(1);
    this.cam.freeze(90);
    bus.emit('combat:transform', { fighter: f, form });
  }

  activateUI(f) {
    if (!this.opts.uiUnlocked || f.inUI || f.form === 'ultra_ego' || f.form === 'ui_ego' || !f.alive || LOCKED.has(f.state) || f.state === 'firing') return;
    if (f.ki < COMBAT.UI_MIN_KI) { this.lowKi(f); return; }
    this.cancelCharge(f);
    const god = this.unlocked(f).filter((x) => (f.def.godForms || ['ui_sign', 'ui']).includes(x));
    if (!god.length) return;
    this.transform(f, god[god.length - 1]);
    bus.emit('combat:ui', { fighter: f, mastered: this.opts.muiUnlocked });
  }

  /**
   * 👉👈 Fusion: the player and their partner become one warrior (Gogeta by the Fusion Dance, Vegito
   * by the Potara) for a while. The fused body keeps the transformation level you had reached, heals,
   * refills ki, hits harder, takes less damage and regenerates ki the whole time.
   */
  fuse(f, force = false) {
    const into = this.opts.fusionDef;
    if (!into || f.fused || !f.alive || (!force && f.cd.fusion > 0) || !f.isPlayer) return;
    if (!force && !['idle', 'guard', 'powerup', 'kiblast'].includes(f.state)) return;
    if (force) this.cancelCharge(f);
    const from = f.def, fromForm = f.form;
    const P = into.fusion || {};
    const col = P.flash || [255, 230, 160];
    this.fx.flash([255, 245, 220], 1, 2.2);
    this.fx.burst(f.center.x, f.center.y, col, 60, 1100, 8);
    this.fx.shockwave(f.center.x, f.center.y, { r1: 420, dur: 0.7, width: 16, color: col });
    this.fx.shockwave(f.x, STAGE.GROUND_Y, { r1: 640, dur: 0.9, width: 20, color: col, flat: 0.22 });
    f.swapDef(into, this._fusedForm(into, fromForm));
    f.defense = FORMS[f.form]?.defense ?? 1;
    this._fusionPerks(f, into, (this.opts.fusionTime || P.seconds || COMBAT.FUSION_S), { def: from, form: fromForm });
    f.ki = f.maxKi;
    f.hp = Math.min(f.maxHp, f.hp + f.maxHp * (P.heal ?? 0.25));
    f.invuln = 1.2;
    f.setState('transform');
    f.rig.spin(2, 0.9);
    this.cam.orbit(-14, -4, 0.9);
    this.cam.freeze(140);
    bus.emit('combat:fusion', { fighter: f, on: true, name: into.name, method: P.method, label: P.label });
  }

  /** The fused form that matches how far the player had transformed. */
  _fusedForm(into, form) {
    const has = (x) => (into.ladder || []).includes(x);
    if (['ui_sign', 'ui', 'ultra_ego'].includes(form) && (into.godForms || []).includes('ui_ego') && this.opts.uiUnlocked) return 'ui_ego';
    if (['ssj_blue', 'blue_kaioken', 'blue_evolved', 'ui_sign', 'ui', 'ultra_ego'].includes(form) && has('ssj_blue')) return 'ssj_blue';
    if (form === 'ssj4' && has('ssj4')) return 'ssj4';
    if (form !== 'base' && form !== 'kaioken' && form !== 'ascended' && has('ssj')) return 'ssj';
    return into.defaultForm || 'base';
  }

  _fusionPerks(f, def, seconds, from) {
    const P = def.fusion || {};
    f.fused = { from, t: seconds, max: seconds, perks: { power: COMBAT.FUSION_POWER, guard: 1, kiRegen: 1, ...P } };
    f.power = f.fused.perks.power;
  }

  defuse(f) {
    if (!f.fused) return;
    const back = f.fused.from;
    if (!back) { f.fused.t = Infinity; return; } // started fused (Battle): nothing to split into
    this.fx.burst(f.center.x, f.center.y, [220, 220, 255], 30, 700, 6);
    f.ultimate = null;
    f.swordT = 0;
    f.swapDef(back.def, 'base');
    f.defense = 1;
    f.rage = 0;
    f.fused = null;
    f.power = 1;
    f.cd.fusion = COMBAT.FUSION_COOLDOWN_S;
    if (f.state === 'ultimate') f.setState('idle');
    f.rig.spin(1, 0.5);
    bus.emit('combat:fusion', { fighter: f, on: false, name: back.def.name });
  }

  /** 👉👈 again while fused: the fusion's signature attack. */
  fusionUltimate(f) {
    const u = f.fused?.perks.ultimate;
    if (!u || f.cd.ultimate > 0 || !f.alive || !['idle', 'guard', 'powerup', 'kiblast', 'strike'].includes(f.state)) return;
    if (f.ki < u.cost) { this.lowKi(f); return; }
    const target = this.opponentOf(f);
    if (!target.alive) return;
    f.ki -= u.cost;
    f.cd.ultimate = COMBAT.ULTIMATE_COOLDOWN_S;
    if (f.state === 'powerup') bus.emit('combat:powerup', { fighter: f, on: false });
    if (u.id === 'soul_punisher') this._soulPunisher(f, target, u);
    else this._swordBarrage(f, target, u);
    this.cam.orbit(-16 * f.facing, -5, 0.8);
    this.cam.freeze(120);
    bus.emit('combat:ultimate', { fighter: f, name: u.name, id: u.id });
  }

  /** Gogeta: a rainbow-white orb of pure ki. Unblockable; purges the target's power surge. */
  _soulPunisher(f, target, u) {
    const S = COMBAT.SOUL_PUNISHER;
    const from = { x: f.x + f.facing * 30, y: f.y - f.height - 70 };
    this.projectiles.push({
      kind: 'spirit', owner: f, phase: 'thrown', x: from.x, y: from.y, r: S.radius, t: 0, flight: S.flightMs,
      colors: { core: [255, 255, 255], glow: [255, 170, 240] }, dmg: S.dmg, kb: S.kb, charge: 1, purify: true, noDeflect: true,
      from, to: { x: target.x, y: target.y - target.height * 0.5 }, ctrl: { x: (from.x + target.x) / 2, y: from.y - 120 },
      blockable: false, dodgeable: true,
    });
    f.setState('throwing');
    f.poseHint = 'cast';
    f.invuln = 0.5;
    this.fx.flash([255, 230, 255], 0.7, 3);
    this.fx.burst(from.x, from.y, [255, 200, 250], 40, 800, 7);
  }

  /** Vegito: blink in beside the foe, then five Spirit Sword slashes; the last one sends them flying. */
  _swordBarrage(f, target, u) {
    const to = clamp(target.x - f.facing * (STAGE.MIN_GAP + 4), STAGE.PLATFORM_L + 40, STAGE.PLATFORM_R - 40);
    this._afterimages(f, f.x - to);
    f.x = to;
    f.ultimate = { kind: 'sword', t: 0, hits: 0, target };
    f.setState('ultimate');
    f.invuln = COMBAT.SWORD_BARRAGE.hits * COMBAT.SWORD_BARRAGE.gap + 0.4;
    this.fx.burst(f.center.x, f.center.y, f.def.ki?.glow || [120, 200, 255], 24, 600, 5);
  }

  _tickUltimate(f, dt) {
    const u = f.ultimate, S = COMBAT.SWORD_BARRAGE;
    if (u.kind !== 'sword' || !f.alive || this.state !== 'fight') { f.ultimate = null; return; }
    u.t += dt;
    if (u.t < (u.hits + 1) * S.gap) return;
    u.hits++;
    const last = u.hits >= S.hits;
    f.poseHint = last ? 'kick' : u.hits % 2 ? 'punch2' : 'punch';
    f.rig.lunge = 1;
    if (last) f.rig.spin(1, 0.35);
    const res = this.resolveHit(u.target, f, { dmg: last ? S.finisher : S.dmg, kb: last ? S.kb : 18, kind: 'melee', blockable: true, dodgeable: false, heavy: last, knockdown: last, fromX: f.x });
    const h = f.rig.anchors.handF;
    const col = f.def.ki?.glow || [120, 200, 255];
    this.fx.shockwave(h.x + f.facing * 40, h.y, { r1: last ? 200 : 110, dur: 0.22, width: 8, color: col });
    for (let i = 0; i < 10; i++) this.fx.particles.emit({ x: h.x + f.facing * rand(0, 120), y: h.y + rand(-60, 60), vx: f.facing * rand(500, 1100), vy: rand(-500, 500), drag: 4, life: rand(0.15, 0.3), size: 4, color: col, kind: KIND.STREAK });
    if (res === 'hit') this.cam.shake(last ? 0.45 : 0.15);
    if (last || !u.target.alive) { f.ultimate = null; f.setState('strike'); f.strikeKind = 'kick'; }
  }

  /** An enemy at low health powers up: new aura, more power, faster. */
  surgeUp(f, s) {
    f.surged = true;
    f.power *= s.mult;
    f.auraOverride = s.aura;
    f.rig.scale *= 1.07;
    this.ai.aggression *= s.speed || 1.25;
    f.rig.spin(1, 0.6);
    this.fx.flash(s.aura.outer, 0.6, 2);
    this.fx.shockwave(f.center.x, f.center.y, { r1: 380, dur: 0.6, width: 14, color: s.aura.outer });
    this.cam.orbit(12 * -f.facing, -3, 0.7);
    this.cam.shake(0.5);
    bus.emit('combat:surge', { fighter: f, name: s.name });
  }

  /** ✊ punch / 🦵 kick. From range the fighter blinks in (afterimages) and strikes; home-drift brings them back. */
  strike(f, kind) {
    const base = kind === 'kick' ? COMBAT.KICK : COMBAT.PUNCH;
    const sword = f.fused?.perks.perk === 'sword';
    const M = sword ? { ...base, reach: base.reach + COMBAT.SPIRIT_SWORD.reach, dmg: base.dmg * COMBAT.SPIRIT_SWORD.dmg } : base;
    if (!f.alive || f.cd.melee > 0) return;
    if (!['idle', 'guard', 'powerup', 'kiblast', 'strike'].includes(f.state)) return;
    const opp = this.opponentOf(f);
    if (Math.abs(opp.x - f.x) > M.reach + 20) {
      const to = clamp(opp.x - f.facing * (STAGE.MIN_GAP + 6), STAGE.PLATFORM_L + 40, STAGE.PLATFORM_R - 40);
      this._afterimages(f, f.x - to);
      this.fx.burst(f.center.x, f.center.y, f.def.forms?.[f.form]?.aura?.outer || [220, 230, 255], 10, 320, 4);
      f.x = to;
    }
    if (f.state === 'powerup') bus.emit('combat:powerup', { fighter: f, on: false });
    f.cd.melee = M.cooldown;
    f.strikeKind = kind;
    f.combo = this.t - (f.lastStrikeAt ?? -9) < 0.8 ? (f.combo || 0) + 1 : 0; // strikes within 0.8 s chain
    f.lastStrikeAt = this.t;
    f.setState('strike');
    f.poseHint = kind === 'kick' ? 'kick' : f.combo % 2 ? 'punch2' : 'punch';
    f.rig.lunge = 1;
    if (sword) f.swordT = 0.32;
    const heavy = kind === 'kick' || f.combo >= 3;
    const res = this.resolveHit(opp, f, { dmg: M.dmg * (heavy && kind !== 'kick' ? 1.4 : 1), kb: M.kb * (heavy ? 1.5 : 1), kind, blockable: true, dodgeable: true, heavy, knockdown: kind === 'kick' && f.combo >= 3, fromX: f.x });
    if (res === 'hit' || res === 'blocked') {
      const h = f.rig.anchors[kind === 'kick' ? 'chest' : 'handF'];
      this.fx.shockwave(h.x + f.facing * 30, h.y, { r1: kind === 'kick' ? 120 : 70, dur: 0.22, width: 6, color: [255, 255, 255] });
    }
    bus.emit('combat:strike', { fighter: f, kind, result: res });
  }

  /** ✌️ Instant Transmission: vanish, reappear further along the ring at a new altitude, then settle. */
  instantTransmission(f, dir = 0) {
    if (f.cd.dodge > 0 || !f.alive) return;
    if (!['idle', 'guard', 'powerup', 'charge_kame', 'charge_spirit', 'kiblast'].includes(f.state)) return;
    if (f.state === 'charge_kame' || f.state === 'charge_spirit') this.cancelCharge(f);
    const opp = this.opponentOf(f);
    const lo = STAGE.PLATFORM_L + 70, hi = STAGE.PLATFORM_R - 70;
    const keepSide = (x) => (f.isPlayer ? Math.min(x, opp.x - STAGE.MIN_GAP) : Math.max(x, opp.x + STAGE.MIN_GAP));
    // Gesture teleports go whichever way has more room, so they never strand you at the ring's edge.
    const roomBack = f.facing > 0 ? f.x - lo : hi - f.x;
    const roomFwd = Math.abs(opp.x - f.x) - STAGE.MIN_GAP;
    const d = dir || (roomBack > roomFwd ? -f.facing : f.facing);
    const to = keepSide(clamp(f.x + d * COMBAT.TELEPORT_DIST, lo, hi));
    const col = f.def.forms?.[f.form]?.aura?.outer || [200, 220, 255];
    this.fx.burst(f.center.x, f.center.y, col, 14, 380, 4);
    this.fx.shockwave(f.center.x, f.center.y, { r1: 90, dur: 0.25, width: 6, color: col });
    f.x = to;
    f.altBoost = rand(...COMBAT.TELEPORT_ALT);
    f.invuln = TIMING.DODGE_IFRAMES_MS / 1000 + 0.15;
    f.cd.dodge = TIMING.DODGE_COOLDOWN_MS / 1000;
    f.rig.setOpacity(0.25);
    f.rig.spin(1, 0.3);
    f.setState('teleport');
    this.fx.burst(f.x, f.y - f.altBoost - f.height * 0.55, col, 18, 420, 4);
    if (f.isPlayer) this.stats.dodges++;
    bus.emit('combat:dodge', { fighter: f, auto: false, teleport: true });
  }

  aiDodge(f) {
    const back = -f.facing;
    const opp = this.opponentOf(f);
    let to = clamp(f.x + back * 190, STAGE.PLATFORM_L + 90, STAGE.PLATFORM_R - 90);
    if (Math.abs(to - opp.x) < STAGE.MIN_GAP) to = f.x;
    this._afterimages(f, f.x - to);
    f.x = to;
    f.invuln = 0.45;
    f.rig.setOpacity(0.55);
    f.setState('teleport');
    bus.emit('combat:dodge', { fighter: f, auto: false });
  }

  autoDodge(f, attacker) {
    const shift = -f.facing * 60;
    const to = clamp(f.x + shift, STAGE.PLATFORM_L + 40, STAGE.PLATFORM_R - 40);
    f.dodgeFrom = f.x;
    f.dodgeTo = to;
    f.setState('dodge');
    f.invuln = 0.35;
    this._afterimages(f, f.x - to + f.facing * 30, 'ui');
    this.fx.burst(f.center.x, f.center.y, [210, 220, 255], 12, 300, 4);
    bus.emit('combat:dodge', { fighter: f, auto: true });
    if ((f.form === 'ui' || f.form === 'ui_ego') && Math.abs(attacker.x - f.x) < 260) {
      // Mastered Ultra Instinct counters instantly
      setTimeout(() => {
        if (this.state !== 'fight' || !attacker.alive) return;
        this.resolveHit(attacker, f, { dmg: COMBAT.UI_COUNTER_DMG, kb: 180, kind: 'counter', blockable: false, dodgeable: false, heavy: true, fromX: f.x });
        this.fx.flash([220, 230, 255], 0.35, 6);
        bus.emit('combat:counter', { fighter: f });
      }, 90);
    }
  }

  _afterimages(f, travel, cls = '') {
    const n = cls === 'ui' ? 3 : quality.settings.afterimages;
    for (let i = 1; i <= n; i++) f.rig.spawnAfterimage((travel * i) / n, 0.5 - i * 0.1, 0.32 + i * 0.05, cls);
  }

  /* ── hits ─────────────────────────────────────────────────────────────── */
  resolveHit(target, attacker, o) {
    if (!target.alive || this.state !== 'fight') return 'none';
    const hb = target.center;
    if (target.invuln > 0 && o.dodgeable !== false) {
      this.fx.number(target.x, target.y - target.height - 10, 'MISS', [190, 215, 255]);
      return 'miss';
    }
    if (target.inUI && o.dodgeable !== false && target.state !== 'struggle') {
      const chance = target.form === 'ui' ? COMBAT.UI_DODGE : target.form === 'ui_ego' ? COMBAT.UI_EGO_DODGE : COMBAT.UI_SIGN_DODGE;
      if (Math.random() < chance) { this.autoDodge(target, attacker); return 'dodged'; }
    }
    const blocked = target.state === 'guard' && o.blockable !== false;
    // Energy Barrier: absorbs ki blasts, takes 80% off beams and spheres, 75% off everything else.
    const reduction = o.kind === 'beam' || o.kind === 'sphere' ? COMBAT.BARRIER_BEAM_REDUCTION : COMBAT.GUARD_REDUCTION;
    const defense = target.defense / (target.fused?.perks.guard || 1); // a fused body shrugs off more
    let dmg = blocked && o.kind === 'blast' ? 0 : computeDamage({ base: o.dmg, mult: attacker.mult, defense, blocked, reduction });
    // Ultra Ego: every hit that lands makes the fighter stronger
    if (!blocked && dmg > 0 && isEgoForm(target.form)) target.rage = Math.min(COMBAT.EGO_RAGE.max, (target.rage || 0) + COMBAT.EGO_RAGE.perHit);
    if (blocked) target.barrierHit = 0.25;
    if (target.flags.plotArmor) dmg = Math.min(dmg, Math.max(0, target.hp - 1));
    target.hp = Math.max(0, target.hp - dmg);
    const dir = Math.sign(target.x - (o.fromX ?? attacker.x)) || -target.facing;
    target.vx += dir * (o.kb || 0) * (blocked ? COMBAT.GUARD_KB_MULT : 1) * COMBAT.FRICTION;

    const heavy = o.heavy || dmg >= 90;
    target.rig.flash(heavy ? 120 : 80);
    if (heavy || o.kind === 'punch' || o.kind === 'kick') this.impacts.push({ x: target.center.x, y: hb.y, t: 0, dur: heavy ? 0.26 : 0.16, power: heavy ? 1 : 0.55 });
    const hitX = target.x - dir * 30, hitY = hb.y + rand(-30, 20);
    const color = attacker.def.ki?.glow || attacker.def.forms?.[attacker.form]?.aura?.outer || [255, 230, 160];
    this.fx.burst(hitX, hitY, blocked ? [200, 210, 230] : color, heavy ? 34 : 16, heavy ? 900 : 600);
    this.fx.number(target.x, target.y - target.height - 6, blocked ? `${dmg}` : dmg, blocked ? [170, 185, 210] : heavy ? [255, 214, 74] : [255, 255, 255], heavy && !blocked);
    this.cam.shake(clamp(dmg / 320) * 0.6 + 0.08);
    this.cam.freeze(heavy ? TIMING.HITSTOP_HEAVY_MS : TIMING.HITSTOP_LIGHT_MS);
    this.arenaDamage = Math.min(1, this.arenaDamage + dmg / 5000);

    const armored = target === this.p2 && this.ai.p.armor && !heavy;
    if (blocked) {
      target.stun = TIMING.BLOCK_STUN_MS / 1000;
      if (target.isPlayer) this.stats.blocked++;
    } else if (!armored) {
      if (target.isPlayer) this.cancelCharge(target);
      if (target === this.p2) this.ai.cancel();
      target.tele = null;
      target.setState(o.knockdown ? 'knockdown' : 'hit');
      target.stun = TIMING.HIT_STUN_MS / 1000;
    }
    if (attacker.isPlayer && !blocked) { this.stats.hits++; this.stats.damage += dmg; }
    if (target.isPlayer) this.stats.taken += dmg;
    bus.emit('combat:hit', { target, attacker, dmg, blocked, kind: o.kind, heavy });
    if (target.hp <= 0) this.knockout(target, attacker);
    return blocked ? 'blocked' : 'hit';
  }

  knockout(loser, winner) {
    loser.ko = true;
    loser.setState('ko');
    loser.vx += Math.sign(loser.x - winner.x) * 700;
    this.cam.slow(0.25, TIMING.KO_SLOWMO_MS);
    this.cam.orbit(16 * Math.sign(winner.x - loser.x || 1), -5, 1.1); // cinematic finish
    loser.rig.spin(1.5, 0.9);
    this.fx.flash([255, 255, 255], 0.6, 2);
    this.end(winner.side, 'ko');
  }

  ringOut(f) {
    f.setState('falling');
    f.vy = -420;
    f.spin = 0;
    this.cancelCharge(f);
    this.cam.shake(0.5);
    bus.emit('combat:ringout', { fighter: f });
  }

  end(winner, method) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.struggle = null;
    this.cam.hold(null);
    for (const a of this.actions) a.done = true;
    const w = winner === 'p1' ? this.p1 : this.p2;
    const l = this.opponentOf(w);
    for (const f of this.fighters) f.tele = null;
    setTimeout(() => {
      if (w.alive) { w.setState('victory'); }
      if (l.alive && l.state !== 'falling') l.setState('defeat');
    }, 700);
    this.result = { winner, method, time: this.t, stats: { ...this.stats } };
    bus.emit('combat:end', { combat: this, ...this.result });
  }

  /* ── opponent attacks ─────────────────────────────────────────────────── */
  enemyAttack(f, target, atk) {
    const a = { f, target, atk, type: atk.type, phase: 'tele', t: 0, i: 0, done: false };
    const rules = ENEMY_ATTACKS[atk.type] || ENEMY_ATTACKS[atk.type === 'feint' ? 'rush' : 'rush'];
    f.tele = { k: 0, unblockable: !rules.blockable, type: atk.type };
    const tele = { rush: 'telegraph', feint: 'telegraph', slam: 'telegraph', volley: 'telegraph', beam: 'beam_charge', sphere: 'cast', hakai: 'point' };
    f.setState(tele[atk.type] || 'telegraph');
    if (atk.type === 'sphere') {
      a.sphere = { kind: 'sphere', owner: f, phase: 'charging', x: f.x, y: f.y - 300, r: 6, t: 0, dmg: atk.dmg, kb: atk.kb, colors: DESTRUCTION, blockable: true, dodgeable: true };
      this.projectiles.push(a.sphere);
    }
    if (atk.type === 'hakai') {
      a.hz = { kind: 'hakai', owner: f, x: target.x, r: atk.radius, t: 0, tele: atk.tele / 1000, phase: 'tele', dmg: atk.dmg };
      this.hazards.push(a.hz);
    }
    this.actions.push(a);
    bus.emit('combat:telegraph', { fighter: f, type: atk.type, unblockable: !rules.blockable });
    return a;
  }

  abort(a) {
    a.done = true;
    a.f.tele = null;
    if (a.sphere && a.sphere.phase === 'charging') a.sphere.dead = true;
    if (a.hz && a.hz.phase === 'tele') a.hz.dead = true;
  }

  updateAttack(a, dt) {
    const { f, target, atk } = a;
    if (a.done) return;
    if (!f.alive || this.state !== 'fight' || this.struggle || (LOCKED.has(f.state) && f.state !== 'teleport' && a.phase !== 'post')) {
      this.abort(a);
      return;
    }
    a.t += dt;
    const T = atk.tele / 1000;
    if (a.phase === 'tele') {
      const k = clamp(a.t / T);
      if (f.tele) f.tele.k = k;
      if (a.sphere) {
        a.sphere.r = lerp(6, atk.radius, ease.outCubic(k));
        const h = f.rig.anchors.handF;
        a.sphere.x = h.x;
        a.sphere.y = h.y - a.sphere.r - 8;
      }
      if (a.hz && k < 0.6) a.hz.x = damp(a.hz.x, target.x, 5, dt);
      if (a.type === 'beam') this._converge(f.rig.anchors.hands, f.def.ki?.glow || [255, 80, 80], dt, 60);
      if (a.t >= T) { f.tele = null; a.phase = 'go'; a.t = 0; this._attackGo(a); }
      return;
    }
    const gap = () => Math.abs(target.x - f.x);
    switch (a.type) {
      case 'rush':
      case 'feint':
        if (a.phase === 'dash') {
          f.x += f.facing * (atk.speed || 1300) * dt;
          if (gap() <= 165 || a.t > 0.7) { f.x = target.x - f.facing * Math.max(150, Math.min(gap(), 165)); a.phase = 'combo'; a.t = 0; a.i = 0; f.setState('melee'); }
        } else if (a.phase === 'blink') {
          if (a.t >= 0.18) {
            f.x = clamp(target.x - f.facing * 165, STAGE.PLATFORM_L + 40, STAGE.PLATFORM_R - 40);
            if (f.side === 'p2') f.x = Math.max(f.x, target.x + 150);
            f.rig.setOpacity(1);
            this._afterimages(f, 140 * -f.facing);
            a.phase = 'combo'; a.t = 0; a.i = 0; f.setState('melee');
          }
        } else if (a.phase === 'combo') {
          const hits = atk.hits || 2;
          if (a.i < hits && a.t >= a.i * 0.2) {
            f.poseHint = ['punch', 'punch2', 'kick'][a.i % 3];
            const last = a.i === hits - 1;
            if (gap() <= 220) {
              this.resolveHit(target, f, { dmg: atk.dmg, kb: last ? atk.kb : 25, kind: 'melee', blockable: true, dodgeable: true, heavy: last && atk.kb >= 140, knockdown: last && atk.kb >= 150, fromX: f.x });
            } else {
              this.fx.number(f.x + f.facing * 120, f.y - f.height, 'WHIFF', [190, 200, 220]);
            }
            bus.emit('combat:swing', { fighter: f });
            a.i++;
          }
          if (a.i >= hits && a.t >= hits * 0.2 + 0.12) {
            a.phase = 'post'; a.t = 0;
            if (f.state === 'melee') f.setState('idle');
            f.vx += -f.facing * 520;
          }
        } else if (a.phase === 'post' && a.t > 0.35) a.done = true;
        break;
      case 'slam':
      case 'volley':
        if (a.phase === 'fire') {
          if (a.i < atk.count && a.t >= a.i * 0.15) {
            f.poseHint = a.i % 2 ? 'kiblast2' : 'kiblast';
            const h = a.i % 2 ? f.rig.anchors.handB : f.rig.anchors.handF;
            const ty = target.center.y + rand(-25, 25);
            const dist = Math.max(80, Math.abs(target.x - h.x));
            this.projectiles.push({ kind: 'volley', owner: f, x: h.x, y: h.y, vx: f.facing * atk.speed, vy: ((ty - h.y) * atk.speed) / dist, r: atk.size || 12, dmg: atk.dmg, kb: 30, colors: f.def.ki || DESTRUCTION, blockable: true, dodgeable: true, t: 0 });
            bus.emit('combat:fire', { fighter: f, kind: 'volley' });
            a.i++;
          }
          if (a.i >= atk.count && a.t >= atk.count * 0.15 + 0.2) { a.phase = 'post'; a.t = 0; f.setState('idle'); }
        } else if (a.phase === 'post' && a.t > (a.type === 'slam' ? 0.5 : 0.3)) { a.done = true; if (f.state === 'melee') f.setState('idle'); }
        break;
      case 'beam':
        if (!a.beam || a.beam.dead || f.state !== 'firing') a.done = true;
        break;
      case 'sphere':
      case 'hakai':
        if (a.t > 0.6) { a.done = true; if (['throwing', 'point', 'cast'].includes(f.state)) f.setState('idle'); }
        break;
      default:
        a.done = true;
    }
  }

  _attackGo(a) {
    const { f, target, atk } = a;
    switch (a.type) {
      case 'rush': a.phase = 'dash'; f.setState('rush'); break;
      case 'feint': a.phase = 'blink'; f.setState('teleport'); f.rig.setOpacity(0.12); f.invuln = 0.25; this._afterimages(f, 100 * f.facing); bus.emit('combat:dodge', { fighter: f, auto: false }); break;
      case 'volley': a.phase = 'fire'; a.i = 0; f.setState('volley'); break;
      case 'slam': {
        f.setState('melee');
        f.poseHint = 'punch';
        const x = f.x + f.facing * 70;
        this.hazards.push({ kind: 'slam', owner: f, x, dir: f.facing, speed: atk.speed, dmg: atk.dmg, kb: atk.kb, t: 0, emitT: 0 });
        this.fx.shockwave(x, STAGE.GROUND_Y, { r1: 180, dur: 0.4, width: 10, color: [255, 200, 160], flat: 0.25 });
        this.fx.debris(x, STAGE.GROUND_Y - 5, 14);
        this.cam.shake(0.45);
        bus.emit('combat:slam', { fighter: f });
        a.phase = 'post'; a.t = 0;
        break;
      }
      case 'beam': {
        const h = f.rig.anchors.hands;
        a.beam = { owner: f, dir: f.facing, x0: h.x, y: h.y, tip: h.x + f.facing * 10, width: atk.width || 44, dmg: atk.dmg, kb: atk.kb, charge: 0.8, phase: 'extend', t: 0, colors: f.def.ki || DESTRUCTION, blockable: true, dodgeable: true, alpha: 1 };
        this.beams.push(a.beam);
        f.setState('firing');
        this.cam.shake(0.35);
        bus.emit('combat:fire', { fighter: f, kind: 'beam', power: 0.8 });
        break;
      }
      case 'sphere':
        Object.assign(a.sphere, { phase: 'thrown', vx: f.facing * atk.speed, ty: target.center.y, t: 0 });
        f.setState('throwing');
        bus.emit('combat:fire', { fighter: f, kind: 'sphere', power: 1 });
        break;
      case 'hakai':
        bus.emit('combat:special', { fighter: f, kind: 'hakai' });
        break;
      default: break;
    }
  }

  /* ── projectiles, beams, hazards ──────────────────────────────────────── */
  _overlaps(p, f) {
    const hb = f.hurtbox();
    return p.x + p.r > hb.x0 && p.x - p.r < hb.x1 && p.y + p.r > hb.y0 && p.y - p.r < hb.y1;
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.t += dt;
      const owner = p.owner;
      const target = this.opponentOf(owner);
      if (p.kind === 'kiblast' || p.kind === 'volley') {
        if (p.homing && target.alive && !p.passed && Math.sign(target.x - p.x) === Math.sign(p.vx)) {
          p.vy = damp(p.vy || 0, (target.center.y - p.y) * COMBAT.HOMING, 8, dt);
        }
        p.x += p.vx * dt;
        p.y += (p.vy || 0) * dt;
        if (!p.passed && target.alive && this._overlaps(p, target)) {
          const res = this.resolveHit(target, owner, { dmg: p.dmg, kb: p.kb, kind: 'blast', blockable: true, dodgeable: true, fromX: p.x - Math.sign(p.vx) * 20 });
          if (res === 'hit' || res === 'blocked') { p.dead = true; this.fx.burst(p.x, p.y, p.colors.glow, 10, 350); }
          else p.passed = true;
        }
        if (p.x < -100 || p.x > STAGE.W + 100 || p.y > STAGE.H + 50) p.dead = true;
      } else if (p.kind === 'spirit') {
        if (p.phase === 'charging') {
          if (owner.state !== 'charge_spirit') { p.dead = true; this.fx.burst(p.x, p.y, p.colors.glow, 16, 300); }
        } else if (p.phase === 'thrown') {
          const k = clamp(p.t / ((p.flight || TIMING.SPIRIT_FLIGHT_MS) / 1000));
          const e = ease.inQuad(k);
          const u = 1 - e;
          p.x = u * u * p.from.x + 2 * u * e * p.ctrl.x + e * e * p.to.x;
          p.y = u * u * p.from.y + 2 * u * e * p.ctrl.y + e * e * p.to.y;
          if (target.flags.deflectSpirit && !p.noDeflect && k > 0.55 && !p.deflected) {
            p.deflected = true;
            p.phase = 'deflected';
            p.vx = 260 * owner.facing;
            p.vy = -1500;
            target.poseHint = 'cast';
            target.setState('throwing');
            target.poseHint = 'cast';
            this.fx.flash([230, 200, 255], 0.35, 4);
            this.fx.burst(p.x, p.y, [200, 120, 255], 30, 700);
            this.cam.shake(0.4);
            bus.emit('combat:special', { fighter: target, kind: 'deflect' });
          } else if (k >= 1) {
            this._explodeSpirit(p, owner, target);
          }
        } else if (p.phase === 'deflected') {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.y < -p.r - 300) p.dead = true;
        }
      } else if (p.kind === 'sphere') {
        if (p.phase === 'thrown' || p.phase === 'overpower') {
          p.x += p.vx * dt;
          p.y = damp(p.y, p.ty ?? target.center.y, 3, dt);
          if (target.alive && this._overlaps(p, target)) {
            const res = this.resolveHit(target, owner, { dmg: p.dmg, kb: p.kb, kind: 'sphere', blockable: p.phase !== 'overpower', dodgeable: p.phase !== 'overpower', heavy: true, knockdown: true, fromX: p.x - Math.sign(p.vx) * 30 });
            if (res === 'hit' || res === 'blocked') this._explode(p.x, p.y, p.colors, 0.8);
            if (res !== 'miss' && res !== 'dodged') p.dead = true;
            else p.passed = true;
          }
          if (p.x < -200 || p.x > STAGE.W + 200) p.dead = true;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  _explodeSpirit(p, owner, target) {
    p.dead = true;
    const near = Math.abs(target.x - p.x) < p.r + 70;
    if (near && target.alive) {
      const res = this.resolveHit(target, owner, { dmg: p.dmg, kb: p.kb, kind: 'spirit', blockable: false, dodgeable: true, heavy: true, knockdown: true, fromX: p.x - owner.facing * 40 });
      if (p.purify && res === 'hit') this._purify(target);
    }
    this._explode(p.x, Math.min(p.y, STAGE.GROUND_Y - 40), p.colors, 1.4);
    this.fx.flash([235, 245, 255], 1, 1.4);
    this.arenaDamage = Math.min(1, this.arenaDamage + 0.15);
    bus.emit('combat:explode', { kind: 'spirit', power: p.charge });
  }

  /** Soul Punisher's cleansing light: strips a power surge or a ki buff off the target. */
  _purify(target) {
    const s = target === this.p2 ? this.ai.p.surge : null;
    if (target.surged === true && s) {
      target.power /= s.mult;
      this.ai.aggression /= s.speed || 1.25;
      target.surged = 'purified'; // stays truthy so the surge cannot come back this fight
      target.auraOverride = null;
    }
    target.rage = 0;
    this.fx.flash([255, 240, 255], 0.5, 3);
    bus.emit('combat:purify', { fighter: target });
  }

  _explode(x, y, colors, scale = 1) {
    this.fx.shockwave(x, y, { r1: 260 * scale, dur: 0.5, width: 16, color: colors.glow });
    this.fx.shockwave(x, STAGE.GROUND_Y, { r1: 620 * scale, dur: 0.8, width: 22, color: colors.core, flat: 0.22 });
    this.fx.burst(x, y, colors.glow, Math.round(40 * scale), 1100 * scale, 8);
    this.fx.debris(x, STAGE.GROUND_Y - 6, Math.round(22 * scale));
    this.fx.dust(x, STAGE.GROUND_Y, Math.round(16 * scale));
    this.cam.shake(0.5 * scale + 0.2);
    this.cam.freeze(TIMING.HITSTOP_HEAVY_MS);
  }

  updateBeams(dt) {
    for (const b of this.beams) {
      if (b.dead) continue;
      b.t += dt;
      const owner = b.owner;
      const target = this.opponentOf(owner);
      if ((b.phase === 'extend' || b.phase === 'hold') && !b.overpower && owner.state !== 'firing' && owner.state !== 'struggle') { b.phase = 'fade'; b.t = 0; }
      const h = owner.rig.anchors.hands;
      b.x0 = h.x + owner.facing * 8;
      if (b.phase !== 'clash') b.y = h.y;
      if (b.phase === 'extend') {
        b.tip += b.dir * TIMING.BEAM_SPEED * dt;
        if (!this.struggle && this.state === 'fight') {
          const opp = this.beams.find((o) => o !== b && !o.dead && o.owner !== owner && (o.phase === 'extend' || o.phase === 'hold'));
          if (opp && (b.dir > 0 ? b.tip >= opp.tip : b.tip <= opp.tip)) {
            const [pb, eb] = owner.isPlayer ? [b, opp] : [opp, b];
            this.startStruggle(pb, eb);
            continue;
          }
          if (owner.isPlayer) {
            const sph = this.projectiles.find((p) => p.kind === 'sphere' && p.phase === 'thrown');
            if (sph && b.tip >= sph.x - sph.r) { this.startStruggle(b, sph); continue; }
          }
        }
        if (!b.hitDone && target.alive) {
          const hb = target.hurtbox();
          const reached = b.dir > 0 ? b.tip >= hb.x0 : b.tip <= hb.x1;
          if (reached && b.y > hb.y0 - b.width * 0.5 && b.y < hb.y1 + b.width * 0.3) {
            b.hitDone = true;
            const res = this.resolveHit(target, owner, { dmg: b.dmg, kb: b.kb, kind: 'beam', blockable: b.blockable, dodgeable: b.dodgeable, heavy: true, knockdown: b.charge > 0.6 || b.overpower, fromX: owner.x });
            if (res === 'hit' || res === 'blocked') {
              b.phase = 'hold'; b.t = 0; b.hitTarget = true;
              this._explode(b.tip, b.y, b.colors, 0.5 + b.charge * 0.5);
            } else b.missed = true;
          }
        }
        if (b.tip < -250 || b.tip > STAGE.W + 250) { b.phase = 'hold'; b.t = 0; }
      } else if (b.phase === 'hold') {
        if (b.hitTarget && target.alive) {
          const hb = target.hurtbox();
          b.tip = b.dir > 0 ? hb.x0 + 24 : hb.x1 - 24;
          if (Math.random() < 0.6) this.fx.burst(b.tip, b.y, b.colors.glow, 4, 500, 5);
        }
        if (b.t * 1000 >= TIMING.BEAM_HOLD_MS) { b.phase = 'fade'; b.t = 0; }
      } else if (b.phase === 'fade') {
        b.alpha = 1 - (b.t * 1000) / TIMING.BEAM_FADE_MS;
        if (b.alpha <= 0) {
          b.dead = true;
          if (owner.state === 'firing') owner.setState('idle');
        }
      }
    }
    this.beams = this.beams.filter((b) => !b.dead);
  }

  updateHazards(dt) {
    for (const h of this.hazards) {
      if (h.dead) continue;
      h.t += dt;
      const target = this.opponentOf(h.owner);
      if (h.kind === 'slam') {
        h.x += h.dir * h.speed * dt;
        h.emitT += dt;
        if (h.emitT > 0.04) {
          h.emitT = 0;
          this.fx.debris(h.x, STAGE.GROUND_Y - 4, 2, [140, 110, 120]);
          this.fx.particles.emit({ x: h.x, y: STAGE.GROUND_Y - 10, vx: 0, vy: -200, life: 0.3, size: 30, size1: 10, color: [255, 150, 90], kind: KIND.GLOW });
        }
        const grounded = (target.rig.pose?.lift || 0) < 20;
        if (target.alive && grounded && Math.abs(h.x - target.x) < 50) {
          this.resolveHit(target, h.owner, { dmg: h.dmg, kb: h.kb, kind: 'slam', blockable: false, dodgeable: true, heavy: true, knockdown: true, fromX: h.x - h.dir * 30 });
          h.dead = true;
        }
        if (isRingOut(h.x)) h.dead = true;
      } else if (h.kind === 'hakai') {
        if (h.phase === 'tele' && h.t >= h.tele) {
          h.phase = 'burst';
          h.t = 0;
          this.fx.flash([60, 0, 90], 0.45, 3);
          this.fx.burst(h.x, STAGE.GROUND_Y - 80, [170, 70, 255], 40, 700, 6);
          this.cam.shake(0.5);
          if (target.alive && Math.abs(target.x - h.x) < h.r) {
            this.resolveHit(target, h.owner, { dmg: h.dmg, kb: 80, kind: 'hakai', blockable: false, dodgeable: true, heavy: true, knockdown: true, fromX: h.x });
          }
          bus.emit('combat:explode', { kind: 'hakai' });
        } else if (h.phase === 'burst' && h.t > 0.55) h.dead = true;
      }
    }
    this.hazards = this.hazards.filter((h) => !h.dead);
  }

  /* ── beam struggle ────────────────────────────────────────────────────── */
  startStruggle(playerBeam, enemyObj) {
    this.cam.orbit(9, -3, 7); // hold a dramatic angle for the whole clash
    const enemyX = enemyObj.kind === 'sphere' ? enemyObj.x : enemyObj.tip;
    const pos = (playerBeam.tip + enemyX) / 2;
    playerBeam.phase = 'clash';
    enemyObj.phase = 'clash';
    for (const a of this.actions) if (a.type === 'beam' || a.type === 'sphere') a.done = true;
    this.ai.action = null;
    this.struggle = createStruggle({ pos, leftX: this.p1.x, rightX: this.p2.x, ai: this.ai.p.struggle });
    this.struggle.pb = playerBeam;
    this.struggle.eo = enemyObj;
    this.p1.setState('struggle');
    this.p2.setState('struggle');
    if (enemyObj.kind === 'sphere') this.p2.poseHint = 'point';
    this.p1.tele = this.p2.tele = null;
    this.cam.hold(pos, playerBeam.y - 30, 1.3);
    this.fx.flash([255, 255, 255], 0.5, 4);
    bus.emit('combat:struggle', { phase: 'start' });
  }

  updateStruggle(dt, input) {
    const s = this.struggle;
    const p1Push = clamp((input.push || 0) * (0.8 + 0.2 * this.p1.mult));
    const aiPush = clamp(aiStrugglePush(s, s.ai) * (0.9 + 0.1 * this.p2.mult));
    stepStruggle(s, p1Push, aiPush, dt);
    this.p1.shake = p1Push;
    s.pb.tip = s.pos;
    if (s.eo.kind === 'sphere') { s.eo.x = s.pos + s.eo.r * 0.6; s.eo.y = damp(s.eo.y, s.pb.y, 6, dt); }
    else { s.eo.tip = s.pos; s.eo.y = damp(s.eo.y, s.pb.y, 4, dt); }
    this.cam.hold(s.pos, s.pb.y - 30, 1.3);
    this.cam.shake(dt * 1.2);
    const glow = s.eo.colors.glow;
    for (let i = 0; i < 4; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(300, 900);
      this.fx.particles.emit({ x: s.pos, y: s.pb.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.15, 0.4), size: 5, drag: 3, color: Math.random() < 0.5 ? s.pb.colors.glow : glow, kind: KIND.STREAK });
    }
    if (s.winner) this.endStruggle(s);
  }

  endStruggle(s) {
    const p1Won = s.winner === 'p1';
    this.cam.orbit(p1Won ? -12 : 12, -2, 0.25);
    this.struggle = null;
    this.cam.hold(null);
    this.fx.flash([255, 255, 255], 0.75, 3);
    this.fx.shockwave(s.pos, s.pb.y, { r1: 380, dur: 0.6, width: 18, color: [255, 255, 255] });
    if (p1Won) {
      Object.assign(s.pb, { phase: 'extend', dmg: s.pb.dmg * COMBAT.STRUGGLE_WIN_MULT + 60, blockable: false, dodgeable: false, overpower: true, charge: 1 });
      this.p1.setState('firing');
      if (s.eo.kind === 'sphere') s.eo.dead = true; else { s.eo.phase = 'fade'; s.eo.t = 0; }
      this.p2.setState('idle');
    } else {
      if (s.eo.kind === 'sphere') Object.assign(s.eo, { phase: 'overpower', vx: -900, dmg: s.eo.dmg * COMBAT.STRUGGLE_WIN_MULT });
      else Object.assign(s.eo, { phase: 'extend', dmg: s.eo.dmg * COMBAT.STRUGGLE_WIN_MULT, blockable: false, dodgeable: false, overpower: true });
      s.pb.phase = 'fade';
      s.pb.t = 0;
      this.p1.setState('idle');
      this.p2.setState(s.eo.kind === 'sphere' ? 'idle' : 'firing');
    }
    bus.emit('combat:struggle', { phase: 'end', winner: s.winner });
  }

  /** Incoming player attack the AI may react to. */
  threatTo(f) {
    for (const p of this.projectiles) {
      if (p.owner === f || p.dead || p.passed) continue;
      if ((p.kind === 'kiblast' && Math.abs(p.x - f.x) < 300) || (p.kind === 'spirit' && p.phase === 'thrown' && p.t > 0.4)) return p;
    }
    for (const b of this.beams) {
      if (b.owner !== f && b.phase === 'extend' && !b.hitDone && Math.abs(b.tip - f.x) < 520) { b.kind = 'beam'; return b; }
    }
    return null;
  }

  /* ── physics ──────────────────────────────────────────────────────────── */
  physics(dt) {
    const { p1, p2 } = this;
    for (const f of this.fighters) {
      if (f.state === 'falling') continue;
      // Airborne stance: everyone floats above the ring; knocked-down fighters drop to the stone.
      const hoverTo = GROUNDED.has(f.state) || !f.alive ? 0 : COMBAT.HOVER + Math.sin(this.t * 2.1 + (f.isPlayer ? 0 : 1.9)) * 7;
      f.hover = damp(f.hover ?? COMBAT.HOVER, hoverTo, GROUNDED.has(f.state) ? 9 : 4, dt);
      f.altBoost = damp(f.altBoost || 0, 0, 2.4, dt);
      f.y = STAGE.GROUND_Y - f.hover - f.altBoost;
      if (f.barrierHit) f.barrierHit = Math.max(0, f.barrierHit - dt);
      if (f.state === 'dodge') continue;
      f.vx *= Math.exp(-COMBAT.FRICTION * dt);
      if (Math.abs(f.vx) < 1) f.vx = 0;
      f.x += f.vx * dt;
      if (f.isPlayer && f.state === 'idle' && Math.abs(f.vx) < 40 && this.state === 'fight') {
        const d = f.home - f.x;
        if (Math.abs(d) > 20) f.x += Math.sign(d) * Math.min(Math.abs(d), COMBAT.RECOVER_SPEED * dt);
      }
      if (f.alive && isRingOut(f.x)) {
        // Only a heavy, knock-down blow can launch someone out of the ring; anything lighter teeters on the edge.
        const launched = f.state === 'knockdown' && Math.abs(f.vx) > 250;
        if (f.flags.plotArmor || this.state !== 'fight' || !launched) {
          f.x = clamp(f.x, STAGE.PLATFORM_L + 5, STAGE.PLATFORM_R - 5);
          f.vx = 0;
        } else this.ringOut(f);
      }
    }
    if (p1.state !== 'falling' && p2.state !== 'falling') {
      const gap = p2.x - p1.x;
      if (gap < STAGE.MIN_GAP) {
        const push = STAGE.MIN_GAP - gap;
        const p1Room = p1.x - (STAGE.PLATFORM_L + 40);
        const a = Math.min(push / 2, Math.max(0, p1Room));
        p1.x -= a;
        p2.x += push - a;
      }
    }
    if (p1.state !== 'falling') p1.facing = p2.x >= p1.x ? 1 : -1;
    if (p2.state !== 'falling') p2.facing = p1.x >= p2.x ? 1 : -1;
  }

  _converge(at, color, dt, radius = 90) {
    this._gather += dt * 45;
    while (this._gather >= 1) {
      this._gather -= 1;
      const a = rand(0, Math.PI * 2), r = rand(radius, radius * 1.6);
      this.fx.particles.emit({ x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r, vx: -Math.sin(a) * 120, vy: Math.cos(a) * 120, pull: 2200, tx: at.x, ty: at.y, drag: 2, life: 0.7, size: rand(5, 10), size1: 3, color, kind: KIND.GLOW });
    }
  }

  /* ── rendering hooks ──────────────────────────────────────────────────── */
  syncRigs(dt) {
    for (const f of this.fighters) f.syncRig(dt);
  }

  drawBack(ctx, t) {
    for (const h of this.hazards) {
      if (h.kind === 'hakai' && h.phase === 'tele') drawHakai(ctx, h.x, STAGE.GROUND_Y, h.r, t, 'telegraph', clamp(h.t / h.tele));
    }
  }

  drawFront(ctx, t) {
    for (const f of this.fighters) {
      if (f.state === 'charge_kame') drawChargeBall(ctx, f.rig.anchors.hands.x, f.rig.anchors.hands.y, 8 + 30 * f.charge, beamOf(f, f.charge).colors, t, 0.25 + f.charge * 0.5);
      if (f.state === 'guard') this._drawBarrier(ctx, f, t);
      if (f.rig.sword) {
        const h = f.rig.anchors.handF, c = f.rig.anchors.chest;
        const dx = h.x - c.x, dy = h.y - c.y, d = Math.hypot(dx, dy) || 1;
        const col = f.def.ki?.glow || [120, 200, 255];
        drawBolt(ctx, h.x, h.y, h.x + (dx / d) * 130, h.y + (dy / d) * 130, { color: col, width: 5, jag: 3, depth: 2 });
      }
      if (f.state === 'beam_charge' && f.tele) drawChargeBall(ctx, f.rig.anchors.hands.x, f.rig.anchors.hands.y, 6 + 30 * f.tele.k, f.def.ki || DESTRUCTION, t, 0.5);
    }
    for (const b of this.beams) drawBeam(ctx, { x0: b.x0, y: b.y, x1: b.tip, width: b.width, colors: b.colors, alpha: b.alpha }, t);
    this._drawImpacts(ctx, Math.min(0.05, t - (this._impT ?? t)));
    this._impT = t;
    for (const p of this.projectiles) {
      if (p.kind === 'kiblast' || p.kind === 'volley') drawKiBlast(ctx, p, p.colors);
      else drawSphere(ctx, p.x, p.y, p.r, p.colors, t);
    }
    for (const h of this.hazards) if (h.kind === 'hakai' && h.phase === 'burst') drawHakai(ctx, h.x, STAGE.GROUND_Y, h.r, t, 'burst', clamp(h.t / 0.55));
    if (this.struggle) {
      const s = this.struggle;
      const r = 44 + Math.sin(t * 30) * 6;
      drawChargeBall(ctx, s.pos, s.pb.y, r, { core: [255, 255, 255], glow: s.eo.colors.glow }, t, 0.9);
      if (Math.random() < 0.5) drawBolt(ctx, s.pos, s.pb.y, s.pos + rand(-140, 140), s.pb.y + rand(-140, 140), { color: [200, 220, 255], width: 2 });
    }
    // telegraph warnings over attackers
    for (const f of this.fighters) {
      if (!f.tele) continue;
      const a = f.rig.anchors.top;
      const pulse = 0.6 + 0.4 * Math.sin(t * 18);
      ctx.save();
      ctx.translate(a.x, a.y - 30);
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 5;
      ctx.strokeStyle = f.tele.unblockable ? `rgba(255,60,80,${pulse})` : `rgba(255,190,60,${pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f.tele.k);
      ctx.stroke();
      ctx.fillStyle = f.tele.unblockable ? '#ff4a5e' : '#ffc23d';
      ctx.font = '900 30px "Bangers", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.tele.unblockable ? '!!' : '!', 0, 2);
      ctx.restore();
    }
  }

  /** Manga-style impact frame: radial speed lines bursting out of a heavy hit. */
  _drawImpacts(ctx, dt) {
    for (const im of this.impacts) {
      im.t += dt;
      const k = im.t / im.dur;
      if (k >= 1) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.85})`;
      ctx.lineCap = 'round';
      const n = Math.round(14 + 14 * im.power);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + im.x * 0.01;
        const r0 = 40 + 140 * k * im.power, r1 = r0 + (90 + 160 * im.power) * (1 - k * 0.5) * (0.6 + ((i * 7) % 5) / 10);
        ctx.lineWidth = (1 - k) * (2 + 4 * im.power) * (i % 3 ? 0.6 : 1);
        ctx.beginPath();
        ctx.moveTo(im.x + Math.cos(a) * r0, im.y + Math.sin(a) * r0);
        ctx.lineTo(im.x + Math.cos(a) * r1, im.y + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.restore();
    }
    this.impacts = this.impacts.filter((im) => im.t < im.dur);
  }

  _drawBarrier(ctx, f, t) {
    const c = f.center;
    const col = f.def.forms?.[f.form]?.aura?.outer || f.def.ki?.glow || [140, 200, 255];
    const r = f.height * 0.62 + Math.sin(t * 9) * 3;
    const hit = f.barrierHit ? f.barrierHit / 0.25 : 0;
    const rgb = (a) => `rgba(${col[0]},${col[1]},${col[2]},${a})`;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c.x, c.y, r * 0.55, c.x, c.y, r);
    g.addColorStop(0, rgb(0));
    g.addColorStop(0.8, rgb(0.12 + hit * 0.25));
    g.addColorStop(1, rgb(0.5 + hit * 0.4));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3 + hit * 4;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + hit * 0.5})`;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, t * 2, t * 2 + Math.PI * 1.2);
    ctx.stroke();
    ctx.restore();
  }

  destroy() {
    for (const f of this.fighters) f.destroy();
    this.projectiles = [];
    this.beams = [];
    this.hazards = [];
    this.actions = [];
  }
}
