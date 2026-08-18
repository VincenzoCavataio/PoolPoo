import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GameButton } from '@/components/ui/button';
import { Card, Screen, SectionLabel } from '@/components/ui/screen';
import { MENU_SELECTED, MenuPalette as Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { LEVELS } from '@/game/rules/levels';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';

const PLAYER_OPTIONS = [1, 2, 3, 4];

export default function NewGameScreen() {
  const router = useRouter();
  const t = useT();
  const startFree = useSession((s) => s.startFree);
  const [players, setPlayers] = useState(2);

  const beginFree = () => {
    // Default names are translated, so they are built here and handed to the
    // rules rather than invented inside them.
    const names = Array.from({ length: players }, (_, i) => t('rules.player', { number: i + 1 }));
    startFree(players, names);
    router.replace('/game');
  };

  return (
    <Screen
      title={t('newGame.title')}
      subtitle={t('newGame.subtitle')}
      onBack={() => router.back()}>
      <SectionLabel>{t('newGame.freeSection')}</SectionLabel>
      <Card>
        <Text style={styles.body}>{t('newGame.freeBody')}</Text>

        <View>
          <Text style={styles.fieldLabel}>{t('newGame.players')}</Text>
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
            {players === 1 ? t('newGame.soloHint') : t('newGame.multiHint', { count: players })}
          </Text>
        </View>

        <GameButton label={t('newGame.startFree')} variant="primary" onPress={beginFree} />
      </Card>

      <SectionLabel>{t('newGame.puzzleSection')}</SectionLabel>
      <Card>
        <Text style={styles.body}>{t('newGame.puzzleBody', { count: LEVELS.length })}</Text>
        <GameButton label={t('newGame.chooseLevel')} onPress={() => router.push('/levels')} />
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
