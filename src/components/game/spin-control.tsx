/**
 * Where the tip strikes the cue ball.
 *
 * Drag inside the circle to move the contact point; the offset is clamped to
 * the rim, which is the solver's miscue limit of 0.45 of a radius. Above centre
 * is follow, below is draw, and either side is english.
 *
 * It subscribes to the spin on its own rather than through the panel around it,
 * so dragging re-renders sixty small views a second instead of the whole
 * shooting panel.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useMemo } from 'react';

import { Palette } from '@/constants/game-theme';
import { useSession } from '@/store/session';

const SIZE = 56;
const RADIUS = SIZE / 2;
const DOT = 14;

export function SpinControl() {
  const spin = useSession((s) => s.spin);
  const setSpin = useSession((s) => s.setSpin);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((event) => apply(event.x, event.y))
        .onChange((event) => apply(event.x, event.y)),
    [],
  );

  function apply(x: number, y: number) {
    let side = (x - RADIUS) / RADIUS;
    // Screen y grows downwards; hitting high on the ball is a positive value.
    let vertical = -(y - RADIUS) / RADIUS;

    const distance = Math.hypot(side, vertical);
    if (distance > 1) {
      side /= distance;
      vertical /= distance;
    }
    useSession.getState().setSpin({ side, vertical });
  }

  const centred = spin.side === 0 && spin.vertical === 0;

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={gesture}>
        <View style={styles.ball} accessibilityLabel="Punto di impatto sulla bianca">
          <View style={styles.crosshairH} pointerEvents="none" />
          <View style={styles.crosshairV} pointerEvents="none" />
          <View
            pointerEvents="none"
            style={[
              styles.dot,
              centred && styles.dotCentred,
              {
                left: RADIUS + spin.side * RADIUS - DOT / 2,
                top: RADIUS - spin.vertical * RADIUS - DOT / 2,
              },
            ]}
          />
        </View>
      </GestureDetector>
      <Text style={styles.caption} onPress={() => setSpin({ side: 0, vertical: 0 })}>
        effetto
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 2,
  },
  ball: {
    width: SIZE,
    height: SIZE,
    borderRadius: RADIUS,
    backgroundColor: '#f2efe6',
    borderWidth: 1,
    borderColor: Palette.border,
  },
  crosshairH: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: RADIUS - 0.5,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  crosshairV: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: RADIUS - 0.5,
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: Palette.danger,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  dotCentred: {
    backgroundColor: '#3a3a3a',
  },
  caption: {
    color: Palette.textMuted,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
