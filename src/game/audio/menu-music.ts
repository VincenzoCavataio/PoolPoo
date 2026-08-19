/**
 * The menus' theme.
 *
 * A single looping track, separate from the in-game player. They are kept apart
 * because they are different things: the game's music is a playlist the player
 * chooses from and changes at the record player, while this is one piece that
 * belongs to the shell and is never selected. Sharing one player would mean the
 * menu theme appearing in the track list, and leaving a game would have to
 * remember which record was on.
 *
 * Lives outside any React state for the same reason the game's does: a native
 * audio object is not something to re-create on a render.
 */

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/**
 * Quieter than the game's music.
 *
 * The menus have no other sound but the taps, so the same level that sits under
 * a break would dominate here.
 */
const MENU_VOLUME = 0.45;

let player: AudioPlayer | null = null;
let wanted = false;

function ensurePlayer(): AudioPlayer | null {
  if (player) return player;

  try {
    player = createAudioPlayer(require('../../../assets/bgm/MENU_1.mp3') as number);
    player.loop = true;
    player.volume = MENU_VOLUME;
  } catch (error) {
    console.warn('[pool] musica dei menu non caricata', error);
    player = null;
  }

  return player;
}

/**
 * Starts the theme from the top.
 *
 * From the top, not from wherever it was paused. Leaving a game and coming back
 * to the menu is a return to the front of the app, and resuming three minutes
 * into the track — often mid-phrase — sounds like something that was left
 * running rather than something that greeted you. The lamp comes back on from
 * dark for the same reason.
 *
 * Rewinding only when it is not already playing, so navigating between the
 * menus themselves does not restart it: those are all one visit.
 */
export function startMenuMusic(): void {
  const alreadyPlaying = wanted;
  wanted = true;
  const active = ensurePlayer();
  if (!active) return;

  try {
    if (!alreadyPlaying) void active.seekTo(0);
    active.play();
  } catch (error) {
    console.warn('[pool] musica dei menu non avviata', error);
  }
}

/**
 * Pauses the theme, keeping the player.
 *
 * Paused rather than released: entering a game and coming back out is the
 * common path, and rebuilding the player each time would stutter at exactly the
 * moment the menu is fading in.
 */
export function stopMenuMusic(): void {
  wanted = false;
  if (!player) return;

  try {
    player.pause();
  } catch (error) {
    console.warn('[pool] musica dei menu non fermata', error);
  }
}

/** Applies the player's volume setting, scaled to the menus' quieter level. */
export function setMenuMusicVolume(volume: number): void {
  if (!player) return;
  player.volume = Math.min(1, Math.max(0, volume)) * MENU_VOLUME;
}

/** Frees the player. For app teardown, not for navigating between screens. */
export function releaseMenuMusic(): void {
  wanted = false;
  if (!player) return;

  try {
    player.remove();
  } catch (error) {
    console.warn('[pool] musica dei menu non rilasciata', error);
  }
  player = null;
}

/** Whether the theme is meant to be playing, for callers restoring state. */
export function menuMusicWanted(): boolean {
  return wanted;
}
