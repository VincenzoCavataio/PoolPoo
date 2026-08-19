/**
 * The backdrop the menus stand on.
 *
 * The menus were a dark rectangle with a list of rows on it, which is what an
 * app looks like. What they were missing is any sense of place — so this puts
 * the game's own subject behind them: a wash of baize, the pool of light a lamp
 * throws onto it, and a rack of balls drifting slowly in the dark.
 *
 * Everything here is drawn with plain views. A GL canvas would render the real
 * thing, but a menu that spins up a renderer costs a second of startup and a
 * chunk of memory to sit behind three buttons, and at this scale flat circles
 * with a highlight are indistinguishable from lit spheres.
 *
 * Deliberately low contrast. It has to read as depth behind the interface, never
 * as content competing with it — every colour here is within a few percent of
 * the ink it sits on, and the balls are held under half opacity.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Luxe } from '@/constants/game-theme';
import { colorForBall } from '@/game/core/ball';

/**
 * Where the balls sit, as fractions of the screen.
 *
 * Scattered rather than racked: a neat triangle reads as a diagram, and the
 * point of this is atmosphere. Sizes vary so the group has some depth to it —
 * the larger ones read as nearer.
 */
const BALLS: { number: number; x: number; y: number; size: number; drift: number }[] = [
  { number: 8, x: 0.14, y: 0.2, size: 46, drift: 5200 },
  { number: 3, x: 0.76, y: 0.12, size: 30, drift: 4300 },
  { number: 11, x: 0.88, y: 0.42, size: 38, drift: 6100 },
  { number: 1, x: 0.08, y: 0.62, size: 26, drift: 4800 },
  { number: 14, x: 0.68, y: 0.78, size: 42, drift: 5600 },
  { number: 6, x: 0.28, y: 0.88, size: 32, drift: 5000 },
];

function DriftingBall({
  number,
  x,
  y,
  size,
  drift,
}: {
  number: number;
  x: number;
  y: number;
  size: number;
  drift: number;
}) {
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, { duration: drift, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [phase, drift]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -6 + phase.value * 12 },
      // A touch of sideways travel too, on a different footing from the rise, so
      // the group never looks like it is bobbing in unison.
      { translateX: -3 + phase.value * 6 },
    ],
  }));

  const stripe = number > 8;

  return (
    <Animated.View
      style={[
        styles.ballWrap,
        { left: `${x * 100}%`, top: `${y * 100}%`, width: size, height: size },
        style,
      ]}>
      <View
        style={[
          styles.ball,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: colorForBall(number) },
        ]}>
        {/* Stripes get a band across the middle; solids stay plain. Two shapes
            instead of one is what stops the group reading as coloured dots. */}
        {stripe ? (
          <View style={[styles.stripe, { height: size * 0.34, borderRadius: size * 0.06 }]} />
        ) : null}
        {/* The lit side, up and to the left, matching the lamp above. */}
        <View
          style={[
            styles.sheen,
            {
              width: size * 0.44,
              height: size * 0.44,
              borderRadius: size * 0.22,
              top: size * 0.1,
              left: size * 0.14,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

export function FeltBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* The cloth: a single deep green wash, barely above the ink. */}
      <View style={styles.cloth} />

      {/*
        The lamp's pool of light.

        Three concentric circles at rising opacity rather than a gradient, which
        React Native has no primitive for. At these radii and this contrast the
        banding is invisible, and it costs three views instead of a shader.
      */}
      <View style={[styles.pool, styles.poolOuter]} />
      <View style={[styles.pool, styles.poolMid]} />
      <View style={[styles.pool, styles.poolInner]} />

      {BALLS.map((ball) => (
        <DriftingBall key={ball.number} {...ball} />
      ))}

      {/* A vignette, so the corners fall away and the eye goes to the middle
          where the buttons are. */}
      <View style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  cloth: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b1712',
  },
  pool: {
    position: 'absolute',
    alignSelf: 'center',
  },
  poolOuter: {
    top: '-24%',
    width: 760,
    height: 760,
    borderRadius: 380,
    backgroundColor: 'rgba(63, 150, 110, 0.05)',
  },
  poolMid: {
    top: '-14%',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'rgba(78, 170, 126, 0.05)',
  },
  poolInner: {
    top: '-6%',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(120, 200, 160, 0.05)',
  },
  ballWrap: {
    position: 'absolute',
    opacity: 0.42,
  },
  ball: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#f2ede0',
  },
  sheen: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    // Not a true radial fade — a flat scrim that deepens the whole field, with
    // the pool above punching the middle back up. The pair reads as a vignette.
    backgroundColor: 'rgba(4, 8, 6, 0.34)',
  },
});
