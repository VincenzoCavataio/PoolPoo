/**
 * Shared vocabulary between the two game modes and the UI.
 *
 * Both modes read the shot event log and return a `ShotOutcome`; neither one
 * touches the world. Applying consequences (respotting the cue ball, racking
 * again) is the session layer's job, which keeps the rules pure and testable.
 */

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
  foulReason: string | null;
  turnPassed: boolean;
  cueBallNeedsRespot: boolean;
  gameOver: boolean;
  /** Short Italian lines for the HUD ticker. */
  messages: string[];
}

export function emptyOutcome(): ShotOutcome {
  return {
    pocketed: [],
    foul: false,
    foulReason: null,
    turnPassed: false,
    cueBallNeedsRespot: false,
    gameOver: false,
    messages: [],
  };
}

export const GameModeKind = {
  FREE: 'free',
  PUZZLE: 'puzzle',
} as const;

export type GameModeKind = (typeof GameModeKind)[keyof typeof GameModeKind];
