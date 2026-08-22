/**
 * Whether the aim dial is on screen.
 *
 * A store rather than component state because the two halves are far apart: the
 * gesture lives on the GL surface, the dial is a sibling view drawn over it.
 *
 * Not persisted, and deliberately not part of the session: this is the state of
 * a finger, not the state of a game. It lasts exactly as long as the drag does —
 * the pan's `onBegin` and `onFinalize` raise and drop it, so the dial follows
 * the touch itself rather than a timer guessing when the touch stopped.
 *
 * No coordinates. The dial used to appear wherever the drag started, on the
 * reasoning that the eye is already there — but the finger is on the shot, so it
 * kept landing over the balls being aimed at, in a different place each time. It
 * has one fixed home now, which is what lets it be read without being hunted
 * for.
 */

import { create } from 'zustand';

interface AimDialState {
  /** True while a drag on the table is turning the cue. */
  active: boolean;
  /** Raised as an aiming drag begins. */
  grab: () => void;
  /** Dropped as it ends — however it ends. */
  release: () => void;
}

export const useAimDial = create<AimDialState>((set, get) => ({
  active: false,

  // Both guarded against redundant writes: a zustand `set` with an unchanged
  // value still notifies subscribers, and these are called from gesture
  // callbacks that can fire more than once for the same state.
  grab: () => {
    if (!get().active) set({ active: true });
  },

  release: () => {
    if (get().active) set({ active: false });
  },
}));
