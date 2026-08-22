/**
 * All sixteen balls in two draw calls.
 *
 * One `InstancedMesh` for the balls and one for their contact shadows. The
 * markings come from a small patch to the standard material: a per-instance
 * style flag plus the vertex's own latitude gives striped balls a coloured band
 * with white poles, and solid balls the white number badge. Because the pattern
 * is evaluated in the ball's object space it rolls with the ball. The
 * alternative was sixteen textures, which would have meant sixteen materials
 * and sixteen draw calls.
 *
 * Nothing here reads React state. Positions are pulled straight from the
 * mutable world each frame, so a shot animates without a single re-render.
 */

import { useFrame } from '@react-three/fiber/native';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { BallKind } from '@/game/core/ball';
import { ballSetById, colorForBallIn, type BallSet } from '@/constants/ball-sets';
import { useSession } from '@/store/session';
import { loadById } from '@/constants/quality';
import { useSettings } from '@/store/settings';
import { BALL_RADIUS, PHYSICS } from '@/game/core/constants';
import type { World } from '@/game/core/world';

import { createNumberAtlas, NUMBER_ATLAS_GRID } from './ball-numbers';
import {
  BALL_HEIGHT,
  POCKET_DEPTH,
  sceneX,
  sceneZ,
  spinAxis,
  SPOT_RADIUS,
  spinRate,
} from './coords';

/**
 * Reference height for how far a ball's shadow pulls away from it. Not a limit —
 * balls can and do go higher than this — just the height at which the shadow has
 * drifted as far as it is going to.
 */
const SHADOW_SPREAD_AT = BALL_RADIUS;

/** Style codes handed to the shader per instance. */
const STYLE_PLAIN = 0;
const STYLE_SOLID = 1;
const STYLE_STRIPE = 2;

/** Latitude above which a striped ball turns white. */
const STRIPE_LATITUDE = 0.52;
/** Latitude above which a solid ball shows its number badge. */
const BADGE_LATITUDE = 0.86;

const SHADOW_ALPHA = 0.4;

/**
 * How fast a ball has to be going before it leaves anything behind.
 *
 * A ball at rest, or rolling gently into position, leaves nothing: a trail on
 * everything that moves would be decoration, and what makes this read as speed
 * is that it appears only when there is speed to read.
 *
 * 1.2 m/s is about the pace of a firm positional roll, so ordinary play stays
 * clean and a struck ball streaks.
 */
const TRAIL_FROM = 1.2;

/**
 * How many ghosts follow a ball.
 *
 * Recorded positions rather than a stretched shape, so a ball coming off a
 * cushion leaves a trail that turns with it instead of a straight smear through
 * the rail.
 *
 * Five. The length is whatever the ball covered in that many frames, so the
 * count sets it: at six a break-speed ball dragged a tail more than half a metre
 * long — nine ball widths, a comet rather than a cue ball — while four left too
 * few ghosts to read as a streak at all.
 */
const TRAIL_LENGTH = 5;

/**
 * Brightness of the ghost nearest the ball; the rest fade away behind it.
 *
 * Raised from 0.45, and the falloff straightened out at the same time. With a
 * squared ramp across four ghosts the nearest one came out at *zero* and the
 * next at five per cent, so the whole effect was a single faint smudge and the
 * trail could not be seen at all. Linear from a floor keeps every ghost visible
 * and still fades to nothing at the tail.
 */
const TRAIL_ALPHA = 0.7;

/** The faintest a ghost is drawn, so the far end of the tail still shows. */
const TRAIL_MIN = 0.12;

/**
 * How much light reaches a ball at the bottom of a pocket.
 *
 * Not zero: a pocket is open at the top, so there is some spill and a ball that
 * vanished completely would look like it had been deleted rather than dropped.
 * An eighth is enough to make out the colour of what went down without the ball
 * reading as lit.
 */
const POCKET_SHADE = 0.13;

/** How narrow the tail end of the ribbon is, as a fraction of its head. */
const TRAIL_TAPER = 0.25;

/**
 * How high the ribbon floats above the cloth.
 *
 * Just clear of it. Flat on the baize would z-fight with the cloth; any higher
 * and the streak visibly hovers above the ball it belongs to.
 */
const TRAIL_Y = 0.0016;

/**
 * The cue ball's spot markings.
 *
 * A plain white sphere gives the eye nothing to track, so all the spin work in
 * the solver — draw, follow, english — was invisible: the ball simply slid
 * about. Six red spots on the cardinal axes fix that. Six rather than one so
 * there is always at least one in view whichever way the ball is facing, and on
 * the axes so the direction of the turn reads directly.
 *
 * This is what a measuring cue ball actually looks like, so it is not only
 * legible but the right kind of object to be looking at.
 */
/**
 * Spot colour, in linear space — which is why the numbers look darker than the
 * red they produce.
 *
 * The previous value came out at sRGB 229,101,105: a salmon pink rather than a
 * red. Filmic tone mapping pulls saturation out of bright colours, so a spot has
 * to start further into the corner of the gamut than seems necessary to land on
 * a convincing red once it reaches the screen.
 */
const SPOT_COLOR = 'vec3(0.95, 0.035, 0.03)';

/**
 * Half-width of the badge cap measured across the ball. A point at latitude
 * `BADGE_LATITUDE` sits this far from the pole in the x–z plane, so it is the
 * scale that maps the cap onto the atlas cell.
 */
const BADGE_EXTENT = Math.sqrt(1 - BADGE_LATITUDE * BADGE_LATITUDE);

function createBallMaterial(numbers: THREE.Texture, set: BallSet): THREE.MeshPhysicalMaterial {
  // A pool ball is pigment under a thick polished lacquer, which is exactly what
  // a clearcoat layer models: a second, much sharper specular response sitting on
  // top of the base colour. It is also what makes the ball pick up the room.
  //
  // The numbers come from the chosen set, so a glassy phenolic ball and an old
  // clay one answer the lamps differently rather than being the same object in
  // different colours.
  const material = new THREE.MeshPhysicalMaterial({
    roughness: set.surface.roughness,
    metalness: 0,
    clearcoat: set.surface.clearcoat,
    clearcoatRoughness: set.surface.clearcoatRoughness,
    envMapIntensity: set.surface.envMapIntensity,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNumbers = { value: numbers };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aStyle;
        attribute float aNumber;
        varying float vStyle;
        varying float vNumber;
        varying vec3 vBallNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vStyle = aStyle;
        vNumber = aNumber;
        vBallNormal = normalize(position);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uNumbers;
        varying float vStyle;
        varying float vNumber;
        varying vec3 vBallNormal;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        /**
         * Re-normalise per fragment.
         *
         * The vertex stage hands over a unit vector, but interpolating across a
         * triangle shortens it towards the middle of each face — so a threshold
         * on its components follows the mesh rather than the sphere. On a 24x18
         * ball a spot spans barely one quadrilateral, which was enough to make
         * the spots come out faceted instead of round. One normalize here fixes
         * the shape exactly, and costs nothing next to raising the tessellation
         * of sixteen instanced balls.
         */
        vec3 ballNormal = normalize(vBallNormal);
        float latitude = abs(ballNormal.y);
        vec3 markingColor = vec3(0.94, 0.93, 0.89);

        // Stripes: coloured band round the equator, white towards the poles.
        if (vStyle > 1.5 && latitude > ${STRIPE_LATITUDE.toFixed(3)}) {
          diffuseColor.rgb = markingColor;
        }

        // The cue ball: red spots at both ends of all three axes. The ball
        // normal is this fragment's direction from the centre in the ball's own
        // frame, so a spot is simply "close to an axis", and the ball's own
        // rotation carries the spots round with it for free.
        if (vStyle < 0.5) {
          float onAxis = max(max(abs(ballNormal.x), abs(ballNormal.y)), abs(ballNormal.z));
          /**
           * Antialiased edge, so the spots stay clean when the ball is only a few
           * pixels across and when it is spinning fast.
           *
           * The band has to scale with the spot. It was a fixed 0.02 either side,
           * which is wider than the spot itself now — the edge would have eaten
           * the whole marking and left a faint smudge.
           */
          float spot = smoothstep(
            ${(1 - SPOT_RADIUS * 1.35).toFixed(5)},
            ${(1 - SPOT_RADIUS * 0.65).toFixed(5)},
            onAxis
          );
          diffuseColor.rgb = mix(diffuseColor.rgb, ${SPOT_COLOR}, spot);
        }

        // Every numbered ball carries the white badge at both poles, with its
        // number inside. The x flip by sign(y) keeps the digits from reading
        // mirrored on the far side of the ball.
        if (vStyle > 0.5 && latitude > ${BADGE_LATITUDE.toFixed(3)}) {
          diffuseColor.rgb = markingColor;

          vec2 capPosition = vec2(ballNormal.x * sign(ballNormal.y), ballNormal.z);
          vec2 cellUv = capPosition / ${BADGE_EXTENT.toFixed(4)} * 0.5 + 0.5;

          if (cellUv.x > 0.0 && cellUv.x < 1.0 && cellUv.y > 0.0 && cellUv.y < 1.0) {
            float column = mod(vNumber, ${NUMBER_ATLAS_GRID.toFixed(1)});
            float row = floor(vNumber / ${NUMBER_ATLAS_GRID.toFixed(1)});
            vec2 atlasUv = (cellUv + vec2(column, row)) / ${NUMBER_ATLAS_GRID.toFixed(1)};

            // The atlas holds a distance field: 0.5 is the edge of the stroke,
            // so one smoothstep recovers a clean edge at any size on screen.
            float field = texture2D(uNumbers, atlasUv).a;
            float coverage = smoothstep(0.46, 0.56, field);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.05, 0.06), coverage);
          }
        }`,
      );
  };

  return material;
}

/**
 * A flat disc whose alpha fades from the centre to the rim, giving a soft
 * shadow without a custom shader: three.js reads a four-component colour
 * attribute as colour plus alpha, and that works under instancing.
 */
function createShadowGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.CircleGeometry(BALL_RADIUS * 1.35, 20);
  geometry.rotateX(-Math.PI / 2);

  const vertices = geometry.attributes.position.count;
  const colors = new Float32Array(vertices * 4);
  for (let i = 0; i < vertices; i++) {
    // Vertex 0 is the centre of a CircleGeometry; the rest form the rim.
    colors[i * 4 + 3] = i === 0 ? SHADOW_ALPHA : 0;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  return geometry;
}

function styleFor(kind: BallKind): number {
  if (kind === BallKind.CUE) return STYLE_PLAIN;
  return kind === BallKind.STRIPE ? STYLE_STRIPE : STYLE_SOLID;
}

export function Balls({ world }: { world: World }) {
  const count = world.balls.length;
  const ballsRef = useRef<THREE.InstancedMesh>(null);
  const shadowsRef = useRef<THREE.InstancedMesh>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);

  /**
   * The ribbon's quad, laid flat once.
   *
   * A plane stands upright in XY by default, so without this every segment
   * would be a little wall along the ball's path. Rotating the geometry rather
   * than each instance means the per-frame matrix only ever carries the heading
   * the segment actually needs.
   */
  const trailGeometry = useCallback((geometry: THREE.PlaneGeometry | null) => {
    geometry?.rotateX(-Math.PI / 2);
  }, []);

  /**
   * The last few positions of every ball, oldest first.
   *
   * A ring would save the shifting, but at six entries a copy is cheaper than
   * the arithmetic to avoid it, and this way the array is already in draw order.
   */
  const history = useMemo(
    () =>
      Array.from({ length: count }, () =>
        Array.from({ length: TRAIL_LENGTH }, () => ({ x: 0, y: 0, z: 0, live: false })),
      ),
    [count],
  );

  const ballSetId = useSettings((s) => s.ballSetId);
  /*
   * The trail needs both the player's preference and the workload's permission.
   *
   * Two different questions — *do I want to see this* and *can this phone
   * afford it* — and the answer to either being no is enough. Combined here
   * rather than by the preset overwriting the setting, so a player who turns
   * trails off keeps them off when they change preset, and one who likes them
   * gets them back on a heavier one without having to remember to re-enable
   * anything.
   */
  const wantsTrail = useSettings((s) => s.motionTrail);
  const trailsAffordable = loadById(useSettings((s) => s.load)).ballTrails;
  const showTrail = wantsTrail && trailsAffordable;

  /**
   * Instances the trail needs: every ball's ghosts, all in one mesh.
   *
   * Allocated for the worst case rather than grown, because an instanced mesh
   * cannot be resized without rebuilding it, and rebuilding one mid-break is the
   * kind of hitch this effect exists to avoid.
   */
  // One segment per gap between recorded positions, so one fewer than the
  // ghosts a per-position trail would have needed.
  const trailCount = count * (TRAIL_LENGTH - 1);
  const set = useMemo(() => ballSetById(ballSetId), [ballSetId]);

  const numbers = useMemo(createNumberAtlas, []);
  // Rebuilt when the set changes: the surface is baked into the material, so a
  // new set is a new material rather than a uniform to poke.
  const material = useMemo(() => createBallMaterial(numbers, set), [numbers, set]);
  const shadowGeometry = useMemo(createShadowGeometry, []);

  useEffect(() => () => numbers.dispose(), [numbers]);

  /** Where a potted ball comes to rest, by pocket id. */
  const pocketRest = useMemo(() => {
    const resting = new Map<string, [number, number]>();
    for (const pocket of world.table.pockets) {
      resting.set(pocket.id, [sceneX(pocket.center), sceneZ(pocket.center)]);
    }
    return resting;
  }, [world]);

  /** How far a ball's centre can stray inside each pocket before it hits wall. */
  const pocketLimit = useMemo(() => {
    const limits = new Map<string, number>();
    for (const pocket of world.table.pockets) {
      limits.set(pocket.id, Math.max(0.004, pocket.radius - BALL_RADIUS));
    }
    return limits;
  }, [world]);

  const scratch = useMemo(
    () => ({
      object: new THREE.Object3D(),
      axis: new THREE.Vector3(),
      spin: new THREE.Quaternion(),
      color: new THREE.Color(),
    }),
    [],
  );
  const orientations = useMemo(
    () => Array.from({ length: count }, () => new THREE.Quaternion()),
    [count],
  );

  /**
   * The drop into the pocket, integrated here rather than in the solver.
   *
   * The solver's job ends the instant a ball is captured — it has left the
   * table and no rule cares where it is afterwards. But cutting the motion dead
   * at that moment looks broken, so the ball keeps the velocity it arrived with,
   * gains gravity, is funnelled towards the middle of the pocket by the liner
   * and lands on the bed.
   */
  const falls = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        started: false,
        done: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        axis: new THREE.Vector3(),
        rate: 0,
      })),
    [world, count],
  );

  useLayoutEffect(() => {
    const mesh = ballsRef.current;
    if (!mesh) return;

    const styles = new Float32Array(count);
    const numberIds = new Float32Array(count);
    world.balls.forEach((ball, index) => {
      // A set without stripes draws every object ball as a solid, which is the
      // one change here that alters how the table reads rather than how it looks.
      const kind =
        !set.striped && ball.kind === BallKind.STRIPE ? BallKind.SOLID : ball.kind;
      styles[index] = styleFor(kind);
      numberIds[index] = ball.number;
      mesh.setColorAt(index, scratch.color.set(colorForBallIn(set, ball.number)));
    });

    mesh.geometry.setAttribute('aStyle', new THREE.InstancedBufferAttribute(styles, 1));
    mesh.geometry.setAttribute('aNumber', new THREE.InstancedBufferAttribute(numberIds, 1));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [world, count, scratch, set]);

  useFrame((_, frameDelta) => {
    const mesh = ballsRef.current;
    const shadows = shadowsRef.current;
    if (!mesh || !shadows) return;

    /**
     * Render time, on the same clock as the world being drawn.
     *
     * Everything below advances something over time — how far a ball has turned,
     * how far it has dropped into a pocket — and all of it used the wall-clock
     * frame delta. That is right while the shot is live, because the solver is
     * stepping in real time too. It is wrong during a replay, which runs the
     * world at a fraction of speed on purpose: the ball drifted to the pocket in
     * slow motion and then fell in at full speed, and spun at full speed the
     * whole way. Same shot, visibly different physics.
     *
     * Scaling by the same factor the store steps the world by puts them back on
     * one clock, so a replay is the shot slowed down rather than a different
     * thing happening.
     */
    const replay = useSession.getState().replay;
    /**
     * How fast the world being drawn is actually running, as a fraction of real
     * time. 1 during play, the replay's own speed during one.
     *
     * Everything below that advances over time uses it — how far a ball has
     * turned, and how far it is drawn out along its path — because both are
     * about distance covered between frames, and a replay covers less.
     */
    const rate = replay ? replay.speed : 1;

    const delta = frameDelta * rate;

    const { object, axis, spin, color } = scratch;

    for (let index = 0; index < count; index++) {
      const ball = world.balls[index];

      if (ball.pocketed) {
        const resting = ball.pocketedIn ? pocketRest.get(ball.pocketedIn) : undefined;
        const fall = falls[index];

        if (!fall.started && resting) {
          fall.started = true;
          fall.done = false;
          fall.x = sceneX(ball.p);
          fall.z = sceneZ(ball.p);
          fall.y = BALL_HEIGHT;
          // Sim velocity (x, y) maps to the scene as (y, −x).
          fall.vx = ball.v.y;
          fall.vz = -ball.v.x;
          fall.vy = 0;
          const [ax, ay, az] = spinAxis(ball.w);
          fall.axis.set(ax, ay, az);
          fall.rate = spinRate(ball.w);
        }

        const floor = -POCKET_DEPTH + BALL_RADIUS;

        if (fall.started && !fall.done && resting) {
          fall.vy -= 9.81 * delta;
          fall.vx *= Math.max(0, 1 - 1.4 * delta);
          fall.vz *= Math.max(0, 1 - 1.4 * delta);

          fall.x += fall.vx * delta;
          fall.y += fall.vy * delta;
          fall.z += fall.vz * delta;

          /*
           * The ball is inside a hole, so the hole has to hold it.
           *
           * Capture happens while it is still travelling — often at several
           * metres a second — and without walls it simply carried that speed
           * across the room. Bouncing it off the liner is both what stops that
           * and what makes it rattle down the throat instead of dropping on a
           * rail.
           */
          const limit = pocketLimit.get(ball.pocketedIn ?? '') ?? 0.03;
          const offsetX = fall.x - resting[0];
          const offsetZ = fall.z - resting[1];
          const offset = Math.hypot(offsetX, offsetZ);

          if (offset > limit) {
            const nx = offsetX / offset;
            const nz = offsetZ / offset;
            fall.x = resting[0] + nx * limit;
            fall.z = resting[1] + nz * limit;

            const into = fall.vx * nx + fall.vz * nz;
            if (into > 0) {
              // Reflect the component going into the wall, keep the rest.
              fall.vx -= nx * into * 1.55;
              fall.vz -= nz * into * 1.55;
            }
          }

          if (fall.y <= floor) {
            fall.y = floor;
            if (Math.abs(fall.vy) > 0.45) {
              fall.vy = -fall.vy * 0.25;
            } else {
              fall.vy = 0;
              fall.vx *= 0.4;
              fall.vz *= 0.4;
              if (Math.hypot(fall.vx, fall.vz) < 0.03) fall.done = true;
            }
          }

          if (fall.rate > 0) {
            spin.setFromAxisAngle(fall.axis, fall.rate * delta);
            orientations[index].premultiply(spin);
            fall.rate *= Math.max(0, 1 - 1.6 * delta);
          }
        }

        const fallY = fall.started ? fall.y : floor;
        object.scale.setScalar(resting ? 1 : 0);
        object.quaternion.copy(orientations[index]);
        object.position.set(
          fall.started ? fall.x : (resting?.[0] ?? 0),
          fallY,
          fall.started ? fall.z : (resting?.[1] ?? 0),
        );
        object.updateMatrix();
        mesh.setMatrixAt(index, object.matrix);

        /*
         * Darkened as it drops, because a pocket is a hole.
         *
         * The lamp is above the table and the ball is now under the slate, so
         * almost nothing reaches it — but the scene lights do not know that: the
         * cavity is open geometry with no occluder in it, so a ball at the
         * bottom of a pocket was lit exactly as brightly as one on the cloth and
         * sat there glowing in what should be the darkest part of the table.
         *
         * Scaled by depth rather than switched at the lip, so the ball dims as
         * it falls the way it would going out of the light.
         */
        const depth = Math.min(1, Math.max(0, (BALL_HEIGHT - fallY) / POCKET_DEPTH));
        color.set(colorForBallIn(set, ball.number));
        color.multiplyScalar(1 - depth * (1 - POCKET_SHADE));
        mesh.setColorAt(index, color);

        object.scale.setScalar(0);
        object.updateMatrix();
        shadows.setMatrixAt(index, object.matrix);
        continue;
      }

      // Back on the table — a respot, or a new rack.
      if (falls[index].started) {
        falls[index].started = false;
        falls[index].done = false;
      }

      /*
       * Full brightness again, which the pocket shading above would otherwise
       * never give back.
       *
       * A respotted cue ball, or the fourteen coming out of a re-rack, would
       * arrive on the cloth still carrying whatever darkness they had at the
       * bottom of the pocket — and nothing would ever lighten them, because the
       * effect that sets the colours only runs when the table is rebuilt.
       */
      color.set(colorForBallIn(set, ball.number));
      mesh.setColorAt(index, color);

      // Turned by its own angular velocity, not inferred from how fast it is
      // travelling: a ball with draw on it slides one way while spinning the
      // other, and inferring the spin drew that as a ball rolling forwards.
      const rate = spinRate(ball.w);
      if (rate > 0) {
        const [ax, ay, az] = spinAxis(ball.w);
        axis.set(ax, ay, az);
        spin.setFromAxisAngle(axis, rate * delta);
        orientations[index].premultiply(spin);
      }

      object.scale.setScalar(1);
      object.position.set(sceneX(ball.p), BALL_HEIGHT + ball.z, sceneZ(ball.p));
      object.quaternion.copy(orientations[index]);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);

      /**
       * The shadow stays on the cloth, and that is what sells a hop.
       *
       * A ball a few millimetres up is barely displaced on screen — far too
       * little to read on its own. What the eye actually notices is the ball
       * separating from its shadow, so the shadow slides further out as the
       * ball rises (the lamps are high but not directly overhead) and tightens
       * a little. Without this the hop is invisible; with it, a 4 mm skip is
       * obvious.
       */
      object.quaternion.identity();
      // A ball on the floor is not casting anything onto the cloth.
      if (ball.offTable) {
        object.scale.setScalar(0);
        object.position.set(0, -1, 0);
        object.updateMatrix();
        shadows.setMatrixAt(index, object.matrix);
        continue;
      }
      const drift = 0.008 + ball.z * 0.35;
      object.scale.setScalar(1 - Math.min(0.4, (ball.z / SHADOW_SPREAD_AT) * 0.4));
      object.position.set(sceneX(ball.p) + drift, 0.0025, sceneZ(ball.p) + drift);
      object.updateMatrix();
      shadows.setMatrixAt(index, object.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    shadows.instanceMatrix.needsUpdate = true;
    // The pocket shading is written per frame, so the colours have to be
    // uploaded per frame too — the effect that sets them only runs on a rerack.
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    /*
     * The trail, drawn as ghosts of where the ball has been.
     *
     * Written after the balls so it reads the same positions they were drawn
     * at. Every ghost of every ball shares one instanced mesh — the whole effect
     * is a single draw call, which is what makes it affordable on a phone that
     * is already drawing balls, shadows and a room.
     */
    const trail = trailRef.current;
    if (trail) {
      let slot = 0;

      for (let index = 0; index < count; index++) {
        const ball = world.balls[index];
        const past = history[index];
        const moving = !ball.pocketed && !ball.offTable;
        const speed = moving ? Math.hypot(ball.v.x, ball.v.y) * rate : 0;

        // Shift the record along and put the current position on the end.
        for (let i = 0; i < TRAIL_LENGTH - 1; i++) {
          past[i].x = past[i + 1].x;
          past[i].y = past[i + 1].y;
          past[i].z = past[i + 1].z;
          past[i].live = past[i + 1].live;
        }
        const head = past[TRAIL_LENGTH - 1];
        head.x = sceneX(ball.p);
        head.y = BALL_HEIGHT + ball.z;
        head.z = sceneZ(ball.p);
        // Only fast enough positions are worth trailing from, so a ball that
        // slows stops feeding the record and the trail runs out behind it.
        head.live = showTrail && speed > TRAIL_FROM;

        if (!showTrail) continue;

        /*
         * One flat segment per gap between recorded positions, joined end to
         * end into a ribbon.
         *
         * It was a row of spheres, which is what a trail looks like when it is
         * made of balls: you could count them. A quad stretched between each
         * pair of positions reads as one continuous streak instead, and because
         * the positions are the ball's real path the ribbon bends with it round
         * a cushion.
         *
         * Laid flat on the cloth rather than upright, so it is a smear of light
         * on the baize rather than a wall standing in the room.
         */
        for (let i = 0; i < TRAIL_LENGTH - 1; i++) {
          if (!past[i].live || !past[i + 1].live || slot >= trailCount) continue;

          const ax = past[i].x;
          const az = past[i].z;
          const bx = past[i + 1].x;
          const bz = past[i + 1].z;

          const dx = bx - ax;
          const dz = bz - az;
          const span = Math.hypot(dx, dz);
          if (span < 1e-4) continue;

          // 0 at the tail, 1 at the segment nearest the ball.
          const age = i / (TRAIL_LENGTH - 2 || 1);

          object.quaternion.identity();
          object.position.set((ax + bx) / 2, TRAIL_Y, (az + bz) / 2);
          object.rotation.set(0, Math.atan2(dx, dz), 0);
          // Narrower towards the tail, so the streak comes to a point rather
          // than ending in a squared-off stub.
          object.scale.set(TRAIL_TAPER + (1 - TRAIL_TAPER) * age, 1, span);
          object.updateMatrix();
          trail.setMatrixAt(slot, object.matrix);

          /*
           * The ball's own colour, dimmed towards the tail.
           *
           * Dimming the colour rather than the opacity: these are drawn additive
           * against a dark room, so a darker colour *is* a fainter part of the
           * streak, and it saves sorting a pile of overlapping transparent
           * quads.
           */
          color.set(colorForBallIn(set, ball.number));
          color.multiplyScalar(TRAIL_MIN + (TRAIL_ALPHA - TRAIL_MIN) * age);
          trail.setColorAt(slot, color);
          slot++;
        }
      }

      // Everything unused is parked at zero size rather than left where it was
      // last frame, which is what would otherwise strand a ghost mid-table.
      for (let i = slot; i < trailCount; i++) {
        object.scale.setScalar(0);
        object.position.set(0, -1, 0);
        object.updateMatrix();
        trail.setMatrixAt(i, object.matrix);
      }

      trail.count = trailCount;
      trail.instanceMatrix.needsUpdate = true;
      if (trail.instanceColor) trail.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {/*
        The trail, behind everything and lighting rather than occluding.

        Additive and depth-write off: a ghost is a smear of light where a ball
        was, not an object in the room, and writing depth would let it hide the
        ball it belongs to.
      */}
      <instancedMesh ref={trailRef} args={[undefined, undefined, trailCount]} frustumCulled={false}>
        {/*
          A unit quad lying on the cloth, scaled to span each gap.

          Two triangles per segment instead of a 12x8 sphere: the ribbon is both
          cheaper than the row of balls it replaces and the thing that was
          actually wanted.
        */}
        <planeGeometry args={[BALL_RADIUS * 1.7, 1]} ref={trailGeometry} />
        {/*
          No `vertexColors` here, and that is the whole reason the trail was
          invisible.

          `vertexColors` tells the shader to read a `color` attribute off the
          *geometry* — which the shadow quad next door does define, and a plain
          sphere does not. The shader then sampled an attribute that was not
          there, every ghost came out black, and black added to a dark room is
          nothing at all. Per-instance colours set with `setColorAt` need no flag
          at all: three.js compiles them in when `instanceColor` exists.
        */}
        <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>

      <instancedMesh ref={shadowsRef} args={[shadowGeometry, undefined, count]} frustumCulled={false}>
        <meshBasicMaterial color="#000000" transparent depthWrite={false} vertexColors />
      </instancedMesh>

      <instancedMesh
        ref={ballsRef}
        args={[undefined, undefined, count]}
        material={material}
        frustumCulled={false}>
        <sphereGeometry args={[BALL_RADIUS, 24, 18]} />
      </instancedMesh>
    </group>
  );
}
