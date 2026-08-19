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

import { Breathe, GlowRule, Heading, LuxeFonts, Overline, SoftHalo } from '@/components/ui/luxe';
import { Luxe } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { useT } from '@/i18n/use-t';

const HOLD_MS = 3200;

/**
 * The eight ball, drawn rather than rendered.
 *
 * Three flat layers — the sphere, a highlight up and to the left, and the white
 * disc with the numeral — read as a lit ball at this size, and cost nothing next
 * to standing up a GL context for one object on a screen that lasts three
 * seconds. It rises a couple of points and settles, which is enough to make it
 * feel like an object rather than a logo.
 */
function EightBall() {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [lift]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 + lift.value * 8 }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(900)} style={style}>
      <View style={styles.ball}>
        {/* The lit side. Offset up and left, matching where the room's lamps are. */}
        <View style={styles.ballSheen} />
        <View style={styles.ballBadge}>
          <Text style={styles.ballNumber}>8</Text>
        </View>
      </View>
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
      <SoftHalo size={420} style={styles.halo} />

      <View style={styles.centre}>
        <EightBall />

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
  ball: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    // A rim of light, which is what separates a dark ball from a dark room.
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    overflow: 'hidden',
  },
  ballSheen: {
    position: 'absolute',
    top: -BALL_SIZE * 0.3,
    left: -BALL_SIZE * 0.24,
    width: BALL_SIZE * 0.9,
    height: BALL_SIZE * 0.9,
    borderRadius: BALL_SIZE * 0.45,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  ballBadge: {
    width: BALL_SIZE * 0.42,
    height: BALL_SIZE * 0.42,
    borderRadius: BALL_SIZE * 0.21,
    backgroundColor: '#f4f1e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballNumber: {
    color: '#141414',
    fontSize: BALL_SIZE * 0.26,
    fontWeight: '700',
    fontFamily: LuxeFonts.sans,
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
