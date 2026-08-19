/**
 * Starting a game: how many people are playing.
 *
 * That is the whole screen now. It used to be two cards — free play in one,
 * puzzles in the other — with a paragraph of prose explaining each, because the
 * player had to choose between two modes before choosing anything else. With one
 * mode left, the player count is the only decision, so it gets the screen rather
 * than a field inside a card.
 *
 * The count is picked as a row of large numerals with a hairline under the
 * chosen one. A number is the shortest possible label for a number, and
 * underlining the selection reads at a glance from further away than a filled
 * pill does.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GameButton } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { GlowRule, LuxeFonts } from '@/components/ui/luxe';
import { Luxe } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';

const PLAYER_OPTIONS = [1, 2, 3, 4];

export default function NewGameScreen() {
  const router = useRouter();
  const t = useT();
  const startFree = useSession((s) => s.startFree);
  const [players, setPlayers] = useState(2);

  /**
   * On to dressing the table.
   *
   * The game is started here rather than there only so the next screen knows how
   * many people are playing; it starts it again once the room and cloth are
   * chosen, because the table is built with the cloth's physics and has to be
   * rebuilt if that changes.
   */
  const next = () => {
    const names = Array.from({ length: players }, (_, i) => t('rules.player', { number: i + 1 }));
    startFree(players, names);
    router.push('/setup');
  };

  return (
    <Screen
      title={t('newGame.title')}
      subtitle={t('newGame.subtitle')}
      onBack={() => router.back()}>
      <View style={styles.block}>
        <Text style={styles.fieldLabel}>{t('newGame.players')}</Text>

        <View style={styles.row}>
          {PLAYER_OPTIONS.map((count) => {
            const selected = count === players;
            return (
              <Pressable
                key={count}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setPlayers(count)}
                style={({ pressed }) => [styles.choice, pressed && styles.pressed]}>
                <Text style={[styles.numeral, selected && styles.numeralSelected]}>{count}</Text>
                {/* The lit rule marks the selection: it is the same mark the rest
                    of the menus use for "this one", so it needs no explaining. */}
                <View style={styles.markSlot}>
                  {selected ? <GlowRule width={28} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.helper}>
          {players === 1 ? t('newGame.soloHint') : t('newGame.multiHint', { count: players })}
        </Text>
      </View>

      <GameButton label={t('newGame.startFree')} variant="primary" onPress={next} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.three,
  },
  fieldLabel: {
    color: Luxe.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
  },
  choice: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  /**
   * Serif, and large. These are the only numbers on the screen, so they can
   * carry the same face as the wordmark instead of looking like form controls.
   */
  numeral: {
    // Muted rather than faint: an unchosen numeral still has to be readable
    // against the felt, which the fainter tone is not.
    color: Luxe.textMuted,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: LuxeFonts.serif,
    fontVariant: ['tabular-nums'],
  },
  numeralSelected: {
    color: Luxe.text,
  },
  /** Reserved height, so choosing does not shift the row by the rule's height. */
  markSlot: {
    height: 6,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  helper: {
    color: Luxe.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
