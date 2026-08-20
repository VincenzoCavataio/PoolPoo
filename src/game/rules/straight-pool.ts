/**
 * Straight pool (14.1 continuous): every ball is worth one, called, to a target.
 *
 * The distinguishing rule is in the name. When one ball is left the other
 * fourteen are racked again and play carries on from wherever the cue ball and
 * that last ball happen to lie — so a run does not end when the table empties,
 * and a good one crosses several racks. That is the whole character of the game,
 * and it is what makes a target of a hundred reachable at all.
 *
 * Individual, not team: there are no groups to divide, so several players is
 * several scores. It scales the way free play does, and for the same reason.
 *
 * Every pot is called, which is not optional here as it is in eight-ball —
 * without it the game is a scramble and safety play stops meaning anything.
 */

import {
  cueBallPocketed,
  cushionReachedAfterContact,
  firstBallHitByCue,
  offTableNumbers,
  pocketedObjectBalls,
  pocketOf,
  type ShotEvent,
} from '../core/events';
import { msg } from '@/i18n';

import type { Difficulty } from '../ai/opponent';
import type { PocketId } from '../core/table';
import type { World } from '../core/world';
import { emptyOutcome, type ShotOutcome } from './types';

export const STRAIGHT_RULES = {
  /**
   * Where a game is won.
   *
   * The professional game plays to 100 or 150. That is a long evening on a
   * phone, and simulating computer games at 50 showed why: two medium opponents
   * traded roughly eight points every twenty-five visits, which puts a fifty-up
   * game past a hundred and fifty shots. Twenty-five still crosses the rack —
   * the re-rack is the whole reason to play 14.1, and a game that never reaches
   * it is 14.1 in name only — while finishing in a sitting.
   */
  target: 25,
  foulPenalty: 1,
  /** Balls left on the table when the rest are racked again. */
  breakBall: 1,
} as const;

export interface StraightPlayer {
  id: number;
  name: string;
  score: number;
  /** Balls potted without missing, across re-racks. The number 14.1 is about. */
  run: number;
  /** The best run of the game, kept because it is the stat players care about. */
  bestRun: number;
  cpu?: Difficulty;
}

/** What the shooter said they were going to do. Always required here. */
export interface Call {
  ball: number;
  pocket: PocketId;
}

export interface StraightState {
  players: StraightPlayer[];
  current: number;
  call: Call | null;
  lastShotWasFoul: boolean;
  finished: boolean;
  winners: number[];
  shotsTaken: number;
  /**
   * Whether the table needs the fourteen racked again before the next shot.
   *
   * Reported rather than done: like every other consequence in this layer, the
   * session applies it. The rules only read the world.
   */
  needsRerack: boolean;
  target: number;
}

export function createStraightState(
  playerCount: number,
  names: string[],
  cpus: (Difficulty | undefined)[] = [],
  target: number = STRAIGHT_RULES.target,
): StraightState {
  const count = Math.max(1, Math.min(8, Math.floor(playerCount)));

  return {
    players: Array.from({ length: count }, (_, i) => ({
      id: i,
      name: names[i]?.trim() || `#${i + 1}`,
      score: 0,
      run: 0,
      bestRun: 0,
      cpu: cpus[i],
    })),
    current: 0,
    call: null,
    lastShotWasFoul: false,
    finished: false,
    winners: [],
    shotsTaken: 0,
    needsRerack: false,
    target,
  };
}

export function currentStraightPlayer(state: StraightState): StraightPlayer {
  return state.players[state.current];
}

export function resolveStraightShot(
  state: StraightState,
  world: World,
  events: ShotEvent[],
): { state: StraightState; outcome: ShotOutcome } {
  const outcome = emptyOutcome();
  if (state.finished) return { state, outcome };

  const potted = pocketedObjectBalls(events);
  const scratched = cueBallPocketed(events);
  const contacted = firstBallHitByCue(events);
  const flewOff = offTableNumbers(events);

  outcome.pocketed = potted;
  outcome.ballsLeftTable = flewOff;

  const players = state.players.map((p) => ({ ...p }));
  const player = players[state.current];
  const isBreak = state.shotsTaken === 0;

  // -------------------------------------------------------------------- fouls

  if (scratched) {
    outcome.foul = true;
    outcome.foulReason = msg('rules.foulScratch');
  } else if (flewOff.length > 0) {
    outcome.foul = true;
    outcome.foulReason =
      flewOff.length === 1
        ? msg('rules.foulOffTable')
        : msg('rules.foulOffTableMany', { count: flewOff.length });
  } else if (contacted === null) {
    outcome.foul = true;
    outcome.foulReason = msg('rules.foulNoContact');
  } else if (potted.length === 0 && !cushionReachedAfterContact(events)) {
    outcome.foul = true;
    outcome.foulReason = msg('rules.foulNoRail');
  }

  // ------------------------------------------------------------------ scoring

  /*
   * Only the called ball scores, and only from the pocket it was called into.
   *
   * Everything else that dropped stays down — it is not returned to the table —
   * but it earns nothing. That asymmetry is deliberate in 14.1: a lucky ball is
   * still off the table, it just does not go on your score.
   *
   * The break is exempt from the call, because there is nothing sensible to
   * call: the opening shot is required to be a safety.
   */
  const called = isBreak
    ? potted
    : potted.filter((n) => matchesCall(state.call, n, pocketOf(events, n)));

  const scored = outcome.foul ? 0 : called.length;

  if (scored > 0) {
    player.score += scored;
    player.run += scored;
    if (player.run > player.bestRun) player.bestRun = player.run;
    outcome.messages.push(
      scored === 1
        ? msg('rules.gained', { name: player.name, count: 1 })
        : msg('rules.gainedMany', { name: player.name, points: scored, balls: scored }),
    );
  }

  if (outcome.foul) {
    player.score -= STRAIGHT_RULES.foulPenalty;
    // A run ends at a miss whether or not it was a foul; a foul also costs.
    player.run = 0;
    outcome.penalty = STRAIGHT_RULES.foulPenalty;
    outcome.messages.push(
      msg('rules.foulPenalty', {
        reason: outcome.foulReason ?? msg('rules.foulNoContact'),
        count: STRAIGHT_RULES.foulPenalty,
      }),
    );
    outcome.cueBallNeedsRespot = scratched || flewOff.includes(0);
  }

  // ------------------------------------------------------------- the re-rack

  /*
   * One ball left means the other fourteen go back up.
   *
   * The count is taken after this shot, from the world the session has already
   * updated — so a shot that pots the fourteenth leaves one on the cloth and
   * triggers the rack, which is exactly when it should happen.
   */
  const left = world.remainingObjectBalls().length;
  const needsRerack = left <= STRAIGHT_RULES.breakBall && left > 0;
  if (needsRerack) outcome.messages.push(msg('rules.rerack'));

  /*
   * An empty table is the corner the re-rack rule exists to avoid.
   *
   * It can still happen — potting the last two at once — and then there is no
   * break ball to carry the run on from. A full rack goes back up and the run
   * survives, which is the friendliest reading and the one that keeps the game
   * moving.
   */
  const needsFullRack = left === 0;
  if (needsFullRack) outcome.messages.push(msg('rules.rerackFull'));

  // -------------------------------------------------------------- turn and win

  const keepsTurn = !outcome.foul && scored > 0;
  outcome.turnPassed = !keepsTurn;
  if (!keepsTurn) player.run = 0;

  const reachedTarget = player.score >= state.target;

  let current = state.current;
  if (reachedTarget) {
    outcome.gameOver = true;
    outcome.messages.push(msg('rules.winsWith', { name: player.name, count: player.score }));
  } else if (!keepsTurn && players.length > 1) {
    current = (state.current + 1) % players.length;
    outcome.messages.push(msg('rules.turnTo', { name: players[current].name }));
  } else if (keepsTurn) {
    outcome.messages.push(msg('rules.keepShooting'));
  }

  return {
    state: {
      ...state,
      players,
      current,
      call: null,
      lastShotWasFoul: outcome.foul,
      finished: reachedTarget,
      winners: reachedTarget ? [player.id] : [],
      shotsTaken: state.shotsTaken + 1,
      needsRerack: needsRerack || needsFullRack,
    },
    outcome,
  };
}

function matchesCall(call: Call | null, ball: number, pocket: PocketId | null): boolean {
  if (!call) return false;
  return call.ball === ball && pocket !== null && call.pocket === pocket;
}
