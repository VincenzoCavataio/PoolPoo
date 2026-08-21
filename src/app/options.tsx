import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { CueIcon, DiscsIcon, LevelIcon, RackIcon, SlidersIcon } from '@/components/ui/icons';
import { Card, Screen, SectionLabel } from '@/components/ui/screen';
import { VolumeRow } from '@/components/ui/volume-row';
import {
  Luxe,
  MenuPalette as Palette,
} from '@/constants/game-theme';
import { QUALITY_PRESETS, qualityById, type QualityLevel } from '@/constants/quality';
import { Spacing } from '@/constants/theme';
import { LOCALE_LABEL, LOCALES } from '@/i18n';
import { useT } from '@/i18n/use-t';
import { setMenuMusicVolume } from '@/game/audio/menu-music';
import { setSfxVolume as setSfxLevel } from '@/game/audio/sfx';
import { clearSavedGame } from '@/store/persistence';
import { useTrophies } from '@/store/trophies';
import { useSettings } from '@/store/settings';

/** Whatever `app.json` says was built, with a fallback so the line is never blank. */
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/** Which way each preset points. Keyed by id so a new preset fails loudly here. */
const QUALITY_DIRECTION: Record<QualityLevel, 'down' | 'level' | 'up'> = {
  low: 'down',
  medium: 'level',
  high: 'up',
};

const SENSITIVITY_STEPS = [
  { labelKey: 'options.sensitivitySlow', value: 0.003 },
  { labelKey: 'options.sensitivityMedium', value: 0.005 },
  { labelKey: 'options.sensitivityFast', value: 0.009 },
] as const;

/**
 * One irreversible action, at the size of a footnote.
 *
 * No border and no fill: an outlined tile would read as a button among buttons,
 * which is the thing being undone here. What marks it is that it is small,
 * muted, and grouped with two others under a line saying they cannot be taken
 * back.
 */
function DangerTile({
  icon,
  label,
  accessibilityLabel,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.dangerTile, pressed && styles.dangerTilePressed]}>
      {icon}
      <Text style={styles.dangerLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Palette.border, true: Palette.accent }}
        thumbColor={Palette.text}
      />
    </View>
  );
}

export default function OptionsScreen() {
  const router = useRouter();
  const t = useT();
  const {
    playerName,
    setPlayerName,
    motionTrail,
    setMotionTrail,
    showAimGuide,
    showGhostBall,
    aimSensitivity,
    haptics,
    language,
    setLanguage,
    collisionHaptics,
    setHaptics,
    setCollisionHaptics,
    setShowAimGuide,
    setShowGhostBall,
    setAimSensitivity,
    resetSettings,
  } = useSettings();
  const musicVolume = useSettings((s) => s.musicVolume);
  const sfxVolume = useSettings((s) => s.sfxVolume);
  const setMusicVolume = useSettings((s) => s.setMusicVolume);
  const setSfxVolume = useSettings((s) => s.setSfxVolume);
  const quality = useSettings((s) => s.quality);
  const setQuality = useSettings((s) => s.setQuality);
  const [savedCleared, setSavedCleared] = useState(false);

  const resetTrophies = useTrophies((s) => s.resetTrophies);

  const activeStep = SENSITIVITY_STEPS.reduce((best, step) =>
    Math.abs(step.value - aimSensitivity) < Math.abs(best.value - aimSensitivity) ? step : best,
  );

  const confirmResetSettings = () => {
    Alert.alert(t('options.resetSettings'), t('options.resetSettingsBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('options.resetSettingsConfirm'), style: 'destructive', onPress: resetSettings },
    ]);
  };

  const confirmResetTrophies = () => {
    Alert.alert(t('trophy.reset'), t('trophy.resetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('trophy.reset'), style: 'destructive', onPress: resetTrophies },
    ]);
  };

  const confirmClearSave = () => {
    Alert.alert(t('options.clearSaveTitle'), t('options.clearSaveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('options.clearSaveConfirm'),
        style: 'destructive',
        onPress: () => {
          void clearSavedGame();
          setSavedCleared(true);
        },
      },
    ]);
  };

  return (
    <Screen title={t('options.title')} onBack={() => router.back()}>
      {/*
        Your name, first.

        It is the first thing the app asked for and the only setting that is
        about the person rather than the game, so it opens the list rather than
        being filed under data at the bottom.
      */}
      {/*
        Your name and your language, under one heading.

        Each of these used to have a heading and a panel of its own, which made a
        screen of six sections where four of them held a single control — all the
        furniture of a list with none of the length that justifies it. Grouping
        them means the headings now mark real changes of subject, and the eye can
        skip a whole card instead of reading past four titles to reach the fifth.
      */}
      <SectionLabel icon={<CueIcon size={15} color={Luxe.gold} />}>{t('options.you')}</SectionLabel>
      <Card>
        <Text style={styles.groupLabel}>{t('name.change')}</Text>
        <Text style={styles.rowDescription}>{t('name.changeBody')}</Text>
        <TextInput
          value={playerName}
          onChangeText={setPlayerName}
          placeholder={t('name.placeholder')}
          placeholderTextColor={Luxe.textFaint}
          style={styles.nameInput}
          maxLength={24}
          autoCorrect={false}
          returnKeyType="done"
        />

        <View style={styles.divider} />

        <Text style={styles.groupLabel}>{t('options.language')}</Text>
        <Text style={styles.rowDescription}>{t('options.languageBody')}</Text>
        <View style={styles.pillRow}>
          {(['auto', ...LOCALES] as const).map((option) => {
            const selected = option === language;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setLanguage(option)}
                style={({ pressed }) => [
                  styles.pill,
                  selected && styles.pillSelected,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]}>
                  {option === 'auto' ? t('options.languageAuto') : LOCALE_LABEL[option]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <SectionLabel icon={<SlidersIcon size={15} color={Luxe.gold} />}>{t('options.play')}</SectionLabel>
      <Card>
        <Text style={styles.groupLabel}>{t('options.aimHelpers')}</Text>
        <ToggleRow
          label={t('options.aimLine')}
          description={t('options.aimLineBody')}
          value={showAimGuide}
          onChange={setShowAimGuide}
        />
        <ToggleRow
          label={t('options.ghostBall')}
          description={t('options.ghostBallBody')}
          value={showGhostBall}
          onChange={setShowGhostBall}
        />
        <View>
          <Text style={styles.rowLabel}>{t('options.sensitivity')}</Text>
          <Text style={styles.rowDescription}>{t('options.sensitivityBody')}</Text>
          <View style={styles.pillRow}>
            {SENSITIVITY_STEPS.map((step) => {
              const selected = step.value === activeStep.value;
              return (
                <Pressable
                  key={step.labelKey}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setAimSensitivity(step.value)}
                  style={({ pressed }) => [
                    styles.pill,
                    selected && styles.pillSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]}>
                    {t(step.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.groupLabel}>{t('quality.section')}</Text>
        <View style={styles.pillRow}>
          {QUALITY_PRESETS.map((preset) => {
            const selected = preset.id === quality;
            return (
              <Pressable
                key={preset.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setQuality(preset.id)}
                style={({ pressed }) => [
                  styles.pill,
                  styles.pillWithIcon,
                  selected && styles.pillSelected,
                  pressed && styles.pressed,
                ]}>
                {/* Down, flat, up: the ordering is the point, and a shape says
                    it faster than reading three words and ranking them. */}
                <LevelIcon
                  direction={QUALITY_DIRECTION[preset.id]}
                  size={14}
                  color={selected ? Luxe.gold : Luxe.textMuted}
                />
                <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]}>
                  {t(preset.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.rowDescription}>{t(qualityById(quality).feelKey)}</Text>

        {/* Under graphics because that is what it is: a look, not an aid. */}
        <ToggleRow
          label={t('options.motionTrail')}
          description={t('options.motionTrailBody')}
          value={motionTrail}
          onChange={setMotionTrail}
        />

        <View style={styles.divider} />

        <Text style={styles.groupLabel}>{t('options.audio')}</Text>
        <ToggleRow
          label={t('options.haptics')}
          description={t('options.hapticsBody')}
          value={haptics}
          onChange={setHaptics}
        />
        <ToggleRow
          label={t('options.collisionHaptics')}
          description={t('options.collisionHapticsBody')}
          value={collisionHaptics}
          onChange={setCollisionHaptics}
        />
        {/*
          The same two faders as the record player's panel, and the same values.

          They were only reachable from the turntable in game, which meant the
          menu music had no volume control at all — you could hear it before you
          had any way to turn it down. Setting them here writes to the store and
          pushes the level to whichever player is actually running: the game's
          playlist is not loaded on this screen, and the menu theme is.
        */}
        <VolumeRow
          label={t('music.musicVolume')}
          value={musicVolume}
          onChange={(value) => {
            setMusicVolume(value);
            setMenuMusicVolume(value);
          }}
        />
        <VolumeRow
          label={t('music.sfxVolume')}
          value={sfxVolume}
          onChange={(value) => {
            setSfxVolume(value);
            setSfxLevel(value);
          }}
        />
      </Card>

      {/*
        The three ways to throw something away, kept small.

        These were full-width buttons stacked like every other action in the
        list, which gave the only irreversible things on the screen the same
        weight as a language pill — and put the largest red rectangle in the app
        at the end of the scroll, where a thumb arrives. As icons they are
        reachable but no longer inviting.

        The word "reset" is said once, by the heading. Repeating it on all three
        captions made the row three-quarters the same word, and the part that
        differed — which of the three you were about to lose — came last in every
        one. Under the heading each tile needs only to name its own thing. Each
        still asks before it does anything.

        It keeps the palette of the cards above — anything else was unreadable
        against this ground — but not their shape: one wide strip split into
        thirds, rather than a stack of labelled rows. Same room, different piece
        of furniture, which is enough to say this part is not like the rest.
      */}
      <View style={styles.resetBlock}>
        <Text style={styles.resetHeading}>{t('options.resetSection')}</Text>

        <View style={styles.resetStrip}>
          <DangerTile
            icon={<SlidersIcon size={16} color={Luxe.gold} />}
            label={t('options.resetShort')}
            accessibilityLabel={t('options.resetSettings')}
            onPress={confirmResetSettings}
          />
          <View style={styles.resetSplit} />
          <DangerTile
            icon={<RackIcon size={16} color={Luxe.gold} />}
            label={savedCleared ? t('options.cleared') : t('options.clearSaveShort')}
            accessibilityLabel={t('options.clearSave')}
            onPress={confirmClearSave}
          />
          <View style={styles.resetSplit} />
          <DangerTile
            icon={<DiscsIcon size={16} color={Luxe.gold} />}
            label={t('options.resetTrophiesShort')}
            accessibilityLabel={t('trophy.reset')}
            onPress={confirmResetTrophies}
          />
        </View>
      </View>

      {/*
        The version, last and faintest.

        Read from the manifest rather than typed here, so it cannot drift from
        what was actually shipped — a hand-kept number on a settings screen is
        wrong the first time anybody forgets to change it.
      */}
      <Text style={styles.version}>{t('options.version', { version: APP_VERSION })}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  swatchWrap: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.two,
  },
  swatchLabelSelected: {
    color: Palette.accent,
  },
  clothFeel: {
    color: Palette.text,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  /**
   * A setting's name, in the menus' voice rather than a form's.
   *
   * Spaced capitals at label size, with the explanation beneath in sentence
   * case. The two were 15pt bold and 12pt regular — the difference between a
   * heading and its body in a document, which is what made the screen read as a
   * form. Capitals separate them by texture instead of by weight.
   */
  /**
   * The label of a setting, and the line explaining it.
   *
   * The label used to be 11pt against a 13pt description — the heading smaller
   * than the body beneath it, which is most of why every card read as a wall of
   * grey with a caption on top. 13 over 12 puts them the right way round and
   * matches the rows on the menu and the mode screen.
   */
  rowLabel: {
    color: Luxe.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  rowDescription: {
    color: Luxe.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  /**
   * Boxed rather than underlined, unlike the twin field on the seats screen.
   *
   * That one is underlined because it stands alone in its panel. Here the group
   * divider falls a few points below it, and the two hairlines read as one
   * doubled rule — a box says "type here" without putting a second line where a
   * separator already is.
   */
  nameInput: {
    marginTop: Spacing.three,
    color: Luxe.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  /**
   * A group inside a card, where a section heading would once have been.
   *
   * Quieter than `SectionLabel` on purpose: it separates two sets of controls
   * that belong to the same subject, so it has to read as a subdivision rather
   * than as another top-level heading competing with the one above the card.
   */
  groupLabel: {
    color: Luxe.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.three,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  resetBlock: {
    gap: Spacing.two,
    paddingTop: Spacing.five,
  },
  /** The same gold and weight as the group headings above it. */
  resetHeading: {
    color: Luxe.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  /**
   * The card's ground and edge, in the shape of a strip.
   *
   * Tinting this red made a panel nothing else on the screen shared, and against
   * that ground both the muted grey and the danger tone itself sat too close to
   * the background to read. The colours come from the cards above instead, and
   * what marks the section is its shape — one wide strip split three ways rather
   * than a stack of rows.
   */
  resetStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201, 169, 98, 0.28)',
    backgroundColor: '#080b0a',
    overflow: 'hidden',
  },
  /** A hairline between thirds, so the strip reads as three doors, not one. */
  resetSplit: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  /** Equal thirds, so the three read as one row of the same thing. */
  dangerTile: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.four,
  },
  dangerTilePressed: {
    backgroundColor: '#141a19',
  },
  /**
   * Small, but bright.
   *
   * These were 10pt in the muted grey on a transparent ground — light text
   * floating on whatever the room happened to be behind it, for the labels that
   * say what you are about to destroy. The size was only half of why they could
   * not be read. At 11pt in the near-white on the card's own dark they clear
   * 17:1, so the row can stay as quiet as it should be and still be legible.
   */
  dangerLabel: {
    color: Luxe.text,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  version: {
    // `textMuted`, not `textFaint`: this is the line somebody reads back when
    // reporting a problem, and at 3:1 the faint grey was not quite readable.
    color: Luxe.textMuted,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.2,
    textAlign: 'center',
    paddingTop: Spacing.four,
  },
  /** Room for the glyph beside the word, laid out on one line. */
  pillWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  pill: {
    flex: 1,
    height: 44,
    borderRadius: 4,
    backgroundColor: 'rgba(8, 12, 10, 0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: 'rgba(28, 23, 12, 0.86)',
    borderColor: Luxe.gold,
  },
  pillLabel: {
    color: Luxe.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  pillLabelSelected: {
    color: Luxe.gold,
  },
  pressed: {
    opacity: 0.7,
  },
});
