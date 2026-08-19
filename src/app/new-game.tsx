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

import { BackButton, RackIcon } from '@/components/ui/icons';
import { GlowRule, Heading, LuxeFonts } from '@/components/ui/luxe';
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
        <View style={styles.header}>
          <BackButton label={t('common.back')} onPress={() => router.back()} />
          <Heading size={26}>{t('newGame.title')}</Heading>
        </View>

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
            <View style={styles.goArt} pointerEvents="none">
              <RackIcon size={88} color={Luxe.gold} />
            </View>

            <GlowRule width={30} align="flex-start" color={Luxe.gold} />
            <Text style={styles.goLabel}>{t('newGame.startFree')}</Text>
            <Text style={styles.goHint}>
              {t('newGame.players')} · {players}
            </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Spacing.five,
    gap: Spacing.three,
    top: Spacing.seven
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

  go: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 98, 0.55)',
    backgroundColor: '#1d1809',
    overflow: 'hidden',
    top: -Spacing.six
  },
  goPressed: {
    backgroundColor: '#2b2410',
  },
  /** The rack, bled off the corner — the same device the menu's panel uses. */
  goArt: {
    position: 'absolute',
    top: -Spacing.two,
    right: -Spacing.two,
    opacity: 0.18,
  },
  goLabel: {
    color: Luxe.gold,
    fontSize: 24,
    fontFamily: LuxeFonts.serif,
  },
  goHint: {
    color: Luxe.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
