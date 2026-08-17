/**
 * Brute-force puzzle solver, used to prove levels are winnable.
 *
 * A level that cannot be solved inside its shot budget is the one bug in this
 * game that playtesting finds slowly and expensively, so it gets checked
 * mechanically instead. The search is a grid over aim angle and power with a
 * narrow depth-first beam: not clever, but exhaustive enough that "no solution
 * found" is a real signal about the level design.
 */

import { PHYSICS } from '../../core/constants';
import { World } from '../../core/world';
import { LEVELS } from '../levels';
import { createPuzzleState, resolvePuzzleShot, type PuzzleLevel, type PuzzleState } from '../puzzle';

export interface Shot {
  angle: number;
  power: number;
}

export interface SolveResult {
  won: boolean;
  shots: Shot[];
  simulations: number;
}

export interface SolveOptions {
  /** Aim directions tried per shot, spread over the full circle. */
  angles: number;
  powers: number[];
  /** How many of the best candidates to recurse into. */
  beam: number;
  /** Hard cap on simulated shots, so a bad level fails fast. */
  budget: number;
}

/**
 * One degree of aim and six powers.
 *
 * The angular step is the number that matters. Potting a ball a metre away
 * through a pocket a few centimetres wide leaves an aiming window of two or
 * three degrees, so a coarser sweep can step straight over every solution and
 * report a perfectly good level as impossible — which is exactly what a 2.5°
 * grid did once ball-to-ball throw started nudging the contact.
 */
const DEFAULT_OPTIONS: SolveOptions = {
  angles: 360,
  powers: [0.25, 0.4, 0.55, 0.7, 0.85, 1],
  beam: 2,
  budget: 160000,
};

/** How much of the objective is done — higher is strictly better. */
function progressOf(level: PuzzleLevel, state: PuzzleState, world: World): number {
  const goal = level.goal;
  switch (goal.kind) {
    case 'pocket-in-order':
      return state.orderIndex;
    case 'pocket-set':
      return goal.numbers.filter((n) => world.ballByNumber(n)?.pocketed).length;
    case 'pocket-into':
      return world.ballByNumber(goal.number)?.pocketed ? 1 : 0;
    case 'pocket-all':
      return world.balls.filter((b) => b.number !== 0 && b.pocketed).length;
  }
}

export function solveLevel(level: PuzzleLevel, options: Partial<SolveOptions> = {}): SolveResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let simulations = 0;

  const search = (world: World, state: PuzzleState, depth: number): Shot[] | null => {
    if (state.status === 'won') return [];
    if (state.status === 'failed') return null;
    if (depth >= level.maxShots) return null;

    const baseline = progressOf(level, state, world);
    const candidates: { shot: Shot; world: World; state: PuzzleState; score: number }[] = [];

    for (let a = 0; a < opts.angles; a++) {
      const angle = (a / opts.angles) * Math.PI * 2;
      for (const power of opts.powers) {
        if (simulations >= opts.budget) break;

        const next = world.clone();
        next.shoot(angle, power);
        const events = next.simulateUntilRest(PHYSICS.maxShotSeconds);
        simulations += 1;

        const resolved = resolvePuzzleShot(level, state, next, events);
        if (resolved.state.status === 'failed') continue;
        if (resolved.outcome.cueBallNeedsRespot) next.respotCueBall();

        const gained = progressOf(level, resolved.state, next) - baseline;
        if (resolved.state.status !== 'won' && gained <= 0) continue;

        candidates.push({
          shot: { angle, power },
          world: next,
          state: resolved.state,
          // Winning beats progress; among equals, prefer softer shots because
          // they leave the cue ball closer to where it started.
          score: (resolved.state.status === 'won' ? 1000 : 0) + gained * 10 - power,
        });
      }
    }

    candidates.sort((x, y) => y.score - x.score);

    for (const candidate of candidates.slice(0, Math.max(1, opts.beam))) {
      if (candidate.state.status === 'won') return [candidate.shot];
      const rest = search(candidate.world, candidate.state, depth + 1);
      if (rest) return [candidate.shot, ...rest];
      if (simulations >= opts.budget) break;
    }

    return null;
  };

  const world = World.fromLayout(level.layout);
  const shots = search(world, createPuzzleState(level), 0);
  return { won: shots !== null, shots: shots ?? [], simulations };
}

/** Replays a solution to confirm it really wins, independently of the search. */
export function verifySolution(level: PuzzleLevel, shots: Shot[]): PuzzleState {
  const world = World.fromLayout(level.layout);
  let state = createPuzzleState(level);

  for (const shot of shots) {
    world.shoot(shot.angle, shot.power);
    const events = world.simulateUntilRest(PHYSICS.maxShotSeconds);
    const resolved = resolvePuzzleShot(level, state, world, events);
    state = resolved.state;
    if (resolved.outcome.cueBallNeedsRespot) world.respotCueBall();
    if (state.status !== 'playing') break;
  }

  return state;
}

export { LEVELS };
