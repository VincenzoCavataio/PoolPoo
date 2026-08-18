/**
 * View switcher and camera reset, floating at the right edge of the table.
 *
 * The switcher only appears while aiming, because that is the only time the
 * choice is the player's: taking a shot lifts the camera up to watch it and
 * settling drops it back behind the cue, and a button that fights the game for
 * control of the camera would just feel broken.
 *
 * Placed away from the bottom panel on purpose — the power slider and the shoot
 * button are hit under time pressure, and crowding them invites mis-taps.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { useMusic } from '@/game/audio/music';
import { CAMERA_MODE_LABEL, CameraMode, resetRig } from '@/game/render/camera';
import { Phase } from '@/game/rules/types';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';

const VIEW_MODES: CameraMode[] = [CameraMode.CUE, CameraMode.TABLE];

export function CameraControls() {
  const t = useT();
  const openMusic = useMusic((s) => s.openHud);
  const phase = useSession((s) => s.phase);
  const cameraMode = useSession((s) => s.cameraMode);
  const setCameraMode = useSession((s) => s.setCameraMode);

  const aiming = phase === Phase.AIMING;

  return (
    <View style={styles.column}>
      {aiming ? (
        <View style={styles.group}>
          {VIEW_MODES.map((mode) => {
            const active = mode === cameraMode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t('game.viewLabel', { name: t(CAMERA_MODE_LABEL[mode]) })}
                onPress={() => setCameraMode(mode)}
                style={({ pressed }) => [
                  styles.segment,
                  active && styles.segmentActive,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                  {t(CAMERA_MODE_LABEL[mode])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable
        accessibilityLabel={t('game.resetCamera')}
        onPress={resetRig}
        style={({ pressed }) => [styles.reset, pressed && styles.pressed]}>
        <Text style={styles.resetLabel}>↺</Text>
      </Pressable>

      {/* The music unit is on the wall, which the table view does not frame, so
          the panel needs a way in that does not depend on seeing it. */}
      <Pressable
        accessibilityLabel={t('game.music')}
        onPress={openMusic}
        style={({ pressed }) => [styles.reset, styles.music, pressed && styles.pressed]}>
        <Text style={styles.musicLabel}>♪</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  group: {
    backgroundColor: 'rgba(12, 19, 16, 0.88)',
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  segment: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 9,
    minWidth: 72,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: 'rgba(61, 220, 132, 0.22)',
  },
  segmentLabel: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentLabelActive: {
    color: Palette.accent,
  },
  pressed: {
    opacity: 0.7,
  },
  reset: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
    backgroundColor: 'rgba(12, 19, 16, 0.88)',
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetLabel: {
    color: Palette.text,
    fontSize: 18,
    lineHeight: 22,
  },
  music: {
    borderColor: 'rgba(92, 255, 176, 0.55)',
  },
  musicLabel: {
    color: '#5cffb0',
    fontSize: 20,
    lineHeight: 24,
  },
});
