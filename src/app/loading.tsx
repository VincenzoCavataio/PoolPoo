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

import { EightBall, GlowRule, Heading, Overline, SoftHalo } from '@/components/ui/luxe';
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

/**
 * The eight ball, rolling.
 *
 * A rotation, not a spin: one slow turn over the whole pause, which reads as a
 * ball that has been struck and is running out of steam rather than as a
 * loading spinner. The difference matters — a spinner says *the app is busy*,
 * and nothing here is busy. The rack was built by the screen before this one.
 *
 * Linear, for the same reason the bar is: it is counting out a fixed pause, and
 * an eased turn would imply something is speeding up.
 */
function SpinningBall() {
  const turn = useSharedValue(0);

  useEffect(() => {
    turn.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear });
  }, [turn]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 300}deg` }],
  }));

  return (
    <Animated.View entering={FadeIn.delay(240).duration(600)} style={style}>
      <EightBall size={56} />
    </Animated.View>
  );
}

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

      {/*
        On a panel, like every other screen.

        The rest of the app puts its content on a dark ground with a hairline
        round it; this screen was the last one still laying type straight onto
        the background, which made the pause look like a different app rather
        than a beat within this one.
      */}
      <View style={styles.centre}>
        <Animated.View entering={FadeIn.delay(160).duration(700)} style={styles.panel}>
          {/*
            The same ball the app opened with, smaller and turning.

            The splash, the title and this screen are three stops on one way in,
            and until now only the first two had anything in common. Carrying the
            eight ball through means the pause reads as the same journey
            continuing rather than as a third screen arriving — and it gives the
            wait something to watch that is not a bar.

            Turning rather than floating: the title screen's ball hovers because
            it is being presented. This one is in play.
          */}
          <SpinningBall />

          <Heading size={26}>{t('loading.title')}</Heading>
          <GlowRule width={64} color={Luxe.gold} />

          <View style={styles.barBlock}>
            <View style={styles.track}>
              <Animated.View style={[styles.fill, fill]} />
            </View>

            <Overline>{t('loading.subtitle')}</Overline>
          </View>
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
     *
     * `Luxe.ink` rather than the in-game background, which is a shade lighter.
     * This screen is reached from the menus and is the last thing before the
     * table, so it belongs to the shell around the game — and the shell is what
     * the splash and the title are painted in too. One ground across every
     * screen that is not the table itself.
     */
    backgroundColor: Luxe.ink,
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
  },
  /**
   * The panel the whole pause sits on.
   *
   * The same ground, hairline and radius as the panels on every other screen —
   * this was the last place in the app still setting type directly on the
   * background.
   */
  panel: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    backgroundColor: '#0d1210',
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
