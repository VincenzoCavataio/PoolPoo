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

import { Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { Phase } from '@/game/rules/types';
import type { Message } from '@/i18n';
import { useMessageRenderer, useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';

const CONFETTI_COLORS = ['#ffc857', '#3ddc84', '#ff53d8', '#5cf0ff', '#ff6b5e', '#f2f0e6'];
const CONFETTI_COUNT = 26;

const POT_DURATION = 2600;
const FOUL_DURATION = 1700;

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
          delay: (i % 9) * 80,
          duration: 1500 + (i % 5) * 280,
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

function PotBanner({ balls }: { balls: number[] }) {
  const t = useT();
  const title =
    balls.length > 1
      ? t('celebration.potMany', { count: balls.length })
      : t('celebration.potOne', { number: balls[0] });

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(260)}
      style={styles.bannerWrap}
      pointerEvents="none">
      <View style={styles.potBanner}>
        <Text style={styles.potTitle}>{title}</Text>
      </View>
    </Animated.View>
  );
}

function FoulBanner({ reason, penalty }: { reason: Message | null; penalty: number }) {
  const t = useT();
  const render = useMessageRenderer();
  const sink = new Keyframe({
    0: { opacity: 0, transform: [{ translateY: -14 }] },
    30: { opacity: 1, transform: [{ translateY: 0 }] },
    100: { opacity: 0, transform: [{ translateY: 18 }] },
  });

  return (
    <View style={styles.bannerWrap} pointerEvents="none">
      {/* A cold wash instead of a bright one — the opposite of the confetti. */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(300)}
        style={styles.foulWash}
      />
      <Animated.View entering={sink.duration(FOUL_DURATION)} style={styles.foulBanner}>
        <Text style={styles.foulTitle}>{t('celebration.foul')}</Text>
        {reason ? <Text style={styles.foulReason}>{render(reason)}</Text> : null}
        {/* The cost, spelled out: a foul the player cannot price is just a telling-off. */}
        {penalty > 0 ? (
          <Text style={styles.foulPenalty}>{t('celebration.penalty', { count: penalty })}</Text>
        ) : null}
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

      {celebration?.kind === 'foul' ? (
        <FoulBanner reason={celebration.reason} penalty={celebration.penalty} />
      ) : null}

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
  potBanner: {
    backgroundColor: 'rgba(12, 19, 16, 0.86)',
    borderWidth: 2,
    borderColor: Palette.accent,
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  potTitle: {
    color: Palette.accent,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
  },
  foulWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(28, 46, 74, 0.34)',
  },
  foulBanner: {
    backgroundColor: 'rgba(10, 14, 20, 0.88)',
    borderWidth: 1,
    borderColor: Palette.danger,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: 4,
  },
  foulTitle: {
    color: Palette.danger,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
  },
  foulReason: {
    color: Palette.textMuted,
    fontSize: 13,
  },
  foulPenalty: {
    color: Palette.danger,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
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
