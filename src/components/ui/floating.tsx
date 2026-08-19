/**
 * The gentle drift under the menu panels.
 *
 * Two motions, deliberately small. A slow rise and fall that runs on its own,
 * and a tilt that answers the phone being moved — so the panels sit a little
 * above the scene rather than being painted onto it.
 *
 * Kept subtle on purpose. A menu is something to read, and anything that moves
 * far enough to notice while reading is a nuisance rather than a flourish: the
 * whole range here is a handful of points. Each panel is given a different phase
 * so the group breathes rather than pumping in unison.
 *
 * All of it runs on the UI thread through Reanimated shared values, so nothing
 * here crosses the JS bridge per frame.
 */

import { Gyroscope } from 'expo-sensors';
import { useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** How far the idle rise and fall travels, in points. */
const FLOAT = 3.5;
/** How far a tilt can push a panel, in points. */
const TILT = 6;
/** How quickly the tilt follows the phone. Low is heavy and smooth. */
const TILT_EASE = 0.06;

/**
 * The phone's tilt, shared by every floating panel.
 *
 * One subscription for the whole screen rather than one per panel: the reading
 * is the same for all of them, and a sensor listener each would be several
 * callbacks a frame doing identical work.
 *
 * Values are already smoothed here, so a panel only has to scale them.
 */
const tiltX = { value: 0 };
const tiltY = { value: 0 };
let subscribers = 0;
let subscription: { remove: () => void } | null = null;

/**
 * The current smoothed tilt, for anything that is not a React view.
 *
 * The backdrop's camera reads this: it runs inside a `useFrame` on the GL
 * thread, where a shared value or a piece of React state is the wrong shape and
 * a second Gyroscope listener would be a duplicate of work already being done.
 * Same reading, same smoothing, one subscription.
 */
export function currentTilt(): { x: number; y: number } {
  return { x: tiltX.value, y: tiltY.value };
}

/**
 * Keeps the sensor running while something non-visual needs it.
 *
 * The camera is behind every menu but is not itself a `Floating` panel, so
 * without this the subscription would come and go with whichever panels happen
 * to be mounted, and the parallax would stop between screens.
 */
export function useTilt(): void {
  useEffect(() => subscribeTilt(), []);
}

function subscribeTilt(): () => void {
  subscribers += 1;

  if (!subscription) {
    Gyroscope.setUpdateInterval(60);
    subscription = Gyroscope.addListener(({ x, y }) => {
      /**
       * The gyroscope reports rate of turn, not angle, so this integrates it —
       * and leaks the total back towards zero every reading.
       *
       * Without that decay the panels would drift further and further from
       * centre as small rotations accumulated, and a phone left face-up would
       * slowly slide its menu off the screen. The leak means the effect answers
       * movement and then forgets it, which is what "floating" should feel like.
       */
      tiltX.value = tiltX.value * 0.92 + y * TILT_EASE;
      tiltY.value = tiltY.value * 0.92 + x * TILT_EASE;

      // Hard bounds, so a spin cannot fling a panel out of its place.
      tiltX.value = Math.max(-1, Math.min(1, tiltX.value));
      tiltY.value = Math.max(-1, Math.min(1, tiltY.value));
    });
  }

  return () => {
    subscribers -= 1;
    if (subscribers <= 0 && subscription) {
      subscription.remove();
      subscription = null;
      tiltX.value = 0;
      tiltY.value = 0;
    }
  };
}

/**
 * Wraps a panel so it drifts.
 *
 * `depth` scales how much this one moves: a panel meant to read as nearer takes
 * a larger value, which is what turns a uniform wobble into a sense of layers.
 */
export function Floating({
  children,
  phase = 0,
  depth = 1,
  style,
}: {
  children: React.ReactNode;
  /** Offsets this panel's cycle, so a stack of them does not move as one. */
  phase?: number;
  depth?: number;
  style?: ViewStyle;
}) {
  const rise = useSharedValue(0);
  const leanX = useSharedValue(0);
  const leanY = useSharedValue(0);

  useEffect(() => {
    // Periods that do not divide into each other, so the pair never repeats.
    rise.value = withRepeat(
      withTiming(1, { duration: 4200 + phase * 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [rise, phase]);

  useEffect(() => subscribeTilt(), []);

  useEffect(() => {
    /**
     * The sensor writes to plain objects, not shared values, so this copies
     * across on a timer.
     *
     * Reanimated shared values cannot be written from a sensor callback without
     * going through the bridge on every reading. Sampling at 30Hz and easing
     * towards the target keeps the motion smooth while the bridge carries two
     * numbers twice a frame at most.
     */
    const timer = setInterval(() => {
      leanX.value = withTiming(tiltX.value, { duration: 120 });
      leanY.value = withTiming(tiltY.value, { duration: 120 });
    }, 33);

    return () => clearInterval(timer);
  }, [leanX, leanY]);

  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateY: (-FLOAT + rise.value * FLOAT * 2) * depth + leanY.value * TILT * depth },
      { translateX: leanX.value * TILT * depth },
    ],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
