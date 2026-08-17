/**
 * Physics core test suite. `npm run test:core`
 *
 * These assert the four properties the rest of the game leans on: shots always
 * terminate, balls never pass through each other or through a rail, collisions
 * transfer momentum the way pool balls do, and identical input produces
 * identical output.
 */

import { BALL_DIAMETER, BALL_RADIUS, DEFAULT_PROFILE, PHYSICS } from '../constants';
import { firstBallHitByCue, pocketedNumbers, type ShotEvent } from '../events';
import { predictAim } from '../predict';
import { createTable, headSpot } from '../table';
import { add, angleOf, normalize, scale, sub } from '../vec';
import { World } from '../world';
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

report();
