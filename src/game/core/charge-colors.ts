/**
 * What a charge looks like, as one set of numbers.
 *
 * Only the ring reads this today — the bar it was factored out of has since been
 * replaced by that ring rather than sitting beside it. It stays a module of its
 * own regardless: the thresholds are a statement about the *shot* and not about
 * any one drawing of it, and the next thing to show a charge (a replay caption,
 * a tutorial, a second gauge for a second player) should be reading them rather
 * than choosing its own.
 *
 * Plain data and one pure function: no React, no three.js, importable from
 * either side without dragging the other in behind it.
 */

import { Palette } from '@/constants/game-theme';
import { MISCUE_OVER } from '@/store/swing';

/**
 * Where the gauge stops being green, as a fraction of a *full* charge.
 *
 * A fraction of 1 rather than of `MAX_CHARGE`, so it stays put if the ceiling
 * moves: sixty per cent of a full shot is sixty per cent however far past full
 * the gauge is allowed to run.
 */
export const WARM_FROM = 0.6;

/**
 * The overcharge amber.
 *
 * Chosen for hue, not for lightness: against the gold beside it the luminance
 * ratio is only 1.04 — the two are all but identical in greyscale. Colour alone
 * therefore cannot carry the hundred-per-cent line, and both drawings mark it
 * with shape as well: the bar steps its blocks up to full height, the ring
 * pulses and throws a halo.
 */
export const OVER_COLOR = '#e8a33d';

/** The soft end: the game's own accent green. */
export const SOFT_COLOR = Palette.accent;

/** The miscue band, where the cue skids off the ball entirely. */
export const WILD_COLOR = Palette.danger;

/**
 * The colour a charge reads at.
 *
 * Four bands, warming as it fills: green while the shot is soft enough to be
 * placed, gold once it is hard enough to lose position with, amber past a full
 * charge, and the app's own danger colour for the stretch where the shot is a
 * miscue whatever else happens.
 */
export function colorForCharge(charge: number): string {
  if (charge > MISCUE_OVER) return WILD_COLOR;
  if (charge > 1) return OVER_COLOR;
  return charge > WARM_FROM ? Palette.gold : SOFT_COLOR;
}
