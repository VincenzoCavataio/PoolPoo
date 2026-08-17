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

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { clothById, Palette } from '@/constants/game-theme';
import { footSpot, headSpot, type Table } from '@/game/core/table';
import { add, dist, dot, normalize, perp, scale, sub } from '@/game/core/vec';
import { useSettings } from '@/store/settings';

import { POCKET_DEPTH, sceneX, sceneZ } from './coords';
import { FLOOR_Y } from './locations';

const CUSHION_WIDTH = 0.02;
const CUSHION_HEIGHT = 0.04;
const RAIL_WIDTH = 0.075;
const RAIL_TOP = 0.055;
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
        <meshPhysicalMaterial
          color={cloth.cloth}
          roughness={1}
          metalness={0}
          sheen={1}
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
      {table.pockets.map((pocket) => (
        <group key={pocket.id} position={[sceneX(pocket.center), 0, sceneZ(pocket.center)]}>
          <mesh position={[0, (0.004 - POCKET_DEPTH) / 2, 0]}>
            <cylinderGeometry
              args={[pocket.radius, pocket.radius * 0.86, POCKET_DEPTH + 0.004, 24, 1, true]}
            />
            <meshBasicMaterial color="#0a0f0c" side={THREE.BackSide} />
          </mesh>

          <mesh position={[0, -POCKET_DEPTH, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[pocket.radius, 24]} />
            <meshBasicMaterial color="#050806" />
          </mesh>

          {/* A dark ring on the cloth, so the mouth has an edge instead of the
              paper-thin cut left by the hole in the ShapeGeometry. */}
          <mesh position={[0, 0.0015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[pocket.radius, pocket.radius + 0.014, 24]} />
            <meshBasicMaterial
              color={Palette.pocket}
              polygonOffset
              polygonOffsetFactor={-3}
              polygonOffsetUnits={-3}
            />
          </mesh>
        </group>
      ))}

      {/* Slate body. */}
      <mesh position={[0, (BODY_TOP + BODY_BOTTOM) / 2, 0]}>
        <boxGeometry args={[bedWidth, BODY_TOP - BODY_BOTTOM, bedLength]} />
        <meshPhysicalMaterial color={Palette.railDark} roughness={0.6} clearcoat={0.2} />
      </mesh>

      {/* Cushions, one per solver segment. */}
      {cushions.map((box, index) => (
        <mesh key={`cushion-${index}`} position={box.position} rotation={box.rotation}>
          <boxGeometry args={[CUSHION_WIDTH, CUSHION_HEIGHT, box.length]} />
          <meshPhysicalMaterial
            color={cloth.cushion}
            roughness={1}
            sheen={0.8}
            sheenRoughness={0.8}
            sheenColor={cloth.sheen}
          />
        </mesh>
      ))}

      {/* Wooden rails, outboard of the cushions and continuous across pockets. */}
      {([-1, 1] as const).map((side) => (
        <mesh key={`rail-x-${side}`} position={[side * railOffsetX, railCentreY, 0]}>
          <boxGeometry args={[RAIL_WIDTH, railHeight, railSpanZ]} />
          {/* Varnished rail: a clearcoat over the wood, so the lamps leave a
              proper reflection along the edge instead of a dull smear. */}
          <meshPhysicalMaterial
            color={Palette.rail}
            roughness={0.4}
            clearcoat={0.6}
            clearcoatRoughness={0.18}
          />
        </mesh>
      ))}
      {([-1, 1] as const).map((side) => (
        <mesh key={`rail-z-${side}`} position={[0, railCentreY, side * railOffsetZ]}>
          <boxGeometry args={[bedWidth + 2 * CUSHION_WIDTH, railHeight, RAIL_WIDTH]} />
          {/* Varnished rail: a clearcoat over the wood, so the lamps leave a
              proper reflection along the edge instead of a dull smear. */}
          <meshPhysicalMaterial
            color={Palette.rail}
            roughness={0.4}
            clearcoat={0.6}
            clearcoatRoughness={0.18}
          />
        </mesh>
      ))}

      <RailDiamonds table={table} />

      {/* Legs, so the table stands on the floor instead of hovering over it. */}
      {([-1, 1] as const).map((sx) =>
        ([-1, 1] as const).map((sz) => (
          <mesh
            key={`leg-${sx}-${sz}`}
            position={[sx * legInsetX, BODY_BOTTOM - legHeight / 2, sz * legInsetZ]}>
            <boxGeometry args={[LEG_SIZE, legHeight, LEG_SIZE]} />
            <meshPhysicalMaterial color={Palette.railDark} roughness={0.6} clearcoat={0.2} />
          </mesh>
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
