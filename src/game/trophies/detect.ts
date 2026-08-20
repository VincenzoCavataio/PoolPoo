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
import type { PocketId } from '@/game/core/table';
import type { ShotSpin } from '@/game/core/world';
import type { Difficulty } from '@/game/ai/opponent';
import { GameModeKind, type ShotOutcome } from '@/game/rules/types';

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
  /**
   * Whether the current streak has survived a re-rack.
   *
   * Straight pool's whole character: a run that carries on after the table is
   * refilled. Carried here rather than read off the state afterwards, because by
   * then the rack has already happened and the streak looks ordinary.
   */
  streakCrossedRack: boolean;
  /** True while the shooter has led from the first shot. For wire-to-wire. */
  ledThroughout: boolean;
  /** True once anybody has trailed by five or more. For the comeback. */
  wasBehind: boolean;
}

export function emptyRunState(): TrophyRunState {
  return {
    streak: 0,
    clean: true,
    noScratch: true,
    shots: 0,
    streakCrossedRack: false,
    ledThroughout: true,
    wasBehind: false,
  };
}

export interface ShotFacts {
  events: ShotEvent[];
  outcome: ShotOutcome;
  spin: ShotSpin;
  /** How hard it was struck, 0 to 1. */
  power: number;
  /** True if this was the opening shot of the game. */
  isBreak: boolean;
  /** True when this shot ended the game, and the shooter won it. */
  wonGame: boolean;
  /** How many players are in the game. */
  players: number;
  /** Points the shooter had, and the best anyone else had. */
  winnerScore: number;
  runnerUpScore: number;

  /** Which rules are being played under. */
  mode: GameModeKind;
  /** What the shooter said they would do, in the called games. */
  call: { ball: number; pocket: PocketId } | null;
  /** How far the cue ball was from the first ball it struck, in metres. */
  contactDistance: number | null;
  /**
   * The computers in this game, hardest first.
   *
   * Empty in a game between people. Read to decide which "beat the computer"
   * trophies a win is worth — a win over three easy machines is not a win over a
   * hard one.
   */
  cpus: Difficulty[];
  /** True when the shooter is a person. Computers earn nothing. */
  shooterIsHuman: boolean;
  /** True when the shooter had a partner in this game. Eight-ball teams. */
  hasPartner: boolean;
  /** Seats on the shooter's side, and on the other. For the outnumbered win. */
  ownTeamSize: number;
  otherTeamSize: number;
  /** True when this shot cleared the last of the shooter's group. */
  clearedGroup: boolean;
  /** True when the fourteen went back up after this shot. */
  reracked: boolean;
  /** The target a straight-pool game is played to. */
  target: number;
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

/** Draw, rather than merely not-follow. Same reasoning as the side threshold. */
const DRAW_THRESHOLD = -0.5;

/**
 * What counts as a long pot: most of the table's length between the cue ball and
 * what it hit. The table is 2.54m, so this is roughly half of it.
 */
const LONG_POT_DISTANCE = 1.2;

/** A pot played this gently is a touch shot rather than a hit. */
const SOFT_TOUCH_POWER = 0.2;

export function detectShot(
  facts: ShotFacts,
  run: TrophyRunState,
): { awards: TrophyAwards; run: TrophyRunState } {
  const award: string[] = [];
  const advance: string[] = [];

  const potted = facts.outcome.pocketed;
  const scored = potted.length > 0;
  const isEight = facts.mode === GameModeKind.EIGHT || facts.mode === GameModeKind.EIGHT_CALLED;

  /*
   * A computer's turn earns nothing.
   *
   * The detector runs on every settled shot, including the ones the machine
   * plays, and without this a game against three hard opponents would hand the
   * player every trophy those three earned on their own visits.
   */
  if (!facts.shooterIsHuman) {
    return {
      awards: { award, advance },
      run: {
        ...run,
        // The streak belongs to whoever is shooting, so somebody else's visit
        // ends it.
        streak: 0,
        streakCrossedRack: false,
        clean: run.clean && !facts.outcome.foul,
        noScratch: run.noScratch && !facts.outcome.cueBallNeedsRespot,
        shots: run.shots + 1,
        ledThroughout: run.ledThroughout && facts.winnerScore >= facts.runnerUpScore,
      },
    };
  }

  // ------------------------------------------------------------- progression
  award.push('first-shot');
  if (scored) {
    award.push('first-pot');
    for (let i = 0; i < potted.length; i++) {
      advance.push('hundred-pots');
      advance.push('thousand-pots');
    }
  }

  // ------------------------------------------------------------------- skill
  if (potted.length >= 2) award.push('double-pot');
  if (potted.length >= 3) award.push('triple-pot');
  if (potted.length >= 4) award.push('quad-pot');

  if (facts.isBreak && scored) {
    award.push('break-pot');
    if (potted.length >= 3) award.push('big-break');
  }

  if (scored && Math.abs(facts.spin.side) >= SPIN_THRESHOLD) award.push('spin-pot');
  if (scored && facts.spin.vertical <= DRAW_THRESHOLD) award.push('draw-pot');

  if (scored && facts.contactDistance !== null && facts.contactDistance >= LONG_POT_DISTANCE) {
    award.push('long-pot');
  }
  if (scored && facts.power <= SOFT_TOUCH_POWER) award.push('soft-touch');

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
    const cueCushions = facts.events.filter(
      (e) => e.kind === 'cushion-hit' && e.ball === 0 && (!firstPot || e.t < firstPot.t),
    );
    if (firstPot && cueCushions.length >= 1) award.push('cushion-pot');
    if (firstPot && cueCushions.length >= 2) award.push('two-cushion-pot');
  }

  // -------------------------------------------------------------- the called
  /*
   * Did the ball go where it was said it would?
   *
   * Both halves have to hold, and the pocket is the half that matters: the
   * whole point of the called game is that a ball rattling into a different
   * pocket does not count.
   */
  const calledTrue =
    facts.call !== null &&
    facts.events.some(
      (e) => e.kind === 'pocketed' && e.ball === facts.call?.ball && e.pocket === facts.call.pocket,
    );

  if (calledTrue && facts.mode === GameModeKind.EIGHT_CALLED) {
    advance.push('called-as-said');
    if (facts.call?.pocket === 'side-n' || facts.call?.pocket === 'side-s') {
      award.push('called-side-pocket');
    }
    if (facts.call?.ball === 8) award.push('called-black');
  }

  // --------------------------------------------------------------- eight-ball
  if (isEight && facts.clearedGroup) award.push('eight-clear-group');

  // ------------------------------------------------------------ straight pool
  if (facts.mode === GameModeKind.STRAIGHT) {
    if (facts.reracked) award.push('straight-rerack');
    if (facts.winnerScore >= Math.ceil(facts.target / 2)) award.push('straight-half-target');
  }

  // ------------------------------------------------------------------ hidden
  if (facts.outcome.ballsLeftTable.length > 0) award.push('off-the-table');

  /*
   * Potting the black early, which loses the frame on the spot.
   *
   * A trophy for a mistake, and deliberately hidden: it is the kind of thing
   * that happens once and is remembered, which is exactly what a secret is for.
   */
  if (isEight && facts.outcome.gameOver && !facts.wonGame && potted.includes(8)) {
    award.push('own-goal');
  }

  /*
   * Two balls in the same shot, into pockets at opposite ends of the table.
   *
   * Not a skill so much as a sight. The x sign of a corner pocket tells which
   * end it is; a shot that fills one of each has sent balls the length of the
   * table in both directions.
   */
  if (potted.length >= 2) {
    const ends = new Set(
      facts.events
        .filter((e) => e.kind === 'pocketed' && e.ball !== 0)
        .map((e) => (e as { pocket: PocketId }).pocket)
        .filter((p) => p.startsWith('corner'))
        .map((p) => (p.endsWith('-nw') || p.endsWith('-sw') ? 'west' : 'east')),
    );
    if (ends.size === 2) award.push('both-ends');
  }

  // ------------------------------------------------------------ running tally
  const streak = scored ? run.streak + 1 : 0;
  const streakCrossedRack = scored ? run.streakCrossedRack || facts.reracked : false;

  if (streak >= 3) {
    award.push('run-of-three');
    if (facts.mode === GameModeKind.EIGHT_CALLED) award.push('called-run-of-three');
  }
  if (streak >= 5) award.push('run-of-five');
  if (streak >= 6) award.push('long-run');
  if (facts.mode === GameModeKind.STRAIGHT) {
    if (streak >= 8) award.push('straight-run-of-eight');
    if (streak >= 2 && streakCrossedRack) award.push('straight-across-racks');
  }

  const clean = run.clean && !facts.outcome.foul;
  const noScratch = run.noScratch && !facts.outcome.cueBallNeedsRespot;
  const shots = run.shots + 1;
  const ledThroughout = run.ledThroughout && facts.winnerScore >= facts.runnerUpScore;
  const wasBehind = run.wasBehind || facts.runnerUpScore - facts.winnerScore >= 5;

  // ------------------------------------------------------------------- feats
  if (facts.wonGame) {
    award.push('first-win');
    advance.push('ten-games');
    advance.push('fifty-games');

    if (clean) award.push('clean-game');
    if (noScratch) award.push('no-scratch');
    if (ledThroughout && facts.players > 1) award.push('wire-to-wire');
    if (wasBehind) award.push('comeback');

    /*
     * A shutout: won without the other player scoring at all.
     *
     * Only in a game with somebody to shut out, and only when the runner-up is
     * still on nothing. Solo play would otherwise hand this out every time.
     */
    if (facts.players > 1 && facts.runnerUpScore <= 0 && facts.winnerScore > 0) {
      award.push('shutout');
    }

    // ---------------------------------------------------------- per discipline
    if (facts.mode === GameModeKind.EIGHT) {
      award.push('eight-first-win');
      advance.push('eight-ten-wins');
      if (facts.hasPartner) award.push('eight-team-win');
      // The lone player in a 2v1, who sees the table half as often as the pair.
      if (facts.ownTeamSize < facts.otherTeamSize) award.push('eight-outnumbered');
      // Won by potting the black, which is the only way an eight-ball game ends
      // in your favour.
      if (potted.includes(8)) award.push('eight-on-the-black');
    }
    if (facts.mode === GameModeKind.EIGHT_CALLED) award.push('called-first-win');
    if (facts.mode === GameModeKind.STRAIGHT) award.push('straight-first-win');
    if (facts.mode === GameModeKind.FREE) {
      if (clean && noScratch) award.push('free-clean-sweep');
      if (facts.winnerScore >= 10) award.push('free-double-figures');
    }

    // ------------------------------------------------------------ the computer
    /*
     * Credited for the hardest machine at the table, not for each of them.
     *
     * Beating one hard opponent is worth more than beating three easy ones, and
     * awarding all three tiers for a table of mixed difficulties would make the
     * hard trophy reachable by sitting down with an easy one.
     */
    if (facts.cpus.length > 0) {
      const hardest = facts.cpus.includes('hard')
        ? 'hard'
        : facts.cpus.includes('medium')
          ? 'medium'
          : 'easy';

      if (hardest === 'easy') award.push('beat-easy');
      if (hardest === 'medium') award.push('beat-medium');
      if (hardest === 'hard') {
        award.push('beat-hard');
        advance.push('beat-hard-ten');
        if (clean) award.push('beat-hard-clean');
      }
      if (facts.cpus.length >= 3) award.push('beat-three-cpus');
    }
  }

  return {
    awards: { award, advance },
    run: { streak, clean, noScratch, shots, streakCrossedRack, ledThroughout, wasBehind },
  };
}
