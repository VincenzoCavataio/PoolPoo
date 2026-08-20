/**
 * What there is to earn.
 *
 * Plain data, so the list can be read by the screen that shows it, the code that
 * awards it, and the tests that check the two agree. Nothing here knows how a
 * trophy is stored or drawn.
 *
 * Five kinds, and they are different on purpose:
 *
 *  - **progress** — turn up and play. These exist so the first hour has a rhythm.
 *  - **skill** — you did something on purpose and it worked.
 *  - **mode** — belongs to one discipline, and says something only that
 *    discipline can say. These are what make four games feel like four games
 *    rather than one game with four scoreboards.
 *  - **feat** — a whole game played to a standard, which is much harder than any
 *    single shot.
 *  - **secret** — not listed until earned. The screen shows a locked outline and
 *    nothing else, so finding one is finding something.
 *
 * The ids are strings rather than an enum because they are also the keys under
 * which progress is saved. A renamed id is a lost trophy for anybody who already
 * had it, so they are written once and left alone.
 */

import type { GameModeKind } from '@/game/rules/types';
import type { MessageKey } from '@/i18n';

export type TrophyKind = 'progress' | 'skill' | 'mode' | 'feat' | 'secret';

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
  /**
   * Which discipline it belongs to, for the ones that belong to one.
   *
   * Used only to group the screen: the detector decides what fires, and it reads
   * the mode from the shot rather than from here. Two sources for one rule is
   * how they end up disagreeing.
   */
  mode?: GameModeKind;
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
    id: 'fifty-games',
    kind: 'progress',
    labelKey: 'trophy.fiftyGames',
    hintKey: 'trophy.fiftyGamesHint',
    target: 50,
  },
  {
    id: 'hundred-pots',
    kind: 'progress',
    labelKey: 'trophy.hundredPots',
    hintKey: 'trophy.hundredPotsHint',
    target: 100,
  },
  {
    id: 'thousand-pots',
    kind: 'progress',
    labelKey: 'trophy.thousandPots',
    hintKey: 'trophy.thousandPotsHint',
    target: 1000,
  },
  {
    id: 'all-disciplines',
    kind: 'progress',
    labelKey: 'trophy.allDisciplines',
    hintKey: 'trophy.allDisciplinesHint',
    target: 4,
  },

  // ------------------------------------------------------------------- skill
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
    id: 'quad-pot',
    kind: 'skill',
    labelKey: 'trophy.quadPot',
    hintKey: 'trophy.quadPotHint',
  },
  {
    id: 'cushion-pot',
    kind: 'skill',
    labelKey: 'trophy.cushionPot',
    hintKey: 'trophy.cushionPotHint',
  },
  {
    id: 'two-cushion-pot',
    kind: 'skill',
    labelKey: 'trophy.twoCushionPot',
    hintKey: 'trophy.twoCushionPotHint',
  },
  {
    id: 'spin-pot',
    kind: 'skill',
    labelKey: 'trophy.spinPot',
    hintKey: 'trophy.spinPotHint',
  },
  {
    id: 'draw-pot',
    kind: 'skill',
    labelKey: 'trophy.drawPot',
    hintKey: 'trophy.drawPotHint',
  },
  {
    id: 'break-pot',
    kind: 'skill',
    labelKey: 'trophy.breakPot',
    hintKey: 'trophy.breakPotHint',
  },
  {
    id: 'big-break',
    kind: 'skill',
    labelKey: 'trophy.bigBreak',
    hintKey: 'trophy.bigBreakHint',
  },
  {
    id: 'run-of-three',
    kind: 'skill',
    labelKey: 'trophy.runOfThree',
    hintKey: 'trophy.runOfThreeHint',
  },
  {
    id: 'run-of-five',
    kind: 'skill',
    labelKey: 'trophy.runOfFive',
    hintKey: 'trophy.runOfFiveHint',
  },
  {
    id: 'long-pot',
    kind: 'skill',
    labelKey: 'trophy.longPot',
    hintKey: 'trophy.longPotHint',
  },
  {
    id: 'soft-touch',
    kind: 'skill',
    labelKey: 'trophy.softTouch',
    hintKey: 'trophy.softTouchHint',
  },

  // ------------------------------------------------------- eight-ball
  {
    id: 'eight-first-win',
    kind: 'mode',
    mode: 'eight',
    labelKey: 'trophy.eightFirstWin',
    hintKey: 'trophy.eightFirstWinHint',
  },
  {
    id: 'eight-on-the-black',
    kind: 'mode',
    mode: 'eight',
    labelKey: 'trophy.eightOnTheBlack',
    hintKey: 'trophy.eightOnTheBlackHint',
  },
  {
    id: 'eight-clear-group',
    kind: 'mode',
    mode: 'eight',
    labelKey: 'trophy.eightClearGroup',
    hintKey: 'trophy.eightClearGroupHint',
  },
  {
    id: 'eight-team-win',
    kind: 'mode',
    mode: 'eight',
    labelKey: 'trophy.eightTeamWin',
    hintKey: 'trophy.eightTeamWinHint',
  },
  {
    id: 'eight-outnumbered',
    kind: 'mode',
    mode: 'eight',
    labelKey: 'trophy.eightOutnumbered',
    hintKey: 'trophy.eightOutnumberedHint',
  },
  {
    id: 'eight-ten-wins',
    kind: 'mode',
    mode: 'eight',
    labelKey: 'trophy.eightTenWins',
    hintKey: 'trophy.eightTenWinsHint',
    target: 10,
  },

  // --------------------------------------------------- eight-ball, called
  {
    id: 'called-first-win',
    kind: 'mode',
    mode: 'eight-called',
    labelKey: 'trophy.calledFirstWin',
    hintKey: 'trophy.calledFirstWinHint',
  },
  {
    id: 'called-as-said',
    kind: 'mode',
    mode: 'eight-called',
    labelKey: 'trophy.calledAsSaid',
    hintKey: 'trophy.calledAsSaidHint',
    target: 25,
  },
  {
    id: 'called-run-of-three',
    kind: 'mode',
    mode: 'eight-called',
    labelKey: 'trophy.calledRunOfThree',
    hintKey: 'trophy.calledRunOfThreeHint',
  },
  {
    id: 'called-black',
    kind: 'mode',
    mode: 'eight-called',
    labelKey: 'trophy.calledBlack',
    hintKey: 'trophy.calledBlackHint',
  },
  {
    id: 'called-side-pocket',
    kind: 'mode',
    mode: 'eight-called',
    labelKey: 'trophy.calledSidePocket',
    hintKey: 'trophy.calledSidePocketHint',
  },

  // ------------------------------------------------------------ straight pool
  {
    id: 'straight-first-win',
    kind: 'mode',
    mode: 'straight',
    labelKey: 'trophy.straightFirstWin',
    hintKey: 'trophy.straightFirstWinHint',
  },
  {
    id: 'straight-rerack',
    kind: 'mode',
    mode: 'straight',
    labelKey: 'trophy.straightRerack',
    hintKey: 'trophy.straightRerackHint',
  },
  {
    id: 'straight-across-racks',
    kind: 'mode',
    mode: 'straight',
    labelKey: 'trophy.straightAcrossRacks',
    hintKey: 'trophy.straightAcrossRacksHint',
  },
  {
    id: 'straight-run-of-eight',
    kind: 'mode',
    mode: 'straight',
    labelKey: 'trophy.straightRunOfEight',
    hintKey: 'trophy.straightRunOfEightHint',
  },
  {
    id: 'straight-half-target',
    kind: 'mode',
    mode: 'straight',
    labelKey: 'trophy.straightHalfTarget',
    hintKey: 'trophy.straightHalfTargetHint',
  },

  // ------------------------------------------------------------- free play
  {
    id: 'free-clean-sweep',
    kind: 'mode',
    mode: 'free',
    labelKey: 'trophy.freeCleanSweep',
    hintKey: 'trophy.freeCleanSweepHint',
  },
  {
    id: 'free-double-figures',
    kind: 'mode',
    mode: 'free',
    labelKey: 'trophy.freeDoubleFigures',
    hintKey: 'trophy.freeDoubleFiguresHint',
  },

  // ----------------------------------------------------------- the computer
  {
    id: 'beat-easy',
    kind: 'feat',
    labelKey: 'trophy.beatEasy',
    hintKey: 'trophy.beatEasyHint',
  },
  {
    id: 'beat-medium',
    kind: 'feat',
    labelKey: 'trophy.beatMedium',
    hintKey: 'trophy.beatMediumHint',
  },
  {
    id: 'beat-hard',
    kind: 'feat',
    labelKey: 'trophy.beatHard',
    hintKey: 'trophy.beatHardHint',
  },
  {
    id: 'beat-hard-ten',
    kind: 'feat',
    labelKey: 'trophy.beatHardTen',
    hintKey: 'trophy.beatHardTenHint',
    target: 10,
  },
  {
    id: 'beat-three-cpus',
    kind: 'feat',
    labelKey: 'trophy.beatThreeCpus',
    hintKey: 'trophy.beatThreeCpusHint',
  },
  {
    id: 'beat-hard-clean',
    kind: 'feat',
    labelKey: 'trophy.beatHardClean',
    hintKey: 'trophy.beatHardCleanHint',
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
  {
    id: 'wire-to-wire',
    kind: 'feat',
    labelKey: 'trophy.wireToWire',
    hintKey: 'trophy.wireToWireHint',
  },
  {
    id: 'comeback',
    kind: 'feat',
    labelKey: 'trophy.comeback',
    hintKey: 'trophy.comebackHint',
  },

  // ------------------------------------------------------------------ hidden
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
  {
    id: 'own-goal',
    kind: 'secret',
    labelKey: 'trophy.ownGoal',
    hintKey: 'trophy.ownGoalHint',
  },
  {
    id: 'both-ends',
    kind: 'secret',
    labelKey: 'trophy.bothEnds',
    hintKey: 'trophy.bothEndsHint',
  },
  {
    id: 'named-yourself',
    kind: 'secret',
    labelKey: 'trophy.namedYourself',
    hintKey: 'trophy.namedYourselfHint',
  },
];

export function trophyById(id: string): Trophy | undefined {
  return TROPHIES.find((trophy) => trophy.id === id);
}
