/**
 * A volume slider.
 *
 * Shared between the record player's panel in game and the options screen, which
 * set the same two values — the settings store is the single source, so two
 * separate controls drifting apart in feel would be the same number behaving
 * differently depending on where you touched it.
 *
 * A pan rather than a stock slider: the track is the control, so tapping
 * anywhere on it jumps there, and dragging carries on from wherever you landed.
 */

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { MenuPalette as Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';

export function VolumeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const [width, setWidth] = useState(0);

  const gesture = useMemo(() => {
    /**
     * Clamped, because a pan reports positions past the ends of the view it
     * started in. Dragging off the left of the track gives a negative x, which
     * a bare `x / width` would pass straight through as a negative volume.
     */
    const at = (x: number) => Math.min(1, Math.max(0, x / width));

    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((event) => width > 0 && onChange(at(event.x)))
      .onChange((event) => width > 0 && onChange(at(event.x)));
  }, [width, onChange]);

  return (
    <View style={styles.volumeRow}>
      <Text style={styles.volumeLabel}>{label}</Text>
      <GestureDetector gesture={gesture}>
        <View style={styles.volumeTrack} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <View style={[styles.volumeFill, { width: `${Math.round(value * 100)}%` }]} />
        </View>
      </GestureDetector>
      <Text style={styles.volumeValue}>{Math.round(value * 100)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  volumeLabel: {
    color: Palette.textMuted,
    fontSize: 12,
    width: 56,
  },
  volumeTrack: {
    flex: 1,
    height: 26,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  volumeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Palette.accent,
    opacity: 0.7,
  },
  volumeValue: {
    color: Palette.text,
    fontSize: 12,
    fontWeight: '700',
    width: 26,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
