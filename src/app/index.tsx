/**
 * Attract screen.
 *
 * Doubles as the splash: it hides the native splash once it has mounted, so
 * there is no flash of empty background between the two. It also holds long
 * enough to be a title card rather than a loading artefact — a cabinet spends
 * most of its life on this screen, and it should look like it wants a coin.
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

import { Blink, NeonText, Scanlines, StripeBand } from '@/components/ui/arcade';
import { Arcade } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { colorForBall } from '@/game/core/ball';

const HOLD_MS = 2600;
const RACK_PREVIEW = [1, 9, 3, 8, 5, 14, 7];

function FloatingBall({ number, index }: { number: number; index: number }) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withTiming(1, { duration: 1200 + index * 130, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [bob, index]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -7 + bob.value * 14 }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(260 + index * 70).duration(460)}
      style={[styles.ballSlot, style]}>
      <View style={[styles.ball, { backgroundColor: colorForBall(number) }]}>
        <View style={styles.ballBadge} />
      </View>
    </Animated.View>
  );
}

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
    <Pressable style={styles.container} onPress={() => router.replace('/menu')}>
      <View style={styles.top}>
        <Animated.View entering={FadeIn.duration(500)}>
          <Text style={styles.kicker}>1994 · SALA GIOCHI</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(620)} style={styles.titleBlock}>
          <NeonText size={52} spacing={7}>
            BILIARDO
          </NeonText>
          <View style={styles.subtitleRow}>
            <View style={styles.rule} />
            <NeonText size={26} spacing={12} color={Arcade.gold}>
              3D
            </NeonText>
            <View style={styles.rule} />
          </View>
        </Animated.View>
      </View>

      <View style={styles.ballRow}>
        {RACK_PREVIEW.map((number, index) => (
          <FloatingBall key={number} number={number} index={index} />
        ))}
      </View>

      <View style={styles.bottom}>
        <StripeBand height={14} />
        <Animated.View entering={FadeIn.delay(900).duration(500)} style={styles.promptWrap}>
          <Blink>
            <Text style={styles.prompt}>▶ TOCCA PER GIOCARE ◀</Text>
          </Blink>
        </Animated.View>
      </View>

      <Scanlines />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Arcade.ink,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.six,
  },
  top: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.five,
  },
  kicker: {
    color: Arcade.cyan,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 5,
  },
  titleBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rule: {
    width: 44,
    height: 3,
    backgroundColor: Arcade.magenta,
  },
  ballRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  ballSlot: {
    alignItems: 'center',
  },
  ball: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f4eee0',
  },
  bottom: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.four,
  },
  promptWrap: {
    alignItems: 'center',
  },
  prompt: {
    color: Arcade.gold,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 3,
  },
});
