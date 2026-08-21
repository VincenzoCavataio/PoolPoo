/**
 * The live game.
 *
 * The `World` lives in this store but is *mutated in place* by the render loop
 * and never handed to `set` during a shot: sixteen balls moving at 120 Hz would
 * otherwise re-render the whole UI a hundred times a second. React only hears
 * about a shot when it settles, which is the one moment the HUD has anything new
 * to say.
 *
 * The camera view is driven from here rather than chosen in the options, because
 * the game decides it: aiming puts the player behind the cue, taking the shot
 * lifts them up to watch it, and settling drops them back down.
 *
 * The action replay is the payoff of a deterministic solver. Nothing is
 * recorded frame by frame — the shot is simply *played again* from a serialised
 * snapshot with the same angle and power, fast-forwarded headlessly to just
 * before the ball drops and then run at four-tenths speed.
 */

import { create } from 'zustand';

import { clothProfile } from '@/constants/game-theme';
import { PHYSICS } from '@/game/core/constants';
import { createTable, type PocketId } from '@/game/core/table';
import { effectiveLocation, obstaclesFor } from '@/game/render/locations';
import { angleOf, dist2, sub } from '@/game/core/vec';
import { NO_SPIN, World, type SerializedWorld, type ShotSpin } from '@/game/core/world';
import { planShot, type Difficulty } from '@/game/ai/opponent';
import { detectShot, emptyRunState, type TrophyRunState } from '@/game/trophies/detect';
import { useTrophies } from '@/store/trophies';
import { msg, type Message } from '@/i18n';
import { CameraMode } from '@/game/render/camera';
import {
  createMatch,
  cpusIn,
  currentCall,
  currentCpu,
  currentSeat,
  isFinished,
  legalTargets,
  needsCall,
  onTheEight,
  partnersOf,
  playerCount as matchPlayerCount,
  rerackDone,
  resolveShot,
  shotsTaken,
  standings,
  targetOf,
  teamOfSeat,
  teamSizes,
  wantsRerack,
  winningSeats,
  withCall,
  type Match,
} from '@/game/rules/match';
import {
  GameModeKind,
  Phase,
  type ShotOutcome,
  type Standing,
} from '@/game/rules/types';

import { isMiscue, powerFor, wildnessFor } from './swing';
import { clearSavedGame, SAVE_VERSION, saveGame, type SavedGame } from './persistence';
import { useSettings } from './settings';

/**
 * Time left over between fixed ticks. Module-level rather than store state
 * because it changes every frame and nothing should re-render for it.
 */
let accumulator = 0;
let replayAccumulator = 0;

/**
 * What the trophy detector remembers between shots of a game.
 *
 * Module-level next to the other per-shot scratch state, and reset wherever a
 * game starts — a streak carried into a new frame would hand out a run somebody
 * never played.
 */
let trophyRun: TrophyRunState = emptyRunState();

/**
 * The shape of a computer's turn, in milliseconds.
 *
 * Long enough to read as somebody deciding, short enough not to be a wait: a
 * machine that answers instantly does not feel like an opponent, and one that
 * takes three seconds feels like the app has hung. About a second and a half in
 * total, most of it spent visibly aiming.
 */
const CPU_LOOK_MS = 450;
const CPU_AIM_MS = 650;
const CPU_DRAW_MS = 320;
/** How often the turn advances. 60Hz would gain nothing a cue swing can show. */
const CPU_TICK_MS = 33;

/** The computer's turn in progress, so it can be cancelled if the game goes. */
let cpuTimer: ReturnType<typeof setInterval> | null = null;

function cancelCpuTurn(): void {
  if (cpuTimer === null) return;
  clearInterval(cpuTimer);
  cpuTimer = null;
}

/** Ceiling on catch-up work after a stutter, so a slow frame cannot cascade. */
const MAX_ACCUMULATED = 0.25;

export const DEFAULT_POWER = 0.55;

/**
  * Replay pacing.
  *
  * The window either side of the pots, and a *target duration* rather than a
  * fixed speed. A fixed speed was the bug behind short replays flashing past: a
  * ball potted a quarter of a second after the break leaves almost no window,
  * and at four-tenths speed that is over before the eye finds it. Solving for
  * the speed instead means every replay lasts about the same, whether it covers
  * one pot at the start of the shot or four spread across it.
  */
const REPLAY_LEAD = 0.85;
const REPLAY_TRAIL = 0.55;
/** Longer tail for a ball going off the table: the fall is the whole point. */
const REPLAY_FALL_TRAIL = 1.5;
/**
 * How long a replay should last, and how much longer a busy one gets.
 *
 * A single pot and a shot that drops four both used to be squeezed into the same
 * 2.6 seconds, which meant the busy one — the one actually worth watching — ran
 * fastest. The target now grows with the number of moments, so a treble is given
 * the time to be read as three separate things rather than a blur.
 */
const REPLAY_TARGET_SECONDS = 3.2;
const REPLAY_SECONDS_PER_EXTRA_MOMENT = 0.7;
const REPLAY_MAX_TARGET_SECONDS = 5;

/**
 * The floor was 0.12 — an eighth of real time, which is not slow motion so much
 * as a still picture, and it was reached often because the window before the
 * first pot is frequently short. Raising it means a tight window plays at a
 * readable crawl instead of appearing to freeze.
 */
const REPLAY_MIN_SPEED = 0.22;
const REPLAY_MAX_SPEED = 0.8;

/**
 * How much of a settled shot's tail is run out in one frame.
 *
 * Six hundred ticks is five seconds of simulation, which covers the longest roll
 * a ball can have across the floor. It is spent in a single frame — one dropped
 * frame at the moment the shot ends, against several seconds of waiting.
 */
const FAST_FORWARD_TICKS = 600;

/**
 * A moment in a shot worth replaying.
 *
 * Either a ball dropping into a pocket or one leaving the table altogether.
 * They share a type because they want identical treatment: both are the payoff
 * of the shot, both want the camera taken to them, and a shot can produce
 * several of either in one go.
 */
export type ReplayMoment =
  | { kind: 'pot'; t: number; ball: number; pocket: PocketId }
  | { kind: 'fall'; t: number; ball: number; at: { x: number; y: number } };

export interface ReplayState {
  /** A second world, replaying the shot; the real one keeps its settled state. */
  world: World;
  /** Simulated time at which the replay stops. */
  until: number;
  /**
   * Everything the shot did that is worth watching, in order.
   *
   * The camera walks this list rather than being pinned to one place: a shot
   * that drops three balls used to replay only the first, which made the other
   * two look like they had never happened.
   */
  moments: ReplayMoment[];
  /** Time scale, solved for so short and long replays feel the same length. */
  speed: number;
}

export interface Celebration {
  kind: 'pot' | 'foul';
  /** Ball numbers potted, for the overlay to name them. */
  balls: number[];
  reason: Message | null;
  /** Points lost, shown outright so a foul reads as a cost and not just a scold. */
  penalty: number;
  /** Changes every time, so the overlay restarts its animation. */
  id: number;
}

interface PendingShot {
  snapshot: SerializedWorld;
  angle: number;
  power: number;
  spin: ShotSpin;
}

export interface SessionState {
  mode: GameModeKind | null;
  world: World | null;
  phase: Phase;
  /**
   * The game in progress, whichever discipline it is.
   *
   * Replaces the old `free` field. The modes keep separate state shapes because
   * they genuinely differ — eight-ball has teams and no score, straight pool has
   * runs and a target — so this is a tagged union rather than one struct with
   * everything optional.
   */
  match: Match | null;
  /**
   * The scoreboard, flattened.
   *
   * Kept beside the match so the HUD can render without knowing the ruleset.
   * Recomputed whenever the match changes, which is once per shot.
   */
  standings: Standing[];
  aimAngle: number;
  power: number;
  /** Where the tip strikes the cue ball. Resets to centre after every shot. */
  spin: ShotSpin;
  /** Which view is live. Driven by the phase; the player may override while aiming. */
  cameraMode: CameraMode;
  replay: ReplayState | null;
  celebration: Celebration | null;
  /** Lines describing the last shot, still untranslated. */
  messages: Message[];
  lastOutcome: ShotOutcome | null;
  /** Bumped when the ball set changes, so the scene remounts. */
  gameId: number;
  /**
   * Whether the table is held still.
   *
   * Set while a panel is open over the game. The solver is not stepped and the
   * clock does not run, so a shot in flight resumes exactly where it was left
   * rather than having quietly played on behind the panel — which would mean
   * opening the scoreboard could cost you the frame.
   */
  paused: boolean;
  setPaused: (value: boolean) => void;

  /**
   * Starts a game under the given rules.
   *
   * `startFree` stays as the name every existing caller uses, now with the mode
   * as its first argument — renaming it would have touched five screens to say
   * the same thing.
   */
  startGame: (
    kind: Match['kind'],
    playerCount: number,
    names: string[],
    cpus?: (Difficulty | undefined)[],
  ) => void;
  /** Names the ball and pocket for the coming shot, in the called modes. */
  setCall: (call: { ball: number; pocket: PocketId } | null) => void;
  resume: (save: SavedGame) => boolean;
  setAimAngle: (angle: number) => void;
  nudgeAim: (delta: number) => void;
  setPower: (power: number) => void;
  setSpin: (spin: ShotSpin) => void;
  setCameraMode: (mode: CameraMode) => void;
  /**
   * Plays the shot.
   *
   * `charge` is how long the shoot button was held: 1 is a full wind-up, above
   * that an overcharge, and 0 a tap — which is a miscue, the same as holding too
   * long. Omitted entirely by the computer, which has no button to hold and sets
   * `power` directly.
   */
  takeShot: (charge?: number) => void;
  skipReplay: () => void;
  dismissCelebration: () => void;
  /** Called from `useFrame`; does not touch React state until something ends. */
  stepSimulation: (delta: number) => void;
  leaveGame: () => void;
  persistNow: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => {
  let pending: PendingShot | null = null;

  /** Points the cue at the nearest remaining ball, so aiming starts sensibly. */
  const aimAtNearestTarget = () => {
    const { world } = get();
    const cue = world?.cueBall();
    if (!world || !cue || cue.pocketed) return;

    const targets = world.remainingObjectBalls();
    if (targets.length === 0) return;

    let nearest = targets[0];
    let nearestDistance = Infinity;
    for (const target of targets) {
      const d = dist2(cue.p, target.p);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = target;
      }
    }
    set({ aimAngle: angleOf(sub(nearest.p, cue.p)) });
  };

  /**
   * Whether the shot now being played was mishit, and which way.
   *
   * Set when the shot is struck and read when it settles, because the ticker
   * only speaks between shots — by which time the charge that caused it is long
   * gone.
   */
  let lastMiscue: 'rushed' | 'snatched' | null = null;

  const buildSave = (): SavedGame | null => {
    const { mode, world, match } = get();
    if (!mode || !world || !match) return null;
    return {
      version: SAVE_VERSION,
      mode,
      world: world.serialize(),
      match,
      savedAt: new Date().toISOString(),
    };
  };

  /**
   * Whether the shot just watched was the one that ended the game.
   *
   * Set when the rules say so and read once the replay is over, because the two
   * are no longer the same moment: the frame ends, the replay of it plays, and
   * only then does the board go up.
   */
  let gameEnded = false;

  const finishTurn = () => {
    /*
     * A finished game goes to the result rather than back to the table.
     *
     * Reached from the end of the replay as well as directly, which is the whole
     * point: the winning shot gets watched first.
     */
    if (gameEnded) {
      gameEnded = false;
      set({ phase: Phase.GAME_OVER, replay: null });
      return;
    }

    /**
     * Balls that were driven off the table come back here rather than the moment
     * the shot settles.
     *
     * The rules have already read the event log and charged the foul, so this is
     * only putting the pieces back on the board. Waiting until the turn actually
     * changes hands is what lets the replay show the ball sailing off in the
     * first place — return it any earlier and it teleports back to the spot
     * before anyone has seen it go.
     */
    get().world?.returnBallsToTable();

    // Spin goes back to centre ball: carrying heavy draw silently into the next
    // shot is a way to lose a frame without ever knowing why.
    set({ phase: Phase.AIMING, cameraMode: CameraMode.CUE, replay: null, spin: NO_SPIN });
    aimAtNearestTarget();
    const save = buildSave();
    if (save) void saveGame(save);

    takeCpuTurnIfNeeded();
  };

  /**
   * Hands the table to the computer when the seat that just came up is one.
   *
   * Delayed rather than immediate, and the delay is the point: a machine that
   * shoots the instant the balls stop reads as a glitch rather than as an
   * opponent. A beat to "look at the table" is what makes it legible as somebody
   * taking their turn — and it also gives the player a moment to see the
   * position before it changes.
   *
   * Guarded on the phase at the moment the timer fires, not when it is set: a
   * player who backs out to the menu in between must not come back to a shot
   * being played on an abandoned game.
   */
  const takeCpuTurnIfNeeded = () => {
    const { match, phase } = get();
    if (!match || isFinished(match) || phase !== Phase.AIMING) return;

    const level = currentCpu(match);
    if (!level) return;

    const world = get().world;
    if (!world) return;

    /*
     * What this seat is allowed to aim at, and who is on its side.
     *
     * `targets` is null in every mode but eight-ball, where it is the shooter's
     * own group — or the black once that group is clear. Without it the computer
     * plays whatever is easiest and fouls on its own turn, which reads less like
     * a weak opponent than like a broken one.
     *
     * `partners` is empty outside eight-ball and in singles too, so it costs
     * nothing where it does not apply.
     */
    const shot = planShot(world, level, Date.now() & 0xffff, {
      targets: legalTargets(match, world) ?? undefined,
      partners: partnersOf(match, currentSeat(match)),
    });
    if (!shot) return;

    /*
     * In the called modes the computer has to say what it is going for.
     *
     * The planner already knows — it chose a ball and a pocket — so this only
     * records that choice where the rules will look for it. A computer that
     * shot without calling would foul on every visit.
     */
    if (shot.call) set({ match: withCall(get().match ?? match, shot.call) });

    cancelCpuTurn();

    /*
     * Behind the cue, whatever the last player left the camera on.
     *
     * `takeShot` refuses to play from the overhead view — you line a shot up
     * from behind the cue, not from the ceiling — so a player who wandered off
     * to look at the table from above and then handed over would have left the
     * computer unable to shoot at all, waiting forever on a turn it could never
     * take. It is also the view its aiming is worth watching from.
     */
    set({ cameraMode: CameraMode.CUE });

    /**
     * The computer plays the controls rather than the outcome.
     *
     * It used to set the aim, the power and the shot in one statement, which is
     * correct and reads as nothing at all: the table simply erupted. A person at
     * a table does three separable things — they look, they line up, and they
     * strike — and the interface already draws two of them, so the opponent
     * drives those instead of stepping around them.
     *
     * Three phases, each with a job:
     *
     *  - **look** — a beat before anything moves, so the turn is legibly somebody
     *    else's rather than a delayed reaction to the last shot;
     *  - **aim** — the cue swings round to the shot, at a speed a hand could
     *    manage. The aim guide follows it, so you can see what it is going for
     *    before it gets there;
     *  - **draw** — the power bar fills, which is the cue going back.
     *
     * Driven by an interval rather than by the frame loop: this is interface,
     * not physics, and it must keep running whether or not the renderer is busy.
     */
    const startAngle = get().aimAngle;

    /*
     * The shorter way round.
     *
     * Interpolating between two angles naively can take the cue the long way
     * round the table — from just under +180° to just over −180° is a hair of
     * movement described as a full turn.
     */
    let delta = shot.angle - startAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    let elapsed = 0;
    cpuTimer = setInterval(() => {
      elapsed += CPU_TICK_MS;

      const state = get();
      const stillCpu = state.match ? currentCpu(state.match) : undefined;
      // Everything may have changed while it was playing its turn.
      if (!state.world || state.phase !== Phase.AIMING || !stillCpu) {
        cancelCpuTurn();
        return;
      }

      if (elapsed <= CPU_LOOK_MS) return;

      const aiming = Math.min(1, (elapsed - CPU_LOOK_MS) / CPU_AIM_MS);
      // Eased at both ends: a hand does not start or stop a cue abruptly.
      const swung = aiming * aiming * (3 - 2 * aiming);
      state.setAimAngle(startAngle + delta * swung);

      if (aiming < 1) return;

      const drawing = Math.min(
        1,
        (elapsed - CPU_LOOK_MS - CPU_AIM_MS) / CPU_DRAW_MS,
      );
      state.setPower(Math.max(0.05, shot.power * drawing));

      if (drawing >= 1) {
        cancelCpuTurn();
        state.setSpin(shot.spin);
        state.takeShot();
      }
    }, CPU_TICK_MS);
  };

  /**
   * Re-runs the settled shot on a throwaway world and hands back the slice worth
   * watching. Returns null when there is nothing to show.
   */
  /**
   * A table that knows about the room it is standing in.
   *
   * The furniture is only ever met by a ball that has been knocked onto the
   * floor, but it has to be on the table object because that is what the solver
   * carries around — including into the replay world, which has to bounce off
   * the same sideboard the live one did or the replay would not match.
   */
  const furnishedTable = () => {
    const table = createTable();
    const location = effectiveLocation(useSettings.getState().locationId);
    return { ...table, obstacles: obstaclesFor(location.id) };
  };

  const buildReplay = (moments: ReplayMoment[]): ReplayState | null => {
    const live = get().world;
    if (!pending || !live || moments.length === 0) return null;

    // Same cloth, same table: a replay on a different profile would not be a
    // replay of the shot that was played.
    const world = World.deserialize(pending.snapshot, live.table, live.profile);
    world.shoot(pending.angle, pending.power, pending.spin);

    // The window runs from before the first ball drops to after the last, so a
    // shot that pots several shows all of them in one continuous clip.
    const from = Math.max(0, moments[0].t - REPLAY_LEAD);
    // A ball leaving the table needs longer on the end than a pot does: the drop
    // to the floor is most of the show, and it happens after the event fires.
    const trail = moments.some((m) => m.kind === 'fall') ? REPLAY_FALL_TRAIL : REPLAY_TRAIL;

    /**
     * The window, capped rather than allowed to run as long as the shot did.
     *
     * Solving for a speed that fits any span into the target only works while
     * that speed is inside its own limits. Past them the clamp takes over and the
     * duration escapes: a span of five seconds against a ceiling of 0.85 plays
     * for nearly six, which is why some replays ran two seconds and others ten.
     *
     * A ball knocked onto the floor is what produces those long spans — it can
     * roll for several seconds after the drop everyone actually wants to see. So
     * the tail is trimmed to what the slowest allowed speed can still show at the
     * target length, and what is cut is the part after the ball has landed.
     */
    const longest = REPLAY_MAX_SPEED * REPLAY_MAX_TARGET_SECONDS;
    const wanted = moments[moments.length - 1].t + trail;
    const until = Math.min(wanted, from + longest);

    const guard = Math.ceil(PHYSICS.maxShotSeconds / PHYSICS.fixedDt);
    for (let i = 0; i < guard && world.time < from && !world.atRest; i++) {
      world.step(PHYSICS.fixedDt);
    }

    /**
     * Solved so every replay lasts about the same, whatever it covers.
     *
     * The clamp still guards the short end — a pot a quarter second after the
     * break leaves almost no window, and playing that at a twelfth speed is the
     * best that can be done with it. The long end no longer needs guarding
     * because the window above is already trimmed to fit.
     */
    /*
     * A busy shot is given longer than a quiet one.
     *
     * Four balls dropping in the same window is the replay most worth watching
     * and, on a fixed target, the one that played fastest. Each moment past the
     * first buys a little more time.
     */
    const target = Math.min(
      REPLAY_MAX_TARGET_SECONDS,
      REPLAY_TARGET_SECONDS + (moments.length - 1) * REPLAY_SECONDS_PER_EXTRA_MOMENT,
    );

    const span = Math.max(0.05, until - from);
    const speed = Math.min(REPLAY_MAX_SPEED, Math.max(REPLAY_MIN_SPEED, span / target));

    replayAccumulator = 0;
    return { world, until, moments, speed };
  };

  /** Applies the rules once the balls have stopped. */
  const settleShot = () => {
    const { world, match } = get();
    if (!world) return;

    world.settle();
    const events = world.events;

    /**
     * Captured before the rules run, because a respot rewrites the world.
     *
     * Pots and balls driven off the table go into one list, ordered by when they
     * happened, so a shot that does both replays as a single continuous clip
     * instead of picking one and dropping the other.
     */
    const moments: ReplayMoment[] = events
      .flatMap<ReplayMoment>((e) => {
        if (e.kind === 'pocketed' && e.ball !== 0) {
          return [{ kind: 'pot', t: e.t, ball: e.ball, pocket: e.pocket }];
        }
        if (e.kind === 'off-table') {
          return [{ kind: 'fall', t: e.t, ball: e.ball, at: { x: e.x, y: e.y } }];
        }
        return [];
      })
      .sort((a, b) => a.t - b.t);

    const miscued = lastMiscue;
    lastMiscue = null;

    let outcome: ShotOutcome | null = null;
    let finished = false;
    /*
     * Whether the fourteen went back up on this shot.
     *
     * Noted here because `rerackDone` clears the flag immediately below, and by
     * the time the trophy detector runs there would be nothing left to say it
     * happened — which is the one thing straight pool's own trophies are about.
     */
    let reracked = false;

    // Read before resolving: the rules consume the call as part of the shot.
    const callBefore = match ? currentCall(match) : null;

    if (match) {
      const resolved = resolveShot(match, world, events);
      outcome = resolved.outcome;
      finished = resolved.outcome.gameOver;
      if (resolved.outcome.cueBallNeedsRespot) world.respotCueBall();

      /*
       * Straight pool's re-rack, applied here because only the session may
       * write to the world.
       *
       * The break ball stays where it lies and so does the cue ball; everything
       * else goes back into the triangle. Doing it now rather than at the start
       * of the next shot means the player sees the table they will be playing
       * from while the outcome is still on screen.
       */
      let next = resolved.match;
      if (wantsRerack(next)) {
        const keep = world.remainingObjectBalls().map((ball) => ball.number);
        world.rerack(keep);
        next = rerackDone(next);
        reracked = true;
      }

      set({ match: next, standings: standings(next, world) });
    }

    /**
     * What the shot earned.
     *
     * Read from the outcome the rules already produced rather than from a second
     * pass over the events, so a trophy can never disagree with the score. The
     * detector is pure; this is the only place it meets the store.
     */
    if (outcome && match) {
      /*
       * Read off the flattened scoreboard rather than off one mode's state.
       *
       * Eight-ball has no scores at all, so the two score fields fall back to
       * zero there and the trophies that compare them simply never fire in that
       * mode — which is right, because "won by more than twenty" is not a thing
       * that happens in a game you win by potting the black.
       */
      const seat = currentSeat(match);
      const table = standings(match, world);
      const shooter = table[seat];
      const runnerUp = table
        .filter((_, i) => i !== seat)
        .reduce((best, p) => Math.max(best, p.score ?? 0), 0);

      /*
       * How far the cue ball travelled to reach what it struck.
       *
       * Measured off the snapshot taken before the shot, because by now both
       * balls have moved: the pre-shot positions are the only place the length
       * of the pot still exists.
       */
      const firstHit = events.find((e) => e.kind === 'ball-hit' && e.a === 0);
      let contactDistance: number | null = null;
      if (firstHit && pending) {
        const before = pending.snapshot.balls;
        const cue = before.find((b) => b.number === 0);
        const struck = before.find(
          (b) => b.number === (firstHit as { b: number }).b,
        );
        if (cue && struck) {
          contactDistance = Math.hypot(cue.p.x - struck.p.x, cue.p.y - struck.p.y);
        }
      }

      /*
       * Whether this shot finished off the shooter's group.
       *
       * Compared across the shot rather than read after it: `onTheEight` is true
       * for every visit once the group is gone, and the trophy is for the shot
       * that cleared it.
       */
      const teamBefore = teamOfSeat(match, seat);
      const wasOnEight = teamBefore === null ? false : onTheEight(match, world, teamBefore);
      const nowOnEight =
        teamBefore === null ? false : onTheEight(get().match ?? match, world, teamBefore);
      const clearedGroup = !wasOnEight && nowOnEight;

      const partners = partnersOf(match, seat);
      const sides = teamSizes(match);

      const { awards, run } = detectShot(
        {
          events,
          outcome,
          spin: pending?.spin ?? NO_SPIN,
          power: pending?.power ?? 0,
          isBreak: shotsTaken(match) === 0,
          wonGame: finished && winningSeats(get().match ?? match).includes(seat),
          players: matchPlayerCount(match),
          winnerScore: shooter?.score ?? 0,
          runnerUpScore: runnerUp,

          mode: match.kind,
          // The call as it stood when the shot was played: the rules clear it
          // once resolved, so the post-shot state has nothing to compare.
          call: callBefore,
          contactDistance,
          cpus: cpusIn(match),
          shooterIsHuman: shooter?.cpu !== true,
          hasPartner: partners.length > 0,
          ownTeamSize: teamBefore === null ? 1 : sides[teamBefore],
          otherTeamSize: teamBefore === null ? 0 : sides[teamBefore === 0 ? 1 : 0],
          clearedGroup,
          reracked,
          target: targetOf(match),
        },
        trophyRun,
      );

      trophyRun = run;
      const trophies = useTrophies.getState();

      /*
       * Winning in every discipline, tracked as a set rather than a count.
       *
       * `advance` would have counted four wins in free play as four
       * disciplines. What the trophy asks is which ones you have won in, and
       * that is a question only a set can answer.
       */
      if (finished && winningSeats(get().match ?? match).includes(seat)) {
        trophies.discover('disciplines', match.kind, 'all-disciplines', 4);
      }
      for (const id of awards.award) trophies.award(id);
      for (const id of awards.advance) trophies.advance(id);
    }

    const potted = outcome?.pocketed ?? [];
    const celebration: Celebration | null = potted.length
      ? { kind: 'pot', balls: potted, reason: null, penalty: 0, id: Date.now() }
      : outcome?.foul
        ? {
            kind: 'foul',
            balls: [],
            reason: outcome.foulReason,
            penalty: outcome.penalty ?? 0,
            id: Date.now(),
          }
        : null;

    set({
      /*
       * The miscue is told here, not by a banner of its own.
       *
       * It was a third component reporting the same shot: the miscue banner at
       * contact, the foul banner when the balls stopped, and this ticker after
       * — three panels in three styles for one bad shot. Folding it into the
       * message list means it arrives through the channel the game already uses
       * to say what happened, in the one style that channel has.
       *
       * Last in the list, because the ticker shows the last line: the miscue is
       * *why* the shot went wrong, and it should be the thing left on screen.
       */
      messages: miscued
        ? [...(outcome?.messages ?? []), msg(miscued === 'rushed' ? 'miscue.rushed' : 'miscue.snatched')]
        : (outcome?.messages ?? []),
      lastOutcome: outcome,
      celebration,
    });

    /*
     * The winning shot is watched before the board goes up.
     *
     * It used to cut straight to the result, on the reasoning that the panel
     * matters more — which had it exactly backwards. The shot that wins the
     * frame is the one replay anybody would actually want, and skipping it meant
     * the only pot never shown was the best one. So the game ending is recorded
     * now and acted on when the replay finishes.
     */
    if (finished) {
      void clearSavedGame();
      gameEnded = true;
    }

    const replay = buildReplay(moments);
    if (replay) {
      set({ phase: Phase.REPLAY, replay });
      if (!finished) {
        const save = buildSave();
        if (save) void saveGame(save);
      }
      return;
    }

    finishTurn();
  };

  return {
    mode: null,
    world: null,
    phase: Phase.AIMING,
    match: null,
    standings: [],
    // A pause is only ever held by a panel, and no panel survives leaving.
    paused: false,
    puzzle: null,
    levelId: null,
    aimAngle: 0,
    power: DEFAULT_POWER,
    spin: NO_SPIN,
    cameraMode: CameraMode.CUE,
    replay: null,
    celebration: null,
    messages: [],
    lastOutcome: null,
    gameId: 0,

    startGame: (kind, playerCount, names, cpus) => {
      accumulator = 0;
      pending = null;
      // A stale flag would send the next shot straight to a result screen for a
      // game that had not finished.
      gameEnded = false;
      trophyRun = emptyRunState();
      // The cloth is a physics choice, not only a colour, so the table is built
      // with the profile the player picked.
      const world = World.rack(furnishedTable(), clothProfile(useSettings.getState().clothId));
      const match = createMatch({ kind, playerCount, names, cpus });

      set({
        mode: kind,
        world,
        phase: Phase.AIMING,
        match,
        standings: standings(match, world),
        power: DEFAULT_POWER,
        spin: NO_SPIN,
        cameraMode: CameraMode.CUE,
        replay: null,
        celebration: null,
        messages: [],
        lastOutcome: null,
        gameId: get().gameId + 1,
      });
      aimAtNearestTarget();
      // A game that opens on a computer's turn plays itself from the off.
      takeCpuTurnIfNeeded();
      const save = buildSave();
      if (save) void saveGame(save);
    },

    resume: (save) => {
      if (!save.match) return false;

      accumulator = 0;
      pending = null;
      // A stale flag would send the next shot straight to a result screen for a
      // game that had not finished.
      gameEnded = false;
      trophyRun = emptyRunState();
      // Built first: the standings read the table to work out which balls of a
      // group are already down.
      const restored = World.deserialize(
        save.world,
        furnishedTable(),
        clothProfile(useSettings.getState().clothId),
      );

      set({
        mode: save.mode,
        world: restored,
        phase: Phase.AIMING,
        match: save.match,
        standings: standings(save.match, restored),
        power: DEFAULT_POWER,
        spin: NO_SPIN,
        cameraMode: CameraMode.CUE,
        replay: null,
        celebration: null,
        messages: [{ key: 'rules.resumed' }],
        lastOutcome: null,
        gameId: get().gameId + 1,
      });
      aimAtNearestTarget();
      takeCpuTurnIfNeeded();
      return true;
    },

    setAimAngle: (aimAngle) => set({ aimAngle }),

    nudgeAim: (delta) => set({ aimAngle: get().aimAngle + delta }),

    setPower: (power) => set({ power: Math.min(1, Math.max(0.05, power)) }),

    // Only while aiming: during a shot or a replay the game owns the camera.
    setCameraMode: (cameraMode) => {
      if (get().phase !== Phase.AIMING) return;
      set({ cameraMode });
    },

    setSpin: (spin) => set({ spin }),

    /**
     * What the shooter says they are going to do.
     *
     * Stored on the match rather than beside it, because the rules read it
     * from there and clear it themselves once the shot has been resolved — a
     * call belongs to one shot, and one that outlived its shot would hold
     * somebody to a pocket they named several visits ago.
     */
    setCall: (call) => {
      const { match } = get();
      if (!match) return;
      set({ match: withCall(match, call) });
    },

    takeShot: (charge) => {
      const { world, phase, aimAngle, power, spin, cameraMode, match } = get();
      if (!world || phase !== Phase.AIMING) return;
      // Shooting from the overhead view is deliberately not allowed: you line a
      // shot up from behind the cue, not from the ceiling.
      if (cameraMode !== CameraMode.CUE) return;

      /*
       * In the called games, no shot without a call.
       *
       * Refused rather than allowed and then charged as a foul. A player who has
       * not answered the picker has not decided yet, and taking their shot for
       * them and then penalising it would be the game punishing its own UI.
       */
      if (match && needsCall(match) && !currentCall(match)) return;

      /*
       * The charge decides the shot — including when there was none.
       *
       * `charge` is how long the button was held, where 1 is a full wind-up and
       * anything above it is an overcharge. A tap is a charge of zero, and zero
       * is inside the miscue band at the bottom: jabbing at the ball without
       * drawing the cue back is as much a mishit as snatching at it, and the two
       * now behave the same way. `powerFor` already knows this.
       *
       * `undefined` is what the computer passes, because it has no button to
       * hold and sets `power` directly. That is the one case that falls through.
       */
      const struck = charge === undefined ? power : powerFor(charge);
      // Remembered for the ticker, which reports it once the balls have stopped.
      lastMiscue =
        charge === undefined || !isMiscue(charge) ? null : charge === 0 ? 'rushed' : 'snatched';

      /*
       * An overcharged cue does not merely hit harder, it hits *badly*.
       *
       * Full power is full power; there is nowhere above it for speed to go. So
       * what the overcharge buys is error: the tip lands off where it was aimed,
       * and a hard shot struck off-line is what actually sends a ball over a
       * rail. Adding speed alone would have been a harder shot, not a wilder
       * one.
       *
       * Deterministic in the shot's own terms rather than random, so a replay of
       * it plays back identically.
       */
      const wild = charge === undefined ? 0 : wildnessFor(charge);
      const skew = wild === 0 ? 0 : (((world.balls.length * 7919) % 17) / 17 - 0.5) * wild * 0.09;
      const angle = aimAngle + skew;

      pending = { snapshot: world.serialize(), angle, power: struck, spin };

      accumulator = 0;
      world.shoot(angle, struck, spin);
      set({
        phase: Phase.SIMULATING,
        /*
         * A mishit does not cut to the overhead view.
         *
         * Pulling back is right for a real shot: the table is where everything
         * is about to happen. On a miscue nothing happens there at all — the
         * ball does not move — so the shot ends almost immediately and the
         * camera rises and drops again within a few frames. That flash is the
         * only thing the change achieves, and it reads as a glitch. Staying put
         * costs nothing, because there is nothing to pull back and look at.
         */
        cameraMode: lastMiscue ? CameraMode.CUE : CameraMode.TABLE,
        messages: [],
        lastOutcome: null,
        celebration: null,
      });
    },

    skipReplay: () => {
      if (get().phase !== Phase.REPLAY) return;
      finishTurn();
    },

    dismissCelebration: () => set({ celebration: null }),

    setPaused: (paused) => {
      // The accumulator is dropped rather than carried: it holds the time owed
      // since the last tick, and paying that debt after the pause would fast
      // forward the shot by however long the panel was open.
      if (!paused) accumulator = 0;
      set({ paused });
    },

    stepSimulation: (delta) => {
      const { world, phase, replay, paused } = get();
      if (!world) return;
      // Held still while a panel is open over the table.
      if (paused) return;

      if (phase === Phase.REPLAY && replay) {
        replayAccumulator = Math.min(replayAccumulator + delta * replay.speed, MAX_ACCUMULATED);
        while (replayAccumulator >= PHYSICS.fixedDt) {
          replay.world.step(PHYSICS.fixedDt);
          replayAccumulator -= PHYSICS.fixedDt;
          if (replay.world.time >= replay.until) break;
        }
        if (replay.world.time >= replay.until || replay.world.atRest) finishTurn();
        return;
      }

      if (phase !== Phase.SIMULATING) return;

      accumulator = Math.min(accumulator + delta, MAX_ACCUMULATED);

      // Only whole fixed ticks are ever executed and the remainder is carried
      // over, so frame timing changes *when* the physics runs but never what it
      // computes — the animated shot matches a headless replay exactly.
      while (accumulator >= PHYSICS.fixedDt) {
        world.step(PHYSICS.fixedDt);
        accumulator -= PHYSICS.fixedDt;

        if (world.atRest) break;
        // Safety valve for a pathological shot that refuses to lose energy.
        if (world.time > PHYSICS.maxShotSeconds) break;
      }

      /**
       * Run the tail of the shot out at speed once nothing is left to watch.
       *
       * A ball knocked onto the floor keeps rolling long after the shot has been
       * decided — up to about five seconds — and the turn does not settle until
       * everything has stopped, so all of that sat between the shot and its
       * replay. The solver still has to carry the ball to a halt, or it freezes
       * mid-floor still spinning, so the fix is to step it there quickly rather
       * than to stop early.
       *
       * Bounded: a shot that somehow never settles is caught by the same
       * `maxShotSeconds` valve as the loop above.
       */
      if (!world.atRest && world.decided) {
        for (let i = 0; i < FAST_FORWARD_TICKS && !world.atRest; i++) {
          world.step(PHYSICS.fixedDt);
          if (world.time > PHYSICS.maxShotSeconds) break;
        }
      }

      if (world.atRest || world.time > PHYSICS.maxShotSeconds) {
        settleShot();
      }
    },

    leaveGame: () => {
      accumulator = 0;
      pending = null;
      // A stale flag would send the next shot straight to a result screen for a
      // game that had not finished.
      gameEnded = false;
      trophyRun = emptyRunState();
      cancelCpuTurn();
      set({
        mode: null,
        world: null,
        phase: Phase.AIMING,
        match: null,
    standings: [],
    // A pause is only ever held by a panel, and no panel survives leaving.
    paused: false,
        replay: null,
        celebration: null,
        messages: [],
        lastOutcome: null,
      });
    },

    persistNow: async () => {
      const save = buildSave();
      if (save) await saveGame(save);
    },
  };
});
