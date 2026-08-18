/**
 * Title screen.
 *
 * Doubles as the splash: it hides the native splash once it has mounted, so
 * there is no flash of empty background between the two.
 *
 * Almost nothing on it. A serif wordmark, one lit hairline, a faint halo behind,
 * and a line of balls that drift by a couple of pixels. The restraint is the
 * point — the previous version shouted and looked cheap for it.
 */

import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Breathe, GlowRule, Heading, Overline, SoftHalo } from '@/components/ui/luxe';
import { Luxe } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { colorForBall } from '@/game/core/ball';
import { useT } from '@/i18n/use-t';

const HOLD_MS = 2800;
const RACK_PREVIEW = [1, 3, 8, 11, 14];

function DriftingBall({ number, index }: { number: number; index: number }) {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 2400 + index * 260, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [drift, index]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 + drift.value * 6 }],
  }));

  return (
    <Animated.View entering={FadeIn.delay(700 + index * 110).duration(700)} style={style}>
      <View style={[styles.ball, { backgroundColor: colorForBall(number) }]} />
    </Animated.View>
  );
}

export default function TitleScreen() {
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      // Already hidden — nothing to do.
    });

    const timer = setTimeout(() => router.replace('/menu'), HOLD_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <Pressable style={styles.container} onPress={() => router.replace('/menu')}>
      <SoftHalo size={340} style={styles.halo} />

      <View style={styles.centre}>
        <Animated.View entering={FadeIn.duration(700)}>
          <Overline color={Luxe.textFaint}>{t('title.kicker')}</Overline>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(760)} style={styles.wordmark}>
          <Heading size={54}>{t('title.wordmark')}</Heading>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(280).duration(700)} style={styles.ruleRow}>
          <GlowRule width={110} />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(420).duration(700)}>
          <Text style={styles.dimension}>{t('title.dimension')}</Text>
        </Animated.View>
      </View>

      <View style={styles.foot}>
        <View style={styles.ballRow}>
          {RACK_PREVIEW.map((number, index) => (
            <DriftingBall key={number} number={number} index={index} />
          ))}
        </View>

        <Animated.View entering={FadeIn.delay(1200).duration(900)}>
          <Breathe>
            <Overline color={Luxe.textMuted}>{t('title.enter')}</Overline>
          </Breathe>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Luxe.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    top: '22%',
  },
  centre: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  wordmark: {
    marginTop: Spacing.two,
  },
  ruleRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  dimension: {
    color: Luxe.gold,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
  },
  foot: {
    position: 'absolute',
    bottom: Spacing.six,
    alignItems: 'center',
    gap: Spacing.four,
  },
  ballRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  ball: {
    width: 12,
    height: 12,
    borderRadius: 6,
    opacity: 0.85,
  },
});
