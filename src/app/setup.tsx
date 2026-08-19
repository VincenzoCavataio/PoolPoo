/**
 * Dressing the table, between choosing the players and breaking.
 *
 * Room, cloth and balls used to live in Options, which is the wrong place for
 * them: they are not preferences you set once and forget, they are part of
 * setting up a game — and burying them three taps deep under a settings screen
 * meant most players would never find out the cloth changes how the table plays.
 *
 * Everything here is a swatch rather than a row of text. These are choices about
 * how something looks, so the control shows what it will look like and the words
 * only name it.
 */

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GameButton } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { GlowRule, LuxeFonts } from '@/components/ui/luxe';
import { BALL_SETS, ballSetById, colorForBallIn } from '@/constants/ball-sets';
import { CLOTH_OPTIONS, Luxe } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { LOCATIONS } from '@/game/render/locations';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

/** A labelled group with a lit rule under its heading. */
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <GlowRule width={24} align="flex-start" />
      {children}
    </View>
  );
}

/**
 * Five balls from a set, drawn flat.
 *
 * Enough of the set to judge it: two solids, the eight, and two that are striped
 * where the set has stripes. A set without them shows five solids instead, which
 * is exactly the difference the player is choosing between.
 */
function BallSetPreview({ setId }: { setId: string }) {
  const set = ballSetById(setId);
  const sample = [1, 3, 8, 11, 14];

  return (
    <View style={styles.swatchRow}>
      {sample.map((n) => {
        const striped = set.striped && n > 8;
        return (
          <View
            key={n}
            style={[styles.ball, { backgroundColor: colorForBallIn(set, n) }]}>
            {striped ? <View style={styles.ballStripe} /> : null}
            <View style={styles.ballSheen} />
          </View>
        );
      })}
    </View>
  );
}

export default function SetupScreen() {
  const router = useRouter();
  const t = useT();

  const locationId = useSettings((s) => s.locationId);
  const setLocation = useSettings((s) => s.setLocation);
  const clothId = useSettings((s) => s.clothId);
  const setCloth = useSettings((s) => s.setCloth);
  const ballSetId = useSettings((s) => s.ballSetId);
  const setBallSet = useSettings((s) => s.setBallSet);

  const players = useSession((s) => s.free?.players.length ?? 2);
  const startFree = useSession((s) => s.startFree);

  const begin = () => {
    const names = Array.from({ length: players }, (_, i) => t('rules.player', { number: i + 1 }));
    // Restarted here rather than on the previous screen, so the table is built
    // with the cloth and room chosen on this one.
    startFree(players, names);
    router.replace('/game');
  };

  const cloth = CLOTH_OPTIONS.find((c) => c.id === clothId) ?? CLOTH_OPTIONS[0];
  const balls = ballSetById(ballSetId);
  const room = LOCATIONS.find((l) => l.id === locationId) ?? LOCATIONS[0];

  return (
    <Screen
      title={t('setup.title')}
      subtitle={t('setup.subtitle')}
      onBack={() => router.back()}
      footer={<GameButton label={t('setup.start')} variant="primary" onPress={begin} />}>
      <Group label={t('setup.place')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tileRow}>
            {LOCATIONS.map((location) => {
              const selected = location.id === locationId;
              return (
                <Pressable
                  key={location.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setLocation(location.id)}
                  style={({ pressed }) => [
                    styles.tile,
                    selected && styles.tileSelected,
                    pressed && styles.pressed,
                  ]}>
                  {/* The room's own floor and wall, which is more use than its
                      name for telling one from another at a glance. */}
                  <View style={[styles.tileArt, { backgroundColor: location.floorColor }]}>
                    <View
                      style={[
                        styles.tileWall,
                        { backgroundColor: location.walls?.color ?? location.background },
                      ]}
                    />
                  </View>
                  <Text style={[styles.tileLabel, selected && styles.tileLabelSelected]}>
                    {t(location.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <Text style={styles.note}>{t(room.descriptionKey)}</Text>
      </Group>

      <Group label={t('setup.cloth')}>
        <View style={styles.swatchRow}>
          {CLOTH_OPTIONS.map((option) => {
            const selected = option.id === clothId;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(option.labelKey)}
                onPress={() => setCloth(option.id)}
                style={({ pressed }) => [
                  styles.swatch,
                  { backgroundColor: option.cloth },
                  selected && styles.swatchSelected,
                  pressed && styles.pressed,
                ]}
              />
            );
          })}
        </View>
        <Text style={styles.chosen}>{t(cloth.labelKey)}</Text>
        <Text style={styles.note}>{t(cloth.feelKey)}</Text>
      </Group>

      <Group label={t('setup.balls')}>
        <View style={styles.setColumn}>
          {BALL_SETS.map((set) => {
            const selected = set.id === ballSetId;
            return (
              <Pressable
                key={set.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setBallSet(set.id)}
                style={({ pressed }) => [
                  styles.setRow,
                  selected && styles.setRowSelected,
                  pressed && styles.pressed,
                ]}>
                <BallSetPreview setId={set.id} />
                <Text style={[styles.setLabel, selected && styles.setLabelSelected]}>
                  {t(set.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.note}>{t(balls.feelKey)}</Text>
      </Group>
    </Screen>
  );
}

const BALL = 22;

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  groupLabel: {
    color: Luxe.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  note: {
    color: Luxe.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  chosen: {
    color: Luxe.text,
    fontSize: 15,
    fontFamily: LuxeFonts.serif,
  },

  // ------------------------------------------------------------------- rooms
  tileRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  tile: {
    width: 92,
    gap: Spacing.one,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    borderRadius: 4,
    backgroundColor: 'rgba(8, 12, 10, 0.7)',
  },
  tileSelected: {
    borderColor: Luxe.gold,
    backgroundColor: 'rgba(28, 23, 12, 0.86)',
  },
  tileArt: {
    height: 46,
    borderRadius: 2,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  tileWall: {
    height: 18,
  },
  tileLabel: {
    color: Luxe.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tileLabelSelected: {
    color: Luxe.gold,
  },

  // ------------------------------------------------------------------ cloth
  swatchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  swatch: {
    width: 46,
    height: 46,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: Luxe.gold,
  },

  // ------------------------------------------------------------------ balls
  setColumn: {
    gap: Spacing.two,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    borderRadius: 4,
    backgroundColor: 'rgba(8, 12, 10, 0.7)',
  },
  setRowSelected: {
    borderColor: Luxe.gold,
    backgroundColor: 'rgba(28, 23, 12, 0.86)',
  },
  setLabel: {
    color: Luxe.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  setLabelSelected: {
    color: Luxe.gold,
  },
  ball: {
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BALL * 0.36,
    backgroundColor: '#f2ede0',
  },
  ballSheen: {
    position: 'absolute',
    top: BALL * 0.12,
    left: BALL * 0.16,
    width: BALL * 0.36,
    height: BALL * 0.36,
    borderRadius: BALL * 0.18,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },

  pressed: {
    opacity: 0.65,
  },
});
