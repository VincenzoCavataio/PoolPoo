/**
 * The switch on the wall, and the lamp it controls.
 *
 * Small enough to look unnecessary, and it is not: the light lives in the GL
 * scene while the switch is a React view over it, so the two need somewhere to
 * meet. A module variable would do for the lamp alone — it reads its state every
 * frame and never needs to re-render — but the switch has to redraw when the
 * state changes, and that is what a store buys.
 *
 * Not persisted. Coming back to the app should find the room the way an empty
 * room is found: dark, waiting to be switched on, with the whole strike sequence
 * still to come. Remembering that the light was off would mean launching into a
 * black screen and wondering what broke.
 */

import { create } from 'zustand';

import { useTrophies } from '@/store/trophies';

interface RoomLightState {
  /** Whether the switch is thrown. The lamp answers this, with its own timing. */
  on: boolean;
  toggle: () => void;
}

export const useRoomLight = create<RoomLightState>((set) => ({
  on: true,
  toggle: () =>
    set((state) => {
      // Turning the room dark is the kind of thing nobody is told to try.
      if (state.on) useTrophies.getState().award('lights-out');
      return { on: !state.on };
    }),
}));
