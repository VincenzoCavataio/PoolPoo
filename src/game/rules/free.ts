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
  firstBallHitByCue,
  pocketedObjectBalls,
  type ShotEvent,
} from '../core/events';
import type { World } from '../core/world';
import { emptyOutcome, type ShotOutcome } from './types';

export interface Player {
  id: number;
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

export function createFreeState(playerCount: number, names?: string[]): FreeState {
  const count = Math.max(1, Math.min(8, Math.floor(playerCount)));
  const players: Player[] = Array.from({ length: count }, (_, i) => ({
    id: i,
    name: names?.[i]?.trim() || `Giocatore ${i + 1}`,
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

  outcome.pocketed = potted;

  // A miss with no contact at all is a foul, same as potting the cue ball.
  // Without this, a player could safely roll the cue ball nowhere forever.
  if (scratched) {
    outcome.foul = true;
    outcome.foulReason = 'Bianca in buca';
  } else if (contacted === null) {
    outcome.foul = true;
    outcome.foulReason = 'Nessuna pallina colpita';
  }

  const players = state.players.map((p) => ({ ...p }));
  const player = players[state.current];

  if (potted.length > 0) {
    player.score += potted.length * FREE_RULES.pointsPerBall;
    player.ballsPocketed += potted.length;
    outcome.messages.push(
      potted.length === 1
        ? `${player.name}: +${FREE_RULES.pointsPerBall} punto`
        : `${player.name}: +${potted.length * FREE_RULES.pointsPerBall} punti (${potted.length} palline)`,
    );
  }

  if (outcome.foul) {
    player.score -= FREE_RULES.foulPenalty;
    outcome.messages.push(`Fallo: ${outcome.foulReason} (−${FREE_RULES.foulPenalty})`);
    outcome.cueBallNeedsRespot = scratched;
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
    outcome.messages.push(`Turno a ${players[current].name}`);
  } else if (keepsTurn) {
    outcome.messages.push('Continui tu');
  }

  let winners: number[] = [];
  if (gameOver) {
    const best = Math.max(...players.map((p) => p.score));
    winners = players.filter((p) => p.score === best).map((p) => p.id);
    outcome.messages.push(
      winners.length === 1
        ? `Vince ${players[winners[0]].name} con ${best} punti`
        : `Pareggio a ${best} punti`,
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
