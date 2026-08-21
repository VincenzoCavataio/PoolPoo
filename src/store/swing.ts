/**
 * Power, taken from how long the shoot button is held.
 *
 * There is no slider. The button starts at nothing and winds up while it is
 * held: the ring around it fills, the cue starts to shake, and letting go plays
 * the shot at whatever had been wound on. Keep holding past a full charge and it
 * runs into an overcharge — still a legal shot, and a wild one, because the ball
 * is now being struck harder than the table is meant to take.
 *
 * The whole control is *how long*, which is what makes it a decision rather than
 * a setting. A slider is something you adjust until it is right and then forget;
 * a charge is a thing you have to stop.
 *
 * Lives in its own store rather than inside the button, because three things
 * have to agree about it — the button that draws the ring, the cue in the 3D
 * scene that shakes as the charge builds, and the flash at the moment of
 * contact.
 */

import { makeMutable } from 'react-native-reanimated';
import { create } from 'zustand';

/**
 * The live charge, on the UI thread.
 *
 * A module value rather than a hook because three separate components animate
 * from it — the ring, the percentage and the cue — and they must all read the
 * *same* number. The store below carries a sampled copy for anything that needs
 * to re-render on it; this is the one that is smooth.
 *
 * Kept out of the store deliberately: writing sixty times a second to zustand
 * would re-render the whole control tree every frame.
 */
export const chargeValue = makeMutable(0);

/**
 * How long a full charge takes, and how long the overcharge lasts beyond it.
 *
 * The full sweep is deliberately slow enough to stop deliberately: a soft safety
 * and a firm positional shot are only a couple of hundred milliseconds apart, so
 * the charge has to be readable rather than a reflex.
 */
export const CHARGE_MS = 1400;

/**
 * How long the overcharge runs past a full charge.
 *
 * Half as long again as it takes to reach 100%, which puts the ceiling at 150%.
 * Long enough that going past full is a decision rather than a slip, short
 * enough that holding on is never the obvious play.
 */
export const OVERCHARGE_MS = CHARGE_MS * 0.5;

/**
 * The most that can be wound on, as a multiple of a full charge.
 *
 * Past 1 the shot is overcharged. It keeps climbing to give the overcharge a
 * shape — holding a moment too long and holding far too long should not be the
 * same shot — and then stops, because a button held for ever is somebody who has
 * put the phone down.
 */
export const MAX_CHARGE = 1 + OVERCHARGE_MS / CHARGE_MS;

/**
 * The two ways a shot is mishit: not swinging at all, and swinging too hard.
 *
 * A tap is a jab at the ball before the arm has come through; holding right to
 * the ceiling is a snatch. Both are miscues.
 *
 * There used to be a whole band under 20% that miscued as well, which was wrong:
 * a soft shot is a legitimate shot — safeties and delicate positional play are
 * *made* of them — and punishing the bottom of the scale meant the gentlest
 * quarter of the range could not be used at all. Now only a charge of nothing
 * counts, so releasing early gives you a soft shot rather than a penalty.
 */
export const MISCUE_UNDER = 0;

/**
 * Where the overcharge stops being a gamble and becomes a mishit.
 *
 * 1.3, not 1.1. At 1.1 the whole overcharge was 140 milliseconds wide — too
 * narrow to aim for, which made it a trap rather than a choice: anybody
 * deliberately going past full would have overshot into a miscue almost every
 * time. At 1.3 there is about 420 ms of it, which is long enough to take on
 * purpose and still short enough to be a risk.
 */
export const MISCUE_OVER = 1.3;

export type ChargeZone = 'miscue' | 'safe' | 'over';

export function zoneFor(charge: number): ChargeZone {
  // `<=` at the bottom, so only a charge of literally nothing is a miscue; any
  // amount of swing, however small, is a real shot.
  if (charge <= MISCUE_UNDER || charge > MISCUE_OVER) return 'miscue';
  return charge > 1 ? 'over' : 'safe';
}

/** Whether a charge lands in one of the two miscue bands. */
export function isMiscue(charge: number): boolean {
  return zoneFor(charge) === 'miscue';
}

/**
 * The power a charge plays at.
 *
 * A full charge is full power. An overcharge cannot go past it — the solver's
 * scale stops at 1 — so what the extra buys is not more speed but *less
 * control*: see `wildnessFor`, which is where the risk actually lives.
 */
export function powerFor(charge: number): number {
  /*
   * A miscue does not move the ball at all.
   *
   * Zero, not a trickle. The tip goes past the ball entirely — that is what the
   * swing animation shows — so there is no contact to put anything into it, and
   * a cue ball that crept two centimetres was telling a different story from the
   * cue that visibly missed it.
   *
   * It is still a foul, and by the ordinary rules rather than a special one: the
   * cue ball touches nothing and reaches no cushion, which is exactly what the
   * WPA book calls a foul. There is no separate penalty for a miscue there
   * either — it is a foul for what it fails to do, not for what it is.
   */
  if (isMiscue(charge)) return 0;
  return Math.min(1, charge);
}

/**
 * How wild an overcharged shot is, 0 to 1.
 *
 * A snatched cue does not simply hit harder, it hits *badly*: the tip lands off
 * where it was aimed, and that is what sends a ball off the table rather than
 * raw speed alone. Zero for any shot struck cleanly inside a full charge, so the
 * ordinary game is untouched by this.
 */
export function wildnessFor(charge: number): number {
  // A miscue goes wherever it goes; that is what makes it a miscue.
  if (isMiscue(charge)) return 1;
  if (charge <= 1) return 0;
  return Math.min(1, (charge - 1) / (MAX_CHARGE - 1));
}

/**
 * How much the cue shakes at a given charge.
 *
 * Nothing until the charge is well under way, then climbing steeply — a hand
 * winding up harder and harder is a hand that is less and less steady. Past a
 * full charge it is at its worst and stays there, which is the visible warning
 * that the shot has gone past what it should be.
 */
export function shakeFor(charge: number): number {
  if (charge < 0.4) return 0;
  const t = Math.min(1, (charge - 0.4) / 0.6);
  return t * t;
}


interface SwingState {
  /** Whether the button is being held. */
  charging: boolean;
  /** How far the charge has wound. 1 is full; above that is overcharge. */
  charge: number;
  /**
   * The last shot that was mishit, if it was.
   *
   * The id changes every time so two miscues in a row both announce themselves;
   * without it the value would not change and nothing downstream would notice.
   * It is also the clock the swing animation runs from.
   *
   * Cleared by the next shot rather than by whoever read it: the animation needs
   * it to survive the whole swing, and a reader that cleared it on sight would
   * cut the cue off mid-lunge.
   */
  miscue: {
    id: number;
    charge: number;
    /**
     * Which way the cue slipped, so the animation can show it.
     *
     * Chosen once when the shot is played rather than by the renderer, because
     * the swing and the message have to agree — and because a value picked in a
     * frame loop would be a different direction every frame.
     */
    slip: 'left' | 'right' | 'high';
  } | null;

  start: () => void;
  setCharge: (charge: number) => void;
  /** Ends the hold and records it, returning the charge that was wound on. */
  release: () => number;
  /**
   * Records a shot played without charging at all.
   *
   * A tap is a jab at the ball: the cue never came back, so it is a miscue in
   * the same way that snatching at it is, and it has to be reported the same
   * way. Returns zero, which is the charge it represents.
   */
  tap: () => number;
  /** Ends without playing, for a shot cancelled or interrupted. */
  cancel: () => void;
}

/**
 * Which way a mishit cue goes.
 *
 * Random, and it has to be: a miscue that always slipped the same way would be
 * a animation rather than a mistake, and after two of them you would stop
 * reading it. High is rarer than the two sides because a cue riding up over the
 * ball is the less common way to miss it.
 */
function pickSlip(): 'left' | 'right' | 'high' {
  const roll = Math.random();
  if (roll < 0.4) return 'left';
  if (roll < 0.8) return 'right';
  return 'high';
}

export const useSwing = create<SwingState>((set, get) => ({
  charging: false,
  charge: 0,
  miscue: null,

  // The record is cleared as the next shot is wound up, which is what stops the
  // swing animation from replaying over an aim that has already moved on.
  start: () => set({ charging: true, charge: 0, miscue: null }),
  setCharge: (charge) => set({ charge: Math.min(MAX_CHARGE, Math.max(0, charge)) }),

  release: () => {
    const { charging, charge } = get();
    if (!charging) return 0;

    set({
      charging: false,
      charge: 0,
      miscue: isMiscue(charge) ? { id: Date.now(), charge, slip: pickSlip() } : null,
    });
    return charge;
  },

  tap: () => {
    set({ charging: false, charge: 0, miscue: { id: Date.now(), charge: 0, slip: pickSlip() } });
    return 0;
  },

  cancel: () => set({ charging: false, charge: 0, miscue: null }),
}));
