/**
 * One face over the four rulesets.
 *
 * Each mode keeps its own state shape, because they genuinely differ: eight-ball
 * has teams and groups and no score, straight pool has runs and a target, free
 * play has neither. Flattening them into one struct with everything optional
 * would make every field a question.
 *
 * What they do share is the shape of the conversation with the rest of the app:
 * start a match, resolve a settled shot, say who is at the table and how it
 * stands. That is what this is — a tagged union and the handful of functions the
 * session and the HUD need, so neither has to know which discipline is running.
 */

import type { Difficulty } from '../ai/opponent';
import type { PocketId } from '../core/table';
import type { ShotEvent } from '../core/events';
import type { World } from '../core/world';

import {
  createEightState,
  groupOf,
  resolveEightShot,
  type EightState,
} from './eight-ball';
import { createFreeState, resolveFreeShot, type FreeState } from './free';
import {
  createStraightState,
  resolveStraightShot,
  type StraightState,
} from './straight-pool';
import {
  GameModeKind,
  modeIsCalled,
  type ShotOutcome,
  type Standing,
} from './types';

/**
 * A game in progress, tagged by its discipline.
 *
 * The tag is what makes the switches below exhaustive: adding a fifth mode
 * without handling it here is a type error rather than a silent fall-through.
 */
export type Match =
  | { kind: typeof GameModeKind.FREE; state: FreeState }
  | { kind: typeof GameModeKind.EIGHT; state: EightState }
  | { kind: typeof GameModeKind.EIGHT_CALLED; state: EightState }
  | { kind: typeof GameModeKind.STRAIGHT; state: StraightState };

export interface MatchSetup {
  kind: Match['kind'];
  playerCount: number;
  names: string[];
  cpus?: (Difficulty | undefined)[];
}

export function createMatch({ kind, playerCount, names, cpus = [] }: MatchSetup): Match {
  switch (kind) {
    case GameModeKind.EIGHT:
      return { kind, state: createEightState(playerCount, names, cpus, false) };
    case GameModeKind.EIGHT_CALLED:
      return { kind, state: createEightState(playerCount, names, cpus, true) };
    case GameModeKind.STRAIGHT:
      return { kind, state: createStraightState(playerCount, names, cpus) };
    case GameModeKind.FREE:
    default:
      return { kind: GameModeKind.FREE, state: createFreeState(playerCount, names, cpus) };
  }
}

export function resolveShot(
  match: Match,
  world: World,
  events: ShotEvent[],
): { match: Match; outcome: ShotOutcome } {
  switch (match.kind) {
    case GameModeKind.EIGHT:
    case GameModeKind.EIGHT_CALLED: {
      const { state, outcome } = resolveEightShot(match.state, world, events);
      return { match: { kind: match.kind, state }, outcome };
    }
    case GameModeKind.STRAIGHT: {
      const { state, outcome } = resolveStraightShot(match.state, world, events);
      return { match: { kind: match.kind, state }, outcome };
    }
    case GameModeKind.FREE:
    default: {
      const { state, outcome } = resolveFreeShot(match.state, world, events);
      return { match: { kind: GameModeKind.FREE, state }, outcome };
    }
  }
}

/** Whose turn it is, as a seat index. */
export function currentSeat(match: Match): number {
  return match.state.current;
}

export function isFinished(match: Match): boolean {
  return match.state.finished;
}

export function shotsTaken(match: Match): number {
  return match.state.shotsTaken;
}

/** Which computer is in the seat now shooting, or `undefined` for a person. */
export function currentCpu(match: Match): Difficulty | undefined {
  return match.state.players[match.state.current]?.cpu;
}

export function playerCount(match: Match): number {
  return match.state.players.length;
}

/** The name in a seat, for the HUD and the trophy detector. */
export function seatName(match: Match, seat: number): string {
  return match.state.players[seat]?.name ?? '';
}

/**
 * The scoreboard, in one shape whatever produced it.
 *
 * The current seat is marked here rather than left for the caller to work out,
 * because "which row is lit" is the one thing every renderer of this needs and
 * the one most easily got wrong by comparing the wrong index.
 */
export function standings(match: Match): Standing[] {
  switch (match.kind) {
    case GameModeKind.EIGHT:
    case GameModeKind.EIGHT_CALLED:
      return match.state.players.map((player) => ({
        id: player.id,
        name: player.name,
        team: player.team,
        group: match.state.teams[player.team]?.group ?? null,
        isCurrent: player.id === match.state.current,
        cpu: player.cpu !== undefined,
      }));

    case GameModeKind.STRAIGHT:
      return match.state.players.map((player) => ({
        id: player.id,
        name: player.name,
        score: player.score,
        run: player.run,
        isCurrent: player.id === match.state.current,
        cpu: player.cpu !== undefined,
      }));

    case GameModeKind.FREE:
    default:
      return match.state.players.map((player) => ({
        id: player.id,
        name: player.name,
        score: player.score,
        isCurrent: player.id === match.state.current,
        cpu: player.cpu !== undefined,
      }));
  }
}

/**
 * Who won, as seat indices.
 *
 * Eight-ball records the winning *team*, so it is expanded back into the seats
 * on that team: the results screen names people, not sides, and a team of one is
 * the singles case falling out for free.
 */
export function winningSeats(match: Match): number[] {
  if (match.kind === GameModeKind.EIGHT || match.kind === GameModeKind.EIGHT_CALLED) {
    const teams = match.state.winners;
    return match.state.players.filter((p) => teams.includes(p.team)).map((p) => p.id);
  }
  return match.state.winners;
}

/** Whether this match wants a ball and pocket named before each shot. */
export function needsCall(match: Match): boolean {
  return modeIsCalled(match.kind);
}

/** The call standing for the shot about to be played, if any. */
export function currentCall(match: Match): { ball: number; pocket: PocketId } | null {
  if (match.kind === GameModeKind.FREE) return null;
  return match.state.call;
}

/** Records what the shooter says they are going to do. */
export function withCall(match: Match, call: { ball: number; pocket: PocketId } | null): Match {
  switch (match.kind) {
    case GameModeKind.EIGHT:
    case GameModeKind.EIGHT_CALLED:
      return { kind: match.kind, state: { ...match.state, call } };
    case GameModeKind.STRAIGHT:
      return { kind: match.kind, state: { ...match.state, call } };
    default:
      return match;
  }
}

/** Whether straight pool wants the fourteen put back up before the next shot. */
export function wantsRerack(match: Match): boolean {
  return match.kind === GameModeKind.STRAIGHT && match.state.needsRerack;
}

/** Clears the re-rack request once the session has acted on it. */
export function rerackDone(match: Match): Match {
  if (match.kind !== GameModeKind.STRAIGHT) return match;
  return { kind: match.kind, state: { ...match.state, needsRerack: false } };
}

/**
 * Which balls the seat now shooting is allowed to aim at.
 *
 * `null` means anything on the table — free play, straight pool, and eight-ball
 * before the groups are handed out. Otherwise it is the shooter's own group, or
 * just the black once that group is clear. The computer needs this to pick a
 * target, and the aim helpers need it to know what to draw a line to.
 */
export function legalTargets(match: Match, world: World): number[] | null {
  if (match.kind !== GameModeKind.EIGHT && match.kind !== GameModeKind.EIGHT_CALLED) {
    return null;
  }

  const shooter = match.state.players[match.state.current];
  const group = match.state.teams[shooter.team]?.group ?? null;
  if (!group) return null;

  const onTable = world.remainingObjectBalls().map((ball) => ball.number);
  const mine = onTable.filter((number) => groupOf(number) === group);
  return mine.length > 0 ? mine : onTable.filter((number) => number === 8);
}

/**
 * Seats on the same side as the one shooting, excluding itself.
 *
 * Empty in every mode but eight-ball, and empty there too in singles. The
 * computer reads it so it does not play a safety against its own partner, which
 * is the kind of mistake that is obvious to a person watching and invisible to
 * an evaluator that only counts pots.
 */
export function partnersOf(match: Match, seat: number): number[] {
  if (match.kind !== GameModeKind.EIGHT && match.kind !== GameModeKind.EIGHT_CALLED) {
    return [];
  }
  const team = match.state.players[seat]?.team;
  if (team === undefined) return [];
  return match.state.players.filter((p) => p.id !== seat && p.team === team).map((p) => p.id);
}
