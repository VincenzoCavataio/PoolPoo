/**
 * Public surface of the simulation core.
 *
 * Nothing in here imports three.js, React or any React Native module — it runs
 * unchanged in Node, which is how the physics gets tested without a device.
 */

export * from './ball';
export * from './constants';
export * from './events';
export * from './predict';
export * from './table';
export * from './vec';
export * from './world';
