/**
 * How strong each computer is.
 *
 * One row per machine, because the point of playing several is that they are not
 * all the same — a hard one to beat and two easy ones to stay ahead of is a
 * different evening from three mediums, and asking once for all of them would
 * throw that away.
 *
 * The player always takes the first seat. That is not arbitrary: whoever breaks
 * has an advantage, and giving it to the person is the friendlier default. The
 * computers fill the seats after them.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen';
import { Luxe } from '@/constants/game-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { Difficulty } from '@/game/ai/opponent';
import { playTap } from '@/game/audio/sfx';
import type { MessageKey } from '@/i18n';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';

const LEVELS: { id: Difficulty; labelKey: MessageKey }[] = [
  { id: 'easy', labelKey: 'difficulty.easy' },
  { id: 'medium', labelKey: 'difficulty.medium' },
  { id: 'hard', labelKey: 'difficulty.hard' },
];

export default function DifficultyScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const startFree = useSession((s) => s.startFree);

  const params = useLocalSearchParams<{ players?: string }>();
  // The total round the table, including the person. At least one machine.
  const total = Math.max(2, Math.min(8, Number(params.players) || 2));
  const cpuCount = total - 1;

  const [levels, setLevels] = useState<Difficulty[]>(
    // Medium by default: an opponent that is neither a pushover nor a wall is
    // the one most people would have picked anyway.
    Array.from({ length: cpuCount }, () => 'medium'),
  );

  const begin = () => {
    playTap('confirm');

    const names = [
      t('rules.player', { number: 1 }),
      ...levels.map((level, i) => t('difficulty.cpuName', { number: i + 1 })),
    ];

    // Seat 0 is the person; the rest carry their difficulty.
    startFree(total, names, [undefined, ...levels]);
    router.push('/setup');
  };

  return (
    <View style={styles.root}>
      <View style={[styles.inner, { paddingTop: insets.top + Spacing.four }]}>
        <ScreenHeader title={t('difficulty.title')} onBack={() => router.back()} />

        <View style={styles.centre}>
          {levels.map((current, index) => (
            <Animated.View
              key={index}
              entering={FadeIn.delay(60 + index * 50).duration(260)}
              style={styles.seat}>
              <Text style={styles.seatLabel}>
                {t('difficulty.cpuName', { number: index + 1 })}
              </Text>

              <View style={styles.pills}>
                {LEVELS.map((level) => {
                  const selected = level.id === current;
                  return (
                    <Pressable
                      key={level.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        playTap();
                        setLevels((all) =>
                          all.map((value, i) => (i === index ? level.id : value)),
                        );
                      }}
                      style={({ pressed }) => [
                        styles.pill,
                        selected && styles.pillSelected,
                        pressed && styles.pressed,
                      ]}>
                      <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]}>
                        {t(level.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(120).duration(280)}>
          <Pressable
            accessibilityRole="button"
            onPress={begin}
            style={({ pressed }) => [styles.go, pressed && styles.goPressed]}>
            <Text style={styles.goLabel}>{t('newGame.next')}</Text>
            <Text style={styles.goChevron}>{'›'}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * The same veil the shared `Screen` wears.
   *
   * This screen builds its own frame rather than using that component, so it has
   * to carry the ground itself — without it the panels float on the drifting
   * table and the page reads as a scroll over nothing.
   */
  root: {
    flex: 1,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  centre: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  seat: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201, 169, 98, 0.28)',
    backgroundColor: 'rgba(6, 9, 8, 0.92)',
  },
  seatLabel: {
    color: Luxe.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  pills: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  pillSelected: {
    borderColor: 'rgba(201, 169, 98, 0.45)',
    backgroundColor: '#1c2b26',
  },
  pillLabel: {
    color: Luxe.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  pillLabelSelected: {
    color: Luxe.gold,
  },
  pressed: {
    opacity: 0.6,
  },
  go: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 98, 0.5)',
    backgroundColor: '#111716',
  },
  goPressed: {
    backgroundColor: '#1a2321',
  },
  goLabel: {
    color: Luxe.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  goChevron: {
    color: 'rgba(201, 169, 98, 0.6)',
    fontSize: 22,
    lineHeight: 24,
    marginTop: -2,
  },
});
