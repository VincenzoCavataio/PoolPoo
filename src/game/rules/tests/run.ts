/**
 * Rules test suite. `npm run test:rules`
 *
 * Two halves: fast unit tests that feed synthetic event logs to the scoring and
 * objective code, then the slow half that actually solves every puzzle level
 * with the brute-force searcher.
 */

import type { ShotEvent } from '../../core/events';
import type { PocketId } from '../../core/table';
import { World } from '../../core/world';
import { assert, assertClose, assertEqual, report, suite, test } from '../../core/tests/harness';
import { createFreeState, resolveFreeShot, type FreeState } from '../free';
import {
  createEightState,
  groupOf,
  resolveEightShot,
  teamOf,
  type EightState,
} from '../eight-ball';
import {
  createStraightState,
  resolveStraightShot,
  STRAIGHT_RULES,
  type StraightState,
} from '../straight-pool';

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
        { id: 0, name: 'A', score: 4, ballsPocketed: 4, potted: [1, 2, 3, 4] },
        { id: 1, name: 'B', score: 5, ballsPocketed: 5, potted: [5, 6, 7, 9, 10] },
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


// ------------------------------------------------------------------- 8-ball

/**
 * Eight-ball, where nearly every rule is about *which* ball rather than how many.
 *
 * These matter more than the free-play ones: free play scores what dropped, so a
 * mistake is a wrong number on a scoreboard. Here a mistake hands somebody the
 * frame, and several of the rules only apply in states that take a few shots to
 * reach - which is exactly what a synthetic event log is for.
 */
suite('eight-ball', () => {
  const pottedIn = (ball: number, pocket: PocketId): ShotEvent => ({
    kind: 'pocketed',
    t: 0.5,
    ball,
    pocket,
  });

  /** A state with groups already handed out: team 0 solids, team 1 stripes. */
  function withGroups(players = 2, called = false): EightState {
    const state = createEightState(players, names(players), [], called);
    return {
      ...state,
      teams: [
        { id: 0, group: 'solids' },
        { id: 1, group: 'stripes' },
      ],
      // Past the break, so break-only exemptions do not apply.
      shotsTaken: 3,
    };
  }

  test('the eight belongs to neither group', () => {
    assertEqual(groupOf(8), null, 'the black');
    assertEqual(groupOf(1), 'solids', 'the one');
    assertEqual(groupOf(7), 'solids', 'the seven');
    assertEqual(groupOf(9), 'stripes', 'the nine');
    assertEqual(groupOf(15), 'stripes', 'the fifteen');
  });

  test('seats alternate sides, so partners never shoot back to back', () => {
    // Four players: A B A B. Three: A B A, the 2v1.
    assertEqual([0, 1, 2, 3].map(teamOf).join(''), '0101', 'four players');
    assertEqual([0, 1, 2].map(teamOf).join(''), '010', 'three players');
  });

  test('the first ball potted after the break claims the table', () => {
    const world = worldWith([1, 2, 9, 10], [1]);
    const state = { ...createEightState(2, names(2)), shotsTaken: 2 };
    const { state: next } = resolveEightShot(state, world, [hit(0, 1), pot(1)]);

    assertEqual(next.teams[0].group, 'solids', 'shooter took solids');
    assertEqual(next.teams[1].group, 'stripes', 'the other side gets stripes');
    assertEqual(next.current, 0, 'and keeps the table');
  });

  test('the break itself claims nothing', () => {
    const world = worldWith([1, 2, 9, 10], [1]);
    const { state: next } = resolveEightShot(createEightState(2, names(2)), world, [
      hit(0, 1),
      pot(1),
    ]);

    assertEqual(next.teams[0].group, null, 'table still open');
    assertEqual(next.teams[1].group, null, 'both sides open');
  });

  test('potting your own group keeps you at the table', () => {
    const world = worldWith([2, 9], [1]);
    const { state: next, outcome } = resolveEightShot(withGroups(), world, [hit(0, 1), pot(1)]);

    assertEqual(outcome.turnPassed, false, 'turn passed');
    assertEqual(next.current, 0, 'same shooter');
  });

  test('potting the other side ball does not buy a shot', () => {
    // Legal contact on a solid first, but only a stripe dropped.
    const world = worldWith([1, 10], [9]);
    const { state: next, outcome } = resolveEightShot(withGroups(), world, [
      hit(0, 1),
      rail(9),
      pot(9),
    ]);

    assertEqual(outcome.foul, false, 'not a foul in bar rules');
    assertEqual(outcome.turnPassed, true, 'but the turn goes over');
    assertEqual(next.current, 1, 'to the opponent');
  });

  test('hitting the other group first is a foul', () => {
    const world = worldWith([1, 9]);
    const { outcome } = resolveEightShot(withGroups(), world, [hit(0, 9), rail(9)]);

    assertEqual(outcome.foul, true, 'foul');
    assertEqual(outcome.turnPassed, true, 'turn over');
  });

  test('hitting the black first while still on a group is a foul', () => {
    const world = worldWith([1, 8]);
    const { outcome } = resolveEightShot(withGroups(), world, [hit(0, 8), rail(8)]);

    assertEqual(outcome.foul, true, 'foul');
  });

  test('the black is the only legal contact once your group is clear', () => {
    // Team 0 has no solids left, so the eight is what they must hit.
    const world = worldWith([8, 9, 10]);
    const { outcome } = resolveEightShot(withGroups(), world, [hit(0, 8), rail(8)]);

    assertEqual(outcome.foul, false, 'hitting the black is now legal');
  });

  test('potting the black on time wins for the team', () => {
    const world = worldWith([9, 10], [8]);
    const { state: next, outcome } = resolveEightShot(withGroups(), world, [hit(0, 8), pot(8)]);

    assertEqual(outcome.gameOver, true, 'game over');
    assertEqual(next.winners.join(','), '0', 'shooting team wins');
  });

  test('potting the black early loses, on the break as much as later', () => {
    const world = worldWith([1, 2, 9], [8]);

    // Mid-game, group not yet cleared.
    const early = resolveEightShot(withGroups(), world, [hit(0, 1), pot(8)]);
    assertEqual(early.outcome.gameOver, true, 'game over');
    assertEqual(early.state.winners.join(','), '1', 'the other team wins');

    // And on the break, where some rule sets would respot it.
    const onBreak = resolveEightShot(createEightState(2, names(2)), world, [hit(0, 1), pot(8)]);
    assertEqual(onBreak.state.winners.join(','), '1', 'the other team wins on the break too');
  });

  test('knocking the black off the table loses as well', () => {
    const world = worldWith([9, 10]);
    const { state: next, outcome } = resolveEightShot(withGroups(), world, [
      hit(0, 8),
      { kind: 'off-table', t: 0.6, ball: 8, speed: 3, x: 0, y: 0 },
    ]);

    assertEqual(outcome.gameOver, true, 'game over');
    assertEqual(next.winners.join(','), '1', 'the other team wins');
  });

  test('a 2v1 puts two seats on one side', () => {
    const state = createEightState(3, names(3));
    assertEqual(state.players.map((p) => p.team).join(''), '010', 'A B A');
  });

  test('in the called game a pot in the wrong pocket does not count', () => {
    const world = worldWith([2, 9], [1]);
    const state = { ...withGroups(2, true), call: { ball: 1, pocket: 'corner-ne' as PocketId } };

    const { outcome } = resolveEightShot(state, world, [hit(0, 1), pottedIn(1, 'corner-sw')]);

    assertEqual(outcome.turnPassed, true, 'turn goes over');
  });

  test('in the called game the named pot keeps the turn', () => {
    const world = worldWith([2, 9], [1]);
    const state = { ...withGroups(2, true), call: { ball: 1, pocket: 'corner-ne' as PocketId } };

    const { outcome } = resolveEightShot(state, world, [hit(0, 1), pottedIn(1, 'corner-ne')]);

    assertEqual(outcome.turnPassed, false, 'shooter continues');
  });

  test('a call is consumed by the shot it was made for', () => {
    const world = worldWith([2, 9], [1]);
    const state = { ...withGroups(2, true), call: { ball: 1, pocket: 'corner-ne' as PocketId } };
    const { state: next } = resolveEightShot(state, world, [hit(0, 1), pottedIn(1, 'corner-ne')]);

    assertEqual(next.call, null, 'call cleared');
  });

  test('scratching is a foul and asks for the cue ball back', () => {
    const world = worldWith([1, 9]);
    const { outcome } = resolveEightShot(withGroups(), world, [
      hit(0, 1),
      { kind: 'pocketed', t: 0.5, ball: 0, pocket: 'side-n' },
    ]);

    assertEqual(outcome.foul, true, 'foul');
    assertEqual(outcome.cueBallNeedsRespot, true, 'cue ball comes back');
    assertEqual(outcome.turnPassed, true, 'turn over');
  });
});


// ------------------------------------------------------------------- 14.1

/**
 * Straight pool, where the interesting rule is what happens when the table runs
 * out rather than what happens when a ball drops.
 *
 * The re-rack is the whole game: a run that survives the table emptying is what
 * a hundred-point run is made of, and it is the one rule that has no counterpart
 * in either of the other modes.
 */
suite('straight pool', () => {
  const potIn = (ball: number, pocket: PocketId): ShotEvent => ({
    kind: 'pocketed',
    t: 0.5,
    ball,
    pocket,
  });

  /** A state past the break, with a call already made for `ball`. */
  function calling(ball: number, pocket: PocketId = 'corner-ne', players = 2): StraightState {
    return {
      ...createStraightState(players, names(players)),
      call: { ball, pocket },
      shotsTaken: 4,
    };
  }

  test('the called ball scores and keeps the turn', () => {
    const world = worldWith([2, 3], [1]);
    const { state: next, outcome } = resolveStraightShot(calling(1), world, [
      hit(0, 1),
      potIn(1, 'corner-ne'),
    ]);

    assertEqual(next.players[0].score, 1, 'score');
    assertEqual(next.players[0].run, 1, 'run');
    assertEqual(outcome.turnPassed, false, 'shooter continues');
  });

  test('a ball in the wrong pocket stays down but scores nothing', () => {
    const world = worldWith([2, 3], [1]);
    const { state: next, outcome } = resolveStraightShot(calling(1), world, [
      hit(0, 1),
      potIn(1, 'side-s'),
    ]);

    assertEqual(next.players[0].score, 0, 'no score');
    assertEqual(outcome.turnPassed, true, 'turn goes over');
  });

  test('a run carries across pots and is remembered at its best', () => {
    let state = calling(1);
    let world = worldWith([2, 3], [1]);
    state = resolveStraightShot(state, world, [hit(0, 1), potIn(1, 'corner-ne')]).state;

    state = { ...state, call: { ball: 2, pocket: 'corner-ne' } };
    world = worldWith([3], [1, 2]);
    state = resolveStraightShot(state, world, [hit(0, 2), potIn(2, 'corner-ne')]).state;

    assertEqual(state.players[0].run, 2, 'run of two');
    assertEqual(state.players[0].bestRun, 2, 'best run');

    // Now a miss: the run ends but the best is kept.
    state = { ...state, call: { ball: 3, pocket: 'corner-ne' } };
    world = worldWith([3], [1, 2]);
    state = resolveStraightShot(state, world, [hit(0, 3), rail(3)]).state;

    assertEqual(state.players[0].run, 0, 'run reset');
    assertEqual(state.players[0].bestRun, 2, 'best run kept');
  });

  test('one ball left asks for the fourteen to be racked again', () => {
    // Fourteen are down; the fifteenth is the break ball.
    const world = worldWith([15], Array.from({ length: 14 }, (_, i) => i + 1));
    const { state: next } = resolveStraightShot(calling(14), world, [
      hit(0, 14),
      potIn(14, 'corner-ne'),
    ]);

    assertEqual(next.needsRerack, true, 'rack the fourteen');
  });

  test('a table with balls on it is not racked', () => {
    const world = worldWith([2, 3, 4], [1]);
    const { state: next } = resolveStraightShot(calling(1), world, [
      hit(0, 1),
      potIn(1, 'corner-ne'),
    ]);

    assertEqual(next.needsRerack, false, 'no rack yet');
  });

  test('clearing the table entirely still asks for a rack', () => {
    const world = worldWith([], Array.from({ length: 15 }, (_, i) => i + 1));
    const { state: next } = resolveStraightShot(calling(15), world, [
      hit(0, 15),
      potIn(15, 'corner-ne'),
    ]);

    assertEqual(next.needsRerack, true, 'a full rack goes up');
  });

  test('a run survives the re-rack', () => {
    const world = worldWith([15], Array.from({ length: 14 }, (_, i) => i + 1));
    const state = { ...calling(14), players: [{ ...createStraightState(1, names(1)).players[0], score: 6, run: 6, bestRun: 6 }] };

    const { state: next } = resolveStraightShot(state, world, [hit(0, 14), potIn(14, 'corner-ne')]);

    assertEqual(next.needsRerack, true, 'rack goes up');
    assertEqual(next.players[0].run, 7, 'and the run carries on');
  });

  test('a foul costs a point and ends the run', () => {
    const world = worldWith([1, 2]);
    const state = { ...calling(1), players: [{ ...createStraightState(1, names(1)).players[0], score: 5, run: 5, bestRun: 5 }] };

    const { state: next, outcome } = resolveStraightShot(state, world, [
      hit(0, 1),
      { kind: 'pocketed', t: 0.5, ball: 0, pocket: 'side-n' },
    ]);

    assertEqual(outcome.foul, true, 'foul');
    assertEqual(next.players[0].score, 4, 'a point off');
    assertEqual(next.players[0].run, 0, 'run over');
    assertEqual(next.players[0].bestRun, 5, 'best run kept');
  });

  test('reaching the target wins', () => {
    const world = worldWith([2, 3], [1]);
    const base = createStraightState(2, names(2));
    const state: StraightState = {
      ...base,
      call: { ball: 1, pocket: 'corner-ne' },
      shotsTaken: 20,
      players: [{ ...base.players[0], score: STRAIGHT_RULES.target - 1 }, base.players[1]],
    };

    const { state: next, outcome } = resolveStraightShot(state, world, [
      hit(0, 1),
      potIn(1, 'corner-ne'),
    ]);

    assertEqual(outcome.gameOver, true, 'game over');
    assertEqual(next.winners.join(','), '0', 'the shooter wins');
  });

  test('the break needs no call', () => {
    const world = worldWith([2, 3], [1]);
    const state = createStraightState(2, names(2));
    const { state: next } = resolveStraightShot(state, world, [hit(0, 1), potIn(1, 'corner-ne')]);

    assertEqual(next.players[0].score, 1, 'the ball counts');
  });
});

// ----------------------------------------------------------------------- puzzles

report();
