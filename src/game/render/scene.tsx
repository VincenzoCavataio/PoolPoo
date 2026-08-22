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
import { useSession } from '@/store/session';
import { loadById, qualityById } from '@/constants/quality';
import { useSettings } from '@/store/settings';

import { AimGuide } from './aim-guide';
import { Balls } from './balls';
import { CameraMode, rig } from './camera';
import { sceneX, sceneZ } from './coords';
import { Environment } from './environment';
import { EnvironmentReflections } from './environment-map';
import { effectiveLocation } from './locations';
import { requestRedraw, setRedrawHandle } from './redraw';
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
 * How often the scene is redrawn, in frames per second.
 *
 * A mutable box rather than React state: the only place a limit can be applied
 * is inside the renderer's own draw call, which is installed once when the GL
 * context is created and never rebuilt. A value captured from a render would be
 * the one from mount and would never change again.
 */
const frameLimit = { fps: 60 };

/** A hair of slack, so a panel running a shade under its nominal rate is not
 *  halved by a threshold it keeps missing by a microsecond. */
const FRAME_SLACK_MS = 1.5;

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

/**
 * How close the camera has to be to its target before it stops asking for
 * frames, as a squared distance in metres.
 *
 * A millimetre. Squared, so the check needs no square root on a path that runs
 * every frame.
 */
const CAMERA_REST_SQ = 0.001 * 0.001;

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

          /*
           * Swung along the rail, which is what the side pockets need.
           *
           * Straight outward from the table's centre is a good angle for a
           * corner, where that direction is diagonal and a ball arrives roughly
           * towards you. It is the worst possible angle for a side pocket: there
           * the outward direction is square to the long rail, so the camera ends
           * up looking straight across the table and the ball crosses the frame
           * sideways rather than coming at you. You see it arrive and vanish,
           * never the drop.
           *
           * Offsetting along the rail turns the view up the table instead, so a
           * ball rolling into a middle pocket is coming towards the lens. Which
           * way to swing is decided by where the ball is arriving from, so a pot
           * from either end is filmed from the side it came.
           */
          const isSide = pocket.id === 'side-n' || pocket.id === 'side-s';

          let camX = px + outX * 0.52;
          let camZ = pz + outZ * 0.52;
          let lookX = px - outX * 0.14;
          let lookZ = pz - outZ * 0.14;

          if (isSide) {
            const ball = replay.world.balls.find((b) => b.number === target.ball);
            // The rail runs along z here, so the swing is along z as well. Sign
            // from which half of the table the ball is coming from.
            const from = ball ? sceneZ(ball.p) : 0;
            const swing = from >= 0 ? 1 : -1;

            camX = px + outX * 0.34;
            camZ = pz + swing * 0.72;
            // Aimed a little past the pocket, so the ball runs into frame rather
            // than sitting in the middle of it the whole way.
            lookX = px - outX * 0.1;
            lookZ = pz - swing * 0.12;
          }

          // Just outside the pocket, low, looking back along the ball's path.
          wanted.set(camX, 0.3, camZ);
          wantedLook.set(lookX, -0.03, lookZ);
          damping = REPLAY_DAMPING;
        } else {
          tableView();
        }
      }
    } else if (
      /*
       * Behind the cue while aiming, and while a mishit plays out.
       *
       * The phase check used to be `AIMING` alone, so the instant a shot began
       * the camera fell through to the table view no matter what `cameraMode`
       * said — which is why a miscue still cut to the ceiling even after the
       * store was told to stay put. On a mishit there is nothing on the table to
       * pull back for: the ball moves two centimetres and the only thing worth
       * watching is the cue going through and missing it.
       */
      cameraMode === CameraMode.CUE &&
      (phase === Phase.AIMING || phase === Phase.SIMULATING)
    ) {
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

      /*
       * A moving camera keeps the loop awake.
       *
       * The easing is exponential, so it never formally arrives: without a
       * threshold this would request frames for ever and the demand presets
       * would save nothing. A millimetre is far below what a pixel can show at
       * this scale, so stopping there is invisible — and `lerp` continues to
       * close the remaining distance on whatever frame comes next anyway.
       *
       * This matters most for a view change made while aiming, which is the one
       * animation that happens in the phase `DemandDriver` deliberately sleeps
       * through.
       */
      if (camera.position.distanceToSquared(wanted) > CAMERA_REST_SQ) requestRedraw();
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

/**
 * Keeps the frame loop alive while anything on screen is still moving.
 *
 * `frameloop="demand"` stops the loop entirely between requests — including
 * `useFrame`, which is what drives the physics. So on demand the loop is not
 * "the scene redraws when React re-renders"; it is "the scene redraws while
 * something says it must", and this is the thing that says so.
 *
 * The rule is deliberately generous. A missed `invalidate` is a frozen table,
 * which is far worse than a few frames drawn for nothing, so this asks for
 * another frame whenever the game is in any state that could possibly change on
 * its own — a shot resolving, a replay running, the camera easing towards a new
 * position — and only lets go once the table has genuinely settled.
 *
 * What it does *not* cover is deliberate: a still table in `AIMING` draws
 * nothing until the player touches it, and the aim gesture invalidates through
 * `nudgeAim`. That is the state the whole setting exists for, and it is most of
 * a game.
 */
function DemandDriver() {
  const invalidate = useThree((state) => state.invalidate);

  useFrame(() => {
    const { phase, replay } = useSession.getState();

    /*
     * Anything but a settled aim keeps the loop running.
     *
     * `AIMING` is the one phase that can be genuinely static. Every other phase
     * is a thing in progress by definition: balls rolling, a replay playing, a
     * rack being set. The camera is included through the phase too — the moves
     * that ease it belong to shots and replays, not to a still aim.
     */
    if (phase !== Phase.AIMING || replay) invalidate();
  });

  /*
   * The first frame after a mount, and the handle everything else uses.
   *
   * On demand nothing has asked for a frame yet, and a scene that has never
   * drawn is a black screen rather than a still table — so one is requested
   * outright. The same effect leaves `invalidate` where the aim gesture and the
   * session store can reach it; see `redraw.ts` for why they cannot import it
   * themselves.
   */
  useLayoutEffect(() => {
    setRedrawHandle(invalidate);
    invalidate();
    return () => setRedrawHandle(null);
  }, [invalidate]);

  return null;
}

export function GameScene() {
  const world = useSession((state) => state.world);
  const replay = useSession((state) => state.replay);
  const gameId = useSession((state) => state.gameId);
  const locationId = useSettings((state) => state.locationId);
  const quality = qualityById(useSettings((state) => state.quality));
  const load = loadById(useSettings((state) => state.load));

  // Pushed into the box the draw call reads, which cannot see React state.
  frameLimit.fps = quality.fps;

  const location = effectiveLocation(locationId);

  if (!world) return null;

  // During a replay the balls come from the replay world; the real one keeps its
  // settled state untouched underneath.
  const shown = replay?.world ?? world;

  return (
    <Canvas
      /*
       * Drawn on demand, or continuously, according to the workload preset.
       *
       * On demand the loop sleeps between requests — see `DemandDriver`, which
       * is what keeps it awake while a shot resolves and what hands the rest of
       * the app a way to ask for a frame.
       */
      frameloop={load.renderOnDemand ? 'demand' : 'always'}
      /**
       * Building the renderer here, rather than letting the canvas build one, so
       * the frame limiter can sit *inside* it.
       *
       * That position is the whole point. react-three-fiber's native canvas
       * wraps `gl.render` to append expo-gl's `endFrameEXP`, which is what hands
       * the finished buffer to the display — and it wraps whatever it is given.
       * A limiter installed afterwards, in `onCreated`, ends up wrapping *that*,
       * so skipping a frame also skips `endFrameEXP`: the native loop is left
       * waiting for a buffer that never arrives, and the result is exactly the
       * intermittent hitch this was meant to prevent.
       *
       * Installed here, the limiter is underneath. Skipping means the scene is
       * not re-rendered but the previous buffer is still presented, which is
       * precisely what running at 30 on a 60 Hz panel looks like — every image
       * held for two refreshes, and the display never left waiting.
       */
      gl={(defaults) => {
        const renderer = new THREE.WebGLRenderer({
          ...defaults,
          antialias: quality.antialias,
        });

        // Filmic tone mapping rather than raw clamping. Point lights close to a
        // glossy ball blow straight past white otherwise, and the highlights
        // turn into flat discs instead of reading as reflections.
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;

        const draw = renderer.render.bind(renderer);
        let lastDrawn = 0;
        renderer.render = (scene: THREE.Scene, camera: THREE.Camera) => {
          const minimum = 1000 / frameLimit.fps - FRAME_SLACK_MS;
          const now = Date.now();
          if (now - lastDrawn < minimum) return;
          lastDrawn = now;
          draw(scene, camera);
        };

        return renderer;
      }}>
      {/* Both attach to the scene itself, so they belong at the top level. */}
      <color attach="background" args={[location.background]} />
      {location.fog ? (
        <fog attach="fog" args={[location.fog.color, location.fog.near, location.fog.far]} />
      ) : null}

      {/* Reflections of the room in the balls and rails. Generated once into a
          cube map, so the cost is in memory and setup rather than per frame —
          which is why only the lowest preset gives it up. */}
      {quality.environmentMap ? <EnvironmentReflections location={location} /> : null}
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
      <DemandDriver />
    </Canvas>
  );
}
