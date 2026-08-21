/**
 * The table.
 *
 * Two things here are driven by the solver rather than eyeballed, so that what
 * the player sees and what the physics believes cannot drift apart: the cushion
 * rails are built from `table.cushions` — the very segments collisions test
 * against — and the pockets are real holes cut at the solver's capture radii.
 *
 * The cloth is a `ShapeGeometry` with six circular holes rather than a box with
 * dark discs painted on top. Painted discs read fine from overhead but give
 * themselves away the moment the camera drops to cue height, which it now can.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { clothById, Palette } from '@/constants/game-theme';
import { BALL_DIAMETER, CUSHION_NOSE_HEIGHT } from '@/game/core/constants';
import { footSpot, headSpot, type Table } from '@/game/core/table';
import { add, dist, dot, normalize, perp, scale, sub } from '@/game/core/vec';
import { qualityById } from '@/constants/quality';

import { mergeShapes, type MergeShape } from './merge';
import { useSettings } from '@/store/settings';

import { POCKET_DEPTH, sceneX, sceneZ } from './coords';
import { FLOOR_Y } from './locations';

const CUSHION_WIDTH = 0.02;

/**
 * The cushion you see, tied to the one that bounces.
 *
 * It was 40 mm, chosen by eye, while the solver turns balls back at
 * `CUSHION_NOSE_HEIGHT` — 36.3 mm, which is the 63.5% of a ball's diameter the
 * WPA specification asks for. Nearly four millimetres apart, so the rubber drawn
 * on screen was not the rubber the ball hit: a ball skimming the top was turned
 * back below what looked like the edge, and one that hopped the rail cleared a
 * nose lower than the one in the picture.
 *
 * Reading the constant instead means the two cannot drift, and the height is now
 * regulation by construction rather than by coincidence.
 */
const CUSHION_HEIGHT = CUSHION_NOSE_HEIGHT;

const RAIL_WIDTH = 0.075;

/**
 * Top of the wooden rail behind the cushion.
 *
 * Above the nose, as it is on a real table: the rail is what your hand rests on
 * and the cushion is set into its inner face, so a rail level with the rubber
 * would leave nothing to bridge on. Kept a shade proud of the balls, which is
 * what makes the table read as a box holding them rather than a tray they sit
 * on.
 */
const RAIL_TOP = BALL_DIAMETER * 1.12;
/**
 * How far the cloth continues past the playing edge. Exactly the width of the
 * cushion plus the rail, so the cloth reaches the rail's outer face: without it
 * there is nothing under the cushions and a low camera sees a dark slot running
 * all the way round the table.
 */
const CLOTH_OVERHANG = CUSHION_WIDTH + RAIL_WIDTH;

/**
 * Top of the slate body, kept clear of the pocket floors rather than flush with
 * them. Two surfaces at the same height fight over the depth buffer and flicker.
 */
const BODY_TOP = -POCKET_DEPTH - 0.03;
const BODY_BOTTOM = -0.3;
const LEG_SIZE = 0.1;

interface CushionBox {
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
}

/** One box per solver segment, nudged outwards so its inner face is the rail. */
function cushionBoxes(table: Table): CushionBox[] {
  return table.cushions.map((segment) => {
    const direction = normalize(sub(segment.b, segment.a));
    const midpoint = scale(add(segment.a, segment.b), 0.5);

    // Outward normal: perpendicular to the rail, pointing away from the centre.
    let outward = perp(direction);
    if (dot(outward, midpoint) < 0) outward = scale(outward, -1);

    const offset = add(midpoint, scale(outward, CUSHION_WIDTH / 2));
    const from = { x: sceneX(segment.a), z: sceneZ(segment.a) };
    const to = { x: sceneX(segment.b), z: sceneZ(segment.b) };

    return {
      position: [sceneX(offset), CUSHION_HEIGHT / 2, sceneZ(offset)],
      rotation: [0, Math.atan2(to.x - from.x, to.z - from.z), 0],
      length: dist(segment.a, segment.b),
    };
  });
}

/**
 * Cloth surface with the pockets removed.
 *
 * Built in the XY plane and rotated flat by the mesh, which sends shape y to
 * scene −z — hence the negated pocket coordinates.
 */
function useClothGeometry(table: Table): THREE.ShapeGeometry {
  return useMemo(() => {
    const halfX = table.halfWidth + CLOTH_OVERHANG;
    const halfY = table.halfLength + CLOTH_OVERHANG;

    const outline = new THREE.Shape();
    outline.moveTo(-halfX, -halfY);
    outline.lineTo(halfX, -halfY);
    outline.lineTo(halfX, halfY);
    outline.lineTo(-halfX, halfY);
    outline.closePath();

    outline.holes = table.pockets.map((pocket) => {
      const hole = new THREE.Path();
      hole.absarc(sceneX(pocket.center), -sceneZ(pocket.center), pocket.radius, 0, Math.PI * 2, true);
      return hole;
    });

    return new THREE.ShapeGeometry(outline, 12);
  }, [table]);
}

/** The 18 sights on the rail tops, in one draw call. */
function RailDiamonds({ table }: { table: Table }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const positions = useMemo(() => {
    const spots: [number, number][] = [];
    const railX = table.halfWidth + CUSHION_WIDTH + RAIL_WIDTH / 2;
    const railZ = table.halfLength + CUSHION_WIDTH + RAIL_WIDTH / 2;

    // Long rails: eighths of the length, skipping the side pocket at the middle.
    for (let i = 1; i <= 7; i++) {
      if (i === 4) continue;
      const z = -table.halfLength + 2 * table.halfLength * (i / 8);
      spots.push([-railX, z], [railX, z]);
    }
    // Short rails: quarters of the width.
    for (let j = 1; j <= 3; j++) {
      const x = -table.halfWidth + 2 * table.halfWidth * (j / 4);
      spots.push([x, -railZ], [x, railZ]);
    }
    return spots;
  }, [table]);

  const geometry = useMemo(() => {
    const circle = new THREE.CircleGeometry(0.008, 10);
    circle.rotateX(-Math.PI / 2);
    return circle;
  }, []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const object = new THREE.Object3D();
    positions.forEach(([x, z], index) => {
      object.position.set(x, RAIL_TOP + 0.0015, z);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, positions.length]}
      frustumCulled={false}>
      {/* Polygon offset rather than a bigger gap: these sit a millimetre above
          the rail and would otherwise flicker against it at distance. */}
      <meshPhysicalMaterial
        color="#e8dcc0"
        roughness={0.25}
        clearcoat={0.8}
        clearcoatRoughness={0.08}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </instancedMesh>
  );
}

export function TableMesh({ table }: { table: Table }) {
  const clothId = useSettings((s) => s.clothId);
  const cloth = clothById(clothId);
  const quality = qualityById(useSettings((s) => s.quality));

  const bedWidth = table.halfWidth * 2;
  const bedLength = table.halfLength * 2;
  const cushions = useMemo(() => cushionBoxes(table), [table]);
  const clothGeometry = useClothGeometry(table);

  const railSpanZ = bedLength + 2 * CUSHION_WIDTH + 2 * RAIL_WIDTH;
  const railOffsetX = table.halfWidth + CUSHION_WIDTH + RAIL_WIDTH / 2;
  const railOffsetZ = table.halfLength + CUSHION_WIDTH + RAIL_WIDTH / 2;

  // Rails run from the body all the way up, closing the gap that the hollow
  // pocket cavity would otherwise expose at cloth level.
  const railHeight = RAIL_TOP - BODY_TOP;
  const railCentreY = BODY_TOP + railHeight / 2;

  /**
   * Cushions, rails and inlays as one geometry each.
   *
   * Rebuilt only when the table's dimensions change, which is never during play.
   * The source geometries are temporary: they exist to be baked into the merged
   * buffers and are released immediately.
   */
  const merged = useMemo(() => {
    const shapes: MergeShape[] = [];

    for (const box of cushions) {
      shapes.push({
        key: 'cushions',
        geometry: new THREE.BoxGeometry(CUSHION_WIDTH, CUSHION_HEIGHT, box.length),
        position: box.position,
        rotation: box.rotation,
      });
    }

    for (const pocket of table.pockets) {
      const x = sceneX(pocket.center);
      const z = sceneZ(pocket.center);
      shapes.push({
        key: 'pocketWalls',
        geometry: new THREE.CylinderGeometry(
          pocket.radius,
          pocket.radius * 0.86,
          POCKET_DEPTH + 0.004,
          16,
          1,
          true,
        ),
        position: [x, (0.004 - POCKET_DEPTH) / 2, z],
      });
      shapes.push({
        key: 'pocketFloors',
        geometry: new THREE.CircleGeometry(pocket.radius, 16),
        position: [x, -POCKET_DEPTH, z],
        rotation: [-Math.PI / 2, 0, 0],
      });
      shapes.push({
        key: 'pocketRings',
        geometry: new THREE.RingGeometry(pocket.radius, pocket.radius + 0.014, 16),
        position: [x, 0.0015, z],
        rotation: [-Math.PI / 2, 0, 0],
      });
    }

    for (const side of [-1, 1] as const) {
      shapes.push({
        key: 'rails',
        geometry: new THREE.BoxGeometry(RAIL_WIDTH, railHeight, railSpanZ),
        position: [side * railOffsetX, railCentreY, 0],
      });
      shapes.push({
        key: 'rails',
        geometry: new THREE.BoxGeometry(bedWidth + 2 * CUSHION_WIDTH, railHeight, RAIL_WIDTH),
        position: [0, railCentreY, side * railOffsetZ],
      });
      shapes.push({
        key: 'inlays',
        geometry: new THREE.BoxGeometry(RAIL_WIDTH * 0.42, 0.004, railSpanZ * 0.94),
        position: [side * railOffsetX, RAIL_TOP + 0.001, 0],
      });
      shapes.push({
        key: 'inlays',
        geometry: new THREE.BoxGeometry(
          (bedWidth + 2 * CUSHION_WIDTH) * 0.9,
          0.004,
          RAIL_WIDTH * 0.42,
        ),
        position: [0, RAIL_TOP + 0.001, side * railOffsetZ],
      });
    }

    const result = mergeShapes(shapes);
    for (const shape of shapes) shape.geometry.dispose();

    return {
      cushions: result.get('cushions')!,
      rails: result.get('rails')!,
      inlays: result.get('inlays')!,
      pocketWalls: result.get('pocketWalls')!,
      pocketFloors: result.get('pocketFloors')!,
      pocketRings: result.get('pocketRings')!,
    };
  }, [
    table,
    cushions,
    bedWidth,
    railHeight,
    railSpanZ,
    railOffsetX,
    railOffsetZ,
    railCentreY,
  ]);

  // Merged buffers are ours, not React's, so a new table has to hand them back.
  useEffect(
    () => () => {
      for (const geometry of Object.values(merged)) geometry.dispose();
    },
    [merged],
  );

  const legInsetX = railOffsetX + RAIL_WIDTH / 2 - LEG_SIZE / 2 - 0.02;
  const legInsetZ = railOffsetZ + RAIL_WIDTH / 2 - LEG_SIZE / 2 - 0.02;
  const legHeight = BODY_BOTTOM - FLOOR_Y;

  return (
    <group>
      {/* Cloth, holes and all. The camera never goes below it, so one side is enough. */}
      <mesh geometry={clothGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        {/* Sheen is what makes this read as cloth. Billiard baize is a mat of
            short fibres that catches light at grazing angles, and without that
            rim it renders as flat green paint. */}
        {/* Sheen is a third specular lobe evaluated per light, over the largest
            surface on screen — which makes it the single most expensive material
            feature in the scene, and the one a preset turns off first. Without it
            the baize still reads as cloth from its colour and roughness; it just
            loses the pale rim at grazing angles. */}
        <meshPhysicalMaterial
          color={cloth.cloth}
          roughness={1}
          metalness={0}
          sheen={quality.clothSheen ? 1 : 0}
          sheenRoughness={0.85}
          sheenColor={cloth.sheen}
        />
      </mesh>

      {/*
        Pockets read as holes only if they stay dark. Lit materials were the bug:
        with lamps hanging straight overhead, a standard material lit the inside
        of each tube like a shiny cylinder, so the pockets looked like objects
        stuck to the table rather than openings in it. Unlit dark materials fix
        it. The liner is BackSide because it is only ever seen from within, and
        it starts a hair above the cloth so no seam opens at the rim.
      */}
      {/*
        Six pockets, three meshes each, as three meshes total.

        They cannot be instanced — a corner pocket and a middle one are different
        sizes — but nothing about them moves, so merging does the same job. This
        was the largest remaining group of draw calls on the table by some way.
      */}
      <mesh geometry={merged.pocketWalls}>
        <meshBasicMaterial color="#0a0f0c" side={THREE.BackSide} />
      </mesh>

      <mesh geometry={merged.pocketFloors}>
        <meshBasicMaterial color="#050806" />
      </mesh>

      {/* A dark ring on the cloth, so the mouth has an edge instead of the
          paper-thin cut left by the hole in the ShapeGeometry. */}
      <mesh geometry={merged.pocketRings}>
        <meshBasicMaterial
          color={Palette.pocket}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-3}
        />
      </mesh>

      {/* Slate body. */}
      <mesh position={[0, (BODY_TOP + BODY_BOTTOM) / 2, 0]}>
        <boxGeometry args={[bedWidth, BODY_TOP - BODY_BOTTOM, bedLength]} />
        <meshPhysicalMaterial color={Palette.railDark} roughness={0.6} clearcoat={0.2} />
      </mesh>

      {/*
        Cushions, rails and inlays, welded into one geometry apiece.

        Fourteen meshes became three. None of them ever moves relative to the
        table, and every group already shared a single material — so as separate
        meshes they were fourteen trips across the JS bridge per frame buying
        nothing that one trip does not.
      */}
      <mesh geometry={merged.cushions}>
        <meshPhysicalMaterial
          color={cloth.cushion}
          roughness={1}
          sheen={quality.clothSheen ? 0.8 : 0}
          sheenRoughness={0.8}
          sheenColor={cloth.sheen}
        />
      </mesh>

      <mesh geometry={merged.rails}>
        {/* Varnished rail: a clearcoat over the wood, so the lamps leave a
            proper reflection along the edge instead of a dull smear. */}
        <meshPhysicalMaterial
          color={Palette.rail}
          roughness={0.4}
          clearcoat={quality.propClearcoat ? 0.6 : 0}
          clearcoatRoughness={0.18}
        />
      </mesh>

      {/* Inlay strip down the middle of each rail: one line of lighter wood is
          what stops a rail from reading as a plain brown bar. */}
      <mesh geometry={merged.inlays}>
        <meshPhysicalMaterial
          color="#c8a06a"
          roughness={0.3}
          clearcoat={quality.propClearcoat ? 0.7 : 0}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Nothing rings the pocket mouths. A ball has to be able to reach the
          hole from any angle along the rail, and anything sitting proud of the
          cloth there would be in its way. */}

      <RailDiamonds table={table} />

      {/* Legs, so the table stands on the floor instead of hovering over it. */}
      {([-1, 1] as const).map((sx) =>
        ([-1, 1] as const).map((sz) => (
          <group key={`leg-${sx}-${sz}`} position={[sx * legInsetX, 0, sz * legInsetZ]}>
            <mesh position={[0, BODY_BOTTOM - legHeight / 2, 0]}>
              <boxGeometry args={[LEG_SIZE, legHeight, LEG_SIZE]} />
              <meshPhysicalMaterial color={Palette.railDark} roughness={0.6} clearcoat={0.2} />
            </mesh>
            {/* A collar at the top and a foot at the bottom, so the leg has a
                shape instead of being a post. */}
            <mesh position={[0, BODY_BOTTOM - 0.045, 0]}>
              <boxGeometry args={[LEG_SIZE * 1.28, 0.06, LEG_SIZE * 1.28]} />
              <meshPhysicalMaterial color={Palette.rail} roughness={0.45} clearcoat={0.4} />
            </mesh>
            <mesh position={[0, FLOOR_Y + 0.028, 0]}>
              <boxGeometry args={[LEG_SIZE * 1.35, 0.056, LEG_SIZE * 1.35]} />
              <meshPhysicalMaterial color="#a8863f" roughness={0.35} metalness={0.7} />
            </mesh>
          </group>
        )),
      )}

      {/* Head and foot spots, the usual cloth markings. */}
      {[headSpot(table), footSpot(table)].map((spot, index) => (
        <mesh
          key={`spot-${index}`}
          position={[sceneX(spot), 0.002, sceneZ(spot)]}
          rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.008, 12]} />
          <meshBasicMaterial
            color="#0d2b1f"
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ))}
    </group>
  );
}
