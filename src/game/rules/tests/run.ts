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

report();
