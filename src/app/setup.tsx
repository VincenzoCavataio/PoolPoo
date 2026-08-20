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

import { BallsIcon, ClothIcon, PocketIcon } from '@/components/ui/icons';
import { LuxeFonts } from '@/components/ui/luxe';
import { ScreenHeader } from '@/components/ui/screen';
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
  /**
   * Who is already sitting at the table.
   *
   * This screen restarts the game, and it has to put back exactly the people the
   * screens before it set up. Rebuilding with fresh names dropped every computer
   * seat on the floor — the difficulty screen's entire answer — so a game against
   * the computer arrived at the table as a game between people, and no machine
   * ever took a turn because there was no machine.
   */
  const seats = useSession((s) => s.free?.players);

  const begin = () => {
    playTap('confirm');

    const names = Array.from(
      { length: players },
      (_, i) => seats?.[i]?.name ?? t('rules.player', { number: i + 1 }),
    );
    const cpus = Array.from({ length: players }, (_, i) => seats?.[i]?.cpu);

    // Restarted here rather than on the previous screen, so the table is built
    // with the cloth and room chosen on this one.
    startFree(players, names, cpus);
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
        <ScreenHeader title={t('setup.title')} onBack={() => router.back()} />

        <Animated.View entering={FadeIn.duration(260)} style={styles.stage}>
          <TablePreview locationId={locationId} clothId={clothId} ballSetId={ballSetId} />
        </Animated.View>

        {/*
          Tabs and choices, on one surface.

          They were separate slabs with a gap between them, which read as two
          unrelated controls — but a tab means nothing apart from the thing it
          reveals. Sharing a panel makes the tabs the heading of the row they
          switch, which is what they actually are.
        */}
        <View style={styles.picker}>
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
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={begin}
          style={({ pressed }) => [styles.go, pressed && styles.goPressed]}>
          <Text style={styles.goLabel}>{t('setup.start')}</Text>
          <Text style={styles.goChevron}>{'›'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * The same veil the options and trophy screens wear.
   *
   * This screen is read as much as it is looked at — a preview, a row of tabs, a
   * paragraph about whichever room is selected — and the drifting table under
   * all of it left the panels floating. The veil gives them a floor while
   * leaving the room visible behind, which matters here more than anywhere:
   * the thing being dressed is the table you can still see.
   */
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
    borderColor: 'rgba(255, 255, 255, 0.18)',
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
  /**
   * The rack, turned to match the table.
   *
   * This plan view is twice as wide as it is deep, so the long axis runs left to
   * right — the cue ball sits at one end and the pack at the other. The triangle
   * has to point along that axis, at the cue ball, the way it does on a real
   * table.
   *
   * It used to stack its rows downwards, which aimed the apex at a side cushion:
   * the rack was square to the table rather than in line with it, and the whole
   * layout read as a rack from some other table dropped onto this one. Laying
   * the rows out as columns turns it the ninety degrees it was out by.
   */
  previewRack: {
    position: 'absolute',
    right: '18%',
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  /**
   * One row of the triangle — drawn as a column, since the rack is on its side.
   *
   * The rows are listed apex first and a plain `row` lays them left to right, so
   * the single ball ends up on the side the cue ball is on and the pack widens
   * away from it.
   */
  previewRow: {
    flexDirection: 'column',
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
  /**
   * The panel holding the tabs and whatever they open.
   *
   * Solid, like every other panel in the app, and for the reason the menus
   * settled on: the scene behind this screen moves, and a rail sliding under a
   * line of type changes the contrast under each letter *while it is being
   * read*. Swatch labels and a two-line description over bare cloth were the
   * worst case for that.
   */
  picker: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201, 169, 98, 0.28)',
    backgroundColor: 'rgba(6, 9, 8, 0.92)',
    overflow: 'hidden',
  },
  /**
   * The tabs, along the top of that panel.
   *
   * Divided from the content by a hairline rather than boxed off from it: they
   * are the panel's heading, not a separate control floating above it.
   */
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    padding: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Luxe.hairline,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  /**
   * The selected tab, in the same family as the panel it sits in.
   *
   * It used to be `#161208`, the app's near-black gold — hue 43, all but
   * identical to the gold itself. That works where gold is the theme, but this
   * screen is green: against a panel at hue 156 the only warm thing on it read
   * as brown rather than as lit. This is the panel's own colour raised a couple
   * of stops, so the selected tab is marked by being brighter than its
   * neighbours instead of by being a different temperature. The gold edge and
   * label still carry the accent.
   */
  tabActive: {
    borderColor: 'rgba(201, 169, 98, 0.4)',
    backgroundColor: '#1c2b26',
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
  /**
   * The lower half of the picker panel.
   *
   * It carries the padding rather than the panel, so the tab strip above can run
   * edge to edge under its own divider — a heading that stops short of the sides
   * reads as a floating control again, which is the thing merging the two was
   * meant to fix.
   */
  choices: {
    gap: Spacing.two,
    padding: Spacing.three,
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

  /**
   * The one thing this screen exists to do, and now it looks like it.
   *
   * It was an outlined dark rectangle with gold small caps — the same weight as
   * a tab or a swatch, for the action that ends the screen. Filled gold is how
   * the main menu already marks *its* primary action, so this is the app's own
   * language rather than merely a louder button: the only solid gold surface on
   * the screen, and the obvious place to go next.
   */
  go: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 8,
    backgroundColor: Luxe.gold,
  },
  goPressed: {
    backgroundColor: '#b8985a',
  },
  goLabel: {
    // Ink on gold, not gold on black: a filled button carries dark type.
    color: Luxe.ink,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    fontFamily: LuxeFonts.sans,
  },
  /**
   * A chevron, because this one goes somewhere.
   *
   * Darker than a decorative mark would need to be: at 55% of ink on gold it
   * measured 2.9:1, and while nothing depends on reading it, a glyph that faint
   * beside 800-weight capitals looks like a rendering fault rather than a
   * deliberately quiet flourish.
   */
  goChevron: {
    color: 'rgba(8, 9, 11, 0.75)',
    fontSize: 20,
    lineHeight: 22,
    marginTop: -2,
  },
});
