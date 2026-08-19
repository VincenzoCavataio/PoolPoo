/**
 * Welding many small shapes into one geometry per material.
 *
 * Every mesh handed to three.js is a draw call, and on expo-gl each draw call
 * crosses the JS-to-native bridge. That crossing is the expensive part: at
 * roughly 30–80 microseconds apiece, a scene with 135 of them spends more than
 * half a 60fps frame just issuing commands, before the GPU has drawn anything.
 * That is what stutter on a mid-range phone actually is.
 *
 * Shapes that never move can be baked into a single buffer ahead of time, so a
 * fifty-piece object costs the same to draw as a cube. This is the generic
 * version of what `props.tsx` already does for the room's furniture, pulled out
 * so the music unit can use it too.
 *
 * Only for geometry that is static in its own local space. Anything that
 * animates has to stay a mesh of its own, because a merged buffer has no parts
 * left to move.
 */

import * as THREE from 'three';

export interface MergeShape {
  /** Which bucket this shape lands in. Meshes are emitted one per key. */
  key: string;
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * Bakes each shape's transform into its vertices and concatenates by key.
 *
 * The source geometries are left alone — they are usually shared — so the caller
 * disposes the results, not the inputs.
 */
export function mergeShapes(shapes: MergeShape[]): Map<string, THREE.BufferGeometry> {
  const buckets = new Map<string, { position: number[]; normal: number[] }>();
  const matrix = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const normalMatrix = new THREE.Matrix3();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (const shape of shapes) {
    let bucket = buckets.get(shape.key);
    if (!bucket) {
      bucket = { position: [], normal: [] };
      buckets.set(shape.key, bucket);
    }

    const [rx, ry, rz] = shape.rotation ?? [0, 0, 0];
    euler.set(rx, ry, rz);
    matrix.makeRotationFromEuler(euler);
    matrix.setPosition(shape.position[0], shape.position[1], shape.position[2]);
    // Normals transform by the inverse transpose, which for a rotation is the
    // rotation itself — but going through the proper matrix keeps this correct
    // if a caller ever passes a scale.
    normalMatrix.getNormalMatrix(matrix);

    const source = shape.geometry.index ? shape.geometry.toNonIndexed() : shape.geometry;
    const positions = source.getAttribute('position');
    const normals = source.getAttribute('normal');

    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      bucket.position.push(vertex.x, vertex.y, vertex.z);

      if (normals) {
        normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
        bucket.normal.push(normal.x, normal.y, normal.z);
      }
    }

    // `toNonIndexed` returns a new geometry; the original is the caller's.
    if (source !== shape.geometry) source.dispose();
  }

  const merged = new Map<string, THREE.BufferGeometry>();
  for (const [key, bucket] of buckets) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(bucket.position), 3),
    );
    if (bucket.normal.length > 0) {
      geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(new Float32Array(bucket.normal), 3),
      );
    }
    merged.set(key, geometry);
  }

  return merged;
}
