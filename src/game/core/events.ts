/**
 * Shot event log.
 *
 * The solver records what happened during a shot; every rule in the game — the
 * scoring in free play, the objectives in puzzles, foul detection — is written
 * as a query over this log rather than as code poking at the solver. That is
 * what keeps two very different game modes from leaking into the physics.
 */

import type { PocketId } from './table';

export interface BallHitEvent {
  kind: 'ball-hit';
  /** Seconds since the start of the shot. */
  t: number;
  a: number;
  b: number;
  /** Closing speed at impact, m/s. */
  speed: number;
}

export interface CushionHitEvent {
  kind: 'cushion-hit';
  t: number;
  ball: number;
  cushion: number;
  speed: number;
}

export interface PocketedEvent {
  kind: 'pocketed';
  t: number;
  ball: number;
  pocket: PocketId;
}

/** A ball that went over a cushion and left the table. */
export interface OffTableEvent {
  kind: 'off-table';
  t: number;
  ball: number;
  /** How fast it was travelling as it left, for the sound and the camera. */
  speed: number;
  /**
   * Where it crossed out of the playing area. The replay camera needs somewhere
   * to point, and by the time anyone looks the ball is on the floor rather than
   * where it went over.
   */
  x: number;
  y: number;
}

export type ShotEvent = BallHitEvent | CushionHitEvent | PocketedEvent | OffTableEvent;

/** The first object ball the cue ball touched, or null if it hit nothing. */
export function firstBallHitByCue(events: ShotEvent[]): number | null {
  for (const e of events) {
    if (e.kind !== 'ball-hit') continue;
    if (e.a === 0) return e.b;
    if (e.b === 0) return e.a;
  }
  return null;
}

/** Pocketed ball numbers in the order they dropped. */
export function pocketedNumbers(events: ShotEvent[]): number[] {
  return events.filter((e): e is PocketedEvent => e.kind === 'pocketed').map((e) => e.ball);
}

export function pocketedObjectBalls(events: ShotEvent[]): number[] {
  return pocketedNumbers(events).filter((n) => n !== 0);
}

export function cueBallPocketed(events: ShotEvent[]): boolean {
  return pocketedNumbers(events).includes(0);
}

/**
 * Did any ball reach a cushion after the cue ball made contact?
 *
 * This is the test behind the push-out foul (WPA 8.6): once the cue ball has
 * touched an object ball, either something has to drop or some ball has to
 * reach a rail. Without it a player can nudge the cue ball into the pack over
 * and over, never potting and never risking anything, and simply run the
 * opponent out of turns.
 */
export function cushionReachedAfterContact(events: ShotEvent[]): boolean {
  let contacted = false;
  for (const e of events) {
    if (e.kind === 'ball-hit') contacted = true;
    else if (e.kind === 'cushion-hit' && contacted) return true;
  }
  return false;
}

/** Balls that left the table, in the order they went. */
export function offTableNumbers(events: ShotEvent[]): number[] {
  return events.filter((e): e is OffTableEvent => e.kind === 'off-table').map((e) => e.ball);
}

export function cueBallLeftTable(events: ShotEvent[]): boolean {
  return offTableNumbers(events).includes(0);
}

/** How many cushions `ball` struck before it dropped (or in total). */
export function cushionsHitBefore(events: ShotEvent[], ball: number): number {
  let count = 0;
  for (const e of events) {
    if (e.kind === 'cushion-hit' && e.ball === ball) count += 1;
    if (e.kind === 'pocketed' && e.ball === ball) break;
  }
  return count;
}

/** Total cushion contacts by any ball — used by "must reach a rail" rules. */
export function totalCushionHits(events: ShotEvent[]): number {
  return events.filter((e) => e.kind === 'cushion-hit').length;
}

/**
 * Cushion contacts by any ball before the first ball dropped. This is what
 * bank-shot objectives mean by "off a rail first": the count has to accumulate
 * before the pot, not merely during the shot.
 */
export function cushionsBeforeFirstPot(events: ShotEvent[]): number {
  let count = 0;
  for (const e of events) {
    if (e.kind === 'pocketed') break;
    if (e.kind === 'cushion-hit') count += 1;
  }
  return count;
}

export function pocketOf(events: ShotEvent[], ball: number): PocketId | null {
  for (const e of events) {
    if (e.kind === 'pocketed' && e.ball === ball) return e.pocket;
  }
  return null;
}
