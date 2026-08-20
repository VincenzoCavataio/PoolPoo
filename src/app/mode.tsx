/**
 * Who is playing: alone, against the computer, or against people in the room.
 *
 * The first fork of a new game, and it earns its own screen because the three
 * answers lead somewhere different. Solo needs nothing else asked — one player,
 * straight to dressing the table. The other two need a count, and the computer
 * needs a strength for each seat on top of that.
 *
 * Built out of `Screen` and `Card` like every other screen that asks a question,
 * rather than out of hand-rolled panels. The first version had its own frame and
 * its own spacing and looked adjacent to the app instead of part of it.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { CueIcon, RackIcon, SlidersIcon } from '@/components/ui/icons';
import { Card, Screen, SectionLabel } from '@/components/ui/screen';
import { Luxe } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
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
  { id: 'solo', labelKey: 'mode.solo', bodyKey: 'mode.soloBody', icon: <CueIcon size={20} /> },
  { id: 'cpu', labelKey: 'mode.cpu', bodyKey: 'mode.cpuBody', icon: <SlidersIcon size={20} /> },
  { id: 'human', labelKey: 'mode.human', bodyKey: 'mode.humanBody', icon: <RackIcon size={20} /> },
];

export default function ModeScreen() {
  const router = useRouter();
  const t = useT();
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
    <Screen title={t('mode.title')} onBack={() => router.back()}>
      <SectionLabel icon={<RackIcon size={15} color={Luxe.gold} />}>
        {t('mode.section')}
      </SectionLabel>

      <Card>
        {MODES.map((mode, index) => (
          <Animated.View key={mode.id} entering={FadeInDown.delay(index * 55).duration(260)}>
            <Pressable
              accessibilityRole="button"
              onPress={() => choose(mode.id)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
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
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /**
   * One row per mode, in the same shape the menu uses for Continue: an inset
   * icon, a label with a line under it, and a chevron because it goes somewhere.
   */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowPressed: {
    opacity: 0.6,
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  text: {
    flex: 1,
    gap: 3,
  },
  label: {
    color: Luxe.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  body: {
    color: Luxe.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  chevron: {
    color: 'rgba(201, 169, 98, 0.55)',
    fontSize: 20,
    lineHeight: 22,
    marginTop: -2,
  },
});
