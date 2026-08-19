/**
 * One camera button, sitting on the board itself.
 *
 * It was a row of controls under the table: two view buttons, a reset, and a
 * music button beside them. That is four targets for what is really one
 * decision — which way you are looking — plus one thing that has nothing to do
 * with the camera at all.
 *
 * Now it is a single button in the corner of the stage. A tap swaps the view,
 * and holding resets the zoom and pan. Putting it over the table rather than
 * under it means the board keeps every point the layout gives it, and a control
 * that changes what you see belongs on the thing it changes.
 *
 * The music button is gone entirely: the record player in the room is tappable,
 * which is a better answer than a button that does the same job from off-stage.
 *
 * It only appears while aiming, because that is the only time the choice is the
 * player's. Taking a shot lifts the camera to watch it and settling drops it back
 * behind the cue, so a button fighting the game for the camera would just feel
 * broken.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HUD_SURFACE } from '@/components/game/hud';
import { Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { CameraMode, resetRig } from '@/game/render/camera';
import { Phase } from '@/game/rules/types';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';

export function CameraControls() {
  const t = useT();
  const phase = useSession((s) => s.phase);
  const cameraMode = useSession((s) => s.cameraMode);
  const setCameraMode = useSession((s) => s.setCameraMode);

  if (phase !== Phase.AIMING) return null;

  const other = cameraMode === CameraMode.CUE ? CameraMode.TABLE : CameraMode.CUE;

  return (
    <View style={styles.corner} pointerEvents="box-none">
      <Pressable
        accessibilityLabel={t('game.switchView')}
        accessibilityHint={t('game.resetCamera')}
        onPress={() => setCameraMode(other)}
        onLongPress={resetRig}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.icon}>{'▦'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Bottom-left of the stage: the corner furthest from the shooting hand, and
   * the one the cue is least often pointing into.
   */
  corner: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
  },
  /**
   * Deliberately quiet. It sits over the table all the time, so it reads as a
   * faint marker until it is looked for — hence the low-contrast glyph and a
   * panel barely separated from what is behind it.
   */
  button: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HUD_SURFACE,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Palette.border,
    opacity: 0.75,
  },
  icon: {
    color: Palette.textMuted,
    fontSize: 16,
    lineHeight: 19,
  },
  pressed: {
    opacity: 1,
  },
});
