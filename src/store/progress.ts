/**
 * Puzzle progress: best star rating per level, and which levels are unlocked.
 *
 * Kept apart from `settings` because it is earned state rather than a
 * preference — resetting one should not wipe the other.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { LEVELS } from '@/game/rules/levels';

export interface ProgressState {
  /** Level id → best stars earned (1–3). */
  stars: Record<string, number>;
  recordResult: (levelId: string, stars: number) => void;
  resetProgress: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      stars: {},

      recordResult: (levelId, stars) =>
        set((state) => {
          // Only ever improve: replaying a level for fun cannot lose your medal.
          const best = Math.max(state.stars[levelId] ?? 0, stars);
          if (best === state.stars[levelId]) return state;
          return { stars: { ...state.stars, [levelId]: best } };
        }),

      resetProgress: () => set({ stars: {} }),
    }),
    {
      name: 'pool.progress.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function starsForLevel(stars: Record<string, number>, levelId: string): number {
  return stars[levelId] ?? 0;
}

/** The first level is always open; each next one needs a star on the previous. */
export function isLevelUnlocked(stars: Record<string, number>, levelId: string): boolean {
  const index = LEVELS.findIndex((l) => l.id === levelId);
  if (index <= 0) return index === 0;
  return (stars[LEVELS[index - 1].id] ?? 0) > 0;
}

export function totalStars(stars: Record<string, number>): number {
  return LEVELS.reduce((sum, level) => sum + (stars[level.id] ?? 0), 0);
}

export const MAX_STARS = LEVELS.length * 3;
