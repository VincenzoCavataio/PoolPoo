/**
 * The pause between the menus and the table.
 *
 * Built from the same pieces as every other screen — a serif heading, a lit
 * hairline under it, an overline in spaced capitals — so it reads as part of the
 * app rather than as a splash that wandered in. The first version used only
 * small capitals and no heading at all, which is why it did not match anything.
 *
 * The bar is honest about what it measures: elapsed time, not work. Nothing is
 * loading — the rack is built synchronously by the screen before this one and
 * the renderer mounts in a frame or two — so what the bar shows is how much of
 * the pause is left. It is here because a dark screen with no indication of its
 * own length reads as a stall, and a filling bar reads as a wait with an end to
 * it.
 *
 * The pause itself earns its place by what it takes away. The menus have their
 * theme playing and a lit room drifting behind them; cutting straight to the
 * table puts a piece of music against the cloth with no gap at all. The music is
 * stopped by route in the root layout, which counts this screen as being in the
 * game, so the quiet starts the instant this mounts.
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { GlowRule, Heading, Overline, SoftHalo } from '@/components/ui/luxe';
import { Luxe, Palette, Radius } from '@/constants/game-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';

/**
 * How long the pause lasts.
 *
 * Long enough to register as a beat of its own rather than as a flicker between
 * screens — under about a second and a half a dark screen reads as a stutter,
 * which is worse than no pause at all. Not so long that starting a game feels
 * like waiting for one.
 */
const HOLD_MS = 2400;

export default function LoadingScreen() {
  const router = useRouter();
  const t = useT();
  const world = useSession((s) => s.world);

  const progress = useSharedValue(0);

  useEffect(() => {
    /**
     * Nothing here waits for the game to be ready, because it already is.
     *
     * The previous screen calls `startFree` before navigating, so the world
     * exists by the time this mounts. The guard is for the other way in — a
     * reload or a deep link straight to this route, with no game in memory,
     * which would otherwise sit here and then land on an empty table.
     */
    if (!world) {
      router.replace('/menu');
      return;
    }

    /**
     * Linear, and deliberately so.
     *
     * An eased bar implies the thing behind it is speeding up or slowing down.
     * This one is counting out a fixed pause, so it moves at a fixed rate — the
     * curve would be a small lie about something the player can time.
     */
    progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear });

    const timer = setTimeout(() => router.replace('/game'), HOLD_MS);
    return () => clearTimeout(timer);
  }, [router, world, progress]);

  const fill = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(320)}
      exiting={FadeOut.duration(240)}
      style={styles.container}>
      <SoftHalo size={360} style={styles.halo} />

      <View style={styles.centre}>
        <Animated.View entering={FadeIn.delay(160).duration(700)} style={styles.heading}>
          <Heading size={30}>{t('loading.title')}</Heading>
          <GlowRule width={72} color={Luxe.gold} />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(360).duration(700)} style={styles.barBlock}>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fill]} />
          </View>

          <Overline>{t('loading.subtitle')}</Overline>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    /**
     * Opaque, and the only screen in the app that is.
     *
     * The table backdrop is mounted at the root and draws behind every menu.
     * Here it has to be covered: the point of the pause is that the lit room
     * goes away for a moment, and a transparent screen would leave it drifting
     * about underneath.
     */
    backgroundColor: Palette.background,
  },
  halo: {
    position: 'absolute',
    opacity: 0.45,
  },
  centre: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    gap: Spacing.five,
  },
  heading: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  barBlock: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.two,
  },
  /** The same track the power bar uses, drawn thin: this one is not a control. */
  track: {
    width: '100%',
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Luxe.gold,
    opacity: 0.85,
  },
});
