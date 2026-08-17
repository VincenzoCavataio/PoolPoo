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
  };
  if (!cue || cue.pocketed) return empty;

  const origin = cue.p;
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
    const disc = b * b - c;
    if (disc < 0) continue;

    const t = -b - Math.sqrt(disc);
    if (t > 1e-6 && t < bestT) {
      bestT = t;
      hitBall = ball.number;
      hitCushion = null;
    }
  }

  // Cue ball centre versus each cushion, offset a radius towards the ball.
  world.table.cushions.forEach((seg, index) => {
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

  const cueStop = { x: origin.x + dir.x * bestT, y: origin.y + dir.y * bestT };

  let targetDirection: Vec2 | null = null;
  if (hitBall !== null) {
    const target = world.ballByNumber(hitBall);
    if (target) {
      targetDirection = normalize({ x: target.p.x - cueStop.x, y: target.p.y - cueStop.y });
    }
  }

  return { cueStop, distance: bestT, targetBall: hitBall, targetDirection, cushion: hitCushion };
}
