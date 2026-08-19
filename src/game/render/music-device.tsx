/**
 * The thing playing the music, standing in the room.
 *
 * This is the one prop that stays out of the merged static geometry. Everything
 * else in `props.tsx` is fused by material because it never moves; this has to
 * be tappable, it has to spin, and it has to play the record-changing animation,
 * so it costs a handful of draw calls and earns them.
 *
 * Taps are not handled by a raycaster. The canvas is already wrapped in a
 * gesture detector and the two would fight over the same touch, so instead the
 * device projects its own position to screen coordinates every frame and leaves
 * it in `musicDeviceScreen`; the tap gesture just measures the distance in
 * pixels. Simpler, and nothing competes.
 */

import { useFrame, useThree } from '@react-three/fiber/native';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { CHANGE_TOTAL_MS, useMusic } from '@/game/audio/music';
import { trackAt } from '@/game/audio/tracks';

import { FLOOR_Y, type MusicDevice } from './locations';
import { mergeShapes } from './merge';

/** Where the device currently is on screen, for the tap gesture to compare. */
export const musicDeviceScreen = { x: -1, y: -1, onScreen: false };

/**
 * How much of a tap's flash is still burning, 1 down to 0.
 *
 * Module state for the same reason the screen position above is: the gesture
 * layer and the render loop have to agree on something every frame, and routing
 * it through React would re-render a component sixty times a second to move a
 * number the renderer reads directly. The gesture sets it to 1 and the frame
 * loop burns it down.
 */
export const musicDeviceFlash = { level: 0 };

/** Lights the device up, in answer to a tap on it. */
export function flashMusicDevice(): void {
  musicDeviceFlash.level = 1;
}

/** How long the flash takes to fade, in seconds. */
const FLASH_FADE = 0.55;

/** Cosine of the half-angle within which the sign lights up fully. */
const LOOK_THRESHOLD = Math.cos((75 * Math.PI) / 180);
const SPIN_SPEED = 1.9;
/** The prompt colour, used by the plate, the note, the ring and the light. */
const GLOW = '#5cffb0';
/** Leg length for the rooftop unit: shelf height (0.55) down to the floor. */
const LEG_DROP = 0.55 - FLOOR_Y;

/**
 * The prompt above the player.
 *
 * A still label was too easy to read as scenery — it sat there looking like one
 * more object in a room full of objects. Movement is what separates "you can
 * touch this" from "this is furniture", so it bounces in, hovers, rocks the note
 * back and forth and pulses a ring behind it. It also swells rather than fades
 * in, which the eye catches from the corner.
 */
/**
 * A neon quaver bolted to the wall above the shelf.
 *
 * This replaced a speech bubble floating in mid-air. A prompt hanging in space
 * reads as an interface drawn on top of the room; a sign screwed to the wall
 * reads as something that is *in* the room, which is what the rest of the
 * furniture already does. It still pulses and still throws light, so it is no
 * harder to find — it just belongs there now.
 */
function NeonSign({ height }: { height: number }) {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const camera = useThree((state) => state.camera);
  const scratch = useMemo(
    () => ({ forward: new THREE.Vector3(), toSign: new THREE.Vector3(), world: new THREE.Vector3() }),
    [],
  );
  const attention = useRef(0);
  const clock = useRef(0);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;

    clock.current += delta;

    node.getWorldPosition(scratch.world);
    camera.getWorldDirection(scratch.forward);
    scratch.toSign.copy(scratch.world).sub(camera.position).normalize();

    // Brighter when it is being looked at, but never off: it is furniture, and
    // furniture does not blink out of existence when you turn away.
    const facing = scratch.forward.dot(scratch.toSign) > LOOK_THRESHOLD ? 1 : 0;
    attention.current += (facing - attention.current) * Math.min(1, delta * 6);

    /**
     * The answer to a tap: a hard flash that decays.
     *
     * Squared on the way out, so it hits at full strength and falls away quickly
     * rather than dimming evenly — that shape is what reads as *being struck*
     * instead of merely brightening.
     */
    if (musicDeviceFlash.level > 0) {
      musicDeviceFlash.level = Math.max(0, musicDeviceFlash.level - delta / FLASH_FADE);
    }
    const flash = musicDeviceFlash.level * musicDeviceFlash.level;

    const pulse = 0.78 + Math.sin(clock.current * 2.6) * 0.12 + attention.current * 0.3;

    if (light.current) light.current.intensity = 0.35 + pulse * 0.9 + flash * 6;
    if (glow.current) {
      const material = glow.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.1 + pulse * 0.14 + flash * 0.5;
      // Grows as well as brightens, so the flash carries at a distance where a
      // change in brightness alone would be lost against the lamps.
      glow.current.scale.setScalar(0.92 + pulse * 0.16 + flash * 0.9);
    }
  });

  return (
    <group ref={group} position={[0, height, 0.03]}>
      <pointLight ref={light} color={GLOW} intensity={0.9} distance={2.2} decay={2} />

      {/* Bloom on the wall behind the tubes. */}
      <mesh ref={glow} position={[0, 0, -0.02]}>
        <circleGeometry args={[0.26, 26]} />
        <meshBasicMaterial color={GLOW} transparent opacity={0.16} depthWrite={false} />
      </mesh>

      {/* The quaver, as bent neon tube: head, stem, flag. */}
      <mesh position={[-0.045, -0.055, 0]} rotation={[0, 0, -0.35]}>
        <sphereGeometry args={[0.05, 14, 12]} />
        <meshBasicMaterial color={GLOW} />
      </mesh>
      <mesh position={[0.004, 0.035, 0]}>
        <boxGeometry args={[0.018, 0.185, 0.018]} />
        <meshBasicMaterial color={GLOW} />
      </mesh>
      <mesh position={[0.055, 0.09, 0]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.092, 0.026, 0.018]} />
        <meshBasicMaterial color={GLOW} />
      </mesh>

      {/* The bracket it hangs off, so it is mounted rather than levitating. */}
      <mesh position={[0, -0.15, -0.025]}>
        <boxGeometry args={[0.02, 0.09, 0.02]} />
        <meshPhysicalMaterial color="#3a3f45" roughness={0.4} metalness={0.7} />
      </mesh>
    </group>
  );
}

/** The wall unit the device stands on. */
/**
 * Geometry and materials for the shelf, built once and shared.
 *
 * Every `<mesh>` in a react-three-fiber tree that declares its own
 * `<boxGeometry>` and `<meshPhysicalMaterial>` creates a *new* one of each — so
 * the four brackets and legs here were four geometries and four materials
 * describing the same 3 cm strip of steel, and three.js cannot batch draws that
 * do not share a material. Hoisting them to module scope means one geometry and
 * one material per distinct part, which is what lets the renderer sort and reuse
 * them instead of setting up state afresh for each.
 */
const SHELF_GEOMETRY = {
  backing: new THREE.BoxGeometry(0.92, 0.72, 0.03),
  board: new THREE.BoxGeometry(0.86, 0.045, 0.32),
  bracket: new THREE.BoxGeometry(0.03, 0.14, 0.22),
  leg: new THREE.BoxGeometry(0.045, LEG_DROP, 0.045),
};

const SHELF_MATERIAL = {
  backing: new THREE.MeshPhysicalMaterial({
    color: '#3a2718',
    roughness: 0.6,
    clearcoat: 0.25,
  }),
  board: new THREE.MeshPhysicalMaterial({
    color: '#6b4a2f',
    roughness: 0.4,
    clearcoat: 0.45,
  }),
  steel: new THREE.MeshPhysicalMaterial({
    color: '#3a3f45',
    roughness: 0.35,
    metalness: 0.75,
  }),
};

const BRACKET_X = [-0.33, 0.33];
const LEG_X = [-0.36, 0.36];

/**
 * The unit's fixed parts, as data.
 *
 * Everything that never moves in the device's own space is described here and
 * welded into one geometry per material. As separate meshes the shelf, the
 * cabinets and the sign came to fifty-four draw calls — forty percent of the
 * whole scene's, for one object that is usually off screen — and on expo-gl a
 * draw call is a trip across the JS bridge. Merged, the lot costs six.
 *
 * The record and the tone arm are not in here: they animate, and a merged buffer
 * has no parts left to move.
 */
type Shape = {
  key: string;
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  rotation?: [number, number, number];
};

/** Materials the merged parts are drawn with, built once and shared. */
const DEVICE_MATERIALS: Record<string, THREE.Material> = {
  board: new THREE.MeshPhysicalMaterial({ color: '#6b4a2f', roughness: 0.4, clearcoat: 0.45 }),
  backing: new THREE.MeshPhysicalMaterial({ color: '#3a2718', roughness: 0.6, clearcoat: 0.25 }),
  steel: new THREE.MeshPhysicalMaterial({ color: '#b9bfc6', roughness: 0.24, metalness: 0.92 }),
  dark: new THREE.MeshPhysicalMaterial({ color: '#1b1d20', roughness: 0.35, clearcoat: 0.55 }),
  cabinet: new THREE.MeshPhysicalMaterial({ color: '#4a1f2e', roughness: 0.35, clearcoat: 0.7 }),
  case: new THREE.MeshPhysicalMaterial({ color: '#2b2723', roughness: 0.4, clearcoat: 0.5 }),
  grille: new THREE.MeshStandardMaterial({ color: '#2a2c2f', roughness: 0.92 }),
  neonPink: new THREE.MeshBasicMaterial({ color: '#ff53d8' }),
  neonCyan: new THREE.MeshBasicMaterial({ color: '#5cf0ff' }),
  dial: new THREE.MeshBasicMaterial({ color: '#ffa63c' }),
};

const G = {
  shelfBacking: new THREE.BoxGeometry(0.92, 0.72, 0.03),
  shelfBoard: new THREE.BoxGeometry(0.86, 0.045, 0.32),
  bracket: new THREE.BoxGeometry(0.03, 0.14, 0.22),
  leg: new THREE.BoxGeometry(0.045, LEG_DROP, 0.045),

  deck: new THREE.BoxGeometry(0.44, 0.09, 0.34),
  platter: new THREE.CylinderGeometry(0.138, 0.138, 0.014, 24),
  spindle: new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8),
  foot: new THREE.CylinderGeometry(0.018, 0.018, 0.016, 12),

  cabinet: new THREE.BoxGeometry(0.82, 1.36, 0.52),
  dome: new THREE.CylinderGeometry(0.41, 0.41, 0.52, 18, 1, false, 0, Math.PI),
  tube: new THREE.BoxGeometry(0.04, 1.2, 0.06),
  speakerPanel: new THREE.BoxGeometry(0.5, 0.3, 0.02),
  marquee: new THREE.BoxGeometry(0.4, 0.06, 0.02),

  radioCase: new THREE.BoxGeometry(0.38, 0.2, 0.17),
  radioGrille: new THREE.CylinderGeometry(0.06, 0.06, 0.012, 16),
  radioDial: new THREE.BoxGeometry(0.13, 0.045, 0.012),
  knob: new THREE.CylinderGeometry(0.014, 0.014, 0.012, 10),
  handle: new THREE.TorusGeometry(0.075, 0.008, 6, 16, Math.PI),
};

function shelfShapes(freestanding: boolean): Shape[] {
  const shapes: Shape[] = [
    { key: 'backing', geometry: G.shelfBacking, position: [0, 0.22, -0.03] },
    { key: 'board', geometry: G.shelfBoard, position: [0, 0, 0.14] },
  ];
  for (const x of [-0.33, 0.33]) {
    shapes.push({ key: 'steel', geometry: G.bracket, position: [x, -0.09, 0.09] });
  }
  if (freestanding) {
    for (const x of [-0.36, 0.36]) {
      shapes.push({ key: 'steel', geometry: G.leg, position: [x, -0.06 + LEG_DROP / 2, 0.02] });
    }
  }
  return shapes;
}

function turntableShapes(): Shape[] {
  const shapes: Shape[] = [
    { key: 'dark', geometry: G.deck, position: [0, 0.045, 0] },
    { key: 'steel', geometry: G.platter, position: [0, 0.096, 0] },
    { key: 'steel', geometry: G.spindle, position: [0, 0.115, 0] },
  ];
  for (const x of [-0.16, 0.16]) {
    shapes.push({ key: 'steel', geometry: G.foot, position: [x, 0.096, 0.13] });
  }
  return shapes;
}

function jukeboxShapes(): Shape[] {
  const shapes: Shape[] = [
    { key: 'cabinet', geometry: G.cabinet, position: [0, 0.68, 0] },
    { key: 'cabinet', geometry: G.dome, position: [0, 1.36, 0], rotation: [Math.PI / 2, 0, 0] },
    { key: 'grille', geometry: G.speakerPanel, position: [0, 0.5, 0.27] },
    { key: 'neonCyan', geometry: G.marquee, position: [0, 0.2, 0.27] },
  ];
  for (const x of [-0.42, 0.42]) {
    shapes.push({ key: 'neonPink', geometry: G.tube, position: [x, 0.78, 0] });
  }
  return shapes;
}

function radioShapes(): Shape[] {
  const shapes: Shape[] = [
    { key: 'case', geometry: G.radioCase, position: [0, 0.1, 0] },
    {
      key: 'grille',
      geometry: G.radioGrille,
      position: [-0.1, 0.1, 0.088],
      rotation: [Math.PI / 2, 0, 0],
    },
    { key: 'dial', geometry: G.radioDial, position: [0.09, 0.14, 0.088] },
    { key: 'dark', geometry: G.handle, position: [0, 0.215, 0] },
  ];
  for (const x of [0.05, 0.13]) {
    shapes.push({
      key: 'steel',
      geometry: G.knob,
      position: [x, 0.05, 0.088],
      rotation: [Math.PI / 2, 0, 0],
    });
  }
  return shapes;
}

/** Draws a set of merged shapes: one mesh per material rather than per part. */
function MergedParts({ shapes }: { shapes: Shape[] }) {
  const merged = useMemo(() => Array.from(mergeShapes(shapes).entries()), [shapes]);

  useEffect(
    () => () => {
      for (const [, geometry] of merged) geometry.dispose();
    },
    [merged],
  );

  return (
    <group>
      {merged.map(([key, geometry]) => (
        <mesh key={key} geometry={geometry} material={DEVICE_MATERIALS[key]} />
      ))}
    </group>
  );
}

/** The record itself: shared by every device, so there is one animation. */
function Disc({ radius }: { radius: number }) {
  const group = useRef<THREE.Group>(null);
  const label = useRef<THREE.Mesh>(null);
  const changeStarted = useRef(0);
  const wasChanging = useRef(false);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;

    const { playing, changing, index } = useMusic.getState();

    if (changing && !wasChanging.current) changeStarted.current = Date.now();
    wasChanging.current = changing;

    if (playing || changing) node.rotation.y += SPIN_SPEED * delta;

    // Out for the first half of the change, back in for the second: the disc
    // lifting off and the new one settling.
    let scale = 1;
    if (changing) {
      const progress = Math.min(1, (Date.now() - changeStarted.current) / CHANGE_TOTAL_MS);
      scale = progress < 0.5 ? 1 - progress * 2 : (progress - 0.5) * 2;
    }
    node.scale.set(1, Math.max(0.02, scale), 1);
    node.position.y = (1 - scale) * 0.055;

    // `index` flips halfway through the change, so reading it each frame gets
    // the new label on at exactly the right moment for free.
    const material = label.current?.material as THREE.MeshStandardMaterial | undefined;
    material?.color.set(trackAt(index).labelColor);
  });

  return (
    <group ref={group}>
      <mesh>
        <cylinderGeometry args={[radius, radius, 0.005, 32]} />
        <meshPhysicalMaterial color="#131313" roughness={0.28} clearcoat={0.8} clearcoatRoughness={0.1} />
      </mesh>
      <mesh ref={label} position={[0, 0.004, 0]}>
        <cylinderGeometry args={[radius * 0.36, radius * 0.36, 0.005, 24]} />
        <meshStandardMaterial color="#d94f7a" roughness={0.75} />
      </mesh>
    </group>
  );
}

/** The shelf the unit stands on, merged like everything else that never moves. */
function WallShelf({ freestanding }: { freestanding: boolean }) {
  const shapes = useMemo(() => shelfShapes(freestanding), [freestanding]);
  return <MergedParts shapes={shapes} />;
}

/**
 * The three devices.
 *
 * Each is a merged block of fixed parts plus whatever actually moves — the
 * record on all of them, and the tone arm on the turntable. That split is the
 * whole optimisation: the parts that never move cost one draw call per material
 * instead of one apiece.
 */
function Turntable() {
  const arm = useRef<THREE.Group>(null);
  const shapes = useMemo(turntableShapes, []);

  useFrame(() => {
    const { changing, playing } = useMusic.getState();
    if (!arm.current) return;
    // Swung in over the record while playing, parked out of the way otherwise.
    const target = changing || !playing ? 0.55 : 0;
    arm.current.rotation.y += (target - arm.current.rotation.y) * 0.12;
  });

  return (
    <group>
      <MergedParts shapes={shapes} />

      <group position={[0, 0.107, 0]}>
        <Disc radius={0.128} />
      </group>

      <group ref={arm} position={[0.17, 0.1, -0.12]}>
        <mesh position={[-0.1, 0.02, 0.06]} rotation={[0, -0.6, 0]} material={DEVICE_MATERIALS.steel}>
          <boxGeometry args={[0.23, 0.012, 0.016]} />
        </mesh>
        <mesh material={DEVICE_MATERIALS.dark}>
          <cylinderGeometry args={[0.026, 0.026, 0.022, 12]} />
        </mesh>
      </group>
    </group>
  );
}

function Jukebox() {
  const shapes = useMemo(jukeboxShapes, []);

  return (
    <group>
      <MergedParts shapes={shapes} />

      {/* Glass over the deck. Kept out of the merge: it is transparent, and a
          transparent surface has to be drawn after the opaque ones behind it. */}
      <mesh position={[0, 1.18, 0.24]}>
        <boxGeometry args={[0.56, 0.42, 0.03]} />
        <meshPhysicalMaterial
          color="#9fc4cf"
          roughness={0.05}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>

      <group position={[0, 1.18, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <Disc radius={0.15} />
      </group>
    </group>
  );
}

function Radio() {
  const shapes = useMemo(radioShapes, []);

  return (
    <group>
      <MergedParts shapes={shapes} />

      <group position={[0, 0.1, 0.095]} rotation={[Math.PI / 2, 0, 0]}>
        <Disc radius={0.055} />
      </group>
    </group>
  );
}

export function MusicDeviceObject({ device }: { device: MusicDevice }) {
  const group = useRef<THREE.Group>(null);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const projected = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const node = group.current;
    if (!node) {
      musicDeviceScreen.onScreen = false;
      return;
    }

    node.getWorldPosition(projected);
    projected.y += device.signHeight;
    projected.project(camera);

    // z outside [-1, 1] means behind the camera or past the far plane.
    const inFront = projected.z > -1 && projected.z < 1;
    musicDeviceScreen.x = (projected.x * 0.5 + 0.5) * size.width;
    musicDeviceScreen.y = (-projected.y * 0.5 + 0.5) * size.height;
    musicDeviceScreen.onScreen =
      inFront &&
      projected.x > -1.1 &&
      projected.x < 1.1 &&
      projected.y > -1.1 &&
      projected.y < 1.1;
  });

  return (
    <group ref={group} position={device.position} rotation={[0, device.rotationY, 0]}>
      {/* The jukebox is a floor cabinet and brings its own base; everything
          else stands on the shelf. */}
      {device.kind !== 'jukebox' ? <WallShelf freestanding={device.freestanding ?? false} /> : null}

      <group position={[0, device.kind === 'jukebox' ? 0 : 0.024, device.kind === 'jukebox' ? 0 : 0.14]}>
        {device.kind === 'turntable' ? <Turntable /> : null}
        {device.kind === 'jukebox' ? <Jukebox /> : null}
        {device.kind === 'radio' ? <Radio /> : null}
      </group>

      <NeonSign height={device.signHeight} />
    </group>
  );
}
