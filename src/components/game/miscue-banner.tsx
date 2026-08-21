/**
 * What appears when the cue skids off the ball.
 *
 * Fired at the two ends of the charge — a jab released almost at once, or a
 * snatch held right to the ceiling — and never in the wide middle. It is a
 * mistake rather than a rule, so it says what happened rather than pronouncing a
 * penalty: the ball trickling nowhere is the punishment.
 *
 * Shown on contact rather than on release. Letting go is when *you* decided; the
 * tip reaching the ball is when it went wrong, and putting the message on the
 * gesture would announce the miscue before the cue had moved.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut, Keyframe } from 'react-native-reanimated';

import { Luxe } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { Phase } from '@/game/rules/types';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';
import { MISCUE_UNDER, useSwing } from '@/store/swing';

const DURATION = 1500;

export function MiscueBanner() {
  const t = useT();
  const miscue = useSwing((s) => s.miscue);
  const clearMiscue = useSwing((s) => s.clearMiscue);
  const phase = useSession((s) => s.phase);

  const [showing, setShowing] = useState<'rushed' | 'snatched' | null>(null);

  useEffect(() => {
    if (!miscue || phase !== Phase.SIMULATING) return;

    // Which mistake it was, so the line can name it: too early or too late.
    setShowing(miscue.charge < MISCUE_UNDER ? 'rushed' : 'snatched');
    clearMiscue();

    const timer = setTimeout(() => setShowing(null), DURATION);
    return () => clearTimeout(timer);
  }, [miscue, phase, clearMiscue]);

  if (!showing) return null;

  /*
   * A jolt, not a fade.
   *
   * The banner is reporting a slip, so it arrives like one: thrown in off
   * centre, over-corrected, and settled. A smooth entrance would make a miscue
   * look like something the game had planned.
   */
  const jolt = new Keyframe({
    0: { opacity: 0, transform: [{ translateX: -18 }, { rotate: '-4deg' }] },
    35: { opacity: 1, transform: [{ translateX: 8 }, { rotate: '2deg' }] },
    60: { opacity: 1, transform: [{ translateX: -3 }, { rotate: '-1deg' }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { rotate: '0deg' }] },
  });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View entering={jolt.duration(320)} exiting={FadeOut.duration(240)}>
        <View style={styles.banner}>
          <Text style={styles.title}>{t('miscue.title')}</Text>
          <Text style={styles.reason}>
            {t(showing === 'rushed' ? 'miscue.rushed' : 'miscue.snatched')}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: Spacing.six,
  },
  /** The app's own panel, edged in the danger tone: a cost, not a catastrophe. */
  banner: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(217, 117, 107, 0.5)',
    backgroundColor: '#080b0a',
  },
  title: {
    color: Luxe.danger,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.6,
    textTransform: 'uppercase',
  },
  reason: {
    color: Luxe.text,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
});
