/**
 * Who is at the table, and how good the machines are.
 *
 * One panel per seat, because the point of playing several computers is that
 * they need not be alike — a hard one to beat and two easy ones to stay ahead of
 * is a different evening from three mediums, and asking once for all of them
 * would throw that away.
 *
 * Every seat can be renamed, the player's included. A scoreboard reading
 * "Computer 2 beat Player 1" is a scoreboard nobody is in; names are most of
 * what makes a frame feel like it happened to somebody.
 *
 * The player always takes the first seat. That is not arbitrary: whoever breaks
 * has an advantage, and giving it to the person is the friendlier default.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { useSettings } from '@/store/settings';

const LEVELS: { id: Difficulty; labelKey: MessageKey }[] = [
  { id: 'easy', labelKey: 'difficulty.easy' },
  { id: 'medium', labelKey: 'difficulty.medium' },
  { id: 'hard', labelKey: 'difficulty.hard' },
];

/** One seat: a name that can be edited, and — for a machine — a strength. */
interface Seat {
  name: string;
  level?: Difficulty;
}

export default function DifficultyScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const startFree = useSession((s) => s.startFree);
  const playerName = useSettings((s) => s.playerName);
  const setPlayerName = useSettings((s) => s.setPlayerName);

  const params = useLocalSearchParams<{ players?: string; mode?: string }>();
  // Carried from the mode screen; anything but `cpu` is a game between people.
  const mode = params.mode === 'cpu' ? 'cpu' : 'human';
  // The total round the table, the person included.
  const total = Math.max(1, Math.min(8, Number(params.players) || 2));

  const [seats, setSeats] = useState<Seat[]>(() => [
    { name: playerName || t('rules.player', { number: 1 }) },
    ...Array.from({ length: total - 1 }, (_, index) =>
      mode === 'cpu'
        ? {
            name: t('difficulty.cpuName', { number: index + 1 }),
            // Medium by default: neither a pushover nor a wall is the one most
            // people would have picked anyway.
            level: 'medium' as Difficulty,
          }
        : { name: t('rules.player', { number: index + 2 }) },
    ),
  ]);

  const update = (index: number, change: Partial<Seat>) => {
    setSeats((all) => all.map((seat, i) => (i === index ? { ...seat, ...change } : seat)));
  };

  const begin = () => {
    playTap('confirm');

    /*
     * A renamed first seat is the player renaming themselves.
     *
     * Writing it back means the change sticks — the greeting on the menu and the
     * next game both follow — rather than applying to this frame only, which
     * would be a rename that quietly undoes itself.
     */
    const chosen = seats[0].name.trim();
    if (chosen && chosen !== playerName) setPlayerName(chosen);

    startFree(
      seats.length,
      seats.map((seat, i) => seat.name.trim() || t('rules.player', { number: i + 1 })),
      seats.map((seat) => seat.level),
    );
    router.push('/setup');
  };

  return (
    <View style={styles.root}>
      {/* Outside the padded column, so the bar reaches both edges and runs up
          under the status bar. */}
      <ScreenHeader
        title={t('difficulty.title')}
        onBack={() => router.back()}
        topInset={insets.top}
      />

      <View style={styles.inner}>
        <View style={styles.centre}>
          {seats.map((seat, index) => (
            <Animated.View
              key={index}
              entering={FadeIn.delay(60 + index * 50).duration(260)}
              style={styles.seat}>
              {/*
                Who this seat is, in a word.

                The first is always the person holding the phone; the rest are
                machines or the friends passing it round, and knowing which
                before reading the name is what makes the list scannable.
              */}
              <Text style={styles.seatRole}>
                {index === 0
                  ? t('difficulty.roleYou')
                  : seat.level
                    ? t('difficulty.roleCpu')
                    : t('difficulty.rolePlayer', { number: index + 1 })}
              </Text>

              {/*
                The name, edited in place.

                A text field rather than a label with a pencil beside it: there
                are at most a handful of these, they are all visible at once, and
                a dialog per rename would be four taps to change a word.
              */}
              <TextInput
                value={seat.name}
                onChangeText={(name) => update(index, { name })}
                placeholder={t('name.placeholder')}
                placeholderTextColor={Luxe.textFaint}
                style={styles.nameInput}
                maxLength={24}
                autoCorrect={false}
                returnKeyType="done"
              />

              {/* Only a machine has a strength to set. */}
              {seat.level ? (
                <View style={styles.pills}>
                  {LEVELS.map((level) => {
                    const selected = level.id === seat.level;
                    return (
                      <Pressable
                        key={level.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        onPress={() => {
                          playTap();
                          update(index, { level: level.id });
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
              ) : null}
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
  root: {
    flex: 1,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    // The bar above carries the safe-area inset now; this is only the gap
    // between it and the content.
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },
  centre: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  /**
   * One seat, given room to be read.
   *
   * These were tight rows of small capitals, which is the shape of a settings
   * list — and this is not a list of settings, it is the people about to play.
   * The name is the largest thing on the panel because it is the thing being
   * chosen.
   */
  seat: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201, 169, 98, 0.28)',
    backgroundColor: '#080b0a',
  },
  seatRole: {
    color: Luxe.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  nameInput: {
    color: Luxe.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.14)',
  },
  pills: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
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
    fontSize: 12,
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
    backgroundColor: '#080b0a',
  },
  goPressed: {
    backgroundColor: '#141a19',
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
