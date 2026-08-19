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

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RackIcon } from '@/components/ui/icons';
import { GlowRule, LuxeFonts } from '@/components/ui/luxe';
import { ScreenHeader } from '@/components/ui/screen';
import { ballSetById, colorForBallIn } from '@/constants/ball-sets';
import { Luxe } from '@/constants/game-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { playTap } from '@/game/audio/sfx';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const PLAYER_OPTIONS = [1, 2, 3, 4];

/**
 * One player, as a ball.
 *
 * Coloured from the set the player has actually chosen, so the control is made
 * of the same balls the game will be played with rather than a generic swatch.
 */
/**
 * One ball in the picker, drawn the way the table draws it.
 *
 * It carries its colour from the chosen set, its number, and — for a set that
 * has stripes — the white band. Without those last two it was a coloured disc:
 * the colour alone reads as a swatch, while a number on a band reads as a ball,
 * and this screen is picking players out of a rack.
 *
 * The band is drawn behind the number and inside the circle, so the number sits
 * on the white the way it does on a real stripe.
 */
function PlayerBall({ index, active, size }: { index: number; active: boolean; size: number }) {
  const setId = useSettings((s) => s.ballSetId);
  const set = ballSetById(setId);
  const number = index + 1;
  const colour = colorForBallIn(set, number);

  // Stripes only exist above the eight, and only in a set that has them.
  const striped = set.striped && number > 8;

  return (
    <View
      style={[
        styles.ball,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: active ? (striped ? '#f2efe6' : colour) : 'transparent',
          borderColor: active ? 'transparent' : Luxe.hairlineStrong,
        },
      ]}>
      {/* The stripe: a band across the middle, with the pale ball showing above
          and below it. */}
      {active && striped ? (
        <View
          style={[
            styles.ballStripe,
            { height: size * 0.56, backgroundColor: colour },
          ]}
        />
      ) : null}

      {active ? (
        <>
          <View
            style={[
              styles.ballSheen,
              {
                width: size * 0.38,
                height: size * 0.38,
                borderRadius: size * 0.19,
                top: size * 0.14,
                left: size * 0.16,
              },
            ]}
          />

          {/* The number, on the white disc every numbered ball carries. */}
          <View
            style={[
              styles.ballDisc,
              {
                width: size * 0.52,
                height: size * 0.52,
                borderRadius: size * 0.26,
              },
            ]}>
            <Text style={[styles.ballNumber, { fontSize: size * 0.3 }]}>{number}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function NewGameScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const startFree = useSession((s) => s.startFree);
  const [players, setPlayers] = useState(2);

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
    const names = Array.from({ length: players }, (_, i) => t('rules.player', { number: i + 1 }));
    startFree(players, names);
    router.push('/setup');
  };

  return (
    <View style={styles.root}>
      <View style={[styles.inner, { paddingTop: insets.top + Spacing.four }]}>
        <ScreenHeader title={t('newGame.title')} onBack={() => router.back()} />

        <Animated.View entering={FadeIn.duration(260)} style={styles.centre}>
          <Text style={styles.prompt}>{t('newGame.players')}</Text>

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
                <PlayerBall index={count - 1} active={count <= players} size={52} />
              </Pressable>
            ))}
          </View>

          <View style={styles.countRow}>
            <Text style={styles.count}>{players}</Text>
            <GlowRule width={40} color={Luxe.gold} />
          </View>

          <Text style={styles.hint}>
            {players === 1 ? t('newGame.soloHint') : t('newGame.multiHint', { count: players })}
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
              <RackIcon size={22} color={Luxe.gold} />
            </View>

            <View style={styles.goText}>
              <Text style={styles.goLabel}>{t('newGame.next')}</Text>
              <Text style={styles.goHint} numberOfLines={1}>
                {t('newGame.players')} · {players}
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
  ball: {
    borderWidth: 1.5,
    overflow: 'hidden',
    // The number disc is a child in normal flow, so without these it settles
    // into the top-left corner instead of the middle of the circle.
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballSheen: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  ballStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Centred by hand: an absolute child ignores the parent's justification, and
    // the band has to sit across the middle of the ball.
    top: '22%',
  },
  /** The white disc the number is printed on. */
  ballDisc: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f5ef',
  },
  ballNumber: {
    color: '#14161a',
    fontWeight: '800',
    // The same gap the table's own numbers use, so a two-digit ball does not
    // run its characters together.
    letterSpacing: 0.5,
    includeFontPadding: false,
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
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 98, 0.5)',
    backgroundColor: '#111716',
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
    backgroundColor: '#1a2321',
  },
  /** The rack, small and inset — a mark on the row, not a background. */
  goIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    backgroundColor: 'rgba(201, 169, 98, 0.08)',
  },
  goText: {
    flex: 1,
    gap: 3,
  },
  goLabel: {
    color: Luxe.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  goHint: {
    color: Luxe.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  /** A chevron, because this one goes somewhere rather than doing something. */
  goChevron: {
    color: 'rgba(201, 169, 98, 0.6)',
    fontSize: 22,
    lineHeight: 24,
    marginTop: -2,
  },
});
