/**
 * What has been earned, and what is on the way there.
 *
 * Two records: how many times each counted thing has happened, and when each
 * trophy was unlocked. Keeping the counts separate from the unlocks is what lets
 * the screen show "34 of 100" rather than only a locked outline, and it means a
 * trophy whose target is raised later does not lose the progress behind it.
 *
 * **Built for a platform sync that is not here yet.** Unlocking goes through one
 * function, and that function is the only place that would ever have to tell
 * Game Center or Play Games about it. Those need native code and a development
 * build, which this project deliberately does not have — it is pinned to Expo Go
 * — so the hook is a comment rather than a stub nobody can run. When the build
 * changes, the change is one call inside `award`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { TROPHIES, trophyById } from '@/game/trophies/catalogue';

interface TrophyState {
  /** Unlock time in epoch milliseconds, keyed by trophy id. */
  unlocked: Record<string, number>;
  /** Running totals for the counted trophies, keyed by the same ids. */
  progress: Record<string, number>;

  /**
   * The trophy waiting to be shown, if any.
   *
   * The banner reads this rather than being called directly: a shot can finish
   * two trophies at once, and a queue of one keeps the second from painting over
   * the first. `clearPending` moves it along.
   */
  pending: string[];

  /** Unlocks a trophy. Does nothing if it is already earned. */
  award: (id: string) => void;
  /**
   * Counts one step towards a counted trophy, unlocking it at its target.
   *
   * Returns nothing on purpose: callers should not branch on whether this was
   * the step that finished it. The banner is driven by `pending`.
   */
  advance: (id: string, by?: number) => void;
  clearPending: () => void;
  /**
   * Things seen at least once, keyed by a bucket name.
   *
   * The discovery trophies ask "have you tried them all?", which needs a set
   * rather than a count — visiting the same room ten times is one room. Kept
   * here rather than derived from the settings store because a player who
   * changes a setting back has still seen both.
   */
  seen: Record<string, string[]>;
  /** Records one sighting, unlocking `id` once the bucket holds `target`. */
  discover: (bucket: string, value: string, id: string, target: number) => void;

  /** For the options screen. Wipes both records. */
  resetTrophies: () => void;
}

export const useTrophies = create<TrophyState>()(
  persist(
    (set, get) => ({
      unlocked: {},
      progress: {},
      seen: {},
      pending: [],

      award: (id) => {
        if (get().unlocked[id]) return;
        // An id with no trophy behind it is a typo at a call site, and silently
        // storing it would leave an unlock nothing can ever display.
        if (!trophyById(id)) return;

        /*
         * The one place an unlock happens.
         *
         * A platform sync — Play Games on Android, Game Center on iOS — belongs
         * exactly here, as a fire-and-forget call alongside the local write.
         * Both need native modules and a development build, so it is deliberately
         * absent rather than stubbed.
         */
        set((state) => ({
          unlocked: { ...state.unlocked, [id]: Date.now() },
          pending: [...state.pending, id],
        }));
      },

      advance: (id, by = 1) => {
        const trophy = trophyById(id);
        if (!trophy || get().unlocked[id]) return;

        const next = (get().progress[id] ?? 0) + by;
        set((state) => ({ progress: { ...state.progress, [id]: next } }));

        const target = trophy.target ?? 1;
        if (next >= target) get().award(id);
      },

      discover: (bucket, value, id, target) => {
        if (get().unlocked[id]) return;

        const already = get().seen[bucket] ?? [];
        if (already.includes(value)) return;

        const next = [...already, value];
        set((state) => ({ seen: { ...state.seen, [bucket]: next } }));

        if (next.length >= target) get().award(id);
      },

      clearPending: () => set((state) => ({ pending: state.pending.slice(1) })),

      resetTrophies: () => set({ unlocked: {}, progress: {}, seen: {}, pending: [] }),
    }),
    {
      name: 'pool.trophies.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // `pending` is a queue for the current session, not something to restore:
      // reopening the app should not replay a banner from three days ago.
      partialize: (state) => ({
        unlocked: state.unlocked,
        progress: state.progress,
        seen: state.seen,
      }),
    },
  ),
);

/** How many trophies are earned, and out of how many. For the options screen. */
export function trophyTally(unlocked: Record<string, number>): {
  earned: number;
  total: number;
} {
  return {
    earned: TROPHIES.filter((t) => unlocked[t.id]).length,
    total: TROPHIES.length,
  };
}
