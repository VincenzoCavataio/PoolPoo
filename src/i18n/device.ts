/**
 * The phone's own language.
 *
 * Kept in its own file so the translation core stays free of native modules and
 * can keep running under the Node test harness. Resolved once and cached: it
 * cannot change without the app restarting, and it is a bridge call.
 */

import { getLocales } from 'expo-localization';

import type { Locale } from './index';

let cached: Locale | null = null;

export function deviceLocale(): Locale {
  if (cached) return cached;

  try {
    const code = getLocales()[0]?.languageCode;
    cached = code === 'it' ? 'it' : 'en';
  } catch {
    // Reading the locale must never be the reason a game fails to start.
    cached = 'en';
  }
  return cached;
}
