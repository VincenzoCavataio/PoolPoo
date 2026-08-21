/**
 * The shooting panel: aim strip, power, shot button.
 *
 * Deliberately squat — it used to be tall enough to sit over the near pockets,
 * which is the one part of the table you most need to see while lining a shot
 * up. Aiming gets its own row because it is the control used most and the one
 * that needs the finest touch.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { SpinControl } from '@/components/game/spin-control';
import { Luxe, Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { ChargeRing } from '@/components/game/charge-ring';
import { CameraMode } from '@/game/render/camera';
import { Phase } from '@/game/rules/types';
import { currentCall, currentCpu, isFinished, needsCall } from '@/game/rules/match';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';
import { chargeValue, MAX_CHARGE, MISCUE_OVER, useSwing } from '@/store/swing';

/** One tap of the fine-aim buttons, in radians — a touch over half a degree. */
/**
 * How long the shoot button must be held before the swing meter opens.
 *
 * Long enough that an ordinary tap never sees it, short enough that reaching for
 * it does not feel like waiting. A quarter second is about the boundary between
 * a press and a hold.
 */
const HOLD_MS = 250;

const FINE_AIM_STEP = 0.01;
/**
 * The rolling scale: how far apart the marks are, and how many turns of the cue
 * it takes to run through them all.
 *
 * Twelve pixels is close enough that several are always in view at once, which
 * is what makes the movement readable; a scale with two marks on it looks like
 * two things sliding rather than a scale turning.
 *
 * Sixty ticks to a full revolution puts a major mark — every fifth — at each
 * thirty degrees, so the strip is coarse enough to see turning and fine enough
 * that a small correction still visibly moves it.
 */
/**
 * How many blocks the power gauge is divided into.
 *
 * Fifteen over a ceiling of 150%, so each is worth a tenth of a full charge and
 * the last three are the overcharge. Coarse enough to count without thinking,
 * fine enough that a shot can be judged to within ten per cent.
 */
const POWER_SEGMENTS = 15;

const TICK_GAP = 12;
const TICKS_PER_TURN = 60;

/**
 * How many marks are drawn.
 *
 * Enough to cover the widest strip twice over, so the row can be offset by up to
 * a full spacing without a gap appearing at either end.
 */
const ROLLING_TICKS = 64;
/** Radians per pixel dragged across the strip. */
const SCRUB_PER_PX = 0.0022;
/** Fraction of the strip at each end that keeps turning while held. */
const EDGE_ZONE = 0.2;
/** Radians per second at the very end of the strip. */
const EDGE_RATE = 1.15;

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
      return { backgroundColor: wild ? 'rgba(217, 117, 107, 0.14)' : 'rgba(255, 255, 255, 0.07)' };
    }
    return { backgroundColor: wild ? '#d9756b' : over ? '#ff523c' : Luxe.gold };
  });

  return (
    <Animated.View
      style={[styles.segment, over && styles.segmentOver, style]}
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
function PowerReadout() {
  const t = useT();

  return (
    <View style={styles.powerWrap}>
      <View style={styles.segments}>
        {Array.from({ length: POWER_SEGMENTS }, (_, i) => (
          <Segment key={i} index={i} count={POWER_SEGMENTS} />
        ))}
      </View>

      <Text style={styles.powerCaption}>{t('game.power')}</Text>
    </View>
  );
}

function AimStrip() {
  const t = useT();
  const [width, setWidth] = useState(0);
  const [edge, setEdge] = useState(0);
  const aimAngle = useSession((s) => s.aimAngle);

  /*
   * The scale's offset, from the aim itself.
   *
   * One full turn of the cue moves the marks by `TICKS_PER_TURN` spacings, and
   * the row is wrapped back by one spacing so it never runs off its own end.
   * Using the angle directly rather than an animation means the strip cannot
   * lag behind the table it is reporting on.
   */
  const tickScroll = useAnimatedStyle(() => {
    const perTick = (Math.PI * 2) / TICKS_PER_TURN;
    /*
     * Wrapped into 0..TICK_GAP, never negative.
     *
     * JavaScript's `%` keeps the sign of its left operand, so aiming anticlockwise
     * gave a negative shift — which slides the row the wrong way and opens a gap
     * at its leading edge. Adding a full spacing before the second modulo folds
     * it back into the positive range.
     */
    const raw = ((aimAngle / perTick) * TICK_GAP) % TICK_GAP;
    const shift = (raw + TICK_GAP) % TICK_GAP;
    return { transform: [{ translateX: -shift }] };
  }, [aimAngle]);

  const hold = useRef({ running: false, direction: 0, depth: 0 });
  const frame = useRef<number | null>(null);
  const last = useRef(0);

  const stop = useCallback(() => {
    hold.current.running = false;
    hold.current.direction = 0;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setEdge(0);
  }, []);

  const tick = useCallback(() => {
    const now = Date.now();
    const delta = Math.min(0.05, (now - last.current) / 1000);
    last.current = now;

    const { direction, depth } = hold.current;
    if (direction !== 0 && useSession.getState().phase === Phase.AIMING) {
      useSession.getState().nudgeAim(direction * EDGE_RATE * depth * delta);
    }

    frame.current = hold.current.running ? requestAnimationFrame(tick) : null;
  }, []);

  const track = useCallback(
    (x: number) => {
      if (width <= 0) return;
      const position = Math.min(1, Math.max(0, x / width));

      let direction = 0;
      let depth = 0;
      if (position < EDGE_ZONE) {
        direction = -1;
        depth = (EDGE_ZONE - position) / EDGE_ZONE;
      } else if (position > 1 - EDGE_ZONE) {
        direction = 1;
        depth = (position - (1 - EDGE_ZONE)) / EDGE_ZONE;
      }

      hold.current.direction = direction;
      hold.current.depth = Math.max(0.25, depth);
      setEdge(direction);
    },
    [width],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((event) => {
          last.current = Date.now();
          hold.current.running = true;
          track(event.x);
          if (frame.current === null) frame.current = requestAnimationFrame(tick);
        })
        .onChange((event) => {
          const session = useSession.getState();
          if (session.phase === Phase.AIMING) session.nudgeAim(event.changeX * SCRUB_PER_PX);
          track(event.x);
        })
        .onFinalize(stop),
    [track, tick, stop],
  );

  useEffect(() => stop, [stop]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.strip}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityLabel={t('game.aimStrip')}>
        <View style={[styles.edgeZone, styles.edgeLeft, edge === -1 && styles.edgeActive]} pointerEvents="none" />
        <View style={[styles.edgeZone, styles.edgeRight, edge === 1 && styles.edgeActive]} pointerEvents="none" />

        {/*
          The ticks travel with the aim, like the card of a compass.

          They used to be twenty-one fixed marks, so turning the cue changed the
          table and left the strip looking exactly as it had — the one control
          whose whole job is to say "you are turning" said nothing. Now the scale
          slides underneath a fixed pointer: the marks move, the centre does not,
          and the strip reads as a heading rather than as decoration.

          Enough of them are drawn to cover the strip twice over, and the row is
          offset by the aim modulo one tick spacing, so it scrolls for ever
          without ever running out of marks.
        */}
        <View style={styles.ticks} pointerEvents="none">
          <Animated.View style={[styles.tickRow, tickScroll]}>
            {Array.from({ length: ROLLING_TICKS }, (_, i) => (
              <View
                key={i}
                style={[styles.tick, i % 5 === 0 && styles.tickMajor, { left: i * TICK_GAP }]}
              />
            ))}
          </Animated.View>
        </View>

        {/* The pointer, fixed at the middle: what the scale is read against. */}
        <View style={styles.tickCentre} pointerEvents="none" />

        <Text style={styles.stripLabel} pointerEvents="none">
          ◀ {t('game.aim')} ▶
        </Text>
      </View>
    </GestureDetector>
  );
}

export function GameControls() {
  const t = useT();
  const phase = useSession((s) => s.phase);
  const cameraMode = useSession((s) => s.cameraMode);
  const takeShot = useSession((s) => s.takeShot);
  const nudgeAim = useSession((s) => s.nudgeAim);
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

  const startCharge = useSwing((s) => s.start);
  const releaseCharge = useSwing((s) => s.release);
  const cancelCharge = useSwing((s) => s.cancel);

  /** Counts the hold. Cleared on release, so a tap never starts a charge. */
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const aiming = phase === Phase.AIMING;

  /*
   * A charge left running by anything but a release has to be stopped.
   *
   * The phase changes under it when the computer takes over, or when the player
   * backs out to the menu mid-hold, and a button still winding up over a table
   * that is no longer being aimed at is both wrong and impossible to discharge.
   */
  useEffect(() => {
    if (aiming) return;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
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

  if (!aiming) return null;

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
        <View style={styles.row}>
          <Pressable
            accessibilityLabel={t('game.aimLeft')}
            onPress={() => nudgeAim(-FINE_AIM_STEP)}
            style={({ pressed }) => [styles.fine, pressed && styles.pressed]}>
            <Text style={styles.fineLabel}>◀</Text>
          </Pressable>

          <AimStrip />

          <Pressable
            accessibilityLabel={t('game.aimRight')}
            onPress={() => nudgeAim(FINE_AIM_STEP)}
            style={({ pressed }) => [styles.fine, pressed && styles.pressed]}>
            <Text style={styles.fineLabel}>▶</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <SpinControl />

          {/*
            A reading, not a control.

            The slider is gone: power comes from how long the shoot button is
            held, so there is nothing here to drag any more. What is left is the
            number, which sits at zero until the button is pressed and then
            climbs with the charge — the same information the ring gives, for
            anybody who would rather have the figure.
          */}
          <PowerReadout />

          {/*
            Tap to shoot, hold to gamble.

            A press that ends quickly plays the shot exactly as it always did, at
            the power on the slider. A press held past the threshold opens the
            swing meter instead, and letting go stops the marker — land it in the
            middle and the shot comes out closer to what you asked for, miss and
            the cue is snatched and the ball struck harder than you meant.

            Both live on one button on purpose: a separate control would make the
            meter a mode to enter rather than a risk to take, and the whole point
            is that it is the same action, held.
          */}
          <Pressable
            accessibilityLabel={
              awaitingCall
                ? t('game.callFirst')
                : canShoot
                  ? t('game.shootLabel')
                  : t('game.goAimLabel')
            }
            onPressIn={() => {
              if (!canShoot) return;
              // Armed rather than started: a quick tap must not light the ring
              // on its way to an ordinary shot.
              holdTimer.current = setTimeout(startCharge, HOLD_MS);
            }}
            onPressOut={() => {
              if (holdTimer.current) {
                clearTimeout(holdTimer.current);
                holdTimer.current = null;
              }
              if (!canShoot) return;

              // Charging means the hold ran long enough for the ring to light,
              // so this release plays whatever was wound on. Otherwise it was a
              // tap, and a tap adds nothing.
              takeShot(useSwing.getState().charging ? releaseCharge() : 0);
            }}
            onPress={
              // The tap is handled in `onPressOut`, which is the event that also
              // ends a hold — one path for both, so a shot cannot fire twice.
              awaitingCall || canShoot ? undefined : () => setCameraMode(CameraMode.CUE)
            }
            style={({ pressed }) => [
              styles.shoot,
              !canShoot && styles.shootBlocked,
              pressed && (canShoot ? styles.shootPressed : styles.pressed),
            ]}>
            <Text style={[styles.shootLabel, !canShoot && styles.shootLabelBlocked]}>
              {/* The short form on the face; the accessibility label above
                  carries the whole sentence. */}
              {awaitingCall
                ? t('game.callFirstShort')
                : canShoot
                  ? t('game.shoot')
                  : t('game.goAim')}
            </Text>

            {/* Inside the button so it tracks its box, and over the label so the
                glow reads as coming off the button rather than behind it. */}
            <ChargeRing />
          </Pressable>
        </View>

        {!fromCue ? (
          <Text style={styles.hint}>{t('game.shootBlocked')}</Text>
        ) : null}
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
  panel: {
    backgroundColor: 'rgba(12, 19, 16, 0.9)',
    borderRadius: Radius.large,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  strip: {
    flex: 1,
    height: 44,
    borderRadius: Radius.small,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  edgeZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: `${EDGE_ZONE * 100}%`,
    backgroundColor: 'transparent',
  },
  edgeLeft: {
    left: 0,
    borderTopLeftRadius: Radius.small,
    borderBottomLeftRadius: Radius.small,
  },
  edgeRight: {
    right: 0,
    borderTopRightRadius: Radius.small,
    borderBottomRightRadius: Radius.small,
  },
  edgeActive: {
    backgroundColor: 'rgba(61, 220, 132, 0.22)',
  },
  /** Clips the sliding row, so marks disappear at the edges rather than pile up. */
  ticks: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  /** The row that slides. Absolute children, so their spacing is exact. */
  tickRow: {
    ...StyleSheet.absoluteFillObject,
  },
  tick: {
    position: 'absolute',
    top: '50%',
    marginTop: -4,
    width: 1,
    height: 8,
    backgroundColor: Palette.border,
  },
  tickMajor: {
    marginTop: -7.5,
    height: 15,
    backgroundColor: Palette.textMuted,
  },
  /**
   * The pointer the scale is read against, fixed at the middle.
   *
   * Was one of the marks, which meant it moved with them and there was nothing
   * left to measure against — a compass card with no lubber line.
   */
  tickCentre: {
    position: 'absolute',
    left: '50%',
    marginLeft: -1,
    top: '50%',
    marginTop: -13,
    width: 2,
    height: 26,
    backgroundColor: Palette.accent,
  },
  stripLabel: {
    color: Palette.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  fine: {
    width: 44,
    height: 44,
    borderRadius: Radius.small,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fineLabel: {
    color: Palette.text,
    fontSize: 16,
  },
  /**
   * The readout, shaped like the slider it replaces.
   *
   * Same footprint on purpose: the row keeps its proportions, and the thing that
   * changed is that this one cannot be dragged. It fills from the left as the
   * charge climbs, so the figure is backed by something readable at a glance.
   */
  powerWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    /*
     * Air on both sides, beyond the row's own gap.
     *
     * The blocks run edge to edge inside this, so without it the outermost one
     * sits almost against the spin control on one side and the shoot button on
     * the other — three different things touching, reading as one crowded strip.
     */
    paddingHorizontal: Spacing.two,
  },
  powerCaption: {
    color: Luxe.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  /**
   * The row of blocks. No border and no ground of its own.
   *
   * A frame round it would put it straight back into the same family as the aim
   * strip; the blocks themselves are the object, floating on the panel.
   */
  segments: {
    width: '100%',
    // A shade shorter than the aim strip beside it, so the eye reads them as
    // two different instruments rather than a pair.
    height: 26,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  /**
   * One block, taller than it is wide.
   *
   * Upright bars rather than a continuous strip: the shape says "level" the way
   * a row of lights on an amplifier does, and it is the clearest thing this
   * could be that the aim strip is not.
   */
  segment: {
    flex: 1,
    height: '70%',
    borderRadius: 1.5,
  },
  /** The overcharge blocks stand full height, so the last stretch is visibly different. */
  segmentOver: {
    height: '100%',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: Radius.pill,
    opacity: 0.85,
  },
  trackLabel: {
    color: Palette.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: Radius.pill,
    backgroundColor: Palette.text,
    borderWidth: 3,
  },
  /**
   * The one control that does the thing, made to look like it.
   *
   * It was an 88×48 rounded rectangle in the accent colour, in a row of 48-tall
   * rounded rectangles — the same silhouette as the power slider beside it and
   * the spin control on the other side, so the eye had nothing to catch on. A
   * button does not read as primary because it is a slightly different colour;
   * it reads as primary because it is a different *shape*.
   *
   * So it is a disc: taller than the row, filled gold like every committing
   * action in the app, and round where everything near it is oblong.
   */
  shoot: {
    width: 88,
    height: 48,
    borderRadius: Radius.small,
    backgroundColor: Luxe.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * Waiting on something — the overhead view, or a call not yet made.
   *
   * Hollow rather than merely darker: an unfilled disc reads as "not yet"
   * without going grey, which on a dark HUD is indistinguishable from disabled.
   */
  shootBlocked: {
    backgroundColor: 'rgba(8, 11, 10, 0.85)',
    borderWidth: 2,
    borderColor: 'rgba(201, 169, 98, 0.5)',
  },
  /** Pressed: sunk a shade, the way the menu's gold bars do. */
  shootPressed: {
    backgroundColor: '#b8985a',
  },
  shootLabel: {
    color: Luxe.ink,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  shootLabelBlocked: {
    color: Luxe.gold,
    fontSize: 11,
    letterSpacing: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  hint: {
    color: Palette.gold,
    fontSize: 11,
    textAlign: 'center',
  },
});
