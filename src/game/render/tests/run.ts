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
import * as THREE from 'three';

import { createTable } from '../../core/table';
import { BALL_RADIUS, PHYSICS } from '../../core/constants';
import { spinAxis, spinRate, SPOT_RADIUS } from '../coords';
import { BALL_SETS, colorForBallIn } from '../../../constants/ball-sets';
import { QUALITY_PRESETS, relativeShadingCost } from '../../../constants/quality';
import { mergeShapes } from '../merge';
import { createNumberAtlas, NUMBER_ATLAS_GRID } from '../ball-numbers';
import { LOCATIONS, obstaclesFor, ROOM, type MusicDevice } from '../locations';
import { propFootprints, propParts } from '../props';
import { CUE_LENGTH, placeCues } from '../../../components/ui/cue-placement';

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

  /**
   * Two digits have to be two digits, not one wide smudge.
   *
   * The gap used to be measured between the digits' *centre lines*, while the
   * strokes are drawn as round-capped lines with real thickness — so each digit
   * spilled a stroke radius past its measured edge and the neighbouring ink
   * overlapped. Total width looked right, which is why the test above passed
   * while 11 and 12 ran together on the table.
   *
   * This looks for daylight: a column, somewhere in the middle of the number,
   * with no ink in it at all.
   */
  test('two-digit numbers have a clear gap between the digits', () => {
    const data = atlasPixels();

    for (const ball of [10, 11, 12, 13, 14, 15]) {
      const [originX, originY] = cellOrigin(ball);

      // Which columns carry ink, and where the number starts and ends.
      const inked: boolean[] = [];
      let first = CELL;
      let last = -1;
      for (let x = 0; x < CELL; x++) {
        let any = false;
        for (let y = 0; y < CELL; y++) {
          if (alphaAt(data, originX + x, originY + y) >= INSIDE) {
            any = true;
            break;
          }
        }
        inked[x] = any;
        if (any) {
          if (x < first) first = x;
          last = x;
        }
      }

      assert(last > first, `ball ${ball} drew nothing`);

      let clear = 0;
      for (let x = first + 1; x < last; x++) if (!inked[x]) clear++;

      assert(clear > 0, `ball ${ball} has no gap between its digits`);
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

suite('furniture layout', () => {
  const table = createTable();

  test('no piece of furniture stands on the table', () => {
    for (const id of LOCATIONS.map((l) => l.id)) {
      for (const o of obstaclesFor(id)) {
        const overX = Math.abs(o.x) - o.halfX < table.halfLength;
        const overY = Math.abs(o.y) - o.halfY < table.halfWidth;
        assert(!(overX && overY), `${id}: a piece at (${o.x}, ${o.y}) is on the table`);
      }
    }
  });

  /**
   * Every collision box has to sit on a piece of furniture that is really drawn
   * there.
   *
   * The table is written by hand, and the first version was wrong in both
   * directions: two plant boxes stood where no plant was, and the two stools and
   * two speakers had no box at all. A box in the wrong place is a ball bouncing
   * off thin air; a missing one is a ball rolling through a bookcase.
   */
  test('every collision box sits on something that is drawn', () => {
    const drawn = propFootprints(LOCATIONS.find((l) => l.id === 'sala')!.props);

    for (const o of obstaclesFor('sala')) {
      // Back into scene axes: sim x is scene -z, sim y is scene x.
      const sceneX = o.y;
      const sceneZ = -o.x;
      const near = drawn.find(
        (d) => Math.abs(d.x - sceneX) < 0.25 && Math.abs(d.z - sceneZ) < 0.25,
      );
      assert(
        near !== undefined,
        `a collision box at scene (${sceneX.toFixed(2)}, ${sceneZ.toFixed(2)}) ` +
          'has no furniture standing there',
      );
    }
  });

  test('everything a ball can hit has a collision box', () => {
    const boxes = obstaclesFor('sala').map((o) => ({ x: o.y, z: -o.x }));

    for (const piece of propFootprints(LOCATIONS.find((l) => l.id === 'sala')!.props)) {
      // Only pieces a ball can actually be stopped by. Individual cue shafts and
      // the pictures on the wall are drawn as their own slivers of geometry, and
      // giving each of them an obstacle would be pointless — a ball rolls past
      // anything this thin without ever meeting enough of it to bounce off.
      if (piece.height < BALL_RADIUS * 2) continue;
      if (piece.halfX < 0.08 || piece.halfZ < 0.08) continue;

      const covered = boxes.some(
        (b) => Math.abs(b.x - piece.x) < 0.25 && Math.abs(b.z - piece.z) < 0.25,
      );
      assert(
        covered,
        `the piece at scene (${piece.x.toFixed(2)}, ${piece.z.toFixed(2)}) ` +
          'has no collision box, so a ball rolls straight through it',
      );
    }
  });

  /**
   * Two boxes sharing a footprint leave a gap a ball can be wedged into, where
   * each piece keeps pushing it back towards the other.
   */
  test('no two pieces share the same floor space', () => {
    for (const id of LOCATIONS.map((l) => l.id)) {
      const pieces = obstaclesFor(id);
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          const a = pieces[i];
          const b = pieces[j];
          const clash =
            Math.abs(a.x - b.x) < a.halfX + b.halfX &&
            Math.abs(a.y - b.y) < a.halfY + b.halfY;
          assert(!clash, `${id}: two pieces overlap near (${a.x.toFixed(2)}, ${a.y.toFixed(2)})`);
        }
      }
    }
  });

  test('every piece stands inside the room', () => {
    for (const id of LOCATIONS.map((l) => l.id)) {
      for (const o of obstaclesFor(id)) {
        assert(
          Math.abs(o.x) + o.halfX <= PHYSICS.roomHalfX + BALL_RADIUS + 0.01 &&
            Math.abs(o.y) + o.halfY <= PHYSICS.roomHalfY + BALL_RADIUS + 0.01,
          `${id}: a piece at (${o.x.toFixed(2)}, ${o.y.toFixed(2)}) pokes through a wall`,
        );
      }
    }
  });

  test('every piece is solid enough to bounce a ball and no more', () => {
    for (const id of LOCATIONS.map((l) => l.id)) {
      for (const o of obstaclesFor(id)) {
        assert(
          o.restitution >= 0 && o.restitution < 1,
          `${id}: a piece has restitution ${o.restitution}, which would add energy`,
        );
        assert(o.halfX > 0 && o.halfY > 0 && o.height > 0, `${id}: a piece has no size`);
      }
    }
  });
});

suite('coplanar surfaces', () => {
  /**
   * Two flat faces sharing the same depth is a z-fight: the depth buffer cannot
   * decide which is in front and swaps between them as the camera moves, which
   * reads on screen as shimmering or flickering.
   *
   * The framed pictures had it badly — their layers were stacked backwards, so
   * the canvas sat inside the mount and the paint inside the canvas. This walks
   * every thin, wall-facing shape in the room and checks that any two sharing a
   * patch of wall are separated in depth by more than the fudge a depth buffer
   * can be trusted with at this range.
   */
  const MIN_SEPARATION = 0.0015;

  interface Slab {
    x: number;
    y: number;
    z: number;
    halfX: number;
    halfY: number;
    halfZ: number;
  }

  function wallSlabs(): Slab[] {
    const slabs: Slab[] = [];
    for (const location of LOCATIONS) {
      for (const part of propParts(location.props)) {
        if (!part.box) continue;
        const [w, h, d] = part.box;
        // Thin and facing the room: the shapes that stack up on a wall.
        if (d > 0.06 || w < 0.02 || h < 0.02) continue;
        const [x, y, z] = part.position;
        slabs.push({ x, y, z, halfX: w / 2, halfY: h / 2, halfZ: d / 2 });
      }
    }
    return slabs;
  }

  test('no two flat surfaces fight over the same depth', () => {
    const slabs = wallSlabs();
    let worst = Infinity;
    let where = '';

    for (let i = 0; i < slabs.length; i++) {
      for (let j = i + 1; j < slabs.length; j++) {
        const a = slabs[i];
        const b = slabs[j];
        // Only pairs that actually overlap when seen face-on.
        if (Math.abs(a.x - b.x) >= a.halfX + b.halfX) continue;
        if (Math.abs(a.y - b.y) >= a.halfY + b.halfY) continue;

        /**
         * Surfaces at the same depth are one object, not a conflict.
         *
         * The four bars of a picture frame sit at identical z and cross at the
         * corners on purpose — they cannot shimmer against each other because
         * there is no ambiguity about which is in front. What flickers is two
         * surfaces at *different* depths that are nonetheless too close for the
         * depth buffer to separate, so that is the only case worth flagging.
         */
        if (Math.abs(a.z - b.z) < 1e-6) continue;

        const gap = Math.abs(a.z - b.z) - (a.halfZ + b.halfZ);
        if (gap < worst) {
          worst = gap;
          where = `(${a.x.toFixed(2)}, ${a.y.toFixed(2)}) and (${b.x.toFixed(2)}, ${b.y.toFixed(2)})`;
        }
      }
    }

    assert(
      worst === Infinity || worst > -MIN_SEPARATION,
      `two surfaces overlap in depth by ${(-worst * 1000).toFixed(2)}mm at ${where}, ` +
        'which will shimmer as the camera turns',
    );
  });
});

suite('cue ball spots', () => {
  /**
   * Diameter of one spot in metres, from the shader's threshold.
   *
   * The shader tests the largest component of the ball's own surface normal
   * against `1 - SPOT_RADIUS`, so the value is a cosine and the marking it makes
   * is far wider than the number reads. Getting that wrong is what made the
   * first version cover half the ball.
   */
  const spotDiameter = 2 * BALL_RADIUS * Math.sin(Math.acos(1 - SPOT_RADIUS));

  test('a spot is a few millimetres, not a patch', () => {
    assert(
      spotDiameter < 0.012,
      `a spot is ${(spotDiameter * 1000).toFixed(1)}mm across, which reads as a pattern`,
    );
  });

  test('a spot is still big enough to see turning', () => {
    assert(
      spotDiameter > 0.004,
      `a spot is only ${(spotDiameter * 1000).toFixed(1)}mm across and would vanish`,
    );
  });

  /**
   * The spots have to be round, and the sphere they sit on is coarse.
   *
   * The shader thresholds the components of the ball's surface normal, and the
   * normal the rasteriser interpolates across a face is shorter than unit in the
   * middle of it. On a 24x18 sphere that shortening varies enough around the
   * equator — where the longitude lines are furthest apart — to squash the spots
   * by nearly half in one direction. Re-normalising per fragment restores a true
   * sphere to threshold against; this checks the boundary is the same distance
   * out whichever way you leave the centre.
   */
  test('a spot is round, not squashed by the mesh', () => {
    const segmentsLon = 24;
    const segmentsLat = 18;

    /** The interpolated, un-normalised normal the fragment stage receives. */
    function interpolated(theta: number, phi: number): [number, number, number] {
      const lon = (theta / (2 * Math.PI)) * segmentsLon;
      const lat = (phi / Math.PI) * segmentsLat;
      const l0 = Math.floor(lon);
      const p0 = Math.floor(lat);
      const fu = lon - l0;
      const fv = lat - p0;

      const corner = (li: number, pi: number): [number, number, number] => {
        const th = (li / segmentsLon) * 2 * Math.PI;
        const ph = (pi / segmentsLat) * Math.PI;
        return [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
      };

      const a = corner(l0, p0);
      const b = corner(l0 + 1, p0);
      const c = corner(l0, p0 + 1);
      const d = corner(l0 + 1, p0 + 1);
      return [0, 1, 2].map(
        (i) => (a[i] * (1 - fu) + b[i] * fu) * (1 - fv) + (c[i] * (1 - fu) + d[i] * fu) * fv,
      ) as [number, number, number];
    }

    // The +x spot sits on the equator, the worst case for this.
    const threshold = 1 - SPOT_RADIUS;
    const radii: number[] = [];
    for (let k = 0; k < 36; k++) {
      const around = (k / 36) * Math.PI * 2;
      let edge = 0;
      for (let t = 0; t < 0.4; t += 0.0005) {
        const theta = (t * Math.cos(around) + 2 * Math.PI) % (2 * Math.PI);
        const phi = Math.PI / 2 + t * Math.sin(around);
        const raw = interpolated(theta, phi);
        const length = Math.hypot(raw[0], raw[1], raw[2]);
        const n = raw.map((v) => v / length);
        const onAxis = Math.max(Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2]));
        if (onAxis > threshold) edge = t;
        else break;
      }
      radii.push(edge);
    }

    const smallest = Math.min(...radii);
    const largest = Math.max(...radii);
    const variation = (largest - smallest) / largest;
    assert(
      variation < 0.05,
      `the spot boundary varies by ${(variation * 100).toFixed(0)}% around its centre, ` +
        'so it is not round',
    );
  });

  test('a spot is a small fraction of the ball', () => {
    const share = spotDiameter / (BALL_RADIUS * 2);
    assert(share < 0.2, `a spot covers ${(share * 100).toFixed(0)}% of the ball's width`);
  });
});

suite('ball sets', () => {
  /** Straight RGB distance. Crude, but it is the axis a player judges on. */
  function apart(a: string, b: string): number {
    const parse = (hex: string) => hex.match(/\w\w/g)!.map((h) => parseInt(h, 16));
    const [r1, g1, b1] = parse(a);
    const [r2, g2, b2] = parse(b);
    return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
  }

  function closestPair(set: (typeof BALL_SETS)[number]) {
    const colours = [1, 2, 3, 4, 5, 6, 7].map((n) => colorForBallIn(set, n));
    let nearest = Infinity;
    let which = '';
    for (let i = 0; i < colours.length; i++) {
      for (let j = i + 1; j < colours.length; j++) {
        const d = apart(colours[i], colours[j]);
        if (d < nearest) {
          nearest = d;
          which = `${i + 1} and ${j + 1}`;
        }
      }
    }
    return { nearest, which };
  }

  /**
   * A set whose colours are the only way to tell balls apart has to keep them
   * far apart.
   *
   * Picking these by eye did not work: every hand-chosen palette ended up with a
   * pair a player could confuse across a table, and separating that pair moved
   * the collision somewhere else. Spreading the hues evenly is what fixed it,
   * and this is the check that keeps it fixed.
   */
  test('a set without stripes keeps its colours well apart', () => {
    for (const set of BALL_SETS) {
      if (set.striped) continue;
      const { nearest, which } = closestPair(set);
      assert(
        nearest > 60,
        `${set.id}: balls ${which} are only ${nearest.toFixed(0)} apart, and there ` +
          'are no stripes to tell them apart by',
      );
    }
  });

  /** Striped sets have a second cue, so they can afford a tighter palette. */
  test('every set stays usable', () => {
    for (const set of BALL_SETS) {
      const { nearest, which } = closestPair(set);
      assert(nearest > 30, `${set.id}: balls ${which} are ${nearest.toFixed(0)} apart`);
    }
  });

  test('a cue ball is never mistakable for an object ball', () => {
    for (const set of BALL_SETS) {
      for (let n = 1; n <= 8; n++) {
        const d = apart(set.cue, colorForBallIn(set, n));
        assert(d > 60, `${set.id}: ball ${n} is only ${d.toFixed(0)} from the cue ball`);
      }
    }
  });

  test('every set describes a real surface', () => {
    for (const set of BALL_SETS) {
      const s = set.surface;
      assert(s.roughness > 0 && s.roughness <= 1, `${set.id}: roughness out of range`);
      assert(s.clearcoat >= 0 && s.clearcoat <= 1, `${set.id}: clearcoat out of range`);
      assert(s.envMapIntensity >= 0, `${set.id}: negative reflection`);
    }
  });

  test('the sets differ by more than their colours', () => {
    // If every surface were identical the sets would be palettes, not sets.
    const finishes = new Set(BALL_SETS.map((s) => s.surface.roughness));
    assert(finishes.size === BALL_SETS.length, 'two sets share the same finish');
  });
});

suite('graphics presets', () => {
  const byId = Object.fromEntries(QUALITY_PRESETS.map((q) => [q.id, q]));

  /**
   * Three settings that cost the same are one setting with three names.
   *
   * The presets were built from `relativeShadingCost`, which counts lights
   * weighted by how expensive the materials they fall on are — the arithmetic
   * that decides what a frame costs on a phone. This holds them apart.
   */
  test('each level costs meaningfully less than the one above', () => {
    const high = relativeShadingCost(byId.high);
    const medium = relativeShadingCost(byId.medium);
    const low = relativeShadingCost(byId.low);

    assert(medium < high * 0.85, `medium is ${((medium / high) * 100).toFixed(0)}% of high`);
    assert(low < medium * 0.7, `low is ${((low / medium) * 100).toFixed(0)}% of medium`);
  });

  test('low costs less than half of high', () => {
    const ratio = relativeShadingCost(byId.low) / relativeShadingCost(byId.high);
    assert(ratio < 0.5, `low is ${(ratio * 100).toFixed(0)}% of high, which is not worth a setting`);
  });

  /**
   * The table always has to be lit. Every other light in the room is decoration
   * a preset may drop, but a preset that turns the lamps off has made the game
   * unplayable rather than cheaper.
   */
  test('every preset keeps a light over the table', () => {
    for (const preset of QUALITY_PRESETS) {
      assert(preset.tableLamps >= 1, `${preset.id} leaves the table unlit`);
    }
  });

  test('nothing above low gives up the reflections', () => {
    assert(byId.medium.environmentMap, 'medium should still reflect the room');
    assert(byId.high.environmentMap, 'high should still reflect the room');
  });

  test('high gives up nothing', () => {
    const high = byId.high;
    assert(
      high.spillLights && high.propClearcoat && high.clothSheen && high.environmentMap &&
        high.antialias && high.ballShadows,
      'high is meant to be the full scene',
    );
  });

  /** A preset that turns a feature back on at a lower level is a mistake. */
  test('features only ever come off going down', () => {
    const order = [byId.low, byId.medium, byId.high];
    const flags = ['spillLights', 'propClearcoat', 'clothSheen', 'environmentMap', 'antialias'] as const;

    for (const flag of flags) {
      let seenOn = false;
      for (const preset of order) {
        if (preset[flag]) seenOn = true;
        else
          assert(
            !seenOn,
            `${flag} is on at a lower level than ${preset.id} but off at ${preset.id}`,
          );
      }
    }
  });
});

suite('geometry merging', () => {
  /**
   * Welding shapes together is what keeps the draw call count down, and a draw
   * call on expo-gl is a trip across the JS bridge — the thing that was actually
   * causing stutter. But a merge that quietly loses or misplaces vertices would
   * be invisible in code and obvious on screen, so this checks the arithmetic.
   */
  test('a merge keeps every vertex', () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const perBox = box.toNonIndexed().getAttribute('position').count;

    const merged = mergeShapes([
      { key: 'a', geometry: box, position: [0, 0, 0] },
      { key: 'a', geometry: box, position: [3, 0, 0] },
      { key: 'b', geometry: box, position: [0, 5, 0] },
    ]);

    assertEqual(merged.get('a')!.getAttribute('position').count, perBox * 2, 'bucket a');
    assertEqual(merged.get('b')!.getAttribute('position').count, perBox, 'bucket b');
  });

  test('a merge puts the shapes where they were asked for', () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const merged = mergeShapes([
      { key: 'a', geometry: box, position: [0, 0, 0] },
      { key: 'a', geometry: box, position: [3, 0, 0] },
    ]);

    const geometry = merged.get('a')!;
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    assertClose(bounds.min.x, -0.5, 1e-6, 'left edge');
    assertClose(bounds.max.x, 3.5, 1e-6, 'right edge');
  });

  test('a merge carries rotation into the vertices', () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const merged = mergeShapes([
      { key: 'a', geometry: box, position: [0, 0, 0], rotation: [0, Math.PI / 4, 0] },
    ]);

    const geometry = merged.get('a')!;
    geometry.computeBoundingBox();
    // A unit cube turned 45 degrees about y is sqrt(2) across.
    assertClose(geometry.boundingBox!.max.x, Math.SQRT1_2, 1e-6, 'turned width');
  });

  test('a merge keeps normals, or the result renders unlit', () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const merged = mergeShapes([{ key: 'a', geometry: box, position: [0, 0, 0] }]);
    const normals = merged.get('a')!.getAttribute('normal');
    assert(normals !== undefined, 'the merged geometry has no normals');
    // Rotation must leave them unit length, or the lighting goes wrong.
    const x = normals.getX(0);
    const y = normals.getY(0);
    const z = normals.getZ(0);
    assertClose(Math.hypot(x, y, z), 1, 1e-5, 'normal length');
  });

  test('a merge does not consume the geometry it was given', () => {
    // The sources are shared between shapes, so consuming one would empty the
    // rest of the object it belongs to.
    const box = new THREE.BoxGeometry(1, 1, 1);
    const before = box.getAttribute('position').count;
    mergeShapes([{ key: 'a', geometry: box, position: [0, 0, 0] }]);
    assertEqual(box.getAttribute('position').count, before, 'source was modified');
  });
});

suite('frame rate', () => {
  /**
   * Every preset has to name a rate the display can actually hold.
   *
   * A limiter can only ever *skip* frames a panel is already offering, so the
   * useful values are whole divisions of a refresh rate — 60 and 30 on a 60 Hz
   * screen. Anything between the two produces an uneven cadence, where some
   * images are held for one refresh and some for two, and that reads as worse
   * than the lower rate held steadily.
   */
  test('every preset draws at a whole division of 60', () => {
    for (const preset of QUALITY_PRESETS) {
      assert(
        60 % preset.fps === 0,
        `${preset.id} asks for ${preset.fps}fps, which does not divide a 60Hz panel evenly`,
      );
    }
  });

  test('no preset asks for more than a display can give', () => {
    for (const preset of QUALITY_PRESETS) {
      assert(preset.fps <= 60, `${preset.id} asks for ${preset.fps}fps`);
      assert(preset.fps >= 30, `${preset.id} asks for ${preset.fps}fps, below playable`);
    }
  });

  /** The cheapest preset is the one that should be trading frames for headroom. */
  test('the low preset is the one that halves the rate', () => {
    const byId = Object.fromEntries(QUALITY_PRESETS.map((q) => [q.id, q]));
    assertEqual(byId.low.fps, 30, 'low should run at 30');
    assertEqual(byId.medium.fps, 60, 'medium should run at 60');
    assertEqual(byId.high.fps, 60, 'high should run at 60');
  });
});


/**
 * Where the menu's cues are laid.
 *
 * The rule is easy to state and easy to get subtly wrong: a cue may not touch a
 * ball, may not overhang a rail, may not cross another cue, and if none of that
 * can be satisfied it must not be drawn at all. Each of those is a test.
 */
suite('cue placement', () => {
  const table = createTable();

  /** Distance from a point to a segment, independently of the module's own maths. */
  const gap = (
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): number => {
    const abx = bx - ax;
    const aby = by - ay;
    const l2 = abx * abx + aby * aby;
    let s = ((px - ax) * abx + (py - ay) * aby) / l2;
    s = s < 0 ? 0 : s > 1 ? 1 : s;
    return Math.hypot(px - (ax + abx * s), py - (ay + aby * s));
  };

  const ends = (pose: { centre: { x: number; y: number }; angle: number }) => {
    const half = CUE_LENGTH / 2;
    return {
      ax: pose.centre.x - Math.cos(pose.angle) * half,
      ay: pose.centre.y - Math.sin(pose.angle) * half,
      bx: pose.centre.x + Math.cos(pose.angle) * half,
      by: pose.centre.y + Math.sin(pose.angle) * half,
    };
  };

  test('one cue per player on an empty table', () => {
    for (let players = 1; players <= 4; players++) {
      assertEqual(placeCues(players, table, []).length, players, `${players} players`);
    }
  });

  test('every cue stays inside the rails', () => {
    const poses = placeCues(4, table, []);
    assert(poses.length > 0, 'expected at least one cue');

    for (const pose of poses) {
      const { ax, ay, bx, by } = ends(pose);
      for (const [x, y] of [
        [ax, ay],
        [bx, by],
      ]) {
        assert(Math.abs(x) <= table.halfLength, `end at x=${x.toFixed(3)} is past the cushion`);
        assert(Math.abs(y) <= table.halfWidth, `end at y=${y.toFixed(3)} is past the cushion`);
      }
    }
  });

  test('no cue lies on a ball', () => {
    // A full rack plus the cue ball: the crowded case the fixed pose failed on.
    const balls = [{ number: 0, x: -0.635, y: 0 }];
    let n = 1;
    for (let row = 0; row < 5; row++) {
      for (let seat = 0; seat <= row; seat++) {
        balls.push({
          number: n++,
          x: 0.635 + row * BALL_RADIUS * 1.74,
          y: (seat - row / 2) * BALL_RADIUS * 2.02,
        });
      }
    }

    const poses = placeCues(4, table, balls);
    for (const pose of poses) {
      const { ax, ay, bx, by } = ends(pose);
      for (const ball of balls) {
        assert(
          gap(ball.x, ball.y, ax, ay, bx, by) > BALL_RADIUS,
          `cue passes through ball ${ball.number}`,
        );
      }
    }
  });

  test('cues do not lie across each other', () => {
    const poses = placeCues(4, table, []);
    for (let i = 0; i < poses.length; i++) {
      for (let j = i + 1; j < poses.length; j++) {
        const a = ends(poses[i]);
        const b = ends(poses[j]);
        const closest = Math.min(
          gap(a.ax, a.ay, b.ax, b.ay, b.bx, b.by),
          gap(a.bx, a.by, b.ax, b.ay, b.bx, b.by),
          gap(b.ax, b.ay, a.ax, a.ay, a.bx, a.by),
          gap(b.bx, b.by, a.ax, a.ay, a.bx, a.by),
        );
        assert(closest > 0.02, `cues ${i} and ${j} are ${closest.toFixed(3)}m apart`);
      }
    }
  });

  test('a table with no room gets no cue rather than a bad one', () => {
    /*
     * Balls on a lattice fine enough that no 1.45m line can thread it.
     *
     * Not a realistic frame — it is the case the fallback exists for, and the
     * only way to check that "draw nothing" actually happens is to make it the
     * only correct answer.
     */
    const wall: { number: number; x: number; y: number }[] = [];
    let n = 0;
    for (let x = -1.2; x <= 1.2; x += 0.1) {
      for (let y = -0.6; y <= 0.6; y += 0.1) {
        wall.push({ number: n++, x, y });
      }
    }

    assertEqual(placeCues(2, table, wall).length, 0, 'no cue should be placed');
  });
});


report();
