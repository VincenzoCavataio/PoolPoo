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

  /**
   * How much of a ball's downward speed survives a bounce on the cloth, in the
   * limit of a gentle landing.
   *
   * The real figure falls as the impact gets harder — cloth over slate has
   * somewhere to go, and the harder it is hit the more of the blow it swallows.
   * See `clothSoftening`, which is what makes that happen and is not a detail:
   * a constant value has to be either too dead for a ball skipping off a rail or
   * far too lively for one slammed into the bed by another ball.
   */
  clothRestitution: number;

  /**
   * Speed scale over which the cloth stops giving anything back: the bounce
   * keeps `clothRestitution / (1 + speed / clothSoftening)` of the impact.
   */
  clothSoftening: number;
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
  clothRestitution: 0.7,
  clothSoftening: 1.5,
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

/**
 * Height of the cushion nose above the bed, as a fraction of a ball's diameter.
 * The WPA specification puts it at 62.5–64.5%.
 *
 * This one number is why balls hop off a rail, and it is worth spelling out
 * because the reason is not the obvious one. A ball's centre sits at half its
 * diameter, so a nose at 63.5% touches the ball **above** its centre: the rail
 * does not hit a ball squarely, it hits it slightly from above and drives it
 * down into the cloth, which then throws it back up. Nothing about hitting the
 * cue ball harder can produce that on its own — a horizontal blow through the
 * centre has no vertical component at all.
 */
export const CUSHION_NOSE_FRACTION = 0.635;

/**
 * Height of the nose above the bed, in metres: about 36.3 mm.
 *
 * Everything vertical follows from comparing this with where the ball's centre
 * happens to be, which is *not* a constant once balls can leave the cloth:
 *
 * - a ball on the cloth has its centre at 28.6 mm, below the nose, so the rail
 *   catches it from above and drives it down;
 * - lift the ball 7.7 mm and the contact is level with its centre — a pure
 *   horizontal rebound, no vertical at all;
 * - lift it further and the rail now catches it from *below* and throws it
 *   upwards, which is why a ball already hopping gets launched by a rail;
 * - lift it past the nose entirely and there is nothing left to hit. The ball
 *   goes over the cushion and off the table.
 */
export const CUSHION_NOSE_HEIGHT = CUSHION_NOSE_FRACTION * BALL_DIAMETER;

/**
 * How much of the geometric vertical share a real rail actually delivers.
 *
 * Unlike everything around it, this number is **calibrated, not derived**, and it
 * is worth being blunt about that. The geometry above assumes the nose is a rigid
 * edge, and a rigid edge is an upper bound: taken at face value it sends a ball
 * driven hard into a rail 160 mm into the air and put a third of hard shots on
 * the floor. Cushion rubber deforms, the contact is a patch rather than a line,
 * and the ball rides part of the way over instead of being levered up. This
 * factor is set so that a firm rail hit skips a few millimetres and the hardest
 * one in the game skips a couple of centimetres, which is what real tables do.
 */
export const CUSHION_COMPLIANCE = 0.8;

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

  /**
   * Below this vertical speed a ball stays glued to the cloth.
   *
   * This has to be set by what is *visible*, not by what is small, and getting
   * that backwards is a bug rather than a rough edge. A ball off the cloth feels
   * no friction, so it stops decelerating — and that reads on screen however
   * low it is. An earlier value of 0.12 m/s lifted balls by 0.7 mm, far too
   * little to see, and the result was a ball that appeared to be rolling along
   * the cloth while mysteriously refusing to slow down.
   *
   * So the floor is the height at which a hop becomes legible: this value puts
   * the ball about 6 mm up for a tenth of a second. Anything a rail can produce
   * below that leaves the ball down, where it keeps its friction and behaves.
   */
  restVerticalSpeed: 0.34,

  /** How far past the cushion line a ball must be to count as off the table. */
  offTableMargin: BALL_DIAMETER,

  /**
   * Half-extents of the room, in sim axes, so a ball on the floor stops at the
   * walls instead of rolling out through them.
   *
   * Sim `x` runs along the table's length and maps to the room's depth; sim `y`
   * runs across it and maps to the room's width. The renderer owns the room's
   * appearance, but where its walls are is something the solver has to know —
   * it is the only place that can stop a ball at them.
   */
  roomHalfX: 3.5 - BALL_RADIUS,
  roomHalfY: 2.6 - BALL_RADIUS,

  /**
   * Hard ceiling on how fast anything may be travelling upwards.
   *
   * This game has no elevated cue. Every shot is struck horizontally, and a
   * horizontal blow through the centre of a ball has no vertical component at
   * all — the only thing lifting a ball here is the dimple it rests in, which is
   * a fraction of a millimetre deep. So the honest upper bound on a hop is a
   * skip of a few centimetres, and anything larger is an artefact of some
   * contact geometry rather than a shot anybody played.
   *
   * A real jump needs the cue raised 30 degrees or more. When that becomes a
   * shot the player can choose, this ceiling is what has to be lifted with it —
   * deliberately, not by accident.
   *
   * Set to 70 mm: a touch over the 36 mm cushion nose, so a ball still rising
   * when it meets a rail can clear it and leave the table, while an ordinary hop
   * stays the centimetre-or-two skip that a flat cloth can justify.
   */
  maxVerticalSpeed: Math.sqrt(2 * 9.81 * 0.07),

  /**
   * How much of a hard shot's speed lifts the cue ball, from the dimple the
   * ball makes in the cloth: a horizontal blow pushes it slightly up and out of
   * its own depression. It scales with speed on its own, so only a hard shot
   * clears the threshold above and produces a hop at all.
   */
  cueDimpleLift: 0.075,

  /**
   * Lift a ball gets from being struck hard by another ball, as a share of the
   * closing speed.
   *
   * The same dimple the cue ball climbs out of is under every ball on the table,
   * so a ball taking a hard blow does not simply set off along the cloth: it has
   * to ride up out of its own depression first. This is why balls spit upwards
   * out of a rack on a heavy break, and it is what makes hopping something every
   * ball on the table does rather than a trick reserved for the cue ball.
   *
   * The solver spends it by turning the ball's velocity slightly upwards rather
   * than adding to it, so the climb is paid for out of the ball's own speed.
   */
  ballDimpleLift: 0.12,

  /**
   * Extra lift when the tip lands low, which is where a hopping cue ball comes
   * from — and, at full power, where a cue ball leaving the table comes from.
   *
   * Hitting low presses the ball into its own dimple before it moves, so it
   * climbs out of a deeper hole. This is why a hard draw shot visibly jumps
   * while a hard centre-ball shot only skips.
   */
  cueDimpleDrawLift: 1.5,

  /** Safety valve: a shot is force-stopped after this long. */
  maxShotSeconds: 30,

  /**
   * Furthest the tip may strike from the ball's centre, as a fraction of the
   * radius. Past roughly half a radius a real cue miscues, and 0.4 is the
   * classic natural-roll contact point — so full power on this scale is a touch
   * beyond pure follow.
   */
  maxTipOffset: 0.45,

  /**
   * Furthest the tip may strike from the centre *sideways*, as a fraction of the
   * radius — a separate, smaller limit than the vertical one.
   *
   * They were one number, so dialling the english down also weakened draw and
   * follow, which is the wrong trade: the vertical spin is well behaved and the
   * side spin was not. A real cue can reach the same distance in any direction,
   * but a horizontal blow that far off the vertical axis is exactly the one that
   * miscues, so a tighter usable range is honest as well as convenient.
   */
  maxSideTipOffset: 0.28,
} as const;

/**
 * Substep length is chosen so a ball never travels more than this fraction of
 * its radius per substep. Without it, a break-speed ball would jump clean
 * through another ball inside a single tick.
 */
export const MAX_TRAVEL_PER_SUBSTEP = BALL_RADIUS * 0.5;
