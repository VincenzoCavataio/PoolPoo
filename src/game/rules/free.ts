/**
 * Free play: n players, one point per ball, keep shooting while you keep
 * potting.
 *
 * Chosen over 8-ball because it scales to any player count without changing
 * shape — with one player it is simply a high-score run, which is what makes
 * "1 to n players" a single code path rather than two.
 */

import {
  cueBallPocketed,
  cushionReachedAfterContact,
  firstBallHitByCue,
  offTableNumbers,
  pocketedObjectBalls,
  type ShotEvent,
} from '../core/events';
import { msg } from '@/i18n';

import type { World } from '../core/world';
import { emptyOutcome, type ShotOutcome } from './types';

export interface Player {
  id: number;
  /**
   * Supplied by the caller, never invented here.
   *
   * A default like "Player 3" is a translated string, and the rules have no
   * language. The screen that starts the game passes the names in.
   */
  name: string;
  score: number;
  ballsPocketed: number;
}

export interface FreeState {
  players: Player[];
  /** Index into `players`. */
  current: number;
  /** True when the last shot was a foul, so the HUD can say why. */
  lastShotWasFoul: boolean;
  finished: boolean;
  /** Ids of the winner(s) — plural on a tie. */
  winners: number[];
  shotsTaken: number;
}

export const FREE_RULES = {
  pointsPerBall: 1,
  foulPenalty: 1,
} as const;

/**
 * `names` is required because a default name is a translated string, and this
 * module has no language. The caller has the translator; it passes them in.
 */
export function createFreeState(playerCount: number, names: string[]): FreeState {
  const count = Math.max(1, Math.min(8, Math.floor(playerCount)));
  const players: Player[] = Array.from({ length: count }, (_, i) => ({
    id: i,
    name: names[i]?.trim() || `#${i + 1}`,
    score: 0,
    ballsPocketed: 0,
  }));

  return {
    players,
    current: 0,
    lastShotWasFoul: false,
    finished: false,
    winners: [],
    shotsTaken: 0,
  };
}

export function currentPlayer(state: FreeState): Player {
  return state.players[state.current];
}

/**
 * Applies one settled shot. Returns fresh state plus what the HUD should say;
 * `world` is only read.
 */
export function resolveFreeShot(
  state: FreeState,
  world: World,
  events: ShotEvent[],
): { state: FreeState; outcome: ShotOutcome } {
  const outcome = emptyOutcome();
  if (state.finished) return { state, outcome };

  const potted = pocketedObjectBalls(events);
  const scratched = cueBallPocketed(events);
  const contacted = firstBallHitByCue(events);
  const flewOff = offTableNumbers(events);

  outcome.pocketed = potted;
  outcome.ballsLeftTable = flewOff;

  // A miss with no contact at all is a foul, same as potting the cue ball.
  // Without this, a player could safely roll the cue ball nowhere forever.
  //
  // Driving a ball off the table is a foul too, and it outranks a plain miss
  // when reporting the reason: it is the more spectacular thing to have done,
  // and it is the one the player needs told.
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
    // WPA 8.6: after the cue ball touches an object ball, either a ball drops or
    // some ball has to reach a rail. This is what stops a player from tapping
    // the cue ball into the pack forever and never taking a risk.
    outcome.foul = true;
    outcome.foulReason = msg('rules.foulNoRail');
  }

  const players = state.players.map((p) => ({ ...p }));
  const player = players[state.current];

  if (potted.length > 0) {
    player.score += potted.length * FREE_RULES.pointsPerBall;
    player.ballsPocketed += potted.length;
    outcome.messages.push(
      potted.length === 1
        ? msg('rules.gained', { name: player.name, count: FREE_RULES.pointsPerBall })
        : msg('rules.gainedMany', {
            name: player.name,
            points: potted.length * FREE_RULES.pointsPerBall,
            balls: potted.length,
          }),
    );
  }

  if (outcome.foul) {
    player.score -= FREE_RULES.foulPenalty;
    outcome.messages.push(
      msg('rules.foulPenalty', {
        reason: outcome.foulReason ?? msg('rules.foulNoContact'),
        count: FREE_RULES.foulPenalty,
      }),
    );
    outcome.cueBallNeedsRespot = scratched || flewOff.includes(0);
  }

  // Potting earns another shot; a foul always ends the turn, even if the shot
  // also potted something.
  const keepsTurn = potted.length > 0 && !outcome.foul;
  outcome.turnPassed = !keepsTurn;

  const objectBallsLeft = world.remainingObjectBalls().length;
  const gameOver = objectBallsLeft === 0;

  let current = state.current;
  if (gameOver) {
    outcome.gameOver = true;
  } else if (!keepsTurn && players.length > 1) {
    current = (state.current + 1) % players.length;
    outcome.messages.push(msg('rules.turnTo', { name: players[current].name }));
  } else if (keepsTurn) {
    outcome.messages.push(msg('rules.keepShooting'));
  }

  let winners: number[] = [];
  if (gameOver) {
    const best = Math.max(...players.map((p) => p.score));
    winners = players.filter((p) => p.score === best).map((p) => p.id);
    outcome.messages.push(
      winners.length === 1
        ? msg('rules.winsWith', { name: players[winners[0]].name, count: best })
        : msg('rules.drawAt', { count: best }),
    );
  }

  return {
    state: {
      players,
      current,
      lastShotWasFoul: outcome.foul,
      finished: gameOver,
      winners,
      shotsTaken: state.shotsTaken + 1,
    },
    outcome,
  };
}
