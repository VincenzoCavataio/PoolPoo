/**
 * The menus' backdrop: the actual table, in a dark room.
 *
 * A real scene rather than a suggestion of one. The renderer is already here and
 * the table already exists, so drawing the thing itself costs less invention
 * than any abstraction of it — and reads as the game rather than as decoration
 * that happens to be green.
 *
 * **The camera belongs to the navigation.** Each screen has its own framing, and
 * moving between screens moves the camera: the menu looks down the length of the
 * table, choosing players drops to the head where a rack would be set, dressing
 * the table swings across the cloth, and settings pulls back to take the whole
 * thing in. Going back reverses the move. That makes the backdrop part of how
 * the app is laid out rather than something playing behind it — you can tell
 * where you are with the text covered up.
 *
 * Between moves the camera drifts: a slow arc and a slow rise, on periods that
 * do not divide into each other, so the loop never visibly repeats.
 *
 * Deliberately unlit. The room's lamps are off; what light there is comes from
 * two dim sources placed low, which rakes the rails and leaves the middle of the
 * cloth in shadow. A menu has to stay legible over this.
 *
 * Cheap on purpose: no room, no furniture, no reflections, thirty frames a
 * second. It is behind a menu.
 */

import { Canvas, useFrame } from '@react-three/fiber/native';
import { usePathname } from 'expo-router';
import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import * as THREE from 'three';

import { currentTilt, useTilt } from '@/components/ui/floating';
import { playBallast, playSwitch } from '@/game/audio/sfx';
import { createTable } from '@/game/core/table';
import { useRoomLight } from '@/store/room-light';
import { createNumberAtlas, NUMBER_ATLAS_GRID } from '@/game/render/ball-numbers';
import { BALL_HEIGHT, sceneHeading, sceneX, sceneZ, SPOT_RADIUS } from '@/game/render/coords';
import { placeCues } from '@/components/ui/cue-placement';
import type { Table } from '@/game/core/table';
import { BALL_RADIUS } from '@/game/core/constants';
import { colorForBall } from '@/game/core/ball';
import { useBackdropLayout } from '@/store/backdrop-layout';
import { TableMesh } from '@/game/render/table-mesh';

interface Shot {
  /** Where the camera sits. */
  from: [number, number, number];
  /** What it points at. */
  look: [number, number, number];
  /** How far the idle drift swings it, in metres. */
  drift: number;
}

/**
 * One framing per screen.
 *
 * Each is chosen to say something about the screen it belongs to rather than
 * just to be different: the head of the table for choosing players, a low sweep
 * across the cloth for dressing it, a wide pull-back for settings.
 */
/**
 * The framings, one per screen.
 *
 * Each aims low. Dropping the look target lifts the table in the frame, which is
 * what keeps it clear of the panels: those sit at the foot of the screen, so the
 * scene has to live in the band above them rather than behind them. Roughly 70
 * points of lift at this field of view, scaled by how far each shot stands from
 * what it is looking at.
 */
const SHOTS: Record<string, Shot> = {
  /**
   * High and steeply down the length of the table. The establishing shot.
   *
   * Set back to 2.55m as well as raised: at 33 degrees the frame is only as wide
   * as its distance allows, and closer in the table's 1.27m width ran off both
   * sides. This is the nearest the camera gets while still holding the whole
   * table with a margin.
   */
  '/menu': { from: [0.1, 1.75, 2.55], look: [0, -0.28, -0.55], drift: 0.05 },

  /**
   * Low at the head, looking along the cloth. Where you break from.
   *
   * Aimed a little above the bed rather than level with it, so the light over
   * the table is in the frame. Dead level it was a handsome shot of a dark room
   * with the one thing lighting it just above the top edge.
   */
  /**
   * Under the light, looking up the table from one corner. Picking an opponent.
   *
   * The first step off the menu, so it has to move visibly or the screen change
   * reads as a swap of panels over a still photograph — which is what happened
   * while this route had no entry and fell through to the menu's own framing.
   *
   * It moves in and around rather than simply closer: off to the near-left
   * corner at head height, which swings the table diagonally across the frame.
   * A shot along the same axis as the one before it, only nearer, is a zoom, and
   * a zoom on a fixed subject is the one camera move that can be missed.
   */
  '/mode': { from: [-0.95, 0.95, 1.85], look: [0.15, 0.15, -0.5], drift: 0.045 },

  '/new-game': { from: [0.0, 0.12, 1.5], look: [0, 0.42, -0.6], drift: 0.03 },

  /**
   * Across the corner pocket at rail height. Sizing up who you are playing.
   *
   * Tight and low on the far side, so the frame is mostly rail and cloth with
   * the light burning at the top — the closest the camera comes to the table in
   * the menus, for the screen where the game stops being a number of players and
   * becomes named people.
   */
  '/difficulty': { from: [0.95, 0.42, -1.35], look: [-0.15, 0.4, 0.15], drift: 0.035 },

  /**
   * Side on and close, raking across the bed — the cloth fills the frame.
   *
   * Raised from 0.3m for the same reason as the shot above: from down at rail
   * height, tilted down, no part of the ceiling was ever in shot.
   */
  '/setup': { from: [1.45, 0.5, -0.35], look: [-0.3, 0.45, 0.1], drift: 0.045 },

  /** High and back over the far end, the whole table small in the frame. */
  '/options': { from: [-0.7, 1.65, -1.9], look: [0, -0.05, 0.2], drift: 0.07 },

  /**
   * The mirror of the options shot, from the other corner and a touch higher.
   *
   * Trophies sit beside options on the menu and are the same kind of screen — a
   * long list to scroll — so they get the same kind of framing: far enough back
   * that the room is a backdrop and not a thing to look at. Coming from the
   * opposite side keeps the two from feeling like the same screen twice.
   */
  '/trophies': { from: [1.05, 1.8, -1.75], look: [-0.1, -0.05, 0.25], drift: 0.065 },
};

const DEFAULT_SHOT = SHOTS['/menu'];

/**
 * How quickly the camera settles onto a new framing. A rate, so frame-rate free.
 *
 * Set against the screens' own entry animations, which take about a third of a
 * second: at 2.2 the camera covers half its travel in 0.32s and nine tenths in
 * about a second, so the move and the content arrive together and the last of it
 * eases in behind a screen you are already reading. Faster reads as a cut, given
 * some of these framings are four metres apart.
 */
const TRAVEL = 2.2;

function shotFor(pathname: string): Shot {
  return SHOTS[pathname] ?? DEFAULT_SHOT;
}

/** How far a tilt of the phone shifts the camera, in metres. */
const PARALLAX = 0.09;

function DriftingCamera({ shot }: { shot: Shot }) {
  useTilt();

  const clock = useRef(0);
  const settled = useRef(false);

  const scratch = useMemo(
    () => ({
      target: new THREE.Vector3(),
      look: new THREE.Vector3(),
      current: new THREE.Vector3(),
      aim: new THREE.Vector3(),
    }),
    [],
  );

  useFrame((state, delta) => {
    clock.current += delta;

    /**
     * The idle drift.
     *
     * Two motions on periods that share no common multiple, so the pair never
     * comes back to the same place — a single sine would be a visible loop, and
     * two that divide evenly would be a longer visible loop.
     */
    const swing = Math.sin(clock.current * 0.21) * shot.drift;
    const rise = Math.cos(clock.current * 0.13) * shot.drift * 0.45;

    scratch.target.set(shot.from[0] + swing, shot.from[1] + rise, shot.from[2]);
    scratch.look.set(shot.look[0], shot.look[1], shot.look[2]);

    if (!settled.current) {
      scratch.current.copy(scratch.target);
      scratch.aim.copy(scratch.look);
      settled.current = true;
    } else {
      // Exponential easing: fast at first, then settling, and independent of how
      // often this runs — which matters because the backdrop is capped at 30.
      const alpha = 1 - Math.exp(-TRAVEL * delta);
      scratch.current.lerp(scratch.target, alpha);
      scratch.aim.lerp(scratch.look, alpha);
    }

    /**
     * The phone's own tilt, added after the easing rather than before it.
     *
     * Before, and it would be fed through the same exponential settle as a
     * change of framing — the camera would lag a quarter second behind the
     * phone, which reads as drift rather than as parallax. The tilt is already
     * smoothed at the sensor, so it goes on as an offset at the end.
     *
     * Deliberately larger than the panels' own lean. The scene is metres away
     * and the panels are notionally a few centimetres off the glass, so equal
     * offsets would put the whole screen on one plane; the point of moving the
     * camera at all is that the table and the menu over it separate.
     */
    const tilt = currentTilt();
    state.camera.position.set(
      scratch.current.x + tilt.x * PARALLAX,
      scratch.current.y - tilt.y * PARALLAX * 0.6,
      scratch.current.z,
    );
    state.camera.lookAt(scratch.aim);
  });

  return null;
}

/** A cue lying across the cloth, which is what makes the table read as in use. */
/**
 * The cue's colours, as bands along its length.
 *
 * Distance from the tip, in metres, and the colour from there back. Painted into
 * the mesh rather than built as separate rings around it — see `RestingCue`.
 */
const CUE_BANDS: [number, string][] = [
  [0.0, '#5d7e9e'], // the tip
  [0.014, '#efe8d6'], // ferrule
  [0.05, '#e8d5b0'], // pale shaft, most of the cue
  [0.86, '#c9c9cc'], // the joint ring
  [0.88, '#c2a273'], // forearm, a shade deeper than the shaft
  [1.03, '#5b3a1e'], // the wrap: brown, and the only dark stretch
  [1.36, '#c2a273'], // a hand's width of wood below the wrap
  [1.415, '#241d17'], // the bumper
];

/**
 * The cues on the cloth, one per player.
 *
 * Both halves of this were fixed before: one cue, at one transform picked by eye
 * against the four balls that used to be the only thing on the table. Neither
 * survives real positions coming through from a save — the pose lands in the
 * pack as often as not, and one stick on a table set for four is wrong about who
 * is playing.
 *
 * `placeCues` searches for poses that clear the balls, the rails and each other,
 * and returns fewer than asked for when the cloth is too crowded to fit them.
 * Whatever it returns is what gets drawn, including nothing.
 */
function RestingCues({ table }: { table: Table }) {
  const layout = useBackdropLayout((s) => s.layout);
  const players = useBackdropLayout((s) => s.players);

  const poses = useMemo(() => {
    // With no game on, the table is idle: one cue put down by whoever was last
    // here, laid against the balls that are actually on the cloth.
    const balls = layout ?? IDLE_SCATTER.map((b) => ({ number: b.number, x: -b.z, y: b.x }));
    return placeCues(Math.max(1, players), table, balls);
  }, [layout, players, table]);

  const geometry = useCueGeometry();

  return (
    <group>
      {poses.map((pose, index) => (
        <group
          key={index}
          position={[sceneX(pose.centre), CUE_REST_HEIGHT, sceneZ(pose.centre)]}
          // The lathe runs along local +y, so it is tipped flat first and then
          // turned to its heading. `sceneHeading` is the same conversion the
          // game uses to point a cue down an aim line.
          rotation={[Math.PI / 2, 0, -sceneHeading(pose.angle)]}>
          <mesh geometry={geometry}>
            <meshPhysicalMaterial vertexColors roughness={0.36} clearcoat={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** How high a cue lying on its side floats above the cloth: its own thickness. */
const CUE_REST_HEIGHT = 0.0134;

function useCueGeometry() {
  /**
   * A cue as one continuous piece of wood, tapering the whole way.
   *
   * Two things had to be right at once, and earlier versions each got one. The
   * silhouette is a single unbroken line from bumper to tip — one lathe, not a
   * shaft cylinder and a butt cylinder set end to end, which stepped where they
   * met. And the colour changes along that line without anything being laid on
   * top of it.
   *
   * That second part is why the bands are vertex colours rather than meshes. The
   * ferrule, joint, wrap and bumper used to be thin cylinders sleeved over the
   * body at almost exactly its radius — clearances between −0.3mm and +0.17mm,
   * which is to say two surfaces fighting for the same pixels. At this distance
   * that is textbook z-fighting, and it is what was shimmering on the phone.
   * Pushing them further out would have fixed the flicker by making the cue
   * lumpy; colouring the body's own vertices removes the second surface
   * altogether, so there is nothing left to fight.
   *
   * Radii, tip to bumper: 6mm out through 10mm at the joint to 13mm at the butt,
   * 1.45m overall. The taper is close to flat behind the tip — the "pro taper"
   * that runs through the bridge hand — and only then opens out.
   */
  const geometry = useMemo(() => {
    /** The profile, as (distance from tip, radius) in metres. */
    const profile: [number, number][] = [
      [0.0, 0.0],
      [0.0, 0.0062],
      [0.012, 0.0063],
      [0.045, 0.0065],
      [0.3, 0.0072],
      [0.55, 0.0086],
      [0.82, 0.0101],
      [1.1, 0.0115],
      [1.38, 0.0128],
      [1.41, 0.013],
      // The bumper: a rubber plug with a flat face, not a taper to a point.
      //
      // The profile used to run 13mm to 12.6mm and then straight to zero over
      // the last centimetre, which closes the butt off as a cone. From the side
      // that reads as a cue with its bumper missing — the end has to be blunt,
      // because that is the part that gets stood on the floor. It sits a shade
      // proud of the wood, the way a real one does.
      [1.415, 0.0134],
      [1.448, 0.0134],
      /**
       * The face of the bumper, closed over three rings rather than two.
       *
       * The end used to be written as two points at the same distance — the rim
       * and the centre — which is how a lathe is normally told to cap itself.
       * That cannot survive the resampling below: every ring is keyed by its
       * distance from the tip in a `Set`, so two entries at 1.45 collapse into
       * one, and `radiusAt` then answers with the first match it finds, the rim.
       * The centre point was silently dropped and the butt was left open — a
       * tube you could see down, which is exactly the missing bumper.
       *
       * Giving each ring its own distance keeps all three, and the last two
       * millimetres round the plug over instead of leaving a hole.
       */
      [1.4495, 0.0126],
      [1.4498, 0.0072],
      [1.45, 0.0],
    ];

    /**
     * The profile, resampled so every colour boundary falls on a real vertex.
     *
     * A lathe only has rings where the profile has points, and a colour can only
     * change at a ring. Without this the wrap would start wherever the nearest
     * existing ring happened to be and bleed across a 30cm interpolation.
     */
    const cuts = new Set<number>();
    for (const [along] of profile) cuts.add(along);
    for (const [along] of CUE_BANDS) {
      cuts.add(along);
      // A second ring a hair along, so the change is a line and not a fade.
      cuts.add(along + 0.001);
    }

    const radiusAt = (along: number): number => {
      for (let i = 1; i < profile.length; i++) {
        const [a0, r0] = profile[i - 1];
        const [a1, r1] = profile[i];
        if (along >= a0 && along <= a1) {
          const t = a1 === a0 ? 0 : (along - a0) / (a1 - a0);
          return r0 + (r1 - r0) * t;
        }
      }
      return 0;
    };

    const sorted = [...cuts].filter((a) => a >= 0 && a <= 1.45).sort((a, b) => a - b);
    const points = sorted.map((along) => new THREE.Vector2(radiusAt(along), along - 0.725));

    // 14 segments around: it is a thin object seen from a distance, behind a menu.
    const lathe = new THREE.LatheGeometry(points, 14);

    // Paint the rings. Each vertex takes the colour of the last band at or
    // before its distance from the tip.
    const position = lathe.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    const colour = new THREE.Color();

    for (let i = 0; i < position.count; i++) {
      const along = position.getY(i) + 0.725;
      let hex = CUE_BANDS[0][1];
      for (const [from, value] of CUE_BANDS) {
        if (along >= from - 1e-6) hex = value;
      }
      colour.set(hex);
      colors[i * 3] = colour.r;
      colors[i * 3 + 1] = colour.g;
      colors[i * 3 + 2] = colour.b;
    }

    lathe.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return lathe;
  }, []);

  return geometry;
}

/**
 * Three balls left on the cloth.
 *
 * Not a rack — a rack is a game about to start, and this is a table between
 * frames. Scattered near the far end so they catch the warm light without
 * sitting where the menu's text goes.
 */
/**
 * How far from the pole the white badge reaches, and how wide it is.
 *
 * The same numbers the table's own balls use, so a ball left on the cloth here
 * carries the marking it would carry in play.
 */
const BADGE_LATITUDE = 0.86;
const BADGE_EXTENT = Math.sqrt(1 - BADGE_LATITUDE * BADGE_LATITUDE);

/**
 * A ball with its number on it, for the backdrop.
 *
 * The game draws these through a much larger shader — one that also handles ball
 * sets, stripes and the cue ball's spots — and none of that applies to three
 * balls sitting still on a dark table. This is the same badge and the same
 * number atlas with everything else left out.
 *
 * The atlas is a distance field rather than a bitmap, which is what lets one
 * small texture stay sharp on a ball a few pixels across and on the same ball
 * filling half the frame: a `smoothstep` across the 0.5 contour recovers a clean
 * edge at any size.
 */
/**
 * The cue ball's markings, matching the table's.
 *
 * The red spots at the cardinal points are how the cue ball shows what it is
 * doing in play — without them a spinning white sphere looks perfectly still.
 * Here nothing is moving, but they are what makes the white ball read as *the*
 * cue ball rather than as an unnumbered one somebody forgot to paint.
 */
const SPOT_COLOR = 'vec3(0.95, 0.035, 0.03)';

/**
 * Builds a ball for the backdrop: numbered, or the cue ball with its spots.
 *
 * `number` of zero means the cue ball, the same convention the solver uses.
 */
function createBackdropBallMaterial(atlas: THREE.Texture, colour: string, number: number) {
  const material = new THREE.MeshPhysicalMaterial({
    color: colour,
    roughness: 0.26,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNumbers = { value: atlas };
    shader.uniforms.uNumber = { value: number };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vBallNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBallNormal = normalize(position);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vBallNormal;
        uniform sampler2D uNumbers;
        uniform float uNumber;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>

        vec3 ballNormal = normalize(vBallNormal);
        float latitude = abs(ballNormal.y);

        // The cue ball: red spots at the six cardinal points, and no badge.
        //
        // How close this fragment is to one of the axes, taken from the
        // normalised normal — the interpolated one varies in length around the
        // equator, which stretched the spots into ovals there.
        if (uNumber < 0.5) {
          float onAxis = max(max(abs(ballNormal.x), abs(ballNormal.y)), abs(ballNormal.z));
          float spot = smoothstep(
            ${(1 - SPOT_RADIUS * 1.35).toFixed(5)},
            ${(1 - SPOT_RADIUS * 0.65).toFixed(5)},
            onAxis
          );
          diffuseColor.rgb = mix(diffuseColor.rgb, ${SPOT_COLOR}, spot);
        }

        // The white badge at both poles, with the number inside it. Flipping x
        // by the sign of y keeps the digits from reading mirrored underneath.
        if (uNumber > 0.5 && latitude > ${BADGE_LATITUDE.toFixed(3)}) {
          diffuseColor.rgb = vec3(0.96, 0.95, 0.92);

          vec2 capPosition = vec2(ballNormal.x * sign(ballNormal.y), ballNormal.z);
          vec2 cellUv = capPosition / ${BADGE_EXTENT.toFixed(4)} * 0.5 + 0.5;

          if (cellUv.x > 0.0 && cellUv.x < 1.0 && cellUv.y > 0.0 && cellUv.y < 1.0) {
            float column = mod(uNumber, ${NUMBER_ATLAS_GRID.toFixed(1)});
            float row = floor(uNumber / ${NUMBER_ATLAS_GRID.toFixed(1)});
            vec2 atlasUv = (cellUv + vec2(column, row)) / ${NUMBER_ATLAS_GRID.toFixed(1)};

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
 * The balls left on the cloth: three numbered, and the cue ball with them.
 *
 * The cue ball is what makes the group read as a table someone was playing on
 * rather than a few balls put out for decoration — it is the one that has to be
 * there, and its red spots are the brightest small thing in a dark room.
 *
 * Numbered, because an unnumbered coloured sphere is a marble. They are tipped
 * off the vertical so a badge comes into view: a ball resting squarely on a
 * table keeps both of its numbers at the poles, which is to say out of sight
 * from every angle this scene is filmed from. Each leans by a different amount,
 * so they do not look stamped from one mould.
 */
/**
 * Four balls left where a shot finished, for a table nobody is playing on.
 *
 * Placed by hand rather than simulated: this is scenery for an idle room, and
 * what it has to look like is plausible, not correct.
 */
const IDLE_SCATTER = [
  { number: 3, x: -0.42, z: -0.62, lean: 0.6 },
  { number: 1, x: -0.28, z: -0.48, lean: -1.1 },
  { number: 8, x: 0.36, z: -0.71, lean: 0.25 },
  // The cue ball, set apart from the other three the way it ends up after a
  // shot rather than tucked in with them.
  { number: 0, x: 0.12, z: -0.28, lean: 0.9 },
] as const;

/**
 * The balls on the table under the menu.
 *
 * Two states, and which one shows is the answer to a question the player is
 * about to ask. With a game in progress the real positions come through from the
 * save, so the table behind "Continua" *is* the frame waiting to be resumed —
 * the button and the room agree, and how the game stands is legible before
 * anything is tapped. With no game, the hand-placed scatter: an idle table with
 * a few balls left on it.
 *
 * Colours come from the solver's own table rather than being written again here.
 * A menu that showed the four ball in a different orange from the game is the
 * kind of drift that only gets noticed once it is everywhere.
 */
function StrayBalls() {
  const atlas = useMemo(createNumberAtlas, []);
  const layout = useBackdropLayout((s) => s.layout);

  const balls = useMemo(() => {
    if (layout && layout.length > 0) {
      return layout.map((ball) => ({
        key: ball.number,
        // Through the shared mapping, so the menu's table and the game's agree
        // on which end is which.
        x: sceneX({ x: ball.x, y: ball.y }),
        z: sceneZ({ x: ball.x, y: ball.y }),
        // A fixed tilt per number rather than a random one: this is rebuilt
        // whenever the save is re-read, and balls that reshuffle their spin on
        // every visit to the menu would twitch.
        lean: ball.number * 1.7,
        material: createBackdropBallMaterial(atlas, colorForBall(ball.number), ball.number),
      }));
    }

    return IDLE_SCATTER.map((ball) => ({
      key: ball.number,
      x: ball.x,
      z: ball.z,
      lean: ball.lean,
      material: createBackdropBallMaterial(atlas, colorForBall(ball.number), ball.number),
    }));
  }, [atlas, layout]);

  return (
    <group>
      {balls.map((ball) => (
        <mesh
          key={ball.key}
          position={[ball.x, BALL_HEIGHT, ball.z]}
          rotation={[0.5, ball.lean, 0]}
          material={ball.material}>
          {/* More segments than before: the badge is a shape read off the
              surface, and a coarse sphere gives it a visibly polygonal edge. */}
          <sphereGeometry args={[BALL_RADIUS, 20, 14]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The lamp over the table, and the moment it comes on.
 *
 * The menu opens on a dark room — the table is there, but only the two low
 * lights are, raking the rails. A beat later the pendant above it comes up, the
 * way a room lights when somebody walks in and reaches for the switch.
 *
 * Timed off a ramp driven by the frame clock rather than a JS timer: the
 * backdrop already runs its own capped loop, and a `setTimeout` writing to React
 * state would re-render the whole scene tree to change one number.
 *
 * It happens once. `lit` lives outside the component because navigating back to
 * the menu remounts this, and a lamp that switches itself on again every time
 * you back out of the options screen is a light fixture with a fault.
 */
let lit = false;

/**
 * Told once, on the frame the arc takes and the ballast starts to hum.
 *
 * The menu's greeting banner waits on this so it does not run out over a dark
 * room during the strike. A callback list rather than a store: `lit` is read
 * every frame by the render loop and pushing it through React state would
 * re-render the whole scene tree to change one boolean.
 *
 * Callers are dropped after firing, and anybody who subscribes once the light
 * is already up is called immediately — so a listener can never miss the event
 * by arriving late, which is the failure a plain event would have.
 */
const litWaiters: (() => void)[] = [];

/**
 * Whether the announcement has gone out.
 *
 * Separate from `lit`, which is set half a second later when the output finishes
 * climbing and exists to stop the lamp re-striking on a remount. Sharing one
 * flag would mean a listener arriving inside that window was told the room was
 * still dark, having just missed the only announcement it would ever get.
 */
let announced = false;

export function onRoomLit(run: () => void): () => void {
  if (announced) {
    run();
    return () => {};
  }
  litWaiters.push(run);
  return () => {
    const at = litWaiters.indexOf(run);
    if (at >= 0) litWaiters.splice(at, 1);
  };
}

function announceLit() {
  if (announced) return;
  announced = true;
  // Copied before running: a waiter is free to subscribe again from inside its
  // own callback without walking the array being spliced underneath it.
  const waiting = litWaiters.splice(0, litWaiters.length);
  for (const run of waiting) run();
}

/** How long the room stays dark before the switch is thrown. */
const DARK_HOLD = 1.0;

/**
 * One strike of the tube: when it fires, and for how long.
 *
 * A fluorescent tube does not fade up. The starter closes, the tube flashes at
 * something near full brightness, the starter opens again and it goes out —
 * several times, unevenly — until the cathodes are hot enough to hold the arc.
 * So this is a list of flashes with gaps between them, not a ramp: the previous
 * lamp faded in over 1.4s, which is a filament bulb or a dimmer, and reads as
 * neither of the things a 90s strip light does.
 *
 * Built fresh each time, with random timings, so it never stutters twice the
 * same way.
 */
interface Flash {
  at: number;
  until: number;
  /** Not every misfire is as bright as the last. */
  power: number;
}

function buildStrikes(): { flashes: Flash[]; settled: number } {
  const flashes: Flash[] = [];
  // Two to four false starts. One is not a stutter and five is a broken tube.
  const count = 2 + Math.floor(Math.random() * 3);
  let t = DARK_HOLD;

  for (let i = 0; i < count; i++) {
    // Short flashes, and the gaps between them grow as the tube warms up.
    const on = 0.04 + Math.random() * 0.07;
    flashes.push({ at: t, until: t + on, power: 0.55 + Math.random() * 0.45 });
    t += on + 0.07 + Math.random() * 0.22 * (1 + i * 0.5);
  }

  // Then it catches and stays on.
  flashes.push({ at: t, until: Number.POSITIVE_INFINITY, power: 1 });
  return { flashes, settled: t };
}

/** How quickly the tube reaches full output once the arc holds. */
const WARM_UP = 0.55;

/**
 * Per lamp, and there are two of them.
 *
 * Brighter than the pendant it replaces: a tube over a table is the working
 * light of the room, not a mood light. The scrim over the whole backdrop is what
 * keeps the menu readable underneath.
 */
const LAMP_INTENSITY = 4.6;

function CeilingLamp({ armed }: { armed: boolean }) {
  // Every lamp along the tube, so none is left dark when the arc takes.
  const lights = useRef<(THREE.PointLight | null)[]>([null, null, null]);

  /**
   * One material shared by both tubes.
   *
   * They are two meshes but a single lamp — the starter fires the pair together,
   * so they brighten as one. Sharing the material means the frame loop writes
   * one number instead of keeping two refs in step, and it cannot end up with
   * one tube lit and the other dark.
   */
  const glass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#dfeaf2',
        emissive: new THREE.Color('#eaf4ff'),
        emissiveIntensity: 0,
        roughness: 0.35,
      }),
    [],
  );
  const clock = useRef(0);
  const heard = useRef(0);

  /**
   * The strike sequence, rebuilt every time the switch is thrown on.
   *
   * Held in a ref rather than a memo because it has to be replaced from inside
   * the frame loop: a tube that has been switched off and on again gets a fresh
   * stutter, not a replay of the one it did at launch.
   */
  const strikes = useRef(buildStrikes());

  const on = useRoomLight((state) => state.on);
  const wasOn = useRef(on);

  useFrame((_, delta) => {
    /**
     * The clock only runs once the menu is showing.
     *
     * The backdrop is mounted at the root and so is already drawing behind the
     * splash. Left free-running, the dark second and the whole stutter would be
     * spent behind the title card, and the menu would arrive on a room that was
     * already lit — the switch-on would have happened where nobody saw it.
     */
    if (!armed) return;

    /**
     * The switch being thrown, caught on the frame it changes.
     *
     * Off is instant — that is what a switch does, and a fluorescent has no fade
     * to give on the way down; the arc simply stops. On is the whole performance
     * again, from the dark hold through the stutter, so the sequence and the
     * clock are both replaced rather than resumed.
     */
    if (on !== wasOn.current) {
      wasOn.current = on;

      if (on) {
        strikes.current = buildStrikes();
        clock.current = 0;
        heard.current = 0;
        lit = false;
      } else {
        lit = false;
        for (const lamp of lights.current) if (lamp) lamp.intensity = 0;
        glass.emissiveIntensity = 0;
      }
    }

    // Switched off: the room stays dark and no clock runs.
    if (!on) return;

    // Already been through it once: navigating back to the menu finds the light
    // on, not a tube that strikes itself again every time.
    if (lit) {
      for (const lamp of lights.current) if (lamp) lamp.intensity = LAMP_INTENSITY;
      glass.emissiveIntensity = 3.4;
      return;
    }

    const before = clock.current;
    clock.current += delta;
    const now = clock.current;

    let glow = 0;
    for (let i = 0; i < strikes.current.flashes.length; i++) {
      const flash = strikes.current.flashes[i];
      if (now < flash.at || now >= flash.until) continue;

      if (flash.until === Number.POSITIVE_INFINITY) {
        // The arc has taken. It still needs a moment to reach full output.
        glow = Math.min(1, (now - flash.at) / WARM_UP);
        if (glow >= 1) lit = true;
      } else {
        glow = flash.power;
      }
      break;
    }

    /**
     * The switch, and each time the tube strikes.
     *
     * Fired on the frame a flash begins — comparing against the previous frame's
     * clock rather than testing a window, so a slow frame cannot step over one
     * and lose its click.
     */
    for (let i = heard.current; i < strikes.current.flashes.length; i++) {
      const flash = strikes.current.flashes[i];
      if (flash.at > before && flash.at <= now) {
        const settled = flash.until === Number.POSITIVE_INFINITY;
        playSwitch(settled ? 'settle' : 'strike');

        /**
         * The buzz belongs to the tube that stayed lit, not to the misfires.
         *
         * It used to start on the first strike, on the reasoning that the
         * ballast is what does the striking. But that is not what a fluorescent
         * sounds like: while it is stuttering there are only the hard clacks of
         * the starter, and the steady hum arrives with the arc — it is the
         * sound of the tube *running*, so it cannot precede the tube running.
         *
         * Fired on the last flash, the one with no end, which is the moment the
         * light comes up and stays.
         */
        if (settled) {
          playBallast();
          /*
           * The banner goes with the hum, not with the end of the warm-up.
           *
           * Both mark "the tube is running", but they are half a second apart:
           * the arc takes and the ballast starts humming, then the output climbs
           * to full over `WARM_UP`. Announcing at the top of that ramp put the
           * greeting a beat behind the sound that announces the same thing, and
           * two cues for one event read as two events. This is the frame the
           * room starts sounding lit, so it is the frame to say so.
           */
          announceLit();
        }
        heard.current = i + 1;
      }
    }

    for (const lamp of lights.current) if (lamp) lamp.intensity = glow * LAMP_INTENSITY;
    // The glass itself reads far brighter than the light it casts.
    glass.emissiveIntensity = glow * 3.4;
  });

  return (
    /*
      Hung 0.95m over the cloth, turned 20 degrees off the table's axis.
      
      The height is what stops it burning out the cloth and the cue beneath it.
      Brightness falls with the square of distance, so lower down the two lamps
      nearest the middle were close enough to drive the greens and the pale
      shaft towards white — the fix for a blown-out surface is to move the
      source away, not to turn it down, because turning it down dims the whole
      room along with it.
      
      The angle is for the low framings. Square to the table the tube presents
      almost nothing to a camera looking along that same axis; turned, it cuts
      across the frame and reads as a fitting rather than as a bright line at
      the edge. Only 20 degrees: measured, turning it further shortens it in
      perspective and starts losing more than the angle wins back.
    */
    <group position={[0, 0.95, 0]} rotation={[0, 0.35, 0]}>
      {/*
        Two drops, because a strip light hangs from both ends.

        They are the same wire, and they have to *look* the same. The fitting is
        turned across the room, so one end is up to two thirds nearer the camera
        than the other and perspective alone made the near drop read as a rope
        beside a thread. Two things were making that worse than it had to be: at
        6 sides a cylinder shows its flats once it is close enough, and 3mm of
        radius is thick enough for those flats to have area.

        Thinner and rounder fixes both. 2mm reads as wire at the near end instead
        of as cord, and the extra sides keep the silhouette curved rather than
        faceted where it is largest — so what is left is the honest foreshortening
        of a fitting hung at an angle.
      */}
      {[-0.52, 0.52].map((z) => (
        <mesh key={z} position={[0, 0.3, z]}>
          <cylinderGeometry args={[0.002, 0.002, 0.6, 10]} />
          <meshStandardMaterial color="#14161a" roughness={0.9} />
        </mesh>
      ))}

      {/* The steel channel the tube sits in. */}
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[0.12, 0.05, 1.46]} />
        <meshStandardMaterial color="#2b2f35" roughness={0.55} metalness={0.5} />
      </mesh>

      {/*
        Two tubes, side by side — which is what one of these fittings holds.
        
        A single fat tube was wrong for the era: a twin batten is the shape these
        came in, and the pair reads as a fitting where one cylinder reads as a
        glowing rod. Thinner than the one they replace, so the two together are
        not wider than the channel that carries them.
        
        Lying along the table, which is how they are always hung over one: the
        light is even down the length rather than pooling in the middle.
      */}
      {[-0.032, 0.032].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={glass}>
          <cylinderGeometry args={[0.018, 0.018, 1.4, 10]} />
        </mesh>
      ))}

      {/* End caps, so each tube stops rather than just ending. */}
      {[-0.032, 0.032].map((x) =>
        [-0.71, 0.71].map((z) => (
          <mesh key={`${x}:${z}`} position={[x, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.03, 10]} />
            <meshStandardMaterial color="#3a3f46" roughness={0.6} metalness={0.4} />
          </mesh>
        )),
      )}

      {/*
        Three lights along the tube rather than one at its centre.
        
        A strip light is over a metre of emitter, and a single point under it
        lights the middle of the cloth and lets both ends fall away — which is
        the look of a bulb, not a tube. A third was added with the extra length.
      */}
      {[-0.45, 0, 0.45].map((z, i) => (
        <pointLight
          key={z}
          ref={(node) => {
            lights.current[i] = node;
          }}
          position={[0, -0.05, z]}
          color="#eaf4ff"
          intensity={0}
          distance={5}
          decay={2}
        />
      ))}
    </group>
  );
}

function BackdropScene({ shot, armed }: { shot: Shot; armed: boolean }) {
  const table = useMemo(() => createTable(), []);

  return (
    <>
      <color attach="background" args={['#06090a']} />

      {/*
        Two low, dim lights and almost no ambient.

        The room is dark: this is a table nobody is playing on. The pair sit off
        to either side rather than overhead, which rakes across the rails and
        leaves the cloth falling away into shadow — an overhead lamp would light
        the bed evenly and give the menu a bright field to sit on.
      */}
      <ambientLight color="#7d97a8" intensity={0.16} />
      <pointLight
        position={[1.1, 0.5, 0.9]}
        color="#ffd9a0"
        intensity={2.2}
        distance={4}
        decay={2}
      />
      <pointLight
        position={[-1.3, 0.42, -0.7]}
        color="#6fd8c0"
        intensity={1.1}
        distance={3.5}
        decay={2}
      />

      <CeilingLamp armed={armed} />

      <TableMesh table={table} />
      <RestingCues table={table} />
      <StrayBalls />

      <DriftingCamera shot={shot} />
    </>
  );
}

/**
 * The renderer, built once and handed back on every request.
 *
 * This has to be outside the component and it has to cache. React Three Fiber's
 * native canvas re-runs its `configure` effect on *every* render — the effect
 * has no dependency array — and configure calls the `gl` factory each time. An
 * inline factory would therefore build a fresh `WebGLRenderer`, with a fresh
 * drawing buffer, every time the route changed. Returning the same instance
 * makes the extra calls free.
 */
let cached: THREE.WebGLRenderer | null = null;

function createBackdropRenderer(defaults: THREE.WebGLRendererParameters): THREE.WebGLRenderer {
  if (cached) return cached;

  const renderer = new THREE.WebGLRenderer({ ...defaults, antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;

  /**
   * Thirty frames a second, and no more.
   *
   * Installed inside the renderer rather than around it, for the same reason the
   * game's limiter is: the native canvas appends expo-gl's `endFrameEXP` to
   * whatever it is handed, and a limiter wrapped around that would skip the call
   * that presents the buffer. Underneath, a skipped frame simply re-presents the
   * last one.
   *
   * The camera moves slowly enough that thirty is indistinguishable from sixty
   * here, and this is running behind a menu.
   */
  const draw = renderer.render.bind(renderer);
  let last = 0;
  renderer.render = (scene: THREE.Scene, camera: THREE.Camera) => {
    const now = Date.now();
    if (now - last < 32) return;
    last = now;
    draw(scene, camera);
  };

  cached = renderer;
  return renderer;
}

export function TableBackdrop() {
  const pathname = usePathname();
  const shot = shotFor(pathname);

  /**
   * The tube strikes once, on the way into the menus, and never again.
   *
   * `armed` excludes the game as well as the splash. The backdrop is mounted at
   * the root and keeps drawing underneath the table, so with the game armed the
   * lamp ran its stutter — clicks, buzz and all — behind a screen nobody can see
   * it from, which is where the ticking during play was coming from.
   *
   * An earlier version made it re-strike on every return from a game, to match
   * the menu theme restarting. That was wrong twice over: the sound arrived
   * under the game itself, and the light show is a thing you watch on arrival,
   * not something to sit through each time you back out of a frame. `lit` is
   * never cleared now, so the first launch gets the switch-on and every visit
   * after it finds the room already lit.
   */
  /**
   * Armed only where the backdrop is actually seen.
   *
   * The splash covers it, the game draws its own table, and the loading pause
   * covers it with an opaque screen. This holds the lamp's clock on those three
   * — it does not stop the canvas drawing — so the strike sequence cannot run
   * out of sight and arrive already finished.
   */
  const armed = pathname !== '/' && pathname !== '/game' && pathname !== '/loading';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas camera={{ fov: 42, near: 0.05, far: 20 }} gl={createBackdropRenderer}>
        <BackdropScene shot={shot} armed={armed} />
      </Canvas>

      {/* A scrim over the whole thing. The scene is already dark, but the menu
          has to stay comfortably legible over the lit rails. */}
      <View style={styles.scrim} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 7, 6, 0.55)',
  },
});
