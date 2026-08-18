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

import type { Message } from '@/i18n';

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

export const GameModeKind = {
  FREE: 'free',
  PUZZLE: 'puzzle',
} as const;

export type GameModeKind = (typeof GameModeKind)[keyof typeof GameModeKind];
