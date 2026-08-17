/**
 * Layout scale inherited from the Expo template.
 *
 * The colour palette that used to live here is gone: the game commits to a
 * single dark theme in `game-theme.ts`, because the 3D table is lit for a dark
 * surround and a light UI around it would read as a bug rather than a choice.
 */

import '@/global.css';

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
