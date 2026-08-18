import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Stars } from '@/components/game/hud';
import { Screen } from '@/components/ui/screen';
import { MENU_SELECTED, MenuPalette as Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { LEVELS } from '@/game/rules/levels';
import { describeGoal } from '@/game/rules/puzzle';
import { useMessageRenderer, useT } from '@/i18n/use-t';
import { isLevelUnlocked, MAX_STARS, totalStars, useProgress } from '@/store/progress';
import { useSession } from '@/store/session';

export default function LevelsScreen() {
  const router = useRouter();
  const t = useT();
  const render = useMessageRenderer();
  const stars = useProgress((s) => s.stars);
  const startPuzzle = useSession((s) => s.startPuzzle);

  const open = (levelId: string) => {
    if (startPuzzle(levelId)) router.replace('/game');
  };

  return (
    <Screen
      title={t('levels.title')}
      subtitle={t('levels.subtitle', { earned: totalStars(stars), total: MAX_STARS })}
      onBack={() => router.back()}>
      {LEVELS.map((level, index) => {
        const unlocked = isLevelUnlocked(stars, level.id);
        const earned = stars[level.id] ?? 0;

        return (
          <Pressable
            key={level.id}
            accessibilityRole="button"
            accessibilityState={{ disabled: !unlocked }}
            disabled={!unlocked}
            onPress={() => open(level.id)}
            style={({ pressed }) => [
              styles.row,
              !unlocked && styles.rowLocked,
              pressed && styles.pressed,
            ]}>
            <View style={[styles.index, earned > 0 && styles.indexDone]}>
              <Text style={[styles.indexLabel, earned > 0 && styles.indexLabelDone]}>
                {unlocked ? index + 1 : '🔒'}
              </Text>
            </View>

            <View style={styles.rowBody}>
              <Text style={styles.name}>{t(level.nameKey)}</Text>
              <Text style={styles.goal} numberOfLines={2}>
                {unlocked ? render(describeGoal(level)) : t('levels.locked')}
              </Text>
              {unlocked ? (
                <Text style={styles.budget}>
                  {t('levels.budget', { shots: level.maxShots, three: level.stars.three })}
                </Text>
              ) : null}
            </View>

            {unlocked ? <Stars value={earned} /> : null}
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Palette.surface,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.three,
  },
  rowLocked: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
  index: {
    width: 40,
    height: 40,
    borderRadius: Radius.small,
    backgroundColor: Palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexDone: {
    backgroundColor: MENU_SELECTED,
  },
  indexLabel: {
    color: Palette.textMuted,
    fontSize: 16,
    fontWeight: '800',
  },
  indexLabelDone: {
    color: Palette.accent,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  goal: {
    color: Palette.textMuted,
    fontSize: 13,
  },
  budget: {
    color: Palette.textMuted,
    fontSize: 11,
    opacity: 0.8,
  },
});
