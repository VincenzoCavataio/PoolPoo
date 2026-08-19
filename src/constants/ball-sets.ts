/**
 * Ball sets.
 *
 * A set is not only a repaint. Each one carries its own surface — how polished
 * it is, how much of the room it reflects — and those feed straight into the
 * material the renderer builds, so an aramith set and a set of clay balls do not
 * catch the lamps the same way.
 *
 * The numbering scheme changes too. A set can be the standard fifteen with
 * stripes, or it can drop the stripes entirely and run on colour alone, which is
 * what the numberless sets do — and that is a real difference in how quickly you
 * can read the table, not just a different look.
 *
 * Colours are per set rather than global. `colorForBall` used to be a fixed map
 * in the core, which meant the physics module owned the palette; sets moved it
 * out to where the rest of the presentation lives.
 */

import type { MessageKey } from '@/i18n';

export interface BallSurface {
  /**
   * How rough the finish is. Low is a mirror; high scatters the highlight into
   * a broad sheen.
   */
  roughness: number;
  /** Strength of the lacquer layer over the pigment. Phenolic resin is glassy. */
  clearcoat: number;
  /** How sharp that lacquer's reflection is. */
  clearcoatRoughness: number;
  /** How much of the room the ball picks up. */
  envMapIntensity: number;
}

export interface BallSet {
  id: string;
  labelKey: MessageKey;
  /** One line on what it looks like, for the picker. */
  feelKey: MessageKey;
  surface: BallSurface;
  /** Cue ball colour. */
  cue: string;
  /**
   * The fifteen object balls, in number order.
   *
   * Sets that stripe reuse the solid's colour for `n + 8`, which is how a real
   * set works and why this only needs seven entries plus the eight.
   */
  /**
   * Seven hues spread evenly round the wheel rather than picked by eye.
   *
   * Chosen that way because picking them by hand kept producing pairs a player
   * could confuse across a table — two pinks, or two muted blues — and fixing
   * one pair moved the collision to another. An even spread guarantees the
   * closest pair is as far apart as seven colours can be, and each set applies
   * its own saturation and lightness on top for character.
   */
  solids: [string, string, string, string, string, string, string];
  eight: string;
  /** False for sets that carry no stripes, so all fifteen read as solids. */
  striped: boolean;
}

export const BALL_SETS: BallSet[] = [
  {
    id: 'classica',
    labelKey: 'ballSet.classic',
    feelKey: 'ballSet.classicFeel',
    // Phenolic resin: hard, glassy, and the reference every other set is read
    // against.
    surface: { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.1 },
    cue: '#f7f4ec',
    solids: ['#c8a519', '#1970c8', '#c81919', '#8d19c8', '#c86219', '#19c88d', '#c8198d'],
    eight: '#141414',
    striped: true,
  },
  {
    id: 'notte',
    labelKey: 'ballSet.night',
    feelKey: 'ballSet.nightFeel',
    // Deep, saturated and very polished: these throw the lamps back hardest.
    surface: { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5 },
    cue: '#e8ecf2',
    solids: ['#ecc93c', '#3c94ec', '#ec3c3c', '#b13cec', '#ec853c', '#3cecb1', '#ec3cb1'],
    eight: '#0a0a12',
    striped: true,
  },
  {
    id: 'avorio',
    labelKey: 'ballSet.ivory',
    feelKey: 'ballSet.ivoryFeel',
    // Old clay and ivory: barely any lacquer, so the highlight is a soft bloom
    // rather than a hard point, and they pick up almost nothing of the room.
    surface: { roughness: 0.62, clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 0.5 },
    cue: '#efe6d2',
    solids: ['#baab6d', '#41668b', '#994848', '#613776', '#b17d59', '#4ba083', '#843e6d'],
    eight: '#2c2620',
    striped: true,
  },
  {
    id: 'tinta',
    labelKey: 'ballSet.solid',
    feelKey: 'ballSet.solidFeel',
    /**
     * Fifteen solids, no stripes and no numbers to read.
     *
     * The one set that changes the game rather than the look: without the
     * stripe band you identify a ball purely by hue, which is quicker at a
     * glance and much harder across the table. Colours are picked to stay
     * distinguishable at ball size and under warm lamps.
     */
    surface: { roughness: 0.34, clearcoat: 0.85, clearcoatRoughness: 0.08, envMapIntensity: 0.95 },
    cue: '#f4f4f4',
    solids: ['#d9b526', '#2680d9', '#d92626', '#9d26d9', '#d97126', '#26d99d', '#d9269d'],
    eight: '#17202a',
    striped: false,
  },
];

export function ballSetById(id: string): BallSet {
  return BALL_SETS.find((set) => set.id === id) ?? BALL_SETS[0];
}

/**
 * Colour for one ball in a given set.
 *
 * Zero is the cue ball, eight is the eight, and everything else indexes the
 * solids — with 9 to 15 folding back onto 1 to 7, which is what makes a striped
 * ball share its solid partner's colour.
 */
export function colorForBallIn(set: BallSet, n: number): string {
  if (n === 0) return set.cue;
  if (n === 8) return set.eight;
  const index = (n > 8 ? n - 8 : n) - 1;
  return set.solids[index] ?? '#cccccc';
}
