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
import { CameraMode, rig, uiInsets } from './camera';
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
  const framing = useRef({ top: -1, bottom: -1, width: -1, height: -1 });

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
     * The HUD sits over the canvas, so the table is framed inside the band it
     * leaves free rather than inside the whole viewport. `setViewOffset` renders
     * the full canvas as an over-scan of that band: the table lands between the
     * panels, and the extra scenery fills the space behind them.
     */
    const freeHeight = Math.max(160, size.height - uiInsets.top - uiInsets.bottom);
    if (
      framing.current.top !== uiInsets.top ||
      framing.current.bottom !== uiInsets.bottom ||
      framing.current.width !== size.width ||
      framing.current.height !== size.height
    ) {
      camera.aspect = size.width / freeHeight;
      camera.setViewOffset(size.width, freeHeight, 0, -uiInsets.top, size.width, size.height);
      camera.updateProjectionMatrix();
      framing.current = {
        top: uiInsets.top,
        bottom: uiInsets.bottom,
        width: size.width,
        height: size.height,
      };
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
      // Follow the pots as they come: the next one still to drop, or the last
      // one once they all have. With the damping below, the camera glides from
      // pocket to pocket instead of cutting.
      const now = replay.world.time;
      const target =
        replay.pots.find((p) => p.t >= now - 0.04) ?? replay.pots[replay.pots.length - 1];
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
