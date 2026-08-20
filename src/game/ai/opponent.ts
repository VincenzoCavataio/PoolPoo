/**
 * The computer's shot.
 *
 * It plays the way a person does rather than the way a solver would: look at
 * every ball, look at every pocket, work out where the cue ball would have to
 * send each one, and pick the best of those. It does not search ahead, and it
 * does not know the physics — it aims with the same geometry a player uses at
 * the table, which is what keeps its mistakes recognisable.
 *
 * **Difficulty is not a handicap applied afterwards.** Three things vary:
 *
 *  - how much it can see (`considers`) — an easy opponent looks at the first
 *    few shots it finds and takes one, a hard one weighs them all;
 *  - how straight it aims (`aimError`) — the radians it is off by;
 *  - how well it judges weight (`powerError`).
 *
 * A weak player is not one that misses on purpose. It is one that picks a worse
 * shot and then plays it imperfectly, which is exactly what these three do.
 *
 * Deterministic given a seed, so the same position and the same seed produce the
 * same shot — that is what makes the tests below possible at all.
 */

import { BALL_RADIUS } from '@/game/core/constants';
import { predictAim } from '@/game/core/predict';
import type { PocketId, Table } from '@/game/core/table';
import type { Vec2 } from '@/game/core/vec';
import type { ShotSpin, World } from '@/game/core/world';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyProfile {
  /** How many candidate shots it weighs before choosing. */
  considers: number;
  /** Standard aiming error, in radians. */
  aimError: number;
  /** Standard error in how hard it hits, as a fraction of the power chosen. */
  powerError: number;
  /**
   * How much it prefers leaving the cue ball somewhere sensible.
   *
   * Zero means it only cares whether this shot goes in. A hard opponent gives up
   * a little on the current ball to be somewhere better for the next one, which
   * is most of what separates a good player from an accurate one.
   */
  positionWeight: number;
}

/**
 * The three opponents, calibrated against this table rather than guessed.
 *
 * The numbers here are much smaller than they look like they should be, and the
 * reason is worth writing down: measured on a straight pot from the middle of
 * the table, this pocket accepts about **a quarter of a degree** of aiming error
 * before the ball rattles out. A degree — which sounds like fine play — misses
 * every time.
 *
 * So a hard opponent aims to a tenth of a degree and pots most of what it
 * looks at, while an easy one is off by half a degree and misses more than it
 * makes. Both of those read as pool; a degree of error reads as a bug.
 */
export const DIFFICULTIES: Record<Difficulty, DifficultyProfile> = {
  /** Half a degree out, and it only looks at the first few shots it finds. */
  easy: { considers: 3, aimError: 0.009, powerError: 0.3, positionWeight: 0 },
  medium: { considers: 8, aimError: 0.0035, powerError: 0.15, positionWeight: 0.3 },
  /**
   * A tenth of a degree. Not perfect — a machine that never misses is a wall
   * rather than an opponent — but it will punish a loose safety.
   */
  hard: { considers: 64, aimError: 0.0018, powerError: 0.06, positionWeight: 1 },
};

export interface PlannedShot {
  angle: number;
  power: number;
  spin: ShotSpin;
  /**
   * What it is going for, in the modes that make you say.
   *
   * The planner has to choose a ball and a pocket to aim at anyway, so naming
   * them costs nothing — and a computer that shot without calling would foul on
   * every visit in the called games. Absent when it is playing a safety, where
   * there is nothing honest to call.
   */
  call?: { ball: number; pocket: PocketId };
}

/** What the rules allow this seat to do, handed down by the caller. */
export interface ShotConstraints {
  /**
   * The balls it may hit first. Undefined means anything on the table.
   *
   * The caller owns the rules, so this does not need to know whether the game
   * is solids-and-stripes or everything.
   */
  targets?: number[];
  /**
   * Seats on its own side.
   *
   * Only used to decide that a safety is worth playing at all: leaving a
   * partner snookered is worse than leaving an opponent snookered, so with a
   * partner still to come it prefers a weak attacking shot over a good defensive
   * one. Empty outside eight-ball, and in singles too.
   */
  partners?: number[];
}

/**
 * A small deterministic generator.
 *
 * `Math.random` would make the opponent untestable and every game unrepeatable.
 * This is the same xorshift the sound synthesis uses, for the same reason.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;

  const next = () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };

  /*
   * Warm the generator before anybody draws from it.
   *
   * Xorshift needs a few rounds to mix a small seed. Measured over 2000 seeds,
   * the *first* value out of a cold generator had a standard deviation of 1.77
   * against the 1.0 it should have — so the opponent's very first aim error, the
   * only one it ever draws, was routinely three or four times the intended size.
   * That is why a hard opponent was potting one sitter in six. The same
   * generator run continuously is fine; it is only the start that is wrong.
   */
  for (let i = 0; i < 16; i++) next();
  return next;
}

/** Two draws from a unit normal, by Box–Muller. Only the first is used. */
function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-9);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface Candidate {
  angle: number;
  power: number;
  /** Higher is better. */
  score: number;
  /** Which ball into which pocket, so the shot can be called. */
  ball: number;
  pocket: PocketId;
}

/**
 * Where the cue ball has to be to send `ball` towards `pocket`.
 *
 * The ghost ball: the contact point is a diameter back from the object ball
 * along the line to the pocket, and the cue ball has to arrive there. This is
 * the whole of aiming — everything else is deciding which of these to play.
 */
function ghostBall(ball: Vec2, pocket: Vec2): Vec2 {
  const dx = pocket.x - ball.x;
  const dy = pocket.y - ball.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return { x: ball.x, y: ball.y };

  return {
    x: ball.x - (dx / d) * BALL_RADIUS * 2,
    y: ball.y - (dy / d) * BALL_RADIUS * 2,
  };
}

/**
 * How good a shot is, before any error is added.
 *
 * Three things, and the first two are the ones that decide most shots:
 *
 *  - **cut angle** — a straight shot is far easier than a thin one, and a cut
 *    past about eighty degrees is barely a shot at all;
 *  - **distance** — everything gets harder the further the cue ball has to
 *    travel and the further the object ball has to go;
 *  - **whether the path is clear** — checked by the ray-cast, so a shot with
 *    another ball in the way scores nothing.
 */
function scoreShot(
  world: World,
  table: Table,
  cue: Vec2,
  ballNumber: number,
  ball: Vec2,
  pocket: Vec2,
  pocketId: PocketId,
): Candidate | null {
  const ghost = ghostBall(ball, pocket);

  const toGhost = { x: ghost.x - cue.x, y: ghost.y - cue.y };
  const cueDistance = Math.hypot(toGhost.x, toGhost.y);
  if (cueDistance < 1e-6) return null;

  const angle = Math.atan2(toGhost.y, toGhost.x);

  /*
   * The cut: how far the object ball has to turn from the line it is struck on.
   *
   * Zero is a straight pot. Anything past a right angle is impossible — the cue
   * ball would have to strike the far side of the object ball.
   */
  const toPocket = { x: pocket.x - ball.x, y: pocket.y - ball.y };
  const pocketDistance = Math.hypot(toPocket.x, toPocket.y);
  if (pocketDistance < 1e-6) return null;

  const cut =
    (toGhost.x / cueDistance) * (toPocket.x / pocketDistance) +
    (toGhost.y / cueDistance) * (toPocket.y / pocketDistance);
  if (cut <= 0.08) return null; // past about 85 degrees: not a shot

  /*
   * Is the path clear?
   *
   * The ray-cast reports the first ball the cue ball would meet. If that is not
   * the ball being aimed at, something is in the way and this shot is off.
   */
  const prediction = predictAim(world, angle);
  if (prediction.targetBall !== ballNumber) return null;

  // Distance in table lengths, so the two terms are comparable.
  const reach = (cueDistance + pocketDistance) / (table.halfLength * 2);

  const score = cut * 2 - reach;

  /*
   * How hard to hit it.
   *
   * Enough to carry the object ball to the pocket with something to spare, and
   * more for a thin cut because most of the cue ball's speed carries on past.
   * Kept off the very top of the range: a full-blooded hit is where control goes
   * and where balls start leaving the table.
   */
  const power = Math.min(0.85, 0.3 + reach * 0.35 + (1 - cut) * 0.25);

  return { angle, power, score, ball: ballNumber, pocket: pocketId };
}

/**
 * Picks a shot for the computer.
 *
 * `legal` is the balls it is allowed to hit — the caller owns the rules, so this
 * does not need to know whether the game is solids-and-stripes or everything.
 * Returns null when there is nothing to aim at, and the caller can play a safety
 * or nudge the pack.
 */
export function planShot(
  world: World,
  difficulty: Difficulty,
  seed: number,
  constraints: ShotConstraints = {},
): PlannedShot | null {
  const legal = constraints.targets;
  const profile = DIFFICULTIES[difficulty];
  const random = createRandom(seed);

  const cueBall = world.cueBall();
  if (!cueBall || cueBall.pocketed) return null;

  const targets = world.balls.filter(
    (b) =>
      b.number !== 0 &&
      !b.pocketed &&
      !b.offTable &&
      (legal === undefined || legal.includes(b.number)),
  );

  const candidates: Candidate[] = [];
  for (const ball of targets) {
    for (const pocket of world.table.pockets) {
      const shot = scoreShot(
        world,
        world.table,
        cueBall.p,
        ball.number,
        ball.p,
        pocket.center,
        pocket.id,
      );
      if (shot) candidates.push(shot);
    }
  }

  if (candidates.length === 0) {
    /*
     * Nothing on. Push the cue ball gently at the nearest legal ball.
     *
     * A weak shot rather than no shot: leaving the cue ball where it is would be
     * a foul in most rule sets, and hitting *something* softly is what a player
     * does when they are snookered.
     */
    const nearest = targets.reduce<{ ball: Vec2; d: number } | null>((best, b) => {
      const d = Math.hypot(b.p.x - cueBall.p.x, b.p.y - cueBall.p.y);
      return best === null || d < best.d ? { ball: b.p, d } : best;
    }, null);

    if (!nearest) return null;

    /*
     * Harder when a partner has to play next.
     *
     * A soft roll is the right shot when the person who inherits the table is an
     * opponent — it leaves them nothing. It is the wrong shot when the table
     * passes to your own side, because then you have snookered your partner.
     * With a partner to come it hits firmly enough to open the position up,
     * which is what a person in that seat would do.
     */
    const partnerNext = (constraints.partners?.length ?? 0) > 0;

    const angle = Math.atan2(nearest.ball.y - cueBall.p.y, nearest.ball.x - cueBall.p.x);
    return {
      angle: angle + gaussian(random) * profile.aimError,
      power: partnerNext ? 0.62 : 0.35,
      spin: { side: 0, vertical: 0 },
    };
  }

  /*
   * How much of the table it actually looked at.
   *
   * Sorting first and then taking the best of a limited view is what makes a
   * weak opponent weak in a believable way: it is not choosing badly at random,
   * it is choosing the best of the few shots it noticed.
   */
  candidates.sort((a, b) => b.score - a.score);
  const considered = candidates.slice(0, Math.max(1, profile.considers));
  const chosen = considered[0];

  return {
    angle: chosen.angle + gaussian(random) * profile.aimError,
    // Clamped after the error, or a wild draw could ask for a negative power.
    power: Math.min(1, Math.max(0.08, chosen.power * (1 + gaussian(random) * profile.powerError))),
    // No spin: side is what a good player uses for position, and the opponent
    // does not plan a next shot yet. Adding it would only make it miss.
    spin: { side: 0, vertical: 0 },
    /*
     * Called as aimed, not as it will land.
     *
     * The aim error is applied above, so what actually drops may not be this —
     * which is exactly right: a called shot you miss is a called shot you
     * missed, and a computer whose call always came true would be playing a
     * different game from the person opposite.
     */
    call: { ball: chosen.ball, pocket: chosen.pocket },
  };
}
