/**
 * Ball state. Deliberately a plain data object with no methods: the whole
 * point of the core layer is that game state is JSON, so saving a game is
 * `JSON.stringify` and nothing more.
 */

import type { PocketId } from './table';
import type { Vec2, Vec3 } from './vec';

export const BallKind = {
  CUE: 'cue',
  SOLID: 'solid',
  STRIPE: 'stripe',
  EIGHT: 'eight',
} as const;

export type BallKind = (typeof BallKind)[keyof typeof BallKind];

export interface Ball {
  /** Ball number: 0 is the cue ball, 1–15 the object balls. Also the id. */
  number: number;
  kind: BallKind;
  /** Centre position on the cloth plane. */
  p: Vec2;
  v: Vec2;
  /**
   * Angular velocity, rad/s. `x` and `y` are the rolling axes; `z` is english.
   *
   * Rolling without slipping means `v.x = radius * w.y` and `v.y = -radius * w.x`
   * — the solver drives the ball towards that state and holds it there.
   */
  w: Vec3;
  pocketed: boolean;
  /** Which pocket swallowed it, for rules that care about placement. */
  pocketedIn: PocketId | null;
}

export function ballKindFor(n: number): BallKind {
  if (n === 0) return BallKind.CUE;
  if (n === 8) return BallKind.EIGHT;
  return n < 8 ? BallKind.SOLID : BallKind.STRIPE;
}

export function createBall(n: number, p: Vec2): Ball {
  return {
    number: n,
    kind: ballKindFor(n),
    p: { x: p.x, y: p.y },
    v: { x: 0, y: 0 },
    w: { x: 0, y: 0, z: 0 },
    pocketed: false,
    pocketedIn: null,
  };
}

export function cloneBall(b: Ball): Ball {
  return {
    number: b.number,
    kind: b.kind,
    p: { x: b.p.x, y: b.p.y },
    v: { x: b.v.x, y: b.v.y },
    // Older saves predate spin, so a missing value has to mean "no spin"
    // rather than a crash.
    w: b.w ? { x: b.w.x, y: b.w.y, z: b.w.z } : { x: 0, y: 0, z: 0 },
    pocketed: b.pocketed,
    pocketedIn: b.pocketedIn,
  };
}

/**
 * Base colour per ball number. Stripes reuse the solid colour of `n - 8`; the
 * renderer draws the white band as geometry, so one colour per ball is enough
 * and we avoid needing 16 textures to get on screen.
 */
export const BALL_COLORS: Record<number, string> = {
  0: '#f7f4ec',
  1: '#f2c200',
  2: '#1f4fd8',
  3: '#d81f2a',
  4: '#5b2a8c',
  5: '#e8701f',
  6: '#0f8a3c',
  7: '#8c2a2a',
  8: '#141414',
  9: '#f2c200',
  10: '#1f4fd8',
  11: '#d81f2a',
  12: '#5b2a8c',
  13: '#e8701f',
  14: '#0f8a3c',
  15: '#8c2a2a',
};

export function colorForBall(n: number): string {
  return BALL_COLORS[n] ?? '#cccccc';
}
