/**
 * Deciding what a shot earned.
 *
 * A pure function over the things a shot already produces — its events, its
 * outcome, and a little state carried between shots — returning the ids to
 * award and to advance. Nothing here touches the store or the screen, which is
 * what makes it testable: the awkward cases are all "did this shot really count
 * as that?", and those are much easier to argue about with numbers in front of
 * you than by playing until one happens.
 *
 * The rules are deliberately strict. A trophy that fires when it should not is
 * worse than one that is hard to get: the first makes every other trophy mean
 * less, and it cannot be taken back once a player has it.
 */

import type { ShotEvent } from '@/game/core/events';
import type { ShotSpin } from '@/game/core/world';
import type { ShotOutcome } from '@/game/rules/types';

/**
 * What the detector needs to remember between shots.
 *
 * Kept by the caller rather than inside a module, so a game that is abandoned
 * halfway does not leak its half-finished streak into the next one.
 */
export interface TrophyRunState {
  /** Consecutive shots by the current player that potted something. */
  streak: number;
  /** True while nobody has fouled all game. */
  clean: boolean;
  /** True while the cue ball has never been pocketed this game. */
  noScratch: boolean;
  /** Shots played in this game, by anybody. */
  shots: number;
}

export function emptyRunState(): TrophyRunState {
  return { streak: 0, clean: true, noScratch: true, shots: 0 };
}

export interface ShotFacts {
  events: ShotEvent[];
  outcome: ShotOutcome;
  spin: ShotSpin;
  /** True if this was the opening shot of the game. */
  isBreak: boolean;
  /** True when this shot ended the game, and the shooter won it. */
  wonGame: boolean;
  /** How many players are in the game. */
  players: number;
  /** Points the winner had, and the best anyone else had. For the shutout. */
  winnerScore: number;
  runnerUpScore: number;
}

export interface TrophyAwards {
  /** Unlock outright. */
  award: string[];
  /** Count one step towards. */
  advance: string[];
}

/**
 * How much spin counts as "with spin".
 *
 * Well past the point where a slip of the thumb would reach it: the trophy is
 * for meaning to use side, and a contact point a tenth off centre is a straight
 * shot with a wobble.
 */
const SPIN_THRESHOLD = 0.45;

export function detectShot(facts: ShotFacts, run: TrophyRunState): {
  awards: TrophyAwards;
  run: TrophyRunState;
} {
  const award: string[] = [];
  const advance: string[] = [];

  const potted = facts.outcome.pocketed;
  const scored = potted.length > 0;

  // ------------------------------------------------------------- progression
  award.push('first-shot');
  if (scored) {
    award.push('first-pot');
    for (let i = 0; i < potted.length; i++) advance.push('hundred-pots');
  }

  // ------------------------------------------------------------------- skill
  if (potted.length >= 2) award.push('double-pot');
  if (potted.length >= 3) award.push('triple-pot');
  if (scored && facts.isBreak) award.push('break-pot');

  if (scored && Math.abs(facts.spin.side) >= SPIN_THRESHOLD) award.push('spin-pot');

  /*
   * A ball potted after the cue ball had already found a cushion.
   *
   * Judged on the order of events rather than on the count: the cushion has to
   * come *before* the pot, or every ball that rattles a jaw on the way down
   * would qualify. The cue ball specifically, because a cushion the object ball
   * found on its own is the shot working, not the player's doing.
   */
  if (scored) {
    const firstPot = facts.events.find((e) => e.kind === 'pocketed');
    const cueCushion = facts.events.find(
      (e) => e.kind === 'cushion-hit' && e.ball === 0,
    );
    if (firstPot && cueCushion && cueCushion.t < firstPot.t) award.push('cushion-pot');
  }

  // ------------------------------------------------------------------ hidden
  if (facts.outcome.ballsLeftTable.length > 0) award.push('off-the-table');

  // ------------------------------------------------------------ running tally
  const streak = scored ? run.streak + 1 : 0;
  if (streak >= 3) award.push('run-of-three');
  if (streak >= 6) award.push('long-run');

  const clean = run.clean && !facts.outcome.foul;
  const noScratch = run.noScratch && !facts.outcome.cueBallNeedsRespot;
  const shots = run.shots + 1;

  // ------------------------------------------------------------------- feats
  if (facts.wonGame) {
    award.push('first-win');
    advance.push('ten-games');

    if (clean) award.push('clean-game');
    if (noScratch) award.push('no-scratch');

    /*
     * A shutout: won without the other player scoring at all.
     *
     * Only in a game with somebody to shut out, and only when the runner-up is
     * still on nothing. Solo play would otherwise hand this out every time.
     */
    if (facts.players > 1 && facts.runnerUpScore <= 0 && facts.winnerScore > 0) {
      award.push('shutout');
    }
  }

  return {
    awards: { award, advance },
    run: { streak, clean, noScratch, shots },
  };
}
