import { STAGE } from '../config.js';
import { rand } from '../core/math.js';

/**
 * Opponent behaviour. Telegraph times stay at or above ~650 ms so a camera-driven player (frame
 * latency plus reaction time) can guard or dodge. Numbers assume the player's 1000 HP.
 */
export const AI_PROFILES = {
  shadow: {
    hp: 99999, idleTime: [99, 99], speed: 120, preferDist: 460, dodge: 0, guard: 0, interrupt: 0, struggle: 0.3,
    attacks: [
      { type: 'volley', w: 1, tele: 1000, count: 3, dmg: 10, speed: 900, size: 13 },
      { type: 'rush', w: 1, tele: 1200, hits: 1, dmg: 12, kb: 50, speed: 1000 },
    ],
  },
  garrok: {
    surge: { at: 0.35, name: 'IRON RAGE', mult: 1.25, speed: 1.2, aura: { inner: [255, 220, 200], outer: [255, 90, 40] } },
    hp: 1000, idleTime: [1.5, 2.5], speed: 160, preferDist: 380, dodge: 0.12, guard: 0.28, interrupt: 0.35, struggle: 0.45,
    attacks: [
      { type: 'rush', w: 4, tele: 900, hits: 2, dmg: 45, kb: 150, speed: 1250 },
      { type: 'slam', w: 2, tele: 1100, dmg: 95, kb: 220, speed: 820 },
      { type: 'volley', w: 1.5, tele: 750, count: 3, dmg: 24, speed: 1100, size: 14 },
    ],
  },
  vessa: {
    surge: { at: 0.35, name: 'STORM DANCE', mult: 1.2, speed: 1.4, aura: { inner: [210, 255, 250], outer: [40, 230, 210] } },
    hp: 900, idleTime: [1.0, 1.7], speed: 360, preferDist: 430, dodge: 0.45, guard: 0.1, interrupt: 0.55, struggle: 0.42,
    attacks: [
      { type: 'rush', w: 4, tele: 680, hits: 3, dmg: 30, kb: 80, speed: 1700 },
      { type: 'feint', w: 2, tele: 650, hits: 2, dmg: 28, kb: 70 },
      { type: 'volley', w: 3, tele: 680, count: 5, dmg: 17, speed: 1650, size: 10 },
    ],
  },
  thornka: {
    surge: { at: 0.35, name: 'CRYSTAL OVERDRIVE', mult: 1.3, speed: 1.2, aura: { inner: [255, 220, 235], outer: [255, 90, 140] } },
    hp: 1500, idleTime: [1.6, 2.6], speed: 110, preferDist: 520, dodge: 0.04, guard: 0.32, interrupt: 0.25, struggle: 0.55,
    armor: true, counterBeam: 0.6,
    attacks: [
      { type: 'beam', w: 4, tele: 1250, dmg: 125, kb: 230, width: 50 },
      { type: 'volley', w: 2, tele: 820, count: 4, dmg: 26, speed: 1000, size: 16 },
      { type: 'slam', w: 1.5, tele: 1150, dmg: 105, kb: 260, speed: 700 },
    ],
  },
  // A rival Saiyan (Goku or Vegeta) in Battle mode: fast, beam-happy, answers beams with beams.
  saiyan: {
    hp: 1700, idleTime: [1.0, 1.7], speed: 280, preferDist: 460, dodge: 0.34, guard: 0.3, interrupt: 0.5, struggle: 0.6,
    counterBeam: 0.55,
    attacks: [
      { type: 'rush', w: 3, tele: 740, hits: 3, dmg: 40, kb: 160, speed: 1650 },
      { type: 'volley', w: 2, tele: 700, count: 4, dmg: 26, speed: 1500, size: 12 },
      { type: 'beam', w: 2.5, tele: 1150, dmg: 140, kb: 240, width: 52 },
    ],
  },
  // The finale: Vegeta in Ultra Ego. Relentless, hits hard, always answers a beam.
  saiyan_final: {
    hp: 2900, idleTime: [0.8, 1.4], speed: 330, preferDist: 440, dodge: 0.3, guard: 0.25, interrupt: 0.6, struggle: 0.72,
    armor: true, counterBeam: 0.65,
    attacks: [
      { type: 'rush', w: 3, tele: 700, hits: 3, dmg: 50, kb: 180, speed: 1800 },
      { type: 'volley', w: 2, tele: 680, count: 5, dmg: 30, speed: 1600, size: 13 },
      { type: 'beam', w: 3, tele: 1100, dmg: 170, kb: 260, width: 60 },
    ],
  },
  brakk: {
    surge: { at: 0.45, name: 'BERSERK', mult: 1.4, speed: 1.35, aura: { inner: [255, 200, 180], outer: [255, 30, 20] } },
    hp: 2400, idleTime: [1.4, 2.2], speed: 150, preferDist: 360, dodge: 0.05, guard: 0.2, interrupt: 0.3, struggle: 0.6, armor: true,
    attacks: [
      { type: 'rush', w: 4, tele: 850, hits: 2, dmg: 62, kb: 200, speed: 1300 },
      { type: 'slam', w: 3, tele: 1050, dmg: 120, kb: 280, speed: 820 },
      { type: 'volley', w: 1, tele: 800, count: 3, dmg: 30, speed: 1000, size: 18 },
    ],
  },
  zeltra: {
    surge: { at: 0.4, name: 'VOID ASCENSION', mult: 1.3, speed: 1.3, aura: { inner: [255, 220, 255], outer: [255, 60, 230] } },
    hp: 2000, idleTime: [0.9, 1.6], speed: 300, preferDist: 520, dodge: 0.5, guard: 0.15, interrupt: 0.55, struggle: 0.62, counterBeam: 0.5,
    attacks: [
      { type: 'volley', w: 4, tele: 700, count: 6, dmg: 22, speed: 1400, size: 12 },
      { type: 'beam', w: 3, tele: 1100, dmg: 140, kb: 220, width: 48 },
      { type: 'sphere', w: 2, tele: 1250, dmg: 150, kb: 260, speed: 560, radius: 44 },
      { type: 'hakai', w: 1, tele: 1250, dmg: 180, radius: 85 },
    ],
  },
  zelbrakk: {
    surge: { at: 0.4, name: 'CALAMITY FORM', mult: 1.35, speed: 1.3, aura: { inner: [255, 230, 255], outer: [255, 40, 160] } },
    hp: 3600, idleTime: [0.8, 1.4], speed: 260, preferDist: 440, dodge: 0.3, guard: 0.3, interrupt: 0.6, struggle: 0.72, armor: true, counterBeam: 0.55,
    attacks: [
      { type: 'rush', w: 3, tele: 760, hits: 3, dmg: 55, kb: 200, speed: 1700 },
      { type: 'slam', w: 2, tele: 1000, dmg: 130, kb: 290, speed: 860 },
      { type: 'volley', w: 2, tele: 700, count: 6, dmg: 26, speed: 1500, size: 14 },
      { type: 'beam', w: 2.5, tele: 1100, dmg: 170, kb: 260, width: 58 },
      { type: 'hakai', w: 1, tele: 1200, dmg: 200, radius: 95 },
    ],
  },
  // Aurex, the Fallen Angel: an angel's reflexes (dodges a lot), fast, and a surge that seals the deal.
  aurex: {
    surge: { at: 0.35, name: 'HALO UNSEALED', mult: 1.35, speed: 1.35, aura: { inner: [240, 255, 255], outer: [60, 230, 255] } },
    hp: 4400, idleTime: [0.75, 1.3], speed: 360, preferDist: 460, dodge: 0.45, guard: 0.3, interrupt: 0.65, struggle: 0.74,
    armor: true, counterBeam: 0.5,
    attacks: [
      { type: 'rush', w: 3, tele: 700, hits: 3, dmg: 56, kb: 200, speed: 1900 },
      { type: 'volley', w: 2, tele: 680, count: 6, dmg: 28, speed: 1650, size: 12 },
      { type: 'beam', w: 2.5, tele: 1100, dmg: 180, kb: 270, width: 56 },
      { type: 'sphere', w: 1.5, tele: 1200, dmg: 170, kb: 300, speed: 600, radius: 48 },
      { type: 'hakai', w: 1.5, tele: 1150, dmg: 230, radius: 95 },
    ],
  },
  beerus1: {
    hp: 1900, idleTime: [1.0, 1.8], speed: 300, preferDist: 420, dodge: 0.38, guard: 0.3, interrupt: 0.6, struggle: 0.62,
    armor: true, counterBeam: 0.2, deflectSpirit: true,
    attacks: [
      { type: 'rush', w: 3, tele: 760, hits: 3, dmg: 42, kb: 170, speed: 1700 },
      { type: 'volley', w: 2, tele: 720, count: 4, dmg: 30, speed: 1500, size: 13 },
      { type: 'sphere', w: 2, tele: 1300, dmg: 150, kb: 300, speed: 520, radius: 46 },
    ],
  },
  beerus2: {
    hp: 2800, idleTime: [0.8, 1.4], speed: 340, preferDist: 440, dodge: 0.42, guard: 0.35, interrupt: 0.65, struggle: 0.7,
    armor: true, counterBeam: 0.35,
    attacks: [
      { type: 'rush', w: 3, tele: 700, hits: 3, dmg: 48, kb: 190, speed: 1850 },
      { type: 'volley', w: 1.5, tele: 700, count: 5, dmg: 30, speed: 1600, size: 13 },
      { type: 'sphere', w: 2, tele: 1250, dmg: 170, kb: 320, speed: 560, radius: 52 },
      { type: 'hakai', w: 2.5, tele: 1150, dmg: 260, radius: 95 },
    ],
  },
};

export class AIController {
  constructor(profileId, { aggression = 1 } = {}) {
    this.id = profileId;
    this.p = AI_PROFILES[profileId];
    this.aggression = aggression;
    this.cool = rand(...this.p.idleTime) * 0.6 + 0.8;
    this.action = null;
    this.reacted = new WeakSet();
    this.forced = null;
    this.guardT = 0;
    this.enabled = true;
  }

  force(type) {
    this.forced = this.p.attacks.find((a) => a.type === type) || null;
    this.cool = 0;
  }

  pick() {
    const list = this.p.attacks;
    let total = list.reduce((s, a) => s + a.w, 0);
    let r = Math.random() * total;
    for (const a of list) if ((r -= a.w) <= 0) return a;
    return list[0];
  }

  fast() {
    return this.p.attacks.find((a) => a.type === 'volley') || this.p.attacks.find((a) => a.type === 'rush') || this.pick();
  }

  update(f, target, dt, combat) {
    if (!this.enabled || !f.alive) return;
    if (this.action) {
      if (this.action.done) this.action = null;
      else return;
    }
    if (f.state === 'guard') {
      this.guardT -= dt;
      if (this.guardT > 0) return;
      f.setState('idle');
    }
    if (!f.canAct || combat.state !== 'fight') return;

    const threat = combat.threatTo(f);
    if (threat && !this.reacted.has(threat)) {
      this.reacted.add(threat);
      if (threat.kind === 'beam' && this.p.counterBeam && this.p.attacks.some((a) => a.type === 'beam') && Math.random() < this.p.counterBeam) {
        this.action = combat.enemyAttack(f, target, { ...this.p.attacks.find((a) => a.type === 'beam'), tele: 120 });
        return;
      }
      const r = Math.random();
      if (r < this.p.dodge && threat.dodgeable !== false) { combat.aiDodge(f, threat); return; }
      if (r < this.p.dodge + this.p.guard && threat.blockable !== false) { f.setState('guard'); this.guardT = 0.75; return; }
    }

    const charging = target.state === 'charge_kame' || target.state === 'charge_spirit';
    if (charging && this.p.attacks.length && Math.random() < this.p.interrupt * dt * 0.9 * this.aggression) {
      this.action = combat.enemyAttack(f, target, this.fast());
      return;
    }

    this.move(f, target, dt);
    this.cool -= dt * this.aggression;
    if (this.cool <= 0) {
      const atk = this.forced || (this.p.attacks.length && this.id !== 'shadow' ? this.pick() : null);
      this.forced = null;
      if (atk) this.action = combat.enemyAttack(f, target, atk);
      this.cool = rand(...this.p.idleTime);
    }
  }

  move(f, target, dt) {
    if (f.state !== 'idle') return;
    const dist = Math.abs(target.x - f.x);
    const toward = Math.sign(target.x - f.x) || -1;
    let dir = 0;
    if (dist > this.p.preferDist + 60) dir = toward;
    else if (dist < this.p.preferDist - 60) dir = -toward;
    if (f.x > STAGE.PLATFORM_R - 150) dir = -1;
    else if (f.x < STAGE.PLATFORM_L + 150) dir = 1;
    f.x += dir * this.p.speed * dt;
  }

  cancel() {
    if (this.action) this.action.done = true;
    this.action = null;
  }
}
