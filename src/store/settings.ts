/**
 * Player preferences, persisted to AsyncStorage.
 *
 * Every option here changes something observable. There is deliberately no
 * sound or haptics toggle: nothing in the game plays audio or vibrates yet, and
 * a switch that does nothing is worse than no switch.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { CLOTH_OPTIONS } from '@/constants/game-theme';
import { LOCATIONS } from '@/game/render/locations';

export const AIM_SENSITIVITY = {
  min: 0.002,
  max: 0.012,
  default: 0.005,
} as const;

export interface SettingsState {
  clothId: string;
  /** Which room the table stands in. */
  locationId: string;
  /** Draw the line from the cue ball to its first contact. */
  showAimGuide: boolean;
  /** Draw the ghost ball and the predicted path of the struck ball. */
  showGhostBall: boolean;
  /** Radians of aim change per pixel dragged. */
  aimSensitivity: number;

  setCloth: (id: string) => void;
  setLocation: (id: string) => void;
  setShowAimGuide: (value: boolean) => void;
  setShowGhostBall: (value: boolean) => void;
  setAimSensitivity: (value: number) => void;
  resetSettings: () => void;
}

const DEFAULTS = {
  clothId: CLOTH_OPTIONS[0].id,
  locationId: LOCATIONS[0].id,
  showAimGuide: true,
  showGhostBall: true,
  aimSensitivity: AIM_SENSITIVITY.default,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setCloth: (clothId) => set({ clothId }),
      setLocation: (locationId) => set({ locationId }),
      setShowAimGuide: (showAimGuide) => set({ showAimGuide }),
      setShowGhostBall: (showGhostBall) => set({ showGhostBall }),
      setAimSensitivity: (value) =>
        set({
          aimSensitivity: Math.min(AIM_SENSITIVITY.max, Math.max(AIM_SENSITIVITY.min, value)),
        }),
      resetSettings: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'pool.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
