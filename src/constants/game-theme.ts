/**
 * Game palette. Deliberately a fixed dark theme rather than the template's
 * light/dark pair: the 3D table is lit for a dark surround, and a light UI
 * around it would read as a bug rather than a preference.
 */

export const Palette = {
  background: '#0c1310',
  surface: '#15201b',
  surfaceRaised: '#1d2c25',
  border: '#2a3b32',
  text: '#eaf2ee',
  textMuted: '#8ba79a',
  accent: '#3ddc84',
  accentText: '#05170e',
  danger: '#ff6b5e',
  gold: '#ffc857',
  rail: '#5c3b23',
  railDark: '#3c2616',
  railTop: '#6d4829',
  pocket: '#07100c',
} as const;

import { DEFAULT_PROFILE, type PhysicsProfile } from '@/game/core/constants';

/**
 * A cloth is no longer just a colour: each one plays differently, and the table
 * is built with its physics profile. A fast cloth genuinely rolls further and
 * comes off the rails harder.
 */
export interface ClothOption {
  id: string;
  label: string;
  /** One line on how it plays, for the options screen. */
  feel: string;
  /** Cloth colour under full light. */
  cloth: string;
  /** Darker tone used for the cushion faces. */
  cushion: string;
  /**
   * Colour of the fibre sheen — the pale halo billiard cloth throws at grazing
   * angles. It is what stops the bed from looking like painted plastic.
   */
  sheen: string;
  /** Overrides on top of the default profile. */
  physics: Partial<PhysicsProfile>;
}

export const CLOTH_OPTIONS: ClothOption[] = [
  {
    id: 'verde',
    label: 'Verde',
    feel: 'Standard. Il riferimento con cui è tarato tutto il resto.',
    cloth: '#1f6b4a',
    cushion: '#164f37',
    sheen: '#7fd8ac',
    physics: {},
  },
  {
    id: 'blu',
    label: 'Blu',
    feel: 'Veloce e vivo: le palline corrono di più e le sponde restituiscono meglio.',
    cloth: '#1c4f7c',
    cushion: '#143b5d',
    sheen: '#7fb6e8',
    physics: { rollingFriction: 0.046, slidingFriction: 0.18, cushionRestitution: 0.8 },
  },
  {
    id: 'bordeaux',
    label: 'Bordeaux',
    feel: 'Pesante e lento, sponde smorzate. Perdona meno la potenza di troppo.',
    cloth: '#7a2230',
    cushion: '#5b1923',
    sheen: '#e08a96',
    physics: { rollingFriction: 0.082, slidingFriction: 0.24, cushionRestitution: 0.68 },
  },
  {
    id: 'grafite',
    label: 'Grafite',
    feel: 'Ruvido: mordente alto, l’effetto attacca molto di più.',
    cloth: '#39424a',
    cushion: '#282f35',
    sheen: '#9fb0be',
    physics: {
      slidingFriction: 0.26,
      spinningFriction: 0.03,
      cushionSpinTransfer: 0.34,
      ballFriction: 0.085,
    },
  },
];

export function clothById(id: string): ClothOption {
  return CLOTH_OPTIONS.find((c) => c.id === id) ?? CLOTH_OPTIONS[0];
}

/** The physics the table is built with, for the chosen cloth. */
export function clothProfile(id: string): PhysicsProfile {
  return { ...DEFAULT_PROFILE, ...clothById(id).physics };
}

export const Radius = {
  small: 8,
  medium: 14,
  large: 22,
  pill: 999,
} as const;
