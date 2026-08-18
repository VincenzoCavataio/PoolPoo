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
import { angleOf, dist2, sub } from '@/game/core/vec';
import { NO_SPIN, World, type SerializedWorld, type ShotSpin } from '@/game/core/world';
import type { Message } from '@/i18n';
import { CameraMode } from '@/game/render/camera';
import { createFreeState, resolveFreeShot, type FreeState } from '@/game/rules/free';
import { levelById } from '@/game/rules/levels';
import { createPuzzleState, resolvePuzzleShot, type PuzzleState } from '@/game/rules/puzzle';
import { Phase, type GameModeKind, type ShotOutcome } from '@/game/rules/types';

import { clearSavedGame, SAVE_VERSION, saveGame, type SavedGame } from './persistence';
import { useProgress } from './progress';
import { useSettings } from './settings';

/**
 * Time left over between fixed ticks. Module-level rather than store state
 * because it changes every frame and nothing should re-render for it.
 */
let accumulator = 0;
let replayAccumulator = 0;

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
const REPLAY_TARGET_SECONDS = 2.6;
const REPLAY_MIN_SPEED = 0.12;
const REPLAY_MAX_SPEED = 0.85;

export interface ReplayPot {
  /** Seconds into the shot. */
  t: number;
  ball: number;
  pocket: PocketId;
}

export interface ReplayState {
  /** A second world, replaying the shot; the real one keeps its settled state. */
  world: World;
  /** Simulated time at which the replay stops. */
  until: number;
  /**
   * Every ball potted by the shot, in the order they dropped.
   *
   * The camera walks this list rather than being pinned to one pocket: a shot
   * that drops three balls used to replay only the first, which made the other
   * two look like they had never happened.
   */
  pots: ReplayPot[];
  /** Time scale, solved for so short and long replays feel the same length. */
  speed: number;
}

export interface Celebration {
  kind: 'pot' | 'foul';
  /** Ball numbers potted, for the overlay to name them. */
  balls: number[];
  reason: Message | null;
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
  free: FreeState | null;
  puzzle: PuzzleState | null;
  levelId: string | null;
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

  startFree: (playerCount: number, names: string[]) => void;
  startPuzzle: (levelId: string) => boolean;
  resume: (save: SavedGame) => boolean;
  retryLevel: () => void;
  setAimAngle: (angle: number) => void;
  nudgeAim: (delta: number) => void;
  setPower: (power: number) => void;
  setSpin: (spin: ShotSpin) => void;
  setCameraMode: (mode: CameraMode) => void;
  takeShot: () => void;
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

  const buildSave = (): SavedGame | null => {
    const { mode, world, free, puzzle, levelId } = get();
    if (!mode || !world) return null;
    return {
      version: SAVE_VERSION,
      mode,
      world: world.serialize(),
      free,
      puzzle,
      levelId,
      savedAt: new Date().toISOString(),
    };
  };

  const finishTurn = () => {
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
  };

  /**
   * Re-runs the settled shot on a throwaway world and hands back the slice worth
   * watching. Returns null when there is nothing to show.
   */
  const buildReplay = (pots: ReplayPot[]): ReplayState | null => {
    const live = get().world;
    if (!pending || !live || pots.length === 0) return null;

    // Same cloth, same table: a replay on a different profile would not be a
    // replay of the shot that was played.
    const world = World.deserialize(pending.snapshot, live.table, live.profile);
    world.shoot(pending.angle, pending.power, pending.spin);

    // The window runs from before the first ball drops to after the last, so a
    // shot that pots several shows all of them in one continuous clip.
    const from = Math.max(0, pots[0].t - REPLAY_LEAD);
    const until = pots[pots.length - 1].t + REPLAY_TRAIL;

    const guard = Math.ceil(PHYSICS.maxShotSeconds / PHYSICS.fixedDt);
    for (let i = 0; i < guard && world.time < from && !world.atRest; i++) {
      world.step(PHYSICS.fixedDt);
    }

    const span = Math.max(0.05, until - from);
    const speed = Math.min(
      REPLAY_MAX_SPEED,
      Math.max(REPLAY_MIN_SPEED, span / REPLAY_TARGET_SECONDS),
    );

    replayAccumulator = 0;
    return { world, until, pots, speed };
  };

  /** Applies the rules once the balls have stopped. */
  const settleShot = () => {
    const { world, mode, free, puzzle, levelId } = get();
    if (!world) return;

    world.settle();
    const events = world.events;

    // Captured before the rules run, because a respot rewrites the world.
    const pots: ReplayPot[] = events
      .filter((e) => e.kind === 'pocketed' && e.ball !== 0)
      .map((e) => {
        const potted = e as Extract<typeof e, { kind: 'pocketed' }>;
        return { t: potted.t, ball: potted.ball, pocket: potted.pocket };
      });

    let outcome: ShotOutcome | null = null;
    let finished = false;

    if (mode === 'free' && free) {
      const resolved = resolveFreeShot(free, world, events);
      outcome = resolved.outcome;
      finished = resolved.outcome.gameOver;
      if (resolved.outcome.cueBallNeedsRespot) world.respotCueBall();
      set({ free: resolved.state });
    } else if (mode === 'puzzle' && puzzle && levelId) {
      const level = levelById(levelId);
      if (!level) return;

      const resolved = resolvePuzzleShot(level, puzzle, world, events);
      outcome = resolved.outcome;
      finished = resolved.state.status !== 'playing';
      if (resolved.outcome.cueBallNeedsRespot) world.respotCueBall();
      if (resolved.state.status === 'won') {
        useProgress.getState().recordResult(level.id, resolved.state.stars);
      }
      set({ puzzle: resolved.state });
    }

    const potted = outcome?.pocketed ?? [];
    const celebration: Celebration | null = potted.length
      ? { kind: 'pot', balls: potted, reason: null, id: Date.now() }
      : outcome?.foul
        ? { kind: 'foul', balls: [], reason: outcome.foulReason, id: Date.now() }
        : null;

    set({
      messages: outcome?.messages ?? [],
      lastOutcome: outcome,
      celebration,
    });

    if (finished) {
      // The result panel matters more than a replay does.
      set({ phase: Phase.GAME_OVER, replay: null });
      void clearSavedGame();
      return;
    }

    const replay = buildReplay(pots);
    if (replay) {
      set({ phase: Phase.REPLAY, replay });
      const save = buildSave();
      if (save) void saveGame(save);
      return;
    }

    finishTurn();
  };

  return {
    mode: null,
    world: null,
    phase: Phase.AIMING,
    free: null,
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

    startFree: (playerCount, names) => {
      accumulator = 0;
      pending = null;
      // The cloth is a physics choice, not only a colour, so the table is built
      // with the profile the player picked.
      const world = World.rack(createTable(), clothProfile(useSettings.getState().clothId));
      set({
        mode: 'free',
        world,
        phase: Phase.AIMING,
        free: createFreeState(playerCount, names),
        puzzle: null,
        levelId: null,
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
      const save = buildSave();
      if (save) void saveGame(save);
    },

    startPuzzle: (levelId) => {
      const level = levelById(levelId);
      if (!level) return false;

      accumulator = 0;
      pending = null;
      const world = World.fromLayout(
        level.layout,
        createTable(),
        clothProfile(useSettings.getState().clothId),
      );
      set({
        mode: 'puzzle',
        world,
        phase: Phase.AIMING,
        free: null,
        puzzle: createPuzzleState(level),
        levelId,
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
      const save = buildSave();
      if (save) void saveGame(save);
      return true;
    },

    resume: (save) => {
      const level = save.levelId ? levelById(save.levelId) : null;
      if (save.mode === 'puzzle' && (!level || !save.puzzle)) return false;
      if (save.mode === 'free' && !save.free) return false;

      accumulator = 0;
      pending = null;
      set({
        mode: save.mode,
        world: World.deserialize(
          save.world,
          createTable(),
          clothProfile(useSettings.getState().clothId),
        ),
        phase: Phase.AIMING,
        free: save.free,
        puzzle: save.puzzle,
        levelId: save.levelId,
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
      return true;
    },

    retryLevel: () => {
      const { levelId } = get();
      if (levelId) get().startPuzzle(levelId);
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

    takeShot: () => {
      const { world, phase, aimAngle, power, spin, cameraMode } = get();
      if (!world || phase !== Phase.AIMING) return;
      // Shooting from the overhead view is deliberately not allowed: you line a
      // shot up from behind the cue, not from the ceiling.
      if (cameraMode !== CameraMode.CUE) return;

      pending = { snapshot: world.serialize(), angle: aimAngle, power, spin };

      accumulator = 0;
      world.shoot(aimAngle, power, spin);
      set({
        phase: Phase.SIMULATING,
        cameraMode: CameraMode.TABLE,
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

    stepSimulation: (delta) => {
      const { world, phase, replay } = get();
      if (!world) return;

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

      if (world.atRest || world.time > PHYSICS.maxShotSeconds) {
        settleShot();
      }
    },

    leaveGame: () => {
      accumulator = 0;
      pending = null;
      set({
        mode: null,
        world: null,
        phase: Phase.AIMING,
        free: null,
        puzzle: null,
        levelId: null,
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
