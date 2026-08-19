/**
 * The single place where simulation coordinates become scene coordinates.
 *
 * The solver works in 2D: `x` along the table's length, `y` across its width.
 * three.js is y-up, and the phone is held in portrait, so the table has to run
 * *up* the screen — which means the sim's long axis maps to the scene's depth
 * axis and the two horizontal axes swap:
 *
 *     sim  ( x , y )  →  scene ( y , ballHeight , -x )
 *
 * The negation on `x` puts the head spot nearest the camera, so the player
 * shoots away from themselves. Every conversion goes through here; doing it
 * ad hoc in each component is how sign errors get in.
 */

import { BALL_RADIUS } from '../core/constants';
import type { Vec2, Vec3 } from '../core/vec';

/** Height of a ball centre above the cloth. */
export const BALL_HEIGHT = BALL_RADIUS;

/** Cloth surface sits at scene y = 0. */
export const CLOTH_Y = 0;

/**
 * How deep the pockets are cut below the cloth. Shared by the table geometry
 * and by the balls, which come to rest on the cavity floor once potted.
 */
export const POCKET_DEPTH = 0.11;

export function sceneX(p: Vec2): number {
  return p.y;
}

export function sceneZ(p: Vec2): number {
  return -p.x;
}

export function toScene(p: Vec2, height = BALL_HEIGHT): [number, number, number] {
  return [p.y, height, -p.x];
}

/**
 * A sim aim angle as a rotation about the scene's y axis.
 *
 * A sim direction `(cos a, sin a)` maps to the scene direction
 * `(sin a, -cos a)`, and a y rotation of θ sends local +z to
 * `(sin θ, cos θ)` — so θ is the atan2 of that mapped pair.
 */
export function sceneHeading(angle: number): number {
  return Math.atan2(Math.sin(angle), -Math.cos(angle));
}

/**
 * How a ball is actually turning, taken from its own angular velocity.
 *
 * These used to be derived from the ball's *velocity*, on the assumption that it
 * rolls without slipping. That assumption stopped being true the moment spin was
 * added to the solver, and the result was the single most confusing thing on
 * screen: a ball struck with heavy draw would slide backwards across the cloth
 * while being drawn rolling forwards, and a ball spinning at 237 rad/s was drawn
 * turning at ten. The motion looked like it sped up and slowed down for no
 * reason, because what you could see and what the ball was doing had come apart.
 *
 * The solver already tracks the truth in `w`, so the renderer reads that instead
 * of guessing. Sim `w` is `(wx, wy, wz)` about the sim axes; the scene swaps
 * them to `(wy, wz, -wx)` — the same mapping the positions use.
 *
 * The axis mapping is pinned to the version this replaced, which was correct for
 * a rolling ball: it produced `(-vx, 0, -vy)`, and natural roll means
 * `vx = R·w.y` and `vy = -R·w.x`, so the axis is `(-w.y, 0, w.x)`. Extending it
 * to english — spin about the vertical axis — adds `w.z` as the scene's up.
 *
 * Returned as an axis plus a scalar so the caller can build a quaternion without
 * allocating one per ball per frame.
 */
export function spinAxis(w: Vec3): [number, number, number] {
  const x = -w.y;
  const y = w.z;
  const z = w.x;
  const rate = Math.hypot(x, y, z);
  if (rate === 0) return [0, 0, 0];
  return [x / rate, y / rate, z / rate];
}

export function spinRate(w: Vec3): number {
  return Math.hypot(w.x, w.y, w.z);
}

/**
 * Size of a spot, as how far the surface normal may fall from an axis.
 *
 * Not a linear radius: the shader compares this against the largest component of
 * the ball's own normal, so the value is a cosine threshold and the spot it
 * produces is much wider than the number suggests. At 0.2 each spot came out
 * 34 mm across on a 57 mm ball — over half the ball, and twelve of the twenty
 * pixels the ball occupies in the table view.
 *
 * 0.012 puts them at roughly 9 mm: about three pixels from the table view and
 * twenty in the cue view, which is small enough to read as a marked ball rather
 * than a patterned one while still turning visibly.
 */
export const SPOT_RADIUS = 0.012;
