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
import type * as THREE from 'three';

import { BALL_RADIUS } from '@/game/core/constants';
import { predictAim } from '@/game/core/predict';
import type { Table } from '@/game/core/table';
import type { Vec2 } from '@/game/core/vec';
import { Phase } from '@/game/rules/types';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

import { CameraMode, rig } from './camera';
import { BALL_HEIGHT, sceneHeading, sceneX, sceneZ } from './coords';

const GUIDE_Y = BALL_RADIUS * 0.9;
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
    const { world, phase, aimAngle, power, cameraMode } = useSession.getState();
    const { showAimGuide, showGhostBall } = useSettings.getState();

    const cue = world?.cueBall();
    const aiming = phase === Phase.AIMING && !!world && !!cue && !cue.pocketed;

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
      let length = CUE_LENGTH;
      let visible = true;
      if (cameraMode === CameraMode.CUE) {
        const room = rig.eyeBack - BALL_RADIUS - pullBack - 0.05;
        length = Math.min(CUE_LENGTH, room);
        // Pulled right in against the ball there is simply no room for it.
        visible = room >= 0.1;
      }

      cueGroup.current.visible = visible;
      cueStick.current.scale.set(1, length / CUE_LENGTH, 1);
      cueStick.current.position.set(0, 0, -(pullBack + length / 2 + BALL_RADIUS));

      /*
       * Raise the butt when the ball is near a rail.
       *
       * The cue lies at ball height and reaches most of a metre backwards, so
       * near a cushion it ran straight through the woodwork. Rendering it in
       * front of everything would be a lie; elevating it is what a player
       * actually does, and it clears the rail for the same reason.
       */
      if (cueTilt.current) {
        const back = distanceToEdge(world.table, cue.p, aimAngle);
        const needed = back < length + BALL_RADIUS ? RAIL_CLEARANCE / Math.max(back, 0.04) : 0;
        const elevation = Math.min(MAX_ELEVATION, Math.max(BASE_ELEVATION, Math.atan(needed)));
        cueTilt.current.rotation.x = elevation;
      }
    }

    const prediction = predictAim(world, aimAngle);
    const stopX = sceneX(prediction.cueStop);
    const stopZ = sceneZ(prediction.cueStop);

    if (guideLine.current) {
      if (showAimGuide) layoutSegment(guideLine.current, cueX, cueZ, stopX, stopZ, GUIDE_Y);
      else guideLine.current.visible = false;
    }

    const showGhost = showAimGuide && showGhostBall && prediction.targetBall !== null;

    if (ghostBall.current) {
      ghostBall.current.visible = showGhost;
      if (showGhost) ghostBall.current.position.set(stopX, BALL_HEIGHT, stopZ);
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

      <mesh ref={guideLine}>
        <boxGeometry args={[0.006, 0.002, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.42} />
      </mesh>

      <mesh ref={ghostBall}>
        <sphereGeometry args={[BALL_RADIUS, 16, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} />
      </mesh>

      <mesh ref={targetLine}>
        <boxGeometry args={[0.005, 0.002, 1]} />
        <meshBasicMaterial color="#ffc857" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}
