/**
 * Eight-ball: two groups, and the black last.
 *
 * The bar rules rather than the WPA book, with one option on top. Groups are
 * assigned by the first ball legally potted after the break; whoever clears
 * theirs may then shoot the eight; potting the eight early loses on the spot,
 * the break included. In the called variant the shooter must also name a ball
 * and a pocket, and a ball that drops anywhere else does not count.
 *
 * Unlike free play this has exactly two sides, which is what makes teams
 * possible: two groups, two teams, however many people are sitting round the
 * table. Three players is 2v1 — lopsided, and asked for deliberately.
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

/** The black. Neither group owns it until one of them has cleared. */
export const EIGHT = 8;

export type Group = 'solids' | 'stripes';

/** Which group a ball belongs to. The eight belongs to neither. */
export function groupOf(ball: number): Group | null {
  if (ball < 1 || ball > 15 || ball === EIGHT) return null;
  return ball < EIGHT ? 'solids' : 'stripes';
}

export interface EightPlayer {
  id: number;
  name: string;
  /**
   * Which side of the table this seat plays for.
   *
   * Two teams, always — in a singles game each is a team of one, which keeps
   * one code path instead of two. Groups are held by the team, not the player:
   * partners share a group by definition.
   */
  team: number;
  cpu?: Difficulty;
}

export interface EightTeam {
  id: number;
  /** `null` until the table is claimed by the first ball legally potted. */
  group: Group | null;
}

/** What the shooter said they were going to do, in the called variant. */
export interface Call {
  ball: number;
  pocket: PocketId;
}

export interface EightState {
  players: EightPlayer[];
  teams: EightTeam[];
  /** Index into `players`. */
  current: number;
  /**
   * Whether a pot has to be named before it counts.
   *
   * A property of the game rather than of the state it produces, but it lives
   * here because the resolver needs it and the resolver is handed only state.
   */
  called: boolean;
  /** The call for the shot about to be taken, in the called variant. */
  call: Call | null;
  lastShotWasFoul: boolean;
  finished: boolean;
  /** Team ids — a team, not a player, wins an eight-ball game. */
  winners: number[];
  shotsTaken: number;
}

/**
 * How the seats divide into sides.
 *
 * Alternating rather than split down the middle: with four players the order
 * round the table is A, B, A, B, so partners are never consecutive and the turn
 * passes to an opponent every time. With three that gives A, B, A — the 2v1 that
 * was asked for, team A taking two seats of the three.
 */
export function teamOf(seat: number): number {
  return seat % 2;
}

export function createEightState(
  playerCount: number,
  names: string[],
  cpus: (Difficulty | undefined)[] = [],
  called = false,
): EightState {
  const count = Math.max(2, Math.min(8, Math.floor(playerCount)));

  const players: EightPlayer[] = Array.from({ length: count }, (_, i) => ({
    id: i,
    name: names[i]?.trim() || `#${i + 1}`,
    team: teamOf(i),
    cpu: cpus[i],
  }));

  return {
    players,
    teams: [
      { id: 0, group: null },
      { id: 1, group: null },
    ],
    current: 0,
    called,
    call: null,
    lastShotWasFoul: false,
    finished: false,
    winners: [],
    shotsTaken: 0,
  };
}

export function currentEightPlayer(state: EightState): EightPlayer {
  return state.players[state.current];
}

/** The group the seat now shooting is on, or `null` while the table is open. */
export function groupFor(state: EightState, seat: number): Group | null {
  const player = state.players[seat];
  return state.teams[player.team]?.group ?? null;
}

/** Whether a team has potted everything in its group and may shoot the eight. */
export function onTheEight(state: EightState, world: World, team: number): boolean {
  const group = state.teams[team]?.group;
  if (!group) return false;
  return !world.remainingObjectBalls().some((ball) => groupOf(ball.number) === group);
}

/**
 * Applies one settled shot.
 *
 * Reads the world, never writes it — respotting and re-racking are the session's
 * job, exactly as in free play.
 */
export function resolveEightShot(
  state: EightState,
  world: World,
  events: ShotEvent[],
): { state: EightState; outcome: ShotOutcome } {
  const outcome = emptyOutcome();
  if (state.finished) return { state, outcome };

  const potted = pocketedObjectBalls(events);
  const scratched = cueBallPocketed(events);
  const contacted = firstBallHitByCue(events);
  const flewOff = offTableNumbers(events);

  outcome.pocketed = potted;
  outcome.ballsLeftTable = flewOff;

  const players = state.players.map((p) => ({ ...p }));
  const teams = state.teams.map((t) => ({ ...t }));
  const shooter = players[state.current];
  const myTeam = shooter.team;
  const isBreak = state.shotsTaken === 0;

  /*
   * Whether the eight was fair game.
   *
   * Taken before the balls are counted, because `world` is the table as it now
   * stands: after a shot that cleared the last of a group, `onTheEight` is true
   * even though it was false when the shooter drew back. The question the rules
   * ask is whether they were on it *when they shot*.
   */
  const groupBefore = teams[myTeam].group;
  // The table as it stood before the shot: what is left, plus what this shot
  // took off it.
  const beforeShot = world
    .remainingObjectBalls()
    .map((ball) => ball.number)
    .concat(potted);
  const wasOnTheEight =
    groupBefore !== null && !beforeShot.some((number) => groupOf(number) === groupBefore);

  // -------------------------------------------------------------------- fouls

  if (scratched) {
    outcome.foul = true;
    outcome.foulReason = msg('rules.foulScratch');
  } else if (flewOff.filter((n) => n !== EIGHT).length > 0) {
    outcome.foul = true;
    outcome.foulReason =
      flewOff.length === 1
        ? msg('rules.foulOffTable')
        : msg('rules.foulOffTableMany', { count: flewOff.length });
  } else if (contacted === null) {
    outcome.foul = true;
    outcome.foulReason = msg('rules.foulNoContact');
  } else if (!isBreak && !isLegalFirstContact(state, world, contacted, myTeam, potted)) {
    // Hitting the other side's ball first, or the eight while still on a group.
    outcome.foul = true;
    outcome.foulReason =
      contacted === EIGHT
        ? msg('rules.foulEightFirst')
        : msg('rules.foulWrongGroup');
  } else if (potted.length === 0 && !cushionReachedAfterContact(events)) {
    outcome.foul = true;
    outcome.foulReason = msg('rules.foulNoRail');
  }

  // ------------------------------------------------------------ the black ball

  const pottedEight = potted.includes(EIGHT) || flewOff.includes(EIGHT);

  if (pottedEight) {
    /*
     * The eight decides the game, one way or the other.
     *
     * Legal only when the shooter's group was already clear before this shot,
     * the shot was not a foul, and — in the called variant — the pocket was the
     * one named. Anything else loses, on the break as much as at the end.
     */
    const calledCorrectly =
      !state.called || matchesCall(state.call, EIGHT, pocketOf(events, EIGHT));

    const won = wasOnTheEight && !outcome.foul && !flewOff.includes(EIGHT) && calledCorrectly;
    const winningTeam = won ? myTeam : otherTeam(myTeam);

    outcome.gameOver = true;
    outcome.turnPassed = false;
    outcome.messages.push(
      won
        ? msg('rules.eightWon', { name: shooter.name })
        : msg('rules.eightLost', { name: shooter.name }),
    );

    return {
      state: {
        ...state,
        players,
        teams,
        call: null,
        lastShotWasFoul: outcome.foul,
        finished: true,
        winners: [winningTeam],
        shotsTaken: state.shotsTaken + 1,
      },
      outcome,
    };
  }

  // ------------------------------------------------------------------- groups

  /*
   * The table is claimed by the first ball legally potted after the break.
   *
   * Not on the break itself: a break that drops one of each says nothing about
   * who wanted what, and every bar in the country plays the table open until
   * somebody pots on a normal shot.
   */
  let claimed: Group | null = null;
  if (teams[myTeam].group === null && !isBreak && !outcome.foul) {
    const legal = potted.filter((n) => n !== EIGHT);
    const named = state.called
      ? legal.filter((n) => matchesCall(state.call, n, pocketOf(events, n)))
      : legal;
    const first = named[0] ?? null;
    claimed = first === null ? null : groupOf(first);

    if (claimed) {
      teams[myTeam].group = claimed;
      teams[otherTeam(myTeam)].group = claimed === 'solids' ? 'stripes' : 'solids';
      outcome.messages.push(
        msg(claimed === 'solids' ? 'rules.tookSolids' : 'rules.tookStripes', {
          name: shooter.name,
        }),
      );
    }
  }

  // -------------------------------------------------------------- keeping on

  const myGroup = teams[myTeam].group;

  /*
   * Which of the potted balls actually count as the shooter's.
   *
   * While the table is open nothing counts towards keeping the turn except a
   * ball that claimed it, which `claimed` already covers. Once groups are set,
   * only the shooter's own group earns another visit — dropping an opponent's
   * ball is not a foul in bar rules, but it does not buy a shot either.
   */
  const mine = potted.filter((n) => n !== EIGHT && groupOf(n) === myGroup);
  /*
   * In the called game both halves of the call have to come true.
   *
   * Ball *and* pocket — checking only the number was the bug: the named ball
   * rattling into a different pocket is precisely the shot the called variant
   * exists to disallow, and it was being counted as a clean pot.
   */
  const counted = state.called
    ? mine.filter((n) => matchesCall(state.call, n, pocketOf(events, n)))
    : mine;

  if (potted.length > 0) {
    outcome.messages.push(
      potted.length === 1
        ? msg('rules.potted', { name: shooter.name })
        : msg('rules.pottedMany', { name: shooter.name, count: potted.length }),
    );
  }

  if (outcome.foul) {
    outcome.messages.push(
      msg('rules.foulTurnOver', { reason: outcome.foulReason ?? msg('rules.foulNoContact') }),
    );
    outcome.cueBallNeedsRespot = scratched || flewOff.includes(0);
  }

  const keepsTurn = !outcome.foul && (counted.length > 0 || claimed !== null);
  outcome.turnPassed = !keepsTurn;

  let current = state.current;
  if (!keepsTurn) {
    current = nextSeat(state, players);
    outcome.messages.push(msg('rules.turnTo', { name: players[current].name }));
  } else {
    outcome.messages.push(msg('rules.keepShooting'));
  }

  return {
    state: {
      ...state,
      players,
      teams,
      current,
      // Consumed: a call belongs to the shot it was made for, and carrying it
      // into the next one would silently hold somebody to a pocket they named
      // several shots ago.
      call: null,
      lastShotWasFoul: outcome.foul,
      finished: false,
      winners: [],
      shotsTaken: state.shotsTaken + 1,
    },
    outcome,
  };
}

function otherTeam(team: number): number {
  return team === 0 ? 1 : 0;
}

/**
 * The next seat, skipping nobody.
 *
 * Seats alternate teams, so plain rotation already hands the table to an
 * opponent in the 2v2 and 1v1 cases. In the 2v1 it gives A, B, A, B… — the lone
 * player shooting every second visit against the pair's every fourth, which is
 * the lopsidedness that comes with the format.
 */
function nextSeat(state: EightState, players: EightPlayer[]): number {
  return (state.current + 1) % players.length;
}

/**
 * Whether the cue ball struck something it was allowed to strike first.
 *
 * While the table is open anything but the eight is fair. Once groups are set
 * it must be the shooter's own — except when they are on the eight, when the
 * eight is the only legal first contact.
 */
function isLegalFirstContact(
  state: EightState,
  world: World,
  contacted: number,
  team: number,
  potted: number[],
): boolean {
  const group = state.teams[team].group;
  if (group === null) return contacted !== EIGHT;

  // Everything of theirs that was on the table when the shot was played: the
  // world has already had this shot's pots removed, so they go back in.
  const beforeShot = world
    .remainingObjectBalls()
    .map((b) => b.number)
    .concat(potted);
  const anyLeft = beforeShot.some((n) => groupOf(n) === group);

  return anyLeft ? groupOf(contacted) === group : contacted === EIGHT;
}

function matchesCall(call: Call | null, ball: number, pocket: PocketId | null): boolean {
  if (!call) return false;
  return call.ball === ball && pocket !== null && call.pocket === pocket;
}
