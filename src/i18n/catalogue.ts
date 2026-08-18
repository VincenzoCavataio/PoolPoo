/**
 * Shape of a translation catalogue.
 *
 * An entry is either a plain string or a pair of plural forms. Italian and
 * English happen to agree on needing exactly `one` and `other`, which is why
 * two forms are enough here — a language with more (Polish, Russian) would need
 * this type widened before it could be added.
 */

export interface Plural {
  one: string;
  other: string;
}

export type Entry = string | Plural;

/**
 * A message referenced from inside another message.
 *
 * Loosely typed here on purpose: the narrow `Message` in `index.ts` knows the
 * real key union, but this module is what defines `Values` and cannot import it
 * back without a cycle.
 */
export interface AnyMessage {
  key: string;
  values?: Values;
}

/**
 * Values substituted into `{placeholders}`. `count` also picks the plural.
 *
 * A value may itself be a message, which is what lets one sentence quote
 * another — "Foul: cue ball potted" is a foul line with a reason slotted into
 * it, and both halves have to translate.
 */
export type Values = Record<string, string | number | AnyMessage>;

export function isPlural(entry: Entry): entry is Plural {
  return typeof entry !== 'string';
}
