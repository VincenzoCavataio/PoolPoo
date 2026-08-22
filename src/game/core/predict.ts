/**
 * Aim prediction for the on-screen guide line.
 *
 * Solved analytically instead of by running the simulation, because the guide
 * updates while the player drags and a full simulation per frame would be
 * wasted work. It answers the one question the guide needs: what does the cue
 * ball meet first, and where would the struck ball go?
 */

import { BALL_DIAMETER, BALL_RADIUS } from './constants';
import { fromAngle, normalize, type Vec2 } from './vec';
import type { World } from './world';

/** One straight run of the cue ball, between two events. */
export interface AimLeg {
  /** Where the run starts. */
  from: Vec2;
  /** Where it ends — at a cushion, a ball, or the end of the guide's reach. */
  to: Vec2;
}

export interface AimPrediction {
  /** Cue ball centre at the moment of first contact (the "ghost ball"). */
  cueStop: Vec2;
  /** Distance travelled to that contact. */
  distance: number;
  /** First object ball struck, or null if the cue ball reaches a rail first. */
  targetBall: number | null;
  /** Direction the struck ball departs in, for a centre-ball hit. */
  targetDirection: Vec2 | null;
  /** Cushion index when a rail comes first. */
  cushion: number | null;
  /**
   * The cue ball's path, as one run per straight stretch.
   *
   * One entry when the shot meets a ball or simply runs out of reach; more when
   * it bounces, each starting where the last one ended. The first is always the
   * stretch leaving the cue ball, so a caller that only wants the old behaviour
   * can read `legs[0]` and ignore the rest.
   */
  legs: AimLeg[];
}

/** What the cue ball meets first from a given point and heading. */
interface FirstContact {
  /** How far it travels before meeting it. */
  t: number;
  /** The object ball struck, if one comes first. */
  ball: number | null;
  /** The cushion reached, if one comes first. */
  cushion: number | null;
}

/**
 * How many cushions the guide will follow the cue ball around.
 *
 * Three is enough to show the shape of a bank shot without the line becoming a
 * prediction nobody should trust: every bounce compounds the error in the one
 * before it, and a guide that draws six is claiming an accuracy the physics
 * behind it does not have. The run also stops at the first ball it meets, so on
 * a full table it rarely reaches this at all.
 */
const MAX_BOUNCES = 3;

/**
 * What the cue ball meets first, travelling from `origin` along `dir`.
 *
 * Pulled out of `predictAim` so a bounced run can ask the same question again
 * from the new heading. `skipCushion` is the rail just left: without it the
 * search finds that same rail at a distance of zero and the path stops dead on
 * the bounce it has only just made.
 */
function firstContact(
  world: World,
  origin: Vec2,
  dir: Vec2,
  maxDistance: number,
  skipCushion: number | null,
): FirstContact {
  let bestT = maxDistance;
  let hitBall: number | null = null;
  let hitCushion: number | null = null;

  // Cue ball centre versus each object ball centre, at a diameter's separation.
  for (const ball of world.balls) {
    if (ball.pocketed || ball.number === 0) continue;

    const mx = origin.x - ball.p.x;
    const my = origin.y - ball.p.y;
    const b = mx * dir.x + my * dir.y;
    const c = mx * mx + my * my - BALL_DIAMETER * BALL_DIAMETER;

    /*
     * `b >= 0` means the shot is travelling *away* from this ball, and it has to
     * be rejected before anything else. Filtering on the root alone was the bug
     * behind the guide going wrong with a ball frozen against the cue ball: at
     * touching distance the quadratic has a root near zero whichever way you aim,
     * so a ball sitting beside the cue ball was reported as the first contact
     * even when the shot pointed the other way.
     */
    if (b >= 0) continue;

    const disc = b * b - c;
    if (disc < 0) continue;

    // A ball already touching gives a negative root: contact is immediate.
    const t = Math.max(0, -b - Math.sqrt(disc));
    if (t < bestT) {
      bestT = t;
      hitBall = ball.number;
      hitCushion = null;
    }
  }

  // Cue ball centre versus each cushion, offset a radius towards the ball.
  world.table.cushions.forEach((seg, index) => {
    if (index === skipCushion) return;

    const abx = seg.b.x - seg.a.x;
    const aby = seg.b.y - seg.a.y;
    const l2 = abx * abx + aby * aby;
    if (l2 === 0) return;

    const inv = 1 / Math.sqrt(l2);
    const nx = -aby * inv;
    const ny = abx * inv;

    const relX = origin.x - seg.a.x;
    const relY = origin.y - seg.a.y;
    const sideDistance = relX * nx + relY * ny;
    const approach = dir.x * nx + dir.y * ny;
    if (approach === 0) return;

    // Keep the offset on whichever side the cue ball currently sits.
    const offset = sideDistance >= 0 ? BALL_RADIUS : -BALL_RADIUS;
    const t = (offset - sideDistance) / approach;
    if (t <= 1e-6 || t >= bestT) return;

    // Only the flat face counts here; a ball heading for a jaw is left to the
    // solver rather than approximated in the guide.
    const px = origin.x + dir.x * t;
    const py = origin.y + dir.y * t;
    const along = ((px - seg.a.x) * abx + (py - seg.a.y) * aby) / l2;
    if (along < 0 || along > 1) return;

    bestT = t;
    hitCushion = index;
    hitBall = null;
  });

  return { t: bestT, ball: hitBall, cushion: hitCushion };
}

/** The unit normal of a cushion segment. */
function cushionNormal(seg: { a: Vec2; b: Vec2 }): Vec2 {
  const abx = seg.b.x - seg.a.x;
  const aby = seg.b.y - seg.a.y;
  const inv = 1 / Math.sqrt(abx * abx + aby * aby);
  return { x: -aby * inv, y: abx * inv };
}

export function predictAim(world: World, angle: number, maxDistance = 6): AimPrediction {
  const cue = world.cueBall();
  const dir = fromAngle(angle);

  const empty: AimPrediction = {
    cueStop: cue ? { x: cue.p.x, y: cue.p.y } : { x: 0, y: 0 },
    distance: 0,
    targetBall: null,
    targetDirection: null,
    cushion: null,
    legs: [],
  };
  if (!cue || cue.pocketed) return empty;

  const legs: AimLeg[] = [];
  let from: Vec2 = { x: cue.p.x, y: cue.p.y };
  let heading = dir;
  let lastCushion: number | null = null;

  /*
   * Budgeted across the whole path rather than given to each leg.
   *
   * `maxDistance` is how far ahead the guide is willing to see, and a bounce
   * does not buy the player more of it — otherwise a shot into a nearby rail
   * would draw a longer line than the same shot up the open table.
   */
  let remaining = maxDistance;

  /*
   * The first leg's contact is the shot's answer: the ghost ball sits at its
   * end, and the struck ball departs from it. Later legs are the path after a
   * bounce, which is drawn but has no ghost of its own.
   */
  let firstStop: Vec2 | null = null;
  let firstDistance = 0;
  let hitBall: number | null = null;
  let firstCushion: number | null = null;

  for (let bounce = 0; bounce <= MAX_BOUNCES; bounce++) {
    const contact = firstContact(world, from, heading, remaining, lastCushion);
    const to: Vec2 = {
      x: from.x + heading.x * contact.t,
      y: from.y + heading.y * contact.t,
    };

    legs.push({ from, to });

    if (firstStop === null) {
      firstStop = to;
      firstDistance = contact.t;
      hitBall = contact.ball;
      firstCushion = contact.cushion;
    }

    remaining -= contact.t;

    // A ball ends the path: what happens after that contact is the struck
    // ball's business, and the guide answers it with the target line instead.
    if (contact.ball !== null) break;
    // No cushion means the run simply reached the end of its reach.
    if (contact.cushion === null || remaining <= 1e-6) break;

    /*
     * Reflected about the cushion's normal: the mirror bounce.
     *
     * The real table takes some speed out of a rail and throws the ball a little
     * along it, and side spin changes the angle again. None of that is modelled
     * here — the guide is showing the geometry of the bank, not promising the
     * ball will land on it.
     */
    const n = cushionNormal(world.table.cushions[contact.cushion]);
    const dot = heading.x * n.x + heading.y * n.y;
    heading = { x: heading.x - 2 * dot * n.x, y: heading.y - 2 * dot * n.y };
    from = to;
    lastCushion = contact.cushion;
  }

  const cueStop = firstStop ?? { x: cue.p.x, y: cue.p.y };

  let targetDirection: Vec2 | null = null;
  if (hitBall !== null) {
    const target = world.ballByNumber(hitBall);
    if (target) {
      targetDirection = normalize({ x: target.p.x - cueStop.x, y: target.p.y - cueStop.y });
    }
  }

  return {
    cueStop,
    distance: firstDistance,
    targetBall: hitBall,
    targetDirection,
    cushion: firstCushion,
    legs,
  };
}
