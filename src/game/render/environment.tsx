/**
 * The room around the table: floor, walls, hanging lamps, set dressing and the
 * light they cast.
 *
 * Walls are four inward-facing planes with no ceiling, rather than a box with
 * inverted faces. The camera can be zoomed and orbited well above head height,
 * and a closed box would either swallow it or show its outside and hide the
 * table; an open-topped room reads correctly from any angle the rig allows.
 */

import { useFrame, useThree } from '@react-three/fiber/native';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { FLOOR_Y, ROOM, type GameLocation, type LocationLamp } from './locations';
import { Props } from './props';

/** Distance below a lamp over which its fixture fades in. */
const LAMP_FADE = 0.42;

function Walls({ color, height }: { color: string; height: number }) {
  const y = FLOOR_Y + height / 2;
  const halfWidth = ROOM.width / 2;
  const halfDepth = ROOM.depth / 2;

  // Each plane's default normal is +z, so the rotation aims it at the table.
  const walls: {
    position: [number, number, number];
    rotation: [number, number, number];
    size: [number, number];
  }[] = [
    { position: [-halfWidth, y, 0], rotation: [0, Math.PI / 2, 0], size: [ROOM.depth, height] },
    { position: [halfWidth, y, 0], rotation: [0, -Math.PI / 2, 0], size: [ROOM.depth, height] },
    { position: [0, y, -halfDepth], rotation: [0, 0, 0], size: [ROOM.width, height] },
    { position: [0, y, halfDepth], rotation: [0, Math.PI, 0], size: [ROOM.width, height] },
  ];

  return (
    <group>
      {walls.map((wall, index) => (
        <group key={index} position={wall.position} rotation={wall.rotation}>
          <mesh>
            <planeGeometry args={wall.size} />
            <meshStandardMaterial color={color} roughness={0.95} />
          </mesh>

          {/* Skirting and a picture rail. Flat walls of one colour read as a
              backdrop; two horizontal lines at human heights are enough to make
              them read as a room. */}
          <mesh position={[0, -height / 2 + 0.06, 0.02]}>
            <boxGeometry args={[wall.size[0], 0.12, 0.04]} />
            <meshPhysicalMaterial color="#efe7d6" roughness={0.5} clearcoat={0.35} />
          </mesh>
          <mesh position={[0, -height / 2 + 1.05, 0.015]}>
            <boxGeometry args={[wall.size[0], 0.05, 0.03]} />
            <meshPhysicalMaterial color="#efe7d6" roughness={0.55} clearcoat={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * A hanging lamp whose fixture fades out as the camera rises towards it.
 *
 * The light itself never changes — only the shade, cord and bulb do. Overhead,
 * a lamp hung a metre and a half above the cloth sits squarely between the
 * player and the table, so it earns its place only from a low angle.
 */
function Lamp({ lamp }: { lamp: LocationLamp }) {
  const camera = useThree((state) => state.camera);
  const fixture = useRef<THREE.Group>(null);

  const materials = useMemo(
    () => ({
      cord: new THREE.MeshBasicMaterial({ color: '#141414', transparent: true }),
      shade: new THREE.MeshStandardMaterial({
        color: '#26282a',
        roughness: 0.5,
        side: THREE.DoubleSide,
        transparent: true,
      }),
      bulb: new THREE.MeshBasicMaterial({ color: lamp.color, transparent: true }),
    }),
    [lamp.color],
  );

  useFrame(() => {
    const opacity = Math.min(1, Math.max(0, (lamp.position[1] - camera.position.y) / LAMP_FADE));

    for (const material of [materials.cord, materials.shade, materials.bulb]) {
      material.opacity = opacity;
      // Writing depth while half-transparent produces sorting artefacts, so the
      // fixture only claims the depth buffer once it is solid.
      material.depthWrite = opacity > 0.99;
    }
    if (fixture.current) fixture.current.visible = opacity > 0.01;
  });

  return (
    <group position={lamp.position}>
      <pointLight color={lamp.color} intensity={lamp.intensity} decay={2} position={[0, -0.05, 0]} />

      <group ref={fixture}>
        <mesh position={[0, lamp.cordLength / 2 + 0.08, 0]} material={materials.cord}>
          <cylinderGeometry args={[0.004, 0.004, lamp.cordLength, 6]} />
        </mesh>

        {/* ConeGeometry has its apex at +y, which is the shape of a lamp shade. */}
        <mesh material={materials.shade}>
          <coneGeometry args={[lamp.shadeRadius, 0.17, 18, 1, true]} />
        </mesh>

        <mesh position={[0, -0.05, 0]} material={materials.bulb}>
          <sphereGeometry args={[0.032, 10, 8]} />
        </mesh>
      </group>
    </group>
  );
}

export function Environment({ location }: { location: GameLocation }) {
  const hasNeon = location.props.includes('neon');
  const hasFloorLamp = location.props.includes('floorLamp');
  const hasArcade = location.props.includes('arcade');

  return (
    <group>
      <ambientLight color={location.ambient.color} intensity={location.ambient.intensity} />
      <directionalLight
        position={location.fill.position}
        color={location.fill.color}
        intensity={location.fill.intensity}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        {/* A little clearcoat so the floor catches the lamps. Sealed boards and
            polished concrete both do this, and it is most of what tells you the
            table is standing in a room rather than on a flat colour. */}
        <meshPhysicalMaterial
          color={location.floorColor}
          roughness={location.floorRoughness}
          metalness={0}
          clearcoat={0.3}
          clearcoatRoughness={0.45}
        />
      </mesh>

      {location.walls ? <Walls color={location.walls.color} height={location.walls.height} /> : null}

      {location.lamps.map((lamp, index) => (
        <Lamp key={index} lamp={lamp} />
      ))}

      {/* Spill from the emissive props, so the things that look like light
          sources actually light the surfaces around them. Their geometry is
          merged and unlit; these are what sell it. */}
      {hasNeon ? (
        <pointLight
          position={[0, 0.95, -ROOM.depth / 2 + 0.45]}
          color="#ff53d8"
          intensity={2.2}
          decay={2}
        />
      ) : null}

      {hasFloorLamp ? (
        <pointLight
          position={[ROOM.width / 2 - 0.5, FLOOR_Y + 1.5, -ROOM.depth / 2 + 1.0]}
          color="#ffcf9a"
          intensity={4}
          decay={2}
        />
      ) : null}

      {hasArcade ? (
        <>
          <pointLight
            position={[-1.25, FLOOR_Y + 1.2, -ROOM.depth / 2 + 1.1]}
            color="#5cf0ff"
            intensity={2.6}
            decay={2}
          />
          <pointLight
            position={[1.25, FLOOR_Y + 1.2, -ROOM.depth / 2 + 1.1]}
            color="#ff53d8"
            intensity={2.6}
            decay={2}
          />
        </>
      ) : null}

      {location.props.length > 0 ? <Props groups={location.props} /> : null}
    </group>
  );
}
