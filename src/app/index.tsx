/**
 * Title screen.
 *
 * Doubles as the splash: it hides the native splash once it has mounted, so
 * there is no flash of empty background between the two.
 */

import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Palette } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { colorForBall } from '@/game/core/ball';

const HOLD_MS = 1700;
const RACK_PREVIEW = [1, 9, 3, 8, 5];

export default function TitleScreen() {
  const router = useRouter();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      // Already hidden — nothing to do.
    });

    const timer = setTimeout(() => router.replace('/menu'), HOLD_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(600)} style={styles.titleBlock}>
        <Text style={styles.title}>BILIARDO</Text>
        <Text style={styles.subtitle}>3D</Text>
      </Animated.View>

      <View style={styles.ballRow}>
        {RACK_PREVIEW.map((number, index) => (
          <Animated.View
            key={number}
            entering={FadeInUp.delay(220 + index * 90).duration(520)}
            style={[styles.ball, { backgroundColor: colorForBall(number) }]}
          />
        ))}
      </View>

      <Animated.Text entering={FadeIn.delay(900).duration(600)} style={styles.tagline}>
        Caricamento del tavolo…
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  titleBlock: {
    alignItems: 'center',
  },
  title: {
    color: Palette.text,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 6,
  },
  subtitle: {
    color: Palette.accent,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 12,
    marginTop: -2,
  },
  ballRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  ball: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  tagline: {
    color: Palette.textMuted,
    fontSize: 13,
  },
});
