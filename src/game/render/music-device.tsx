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
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { CHANGE_TOTAL_MS, useMusic } from '@/game/audio/music';
import { trackAt } from '@/game/audio/tracks';

import type { MusicDevice } from './locations';

/** Where the device currently is on screen, for the tap gesture to compare. */
export const musicDeviceScreen = { x: -1, y: -1, onScreen: false };

/** Cosine of the half-angle within which the prompt appears. */
const LOOK_THRESHOLD = Math.cos((34 * Math.PI) / 180);
const SPIN_SPEED = 1.9;

/**
 * The prompt above the player.
 *
 * A still label was too easy to read as scenery — it sat there looking like one
 * more object in a room full of objects. Movement is what separates "you can
 * touch this" from "this is furniture", so it bounces in, hovers, rocks the note
 * back and forth and pulses a ring behind it. It also swells rather than fades
 * in, which the eye catches from the corner.
 */
function Bubble({ height }: { height: number }) {
  const group = useRef<THREE.Group>(null);
  const note = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const camera = useThree((state) => state.camera);
  const scratch = useMemo(
    () => ({ forward: new THREE.Vector3(), toDevice: new THREE.Vector3(), world: new THREE.Vector3() }),
    [],
  );
  const shown = useRef(0);
  const clock = useRef(0);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;

    clock.current += delta;

    node.getWorldPosition(scratch.world);
    camera.getWorldDirection(scratch.forward);
    scratch.toDevice.copy(scratch.world).sub(camera.position).normalize();

    // Only when the player is actually looking at it, which is what makes the
    // prompt feel like a response rather than clutter.
    const facing = scratch.forward.dot(scratch.toDevice) > LOOK_THRESHOLD;
    const target = facing ? 1 : 0;
    shown.current += (target - shown.current) * Math.min(1, delta * 9);

    node.visible = shown.current > 0.02;

    // Overshoot on the way in: it pops rather than appears.
    const pop = 1 + Math.sin(Math.min(1, shown.current) * Math.PI) * 0.22;
    const breathe = 1 + Math.sin(clock.current * 3.1) * 0.05;
    node.scale.setScalar(shown.current * pop * breathe);

    node.quaternion.copy(camera.quaternion);
    node.position.y = height + Math.sin(clock.current * 2.2) * 0.022;

    if (note.current) {
      note.current.rotation.z = Math.sin(clock.current * 4.4) * 0.28;
      note.current.position.y = Math.sin(clock.current * 4.4 + 1) * 0.008;
    }

    if (ring.current) {
      const beat = (clock.current % 1.6) / 1.6;
      ring.current.scale.setScalar(0.6 + beat * 1.5);
      const material = ring.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.5 - beat * 0.5);
    }
  });

  return (
    <group ref={group} position={[0, height, 0]}>
      <mesh ref={ring} position={[0, 0, -0.006]}>
        <ringGeometry args={[0.1, 0.125, 24]} />
        <meshBasicMaterial color="#3ddc84" transparent opacity={0.4} depthWrite={false} />
      </mesh>

      <mesh>
        <boxGeometry args={[0.17, 0.13, 0.012]} />
        <meshBasicMaterial color="#101a15" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, -0.085, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.04, 0.04, 0.01]} />
        <meshBasicMaterial color="#101a15" transparent opacity={0.9} />
      </mesh>

      {/* A quaver: head, stem, flag. */}
      <group ref={note}>
        <mesh position={[-0.018, -0.022, 0.011]} rotation={[0, 0, -0.35]}>
          <sphereGeometry args={[0.021, 10, 8]} />
          <meshBasicMaterial color="#3ddc84" />
        </mesh>
        <mesh position={[0.001, 0.014, 0.011]}>
          <boxGeometry args={[0.008, 0.075, 0.008]} />
          <meshBasicMaterial color="#3ddc84" />
        </mesh>
        <mesh position={[0.022, 0.036, 0.011]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.038, 0.012, 0.008]} />
          <meshBasicMaterial color="#3ddc84" />
        </mesh>
      </group>
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

function Turntable() {
  const arm = useRef<THREE.Group>(null);

  useFrame(() => {
    const { changing, playing } = useMusic.getState();
    if (!arm.current) return;
    // Swung in over the record while playing, parked out of the way otherwise.
    const target = changing || !playing ? 0.55 : 0;
    arm.current.rotation.y += (target - arm.current.rotation.y) * 0.12;
  });

  return (
    <group>
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[0.44, 0.09, 0.34]} />
        <meshPhysicalMaterial color="#1b1d20" roughness={0.35} clearcoat={0.55} />
      </mesh>
      <mesh position={[0, 0.096, 0]}>
        <cylinderGeometry args={[0.138, 0.138, 0.014, 32]} />
        <meshPhysicalMaterial color="#b9bfc6" roughness={0.22} metalness={0.95} />
      </mesh>

      <group position={[0, 0.107, 0]}>
        <Disc radius={0.128} />
      </group>

      <mesh position={[0, 0.115, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.03, 8]} />
        <meshPhysicalMaterial color="#b9bfc6" roughness={0.2} metalness={0.95} />
      </mesh>

      <group ref={arm} position={[0.17, 0.1, -0.12]}>
        <mesh position={[-0.1, 0.02, 0.06]} rotation={[0, -0.6, 0]}>
          <boxGeometry args={[0.23, 0.012, 0.016]} />
          <meshPhysicalMaterial color="#b9bfc6" roughness={0.25} metalness={0.9} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.026, 0.026, 0.022, 16]} />
          <meshPhysicalMaterial color="#1b1d20" roughness={0.3} clearcoat={0.6} />
        </mesh>
      </group>

      {[-0.16, 0.16].map((x) => (
        <mesh key={x} position={[x, 0.096, 0.13]}>
          <cylinderGeometry args={[0.018, 0.018, 0.016, 16]} />
          <meshPhysicalMaterial color="#b9bfc6" roughness={0.25} metalness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Jukebox() {
  return (
    <group>
      <mesh position={[0, 0.68, 0]}>
        <boxGeometry args={[0.82, 1.36, 0.52]} />
        <meshPhysicalMaterial color="#4a1f2e" roughness={0.35} clearcoat={0.7} />
      </mesh>
      {/* Domed top, the shape everyone recognises. */}
      <mesh position={[0, 1.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.41, 0.41, 0.52, 24, 1, false, 0, Math.PI]} />
        <meshPhysicalMaterial color="#4a1f2e" roughness={0.35} clearcoat={0.7} side={THREE.DoubleSide} />
      </mesh>

      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.78, 0]}>
          <boxGeometry args={[0.04, 1.2, 0.06]} />
          <meshBasicMaterial color="#ff53d8" />
        </mesh>
      ))}

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

      <mesh position={[0, 0.5, 0.27]}>
        <boxGeometry args={[0.5, 0.3, 0.02]} />
        <meshStandardMaterial color="#2a2c2f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.2, 0.27]}>
        <boxGeometry args={[0.4, 0.06, 0.02]} />
        <meshBasicMaterial color="#5cf0ff" />
      </mesh>
    </group>
  );
}

function Radio() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.38, 0.2, 0.17]} />
        <meshPhysicalMaterial color="#2b2723" roughness={0.4} clearcoat={0.5} />
      </mesh>
      <mesh position={[-0.1, 0.1, 0.088]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.012, 20]} />
        <meshStandardMaterial color="#2a2c2f" roughness={0.95} />
      </mesh>
      <mesh position={[0.09, 0.14, 0.088]}>
        <boxGeometry args={[0.13, 0.045, 0.012]} />
        <meshBasicMaterial color="#ffa63c" />
      </mesh>
      {[0.05, 0.13].map((x) => (
        <mesh key={x} position={[x, 0.05, 0.088]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.012, 12]} />
          <meshPhysicalMaterial color="#b9bfc6" roughness={0.25} metalness={0.9} />
        </mesh>
      ))}
      {/* Handle, so it reads as portable. */}
      <mesh position={[0, 0.215, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.075, 0.008, 8, 20, Math.PI]} />
        <meshPhysicalMaterial color="#1b1d20" roughness={0.5} />
      </mesh>

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
    projected.y += device.bubbleHeight * 0.5;
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
      {device.kind === 'turntable' ? <Turntable /> : null}
      {device.kind === 'jukebox' ? <Jukebox /> : null}
      {device.kind === 'radio' ? <Radio /> : null}
      <Bubble height={device.bubbleHeight} />
    </group>
  );
}
