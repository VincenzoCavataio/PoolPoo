/**
 * Render-layer test suite. `npm run test:render`
 *
 * Only the parts that are plain data. The number atlas is rasterised in JS from
 * vector outlines into a distance field, so the things most likely to go wrong —
 * a cell offset that puts the 7 on the 3, glyphs bleeding into the neighbouring
 * cell, or the field collapsing back into a hard-edged bitmap — are checkable
 * here rather than by squinting at a phone.
 */

import { assert, assertEqual, report, suite, test } from '../../core/tests/harness';
import { createNumberAtlas, NUMBER_ATLAS_GRID } from '../ball-numbers';

const CELL = 64;
const SIZE = CELL * NUMBER_ATLAS_GRID;
/** Alpha above this is inside the stroke; the shader thresholds at the same place. */
const INSIDE = 128;

function atlasPixels(): Uint8Array {
  const texture = createNumberAtlas();
  return texture.image.data as Uint8Array;
}

function cellOrigin(ball: number): [number, number] {
  return [(ball % NUMBER_ATLAS_GRID) * CELL, Math.floor(ball / NUMBER_ATLAS_GRID) * CELL];
}

function alphaAt(data: Uint8Array, x: number, y: number): number {
  return data[(y * SIZE + x) * 4 + 3];
}

/** Pixels inside the stroke, within the cell belonging to `ball`. */
function cellInk(data: Uint8Array, ball: number): number {
  const [originX, originY] = cellOrigin(ball);
  let ink = 0;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (alphaAt(data, originX + x, originY + y) >= INSIDE) ink += 1;
    }
  }
  return ink;
}

/** A cell's stroke as a string, for comparing one glyph against another. */
function cellSignature(data: Uint8Array, ball: number): string {
  const [originX, originY] = cellOrigin(ball);
  let signature = '';
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      signature += alphaAt(data, originX + x, originY + y) >= INSIDE ? '#' : '.';
    }
  }
  return signature;
}

suite('ball number atlas', () => {
  test('the atlas is a full 4x4 grid of RGBA cells', () => {
    const texture = createNumberAtlas();
    assertEqual(texture.image.width, SIZE, 'atlas width');
    assertEqual(texture.image.height, SIZE, 'atlas height');
    assertEqual((texture.image.data as Uint8Array).length, SIZE * SIZE * 4, 'atlas byte length');
    // v = 0 must mean the first row of data, which is what the shader assumes.
    assertEqual(texture.flipY, false, 'flipY');
  });

  test('the cue ball cell is blank all the way to zero', () => {
    const data = atlasPixels();
    const [originX, originY] = cellOrigin(0);
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        assertEqual(alphaAt(data, originX + x, originY + y), 0, `alpha at ${x},${y} of cell 0`);
      }
    }
  });

  test('every numbered ball has a legible glyph', () => {
    const data = atlasPixels();
    for (let ball = 1; ball <= 15; ball++) {
      const ink = cellInk(data, ball);
      assert(ink >= 120, `ball ${ball} drew only ${ink} pixels of stroke`);
      assert(ink <= CELL * CELL * 0.45, `ball ${ball} is a solid blob (${ink} pixels)`);
    }
  });

  test('it is a distance field, not a bitmap', () => {
    // The value of the whole exercise: a real ramp between inside and outside.
    // A hard-edged bitmap would have almost no intermediate values, and would be
    // exactly the pixelated look this replaced.
    const data = atlasPixels();

    let soft = 0;
    let hard = 0;
    for (let i = 3; i < data.length; i += 4) {
      const alpha = data[i];
      if (alpha > 20 && alpha < 235) soft += 1;
      else if (alpha >= 235) hard += 1;
    }

    assert(hard > 0, 'nothing is solidly inside a stroke');
    assert(soft > hard * 0.5, `only ${soft} soft texels against ${hard} solid ones`);
  });

  test('no glyph bleeds outside its own cell', () => {
    const data = atlasPixels();

    let total = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] >= INSIDE) total += 1;
    }

    let inCells = 0;
    for (let ball = 0; ball < NUMBER_ATLAS_GRID * NUMBER_ATLAS_GRID; ball++) {
      inCells += cellInk(data, ball);
    }

    assertEqual(inCells, total, 'pixels accounted for by cells');
  });

  test('different numbers draw different glyphs', () => {
    const data = atlasPixels();
    const seen = new Map<string, number>();

    for (let ball = 1; ball <= 15; ball++) {
      const signature = cellSignature(data, ball);
      const clash = seen.get(signature);
      assert(clash === undefined, `balls ${clash} and ${ball} share the same glyph`);
      seen.set(signature, ball);
    }
  });

  test('two-digit numbers are wider than single digits', () => {
    const data = atlasPixels();

    const widthOf = (ball: number) => {
      const [originX, originY] = cellOrigin(ball);
      let min = CELL;
      let max = -1;
      for (let y = 0; y < CELL; y++) {
        for (let x = 0; x < CELL; x++) {
          if (alphaAt(data, originX + x, originY + y) < INSIDE) continue;
          if (x < min) min = x;
          if (x > max) max = x;
        }
      }
      return max - min + 1;
    };

    assert(widthOf(12) > widthOf(2), 'the 12 should be wider than the 2');
    assert(widthOf(15) > widthOf(5), 'the 15 should be wider than the 5');
  });

  test('glyphs stay inside the cell with a margin', () => {
    const data = atlasPixels();

    for (let ball = 1; ball <= 15; ball++) {
      const [originX, originY] = cellOrigin(ball);
      for (let y = 0; y < CELL; y++) {
        for (let x = 0; x < CELL; x++) {
          if (alphaAt(data, originX + x, originY + y) < INSIDE) continue;
          // The shader maps the cell onto a round badge, so ink at the very edge
          // would land on the curve where it cannot be read.
          assert(x >= 3 && x < CELL - 3, `ball ${ball} has stroke at column ${x}`);
          assert(y >= 3 && y < CELL - 3, `ball ${ball} has stroke at row ${y}`);
        }
      }
    }
  });

  test('the glyphs sit centred in their cell', () => {
    const data = atlasPixels();

    for (let ball = 1; ball <= 15; ball++) {
      const [originX, originY] = cellOrigin(ball);
      let minX = CELL;
      let maxX = -1;
      let minY = CELL;
      let maxY = -1;

      for (let y = 0; y < CELL; y++) {
        for (let x = 0; x < CELL; x++) {
          if (alphaAt(data, originX + x, originY + y) < INSIDE) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }

      const centreX = (minX + maxX) / 2;
      const centreY = (minY + maxY) / 2;
      assert(Math.abs(centreX - CELL / 2) < 4, `ball ${ball} is off-centre horizontally`);
      assert(Math.abs(centreY - CELL / 2) < 4, `ball ${ball} is off-centre vertically`);
    }
  });
});

report();
