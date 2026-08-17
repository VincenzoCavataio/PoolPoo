/**
 * Writes the synthesised sound effects out as WAV files. `npm run sfx:build`
 *
 * The generator is committed alongside the files it produces so the sounds stay
 * tunable: change a partial in `synth.ts`, re-run, done. The output is
 * deterministic, so re-running without changing anything produces byte-identical
 * files and no spurious diff.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { EFFECTS, encodeWav, SAMPLE_RATE } from '../src/game/audio/synth';

const outputDir = join(process.cwd(), 'assets', 'sfx');
mkdirSync(outputDir, { recursive: true });

let total = 0;

for (const [name, render] of Object.entries(EFFECTS)) {
  const samples = render();
  const wav = encodeWav(samples);
  const path = join(outputDir, `${name}.wav`);

  writeFileSync(path, wav);
  total += wav.length;

  const duration = (samples.length / SAMPLE_RATE) * 1000;
  console.log(`  ${name}.wav  ${duration.toFixed(0)} ms  ${(wav.length / 1024).toFixed(1)} KB`);
}

console.log(`\n${Object.keys(EFFECTS).length} effetti, ${(total / 1024).toFixed(1)} KB in totale`);
