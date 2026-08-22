/**
 * The one control that plays the shot: power and spin in a single gesture.
 *
 * Hold it and the power winds up. Slide the thumb while holding and the contact
 * point moves off centre — the same english the separate control used to set,
 * without a second thing to reach for or a second decision to remember making.
 *
 * The spin is drawn *inside* the button while charging, as a cue ball with the
 * tip mark on it. That placement is the reason this works at all: charging is a
 * timed act, and asking somebody to watch a power bar in one corner and a spin
 * target in another while a clock runs is asking them to do neither well. One
 * place, one thumb, one reading.
 *
 * A pan rather than a `Pressable`, because a press releases the moment the
 * finger leaves the button's bounds — which is exactly what steering the spin
 * does. The gesture keeps the touch until the finger lifts, wherever it goes.
 */

import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { useChargeSwell } from '@/components/game/charge-ring';
import { Luxe, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';
import { useSwing } from '@/store/swing';

/** How long the button must be held before the charge starts. */
const HOLD_MS = 220;

/**
 * How far the thumb travels for full english, in points.
 *
 * Generous, because the thumb is already resting on the button and the movement
 * has to be possible without lifting: 70pt is about a thumb's reach from a
 * planted contact, and it means a small slip does not put heavy side on a shot
 * that was meant to be plain.
 */
const SPIN_REACH = 70;

export function ShootButton({
  canShoot,
  awaitingCall,
  onBlocked,
}: {
  canShoot: boolean;
  awaitingCall: boolean;
  onBlocked: () => void;
}) {
  const t = useT();
  const swell = useChargeSwell();
  const takeShot = useSession((s) => s.takeShot);
  const setSpin = useSession((s) => s.setSpin);

  const startCharge = useSwing((s) => s.start);
  const releaseCharge = useSwing((s) => s.release);
  const cancelCharge = useSwing((s) => s.cancel);
  const tapCharge = useSwing((s) => s.tap);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /*
   * Whether the finger is still down.
   *
   * `onFinalize`'s `success` flag reports whether the *recogniser* activated,
   * not whether the shot was any good — and a pan with `minDistance(0)` that
   * never moves may never activate at all. Treating that as an interruption
   * cancelled the charge instead of playing the shot, so holding the button
   * dead still wound the ring to the top and then threw the shot away, over and
   * over. This ref is the honest answer to "did the touch begin here?", which
   * is the question the release actually needs to ask.
   */
  const touching = useRef(false);

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  useEffect(() => clearHold, [clearHold]);

  /*
   * Where the thumb has moved to, as a contact point on the ball.
   *
   * Measured from where the gesture began rather than from the button's centre:
   * the thumb lands wherever it lands, and treating that spot as centre-ball
   * means a shot with no english needs no precision at all — you simply do not
   * move.
   */
  const steer = useCallback(
    (dx: number, dy: number) => {
      let side = dx / SPIN_REACH;
      // Screen y grows downwards; hitting high on the ball is positive.
      let vertical = -dy / SPIN_REACH;

      const distance = Math.hypot(side, vertical);
      if (distance > 1) {
        side /= distance;
        vertical /= distance;
      }

      setSpin({ side, vertical });
    },
    [setSpin],
  );

  /*
   * Play the shot, once.
   *
   * Both the touch stream and the recogniser can report the same release, and
   * whichever arrives first should be the one that counts — `touching` is the
   * latch that makes the second a no-op.
   */
  const fire = useCallback(() => {
    if (!touching.current) return;
    touching.current = false;

    const charging = useSwing.getState().charging;
    takeShot(charging ? releaseCharge() : tapCharge());
  }, [takeShot, releaseCharge, tapCharge]);

  const gesture = Gesture.Pan()
    .runOnJS(true)
    /*
     * Activated by time as well as by movement.
     *
     * `minDistance(0)` reads as "no movement required", but a pan only *tests*
     * that condition when a touch-move event arrives — so a finger held
     * perfectly still generates nothing to test, the recogniser sits in BEGAN,
     * and the gesture can end without ever activating. That is precisely the
     * plain shot with no english: press, hold to the power you want, release.
     * The charge wound to the top and the shot was never played.
     *
     * Activating after a long press gives the recogniser a clock of its own, so
     * a still finger reaches ACTIVE on its own account. Well under the hold that
     * starts the charge, so by the time there is anything to release the gesture
     * is already live.
     */
    .activateAfterLongPress(HOLD_MS / 2)
    .minDistance(0)
    .onBegin(() => {
      if (!canShoot) return;
      touching.current = true;
      // Every shot starts plain: english is a thing you ask for on this shot,
      // not a setting left over from the last one.
      setSpin({ side: 0, vertical: 0 });
      holdTimer.current = setTimeout(startCharge, HOLD_MS);
    })
    .onChange((event) => {
      if (!canShoot) return;
      // Only once the charge has begun: a flick during the first fifth of a
      // second is somebody tapping, not somebody aiming.
      if (useSwing.getState().charging) steer(event.translationX, event.translationY);
    })
    /*
     * The finger lifting, reported by the touch stream rather than the
     * recogniser.
     *
     * A belt to the long-press braces: `onTouchesUp` fires whenever a pointer
     * leaves the screen, whatever state the pan is in, so even a gesture that
     * somehow never activates cannot leave the charge running. `fire` guards
     * against the shot being played twice when both paths do arrive.
     */
    .onTouchesUp(() => {
      clearHold();
      fire();
    })
    .onFinalize((_event, success) => {
      clearHold();

      if (!canShoot) {
        onBlocked();
        return;
      }

      /*
       * A gesture the system took away is not a shot.
       *
       * `onFinalize` fires both when the finger lifts and when something else
       * claims the touch — a notification, a system edge swipe. Playing the shot
       * on the second would fire a half-wound cue at whatever the interruption
       * left on the meter, so the charge is simply discharged instead.
       *
       * But `success` alone cannot tell those apart: it is false both when the
       * system stole the touch *and* when the finger simply never moved far
       * enough to activate the pan — which is exactly what a player holding the
       * button still to wind up full power does. Only a touch that never began
       * here is treated as an interruption.
       */
      /*
       * Only a touch still held here can be an interruption.
       *
       * If `touching` is already false the release has been dealt with — either
       * the touch stream reported the lift and the shot is away, or the gesture
       * never began on this button at all. Cancelling in that state would
       * discharge a swing that has already been played.
       */
      if (!touching.current) return;

      if (!success) {
        touching.current = false;
        cancelCharge();
        return;
      }

      fire();
    });

  const label = awaitingCall
    ? t('game.callFirstShort')
    : canShoot
      ? t('game.shoot')
      : t('game.goAim');

  return (
    /*
     * A plain `View` directly under the detector, with the animation inside it.
     *
     * `GestureDetector` needs a child it can attach a native handler to, and an
     * `Animated.View` in that position broke the attachment outright — the
     * button stopped responding, and because this gesture shares the screen with
     * the table's own, the whole 3D surface went dead with it. The wrapper stays
     * ordinary; the swell moves one level in, where nothing depends on it.
     */
    <GestureDetector gesture={gesture}>
      <View
        accessibilityRole="button"
        accessibilityLabel={
          awaitingCall ? t('game.callFirst') : canShoot ? t('game.shootLabel') : t('game.goAimLabel')
        }
        style={styles.host}>
        <Animated.View style={[styles.button, !canShoot && styles.blocked, swell]}>
          <Text style={[styles.label, !canShoot && styles.labelBlocked]}>{label}</Text>

          {/*
            Nothing here about the english.

            The contact point is marked on the cue ball itself, out on the table
            — which is the ball you are already looking at, so there is no
            diagram to translate from. See `AimGuide`.
          */}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  /**
   * The touch target, which never moves.
   *
   * Sized to the button at rest. The swell inside it scales visually without
   * changing this box, so the area that answers a thumb stays exactly where the
   * thumb last found it — a target that grows as you hold it is a target that
   * has moved by the time you let go.
   */
  host: {
    width: 168,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * A wide bar, sized and cornered like the rest of the app.
   *
   * The radius was 10 while the panel around it is 22 and every card in the app
   * is 14 — close enough to the others to look like a mistake rather than a
   * choice. `Radius.medium` puts it in the same family as the menu buttons it
   * is the in-game equivalent of.
   *
   * Wider than it was, too. It is the only control in its row now, and a button
   * that is the whole point of the panel should not be the smallest thing on
   * it.
   */
  button: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Luxe.gold,
  },
  /**
   * Waiting on something: hollow rather than merely dimmed.
   *
   * An outline reads as "not yet" — grey on a dark HUD is indistinguishable
   * from broken.
   */
  blocked: {
    backgroundColor: 'rgba(8, 11, 10, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 98, 0.45)',
  },
  label: {
    color: Luxe.ink,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
  },
  labelBlocked: {
    color: Luxe.gold,
    fontSize: 11,
    letterSpacing: 1,
  },
});
