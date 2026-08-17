import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GameButton } from '@/components/ui/button';
import { Card, Screen, SectionLabel } from '@/components/ui/screen';
import { MENU_SELECTED, MenuPalette as Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { LEVELS } from '@/game/rules/levels';
import { useSession } from '@/store/session';

const PLAYER_OPTIONS = [1, 2, 3, 4];

export default function NewGameScreen() {
  const router = useRouter();
  const startFree = useSession((s) => s.startFree);
  const [players, setPlayers] = useState(2);

  const beginFree = () => {
    startFree(players);
    router.replace('/game');
  };

  return (
    <Screen title="Nuova partita" subtitle="Due modi di giocare" onBack={() => router.back()}>
      <SectionLabel>Partita libera</SectionLabel>
      <Card>
        <Text style={styles.body}>
          Castello completo, 15 palline. Un punto per pallina imbucata, e chi imbuca continua a
          tirare. Bianca in buca o nessuna pallina colpita costa un punto e passa il turno.
        </Text>

        <View>
          <Text style={styles.fieldLabel}>Giocatori</Text>
          <View style={styles.pillRow}>
            {PLAYER_OPTIONS.map((count) => {
              const selected = count === players;
              return (
                <Pressable
                  key={count}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setPlayers(count)}
                  style={({ pressed }) => [
                    styles.pill,
                    selected && styles.pillSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]}>
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helper}>
            {players === 1
              ? 'Con un solo giocatore è una sfida al punteggio.'
              : `${players} giocatori a turno sullo stesso dispositivo.`}
          </Text>
        </View>

        <GameButton label="Inizia partita libera" variant="primary" onPress={beginFree} />
      </Card>

      <SectionLabel>Puzzle</SectionLabel>
      <Card>
        <Text style={styles.body}>
          {LEVELS.length} livelli con un numero limitato di colpi e un obiettivo preciso: imbucare
          certe palline, in un certo ordine, o in una certa buca. Meno colpi usi, più stelle prendi.
        </Text>
        <GameButton label="Scegli un livello" onPress={() => router.push('/levels')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: Palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  fieldLabel: {
    color: Palette.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pill: {
    flex: 1,
    height: 48,
    borderRadius: Radius.small,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: MENU_SELECTED,
    borderColor: Palette.accent,
  },
  pillLabel: {
    color: Palette.textMuted,
    fontSize: 17,
    fontWeight: '700',
  },
  pillLabelSelected: {
    color: Palette.accent,
  },
  pressed: {
    opacity: 0.7,
  },
  helper: {
    color: Palette.textMuted,
    fontSize: 12,
    marginTop: Spacing.two,
  },
});
