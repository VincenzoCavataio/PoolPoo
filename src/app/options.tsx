import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { GameButton } from '@/components/ui/button';
import { Card, Screen, SectionLabel } from '@/components/ui/screen';
import {
  Luxe,
  MenuPalette as Palette,
  Radius,
} from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { LOCATIONS } from '@/game/render/locations';
import { LOCALE_LABEL, LOCALES } from '@/i18n';
import { useT } from '@/i18n/use-t';
import { clearSavedGame } from '@/store/persistence';
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
    clothId,
    locationId,
    showAimGuide,
    showGhostBall,
    aimSensitivity,
    haptics,
    language,
    setLanguage,
    collisionHaptics,
    setHaptics,
    setCollisionHaptics,
    setCloth,
    setLocation,
    setShowAimGuide,
    setShowGhostBall,
    setAimSensitivity,
    resetSettings,
  } = useSettings();
  const [savedCleared, setSavedCleared] = useState(false);

  const activeStep = SENSITIVITY_STEPS.reduce((best, step) =>
    Math.abs(step.value - aimSensitivity) < Math.abs(best.value - aimSensitivity) ? step : best,
  );

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
      <SectionLabel>{t('options.language')}</SectionLabel>
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

      <SectionLabel>{t('options.aimHelpers')}</SectionLabel>
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

      <SectionLabel>{t('options.audio')}</SectionLabel>
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
        <Text style={styles.rowDescription}>{t('options.mixerHint')}</Text>
      </Card>

      <SectionLabel>{t('options.data')}</SectionLabel>
      <Card>
        <GameButton label={t('options.resetSettings')} onPress={resetSettings} />
        <GameButton
          label={t('options.clearSave')}
          variant="danger"
          sublabel={savedCleared ? t('options.cleared') : undefined}
          onPress={confirmClearSave}
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
  rowLabel: {
    color: Luxe.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  rowDescription: {
    color: Luxe.textMuted,
    fontSize: 13,
    lineHeight: 19,
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
