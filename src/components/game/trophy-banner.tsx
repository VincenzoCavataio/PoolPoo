/**
 * The card that slides in when a trophy is earned.
 *
 * It reads a queue rather than being called: a single shot can finish two
 * trophies — a treble that also wins the game finishes three — and a banner
 * driven by a callback would paint the second over the first before anyone had
 * read it. Each is shown for its own moment, then dropped and the next taken up.
 *
 * At the top of the screen, out of the way of the table and of the shooting
 * panel: this is news, not a control, and nothing about it should be in the way
 * of the next shot.
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Luxe } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { trophyById } from '@/game/trophies/catalogue';
import { useT } from '@/i18n/use-t';
import { useTrophies } from '@/store/trophies';

/** How long one trophy holds the screen before the next is taken up. */
const SHOW_MS = 2600;

export function TrophyBanner() {
  const t = useT();
  const pending = useTrophies((s) => s.pending);
  const clearPending = useTrophies((s) => s.clearPending);
  const insets = useSafeAreaInsets();

  const id = pending[0];

  useEffect(() => {
    if (!id) return;
    const timer = setTimeout(clearPending, SHOW_MS);
    return () => clearTimeout(timer);
  }, [id, clearPending]);

  if (!id) return null;

  const trophy = trophyById(id);
  if (!trophy) return null;

  return (
    <Animated.View
      // Keyed on the trophy so a second one animates in as a new card rather
      // than the text changing inside a card that is already on screen.
      key={id}
      entering={FadeInUp.duration(320)}
      exiting={FadeOut.duration(240)}
      style={[styles.wrap, { top: insets.top + Spacing.two }]}
      pointerEvents="none">
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeMark}>★</Text>
        </View>

        <View style={styles.text}>
          <Text style={styles.kicker}>{t('trophy.unlocked')}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {t(trophy.labelKey)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201, 169, 98, 0.45)',
    // Solid: it sits over a moving table, and a translucent card over moving
    // scenery is legible on average and illegible in the moment.
    backgroundColor: 'rgba(10, 13, 12, 0.94)',
  },
  badge: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: 'rgba(201, 169, 98, 0.16)',
  },
  badgeMark: {
    color: Luxe.gold,
    fontSize: 14,
  },
  text: {
    gap: 1,
  },
  kicker: {
    color: Luxe.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  label: {
    color: Luxe.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
