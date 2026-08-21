/**
 * The glow around the shoot button while it is held.
 *
 * A ring that fills as the charge climbs — gold while the extra power is simply
 * extra power, running red through the last fifth where the shot becomes hard
 * enough to put a ball on the floor. It sits on the button rather than in a bar
 * of its own so the reading is where the thumb already is: you never look away
 * from the table to find out how hard you are about to hit it.
 *
 * Drawn as layers rather than as an arc, because there is no canvas here and a
 * stroked circle would need one. A ring that brightens, thickens and spreads is
 * a truer reading of "winding up" than a dial creeping round anyway: the whole
 * button gets more dangerous, rather than a pointer moving.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { CHARGE_MS, chargeValue, MAX_CHARGE, OVERCHARGE_MS, useSwing } from '@/store/swing';
import { useSettings } from '@/store/settings';

/** Widest the glow spreads beyond the button, in points. */
const SPREAD = 14;

/**
 * The button's own corner radius, so the ring follows its shape.
 *
 * Matched to the button rather than guessed: a ring with a different radius
 * traces a shape the button does not have, which reads as a misaligned outline
 * rather than as the button glowing.
 */
const BUTTON_RADIUS = 10;

/**
 * How often the button buzzes, at rest and at full charge.
 *
 * Speeding up rather than getting stronger: `expo-haptics` offers a few fixed
 * intensities and nothing continuous, so the way to make a vibration build is to
 * make it more frequent. A tick every 220 ms reads as a hum starting; every
 * 45 ms reads as a hand about to lose the cue.
 */
const PULSE_SLOW = 220;
const PULSE_FAST = 45;

export function ChargeRing() {
  const charging = useSwing((s) => s.charging);
  const setCharge = useSwing((s) => s.setCharge);
  const haptics = useSettings((s) => s.haptics);

  /**
   * The shared charge, driven here and read by everything else.
   *
   * Not a local `useSharedValue`: the percentage beside the button animates from
   * the same number, and two values counting separately would drift.
   */
  const charge = chargeValue;

  /*
   * The store is told the charge a few times a second, not every frame.
   *
   * The animation has to stay on the UI thread; what the store needs is a value
   * the cue can shake by and the release can read. Sixty store writes a second
   * would re-render the control tree every frame.
   */
  /*
   * Whether this mount actually wound the charge up.
   *
   * Without it there is no way to tell "the player let go" from "the panel was
   * rebuilt with an old value still on the shared gauge", and only the first
   * should animate.
   */
  const hadCharge = useRef(false);

  const sampler = useRef<ReturnType<typeof setInterval> | null>(null);
  const buzzer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stopTimers = () => {
      if (sampler.current) {
        clearInterval(sampler.current);
        sampler.current = null;
      }
      if (buzzer.current) {
        clearTimeout(buzzer.current);
        buzzer.current = null;
      }
    };

    if (!charging) {
      cancelAnimation(charge);

      /*
       * Eased down on release, but snapped to zero when there was nothing to
       * release.
       *
       * The gauge unwinding is the right picture for a shot just played: the
       * charge you built visibly spends itself. But `chargeValue` is shared and
       * outlives the shot, so when the panel comes *back* — after a replay, or
       * a turn — this effect runs again with a stale value still on it and eases
       * that down from wherever it stopped. What you see is the bar sliding
       * backwards a moment after it appears, for a shot that finished a while
       * ago.
       *
       * Animating only when there is something to animate away from fixes both:
       * a release still unwinds, a re-entry starts at zero.
       */
      if (charge.value > 0.001 && hadCharge.current) {
        charge.value = withTiming(0, { duration: 160 });
      } else {
        charge.value = 0;
      }

      hadCharge.current = false;
      stopTimers();
      return;
    }

    hadCharge.current = true;

    /*
     * Winds to the ceiling, getting faster as it goes.
     *
     * Not linear. A charge that climbs at a steady rate is easy: the last tenth
     * takes as long as the first, so stopping on the mark is only a matter of
     * counting. Accelerating means the top of the scale arrives faster than the
     * bottom did — the harder you are trying to hit it, the less time you have
     * to stop — and overshooting into the miscue stops being carelessness and
     * becomes a real risk that has to be played around.
     *
     * A gentle quadratic rather than anything steeper: `Easing.in(Easing.quad)`
     * makes the second half about three times quicker than the first, which is
     * enough to feel without making the low end sluggish to reach.
     *
     * One timing to the ceiling rather than two in sequence, so the charge does
     * not visibly change gear at the moment it becomes dangerous — what changes
     * is the colour, and that is the warning.
     */
    charge.value = 0;
    charge.value = withTiming(MAX_CHARGE, {
      duration: CHARGE_MS + OVERCHARGE_MS,
      easing: Easing.in(Easing.quad),
    });

    sampler.current = setInterval(() => setCharge(charge.value), 40);

    /*
     * The buzz, rescheduling itself faster as the charge builds.
     *
     * A self-scheduling timeout rather than an interval: the gap between pulses
     * has to change as it goes, and an interval's period is fixed when it is
     * created.
     */
    if (haptics) {
      const pulse = () => {
        const value = charge.value;
        const style =
          value > 1
            ? Haptics.ImpactFeedbackStyle.Heavy
            : value > 0.55
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light;
        void Haptics.impactAsync(style).catch(() => undefined);

        const gap = PULSE_SLOW + (PULSE_FAST - PULSE_SLOW) * Math.min(1, value);
        buzzer.current = setTimeout(pulse, gap);
      };
      buzzer.current = setTimeout(pulse, PULSE_SLOW);
    }

    return stopTimers;
  }, [charging, charge, setCharge, haptics]);

  /**
   * The glow: brighter, wider and redder as the charge climbs.
   *
   * All three at once, because a single channel is easy to miss at the edge of
   * vision — and the whole point of putting this on the button is that it is
   * read without looking at it.
   */
  const glow = useAnimatedStyle(() => {
    const v = charge.value;
    if (v <= 0.001) return { opacity: 0 };

    const filled = Math.min(1, v);
    // Past a full charge: 0 at the line, 1 at the ceiling.
    const over = MAX_CHARGE > 1 ? Math.max(0, (v - 1) / (MAX_CHARGE - 1)) : 0;

    /*
     * Gold while it fills, then straight to red the instant it goes past full.
     *
     * A gradual shift through orange would make the moment it becomes dangerous
     * a matter of judging a hue, which is exactly the judgement the player
     * should not have to make under time pressure. It is gold, and then it is
     * not — and after that it only gets angrier.
     */
    const r = over > 0 ? 255 : 201;
    const g = over > 0 ? 82 - 40 * over : 169;
    const b = over > 0 ? 60 - 30 * over : 98;

    return {
      opacity: 0.4 + filled * 0.6,
      borderColor: `rgb(${r}, ${g}, ${b})`,
      // Thickens as it winds, and again as it overcharges.
      borderWidth: 2 + filled * 5 + over * 4,
      // Spreads outward, which is what makes it read as a charge escaping the
      // button rather than a border being restyled.
      margin: -(filled * SPREAD + over * SPREAD * 0.5),
      /*
       * Kept round as it spreads.
       *
       * The button is a disc, so the ring has to be one too — and the radius has
       * to grow with the margin, or a ring pushed 14pt outward with a fixed
       * radius turns into a rounded square around a circle.
       */
      borderRadius: BUTTON_RADIUS + filled * SPREAD,
    };
  });

  return <Animated.View pointerEvents="none" style={[styles.ring, glow]} />;
}

const styles = StyleSheet.create({
  /**
   * Over the button and never in the way of it.
   *
   * `absoluteFill` inside the button's own box, so it tracks the button's size
   * without needing to be told it, and `pointerEvents: none` so the press it is
   * reporting on still reaches the button underneath.
   */
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BUTTON_RADIUS,
    borderWidth: 0,
  },
});
