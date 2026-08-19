/**
 * The soundtrack player.
 *
 * One looping player, kept outside the store because a native audio object is
 * not React state and nothing should re-render because a song is a second
 * further along. The store holds only what the record changer needs to draw.
 *
 * Changing track is deliberately not instant: the arm lifts, the disc swaps, the
 * needle drops. The store exposes that as a `changing` flag with a fixed
 * timeline, so the 3D turntable and the HUD can animate against the same clock
 * and stay in step.
 */

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { create } from 'zustand';

import { useTrophies } from '@/store/trophies';

import { playEffect } from './sfx';
import { TRACKS, trackAt, type Track } from './tracks';

/** Arm up, disc off, disc on, arm down. */
export const CHANGE_LIFT_MS = 420;
export const CHANGE_TOTAL_MS = 900;

let player: AudioPlayer | null = null;
let changeTimer: ReturnType<typeof setTimeout> | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimers(): void {
  if (changeTimer) clearTimeout(changeTimer);
  if (settleTimer) clearTimeout(settleTimer);
  changeTimer = null;
  settleTimer = null;
}

export interface MusicState {
  index: number;
  playing: boolean;
  volume: number;
  /** True for the length of the changer animation. */
  changing: boolean;
  /** Whether the record changer panel is up. */
  hudOpen: boolean;
  openHud: () => void;
  closeHud: () => void;

  /** Called when the game screen opens; music belongs to the room. */
  start: () => void;
  stop: () => void;
  toggle: () => void;
  select: (index: number) => void;
  next: () => void;
  previous: () => void;
  setVolume: (volume: number) => void;
}

export const useMusic = create<MusicState>((set, get) => {
  const ensurePlayer = (): AudioPlayer | null => {
    if (player) return player;
    if (TRACKS.length === 0) return null;

    try {
      player = createAudioPlayer(trackAt(get().index).source);
      player.loop = true;
      player.volume = get().volume;
    } catch (error) {
      console.warn('[pool] traccia non caricata', error);
      player = null;
    }
    return player;
  };

  return {
    index: 0,
    playing: false,
    volume: 0.55,
    changing: false,
    hudOpen: false,

    openHud: () => set({ hudOpen: true }),
    closeHud: () => set({ hudOpen: false }),

    start: () => {
      const active = ensurePlayer();
      if (!active) return;
      try {
        active.volume = get().volume;
        active.play();
        set({ playing: true });
      } catch (error) {
        console.warn('[pool] riproduzione non avviata', error);
      }
    },

    stop: () => {
      clearTimers();
      if (player) {
        try {
          player.pause();
        } catch {
          // Already torn down.
        }
      }
      set({ playing: false, changing: false });
    },

    toggle: () => {
      if (get().playing) get().stop();
      else get().start();
    },

    select: (index) => {
      if (TRACKS.length === 0) return;
      const target = ((index % TRACKS.length) + TRACKS.length) % TRACKS.length;
      if (get().changing) return;

      // Putting a different record on is a thing nobody is told they can do.
      if (target !== get().index) useTrophies.getState().award('dj');

      const active = ensurePlayer();
      if (!active) return;

      // Same record already on: just make sure it is running.
      if (target === get().index && get().playing) return;

      clearTimers();
      set({ changing: true });

      try {
        active.pause();
      } catch {
        // Nothing playing yet.
      }

      changeTimer = setTimeout(() => {
        try {
          active.replace(trackAt(target).source);
          active.loop = true;
          active.volume = get().volume;
          active.play();
          playEffect('needle', 0.7);
          set({ index: target, playing: true });
        } catch (error) {
          console.warn('[pool] cambio traccia non riuscito', error);
          set({ playing: false });
        }
      }, CHANGE_LIFT_MS);

      settleTimer = setTimeout(() => set({ changing: false }), CHANGE_TOTAL_MS);
    },

    next: () => get().select(get().index + 1),
    previous: () => get().select(get().index - 1),

    setVolume: (value) => {
      const volume = Math.min(1, Math.max(0, value));
      set({ volume });
      if (player) {
        try {
          player.volume = volume;
        } catch {
          // Player gone; the next one picks the value up from the store.
        }
      }
    },
  };
});

export function currentTrack(): Track {
  return trackAt(useMusic.getState().index);
}

export function releaseMusic(): void {
  clearTimers();
  if (player) {
    try {
      player.remove();
    } catch {
      // Already removed.
    }
  }
  player = null;
}
