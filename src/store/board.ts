/**
 * Whether the full scoreboard is open.
 *
 * A store rather than component state because the two halves live in different
 * places: the button is in the header, and the panel it opens has to be mounted
 * at the screen's root — an absolutely positioned child of the header would be
 * clipped to the header's own box, which is a strip a few points tall.
 *
 * Not persisted. Which of the two views you want changes within a frame, not
 * between them, and a board left open from three games ago would be answering a
 * question nobody had asked.
 */

import { create } from 'zustand';

interface BoardState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useBoard = create<BoardState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
