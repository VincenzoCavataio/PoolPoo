/**
 * The GL scene: camera rig, environment, and the loop that drives the physics.
 *
 * No shadow maps. On a phone, going through expo-gl's WebGL bridge, a shadow
 * pass costs more than it returns here — the balls get soft contact shadows from
 * a cheap instanced disc instead (see `balls.tsx`).
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { ShotAudio } from '@/game/audio/shot-audio';
import type { Table } from '@/game/core/table';
import { Phase } from '@/game/rules/types';
import { useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

import { AimGuide } from './aim-guide';
import { Balls } from './balls';
import { CameraMode, rig } from './camera';
import { sceneX, sceneZ } from './coords';
import { Environment } from './environment';
import { EnvironmentReflections } from './environment-map';
import { effectiveLocation } from './locations';
import { MusicDeviceObject } from './music-device';
import { TableMesh } from './table-mesh';

const FOV = 48;
/** Slack around the table so perspective never crops a rail. */
const FRAMING_MARGIN = 1.1;
/** Higher follows the target sooner; this is a rate, so it is frame-rate free. */
const DAMPING = 11;
/** The replay is slower on purpose — it is meant to look like a camera move. */
const REPLAY_DAMPING = 5;
/** How far ahead of the cue ball the cue view looks. */
const CUE_LOOK_AHEAD = 1.0;

/**
 * There is no pixel-ratio dial on this platform.
 *
 * Capping it looked like the biggest performance win available — the canvas
 * draws at the display's full native density, and every one of those pixels is
 * paid for by the fragment shader with all seven lights in it. But expo-gl
 * creates its drawing buffer at the view's native resolution and can only render
 * at that size, so telling three.js a smaller ratio does not shrink the buffer:
 * it draws a smaller picture into the corner of a full-size one. That is exactly
 * what it did — the scene appeared at two thirds scale in the bottom-left until
 * the first layout change re-ran the setup and put it right.
 *
 * The canvas is also reconfigured with `dpr: PixelRatio.get()` by
 * react-three-fiber's own native wrapper, so any value set in `onCreated` is
 * overwritten a moment later regardless.
 *
 * The fill rate still came down by half, from framing the table into a panel
 * rather than the whole screen. That one is real because the buffer itself is
 * smaller.
 */
/** The aim stops following a fallen ball once it is on the floor. */
const FLOOR_LOOK_FLOOR = -0.78;

function CameraRig({ table }: { table: Table }) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const size = useThree((state) => state.size);

  const scratch = useMemo(
    () => ({
      wanted: new THREE.Vector3(),
      wantedLook: new THREE.Vector3(),
      // Smoothed separately from the position, so the pan and the travel ease
      // together instead of the view snapping round mid-move.
      look: new THREE.Vector3(),
    }),
    [],
  );
  const settled = useRef(false);
  const framing = useRef({ width: -1, height: -1 });

  useLayoutEffect(() => {
    camera.fov = FOV;
    // A tight near plane wastes depth-buffer precision, which shows up as
    // flicker between the cloth and the markings painted on it. 0.05 still
    // clears the cue ball at the closest the cue view is allowed to get.
    camera.near = 0.05;
    camera.far = 40;
    camera.updateProjectionMatrix();
  }, [camera]);

  useFrame((_, delta) => {
    const { wanted, wantedLook, look } = scratch;

    /**
     * Straight aspect ratio, no skew.
     *
     * The canvas used to run the full height of the screen with the panels lying
     * over it, so the table had to be framed into whatever band they left free —
     * `setViewOffset` rendered the whole canvas as an over-scan of that band. Now
     * the canvas *is* the band: it occupies exactly the space the layout gives
     * it, and every pixel of it is visible. Keeping the offset would shift the
     * framing a second time, for a gap that no longer exists.
     */
    const freeHeight = Math.max(160, size.height);
    if (framing.current.width !== size.width || framing.current.height !== size.height) {
      camera.aspect = size.width / freeHeight;
      camera.updateProjectionMatrix();
      framing.current = { width: size.width, height: size.height };
    }

    const { world, phase, replay, aimAngle, cameraMode } = useSession.getState();

    // `fov` is vertical, so on a narrow band the horizontal field is much
    // tighter and the width is usually what decides the distance.
    const halfFov = (FOV * Math.PI) / 360;
    const aspect = size.width / freeHeight;
    const forHeight = (table.halfLength + 0.08) / Math.tan(halfFov);
    const forWidth = (table.halfWidth + 0.08) / (Math.tan(halfFov) * Math.max(aspect, 0.2));
    const fitted = Math.max(forHeight, forWidth) * FRAMING_MARGIN;

    const tableView = () => {
      const distance = fitted * rig.zoom;
      const horizontal = Math.cos(rig.elevation) * distance;
      wanted.set(
        horizontal * Math.sin(rig.azimuth),
        Math.sin(rig.elevation) * distance,
        horizontal * Math.cos(rig.azimuth),
      );
      wantedLook.set(0, 0, 0);
    };

    let damping = DAMPING;

    if (phase === Phase.REPLAY && replay) {
      // Follow the moments as they come: the next one still to happen, or the
      // last once they all have. With the damping below the camera glides from
      // one to the next instead of cutting.
      const now = replay.world.time;
      const target =
        replay.moments.find((m) => m.t >= now - 0.04) ??
        replay.moments[replay.moments.length - 1];

      if (target.kind === 'fall') {
        /**
         * A ball going off the table: plant the camera and let the ball fall
         * through the shot, the way a broadcast camera would cover it.
         *
         * The first version chased the ball with the camera pinned a metre
         * behind it. That is the worst way to film a fall: the ball sits
         * motionless in frame while the room flies past, so nothing appears to
         * move except the scenery — and because the ball keeps travelling
         * outwards, the camera followed it clean through the wall, ending five
         * metres off the table.
         *
         * So the vantage point comes from where the ball *crossed the rail*,
         * which does not move, and only the aim tracks the ball down. It is set
         * back far enough to hold the table edge and the floor in one frame, so
         * you can see what left and how far it had to drop.
         */
        const ball = replay.world.balls.find((b) => b.number === target.ball);
        const exitX = sceneX(target.at);
        const exitZ = sceneZ(target.at);
        const length = Math.hypot(exitX, exitZ) || 1;
        const outX = exitX / length;
        const outZ = exitZ / length;

        // Outside the rail it went over, above table height, looking down.
        wanted.set(exitX + outX * 1.15, 0.62, exitZ + outZ * 1.15);

        // The aim follows the ball down; it is the only thing that moves.
        const lookX = ball ? sceneX(ball.p) : exitX;
        const lookZ = ball ? sceneZ(ball.p) : exitZ;
        const lookY = ball ? Math.max(FLOOR_LOOK_FLOOR, ball.z) : 0;
        wantedLook.set(lookX, lookY, lookZ);
        damping = REPLAY_DAMPING;
      } else {
        const pocket = table.pockets.find((p) => p.id === target.pocket);
        if (pocket) {
          const px = sceneX(pocket.center);
          const pz = sceneZ(pocket.center);
          const length = Math.hypot(px, pz) || 1;
          const outX = px / length;
          const outZ = pz / length;

          // Just outside the pocket, low, looking back along the ball's path.
          wanted.set(px + outX * 0.52, 0.3, pz + outZ * 0.52);
          wantedLook.set(px - outX * 0.14, -0.03, pz - outZ * 0.14);
          damping = REPLAY_DAMPING;
        } else {
          tableView();
        }
      }
    } else if (cameraMode === CameraMode.CUE && phase === Phase.AIMING) {
      const cue = world?.cueBall();
      if (cue && !cue.pocketed) {
        // Sim direction (cos a, sin a) maps to the scene as (sin a, -cos a).
        const dirX = Math.sin(aimAngle);
        const dirZ = -Math.cos(aimAngle);
        const ballX = sceneX(cue.p);
        const ballZ = sceneZ(cue.p);

        wanted.set(ballX - dirX * rig.eyeBack, rig.eyeHeight, ballZ - dirZ * rig.eyeBack);
        wantedLook.set(ballX + dirX * CUE_LOOK_AHEAD, 0.02, ballZ + dirZ * CUE_LOOK_AHEAD);
      } else {
        // Nothing to stand behind — fall back rather than point at nowhere.
        tableView();
      }
    } else {
      tableView();
    }

    if (!settled.current) {
      camera.position.copy(wanted);
      look.copy(wantedLook);
      settled.current = true;
    } else {
      const alpha = 1 - Math.exp(-damping * delta);
      camera.position.lerp(wanted, alpha);
      look.lerp(wantedLook, alpha);
    }

    camera.lookAt(look);
  });

  return null;
}

/** Advances the simulation. The store decides whether there is anything to do. */
function SimulationDriver() {
  useFrame((_, delta) => {
    useSession.getState().stepSimulation(delta);
  });
  return null;
}

export function GameScene() {
  const world = useSession((state) => state.world);
  const replay = useSession((state) => state.replay);
  const gameId = useSession((state) => state.gameId);
  const locationId = useSettings((state) => state.locationId);
  const stars = useProgress((state) => state.stars);

  const location = effectiveLocation(locationId, stars);

  if (!world) return null;

  // During a replay the balls come from the replay world; the real one keeps its
  // settled state untouched underneath.
  const shown = replay?.world ?? world;

  return (
    <Canvas
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        // Filmic tone mapping rather than raw clamping. Point lights close to a
        // glossy ball blow straight past white otherwise, and the highlights
        // turn into flat discs instead of reading as reflections.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;

      }}>
      {/* Both attach to the scene itself, so they belong at the top level. */}
      <color attach="background" args={[location.background]} />
      {location.fog ? (
        <fog attach="fog" args={[location.fog.color, location.fog.near, location.fog.far]} />
      ) : null}

      <EnvironmentReflections location={location} />
      <Environment location={location} />

      <CameraRig table={world.table} />

      {/* Remounted per game, so instance buffers are rebuilt for a new rack. */}
      <group key={gameId}>
        <TableMesh table={world.table} />
        <Balls world={shown} />
      </group>

      <MusicDeviceObject device={location.musicDevice} />

      <AimGuide />
      {/* Before the driver, so a fresh shot's empty event log is seen first. */}
      <ShotAudio />
      <SimulationDriver />
    </Canvas>
  );
}
