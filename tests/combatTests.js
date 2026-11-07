import { COMBAT, STAGE, FORMS } from '../js/config.js';
import { computeDamage, kameStats, spiritStats, maxKameCharge, nextForm, prevForm, ladderOf, unlockedForms, isRingOut, formMult, isUIForm, isEgoForm } from '../js/combat/moves.js';
import { CHARACTERS } from '../js/characters/index.js';
import { createStruggle, stepStruggle } from '../js/combat/beamStruggle.js';
import { springStep } from '../js/core/math.js';

export function combatTests(t) {
  t.group('Damage and moves');
  t.ok('guard cuts damage by GUARD_REDUCTION', computeDamage({ base: 100, blocked: true }) === Math.round(100 * (1 - COMBAT.GUARD_REDUCTION)));
  t.ok('Super Saiyan 3 multiplies damage', computeDamage({ base: 100, mult: FORMS.ssj3.mult }) === Math.round(100 * FORMS.ssj3.mult));
  t.ok('damage never drops below 1', computeDamage({ base: 0.1, defense: 10 }) === 1);
  const weak = kameStats(0), full = kameStats(1);
  t.ok('a full Kamehameha costs, hits and pushes more than a quick one', full.cost > weak.cost && full.dmg > weak.dmg && full.kb > weak.kb && full.width > weak.width);
  t.ok('Spirit Bomb grows with charge', spiritStats(1).radius > spiritStats(0.3).radius && spiritStats(1).dmg > kameStats(1).dmg);
  t.ok('Kamehameha charge is capped by available ki', maxKameCharge(COMBAT.KAME.costBase) === 0 && maxKameCharge(100) === 1);
  t.ok('form multiplier lookup', formMult('ui') === FORMS.ui.mult && formMult('unknown') === 1);

  t.ok('Energy Barrier takes 80% off a beam', computeDamage({ base: 100, blocked: true, reduction: COMBAT.BARRIER_BEAM_REDUCTION }) === 20);

  t.group('Fusions');
  const { gogeta, vegito } = CHARACTERS;
  t.ok('Gogeta and Vegito both climb to Ultra Instinct Ego', ladderOf(gogeta).at(-1) === 'ui_ego' && ladderOf(vegito).at(-1) === 'ui_ego');
  t.ok('Ultra Instinct Ego outclasses Mastered UI and Ultra Ego', FORMS.ui_ego.mult > FORMS.ui.mult && FORMS.ui_ego.mult > FORMS.ultra_ego.mult);
  t.ok('Ultra Instinct Ego both dodges (UI) and rages (Ego)', isUIForm('ui_ego') && isEgoForm('ui_ego') && !isEgoForm('ui') && !isUIForm('ultra_ego'));
  t.ok('the story can unlock Ultra Instinct Ego for a fusion', unlockedForms(vegito, { tier: 8, god: true }).includes('ui_ego') && !unlockedForms(vegito, { tier: 8 }).includes('ui_ego'));
  t.ok('Potara lasts longer and guards better; the Dance hits harder', vegito.fusion.seconds > gogeta.fusion.seconds && vegito.fusion.guard < gogeta.fusion.guard && gogeta.fusion.power > vegito.fusion.power);
  t.ok('each fusion has its own signature ultimate and bomb', gogeta.fusion.ultimate.id !== vegito.fusion.ultimate.id && gogeta.moves.bomb.name !== vegito.moves.bomb.name);
  t.ok('a fused body takes less damage', computeDamage({ base: 100, defense: 1 / vegito.fusion.guard }) < computeDamage({ base: 100 }));
  t.ok('Spirit Sword reaches further and cuts deeper than a punch', COMBAT.PUNCH.reach + COMBAT.SPIRIT_SWORD.reach > COMBAT.KICK.reach && COMBAT.SPIRIT_SWORD.dmg > 1);
  t.ok('Ultra Ego rage is capped', COMBAT.EGO_RAGE.max / COMBAT.EGO_RAGE.perHit >= 5 && COMBAT.EGO_RAGE.max <= 0.5);

  t.group('Transformations');
  const goku = CHARACTERS.goku, vegeta = CHARACTERS.vegeta;
  const GL = ladderOf(goku), VL = ladderOf(vegeta);
  t.ok('Goku: Base → Kaioken → SSJ → SSJ2 → SSJ3 → SSJ4 → God → Blue → Blue Kaioken → UI → MUI', GL.join(',') === 'base,kaioken,ssj,ssj2,ssj3,ssj4,ssj_god,ssj_blue,blue_kaioken,ui_sign,ui');
  t.ok('Vegeta: Base → Ascended → SSJ → SSJ2 → SSJ4 → God → Blue → Blue Evolved → Ultra Ego', VL.join(',') === 'base,ascended,ssj,ssj2,ssj4,ssj_god,ssj_blue,blue_evolved,ultra_ego');
  const GG = ladderOf(CHARACTERS.gogeta);
  t.ok('Gogeta (fusion): Base → SSJ → SSJ4 → Blue → UI·Ego', GG.join(',') === 'base,ssj,ssj4,ssj_blue,ui_ego' && GG.every((f) => FORMS[f] && CHARACTERS.gogeta.forms[f]));
  const t1 = unlockedForms(goku, { tier: 1 });
  t.ok('chapter tier 1 unlocks Kaioken only', nextForm('base', t1, GL) === 'kaioken' && nextForm('kaioken', t1, GL) === null);
  const all = unlockedForms(goku, { tier: 8, god: true, mastered: true });
  t.ok('full ladder climbs to Mastered UI', nextForm('ssj_blue', all, GL) === 'blue_kaioken' && nextForm('blue_kaioken', all, GL) === 'ui_sign' && nextForm('ui_sign', all, GL) === 'ui');
  const ego = unlockedForms(vegeta, { tier: 7, god: true });
  t.ok('Vegeta tops out in Ultra Ego', nextForm('blue_evolved', ego, VL) === 'ultra_ego' && nextForm('ultra_ego', ego, VL) === null);
  t.ok('god forms stay locked until the story unlocks them', nextForm('blue_kaioken', unlockedForms(goku, { tier: 8 }), GL) === null);
  t.ok('running out of ki drops one step', prevForm('ssj_blue', GL) === 'ssj_god' && prevForm('kaioken', GL) === 'base' && prevForm('ultra_ego', VL) === 'blue_evolved');
  t.ok('every ladder form has gameplay numbers and visuals', [...GL.map((f) => [goku, f]), ...VL.map((f) => [vegeta, f])].every(([d, f]) => FORMS[f] && d.forms[f]));

  t.group('Ring-out');
  t.ok('inside the platform is safe', !isRingOut(STAGE.P1_HOME) && !isRingOut(STAGE.P2_HOME));
  t.ok('past either edge is a ring-out', isRingOut(STAGE.PLATFORM_L - 1) && isRingOut(STAGE.PLATFORM_R + 1));

  t.group('Beam struggle');
  {
    const s = createStruggle({ pos: 800, leftX: 500, rightX: 1100, ai: 0.5 });
    for (let i = 0; i < 600 && !s.winner; i++) stepStruggle(s, 0.95, 0.4, 1 / 60);
    t.ok('pushing harder than the opponent wins', s.winner === 'p1', `winner ${s.winner} at ${s.t.toFixed(1)}s`);
  }
  {
    const s = createStruggle({ pos: 800, leftX: 500, rightX: 1100, ai: 0.5 });
    for (let i = 0; i < 600 && !s.winner; i++) stepStruggle(s, 0.1, 0.6, 1 / 60);
    t.ok('pushing too little loses', s.winner === 'p2');
  }
  {
    const s = createStruggle({ pos: 800, leftX: 500, rightX: 1100, ai: 0.5 });
    for (let i = 0; i < 60 * 10 && !s.winner; i++) stepStruggle(s, 0.5, 0.5, 1 / 60);
    t.ok('an even struggle ends on the timer', !!s.winner && s.t * 1000 >= COMBAT.STRUGGLE_MAX_MS - 20);
  }

  t.group('Animation stability');
  {
    const s = { x: 0, v: 0 };
    for (let i = 0; i < 50; i++) springStep(s, 90, 26, 0.25); // a very slow, throttled frame rate
    t.ok('pose springs stay stable at 4 fps', Math.abs(s.x - 90) < 0.01 && Number.isFinite(s.v), `x=${s.x.toFixed(3)}`);
    const q = { x: 0, v: 0 };
    let overshoot = 0;
    for (let i = 0; i < 120; i++) { springStep(q, 1, 15, 1 / 60); overshoot = Math.max(overshoot, q.x - 1); }
    t.ok('pose springs settle without overshoot', overshoot < 1e-6 && Math.abs(q.x - 1) < 0.01);
  }
}
