/**
 * Sound effect test suite. `npm run test:audio`
 *
 * These sounds were written without ever hearing them, so the tests check the
 * properties that decide whether a synthesised impact is usable at all: it has
 * to peak below clipping, it has to decay rather than drone, it has to be short,
 * and it has to come out the same on every build. The WAV header is checked
 * byte by byte, because a header a decoder rejects is silence on the device with
 * nothing in the logs to say why.
 */

import { assert, assertEqual, report, suite, test } from '../../core/tests/harness';
import { EFFECTS, encodeWav, SAMPLE_RATE, type EffectName } from '../synth';

const NAMES = Object.keys(EFFECTS) as EffectName[];

function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const magnitude = Math.abs(samples[i]);
    if (magnitude > peak) peak = magnitude;
  }
  return peak;
}

function energyOf(samples: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return sum;
}

/** Zero crossings per second: a cheap, reliable stand-in for brightness. */
function brightness(samples: Float32Array, from: number, to: number): number {
  let crossings = 0;
  for (let i = from + 1; i < to; i++) {
    if (samples[i - 1] < 0 !== samples[i] < 0) crossings += 1;
  }
  const span = (to - from) / SAMPLE_RATE;
  return span > 0 ? crossings / span : 0;
}

/**
 * Last sample still worth hearing.
 *
 * Measuring brightness across the whole buffer is worthless: once a hit has
 * decayed into the noise floor, its sign flips at random and the zero-crossing
 * rate shoots back up, so a perfectly dull sound reads as bright. Everything is
 * measured inside the audible span instead.
 */
function audibleEnd(samples: Float32Array, fraction = 0.02): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const magnitude = Math.abs(samples[i]);
    if (magnitude > peak) peak = magnitude;
  }

  const floor = peak * fraction;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (Math.abs(samples[i]) >= floor) return i + 1;
  }
  return samples.length;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let text = '';
  for (let i = 0; i < length; i++) text += String.fromCharCode(bytes[offset + i]);
  return text;
}

suite('sound effects', () => {
  test('every effect produces audible, finite samples', () => {
    for (const name of NAMES) {
      const samples = EFFECTS[name]();
      assert(samples.length > 0, `${name} is empty`);

      for (let i = 0; i < samples.length; i++) {
        assert(Number.isFinite(samples[i]), `${name} has a non-finite sample at ${i}`);
      }

      const peak = peakOf(samples);
      assert(peak > 0.4, `${name} is nearly silent (peak ${peak.toFixed(3)})`);
      assert(peak < 1, `${name} clips (peak ${peak.toFixed(3)})`);
    }
  });

  test('impacts decay instead of droning', () => {
    for (const name of NAMES) {
      const samples = EFFECTS[name]();
      const half = Math.floor(samples.length / 2);

      const front = energyOf(samples, 0, half);
      const back = energyOf(samples, half, samples.length);

      // A hit is nearly all in its first instant. Anything that carries half its
      // energy into the second half is a tone, not an impact.
      assert(front > back * 8, `${name} does not decay: ${front.toFixed(2)} vs ${back.toFixed(2)}`);
    }
  });

  test('every effect is short enough to fire repeatedly', () => {
    for (const name of NAMES) {
      const duration = EFFECTS[name]().length / SAMPLE_RATE;
      assert(duration > 0.02, `${name} is only ${(duration * 1000).toFixed(0)} ms`);
      assert(duration < 0.8, `${name} runs ${duration.toFixed(2)} s, too long for a hit`);
    }
  });

  test('the same build produces the same bytes', () => {
    // Noise comes from a seeded generator, not Math.random: without that, every
    // rebuild would rewrite every asset and the tests below would prove nothing.
    for (const name of NAMES) {
      const first = EFFECTS[name]();
      const second = EFFECTS[name]();

      assertEqual(first.length, second.length, `${name} length`);
      for (let i = 0; i < first.length; i++) {
        if (first[i] !== second[i]) throw new Error(`${name} differs at sample ${i}`);
      }
    }
  });

  test('no impact keeps ringing brightly', () => {
    /*
     * The measurable version of "it sounds metallic".
     *
     * Metal is high frequencies that refuse to die. A hit is therefore fine on
     * either of two counts: its tail is dull in absolute terms, or its tail has
     * fallen a long way from a bright attack. Demanding the second alone was
     * wrong — the cushion is a low, dull pock from the first sample, and had no
     * brightness left to lose.
     */
    const impacts: EffectName[] = ['ball-hit', 'cushion', 'cue', 'pocket'];
    const DULL_ENOUGH = 700;

    for (const name of impacts) {
      const samples = EFFECTS[name]();
      const end = audibleEnd(samples);
      const head = brightness(samples, 0, Math.floor(end * 0.12));
      const tail = brightness(samples, Math.floor(end * 0.45), Math.floor(end * 0.9));

      console.log(`      ${name}: attacco ${head.toFixed(0)} Hz → coda ${tail.toFixed(0)} Hz`);
      assert(
        tail <= Math.max(DULL_ENOUGH, head * 0.55),
        `${name} keeps ringing: ${tail.toFixed(0)} Hz in the tail against ${head.toFixed(0)} Hz at the attack`,
      );
    }
  });

  test('a ball click is brighter and shorter than a cushion', () => {
    // The distinction the ear actually makes between the two events.
    const ball = EFFECTS['ball-hit']();
    const cushion = EFFECTS.cushion();

    assert(ball.length < cushion.length, 'the ball click should be the shorter of the two');

    assert(
      brightness(ball, 0, ball.length) > brightness(cushion, 0, cushion.length) * 1.5,
      'the ball click should be much brighter than the cushion',
    );
  });

  test('the WAV header is one a decoder will accept', () => {
    const samples = EFFECTS['ball-hit']();
    const wav = encodeWav(samples);
    const view = new DataView(wav.buffer);

    assertEqual(readAscii(wav, 0, 4), 'RIFF', 'RIFF tag');
    assertEqual(readAscii(wav, 8, 4), 'WAVE', 'WAVE tag');
    assertEqual(readAscii(wav, 12, 4), 'fmt ', 'fmt tag');
    assertEqual(readAscii(wav, 36, 4), 'data', 'data tag');

    assertEqual(view.getUint16(20, true), 1, 'PCM format');
    assertEqual(view.getUint16(22, true), 1, 'channel count');
    assertEqual(view.getUint32(24, true), SAMPLE_RATE, 'sample rate');
    assertEqual(view.getUint16(34, true), 16, 'bits per sample');

    assertEqual(view.getUint32(40, true), samples.length * 2, 'data chunk size');
    assertEqual(view.getUint32(4, true), 36 + samples.length * 2, 'RIFF chunk size');
    assertEqual(wav.length, 44 + samples.length * 2, 'total byte length');
  });

  test('encoding preserves the waveform', () => {
    const samples = EFFECTS.cue();
    const wav = encodeWav(samples);
    const view = new DataView(wav.buffer);

    for (let i = 0; i < samples.length; i += 97) {
      const decoded = view.getInt16(44 + i * 2, true) / 32767;
      // One 16-bit step of tolerance.
      assert(Math.abs(decoded - samples[i]) < 1 / 32000, `sample ${i} drifted on encode`);
    }
  });
});

report();
