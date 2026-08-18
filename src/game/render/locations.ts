/**
 * Playable locations: the room around the table, the light in it, and what is
 * standing against the walls.
 *
 * Pure data, so the whole look of the game is tunable from one file without
 * touching a component. That matters more than usual here because lighting
 * values are the kind of thing you only get right by looking at them on a real
 * screen — every number below is meant to be nudged.
 *
 * Intensities are in three.js' physically-based units, where a directional
 * light's intensity is irradiance directly but a point light's falls off as
 * `intensity / distance²`. That is why the lamps carry values around 9 while
 * the fill lights sit below 1: a lamp 1.45 m above the cloth divides by ~2.1.
 */

import type { MessageKey } from '@/i18n';

import type { PropGroup } from './props';

export interface LocationLamp {
  /** Scene position: x across the table, y up, z along its length. */
  position: [number, number, number];
  color: string;
  intensity: number;
  /** Radius of the visible shade. */
  shadeRadius: number;
  /** Length of the cord running up out of shot. */
  cordLength: number;
}

export interface GameLocation {
  id: string;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  /**
   * Puzzle stars needed to unlock. All five are currently open from the start;
   * the gate is kept because turning it back on is one number per location.
   */
  unlockStars: number;
  /** Clear colour behind everything. */
  background: string;
  floorColor: string;
  floorRoughness: number;
  /** Omit for an open-air location with no walls. */
  walls?: { color: string; height: number };
  ambient: { color: string; intensity: number };
  /** Broad fill so the table is never lit by lamps alone. */
  fill: { position: [number, number, number]; color: string; intensity: number };
  lamps: LocationLamp[];
  /** Furniture and set dressing to place. */
  props: PropGroup[];
  /**
   * The thing playing the music, in keeping with the room. It is the one prop
   * that is *not* merged into the static geometry: it has to be tappable and it
   * has to move.
   */
  musicDevice: MusicDevice;
  fog?: { color: string; near: number; far: number };
}

export type MusicDeviceKind = 'turntable' | 'jukebox' | 'radio';

export interface MusicDevice {
  kind: MusicDeviceKind;
  labelKey: MessageKey;
  position: [number, number, number];
  /** Rotation about the vertical axis, so it faces into the room. */
  rotationY: number;
  /**
   * Height of the neon sign above the shelf board.
   *
   * Also where a tap has to land: the sign is the lit part, so it is what the
   * eye goes to and what the finger aims at.
   */
  signHeight: number;
  /**
   * True where there is no wall behind the unit — the rooftop. It grows a pair
   * of legs down to the floor instead of appearing to hang off thin air.
   */
  freestanding?: boolean;
}

/** Cloth sits at y = 0, so the floor is a table's height below it. */
export const FLOOR_Y = -0.78;

/**
 * Room footprint. Scene z runs along the table's length, so it is the longer.
 * Kept deliberately snug: a warehouse-sized room pushes the set dressing so far
 * from the table that none of it is legible on a phone.
 */
export const ROOM = { width: 5.2, depth: 7.0 } as const;

export const LOCATIONS: GameLocation[] = [
  {
    id: 'sala',
    labelKey: 'location.sala',
    descriptionKey: 'location.salaBody',
    unlockStars: 0,
    background: '#0a0d0b',
    floorColor: '#4a3221',
    floorRoughness: 0.85,
    walls: { color: '#2e4239', height: 3.0 },
    ambient: { color: '#9fb4c4', intensity: 0.5 },
    fill: { position: [1.4, 3.0, 1.6], color: '#cfd8e6', intensity: 0.5 },
    lamps: [
      {
        position: [0, 1.45, -0.62],
        color: '#ffd9a0',
        intensity: 9,
        shadeRadius: 0.17,
        cordLength: 1.4,
      },
      {
        position: [0, 1.45, 0.62],
        color: '#ffd9a0',
        intensity: 9,
        shadeRadius: 0.17,
        cordLength: 1.4,
      },
    ],
    musicDevice: {
      kind: 'turntable',
      labelKey: 'device.turntable',
      position: [ROOM.width / 2 - 0.16, 0.55, -1.75],
      rotationY: -Math.PI / 2,
      signHeight: 0.44,
    },
    props: [
      'shelf',
      'speakers',
      'bookcase',
      'plants',
      'neon',
      'cueRack',
      'art',
      'stool',
      'clock',
      'rug',
      'sideTable',
      'floorLamp',
    ],
    fog: { color: '#0a0d0b', near: 8, far: 20 },
  },
  {
    id: 'garage',
    labelKey: 'location.garage',
    descriptionKey: 'location.garageBody',
    unlockStars: 0,
    background: '#14171a',
    floorColor: '#4c4f52',
    floorRoughness: 0.95,
    walls: { color: '#4d545a', height: 2.8 },
    ambient: { color: '#dfe9ff', intensity: 0.68 },
    fill: { position: [-1.2, 3.2, -1.0], color: '#eaf1ff', intensity: 0.9 },
    lamps: [
      {
        position: [0, 1.7, 0],
        color: '#e8f2ff',
        intensity: 13,
        shadeRadius: 0.24,
        cordLength: 1.0,
      },
    ],
    musicDevice: {
      kind: 'radio',
      labelKey: 'device.radioWork',
      position: [1.45, 0.55, -ROOM.depth / 2 + 0.16],
      rotationY: 0,
      signHeight: 0.4,
    },
    props: ['shelf', 'speakers', 'bookcase', 'cueRack', 'neon', 'sideTable', 'plants'],
  },
  {
    id: 'arcade',
    labelKey: 'location.arcade',
    descriptionKey: 'location.arcadeBody',
    unlockStars: 0,
    background: '#0a0714',
    floorColor: '#2a1f38',
    floorRoughness: 0.9,
    walls: { color: '#2b2049', height: 3.0 },
    ambient: { color: '#8f7fd8', intensity: 0.46 },
    fill: { position: [0.8, 3.2, -1.4], color: '#c9bdff', intensity: 0.45 },
    lamps: [
      {
        position: [0, 1.5, 0],
        color: '#ffe0b0',
        intensity: 8,
        shadeRadius: 0.19,
        cordLength: 1.35,
      },
    ],
    musicDevice: {
      kind: 'jukebox',
      labelKey: 'device.jukebox',
      position: [-ROOM.width / 2 + 0.42, FLOOR_Y, -0.8],
      rotationY: Math.PI / 2,
      signHeight: 1.72,
    },
    props: ['arcade', 'speakers', 'neon', 'cueRack', 'stool', 'rug', 'plants'],
    fog: { color: '#0a0714', near: 7.5, far: 18 },
  },
  {
    id: 'terrazza',
    labelKey: 'location.terrazza',
    descriptionKey: 'location.terrazzaBody',
    unlockStars: 0,
    background: '#070b14',
    floorColor: '#2b2a2c',
    floorRoughness: 0.8,
    ambient: { color: '#5f79b8', intensity: 0.46 },
    fill: { position: [-2.0, 4.0, -2.4], color: '#aebfe8', intensity: 0.75 },
    lamps: [
      {
        position: [-0.5, 1.4, -0.9],
        color: '#ffc98a',
        intensity: 6,
        shadeRadius: 0.11,
        cordLength: 1.2,
      },
      {
        position: [0.5, 1.4, 0.9],
        color: '#ffc98a',
        intensity: 6,
        shadeRadius: 0.11,
        cordLength: 1.2,
      },
    ],
    musicDevice: {
      kind: 'radio',
      labelKey: 'device.boombox',
      position: [-ROOM.width / 2 + 0.16, 0.55, -1.0],
      rotationY: Math.PI / 2,
      signHeight: 0.4,
      freestanding: true,
    },
    props: ['plants', 'stool', 'neon', 'sideTable', 'floorLamp'],
    fog: { color: '#070b14', near: 6, far: 15 },
  },
  {
    id: 'studio',
    labelKey: 'location.studio',
    descriptionKey: 'location.studioBody',
    unlockStars: 0,
    background: '#c9ccd0',
    floorColor: '#b9bdc2',
    floorRoughness: 0.7,
    walls: { color: '#d7dade', height: 3.8 },
    ambient: { color: '#ffffff', intensity: 1.5 },
    fill: { position: [1.6, 3.6, 2.0], color: '#ffffff', intensity: 1.4 },
    lamps: [],
    musicDevice: {
      kind: 'radio',
      labelKey: 'device.monitor',
      position: [ROOM.width / 2 - 0.16, 0.55, -0.8],
      rotationY: -Math.PI / 2,
      signHeight: 0.4,
    },
    props: [],
  },
];

export function locationById(id: string): GameLocation {
  return LOCATIONS.find((l) => l.id === id) ?? LOCATIONS[0];
}

export function isLocationUnlocked(location: GameLocation, earnedStars: number): boolean {
  return earnedStars >= location.unlockStars;
}

/**
 * The location actually rendered.
 *
 * Guards against a stored choice the player no longer has. Nothing is gated
 * today, but the check costs a line and stops a stale setting from rendering a
 * room the player cannot pick.
 */
export function effectiveLocation(id: string, stars: Record<string, number>): GameLocation {
  const earned = Object.values(stars).reduce((sum, value) => sum + value, 0);
  const chosen = locationById(id);
  return isLocationUnlocked(chosen, earned) ? chosen : LOCATIONS[0];
}
