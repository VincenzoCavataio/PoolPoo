import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { GameButton } from '@/components/ui/button';
import { Arcade } from '@/constants/game-theme';
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
    <Screen title="Biliardo 3D" subtitle="Inserisci una moneta">
      <GameButton
        label="Nuova partita"
        variant="primary"
        sublabel="Libera o puzzle"
        badge="1P–4P"
        onPress={() => router.push('/new-game')}
      />

      <GameButton
        label="Continua"
        onPress={onContinue}
        disabled={!save}
        badge={save ? 'PRONTA' : undefined}
        sublabel={
          save ? describeSavedGame(save) : checked ? 'Nessuna partita salvata' : 'Controllo…'
        }
      />

      <GameButton label="Opzioni" onPress={() => router.push('/options')} />

      <View style={styles.scoreboard}>
        <View style={styles.scoreEdge} pointerEvents="none" />
        <View style={styles.scoreBody}>
          <Text style={styles.scoreLabel}>Stelle</Text>
          <Text style={styles.scoreValue}>
            {String(earned).padStart(2, '0')}
            <Text style={styles.scoreTotal}> / {MAX_STARS}</Text>
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scoreboard: {
    marginTop: Spacing.three,
    position: 'relative',
  },
  scoreEdge: {
    position: 'absolute',
    left: 5,
    right: -5,
    top: 5,
    bottom: -5,
    backgroundColor: '#0d0620',
  },
  scoreBody: {
    backgroundColor: Arcade.panel,
    borderWidth: 3,
    borderColor: Arcade.edge,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  scoreLabel: {
    color: Arcade.cyan,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontWeight: '900',
  },
  scoreValue: {
    color: Arcade.gold,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  scoreTotal: {
    color: Arcade.textMuted,
    fontSize: 14,
  },
});
