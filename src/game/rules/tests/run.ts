/**
 * Rules test suite. `npm run test:rules`
 *
 * Two halves: fast unit tests that feed synthetic event logs to the scoring and
 * objective code, then the slow half that actually solves every puzzle level
 * with the brute-force searcher.
 */

import type { ShotEvent } from '../../core/events';
import { World } from '../../core/world';
import { assert, assertClose, assertEqual, report, suite, test } from '../../core/tests/harness';
import { createFreeState, resolveFreeShot, type FreeState } from '../free';
import { LEVELS, levelById, nextLevelId } from '../levels';
import { createPuzzleState, resolvePuzzleShot, starsFor } from '../puzzle';
import { solveLevel, verifySolution } from './solver';

/** Player names, which the caller owns; the rules only carry them. */
function names(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `P${i + 1}`);
}

// ------------------------------------------------------------ synthetic events

const hit = (a: number, b: number): ShotEvent => ({ kind: 'ball-hit', t: 0.1, a, b, speed: 1.5 });
const rail = (ball: number): ShotEvent => ({
  kind: 'cushion-hit',
  t: 0.2,
  ball,
  cushion: 0,
  speed: 1,
});
const pot = (ball: number): ShotEvent => ({
  kind: 'pocketed',
  t: 0.5,
  ball,
  pocket: 'corner-ne',
});

/** A table holding `numbers`, with `pocketed` already off the table. */
function worldWith(numbers: number[], pocketed: number[] = []): World {
  const world = World.fromLayout([
    { number: 0, x: -0.6, y: 0 },
    ...numbers.map((n, i) => ({ number: n, x: 0.2 + i * 0.15, y: 0 })),
  ]);
  for (const n of [...pocketed]) {
    const ball = world.ballByNumber(n);
    if (!ball) continue;
    ball.pocketed = true;
    ball.pocketedIn = 'corner-ne';
  }
  return world;
}

// --------------------------------------------------------------------- free play

suite('free play scoring', () => {
  test('potting scores a point and keeps the turn', () => {
    const world = worldWith([1, 2], [1]);
    const { state, outcome } = resolveFreeShot(createFreeState(2, names(2)), world, [hit(0, 1), pot(1)]);

    assertEqual(state.players[0].score, 1, 'score');
    assertEqual(state.current, 0, 'still the same player');
    assertEqual(outcome.turnPassed, false, 'turn passed');
    assertEqual(outcome.gameOver, false, 'game over');
  });

  test('a clean miss passes the turn', () => {
    const world = worldWith([1, 2]);
    const { state, outcome } = resolveFreeShot(createFreeState(2, names(2)), world, [hit(0, 1), rail(1)]);

    assertEqual(state.players[0].score, 0, 'score');
    assertEqual(state.current, 1, 'next player');
    assertEqual(outcome.turnPassed, true, 'turn passed');
    assertEqual(outcome.foul, false, 'foul');
  });

  test('potting the cue ball is a foul that costs a point and the turn', () => {
    const world = worldWith([1, 2]);
    const { state, outcome } = resolveFreeShot(createFreeState(2, names(2)), world, [hit(0, 1), pot(0)]);

    assertEqual(state.players[0].score, -1, 'score');
    assertEqual(outcome.foul, true, 'foul');
    assertEqual(outcome.cueBallNeedsRespot, true, 'respot requested');
    assertEqual(state.current, 1, 'next player');
    assertEqual(state.lastShotWasFoul, true, 'foul recorded');
  });

  test('hitting nothing at all is a foul', () => {
    const world = worldWith([1, 2]);
    const { outcome } = resolveFreeShot(createFreeState(2, names(2)), world, [rail(0)]);

    assertEqual(outcome.foul, true, 'foul');
    assertEqual(outcome.foulReason?.key, 'rules.foulNoContact', 'reason');
  });

  test('a foul ends the turn even when the shot potted a ball', () => {
    const world = worldWith([1, 2], [1]);
    const { state, outcome } = resolveFreeShot(createFreeState(2, names(2)), world, [
      hit(0, 1),
      pot(1),
      pot(0),
    ]);

    // One point for the ball, one back for the scratch.
    assertEqual(state.players[0].score, 0, 'score');
    assertEqual(outcome.turnPassed, true, 'turn passed');
    assertEqual(state.current, 1, 'next player');
  });

  test('a solo game never changes player', () => {
    const world = worldWith([1, 2]);
    const { state } = resolveFreeShot(createFreeState(1, names(1)), world, [hit(0, 1)]);
    assertEqual(state.current, 0, 'current player');
    assertEqual(state.players.length, 1, 'player count');
  });

  test('the last ball ends the game and the top score wins', () => {
    const world = worldWith([1], [1]);
    const { state, outcome } = resolveFreeShot(createFreeState(3, names(3)), world, [hit(0, 1), pot(1)]);

    assertEqual(outcome.gameOver, true, 'game over');
    assertEqual(state.finished, true, 'finished');
    assertEqual(state.winners.join(','), '0', 'winners');
  });

  test('equal scores produce a shared win', () => {
    const world = worldWith([1], [1]);
    const tied: FreeState = {
      ...createFreeState(2, names(2)),
      players: [
        { id: 0, name: 'A', score: 4, ballsPocketed: 4 },
        { id: 1, name: 'B', score: 5, ballsPocketed: 5 },
      ],
    };
    const { state } = resolveFreeShot(tied, world, [hit(0, 1), pot(1)]);
    assertEqual(state.winners.join(','), '0,1', 'winners');
  });

  test('names come from the caller, never from the rules', () => {
    // Defaults are translated strings, so this module must not invent one. It
    // only carries what it is handed, and refuses to leave a name blank.
    const state = createFreeState(3, ['Vince', '  ']);
    assertEqual(state.players[0].name, 'Vince', 'given name');
    assertEqual(state.players[1].name, '#2', 'blank name');
    assertEqual(state.players[2].name, '#3', 'missing name');
  });
});

// ----------------------------------------------------------------------- puzzles

suite('puzzle objectives', () => {
  test('clearing the table wins and awards three stars', () => {
    const level = levelById('primo-colpo')!;
    const world = World.fromLayout(level.layout);
    world.ballByNumber(3)!.pocketed = true;

    const { state } = resolvePuzzleShot(level, createPuzzleState(level), world, [hit(0, 3), pot(3)]);
    assertEqual(state.status, 'won', 'status');
    assertEqual(state.stars, 3, 'stars');
    assertEqual(state.shotsUsed, 1, 'shots used');
  });

  test('a forbidden ball loses the level', () => {
    const level = levelById('niente-nera')!;
    const world = World.fromLayout(level.layout);
    world.ballByNumber(8)!.pocketed = true;

    const { state } = resolvePuzzleShot(level, createPuzzleState(level), world, [hit(0, 8), pot(8)]);
    assertEqual(state.status, 'failed', 'status');
    assertEqual(state.failReason?.key, 'puzzle.failForbidden', 'reason');
  });

  test('hitting the wrong ball first loses the level', () => {
    const level = levelById('prima-la-5')!;
    const world = World.fromLayout(level.layout);

    const { state } = resolvePuzzleShot(level, createPuzzleState(level), world, [hit(0, 2)]);
    assertEqual(state.status, 'failed', 'status');
    assertEqual(state.failReason?.key, 'puzzle.failWrongFirst', 'reason');
  });

  test('an ordered goal advances one ball at a time', () => {
    const level = levelById('in-ordine')!;
    const world = World.fromLayout(level.layout);
    world.ballByNumber(1)!.pocketed = true;

    const first = resolvePuzzleShot(level, createPuzzleState(level), world, [hit(0, 1), pot(1)]);
    assertEqual(first.state.status, 'playing', 'status after the first ball');
    assertEqual(first.state.orderIndex, 1, 'order index');
  });

  test('an out-of-order pot loses the level', () => {
    const level = levelById('in-ordine')!;
    const world = World.fromLayout(level.layout);
    world.ballByNumber(2)!.pocketed = true;

    const { state } = resolvePuzzleShot(level, createPuzzleState(level), world, [hit(0, 2), pot(2)]);
    assertEqual(state.status, 'failed', 'status');
    assertEqual(state.failReason?.key, 'puzzle.failOutOfOrder', 'reason');
  });

  test('potting without the required rail loses the level', () => {
    const level = levelById('di-sponda')!;
    const world = World.fromLayout(level.layout);
    world.ballByNumber(6)!.pocketed = true;

    const { state } = resolvePuzzleShot(level, createPuzzleState(level), world, [hit(0, 6), pot(6)]);
    assertEqual(state.status, 'failed', 'status');

    // The same shot with a rail contact first is fine.
    const banked = resolvePuzzleShot(level, createPuzzleState(level), world, [
      rail(0),
      hit(0, 6),
      pot(6),
    ]);
    assertEqual(banked.state.status, 'won', 'status when banked');
  });

  test('the wrong pocket loses a pocket-into level', () => {
    const level = levelById('buca-scelta')!;
    const world = World.fromLayout(level.layout);
    const nine = world.ballByNumber(9)!;
    nine.pocketed = true;
    nine.pocketedIn = 'corner-ne';

    const { state } = resolvePuzzleShot(level, createPuzzleState(level), world, [hit(0, 9), pot(9)]);
    assertEqual(state.status, 'failed', 'status');
    assertEqual(state.failReason?.key, 'puzzle.failWrongPocket', 'reason');
  });

  test('running out of shots loses the level', () => {
    const level = levelById('primo-colpo')!;
    const world = World.fromLayout(level.layout);
    let state = createPuzzleState(level);

    for (let i = 0; i < level.maxShots; i++) {
      state = resolvePuzzleShot(level, state, world, [hit(0, 3)]).state;
    }
    assertEqual(state.status, 'failed', 'status');
    assertEqual(state.failReason?.key, 'puzzle.failOutOfShots', 'reason');
  });

  test('star thresholds match the level definition', () => {
    const level = levelById('doppietta')!;
    assertEqual(starsFor(level, 2), 3, 'three-star shots');
    assertEqual(starsFor(level, 3), 2, 'two-star shots');
    assertEqual(starsFor(level, 9), 1, 'one-star shots');
  });

  test('levels form a chain with unique ids', () => {
    const ids = new Set(LEVELS.map((l) => l.id));
    assertEqual(ids.size, LEVELS.length, 'unique level ids');
    assertEqual(nextLevelId(LEVELS[LEVELS.length - 1].id), null, 'last level has no successor');
    assertEqual(nextLevelId(LEVELS[0].id), LEVELS[1].id, 'first level points to the second');
  });

  test('every level starts from a legal layout', () => {
    for (const level of LEVELS) {
      const world = World.fromLayout(level.layout);
      assert(world.cueBall() !== undefined, `${level.id}: no cue ball`);

      const active = world.balls;
      for (let i = 0; i < active.length; i++) {
        const { halfLength, halfWidth } = world.table;
        assert(
          Math.abs(active[i].p.x) < halfLength && Math.abs(active[i].p.y) < halfWidth,
          `${level.id}: ball ${active[i].number} is off the table`,
        );
        for (let j = i + 1; j < active.length; j++) {
          const d = Math.hypot(active[i].p.x - active[j].p.x, active[i].p.y - active[j].p.y);
          assert(d > 0.0572, `${level.id}: balls ${active[i].number} and ${active[j].number} overlap`);
        }
        for (const pocket of world.table.pockets) {
          const d = Math.hypot(active[i].p.x - pocket.center.x, active[i].p.y - pocket.center.y);
          assert(d > pocket.radius + 0.0286, `${level.id}: ball ${active[i].number} starts in ${pocket.id}`);
        }
      }

      assert(level.stars.three <= level.stars.two, `${level.id}: star thresholds are inverted`);
      assert(level.stars.two <= level.maxShots, `${level.id}: two-star threshold exceeds the budget`);
    }
  });
});

// ------------------------------------------------------------------ solvability

suite('every level is solvable', () => {
  for (const level of LEVELS) {
    test(`${level.id} can be won within ${level.maxShots} shots`, () => {
      const started = Date.now();
      const result = solveLevel(level);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);

      assert(
        result.won,
        `no solution found in ${result.simulations} simulated shots — the level needs redesigning`,
      );
      assert(
        result.shots.length <= level.maxShots,
        `solution needs ${result.shots.length} shots but the budget is ${level.maxShots}`,
      );

      // Replay independently of the search, so a solver bug cannot pass a level.
      const replayed = verifySolution(level, result.shots);
      assertEqual(replayed.status, 'won', 'replayed solution');
      assertClose(replayed.shotsUsed, result.shots.length, 0, 'replayed shot count');

      console.log(
        `      ${result.shots.length} shot(s), ${result.simulations} sims, ${seconds}s, ${replayed.stars}★`,
      );
    });
  }
});

report();
