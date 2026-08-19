/**
 * What there is to earn.
 *
 * Plain data, so the list can be read by the screen that shows it, the code that
 * awards it, and the tests that check the two agree. Nothing here knows how a
 * trophy is stored or drawn.
 *
 * Four kinds, and they are different on purpose:
 *
 *  - **progress** — turn up and play. These exist so the first hour has a rhythm.
 *  - **skill** — you did something on purpose and it worked.
 *  - **feat** — a whole game played to a standard, which is much harder than any
 *    single shot.
 *  - **secret** — not listed until earned. The screen shows a locked outline and
 *    nothing else, so finding one is finding something.
 *
 * The ids are strings rather than an enum because they are also the keys under
 * which progress is saved. A renamed id is a lost trophy for anybody who already
 * had it, so they are written once and left alone.
 */

import type { MessageKey } from '@/i18n';

export type TrophyKind = 'progress' | 'skill' | 'feat' | 'secret';

export interface Trophy {
  id: string;
  kind: TrophyKind;
  /**
   * Translation keys, typed against the catalogue.
   *
   * `MessageKey` rather than `string`: a trophy whose label does not exist is a
   * blank line on the screen and nothing anywhere to say why, and that is a
   * mistake worth catching at compile time rather than by reading the list.
   */
  labelKey: MessageKey;
  /** How it is earned. Secrets describe it only after the fact. */
  hintKey: MessageKey;
  /**
   * How many times the triggering thing must happen. Absent means once.
   *
   * A counted trophy shows its progress on the screen, which is the difference
   * between "play 10 games" being a goal and being a surprise.
   */
  target?: number;
}

export const TROPHIES: Trophy[] = [
  // ------------------------------------------------------------- progression
  {
    id: 'first-shot',
    kind: 'progress',
    labelKey: 'trophy.firstShot',
    hintKey: 'trophy.firstShotHint',
  },
  {
    id: 'first-pot',
    kind: 'progress',
    labelKey: 'trophy.firstPot',
    hintKey: 'trophy.firstPotHint',
  },
  {
    id: 'first-win',
    kind: 'progress',
    labelKey: 'trophy.firstWin',
    hintKey: 'trophy.firstWinHint',
  },
  {
    id: 'ten-games',
    kind: 'progress',
    labelKey: 'trophy.tenGames',
    hintKey: 'trophy.tenGamesHint',
    target: 10,
  },
  {
    id: 'hundred-pots',
    kind: 'progress',
    labelKey: 'trophy.hundredPots',
    hintKey: 'trophy.hundredPotsHint',
    target: 100,
  },

  // ------------------------------------------------------------------ skill
  {
    id: 'double-pot',
    kind: 'skill',
    labelKey: 'trophy.doublePot',
    hintKey: 'trophy.doublePotHint',
  },
  {
    id: 'triple-pot',
    kind: 'skill',
    labelKey: 'trophy.triplePot',
    hintKey: 'trophy.triplePotHint',
  },
  {
    id: 'cushion-pot',
    kind: 'skill',
    labelKey: 'trophy.cushionPot',
    hintKey: 'trophy.cushionPotHint',
  },
  {
    id: 'spin-pot',
    kind: 'skill',
    labelKey: 'trophy.spinPot',
    hintKey: 'trophy.spinPotHint',
  },
  {
    id: 'break-pot',
    kind: 'skill',
    labelKey: 'trophy.breakPot',
    hintKey: 'trophy.breakPotHint',
  },
  {
    id: 'run-of-three',
    kind: 'skill',
    labelKey: 'trophy.runOfThree',
    hintKey: 'trophy.runOfThreeHint',
  },

  // ------------------------------------------------------------------- feats
  {
    id: 'clean-game',
    kind: 'feat',
    labelKey: 'trophy.cleanGame',
    hintKey: 'trophy.cleanGameHint',
  },
  {
    id: 'no-scratch',
    kind: 'feat',
    labelKey: 'trophy.noScratch',
    hintKey: 'trophy.noScratchHint',
  },
  {
    id: 'shutout',
    kind: 'feat',
    labelKey: 'trophy.shutout',
    hintKey: 'trophy.shutoutHint',
  },

  // ---------------------------------------------------------------- secrets
  /**
   * The hidden ones.
   *
   * Each is something a player might do without meaning to, or something only
   * curiosity finds. None of them can be aimed at from the trophy screen,
   * because until you have it the screen will not say what it is.
   */
  {
    id: 'off-the-table',
    kind: 'secret',
    labelKey: 'trophy.offTheTable',
    hintKey: 'trophy.offTheTableHint',
  },
  {
    id: 'lights-out',
    kind: 'secret',
    labelKey: 'trophy.lightsOut',
    hintKey: 'trophy.lightsOutHint',
  },
  {
    id: 'dj',
    kind: 'secret',
    labelKey: 'trophy.dj',
    hintKey: 'trophy.djHint',
  },
  {
    id: 'grand-tour',
    kind: 'secret',
    labelKey: 'trophy.grandTour',
    hintKey: 'trophy.grandTourHint',
  },
  {
    id: 'collector',
    kind: 'secret',
    labelKey: 'trophy.collector',
    hintKey: 'trophy.collectorHint',
  },
  {
    id: 'long-run',
    kind: 'secret',
    labelKey: 'trophy.longRun',
    hintKey: 'trophy.longRunHint',
  },
];

export function trophyById(id: string): Trophy | undefined {
  return TROPHIES.find((t) => t.id === id);
}
