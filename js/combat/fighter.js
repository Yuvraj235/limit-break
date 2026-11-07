import { COMBAT, STAGE } from '../config.js';
import { CharacterRig } from '../characters/rig.js';
import { isUIForm, formMult } from './moves.js';

const ACTIONABLE = new Set(['idle', 'guard', 'powerup', 'charge_kame', 'charge_spirit', 'kiblast']);

const POSE_FOR = {
  guard: 'guard', powerup: 'powerup', charge_kame: 'kame_charge', charge_spirit: 'spirit_raise', firing: 'kame_fire',
  throwing: 'spirit_throw', dodge: 'dodge', hit: 'hit', knockdown: 'knockdown', getup: 'getup', transform: 'powerup',
  falling: 'fall', ko: 'knockdown', victory: 'victory', defeat: 'defeat', struggle: 'kame_fire', telegraph: 'telegraph',
  rush: 'rush', melee: 'punch', volley: 'kiblast', beam_charge: 'beam_charge', cast: 'cast', point: 'point',
  teleport: 'dodge', stand: 'stand', kiblast: 'kiblast', strike: 'punch', ultimate: 'punch',
};

/** Gameplay state of one combatant plus its rig. Combat rules live in combat.js. */
export class Fighter {
  constructor({ def, layer, side, hp, fx }) {
    this.def = def;
    this.side = side;
    this.isPlayer = side === 'p1';
    this.layer = layer;
    this.rig = new CharacterRig(def, layer);
    this.aura = fx.aura(this.rig);
    this.fx = fx;
    this.maxHp = this.hp = hp;
    this.maxKi = COMBAT.KI_MAX;
    this.ki = this.isPlayer ? 45 : 100;
    this.home = this.isPlayer ? STAGE.P1_HOME : STAGE.P2_HOME;
    this.x = this.home;
    this.y = STAGE.GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.facing = this.isPlayer ? 1 : -1;
    this.state = 'idle';
    this.stateT = 0;
    this.form = def.defaultForm || 'base';
    this.charge = 0;
    this.transformMeter = 0;
    this.invuln = 0;
    this.stun = 0;
    this.cd = { dodge: 0, blast: 0, melee: 0 };
    this.power = 1;
    this.defense = 1;
    this.flags = {};
    this.out = false;
    this.ko = false;
    this.tele = null;
    this.poseHint = null;
    this.idlePose = 'idle';
    this.shake = 0;
    this.spin = 0;
    this.rig.x = this.x;
    this.rig.facing = this.facing;
    this.rig.update(0);
  }

  get alive() { return !this.ko && !this.out; }
  get canAct() { return this.alive && ACTIONABLE.has(this.state); }
  get inUI() { return isUIForm(this.form); }
  get mult() { return formMult(this.form) * this.power * (1 + (this.rage || 0)); }
  get height() { return this.rig.height || 250; }
  get center() { return { x: this.x, y: this.y - this.height * 0.55 }; }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
    this.poseHint = null;
  }

  hurtbox() {
    const w = 48 * this.rig.scale;
    return { x0: this.x - w, x1: this.x + w, y0: this.y - this.height, y1: this.y };
  }

  syncRig(dt) {
    const r = this.rig;
    r.x = this.x;
    r.y = this.y;
    r.facing = this.facing;
    let pose = this.poseHint || POSE_FOR[this.state];
    if (!pose) pose = this.inUI ? 'ui_stance' : this.idlePose;
    if (pose !== r.poseName) r.setPose(pose);
    if (this.state === 'falling') { r.target.rot = this.spin; r.j.rot.x = this.spin; r.j.rot.v = 0; }

    const formVis = this.def.forms?.[this.form];
    const colors = this.auraOverride || formVis?.aura || this.def.aura || { inner: [255, 255, 255], outer: [140, 190, 255] };
    let level = 0;
    const s = this.state;
    if (s === 'powerup' || s === 'transform') level = 0.75 + 0.25 * this.shake;
    else if (s === 'charge_kame' || s === 'charge_spirit' || s === 'struggle' || s === 'beam_charge' || s === 'cast') level = 0.55;
    else if (this.form && this.form !== 'base') level = 0.3;
    if (this.inUI) level = Math.max(level, 0.45);
    if (this.flags.serious) level = Math.max(level, 0.3);
    if (this.surged) level = Math.max(level, 0.5);
    if (!this.alive) level = 0;
    this.aura.set(level, colors, { lightning: !!formVis?.lightning && level > 0.2, ui: !!formVis?.ui });
    r.sword = (this.swordT || 0) > 0 || this.ultimate?.kind === 'sword';
    r.swordColor = this.def.ki?.glow;
    r.tremble = s === 'powerup' || s === 'transform' ? 0.5 + this.shake : s === 'struggle' ? 0.6 : 0;
    r.hairSway = level > 0.3 ? level * 0.6 : 0;
    r.update(dt);
  }

  /** Become a different character in place (fusion and defusion). */
  swapDef(def, form = def.defaultForm || 'base') {
    this.fx.forget(this.rig);
    this.rig.destroy();
    this.def = def;
    this.rig = new CharacterRig(def, this.layer);
    this.aura = this.fx.aura(this.rig);
    this.form = form;
    this.rig.setForm(form, true);
    Object.assign(this.rig, { x: this.x, y: this.y, facing: this.facing });
    this.rig.update(0);
  }

  destroy() {
    this.fx.forget(this.rig);
    this.rig.destroy();
  }
}
