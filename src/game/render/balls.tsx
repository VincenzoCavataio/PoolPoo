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
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { BallKind } from '@/game/core/ball';
import { ballSetById, colorForBallIn, type BallSet } from '@/constants/ball-sets';
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

  const ballSetId = useSettings((s) => s.ballSetId);
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

  useFrame((_, delta) => {
    const mesh = ballsRef.current;
    const shadows = shadowsRef.current;
    if (!mesh || !shadows) return;

    const { object, axis, spin } = scratch;

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

        object.scale.setScalar(resting ? 1 : 0);
        object.quaternion.copy(orientations[index]);
        object.position.set(
          fall.started ? fall.x : (resting?.[0] ?? 0),
          fall.started ? fall.y : floor,
          fall.started ? fall.z : (resting?.[1] ?? 0),
        );
        object.updateMatrix();
        mesh.setMatrixAt(index, object.matrix);

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
  });

  return (
    <group>
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
