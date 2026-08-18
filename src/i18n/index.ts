/**
 * Translation.
 *
 * Deliberately hand-rolled and dependency-free. Two languages and a few hundred
 * strings do not justify a library, and keeping it as plain data means the whole
 * thing — including the check that the catalogues actually agree — runs in Node
 * under the same test harness as the physics.
 *
 * Italian is the source of truth: `MessageKey` is derived from it, so English is
 * type-checked against it and a forgotten translation is a compile error rather
 * than a string that silently shows up in the wrong language.
 */

import { isPlural, type Entry, type Values } from './catalogue';
import { en } from './en';
import { it } from './it';

export type { Values } from './catalogue';

export const LOCALES = ['it', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABEL: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
};

export type MessageKey = keyof typeof it;

const CATALOGUES: Record<Locale, Record<MessageKey, Entry>> = { it, en };

/**
 * A translatable line produced away from the UI.
 *
 * The rules layer returns these instead of prose. It keeps the game logic pure
 * and language-free, and it means the rules tests assert on a stable key rather
 * than on an Italian sentence that a translation pass would break.
 */
export interface Message {
  key: MessageKey;
  values?: Values;
}

export function msg(key: MessageKey, values?: Values): Message {
  return values ? { key, values } : { key };
}

function renderValue(locale: Locale, value: Values[string]): string {
  if (typeof value === 'object' && value !== null && 'key' in value) {
    return translate(locale, value.key as MessageKey, value.values);
  }
  return String(value);
}

function interpolate(locale: Locale, template: string, values?: Values): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? renderValue(locale, values[name]) : whole,
  );
}

export function translate(locale: Locale, key: MessageKey, values?: Values): string {
  // Falling back through Italian rather than throwing: a missing string should
  // degrade to the wrong language, never to a crash mid-game.
  const entry: Entry | undefined = CATALOGUES[locale]?.[key] ?? CATALOGUES.it[key];
  if (entry === undefined) return key;

  if (isPlural(entry)) {
    const count = Number(values?.count ?? 0);
    return interpolate(locale, Math.abs(count) === 1 ? entry.one : entry.other, values);
  }
  return interpolate(locale, entry, values);
}

/** Renders a message descriptor. */
export function translateMessage(locale: Locale, message: Message): string {
  return translate(locale, message.key, message.values);
}

export type Translator = (key: MessageKey, values?: Values) => string;

export function translatorFor(locale: Locale): Translator {
  return (key, values) => translate(locale, key, values);
}
