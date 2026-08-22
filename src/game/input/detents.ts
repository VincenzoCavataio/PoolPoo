/**
 * The clicks the aim dial makes as it turns.
 *
 * A dial with marks on it should be felt as well as seen: the tick that passes
 * under the pointer is the unit the player is aiming in, and a pulse on each one
 * turns a smooth drag into a countable one. It is the difference between sliding
 * something and ratcheting it.
 *
 * This lives beside the gesture rather than in the dial component because it
 * belongs to the finger, not to the picture. The dial is free to be unmounted,
 * re-rendered or thrown away without the feel of the control changing.
 */

import * as Haptics from 'expo-haptics';

import { useSettings } from '@/store/settings';

/**
 * Degrees between marks on the dial: sixty to a turn.
 *
 * The spacing lives here, with the clicks, and the dial imports it to draw
 * with — rather than the other way round. The pulse the finger feels and the
 * mark the eye sees have to be the same thing, and of the two this is the one
 * that must not depend on a React component being mounted to be correct.
 */
export const TICK_DEGREES = 6;

/** The same spacing in radians, which is what the aim angle is measured in. */
export const TICK_RADIANS = (TICK_DEGREES * Math.PI) / 180;

/**
 * Which tick the aim was on last time we looked.
 *
 * `null` between drags. Kept as a tick index rather than an angle so the
 * comparison is a plain integer one, and so a drag that starts mid-tick does not
 * fire a click for the fraction it began on.
 */
let lastDetent: number | null = null;

/** Which tick an angle falls on. */
function detentOf(angle: number): number {
  return Math.round(angle / TICK_RADIANS);
}

/** Called when a drag begins: takes the reading without clicking. */
export function startDetent(angle: number): void {
  lastDetent = detentOf(angle);
}

/**
 * Called as the aim moves; clicks once for each tick crossed.
 *
 * Once *per tick*, not once per call — a fast flick can cross several between
 * two frames, and firing a single pulse for the lot would make a quick turn feel
 * smoother than a slow one, which is backwards.
 *
 * The pulses are not stacked up one per tick though: a flick across twenty ticks
 * would queue twenty vibrations and the phone would still be buzzing long after
 * the finger stopped. One pulse is fired and the reading is moved the whole way,
 * so the click always marks the *current* position.
 */
export function crossDetents(angle: number): void {
  const detent = detentOf(angle);

  if (lastDetent === null) {
    lastDetent = detent;
    return;
  }

  if (detent === lastDetent) return;
  lastDetent = detent;

  if (!useSettings.getState().haptics) return;

  /*
   * The lightest pulse there is, and errors swallowed.
   *
   * `Light` because this fires many times a second during a turn — anything
   * heavier stops reading as a series of clicks and becomes a rumble. The catch
   * is for the platforms where haptics are simply absent: a dial that throws
   * because the device has no vibrator would take the whole drag down with it.
   */
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Called when the drag ends, so the next one starts fresh. */
export function endDetents(): void {
  lastDetent = null;
}
