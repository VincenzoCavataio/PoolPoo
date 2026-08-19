/**
 * Touch handling on the table.
 *
 * There is no mode button any more: **what a drag does is decided by the view
 * you are in**, and the view is decided by the game. Behind the cue you are
 * aiming, so the drag aims; from overhead you cannot shoot at all, so the drag
 * moves the camera. While the balls roll or a replay plays, it always moves the
 * camera.
 *
 * In the cue view the two axes are split rather than fought over: sideways aims,
 * up and down raises the eye. They never conflict because aiming only ever reads
 * horizontal movement.
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
import { Phase } from '@/game/rules/types';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const ORBIT_AZIMUTH_PER_PX = 0.007;
const ORBIT_ELEVATION_PER_PX = 0.005;
const EYE_HEIGHT_PER_PX = 0.0011;
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
      // `onChange` rather than `onUpdate`: it reports the delta since the last
      // event, so a drag moves things by how far the finger travelled this
      // frame instead of by its total distance from where it started.
      .onChange((event) => {
        if (inCueView()) {
          const session = useSession.getState();
          session.nudgeAim(event.changeX * useSettings.getState().aimSensitivity);
          adjustEye(-event.changeY * EYE_HEIGHT_PER_PX, 0);
          return;
        }

        orbitRig(-event.changeX * ORBIT_AZIMUTH_PER_PX, -event.changeY * ORBIT_ELEVATION_PER_PX);
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
      .maxDistance(14)
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

    // Exclusive, not simultaneous: a pinch must not also be read as a drag, and
    // a stationary tap must not be read as either.
    return Gesture.Exclusive(pinch, drag, tap);
  }, []);
}

/**
 * Power slider drag. `width` is the measured track width; the value goes
 * straight to the session so the bar and the shot cannot disagree.
 */
export function usePowerGesture(width: number) {
  return useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((event) => {
          if (width > 0) useSession.getState().setPower(event.x / width);
        })
        .onUpdate((event) => {
          if (width > 0) useSession.getState().setPower(event.x / width);
        }),
    [width],
  );
}
