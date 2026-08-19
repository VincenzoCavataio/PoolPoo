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

import type { Obstacle } from '@/game/core/table';
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

/**
 * Furniture a ball knocked off the table can actually hit, per room.
 *
 * Declared here, in **scene** coordinates, because this is the file that decides
 * where the furniture stands — keeping the numbers next to the layout is the
 * only way they stay in step with it. `obstaclesFor` converts them into the
 * solver's axes, which are rotated.
 *
 * Only pieces standing on the floor within reach of the table are listed. The
 * wall art, the ceiling lamps and anything up on a shelf can never be reached by
 * a ball rolling across the carpet, so giving them collision would cost work and
 * change nothing.
 */
interface SceneObstacle {
  /** Centre and half-extents on the floor, in scene axes. */
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  height: number;
  /** How lively the piece is when struck: glass rings, upholstery does not. */
  restitution: number;
}

const FURNITURE: Record<string, SceneObstacle[]> = {
  sala: [
    // Measured from the shapes `props.tsx` actually draws, not estimated. An
    // approximation smaller than the furniture lets a ball sink into it, and one
    // in the wrong place is a collision box with nothing to collide with.
    { x: 2.41, z: 0.0, halfX: 0.17, halfZ: 1.1, height: 1.93, restitution: 0.4 },
    { x: -2.42, z: -1.8, halfX: 0.16, halfZ: 0.82, height: 1.9, restitution: 0.35 },
    { x: -2.51, z: 0.9, halfX: 0.06, halfZ: 0.3, height: 1.56, restitution: 0.45 },
    // Glass and hardwood: the liveliest thing on the floor.
    { x: -2.36, z: -0.2, halfX: 0.24, halfZ: 0.58, height: 1.66, restitution: 0.5 },
    // Velvet over a frame, so the chairs swallow a ball rather than return it.
    { x: -0.92, z: 2.95, halfX: 0.35, halfZ: 0.37, height: 0.93, restitution: 0.12 },
    { x: 0.33, z: 2.95, halfX: 0.35, halfZ: 0.36, height: 0.93, restitution: 0.12 },
    { x: 1.6, z: 2.0, halfX: 0.2, halfZ: 0.2, height: 0.67, restitution: 0.3 },
    { x: -1.55, z: 2.15, halfX: 0.2, halfZ: 0.2, height: 0.67, restitution: 0.3 },
    { x: 0.75, z: -3.0, halfX: 0.3, halfZ: 0.3, height: 0.96, restitution: 0.35 },
    { x: 2.1, z: -2.5, halfX: 0.23, halfZ: 0.23, height: 1.77, restitution: 0.3 },
    // Soil in terracotta: almost dead.
    { x: 2.06, z: 2.79, halfX: 0.28, halfZ: 0.24, height: 1.05, restitution: 0.15 },
    { x: -2.09, z: 2.59, halfX: 0.25, halfZ: 0.22, height: 1.08, restitution: 0.15 },
    { x: -1.34, z: -2.91, halfX: 0.28, halfZ: 0.24, height: 1.05, restitution: 0.15 },
    { x: 2.38, z: -1.55, halfX: 0.19, halfZ: 0.16, height: 0.9, restitution: 0.35 },
    { x: 2.38, z: 1.55, halfX: 0.19, halfZ: 0.16, height: 0.9, restitution: 0.35 },
  ],
};

/**
 * The room's furniture in the solver's axes.
 *
 * Scene `x` is sim `y`, and scene `z` is sim `-x` (see `coords.ts`), so a
 * footprint's half-extents swap over as well as its centre.
 */
export function obstaclesFor(locationId: string): Obstacle[] {
  const pieces = FURNITURE[locationId] ?? [];
  return pieces.map((o) => ({
    x: -o.z,
    y: o.x,
    halfX: o.halfZ,
    halfY: o.halfX,
    height: o.height,
    restitution: o.restitution,
  }));
}

export const LOCATIONS: GameLocation[] = [
  {
    id: 'sala',
    labelKey: 'location.sala',
    descriptionKey: 'location.salaBody',
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
      'parquet',
      'rug',
      'shelf',
      'speakers',
      'bookcase',
      'plants',
      'neon',
      'cueRack',
      'gallery',
      'armchair',
      'trophyCase',
      'stool',
      'clock',
      'sideTable',
      'floorLamp',
    ],
    fog: { color: '#0a0d0b', near: 8, far: 20 },
  },
  {
    id: 'garage',
    labelKey: 'location.garage',
    descriptionKey: 'location.garageBody',
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

/**
 * The location actually rendered.
 *
 * Guards against a stored id that no longer names a room, which is all it has to
 * do: this used to take the player's star count and gate rooms behind it, but
 * the stars came from the puzzle levels and every room's requirement was already
 * zero. Carrying a parameter that could not change the answer only made the
 * caller look up something it did not need.
 */
export function effectiveLocation(id: string): GameLocation {
  return locationById(id);
}
