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

import { BALL_SETS } from '@/constants/ball-sets';
import { QUALITY_PRESETS, type QualityLevel } from '@/constants/quality';
import { useTrophies } from '@/store/trophies';
import { CLOTH_OPTIONS } from '@/constants/game-theme';
import type { Locale } from '@/i18n';
import { LOCATIONS } from '@/game/render/locations';

export const AIM_SENSITIVITY = {
  min: 0.002,
  max: 0.012,
  default: 0.005,
} as const;

/** `auto` follows the phone; anything else pins the language. */
export type LanguageSetting = 'auto' | Locale;

export interface SettingsState {
  /**
   * What to call the person playing.
   *
   * Empty until they have been asked, which is what the menu uses to decide
   * whether to ask. Stored here rather than in the session because it outlives
   * any one game — it is who you are, not who is at the table this frame.
   */
  playerName: string;
  language: LanguageSetting;
  clothId: string;
  ballSetId: string;
  /** Graphics preset: which effects the renderer is allowed to spend on. */
  quality: QualityLevel;
  /** Which room the table stands in. */
  locationId: string;
  /** Draw the line from the cue ball to its first contact. */
  showAimGuide: boolean;
  /** Draw the ghost ball and the predicted path of the struck ball. */
  showGhostBall: boolean;
  /** Radians of aim change per pixel dragged. */
  aimSensitivity: number;
  /**
   * Volumes and haptics live here so they survive a restart, but the live audio
   * objects do not read them directly — settings must not import the players, or
   * the two modules end up importing each other. Whoever starts the audio pushes
   * these values in.
   */
  musicVolume: number;
  sfxVolume: number;
  /** Vibration on your own shot and on a pot. */
  haptics: boolean;
  /**
   * A light tap on every ball contact. Separate from `haptics` because it fires
   * dozens of times on a break, and that is either the best part of the shot or
   * the reason the phone goes in a drawer.
   */
  collisionHaptics: boolean;

  setPlayerName: (value: string) => void;
  setLanguage: (value: LanguageSetting) => void;
  setCloth: (id: string) => void;
  setBallSet: (id: string) => void;
  setQuality: (value: QualityLevel) => void;
  setLocation: (id: string) => void;
  setShowAimGuide: (value: boolean) => void;
  setShowGhostBall: (value: boolean) => void;
  setAimSensitivity: (value: number) => void;
  setMusicVolume: (value: number) => void;
  setSfxVolume: (value: number) => void;
  setHaptics: (value: boolean) => void;
  setCollisionHaptics: (value: boolean) => void;
  resetSettings: () => void;
}

const DEFAULTS = {
  // Empty is the signal that nobody has been asked yet.
  playerName: '',
  language: 'auto' as LanguageSetting,
  clothId: CLOTH_OPTIONS[0].id,
  ballSetId: BALL_SETS[0].id,
  quality: QUALITY_PRESETS[2].id,
  locationId: LOCATIONS[0].id,
  showAimGuide: true,
  showGhostBall: true,
  aimSensitivity: AIM_SENSITIVITY.default,
  musicVolume: 0.55,
  sfxVolume: 0.8,
  haptics: true,
  collisionHaptics: false,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setPlayerName: (playerName) => {
        // Trimmed here rather than at each call site: a name that is all spaces
        // has to read as unanswered, or the menu never asks again and every
        // scoreboard shows a blank.
        const trimmed = playerName.trim().slice(0, 24);
        // Introducing yourself is a small thing to have done, and the kind of
        // thing a hidden trophy is for.
        if (trimmed) useTrophies.getState().award('named-yourself');
        set({ playerName: trimmed });
      },
      setLanguage: (language) => set({ language }),
      setCloth: (clothId) => set({ clothId }),
      setBallSet: (ballSetId) => {
        // Trying every set is a thing only curiosity does.
        useTrophies.getState().discover('ballSets', ballSetId, 'collector', BALL_SETS.length);
        set({ ballSetId });
      },
      setQuality: (quality) => set({ quality }),
      setLocation: (locationId) => {
        useTrophies.getState().discover('rooms', locationId, 'grand-tour', LOCATIONS.length);
        set({ locationId });
      },
      setShowAimGuide: (showAimGuide) => set({ showAimGuide }),
      setShowGhostBall: (showGhostBall) => set({ showGhostBall }),
      setAimSensitivity: (value) =>
        set({
          aimSensitivity: Math.min(AIM_SENSITIVITY.max, Math.max(AIM_SENSITIVITY.min, value)),
        }),
      setMusicVolume: (value) => set({ musicVolume: Math.min(1, Math.max(0, value)) }),
      setSfxVolume: (value) => set({ sfxVolume: Math.min(1, Math.max(0, value)) }),
      setHaptics: (haptics) => set({ haptics }),
      setCollisionHaptics: (collisionHaptics) => set({ collisionHaptics }),
      resetSettings: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'pool.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
