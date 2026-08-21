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

import { Pressable, StyleSheet, View } from 'react-native';

import { HUD_SURFACE } from '@/components/game/hud';
import { CameraIcon } from '@/components/ui/icons';
import { Luxe, Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { CameraMode, resetRig } from '@/game/render/camera';
import { Phase } from '@/game/rules/types';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';
import { useSwing } from '@/store/swing';

export function CameraControls() {
  const t = useT();
  const phase = useSession((s) => s.phase);
  const cameraMode = useSession((s) => s.cameraMode);
  const setCameraMode = useSession((s) => s.setCameraMode);
  const miscue = useSwing((s) => s.miscue);

  /*
   * Held through a mishit, like the rest of the panel.
   *
   * A miscue ends within a few frames because nothing moves, so hiding this
   * with the others only adds to the flash of bare table. See `Controls`.
   */
  const mishit = miscue !== null && phase !== Phase.AIMING;

  if (phase !== Phase.AIMING && !mishit) return null;

  const overhead = cameraMode === CameraMode.TABLE;
  const other = overhead ? CameraMode.CUE : CameraMode.TABLE;

  return (
    <View style={styles.corner} pointerEvents="box-none">
      {/*
        A switch, like the three opposite it.

        The view is either overhead or behind the cue — two states, one of which
        is on — so it answers to the same treatment as the aids: gold when the
        overhead view is up, muted when it is not. It behaved this way already;
        it simply never said so, which made an identical-looking tile the one
        tile whose state you could not read.
      */}
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: overhead }}
        accessibilityLabel={t('game.switchView')}
        accessibilityHint={t('game.resetCamera')}
        onPress={() => setCameraMode(other)}
        onLongPress={resetRig}
        style={({ pressed }) => [
          styles.button,
          overhead && styles.buttonOn,
          pressed && styles.pressed,
        ]}>
        <CameraIcon size={18} color={overhead ? Luxe.gold : Palette.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Top-right of the stage, level with the aid toggles opposite.
   *
   * Same edge, same inset, same tile size as those three, so the top of the
   * board reads as one row of controls split to its two ends rather than as two
   * unrelated pieces of furniture. Down in the corner it was the odd one out:
   * identical in style to the toggles but nowhere near them, which made it look
   * like something left behind rather than part of the set.
   */
  corner: {
    position: 'absolute',
    right: Spacing.two,
    top: Spacing.two,
  },
  /**
   * Deliberately quiet, and the same tile as the aid toggles.
   *
   * It sits over the table all the time, so it reads as a faint marker until it
   * is looked for — hence the muted icon and a panel barely separated from what
   * is behind it.
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
  /** Lit when the overhead view is up — the same signal the aid toggles use. */
  buttonOn: {
    borderColor: Luxe.gold,
    opacity: 0.95,
  },
  pressed: {
    opacity: 1,
  },
});
