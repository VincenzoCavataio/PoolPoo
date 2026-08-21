/**
 * Reactions to a shot: confetti and light for a pot, a cold sinking wash for a
 * foul.
 *
 * Drawn in React Native rather than in the GL scene. Particles on the phone's
 * GL context would compete with the table for the very frames the replay is
 * trying to make look good, and none of this needs to exist in world space.
 *
 * Every piece is derived from its index, not from `Math.random`, so the effect
 * is the same each time and cannot produce an unlucky-looking frame once and a
 * good one the next.
 */

import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, Keyframe } from 'react-native-reanimated';

import { LuxeFonts } from '@/components/ui/luxe';
import { Luxe, Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { Phase } from '@/game/rules/types';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';

const CONFETTI_COLORS = ['#ffc857', '#3ddc84', '#ff53d8', '#5cf0ff', '#ff6b5e', '#f2f0e6'];
const CONFETTI_COUNT = 26;

/**
 * How long the pot banner stays up.
 *
 * 2600 was most of the replay it plays over, which made it scenery. A reaction
 * should be over while the thing it is reacting to is still happening.
 */
const POT_DURATION = 1500;
/** A foul's celebration is only the dismissal timer now; the ticker speaks. */
const FOUL_DURATION = 1200;

function Confetti({ seed }: { seed: number }) {
  const { height } = useWindowDimensions();

  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const step = (i * 41 + seed) % 100;
        return {
          key: `${seed}-${i}`,
          left: `${step}%`,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          width: 6 + (i % 3) * 4,
          height: 10 + (i % 4) * 3,
          /*
           * Nearly all of it arrives at once.
           *
           * The delays ran to 720ms, so the last of the confetti appeared long
           * after the ball had dropped and the burst read as a slow drizzle.
           * A fifth of that keeps the ragged edge that stops it looking
           * mechanical, without any of it turning up late to its own party.
           */
          delay: (i % 9) * 16,
          duration: 1100 + (i % 5) * 240,
          drift: ((i % 5) - 2) * 30,
          spin: (i % 2 === 0 ? 1 : -1) * (400 + (i % 3) * 200),
        };
      }),
    [seed],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece) => {
        const keyframe = new Keyframe({
          0: {
            opacity: 0,
            transform: [{ translateY: -50 }, { translateX: 0 }, { rotate: '0deg' }],
          },
          12: {
            opacity: 1,
            transform: [{ translateY: 0 }, { translateX: 0 }, { rotate: '40deg' }],
          },
          100: {
            opacity: 0,
            transform: [
              { translateY: height + 60 },
              { translateX: piece.drift },
              { rotate: `${piece.spin}deg` },
            ],
            easing: Easing.in(Easing.quad),
          },
        });

        return (
          <Animated.View
            key={piece.key}
            entering={keyframe.duration(piece.duration).delay(piece.delay)}
            style={[
              styles.confetti,
              {
                left: piece.left as `${number}%`,
                width: piece.width,
                height: piece.height,
                backgroundColor: piece.color,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/**
 * The pot, announced like something that just happened.
 *
 * It used to fade in over 220ms and sit there. A fade is how you introduce a
 * label; it is not how a thing that just happened arrives, and that is the whole
 * of why potting felt announced rather than *felt*. What lands is a hit: the
 * banner arrives already too big and snaps down to size inside a fifth of a
 * second, and a flash of light goes off behind it on the same frame.
 *
 * The sound and the vibration already fire on the pocketed event, so all three
 * now coincide. Simultaneity is most of the effect — the same three cues spread
 * over half a second read as three separate notifications.
 */
function PotBanner({ balls }: { balls: number[] }) {
  const t = useT();
  const title =
    balls.length > 1
      ? t('celebration.potMany', { count: balls.length })
      : t('celebration.potOne', { number: balls[0] });

  /*
   * Overshoot and settle, rather than grow into place.
   *
   * 1.35 down to 1 with a single bounce past it. The whole move is 260ms: long
   * enough to read as a movement, short enough that it is over before you have
   * decided to look at it, which is what makes it feel like impact rather than
   * animation.
   */
  const slam = new Keyframe({
    0: { opacity: 0, transform: [{ scale: 1.35 }] },
    45: { opacity: 1, transform: [{ scale: 0.94 }] },
    70: { opacity: 1, transform: [{ scale: 1.03 }] },
    100: { opacity: 1, transform: [{ scale: 1 }] },
  });

  return (
    <View style={styles.bannerWrap} pointerEvents="none">
      {/*
        A flash behind the banner, gone almost before it registers.

        Not a glow that lingers: the eye reads a brief full-frame lift as impact
        and a slow one as a state change, and this is an impact.
      */}
      <Animated.View
        entering={FadeIn.duration(60)}
        exiting={FadeOut.duration(320)}
        style={styles.potFlash}
      />

      <Animated.View entering={slam.duration(260)} exiting={FadeOut.duration(220)}>
        <View style={styles.potBanner}>
          <Text style={styles.potTitle}>{title}</Text>
          <View style={styles.potRule} />
        </View>
      </Animated.View>
    </View>
  );
}

export function Celebration() {
  const t = useT();
  const celebration = useSession((s) => s.celebration);
  const phase = useSession((s) => s.phase);
  const dismissCelebration = useSession((s) => s.dismissCelebration);
  const skipReplay = useSession((s) => s.skipReplay);

  const id = celebration?.id ?? 0;
  const kind = celebration?.kind;

  useEffect(() => {
    if (!kind) return;
    const timer = setTimeout(dismissCelebration, kind === 'pot' ? POT_DURATION : FOUL_DURATION);
    return () => clearTimeout(timer);
  }, [id, kind, dismissCelebration]);

  const replaying = phase === Phase.REPLAY;
  if (!celebration && !replaying) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {celebration?.kind === 'pot' ? (
        <>
          <Confetti seed={celebration.id % 97} />
          <PotBanner balls={celebration.balls} />
        </>
      ) : null}

      {/*
        A foul says itself once, through the shot ticker.

        There used to be a panel here as well, and the two carried the same
        sentence in two different styles a second apart — the rules already put
        the reason and the cost into the message list, and the ticker is where
        the game says what happened. A second announcement of one event is not
        emphasis, it is a stutter.
      */}

      {/* Anywhere on screen cuts the replay short. */}
      {replaying ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={skipReplay}
          accessibilityLabel={t('celebration.skipReplay')}>
          <View style={styles.skipWrap} pointerEvents="none">
            <Text style={styles.skipLabel}>{t('celebration.replayHint')}</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  confetti: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
  bannerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
/**
   * The flash behind the pot. Gold, and gone almost before it registers.
   *
   * It was the in-game accent green, which is the colour of the cloth and of
   * every control on the table. Gold is what this app uses for the things that
   * matter, and a flash in the accent colour read as the table lighting up
   * rather than as something having happened on it.
   */
  potFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(201, 169, 98, 0.16)',
  },
  /**
   * The pot banner, in the shell's own language.
   *
   * Near-black with a gold edge and a serif line, exactly like every panel in
   * the menus. It used to be a green-bordered box in the HUD palette — correct
   * for a control that sits over baize, wrong for the one moment the game stops
   * to tell you something.
   */
  potBanner: {
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#080b0a',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 98, 0.45)',
    borderRadius: 12,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  potTitle: {
    color: Luxe.text,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: LuxeFonts.serif,
    textAlign: 'center',
  },
  /** The lit rule the wordmark carries, so the banner belongs to the same set. */
  potRule: {
    width: 44,
    height: 1,
    backgroundColor: Luxe.gold,
    opacity: 0.7,
  },
  skipWrap: {
    position: 'absolute',
    bottom: Spacing.five,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  skipLabel: {
    color: Palette.text,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(12, 19, 16, 0.8)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
});
