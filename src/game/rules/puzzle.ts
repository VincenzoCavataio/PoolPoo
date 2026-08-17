/**
 * Puzzle mode: a fixed layout, a shot budget, and an objective.
 *
 * Objectives are *data*, not code — a goal plus a list of constraints, each
 * evaluated against the shot event log. Adding "pot the 5 off two rails
 * without touching the 8" is then a new level entry rather than a new branch
 * in the game loop, and every level is checkable by the solver in the tests.
 */

import {
  cueBallPocketed,
  cushionsBeforeFirstPot,
  firstBallHitByCue,
  pocketedObjectBalls,
  type ShotEvent,
} from '../core/events';
import type { PocketId } from '../core/table';
import type { BallLayout, World } from '../core/world';
import { emptyOutcome, type ShotOutcome } from './types';

export type PuzzleGoal =
  | { kind: 'pocket-all' }
  | { kind: 'pocket-set'; numbers: number[] }
  | { kind: 'pocket-in-order'; numbers: number[] }
  | { kind: 'pocket-into'; number: number; pocket: PocketId };

export type PuzzleConstraint =
  | { kind: 'no-cue-pocket' }
  | { kind: 'must-hit-first'; number: number }
  | { kind: 'forbid-pocket'; numbers: number[] }
  | { kind: 'cushions-before-pot'; count: number };

export interface PuzzleLevel {
  id: string;
  name: string;
  /** One line shown under the title, in Italian. */
  hint: string;
  maxShots: number;
  layout: BallLayout[];
  goal: PuzzleGoal;
  constraints: PuzzleConstraint[];
  /** Finish within `three` shots for three stars, `two` for two. */
  stars: { three: number; two: number };
}

export type PuzzleStatus = 'playing' | 'won' | 'failed';

export interface PuzzleState {
  levelId: string;
  shotsUsed: number;
  /** How far through an ordered goal the player has got. */
  orderIndex: number;
  status: PuzzleStatus;
  failReason: string | null;
  stars: number;
}

export function createPuzzleState(level: PuzzleLevel): PuzzleState {
  return {
    levelId: level.id,
    shotsUsed: 0,
    orderIndex: 0,
    status: 'playing',
    failReason: null,
    stars: 0,
  };
}

export function starsFor(level: PuzzleLevel, shotsUsed: number): number {
  if (shotsUsed <= level.stars.three) return 3;
  if (shotsUsed <= level.stars.two) return 2;
  return 1;
}

export function shotsLeft(level: PuzzleLevel, state: PuzzleState): number {
  return Math.max(0, level.maxShots - state.shotsUsed);
}

export function describeGoal(level: PuzzleLevel): string {
  const goal = level.goal;
  switch (goal.kind) {
    case 'pocket-all':
      return 'Imbuca tutte le palline';
    case 'pocket-set':
      return `Imbuca la ${goal.numbers.join(', la ')}`;
    case 'pocket-in-order':
      return `Imbuca in ordine: ${goal.numbers.join(' → ')}`;
    case 'pocket-into':
      return `Imbuca la ${goal.number} nella buca indicata`;
  }
}

/**
 * Applies one settled shot. `world` is read only; the caller respots the cue
 * ball if the outcome asks for it.
 */
export function resolvePuzzleShot(
  level: PuzzleLevel,
  state: PuzzleState,
  world: World,
  events: ShotEvent[],
): { state: PuzzleState; outcome: ShotOutcome } {
  const outcome = emptyOutcome();
  if (state.status !== 'playing') return { state, outcome };

  const potted = pocketedObjectBalls(events);
  outcome.pocketed = potted;

  const shotsUsed = state.shotsUsed + 1;
  let orderIndex = state.orderIndex;

  // Recorded as a reason and a flag, with the status derived once at the end.
  // Mutating a status variable through a closure also defeats TypeScript's
  // narrowing, which turned the later comparisons into "impossible" errors.
  let failure: string | null = null;
  let solved = false;

  const fail = (reason: string) => {
    if (failure === null && !solved) failure = reason;
  };

  // Constraints first: violating one loses the level even on a shot that would
  // otherwise have completed the goal.
  for (const constraint of level.constraints) {
    if (failure !== null) break;

    switch (constraint.kind) {
      case 'no-cue-pocket':
        if (cueBallPocketed(events)) fail('Bianca in buca');
        break;

      case 'must-hit-first': {
        const first = firstBallHitByCue(events);
        if (first !== constraint.number) {
          fail(
            first === null
              ? 'Non hai colpito nessuna pallina'
              : `Dovevi colpire prima la ${constraint.number}`,
          );
        }
        break;
      }

      case 'forbid-pocket': {
        const offender = potted.find((n) => constraint.numbers.includes(n));
        if (offender !== undefined) fail(`La ${offender} non doveva entrare`);
        break;
      }

      case 'cushions-before-pot':
        if (potted.length > 0 && cushionsBeforeFirstPot(events) < constraint.count) {
          fail(
            constraint.count === 1
              ? 'Serve almeno una sponda prima di imbucare'
              : `Servono almeno ${constraint.count} sponde prima di imbucare`,
          );
        }
        break;
    }
  }

  if (failure === null) {
    const goal = level.goal;
    switch (goal.kind) {
      case 'pocket-all':
        if (world.remainingObjectBalls().length === 0) solved = true;
        break;

      case 'pocket-set':
        if (goal.numbers.every((n) => world.ballByNumber(n)?.pocketed)) solved = true;
        break;

      case 'pocket-in-order': {
        for (const n of potted) {
          if (n !== goal.numbers[orderIndex]) {
            fail(`Fuori ordine: toccava alla ${goal.numbers[orderIndex]}`);
            break;
          }
          orderIndex += 1;
        }
        if (failure === null && orderIndex >= goal.numbers.length) solved = true;
        break;
      }

      case 'pocket-into': {
        const ball = world.ballByNumber(goal.number);
        if (ball?.pocketed) {
          if (ball.pocketedIn === goal.pocket) solved = true;
          else fail('Buca sbagliata');
        }
        break;
      }
    }
  }

  if (failure === null && !solved && shotsUsed >= level.maxShots) {
    fail('Colpi esauriti');
  }

  const status: PuzzleStatus = failure !== null ? 'failed' : solved ? 'won' : 'playing';
  const failReason = failure;
  const stars = status === 'won' ? starsFor(level, shotsUsed) : 0;

  if (potted.length > 0) {
    outcome.messages.push(
      potted.length === 1 ? `Imbucata la ${potted[0]}` : `Imbucate ${potted.length} palline`,
    );
  }
  if (status === 'won') {
    outcome.messages.push(`Risolto in ${shotsUsed} ${shotsUsed === 1 ? 'colpo' : 'colpi'}`);
  } else if (status === 'failed') {
    outcome.messages.push(failReason ?? 'Puzzle fallito');
  }

  outcome.gameOver = status !== 'playing';
  outcome.foul = status === 'failed';
  outcome.foulReason = failReason;
  outcome.turnPassed = false;
  outcome.cueBallNeedsRespot = cueBallPocketed(events) && status === 'playing';

  return {
    state: { levelId: state.levelId, shotsUsed, orderIndex, status, failReason, stars },
    outcome,
  };
}
