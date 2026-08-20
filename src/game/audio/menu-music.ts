/**
 * The menus' theme, and what happens to it when the lights go out.
 *
 * A single looping track, separate from the in-game player. They are kept apart
 * because they are different things: the game's music is a playlist the player
 * chooses from and changes at the record player, while this is one piece that
 * belongs to the shell and is never selected.
 *
 * **Two copies of the same track, one of them filtered.** Turning the room dark
 * should sound like stepping out of it — the top end gone, the bass still there,
 * the way music sounds through a wall. That is a low-pass filter, and expo-audio
 * has no filters at all: a player exposes a volume and a playback rate and
 * nothing else.
 *
 * So the filtering is done once, ahead of time, by `npm run bgm:build`, and the
 * two files are cross-faded. Dropping the volume alone was tried first and is
 * not the same thing — muffled is not quieter, it is *duller*, and the ear
 * reads the difference immediately.
 *
 * If the filtered file is missing the effect degrades to a level change rather
 * than failing, so a checkout without it still runs.
 */

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/**
 * Quieter than the game's music.
 *
 * The menus have no other sound but the taps, so the same level that sits under
 * a break would dominate here.
 */
const MENU_VOLUME = 0.45;

/**
 * How much quieter the muffled copy sits.
 *
 * A little, not a lot: the filter is doing the work, and taking the level down
 * as well would put it back to sounding merely distant. A wall does drop the
 * level a bit, so this is not zero either.
 */
const MUFFLED_LEVEL = 0.8;

/** How long the door takes to close, and how often the cross-fade steps. */
const FADE_MS = 500;
const FADE_TICK_MS = 40;

/**
 * The clear track and the filtered one.
 *
 * Both run at once, always, with the cross-fade deciding which is audible. That
 * is what keeps them in step: starting one where the other left off means a
 * seek, and a seek is audible as a stumble at exactly the moment the effect is
 * supposed to be smooth.
 */
let clear: AudioPlayer | null = null;
let muffledTrack: AudioPlayer | null = null;

let wanted = false;
let setting = 1;
let muffled = false;

/** Where the cross-fade is: 0 is the clear track, 1 is fully muffled. */
let closed = 0;
let fade: ReturnType<typeof setInterval> | null = null;

function ensurePlayers(): AudioPlayer | null {
  if (clear) return clear;

  try {
    clear = createAudioPlayer(require('../../../assets/bgm/MENU_1.mp3') as number);
    clear.loop = true;
  } catch (error) {
    console.warn('[pool] musica dei menu non caricata', error);
    clear = null;
    return null;
  }

  /*
   * The filtered copy is optional.
   *
   * It is generated rather than committed by hand, so a fresh checkout may not
   * have it yet. Without it the effect falls back to a level change, which is
   * weaker but not broken — and far better than a menu with no music.
   */
  try {
    muffledTrack = createAudioPlayer(
      require('../../../assets/bgm/MENU_1_muffled.mp3') as number,
    );
    muffledTrack.loop = true;
  } catch {
    muffledTrack = null;
  }

  applyLevel();
  return clear;
}

function applyLevel(): void {
  const base = setting * MENU_VOLUME;

  if (clear) clear.volume = base * (1 - closed);

  if (muffledTrack) {
    muffledTrack.volume = base * closed * MUFFLED_LEVEL;
    return;
  }

  /*
   * No filtered copy: fall back to dimming the clear one.
   *
   * Deliberately further down than the cross-fade would go, because without the
   * filter the only thing left to say "elsewhere" is the level.
   */
  if (clear) clear.volume = base * (1 - closed * 0.6);
}

/**
 * Runs the cross-fade towards whichever state the switch has asked for.
 *
 * Stepped rather than jumped: a level that changes between one frame and the
 * next is heard as a fault in the file, while the same change over half a second
 * is heard as a door closing. The light itself is instant — that is what a
 * switch does — but the sound of a room takes a moment to follow.
 */
function runFade(): void {
  if (fade !== null) clearInterval(fade);

  fade = setInterval(() => {
    const target = muffled ? 1 : 0;
    const step = FADE_TICK_MS / FADE_MS;

    closed = target > closed ? Math.min(target, closed + step) : Math.max(target, closed - step);
    applyLevel();

    if (closed === target && fade !== null) {
      clearInterval(fade);
      fade = null;
    }
  }, FADE_TICK_MS);
}

/**
 * Starts the theme from the top.
 *
 * From the top, not from wherever it was paused. Leaving a game and coming back
 * to the menu is a return to the front of the app, and resuming three minutes
 * into the track — often mid-phrase — sounds like something that was left
 * running rather than something that greeted you.
 *
 * Rewinding only when it is not already playing, so navigating between the menus
 * themselves does not restart it: those are all one visit.
 */
export function startMenuMusic(): void {
  const alreadyPlaying = wanted;
  wanted = true;

  const active = ensurePlayers();
  if (!active) return;

  try {
    for (const track of [clear, muffledTrack]) {
      if (!track) continue;
      if (!alreadyPlaying) void track.seekTo(0);
      track.play();
    }
  } catch (error) {
    console.warn('[pool] musica dei menu non avviata', error);
  }
}

/**
 * Pauses the theme, keeping the players.
 *
 * Paused rather than released: entering a game and coming back out is the common
 * path, and rebuilding a player each time would stutter at exactly the moment
 * the menu is fading in.
 */
export function stopMenuMusic(): void {
  wanted = false;

  try {
    clear?.pause();
    muffledTrack?.pause();
  } catch (error) {
    console.warn('[pool] musica dei menu non fermata', error);
  }
}

/** Applies the player's volume setting, scaled to the menus' quieter level. */
export function setMenuMusicVolume(volume: number): void {
  setting = Math.min(1, Math.max(0, volume));
  applyLevel();
}

/**
 * Muffles the menu theme, or brings it back.
 *
 * Called when the light switch is thrown: with the room dark the music should
 * sound like it is coming through a wall, which is what makes the switch feel
 * like it did something to the room rather than to a light.
 */
export function setMenuMusicMuffled(next: boolean): void {
  if (muffled === next) return;
  muffled = next;
  runFade();
}

/** Frees the players. For app teardown, not for navigating between screens. */
export function releaseMenuMusic(): void {
  wanted = false;

  if (fade !== null) {
    clearInterval(fade);
    fade = null;
  }

  try {
    clear?.remove();
    muffledTrack?.remove();
  } catch (error) {
    console.warn('[pool] musica dei menu non rilasciata', error);
  }

  clear = null;
  muffledTrack = null;
}

/** Whether the theme is meant to be playing, for callers restoring state. */
export function menuMusicWanted(): boolean {
  return wanted;
}
