/**
 * Shared vocabulary between the two game modes and the UI.
 *
 * Both modes read the shot event log and return a `ShotOutcome`; neither one
 * touches the world. Applying consequences (respotting the cue ball, racking
 * again) is the session layer's job, which keeps the rules pure and testable.
 *
 * Nothing here returns prose. A shot produces `Message` descriptors — a key and
 * its values — and the UI decides what language to render them in. That keeps
 * the rules free of any locale, and it means their tests assert on a stable key
 * instead of on an Italian sentence that a translation pass would break.
 */

import type { Message, MessageKey } from '@/i18n';

export const Phase = {
  /** Waiting for the player to aim and shoot. */
  AIMING: 'aiming',
  /** Balls are moving; input is locked. */
  SIMULATING: 'simulating',
  /** Showing a slow-motion action replay of a pot. */
  REPLAY: 'replay',
  /** Match or puzzle is over. */
  GAME_OVER: 'game-over',
} as const;

export type Phase = (typeof Phase)[keyof typeof Phase];

export interface ShotOutcome {
  /** Object balls pocketed by this shot, in drop order. */
  pocketed: number[];
  foul: boolean;
  foulReason: Message | null;
  turnPassed: boolean;
  cueBallNeedsRespot: boolean;
  /**
   * Balls that were driven off the table. They do not stay gone: the caller
   * puts them back before the next shot, which is what real rules do too.
   */
  ballsLeftTable: number[];
  /** Points the foul cost, so the overlay can show the damage rather than imply it. */
  penalty: number;
  gameOver: boolean;
  /** Lines for the HUD ticker, still untranslated. */
  messages: Message[];
}

export function emptyOutcome(): ShotOutcome {
  return {
    pocketed: [],
    foul: false,
    foulReason: null,
    turnPassed: false,
    cueBallNeedsRespot: false,
    ballsLeftTable: [],
    penalty: 0,
    gameOver: false,
    messages: [],
  };
}

/**
 * Which set of rules a game is being played under.
 *
 * Four playable disciplines rather than one. They differ in what a shot is
 * worth, not in how the table behaves — the solver is the same for all of them,
 * and each mode is a function from an event log to an outcome.
 */
export const GameModeKind = {
  /** Every ball a point, keep shooting while you keep potting. */
  FREE: 'free',
  /** Solids and stripes, black last. Teams. */
  EIGHT: 'eight',
  /** The same, but every pot must be named first. */
  EIGHT_CALLED: 'eight-called',
  /** 14.1 continuous: called, to a target, racking the fourteen as they run out. */
  STRAIGHT: 'straight',
  PUZZLE: 'puzzle',
} as const;

export type GameModeKind = (typeof GameModeKind)[keyof typeof GameModeKind];

/** The three the player can start. `puzzle` is a leftover the menus never offer. */
export const PLAYABLE_MODES = [
  GameModeKind.FREE,
  GameModeKind.EIGHT,
  GameModeKind.EIGHT_CALLED,
  GameModeKind.STRAIGHT,
] as const;

/**
 * What each discipline is called, as a message key.
 *
 * Here rather than on the screen that picks them, because three screens name a
 * mode now — the picker, the button that confirms it, and the bar that starts
 * the game — and three copies of the same mapping is three places for them to
 * drift apart.
 */
export const MODE_LABELS: Record<GameModeKind, MessageKey> = {
  [GameModeKind.FREE]: 'discipline.free',
  [GameModeKind.EIGHT]: 'discipline.eight',
  [GameModeKind.EIGHT_CALLED]: 'discipline.eightCalled',
  [GameModeKind.STRAIGHT]: 'discipline.straight',
  [GameModeKind.PUZZLE]: 'discipline.free',
};

/** Whether this mode makes the shooter name a ball and a pocket before shooting. */
export function modeIsCalled(mode: GameModeKind): boolean {
  return mode === GameModeKind.EIGHT_CALLED || mode === GameModeKind.STRAIGHT;
}

/** Whether seats are divided into two sides rather than playing for themselves. */
export function modeHasTeams(mode: GameModeKind): boolean {
  return mode === GameModeKind.EIGHT || mode === GameModeKind.EIGHT_CALLED;
}

/**
 * One row of the scoreboard, whatever mode produced it.
 *
 * The HUD should not have to know which ruleset is running to draw a list of
 * who is playing. Each mode projects its own state onto this; the fields a mode
 * has nothing to say about are simply absent.
 */
export interface Standing {
  id: number;
  name: string;
  /** Absent in eight-ball, which is won rather than scored. */
  score?: number;
  /** Which side, in the modes that have sides. */
  team?: number;
  /** Solids or stripes, once the table has been claimed. */
  group?: 'solids' | 'stripes' | null;
  /** Balls potted without missing. 14.1 only, where it is the headline stat. */
  run?: number;
  isCurrent: boolean;
  cpu?: boolean;
}
