/**
 * Sound effects, synthesised rather than recorded.
 *
 * There are no sample libraries in this project and nothing to record with, so
 * the impacts are built from first principles: a struck ball is a very short
 * burst of noise plus a couple of ringing partials, a cushion is the same idea
 * an octave down and far more damped, a pocket is a rattle followed by a thud.
 *
 * They are honest placeholders. They will read as pool sounds and they cost
 * about a hundred kilobytes in total, but they are not recordings and can be
 * swapped for real samples by dropping files over the generated ones.
 *
 * This module is pure maths on `Float32Array`s so that it runs — and is tested —
 * in Node. `scripts/generate-sfx.ts` writes the results out as WAV files.
 */

export const SAMPLE_RATE = 44100;

/**
 * Deterministic noise.
 *
 * `Math.random` would make every build produce slightly different files, which
 * turns a rebuild into a diff and makes the tests meaningless.
 */
function createNoise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    // xorshift32: cheap, and identical on every machine.
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

function seconds(count: number): number {
  return Math.round(count * SAMPLE_RATE);
}

/** Exponential decay with a short linear attack, so nothing clicks on onset. */
function envelope(index: number, length: number, attack: number, decay: number): number {
  const t = index / SAMPLE_RATE;
  const attackGain = attack > 0 ? Math.min(1, t / attack) : 1;
  const tail = 1 - index / length;
  return attackGain * Math.exp(-t / decay) * Math.max(0, tail);
}

interface Partial {
  frequency: number;
  gain: number;
  decay: number;
}

interface ImpactOptions {
  duration: number;
  attack: number;
  /** Ringing modes of the struck body. */
  partials: Partial[];
  /** Level and decay of the initial noise transient. */
  noiseGain: number;
  noiseDecay: number;
  /** One-pole low-pass on the noise, 0–1; lower is duller. */
  noiseTone: number;
  /**
   * Brightness of the whole sound at the very start and at the end, plus how
   * fast it travels between them.
   *
   * This is what separates a struck solid from a struck bell. A real impact
   * dumps its high frequencies almost immediately — the material absorbs them —
   * and what is left is low and dull. Holding brightness constant is exactly the
   * thing that makes synthesised hits sound metallic.
   */
  tiltFrom: number;
  tiltTo: number;
  tiltTime: number;
  seed: number;
}

function renderImpact(options: ImpactOptions): Float32Array {
  const length = seconds(options.duration);
  const output = new Float32Array(length);
  const noise = createNoise(options.seed);
  let noiseFiltered = 0;
  let toneFiltered = 0;

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;

    noiseFiltered += (noise() - noiseFiltered) * options.noiseTone;
    let sample = noiseFiltered * options.noiseGain * Math.exp(-t / options.noiseDecay);

    for (const partial of options.partials) {
      sample +=
        Math.sin(2 * Math.PI * partial.frequency * t) * partial.gain * Math.exp(-t / partial.decay);
    }

    // Closing low-pass: bright for an instant, then progressively dull.
    const tilt = options.tiltTo + (options.tiltFrom - options.tiltTo) * Math.exp(-t / options.tiltTime);
    toneFiltered += (sample - toneFiltered) * tilt;

    output[i] = toneFiltered * envelope(i, length, options.attack, options.duration * 0.5);
  }

  return normalise(output, 0.86);
}

/** Scales to a target peak, leaving headroom so nothing clips on the device. */
export function normalise(samples: Float32Array, peak: number): Float32Array {
  let loudest = 0;
  for (let i = 0; i < samples.length; i++) {
    const magnitude = Math.abs(samples[i]);
    if (magnitude > loudest) loudest = magnitude;
  }
  if (loudest === 0) return samples;

  const gain = peak / loudest;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}

/**
 * Two balls meeting.
 *
 * Pool balls are phenolic resin: dense, heavily self-damped, and nothing like a
 * bell. The sound is almost entirely a click — noise carries it, the partials
 * are there only to give the click a pitch, they are deliberately **inharmonic**
 * so nothing rings as a chord, and they are gone inside four milliseconds.
 */
export function ballHit(): Float32Array {
  return renderImpact({
    duration: 0.05,
    attack: 0.00025,
    partials: [
      { frequency: 1980, gain: 0.3, decay: 0.0042 },
      { frequency: 3350, gain: 0.16, decay: 0.0026 },
      { frequency: 5210, gain: 0.07, decay: 0.0016 },
    ],
    noiseGain: 0.95,
    noiseDecay: 0.0018,
    noiseTone: 0.62,
    tiltFrom: 0.95,
    tiltTo: 0.16,
    tiltTime: 0.004,
    seed: 0x51f3a1,
  });
}

/**
 * A rail: rubber under cloth, which is about as damped as a material gets.
 *
 * Barely any tone at all — a soft, low pock that is over almost before it
 * starts. Anything that hangs on here reads as a drum.
 */
export function cushionHit(): Float32Array {
  return renderImpact({
    duration: 0.11,
    attack: 0.0016,
    partials: [
      { frequency: 118, gain: 0.34, decay: 0.014 },
      { frequency: 233, gain: 0.14, decay: 0.008 },
    ],
    noiseGain: 0.72,
    noiseDecay: 0.0075,
    noiseTone: 0.075,
    tiltFrom: 0.4,
    tiltTo: 0.05,
    tiltTime: 0.006,
    seed: 0x2ab77c,
  });
}

/** The cue tip: leather on resin through a wooden shaft. Dry and woody. */
export function cueStrike(): Float32Array {
  return renderImpact({
    duration: 0.075,
    attack: 0.0006,
    partials: [
      { frequency: 468, gain: 0.34, decay: 0.009 },
      { frequency: 905, gain: 0.18, decay: 0.0055 },
      { frequency: 1490, gain: 0.07, decay: 0.003 },
    ],
    noiseGain: 0.8,
    noiseDecay: 0.0035,
    noiseTone: 0.3,
    tiltFrom: 0.6,
    tiltTo: 0.09,
    tiltTime: 0.005,
    seed: 0x7c1d05,
  });
}

/**
 * A ball dropping: it clatters against the jaws on the way in, then lands.
 *
 * Built by laying three quietening clicks over a low body resonance, which is
 * what a pocket actually sounds like from above the table.
 */
export function pocketDrop(): Float32Array {
  const length = seconds(0.44);
  const output = new Float32Array(length);
  const noise = createNoise(0x9e3d11);
  let rattleFiltered = 0;
  let toneFiltered = 0;

  // Ball off the jaws, off the liner, then onto the bed of the pocket. Each
  // knock is noise through a dull filter — the pocket is cloth over wood, and
  // there is nothing in there that rings.
  const knocks = [
    { at: 0.0, gain: 1, tone: 0.34 },
    { at: 0.052, gain: 0.55, tone: 0.24 },
    { at: 0.098, gain: 0.3, tone: 0.17 },
    { at: 0.146, gain: 0.15, tone: 0.12 },
  ];

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    let sample = 0;

    for (const knock of knocks) {
      const local = t - knock.at;
      if (local < 0) continue;
      rattleFiltered += (noise() - rattleFiltered) * knock.tone;
      sample += rattleFiltered * 0.55 * knock.gain * Math.exp(-local / 0.0055);
    }

    // The body of the table answering underneath: low, wooden, quickly gone.
    sample += Math.sin(2 * Math.PI * 88 * t) * 0.45 * Math.exp(-t / 0.09);
    sample += Math.sin(2 * Math.PI * 129 * t) * 0.2 * Math.exp(-t / 0.06);

    const tilt = 0.06 + 0.34 * Math.exp(-t / 0.02);
    toneFiltered += (sample - toneFiltered) * tilt;

    output[i] = toneFiltered * envelope(i, length, 0.0005, 0.22);
  }

  return normalise(output, 0.9);
}

/**
 * Needle finding the groove, for the record changer.
 *
 * A soft thunk as the arm lands, then a few seconds' worth of surface crackle
 * compressed into a moment.
 */
export function needleDrop(): Float32Array {
  const length = seconds(0.42);
  const output = new Float32Array(length);
  const noise = createNoise(0x4411af);
  const crackle = createNoise(0xbb2059);
  let filtered = 0;

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;

    filtered += (noise() - filtered) * 0.25;
    let sample = filtered * 0.35 * Math.exp(-t / 0.02);
    sample += Math.sin(2 * Math.PI * 120 * t) * 0.4 * Math.exp(-t / 0.05);

    // Sparse pops rather than a steady hiss: that is what reads as vinyl.
    const pop = crackle();
    if (Math.abs(pop) > 0.985) sample += pop * 0.5 * Math.exp(-t / 0.3);

    output[i] = sample * envelope(i, length, 0.001, 0.25);
  }

  return normalise(output, 0.7);
}

/** 16-bit mono PCM WAV, the most universally decodable thing there is. */
export function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const dataBytes = samples.length * 2;
  const buffer = new Uint8Array(44 + dataBytes);
  const view = new DataView(buffer.buffer);

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) buffer[offset + i] = text.charCodeAt(i);
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  return buffer;
}

export const EFFECTS = {
  'ball-hit': ballHit,
  cushion: cushionHit,
  cue: cueStrike,
  pocket: pocketDrop,
  needle: needleDrop,
} as const;

export type EffectName = keyof typeof EFFECTS;
