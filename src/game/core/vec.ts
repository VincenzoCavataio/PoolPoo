/**
 * Minimal 2D vector maths for the simulation.
 *
 * The table is simulated in 2D on the cloth plane: `x` runs along the length,
 * `y` across the width. The renderer maps this to 3D by lifting every ball to
 * the ball radius. Everything here is allocation-light and side-effect free
 * unless the name says otherwise (`*Mut`).
 */

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Only used for angular velocity. The balls themselves stay on the cloth, but
 * their spin does not: `x` and `y` are the rolling axes and `z` is english.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function vec(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function cloneVec(a: Vec2): Vec2 {
  return { x: a.x, y: a.y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

/** `a + b * s`, the workhorse of the integrator. */
export function addScaled(a: Vec2, b: Vec2, s: number): Vec2 {
  return { x: a.x + b.x * s, y: a.y + b.y * s };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function len2(a: Vec2): number {
  return a.x * a.x + a.y * a.y;
}

export function len(a: Vec2): number {
  return Math.sqrt(a.x * a.x + a.y * a.y);
}

export function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt(dist2(a, b));
}

/** Unit vector, or the zero vector when `a` has no length. */
export function normalize(a: Vec2): Vec2 {
  const l = len(a);
  return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

/** Rotated 90° counter-clockwise. */
export function perp(a: Vec2): Vec2 {
  return { x: -a.y, y: a.x };
}

export function fromAngle(angle: number, length = 1): Vec2 {
  return { x: Math.cos(angle) * length, y: Math.sin(angle) * length };
}

export function angleOf(a: Vec2): number {
  return Math.atan2(a.y, a.x);
}

/** Closest point to `p` on the segment `a`→`b`. */
export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  if (l2 === 0) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { x: a.x + abx * t, y: a.y + aby * t };
}
