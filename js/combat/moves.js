// Move data and pure combat math (unit-tested in tests/combatTests.js).
import { COMBAT, FORMS, FORM_LADDER, GOD_FORMS, STAGE } from '../config.js';
import { clamp } from '../core/math.js';

export const formMult = (form) => FORMS[form]?.mult ?? 1;
export const isUIForm = (form) => form === 'ui_sign' || form === 'ui' || form === 'ui_ego';
/** Forms that grow stronger with every hit taken (Ultra Ego and its fusion with Ultra Instinct). */
export const isEgoForm = (form) => form === 'ultra_ego' || form === 'ui_ego';

export function computeDamage({ base, mult = 1, power = 1, defense = 1, blocked = false, reduction = COMBAT.GUARD_REDUCTION }) {
  let d = (base * mult * power) / defense;
  if (blocked) d *= 1 - reduction;
  return Math.max(1, Math.round(d));
}

export function kameStats(charge) {
  const K = COMBAT.KAME;
  return {
    cost: K.costBase + K.costCharge * charge,
    dmg: K.dmgBase + K.dmgCharge * charge,
    kb: K.kbBase + K.kbCharge * charge,
    width: K.widthBase + K.widthCharge * charge,
  };
}

export function spiritStats(charge) {
  const S = COMBAT.SPIRIT;
  return {
    dmg: S.dmgBase + S.dmgCharge * charge,
    kb: S.kbBase + S.kbCharge * charge,
    radius: S.radiusBase + S.radiusCharge * charge,
  };
}

/** The most Kamehameha charge the fighter's ki can pay for. */
export const maxKameCharge = (ki) => clamp((ki - COMBAT.KAME.costBase) / COMBAT.KAME.costCharge);

/** A character's full ladder: tiered forms, then its god-tier forms. */
export const ladderOf = (def) => [...(def?.ladder || FORM_LADDER), ...(def?.godForms || GOD_FORMS)];

/** Forms a fighter may use: the first `tier` steps past base, plus god forms the story has unlocked. */
export function unlockedForms(def, { tier = 0, god = false, mastered = false } = {}) {
  const top = def?.godForms || GOD_FORMS;
  return [...(def?.ladder || FORM_LADDER).slice(0, tier + 1), ...(god ? top.slice(0, 1) : []), ...(mastered ? top : [])];
}

export function nextForm(current, unlocked, ladder = ladderOf()) {
  const i = ladder.indexOf(current);
  if (i < 0) return null;
  for (let j = i + 1; j < ladder.length; j++) if (unlocked.includes(ladder[j])) return ladder[j];
  return null;
}

/** Running out of ki drops one step down the ladder. */
export function prevForm(current, ladder = ladderOf()) {
  const i = ladder.indexOf(current);
  return i > 0 ? ladder[i - 1] : 'base';
}

export const isRingOut = (x) => x < STAGE.PLATFORM_L || x > STAGE.PLATFORM_R;

/** Opponent attack defaults; AI profiles override per fighter. */
export const ENEMY_ATTACKS = {
  rush: { blockable: true, dodgeable: true },
  volley: { blockable: true, dodgeable: true },
  beam: { blockable: true, dodgeable: true, counterable: true },
  sphere: { blockable: true, dodgeable: true, counterable: true },
  slam: { blockable: false, dodgeable: true },
  hakai: { blockable: false, dodgeable: true },
};
