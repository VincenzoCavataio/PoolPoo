/**
 * Dressing the table, between choosing the players and breaking.
 *
 * Built around a preview rather than a form. The three choices — room, cloth,
 * balls — all change how the table looks, so the table is drawn at the top and
 * the pickers underneath change it live. You choose by looking at the result,
 * not by reading a list of names and imagining it.
 *
 * The pickers themselves are tabs: one row at a time, so a small screen shows
 * the preview large instead of three shrunken carousels stacked up.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton, BallsIcon, ClothIcon, PocketIcon } from '@/components/ui/icons';
import { Heading, LuxeFonts } from '@/components/ui/luxe';
import { BALL_SETS, ballSetById, colorForBallIn } from '@/constants/ball-sets';
import { CLOTH_OPTIONS, clothById, Luxe } from '@/constants/game-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { playTap } from '@/game/audio/sfx';
import { locationById, LOCATIONS } from '@/game/render/locations';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

type Tab = 'place' | 'cloth' | 'balls';

/**
 * The table as it will be, drawn flat.
 *
 * A plan view: the room's floor behind it, the chosen cloth, six pockets, and a
 * rack of the chosen balls. Every choice on this screen changes something you
 * can see here, which is the entire reason the screen is laid out this way.
 */
function TablePreview({
  locationId,
  clothId,
  ballSetId,
}: {
  locationId: string;
  clothId: string;
  ballSetId: string;
}) {
  const room = locationById(locationId);
  const cloth = clothById(clothId);
  const set = ballSetById(ballSetId);

  // A short rack, enough to show the set's colours and whether it stripes.
  const rack = [
    [1],
    [2, 3],
    [4, 5, 6],
  ];

  return (
    <View style={[styles.preview, { backgroundColor: room.floorColor }]}>
      <View style={[styles.previewRail, { borderColor: cloth.cushion }]}>
        <View style={[styles.previewBed, { backgroundColor: cloth.cloth }]}>
          {/* Pockets, at the corners and the middle of the long sides. */}
          {[
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
          ].map(([x, y]) => (
            <View
              key={`${x}-${y}`}
              style={[
                styles.previewPocket,
                { left: x ? undefined : -6, right: x ? -6 : undefined, top: y ? undefined : -6, bottom: y ? -6 : undefined },
              ]}
            />
          ))}
          <View style={[styles.previewPocket, styles.previewPocketMidTop]} />
          <View style={[styles.previewPocket, styles.previewPocketMidBottom]} />

          <View style={styles.previewRack}>
            {rack.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.previewRow}>
                {row.map((n) => {
                  const striped = set.striped && n > 8;
                  return (
                    <View
                      key={n}
                      style={[styles.previewBall, { backgroundColor: colorForBallIn(set, n) }]}>
                      {striped ? <View style={styles.previewStripe} /> : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {/* The cue ball, out on its own the way it is at the break. */}
          <View style={[styles.previewCue, { backgroundColor: set.cue }]} />
        </View>
      </View>
    </View>
  );
}

/** A round swatch: the control is the colour, with the name underneath. */
function Swatch({
  colour,
  label,
  selected,
  onPress,
}: {
  colour: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        playTap();
        onPress();
      }}
      style={({ pressed }) => [styles.swatchWrap, pressed && styles.pressed]}>
      <View
        style={[
          styles.swatch,
          { backgroundColor: colour },
          selected && styles.swatchSelected,
        ]}
      />
      <Text style={[styles.swatchLabel, selected && styles.swatchLabelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SetupScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('place');

  const locationId = useSettings((s) => s.locationId);
  const setLocation = useSettings((s) => s.setLocation);
  const clothId = useSettings((s) => s.clothId);
  const setCloth = useSettings((s) => s.setCloth);
  const ballSetId = useSettings((s) => s.ballSetId);
  const setBallSet = useSettings((s) => s.setBallSet);

  const players = useSession((s) => s.free?.players.length ?? 2);
  const startFree = useSession((s) => s.startFree);

  const begin = () => {
    playTap('confirm');
    const names = Array.from({ length: players }, (_, i) => t('rules.player', { number: i + 1 }));
    // Restarted here rather than on the previous screen, so the table is built
    // with the cloth and room chosen on this one.
    startFree(players, names);
    // Through the pause rather than straight to the table: the world is built
    // here, so the loading screen has a game to hold while it holds the quiet.
    router.replace('/loading');
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'place', label: t('setup.place'), icon: <PocketIcon size={20} /> },
    { id: 'cloth', label: t('setup.cloth'), icon: <ClothIcon size={20} /> },
    { id: 'balls', label: t('setup.balls'), icon: <BallsIcon size={20} /> },
  ];

  const description =
    tab === 'place'
      ? t(locationById(locationId).descriptionKey)
      : tab === 'cloth'
        ? t(clothById(clothId).feelKey)
        : t(ballSetById(ballSetId).feelKey);

  return (
    <View style={styles.root}>
      <View style={[styles.inner, { paddingTop: insets.top + Spacing.four }]}>
        <View style={styles.header}>
          <BackButton label={t('common.back')} onPress={() => router.back()} />
          <Heading size={26}>{t('setup.title')}</Heading>
        </View>

        <Animated.View entering={FadeIn.duration(260)} style={styles.stage}>
          <TablePreview locationId={locationId} clothId={clothId} ballSetId={ballSetId} />
        </Animated.View>

        {/* Which set of choices is showing. */}
        <View style={styles.tabRow}>
          {tabs.map((entry) => {
            const active = entry.id === tab;
            return (
              <Pressable
                key={entry.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  playTap();
                  setTab(entry.id);
                }}
                style={({ pressed }) => [
                  styles.tab,
                  active && styles.tabActive,
                  pressed && styles.pressed,
                ]}>
                <View style={active ? undefined : styles.tabIconIdle}>{entry.icon}</View>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.choices}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.choiceRow}>
              {tab === 'place'
                ? LOCATIONS.map((location) => (
                    <Swatch
                      key={location.id}
                      colour={location.floorColor}
                      label={t(location.labelKey)}
                      selected={location.id === locationId}
                      onPress={() => setLocation(location.id)}
                    />
                  ))
                : null}

              {tab === 'cloth'
                ? CLOTH_OPTIONS.map((option) => (
                    <Swatch
                      key={option.id}
                      colour={option.cloth}
                      label={t(option.labelKey)}
                      selected={option.id === clothId}
                      onPress={() => setCloth(option.id)}
                    />
                  ))
                : null}

              {tab === 'balls'
                ? BALL_SETS.map((option) => (
                    <Swatch
                      key={option.id}
                      colour={colorForBallIn(option, 3)}
                      label={t(option.labelKey)}
                      selected={option.id === ballSetId}
                      onPress={() => setBallSet(option.id)}
                    />
                  ))
                : null}
            </View>
          </ScrollView>

          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={begin}
          style={({ pressed }) => [styles.go, pressed && styles.goPressed]}>
          <Text style={styles.goLabel}>{t('setup.start')}</Text>
        </Pressable>
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
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },

  // ---------------------------------------------------------------- preview
  stage: {
    flex: 1,
    justifyContent: 'center',
  },
  preview: {
    borderRadius: 8,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
  },
  previewRail: {
    borderWidth: 8,
    borderRadius: 6,
  },
  previewBed: {
    aspectRatio: 2,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPocket: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#05080699',
  },
  previewPocketMidTop: {
    top: -6,
    alignSelf: 'center',
  },
  previewPocketMidBottom: {
    bottom: -6,
    alignSelf: 'center',
  },
  previewRack: {
    position: 'absolute',
    right: '18%',
    gap: 2,
    alignItems: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    gap: 2,
  },
  previewBall: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  previewStripe: {
    height: 4,
    backgroundColor: '#f2ede0',
  },
  previewCue: {
    position: 'absolute',
    left: '22%',
    width: 11,
    height: 11,
    borderRadius: 5.5,
  },

  // ------------------------------------------------------------------- tabs
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.two,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  tabActive: {
    borderColor: 'rgba(201, 169, 98, 0.4)',
    backgroundColor: '#161208',
  },
  tabIconIdle: {
    opacity: 0.45,
  },
  tabLabel: {
    color: Luxe.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    color: Luxe.gold,
  },

  // ---------------------------------------------------------------- choices
  choices: {
    gap: Spacing.two,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  swatchWrap: {
    alignItems: 'center',
    gap: 6,
    width: 62,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: Luxe.gold,
  },
  swatchLabel: {
    color: Luxe.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  swatchLabelSelected: {
    color: Luxe.gold,
  },
  description: {
    color: Luxe.textMuted,
    fontSize: 12,
    lineHeight: 18,
    minHeight: 36,
  },

  go: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201, 169, 98, 0.5)',
    backgroundColor: '#161208',
  },
  goPressed: {
    backgroundColor: '#241d0f',
  },
  goLabel: {
    color: Luxe.gold,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    fontFamily: LuxeFonts.sans,
  },
});
