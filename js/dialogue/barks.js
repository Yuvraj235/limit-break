import { FORMS } from '../config.js';
import { bus } from '../core/events.js';

const TRANSFORM_EVENT = {
  kaioken: 'transform_kaioken', ascended: 'transform_ascended', ssj: 'transform_ssj', ssj2: 'transform_ssj2', ssj3: 'transform_ssj3',
  ssj_blue: 'transform_blue', ui_sign: 'ui_sign', ui: 'ui_mastered', ultra_ego: 'ultra_ego',
  ssj_god: 'transform_god', blue_evolved: 'transform_evolved', ssj4: 'transform_ssj4', blue_kaioken: 'transform_kaioken', ui_ego: 'ultra_ego',
};

/** Maps combat events to in-character lines (Gemini or mock). */
export function attachBarks(app) {
  const d = app.dialogue;
  const pct = (f) => Math.round((f.hp / f.maxHp) * 100);
  const ctxFor = (f) => {
    const c = app.combat;
    const foe = c.opponentOf(f);
    return {
      chapter: app.director.chapter?.title,
      self: { name: f.def.name, form: f.def.forms ? FORMS[f.form]?.name : null, hp: pct(f) },
      foe: { name: foe.def.name, hp: pct(foe) },
    };
  };
  const say = (f, event, opts) => { if (app.combat && f) d.say(f.def.id, event, ctxFor(f), opts); };
  const chance = (p) => Math.random() < p;
  let lowHpSaid = false;

  bus.on('combat:start', () => { lowHpSaid = false; });
  bus.on('combat:fight', ({ combat }) => {
    d.say('arbiter', 'round_start', ctxFor(combat.p1), { force: true });
    setTimeout(() => app.combat === combat && combat.state === 'fight' && say(combat.p2, 'intro'), 2200);
  });
  bus.on('combat:charge', ({ fighter, kind }) => {
    if (!fighter.isPlayer || !kind) return;
    say(fighter, kind === 'kame' ? 'kame_charge' : 'spirit_charge');
  });
  bus.on('combat:fire', ({ fighter, kind }) => {
    if (fighter.isPlayer) {
      if (kind === 'kame') say(fighter, 'kame_fire', { force: chance(0.5) });
      else if (kind === 'spirit') say(fighter, 'spirit_throw', { force: true });
    } else if (kind === 'beam' || kind === 'sphere') say(fighter, 'special');
  });
  bus.on('combat:transform', ({ fighter, form }) => { if (fighter.isPlayer && TRANSFORM_EVENT[form]) say(fighter, TRANSFORM_EVENT[form], { force: true }); });
  bus.on('combat:powerup', ({ fighter, on }) => { if (on && fighter.isPlayer && chance(0.5)) say(fighter, 'powerup'); });
  bus.on('combat:hit', ({ target, attacker, heavy, blocked }) => {
    if (blocked && target.isPlayer && chance(0.3)) return say(target, 'block');
    if (!heavy) return;
    if (target.isPlayer) { if (chance(0.55)) say(target, 'hit'); }
    else if (!lowHpSaid && target.hp / target.maxHp < 0.3) { lowHpSaid = true; say(target, 'low_hp', { force: true }); }
    else if (chance(0.5)) say(target, 'hit');
    if (!attacker.isPlayer && chance(0.25)) say(attacker, 'attack');
  });
  bus.on('combat:dodge', ({ fighter }) => { if (fighter.isPlayer && chance(0.35)) say(fighter, 'dodge'); });
  bus.on('combat:telegraph', ({ fighter }) => { if (!fighter.isPlayer && chance(0.3)) say(fighter, 'attack'); });
  bus.on('combat:struggle', ({ phase, winner }) => {
    const c = app.combat;
    if (!c) return;
    if (phase === 'start') { say(c.p1, 'struggle', { force: true }); setTimeout(() => say(c.p2, 'struggle'), 1400); }
    else say(c.p1, winner === 'p1' ? 'struggle_win' : 'struggle_lose', { force: true });
  });
  bus.on('combat:special', ({ fighter, kind }) => {
    if (kind === 'hakai' || kind === 'deflect') say(fighter, kind, { force: true });
  });
  bus.on('combat:lowki', ({ fighter }) => say(fighter, 'low_ki'));
  bus.on('combat:ultimate', ({ fighter }) => say(fighter, 'special', { force: true }));
  bus.on('combat:ringout', ({ fighter }) => d.say('arbiter', 'eliminated', ctxFor(fighter), { force: true }));
  bus.on('combat:end', ({ combat, winner, method }) => {
    if (method === 'training' || method === 'test') return;
    const w = winner === 'p1' ? combat.p1 : combat.p2;
    if (method === 'time') d.say('arbiter', 'time_up', ctxFor(w), { force: true });
    setTimeout(() => app.combat === combat && say(w, 'win', { force: true }), 900);
  });
}
