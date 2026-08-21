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
      charge.value = withTiming(0, { duration: 160 });
      stopTimers();
      return;
    }

    /*
     * Winds to full, then on into the overcharge and stops.
     *
     * One timing to the ceiling rather than two in sequence: the rate is the
     * same either side of full, so the charge does not visibly change gear at
     * the moment it becomes dangerous — what changes is the colour, and that is
     * the warning.
     */
    charge.value = 0;
    charge.value = withTiming(MAX_CHARGE, {
      duration: CHARGE_MS + OVERCHARGE_MS,
      easing: Easing.linear,
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
      borderRadius: 8 + filled * SPREAD,
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
    borderRadius: 8,
    borderWidth: 0,
  },
});
