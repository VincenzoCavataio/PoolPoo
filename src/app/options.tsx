import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { GameButton } from '@/components/ui/button';
import { CueIcon, DiscsIcon, GlobeIcon, SlidersIcon, SoundIcon } from '@/components/ui/icons';
import { Card, Screen, SectionLabel } from '@/components/ui/screen';
import { VolumeRow } from '@/components/ui/volume-row';
import {
  Luxe,
  MenuPalette as Palette,
} from '@/constants/game-theme';
import { QUALITY_PRESETS, qualityById } from '@/constants/quality';
import { Spacing } from '@/constants/theme';
import { LOCALE_LABEL, LOCALES } from '@/i18n';
import { useT } from '@/i18n/use-t';
import { setMenuMusicVolume } from '@/game/audio/menu-music';
import { setSfxVolume as setSfxLevel } from '@/game/audio/sfx';
import { clearSavedGame } from '@/store/persistence';
import { trophyTally, useTrophies } from '@/store/trophies';
import { useSettings } from '@/store/settings';

const SENSITIVITY_STEPS = [
  { labelKey: 'options.sensitivitySlow', value: 0.003 },
  { labelKey: 'options.sensitivityMedium', value: 0.005 },
  { labelKey: 'options.sensitivityFast', value: 0.009 },
] as const;

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

  const unlocked = useTrophies((s) => s.unlocked);
  const resetTrophies = useTrophies((s) => s.resetTrophies);
  const tally = trophyTally(unlocked);

  const activeStep = SENSITIVITY_STEPS.reduce((best, step) =>
    Math.abs(step.value - aimSensitivity) < Math.abs(best.value - aimSensitivity) ? step : best,
  );

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
      <SectionLabel icon={<GlobeIcon size={15} color={Luxe.gold} />}>{t('options.language')}</SectionLabel>
      <Card>
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

      <SectionLabel icon={<SlidersIcon size={15} color={Luxe.gold} />}>{t('quality.section')}</SectionLabel>
      <Card>
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
                  selected && styles.pillSelected,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]}>
                  {t(preset.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.rowDescription}>{t(qualityById(quality).feelKey)}</Text>
      </Card>

      <SectionLabel icon={<CueIcon size={15} color={Luxe.gold} />}>{t('options.aimHelpers')}</SectionLabel>
      <Card>
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
      </Card>

      <SectionLabel icon={<SoundIcon size={15} color={Luxe.gold} />}>{t('options.audio')}</SectionLabel>
      <Card>
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

      <SectionLabel icon={<DiscsIcon size={15} color={Luxe.gold} />}>
        {t('trophy.title')}
      </SectionLabel>
      <Card>
        <GameButton
          label={t('trophy.title')}
          sublabel={t('trophy.tally', { earned: tally.earned, total: tally.total })}
          onPress={() => router.push('/trophies')}
        />
      </Card>

      <SectionLabel icon={<DiscsIcon size={15} color={Luxe.gold} />}>{t('options.data')}</SectionLabel>
      <Card>
        <GameButton label={t('options.resetSettings')} onPress={resetSettings} />
        <GameButton
          label={t('options.clearSave')}
          variant="danger"
          sublabel={savedCleared ? t('options.cleared') : undefined}
          onPress={confirmClearSave}
        />
        <GameButton
          label={t('trophy.reset')}
          variant="danger"
          sublabel={t('trophy.resetBody')}
          onPress={confirmResetTrophies}
        />
      </Card>
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
