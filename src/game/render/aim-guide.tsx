/**
 * Cue stick, aim line, ghost ball and predicted target path.
 *
 * Updated imperatively in `useFrame` from `getState()` rather than from props,
 * because aiming changes every touch move: driving it through React would
 * re-render the scene graph dozens of times per drag. The lines are thin boxes
 * rather than `THREE.Line`, since GL line width is capped at one pixel on
 * mobile and a one-pixel guide is invisible on a phone.
 */

import { useFrame } from '@react-three/fiber/native';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { BALL_RADIUS } from '@/game/core/constants';
import { predictAim } from '@/game/core/predict';
import { departureAngle } from '@/game/core/world';
import type { Table } from '@/game/core/table';
import type { Vec2 } from '@/game/core/vec';
import { Phase } from '@/game/rules/types';
import { useSession } from '@/store/session';
import { shakeFor, useSwing } from '@/store/swing';
import { useSettings } from '@/store/settings';

import { CameraMode, rig } from './camera';
import { BALL_HEIGHT, sceneHeading, sceneX, sceneZ } from './coords';

const GUIDE_Y = BALL_RADIUS * 0.9;

/**
 * The colour of every aiming mark.
 *
 * The app's gold. The guide used white for the line and the ghost, which is the
 * colour of the cue ball itself — so the line leaving the ball looked like part
 * of the ball, and the ghost sitting on an object ball hid it. One colour, used
 * nowhere else on the table, keeps all three marks legible as *aids* rather than
 * as things on the cloth.
 */
const GUIDE_COLOR = '#c9a962';

/**
 * How far the cue wanders while the swing meter is open, in metres.
 *
 * Four millimetres at its worst. Small in absolute terms — the tip is only a
 * couple of centimetres across — but from behind the ball it is plainly visible,
 * which is the point: you should be able to see that your hand is not steady.
 */
const CUE_SHAKE = 0.004;
const TARGET_LINE_LENGTH = 0.32;
const CUE_LENGTH = 0.9;

/** Height the butt has to reach to clear a rail, above the ball's centre. */
const RAIL_CLEARANCE = 0.048;
/** A cue is never quite level, even in the middle of the table. */
const BASE_ELEVATION = 0.06;
const MAX_ELEVATION = 0.95;

/**
 * How far the cue can travel backwards before it reaches the edge of the
 * playing area — which is where the rail begins.
 */
function distanceToEdge(table: Table, position: Vec2, aimAngle: number): number {
  const backX = -Math.cos(aimAngle);
  const backY = -Math.sin(aimAngle);
  let distance = Infinity;

  if (backX > 1e-6) distance = Math.min(distance, (table.halfLength - position.x) / backX);
  if (backX < -1e-6) distance = Math.min(distance, (-table.halfLength - position.x) / backX);
  if (backY > 1e-6) distance = Math.min(distance, (table.halfWidth - position.y) / backY);
  if (backY < -1e-6) distance = Math.min(distance, (-table.halfWidth - position.y) / backY);

  return Number.isFinite(distance) ? Math.max(0, distance) : Infinity;
}

/** Points a unit-length box (its long axis on local z) between two points. */
function layoutSegment(
  object: THREE.Object3D,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  y: number,
): void {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const length = Math.hypot(dx, dz);

  object.position.set((fromX + toX) / 2, y, (fromZ + toZ) / 2);
  object.rotation.set(0, Math.atan2(dx, dz), 0);
  object.scale.set(1, 1, Math.max(length, 1e-4));
  object.visible = length > 2e-3;
}

/**
 * How long the miscue swing takes to play out.
 *
 * Matches the hold the session puts on the phase for exactly this. Nothing at
 * all moves on a miscue — the ball does not shift a pixel — so the swing is the
 * whole event, and it is given the time to be seen rather than being squeezed
 * into however long the solver happens to take.
 */
const MISCUE_SWING_MS = 2000;

/**
 * The cue lunging through and missing the ball.
 *
 * Three things happen at once, and all three are what a real miscue looks like:
 * the cue drives forward past where the ball is, it slides off to one side (or
 * rides up over the top), and it turns as it goes because the hand has lost the
 * line. Then it stops, short and dead, rather than following through.
 *
 * Driven from an elapsed fraction rather than an animation, because the caller
 * is already a frame loop and a second clock would only be another thing that
 * could fall out of step with the shot.
 */
function drawMiscueSwing(
  refs: {
    cueGroup: React.RefObject<THREE.Group | null>;
    cueTilt: React.RefObject<THREE.Group | null>;
    cueStick: React.RefObject<THREE.Mesh | null>;
  },
  ballAt: Vec2,
  aimAngle: number,
  slip: 'left' | 'right' | 'high',
  progress: number,
): void {
  const { cueGroup, cueTilt, cueStick } = refs;
  if (!cueGroup.current || !cueStick.current) return;

  cueGroup.current.visible = true;
  cueGroup.current.position.set(sceneX(ballAt), BALL_HEIGHT, sceneZ(ballAt));
  cueGroup.current.rotation.set(0, sceneHeading(aimAngle), 0);

  /*
   * Fast out, then held.
   *
   * The lunge takes the first fifth of the window and the rest is the cue
   * sitting where it ended up. That pause is what sells it as a failure rather
   * than a stroke: a stroke follows through and recovers, a miscue stops dead
   * and leaves you looking at where the tip went.
   */
  const drive = Math.min(1, progress * 5);
  const eased = 1 - (1 - drive) * (1 - drive);

  // Through the ball rather than up to it: the tip ends past where it should
  // have struck, which is the whole point.
  const forward = MISCUE_THROUGH * eased;
  const sideways = slip === 'high' ? 0 : (slip === 'left' ? -1 : 1) * MISCUE_ASIDE * eased;
  const lift = slip === 'high' ? MISCUE_LIFT * eased : 0;

  cueStick.current.position.set(sideways, lift, -(CUE_LENGTH / 2 + BALL_RADIUS) + forward);
  /*
   * Back to full length for the swing.
   *
   * Aiming shortens the cue on the Y axis so it fits between the camera and the
   * rail; leaving that scale in place would send a stub through the ball instead
   * of a cue. The lathe runs along local Y, which is why the length lives there
   * and not on Z.
   */
  cueStick.current.scale.set(1, 1, 1);

  if (cueTilt.current) {
    // Turned off the line as it slides, and tipped up if it rode over the ball.
    cueTilt.current.rotation.set(
      slip === 'high' ? -MISCUE_TWIST * eased : 0,
      slip === 'high' ? 0 : (slip === 'left' ? -1 : 1) * MISCUE_TWIST * eased,
      0,
    );
  }
}

/** How far the tip travels past the ball, and how far off line it ends up. */
const MISCUE_THROUGH = 0.12;
const MISCUE_ASIDE = 0.05;
const MISCUE_LIFT = 0.045;
const MISCUE_TWIST = 0.22;

export function AimGuide() {
  const cueGroup = useRef<THREE.Group>(null);
  const cueTilt = useRef<THREE.Group>(null);
  const cueStick = useRef<THREE.Mesh>(null);
  const guideLine = useRef<THREE.Mesh>(null);
  const ghostBall = useRef<THREE.Mesh>(null);
  const targetLine = useRef<THREE.Mesh>(null);

  // Reused so the frame loop allocates nothing.
  const hidden = useMemo(() => [cueGroup, guideLine, ghostBall, targetLine], []);

  useFrame(() => {
    const { world, phase, aimAngle, power, cameraMode, spin } = useSession.getState();
    const { showAimGuide, showGhostBall } = useSettings.getState();

    const cue = world?.cueBall();
    const aiming = phase === Phase.AIMING && !!world && !!cue && !cue.pocketed;

    /*
     * The miscue swing: the cue goes through and misses the ball.
     *
     * Played over the first moments of the shot, while the phase is SIMULATING
     * and the cue would otherwise have simply disappeared. Nothing about the
     * physics is involved — the solver has already been told to barely move the
     * ball — so this is purely the picture of what went wrong, which is the part
     * that was missing.
     */
    const miscue = useSwing.getState().miscue;
    /*
     * Not gated on the phase.
     *
     * Requiring SIMULATING was a race: on a mishit the solver is already at rest
     * — the ball does not move at all — so the phase can advance out from under
     * the animation between one frame and the next, and the cue disappears
     * mid-lunge. The elapsed time is the only clock this needs, and the store
     * holds the record until the next shot is wound up.
     */
    if (miscue && world && cue && !cue.pocketed) {
      const elapsed = Date.now() - miscue.id;
      // Bounded both ways: a record left over from a previous shot must not
      // start a swing, and `elapsed` is negative only if the clock went
      // backwards.
      if (elapsed >= 0 && elapsed < MISCUE_SWING_MS) {
        drawMiscueSwing(
          { cueGroup, cueTilt, cueStick },
          cue.p,
          aimAngle,
          miscue.slip,
          elapsed / MISCUE_SWING_MS,
        );
        // Everything else stays hidden: there is no shot to guide.
        for (const ref of [guideLine, ghostBall, targetLine]) {
          if (ref.current) ref.current.visible = false;
        }
        return;
      }
    }

    if (!aiming) {
      for (const ref of hidden) {
        if (ref.current) ref.current.visible = false;
      }
      return;
    }

    const cueX = sceneX(cue.p);
    const cueZ = sceneZ(cue.p);
    const heading = sceneHeading(aimAngle);

    // Cue stick, drawn back in proportion to power.
    if (cueGroup.current && cueStick.current) {
      cueGroup.current.position.set(cueX, BALL_HEIGHT, cueZ);
      cueGroup.current.rotation.set(0, heading, 0);
      const pullBack = 0.03 + power * 0.12;

      // In the cue view the camera sits just behind the ball, so a full-length
      // cue would run straight through it and fill the screen with wood. It gets
      // shortened to stop short of the eye instead of hidden: without it there
      // is nothing on screen that visibly turns when you aim, which is exactly
      // what made aiming from down here feel unresponsive.
      const behind = distanceToEdge(world.table, cue.p, aimAngle);
      let length = CUE_LENGTH;
      let elevation = BASE_ELEVATION;
      let visible = true;

      if (cameraMode === CameraMode.CUE) {
        /*
         * From behind the ball the cue has to fit between the camera and the
         * rail, so it is *shortened* to fit and never elevated.
         *
         * Lifting the butt was the wrong fix here and made things worse: the eye
         * is only twenty centimetres above the ball, so a raised butt swings
         * straight up into the shot and fills the screen with wood. Trimming it
         * keeps it out of both the rail and the view.
         */
        const toCamera = rig.eyeBack - BALL_RADIUS - pullBack - 0.05;
        const toRail = behind - BALL_RADIUS - pullBack - 0.03;
        length = Math.min(CUE_LENGTH, toCamera, toRail);
        visible = length >= 0.1;
      } else if (behind < CUE_LENGTH + BALL_RADIUS + pullBack) {
        // From overhead there is nothing to block, so the butt lifts over the
        // rail the way a player would lift it.
        elevation = Math.min(
          MAX_ELEVATION,
          Math.atan(RAIL_CLEARANCE / Math.max(behind, 0.04)),
        );
      }

      const drawn = Math.max(0.02, length);
      cueGroup.current.visible = visible;
      cueStick.current.scale.set(1, drawn / CUE_LENGTH, 1);

      /*
       * The cue shakes as the charge builds, and hardest at the top of it.
       *
       * The same rule the ring follows: the further the charge is wound, the
       * less steady the hand. Shown on the cue as well as the button because the
       * shake is supposed to make the *shot* feel risky, and a glowing button
       * over a rock-steady cue reads as a UI effect rather than as somebody
       * winding up to snatch at it.
       *
       * Sideways and along, not vertical: a cue lifting off the ball would read
       * as a miscue rather than as an unsteady bridge.
       */
      const swing = useSwing.getState();
      let jitterX = 0;
      let jitterZ = 0;
      if (swing.charging) {
        const strength = shakeFor(swing.charge);
        if (strength > 0) {
          const now = performance.now();
          jitterX = Math.sin(now / 19) * CUE_SHAKE * strength;
          jitterZ = Math.cos(now / 13) * CUE_SHAKE * 0.6 * strength;
        }
      }

      cueStick.current.position.set(
        jitterX,
        0,
        -(pullBack + drawn / 2 + BALL_RADIUS) + jitterZ,
      );
      if (cueTilt.current) cueTilt.current.rotation.x = elevation;
    }

    /*
     * Predicted along the line the ball will leave on, not the line the cue is
     * pointing down.
     *
     * With side spin the two differ by a couple of degrees — squirt — and over a
     * full-table shot that is nearly a ball's width. Drawing the cue's line
     * would make the guide confidently wrong on exactly the shots where a
     * player most wants help, so it follows the ball instead. The cue still
     * renders where it is aimed, which is what makes the deflection visible.
     */
    const prediction = predictAim(world, departureAngle(aimAngle, spin));
    const stopX = sceneX(prediction.cueStop);
    const stopZ = sceneZ(prediction.cueStop);

    if (guideLine.current) {
      if (showAimGuide) layoutSegment(guideLine.current, cueX, cueZ, stopX, stopZ, GUIDE_Y);
      else guideLine.current.visible = false;
    }

    const showGhost = showAimGuide && showGhostBall && prediction.targetBall !== null;

    if (ghostBall.current) {
      ghostBall.current.visible = showGhost;
      // Flat on the cloth, not at the ball's centre: it is a ring marking a
      // place on the table now, not a sphere standing in for a ball.
      if (showGhost) ghostBall.current.position.set(stopX, GUIDE_Y * 0.12, stopZ);
    }

    if (targetLine.current) {
      const target = prediction.targetBall !== null ? world.ballByNumber(prediction.targetBall) : undefined;
      if (showGhost && target && prediction.targetDirection) {
        const tip = {
          x: target.p.x + prediction.targetDirection.x * TARGET_LINE_LENGTH,
          y: target.p.y + prediction.targetDirection.y * TARGET_LINE_LENGTH,
        };
        layoutSegment(
          targetLine.current,
          sceneX(target.p),
          sceneZ(target.p),
          sceneX(tip),
          sceneZ(tip),
          GUIDE_Y,
        );
      } else {
        targetLine.current.visible = false;
      }
    }
  });

  return (
    <group>
      <group ref={cueGroup}>
        {/* Nested so the elevation pivots about the ball, inside the heading. */}
        <group ref={cueTilt}>
          <mesh ref={cueStick} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.006, 0.011, CUE_LENGTH, 12]} />
            <meshPhysicalMaterial color="#c98f4b" roughness={0.35} clearcoat={0.6} />
          </mesh>
        </group>
      </group>

      {/*
        The aim line, in the app's gold rather than plain white.
​
        White is the colour of the cue ball, so a white line leaving a white ball
        read as part of it. Gold is what this app uses for the thing you are
        about to do, and on green baize it separates cleanly from both the cloth
        and the balls.
​
        Additive and depth-write off, like the trail: these are marks of light
        laid over the table, not objects standing on it, and writing depth let
        them z-fight with the cloth at glancing angles.
      */}
      <mesh ref={guideLine}>
        <boxGeometry args={[0.004, 0.001, 1]} />
        <meshBasicMaterial
          color={GUIDE_COLOR}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/*
        The ghost ball, as a ring rather than a solid sphere.
​
        A translucent white sphere sitting on the object ball hid the ball it was
        pointing at — worst of all at close range, where the two coincide and the
        guide appeared to stop working. A thin ring drawn flat on the cloth marks
        the same contact point while leaving everything behind it visible.
      */}
      <mesh ref={ghostBall} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[BALL_RADIUS * 0.82, BALL_RADIUS, 28]} />
        <meshBasicMaterial
          color={GUIDE_COLOR}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Where the struck ball goes: brighter, because it is the answer. */}
      <mesh ref={targetLine}>
        <boxGeometry args={[0.005, 0.001, 1]} />
        <meshBasicMaterial
          color={GUIDE_COLOR}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
