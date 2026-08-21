/**
 * Table geometry: cushions as line segments, pockets as circles.
 *
 * Cushions are segments rather than infinite walls so the gaps at the pocket
 * mouths exist for free, and so the segment ends act as pocket jaws — a ball
 * clipping a jaw rattles off the rounded end instead of passing through an
 * invisible wall.
 */

import { BALL_RADIUS } from './constants';
import type { Vec2 } from './vec';

export interface Segment {
  a: Vec2;
  b: Vec2;
}

export interface Pocket {
  id: PocketId;
  center: Vec2;
  radius: number;
}

export type PocketId =
  | 'corner-nw'
  | 'corner-ne'
  | 'corner-sw'
  | 'corner-se'
  | 'side-n'
  | 'side-s';

/**
 * Something standing on the floor that a ball knocked off the table can hit.
 *
 * Axis-aligned boxes in the sim plane, with a height. That is a crude shape for
 * a bookcase, but a ball only ever meets these from the side while rolling
 * along the carpet, so the footprint is the part that matters and a box gets it
 * right for every piece of furniture in the room.
 */
export interface Obstacle {
  /** Centre on the floor, in sim coordinates. */
  x: number;
  y: number;
  /** Half-extents of the footprint. */
  halfX: number;
  halfY: number;
  /** How far up from the floor it blocks, so a ball can drop onto low things. */
  height: number;
  /** How lively it is when struck. Glass and metal ring; upholstery does not. */
  restitution: number;
}

export interface Table {
  /** Half the playing length, along `x`. */
  halfLength: number;
  /** Half the playing width, along `y`. */
  halfWidth: number;
  cushions: Segment[];
  pockets: Pocket[];
  /**
   * Furniture on the floor around the table. Empty for a bare table; the render
   * layer fills it in from whichever room is being played in, because the room
   * is what decides where the furniture stands.
   */
  obstacles: Obstacle[];
}

/** 9-foot table: 2.54 m × 1.27 m of slate, a 2:1 rectangle. */
const HALF_LENGTH = 1.27;
const HALF_WIDTH = 0.635;

/**
 * How far from each corner the cushion stops, leaving the pocket mouth.
 *
 * The jaws sit at `(-hx + gap, -hy)` and `(-hx, -hy + gap)`, so the mouth they
 * leave between them is `gap × √2`. The WPA specification puts a corner pocket
 * mouth at 4.5 to 4.625 inches — 114.3 to 117.5 mm — measured between the tips
 * of the cushion noses, so the middle of that range wants 81.95 mm of gap.
 *
 * It was 0.06, which is a mouth of 84.9 mm: a third narrower than the narrowest
 * legal pocket, and much the largest departure from the specification anywhere
 * on this table. Corner pots were correspondingly harder than they should be.
 */
const CORNER_GAP = 0.08195;

/**
 * Half-width of a side pocket mouth.
 *
 * WPA gives 5 to 5.125 inches, 127 to 130.2 mm, so half of it is 63.5 to 65.1 —
 * this sits at the top of the range and needs no change.
 */
const SIDE_GAP = 0.065;

/**
 * How close a ball's centre must come to be captured.
 *
 * Not the mouth: the mouth is the gap between the cushion noses above, while
 * this is the radius of the hole behind it. A ball whose centre reaches inside
 * this has passed the point where the slate stops supporting it.
 */
const CORNER_POCKET_RADIUS = 0.062;
const SIDE_POCKET_RADIUS = 0.065;

export function createTable(): Table {
  const hx = HALF_LENGTH;
  const hy = HALF_WIDTH;

  const cushions: Segment[] = [
    // Long rails, each split in two by the side pocket at x = 0.
    { a: { x: -hx + CORNER_GAP, y: -hy }, b: { x: -SIDE_GAP, y: -hy } },
    { a: { x: SIDE_GAP, y: -hy }, b: { x: hx - CORNER_GAP, y: -hy } },
    { a: { x: -hx + CORNER_GAP, y: hy }, b: { x: -SIDE_GAP, y: hy } },
    { a: { x: SIDE_GAP, y: hy }, b: { x: hx - CORNER_GAP, y: hy } },
    // Short rails, uninterrupted.
    { a: { x: -hx, y: -hy + CORNER_GAP }, b: { x: -hx, y: hy - CORNER_GAP } },
    { a: { x: hx, y: -hy + CORNER_GAP }, b: { x: hx, y: hy - CORNER_GAP } },
  ];

  const pockets: Pocket[] = [
    { id: 'corner-sw', center: { x: -hx, y: -hy }, radius: CORNER_POCKET_RADIUS },
    { id: 'corner-se', center: { x: hx, y: -hy }, radius: CORNER_POCKET_RADIUS },
    { id: 'corner-nw', center: { x: -hx, y: hy }, radius: CORNER_POCKET_RADIUS },
    { id: 'corner-ne', center: { x: hx, y: hy }, radius: CORNER_POCKET_RADIUS },
    { id: 'side-s', center: { x: 0, y: -hy }, radius: SIDE_POCKET_RADIUS },
    { id: 'side-n', center: { x: 0, y: hy }, radius: SIDE_POCKET_RADIUS },
  ];

  return { halfLength: hx, halfWidth: hy, cushions, pockets, obstacles: [] };
}

/** Where the cue ball is placed at the start and after being pocketed. */
export function headSpot(table: Table): Vec2 {
  return { x: -table.halfLength / 2, y: 0 };
}

/** Apex of the rack, mirrored from the head spot. */
export function footSpot(table: Table): Vec2 {
  return { x: table.halfLength / 2, y: 0 };
}

/** Clamps a point to the area a ball centre can legally occupy. */
export function clampToPlayable(table: Table, p: Vec2): Vec2 {
  const maxX = table.halfLength - BALL_RADIUS;
  const maxY = table.halfWidth - BALL_RADIUS;
  return {
    x: Math.min(maxX, Math.max(-maxX, p.x)),
    y: Math.min(maxY, Math.max(-maxY, p.y)),
  };
}
