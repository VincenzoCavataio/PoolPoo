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
import type { MessageKey } from '@/i18n';

/**
 * A cloth is no longer just a colour: each one plays differently, and the table
 * is built with its physics profile. A fast cloth genuinely rolls further and
 * comes off the rails harder.
 */
export interface ClothOption {
  id: string;
  labelKey: MessageKey;
  /** One line on how it plays, for the options screen. */
  feelKey: MessageKey;
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
    labelKey: 'cloth.verde',
    feelKey: 'cloth.verdeFeel',
    cloth: '#1f6b4a',
    cushion: '#164f37',
    sheen: '#7fd8ac',
    physics: {},
  },
  {
    id: 'blu',
    labelKey: 'cloth.blu',
    feelKey: 'cloth.bluFeel',
    cloth: '#1c4f7c',
    cushion: '#143b5d',
    sheen: '#7fb6e8',
    physics: { rollingFriction: 0.046, slidingFriction: 0.18, cushionRestitution: 0.8 },
  },
  {
    id: 'bordeaux',
    labelKey: 'cloth.bordeaux',
    feelKey: 'cloth.bordeauxFeel',
    cloth: '#7a2230',
    cushion: '#5b1923',
    sheen: '#e08a96',
    physics: { rollingFriction: 0.082, slidingFriction: 0.24, cushionRestitution: 0.68 },
  },
  {
    id: 'grafite',
    labelKey: 'cloth.grafite',
    feelKey: 'cloth.grafiteFeel',
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

/**
 * Menu palette.
 *
 * Separate from `Palette` on purpose. The in-game HUD sits over green baize and
 * has to stay legible there; the menus have nothing to read over and every
 * reason to be quiet.
 *
 * Almost everything is drawn with `hairline` on `ink`. The gold is the only
 * decorative colour and it is used sparingly — one accent that appears rarely
 * reads as expensive, the same accent everywhere reads as a theme.
 */
export const Luxe = {
  ink: '#08090b',
  surface: '#0e1014',
  surfaceRaised: '#14171d',
  hairline: 'rgba(255, 255, 255, 0.10)',
  hairlineStrong: 'rgba(255, 255, 255, 0.2)',
  gold: '#c9a962',
  /** The single soft neon, used for lit rules and haloes. */
  glow: '#5fe6c8',
  text: '#f3f1ea',
  textMuted: '#8b8e97',
  textFaint: '#5b5e67',
  danger: '#d9756b',
} as const;

/**
 * `Palette` re-keyed onto the menu colours.
 *
 * The menu screens were written against the in-game palette, which is tuned to
 * sit on green baize and looks wrong in the quiet shell around it. Aliasing this
 * in place of `Palette` at the import restyles a whole screen in one line —
 * rewriting three files of stylesheets by hand would have been the same result
 * with thirty times the chance of missing one.
 */
export const MenuPalette = {
  background: Luxe.ink,
  surface: Luxe.surface,
  surfaceRaised: Luxe.surfaceRaised,
  border: Luxe.hairline,
  text: Luxe.text,
  textMuted: Luxe.textMuted,
  accent: Luxe.gold,
  accentText: Luxe.ink,
  danger: Luxe.danger,
  gold: Luxe.gold,
  rail: Luxe.gold,
  railDark: Luxe.surfaceRaised,
  railTop: Luxe.gold,
  pocket: Luxe.ink,
} as const;

/** Selected-state wash for the menus, replacing the in-game green. */
export const MENU_SELECTED = 'rgba(201, 169, 98, 0.12)';

export const Radius = {
  small: 8,
  medium: 14,
  large: 22,
  pill: 999,
} as const;
