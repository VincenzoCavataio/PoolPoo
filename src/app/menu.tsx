/**
 * The menu.
 *
 * The actions sit at the foot of the screen, where a thumb rests, and the title
 * holds the top. Between them is nothing — which is the point: that gap is where
 * the table behind is seen, and it is the largest uninterrupted view of it
 * anywhere in the app.
 *
 * The three choices are three different kinds of thing, and they are built
 * differently to say so:
 *
 *  - **New game** is a panel. It is what the screen is for.
 *  - **Continue** is a row, because what it has to show is a sentence about a
 *    game in progress, and a sentence needs a line.
 *  - **Options** is neither. It leads away from playing, so it is a quiet strip
 *    under the others rather than a third thing of equal weight — making it the
 *    same size as Continue implied a choice between them that nobody makes.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Floating } from '@/components/ui/floating';
import { LightSwitch } from '@/components/ui/light-switch';
import { NamePrompt } from '@/components/ui/name-prompt';
import { CueIcon, RackIcon, SlidersIcon } from '@/components/ui/icons';
import { GlowRule, Heading, LuxeFonts } from '@/components/ui/luxe';
import { Luxe } from '@/constants/game-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { playTap } from '@/game/audio/sfx';
import { useT } from '@/i18n/use-t';
import type { MessageKey, Translator } from '@/i18n';
import { describeSave, loadSavedGame, type SavedGame } from '@/store/persistence';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

function describeSavedGame(save: SavedGame, t: Translator): string {
  const when = describeSave(save);
  const players = save.free?.players.length ?? 1;
  return `${t('menu.savedFree', { count: players })}${when ? ` · ${when}` : ''}`;
}

/**
 * Which greeting suits the hour.
 *
 * Four bands rather than the usual three: the small hours get their own line,
 * because somebody opening a pool game at two in the morning is doing something
 * a little different from somebody opening it at eight in the evening, and the
 * app may as well notice.
 */
function greetingKeyFor(hour: number): MessageKey {
  if (hour < 5) return 'greeting.night';
  if (hour < 13) return 'greeting.morning';
  if (hour < 18) return 'greeting.afternoon';
  return 'greeting.evening';
}

export default function MenuScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const resume = useSession((s) => s.resume);

  const playerName = useSettings((s) => s.playerName);

  /**
   * Worked out once per visit to the menu, not on every render.
   *
   * The hour only matters when the screen is first looked at; recomputing it as
   * the component re-renders would be work for a string that cannot have
   * changed, and would make the greeting flip mid-session at a band boundary.
   */
  const greeting = useMemo(
    () => t(greetingKeyFor(new Date().getHours()), { name: playerName }),
    [t, playerName],
  );

  const [save, setSave] = useState<SavedGame | null>(null);
  const [checked, setChecked] = useState(false);

  // Re-read on focus so finishing a game removes a stale Continue entry.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSavedGame().then((loaded) => {
        if (!active) return;
        setSave(loaded);
        setChecked(true);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const onContinue = () => {
    if (!save) return;
    playTap('confirm');
    // Through the same pause a new game takes. Resuming is just as much an
    // arrival at the table, and cutting straight there from the menu would put
    // the theme against the cloth with no gap at all.
    if (resume(save)) router.push('/loading');
  };

  return (
    <View style={styles.root}>
      {/* Over everything, and only on a first visit. */}
      <NamePrompt />

      <View
        style={[
          styles.inner,
          { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.four },
        ]}>
        {/*
          The wordmark, with the light switch beside it.

          The switch belongs to the room rather than to the menu, so it is not
          lined up with the actions below — it sits out at the top edge where a
          switch is on a wall, level with the title and well away from anything
          that navigates. Nothing else is up here to be pressed by mistake.
        */}
        <Animated.View entering={FadeIn.duration(260)} style={styles.titleRow}>
          <View style={styles.header}>
            {/* 42, not 46: the switch now takes a corner of this line, and at 46
                "After Hours" came within two points of wrapping on a 375pt
                screen. */}
            <Heading size={42}>{t('title.wordmark')}</Heading>
            <GlowRule width={52} align="flex-start" color={Luxe.gold} />
            <Text style={styles.subtitle}>{t('menu.subtitle')}</Text>
          </View>

          <Floating phase={1.6} depth={0.7}>
            <LightSwitch />
          </Floating>
        </Animated.View>

        {/*
          Who is at the door.

          Only once there is a name to use — greeting a stranger by a
          placeholder is worse than not greeting them. It sits in a band of its
          own under the wordmark rather than as a fourth line inside it: the
          title says what the place is called, this says who just walked in, and
          they are not the same sentence.
        */}
        {playerName ? (
          <Animated.View entering={FadeInDown.delay(140).duration(320)} style={styles.welcome}>
            <Text style={styles.greeting}>{greeting}</Text>
          </Animated.View>
        ) : null}

        {/* The view of the table. Nothing is drawn here on purpose. */}
        <View style={styles.window} />

        <View style={styles.actions}>
          {/*
            The primary action.

            A gold bar with the rack standing in it, not a tall panel with serif
            text — the panel repeated what the title above already does, at a
            smaller size, and two serif blocks on one screen read as a heading
            and a subheading rather than as a title and a button.

            Filled rather than outlined: it is the only solid gold surface in the
            app, which is what marks it out without needing to be large. The
            label is sans, in the same spaced capitals as every other control, so
            it reads as something you press.
          */}
          <Animated.View entering={FadeInDown.delay(50).duration(280)}>
            <Floating depth={1.15}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                playTap('confirm');
                router.push('/mode');
              }}
              style={({ pressed }) => [styles.main, pressed && styles.mainPressed]}>
              <View style={styles.mainIcon}>
                <RackIcon size={30} color={Luxe.ink} />
              </View>

              <View style={styles.mainText}>
                <Text style={styles.mainLabel}>{t('menu.newGame')}</Text>
                <Text style={styles.mainSub} numberOfLines={1}>
                  {t('menu.newGameSub')}
                </Text>
              </View>

              {/* A chevron, because this one goes somewhere. */}
              <Text style={styles.mainGo}>{'\u203A'}</Text>
            </Pressable>
            </Floating>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(110).duration(280)}>
            <Floating phase={1} depth={0.85}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !save }}
              disabled={!save}
              onPress={onContinue}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
                !save && styles.rowDisabled,
              ]}>
              <View style={styles.rowIcon}>
                <CueIcon size={24} color={save ? Luxe.text : Luxe.textFaint} />
              </View>

              <View style={styles.rowText}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {t('menu.continue')}
                </Text>
                <Text style={styles.rowDetail} numberOfLines={2}>
                  {save
                    ? describeSavedGame(save, t)
                    : checked
                      ? t('menu.noSave')
                      : t('common.checking')}
                </Text>
              </View>
            </Pressable>
            </Floating>
          </Animated.View>

          {/* Options: a strip, not a tile. Lighter than the two above it in
              every respect — no panel, no detail line, small type. */}
          <Animated.View entering={FadeIn.delay(180).duration(280)} style={styles.quietRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                playTap();
                router.push('/trophies');
              }}
              style={({ pressed }) => [styles.quiet, pressed && styles.quietPressed]}>
              <Text style={styles.quietMark}>★</Text>
              <Text style={styles.quietLabel}>{t('trophy.title')}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                playTap();
                router.push('/options');
              }}
              style={({ pressed }) => [styles.quiet, pressed && styles.quietPressed]}>
              <SlidersIcon size={16} color={Luxe.textMuted} />
              <Text style={styles.quietLabel}>{t('menu.options')}</Text>
            </Pressable>
          </Animated.View>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  /**
   * The greeting, sized like part of the composition.
   *
   * It was 12pt — smaller than the subtitle above it, which made the one line
   * on the screen addressed to the player by name the least visible thing on it.
   * At 26 in the serif face it answers the wordmark instead of hiding under it:
   * two weights of the same voice, the house and then the guest.
   */
  welcome: {
    marginTop: Spacing.four,
  },
  greeting: {
    color: Luxe.text,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: LuxeFonts.serif,
  },
  subtitle: {
    color: Luxe.textMuted,
    fontSize: 12,
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },

  /** The gap the table is seen through. It takes whatever the rest does not. */
  window: {
    flex: 1,
    minHeight: Spacing.four,
  },

  actions: {
    gap: Spacing.two,
  },

  // ------------------------------------------------------------ main action
  /**
   * Filled gold, and the only thing in the app that is.
   *
   * Solid rather than see-through for the same reason every other panel is: the
   * scene behind moves, and a rail sliding under a line of text changes the
   * contrast under each letter while you are reading it.
   */
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 8,
    backgroundColor: Luxe.gold,
  },
  mainPressed: {
    backgroundColor: '#b8985a',
  },
  /** The rack in a darker inset, so it reads as set into the bar. */
  mainIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: 'rgba(8, 9, 11, 0.14)',
  },
  mainText: {
    flex: 1,
    gap: 2,
  },
  mainLabel: {
    color: Luxe.ink,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  mainSub: {
    color: 'rgba(8, 9, 11, 0.68)',
    fontSize: 12,
    lineHeight: 16,
  },
  mainGo: {
    // 0.7 rather than 0.55: at 3.4:1 the lighter value was under what a small
    // graphic needs to stay crisp against the gold.
    color: 'rgba(8, 9, 11, 0.7)',
    fontSize: 26,
    lineHeight: 28,
    marginTop: -3,
  },

  // -------------------------------------------------------------- continue
  /**
   * The title and the switch, on one line.
   *
   * The title keeps the left and takes what it needs; the switch sits at the far
   * end. `flex-start` on the cross axis rather than centring, so the switch
   * hangs level with the top of the wordmark instead of drifting down beside its
   * rule and subtitle.
   */
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    backgroundColor: '#0d1210',
  },
  rowPressed: {
    backgroundColor: '#1b201d',
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  rowLabel: {
    color: Luxe.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  /** 12pt, not 10: this line carries a sentence and has to be readable. */
  rowDetail: {
    color: Luxe.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },

  // --------------------------------------------------------------- options
  /**
   * Trophies and options, sharing a line.
   *
   * Both lead away from playing, and neither is a decision anybody agonises
   * over, so they get one strip between them rather than a row each. Splitting
   * the width equally keeps either from reading as the more important of the
   * two.
   */
  quietRow: {
    flexDirection: 'row',
  },
  quietMark: {
    color: Luxe.textMuted,
    fontSize: 14,
  },
  quiet: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    marginTop: 2,
  },
  quietPressed: {
    opacity: 0.55,
  },
  quietLabel: {
    color: Luxe.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
});
