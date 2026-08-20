/**
 * Asking the player what to call them, once.
 *
 * Shown over the menu the first time the app is opened and never again — the
 * name lives in the settings, so a blank one is the signal that the question has
 * not been put yet. It can be changed later from the options; this is only the
 * first meeting.
 *
 * Skippable, and that matters. A game that will not let you past a form before
 * you have played a single shot is asking for something it has not earned; a
 * player who skips is called by the fallback and is asked nothing again. The
 * scoreboard reads a little less personally, and that is the whole cost.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { GlowRule, Heading } from '@/components/ui/luxe';
import { Luxe } from '@/constants/game-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { playTap } from '@/game/audio/sfx';
import { useT } from '@/i18n/use-t';
import { useSettings } from '@/store/settings';

export function NamePrompt() {
  const t = useT();
  const playerName = useSettings((s) => s.playerName);
  const setPlayerName = useSettings((s) => s.setPlayerName);

  const [draft, setDraft] = useState('');
  /**
   * Whether this session has finished with the question.
   *
   * Separate from the stored name so that skipping closes the sheet without
   * writing anything: a skipped question is not an answer, and storing a blank
   * would be indistinguishable from never having asked.
   */
  const [done, setDone] = useState(false);

  if (playerName || done) return null;

  const submit = () => {
    const name = draft.trim();
    playTap('confirm');
    if (name) setPlayerName(name);
    setDone(true);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(320)}
      exiting={FadeOut.duration(200)}
      style={styles.backdrop}>
      <Animated.View entering={FadeInDown.delay(120).duration(320)} style={styles.sheet}>
        <Heading size={24}>{t('name.askTitle')}</Heading>
        <GlowRule width={48} color={Luxe.gold} />

        <Text style={styles.body}>{t('name.askBody')}</Text>

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('name.placeholder')}
          placeholderTextColor={Luxe.textFaint}
          style={styles.input}
          maxLength={24}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
          // Opens with the keyboard up: the sheet exists to be typed into, and
          // making the player tap the field first is a step for nothing.
          autoFocus
        />

        <Pressable
          accessibilityRole="button"
          onPress={submit}
          disabled={draft.trim().length === 0}
          style={({ pressed }) => [
            styles.confirm,
            draft.trim().length === 0 && styles.confirmDisabled,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.confirmLabel}>{t('name.confirm')}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            playTap();
            setDone(true);
          }}
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
          <Text style={styles.skipLabel}>{t('name.skip')}</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /**
   * Over the whole menu, and opaque enough to take the eye off it.
   *
   * This is the one moment the room should stop competing: it is a question, and
   * a question asked over a drifting table gets answered while somebody watches
   * the table.
   */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    backgroundColor: 'rgba(4, 6, 5, 0.88)',
    zIndex: 10,
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 98, 0.28)',
    backgroundColor: '#080b0a',
  },
  body: {
    color: Luxe.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: Luxe.text,
    fontSize: 16,
    textAlign: 'center',
  },
  /** Filled gold, like every other action that ends a screen. */
  confirm: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 8,
    backgroundColor: Luxe.gold,
  },
  confirmDisabled: {
    opacity: 0.35,
  },
  confirmLabel: {
    color: Luxe.ink,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  skip: {
    paddingVertical: Spacing.two,
  },
  skipLabel: {
    color: Luxe.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.6,
  },
});
