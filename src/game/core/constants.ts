/**
 * Physical constants and tuning knobs, all in SI units (metres, seconds).
 *
 * These are the only numbers that decide how the game *feels*, so they live
 * together instead of being scattered through the solver. Real-world values are
 * noted where they exist; the rest is taste.
 */

/** Regulation pool ball: 57.15 mm diameter. */
export const BALL_RADIUS = 0.028575;
export const BALL_DIAMETER = BALL_RADIUS * 2;

/**
 * How the cloth and the cushions behave.
 *
 * Split out from `PHYSICS` because the table's cloth is now a choice the player
 * makes, and a fast cloth is not merely a different colour — it slides further
 * and comes off the rails harder. Every world carries one of these.
 */
export interface PhysicsProfile {
  /**
   * Rolling resistance once the ball has stopped sliding. Deceleration is
   * `mu * g` — a constant, which is what Coulomb friction gives you and what
   * makes a ball actually stop. Linear velocity damping would instead decay
   * towards zero forever and leave balls creeping across the cloth.
   */
  rollingFriction: number;

  /**
   * Kinetic friction while the contact point is still slipping. Much larger
   * than rolling resistance: this is the phase that turns a struck ball's spin
   * into motion, and it is where follow and draw come from.
   */
  slidingFriction: number;

  /** Decay of spin about the vertical axis — english bleeding away. */
  spinningFriction: number;

  /** Ball-on-ball is nearly elastic. */
  ballRestitution: number;

  /** Tangential friction between two balls, which is what throws a cut shot. */
  ballFriction: number;

  /** Cushions eat far more energy than balls do. */
  cushionRestitution: number;

  /** Tangential velocity lost when scraping along a cushion. */
  cushionFriction: number;

  /** How strongly english pushes the ball sideways off a rail. */
  cushionSpinTransfer: number;

  /** Fraction of english scrubbed off by a rail. */
  cushionSpinLoss: number;
}

export const DEFAULT_PROFILE: PhysicsProfile = {
  rollingFriction: 0.06,
  slidingFriction: 0.2,
  spinningFriction: 0.022,
  ballRestitution: 0.95,
  ballFriction: 0.06,
  cushionRestitution: 0.75,
  cushionFriction: 0.2,
  cushionSpinTransfer: 0.25,
  cushionSpinLoss: 0.4,
};

/**
 * How much faster the contact-point slip dies away than the ball's own speed.
 *
 * One friction impulse does two things at once: it slows the centre by `J/m`
 * and spins the ball up, which moves the contact point by a further
 * `2.5 · J/m` (a sphere's moment of inertia is `2/5 mR²`). The slip therefore
 * closes at `3.5 ×` the rate the centre slows down, so the step that lands
 * exactly on rolling is `slip / 3.5` — which is also the classic result that a
 * struck ball loses `2/7` of its speed before it rolls.
 *
 * The solver clamps every sliding step to this. It has to: the energy change
 * over one uncapped step of size `a` is `-m·a·(slip - 1.75a)`, which turns
 * *positive* once the slip falls below `1.75a`. Past that point friction would
 * pump energy into the ball instead of taking it out.
 */
export const SLIP_DECAY = 3.5;

export const PHYSICS = {
  gravity: 9.81,

  /** Below this speed a ball is parked, so shots terminate in finite time. */
  sleepSpeed: 0.012,


  /**
   * The simulation only ever advances in whole `fixedDt` ticks. Both the
   * renderer (accumulator in `useFrame`) and the headless rules layer use this
   * value, which is what keeps the two bit-identical.
   */
  fixedDt: 1 / 120,

  /** Upper bound on adaptive substeps within one tick. */
  maxSubsteps: 24,

  /** Cue ball speed at full power. A hard break is around 8 m/s in reality. */
  maxShotSpeed: 6.5,

  /** Safety valve: a shot is force-stopped after this long. */
  maxShotSeconds: 30,

  /**
   * Furthest the tip may strike from the ball's centre, as a fraction of the
   * radius. Past roughly half a radius a real cue miscues, and 0.4 is the
   * classic natural-roll contact point — so full power on this scale is a touch
   * beyond pure follow.
   */
  maxTipOffset: 0.45,
} as const;

/**
 * Substep length is chosen so a ball never travels more than this fraction of
 * its radius per substep. Without it, a break-speed ball would jump clean
 * through another ball inside a single tick.
 */
export const MAX_TRAVEL_PER_SUBSTEP = BALL_RADIUS * 0.5;
