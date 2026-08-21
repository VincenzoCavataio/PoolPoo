/**
 * The simulation.
 *
 * Deterministic by construction: `step` only ever advances by whole ticks of
 * `PHYSICS.fixedDt`, iteration order is fixed by the ball array, and nothing
 * here reads a clock or a random number. The same shot replayed from the same
 * state produces the same events, which is what makes puzzle levels solvable and
 * the action replay possible.
 *
 * Balls carry a full angular velocity. A struck ball starts out **sliding**: its
 * contact point is moving across the cloth, and kinetic friction acts there,
 * bleeding speed while spinning the ball up until it rolls without slipping.
 * That one mechanism is where most of the feel comes from — a centre-ball hit
 * loses two sevenths of its speed before it settles into a roll, a ball struck
 * high runs on after contact, and a ball struck low stops dead and comes back.
 * None of that is special-cased; it falls out of the sliding phase.
 *
 * The hot loops use scalar maths rather than the `Vec2` helpers on purpose: at
 * break speed this runs up to 24 substeps per tick and allocating vectors inside
 * them would hand the phone's GC a steady stream of garbage.
 */

import { cloneBall, createBall, type Ball } from './ball';
import {
  BALL_DIAMETER,
  BALL_RADIUS,
  CUSHION_COMPLIANCE,
  CUSHION_NOSE_HEIGHT,
  DEFAULT_PROFILE,
  MAX_TRAVEL_PER_SUBSTEP,
  PHYSICS,
  SLIP_DECAY,
  type PhysicsProfile,
} from './constants';
import type { ShotEvent } from './events';
import { clampToPlayable, createTable, footSpot, headSpot, type Table } from './table';
import type { Vec2 } from './vec';

/**
 * Where the floor of the room is, relative to the cloth. A ball driven off the
 * table falls this far and then lands on it, in view, and stays there until the
 * rules put it back — a ball lying on the carpet is the clearest possible
 * feedback about what just happened.
 */
const FLOOR_DROP = -0.78;

/** How much of its downward speed a ball keeps off a carpeted floor. Not much. */
const FLOOR_RESTITUTION = 0.28;

/**
 * How quickly a ball on the floor stops rolling and spinning.
 *
 * Set by how far it needs to travel, not by feel: at 2.2 a ball leaving the
 * table at five metres a second stopped after 2.2 m, and the furniture it is
 * supposed to rattle into stands between 2.4 and 3.2 m away — so it never
 * reached any of it. At 1.2 it runs about four metres, which crosses the room
 * without turning into a ball that rolls for ten seconds.
 */
const FLOOR_DRAG = 1.2;

export interface BallLayout {
  number: number;
  x: number;
  y: number;
}

export interface SerializedWorld {
  balls: Ball[];
  time: number;
}

/** Where the tip strikes the cue ball, in fractions of the radius, −1 to 1. */
export interface ShotSpin {
  /** Positive is right of centre. */
  side: number;
  /** Positive is above centre: follow. Negative is draw. */
  vertical: number;
}

export const NO_SPIN: ShotSpin = { side: 0, vertical: 0 };

/**
 * The line the cue ball actually leaves on, given where the cue points.
 *
 * Exported because two places need the same answer and they must not compute it
 * separately: the solver, which sends the ball, and the aim helpers, which draw
 * where it is going. A guide that disagreed with the shot by two degrees would
 * be worse than no guide.
 *
 * With no side this is the aim angle unchanged, so the ordinary shot costs
 * nothing.
 */
export function departureAngle(angle: number, spin: ShotSpin): number {
  const side = Math.min(1, Math.max(-1, spin.side));
  if (side === 0) return angle;
  return angle - side * PHYSICS.squirt * (1 - PHYSICS.swerveRecovery);
}

/**
 * Balls the solver still has to think about.
 *
 * A ball can leave play two ways now — down a pocket or over a cushion — and
 * every loop in here has to skip both. One predicate rather than the same pair
 * of conditions repeated a dozen times, so a third way out later is one edit.
 */
function inPlay(b: Ball): boolean {
  return !b.pocketed && !b.offTable;
}

/**
 * Turns a ball's velocity `lift` upwards without changing how fast it is going.
 *
 * Rotating the vector rather than adding to it is the whole point: the ball
 * leaves with exactly the speed it arrived with, so climbing out of the dimple
 * is paid for out of its own forward motion. Adding the vertical on top would
 * invent energy, which is the one thing the solver may never do.
 */
/**
 * The vertical half of a contact impulse, with the table underneath taken into
 * account: a ball sitting on the slate has nowhere to go downwards.
 */
function applyVertical(b: Ball, dvz: number): void {
  if (b.z <= 0 && dvz < 0) return;
  b.vz = clampRise(b.vz + dvz, b.z);
}

/**
 * Holds how high a ball can still get to what a flat cloth and a horizontal cue
 * can produce. See `PHYSICS.maxVerticalSpeed` for why that bound is so low.
 *
 * The limit is on the ball's remaining *climb*, not on its speed, and the
 * difference matters. Capping speed alone lets heights stack: a ball already
 * 50 mm up takes another full-strength kick, and the two add to 120 mm — which
 * is how balls were still reaching nearly twice the ceiling. Measuring from
 * where the ball actually is closes that, because the ceiling is an altitude.
 *
 * Deliberately one-sided: downward speed is untouched. A rail drives a ball into
 * the bed harder the faster it arrives, and that dive is what a hop is made of;
 * clamping it as well — which is what I did first — flattened the effect so a
 * rail hit at 6 m/s bounced no higher than one at 3.
 */
function clampRise(vz: number, z: number): number {
  if (vz <= 0) return vz;
  const ceiling = (PHYSICS.maxVerticalSpeed * PHYSICS.maxVerticalSpeed) / (2 * PHYSICS.gravity);
  const climbLeft = ceiling - Math.max(0, z);
  if (climbLeft <= 0) return 0;
  const fastest = Math.sqrt(2 * PHYSICS.gravity * climbLeft);
  return vz > fastest ? fastest : vz;
}

function tiltUpwards(b: Ball, lift: number): void {
  if (b.z > 0) return; // already off the cloth: there is no dimple to climb
  const speed = Math.sqrt(b.v.x * b.v.x + b.v.y * b.v.y + b.vz * b.vz);
  if (speed <= 0) return;

  const vz = b.vz + lift;
  const tilted = Math.sqrt(b.v.x * b.v.x + b.v.y * b.v.y + vz * vz);
  if (tilted <= 0) return;

  const scale = speed / tilted;
  b.v.x *= scale;
  b.v.y *= scale;
  b.vz = clampRise(vz * scale, b.z);
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

export class World {
  readonly table: Table;
  readonly profile: PhysicsProfile;
  balls: Ball[];
  /** Seconds elapsed inside the current shot; reset by `shoot`. */
  time = 0;
  /** Everything that happened during the current shot. */
  events: ShotEvent[] = [];

  constructor(
    table: Table = createTable(),
    balls: Ball[] = [],
    profile: PhysicsProfile = DEFAULT_PROFILE,
  ) {
    this.table = table;
    this.balls = balls;
    this.profile = profile;
  }

  // ---------------------------------------------------------------- factories

  /** Builds a world from explicit positions. Number 0 is the cue ball. */
  static fromLayout(
    layout: BallLayout[],
    table: Table = createTable(),
    profile: PhysicsProfile = DEFAULT_PROFILE,
  ): World {
    const balls = layout.map((l) => createBall(l.number, { x: l.x, y: l.y }));
    return new World(table, balls, profile);
  }

  /**
   * Standard triangle rack with the 8 in the centre of the third row and one
   * solid / one stripe in the back corners. Fixed rather than randomised so that
   * a "new game" is reproducible; randomised racks can come later.
   */
  static rack(table: Table = createTable(), profile: PhysicsProfile = DEFAULT_PROFILE): World {
    const rows = [[1], [2, 9], [10, 8, 3], [11, 4, 12, 5], [13, 6, 14, 15, 7]];

    // A hair more than a diameter, so the rack starts without overlaps for the
    // contact solver to push apart on the first tick.
    const spacing = BALL_DIAMETER * 1.002;
    const rowStep = spacing * Math.sqrt(3) * 0.5;
    const foot = footSpot(table);

    const layout: BallLayout[] = [{ number: 0, x: headSpot(table).x, y: headSpot(table).y }];
    rows.forEach((row, r) => {
      row.forEach((n, i) => {
        layout.push({
          number: n,
          x: foot.x + r * rowStep,
          y: (i - (row.length - 1) / 2) * spacing,
        });
      });
    });

    return World.fromLayout(layout, table, profile);
  }

  // ------------------------------------------------------------------ queries

  cueBall(): Ball | undefined {
    return this.balls.find((b) => b.number === 0);
  }

  ballByNumber(n: number): Ball | undefined {
    return this.balls.find((b) => b.number === n);
  }

  /**
   * Object balls still to be potted.
   *
   * Deliberately *not* `inPlay`: a ball that has been driven off the table has
   * not been potted, it is coming straight back, and it still has to be cleared
   * before anyone has won. Counting it as gone would end a game — or solve a
   * puzzle — because someone knocked a ball on the floor.
   */
  remainingObjectBalls(): Ball[] {
    return this.balls.filter((b) => b.number !== 0 && !b.pocketed);
  }

  /**
   * A shot is over only when nothing is moving *and* nothing is still slipping.
   *
   * Checking speed alone would end a draw shot the instant the cue ball paused,
   * a moment before its backspin dragged it back up the table.
   */
  /**
   * True once the only thing still moving is a ball that has left the table.
   *
   * The shot is decided at this point: everything in play has stopped, and what
   * is left is a ball rolling about on the floor with nothing to hit and no
   * bearing on the result. It can run for several seconds — measured at nearly
   * five from a fast one — and the game waits for `atRest` before it settles,
   * which put that whole roll between the shot and its replay.
   *
   * It is not folded into `atRest` itself: the solver still has to carry the
   * ball to a stop, or it freezes mid-floor and keeps spinning. This only lets
   * the caller decide it has seen enough.
   */
  get decided(): boolean {
    const threshold = PHYSICS.sleepSpeed * PHYSICS.sleepSpeed;
    let anyOffTableMoving = false;

    for (const b of this.balls) {
      if (b.pocketed) continue;

      if (b.offTable) {
        // Still in the air: that is the part worth watching, so not yet.
        if (b.vz !== 0) return false;
        if (b.v.x * b.v.x + b.v.y * b.v.y > threshold) anyOffTableMoving = true;
        continue;
      }

      if (b.z > 0 || b.vz !== 0) return false;
      if (b.v.x * b.v.x + b.v.y * b.v.y > threshold) return false;

      const slipX = b.v.x - BALL_RADIUS * b.w.y;
      const slipY = b.v.y + BALL_RADIUS * b.w.x;
      if (slipX * slipX + slipY * slipY > threshold) return false;
    }

    return anyOffTableMoving;
  }

  get atRest(): boolean {
    const threshold = PHYSICS.sleepSpeed * PHYSICS.sleepSpeed;
    for (const b of this.balls) {
      if (b.pocketed) continue;

      /**
       * A ball on its way to the floor still counts as motion.
       *
       * It is out of play, but the shot is not over while it is in the air —
       * and it is the thing the replay is about to show. Skipping it here ended
       * the shot mid-fall, which froze the ball in mid-air still spinning.
       */
      if (b.offTable) {
        if (b.vz !== 0) return false;
        if (b.v.x * b.v.x + b.v.y * b.v.y > threshold) return false;
        continue;
      }

      // A ball in the air is not at rest however slowly it is drifting.
      if (b.z > 0 || b.vz !== 0) return false;
      if (b.v.x * b.v.x + b.v.y * b.v.y > threshold) return false;

      const slipX = b.v.x - BALL_RADIUS * b.w.y;
      const slipY = b.v.y + BALL_RADIUS * b.w.x;
      if (slipX * slipX + slipY * slipY > threshold) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ actions

  /**
   * Strikes the cue ball.
   *
   * `spin` is where the tip lands on the ball face. Striking off centre by `a`
   * produces angular velocity `5v/(2R²) · a` about the corresponding axis, which
   * is why a hit `0.4R` above centre — and no other height — sets the ball
   * rolling immediately.
   */
  shoot(angle: number, power: number, spin: ShotSpin = NO_SPIN): void {
    const cue = this.cueBall();
    if (!cue || cue.pocketed) return;

    const scaled = Math.min(1, Math.max(0, power));
    const speed = PHYSICS.maxShotSpeed * scaled;

    /**
     * Squirt: the ball does not leave along the line of the cue.
     *
     * A tip that strikes off the vertical axis shoves the ball sideways as well
     * as forwards, and the ball resists being turned — so it departs *away* from
     * the side that was struck. Aim at the pocket with right english and the
     * ball starts left of where the cue points.
     *
     * Applied to the departure angle rather than to the aim, because that is
     * what physically happens: the cue is still pointing where it was pointed.
     * The aim line the helpers draw is therefore honest about the cue and wrong
     * about the ball, which is exactly the problem a player has at a real table
     * and the reason they learn to compensate.
     *
     * Partly undone by `swerveRecovery`: the side spin the tip left behind makes
     * the ball curve back the way it was pushed. On a level cue that recovery is
     * small, so most of the deflection stands.
     */
    const departure = departureAngle(angle, spin);

    const dirX = Math.cos(departure);
    const dirY = Math.sin(departure);

    // The spin axes stay with the *cue*, not with the deflected path: the tip
    // struck square to where the cue was pointing, and that is what decided
    // which way the ball is turning.
    const cueX = Math.cos(angle);
    const cueY = Math.sin(angle);

    // Everything starts the shot still, so replaying from a snapshot is exact.
    for (const ball of this.balls) {
      ball.v.x = 0;
      ball.v.y = 0;
      ball.z = 0;
      ball.vz = 0;
      ball.offTable = false;
      ball.w.x = 0;
      ball.w.y = 0;
      ball.w.z = 0;
    }

    cue.v.x = dirX * speed;
    cue.v.y = dirY * speed;

    const side = clampUnit(spin.side) * PHYSICS.maxSideTipOffset * BALL_RADIUS;
    const vertical = clampUnit(spin.vertical) * PHYSICS.maxTipOffset * BALL_RADIUS;

    // Side axis: the cue's direction turned left, which is the up axis crossed
    // with the direction.
    const sideAxisX = -cueY;
    const sideAxisY = cueX;

    const gain = (5 * speed) / (2 * BALL_RADIUS * BALL_RADIUS);
    cue.w.x = gain * vertical * sideAxisX;
    cue.w.y = gain * vertical * sideAxisY;
    cue.w.z = -gain * side;

    /**
     * The small skip a hard shot gives the cue ball.
     *
     * A level cue cannot launch a ball on its own — a horizontal blow through
     * the centre has no vertical component. What does lift it is the dimple it
     * is sitting in: the cloth is compressed under the ball, so the surface it
     * pushes off is not quite flat and a hard hit rides it up and out. Hitting
     * low deepens that, which is why a heavy draw shot visibly hops.
     */
    const lowTip = Math.max(0, -clampUnit(spin.vertical));
    const lift = speed * PHYSICS.cueDimpleLift * (1 + lowTip * PHYSICS.cueDimpleDrawLift);
    // Under the threshold there is nothing to see — a tenth of a millimetre for
    // a few frames — and it is not worth taking the ball off the cloth for, so a
    // soft shot leaves it flat and rolling.
    cue.vz = lift > PHYSICS.restVerticalSpeed ? clampRise(lift, cue.z) : 0;

    this.time = 0;
    this.events = [];
  }

  /** Parks every ball. Called once a shot has come to rest. */
  /**
   * Puts every ball that left the table back on it, and reports which they were.
   *
   * The rules layer calls this once a shot is over: leaving the table is a foul,
   * but the ball does not stay gone. `findFreeSpot` walks outwards from the foot
   * spot, so several balls returning at once do not land on top of each other.
   */
  returnBallsToTable(): number[] {
    const returned: number[] = [];
    for (const b of this.balls) {
      if (!b.offTable) continue;
      const spot = this.findFreeSpot(footSpot(this.table), b.number);
      b.p.x = spot.x;
      b.p.y = spot.y;
      b.z = 0;
      b.vz = 0;
      b.v.x = 0;
      b.v.y = 0;
      b.w.x = 0;
      b.w.y = 0;
      b.w.z = 0;
      b.offTable = false;
      returned.push(b.number);
    }
    return returned;
  }

  /**
   * Puts the pocketed object balls back in a rack, leaving the table as it is.
   *
   * Straight pool's defining rule: when the table runs down to one ball, the
   * other fourteen go back up and play continues from wherever the cue ball and
   * that last ball are lying. So this cannot rebuild the world — the two balls
   * still on the cloth have to keep their positions, which is the whole point.
   *
   * `keep` names the balls to leave alone. Everything else that is off the table
   * comes back, filling the rack from the apex, and the triangle is placed with
   * the same geometry `rack` uses so the two look identical.
   *
   * Returns what came back, for the caller to report.
   */
  rerack(keep: number[] = []): number[] {
    const spacing = BALL_DIAMETER * 1.002;
    const rowStep = spacing * Math.sqrt(3) * 0.5;
    const foot = footSpot(this.table);
    const rows = [[1], [2, 9], [10, 8, 3], [11, 4, 12, 5], [13, 6, 14, 15, 7]];

    /*
     * The rack's slots, in the order they get filled.
     *
     * Positions rather than numbers: which ball goes where does not matter in
     * 14.1 — they are all worth one — so whatever is off the table drops into
     * the next free slot from the apex back.
     */
    const slots: Vec2[] = [];
    rows.forEach((row, r) => {
      row.forEach((_, i) => {
        slots.push({
          x: foot.x + r * rowStep,
          y: (i - (row.length - 1) / 2) * spacing,
        });
      });
    });

    const returning = this.balls.filter(
      (b) => b.number !== 0 && !keep.includes(b.number) && (b.pocketed || b.offTable),
    );

    const returned: number[] = [];
    returning.forEach((ball, index) => {
      const slot = slots[index];
      if (!slot) return;
      ball.p.x = slot.x;
      ball.p.y = slot.y;
      ball.z = 0;
      ball.vz = 0;
      ball.v.x = 0;
      ball.v.y = 0;
      ball.w.x = 0;
      ball.w.y = 0;
      ball.w.z = 0;
      ball.pocketed = false;
      ball.pocketedIn = null;
      ball.offTable = false;
      returned.push(ball.number);
    });

    return returned;
  }

  settle(): void {
    for (const b of this.balls) {
      b.v.x = 0;
      b.v.y = 0;
      b.z = 0;
      b.vz = 0;
      b.w.x = 0;
      b.w.y = 0;
      b.w.z = 0;
    }
  }

  placeCueBall(p: Vec2): void {
    const cue = this.cueBall();
    if (!cue) return;
    const spot = this.findFreeSpot(clampToPlayable(this.table, p), 0);
    cue.p.x = spot.x;
    cue.p.y = spot.y;
    cue.v.x = 0;
    cue.v.y = 0;
    cue.z = 0;
    cue.vz = 0;
    cue.w.x = 0;
    cue.w.y = 0;
    cue.w.z = 0;
    cue.pocketed = false;
    cue.pocketedIn = null;
    cue.offTable = false;
  }

  /** Returns the cue ball to the head spot after being pocketed. */
  respotCueBall(): void {
    this.placeCueBall(headSpot(this.table));
  }

  /**
   * Nearest position to `preferred` where a ball of `ignoreNumber` would not
   * overlap anything, searched on widening rings. Used for respots and for
   * ball-in-hand placement.
   */
  findFreeSpot(preferred: Vec2, ignoreNumber: number): Vec2 {
    if (this.isSpotFree(preferred, ignoreNumber)) return preferred;

    const step = BALL_DIAMETER * 0.6;
    for (let ring = 1; ring <= 40; ring++) {
      const radius = ring * step;
      const samples = ring * 8;
      for (let s = 0; s < samples; s++) {
        const a = (s / samples) * Math.PI * 2;
        const candidate = clampToPlayable(this.table, {
          x: preferred.x + Math.cos(a) * radius,
          y: preferred.y + Math.sin(a) * radius,
        });
        if (this.isSpotFree(candidate, ignoreNumber)) return candidate;
      }
    }
    return preferred;
  }

  private isSpotFree(p: Vec2, ignoreNumber: number): boolean {
    for (const b of this.balls) {
      if (!inPlay(b) || b.number === ignoreNumber) continue;
      const dx = b.p.x - p.x;
      const dy = b.p.y - p.y;
      if (dx * dx + dy * dy < BALL_DIAMETER * BALL_DIAMETER) return false;
    }
    for (const pocket of this.table.pockets) {
      const dx = pocket.center.x - p.x;
      const dy = pocket.center.y - p.y;
      const min = pocket.radius + BALL_RADIUS;
      if (dx * dx + dy * dy < min * min) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- stepping

  /**
   * Advances one tick. Callers must always pass `PHYSICS.fixedDt` — the renderer
   * does this from an accumulator — because determinism depends on it.
   */
  step(dt: number): void {
    let fastest = 0;
    for (const b of this.balls) {
      if (!inPlay(b)) continue;
      const s2 = b.v.x * b.v.x + b.v.y * b.v.y;
      if (s2 > fastest) fastest = s2;
    }

    // Adaptive substepping is the anti-tunnelling defence: cap how far the
    // quickest ball may travel before contacts are checked again.
    const travel = Math.sqrt(fastest) * dt;
    let substeps = Math.ceil(travel / MAX_TRAVEL_PER_SUBSTEP);
    if (substeps < 1) substeps = 1;
    if (substeps > PHYSICS.maxSubsteps) substeps = PHYSICS.maxSubsteps;

    const h = dt / substeps;
    for (let i = 0; i < substeps; i++) this.substep(h);
  }

  /** Runs a whole shot headlessly. Used by the rules layer and by tests. */
  simulateUntilRest(maxSeconds: number = PHYSICS.maxShotSeconds): ShotEvent[] {
    const maxTicks = Math.ceil(maxSeconds / PHYSICS.fixedDt);
    for (let i = 0; i < maxTicks && !this.atRest; i++) {
      this.step(PHYSICS.fixedDt);
    }
    this.settle();
    return this.events;
  }

  private substep(h: number): void {
    const balls = this.balls;
    const profile = this.profile;
    const g = PHYSICS.gravity;

    const slideDecel = profile.slidingFriction * g * h;
    const rollBase = profile.rollingFriction * g * h;
    const spinDecel = (5 * profile.spinningFriction * g * h) / (2 * BALL_RADIUS);

    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (!inPlay(b)) continue;

      // A ball in the air touches nothing, so nothing slows it and nothing
      // spins it up. This is the only real coupling the vertical axis has, and
      // it is the whole reason a hop matters: the ball keeps every bit of the
      // speed and spin it left the cloth with.
      if (b.z > 0) continue;

      // Velocity of the point touching the cloth: v + w × (-R ẑ).
      const slipX = b.v.x - BALL_RADIUS * b.w.y;
      const slipY = b.v.y + BALL_RADIUS * b.w.x;
      const slip = Math.sqrt(slipX * slipX + slipY * slipY);

      // Sliding: kinetic friction acts where the ball touches the cloth, slowing
      // the centre and twisting the ball at the same time.
      let rolling = true;
      if (slip > 0) {
        const dirX = slipX / slip;
        const dirY = slipY / slip;

        /**
         * The step is capped at exactly the amount that cancels the slip.
         *
         * This cap is not a nicety, it is what keeps friction dissipative. An
         * uncapped step of size `a` changes the ball's total energy by
         * `-m·a·(slip - 1.75a)`, which turns *positive* once the slip drops
         * below `1.75a`. Below that the ball is being pumped rather than
         * damped, and since a substep's `a` is around 0.016 m/s the window
         * reached up past the speed at which a shot is declared over — so a
         * cluster of nearly-stopped balls could jitter without ever settling.
         * See SLIP_DECAY for where the 3.5 comes from.
         */
        const step = Math.min(slideDecel, slip / SLIP_DECAY);

        b.v.x -= step * dirX;
        b.v.y -= step * dirY;
        const twist = (5 * step) / (2 * BALL_RADIUS);
        b.w.x -= twist * dirY;
        b.w.y += twist * dirX;

        // A capped step is one that ran out of slip: the ball has reached
        // rolling inside this substep, so it rolls for the rest of it.
        rolling = step < slideDecel;
        if (rolling) {
          b.w.x = -b.v.y / BALL_RADIUS;
          b.w.y = b.v.x / BALL_RADIUS;
        }
      }

      if (rolling) {
        // Near-constant deceleration, clamped so friction cannot push a ball
        // backwards, with the spin held on the rolling constraint.
        const speed = Math.sqrt(b.v.x * b.v.x + b.v.y * b.v.y);
        if (speed > 0) {
          /*
           * Resistance rises a little with speed.
           *
           * The cloth ahead of a quick ball is compressed harder and its nap
           * disturbed more, and both cost energy. The rise is small — a few per
           * cent per m/s — so this stays a constant-deceleration model in every
           * way that matters; what it adds is that a ball struck hard sheds its
           * last metre a touch faster than one rolled gently over the same
           * ground.
           */
          const rollDecel = rollBase * (1 + profile.rollingSpeedRise * speed);
          if (speed <= rollDecel) {
            b.v.x = 0;
            b.v.y = 0;
          } else {
            const f = (speed - rollDecel) / speed;
            b.v.x *= f;
            b.v.y *= f;
          }
        }
        b.w.x = -b.v.y / BALL_RADIUS;
        b.w.y = b.v.x / BALL_RADIUS;
      }

      // English bleeds away on its own, whatever the ball is doing.
      if (b.w.z !== 0) {
        const magnitude = Math.abs(b.w.z);
        b.w.z = magnitude <= spinDecel ? 0 : b.w.z - Math.sign(b.w.z) * spinDecel;
      }
    }

    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      // A ball that has left the table is still falling, and is still drawn
      // while it does. It just no longer touches anything: no cloth, no
      // cushions, no other balls. It stops being integrated once it is well out
      // of sight, so a shot cannot be held open by something on the floor.
      if (b.pocketed) continue;
      b.p.x += b.v.x * h;
      b.p.y += b.v.y * h;

      if (b.z > 0 || b.vz !== 0 || b.offTable) {
        // Closed form for constant acceleration, not a Euler step. The naive
        // version gains or loses exactly `g²h²/2` of energy every substep
        // depending on which of the two lines you write first, and over the
        // hundred milliseconds a hop lasts that is a quarter of its height.
        // This expression conserves it to the last bit.
        b.z += b.vz * h - 0.5 * g * h * h;
        b.vz -= g * h;
      }

      /**
       * A ball that left the table lands on the floor rather than stopping in
       * mid-air.
       *
       * It also has to lose its spin down there. The cloth-friction pass above
       * skips anything out of play, so without this a ball kept whatever spin it
       * flew off with — 57 turns a second, for ever, hanging in space. That is
       * the pirouette: it was never touching anything that could slow it down.
       */
      if (b.offTable && b.z <= FLOOR_DROP) {
        b.z = FLOOR_DROP;

        // The room has walls, and a ball on the carpet has to stop at them
        // rather than rolling out of the building.
        if (Math.abs(b.p.x) > PHYSICS.roomHalfX) {
          b.p.x = Math.sign(b.p.x) * PHYSICS.roomHalfX;
          b.v.x = -b.v.x * FLOOR_RESTITUTION;
        }
        if (Math.abs(b.p.y) > PHYSICS.roomHalfY) {
          b.p.y = Math.sign(b.p.y) * PHYSICS.roomHalfY;
          b.v.y = -b.v.y * FLOOR_RESTITUTION;
        }

        this.bounceOffFurniture(b);

        if (b.vz < 0) {
          const bounce = -b.vz * FLOOR_RESTITUTION;
          b.vz = bounce < PHYSICS.restVerticalSpeed ? 0 : bounce;
        }
        // Carpet, not cloth: it scrubs off travel and spin together.
        const drag = Math.max(0, 1 - FLOOR_DRAG * h);
        b.v.x *= drag;
        b.v.y *= drag;
        b.w.x *= drag;
        b.w.y *= drag;
        b.w.z *= drag;

        /**
         * Exponential drag only ever approaches zero, so park it outright once
         * the motion is too small to see. Otherwise the ball creeps and turns by
         * fractions for ever, which is the thing being fixed here.
         *
         * The spin is parked together with the travel rather than on a threshold
         * of its own: a ball lying still on the carpet that is nonetheless
         * turning once every thirteen seconds is the same defect in miniature.
         */
        if (
          Math.hypot(b.v.x, b.v.y) < PHYSICS.sleepSpeed &&
          b.vz === 0 &&
          b.z <= FLOOR_DROP
        ) {
          b.v.x = 0;
          b.v.y = 0;
          b.w.x = 0;
          b.w.y = 0;
          b.w.z = 0;
        }
      }
    }

    this.time += h;

    this.resolveBallContacts();
    this.resolveCushionContacts();
    // After the rail, so a ball the cushion has just driven downwards bounces
    // in the same substep instead of sinking below the cloth for one frame.
    this.resolveClothContacts();
    this.resolvePockets();
    this.resolveOffTable();
  }

  private resolveBallContacts(): void {
    const balls = this.balls;
    const restitution = this.profile.ballRestitution;
    const friction = this.profile.ballFriction;
    const minD2 = BALL_DIAMETER * BALL_DIAMETER;

    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (!inPlay(a)) continue;

      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (!inPlay(b)) continue;

        const dx = b.p.x - a.p.x;
        const dy = b.p.y - a.p.y;
        const dz = b.z - a.z;
        const flat2 = dx * dx + dy * dy;
        const d2 = flat2 + dz * dz;
        if (d2 >= minD2) continue;

        let nx: number;
        let ny: number;
        let nz: number;
        let d: number;
        if (d2 === 0) {
          // Coincident centres leave the normal undefined; pick one.
          nx = 1;
          ny = 0;
          nz = 0;
          d = 0;
        } else {
          d = Math.sqrt(d2);
          nx = dx / d;
          ny = dy / d;
          nz = dz / d;
        }

        /**
         * Separation stays horizontal even though the normal does not.
         *
         * Moving a ball vertically to resolve an overlap would hand it potential
         * energy that nothing paid for, and unlike the horizontal plane, height
         * has an energy attached to it. So the pair is pushed apart on the cloth
         * only, out to the horizontal distance at which balls this far apart in
         * height stop touching.
         */
        const flat = Math.sqrt(flat2);
        const reach2 = minD2 - dz * dz;
        if (reach2 > 0) {
          const half = (Math.sqrt(reach2) - flat) * 0.5;
          if (half > 0) {
            const hx = flat > 0 ? dx / flat : 1;
            const hy = flat > 0 ? dy / flat : 0;
            a.p.x -= hx * half;
            a.p.y -= hy * half;
            b.p.x += hx * half;
            b.p.y += hy * half;
          }
        }

        // Closing speed along the real, three-dimensional normal: a ball landing
        // on top of another one pushes it down and bounces off it.
        const vn =
          (b.v.x - a.v.x) * nx + (b.v.y - a.v.y) * ny + (b.vz - a.vz) * nz;
        if (vn >= 0) continue; // already separating

        // Equal masses: half the closing impulse to each, along the normal.
        const impulse = -(1 + restitution) * vn * 0.5;
        a.v.x -= nx * impulse;
        a.v.y -= ny * impulse;
        b.v.x += nx * impulse;
        b.v.y += ny * impulse;

        /**
         * The slate takes the downward half of a tilted contact.
         *
         * Treating the pair as two free spheres is what made a hard low shot go
         * mad. A cue ball hopping 20 mm meets a ball head-on, the normal tilts
         * by 20 degrees, and a fifth of 6.5 m/s becomes vertical: the flier is
         * thrown up 220 mm and the ball it struck is driven *into the bed*,
         * where the cloth hands it back upwards and the whole rack takes off.
         * Energy was conserved the whole way, which is exactly why the invariant
         * never caught it — the geometry was wrong, not the bookkeeping.
         *
         * A ball resting on the slate cannot be pushed downwards. The slate is
         * right underneath it and absorbs that, so a grounded ball only ever
         * takes an upward push; a ball already in the air is free to take
         * either.
         */
        applyVertical(a, -nz * impulse);
        applyVertical(b, nz * impulse);

        // Throw: the two surfaces slide across each other at the contact, and
        // friction there nudges the object ball off the pure geometric line,
        // which is why english changes where a cut shot goes. The direction is
        // the horizontal tangent, which stays perpendicular to the normal above
        // however the pair is stacked.
        const tx = flat > 0 ? -dy / flat : 0;
        const ty = flat > 0 ? dx / flat : 1;
        const surfaceSlip =
          (b.v.x - a.v.x) * tx +
          (b.v.y - a.v.y) * ty -
          BALL_RADIUS * (a.w.z + b.w.z);

        if (surfaceSlip !== 0 && impulse > 0) {
          // Capped at the value that cancels the slip, for the same reason the
          // cloth's step is. The divisor is twice SLIP_DECAY because here *both*
          // balls take the impulse, so the slip between them closes twice as
          // fast as it would against a fixed surface. A looser cap reverses the
          // slip and hands the pair back more spin than it arrived with.
          const magnitude = Math.min(
            friction * impulse,
            Math.abs(surfaceSlip) / (2 * SLIP_DECAY),
          );
          const tangential = -Math.sign(surfaceSlip) * magnitude;

          a.v.x -= tx * tangential;
          a.v.y -= ty * tangential;
          b.v.x += tx * tangential;
          b.v.y += ty * tangential;

          // Both take the same twist: the lever arms point opposite ways on
          // opposite sides of the contact, and so do the impulses.
          const twist = (2.5 * tangential) / BALL_RADIUS;
          a.w.z -= twist;
          b.w.z -= twist;
        }

        // Both balls sit in a dimple in the cloth, and a hard blow makes them
        // climb out of it — which is how balls come flying up out of a rack.
        const lift = -vn * PHYSICS.ballDimpleLift;
        if (lift > PHYSICS.restVerticalSpeed) {
          tiltUpwards(a, lift);
          tiltUpwards(b, lift);
        }

        this.events.push({
          kind: 'ball-hit',
          t: this.time,
          a: a.number,
          b: b.number,
          speed: -vn,
        });
      }
    }
  }

  /**
   * The rails, which are where hops come from.
   *
   * Everything vertical here falls out of one comparison: where the cushion nose
   * is, against where the ball's centre happens to be. See CUSHION_NOSE_HEIGHT.
   * On the cloth the rail catches a ball from above and drives it down; a ball
   * already in the air is caught from below and thrown up; and a ball higher
   * than the nose is not caught at all, so it carries on over and leaves the
   * table.
   */
  private resolveCushionContacts(): void {
    const cushions = this.table.cushions;
    const profile = this.profile;

    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      if (!inPlay(ball)) continue;

      const above = CUSHION_NOSE_HEIGHT - BALL_RADIUS - ball.z;
      // Higher than the nose: there is nothing left to bounce off.
      if (above <= -BALL_RADIUS) continue;

      /**
       * Only ever downwards.
       *
       * The geometry says that once a ball is higher than 7.7 mm the nose catches
       * it from *below* and should throw it upwards, and taken literally that is
       * a ramp: a ball arriving at 6 m/s came off the rail half a metre up, and a
       * third of hard shots ended with balls on the floor. Real cushion rubber
       * does not do that — it gives way and the ball rides over it. The blow
       * downwards into the cloth is a real, measured effect; the launch upwards
       * is an artefact of pretending the nose is rigid. So a raised ball simply
       * meets the rail square, and only a ball still low enough to be caught
       * from above gets a vertical kick at all.
       */
      const sin = Math.max(0, above / BALL_RADIUS) * CUSHION_COMPLIANCE;
      const cos = Math.sqrt(Math.max(0, 1 - sin * sin));
      // Meeting the nose off centre, a ball has to come horizontally closer
      // before the two actually touch.
      const reach = BALL_RADIUS * cos;
      const reach2 = reach * reach;

      /**
       * Restitution along the tilted normal, raised so that the *horizontal*
       * rebound still comes out at the value the profile is tuned for.
       *
       * Without the `1/cos²` the horizontal lands short, and that is a mistake
       * rather than a detail: a real cushion's measured restitution already has
       * the cost of the hop inside it, so charging for the hop a second time
       * would make every rail in the game play dead. Capped at 1, because past
       * there it would be inventing energy rather than redirecting it, and the
       * reflection below is only guaranteed to dissipate at or under 1.
       */
      const elastic = Math.min(1, (1 + profile.cushionRestitution) / (cos * cos) - 1);

      for (let c = 0; c < cushions.length; c++) {
        const seg = cushions[c];
        const ax = seg.a.x;
        const ay = seg.a.y;
        const abx = seg.b.x - ax;
        const aby = seg.b.y - ay;
        const l2 = abx * abx + aby * aby;

        let t = l2 > 0 ? ((ball.p.x - ax) * abx + (ball.p.y - ay) * aby) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = ax + abx * t;
        const cy = ay + aby * t;

        const dx = ball.p.x - cx;
        const dy = ball.p.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= reach2) continue;

        let nx: number;
        let ny: number;
        if (d2 === 0) {
          // Centre exactly on the rail: use the segment normal facing inwards.
          const inv = 1 / Math.sqrt(l2);
          nx = -aby * inv;
          ny = abx * inv;
          if (nx * -cx + ny * -cy < 0) {
            nx = -nx;
            ny = -ny;
          }
        } else {
          const d = Math.sqrt(d2);
          nx = dx / d;
          ny = dy / d;
        }

        ball.p.x = cx + nx * reach;
        ball.p.y = cy + ny * reach;

        // The contact normal in three dimensions, from the nose to the centre.
        const n3x = nx * cos;
        const n3y = ny * cos;
        const n3z = -sin;

        const vn = ball.v.x * n3x + ball.v.y * n3y + ball.vz * n3z;
        if (vn >= 0) continue;

        // Reflecting along a unit normal leaves the ball with exactly
        // `vn²(1 - e²)` less energy than it arrived with, so this cannot add any.
        const j = -(1 + elastic) * vn;
        ball.v.x += n3x * j;
        ball.v.y += n3y * j;
        ball.vz = clampRise(ball.vz + n3z * j, ball.z);

        // Scrub the tangential component and let english push the ball along the
        // rail. Running english widens the angle off the cushion, reverse
        // english tightens it. This direction is perpendicular to the normal
        // above, so the two do not interfere.
        const tx = -ny;
        const ty = nx;
        const vt = ball.v.x * tx + ball.v.y * ty;

        /**
         * How much of the stored english the rail can actually spend.
         *
         * The push used to be `transfer · R · w.z` and nothing else, which made
         * it a function of the spin alone: a rail brushed at half a metre a
         * second delivered the same 1.8 m/s sideways kick as one hit at six, so
         * a ball with full english would fly off a gentle rail at an angle that
         * had no relation to how it arrived. That is the "out of control" part.
         *
         * Friction at a contact cannot exceed `mu · (1 + e) · |vn|` — Coulomb —
         * and it can never do more than cancel the surface slip. Bounding it by
         * both keeps the effect (heavy english off a firm rail still opens the
         * angle right up) while making a soft rail behave like a soft rail.
         */
        const surface = BALL_RADIUS * ball.w.z;
        const grip = profile.cushionFriction * (1 + elastic) * Math.abs(vn);
        const wanted = profile.cushionSpinTransfer * surface;
        const push =
          Math.sign(wanted) * Math.min(Math.abs(wanted), grip, Math.abs(surface));

        const outVt = vt * (1 - profile.cushionFriction) + push;
        ball.v.x += (outVt - vt) * tx;
        ball.v.y += (outVt - vt) * ty;
        ball.w.z *= 1 - profile.cushionSpinLoss;

        this.events.push({
          kind: 'cushion-hit',
          t: this.time,
          ball: ball.number,
          cushion: c,
          speed: -vn,
        });
      }
    }
  }

  private resolvePockets(): void {
    for (const ball of this.balls) {
      if (!inPlay(ball)) continue;
      // A ball crossing a pocket in the air flies over it and lands beyond,
      // exactly as it does on a real table.
      if (ball.z > 0) continue;

      for (const pocket of this.table.pockets) {
        const dx = ball.p.x - pocket.center.x;
        const dy = ball.p.y - pocket.center.y;
        if (dx * dx + dy * dy > pocket.radius * pocket.radius) continue;

        ball.pocketed = true;
        ball.pocketedIn = pocket.id;
        // Velocity is deliberately left alone. Every loop in the solver skips a
        // pocketed ball, so it changes nothing here — but the renderer needs it
        // to carry the ball over the lip and down, instead of stopping it dead
        // at the moment of capture.
        this.events.push({
          kind: 'pocketed',
          t: this.time,
          ball: ball.number,
          pocket: pocket.id,
        });
        break;
      }
    }
  }

  /**
   * The bounce, and the ceiling on it.
   *
   * The arrival speed is recovered from the ball's energy rather than from the
   * speed it happens to hold at the end of the substep: it crossed the cloth
   * part-way through, so it was travelling slower then than it is now, and
   * bouncing it at the later speed would pay it for the overshoot.
   */
  private resolveClothContacts(): void {
    for (const ball of this.balls) {
      if (!inPlay(ball) || ball.z > 0) continue;

      const sunk = -ball.z;
      ball.z = 0;
      if (ball.vz >= 0) continue;

      const arrival = Math.sqrt(
        Math.max(0, ball.vz * ball.vz - 2 * PHYSICS.gravity * sunk),
      );
      // Softening with speed: a gentle skip is returned, a ball driven into the
      // bed by another one is swallowed. Without this the same coefficient has
      // to serve both, and whichever way it is set one of the two is wrong.
      const restitution =
        this.profile.clothRestitution / (1 + arrival / this.profile.clothSoftening);
      const rebound = clampRise(arrival * restitution, ball.z);
      // There is no ceiling: how high a ball goes is the rail geometry's
      // business, and a hard enough shot is meant to put one over the cushion.
      // There is a floor, though — without it a hop would ring down through ever
      // smaller bounces and hold the shot open, and worse, a ball a fraction of
      // a millimetre up is one that has stopped feeling friction while still
      // looking planted on the cloth.
      ball.vz = rebound <= PHYSICS.restVerticalSpeed ? 0 : rebound;
    }
  }

  /**
   * A ball rolling across the carpet meeting something standing on it.
   *
   * Resolved on the axis it is least far through, which is the standard way to
   * get a believable bounce out of an axis-aligned box: whichever side the ball
   * is nearest to escaping by is the side it must have come in through.
   */
  private bounceOffFurniture(b: Ball): void {
    const obstacles = this.table.obstacles;
    if (obstacles.length === 0) return;

    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      // Low things can be dropped onto rather than hit; the ball is on the floor
      // here, so anything shorter than the ball is stepped over.
      if (o.height < BALL_RADIUS) continue;

      const reachX = o.halfX + BALL_RADIUS;
      const reachY = o.halfY + BALL_RADIUS;
      const dx = b.p.x - o.x;
      const dy = b.p.y - o.y;
      if (Math.abs(dx) >= reachX || Math.abs(dy) >= reachY) continue;

      const escapeX = reachX - Math.abs(dx);
      const escapeY = reachY - Math.abs(dy);

      if (escapeX < escapeY) {
        b.p.x = o.x + Math.sign(dx || 1) * reachX;
        if (b.v.x * Math.sign(dx || 1) < 0) b.v.x = -b.v.x * o.restitution;
      } else {
        b.p.y = o.y + Math.sign(dy || 1) * reachY;
        if (b.v.y * Math.sign(dy || 1) < 0) b.v.y = -b.v.y * o.restitution;
      }
    }
  }

  /**
   * Balls that cleared a cushion and are no longer over the slate.
   *
   * Checked by position rather than by "did it get over the nose": a ball can go
   * up over a rail and still come down inside, and that is a legal, spectacular
   * shot. Only one that ends up beyond the cloth has actually left.
   */
  private resolveOffTable(): void {
    const margin = PHYSICS.offTableMargin;
    const limitX = this.table.halfLength + margin;
    const limitY = this.table.halfWidth + margin;

    for (const ball of this.balls) {
      if (!inPlay(ball)) continue;
      if (Math.abs(ball.p.x) <= limitX && Math.abs(ball.p.y) <= limitY) continue;

      ball.offTable = true;
      this.events.push({
        kind: 'off-table',
        t: this.time,
        ball: ball.number,
        speed: Math.hypot(ball.v.x, ball.v.y),
        x: ball.p.x,
        y: ball.p.y,
      });
    }
  }

  // ------------------------------------------------------------ persistence

  clone(): World {
    const copy = new World(this.table, this.balls.map(cloneBall), this.profile);
    copy.time = this.time;
    copy.events = this.events.slice();
    return copy;
  }

  serialize(): SerializedWorld {
    return { balls: this.balls.map(cloneBall), time: this.time };
  }

  static deserialize(
    state: SerializedWorld,
    table: Table = createTable(),
    profile: PhysicsProfile = DEFAULT_PROFILE,
  ): World {
    const world = new World(table, state.balls.map(cloneBall), profile);
    world.time = state.time;
    // A saved game must never come back with a ball lying on the floor. If one
    // was in the air when the game was written, it is put back where the rules
    // would have put it.
    world.returnBallsToTable();
    return world;
  }

  /**
   * Cheap fingerprint of ball positions, for asserting in tests that a replay
   * landed in exactly the same place.
   */
  stateHash(): string {
    return this.balls
      .map((b) => `${b.number}:${b.p.x.toFixed(6)},${b.p.y.toFixed(6)},${b.pocketed ? 1 : 0}`)
      .join('|');
  }
}
