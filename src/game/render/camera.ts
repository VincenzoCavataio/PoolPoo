/**
 * Camera rig state.
 *
 * Mutable module state rather than React state, for the same reason the physics
 * accumulator is: these values change on every touch move and every frame, and
 * no component needs to re-render when they do. The rig is read inside
 * `useFrame` and written by the gestures.
 *
 * Which of the two views is active is *not* here — it belongs to the session,
 * because the game drives it: aiming puts you behind the cue, taking the shot
 * lifts you up to watch it, and settling drops you back down.
 */

export const CameraMode = {
  /** Overhead view of the whole table; orbit and zoom from there. */
  TABLE: 'table',
  /** Down the cue, behind the ball. The only view you may shoot from. */
  CUE: 'cue',
} as const;

export type CameraMode = (typeof CameraMode)[keyof typeof CameraMode];

export const CAMERA_MODE_LABEL: Record<CameraMode, string> = {
  table: 'Tavolo',
  cue: 'Prima persona',
};

export interface CameraRigState {
  /** Rotation around the table's vertical axis, radians. */
  azimuth: number;
  /** Angle up from the cloth plane, radians. */
  elevation: number;
  /** Multiplier on the fitted viewing distance. */
  zoom: number;
  /** Cue view: camera height above the cloth, metres. */
  eyeHeight: number;
  /** Cue view: how far behind the cue ball, metres. */
  eyeBack: number;
}

const DEFAULT_TILT = 0.5;

const DEFAULTS: CameraRigState = {
  azimuth: 0,
  elevation: Math.PI / 2 - DEFAULT_TILT,
  zoom: 1,
  eyeHeight: 0.2,
  eyeBack: 0.42,
};

const LIMITS = {
  // Stops short of both the cloth plane and straight down: at either extreme
  // `lookAt` loses its up vector and the view rolls.
  elevation: { min: 0.22, max: 1.48 },
  zoom: { min: 0.55, max: 2.0 },
  eyeHeight: { min: 0.08, max: 0.5 },
  eyeBack: { min: 0.2, max: 0.9 },
} as const;

export const rig: CameraRigState = { ...DEFAULTS };

function clamp(value: number, range: { min: number; max: number }): number {
  return Math.min(range.max, Math.max(range.min, value));
}

export function resetRig(): void {
  Object.assign(rig, DEFAULTS);
}

export function orbitRig(deltaAzimuth: number, deltaElevation: number): void {
  rig.azimuth += deltaAzimuth;
  rig.elevation = clamp(rig.elevation + deltaElevation, LIMITS.elevation);
}

export function zoomRig(factor: number): void {
  rig.zoom = clamp(rig.zoom * factor, LIMITS.zoom);
}

export function adjustEye(deltaHeight: number, deltaBack: number): void {
  rig.eyeHeight = clamp(rig.eyeHeight + deltaHeight, LIMITS.eyeHeight);
  rig.eyeBack = clamp(rig.eyeBack + deltaBack, LIMITS.eyeBack);
}

/**
 * Heights of the panels covering the top and bottom of the canvas, in points.
 *
 * The GL surface fills the screen so the scene has no seams, which means the HUD
 * sits over the table and used to hide the near pockets. The camera compensates
 * with `setViewOffset`, framing the table inside the band left free instead of
 * inside the whole viewport. Measured by the panels themselves via `onLayout`,
 * so any change to the HUD's height corrects the framing automatically.
 */
export const uiInsets = { top: 0, bottom: 0 };

export function setUiInset(edge: 'top' | 'bottom', size: number): void {
  uiInsets[edge] = size;
}
