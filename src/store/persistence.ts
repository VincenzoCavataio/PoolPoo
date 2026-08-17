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
import type { PuzzleState } from '@/game/rules/puzzle';
import type { GameModeKind } from '@/game/rules/types';

const SAVE_KEY = 'pool.save.v1';

export const SAVE_VERSION = 1;

export interface SavedGame {
  version: number;
  mode: GameModeKind;
  world: SerializedWorld;
  free: FreeState | null;
  puzzle: PuzzleState | null;
  levelId: string | null;
  savedAt: string;
}

function isValid(value: unknown): value is SavedGame {
  if (typeof value !== 'object' || value === null) return false;
  const save = value as Partial<SavedGame>;
  if (save.version !== SAVE_VERSION) return false;
  if (save.mode !== 'free' && save.mode !== 'puzzle') return false;
  if (!save.world || !Array.isArray(save.world.balls) || save.world.balls.length === 0) return false;
  if (save.mode === 'free' && !save.free) return false;
  if (save.mode === 'puzzle' && (!save.puzzle || !save.levelId)) return false;
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
