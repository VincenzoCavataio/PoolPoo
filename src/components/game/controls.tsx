/**
 * The shooting panel: one button, and the rules about when it may be pressed.
 *
 * It held three controls once — an aim strip, a power gauge and a spin pad — and
 * has given all three away to the table, which is where the things they measure
 * actually happen. Aiming is a drag on the cloth, spin is set on the ball's own
 * face, and power is the ring drawn round it. What is left is the shot itself.
 *
 * Deliberately squat, for the reason it always was: it used to be tall enough to
 * sit over the near pockets, which is the one part of the table you most need to
 * see while lining a shot up.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { ShootButton } from '@/components/game/shoot-button';
import { Spacing } from '@/constants/theme';
import { CameraMode } from '@/game/render/camera';
import { Phase } from '@/game/rules/types';
import { currentCall, currentCpu, isFinished, needsCall } from '@/game/rules/match';
import { useSession } from '@/store/session';
import { useSwing } from '@/store/swing';

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
        style={isCpuTurn && styles.dimmed}
        pointerEvents={isCpuTurn ? 'none' : 'auto'}>
        {/*
          The button, and nothing around it.

          There was a panel here — a bordered card with its own ground — from
          when this row held three controls and needed something to hold them
          together. The aim strip went to the cloth, the spin pad went onto the
          ball, and the power gauge went to the top of the table, which left a
          card drawn round a single button: a box inside a box, two edges where
          one would do.

          The button is its own surface. It says where to press by being gold and
          the size of a thumb, which a hairline round it does not help with.
        */}
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
  dimmed: {
    opacity: 0.72,
  },
  container: {
    paddingHorizontal: Spacing.three,
  },
    pressed: {
    opacity: 0.7,
  },
});
