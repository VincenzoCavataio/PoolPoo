/**
 * A reflection environment, built from the room's own colours.
 *
 * Physically based materials look flat without something to reflect: metal goes
 * black, a lacquered ball shows nothing but a couple of specular dots, and the
 * whole scene reads as plastic. The usual fix is an HDRI, which means shipping a
 * megabyte of image. Instead this paints a small equirectangular gradient —
 * ceiling glow, wall tone, floor tone, plus a hot spot per lamp — from the same
 * data that builds the room, and prefilters it.
 *
 * The payoff is that the balls reflect the room they are actually standing in:
 * warm wood in the pool hall, cold strip light in the garage, neon in the arcade.
 *
 * Prefiltering renders to a texture, which not every mobile GL context supports.
 * It is therefore attempted and not assumed: if it fails the scene keeps its
 * lights and simply loses the reflections.
 */

import { useThree } from '@react-three/fiber/native';
import { useLayoutEffect } from 'react';
import * as THREE from 'three';

import type { GameLocation } from './locations';

const WIDTH = 128;
const HEIGHT = 64;

type Rgb = [number, number, number];

/** Parses `#rrggbb` into sRGB bytes, sidestepping colour-management surprises. */
function parseHex(hex: string): Rgb {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function brighten(color: Rgb, amount: number): Rgb {
  return mix(color, [255, 255, 255], amount);
}

/**
 * Latitude bands: a bright ceiling fading into the walls, then into the floor.
 * The lamps are added as soft hot spots just below the top.
 */
function createEquirectangular(location: GameLocation): THREE.DataTexture {
  const wall = parseHex(location.walls?.color ?? location.background);
  const floor = parseHex(location.floorColor);
  const ambient = parseHex(location.ambient.color);
  const ceiling = brighten(mix(wall, ambient, 0.5), 0.22);

  const lampColor = location.lamps.length ? parseHex(location.lamps[0].color) : brighten(ambient, 0.4);
  const lampStrength = location.lamps.length ? 1 : 0.35;

  const data = new Uint8Array(WIDTH * HEIGHT * 4);

  for (let y = 0; y < HEIGHT; y++) {
    // 0 at the zenith, 1 at the nadir.
    const t = y / (HEIGHT - 1);

    let band: Rgb;
    if (t < 0.5) band = mix(ceiling, wall, t / 0.5);
    else band = mix(wall, floor, (t - 0.5) / 0.5);

    for (let x = 0; x < WIDTH; x++) {
      let [r, g, b] = band;

      // Two lamps, opposite each other, a little below the zenith. Even when a
      // location has none, a soft sky glow keeps the highlights from dying.
      for (const centre of [0.25, 0.75]) {
        const dx = Math.min(Math.abs(x / WIDTH - centre), 1 - Math.abs(x / WIDTH - centre));
        const dy = t - 0.2;
        const falloff = Math.exp(-((dx * dx) / 0.006 + (dy * dy) / 0.01));
        const glow = falloff * lampStrength;
        r += (lampColor[0] - r) * glow;
        g += (lampColor[1] - g) * glow;
        b += (lampColor[2] - b) * glow;
      }

      const index = (y * WIDTH + x) * 4;
      data[index] = Math.min(255, Math.round(r));
      data[index + 1] = Math.min(255, Math.round(g));
      data[index + 2] = Math.min(255, Math.round(b));
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, WIDTH, HEIGHT, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function EnvironmentReflections({ location }: { location: GameLocation }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useLayoutEffect(() => {
    const source = createEquirectangular(location);
    let generator: THREE.PMREMGenerator | null = null;
    let target: THREE.WebGLRenderTarget | null = null;

    try {
      generator = new THREE.PMREMGenerator(gl);
      target = generator.fromEquirectangular(source);
      scene.environment = target.texture;
    } catch (error) {
      console.warn('[pool] riflessi ambientali non disponibili su questo dispositivo', error);
      scene.environment = null;
    }

    source.dispose();

    return () => {
      scene.environment = null;
      target?.dispose();
      generator?.dispose();
    };
  }, [gl, scene, location]);

  return null;
}
