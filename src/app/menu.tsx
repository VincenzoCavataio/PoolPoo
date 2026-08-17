import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { GameButton } from '@/components/ui/button';
import { GlowRule, LuxeFonts, Overline } from '@/components/ui/luxe';
import { Luxe } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { levelById } from '@/game/rules/levels';
import { describeSave, loadSavedGame, type SavedGame } from '@/store/persistence';
import { MAX_STARS, totalStars, useProgress } from '@/store/progress';
import { useSession } from '@/store/session';

function describeSavedGame(save: SavedGame): string {
  const when = describeSave(save);
  if (save.mode === 'free') {
    const players = save.free?.players.length ?? 1;
    return `Partita libera · ${players} ${players === 1 ? 'giocatore' : 'giocatori'}${when ? ` · ${when}` : ''}`;
  }
  const name = save.levelId ? levelById(save.levelId)?.name : undefined;
  return `Puzzle${name ? ` · ${name}` : ''}${when ? ` · ${when}` : ''}`;
}

export default function MenuScreen() {
  const router = useRouter();
  const resume = useSession((s) => s.resume);
  const stars = useProgress((s) => s.stars);

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

  const earned = totalStars(stars);

  return (
    <Screen title="Biliardo" subtitle="Tre dimensioni">
      <GameButton
        label="Nuova partita"
        variant="primary"
        sublabel="Partita libera oppure puzzle"
        onPress={() => router.push('/new-game')}
      />

      <GameButton
        label="Continua"
        onPress={onContinue}
        disabled={!save}
        sublabel={
          save ? describeSavedGame(save) : checked ? 'Nessuna partita salvata' : 'Controllo…'
        }
      />

      <GameButton label="Opzioni" onPress={() => router.push('/options')} />

      <View style={styles.ledger}>
        <View style={styles.ledgerRow}>
          <Overline>Stelle raccolte</Overline>
          <Text style={styles.ledgerValue}>
            {earned}
            <Text style={styles.ledgerTotal}> / {MAX_STARS}</Text>
          </Text>
        </View>
        <GlowRule width={`${Math.round((earned / MAX_STARS) * 100)}%`} align="flex-start" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ledger: {
    marginTop: Spacing.five,
    gap: Spacing.three,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  ledgerValue: {
    color: Luxe.gold,
    fontSize: 20,
    fontWeight: '400',
    fontFamily: LuxeFonts.serif,
    fontVariant: ['tabular-nums'],
  },
  ledgerTotal: {
    color: Luxe.textFaint,
    fontSize: 13,
  },
});
