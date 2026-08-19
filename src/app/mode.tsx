/**
 * Who is playing: alone, against the computer, or against people in the room.
 *
 * The first fork of a new game, and it earns being its own screen because the
 * three answers lead somewhere different. Solo needs nothing else asked — one
 * player, straight to dressing the table. The other two need a count, and the
 * computer needs a strength for each seat on top of that.
 *
 * Three panels rather than a list of radio buttons: this is a choice about what
 * kind of evening it is, not a setting.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CueIcon, RackIcon, SlidersIcon } from '@/components/ui/icons';
import { ScreenHeader } from '@/components/ui/screen';
import { Luxe } from '@/constants/game-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { playTap } from '@/game/audio/sfx';
import { useT } from '@/i18n/use-t';
import type { MessageKey } from '@/i18n';
import { useSession } from '@/store/session';

interface Mode {
  id: 'solo' | 'cpu' | 'human';
  labelKey: MessageKey;
  bodyKey: MessageKey;
  icon: React.ReactNode;
}

const MODES: Mode[] = [
  { id: 'solo', labelKey: 'mode.solo', bodyKey: 'mode.soloBody', icon: <CueIcon size={22} /> },
  { id: 'cpu', labelKey: 'mode.cpu', bodyKey: 'mode.cpuBody', icon: <SlidersIcon size={22} /> },
  { id: 'human', labelKey: 'mode.human', bodyKey: 'mode.humanBody', icon: <RackIcon size={22} /> },
];

export default function ModeScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const startFree = useSession((s) => s.startFree);

  const choose = (mode: Mode['id']) => {
    playTap('confirm');

    if (mode === 'solo') {
      /*
       * Solo skips the count and the difficulties: there is nobody else to
       * describe. The game is started here so the setup screen has something to
       * dress, exactly as the player-count screen does for the other two.
       */
      startFree(1, [t('rules.player', { number: 1 })]);
      router.push('/setup');
      return;
    }

    router.push({ pathname: '/new-game', params: { mode } });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.inner, { paddingTop: insets.top + Spacing.four }]}>
        <ScreenHeader title={t('mode.title')} onBack={() => router.back()} />

        <View style={styles.centre}>
          {MODES.map((mode, index) => (
            <Animated.View
              key={mode.id}
              entering={FadeInDown.delay(60 + index * 60).duration(280)}>
              <Pressable
                accessibilityRole="button"
                onPress={() => choose(mode.id)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                <View style={styles.icon}>{mode.icon}</View>

                <View style={styles.text}>
                  <Text style={styles.label}>{t(mode.labelKey)}</Text>
                  <Text style={styles.body} numberOfLines={2}>
                    {t(mode.bodyKey)}
                  </Text>
                </View>

                <Text style={styles.chevron}>{'›'}</Text>
              </Pressable>
            </Animated.View>
          ))}
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
    paddingBottom: Spacing.six,
  },
  /** The three choices, centred in what the header leaves. */
  centre: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    backgroundColor: '#0d1210',
  },
  cardPressed: {
    backgroundColor: '#161d1a',
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    backgroundColor: 'rgba(201, 169, 98, 0.07)',
  },
  text: {
    flex: 1,
    gap: 3,
  },
  label: {
    color: Luxe.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  body: {
    color: Luxe.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  chevron: {
    color: 'rgba(201, 169, 98, 0.6)',
    fontSize: 22,
    lineHeight: 24,
    marginTop: -2,
  },
});
