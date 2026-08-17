/**
 * A 40-line test harness instead of a test framework.
 *
 * The core has no dependencies and runs in plain Node, so pulling in Jest and
 * a React Native preset to assert that balls do not overlap would cost more
 * than it returns. `npm run test:core` runs these through tsx.
 */

interface Failure {
  suite: string;
  name: string;
  message: string;
}

const failures: Failure[] = [];
let passed = 0;
let currentSuite = 'core';

export function suite(name: string, body: () => void): void {
  currentSuite = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
  body();
}

export function test(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ suite: currentSuite, name, message });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    \x1b[31m${message}\x1b[0m`);
  }
}

export function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function assertClose(actual: number, expected: number, tolerance: number, label: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected} ±${tolerance}, got ${actual}`);
  }
}

export function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

export function report(): void {
  console.log('');
  if (failures.length === 0) {
    console.log(`\x1b[32m${passed} passed\x1b[0m`);
    return;
  }
  console.log(`\x1b[31m${failures.length} failed\x1b[0m, \x1b[32m${passed} passed\x1b[0m`);
  process.exitCode = 1;
}
