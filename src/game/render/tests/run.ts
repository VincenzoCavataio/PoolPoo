/**
 * Render-layer test suite. `npm run test:render`
 *
 * Only the parts that are plain data. The number atlas is rasterised in JS from
 * vector outlines into a distance field, so the things most likely to go wrong —
 * a cell offset that puts the 7 on the 3, glyphs bleeding into the neighbouring
 * cell, or the field collapsing back into a hard-edged bitmap — are checkable
 * here rather than by squinting at a phone.
 */

import { assert, assertClose, assertEqual, report, suite, test } from '../../core/tests/harness';
import { createTable } from '../../core/table';
import { BALL_RADIUS } from '../../core/constants';
import { spinAxis, spinRate } from '../coords';
import { createNumberAtlas, NUMBER_ATLAS_GRID } from '../ball-numbers';
import { LOCATIONS, ROOM, type MusicDevice } from '../locations';

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


suite('music device placement', () => {
  /**
   * The unit's box in its own axes: half a metre wide, and reaching from just
   * behind the backing board out to the front lip of the shelf. The sign and
   * its glow sit inside that width.
   */
  const HALF_WIDTH = 0.5;
  const BEHIND = 0.06;
  const AHEAD = 0.32;

  /** The unit's footprint in world axes, given the wall it is turned against. */
  function footprint(device: MusicDevice) {
    const [x, , z] = device.position;
    const sin = Math.sin(device.rotationY);
    const cos = Math.cos(device.rotationY);

    // Local +Z points into the room; local +X runs along the wall.
    const alongX = Math.abs(cos) * HALF_WIDTH;
    const alongZ = Math.abs(sin) * HALF_WIDTH;
    const outX = sin;
    const outZ = cos;

    const xs = [x + outX * AHEAD, x - outX * BEHIND];
    const zs = [z + outZ * AHEAD, z - outZ * BEHIND];
    return {
      minX: Math.min(...xs) - alongX,
      maxX: Math.max(...xs) + alongX,
      minZ: Math.min(...zs) - alongZ,
      maxZ: Math.max(...zs) + alongZ,
    };
  }

  test('every unit stays inside the room', () => {
    for (const location of LOCATIONS) {
      const box = footprint(location.musicDevice);
      const halfW = ROOM.width / 2 + 0.01;
      const halfD = ROOM.depth / 2 + 0.01;
      assert(
        box.minX >= -halfW && box.maxX <= halfW && box.minZ >= -halfD && box.maxZ <= halfD,
        `${location.id}: the unit pokes through a wall`,
      );
    }
  });

  test('every unit is against a wall, unless it says otherwise', () => {
    for (const location of LOCATIONS) {
      const device = location.musicDevice;
      if (device.freestanding) continue;
      const [x, , z] = device.position;
      const toWall = Math.min(ROOM.width / 2 - Math.abs(x), ROOM.depth / 2 - Math.abs(z));
      assert(toWall <= 0.5, `${location.id}: the unit floats ${toWall.toFixed(2)}m off the wall`);
    }
  });

  test('every unit faces into the room', () => {
    for (const location of LOCATIONS) {
      const device = location.musicDevice;
      const [x, , z] = device.position;
      // The outward normal has to point back towards the middle of the room,
      // or the player is looking at the back of the shelf.
      const towardsCentre =
        Math.sin(device.rotationY) * -x + Math.cos(device.rotationY) * -z;
      assert(towardsCentre > 0, `${location.id}: the unit faces the wall`);
    }
  });

  test('no unit overhangs the table', () => {
    const table = createTable();
    // Scene X is the table's width, scene Z its length.
    const halfX = table.halfWidth + 0.15;
    const halfZ = table.halfLength + 0.15;

    for (const location of LOCATIONS) {
      const box = footprint(location.musicDevice);
      const overlaps =
        box.minX < halfX && box.maxX > -halfX && box.minZ < halfZ && box.maxZ > -halfZ;
      assert(!overlaps, `${location.id}: the unit reaches over the table`);
    }
  });

  test('the sign clears the shelf and stays in eyeline', () => {
    for (const location of LOCATIONS) {
      const device = location.musicDevice;
      const floorToSign = device.position[1] + device.signHeight;
      assert(device.signHeight > 0.3, `${location.id}: the sign sits on the board`);
      assert(floorToSign > 0.6 && floorToSign < 2.4, `${location.id}: the sign is out of eyeline`);
    }
  });
});

suite('how balls are drawn turning', () => {
  const roll = (v: number) => ({ x: 0, y: v / BALL_RADIUS, z: 0 });

  /**
   * The renderer used to infer rotation from a ball's velocity, which silently
   * assumed it rolls without slipping. Once the solver gained real spin that
   * became wrong in the most visible way possible: a ball struck with heavy draw
   * slides backwards while being drawn rolling forwards, and one spinning at 237
   * rad/s was drawn turning at ten. It read as the ball speeding up and slowing
   * down for no reason.
   */
  test('a ball rolling forward turns the way it travels', () => {
    const [x, y, z] = spinAxis(roll(1));
    // Sim +x maps to scene -z, so a forward roll turns about scene -x.
    assert(x < -0.99, `forward roll should turn about -x, got x=${x.toFixed(3)}`);
    assertClose(y, 0, 1e-9, 'forward roll should not tilt');
    assertClose(z, 0, 1e-9, 'forward roll should not yaw');
  });

  test('backspin turns the opposite way to forward roll', () => {
    const [forward] = spinAxis(roll(1));
    const [backward] = spinAxis(roll(-1));
    assert(
      forward * backward < 0,
      'draw and follow have to spin the ball in opposite directions',
    );
  });

  test('the drawn rate is the real one, not one guessed from the speed', () => {
    // A ball barely moving but spinning hard: this is exactly the state a draw
    // shot passes through, and the old code drew it almost stationary.
    const heavy = { x: 0, y: -237, z: 0 };
    assertClose(spinRate(heavy), 237, 1e-9, 'rate should come from w');
  });

  test('english shows as spin about the upright axis', () => {
    const [x, y, z] = spinAxis({ x: 0, y: 0, z: 5 });
    assert(y > 0.99, `english should turn about scene up, got y=${y.toFixed(3)}`);
    assertClose(x, 0, 1e-9, 'english should not roll the ball forward');
    assertClose(z, 0, 1e-9, 'english should not roll the ball sideways');
  });

  test('a still ball is not turning at all', () => {
    assertEqual(spinRate({ x: 0, y: 0, z: 0 }), 0, 'a parked ball must not spin');
    const [x, y, z] = spinAxis({ x: 0, y: 0, z: 0 });
    assertEqual(x + y + z, 0, 'a parked ball has no axis');
  });
});

report();
