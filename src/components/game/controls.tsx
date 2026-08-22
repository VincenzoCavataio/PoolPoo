/**
 * The shooting panel: aim strip, power, shot button.
 *
 * Deliberately squat — it used to be tall enough to sit over the near pockets,
 * which is the one part of the table you most need to see while lining a shot
 * up. Aiming gets its own row because it is the control used most and the one
 * that needs the finest touch.
 */

import { useEffect } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';

import { ShootButton } from '@/components/game/shoot-button';
import { Luxe, Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { CameraMode } from '@/game/render/camera';
import { Phase } from '@/game/rules/types';
import { currentCall, currentCpu, isFinished, needsCall } from '@/game/rules/match';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';
import { chargeValue, MAX_CHARGE, MISCUE_OVER, useSwing } from '@/store/swing';

/**
 * How many blocks the power gauge is divided into.
 *
 * Fifteen over a ceiling of 150%, so each is worth a tenth of a full charge and
 * the last three are the overcharge. Coarse enough to count without thinking,
 * fine enough that a shot can be judged to within ten per cent.
 */
const POWER_SEGMENTS = 15;

/**
 * A ruler to push against, with the edges live.
 *
 * Dragging scrubs the aim as far as the finger travels, which runs out of strip
 * exactly when a long rotation is wanted. So the outer fifth at each end keeps
 * turning for as long as the finger stays there, faster the further in it is —
 * the strip behaves like a rocker switch once you reach the end of it.
 */
/**
 * The power figure, driven by the charge.
 *
 * Zero at rest, because nothing has been wound on: the shot has no power until
 * the button is held, and a readout showing a number nobody chose would be
 * inviting the player to look for the control that set it.
 *
 * Past a hundred it goes red and keeps counting, which is the plainest possible
 * statement of what an overcharge is: not a different mode, just more than the
 * table is meant to take.
 */
/**
 * One segment of the power gauge.
 *
 * Lit or unlit rather than partly filled, so the gauge is counted rather than
 * measured — you read three of ten at a glance, where a bar three-tenths along
 * has to be judged against its own ends.
 */
/**
 * The unlit and overcharge tones, named rather than written inline.
 *
 * `UNLIT_WILD` is the danger colour at the same weight as the plain unlit
 * block, so the last stretch of the gauge reads as *present* before it is
 * reached — you can see where the cliff is without having walked off it.
 */
const UNLIT = 'rgba(255, 255, 255, 0.06)';
const UNLIT_WILD = 'rgba(217, 117, 107, 0.16)';

/**
 * Where the gauge changes colour, as a fraction of a *full* charge.
 *
 * The run reads as a rising temperature: green while the shot is soft enough to
 * be placed, amber once it is hard enough to lose position with, then the
 * overcharge and the miscue band beyond it.
 *
 * These are fractions of 1, not of `MAX_CHARGE`, so they stay put if the ceiling
 * moves — the sixty-per-cent mark is sixty per cent of a full shot however far
 * past full the gauge is allowed to run.
 */
const WARM_FROM = 0.6;

/**
 * The overcharge amber.
 *
 * Chosen for hue, not for lightness: at 8.7:1 against the panel it is plainly
 * visible, but against the gold beside it the luminance ratio is only 1.04 —
 * the two are all but identical in greyscale. Colour alone therefore cannot
 * carry the hundred-per-cent line, so the gauge marks it with *height* too: the
 * safe blocks climb a slope and the overcharge ones break it by standing full
 * height, which is legible whatever the eye does with hue. See `Segment`.
 */
const OVER_COLOR = '#e8a33d';

/**
 * The soft end of the gauge: the game's own accent green.
 *
 * The scale used to be gold for its whole safe run, which said nothing about
 * *where* in that run you were — a quarter charge and a full one were the same
 * colour, and only the count of lit blocks told them apart. Rising through green
 * and amber to red means the colour carries the reading too.
 */
const SOFT_COLOR = Palette.accent;

/**
 * How tall the first and last of the safe blocks stand, as a percentage of the
 * track.
 *
 * The floor is well clear of nothing: a first block at a few per cent would be a
 * speck, and the scale has to look like a scale before any of it is lit.
 */
const MIN_SEGMENT = 42;
const MAX_SEGMENT = 88;

/** The corner radius of one block in the gauge. */
const SEGMENT_RADIUS = 3;

/** How far the track is inset from the blocks it holds, top and bottom. */
const TRACK_PAD_V = 7;

/**
 * The track's corner radius, derived rather than chosen.
 *
 * Two rounded rectangles nested one inside the other only look concentric when
 * the outer radius is the inner one *plus* the gap between them — otherwise the
 * curves run at different rates and the corner of the track visibly pinches
 * against the block sitting in it. The track was on `Radius.medium`, four points
 * wide of what the padding asks for, which is exactly the mismatch that shows.
 *
 * Kept as an expression so it stays true if either number is retuned.
 */
const TRACK_RADIUS = SEGMENT_RADIUS + TRACK_PAD_V;

function Segment({ index, count }: { index: number; count: number }) {
  const charge = ((index + 1) / count) * MAX_CHARGE;
  const over = charge > 1;
  /*
   * The blocks past the miscue line, which the gauge has to distinguish.
   *
   * There are three bands, not two: safe, an overcharge worth taking, and the
   * last stretch where the cue skids off the ball entirely. A gauge that showed
   * only the first two would leave the worst outcome unmarked — you would hold
   * into a miscue with nothing on screen having warned you.
   */
  const wild = charge > MISCUE_OVER;

  const style = useAnimatedStyle(() => {
    const reached = chargeValue.value / MAX_CHARGE;
    // Lit once the charge has passed this block's own share of the gauge.
    const lit = reached >= (index + 1) / count - 1 / count / 2;
    if (!lit) {
      return { backgroundColor: wild ? UNLIT_WILD : UNLIT };
    }
    /*
     * Four lit colours, every one from the theme.
     *
     * Green, gold, amber, then the app's own `danger` for the miscue band — a
     * run that warms as it fills. The last two are the same pair as before, for
     * the same reason: the overcharge wants to look hot without borrowing a
     * siren red that appears nowhere else in the app.
     */
    if (wild) return { backgroundColor: Luxe.danger };
    if (over) return { backgroundColor: OVER_COLOR };
    return { backgroundColor: charge > WARM_FROM ? Luxe.gold : SOFT_COLOR };
  });

  /*
   * The blocks rise across the gauge.
   *
   * A row of identical bars says only *how many* are lit. Stepping the heights
   * up from left to right makes the row a slope, so its shape says which end of
   * the scale you are at even before the colour does — and it rhymes with the
   * three rising balls on the button below, which is the same idea drawn small.
   *
   * The overcharge blocks break the slope and stand full height instead: past a
   * full charge the gauge stops describing degrees of the same thing and starts
   * warning, so the run visibly changes character rather than continuing to
   * climb.
   */
  const rise = MIN_SEGMENT + (MAX_SEGMENT - MIN_SEGMENT) * (index / (count - 1));

  return (
    <Animated.View
      style={[styles.segment, { height: over ? '100%' : `${rise}%` }, style]}
      pointerEvents="none"
    />
  );
}

/**
 * The power gauge: a row of segments that light up as the charge builds.
 *
 * Deliberately not another bar. The aim strip beside it is already a bordered
 * track with marks along it, and a second one read as the same control twice —
 * two rectangles that both fill, distinguishable only by looking at what was
 * written under them.
 *
 * So this counts instead of measuring. Separate blocks with gaps between them
 * are a different object at a glance: a level meter rather than a slider, which
 * is what a charge actually is. The last three run past a full charge and stand
 * apart from the rest, so the overcharge is visibly a place you have gone rather
 * than a colour the bar turned.
 */
/**
 * The charge as a number, driven from the UI thread.
 *
 * An `AnimatedTextInput` rather than a `Text`, because only a `TextInput` has a
 * `text` prop that `useAnimatedProps` can write to — a `Text` would need a state
 * update per frame, which is sixty re-renders of the whole panel a second while
 * the shot is being wound.
 *
 * It is read-only and unfocusable: it looks like a label, and behaves like one.
 */
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

function ChargeNumber() {
  const props = useAnimatedProps(() => {
    // Rounded to fives, so the number reads as a gauge rather than a stopwatch.
    const percent = Math.round((chargeValue.value * 100) / 5) * 5;
    return { text: `${percent}%`, defaultValue: `${percent}%` };
  });

  const style = useAnimatedStyle(() => {
    const charge = chargeValue.value;
    if (charge > MISCUE_OVER) return { color: Luxe.danger };
    if (charge > 1) return { color: OVER_COLOR };
    return { color: charge > 0.02 ? Luxe.gold : Luxe.textFaint };
  });

  return (
    <AnimatedTextInput
      editable={false}
      focusable={false}
      pointerEvents="none"
      style={[styles.powerValue, style]}
      animatedProps={props}
    />
  );
}

function PowerReadout() {
  const t = useT();

  return (
    <View style={styles.powerWrap}>
      {/*
        The caption and the number on one line, above the blocks.

        The caption used to sit alone under the gauge in nine-point letters,
        which is small enough to be furniture rather than information — and it
        said only what the control was, never what it was doing. Pairing it with
        the live percentage puts the label and its value together, the way every
        readout in the app is set: quiet name on the left, bright value on the
        right.
      */}
      <View style={styles.powerHead}>
        <Text style={styles.powerCaption}>{t('game.power')}</Text>
        <ChargeNumber />
      </View>

      <View style={styles.segments}>
        {Array.from({ length: POWER_SEGMENTS }, (_, i) => (
          <Segment key={i} index={i} count={POWER_SEGMENTS} />
        ))}
      </View>
    </View>
  );
}

export function GameControls() {
  const phase = useSession((s) => s.phase);
  const cameraMode = useSession((s) => s.cameraMode);
  const setCameraMode = useSession((s) => s.setCameraMode);

  /** True while the seat whose turn it is belongs to the computer. */
  const isCpuTurn = useSession((s) => {
    const match = s.match;
    return Boolean(match && !isFinished(match) && currentCpu(match));
  });

  const awaitingCall = useSession((s) => {
    const match = s.match;
    return Boolean(match && needsCall(match) && !currentCall(match));
  });

  const cancelCharge = useSwing((s) => s.cancel);
  const miscue = useSwing((s) => s.miscue);

  const aiming = phase === Phase.AIMING;

  /*
   * A mishit leaves the panel where it is.
   *
   * The controls hide during a shot, which is right when there is a shot to
   * watch: the balls are moving and there is nothing to command. A miscue moves
   * nothing at all, so it is over within a few frames — and hiding the panel for
   * those few frames only flashes the screen to bare table and back. Holding it
   * through the mishit means the one thing that visibly changes is the message
   * saying what went wrong.
   */
  const mishit = miscue !== null && !aiming;

  /*
   * A charge left running by anything but a release has to be stopped.
   *
   * The phase changes under it when the computer takes over, or when the player
   * backs out to the menu mid-hold, and a button still winding up over a table
   * that is no longer being aimed at is both wrong and impossible to discharge.
   *
   * The button owns the hold timer now; this only has to discharge the store.
   */
  useEffect(() => {
    if (aiming) return;
    cancelCharge();
  }, [aiming, cancelCharge]);

  const fromCue = cameraMode === CameraMode.CUE;
  /*
   * A shot still owed a call cannot be taken.
   *
   * The session refuses it anyway; this is so the button says why rather than
   * doing nothing when pressed, which is the difference between a rule and a
   * bug from where the player is sitting.
   */
  const canShoot = aiming && fromCue && !awaitingCall;

  /*
   * The overhead view hides the panel outright.
   *
   * From above you are looking, not playing: the shot cannot be taken from
   * here, and a full set of controls that all refuse is worse than no controls
   * — it invites the tap and then explains why it did nothing. Taking them away
   * makes the camera button the obvious next move, which is the only move there
   * is. It also replaces the line of text that used to say so, which was an
   * apology for a state that did not need to exist.
   */
  if (!fromCue) return null;

  if (!aiming && !mishit) return null;

  return (
    <View style={styles.container}>
      {/*
        While a computer is at the table the panel stays, and stops responding.

        It was hidden outright at first, which was wrong once the opponent began
        playing the controls rather than the outcome: the aim strip swinging
        round and the power bar filling *are* the computer taking its turn, and
        hiding them left the table erupting out of nothing.

        `pointerEvents` off rather than each control disabled — every one of them
        is a live surface, and a player must not be able to quietly re-aim a shot
        somebody else is about to play.
      */}
      <View
        style={[styles.panel, isCpuTurn && styles.panelCpu]}
        pointerEvents={isCpuTurn ? 'none' : 'auto'}>
        {/*
          Power across the full width, the button beneath it.

          The spin control is gone from this row: its job moved onto the button,
          where it is set by sliding the thumb during the charge. That freed the
          left of the row, and the power gauge took it — a scale is easier to
          read the longer it is, and this one is now the width of the screen.

          The button sits centred under it rather than at one end, because it is
          no longer one control among three. It is the control.
        */}
        <PowerReadout />

        <ShootButton
          canShoot={canShoot}
          awaitingCall={awaitingCall}
          onBlocked={() => setCameraMode(CameraMode.CUE)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Dimmed while the computer plays: visible, and plainly not yours. */
  panelCpu: {
    opacity: 0.72,
  },
  container: {
    paddingHorizontal: Spacing.three,
  },
  /**
   * The panel: one column, evenly spaced.
   *
   * The spacing used to be stated twice — a `gap` between the panel's children
   * *and* a `marginTop` on the row holding the button, which added up to double
   * the intended distance under the gauge and left the button adrift from the
   * scale it belongs to. There is one rule now: `gap`, and nothing else claims
   * space between them.
   *
   * `alignItems: 'center'` is what centres the button, so it needs no wrapper of
   * its own — the row that used to hold it existed only to do that, and existed
   * only to add the margin that was the problem.
   *
   * The radius comes down to `medium`, which is what every other card in the app
   * uses; `large` made the one panel at the bottom of the screen a different
   * shape from everything above it.
   */
  panel: {
    backgroundColor: 'rgba(12, 19, 16, 0.9)',
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.three,
    /*
     * The panel's own padding stays modest.
     *
     * The gauge inside it now carries a generous track of its own, and two
     * generous paddings nested one inside the other only push the table up the
     * screen for no gain — the eye reads the inner one and the outer just makes
     * the card taller.
     */
    paddingVertical: 12,
    gap: 12,
    alignItems: 'center',
  },
  /**
   * The power gauge and its heading.
   *
   * Full width so the blocks span the panel: a scale is easier to read the
   * longer it is. `width` rather than `flex: 1` — the panel is a column, so
   * `flex` there would have stretched it vertically, which is the opposite of
   * what was wanted and only looked right because nothing was competing for the
   * height.
   */
  powerWrap: {
    width: '100%',
    gap: Spacing.two,
  },
  /** Label left, value right: the setting of every readout in the app. */
  powerHead: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  powerCaption: {
    color: Luxe.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  /**
   * The live figure, in tabular figures.
   *
   * Fixed width and right-aligned so the digits do not shuffle the caption about
   * as the number grows from 5% to 150% — a readout that moves while it counts
   * is hard to read at precisely the moment it matters.
   *
   * `padding: 0` and the explicit height because a `TextInput` carries platform
   * chrome a `Text` does not: without them it sits low and adds a dozen points
   * of invisible margin.
   */
  powerValue: {
    width: 56,
    height: 16,
    padding: 0,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  /**
   * The row of blocks, on a ground of its own.
   *
   * It had none: the blocks floated directly on the panel, which left the unlit
   * ones — six per cent white — reading as gaps in the surface rather than as
   * the empty part of a gauge. A recessed track gives the scale somewhere to sit
   * and makes its full length visible before any of it is filled, so you can see
   * how much charge is left to give.
   *
   * The padding is what makes it a track rather than a border: the blocks stop
   * short of the edge on every side, so the ground reads as a channel they run
   * along.
   */
  segments: {
    width: '100%',
    height: 38,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    /*
     * Generous, and deliberately more than a border's worth.
     *
     * The point of the track is that the blocks run *inside* something. Too
     * little and it reads as an outline drawn round them — the ground has to be
     * visible along the whole run, at both ends and under the shortest block,
     * for the eye to take it as a channel with room left in it.
     */
    paddingHorizontal: Spacing.three,
    paddingVertical: TRACK_PAD_V,
    borderRadius: TRACK_RADIUS,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  /**
   * One block, taller than it is wide.
   *
   * No height here: it is set per block, because the row rises across the gauge
   * — see `Segment`.
   *
   * At a radius of 1.5 the corners read as a rendering artefact rather than a
   * decision. Three points on a block this wide is a visible radius that still
   * leaves it a bar rather than a pill.
   */
  segment: {
    flex: 1,
    borderRadius: SEGMENT_RADIUS,
  },
  pressed: {
    opacity: 0.7,
  },
});
