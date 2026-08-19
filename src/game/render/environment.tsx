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

import { qualityById } from '@/constants/quality';
import { useSettings } from '@/store/settings';

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

          {/*
            Skirting, and only skirting.

            There was a picture rail above this as well, a second pale line at
            about a metre. It made sense when the walls were behind bookcases and
            pictures; with the rooms stripped back to the table it was the one
            bright thing left up there, a stripe running round an empty room with
            nothing to explain it.

            The skirting stays because it is not a decoration — it is the join
            between the wall and the floor, and without it the two planes meet at
            a hard seam that reads as a hole rather than a corner.
          */}
          <mesh position={[0, -height / 2 + 0.06, 0.02]}>
            <boxGeometry args={[wall.size[0], 0.12, 0.04]} />
            <meshPhysicalMaterial color="#efe7d6" roughness={0.5} clearcoat={0.35} />
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
      <pointLight
        color={lamp.color}
        intensity={lamp.intensity}
        distance={LAMP_RANGE}
        decay={2}
        position={[0, -0.05, 0]}
      />

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

/**
 * How far the decorative corner lights reach.
 *
 * Bounding these is worth doing — an unbounded point light is evaluated against
 * every surface in the room — but the range has to be set by measurement, not by
 * what sounds far enough. Three and a half metres looked generous and took 6.8%
 * of the brightness off the cloth: small in absolute terms, but above the ~2% at
 * which a change in an even surface becomes visible, so the baize would have
 * read as duller. Seven costs 0.6%, which nothing can see, and still lets the
 * renderer skip these lights for anything beyond that.
 */
const SPILL_RANGE = 7;

/**
 * Reach of the lamps over the table.
 *
 * Wide enough that the falloff window never bites inside the playing area: at
 * the far rail the difference against an unbounded light is under 2%.
 */
const LAMP_RANGE = 8;

export function Environment({ location }: { location: GameLocation }) {
  const quality = qualityById(useSettings((s) => s.quality));

  const hasNeon = location.props.includes('neon');
  const hasFloorLamp = location.props.includes('floorLamp');
  const hasArcade = location.props.includes('arcade');

  /**
   * The lamps this preset can afford.
   *
   * When only one is allowed it is moved onto the centre line rather than being
   * the first of the pair: two lamps hang either side of the middle, so keeping
   * one where it was would light half the table and leave the rest dim.
   */
  const lamps = useMemo(() => {
    if (quality.tableLamps >= location.lamps.length) return location.lamps;
    const [first] = location.lamps;
    if (!first) return location.lamps;
    return [
      {
        ...first,
        position: [first.position[0], first.position[1], 0] as [number, number, number],
      },
    ];
  }, [location.lamps, quality.tableLamps]);

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

      {/*
        The lamps that light the game.

        A preset can cut this to one, which halves the most expensive light in
        the scene. Never to zero: these are what the table is lit by, and the
        single remaining lamp is moved to the middle so a shortened rack does not
        leave one end in the dark.
      */}
      {lamps.map((lamp, index) => (
        <Lamp key={index} lamp={lamp} />
      ))}

      {/* Spill from the emissive props, so the things that look like light
          sources actually light the surfaces around them. Their geometry is
          merged and unlit; these are what sell it.

          All of them carry a `distance`. Left at the default a point light has
          infinite reach, so every one of them is evaluated against every surface
          in the room — and with clearcoat and sheen in play that lighting loop is
          the most expensive thing in the frame. These sit in the corners and are
          two orders of magnitude dimmer than the table lamps by the time they
          reach the cloth, so bounding them changes nothing that can be seen and
          takes them out of the loop for most of the scene. */}
      {quality.spillLights && hasNeon ? (
        <pointLight
          position={[0, 0.95, -ROOM.depth / 2 + 0.45]}
          color="#ff53d8"
          intensity={2.2}
          distance={SPILL_RANGE}
          decay={2}
        />
      ) : null}

      {quality.spillLights && hasFloorLamp ? (
        <pointLight
          position={[ROOM.width / 2 - 0.5, FLOOR_Y + 1.5, -ROOM.depth / 2 + 1.0]}
          color="#ffcf9a"
          intensity={4}
          distance={SPILL_RANGE}
          decay={2}
        />
      ) : null}

      {quality.spillLights && hasArcade ? (
        <>
          <pointLight
            position={[-1.25, FLOOR_Y + 1.2, -ROOM.depth / 2 + 1.1]}
            color="#5cf0ff"
            intensity={2.6}
            distance={SPILL_RANGE}
            decay={2}
          />
          <pointLight
            position={[1.25, FLOOR_Y + 1.2, -ROOM.depth / 2 + 1.1]}
            color="#ff53d8"
            intensity={2.6}
            distance={SPILL_RANGE}
            decay={2}
          />
        </>
      ) : null}

      {location.props.length > 0 ? <Props groups={location.props} /> : null}
    </group>
  );
}
