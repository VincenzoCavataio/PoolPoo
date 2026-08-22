/**
 * Title screen.
 *
 * Doubles as the splash: it hides the native splash once it has mounted, so
 * there is no flash of empty background between the two.
 *
 * One object, one word, one rule. Everything on screen is either the name of the
 * game or the eight ball, and the eight ball is doing the work — it is the only
 * thing in the whole game a person recognises from across a room, so it earns
 * being large and being alone. The line of five small balls that used to sit at
 * the foot said the same thing five times more quietly.
 */

import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Breathe, EightBall, GlowRule, Heading, Overline, SoftHalo } from '@/components/ui/luxe';
import { Luxe } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { useT } from '@/i18n/use-t';

const HOLD_MS = 3200;

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
      <SoftHalo size={420} style={styles.halo} />

      <View style={styles.centre}>
        <EightBall size={BALL_SIZE} float />

        <Animated.View entering={FadeInDown.delay(320).duration(800)} style={styles.wordmark}>
          <Heading size={52}>{t('title.wordmark')}</Heading>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(520).duration(700)} style={styles.ruleRow}>
          <GlowRule width={132} />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(680).duration(700)}>
          <Overline color={Luxe.gold}>{t('title.dimension')}</Overline>
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(1500).duration(900)} style={styles.foot}>
        <Breathe>
          <Overline color={Luxe.textMuted}>{t('title.enter')}</Overline>
        </Breathe>
      </Animated.View>
    </Pressable>
  );
}

const BALL_SIZE = 104;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Luxe.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    top: '18%',
  },
  centre: {
    alignItems: 'center',
  },
  wordmark: {
    marginTop: Spacing.five,
  },
  ruleRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  foot: {
    position: 'absolute',
    bottom: Spacing.six,
    alignItems: 'center',
  },
});
