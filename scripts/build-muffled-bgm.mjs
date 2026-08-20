/**
 * Builds the muffled copy of the menu theme. `npm run bgm:build`
 *
 * The light switch in the menus should make the music sound like it is coming
 * from the next room — the top end gone, the bass still there. That is a
 * low-pass filter, and expo-audio has no filters: a player exposes a volume and
 * a playback rate and nothing else. Dropping the volume is not the same thing
 * and does not fool anybody; muffled is *duller*, not quieter.
 *
 * So the filtering happens once, here, and the app cross-fades between the two
 * files at runtime. The cost is a second copy of the track in the bundle; the
 * alternative is a native audio module and a development build, which this
 * project deliberately does not have.
 *
 * ffmpeg comes from `ffmpeg-static`, a dev dependency that ships the binary
 * itself — nothing has to be installed on the machine, and a checkout can
 * rebuild the asset without anybody being told to install a media toolchain
 * first. It is a build-time dependency only and never reaches the app.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import ffmpeg from 'ffmpeg-static';

const SOURCE = resolve('assets/bgm/MENU_1.mp3');
const OUTPUT = resolve('assets/bgm/MENU_1_muffled.mp3');

/**
 * The filter chain, and why each part is there.
 *
 * `lowpass=f=520` is the effect: everything above about 520Hz rolls away, which
 * is roughly what a closed door does. Higher and it just sounds a bit soft;
 * much lower and the track turns to mud with no tune left in it.
 *
 * `lowpass` a second time steepens the slope — one pass at 12dB/octave still
 * lets a lot of the top through, and two make the difference between "quieter"
 * and "elsewhere".
 *
 * `bass=g=3` puts back a little of what the filter takes: sound through a wall
 * keeps its bottom end, and without this the result is thin rather than muffled.
 *
 * `volume=1.4` compensates for the energy the filter removed, so the cross-fade
 * is between two tracks of roughly equal loudness and reads as a change of
 * *character* rather than a change of level.
 */
const FILTER = 'lowpass=f=520,lowpass=f=520,bass=g=3:f=110,volume=1.4';

function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Non trovo ${SOURCE}`);
    process.exit(1);
  }

  if (!ffmpeg || !existsSync(ffmpeg)) {
    console.error('Non trovo il binario di ffmpeg.');
    console.error('Reinstalla le dipendenze:  npm install');
    process.exit(1);
  }

  console.log('Filtro MENU_1.mp3 …');

  execFileSync(
    ffmpeg,
    ['-y', '-i', SOURCE, '-af', FILTER, '-codec:a', 'libmp3lame', '-q:a', '4', OUTPUT],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  console.log(`Scritto ${OUTPUT}`);
  console.log('La musica dei menu ora si ovatta davvero quando spegni la luce.');
}

main();
