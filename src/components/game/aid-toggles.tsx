/**
 * The three aiming aids, switchable from the table itself.
 *
 * All three already live in the options screen, and that is where they belong
 * for the settled choice — the one you make once and keep. This is for the other
 * kind: the shot in front of you is awkward, you want the ghost ball for it, and
 * leaving the game to get it costs more than the help is worth.
 *
 * On the stage rather than in the panel below because they change what is drawn
 * *on the table*, and a switch reads best next to the thing it changes. Top
 * left, opposite the camera button in the bottom right, so neither is under the
 * hand that shoots and the two corners of furniture stay balanced.
 *
 * Deliberately quiet: these sit over the board for the whole game, so they are
 * markers to be looked for rather than buttons competing with the balls. The lit
 * state is the only strong signal, and it is the one worth having — at a glance
 * you can see which aids are on without reading anything.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { HUD_SURFACE } from '@/components/game/hud';
import { AimLineIcon, SpinIcon } from '@/components/ui/icons';
import { Luxe, Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { Phase } from '@/game/rules/types';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { useSwing } from '@/store/swing';

function Toggle({
  on,
  onPress,
  label,
  icon,
}: {
  on: boolean;
  onPress: () => void;
  label: string;
  icon: (color: string) => React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        on && styles.buttonOn,
        pressed && styles.pressed,
      ]}>
      {icon(on ? Luxe.gold : Palette.textMuted)}
    </Pressable>
  );
}

export function AidToggles() {
  const t = useT();
  const phase = useSession((s) => s.phase);
  const miscue = useSwing((s) => s.miscue);

  const showAimGuide = useSettings((s) => s.showAimGuide);
  const setShowAimGuide = useSettings((s) => s.setShowAimGuide);
  const showSpinTarget = useSettings((s) => s.showSpinTarget);
  const setShowSpinTarget = useSettings((s) => s.setShowSpinTarget);

  /*
   * Shown while aiming, and held through a mishit.
   *
   * The same rule the rest of the panel follows: there is nothing to configure
   * while the balls are rolling, but a miscue is over in a few frames and
   * hiding these for those frames only makes the screen flicker.
   */
  const mishit = miscue !== null && phase !== Phase.AIMING;
  if (phase !== Phase.AIMING && !mishit) return null;

  return (
    <View style={styles.corner} pointerEvents="box-none">
      <Toggle
        on={showAimGuide}
        onPress={() => setShowAimGuide(!showAimGuide)}
        label={t('options.aimLine')}
        icon={(color) => <AimLineIcon size={18} color={color} />}
      />
      <Toggle
        on={showSpinTarget}
        onPress={() => setShowSpinTarget(!showSpinTarget)}
        label={t('options.spinTarget')}
        icon={(color) => <SpinIcon size={18} color={color} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Top left of the stage, opposite the camera button — and stacked, not in a
   * row.
   *
   * A row of two here against a single button on the right made the top of the
   * table lopsided: the left claimed twice the width of the right, and the gauge
   * between them sat off centre to suit. A column claims one tile's width on
   * each side, so the two ends match and the middle is genuinely the middle.
   *
   * It also grows the right way. Another aid added to a row eats into the gauge;
   * added to a column it costs nothing but height, and there is nothing below
   * these but cloth.
   */
  corner: {
    position: 'absolute',
    left: Spacing.two,
    top: Spacing.two,
    /*
     * The same step that holds them off the stage's edge.
     *
     * It was half that, which made the two tiles read as one block with a seam
     * across it rather than as two controls that happen to be stacked. Every
     * distance in this row is `two` now — tile to tile, tile to edge, tile to
     * gauge — so the spacing says nothing except that these are separate things
     * of equal standing.
     */
    gap: Spacing.two,
  },
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
  /**
   * Lit when the aid is on.
   *
   * The gold border does the work rather than a fill: a filled tile over a green
   * table is a bright rectangle wherever it lands, while an outline reads as
   * "this one is active" without taking the eye off the shot.
   */
  buttonOn: {
    borderColor: Luxe.gold,
    opacity: 0.95,
  },
  pressed: {
    opacity: 1,
  },
});
