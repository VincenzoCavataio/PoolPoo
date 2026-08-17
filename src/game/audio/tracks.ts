/**
 * The soundtrack.
 *
 * React Native resolves `require` at build time from a literal path, so tracks
 * cannot be discovered by scanning a folder — every one needs a line here. That
 * is the whole cost of adding a track: drop the file in `assets/bgm/` and add an
 * entry.
 *
 * `title` and `artist` are yours to fill in; they are what the record changer
 * shows. `labelColor` is the colour of the paper label on the spinning disc, so
 * each track looks like a different record.
 */

export interface Track {
  id: string;
  title: string;
  artist: string;
  /** Colour of the record label in the changer. */
  labelColor: string;
  /** Result of `require`, which React Native turns into an asset id. */
  source: number;
}

export const TRACKS: Track[] = [
  {
    id: 'bgm_1',
    // ↓ da compilare
    title: 'Traccia 1',
    artist: 'Vince',
    labelColor: '#d94f7a',
    source: require('../../../assets/bgm/BGM_1.mp3') as number,
  },
];

export function trackAt(index: number): Track {
  const count = TRACKS.length;
  if (count === 0) throw new Error('nessuna traccia nella OST');
  return TRACKS[((index % count) + count) % count];
}
