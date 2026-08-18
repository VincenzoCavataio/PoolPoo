/**
 * Physics core test suite. `npm run test:core`
 *
 * These assert the four properties the rest of the game leans on: shots always
 * terminate, balls never pass through each other or through a rail, collisions
 * transfer momentum the way pool balls do, and identical input produces
 * identical output.
 */

import {
  BALL_DIAMETER,
  BALL_RADIUS,
  CUSHION_NOSE_HEIGHT,
  DEFAULT_PROFILE,
  PHYSICS,
} from '../constants';
import type { Ball } from '../ball';
import { firstBallHitByCue, pocketedNumbers, type ShotEvent } from '../events';
import { predictAim } from '../predict';
import { createTable, headSpot } from '../table';
import { obstaclesFor } from '../../render/locations';
import { add, angleOf, normalize, scale, sub } from '../vec';
import { NO_SPIN, World } from '../world';
import { createFreeState, resolveFreeShot } from '../../rules/free';
import { assert, assertClose, assertEqual, report, suite, test } from './harness';

const MAX_TICKS = Math.ceil(PHYSICS.maxShotSeconds / PHYSICS.fixedDt);

/** Runs a shot tick by tick and reports how long it took to settle. */
function runShot(world: World): { ticks: number; settled: boolean } {
  let ticks = 0;
  while (!world.atRest && ticks < MAX_TICKS) {
    world.step(PHYSICS.fixedDt);
    ticks += 1;
  }
  const settled = ticks < MAX_TICKS;
  world.settle();
  return { ticks, settled };
}

/** Steps until `predicate` sees the event log satisfied, or the shot ends. */
function stepUntil(world: World, predicate: (events: ShotEvent[]) => boolean): boolean {
  for (let i = 0; i < MAX_TICKS; i++) {
    world.step(PHYSICS.fixedDt);
    if (predicate(world.events)) return true;
    if (world.atRest) return false;
  }
  return false;
}

function worstOverlap(world: World): number {
  let worst = 0;
  const active = world.balls.filter((b) => !b.pocketed);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const d = Math.hypot(active[i].p.x - active[j].p.x, active[i].p.y - active[j].p.y);
      worst = Math.max(worst, BALL_DIAMETER - d);
    }
  }
  return worst;
}

function escapedBalls(world: World): number[] {
  const { halfLength, halfWidth } = world.table;
  return world.balls
    .filter((b) => !b.pocketed)
    .filter((b) => Math.abs(b.p.x) > halfLength + 0.02 || Math.abs(b.p.y) > halfWidth + 0.02)
    .map((b) => b.number);
}

suite('table and rack', () => {
  test('rack holds a cue ball and 15 object balls', () => {
    const world = World.rack();
    assertEqual(world.balls.length, 16, 'ball count');
    assertEqual(world.remainingObjectBalls().length, 15, 'object ball count');
    assert(world.cueBall() !== undefined, 'cue ball present');
  });

  test('racked balls do not overlap and sit on the table', () => {
    const world = World.rack();
    assert(worstOverlap(world) <= 0, `rack overlaps by ${worstOverlap(world)} m`);
    assertEqual(escapedBalls(world).length, 0, 'balls off the table');
  });

  test('the 8 ball sits in the middle of the third row', () => {
    const world = World.rack();
    const eight = world.ballByNumber(8);
    assert(eight !== undefined, '8 ball present');
    assertClose(eight!.p.y, 0, 1e-9, '8 ball y');
  });
});

suite('friction and termination', () => {
  test('a full-power break comes to rest well inside the time cap', () => {
    const world = World.rack();
    world.shoot(0, 1);
    const { ticks, settled } = runShot(world);
    assert(settled, `break did not settle within ${PHYSICS.maxShotSeconds}s`);
    console.log(`      settled in ${(ticks * PHYSICS.fixedDt).toFixed(2)}s`);
  });

  test('a centre-ball roll matches the two-phase stopping distance', () => {
    const table = createTable();
    // Alone on the table, and slow enough to stop before the far rail, so the
    // measurement is friction and nothing else.
    const world = World.fromLayout([{ number: 0, x: -1.0, y: 0.3 }], table);
    world.shoot(0, 0.2);
    const start = world.cueBall()!.p.x;
    runShot(world);
    const travelled = world.cueBall()!.p.x - start;

    // Struck through the centre, the ball slides before it rolls. Sliding ends
    // at exactly five sevenths of the launch speed — the point where the contact
    // patch stops slipping — so the distance is the sum of two phases.
    const g = PHYSICS.gravity;
    const launch = PHYSICS.maxShotSpeed * 0.2;
    const sliding = (3 * launch ** 2) / (12.25 * DEFAULT_PROFILE.slidingFriction * g);
    const rollingStart = (5 / 7) * launch;
    const rolling = rollingStart ** 2 / (2 * DEFAULT_PROFILE.rollingFriction * g);
    const expected = sliding + rolling;

    assertEqual(
      world.events.filter((e) => e.kind === 'cushion-hit').length,
      0,
      'cushion hits during a free roll',
    );
    assertClose(travelled, expected, expected * 0.03, 'stopping distance');
    console.log(
      `      travelled ${travelled.toFixed(3)}m, theory ${expected.toFixed(3)}m ` +
        `(slide ${sliding.toFixed(3)} + roll ${rolling.toFixed(3)})`,
    );
  });

  test('a ball struck at natural roll never slides', () => {
    // 0.4 of a radius above centre is the one contact point that starts a ball
    // rolling immediately, so this shot should skip the sliding phase entirely
    // and travel the pure rolling distance.
    const naturalRoll = 0.4 / PHYSICS.maxTipOffset;
    const world = World.fromLayout([{ number: 0, x: -1.0, y: 0.3 }]);
    world.shoot(0, 0.2, { side: 0, vertical: naturalRoll });

    const start = world.cueBall()!.p.x;
    runShot(world);
    const travelled = world.cueBall()!.p.x - start;

    const launch = PHYSICS.maxShotSpeed * 0.2;
    const expected = launch ** 2 / (2 * DEFAULT_PROFILE.rollingFriction * PHYSICS.gravity);
    assertClose(travelled, expected, expected * 0.03, 'natural-roll distance');
    console.log(`      travelled ${travelled.toFixed(3)}m, theory ${expected.toFixed(3)}m`);
  });

  test('zero power leaves the table untouched', () => {
    const world = World.rack();
    const before = world.stateHash();
    world.shoot(0, 0);
    runShot(world);
    assertEqual(world.stateHash(), before, 'state after a zero-power shot');
  });
});

suite('collisions', () => {
  test('a head-on hit transfers nearly all the speed', () => {
    const world = World.fromLayout([
      { number: 0, x: -0.3, y: 0 },
      { number: 3, x: 0.1, y: 0 },
    ]);
    world.shoot(0, 0.3);
    const hit = stepUntil(world, (events) => events.some((e) => e.kind === 'ball-hit'));
    assert(hit, 'the balls never touched');

    const cueSpeed = Math.hypot(world.cueBall()!.v.x, world.cueBall()!.v.y);
    const target = world.ballByNumber(3)!;
    const targetSpeed = Math.hypot(target.v.x, target.v.y);

    assert(cueSpeed < 0.12, `cue ball kept ${cueSpeed.toFixed(3)} m/s`);
    assert(targetSpeed > 1.5, `target only got ${targetSpeed.toFixed(3)} m/s`);
    assertClose(target.v.y, 0, 1e-9, 'target sideways drift');
  });

  test('a cushion returns the ball with restitution applied', () => {
    // x = 0.5 keeps clear of the side pocket at x = 0.
    const world = World.fromLayout([{ number: 0, x: 0.5, y: 0 }]);
    world.shoot(Math.PI / 2, 0.3);
    const bounced = stepUntil(world, (events) => events.some((e) => e.kind === 'cushion-hit'));
    assert(bounced, 'the ball never reached the rail');

    const event = world.events.find((e) => e.kind === 'cushion-hit')!;
    const cue = world.cueBall()!;
    assert(cue.v.y < 0, 'ball did not come back off the rail');
    assertClose(cue.v.x, 0, 1e-9, 'sideways velocity after a square hit');
    assertClose(
      Math.abs(cue.v.y) / event.speed,
      DEFAULT_PROFILE.cushionRestitution,
      0.03,
      'cushion restitution',
    );
  });

  test('a break leaves no overlapping balls and none off the table', () => {
    const world = World.rack();
    world.shoot(0, 1);
    runShot(world);
    const overlap = worstOverlap(world);
    assert(overlap < 1e-6, `balls overlap by ${overlap.toExponential(2)} m`);
    assertEqual(escapedBalls(world).join(','), '', 'balls that escaped the table');
  });

  test('point-blank max power does not tunnel through the rack', () => {
    // The nastiest case for a discrete solver: full speed, contact immediately.
    const world = World.rack();
    const apex = world.ballByNumber(1)!;
    world.placeCueBall({ x: apex.p.x - BALL_DIAMETER * 1.05, y: 0 });
    world.shoot(0, 1);
    runShot(world);
    assert(worstOverlap(world) < 1e-6, 'overlap after point-blank break');
    assertEqual(escapedBalls(world).join(','), '', 'balls that escaped the table');
  });
});

suite('spin', () => {
  /**
   * Fires the same straight shot with different tip heights and reports where
   * the cue ball ends up relative to where it made contact. This is the whole
   * point of the sliding phase, so it is measured rather than assumed.
   */
  function cueBallAfterContact(vertical: number): { travelPastContact: number; contactX: number } {
    const world = World.fromLayout([
      { number: 0, x: -0.3, y: 0 },
      { number: 3, x: 0.1, y: 0 },
    ]);
    world.shoot(0, 0.35, { side: 0, vertical });

    const hit = stepUntil(world, (events) => events.some((e) => e.kind === 'ball-hit'));
    if (!hit) throw new Error('the balls never touched');
    const contactX = world.cueBall()!.p.x;

    // Long enough for the spin to have its say, short enough that the object
    // ball cannot come off the far rail and interfere.
    for (let i = 0; i < 96; i++) world.step(PHYSICS.fixedDt);

    return { travelPastContact: world.cueBall()!.p.x - contactX, contactX };
  }

  test('follow, stun and draw send the cue ball three different ways', () => {
    const draw = cueBallAfterContact(-1);
    const stun = cueBallAfterContact(0);
    const follow = cueBallAfterContact(1);

    assert(draw.travelPastContact < -0.02, `draw only moved ${draw.travelPastContact.toFixed(3)} m`);
    assert(
      follow.travelPastContact > 0.05,
      `follow only moved ${follow.travelPastContact.toFixed(3)} m`,
    );
    assert(
      draw.travelPastContact < stun.travelPastContact &&
        stun.travelPastContact < follow.travelPastContact,
      'the three tip heights did not order as draw < stun < follow',
    );

    console.log(
      `      draw ${draw.travelPastContact.toFixed(3)}m, ` +
        `stun ${stun.travelPastContact.toFixed(3)}m, ` +
        `follow ${follow.travelPastContact.toFixed(3)}m`,
    );
  });

  test('backspin alone drags a stationary ball backwards', () => {
    const world = World.fromLayout([{ number: 0, x: 0, y: 0 }]);
    const cue = world.cueBall()!;

    // Sitting still but spinning backwards, exactly the state a draw shot leaves
    // the cue ball in the instant after contact.
    cue.w.y = -50;

    assertEqual(world.atRest, false, 'a slipping ball must not count as at rest');

    for (let i = 0; i < 60; i++) world.step(PHYSICS.fixedDt);
    assert(cue.p.x < -0.01, `the ball did not come back: x = ${cue.p.x.toFixed(4)}`);
  });

  test('a rolling ball keeps its spin locked to its speed', () => {
    const world = World.fromLayout([{ number: 0, x: -1.0, y: 0.2 }]);
    world.shoot(0, 0.3);

    // Well past the sliding phase by now.
    for (let i = 0; i < 120; i++) world.step(PHYSICS.fixedDt);

    const cue = world.cueBall()!;
    assertClose(cue.w.y * BALL_RADIUS, cue.v.x, 1e-6, 'rolling constraint on x');
    assertClose(-cue.w.x * BALL_RADIUS, cue.v.y, 1e-6, 'rolling constraint on y');
  });

  test('english bends the ball off a cushion, and each side bends it the other way', () => {
    function reboundAfterRail(side: number): number {
      // x = 0.5 keeps clear of the side pocket at x = 0.
      const world = World.fromLayout([{ number: 0, x: 0.5, y: 0 }]);
      world.shoot(Math.PI / 2, 0.35, { side, vertical: 0 });
      const bounced = stepUntil(world, (events) => events.some((e) => e.kind === 'cushion-hit'));
      if (!bounced) throw new Error('the ball never reached the rail');
      return world.cueBall()!.v.x;
    }

    const left = reboundAfterRail(-1);
    const right = reboundAfterRail(1);
    const none = reboundAfterRail(0);

    assertClose(none, 0, 1e-9, 'a square hit with no english must come straight back');
    assert(Math.abs(left) > 0.05, `left english barely bent the path: ${left.toFixed(4)}`);
    assert(left * right < 0, 'the two sides did not bend the path opposite ways');

    console.log(`      left ${left.toFixed(3)} m/s, right ${right.toFixed(3)} m/s across the rail`);
  });

  test('spin survives a save and reload', () => {
    const world = World.rack();
    world.shoot(0.1, 0.8, { side: 0.6, vertical: -0.8 });
    for (let i = 0; i < 20; i++) world.step(PHYSICS.fixedDt);

    const resumed = World.deserialize(JSON.parse(JSON.stringify(world.serialize())));
    const before = world.cueBall()!;
    const after = resumed.cueBall()!;

    assertClose(after.w.x, before.w.x, 1e-9, 'spin x');
    assertClose(after.w.y, before.w.y, 1e-9, 'spin y');
    assertClose(after.w.z, before.w.z, 1e-9, 'english');

    // And it has to keep behaving the same way, not merely load the same.
    runShot(world);
    runShot(resumed);
    assertEqual(resumed.stateHash(), world.stateHash(), 'state hash after resuming');
  });
});

suite('pocketing', () => {
  test('a straight-in shot drops the ball in the corner', () => {
    const table = createTable();
    const pocket = { x: table.halfLength, y: table.halfWidth };
    const objectPos = { x: 0.8, y: 0.4 };

    // Put the cue ball on the pocket→ball line, so aiming at the object ball
    // centre is the same as aiming at the ghost ball.
    const away = normalize(sub(objectPos, pocket));
    const cuePos = add(objectPos, scale(away, 0.4));

    const world = World.fromLayout(
      [
        { number: 0, x: cuePos.x, y: cuePos.y },
        { number: 3, x: objectPos.x, y: objectPos.y },
      ],
      table,
    );
    world.shoot(angleOf(sub(objectPos, cuePos)), 0.5);
    runShot(world);

    const three = world.ballByNumber(3)!;
    assert(three.pocketed, 'the 3 ball stayed on the table');
    assertEqual(three.pocketedIn, 'corner-ne', 'pocket');
  });

  test('the cue ball can be pocketed and respotted', () => {
    const table = createTable();
    const world = World.fromLayout([{ number: 0, x: 0.9, y: 0.45 }], table);
    world.shoot(angleOf(sub({ x: table.halfLength, y: table.halfWidth }, { x: 0.9, y: 0.45 })), 0.4);
    runShot(world);

    assert(pocketedNumbers(world.events).includes(0), 'cue ball was not pocketed');

    world.respotCueBall();
    const cue = world.cueBall()!;
    assert(!cue.pocketed, 'cue ball still marked pocketed');
    assertClose(cue.p.x, headSpot(table).x, 1e-9, 'respot x');
  });
});

suite('determinism', () => {
  test('the same break twice lands in the same place', () => {
    const first = World.rack();
    first.shoot(0.12, 1);
    runShot(first);

    const second = World.rack();
    second.shoot(0.12, 1);
    runShot(second);

    assertEqual(first.stateHash(), second.stateHash(), 'state hash across identical breaks');
  });

  test('a serialised world resumes identically', () => {
    const original = World.rack();
    original.shoot(0.3, 0.7);
    runShot(original);

    const resumed = World.deserialize(JSON.parse(JSON.stringify(original.serialize())));
    assertEqual(resumed.stateHash(), original.stateHash(), 'state hash after a round trip');

    original.shoot(-0.4, 0.6);
    runShot(original);
    resumed.shoot(-0.4, 0.6);
    runShot(resumed);
    assertEqual(resumed.stateHash(), original.stateHash(), 'state hash after resuming and shooting');
  });
});

suite('aim prediction', () => {
  test('predicted target matches what the solver actually hits', () => {
    const world = World.rack();
    const prediction = predictAim(world, 0);
    assertEqual(prediction.targetBall, 1, 'predicted first contact');

    world.shoot(0, 0.8);
    runShot(world);
    assertEqual(firstBallHitByCue(world.events), 1, 'actual first contact');
  });

  test('an empty line predicts a cushion, not a ball', () => {
    const world = World.fromLayout([{ number: 0, x: 0.5, y: 0 }]);
    const prediction = predictAim(world, Math.PI / 2);
    assertEqual(prediction.targetBall, null, 'target ball');
    assert(prediction.cushion !== null, 'no cushion predicted');
    assertClose(prediction.distance, world.table.halfWidth - 0.028575, 1e-6, 'distance to the rail');
  });

  test('a ball frozen against the cue ball is only predicted when aimed at', () => {
    // At touching distance the ray-sphere quadratic has a root near zero whatever
    // direction you aim, so filtering on the root alone reported a ball sitting
    // beside the cue ball as the first contact even when the shot pointed away.
    const world = World.fromLayout([
      { number: 0, x: 0, y: 0 },
      { number: 5, x: 0, y: BALL_DIAMETER },
    ]);

    const away = predictAim(world, 0);
    assertEqual(away.targetBall, null, 'aiming along x must not see the ball beside it');
    assert(away.cushion !== null, 'aiming along x should reach a rail');

    const behind = predictAim(world, -Math.PI / 2);
    assertEqual(behind.targetBall, null, 'aiming away from it must not see it either');

    const into = predictAim(world, Math.PI / 2);
    assertEqual(into.targetBall, 5, 'aiming at it must see it');
    assertClose(into.distance, 0, 1e-6, 'contact with a frozen ball is immediate');
  });

  test('prediction agrees with the solver across a fan of angles', () => {
    // A wide fan on purpose: near the middle the cue ball reaches the rack,
    // further out it meets a rail first, so both branches get exercised.
    let ballChecks = 0;
    let cushionChecks = 0;

    for (let i = -12; i <= 12; i++) {
      const angle = (i / 12) * 0.45;
      const world = World.rack();
      const prediction = predictAim(world, angle);

      // Neither branch fires when the line runs into a pocket mouth, where the
      // guide deliberately declines to approximate the jaws.
      if (prediction.targetBall === null && prediction.cushion === null) continue;

      world.shoot(angle, 0.8);
      runShot(world);
      const label = `angle ${angle.toFixed(3)}`;

      if (prediction.targetBall !== null) {
        assertEqual(firstBallHitByCue(world.events), prediction.targetBall, `first contact at ${label}`);
        ballChecks += 1;
      } else {
        // Only the cue ball is moving, so the first event must be its own.
        const first = world.events[0];
        assert(first !== undefined, `no events at ${label}`);
        assertEqual(first.kind, 'cushion-hit', `first event kind at ${label}`);
        assertEqual(
          first.kind === 'cushion-hit' ? first.cushion : -1,
          prediction.cushion,
          `cushion index at ${label}`,
        );
        cushionChecks += 1;
      }
    }

    assert(ballChecks >= 5, `only ${ballChecks} angles reached the rack`);
    assert(cushionChecks >= 5, `only ${cushionChecks} angles reached a rail`);
    console.log(`      cross-checked ${ballChecks} ball contacts and ${cushionChecks} rail contacts`);
  });
});

/**
 * Total energy per unit mass: translation in all three axes, rotation about all
 * three (a sphere's `I = 2/5 mR²`), and height.
 *
 * Height has to be in here now that balls leave the cloth. Counting only the
 * kinetic part would read a ball on its way up as losing energy and the same
 * ball on its way down as gaining it, and the invariant below would be
 * measuring gravity rather than the solver.
 */
function totalEnergy(world: World): number {
  const r2 = BALL_RADIUS * BALL_RADIUS;
  let total = 0;
  for (const b of world.balls) {
    if (b.pocketed) continue;
    total += 0.5 * (b.v.x * b.v.x + b.v.y * b.v.y + b.vz * b.vz);
    total += 0.2 * r2 * (b.w.x * b.w.x + b.w.y * b.w.y + b.w.z * b.w.z);
    total += PHYSICS.gravity * b.z;
  }
  return total;
}

/**
 * A fixed sweep of shots across the shot space. Deterministic on purpose — no
 * RNG, so a failure here is always reproducible from its index alone.
 */
function sweptShot(index: number): World {
  const world = World.rack();
  const angle = -0.35 + (index % 40) * (0.7 / 39);
  const power = 0.3 + Math.floor(index / 40) * 0.07;
  world.shoot(angle, power, {
    side: ((index % 7) - 3) / 3,
    vertical: ((index % 5) - 2) / 2,
  });
  return world;
}

suite('energy', () => {
  /**
   * Nothing in a pool table is a motor.
   *
   * This is the invariant that a previous version of the sliding-friction step
   * broke. It applied a fixed velocity decrement per substep regardless of how
   * much slip was left, and the energy change over such a step works out to
   * `-a·(slip - 1.75a)` — positive once the slip drops below `1.75a`. Balls in
   * a cluster ended up being *pumped* by the cloth, gaining speed out of
   * nothing and drifting for ever because they could not fall below the speed
   * at which a shot is called over.
   */
  test('no shot ever gains energy', () => {
    let worst = 0;
    let worstIndex = -1;

    for (let index = 0; index < 240; index++) {
      const world = sweptShot(index);
      let previous = totalEnergy(world);

      for (let tick = 0; tick < MAX_TICKS && !world.atRest; tick++) {
        world.step(PHYSICS.fixedDt);
        const now = totalEnergy(world);
        // Pocketed balls leave the sum, so energy may only ever fall.
        const gain = now - previous;
        if (gain > worst) {
          worst = gain;
          worstIndex = index;
        }
        previous = now;
      }
    }

    // A tick of the solver is a few thousand floating-point operations, so an
    // exact zero is not on offer; this bound is far below anything visible and
    // several orders under the 1 J/kg the old solver could inject.
    assert(worst < 1e-9, `shot ${worstIndex} gained ${worst.toExponential(3)} J/kg in one tick`);
  });

  test('every shot in the sweep comes to rest', () => {
    for (let index = 0; index < 240; index++) {
      const world = sweptShot(index);
      const { settled, ticks } = runShot(world);
      assert(settled, `shot ${index} was still moving after ${ticks} ticks`);
    }
  });

  /**
   * The regression, pinned down to one ball.
   *
   * The direction of the slip relative to the ball's motion is what matters,
   * and it is why this went unnoticed: a ball whose contact point slips
   * *forwards* (a normal struck ball) always lost energy, so casual testing
   * looked fine. A ball in overspin — contact point slipping backwards, which
   * is what a cluster of balls shoving each other produces — was the one that
   * gained.
   *
   * The mechanism was the snap onto rolling. A full-size friction step carried
   * the slip past zero, the solver noticed and reset the spin to `v/R`, and for
   * an overspinning ball that reset *raised* the spin instead of lowering it.
   * Capping the step so it lands exactly on rolling makes the snap a no-op,
   * which is what it was always meant to be.
   */
  test('the cloth drains a ball whatever way its contact point slips', () => {
    const decel = DEFAULT_PROFILE.slidingFriction * PHYSICS.gravity * PHYSICS.fixedDt;

    for (let degrees = 0; degrees <= 180; degrees += 15) {
      const theta = (degrees * Math.PI) / 180;

      // Right through the old danger band and out the other side of it.
      for (const slip of [0.0085, 0.012, 0.02, 1.75 * decel, 0.04, 0.2]) {
        const world = World.fromLayout([{ number: 0, x: 0, y: 0 }]);
        const cue = world.cueBall()!;
        const speed = 0.65;

        // Solve the spin that gives exactly this slip at exactly this angle,
        // from slip = (v.x - R·w.y, v.y + R·w.x).
        cue.v.x = speed;
        cue.v.y = 0;
        cue.w.y = (speed - slip * Math.cos(theta)) / BALL_RADIUS;
        cue.w.x = (slip * Math.sin(theta)) / BALL_RADIUS;
        cue.w.z = 0;

        const before = totalEnergy(world);
        world.step(PHYSICS.fixedDt);
        const after = totalEnergy(world);

        assert(
          after <= before,
          `slip ${slip.toFixed(4)} m/s at ${degrees}° to the motion gained ` +
            `${(after - before).toExponential(3)} J/kg`,
        );
      }
    }
  });

  /**
   * Friction between two balls cannot reverse the direction they are sliding
   * across each other — at most it brings that sliding to a stop. The cap on
   * the tangential impulse is what enforces that, and it is tighter than the
   * cloth's because both balls take the impulse.
   *
   * Tested with an exaggerated ball friction: the real cloths sit low enough
   * that the normal impulse's own losses hide the defect, which is exactly how
   * it survived unnoticed. Turn the knob up and it shows.
   */
  test('a ball-on-ball contact cannot add energy, even at high friction', () => {
    for (const friction of [0.06, 0.2, 0.5, 1]) {
      const profile = { ...DEFAULT_PROFILE, ballFriction: friction };
      let worst = 0;

      for (let index = 0; index < 60; index++) {
        const world = World.rack(createTable(), profile);
        const angle = -0.3 + (index % 20) * (0.6 / 19);
        world.shoot(angle, 0.45 + Math.floor(index / 20) * 0.2, {
          side: ((index % 5) - 2) / 2,
          vertical: ((index % 3) - 1),
        });

        let previous = totalEnergy(world);
        for (let tick = 0; tick < MAX_TICKS && !world.atRest; tick++) {
          world.step(PHYSICS.fixedDt);
          const now = totalEnergy(world);
          if (now - previous > worst) worst = now - previous;
          previous = now;
        }
      }

      assert(
        worst < 1e-9,
        `ballFriction ${friction} gained ${worst.toExponential(3)} J/kg in one tick`,
      );
    }
  });
});

suite('hops', () => {
  /**
   * The height at which a hop is legible on screen. Roughly a tenth of a ball,
   * with the shadow pulling away underneath it.
   */
  const VISIBLE = 0.003;

  /** Drives a ball into the far rail at `speed` and watches what it does. */
  function intoTheRail(speed: number) {
    const table = createTable();
    const world = World.fromLayout([{ number: 0, x: table.halfLength - 0.3, y: 0 }], table);
    const cue = world.cueBall()!;
    cue.v.x = speed;
    cue.w.y = speed / BALL_RADIUS;

    let apex = 0;
    let firstApex = 0;
    let smallestFlight = Infinity;
    let flightApex = 0;
    let wasAirborne = false;
    let flights = 0;

    for (let i = 0; i < MAX_TICKS && !world.atRest; i++) {
      world.step(PHYSICS.fixedDt);
      const airborne = cue.z > 0;
      if (airborne) {
        if (cue.z > flightApex) flightApex = cue.z;
        if (cue.z > apex) apex = cue.z;
      } else if (wasAirborne) {
        flights++;
        if (flights === 1) firstApex = flightApex;
        if (flightApex < smallestFlight) smallestFlight = flightApex;
        flightApex = 0;
      }
      wasAirborne = airborne;
      if (cue.offTable) break;
    }
    if (flights === 0 && flightApex > 0) firstApex = flightApex;
    return { apex, firstApex, flights, smallestFlight, offTable: cue.offTable };
  }

  test('a firm rail hit throws the ball up where you can see it', () => {
    const { apex, flights } = intoTheRail(3);
    assert(flights > 0, 'a 3 m/s rail hit produced no hop at all');
    assert(
      apex > VISIBLE,
      `the hop peaked at ${(apex * 1000).toFixed(2)}mm, under the ${VISIBLE * 1000}mm ` +
        'it takes to read on screen',
    );
  });

  test('a gentle rail hit keeps the ball on the cloth', () => {
    assert(intoTheRail(0.4).flights === 0, 'a 0.4 m/s rail hit lifted the ball');
  });

  test('a hop grows with the speed into the rail', () => {
    // The apex of the *first* flight. Measuring the tallest is wrong: a fast
    // ball reaches the far rail as well, and that second, slower contact throws
    // it less high than the first one did.
    const heights = [1.5, 3, 4.5].map((v) => intoTheRail(v).firstApex);
    for (let i = 1; i < heights.length; i++) {
      assert(
        heights[i] > heights[i - 1],
        `hop heights did not grow: ${heights.map((h) => (h * 1000).toFixed(1)).join(', ')}mm`,
      );
    }
  });

  /**
   * The regression behind "the physics is broken".
   *
   * A ball off the cloth feels no friction, so it stops decelerating — and that
   * is plainly visible however low it is. An earlier version let rails lift
   * balls by a fraction of a millimetre, far too little to see, and the result
   * was a ball that looked like it was rolling along the cloth while refusing to
   * slow down. Every flight has to be tall enough to explain itself.
   */
  test('a ball is never invisibly airborne', () => {
    for (const speed of [0.3, 0.6, 1, 1.5, 2, 3, 4, 5, 6.5]) {
      const { flights, smallestFlight } = intoTheRail(speed);
      if (flights === 0) continue;
      assert(
        smallestFlight > VISIBLE,
        `at ${speed} m/s a flight only reached ${(smallestFlight * 1000).toFixed(2)}mm: ` +
          'the ball would coast without appearing to leave the cloth',
      );
    }
  });

  test('no ball coasts through a whole shot without being seen to', () => {
    for (let index = 0; index < 80; index++) {
      const world = sweptShot(index);
      const apexes = new Map<number, number>();

      for (let tick = 0; tick < MAX_TICKS && !world.atRest; tick++) {
        world.step(PHYSICS.fixedDt);
        for (const b of world.balls) {
          if (b.pocketed || b.offTable) continue;
          if (b.z > 0) {
            apexes.set(b.number, Math.max(apexes.get(b.number) ?? 0, b.z));
          } else if (apexes.has(b.number)) {
            const apex = apexes.get(b.number)!;
            apexes.delete(b.number);
            assert(
              apex > VISIBLE,
              `shot ${index}: ball ${b.number} spent a flight at only ` +
                `${(apex * 1000).toFixed(2)}mm, frictionless but looking planted`,
            );
          }
        }
      }
    }
  });

  test('a ball in the air is not slowed or spun by cloth it is not touching', () => {
    const world = World.fromLayout([{ number: 0, x: 0, y: 0 }]);
    const cue = world.cueBall()!;
    cue.v.x = 1.5;
    cue.z = 0.01;
    cue.vz = 0.5;
    cue.w.z = 20;
    const speedBefore = Math.hypot(cue.v.x, cue.v.y);
    const englishBefore = cue.w.z;

    let steps = 0;
    while (cue.z > 0 && steps < 200) {
      world.step(PHYSICS.fixedDt);
      steps++;
    }
    assert(steps > 3, 'the ball did not stay in the air long enough to test');
    assertClose(Math.hypot(cue.v.x, cue.v.y), speedBefore, 1e-12, 'speed while airborne');
    assertClose(cue.w.z, englishBefore, 1e-12, 'english while airborne');
  });

  test('a ball crossing a pocket in the air is not swallowed', () => {
    const table = createTable();
    const pocket = table.pockets[0];

    const flying = World.fromLayout([{ number: 0, x: pocket.center.x, y: pocket.center.y }], table);
    const airborne = flying.cueBall()!;
    airborne.z = 0.01;
    airborne.vz = 0.3;
    flying.step(PHYSICS.fixedDt);
    assert(!airborne.pocketed, 'a ball in the air fell into a pocket it was flying over');

    const rolling = World.fromLayout([{ number: 0, x: pocket.center.x, y: pocket.center.y }], table);
    rolling.step(PHYSICS.fixedDt);
    assert(rolling.cueBall()!.pocketed, 'a ball sitting in a pocket did not drop');
  });

  test('a save written before balls could hop loads flat on the table', () => {
    const legacy = {
      balls: [
        { number: 0, kind: 'cue', p: { x: 0, y: 0 }, v: { x: 0, y: 0 }, w: { x: 0, y: 0, z: 0 }, pocketed: false, pocketedIn: null },
      ],
      time: 0,
    };
    const world = World.deserialize(legacy as unknown as Parameters<typeof World.deserialize>[0]);
    const cue = world.cueBall()!;
    assertEqual(cue.z, 0, 'height restored from a save with no height');
    assertEqual(cue.vz, 0, 'vertical speed restored from a save with no height');
    assertEqual(cue.offTable, false, 'a ball from an old save should be on the table');
    assert(world.atRest, 'a restored ball should be at rest, not falling');
  });
});

suite('leaving the table', () => {
  test('the cushion stops catching a ball once it is higher than the nose', () => {
    const table = createTable();
    // Placed just short of the rail, already above the nose and travelling at it.
    const world = World.fromLayout([{ number: 0, x: table.halfLength - 0.05, y: 0 }], table);
    const cue = world.cueBall()!;
    cue.v.x = 2;
    // Still climbing. Starting at the nose with no vertical speed is not the
    // same test: the ball drops back under the nose part-way across and the
    // cushion is right to catch it.
    cue.z = CUSHION_NOSE_HEIGHT + 0.002;
    cue.vz = 0.5;

    for (let i = 0; i < MAX_TICKS && !cue.offTable && !world.atRest; i++) {
      world.step(PHYSICS.fixedDt);
    }
    assert(cue.offTable, 'a ball above the nose was still turned back by the cushion');
    assert(
      world.events.some((e) => e.kind === 'off-table' && e.ball === 0),
      'leaving the table was not reported',
    );
  });

  test('a ball that clears a rail but lands back inside stays in play', () => {
    const table = createTable();
    const world = World.fromLayout([{ number: 0, x: 0, y: 0 }], table);
    const cue = world.cueBall()!;
    // Straight up over the nose, with barely any sideways travel.
    cue.v.x = 0.05;
    cue.z = CUSHION_NOSE_HEIGHT + 0.01;
    cue.vz = 0;

    runShot(world);
    assertEqual(cue.offTable, false, 'a ball that came down on the cloth was called out');
    assertEqual(cue.z, 0, 'it should have settled back onto the cloth');
  });

  test('a ball that has left the table is out of play until it is put back', () => {
    const table = createTable();
    const world = World.fromLayout(
      [
        { number: 0, x: 0, y: 0 },
        { number: 1, x: 0.2, y: 0 },
      ],
      table,
    );
    const one = world.ballByNumber(1)!;
    one.offTable = true;

    // Off the table is not potted: it still has to be cleared to win.
    assertEqual(
      world.remainingObjectBalls().length,
      1,
      'a ball on the floor stopped counting towards clearing the table',
    );

    // The cue ball must roll straight through where it used to be.
    const cue = world.cueBall()!;
    cue.v.x = 1;
    for (let i = 0; i < 60; i++) world.step(PHYSICS.fixedDt);
    assert(
      !world.events.some((e) => e.kind === 'ball-hit'),
      'the cue ball collided with a ball that was not on the table',
    );

    const returned = world.returnBallsToTable();
    assertEqual(returned.length, 1, 'one ball should have come back');
    assertEqual(returned[0], 1, 'the ball that left should be the one that returned');
    assertEqual(one.offTable, false, 'it should be in play again');
  });

  test('a ball put back never lands on top of another', () => {
    const world = World.rack();
    // Send several balls off at once and bring them all back.
    for (const n of [1, 2, 3, 9]) world.ballByNumber(n)!.offTable = true;
    world.returnBallsToTable();

    const live = world.balls.filter((b) => !b.pocketed && !b.offTable);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const gap = Math.hypot(live[i].p.x - live[j].p.x, live[i].p.y - live[j].p.y);
        assert(
          gap >= BALL_DIAMETER - 1e-9,
          `balls ${live[i].number} and ${live[j].number} overlap after being put back`,
        );
      }
    }
  });

  /**
   * Possible, and confined to the hardest shots in the game.
   *
   * Both halves matter. If nothing ever leaves the table the feature is not
   * there; if it happens at ordinary playing power it is a nuisance rather than
   * a spectacle.
   */
  test('only a full-blooded shot can put a ball off the table', () => {
    function escapesAt(power: number): number {
      let escapes = 0;
      for (let index = 0; index < 120; index++) {
        const world = World.rack();
        world.shoot(-0.5 + (index % 40) * (1 / 39), power, {
          side: ((index % 7) - 3) / 3,
          vertical: ((index % 5) - 2) / 2,
        });
        runShot(world);
        escapes += world.balls.filter((b) => b.offTable).length;
      }
      return escapes;
    }

    assert(escapesAt(1) > 0, 'nothing left the table even at full power');
    assertEqual(escapesAt(0.5), 0, 'balls left the table at half power');

    // And it stays an event rather than a routine outcome.
    const wild = escapesAt(1);
    assert(wild < 120, `${wild} balls left the table in 120 shots: far too ordinary`);
  });
});

suite('the table stays sane', () => {
  const CEILING =
    (PHYSICS.maxVerticalSpeed * PHYSICS.maxVerticalSpeed) / (2 * PHYSICS.gravity);

  /**
   * The bug this suite exists for: a hard shot with a low tip sent the cue ball
   * mad. It hopped, landed almost on top of a racked ball, and the tilted
   * contact fired it a quarter of a metre into the air with the whole rack
   * following. Energy was conserved the entire time, so the existing invariant
   * never noticed — it was the geometry that was wrong, not the arithmetic.
   *
   * Height is the thing to assert on, because with a horizontal cue there is no
   * mechanism that can legitimately produce a big one.
   */
  test('nothing climbs higher than a flat cloth can throw it', () => {
    for (let power = 0.4; power <= 1.0001; power += 0.2) {
      for (let index = 0; index < 40; index++) {
        const world = World.rack();
        // A low tip is what triggered it, so lead with that.
        world.shoot(-0.4 + index * 0.02, power, { side: ((index % 5) - 2) / 2, vertical: -1 });

        // Run the shot out before judging, so the message reports how far the
        // ceiling was actually missed by rather than the first millimetre over
        // it. When this broke, balls were reaching 260mm.
        let highest = 0;
        let culprit = 0;
        for (let tick = 0; tick < MAX_TICKS && !world.atRest; tick++) {
          world.step(PHYSICS.fixedDt);
          for (const b of world.balls) {
            if (b.pocketed || b.offTable) continue;
            if (b.z > highest) {
              highest = b.z;
              culprit = b.number;
            }
          }
        }
        assert(
          highest <= CEILING + 1e-6,
          `ball ${culprit} reached ${(highest * 1000).toFixed(0)}mm at power ` +
            `${power.toFixed(1)}, over the ${(CEILING * 1000).toFixed(0)}mm ceiling`,
        );
      }
    }
  });

  test('no ball ever outruns what the cue could have given it', () => {
    // English off a rail genuinely adds forward speed, so the bound is the shot
    // speed plus what the maximum legal spin can carry — not the shot alone.
    const maxSpin = (5 * PHYSICS.maxShotSpeed) / (2 * BALL_RADIUS) * PHYSICS.maxTipOffset * BALL_RADIUS;
    const limit = PHYSICS.maxShotSpeed + DEFAULT_PROFILE.cushionSpinTransfer * BALL_RADIUS * maxSpin;

    for (let index = 0; index < 120; index++) {
      const world = sweptShot(index);
      for (let tick = 0; tick < MAX_TICKS && !world.atRest; tick++) {
        world.step(PHYSICS.fixedDt);
        for (const b of world.balls) {
          if (b.pocketed || b.offTable) continue;
          const speed = Math.hypot(b.v.x, b.v.y);
          assert(
            speed <= limit,
            `ball ${b.number} reached ${speed.toFixed(2)} m/s, past the ${limit.toFixed(2)} ceiling`,
          );
        }
      }
    }
  });

  test('every number stays finite', () => {
    for (let index = 0; index < 120; index++) {
      const world = sweptShot(index);
      runShot(world);
      for (const b of world.balls) {
        const all = b.p.x + b.p.y + b.v.x + b.v.y + b.z + b.vz + b.w.x + b.w.y + b.w.z;
        assert(Number.isFinite(all), `ball ${b.number} holds a non-finite value`);
      }
    }
  });
});

suite('fouls', () => {
  function playOut(setup: (w: World) => void) {
    const world = World.rack();
    setup(world);
    world.simulateUntilRest();
    const state = createFreeState(2, ['A', 'B']);
    return { world, ...resolveFreeShot(state, world, world.events) };
  }

  /**
   * WPA 8.6. Without it a player can tap the cue ball into the pack over and
   * over — never potting, never reaching a rail, never risking anything — and
   * simply outlast the opponent.
   */
  test('touching a ball but reaching no rail is a foul', () => {
    const world = World.rack();
    const cue = world.cueBall()!;
    const target = world.remainingObjectBalls()[0];
    // Park the cue ball right against a racked ball and nudge it.
    cue.p.x = target.p.x - BALL_DIAMETER * 1.01;
    cue.p.y = target.p.y;
    world.shoot(0, 0.02, { side: 0, vertical: 0 });
    world.simulateUntilRest();

    const contacted = world.events.some((e) => e.kind === 'ball-hit');
    const railed = world.events.some((e) => e.kind === 'cushion-hit');
    const potted = world.events.some((e) => e.kind === 'pocketed');

    if (contacted && !railed && !potted) {
      const state = createFreeState(2, ['A', 'B']);
      const { outcome } = resolveFreeShot(state, world, world.events);
      assert(outcome.foul, 'a shot that reached no rail was not called a foul');
      assertEqual(outcome.turnPassed, true, 'a foul has to hand the turn over');
    }
  });

  test('driving the cue ball off the table is a foul and it comes back', () => {
    const world = World.rack();
    world.simulateUntilRest();
    const cue = world.cueBall()!;
    cue.offTable = true;
    world.events.push({ kind: 'off-table', t: 1, ball: 0, speed: 4, x: 1.4, y: 0.7 });

    const state = createFreeState(2, ['A', 'B']);
    const { outcome } = resolveFreeShot(state, world, world.events);
    assert(outcome.foul, 'the cue ball leaving the table was not a foul');
    assert(outcome.cueBallNeedsRespot, 'the cue ball has to be put back');
    assertEqual(outcome.turnPassed, true, 'a foul hands the turn over');

    world.respotCueBall();
    assertEqual(cue.offTable, false, 'the cue ball should be back in play');
  });

  test('an object ball off the table is a foul and is spotted, not potted', () => {
    const world = World.rack();
    world.simulateUntilRest();
    const five = world.ballByNumber(5)!;
    five.offTable = true;
    world.events.push({ kind: 'off-table', t: 1, ball: 5, speed: 4, x: 1.4, y: 0.7 });

    const before = world.remainingObjectBalls().length;
    const state = createFreeState(2, ['A', 'B']);
    const { outcome } = resolveFreeShot(state, world, world.events);

    assert(outcome.foul, 'an object ball leaving the table was not a foul');
    assert(!outcome.pocketed.includes(5), 'a ball on the floor was scored as potted');
    assertEqual(
      world.remainingObjectBalls().length,
      before,
      'it still has to be cleared to win',
    );

    world.returnBallsToTable();
    assertEqual(five.offTable, false, 'it should be back on the table');
  });

  test('a foul costs a point and never keeps the turn', () => {
    const { state, outcome } = playOut((w) => w.shoot(Math.PI, 0.04, NO_SPIN));
    if (!outcome.foul) return;
    assertEqual(outcome.turnPassed, true, 'a foul must hand the turn over');
    assert(state.players[0].score < 0, 'a foul should have cost a point');
  });
});

suite('a ball on the floor', () => {
  /**
   * Sends a ball over the side properly — high enough to clear the nose and
   * travelling outwards — rather than teleporting it past the rail, which would
   * be flagged before it ever moved.
   */
  function knockOff() {
    const table = createTable();
    const world = World.fromLayout([{ number: 0, x: 0, y: table.halfWidth - 0.1 }], table);
    const cue = world.cueBall()!;
    cue.v.y = 3;
    cue.w.z = 120;
    cue.z = CUSHION_NOSE_HEIGHT + 0.004;
    cue.vz = 0.4;

    // Stop as soon as it is out, so the rules do not put it back mid-test.
    for (let i = 0; i < MAX_TICKS && !cue.offTable; i++) world.step(PHYSICS.fixedDt);
    // Then let it fall and settle on the floor.
    for (let i = 0; i < MAX_TICKS && !world.atRest; i++) world.step(PHYSICS.fixedDt);
    return { world, cue };
  }

  /**
   * The pirouette.
   *
   * Cloth friction skips anything out of play, so a ball that left the table
   * kept whatever spin it flew off with — 57 turns a second, indefinitely, while
   * hanging in mid-air. It span because nothing down there was touching it.
   */
  test('it stops spinning once it is lying on the floor', () => {
    const { cue } = knockOff();
    const spin = Math.hypot(cue.w.x, cue.w.y, cue.w.z);
    assertEqual(spin, 0, `it is still turning at ${spin.toFixed(1)} rad/s`);
  });

  test('it lands on the floor instead of stopping in the air', () => {
    const { cue } = knockOff();
    assert(cue.z < -0.7, `it came to rest ${(cue.z * 1000).toFixed(0)}mm below the cloth`);
    assertEqual(cue.vz, 0, 'it should not still be falling');
    assertEqual(Math.hypot(cue.v.x, cue.v.y), 0, 'it should not still be rolling');
  });

  test('it does not hold the shot open', () => {
    const { world } = knockOff();
    assert(world.atRest, 'the shot never finished with a ball on the floor');
  });

  /** The replay camera needs somewhere to point, and the ball has moved by then. */
  test('leaving the table records where it went over', () => {
    const { world } = knockOff();
    const fall = world.events.find((e) => e.kind === 'off-table');
    assert(fall !== undefined, 'no off-table event was recorded');
    if (fall && fall.kind === 'off-table') {
      assert(Number.isFinite(fall.x) && Number.isFinite(fall.y), 'the crossing point is not a number');
      assert(
        Math.abs(fall.x) <= 2 && Math.abs(fall.y) <= 2,
        `the crossing point is nowhere near the table: ${fall.x}, ${fall.y}`,
      );
    }
  });

  /**
   * The replay watches the fall, so the ball has to still be in the room when it
   * lands. It used to roll straight out through the wall to nearly four metres.
   */
  test('it stops at the walls instead of rolling out of the room', () => {
    const { cue } = knockOff();
    assert(
      Math.abs(cue.p.x) <= PHYSICS.roomHalfX + 1e-9,
      `it ended ${cue.p.x.toFixed(2)}m along, past the wall at ${PHYSICS.roomHalfX.toFixed(2)}`,
    );
    assert(
      Math.abs(cue.p.y) <= PHYSICS.roomHalfY + 1e-9,
      `it ended ${cue.p.y.toFixed(2)}m across, past the wall at ${PHYSICS.roomHalfY.toFixed(2)}`,
    );
  });

  test('a foul reports what it cost', () => {
    const world = World.rack();
    world.simulateUntilRest();
    world.ballByNumber(3)!.offTable = true;
    world.events.push({ kind: 'off-table', t: 1, ball: 3, speed: 4, x: 1.3, y: 0.6 });

    const state = createFreeState(2, ['A', 'B']);
    const { outcome } = resolveFreeShot(state, world, world.events);
    assert(outcome.foul, 'it should be a foul');
    assert(outcome.penalty > 0, 'the foul has to carry a price the screen can show');
  });
});

suite('english off a rail', () => {
  /** Rolls a ball into the top rail with full side spin and reports the result. */
  function intoRailWithEnglish(speed: number) {
    const table = createTable();
    const world = World.fromLayout(
      [{ number: 0, x: 0.4, y: table.halfWidth - BALL_RADIUS - 0.02 }],
      table,
    );
    const cue = world.cueBall()!;
    cue.v.y = speed;
    cue.w.x = -speed / BALL_RADIUS;
    // As much english as the tip can impart.
    cue.w.z = -((5 * PHYSICS.maxShotSpeed) / (2 * BALL_RADIUS)) * PHYSICS.maxTipOffset;

    for (let t = 0; t < MAX_TICKS; t++) {
      world.step(PHYSICS.fixedDt);
      if (world.events.some((e) => e.kind === 'cushion-hit')) {
        world.step(PHYSICS.fixedDt);
        break;
      }
    }
    return { sideways: Math.abs(cue.v.x), speed };
  }

  /**
   * The "out of control" report.
   *
   * The sideways push off a rail used to be `transfer · R · w.z` and nothing
   * else — a function of the stored spin alone. A rail brushed at half a metre a
   * second handed over the same 1.8 m/s as one struck at six, so a ball with
   * heavy english left a gentle cushion at 79 degrees. Friction at a contact is
   * bounded by `mu · (1 + e) · |vn|`, and once it is, a soft rail behaves like a
   * soft rail.
   */
  test('a gently touched rail cannot fling a ball sideways', () => {
    const soft = intoRailWithEnglish(0.5);
    const hard = intoRailWithEnglish(6);
    assert(
      soft.sideways < hard.sideways * 0.35,
      `a 0.5 m/s rail gave ${soft.sideways.toFixed(2)} m/s sideways against ` +
        `${hard.sideways.toFixed(2)} at 6 m/s: the push ignores how hard it was hit`,
    );
  });

  test('the sideways push grows with how hard the rail is met', () => {
    const pushes = [0.5, 1, 2, 4].map((v) => intoRailWithEnglish(v).sideways);
    for (let i = 1; i < pushes.length; i++) {
      assert(
        pushes[i] > pushes[i - 1],
        `sideways push did not grow: ${pushes.map((p) => p.toFixed(2)).join(', ')}`,
      );
    }
  });

  test('english still opens the angle on a firm rail', () => {
    // The effect has to survive being bounded, or the fix has removed the shot.
    assert(
      intoRailWithEnglish(6).sideways > 1,
      'heavy english off a hard rail should still throw the ball well sideways',
    );
  });

  test('a rail can never hand over more than the spin holds', () => {
    for (const v of [0.5, 1, 2, 4, 6]) {
      const { sideways } = intoRailWithEnglish(v);
      const stored = BALL_RADIUS * ((5 * PHYSICS.maxShotSpeed) / (2 * BALL_RADIUS)) * PHYSICS.maxTipOffset;
      assert(
        sideways <= stored + 1e-9,
        `at ${v} m/s the rail gave ${sideways.toFixed(2)} m/s from ${stored.toFixed(2)} of spin`,
      );
    }
  });
});

suite('furniture on the floor', () => {
  /** The sala, with the sideboard, cabinet, chairs and plants it really has. */
  function furnished() {
    return { ...createTable(), obstacles: obstaclesFor('sala') };
  }

  /** Rolls a ball across the carpet from the middle of the room. */
  function slide(angle: number, speed: number) {
    const table = furnished();
    const world = World.fromLayout([{ number: 0, x: 0, y: 0 }], table);
    const ball = world.cueBall()!;
    ball.offTable = true;
    ball.z = -0.78;
    ball.v.x = Math.cos(angle) * speed;
    ball.v.y = Math.sin(angle) * speed;
    runShot(world);
    return { table, ball };
  }

  test('the room has furniture the solver knows about', () => {
    assert(furnished().obstacles.length > 0, 'the sala has no obstacles at all');
  });

  /**
   * The whole point of giving furniture a footprint: a ball must never come to
   * rest inside the bookcase.
   */
  test('a ball never ends up inside a piece of furniture', () => {
    for (let i = 0; i < 72; i++) {
      const { table, ball } = slide((i / 72) * Math.PI * 2, 5);
      for (const o of table.obstacles) {
        const insideX = Math.abs(ball.p.x - o.x) < o.halfX + BALL_RADIUS - 1e-6;
        const insideY = Math.abs(ball.p.y - o.y) < o.halfY + BALL_RADIUS - 1e-6;
        assert(
          !(insideX && insideY),
          `a ball came to rest inside the piece at (${o.x.toFixed(2)}, ${o.y.toFixed(2)})`,
        );
      }
    }
  });

  /**
   * A ball has to be able to *reach* the furniture, or the collisions are
   * decoration. The carpet drag was originally set so tight that a ball stopped
   * two metres short of everything in the room.
   */
  test('a ball knocked hard off the table reaches the far side of the room', () => {
    let furthest = 0;
    for (let i = 0; i < 36; i++) {
      const { ball } = slide((i / 36) * Math.PI * 2, 5);
      furthest = Math.max(furthest, Math.hypot(ball.p.x, ball.p.y));
    }
    assert(furthest > 2.4, `nothing got further than ${furthest.toFixed(2)}m from the table`);
  });

  test('furniture actually turns a ball back', () => {
    // Straight at the trophy cabinet.
    const table = furnished();
    const cabinet = table.obstacles.reduce((best, o) =>
      Math.abs(o.restitution - 0.5) < Math.abs(best.restitution - 0.5) ? o : best,
    );
    const world = World.fromLayout([{ number: 0, x: 0, y: 0 }], table);
    const ball = world.cueBall()!;
    ball.offTable = true;
    ball.z = -0.78;
    const d = Math.hypot(cabinet.x, cabinet.y);
    ball.v.x = (cabinet.x / d) * 5;
    ball.v.y = (cabinet.y / d) * 5;

    let turned = false;
    for (let t = 0; t < MAX_TICKS && !world.atRest; t++) {
      const before = { vx: ball.v.x, vy: ball.v.y };
      world.step(PHYSICS.fixedDt);
      if (ball.v.x * before.vx < 0 || ball.v.y * before.vy < 0) turned = true;
    }
    assert(turned, 'a ball fired at the cabinet was never turned back');
  });

  test('furniture never adds energy', () => {
    for (let i = 0; i < 36; i++) {
      const table = furnished();
      const world = World.fromLayout([{ number: 0, x: 0, y: 0 }], table);
      const ball = world.cueBall()!;
      ball.offTable = true;
      ball.z = -0.78;
      const angle = (i / 36) * Math.PI * 2;
      ball.v.x = Math.cos(angle) * 5;
      ball.v.y = Math.sin(angle) * 5;

      let fastest = Math.hypot(ball.v.x, ball.v.y);
      for (let t = 0; t < MAX_TICKS && !world.atRest; t++) {
        world.step(PHYSICS.fixedDt);
        const speed = Math.hypot(ball.v.x, ball.v.y);
        assert(speed <= fastest + 1e-9, `a bounce sped the ball up to ${speed.toFixed(3)} m/s`);
        fastest = Math.max(fastest, speed);
      }
    }
  });
});

report();
