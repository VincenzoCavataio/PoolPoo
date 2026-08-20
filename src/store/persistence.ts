/**
 * Saved-game storage for the "Continue" entry in the menu.
 *
 * Because the simulation is plain data, a save is just the serialised world
 * plus whichever rule state is active — no replay log, no engine snapshot.
 * Anything that fails to parse or carries an unknown version is discarded
 * rather than half-restored.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SerializedWorld } from '@/game/core/world';
import type { FreeState } from '@/game/rules/free';
import { PLAYABLE_MODES, type GameModeKind } from '@/game/rules/types';
import type { Match } from '@/game/rules/match';

const SAVE_KEY = 'pool.save.v1';

/**
 * Bumped when four disciplines replaced the one.
 *
 * A version-1 save holds a `free` field this build no longer understands and
 * no record of which rules it was played under. Rather than guess, it fails
 * validation like any other malformed save and the menu simply offers no
 * Continue — which is the behaviour that was already there for saves the game
 * had outgrown.
 */
export const SAVE_VERSION = 2;

export interface SavedGame {
  version: number;
  mode: GameModeKind;
  world: SerializedWorld;
  /** The game in progress, tagged with the rules it is being played under. */
  match: Match | null;
  savedAt: string;
}

function isValid(value: unknown): value is SavedGame {
  if (typeof value !== 'object' || value === null) return false;
  const save = value as Partial<SavedGame>;
  if (save.version !== SAVE_VERSION) return false;
  // A save from when the game had puzzles is not a game any more. It fails here
  // rather than loading half of one, and the menu simply offers no Continue.
  if (!PLAYABLE_MODES.includes(save.mode as (typeof PLAYABLE_MODES)[number])) return false;
  if (!save.world || !Array.isArray(save.world.balls) || save.world.balls.length === 0) return false;
  if (!save.match || !Array.isArray(save.match.state?.players)) return false;
  return true;
}

export async function saveGame(game: SavedGame): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(game));
  } catch (error) {
    // A failed autosave must never interrupt play.
    console.warn('[pool] salvataggio non riuscito', error);
  }
}

export async function loadSavedGame(): Promise<SavedGame | null> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) {
      await AsyncStorage.removeItem(SAVE_KEY);
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('[pool] salvataggio illeggibile', error);
    return null;
  }
}

export async function clearSavedGame(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SAVE_KEY);
  } catch (error) {
    console.warn('[pool] impossibile cancellare il salvataggio', error);
  }
}

/** Human-readable age of a save, for the Continue button. */
export function describeSave(save: SavedGame): string {
  const when = new Date(save.savedAt);
  if (Number.isNaN(when.getTime())) return '';

  const label = when.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return label;
}
