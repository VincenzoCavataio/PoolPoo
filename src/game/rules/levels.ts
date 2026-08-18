/**
 * Puzzle level data.
 *
 * Cue ball positions are computed with `lineUp` rather than hard-coded, so a
 * level that is meant to offer a straight-in shot provably does: the cue ball
 * sits on the line through the object ball and the pocket. The solver in
 * `tests/levels.test.ts` then confirms every level here is actually winnable
 * inside its shot budget.
 */

import { createTable, type PocketId } from '../core/table';
import { add, normalize, scale, sub, type Vec2 } from '../core/vec';
import type { BallLayout } from '../core/world';
import type { PuzzleLevel } from './puzzle';

const table = createTable();

function pocketAt(id: PocketId): Vec2 {
  const pocket = table.pockets.find((p) => p.id === id);
  if (!pocket) throw new Error(`unknown pocket ${id}`);
  return pocket.center;
}

/** Cue ball position `back` metres behind `ball` on the line to `pocket`. */
function lineUp(ball: Vec2, pocket: PocketId, back: number): Vec2 {
  const away = normalize(sub(ball, pocketAt(pocket)));
  return add(ball, scale(away, back));
}

function ball(number: number, x: number, y: number): BallLayout {
  return { number, x, y };
}

function cue(at: Vec2): BallLayout {
  return { number: 0, x: at.x, y: at.y };
}

const three = { x: 1.0, y: 0.45 };
const doubleA = { x: 0.95, y: 0.42 };
const orderOne = { x: 1.0, y: 0.45 };
const noBlackTarget = { x: 0.9, y: 0.4 };
const fiveFirst = { x: 0.8, y: 0.0 };
const sidePocketBall = { x: 0.15, y: 0.38 };

export const LEVELS: PuzzleLevel[] = [
  {
    id: 'primo-colpo',
    nameKey: 'level.primo-colpo',
    hintKey: 'level.primo-colpoHint',
    maxShots: 2,
    layout: [cue(lineUp(three, 'corner-ne', 0.5)), ball(3, three.x, three.y)],
    goal: { kind: 'pocket-all' },
    constraints: [],
    stars: { three: 1, two: 2 },
  },
  {
    id: 'doppietta',
    nameKey: 'level.doppietta',
    hintKey: 'level.doppiettaHint',
    maxShots: 3,
    layout: [
      cue(lineUp(doubleA, 'corner-ne', 0.55)),
      ball(1, doubleA.x, doubleA.y),
      ball(2, 0.95, -0.42),
    ],
    goal: { kind: 'pocket-all' },
    constraints: [],
    stars: { three: 2, two: 3 },
  },
  {
    id: 'in-ordine',
    nameKey: 'level.in-ordine',
    hintKey: 'level.in-ordineHint',
    maxShots: 5,
    layout: [
      cue(lineUp(orderOne, 'corner-ne', 0.5)),
      ball(1, orderOne.x, orderOne.y),
      ball(2, -1.0, 0.45),
      ball(3, 1.0, -0.45),
    ],
    goal: { kind: 'pocket-in-order', numbers: [1, 2, 3] },
    constraints: [],
    stars: { three: 3, two: 4 },
  },
  {
    id: 'niente-nera',
    nameKey: 'level.niente-nera',
    hintKey: 'level.niente-neraHint',
    maxShots: 4,
    layout: [
      cue(lineUp(noBlackTarget, 'corner-ne', 0.5)),
      ball(4, noBlackTarget.x, noBlackTarget.y),
      ball(5, -0.9, -0.4),
      ball(8, 0.0, 0.35),
    ],
    goal: { kind: 'pocket-set', numbers: [4, 5] },
    constraints: [{ kind: 'forbid-pocket', numbers: [8] }],
    stars: { three: 2, two: 3 },
  },
  {
    id: 'prima-la-5',
    nameKey: 'level.prima-la-5',
    hintKey: 'level.prima-la-5Hint',
    maxShots: 3,
    layout: [
      cue(lineUp(fiveFirst, 'corner-ne', 0.6)),
      ball(5, fiveFirst.x, fiveFirst.y),
      ball(2, 0.3, 0.4),
      ball(7, 0.3, -0.4),
    ],
    goal: { kind: 'pocket-set', numbers: [5] },
    constraints: [{ kind: 'must-hit-first', number: 5 }],
    stars: { three: 1, two: 2 },
  },
  {
    id: 'di-sponda',
    nameKey: 'level.di-sponda',
    hintKey: 'level.di-spondaHint',
    maxShots: 4,
    layout: [cue({ x: -0.2, y: 0.2 }), ball(6, 1.0, 0.45)],
    goal: { kind: 'pocket-set', numbers: [6] },
    constraints: [{ kind: 'cushions-before-pot', count: 1 }],
    stars: { three: 2, two: 3 },
  },
  {
    id: 'buca-scelta',
    nameKey: 'level.buca-scelta',
    hintKey: 'level.buca-sceltaHint',
    maxShots: 3,
    layout: [cue(lineUp(sidePocketBall, 'side-n', 0.55)), ball(9, sidePocketBall.x, sidePocketBall.y)],
    goal: { kind: 'pocket-into', number: 9, pocket: 'side-n' },
    constraints: [],
    stars: { three: 1, two: 2 },
  },
  {
    id: 'ripulisci',
    nameKey: 'level.ripulisci',
    hintKey: 'level.ripulisciHint',
    maxShots: 7,
    layout: [
      cue({ x: 0.0, y: -0.2 }),
      ball(1, 1.05, 0.45),
      ball(2, 1.05, -0.45),
      ball(3, -1.05, 0.45),
      ball(4, -1.05, -0.45),
      ball(5, 0.2, 0.45),
    ],
    goal: { kind: 'pocket-all' },
    constraints: [],
    stars: { three: 5, two: 6 },
  },
];

export function levelById(id: string): PuzzleLevel | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function nextLevelId(id: string): string | null {
  const index = LEVELS.findIndex((l) => l.id === id);
  if (index < 0 || index >= LEVELS.length - 1) return null;
  return LEVELS[index + 1].id;
}
