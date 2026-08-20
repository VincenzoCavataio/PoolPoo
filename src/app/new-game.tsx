/**
 * Choosing how many people are playing.
 *
 * The count is picked by tapping balls in a rack rather than by tapping a
 * number. One ball per player, lit as you add them — so the control shows the
 * quantity instead of naming it, and the thing being counted is the thing you
 * are looking at.
 *
 * That is worth more than a numeral here because the number is small and fixed:
 * four choices, all visible at once, none needing to be read.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ball } from '@/components/ui/ball';
import { RackIcon } from '@/components/ui/icons';
import { GlowRule, LuxeFonts } from '@/components/ui/luxe';
import { ScreenHeader } from '@/components/ui/screen';
import { Luxe } from '@/constants/game-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { playTap } from '@/game/audio/sfx';
import { GameModeKind } from '@/game/rules/types';
import { useT } from '@/i18n/use-t';

const PLAYER_OPTIONS = [1, 2, 3, 4];

export default function NewGameScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [players, setPlayers] = useState(2);

  // Carried from the mode screen. Anything else is a game between people.
  const params = useLocalSearchParams<{ mode?: string; rules?: string }>();
  const mode = params.mode === 'cpu' ? 'cpu' : 'human';
  // Carried through untouched: this screen has no opinion about the rules, it
  // only has to not lose them on the way to the seats.
  const rules = params.rules ?? GameModeKind.FREE;

  /**
   * On to dressing the table.
   *
   * The game is started here only so the next screen knows how many people are
   * playing; it starts it again once the room and cloth are chosen, because the
   * table is built with the cloth's physics and has to be rebuilt if that
   * changes.
   */
  const next = () => {
    playTap('confirm');

    /*
     * The seats are named on the next screen, whoever is in them.
     *
     * The game is not started here: that screen is what knows the names — and,
     * against the computer, who is a machine and how good — and starting twice
     * would throw its answer away.
     */
    /*
     * The number chosen is the number of *opponents*, never the seats.
     *
     * Nobody counts themselves when asked how many they are playing against —
     * not against machines and not against friends either. Picking two and
     * getting one opponent is the bug that reading causes; the seat count is
     * always one more than the choice.
     */
    router.push({
      pathname: '/difficulty',
      params: { mode, rules, players: String(players + 1) },
    });
  };

  return (
    <View style={styles.root}>
      {/* Outside the padded column, so the bar reaches both edges and runs up
          under the status bar. */}
      <ScreenHeader
        title={t('newGame.title')}
        onBack={() => router.back()}
        topInset={insets.top}
      />

      <View style={styles.inner}>

        <Animated.View entering={FadeIn.duration(260)} style={styles.centre}>
          <Text style={styles.prompt}>
            {t('newGame.opponents')}
          </Text>

          {/* The rack. Tapping a ball sets the count to that many. */}
          <View style={styles.rack}>
            {PLAYER_OPTIONS.map((count) => (
              <Pressable
                key={count}
                accessibilityRole="radio"
                accessibilityState={{ selected: count === players }}
                accessibilityLabel={String(count)}
                onPress={() => {
                  playTap();
                  setPlayers(count);
                }}
                style={({ pressed }) => [styles.ballTarget, pressed && styles.pressed]}>
                <Ball number={count} active={count <= players} size={52} />
              </Pressable>
            ))}
          </View>

          <View style={styles.countRow}>
            <Text style={styles.count}>{players}</Text>
            <GlowRule width={40} color={Luxe.gold} />
          </View>

          <Text style={styles.hint}>
            {mode === 'cpu'
              ? t('newGame.cpuHint', { count: players })
              : t('newGame.humanHint', { count: players })}
          </Text>
        </Animated.View>

        {/*
          The one thing this screen exists to do.

          It was a bordered rectangle with a line of small capitals in it —
          indistinguishable from any other button in the app, for the action that
          ends the screen. Now it carries the serif face the wordmark uses, a
          rack bled into the corner the way the menu's main panel does, and a lit
          rule above the label. It is the heaviest surface in the menus, which is
          what makes it read as the end of the road rather than one more control.
        */}
        <Animated.View entering={FadeInDown.delay(60).duration(280)}>
          <Pressable
            accessibilityRole="button"
            onPress={next}
            style={({ pressed }) => [styles.go, pressed && styles.goPressed]}>
            <View style={styles.goIcon}>
              <RackIcon size={24} color={Luxe.ink} />
            </View>

            <View style={styles.goText}>
              {/* This button goes to the seats screen, not to the table — a
                  label that names the wrong destination is worse than a vague
                  one. */}
              <Text style={styles.goLabel}>
                {mode === 'cpu' ? t('newGame.nextDifficulty') : t('newGame.nextSeats')}
              </Text>
              {/* The same word the prompt above uses: this count is opponents,
                  not seats, and saying "players" here would contradict the line
                  the player just read. */}
              <Text style={styles.goHint} numberOfLines={1}>
                {t('newGame.opponents')} · {players}
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
  /**
   * The gap under the start button, which is what lifts it off the floor.
   *
   * Raising the picker above it did not move it: `centre` takes `flex: 1` and
   * absorbs every spare point, so the button stays pinned to whatever the
   * bottom padding leaves. The height of the button is set here, not there.
   */
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
  pressed: {
    opacity: 0.6,
  },

  /**
   * The picker sits above centre, not on it.
   *
   * `justifyContent: 'center'` put it in the middle of the space left over,
   * which left a wide gap between the picker and the button below it.
   */
  /**
   * The picker, centred in the space the header and the button leave.
   *
   * `flex: 1` already gives this block everything those two do not claim, so
   * centring inside it puts the choice in the middle of the screen's own empty
   * middle — which is where the eye goes, and where it belongs on a screen that
   * asks exactly one question.
   *
   * It used to be pinned to the top of that space and then pushed back down by a
   * padding and a `top` offset, each added at a different time to correct the
   * one before it. Three numbers were deciding one position, and none of them
   * held when the header gained a panel and the button moved. One rule replaces
   * them: stay in the middle, whatever the rows above and below turn out to be.
   */
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  /** Brighter and a shade larger: this names the only choice on the screen. */
  prompt: {
    color: Luxe.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
  rack: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  ballTarget: {
    padding: Spacing.one,
  },
  countRow: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  count: {
    color: Luxe.text,
    fontSize: 52,
    lineHeight: 58,
    fontFamily: LuxeFonts.serif,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: Luxe.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },

  /**
   * On to dressing the table — a step, not the finish.
   *
   * This used to be the button that started the game, and it was built like it:
   * a tall panel, a 24pt serif line, a rack bleeding off the corner. Then the
   * setup screen went in behind it and this became the first of two steps, while
   * the styling stayed where it was — so the intermediate step shouted and the
   * one that actually breaks was quieter than it.
   *
   * Now it is an outlined row and the button on the setup screen is filled gold.
   * The pair reads in the right order: this one moves you along, that one starts
   * the game.
   *
   * The background is a neutral dark rather than the near-black gold that was
   * here (hue 45, a couple of degrees off the gold itself), which against the
   * green of these screens read as brown.
   */
  go: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 8,
    backgroundColor: Luxe.gold,
    /**
     * Lifted well clear of the bottom of the screen.
     *
     * `marginBottom`, not the `top: -64` that was here: the button is in normal
     * flow, where `top` shifts it visually but leaves its original box in the
     * layout — so the space it vacated stayed empty and the gap below was really
     * the offset plus the container's padding. A margin moves the box itself,
     * which is the same lift expressed once instead of twice.
     */
    marginBottom: Spacing.six + Spacing.six,
  },
  goPressed: {
    backgroundColor: '#b8985a',
  },
  /** The rack in a darker inset, so it reads as set into the bar. */
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
  /** A chevron, because this one goes somewhere rather than doing something. */
  goChevron: {
    // 0.7 rather than 0.55: at 3.4:1 the lighter value was under what a small
    // graphic needs to stay crisp against the gold.
    color: 'rgba(8, 9, 11, 0.7)',
    fontSize: 26,
    lineHeight: 28,
    marginTop: -3,
  },
});
