/**
 * The computer opponent. `npm run test:ai`
 *
 * An opponent is easy to write and hard to know you have written: it always
 * returns *a* shot, so nothing crashes and nothing looks wrong until you have
 * played twenty frames and noticed it never pots anything. These measure what a
 * few hundred shots actually do, which is the only honest way to say a hard
 * opponent is harder than an easy one.
 */

import { assert, assertEqual, report, suite, test } from '../../core/tests/harness';

import { PHYSICS } from '../../core/constants';
import { createTable } from '../../core/table';
import { World } from '../../core/world';
import { createFreeState, resolveFreeShot } from '../../rules/free';
import { DIFFICULTIES, planShot, type Difficulty } from '../opponent';

const MAX_TICKS = Math.ceil(PHYSICS.maxShotSeconds / PHYSICS.fixedDt);

/**
 * A ball sitting in front of a corner pocket, with the cue ball behind it.
 *
 * Deliberately the easiest shot on a table: straight, close, nothing in the way.
 * Anything that cannot pot this cannot pot anything.
 */
function sitter() {
  const table = createTable();
  return World.fromLayout(
    [
      { number: 0, x: 0, y: 0 },
      { number: 1, x: table.halfLength - 0.4, y: table.halfWidth - 0.4 },
    ],
    table,
  );
}

/** Plays one shot to a standstill and says whether ball 1 went down. */
function potted(difficulty: Difficulty, seed: number): boolean {
  const world = sitter();
  const shot = planShot(world, difficulty, seed);
  if (!shot) return false;

  world.shoot(shot.angle, shot.power, shot.spin);
  for (let t = 0; t < MAX_TICKS && !world.atRest; t++) world.step(PHYSICS.fixedDt);

  return world.ballByNumber(1)?.pocketed === true;
}

/** How many of `n` attempts at the same easy shot go in. */
function potRate(difficulty: Difficulty, n = 60): number {
  let made = 0;
  for (let i = 0; i < n; i++) if (potted(difficulty, i * 7919 + 13)) made += 1;
  return made / n;
}

suite('the opponent plays a shot at all', () => {
  test('it finds the ball in front of the pocket', () => {
    const shot = planShot(sitter(), 'hard', 1);
    assert(shot !== null, 'there was an obvious shot and it found nothing');
  });

  test('the shot it returns is playable', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
      for (let seed = 1; seed < 40; seed++) {
        const shot = planShot(sitter(), difficulty, seed);
        assert(shot !== null, `${difficulty}/${seed}: no shot`);
        assert(Number.isFinite(shot!.angle), `${difficulty}/${seed}: angle is not a number`);
        assert(
          shot!.power > 0 && shot!.power <= 1,
          `${difficulty}/${seed}: power ${shot!.power} is out of range`,
        );
      }
    }
  });

  test('an empty table has nothing to aim at', () => {
    const world = World.fromLayout([{ number: 0, x: 0, y: 0 }], createTable());
    assertEqual(planShot(world, 'hard', 1), null, 'nothing to hit');
  });

  test('it will not aim at a ball it is not allowed to hit', () => {
    const world = sitter();
    // Ball 1 is the only one on the table, and it is off limits.
    const shot = planShot(world, 'hard', 1, { targets: [9] });
    assertEqual(shot, null, 'the only ball was not a legal target');
  });

  test('the same seed plays the same shot twice', () => {
    const a = planShot(sitter(), 'medium', 42);
    const b = planShot(sitter(), 'medium', 42);
    assertEqual(a?.angle, b?.angle, 'angle');
    assertEqual(a?.power, b?.power, 'power');
  });

  test('different seeds do not', () => {
    const a = planShot(sitter(), 'medium', 1);
    const b = planShot(sitter(), 'medium', 2);
    assert(a!.angle !== b!.angle, 'two seeds gave identical aim');
  });
});

suite('difficulty actually changes how well it plays', () => {
  /**
   * The measurement that matters.
   *
   * Everything else here checks the opponent is wired up; this checks it is any
   * good. Run over the same easy shot many times, because one pot proves nothing
   * about a player who aims with a random error.
   */
  test('a harder opponent pots more of the same easy shot', () => {
    const easy = potRate('easy');
    const medium = potRate('medium');
    const hard = potRate('hard');

    assert(
      hard > medium && medium > easy,
      `the three are not in order: easy ${easy.toFixed(2)}, ` +
        `medium ${medium.toFixed(2)}, hard ${hard.toFixed(2)}`,
    );
  });

  test('hard is good without being perfect', () => {
    const rate = potRate('hard');
    assert(rate > 0.7, `hard only potted ${(rate * 100).toFixed(0)}% of a sitter`);
    assert(rate < 1, 'hard never missed once, which is a wall rather than an opponent');
  });

  test('easy misses often enough to be beatable', () => {
    const rate = potRate('easy');
    assert(rate < 0.75, `easy potted ${(rate * 100).toFixed(0)}%, which is not easy`);
    assert(rate > 0.05, `easy potted ${(rate * 100).toFixed(0)}%, which is not playing`);
  });
});

suite('the difficulty profiles', () => {
  test('each step aims straighter than the one below it', () => {
    assert(
      DIFFICULTIES.easy.aimError > DIFFICULTIES.medium.aimError,
      'medium should aim straighter than easy',
    );
    assert(
      DIFFICULTIES.medium.aimError > DIFFICULTIES.hard.aimError,
      'hard should aim straighter than medium',
    );
  });

  test('each step looks at more of the table', () => {
    assert(DIFFICULTIES.easy.considers < DIFFICULTIES.medium.considers, 'easy sees least');
    assert(DIFFICULTIES.medium.considers < DIFFICULTIES.hard.considers, 'hard sees most');
  });

  test('even hard is not perfect', () => {
    assert(DIFFICULTIES.hard.aimError > 0, 'an opponent that never errs is not an opponent');
  });
});

/**
 * The measurement that matters most: can it finish a frame?
 *
 * Every test above looks at one shot from a set position, and a machine can pass
 * all of them and still be useless — it only has to fail once from a position it
 * put itself in. This plays a whole rack through the real rules, respotting the
 * cue ball the way the game does, and asks whether the table ends up clear.
 */
suite('it can clear a table', () => {
  test('a medium opponent pots the whole rack, given enough shots', () => {
    const world = World.rack();
    world.simulateUntilRest();
    let state = createFreeState(1, ['CPU']);

    let shots = 0;
    for (let i = 0; i < 120; i++) {
      const left = world.balls.filter((b) => b.number !== 0 && !b.pocketed).length;
      if (left === 0) break;

      const shot = planShot(world, 'medium', i * 104729 + 7);
      assert(shot !== null, `it ran out of ideas with ${left} balls left`);

      world.shoot(shot!.angle, shot!.power, shot!.spin);
      for (let t = 0; t < MAX_TICKS && !world.atRest; t++) world.step(PHYSICS.fixedDt);
      world.settle();

      // Exactly what the session does between shots.
      const resolved = resolveFreeShot(state, world, world.events);
      state = resolved.state;
      if (resolved.outcome.cueBallNeedsRespot) world.respotCueBall();
      world.returnBallsToTable();

      shots += 1;
    }

    const remaining = world.balls.filter((b) => b.number !== 0 && !b.pocketed).length;
    assertEqual(remaining, 0, `it left ${remaining} balls on the table after ${shots} shots`);
  });
});


/**
 * The seats survive being set up.
 *
 * The setup screen rebuilds the game so the table can be made with the cloth
 * chosen on it, and the first version rebuilt it from scratch — fresh names, no
 * computers. Every machine the difficulty screen had placed was dropped on the
 * floor, so a game against the computer reached the table as a game between
 * people and nothing ever took a turn.
 *
 * That is invisible from any single screen: each one worked. It only shows in
 * what the last one hands over.
 */
suite('a game against the computer keeps its computers', () => {
  test('rebuilding a game preserves who is a machine', () => {
    const before = createFreeState(3, ['You', 'CPU 1', 'CPU 2'], [
      undefined,
      'easy',
      'hard',
    ]);

    // Exactly what the setup screen does: read the seats back, restart with them.
    const names = before.players.map((p) => p.name);
    const cpus = before.players.map((p) => p.cpu);
    const after = createFreeState(before.players.length, names, cpus);

    assertEqual(after.players[0].cpu, undefined, 'seat 0 should still be the person');
    assertEqual(after.players[1].cpu, 'easy', 'seat 1 should still be an easy machine');
    assertEqual(after.players[2].cpu, 'hard', 'seat 2 should still be a hard machine');
    assertEqual(after.players[1].name, 'CPU 1', 'the names should survive too');
  });

  /**
   * Picking two opponents gets you two opponents.
   *
   * The player-count screen counts *seats* when people are playing — four
   * friends is four seats — and the difficulty screen was handed that number
   * unchanged. Against machines nobody counts themselves, so choosing two gave
   * one opponent and a seat for yourself. The screen now passes the total.
   */
  test('the number of opponents chosen is the number that turn up', () => {
    for (const chosen of [1, 2, 3, 4]) {
      // Exactly the arithmetic the two screens do between them.
      const total = Math.max(2, Math.min(8, chosen + 1));
      const levels = Array.from({ length: total - 1 }, () => 'medium' as const);
      const state = createFreeState(
        total,
        ['You', ...levels.map((_, i) => `CPU ${i + 1}`)],
        [undefined, ...levels],
      );

      const machines = state.players.filter((p) => p.cpu).length;
      assertEqual(machines, chosen, `choosing ${chosen} opponents seated ${machines}`);
      assertEqual(state.players[0].cpu, undefined, 'the first seat is always the person');
    }
  });

  test('a game between people gains no computers', () => {
    const state = createFreeState(2, ['A', 'B']);
    assertEqual(state.players[0].cpu, undefined, 'nobody asked for a machine');
    assertEqual(state.players[1].cpu, undefined, 'nobody asked for a machine');
  });
});


report();
