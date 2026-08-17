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
import type { Vec2 } from '../core/vec';

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
 * Angular velocity for a ball rolling without slipping.
 *
 * From `v = ω × r`, with `r` the vector from the contact point up to the
 * centre, the axis works out to `(-vx, 0, -vy)` in sim components and the rate
 * to `|v| / radius`. Returned as an axis plus a scalar so the caller can build
 * a quaternion without allocating.
 */
export function rollAxis(v: Vec2): [number, number, number] {
  const speed = Math.hypot(v.x, v.y);
  if (speed === 0) return [0, 0, 0];
  return [-v.x / speed, 0, -v.y / speed];
}

export function rollRate(v: Vec2): number {
  return Math.hypot(v.x, v.y) / BALL_RADIUS;
}
