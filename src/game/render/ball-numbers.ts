/**
 * The numbers printed on the balls.
 *
 * React Native has no `canvas`, so there is nothing to draw text into and no
 * font to draw it with. The digits are therefore described here as **vector
 * outlines** — strokes made of straight runs and flattened arcs — and rasterised
 * into a **signed distance field** rather than into pixels.
 *
 * That distinction is the whole point. A bitmap glyph blown up across a ball's
 * badge shows its own pixels; a distance field stores how far each texel is from
 * the edge of the stroke, so the shader can recover a clean edge at any size with
 * a single `smoothstep`. The atlas is small and the digits still look drawn
 * rather than plotted.
 *
 * Cell `n` holds ball `n` on a 4×4 grid, so the shader finds a cell from one
 * per-instance float with a `mod` and a `floor`.
 */

import * as THREE from 'three';

const CELL = 64;
const GRID = 4;
const SIZE = CELL * GRID;

/** Stroke half-width, as a fraction of the glyph's height. */
const STROKE = 0.108;
/** Distance, in texels, over which the field ramps from inside to outside. */
const SPREAD = 7;
/** Segments used to flatten a full ellipse; partial arcs scale down from this. */
const ARC_STEPS = 18;

export const NUMBER_ATLAS_GRID = GRID;

/** A glyph is a set of open or closed strokes in a unit box, y pointing up. */
type Point = [number, number];
type Stroke = Point[];

function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fromDeg: number,
  toDeg: number,
): Stroke {
  const sweep = Math.abs(toDeg - fromDeg);
  const steps = Math.max(4, Math.round((ARC_STEPS * sweep) / 360));
  const points: Stroke = [];

  for (let i = 0; i <= steps; i++) {
    const angle = ((fromDeg + ((toDeg - fromDeg) * i) / steps) * Math.PI) / 180;
    points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
  }
  return points;
}

/**
 * A geometric, single-weight set of digits. Round joins come for free: the
 * distance to a polyline is already rounded at every vertex.
 */
const GLYPHS: Record<string, Stroke[]> = {
  '0': [arc(0.5, 0.5, 0.31, 0.42, 0, 360)],
  '1': [
    [
      [0.22, 0.71],
      [0.5, 0.93],
      [0.5, 0.07],
    ],
  ],
  '2': [
    arc(0.5, 0.65, 0.3, 0.28, 200, -22),
    [
      [0.78, 0.55],
      [0.15, 0.08],
      [0.87, 0.08],
    ],
  ],
  '3': [
    arc(0.5, 0.71, 0.27, 0.22, 170, -75),
    arc(0.5, 0.3, 0.31, 0.26, 80, -195),
  ],
  '4': [
    [
      [0.7, 0.93],
      [0.1, 0.31],
      [0.92, 0.31],
    ],
    [
      [0.7, 0.93],
      [0.7, 0.07],
    ],
  ],
  '5': [
    [
      [0.82, 0.93],
      [0.26, 0.93],
      [0.21, 0.56],
    ],
    arc(0.52, 0.32, 0.32, 0.27, 105, -160),
  ],
  '6': [
    arc(0.53, 0.6, 0.34, 0.33, 178, 92),
    arc(0.5, 0.3, 0.32, 0.28, 0, 360),
  ],
  '7': [
    [
      [0.12, 0.93],
      [0.88, 0.93],
      [0.36, 0.07],
    ],
  ],
  '8': [
    arc(0.5, 0.71, 0.26, 0.22, 0, 360),
    arc(0.5, 0.29, 0.31, 0.27, 0, 360),
  ],
  '9': [
    arc(0.5, 0.7, 0.32, 0.28, 0, 360),
    arc(0.47, 0.4, 0.34, 0.33, -2, -95),
  ],
};

interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** Squared distance from a point to a segment. */
function distanceSquared(px: number, py: number, s: Segment): number {
  const abx = s.bx - s.ax;
  const aby = s.by - s.ay;
  const lengthSquared = abx * abx + aby * aby;

  let t = lengthSquared > 0 ? ((px - s.ax) * abx + (py - s.ay) * aby) / lengthSquared : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;

  const dx = px - (s.ax + abx * t);
  const dy = py - (s.ay + aby * t);
  return dx * dx + dy * dy;
}

function inkBounds(strokes: Stroke[]): { minX: number; maxX: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const stroke of strokes) {
    for (const [x] of stroke) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  return { minX, maxX };
}

/**
 * Places one number's strokes into cell coordinates, in texels.
 *
 * Each digit is measured and advanced by **its own width**, not by a shared box.
 * A 1 is far narrower than a 5, so centring the box rather than the ink leaves
 * it visibly shoved to one side of the badge — and a badge is a circle, where
 * being off-centre shows.
 */
function segmentsFor(value: number): { segments: Segment[]; strokeRadius: number } {
  const digits = String(value).split('');
  const glyphHeight = digits.length === 1 ? 42 : 34;
  const unitToTexels = glyphHeight * 0.62;

  /**
   * The gap between digits, measured between their *ink* rather than their
   * centre lines.
   *
   * `inkBounds` reports where the strokes' centre lines run, but each stroke is
   * drawn as a round-capped line of radius `STROKE * glyphHeight` — so every
   * digit spills that far past its measured edge on both sides. The old gap was
   * a tenth of the glyph height, which at two digits is 3.4 texels against a
   * stroke 7.3 texels thick: the neighbouring ink overlapped by about four
   * texels, and 11 and 12 ran their characters together.
   *
   * Budgeting one full stroke width for the overlap plus a real space of its own
   * leaves daylight between them at the size a ball is actually drawn.
   */
  const strokeRadius = STROKE * glyphHeight;
  const gap = strokeRadius * 2 + glyphHeight * 0.09;

  const placed = digits.map((digit) => {
    const strokes = GLYPHS[digit] ?? [];
    const { minX, maxX } = inkBounds(strokes);
    return { strokes, minX, width: (maxX - minX) * unitToTexels };
  });

  const totalWidth =
    placed.reduce((sum, entry) => sum + entry.width, 0) + gap * (placed.length - 1);
  const originY = (CELL - glyphHeight) / 2;

  const segments: Segment[] = [];
  let cursor = (CELL - totalWidth) / 2;

  for (const entry of placed) {
    for (const stroke of entry.strokes) {
      for (let i = 0; i < stroke.length - 1; i++) {
        segments.push({
          ax: cursor + (stroke[i][0] - entry.minX) * unitToTexels,
          // Unit boxes point y up; texels point y down.
          ay: originY + (1 - stroke[i][1]) * glyphHeight,
          bx: cursor + (stroke[i + 1][0] - entry.minX) * unitToTexels,
          by: originY + (1 - stroke[i + 1][1]) * glyphHeight,
        });
      }
    }
    cursor += entry.width + gap;
  }

  return { segments, strokeRadius };
}

/**
 * Alpha holds the field: 1 well inside the stroke, 0.5 exactly on its edge, 0
 * outside. The shader thresholds it at 0.5.
 */
export function createNumberAtlas(): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);

  for (let number = 1; number <= 15; number++) {
    const { segments, strokeRadius } = segmentsFor(number);
    if (segments.length === 0) continue;

    const cellX = (number % GRID) * CELL;
    const cellY = Math.floor(number / GRID) * CELL;

    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const px = x + 0.5;
        const py = y + 0.5;

        let nearest = Infinity;
        for (let i = 0; i < segments.length; i++) {
          const d2 = distanceSquared(px, py, segments[i]);
          if (d2 < nearest) nearest = d2;
        }

        const signed = Math.sqrt(nearest) - strokeRadius;
        const field = 0.5 - signed / SPREAD;
        const clamped = field < 0 ? 0 : field > 1 ? 1 : field;

        const index = ((cellY + y) * SIZE + cellX + x) * 4;
        data[index] = 10;
        data[index + 1] = 10;
        data[index + 2] = 12;
        data[index + 3] = Math.round(clamped * 255);
      }
    }
  }

  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
