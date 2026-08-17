/**
 * Set dressing: shelving, a hi-fi stack with a turntable, a CRT, a bookcase,
 * plants, a rug, arcade cabinets, neon, a cue rack.
 *
 * Two hundred-odd separate boxes, cylinders, spheres and cones, drawn in about a
 * dozen calls. They are declared as plain data and then **merged by material**
 * into one geometry each, because none of them ever moves: two hundred `<mesh>`
 * elements would be two hundred draw calls across expo-gl's bridge, which is
 * exactly the cost this project cannot afford to pay for scenery.
 *
 * The merge is hand-rolled rather than pulled from `three/addons`, which keeps
 * the import surface to `three` itself. It only has to handle position and
 * normal, and `toNonIndexed` makes concatenation trivial.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { FLOOR_Y, ROOM } from './locations';

export type PropGroup =
  | 'shelf'
  | 'speakers'
  | 'bookcase'
  | 'plants'
  | 'neon'
  | 'cueRack'
  | 'art'
  | 'stool'
  | 'clock'
  | 'rug'
  | 'sideTable'
  | 'floorLamp'
  | 'arcade';

type MaterialKey =
  | 'wood'
  | 'woodDark'
  | 'plastic'
  | 'metal'
  | 'screen'
  | 'cone'
  | 'vinyl'
  | 'label'
  | 'accent'
  | 'accent2'
  | 'neonPink'
  | 'neonCyan'
  | 'marquee'
  | 'fabric'
  | 'terracotta'
  | 'soil'
  | 'leaf'
  | 'leafDark'
  | 'rug'
  | 'glass';

/**
 * Materials describe how a surface answers light, not just its colour.
 *
 * `clearcoat` is a second, sharper specular layer — varnish on wood, moulding
 * gloss on plastic, the lacquer on a record. `sheen` is the soft rim you get off
 * fibres, which is what makes carpet and leaves read as soft rather than
 * plastic. Both come alive against the reflection environment; without one, the
 * metals in particular fall back to lit-only and go dull.
 */
interface MaterialSpec {
  color: string;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenColor?: string;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  envMapIntensity?: number;
  /** Unlit, for things that read as light sources. */
  basic?: boolean;
}

const MATERIALS: Record<MaterialKey, MaterialSpec> = {
  wood: { color: '#6b4a2f', roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.35 },
  woodDark: { color: '#3a2718', roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4 },
  plastic: { color: '#1b1d20', roughness: 0.35, clearcoat: 0.55, clearcoatRoughness: 0.15 },
  // Real chrome: almost fully metallic, which needs the environment to show.
  metal: { color: '#b9bfc6', roughness: 0.22, metalness: 0.95, envMapIntensity: 1.4 },
  screen: {
    color: '#0a1418',
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    emissive: '#0d2a38',
    emissiveIntensity: 0.5,
  },
  cone: { color: '#2a2c2f', roughness: 0.92 },
  vinyl: { color: '#131313', roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.12 },
  label: { color: '#e5dac2', roughness: 0.85 },
  accent: { color: '#d94f7a', roughness: 0.45, clearcoat: 0.3 },
  accent2: { color: '#3fbfd8', roughness: 0.45, clearcoat: 0.3 },
  neonPink: { color: '#ff53d8', basic: true },
  neonCyan: { color: '#5cf0ff', basic: true },
  marquee: { color: '#ffa63c', basic: true },
  fabric: { color: '#2f3a44', roughness: 1, sheen: 0.7, sheenColor: '#6d7f8f' },
  terracotta: { color: '#a4552f', roughness: 0.95 },
  soil: { color: '#25190f', roughness: 1 },
  leaf: { color: '#3f7a43', roughness: 0.65, sheen: 0.5, sheenColor: '#9fd08a' },
  leafDark: { color: '#2c5a33', roughness: 0.7, sheen: 0.4, sheenColor: '#7fb673' },
  rug: { color: '#6d2c3a', roughness: 1, sheen: 0.85, sheenColor: '#c58a95' },
  glass: {
    color: '#9fc4cf',
    roughness: 0.04,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    opacity: 0.3,
    envMapIntensity: 1.6,
  },
};

interface Part {
  material: MaterialKey;
  position: [number, number, number];
  rotation?: [number, number, number];
  box?: [number, number, number];
  cylinder?: { radius: number; height: number; segments?: number };
  sphere?: { radius: number; segments?: number };
  cone?: { radius: number; height: number; segments?: number };
}

function box(
  material: MaterialKey,
  size: [number, number, number],
  position: [number, number, number],
  rotation?: [number, number, number],
): Part {
  return { material, box: size, position, rotation };
}

function cyl(
  material: MaterialKey,
  radius: number,
  height: number,
  position: [number, number, number],
  rotation?: [number, number, number],
): Part {
  return { material, cylinder: { radius, height }, position, rotation };
}

function sph(
  material: MaterialKey,
  radius: number,
  position: [number, number, number],
): Part {
  return { material, sphere: { radius }, position };
}

function cone(
  material: MaterialKey,
  radius: number,
  height: number,
  position: [number, number, number],
  rotation?: [number, number, number],
): Part {
  return { material, cone: { radius, height }, position, rotation };
}

// ----------------------------------------------------------------- the layout

const WALL_X = ROOM.width / 2;
const WALL_Z = ROOM.depth / 2;

/** Shelving stands against the right-hand wall. */
const SHELF_X = WALL_X - 0.17;
const SHELF_DEPTH = 0.3;
const SHELF_FRONT = SHELF_X - SHELF_DEPTH / 2;
const BOARD_YS = [-0.765, -0.385, -0.005, 0.375, 0.755, 1.135];

function shelfParts(): Part[] {
  const parts: Part[] = [];

  // Boards stop at the inner faces of the sides and the back rather than
  // running through them. Overlapping solids leave coplanar faces exactly where
  // two pieces of furniture meet, and those flicker.
  const shelfSpan = 2.2 - 2 * 0.04;
  const boardDepth = SHELF_DEPTH - 0.02;

  for (const y of BOARD_YS) {
    parts.push(box('wood', [boardDepth, 0.03, shelfSpan], [SHELF_X - 0.01, y, 0]));
  }
  for (const z of [-1.08, 1.08]) {
    parts.push(box('woodDark', [SHELF_DEPTH, 1.93, 0.04], [SHELF_X, 0.185, z]));
  }
  parts.push(box('woodDark', [0.02, 1.93, 2.2], [SHELF_X + SHELF_DEPTH / 2 - 0.01, 0.185, 0]));

  // Bay 0 — records on edge, plus a stack of tapes.
  for (let i = 0; i < 14; i++) {
    const material: MaterialKey = i % 5 === 0 ? 'accent' : i % 3 === 0 ? 'label' : 'vinyl';
    parts.push(box(material, [0.26, 0.31, 0.012], [SHELF_X, -0.595, -0.95 + i * 0.03]));
  }
  for (let i = 0; i < 4; i++) {
    parts.push(box('plastic', [0.2, 0.026, 0.115], [SHELF_X - 0.02, -0.735 + i * 0.028, 0.62]));
  }

  // Bay 1 — the hi-fi stack: amplifier, tape deck, CD player.
  const stack: [number, number][] = [
    [0.1, -0.32],
    [0.1, -0.215],
    [0.075, -0.123],
  ];
  stack.forEach(([height, y]) => {
    parts.push(box('plastic', [0.27, height, 0.44], [SHELF_X, y, -0.3]));
    parts.push(box('metal', [0.012, height * 0.55, 0.4], [SHELF_FRONT + 0.006, y, -0.3]));
  });
  // Green display windows, the giveaway of a 90s separates stack.
  parts.push(box('accent2', [0.008, 0.022, 0.11], [SHELF_FRONT, -0.32, -0.38]));
  parts.push(box('accent2', [0.008, 0.018, 0.09], [SHELF_FRONT, -0.123, -0.38]));

  // Bay 2 — CRT television and a row of cassettes.
  parts.push(box('plastic', [0.3, 0.32, 0.38], [SHELF_X, 0.17, 0.55]));
  parts.push(box('screen', [0.014, 0.24, 0.3], [SHELF_FRONT + 0.002, 0.18, 0.55]));
  for (let i = 0; i < 9; i++) {
    parts.push(box('plastic', [0.1, 0.068, 0.012], [SHELF_X - 0.06, 0.045, -0.62 + i * 0.028]));
  }

  // Bay 3 — boombox.
  parts.push(box('plastic', [0.22, 0.17, 0.46], [SHELF_X, 0.475, -0.1]));
  for (const z of [-0.26, 0.06]) {
    parts.push(cyl('cone', 0.055, 0.016, [SHELF_FRONT + 0.008, 0.475, z], [0, 0, Math.PI / 2]));
  }
  parts.push(box('metal', [0.012, 0.05, 0.1], [SHELF_FRONT + 0.006, 0.5, -0.1]));

  // Bay 4 — odds and ends.
  parts.push(box('label', [0.2, 0.24, 0.16], [SHELF_X, 0.895, -0.7]));
  parts.push(box('accent', [0.18, 0.13, 0.13], [SHELF_X, 0.84, 0.2]));
  parts.push(box('woodDark', [0.22, 0.2, 0.3], [SHELF_X, 0.875, 0.7]));

  return parts;
}

function speakerParts(): Part[] {
  const parts: Part[] = [];
  for (const z of [-1.55, 1.55]) {
    parts.push(box('woodDark', [0.28, 0.9, 0.32], [SHELF_X, FLOOR_Y + 0.45, z]));
    parts.push(cyl('cone', 0.085, 0.02, [SHELF_X - 0.15, FLOOR_Y + 0.28, z], [0, 0, Math.PI / 2]));
    parts.push(cyl('cone', 0.04, 0.02, [SHELF_X - 0.15, FLOOR_Y + 0.62, z], [0, 0, Math.PI / 2]));
  }
  return parts;
}

/** Bookcase on the opposite wall, packed with paperbacks. */
function bookcaseParts(): Part[] {
  const x = -WALL_X + 0.17;
  const front = x + 0.15;
  const centreZ = -1.8;
  const width = 1.6;
  const boards = [-0.765, -0.4, -0.035, 0.33, 0.695, 1.06];
  const parts: Part[] = [];

  // As with the shelving: the boards fit between the sides, they do not pass
  // through them.
  const span = width - 2 * 0.04;

  for (const y of boards) {
    parts.push(box('wood', [0.28, 0.03, span], [x + 0.01, y, centreZ]));
  }
  for (const z of [centreZ - width / 2, centreZ + width / 2]) {
    parts.push(box('woodDark', [0.3, 1.86, 0.04], [x, 0.148, z]));
  }
  parts.push(box('woodDark', [0.02, 1.86, width], [x - 0.14, 0.148, centreZ]));

  const spines: MaterialKey[] = ['accent', 'accent2', 'label', 'woodDark', 'vinyl', 'terracotta'];
  boards.slice(0, 5).forEach((board, shelfIndex) => {
    const count = 12 + (shelfIndex % 2);
    for (let i = 0; i < count; i++) {
      const height = 0.2 + ((i * 7 + shelfIndex * 3) % 5) * 0.012;
      parts.push(
        box(
          spines[(i + shelfIndex) % spines.length],
          [0.24, height, 0.032],
          [x + 0.02, board + 0.015 + height / 2, centreZ - width / 2 + 0.09 + i * 0.055],
        ),
      );
    }
  });

  // A couple of volumes laid flat on top, because shelves are never tidy.
  parts.push(box('label', [0.24, 0.03, 0.18], [x, 1.09, centreZ - 0.4]));
  parts.push(box('accent2', [0.24, 0.03, 0.18], [x, 1.122, centreZ - 0.4]));
  parts.push(cyl('terracotta', 0.09, 0.14, [front - 0.09, 1.145, centreZ + 0.5]));
  parts.push(sph('leaf', 0.11, [front - 0.09, 1.27, centreZ + 0.5]));

  return parts;
}

/** Three potted plants, foliage built from clustered spheres. */
function plantParts(): Part[] {
  const spots: [number, number, number][] = [
    [WALL_X - 0.55, 0, WALL_Z - 0.7],
    [-WALL_X + 0.5, 0, WALL_Z - 0.9],
    [-WALL_X + 0.55, 0, -WALL_Z + 0.75],
  ];
  const parts: Part[] = [];

  spots.forEach(([x, , z], index) => {
    const potHeight = 0.3 + (index % 2) * 0.05;
    const potTop = FLOOR_Y + potHeight;

    parts.push(cyl('terracotta', 0.17, potHeight, [x, FLOOR_Y + potHeight / 2, z]));
    parts.push(cyl('terracotta', 0.185, 0.04, [x, potTop - 0.02, z]));
    parts.push(cyl('soil', 0.15, 0.03, [x, potTop + 0.005, z]));
    parts.push(cyl('leafDark', 0.02, 0.42, [x, potTop + 0.21, z]));

    // Offsets are fixed, not random: the scene must look the same every launch.
    const blobs: [number, number, number, number][] = [
      [0, 0.5, 0, 0.21],
      [0.14, 0.42, 0.08, 0.15],
      [-0.12, 0.44, -0.1, 0.14],
      [0.05, 0.62, -0.12, 0.13],
      [-0.08, 0.6, 0.11, 0.12],
      [0.16, 0.58, -0.04, 0.1],
    ];
    blobs.forEach(([dx, dy, dz, radius], blobIndex) => {
      parts.push(
        sph(
          blobIndex % 2 === 0 ? 'leaf' : 'leafDark',
          radius * (index === 1 ? 0.85 : 1),
          [x + dx, potTop + dy, z + dz],
        ),
      );
    });
  });

  return parts;
}

/** Neon on the far wall — the cheapest possible route to a 90s room. */
function neonParts(): Part[] {
  const z = -WALL_Z + 0.05;
  const y = 0.95;
  const halfW = 0.7;
  const halfH = 0.28;

  return [
    box('neonPink', [halfW * 2, 0.05, 0.04], [0, y + halfH, z]),
    box('neonPink', [halfW * 2, 0.05, 0.04], [0, y - halfH, z]),
    box('neonPink', [0.05, halfH * 2, 0.04], [-halfW, y, z]),
    box('neonPink', [0.05, halfH * 2, 0.04], [halfW, y, z]),
    box('neonCyan', [halfW * 1.3, 0.045, 0.04], [0, y, z + 0.02]),
  ];
}

function cueRackParts(): Part[] {
  const x = -WALL_X + 0.06;
  const parts: Part[] = [box('woodDark', [0.05, 1.3, 0.6], [x, 0.1, 0.9])];
  for (let i = 0; i < 5; i++) {
    parts.push(cyl('wood', 0.012, 1.45, [x + 0.08, 0.05, 0.66 + i * 0.12]));
  }
  return parts;
}

function artParts(): Part[] {
  const z = WALL_Z - 0.04;
  return [
    box('woodDark', [0.92, 0.72, 0.04], [-0.75, 0.85, z]),
    box('label', [0.82, 0.62, 0.02], [-0.75, 0.85, z - 0.02]),
    box('accent', [0.22, 0.22, 0.01], [-0.95, 0.95, z - 0.04]),
    box('accent2', [0.3, 0.06, 0.01], [-0.6, 0.72, z - 0.04]),
    box('neonPink', [0.1, 0.1, 0.01], [-0.5, 1.0, z - 0.04]),
    box('woodDark', [0.5, 0.62, 0.04], [0.7, 0.9, z]),
    box('accent2', [0.42, 0.52, 0.02], [0.7, 0.9, z - 0.02]),
    box('label', [0.16, 0.16, 0.01], [0.7, 0.9, z - 0.04]),
  ];
}

function stoolParts(): Part[] {
  const parts: Part[] = [];
  for (const [x, z] of [
    [1.6, 2.0],
    [-1.55, 2.15],
  ] as const) {
    parts.push(cyl('fabric', 0.17, 0.07, [x, FLOOR_Y + 0.63, z]));
    parts.push(cyl('metal', 0.03, 0.62, [x, FLOOR_Y + 0.31, z]));
    parts.push(cyl('metal', 0.2, 0.03, [x, FLOOR_Y + 0.02, z]));
    parts.push(cyl('metal', 0.16, 0.02, [x, FLOOR_Y + 0.24, z]));
  }
  return parts;
}

function clockParts(): Part[] {
  const x = -WALL_X + 0.05;
  return [
    cyl('woodDark', 0.14, 0.05, [x, 1.5, 0.2], [0, 0, Math.PI / 2]),
    cyl('label', 0.12, 0.02, [x + 0.035, 1.5, 0.2], [0, 0, Math.PI / 2]),
    box('plastic', [0.008, 0.012, 0.09], [x + 0.05, 1.52, 0.2]),
    box('plastic', [0.008, 0.06, 0.01], [x + 0.05, 1.47, 0.2]),
  ];
}

/** A rug under the table, to stop it floating on a bare floor. */
function rugParts(): Part[] {
  return [
    box('rug', [3.3, 0.012, 4.6], [0, FLOOR_Y + 0.007, 0]),
    box('woodDark', [3.0, 0.014, 4.3], [0, FLOOR_Y + 0.009, 0]),
    box('rug', [2.6, 0.016, 3.9], [0, FLOOR_Y + 0.011, 0]),
  ];
}

function sideTableParts(): Part[] {
  const x = -1.75;
  const z = 2.55;
  const top = FLOOR_Y + 0.62;

  return [
    cyl('wood', 0.3, 0.04, [x, top, z]),
    cyl('metal', 0.04, 0.6, [x, FLOOR_Y + 0.3, z]),
    cyl('metal', 0.24, 0.03, [x, FLOOR_Y + 0.02, z]),
    // Two bottles and a pair of glasses.
    cyl('leafDark', 0.036, 0.24, [x - 0.1, top + 0.14, z - 0.05]),
    cyl('leafDark', 0.015, 0.09, [x - 0.1, top + 0.3, z - 0.05]),
    cyl('accent', 0.036, 0.2, [x + 0.02, top + 0.12, z + 0.08]),
    cyl('accent', 0.014, 0.08, [x + 0.02, top + 0.26, z + 0.08]),
    cyl('glass', 0.035, 0.09, [x + 0.13, top + 0.065, z - 0.09]),
    cyl('glass', 0.035, 0.09, [x + 0.17, top + 0.065, z + 0.04]),
  ];
}

function floorLampParts(): Part[] {
  const x = WALL_X - 0.5;
  const z = -WALL_Z + 1.0;

  return [
    cyl('metal', 0.19, 0.03, [x, FLOOR_Y + 0.02, z]),
    cyl('metal', 0.02, 1.5, [x, FLOOR_Y + 0.77, z]),
    cone('label', 0.23, 0.3, [x, FLOOR_Y + 1.62, z]),
    sph('marquee', 0.05, [x, FLOOR_Y + 1.55, z]),
  ];
}

/** Three cabinets, screens glowing. */
function arcadeParts(): Part[] {
  const parts: Part[] = [];
  const z = -WALL_Z + 0.42;
  const screens: MaterialKey[] = ['neonCyan', 'neonPink', 'marquee'];

  [-1.25, 0, 1.25].forEach((x, index) => {
    parts.push(box('plastic', [0.72, 1.7, 0.62], [x, FLOOR_Y + 0.85, z]));
    parts.push(box('woodDark', [0.76, 0.06, 0.66], [x, FLOOR_Y + 1.72, z]));
    // Marquee above, screen below, control panel jutting out at the front.
    parts.push(box(screens[index], [0.6, 0.2, 0.02], [x, FLOOR_Y + 1.5, z + 0.32]));
    parts.push(box('screen', [0.58, 0.46, 0.02], [x, FLOOR_Y + 1.12, z + 0.32]));
    parts.push(box(screens[(index + 1) % 3], [0.5, 0.38, 0.01], [x, FLOOR_Y + 1.12, z + 0.335]));
    parts.push(box('plastic', [0.66, 0.07, 0.3], [x, FLOOR_Y + 0.86, z + 0.42], [0.25, 0, 0]));
    parts.push(cyl('accent', 0.02, 0.06, [x - 0.16, FLOOR_Y + 0.92, z + 0.44]));
    parts.push(cyl('accent2', 0.02, 0.06, [x + 0.16, FLOOR_Y + 0.92, z + 0.44]));
  });

  return parts;
}

const BUILDERS: Record<PropGroup, () => Part[]> = {
  shelf: shelfParts,
  speakers: speakerParts,
  bookcase: bookcaseParts,
  plants: plantParts,
  neon: neonParts,
  cueRack: cueRackParts,
  art: artParts,
  stool: stoolParts,
  clock: clockParts,
  rug: rugParts,
  sideTable: sideTableParts,
  floorLamp: floorLampParts,
  arcade: arcadeParts,
};

// ------------------------------------------------------------------ the merge

/**
 * Concatenates parts into one geometry per material.
 *
 * `toNonIndexed` first, so merging is a straight append of position and normal
 * with no index remapping. Normals get the inverse-transpose so rotated
 * placement cannot shade wrongly.
 */
function mergeByMaterial(parts: Part[]): Map<MaterialKey, THREE.BufferGeometry> {
  const buckets = new Map<MaterialKey, { position: number[]; normal: number[] }>();
  const matrix = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const translation = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  const vector = new THREE.Vector3();

  for (const part of parts) {
    let source: THREE.BufferGeometry;
    if (part.box) {
      source = new THREE.BoxGeometry(part.box[0], part.box[1], part.box[2]);
    } else if (part.cylinder) {
      const { radius, height, segments = 16 } = part.cylinder;
      source = new THREE.CylinderGeometry(radius, radius, height, segments);
    } else if (part.sphere) {
      const { radius, segments = 10 } = part.sphere;
      source = new THREE.SphereGeometry(radius, segments, Math.max(6, segments - 2));
    } else if (part.cone) {
      const { radius, height, segments = 16 } = part.cone;
      source = new THREE.ConeGeometry(radius, height, segments);
    } else {
      continue;
    }

    const geometry = source.index ? source.toNonIndexed() : source;

    translation.set(part.position[0], part.position[1], part.position[2]);
    euler.set(part.rotation?.[0] ?? 0, part.rotation?.[1] ?? 0, part.rotation?.[2] ?? 0);
    quaternion.setFromEuler(euler);
    matrix.compose(translation, quaternion, scale);
    normalMatrix.getNormalMatrix(matrix);

    let bucket = buckets.get(part.material);
    if (!bucket) {
      bucket = { position: [], normal: [] };
      buckets.set(part.material, bucket);
    }

    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    for (let i = 0; i < positions.count; i++) {
      vector.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      bucket.position.push(vector.x, vector.y, vector.z);
      vector.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
      bucket.normal.push(vector.x, vector.y, vector.z);
    }

    geometry.dispose();
    if (geometry !== source) source.dispose();
  }

  const merged = new Map<MaterialKey, THREE.BufferGeometry>();
  for (const [material, bucket] of buckets) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(bucket.position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.normal, 3));
    geometry.computeBoundingSphere();
    merged.set(material, geometry);
  }
  return merged;
}

export function Props({ groups }: { groups: PropGroup[] }) {
  const key = groups.join(',');

  const merged = useMemo(() => {
    const parts = groups.flatMap((group) => BUILDERS[group]());
    return Array.from(mergeByMaterial(parts).entries());
    // `key` is the stable identity of `groups`; the array itself is recreated
    // by the parent on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Merged geometry is ours, not React's, so switching location has to hand it
  // back rather than leave it on the GPU.
  useEffect(
    () => () => {
      for (const [, geometry] of merged) geometry.dispose();
    },
    [merged],
  );

  return (
    <group>
      {merged.map(([material, geometry]) => {
        const spec = MATERIALS[material];
        const translucent = spec.opacity !== undefined && spec.opacity < 1;

        return (
          <mesh key={material} geometry={geometry}>
            {spec.basic ? (
              <meshBasicMaterial color={spec.color} />
            ) : (
              <meshPhysicalMaterial
                color={spec.color}
                roughness={spec.roughness ?? 0.6}
                metalness={spec.metalness ?? 0}
                clearcoat={spec.clearcoat ?? 0}
                clearcoatRoughness={spec.clearcoatRoughness ?? 0.2}
                sheen={spec.sheen ?? 0}
                sheenColor={spec.sheenColor ?? '#ffffff'}
                emissive={spec.emissive ?? '#000000'}
                emissiveIntensity={spec.emissiveIntensity ?? 1}
                envMapIntensity={spec.envMapIntensity ?? 1}
                transparent={translucent}
                opacity={spec.opacity ?? 1}
                // Glass writing depth would hide whatever is behind it.
                depthWrite={!translucent}
              />
            )}
          </mesh>
        );
      })}
    </group>
  );
}
