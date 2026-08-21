/**
 * Sound effect playback.
 *
 * A break fires dozens of ball contacts inside a couple of hundred milliseconds,
 * and one player per sound cannot overlap itself — the second hit would cut the
 * first. So each effect owns a small **pool of voices**, and a trigger takes the
 * one used longest ago.
 *
 * There is also a rate limit. Nobody can hear thirty clicks in a tenth of a
 * second; they arrive as a single burst of mush and, worse, as thirty native
 * calls in one frame. Quiet contacts below a speed threshold are dropped
 * outright, which is both cheaper and closer to how a real break sounds.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type EffectName =
  | 'ball-hit'
  | 'cushion'
  | 'cue'
  | 'miscue'
  | 'pocket'
  | 'needle'
  | 'ballast';

const SOURCES: Record<EffectName, number> = {
  'ball-hit': require('../../../assets/sfx/ball-hit.wav') as number,
  cushion: require('../../../assets/sfx/cushion.wav') as number,
  cue: require('../../../assets/sfx/cue.wav') as number,
  miscue: require('../../../assets/sfx/miscue.wav') as number,
  pocket: require('../../../assets/sfx/pocket.wav') as number,
  needle: require('../../../assets/sfx/needle.wav') as number,
  ballast: require('../../../assets/sfx/ballast.wav') as number,
};

/** Enough voices to cover an overlapping cluster, no more. */
const VOICE_COUNT: Record<EffectName, number> = {
  'ball-hit': 5,
  cushion: 3,
  cue: 2,
  // One at a time: two miscues cannot overlap, there is only one cue.
  miscue: 1,
  pocket: 2,
  needle: 1,
  ballast: 1,
};

/** Shortest gap between two triggers of the same effect. */
const MIN_GAP_MS: Record<EffectName, number> = {
  'ball-hit': 22,
  cushion: 35,
  cue: 0,
  miscue: 0,
  pocket: 60,
  needle: 0,
  ballast: 0,
};

interface Voice {
  player: AudioPlayer;
  lastUsed: number;
}

const pools = new Map<EffectName, Voice[]>();
const lastTrigger = new Map<EffectName, number>();
let masterVolume = 0.8;
let ready = false;

/**
 * Creates the players and puts the session into a mode that plays through the
 * silent switch — a game whose sounds vanish because the phone is on silent is
 * a bug report waiting to happen.
 */
export async function initSfx(): Promise<void> {
  if (ready) return;
  ready = true;

  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
  } catch (error) {
    console.warn('[pool] modalità audio non impostata', error);
  }

  for (const name of Object.keys(SOURCES) as EffectName[]) {
    const voices: Voice[] = [];
    for (let i = 0; i < VOICE_COUNT[name]; i++) {
      try {
        voices.push({ player: createAudioPlayer(SOURCES[name]), lastUsed: 0 });
      } catch (error) {
        console.warn(`[pool] effetto ${name} non caricato`, error);
      }
    }
    pools.set(name, voices);
  }
}

export function releaseSfx(): void {
  for (const voices of pools.values()) {
    for (const voice of voices) {
      try {
        voice.player.remove();
      } catch {
        // Already gone; nothing to do.
      }
    }
  }
  pools.clear();
  lastTrigger.clear();
  ready = false;
}

export function setSfxVolume(volume: number): void {
  masterVolume = Math.min(1, Math.max(0, volume));
}

/**
 * Fires an effect at `gain` (0–1) relative to the master volume.
 *
 * Returns quietly when muted, rate-limited, or not yet loaded: callers are in
 * the frame loop and must never have to care.
 */
export function playEffect(name: EffectName, gain = 1): void {
  if (masterVolume <= 0) return;

  const voices = pools.get(name);
  if (!voices || voices.length === 0) return;

  const now = Date.now();
  const gap = MIN_GAP_MS[name];
  if (gap > 0 && now - (lastTrigger.get(name) ?? 0) < gap) return;
  lastTrigger.set(name, now);

  let chosen = voices[0];
  for (const voice of voices) {
    if (voice.lastUsed < chosen.lastUsed) chosen = voice;
  }
  chosen.lastUsed = now;

  try {
    chosen.player.volume = Math.min(1, Math.max(0, gain)) * masterVolume;
    // Rewind before playing: a voice that ran to the end sits at its final
    // position and would otherwise produce nothing.
    void chosen.player.seekTo(0);
    chosen.player.play();
  } catch (error) {
    console.warn(`[pool] effetto ${name} non riprodotto`, error);
  }
}

/**
 * The sound a menu control makes.
 *
 * One ball touching another, played softly. The game already owns that sound and
 * it is the right one: a menu for a billiards game should click like billiards
 * rather than like a generic interface. Quieter than the same sound in play —
 * a tap on a button is not a shot.
 *
 * `confirm` is for the control that ends a screen. Same sound, fuller, so the
 * decision lands differently from the adjustments leading up to it.
 */
export function playTap(kind: 'select' | 'confirm' = 'select'): void {
  playEffect('ball-hit', kind === 'confirm' ? 0.5 : 0.28);
}

/**
 * The snap of the light switch behind the menu.
 *
 * The cue's own sound, played short and quiet. It is a dry wooden knock with no
 * tail, which is what a switch is; the alternative was shipping another asset
 * for a sound heard once per launch. Each strike of the tube gets one, so the
 * stutter is heard as well as seen.
 *
 * `strike` is a starter misfiring, `settle` is the one that takes — fuller,
 * because that is the throw of the switch that actually holds.
 */
export function playSwitch(kind: 'strike' | 'settle' = 'strike'): void {
  playEffect('cue', kind === 'settle' ? 0.42 : 0.26);
}

/**
 * The buzz of the ballast as the tube settles.
 *
 * Mains hum: a magnetic ballast vibrates at twice the supply frequency, so the
 * fundamental is 100Hz with odd harmonics off the saturating core and a little
 * hiss from the tube. It fades to nothing across its own two seconds, because
 * the buzz belongs to the striking — a fixture that hums forever is a fault, and
 * a menu is not the place to sit under one.
 *
 * Very quiet on purpose. It should be the thing you notice only once the room
 * has gone quiet again, not a layer over the music.
 */
/**
 * The cue skidding off the ball.
 *
 * Its own sound rather than a quieter `cue`, because a miscue is not a weak
 * strike — it is a different event, and telling the player so with the same
 * knock at lower volume would say "you hit it softly" when what happened is
 * "you did not hit it".
 */
export function playMiscue(): void {
  playEffect('miscue', 0.85);
}

export function playBallast(): void {
  playEffect('ballast', 0.2);
}

/** Maps an impact speed in m/s onto a sensible loudness. */
export function gainForImpact(speed: number, reference = 2.5): number {
  const normalised = Math.sqrt(Math.max(0, speed) / reference);
  return Math.min(1, Math.max(0.12, normalised));
}
