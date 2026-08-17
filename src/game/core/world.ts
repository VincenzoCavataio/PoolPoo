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
  DEFAULT_PROFILE,
  MAX_TRAVEL_PER_SUBSTEP,
  PHYSICS,
  type PhysicsProfile,
} from './constants';
import type { ShotEvent } from './events';
import { clampToPlayable, createTable, footSpot, headSpot, type Table } from './table';
import type { Vec2 } from './vec';

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

  /** Object balls still on the table. */
  remainingObjectBalls(): Ball[] {
    return this.balls.filter((b) => b.number !== 0 && !b.pocketed);
  }

  /**
   * A shot is over only when nothing is moving *and* nothing is still slipping.
   *
   * Checking speed alone would end a draw shot the instant the cue ball paused,
   * a moment before its backspin dragged it back up the table.
   */
  get atRest(): boolean {
    const threshold = PHYSICS.sleepSpeed * PHYSICS.sleepSpeed;
    for (const b of this.balls) {
      if (b.pocketed) continue;
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
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    // Everything starts the shot still, so replaying from a snapshot is exact.
    for (const ball of this.balls) {
      ball.v.x = 0;
      ball.v.y = 0;
      ball.w.x = 0;
      ball.w.y = 0;
      ball.w.z = 0;
    }

    cue.v.x = dirX * speed;
    cue.v.y = dirY * speed;

    const side = clampUnit(spin.side) * PHYSICS.maxTipOffset * BALL_RADIUS;
    const vertical = clampUnit(spin.vertical) * PHYSICS.maxTipOffset * BALL_RADIUS;

    // Side axis: the shot direction turned left, which is the up axis crossed
    // with the direction.
    const sideAxisX = -dirY;
    const sideAxisY = dirX;

    const gain = (5 * speed) / (2 * BALL_RADIUS * BALL_RADIUS);
    cue.w.x = gain * vertical * sideAxisX;
    cue.w.y = gain * vertical * sideAxisY;
    cue.w.z = -gain * side;

    this.time = 0;
    this.events = [];
  }

  /** Parks every ball. Called once a shot has come to rest. */
  settle(): void {
    for (const b of this.balls) {
      b.v.x = 0;
      b.v.y = 0;
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
    cue.w.x = 0;
    cue.w.y = 0;
    cue.w.z = 0;
    cue.pocketed = false;
    cue.pocketedIn = null;
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
      if (b.pocketed || b.number === ignoreNumber) continue;
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
      if (b.pocketed) continue;
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
    const rollDecel = profile.rollingFriction * g * h;
    const spinDecel = (5 * profile.spinningFriction * g * h) / (2 * BALL_RADIUS);
    // Friction at the contact point twists the ball as well as slowing it.
    const angularGain = (5 * profile.slidingFriction * g * h) / (2 * BALL_RADIUS);

    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.pocketed) continue;

      // Velocity of the point touching the cloth: v + w × (-R ẑ).
      const slipX = b.v.x - BALL_RADIUS * b.w.y;
      const slipY = b.v.y + BALL_RADIUS * b.w.x;
      const slip = Math.sqrt(slipX * slipX + slipY * slipY);

      if (slip > PHYSICS.slipEpsilon) {
        const dirX = slipX / slip;
        const dirY = slipY / slip;

        b.v.x -= slideDecel * dirX;
        b.v.y -= slideDecel * dirY;
        b.w.x -= angularGain * dirY;
        b.w.y += angularGain * dirX;

        // Friction can only cancel the slip, never reverse it. When a step would
        // overshoot, the ball has reached rolling and is snapped exactly onto it.
        const nextSlipX = b.v.x - BALL_RADIUS * b.w.y;
        const nextSlipY = b.v.y + BALL_RADIUS * b.w.x;
        if (nextSlipX * dirX + nextSlipY * dirY <= 0) {
          b.w.x = -b.v.y / BALL_RADIUS;
          b.w.y = b.v.x / BALL_RADIUS;
        }
      } else {
        // Rolling: constant deceleration, clamped so friction cannot push a ball
        // backwards, with the spin held on the rolling constraint.
        const speed = Math.sqrt(b.v.x * b.v.x + b.v.y * b.v.y);
        if (speed > 0) {
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
      if (b.pocketed) continue;
      b.p.x += b.v.x * h;
      b.p.y += b.v.y * h;
    }

    this.time += h;

    this.resolveBallContacts();
    this.resolveCushionContacts();
    this.resolvePockets();
  }

  private resolveBallContacts(): void {
    const balls = this.balls;
    const restitution = this.profile.ballRestitution;
    const friction = this.profile.ballFriction;
    const minD2 = BALL_DIAMETER * BALL_DIAMETER;

    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.pocketed) continue;

      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.pocketed) continue;

        const dx = b.p.x - a.p.x;
        const dy = b.p.y - a.p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD2) continue;

        let nx: number;
        let ny: number;
        let d: number;
        if (d2 === 0) {
          // Coincident centres leave the normal undefined; pick one.
          nx = 1;
          ny = 0;
          d = 0;
        } else {
          d = Math.sqrt(d2);
          nx = dx / d;
          ny = dy / d;
        }

        // Positional correction first, so resting balls stay exactly touching
        // instead of sinking into each other and jittering.
        const half = (BALL_DIAMETER - d) * 0.5;
        a.p.x -= nx * half;
        a.p.y -= ny * half;
        b.p.x += nx * half;
        b.p.y += ny * half;

        const vn = (b.v.x - a.v.x) * nx + (b.v.y - a.v.y) * ny;
        if (vn >= 0) continue; // already separating

        // Equal masses: half the closing impulse to each, along the normal.
        const impulse = (-(1 + restitution) * vn) * 0.5;
        a.v.x -= nx * impulse;
        a.v.y -= ny * impulse;
        b.v.x += nx * impulse;
        b.v.y += ny * impulse;

        // Throw: the two surfaces slide across each other at the contact, and
        // friction there nudges the object ball off the pure geometric line —
        // which is why english changes where a cut shot goes.
        const tx = -ny;
        const ty = nx;
        const surfaceSlip =
          (b.v.x - a.v.x) * tx +
          (b.v.y - a.v.y) * ty -
          BALL_RADIUS * (a.w.z + b.w.z);

        if (surfaceSlip !== 0 && impulse > 0) {
          const magnitude = Math.min(friction * impulse, Math.abs(surfaceSlip) * 0.5);
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

  private resolveCushionContacts(): void {
    const cushions = this.table.cushions;
    const profile = this.profile;
    const r2 = BALL_RADIUS * BALL_RADIUS;

    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      if (ball.pocketed) continue;

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
        if (d2 >= r2) continue;

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

        ball.p.x = cx + nx * BALL_RADIUS;
        ball.p.y = cy + ny * BALL_RADIUS;

        const vn = ball.v.x * nx + ball.v.y * ny;
        if (vn >= 0) continue;

        const tx = -ny;
        const ty = nx;
        const vt = ball.v.x * tx + ball.v.y * ty;

        // Reflect the normal component; scrub the tangential one and let english
        // push the ball along the rail. Running english widens the angle off the
        // cushion, reverse english tightens it.
        const outVn = -vn * profile.cushionRestitution;
        const outVt =
          vt * (1 - profile.cushionFriction) +
          profile.cushionSpinTransfer * BALL_RADIUS * ball.w.z;

        ball.v.x = tx * outVt + nx * outVn;
        ball.v.y = ty * outVt + ny * outVn;
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
      if (ball.pocketed) continue;

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
