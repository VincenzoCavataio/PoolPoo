/**
 * The strip directly under the table: view controls at one end, music at the
 * other.
 *
 * Grouped by what they belong to rather than by where they fit. Switching view
 * and resetting the view are the same job, so they share a panel; music has
 * nothing to do with either and sits apart, at the far end, where it cannot be
 * hit by someone reaching for the camera.
 *
 * The switcher only appears while aiming, because that is the only time the
 * choice is the player's: taking a shot lifts the camera to watch it and
 * settling drops it back behind the cue, so a button fighting the game for the
 * camera would just feel broken. The reset stays put through all of it — the row
 * keeps its height either way, so nothing below it moves.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HUD_SURFACE, HUD_SURFACE_ACTIVE } from '@/components/game/hud';
import { Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { useMusic } from '@/game/audio/music';
import { CAMERA_MODE_LABEL, CameraMode, resetRig } from '@/game/render/camera';
import { Phase } from '@/game/rules/types';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';

const VIEW_MODES: CameraMode[] = [CameraMode.CUE, CameraMode.TABLE];

/**
 * One glyph per view, in place of the words.
 *
 * The accessible label still says "Vista mira" / "Vista tavolo" — the icon
 * replaces the visible text, not the name of the control, so a screen reader is
 * no worse off than before.
 */
const VIEW_ICON: Record<CameraMode, string> = {
  cue: '▲',
  table: '▦',
};

export function CameraControls() {
  const t = useT();
  const openMusic = useMusic((s) => s.openHud);
  const phase = useSession((s) => s.phase);
  const cameraMode = useSession((s) => s.cameraMode);
  const setCameraMode = useSession((s) => s.setCameraMode);

  const aiming = phase === Phase.AIMING;

  return (
    <View style={styles.row}>
      {/* Everything that moves the camera, in one panel. */}
      <View style={styles.group}>
        {aiming
          ? VIEW_MODES.map((mode) => {
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
                  <Text style={[styles.segmentIcon, active && styles.segmentLabelActive]}>
                    {VIEW_ICON[mode]}
                  </Text>
                </Pressable>
              );
            })
          : null}

        <Pressable
          accessibilityLabel={t('game.resetCamera')}
          onPress={resetRig}
          style={({ pressed }) => [
            styles.segment,
            aiming && styles.segmentDivided,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.utilityLabel}>↺</Text>
        </Pressable>
      </View>

      {/* The music unit is on the wall, which the table view does not frame, so
          the panel needs a way in that does not depend on seeing it. */}
      <Pressable
        accessibilityLabel={t('game.music')}
        onPress={openMusic}
        style={({ pressed }) => [styles.musicButton, pressed && styles.pressed]}>
        <Text style={styles.musicLabel}>♪</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },

  /** The camera panel: view switcher and reset, sharing one outline. */
  group: {
    flexDirection: 'row',
    backgroundColor: HUD_SURFACE,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  segment: {
    width: 42,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Hairline between the switcher and the reset beside it. */
  segmentDivided: {
    borderLeftWidth: 1,
    borderLeftColor: Palette.border,
  },
  segmentActive: {
    backgroundColor: HUD_SURFACE_ACTIVE,
  },
  segmentIcon: {
    color: Palette.textMuted,
    fontSize: 16,
    lineHeight: 19,
  },
  segmentLabelActive: {
    color: Palette.accent,
  },
  utilityLabel: {
    color: Palette.textMuted,
    fontSize: 17,
    lineHeight: 20,
  },

  /** Music, alone at the far end: a different job from the controls opposite. */
  musicButton: {
    width: 42,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HUD_SURFACE,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  musicLabel: {
    color: Palette.accent,
    fontSize: 18,
    lineHeight: 21,
  },

  pressed: {
    opacity: 0.7,
  },
});
