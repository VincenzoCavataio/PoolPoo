/**
 * Graphics presets.
 *
 * Built around what actually costs a frame on a phone, which is fill rate: every
 * pixel is shaded once per dynamic light, and a material with clearcoat or sheen
 * costs roughly twice a plain one to shade. So the levers here are **lights and
 * materials**, in that order.
 *
 * Object count is deliberately not one of them. The room's furniture merges into
 * about thirty draw calls and twenty thousand vertices, which no device made in
 * the last decade notices — dropping the parquet would cost the room its floor
 * and buy back almost nothing. Turning off three point lights is worth more than
 * deleting every stick of furniture in the building.
 *
 * The frame cap is separate from the three presets on purpose: it is a question
 * about the display, not about the scene, and someone on a 120 Hz phone may well
 * want high detail *and* the extra frames.
 */

import type { MessageKey } from '@/i18n';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  id: QualityLevel;
  labelKey: MessageKey;
  feelKey: MessageKey;

  /**
   * Decorative point lights in the corners of the room — the neon, the floor
   * lamp, the arcade cabinets.
   *
   * The first thing to go. They light the furniture beside them and contribute
   * under a hundredth of what the table lamps do to the cloth, so losing them
   * costs atmosphere at the edges and nothing at all where the game happens.
   */
  spillLights: boolean;

  /**
   * How many lamps hang over the table.
   *
   * Never zero: they are what lights the game. At the lowest setting one lamp
   * does the work of two, which halves the most expensive light in the scene
   * and reads as a single low-hung shade rather than a fault.
   */
  tableLamps: number;

  /**
   * Clearcoat on the room's surfaces — the varnish on wood, the gloss on
   * plastic. Balls keep theirs regardless: they are the thing you look at.
   */
  propClearcoat: boolean;

  /**
   * Sheen on the cloth: the pale halo baize throws at grazing angles.
   *
   * Expensive, because it is a third specular lobe evaluated per light over the
   * largest surface on screen. Off, the cloth reads flatter but still reads as
   * cloth thanks to its colour and roughness.
   */
  clothSheen: boolean;

  /** Reflections of the room in the balls and rails. */
  environmentMap: boolean;

  /** Multisampling. The cheapest thing to lose and the most visible. */
  antialias: boolean;

  /** Soft contact shadow under each ball. */
  ballShadows: boolean;

  /**
   * How often the scene is redrawn.
   *
   * Part of the preset rather than a switch of its own. An unlimited option was
   * tried and removed: on a 60 Hz phone it can only ever mean "60", so it had
   * nothing to unlock, and the machinery it needed was what made frames hitch.
   *
   * 30 is a real setting, not a degraded one — every image simply held for two
   * refreshes of a 60 Hz panel, which is even and steady. It halves the work of
   * the most expensive thing in the frame, and on a phone that was struggling it
   * is the difference between smooth at 30 and uneven at 45.
   */
  fps: number;
}

export const QUALITY_PRESETS: QualityPreset[] = [
  {
    id: 'low',
    labelKey: 'quality.low',
    feelKey: 'quality.lowFeel',
    spillLights: false,
    tableLamps: 1,
    propClearcoat: false,
    clothSheen: false,
    environmentMap: false,
    antialias: false,
    ballShadows: true,
    fps: 30,
  },
  {
    id: 'medium',
    labelKey: 'quality.medium',
    feelKey: 'quality.mediumFeel',
    spillLights: false,
    tableLamps: 2,
    propClearcoat: true,
    clothSheen: false,
    environmentMap: true,
    antialias: true,
    ballShadows: true,
    fps: 60,
  },
  {
    id: 'high',
    labelKey: 'quality.high',
    feelKey: 'quality.highFeel',
    spillLights: true,
    tableLamps: 2,
    propClearcoat: true,
    clothSheen: true,
    environmentMap: true,
    antialias: true,
    ballShadows: true,
    fps: 60,
  },
];

export function qualityById(id: string): QualityPreset {
  return QUALITY_PRESETS.find((q) => q.id === id) ?? QUALITY_PRESETS[2];
}

/**
 * Roughly what a preset costs to shade, relative to high.
 *
 * A count of lights weighted by how expensive the materials they fall on are.
 * Not a benchmark — nothing here has been timed on a device — but it is the
 * arithmetic the presets were built from, and it is what the tests assert
 * against so the three levels cannot drift into being the same thing.
 */
export function relativeShadingCost(preset: QualityPreset): number {
  const lights = preset.tableLamps + (preset.spillLights ? 3 : 0) + 2; // + ambient, directional
  const material = 1 + (preset.propClearcoat ? 0.6 : 0) + (preset.clothSheen ? 0.3 : 0);
  const reflections = preset.environmentMap ? 1.15 : 1;
  return lights * material * reflections;
}

/**
 * How hard the app is allowed to work, as distinct from how good it looks.
 *
 * A second axis, deliberately not folded into `QualityPreset`. The two answer
 * different questions and a phone can want opposite things from them: a cheap
 * device with a good screen may well want the room to keep its lamps while the
 * *loop* around it does far less, and there is no single ladder of nine steps
 * that expresses that without half of its rungs being nonsense.
 *
 * **Nothing here touches the simulation.** The physics tick, the solver, the
 * rules and the shot outcome are identical at every level — the same input
 * produces the same shot on the cheapest phone and the most expensive. What
 * varies is only how often the *picture* is recomputed and redrawn, which is
 * work the game does for the eye and not for the table.
 *
 * That constraint is why the obvious lever is missing: resolution. Rendering at
 * a lower pixel ratio is the usual first move, and it does not work here — see
 * the note above `FLOOR_LOOK_FLOOR` in `scene.tsx`. expo-gl creates its drawing
 * buffer at the view's native size and cannot be told to make a smaller one, so
 * asking three.js for a lower ratio draws a small picture into the corner of a
 * full-size buffer rather than saving any fill rate at all.
 */
export type LoadLevel = 'light' | 'balanced' | 'full';

export interface LoadPreset {
  id: LoadLevel;
  labelKey: MessageKey;
  feelKey: MessageKey;

  /**
   * Redraw only when something has changed, rather than continuously.
   *
   * The largest saving available, and the one that costs nothing to look at.
   * Most of a game is spent with the table perfectly still — lining a shot up,
   * reading the board, deciding — and through all of it the scene is redrawn
   * sixty times a second from identical inputs, at the full price of eight
   * dynamic lights over nineteen physical materials.
   *
   * On demand, those frames are simply not drawn. The picture is the same one,
   * because nothing about it changed.
   */
  renderOnDemand: boolean;

  /**
   * How many times a second the aim guide is recomputed while dragging, or 0
   * for every frame.
   *
   * The guide is the most expensive thing on the JS thread during aiming: a
   * fresh prediction against every ball, cushion and pocket, then up to a
   * hundred and twenty-eight dots each given a position, a rotation, a scale, a
   * composed matrix and a colour, then two buffers uploaded.
   *
   * Capping it decouples the guide from the frame rate. The aim itself is not
   * capped — `aimAngle` still follows the finger exactly, the cue still turns
   * every frame, and the shot taken is the shot aimed. Only the dotted
   * *drawing* of where it will go lags by up to a frame or two, which is a
   * picture of a prediction and not the prediction itself.
   */
  guideHz: number;

  /**
   * Whether balls in motion leave a trail.
   *
   * Purely decorative, and priced per moving ball per frame: four quads each,
   * repositioned and recoloured every frame that anything is rolling — which is
   * exactly the frames where the physics is also at its busiest.
   */
  ballTrails: boolean;

  /**
   * Whether the room animates: the swaying lamps, the music device, the neon.
   *
   * Each is a `useFrame` of its own, and together they are the reason a still
   * table is never actually still. Off, the room is lit and furnished but does
   * not move — which on demand-rendering is also what lets the frame loop
   * genuinely idle.
   */
  roomAnimation: boolean;
}

export const LOAD_PRESETS: LoadPreset[] = [
  {
    id: 'light',
    labelKey: 'load.light',
    feelKey: 'load.lightFeel',
    renderOnDemand: true,
    guideHz: 20,
    ballTrails: false,
    roomAnimation: false,
  },
  {
    id: 'balanced',
    labelKey: 'load.balanced',
    feelKey: 'load.balancedFeel',
    renderOnDemand: true,
    guideHz: 30,
    ballTrails: true,
    roomAnimation: true,
  },
  {
    id: 'full',
    labelKey: 'load.full',
    feelKey: 'load.fullFeel',
    renderOnDemand: false,
    guideHz: 0,
    ballTrails: true,
    roomAnimation: true,
  },
];

export function loadById(id: string): LoadPreset {
  return LOAD_PRESETS.find((l) => l.id === id) ?? LOAD_PRESETS[2];
}
