/**
 * Translation test suite. `npm run test:i18n`
 *
 * TypeScript already guarantees that English defines every Italian key. What it
 * cannot see is whether the two say the same *shape* of thing: a translation
 * that drops a `{name}` placeholder, or answers a plural key with a single
 * string, compiles perfectly and then loses a word on screen. Those are the
 * failures this catches.
 */

import { assert, assertEqual, report, suite, test } from '../../game/core/tests/harness';
import { isPlural, type Entry } from '../catalogue';
import { en } from '../en';
import { it } from '../it';
import { LOCALES, translate, type Locale, type MessageKey } from '../index';

const KEYS = Object.keys(it) as MessageKey[];
const CATALOGUES: Record<Locale, Record<string, Entry>> = { it, en };

/** Every `{placeholder}` an entry uses, in both its forms. */
function placeholders(entry: Entry): Set<string> {
  const found = new Set<string>();
  const forms = isPlural(entry) ? [entry.one, entry.other] : [entry];

  for (const form of forms) {
    for (const match of form.matchAll(/\{(\w+)\}/g)) found.add(match[1]);
  }
  return found;
}

function textOf(entry: Entry): string[] {
  return isPlural(entry) ? [entry.one, entry.other] : [entry];
}

suite('catalogues', () => {
  test('there is something to translate', () => {
    assert(KEYS.length > 80, `only ${KEYS.length} keys defined`);
    assertEqual(LOCALES.length, 2, 'locale count');
  });

  test('both languages define exactly the same keys', () => {
    const italian = new Set(KEYS);
    const english = new Set(Object.keys(en));

    for (const key of italian) assert(english.has(key), `English is missing ${key}`);
    for (const key of english) assert(italian.has(key as MessageKey), `English has a stray ${key}`);
  });

  test('a plural key is plural in every language', () => {
    for (const key of KEYS) {
      const italian = it[key] as Entry;
      const english = en[key];
      assertEqual(
        isPlural(english),
        isPlural(italian),
        `${key}: plural in Italian but not in English, or the reverse`,
      );
    }
  });

  test('translations keep every placeholder', () => {
    for (const key of KEYS) {
      const wanted = placeholders(it[key] as Entry);
      const got = placeholders(en[key]);

      for (const name of wanted) {
        assert(got.has(name), `${key}: English drops {${name}}`);
      }
      for (const name of got) {
        assert(wanted.has(name), `${key}: English invents {${name}}`);
      }
    }
  });

  test('a plural entry uses the same placeholders in both forms', () => {
    for (const locale of LOCALES) {
      for (const key of KEYS) {
        const entry = CATALOGUES[locale][key];
        if (!isPlural(entry)) continue;

        const one = placeholders(entry.one);
        const other = placeholders(entry.other);
        for (const name of one) {
          assert(other.has(name), `${locale}/${key}: the plural form drops {${name}}`);
        }
      }
    }
  });

  test('nothing is blank and nothing is left half written', () => {
    for (const locale of LOCALES) {
      for (const key of KEYS) {
        for (const form of textOf(CATALOGUES[locale][key])) {
          assert(form.trim().length > 0, `${locale}/${key} is empty`);
          assert(!form.includes('{}'), `${locale}/${key} has an empty placeholder`);
          assert(!/\{[^}]*$/.test(form), `${locale}/${key} has an unclosed placeholder`);
          assert(!/TODO|FIXME/i.test(form), `${locale}/${key} still says TODO`);
        }
      }
    }
  });
});

suite('translation', () => {
  test('placeholders are filled in', () => {
    assertEqual(
      translate('it', 'rules.player', { number: 3 }),
      'Giocatore 3',
      'Italian interpolation',
    );
    assertEqual(translate('en', 'rules.player', { number: 3 }), 'Player 3', 'English interpolation');
  });

  test('a missing value leaves the placeholder rather than printing undefined', () => {
    // Better a visible {number} in one line than the word "undefined" in the UI.
    assertEqual(translate('it', 'rules.player', {}), 'Giocatore {number}', 'untouched placeholder');
  });

  test('count picks the plural form', () => {
    assertEqual(translate('it', 'result.points', { count: 1 }), '1 punto', 'Italian singular');
    assertEqual(translate('it', 'result.points', { count: 4 }), '4 punti', 'Italian plural');
    assertEqual(translate('en', 'result.points', { count: 1 }), '1 point', 'English singular');
    assertEqual(translate('en', 'result.points', { count: 0 }), '0 points', 'English zero');
  });

  test('a negative single still reads as a singular', () => {
    // Fouls subtract, and "-1 punti" is wrong in both languages.
    assertEqual(translate('it', 'result.points', { count: -1 }), '-1 punto', 'Italian minus one');
  });

  test('an unknown key degrades to the key itself', () => {
    assertEqual(
      translate('it', 'nope.not.a.key' as MessageKey, undefined),
      'nope.not.a.key',
      'unknown key',
    );
  });

  test('every key renders in every language without throwing', () => {
    const probe = { count: 2, number: 7, name: 'X', numbers: '1, 2', points: 3, balls: 2, reason: 'R', used: 1, total: 3, earned: 4, shots: 5, three: 2 };

    for (const locale of LOCALES) {
      for (const key of KEYS) {
        const line = translate(locale, key, probe);
        assert(line.length > 0, `${locale}/${key} rendered empty`);
        assert(!line.includes('{'), `${locale}/${key} left a placeholder unfilled: ${line}`);
      }
    }
  });
});

report();
