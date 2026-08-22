/**
 * The shoot button's own behaviour while it is held.
 *
 * Not a component any more but a hook, because what it produces is a style the
 * button wears rather than a thing drawn on top of it. It also owns the charge
 * itself: the animation that winds `chargeValue` to the ceiling, the sampling
 * that hands the value to the store a few times a second, and the haptic pulse
 * that quickens with it.
 *
 * The reading is on the button because that is where the thumb is: you never
 * look away from the table to find out how hard you are about to hit it.
 */

import { useEffect, useRef } from 'react';
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  CHARGE_MS,
  chargeValue,
  MAX_CHARGE,
  MISCUE_OVER,
  OVERCHARGE_MS,
  useSwing,
} from '@/store/swing';
import { useSettings } from '@/store/settings';

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

export function useChargeSwell() {
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
   * The button swells as it winds, and blinks once it turns dangerous.
   *
   * It was a red ring spreading out from the button's edge — an outline that
   * grew rather than the control itself doing anything. Scaling the button is
   * the more direct picture of winding up: the thing under the thumb is visibly
   * loading, and the thumb is already there to feel it.
   *
   * Deliberately a small swell. This is a button being held, not a balloon; past
   * about six per cent the row beneath starts to shift and the growth reads as a
   * layout bug rather than as tension.
   *
   * The blink is the danger signal, and it *accelerates*: slow at the miscue
   * line, frantic at the ceiling. A flash that merely exists says "you are in
   * the red"; one that speeds up says "and it is getting worse", which is the
   * part that decides whether to let go now or risk one more instant.
   */
  /*
   * A clock the worklet can read, ticked once per frame.
   *
   * The callback runs only while something is charging: a shared value written
   * sixty times a second forever would keep the UI thread awake for a button
   * nobody is touching.
   */
  const clock = useSharedValue(0);
  const frames = useFrameCallback((info) => {
    'worklet';
    clock.value = info.timeSinceFirstFrame;
  }, false);

  useEffect(() => {
    frames.setActive(charging);
  }, [charging, frames]);

  const swell = useAnimatedStyle(() => {
    const v = charge.value;
    if (v <= 0.001) return { transform: [{ scale: 1 }], opacity: 1 };

    const filled = Math.min(1, v);
    const over = MAX_CHARGE > 1 ? Math.max(0, (v - 1) / (MAX_CHARGE - 1)) : 0;

    /*
     * Blink phase from a shared value advanced by a frame callback.
     *
     * Not `performance.now()`. That is a JS-thread global, and reading it from
     * inside a worklet running on the UI thread is not something the runtime
     * guarantees — where it is missing the worklet throws, and a worklet that
     * throws every frame takes the whole animated tree down with it.
     * `useFrameCallback` hands us a timestamp that is defined on the UI thread
     * by construction.
     */
    let opacity = 1;
    if (v > MISCUE_OVER) {
      const past = Math.min(1, (v - MISCUE_OVER) / Math.max(0.0001, MAX_CHARGE - MISCUE_OVER));
      // Six flashes a second at the line, eighteen at the ceiling.
      const hz = 6 + past * 12;
      const phase = (clock.value / 1000) * hz * Math.PI * 2;
      /*
       * The flash fades *in* over the first part of the danger band.
       *
       * Snapping straight to full depth the instant the line is crossed made
       * the warning arrive as a jolt — and since the line is crossed while the
       * charge is still climbing fast, that jolt lands at the least useful
       * moment. Ramping the depth over the first third means it reads as
       * something beginning rather than something breaking.
       *
       * Never fully out: a button that disappears reads as broken, not urgent.
       */
      const depth = Math.min(1, past * 3) * 0.55;
      opacity = 1 - depth * (0.5 - 0.5 * Math.cos(phase));
    }

    return {
      transform: [{ scale: 1 + filled * 0.035 + over * 0.025 }],
      opacity,
    };
  });

  return swell;
}
