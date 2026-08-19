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
import { createTable } from '@/game/core/table';
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

  /** Almost on the cloth at the head, looking along it. Where you break from. */
  '/new-game': { from: [0.0, 0.12, 1.5], look: [0, -0.05, -0.6], drift: 0.03 },

  /** Side on and close, raking across the bed — the cloth fills the frame. */
  '/setup': { from: [1.45, 0.3, -0.35], look: [-0.3, -0.09, 0.1], drift: 0.045 },

  /** High and back over the far end, the whole table small in the frame. */
  '/options': { from: [-0.7, 1.65, -1.9], look: [0, -0.24, 0.2], drift: 0.07 },
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
function RestingCue() {
  /**
   * A cue as one continuous piece of wood, tapering the whole way.
   *
   * Two earlier attempts were wrong in two different ways. The first was too
   * short. The second was the right length but built from a shaft cylinder and a
   * butt cylinder set end to end, and that is the shape of a cue in a case, not
   * a cue: where the two met, the silhouette stepped. A real cue is a single
   * unbroken line from the bumper to the tip, narrowing all the way, and the
   * eye reads any break in that line immediately even when it cannot say why.
   *
   * So the body is one lathe, not two meshes. `LatheGeometry` takes the profile
   * — the radius at each point down the length — and turns it, which is exactly
   * how a cue is actually made. The joint and the wrap are still there, but as
   * bands ON the surface rather than as separate lengths of it, so they decorate
   * the silhouette instead of interrupting it.
   *
   * Radii, tip to bumper: 6mm at the tip, out through 10mm at the joint, to
   * 13mm at the butt — 1.45m overall, against a 2.54m table.
   */
  const geometry = useMemo(() => {
    /**
     * The profile, as (distance from tip, radius) in metres.
     *
     * Not a straight line between the ends: a cue's taper is close to flat for
     * the first stretch behind the tip — the "pro taper", which is the part
     * that runs through the bridge hand — and then opens out. A single linear
     * cone from 6mm to 13mm looks like a chair leg.
     */
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
      [1.44, 0.013],
      [1.45, 0.0126],
      [1.45, 0.0],
    ];

    const points = profile.map(([along, radius]) => new THREE.Vector2(radius, along - 0.725));
    // 14 segments around: it is a thin object seen from a distance, behind a menu.
    return new THREE.LatheGeometry(points, 14);
  }, []);

  return (
    <group position={[0.2, 0.03, 0.05]} rotation={[Math.PI / 2, 0, 0.34]}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial color="#c69a62" roughness={0.34} clearcoat={0.6} />
      </mesh>

      {/* The tip, and the pale ferrule under it. Bands, not sections. */}
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[0.0063, 0.0063, 0.03, 14]} />
        <meshPhysicalMaterial color="#efe6d2" roughness={0.35} clearcoat={0.5} />
      </mesh>
      <mesh position={[0, -0.72, 0]}>
        <cylinderGeometry args={[0.0061, 0.0062, 0.009, 14]} />
        <meshStandardMaterial color="#4f7396" roughness={0.85} />
      </mesh>

      {/* The joint ring, sitting flush on the taper rather than splitting it. */}
      <mesh position={[0, 0.095, 0]}>
        <cylinderGeometry args={[0.0103, 0.0103, 0.014, 14]} />
        <meshPhysicalMaterial color="#b9bfc6" roughness={0.28} metalness={0.85} />
      </mesh>

      {/* The wrap: darker over the same taper, so the line still runs through. */}
      <mesh position={[0, 0.46, 0]}>
        <cylinderGeometry args={[0.0122, 0.0114, 0.26, 14]} />
        <meshStandardMaterial color="#231d18" roughness={0.9} />
      </mesh>

      {/* The bumper at the very end. */}
      <mesh position={[0, 0.722, 0]}>
        <cylinderGeometry args={[0.0127, 0.0122, 0.012, 14]} />
        <meshStandardMaterial color="#0e0d0c" roughness={0.95} />
      </mesh>
    </group>
  );
}

/**
 * Three balls left on the cloth.
 *
 * Not a rack — a rack is a game about to start, and this is a table between
 * frames. Scattered near the far end so they catch the warm light without
 * sitting where the menu's text goes.
 */
function StrayBalls() {
  return (
    <group>
      {(
        [
          [-0.42, -0.62, '#c81919'],
          [-0.28, -0.48, '#c8a519'],
          [0.36, -0.71, '#141414'],
        ] as const
      ).map(([x, z, colour]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.0286, z]}>
          <sphereGeometry args={[0.0286, 14, 10]} />
          <meshPhysicalMaterial
            color={colour}
            roughness={0.26}
            clearcoat={1}
            clearcoatRoughness={0.04}
          />
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

const DARK_HOLD = 1.0;
const LAMP_FADE = 1.4;

function CeilingLamp({ armed }: { armed: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  const shade = useRef<THREE.Mesh>(null);
  const clock = useRef(lit ? DARK_HOLD + LAMP_FADE : 0);

  useFrame((_, delta) => {
    /**
     * The clock only runs once the menu is showing.
     *
     * The backdrop is mounted at the root and so is already drawing behind the
     * splash. Left free-running, the dark second and most of the fade would be
     * spent behind the title card, and the menu would arrive on a room that was
     * already lit — the switch-on would have happened where nobody saw it.
     */
    if (!armed) return;
    clock.current += delta;

    /**
     * A second of dark, then a rise that is fast at first and eases in.
     *
     * Squared rather than linear: a filament does not come up at a constant
     * rate, and a linear ramp on an intensity reads as a dimmer being turned
     * evenly by hand rather than as a lamp being switched on.
     */
    const t = Math.min(1, Math.max(0, (clock.current - DARK_HOLD) / LAMP_FADE));
    const glow = t * t * (3 - 2 * t);

    if (glow >= 1) lit = true;

    if (light.current) light.current.intensity = glow * 5.4;
    if (shade.current) {
      const material = shade.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = glow * 1.8;
    }
  });

  return (
    <group position={[0, 0.92, 0]}>
      {/* The flex, so the shade hangs from something. */}
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.52, 6]} />
        <meshStandardMaterial color="#14161a" roughness={0.9} />
      </mesh>

      {/* The shade, lit from within rather than by anything else. */}
      <mesh ref={shade}>
        <coneGeometry args={[0.17, 0.15, 18, 1, true]} />
        <meshStandardMaterial
          color="#20242a"
          emissive="#ffd9a0"
          emissiveIntensity={0}
          roughness={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight ref={light} position={[0, -0.06, 0]} color="#ffe2b4" intensity={0} distance={4.5} decay={2} />
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
      <RestingCue />
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

  // The splash is the one screen the backdrop is not behind, in effect.
  const armed = pathname !== '/';

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
