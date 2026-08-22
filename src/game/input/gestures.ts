/**
 * Touch handling on the table.
 *
 * There is no mode button any more: **what a drag does is decided by the view
 * you are in**, and the view is decided by the game. Behind the cue you are
 * aiming, so the drag aims; from overhead you cannot shoot at all, so the drag
 * moves the camera. While the balls roll or a replay plays, it always moves the
 * camera.
 *
 * In the cue view a drag aims, and only aims: it reads the horizontal axis and
 * ignores the vertical one entirely. Raising the eye used to share the same
 * drag, which meant no shot could be lined up without also nudging the
 * viewpoint — a hand turning the cue is never perfectly level. That job belongs
 * to the pinch now, which takes two fingers and so cannot happen by accident.
 *
 * All of these run on the JS thread (`runOnJS`) because their only job is to
 * call a plain function. Driving them as worklets would buy nothing and would
 * need a hop back to JS for every update anyway.
 */

import { useMemo } from 'react';
import { Gesture, type ComposedGesture } from 'react-native-gesture-handler';

import { useMusic } from '@/game/audio/music';
import { adjustEye, CameraMode, orbitRig, zoomRig } from '@/game/render/camera';
import { flashMusicDevice, musicDeviceScreen } from '@/game/render/music-device';
import { crossDetents, endDetents, startDetent } from '@/game/input/detents';
import { Phase } from '@/game/rules/types';
import { useAimDial } from '@/store/aim-dial';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const ORBIT_AZIMUTH_PER_PX = 0.007;
const ORBIT_ELEVATION_PER_PX = 0.005;
const EYE_BACK_PER_SCALE = 0.6;
/** How near a tap must land to the music player, in points. */
const DEVICE_TAP_RADIUS = 76;

/** True when the player is lining a shot up from behind the cue ball. */
function inCueView(): boolean {
  const { phase, cameraMode } = useSession.getState();
  return phase === Phase.AIMING && cameraMode === CameraMode.CUE;
}

export function useTableGestures(): ComposedGesture {
  return useMemo(() => {
    const drag = Gesture.Pan()
      .runOnJS(true)
      .maxPointers(1)
      .minDistance(2)
      .onBegin(() => {
        startDetent(useSession.getState().aimAngle);
        // Only where a drag actually aims. Orbiting the camera turns nothing,
        // so there is no reading for the dial to show.
        if (inCueView()) useAimDial.getState().grab();
      })
      // `onChange` rather than `onUpdate`: it reports the delta since the last
      // event, so a drag moves things by how far the finger travelled this
      // frame instead of by its total distance from where it started.
      .onChange((event) => {
        if (inCueView()) {
          /*
           * Aiming reads the horizontal axis and nothing else.
           *
           * Vertical movement used to raise the eye on the same drag. That made
           * the one gesture the table is for into two overlapping ones: a hand
           * turning the cue is never perfectly level, so every aim came with an
           * unasked-for shift of the viewpoint. The eye is still adjustable
           * through the pinch, which is a deliberate two-fingered thing and
           * cannot be done by accident while aiming.
           */
          useSession.getState().nudgeAim(event.changeX * useSettings.getState().aimSensitivity);
          // Read back rather than predicted: the store is the one that decides
          // what the angle became, and the tick that fires must match the tick
          // the dial has just drawn.
          crossDetents(useSession.getState().aimAngle);
          return;
        }

        orbitRig(-event.changeX * ORBIT_AZIMUTH_PER_PX, -event.changeY * ORBIT_ELEVATION_PER_PX);
      })
      /*
       * `onFinalize` rather than `onEnd`: it runs whether the gesture ended, was
       * cancelled, or never activated at all, so the next drag always starts
       * from a fresh reading rather than clicking against where the last one
       * happened to stop.
       */
      .onFinalize(() => {
        endDetents();
        useAimDial.getState().release();
      });

    // The incremental factor is tracked here rather than read from a
    // `scaleChange` field, which is not present in every gesture-handler
    // version; `scale` is absolute and always available.
    let lastScale = 1;
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onBegin(() => {
        lastScale = 1;
      })
      .onUpdate((event) => {
        const factor = lastScale > 0 ? event.scale / lastScale : 1;
        lastScale = event.scale;
        if (!Number.isFinite(factor) || factor <= 0) return;

        if (inCueView()) {
          adjustEye(0, -(factor - 1) * EYE_BACK_PER_SCALE);
        } else {
          // Spreading the fingers should bring the camera closer, which means a
          // smaller distance multiplier.
          zoomRig(1 / factor);
        }
      });

    /**
     * Tapping the music player.
     *
     * The device projects its own screen position every frame, so this is a
     * distance check in pixels rather than a raycast — which would have to fight
     * the pan gesture for the same touch.
     */
    const tap = Gesture.Tap()
      .runOnJS(true)
      /*
       * A tap is a touch that does not move. Four points, not fourteen.
       *
       * Fourteen was generous enough to cover a drag: the pan starts at two, so
       * anything between two and fourteen satisfied both, and the tap — being
       * the simpler gesture — resolved first and consumed the touch. Every
       * attempt to aim was delivered as a tap on the table.
       *
       * Four is still forgiving of the wobble in a real finger press while
       * leaving the whole of a deliberate drag to the pan.
       */
      .maxDistance(4)
      .onEnd((event, success) => {
        if (!success || !musicDeviceScreen.onScreen) return;
        const dx = event.x - musicDeviceScreen.x;
        const dy = event.y - musicDeviceScreen.y;
        if (Math.hypot(dx, dy) > DEVICE_TAP_RADIUS) return;
        // Light it up first: the panel slides in over the next few frames, and
        // the flash is what connects it to the thing that was touched.
        flashMusicDevice();
        useMusic.getState().openHud();
      });

    /*
     * Pinch beside the drag, not ahead of it. The tap after both.
     *
     * `Exclusive` builds its `requireToFail` list cumulatively: every gesture
     * waits for *all* the ones listed before it. So `Exclusive(pinch, drag,
     * tap)` made the drag wait on the pinch — and a pinch given one finger does
     * not fail, it sits waiting for the second. The single-finger drag was
     * blocked at the moment it began while two fingers worked perfectly, which
     * is exactly backwards from what the table needs.
     *
     * Nothing was keeping two fingers from reading as a drag except that
     * ordering, and nothing needed to: `maxPointers(1)` on the pan already
     * refuses a second finger. `Simultaneous` lets each recogniser judge the
     * touch on its own terms.
     *
     * The tap stays exclusive and last. It is the one real conflict — a still
     * finger and the first stirrings of a drag look alike — and `maxDistance(4)`
     * is what keeps it to genuinely stationary presses.
     */
    return Gesture.Exclusive(Gesture.Simultaneous(pinch, drag), tap);
  }, []);
}
