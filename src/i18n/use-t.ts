/**
 * Translation for components.
 *
 * `language` lives in the settings store, so switching it re-renders everything
 * that reads a string, with no reload and no event bus.
 */

import { useMemo } from 'react';

import { useSettings } from '@/store/settings';

import { deviceLocale } from './device';
import { translateMessage, translatorFor, type Locale, type Message, type Translator } from './index';

export function useLocale(): Locale {
  const language = useSettings((s) => s.language);
  return language === 'auto' ? deviceLocale() : language;
}

export function useT(): Translator {
  const locale = useLocale();
  return useMemo(() => translatorFor(locale), [locale]);
}

/** Renders the descriptors the rules layer hands back. */
export function useMessageRenderer(): (message: Message) => string {
  const locale = useLocale();
  return useMemo(() => (message: Message) => translateMessage(locale, message), [locale]);
}
