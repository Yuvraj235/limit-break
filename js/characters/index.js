import { goku, shadow } from './goku.js';
import { vegeta } from './vegeta.js';
import { beerus } from './beerus.js';
import { garrok, vessa, thornka } from './rivals.js';
import { gogeta, vegito, aurex, brakk, zeltra, zelbrakk } from './fusion.js';

/** Character registry. New fighters register here and become usable by combat and story. */
export const CHARACTERS = { goku, vegeta, gogeta, vegito, shadow, beerus, garrok, vessa, thornka, brakk, zeltra, zelbrakk, aurex };

/** Fighters the player can control (each needs ladder, godForms and moves). Fusions start fused. */
export const PLAYABLE = ['goku', 'vegeta', 'gogeta', 'vegito'];

/** Fusions the base Saiyans can perform mid-fight. */
export const FUSIONS = ['gogeta', 'vegito'];
