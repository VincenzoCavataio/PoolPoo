/**
 * Which game is being played.
 *
 * Four disciplines on one table. They are not difficulty settings — each is a
 * different game with its own point, and the difference is worth a sentence
 * rather than a word, because "8-ball" and "14.1" mean nothing to somebody who
 * has only ever played whatever the pub table was set up for.
 *
 * Ordered by how much has to be explained: free play first, straight pool last.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CalledIcon,
  EightBallIcon,
  FreePlayIcon,
  StraightPoolIcon,
} from '@/components/ui/icons';
import { ScreenHeader } from '@/components/ui/screen';
import { Luxe } from '@/constants/game-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { playTap } from '@/game/audio/sfx';
import { humanNames } from '@/game/rules/player-names';
import type { Match } from '@/game/rules/match';
import { GameModeKind } from '@/game/rules/types';
import type { MessageKey } from '@/i18n';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

/** The four the player can pick between. `puzzle` is not one of them. */
type Playable = Match['kind'];

interface Discipline {
  id: Playable;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  /** Whether it can be played alone. Eight-ball needs an opponent. */
  solo: boolean;
  /**
   * Drawn from what the game is about rather than from billiards in general.
   *
   * Four entries that all said "pool" would be four identical rows; each of
   * these picks the thing that makes its game different from the other three.
   */
  icon: (props: { size?: number; color?: string }) => React.ReactElement;
}

const DISCIPLINES: Discipline[] = [
  {
    id: GameModeKind.FREE,
    titleKey: 'discipline.free',
    bodyKey: 'discipline.freeBody',
    solo: true,
    icon: FreePlayIcon,
  },
  {
    id: GameModeKind.EIGHT,
    titleKey: 'discipline.eight',
    bodyKey: 'discipline.eightBody',
    solo: false,
    icon: EightBallIcon,
  },
  {
    id: GameModeKind.EIGHT_CALLED,
    titleKey: 'discipline.eightCalled',
    bodyKey: 'discipline.eightCalledBody',
    solo: false,
    icon: CalledIcon,
  },
  {
    id: GameModeKind.STRAIGHT,
    titleKey: 'discipline.straight',
    bodyKey: 'discipline.straightBody',
    solo: true,
    icon: StraightPoolIcon,
  },
];

export default function RulesScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const startGame = useSession((s) => s.startGame);
  const playerName = useSettings((s) => s.playerName);

  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode === 'cpu' ? 'cpu' : params.mode === 'solo' ? 'solo' : 'human';

  const [chosen, setChosen] = useState<Playable>(GameModeKind.FREE);

  // Alone there is nobody to take the other group, so the two eight-ball
  // entries are not offered rather than being offered and then refused.
  const available = DISCIPLINES.filter((d) => mode !== 'solo' || d.solo);
  const chosenDiscipline = available.find((d) => d.id === chosen) ?? available[0];

  const next = () => {
    playTap('confirm');

    if (mode === 'solo') {
      startGame(chosen, 1, humanNames(1, playerName, t));
      router.push('/setup');
      return;
    }

    router.push({ pathname: '/new-game', params: { mode, rules: chosen } });
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('discipline.title')}
        onBack={() => router.back()}
        topInset={insets.top}
      />

      {/* The home indicator's strip is added to the padding rather than being
          part of it, so the button sits the same distance above the *usable*
          bottom of every screen — which is the distance a thumb feels. */}
      <View style={[styles.inner, { paddingBottom: Spacing.six + insets.bottom }]}>
        {/*
          Scrolls only when it has to.

          Four cards with a mark and a sentence each is taller than a small
          phone, but on a large one the list should sit centred rather than
          pinned to the top with dead space under it. `contentContainerStyle`
          carries `flexGrow: 1` and the centring, so a short list is centred and
          a long one scrolls — one component for both, instead of measuring the
          screen and choosing.
        */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.centre}
          showsVerticalScrollIndicator={false}>
          {available.map((discipline, index) => {
            const selected = discipline.id === chosen;
            return (
              <Animated.View
                key={discipline.id}
                entering={FadeIn.delay(50 + index * 45).duration(240)}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    playTap();
                    setChosen(discipline.id);
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    selected && styles.cardSelected,
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.cardHead}>
                    <View style={[styles.iconBox, selected && styles.iconBoxSelected]}>
                      <discipline.icon
                        size={22}
                        color={selected ? Luxe.gold : Luxe.textMuted}
                      />
                    </View>
                    <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>
                      {t(discipline.titleKey)}
                    </Text>
                    {/* A filled dot rather than a tick: this is a choice of one
                        from four, and a tick reads as a thing switched on. */}
                    <View style={[styles.dot, selected && styles.dotSelected]} />
                  </View>
                  <Text style={styles.cardBody}>{t(discipline.bodyKey)}</Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </ScrollView>

        <Animated.View entering={FadeInDown.delay(120).duration(280)}>
          <Pressable
            accessibilityRole="button"
            onPress={next}
            style={({ pressed }) => [styles.go, pressed && styles.goPressed]}>
            {/*
              The mark of whatever is selected, not a fixed one.

              It changes as the choice does, so the button shows what you are
              about to play right where you confirm it — a second reading of the
              answer, at the moment it is committed.
            */}
            <View style={styles.goIcon}>
              <chosenDiscipline.icon size={24} color={Luxe.ink} />
            </View>

            <View style={styles.goText}>
              <Text style={styles.goLabel}>
                {mode === 'solo' ? t('newGame.next') : t('newGame.nextSeats')}
              </Text>
              {/* Which game, under the destination: the two things this screen
                  has settled, in one line. */}
              <Text style={styles.goHint} numberOfLines={1}>
                {t(chosenDiscipline.titleKey)}
              </Text>
            </View>

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
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },
  scroll: {
    flex: 1,
  },
  centre: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.two,
    // Clear of the button below, which sits outside the scrolling area.
    paddingBottom: Spacing.three,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201, 169, 98, 0.28)',
    backgroundColor: '#080b0a',
  },
  cardSelected: {
    borderColor: 'rgba(201, 169, 98, 0.6)',
    backgroundColor: '#141a19',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  /** A tile for the mark, so the four line up whatever shape each one is. */
  iconBox: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(201, 169, 98, 0.06)',
  },
  iconBoxSelected: {
    borderColor: 'rgba(201, 169, 98, 0.45)',
    backgroundColor: 'rgba(201, 169, 98, 0.12)',
  },
  cardTitle: {
    flex: 1,
    color: Luxe.textMuted,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  cardTitleSelected: {
    color: Luxe.gold,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  dotSelected: {
    borderColor: Luxe.gold,
    backgroundColor: Luxe.gold,
  },
  cardBody: {
    color: Luxe.textMuted,
    fontSize: 12,
    lineHeight: 17,
    // Indented past the icon tile so the sentence starts under its own title
    // rather than under the mark: 38 for the tile, plus the row's gap.
    paddingLeft: 38 + Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  /**
   * The step forward, filled gold.
   *
   * The same bar the menu opens with, and deliberately: gold-on-dark means "this
   * is the way on" everywhere in the app, and a screen that ends with an
   * outlined row instead makes the reader work out afresh which control leaves
   * the page. Outlined is what the *choices* on these screens wear; filled is
   * reserved for the one control that commits them.
   */
  go: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 8,
    backgroundColor: Luxe.gold,
  },
  goPressed: {
    backgroundColor: '#b8985a',
  },
  /** The mark in a darker inset, so it reads as set into the bar. */
  goIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: 'rgba(8, 9, 11, 0.14)',
  },
  goText: {
    flex: 1,
    gap: 2,
  },
  goLabel: {
    color: Luxe.ink,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  goHint: {
    color: 'rgba(8, 9, 11, 0.68)',
    fontSize: 12,
    lineHeight: 16,
  },
  goChevron: {
    // 0.7 rather than 0.55: at 3.4:1 the lighter value was under what a small
    // graphic needs to stay crisp against the gold.
    color: 'rgba(8, 9, 11, 0.7)',
    fontSize: 26,
    lineHeight: 28,
    marginTop: -3,
  },
});
