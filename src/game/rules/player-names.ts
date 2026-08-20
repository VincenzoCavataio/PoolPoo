/**
 * What to call the people at the table.
 *
 * One place, because the rule is easy to get subtly wrong in several: the person
 * holding the phone takes the first seat and is called by the name they gave,
 * everybody else is numbered from two — a screen that numbered them from one
 * would seat a "Player 1" next to the person who *is* player one.
 *
 * The rules layer has no language of its own and never invents a name, so the
 * translator is passed in rather than reached for.
 */

import type { Translator } from '@/i18n';

/**
 * Names for a game between people.
 *
 * `playerName` may be empty — the question can be skipped — in which case the
 * first seat falls back to being numbered like the rest.
 */
export function humanNames(count: number, playerName: string, t: Translator): string[] {
  return Array.from({ length: count }, (_, index) => {
    if (index === 0 && playerName) return playerName;
    return t('rules.player', { number: index + 1 });
  });
}

/**
 * Names for a game against the computer.
 *
 * The person first, then one entry per machine. `cpuNames` lets the difficulty
 * screen pass through whatever the player has renamed them to; anything missing
 * falls back to the numbered default.
 */
export function cpuGameNames(
  playerName: string,
  cpuCount: number,
  t: Translator,
  cpuNames: (string | undefined)[] = [],
): string[] {
  return [
    playerName || t('rules.player', { number: 1 }),
    ...Array.from(
      { length: cpuCount },
      (_, index) => cpuNames[index] || t('difficulty.cpuName', { number: index + 1 }),
    ),
  ];
}
