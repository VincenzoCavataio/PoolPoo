/**
 * The record changer.
 *
 * Opens by tapping the player in the room. The disc turns while a track plays
 * and drops out of the middle of the panel while one is being changed, on the
 * same clock the 3D turntable uses — both read `changing` from the music store,
 * so the record on screen and the record on the table swap together.
 */

import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useMemo, useState } from 'react';

import { Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { CHANGE_LIFT_MS, CHANGE_TOTAL_MS, useMusic } from '@/game/audio/music';
import { setSfxVolume } from '@/game/audio/sfx';
import { TRACKS, trackAt } from '@/game/audio/tracks';
import { useSettings } from '@/store/settings';

const DISC = 116;

function Record({ color }: { color: string }) {
  const playing = useMusic((s) => s.playing);
  const changing = useMusic((s) => s.changing);

  const spin = useSharedValue(0);
  const swap = useSharedValue(1);

  useEffect(() => {
    if (playing) {
      spin.value = 0;
      spin.value = withRepeat(
        withTiming(360, { duration: 2600, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(spin);
    }
  }, [playing, spin]);

  useEffect(() => {
    if (!changing) return;
    // Down and away, then the new one back up — the same shape as the arm lift.
    swap.value = withSequence(
      withTiming(0, { duration: CHANGE_LIFT_MS, easing: Easing.in(Easing.cubic) }),
      withTiming(1, { duration: CHANGE_TOTAL_MS - CHANGE_LIFT_MS, easing: Easing.out(Easing.back()) }),
    );
  }, [changing, swap]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: swap.value }, { rotate: `${spin.value}deg` }],
    opacity: 0.35 + swap.value * 0.65,
  }));

  return (
    <Animated.View style={[styles.disc, style]}>
      <View style={styles.discGrooveOuter} />
      <View style={styles.discGrooveInner} />
      <View style={[styles.discLabel, { backgroundColor: color }]} />
      <View style={styles.discHole} />
    </Animated.View>
  );
}

function VolumeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const [width, setWidth] = useState(0);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((event) => width > 0 && onChange(event.x / width))
        .onChange((event) => width > 0 && onChange(event.x / width)),
    [width, onChange],
  );

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

export function MusicHud() {
  const open = useMusic((s) => s.hudOpen);
  const closeHud = useMusic((s) => s.closeHud);
  const index = useMusic((s) => s.index);
  const playing = useMusic((s) => s.playing);
  const changing = useMusic((s) => s.changing);
  const select = useMusic((s) => s.select);
  const next = useMusic((s) => s.next);
  const previous = useMusic((s) => s.previous);
  const toggle = useMusic((s) => s.toggle);
  const setMusicLevel = useMusic((s) => s.setVolume);

  const musicVolume = useSettings((s) => s.musicVolume);
  const sfxVolume = useSettings((s) => s.sfxVolume);
  const setMusicVolume = useSettings((s) => s.setMusicVolume);
  const setSfxSetting = useSettings((s) => s.setSfxVolume);

  if (!open) return null;

  const track = trackAt(index);

  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={closeHud} accessibilityLabel="Chiudi" />

      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title}>Giradischi</Text>
          <Pressable onPress={closeHud} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Text style={styles.closeLabel}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.stage}>
          <Record color={track.labelColor} />
          <View style={styles.nowPlaying}>
            <Text style={styles.trackTitle} numberOfLines={2}>
              {track.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {track.artist}
            </Text>
            <Text style={styles.trackState}>
              {changing ? 'Cambio disco…' : playing ? 'In riproduzione' : 'In pausa'}
            </Text>
          </View>
        </View>

        <View style={styles.transport}>
          <Pressable
            onPress={previous}
            disabled={changing || TRACKS.length < 2}
            style={({ pressed }) => [
              styles.transportButton,
              (changing || TRACKS.length < 2) && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.transportLabel}>◀◀</Text>
          </Pressable>

          <Pressable
            onPress={toggle}
            disabled={changing}
            style={({ pressed }) => [
              styles.transportButton,
              styles.transportPrimary,
              changing && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.transportLabel, styles.transportLabelPrimary]}>
              {playing ? '❚❚' : '▶'}
            </Text>
          </Pressable>

          <Pressable
            onPress={next}
            disabled={changing || TRACKS.length < 2}
            style={({ pressed }) => [
              styles.transportButton,
              (changing || TRACKS.length < 2) && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.transportLabel}>▶▶</Text>
          </Pressable>
        </View>

        {TRACKS.length > 1 ? (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {TRACKS.map((entry, entryIndex) => {
              const active = entryIndex === index;
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => select(entryIndex)}
                  disabled={changing}
                  style={({ pressed }) => [
                    styles.listRow,
                    active && styles.listRowActive,
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.listDot, { backgroundColor: entry.labelColor }]} />
                  <Text style={[styles.listTitle, active && styles.listTitleActive]} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text style={styles.listArtist} numberOfLines={1}>
                    {entry.artist}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.hint}>
            Una sola traccia per ora. Aggiungine altre in `assets/bgm/` e nel manifest.
          </Text>
        )}

        <VolumeRow
          label="Musica"
          value={musicVolume}
          onChange={(value) => {
            setMusicVolume(value);
            setMusicLevel(value);
          }}
        />
        <VolumeRow
          label="Effetti"
          value={sfxVolume}
          onChange={(value) => {
            setSfxSetting(value);
            setSfxVolume(value);
          }}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6, 10, 8, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Palette.surface,
    borderRadius: Radius.large,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: Palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: Radius.small,
    backgroundColor: Palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    color: Palette.textMuted,
    fontSize: 15,
  },
  stage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: '#131313',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discGrooveOuter: {
    position: 'absolute',
    width: DISC - 14,
    height: DISC - 14,
    borderRadius: (DISC - 14) / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  discGrooveInner: {
    position: 'absolute',
    width: DISC - 34,
    height: DISC - 34,
    borderRadius: (DISC - 34) / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  discLabel: {
    width: DISC * 0.4,
    height: DISC * 0.4,
    borderRadius: (DISC * 0.4) / 2,
  },
  discHole: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.surface,
  },
  nowPlaying: {
    flex: 1,
    gap: 2,
  },
  trackTitle: {
    color: Palette.text,
    fontSize: 17,
    fontWeight: '700',
  },
  trackArtist: {
    color: Palette.textMuted,
    fontSize: 13,
  },
  trackState: {
    color: Palette.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  transport: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  transportButton: {
    flex: 1,
    height: 46,
    borderRadius: Radius.small,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transportPrimary: {
    backgroundColor: Palette.accent,
    borderColor: Palette.accent,
  },
  transportLabel: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  transportLabelPrimary: {
    color: Palette.accentText,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
  list: {
    maxHeight: 150,
  },
  listContent: {
    gap: Spacing.one,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    backgroundColor: Palette.surfaceRaised,
  },
  listRowActive: {
    backgroundColor: 'rgba(61, 220, 132, 0.16)',
  },
  listDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  listTitle: {
    color: Palette.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  listTitleActive: {
    color: Palette.accent,
  },
  listArtist: {
    color: Palette.textMuted,
    fontSize: 11,
  },
  hint: {
    color: Palette.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
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
