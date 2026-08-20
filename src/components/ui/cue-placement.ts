/**
 * Where the cues lie on the menu's table.
 *
 * The backdrop used to draw one cue at a fixed transform, chosen by eye against
 * the four scattered balls that used to be the only thing on the cloth. Now the
 * balls come from the game in progress, so that fixed pose lands wherever the
 * frame happens to have left them — through the pack as often as not.
 *
 * So the pose is searched for instead of written down. Every candidate is tested
 * against the balls, against the rails, and against the cues already placed; the
 * first that clears everything is taken. If nothing clears, the cue is not drawn
 * — a table with no cue on it reads as tidy, and a cue lying through the eight
 * ball reads as broken.
 *
 * Everything here is in solver space: `x` along the table's length, `y` across
 * its width, the same as the physics. The scene conversion happens where the
 * mesh is placed.
 */

import { BALL_RADIUS } from '@/game/core/constants';
import type { Table } from '@/game/core/table';
import { closestPointOnSegment, type Vec2 } from '@/game/core/vec';
import type { BallLayout } from '@/game/core/world';

/** Tip to bumper. The lathe is built to this length. */
export const CUE_LENGTH = 1.45;

/** Half the thickest part, at the butt. */
const CUE_RADIUS = 0.0134;

/**
 * How much air to leave around a cue.
 *
 * Generous, and on purpose: the ask is that it not sit *near* a ball either, and
 * a cue a millimetre clear of the pack still reads as resting on it from a
 * camera three metres away. At 4cm there is visible cloth on both sides.
 */
const BALL_CLEARANCE = 0.04;

/**
 * How far the ends stay off the cushions.
 *
 * A real cue laid on a table can overhang a rail, but the backdrop draws the
 * cushions as solid walls the cue would visibly intersect, so both ends stay
 * inside the playing area with room to spare.
 */
const RAIL_CLEARANCE = 0.05;

/** Cue-to-cue spacing, measured centre line to centre line. */
const CUE_SPACING = 0.075;

export interface CuePose {
  /** Centre of the cue, on the cloth. */
  centre: Vec2;
  /** Heading in solver space: 0 points along +x, the table's length. */
  angle: number;
}

/**
 * Distance between two line segments, or zero if they cross.
 *
 * Used for cue against cue. Four point-to-segment tests catch every case where
 * the segments do not intersect, and the crossing case is caught separately by
 * the orientation test — without it, two cues laid in an X would each measure as
 * far from the other's endpoints and both would be accepted.
 */
function segmentDistance(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): number {
  if (segmentsCross(a1, a2, b1, b2)) return 0;

  const candidates = [
    distanceToSegment(a1, b1, b2),
    distanceToSegment(a2, b1, b2),
    distanceToSegment(b1, a1, a2),
    distanceToSegment(b2, a1, a2),
  ];
  return Math.min(...candidates);
}

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const closest = closestPointOnSegment(p, a, b);
  return Math.hypot(p.x - closest.x, p.y - closest.y);
}

function cross(o: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function segmentsCross(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function endpoints(pose: CuePose): [Vec2, Vec2] {
  const half = CUE_LENGTH / 2;
  const dx = Math.cos(pose.angle) * half;
  const dy = Math.sin(pose.angle) * half;
  return [
    { x: pose.centre.x - dx, y: pose.centre.y - dy },
    { x: pose.centre.x + dx, y: pose.centre.y + dy },
  ];
}

/**
 * Whether a pose is clear of everything.
 *
 * The cue is treated as a capsule — a segment with a radius — which is what it
 * is, and what makes every test a distance comparison rather than a polygon
 * intersection.
 */
function isClear(pose: CuePose, table: Table, balls: BallLayout[], placed: CuePose[]): boolean {
  const [tip, butt] = endpoints(pose);

  // Inside the rails, both ends. The cue is straight, so if both ends are in the
  // rectangle then so is everything between them.
  const limitX = table.halfLength - RAIL_CLEARANCE - CUE_RADIUS;
  const limitY = table.halfWidth - RAIL_CLEARANCE - CUE_RADIUS;
  for (const end of [tip, butt]) {
    if (Math.abs(end.x) > limitX || Math.abs(end.y) > limitY) return false;
  }

  const ballGap = BALL_RADIUS + CUE_RADIUS + BALL_CLEARANCE;
  for (const ball of balls) {
    if (distanceToSegment({ x: ball.x, y: ball.y }, tip, butt) < ballGap) return false;
  }

  for (const other of placed) {
    const [otherTip, otherButt] = endpoints(other);
    if (segmentDistance(tip, butt, otherTip, otherButt) < CUE_SPACING) return false;
  }

  return true;
}

/**
 * Poses to try, in the order they should be preferred.
 *
 * Roughly along the table's length rather than across it: at 1.45m a cue does
 * not fit across a 1.27m bed at all, so only shallow angles have any chance, and
 * putting them first means the search usually ends on its first few tries.
 *
 * Generated rather than listed because the balls move: a handful of hand-picked
 * poses works until the frame that fills one of them, and the whole point here
 * is to survive any arrangement the game can leave behind.
 */
function* candidates(table: Table): Generator<CuePose> {
  const angles = [0, 0.12, -0.12, 0.24, -0.24, 0.36, -0.36];
  // Down the sides first: that is where a cue gets put down, and it is where the
  // balls least often are.
  const lanes = [0.44, -0.44, 0.52, -0.52, 0.34, -0.34, 0.24, -0.24, 0.12, -0.12, 0];
  const shifts = [0, 0.18, -0.18, 0.36, -0.36, 0.54, -0.54];

  for (const lane of lanes) {
    if (Math.abs(lane) > table.halfWidth) continue;
    for (const angle of angles) {
      for (const shift of shifts) {
        yield { centre: { x: shift, y: lane }, angle };
      }
    }
  }
}

/**
 * One pose per player, or fewer if the table is too crowded to fit them.
 *
 * Returning fewer is a real outcome, not a failure: with fifteen balls spread
 * about there may genuinely be nowhere to lay a fourth cue, and drawing it
 * anyway is the thing being fixed.
 */
export function placeCues(
  count: number,
  table: Table,
  balls: BallLayout[],
): CuePose[] {
  const placed: CuePose[] = [];

  for (let i = 0; i < count; i++) {
    let found: CuePose | null = null;
    for (const pose of candidates(table)) {
      if (isClear(pose, table, balls, placed)) {
        found = pose;
        break;
      }
    }
    // Nowhere left. Later cues would only search the same exhausted space, so
    // stopping here saves the work and returns the same answer.
    if (!found) break;
    placed.push(found);
  }

  return placed;
}
