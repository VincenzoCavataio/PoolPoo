/**
 * The menu.
 *
 * Three choices and nothing else. It used to carry a star ledger along the
 * bottom — earned against a total, with a lit rule showing the fraction — which
 * measured progress through the puzzle levels. With those gone the ledger had
 * nothing to count, and a menu that reports a number nobody can change is worse
 * than one that reports nothing.
 *
 * Continue leads the list when there is a game to come back to, because that is
 * what someone opening the app mid-frame is reaching for. When there is not, it
 * stays in place but reads as unavailable rather than vanishing — a list that
 * reorders itself between visits is a list you have to read every time.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { GameButton } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useT } from '@/i18n/use-t';
import type { Translator } from '@/i18n';
import { describeSave, loadSavedGame, type SavedGame } from '@/store/persistence';
import { useSession } from '@/store/session';

function describeSavedGame(save: SavedGame, t: Translator): string {
  const when = describeSave(save);
  const players = save.free?.players.length ?? 1;
  return `${t('menu.savedFree', { count: players })}${when ? ` · ${when}` : ''}`;
}

export default function MenuScreen() {
  const router = useRouter();
  const t = useT();
  const resume = useSession((s) => s.resume);

  const [save, setSave] = useState<SavedGame | null>(null);
  const [checked, setChecked] = useState(false);

  // Re-read on focus so finishing a game removes a stale Continue entry.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSavedGame().then((loaded) => {
        if (!active) return;
        setSave(loaded);
        setChecked(true);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const onContinue = () => {
    if (!save) return;
    if (resume(save)) router.push('/game');
  };

  return (
    <Screen title={t('title.wordmark')} subtitle={t('menu.subtitle')}>
      <GameButton
        label={t('menu.newGame')}
        variant="primary"
        sublabel={t('menu.newGameSub')}
        onPress={() => router.push('/new-game')}
      />

      <GameButton
        label={t('menu.continue')}
        onPress={onContinue}
        disabled={!save}
        sublabel={
          save ? describeSavedGame(save, t) : checked ? t('menu.noSave') : t('common.checking')
        }
      />

      <GameButton label={t('menu.options')} onPress={() => router.push('/options')} />
    </Screen>
  );
}
