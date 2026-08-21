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
import type { Table } from '@/game/core/table';
import type { Vec2 } from '@/game/core/vec';
import { departureAngle } from '@/game/core/world';
import { Phase } from '@/game/rules/types';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { shakeFor, useSwing } from '@/store/swing';

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
 * The prediction itself: the dotted lines and the ghost ball, in white.
 *
 * Gold is the app's accent, and on the cloth it was doing two jobs at once —
 * marking the guide *and* competing with the wood and the trim for the same
 * eye. White separates cleanly from every cloth the table can wear, and it is
 * the colour of the ball whose future these lines describe: the dots are where
 * the white ball travels, the disc is where it stops.
 *
 * The contact frame drawn *on* the cue ball stays gold for the opposite reason:
 * white on white would vanish.
 */
const PREDICTION_COLOR = '#f4f2ec';
const PREDICTION_HEX = 0xf4f2ec;

/**
 * The contact mark: near-black, against ivory.
 *
 * The aiming gold is drawn on green cloth, where it is the lighter of the two.
 * This mark is drawn on the cue ball, where the same gold is the *darker* by a
 * hair and nearly vanishes — #c9a962 on #f7f4ec is about 2:1.
 *
 * Black is the plainest thing that reads on a white ball, at around 19:1, and
 * it stays clearly distinct from the ball's own red spots without having to be
 * a shade of them. The reference frame around it is gold, so nothing is asked
 * to tell two similar colours apart.
 */
const TARGET_COLOR = '#080808';

/**
 * How far the cue wanders while the swing meter is open, in metres.
 *
 * Four millimetres at its worst. Small in absolute terms — the tip is only a
 * couple of centimetres across — but from behind the ball it is plainly visible,
 * which is the point: you should be able to see that your hand is not steady.
 */
const CUE_SHAKE = 0.004;

/**
 * How far the tip shifts across the ball at full english, in metres.
 *
 * A real player addressing side spin moves the *cue*, not a setting: the tip
 * goes to the part of the ball it is going to strike, and where it sits is the
 * whole of the information. Showing that here means the english can be read off
 * the table even with the contact mark switched off, which is the point — the
 * mark is an aid, the cue is the shot.
 *
 * Deliberately less than the full offset the mark travels. The tip really would
 * move the whole way, but the cue is seen almost end-on from behind the ball,
 * where a true-scale shift reads as the cue drifting off the shot line rather
 * than as english. Roughly two thirds keeps the movement legible as intent.
 */
const TIP_ENGLISH = BALL_RADIUS * 0.48;
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

/**
 * The aim line, as a run of dots rather than one solid bar.
 *
 * A continuous rod reads as an object lying on the cloth — a second cue, or a
 * rail — which is exactly what it is not. Dots read as a path: the eye follows
 * them the way it follows a dotted line on a map, and they say "this is where it
 * *would* go" rather than "there is something here".
 *
 * Round rather than dashed because a dash still has a direction of its own, and
 * a run of them reads as a broken line — a thing that was solid and is missing
 * pieces. A dot has no direction at all: it is purely a position, and the line
 * exists only in the eye that joins them up. That is the truer picture of a
 * prediction, and it is quieter on the cloth.
 *
 * They fade along their length, brightest at the cue ball and faintest at the
 * far end, because that is the honest picture of the prediction — the first
 * inch is nearly certain, the last is a guess that any contact will change.
 */
const DASH_LENGTH = 0.007;
const DASH_GAP = 0.019;
/*
 * Enough for the longest line the table can hold.
 *
 * Corner to corner is about 2.84 m, which at this stride is 109 dots; the cap
 * has to clear that or the guide silently stops short on exactly the long shots
 * where it is most useful. Sized once at 128 rather than grown at runtime,
 * because an `InstancedMesh` cannot be resized after it is built — and the
 * spare costs nothing, since `count` is what decides how many are drawn.
 */
const MAX_DASHES = 128;

/** Lays dashes along a segment, returning how many were used. */
function layoutDashes(
  mesh: THREE.InstancedMesh,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  y: number,
  scratch: THREE.Object3D,
  colour: THREE.Color,
  /**
   * How much of the far end to leave empty, in metres.
   *
   * The run ends at the *contact point*, which is the centre of the ghost ring
   * — so dashes drawn all the way there cross the ring and fill it in. The ring
   * is a ball-sized circle marking where the cue ball will sit, and a line
   * through it reads as the line continuing past the contact rather than
   * stopping at it. Holding back by a radius leaves the ring clean and lets it
   * do its own job.
   */
  trim = 0,
  /**
   * How much of the near end to skip, in metres.
   *
   * The mirror of `trim`. The line after the impact starts at the struck ball's
   * centre, which is under the ghost ring, so it needs the same clearance at
   * its start that the approach line needs at its end.
   */
  lead = 0,
  /** How far the dashes dim along the run: 0 keeps them even. */
  fade = 0.72,
): void {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const span = Math.hypot(dx, dz);

  if (span - trim - lead < 2e-3) {
    mesh.count = 0;
    mesh.visible = false;
    return;
  }

  const stride = DASH_LENGTH + DASH_GAP;
  // The length actually dashed: everything up to where the ghost begins.
  const drawn = Math.max(0, span - trim - lead);
  const count = Math.min(MAX_DASHES, Math.floor(drawn / stride));

  for (let i = 0; i < count; i++) {
    // Centre of this dash, measured from the cue ball.
    const along = i * stride + DASH_LENGTH / 2;
    const t = along / Math.max(drawn, 1e-6);
    // Pushed out past the lead-in, so the run starts where it should.
    const distance = along + lead;

    scratch.position.set(fromX + (dx / span) * distance, y, fromZ + (dz / span) * distance);
    /*
     * Laid flat on the cloth.
     *
     * A `circleGeometry` is born standing upright in the XY plane, so without
     * this it would face the end of the table and vanish to a hairline when
     * seen from behind the cue — exactly the view the guide is for. Tipping it a
     * quarter turn about X puts it face-up. No Y rotation: a dot has no heading,
     * which is the whole reason for using one.
     */
    scratch.rotation.set(-Math.PI / 2, 0, 0);
    /*
     * Every dot the same size.
     *
     * A dash could be trimmed lengthwise to stop exactly on the contact point;
     * a dot cannot be squashed without turning into an ellipse and picking up
     * the very direction it is here to avoid. The run simply stops at the last
     * dot that fits, and the gap left over reads as spacing.
     */
    scratch.scale.set(1, 1, 1);
    scratch.updateMatrix();
    mesh.setMatrixAt(i, scratch.matrix);

    // Bright at the ball, faint at the far end — never fully out.
    const level = 1 - t * fade;
    mesh.setColorAt(i, colour.setHex(PREDICTION_HEX).multiplyScalar(level));
  }

  mesh.count = count;
  mesh.visible = count > 0;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function AimGuide() {
  const cueGroup = useRef<THREE.Group>(null);
  const cueTilt = useRef<THREE.Group>(null);
  const cueStick = useRef<THREE.Mesh>(null);
  const guideLine = useRef<THREE.InstancedMesh>(null);
  // Reused every frame: building these per dash would allocate on each of them.
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const scratchColour = useMemo(() => new THREE.Color(), []);
  const ghostBall = useRef<THREE.Mesh>(null);
  const spinTarget = useRef<THREE.Group>(null);
  const spinFrame = useRef<THREE.Group>(null);
  const targetLine = useRef<THREE.InstancedMesh>(null);

  // Reused so the frame loop allocates nothing.
  /*
   * Everything the guide draws while aiming, so the frame can hide the lot.
   *
   * `spinTarget` belongs here as much as the rest: the frame returns early the
   * moment aiming stops, so anything left out of this list simply keeps
   * whatever visibility it had — which is how the contact mark stayed painted
   * on the ball all the way through the shot.
   */
  const hidden = useMemo(
    () => [cueGroup, guideLine, ghostBall, targetLine, spinTarget, spinFrame],
    [],
  );

  useFrame(({ camera }) => {
    const { world, phase, aimAngle, power, cameraMode, spin } = useSession.getState();
    const { showAimGuide, showSpinTarget } = useSettings.getState();

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

      /*
       * And it moves to the english, the way a hand would place it.
       *
       * Sideways is the cue's own local X, which is across the shot line — the
       * same axis the contact mark uses — and vertical is the tip riding up or
       * down the face for follow and draw. Both are simply where the tip is
       * being put, so they apply whether or not the mark is being drawn.
       */
      /*
       * Negated, for the same reason the mark on the ball is.
       *
       * The stick sits in `cueGroup`'s local space, and that group is turned to
       * face down the shot — so its local +X points table-right while the camera,
       * standing behind the ball, calls that direction left. Without the flip the
       * tip mirrors the contact mark: the cross goes right and the cue goes left,
       * and the two references contradict each other.
       */
      const tipSide = -spin.side * TIP_ENGLISH;
      const tipRise = spin.vertical * TIP_ENGLISH;

      cueStick.current.position.set(
        jitterX + tipSide,
        tipRise,
        -(pullBack + drawn / 2 + BALL_RADIUS) + jitterZ,
      );
      if (cueTilt.current) cueTilt.current.rotation.x = elevation;
    }

    /*
     * The contact point, marked on the cue ball itself.
     *
     * A target where the tip will strike, rather than a diagram of a ball
     * somewhere else on screen: this is the ball you are looking at, so putting
     * the mark on it removes the translation step entirely — no working out
     * which part of a small circle in the corner corresponds to which part of
     * the ball on the cloth.
     *
     * Placed on the *near* face, the one the cue is coming from. From behind the
     * ball that is the side you can see; the far side is where the shot goes,
     * and a mark there would be both hidden and wrong.
     */
    if (spinTarget.current) {
      const showTarget = useSwing.getState().charging && showSpinTarget;
      spinTarget.current.visible = showTarget;

      if (showTarget) {
        const heading = sceneHeading(aimAngle);
        /*
         * Out along the line to the eye, not along the cue.
         *
         * The mark sits a ball's radius proud of the centre, and the camera
         * looks *down* on it — so a mark pushed straight back along the cue
         * projects higher on screen than the ball's own centre, by about a fifth
         * of the ball. It reads as a sight floating above the ball rather than
         * one painted on it. Pushing it towards the eye instead keeps it
         * concentric from any angle, because the offset is then along the one
         * direction that cannot displace it on screen: straight at the viewer.
         */
        const eyeX = camera.position.x - sceneX(cue.p);
        const eyeY = camera.position.y - BALL_HEIGHT;
        const eyeZ = camera.position.z - sceneZ(cue.p);
        const eyeLen = Math.hypot(eyeX, eyeY, eyeZ) || 1;
        const backX = eyeX / eyeLen;
        const backY = eyeY / eyeLen;
        const backZ = eyeZ / eyeLen;
        /*
         * Across the shot line — negated, because you are behind the ball.
         *
         * The obvious perpendicular points table-right, but the camera sits
         * behind the cue ball looking down the shot, so its own right hand is
         * the *opposite* way: projecting the plain vector onto the camera's
         * right gives exactly −1 at every aim angle. Without the flip, sliding
         * the thumb right marks the left of the ball and puts the opposite
         * english on the shot from the one you asked for.
         */
        const acrossX = -Math.cos(heading);
        const acrossZ = Math.sin(heading);

        /*
         * Following the curve of the ball, not floating in front of it.
         *
         * A fixed distance along the cue's axis would leave the mark hanging in
         * space at full english — 36 mm out from the centre of a 28.6 mm ball.
         * The ball is a sphere, so how far forward the contact point sits
         * *depends* on how far off centre it is: `√(R² − offset²)` is exactly
         * that, and it is the same sum the solver does to work out where the tip
         * actually strikes.
         *
         * Then a hair further out, because a mark placed exactly on the surface
         * fights with it for the same pixels.
         */
        const reach = BALL_RADIUS * 0.72;
        const offX = spin.side * reach;
        const offY = spin.vertical * reach;
        const depth = Math.sqrt(Math.max(0, BALL_RADIUS * BALL_RADIUS - offX * offX - offY * offY));
        const lift = depth + BALL_RADIUS * 0.05;

        spinTarget.current.position.set(
          sceneX(cue.p) + backX * lift + acrossX * offX,
          BALL_HEIGHT + backY * lift + offY,
          sceneZ(cue.p) + backZ * lift + acrossZ * offX,
        );
        // Square to the eye, so the ring reads as a circle rather than an
        // ellipse however the camera is tilted.
        spinTarget.current.lookAt(camera.position);
      }
    }

    /*
     * The reference frame: a cross and an outer circle, fixed to the ball.
     *
     * Deliberately *not* part of the group above. That group tracks the contact
     * point, so anything inside it moves with the english — and a scale that
     * moves with the thing it is measuring tells you nothing. Held at the centre
     * of the near face instead, the cross reads as centre-ball and the circle as
     * the edge, which is what turns the red dot from a floating spot into a
     * position you can judge: half way to the rim, a touch above the equator.
     */
    if (spinFrame.current) {
      const showFrame = useSwing.getState().charging && showSpinTarget;
      spinFrame.current.visible = showFrame;

      if (showFrame) {
        // Towards the eye, for the same reason as the mark it measures: any
        // other axis and the two stop being concentric the moment the camera
        // is not level with the ball.
        const eyeX = camera.position.x - sceneX(cue.p);
        const eyeY = camera.position.y - BALL_HEIGHT;
        const eyeZ = camera.position.z - sceneZ(cue.p);
        const eyeLen = Math.hypot(eyeX, eyeY, eyeZ) || 1;
        const lift = BALL_RADIUS + BALL_RADIUS * 0.05;

        spinFrame.current.position.set(
          sceneX(cue.p) + (eyeX / eyeLen) * lift,
          BALL_HEIGHT + (eyeY / eyeLen) * lift,
          sceneZ(cue.p) + (eyeZ / eyeLen) * lift,
        );
        spinFrame.current.lookAt(camera.position);
      }
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
      if (showAimGuide) {
        /*
         * Trimmed by a ball radius when the line ends on a ghost, so the dashes
         * stop at the edge of the ring instead of crossing it. A line that ends
         * in open cloth has nothing to keep clear of, so it runs the whole way.
         */
        const endsOnGhost = prediction.targetBall !== null;
        layoutDashes(
          guideLine.current,
          cueX,
          cueZ,
          stopX,
          stopZ,
          GUIDE_Y,
          scratch,
          scratchColour,
          endsOnGhost ? BALL_RADIUS : 0,
        );
      } else {
        guideLine.current.visible = false;
      }
    }

    const showGhost = showAimGuide && prediction.targetBall !== null;

    if (ghostBall.current) {
      ghostBall.current.visible = showGhost;
      // Flat on the cloth, not at the ball's centre: it marks a place on the
      // table now, not a sphere standing in for a ball.
      if (showGhost) ghostBall.current.position.set(stopX, GUIDE_Y * 0.12, stopZ);
    }

    if (targetLine.current) {
      const target = prediction.targetBall !== null ? world.ballByNumber(prediction.targetBall) : undefined;
      if (showGhost && target && prediction.targetDirection) {
        const tip = {
          x: target.p.x + prediction.targetDirection.x * TARGET_LINE_LENGTH,
          y: target.p.y + prediction.targetDirection.y * TARGET_LINE_LENGTH,
        };
        /*
         * Dashed like the line before it, and started clear of the ghost.
         *
         * It begins at the struck ball's centre, which sits under the ghost
         * ring — so without the offset its first dashes are drawn inside the
         * circle, which is exactly what the near line is trimmed to avoid. One
         * radius of lead-in starts it at the ring's edge instead.
         *
         * Brighter than the approach line because it is the answer: where the
         * ball you are aiming at actually goes.
         */
        layoutDashes(
          targetLine.current,
          sceneX(target.p),
          sceneZ(target.p),
          sceneX(tip),
          sceneZ(tip),
          GUIDE_Y,
          scratch,
          scratchColour,
          0,
          BALL_RADIUS,
          0.35,
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

        White is the colour of the cue ball, so a white line leaving a white ball
        read as part of it. Gold is what this app uses for the thing you are
        about to do, and on green baize it separates cleanly from both the cloth
        and the balls.

        Additive and depth-write off, like the trail: these are marks of light
        laid over the table, not objects standing on it, and writing depth let
        them z-fight with the cloth at glancing angles.
      */}
      <instancedMesh ref={guideLine} args={[undefined, undefined, MAX_DASHES]} frustumCulled={false}>
        <circleGeometry args={[DASH_LENGTH / 2, 12]} />
        <meshBasicMaterial
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>

      {/*
        The ghost ball, as a ring rather than a solid sphere.

        A translucent white sphere sitting on the object ball hid the ball it was
        pointing at — worst of all at close range, where the two coincide and the
        guide appeared to stop working. A thin ring drawn flat on the cloth marks
        the same contact point while leaving everything behind it visible.
      */}
      {/*
        A filled disc, not a hollow ring.
        
        The ring left its middle empty, so anything drawn underneath showed
        through it — the dashed line most of all, which ran straight across the
        circle and turned the marker into a target with a line through it.
        Filled from the centre out, the disc covers what passes behind it.

        One flat colour, edge and middle alike, so it reads as a single token
        rather than as a ring with something inside it. A translucent disc still
        let the dots show through — fainter, but a marker you can see the line
        through is a marker with a line through it.

        Solid rather than additive for the same reason: additive blending *adds*
        to what is already there and can never hide it, however opaque the
        material claims to be. This one paints over instead.
      */}
      <mesh ref={ghostBall} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[BALL_RADIUS, 28]} />
        <meshBasicMaterial
          color={PREDICTION_COLOR}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Where the struck ball goes: brighter, because it is the answer. */}
      {/*
        The contact target: a ring with a dot in it, drawn on the cue ball.

        A ring rather than a filled spot, because the ring is what says *where on
        the ball* while the dot says *exactly here* — together they read as a
        sight rather than as a smudge. Both in the aiming gold, unlit and
        depth-free, so they sit on the ball rather than being part of it.
      */}
      {/*
        The reference frame the dot is read against: a hairline circle and cross.

        One pixel wide, near enough — the rim marks the edge of the ball and the
        cross marks its centre, and both are there to be measured against rather
        than looked at. Anything heavier competes with the dot it exists to
        locate. Drawn in the aiming gold rather than the dot's red so the two
        never read as one mark: gold is the scale, red is the answer.

        The cross is two thin planes rather than lines, because a `lineWidth`
        above 1 is silently ignored on most platforms — a plane is the only way
        to be sure of the weight.
      */}
      <group ref={spinFrame} visible={false}>
        <mesh>
          <ringGeometry args={[BALL_RADIUS * 0.97, BALL_RADIUS, 40]} />
          <meshBasicMaterial
            color={GUIDE_COLOR}
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <planeGeometry args={[BALL_RADIUS * 1.94, BALL_RADIUS * 0.02]} />
          <meshBasicMaterial
            color={GUIDE_COLOR}
            transparent
            opacity={0.45}
            side={THREE.DoubleSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <planeGeometry args={[BALL_RADIUS * 0.02, BALL_RADIUS * 1.94]} />
          <meshBasicMaterial
            color={GUIDE_COLOR}
            transparent
            opacity={0.45}
            side={THREE.DoubleSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/*
        The contact point: a small black cross, not a ring.

        A cross marks a point; a ring encloses a region. This is a position —
        exactly where the tip lands — so the mark that says "here, at the
        crossing" is the honest one, and it stops competing with the reference
        circle, which is a ring and is meant to be.

        Small on purpose. It sits inside the reference frame rather than filling
        it, so there is always visible ball between the mark and the rim for the
        eye to judge the offset by; a large mark at full english touches the rim
        and the reading is lost.
      */}
      <group ref={spinTarget} visible={false}>
        <mesh>
          <planeGeometry args={[BALL_RADIUS * 0.34, BALL_RADIUS * 0.035]} />
          <meshBasicMaterial
            color={TARGET_COLOR}
            transparent
            opacity={0.95}
            side={THREE.DoubleSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <planeGeometry args={[BALL_RADIUS * 0.035, BALL_RADIUS * 0.34]} />
          <meshBasicMaterial
            color={TARGET_COLOR}
            transparent
            opacity={0.95}
            side={THREE.DoubleSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      </group>

      <instancedMesh ref={targetLine} args={[undefined, undefined, MAX_DASHES]} frustumCulled={false}>
        <circleGeometry args={[DASH_LENGTH * 0.62, 12]} />
        <meshBasicMaterial
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
}
