/**
 * The power gauge, across the top of the table.
 *
 * It has moved twice. It began under the table, in the panel with the shoot
 * button, which meant winding a shot up while watching a gauge somewhere the
 * shot was not. It was then drawn as a ring round the cue ball — right about
 * where power belongs, wrong about everything else: it sat in the 3D scene, so
 * rails and balls and the room's furniture passed in front of it.
 *
 * This is the third answer and the plain one. A gauge is a flat instrument, so
 * it lives in the HUD where flat instruments cannot be occluded by anything;
 * and it sits at the *top*, in the gap the corner controls leave, because that
 * is the one strip of the stage where nothing is ever played.
 *
 * Always on while aiming, rather than only while the button is held. A gauge
 * that appears at the moment you start winding is a gauge you have to find
 * before you can use it — and its empty length is information too: it is how
 * much shot there is to give.
 */

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import {
  HUD_SURFACE,
  HUD_TILE,
  HUD_TILE_BORDER,
  HUD_TILE_OPACITY,
} from '@/components/game/hud';
import { Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { colorForCharge, WARM_FROM } from '@/game/core/charge-colors';
import { Phase } from '@/game/rules/types';
import { useSession } from '@/store/session';
import { chargeValue, MAX_CHARGE, MISCUE_OVER, useSwing } from '@/store/swing';

/**
 * How many blocks the gauge is divided into.
 *
 * Fewer than the fifteen it had in the panel below: this one spans the gap
 * between two corner controls rather than the whole screen, and fifteen blocks
 * in a hundred and eighty points are slivers. Ten is still a tenth of a charge
 * apiece — coarse enough to count at a glance, fine enough to judge a shot to
 * within ten per cent.
 */
const SEGMENTS = 10;

/** The unlit block: present, so the gauge's full length can be seen unfilled. */
const UNLIT = 'rgba(255, 255, 255, 0.07)';

/** The unlit blocks past the miscue line: the cliff, visible before you reach it. */
const UNLIT_WILD = 'rgba(217, 117, 107, 0.18)';

/** One block, lit once the charge passes its own share of the run. */
function Segment({ index }: { index: number }) {
  const charge = ((index + 1) / SEGMENTS) * MAX_CHARGE;
  const wild = charge > MISCUE_OVER;

  /*
   * The colours are read out here, not called for inside the worklet.
   *
   * `useAnimatedStyle` runs on the UI thread, where an ordinary imported
   * function does not exist — `colorForCharge` is plain JS and calling it from
   * in there fails at runtime rather than at build. Resolving the four bands
   * once, on the JS side, closes over four strings the worklet can simply pick
   * between: the thresholds still live in one place, and nothing crosses the
   * thread boundary per frame.
   */
  const soft = colorForCharge(0);
  const warm = colorForCharge(1);
  const hot = colorForCharge(MISCUE_OVER);
  const danger = colorForCharge(MAX_CHARGE);
  const unlit = wild ? UNLIT_WILD : UNLIT;

  const style = useAnimatedStyle(() => {
    const value = chargeValue.value;
    const reached = value / MAX_CHARGE;
    // Lit once the charge has passed this block's own share of the gauge.
    const lit = reached >= (index + 1) / SEGMENTS - 1 / SEGMENTS / 2;
    if (!lit) return { backgroundColor: unlit };

    if (value > MISCUE_OVER) return { backgroundColor: danger };
    if (value > 1) return { backgroundColor: hot };
    return { backgroundColor: value > WARM_FROM ? warm : soft };
  });

  return (
    <Animated.View style={[styles.segment, style]} pointerEvents="none" />
  );
}

const STEPS = Array.from({ length: SEGMENTS }, (_, i) => i);

/**
 * Where a full charge falls along the track, as a fraction of its length.
 *
 * Snapped to the nearest join between blocks. The honest position is `1 /
 * MAX_CHARGE`, which at ten blocks over a ceiling of 1.5 lands two thirds of
 * the way through the seventh — a line drawn there cuts a block in half and
 * reads as a fault in the block rather than as a mark on the scale.
 *
 * Rounding moves it by at most half a block, which is worth it: the line's job
 * is to say *these are the overcharge ones*, and it can only say that if it
 * falls between two of them. Both numbers are derived, so the mark follows if
 * either the ceiling or the block count is retuned.
 */
const FULL_AT = Math.round((SEGMENTS * 1) / MAX_CHARGE) / SEGMENTS;

export function PowerBar() {
  const phase = useSession((s) => s.phase);
  const miscue = useSwing((s) => s.miscue);

  /*
   * The same rule the corner controls beside it follow: on while aiming, and
   * held through a mishit rather than flickering away for the few frames one
   * lasts.
   */
  const mishit = miscue !== null && phase !== Phase.AIMING;
  if (phase !== Phase.AIMING && !mishit) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <View style={styles.track}>
        {STEPS.map((i) => (
          <Segment key={i} index={i} />
        ))}

        {/* Where a full charge ends and the overcharge begins. */}
        <View style={[styles.mark, { left: `${FULL_AT * 100}%` }]} pointerEvents="none" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Between the corner controls, centred on the stage.
   *
   * Pinned from both sides rather than given a width: the aid toggles claim the
   * left and the camera button the right, and what is left over differs by
   * eighty points between a small phone and a large one. Insetting past both
   * means the gauge takes whatever the middle actually is.
   *
   */
  host: {
    position: 'absolute',
    top: Spacing.two,
    /*
     * One tile's width clear of each corner, and the same on both sides.
     *
     * The aid toggles stack vertically now, so the left claims a single tile
     * exactly as the camera button does on the right. The insets are therefore
     * identical, and the gauge is centred on the stage by construction rather
     * than by arithmetic that has to be redone whenever an aid is added.
     */
    left: Spacing.two + HUD_TILE + Spacing.two,
    right: Spacing.two + HUD_TILE + Spacing.two,
    height: HUD_TILE,
  },
  /**
   * The channel the blocks run in.
   *
   * The same tile as the corner controls, and the same *height* as them: it
   * fills the host rather than sitting centred inside it, so the three
   * instruments across the top share one baseline and one cap. It was two
   * thirds their height before, which is what made it read as a bar that had
   * wandered in rather than as part of the row.
   *
   * Surface, border, radius and opacity all come from `hud`, so none of them can
   * drift from the buttons beside it.
   */
  track: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: HUD_TILE_BORDER,
    borderColor: Palette.border,
    backgroundColor: HUD_SURFACE,
    opacity: HUD_TILE_OPACITY,
  },
  /**
   * One block, and every block the same.
   *
   * They used to step up past a full charge, which marked the hundred-per-cent
   * line by shape as well as by colour. It also made the gauge two objects — a
   * row of short blocks and a row of tall ones — where it should read as one
   * scale being filled. The line is marked by `mark` instead, which says the
   * same thing without breaking the run.
   */
  segment: {
    flex: 1,
    height: '100%',
    borderRadius: 2,
  },
  /**
   * The hundred-per-cent line, drawn between the blocks.
   *
   * Colour cannot carry it alone: the amber above the line and the gold below
   * are within 1.4:1 of each other in luminance, so anyone reading the gauge by
   * brightness — in sun, or with any colour-vision deficiency — sees one
   * unbroken sweep. A hairline through the track is legible whatever the eye
   * does with hue, and unlike a step in height it does not cost the scale its
   * evenness.
   *
   * Absolutely positioned so it sits *over* the blocks rather than taking a slot
   * in the row: it marks a boundary between two of them, not a value of its own.
   */
  mark: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(243, 241, 234, 0.55)',
  },
});
