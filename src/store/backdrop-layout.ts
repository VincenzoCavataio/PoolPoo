/**
 * The balls the menu's backdrop should show.
 *
 * The backdrop is mounted at the root and knows nothing about saved games; the
 * menu is the screen that reads one off disk. This is where the two meet.
 *
 * `null` means "no game in progress", and the backdrop falls back to the few
 * scattered balls it has always drawn. Anything else is the real position from
 * the save, so the table under the menu is the table you left.
 *
 * Not persisted, and deliberately: it is a copy of something already stored, and
 * a second copy that could fall out of step with the first is a bug waiting for
 * somebody to clear their save.
 */

import { create } from 'zustand';

import type { BallLayout } from '@/game/core/world';

interface BackdropLayoutState {
  /** Ball positions from the game in progress, or `null` for none. */
  layout: BallLayout[] | null;
  /**
   * How many are playing, which is how many cues lie on the table.
   *
   * One each: a cue on the cloth is somebody's cue, and a table set for four
   * with one stick on it is a table three people are watching. Zero when there
   * is no game, and the backdrop shows its single idle cue instead.
   */
  players: number;
  setLayout: (layout: BallLayout[] | null, players?: number) => void;
}

export const useBackdropLayout = create<BackdropLayoutState>((set) => ({
  layout: null,
  players: 0,
  setLayout: (layout, players = 0) => set({ layout, players }),
}));
