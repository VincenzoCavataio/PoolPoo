import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { GameButton } from '@/components/ui/button';
import { Card, Screen, SectionLabel } from '@/components/ui/screen';
import { CLOTH_OPTIONS, clothById, Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { isLocationUnlocked, LOCATIONS } from '@/game/render/locations';
import { clearSavedGame } from '@/store/persistence';
import { MAX_STARS, totalStars, useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';

const SENSITIVITY_STEPS = [
  { label: 'Lenta', value: 0.003 },
  { label: 'Media', value: 0.005 },
  { label: 'Rapida', value: 0.009 },
];

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
  const {
    clothId,
    locationId,
    showAimGuide,
    showGhostBall,
    aimSensitivity,
    setCloth,
    setLocation,
    setShowAimGuide,
    setShowGhostBall,
    setAimSensitivity,
    resetSettings,
  } = useSettings();
  const stars = useProgress((s) => s.stars);
  const resetProgress = useProgress((s) => s.resetProgress);
  const [savedCleared, setSavedCleared] = useState(false);

  const earned = totalStars(stars);

  const activeStep = SENSITIVITY_STEPS.reduce((best, step) =>
    Math.abs(step.value - aimSensitivity) < Math.abs(best.value - aimSensitivity) ? step : best,
  );

  const confirmClearSave = () => {
    Alert.alert('Cancellare la partita salvata?', 'La partita in corso non sarà più recuperabile.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Cancella',
        style: 'destructive',
        onPress: () => {
          void clearSavedGame();
          setSavedCleared(true);
        },
      },
    ]);
  };

  const confirmResetProgress = () => {
    Alert.alert(
      'Azzerare i progressi?',
      'Perderai tutte le stelle, i livelli sbloccati e gli ambienti sbloccati.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Azzera', style: 'destructive', onPress: resetProgress },
      ],
    );
  };

  return (
    <Screen title="Opzioni" onBack={() => router.back()}>
      <SectionLabel>Ambiente</SectionLabel>
      <Card>
        <Text style={styles.rowDescription}>
          Tutti e {LOCATIONS.length} disponibili. Stelle raccolte: {earned} su {MAX_STARS}.
        </Text>
        {LOCATIONS.map((location) => {
          const unlocked = isLocationUnlocked(location, earned);
          const selected = location.id === locationId && unlocked;
          return (
            <Pressable
              key={location.id}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: !unlocked }}
              disabled={!unlocked}
              onPress={() => setLocation(location.id)}
              style={({ pressed }) => [
                styles.locationRow,
                selected && styles.locationRowSelected,
                !unlocked && styles.locationRowLocked,
                pressed && styles.pressed,
              ]}>
              <View style={styles.locationText}>
                <Text style={[styles.rowLabel, selected && styles.locationLabelSelected]}>
                  {unlocked ? location.label : `🔒 ${location.label}`}
                </Text>
                <Text style={styles.rowDescription}>
                  {unlocked
                    ? location.description
                    : `Servono ${location.unlockStars} stelle per sbloccarlo`}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </Card>

      <SectionLabel>Panno</SectionLabel>
      <Card>
        <Text style={styles.rowDescription}>
          Il panno non è solo un colore: cambia attrito, scorrimento e resa delle sponde.
        </Text>
        <View style={styles.swatchRow}>
          {CLOTH_OPTIONS.map((option) => {
            const selected = option.id === clothId;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                onPress={() => setCloth(option.id)}
                style={({ pressed }) => [styles.swatchWrap, pressed && styles.pressed]}>
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: option.cloth },
                    selected && styles.swatchSelected,
                  ]}
                />
                <Text style={[styles.swatchLabel, selected && styles.swatchLabelSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.clothFeel}>{clothById(clothId).feel}</Text>
      </Card>

      <SectionLabel>Aiuti di mira</SectionLabel>
      <Card>
        <ToggleRow
          label="Linea di mira"
          description="Mostra dove arriva la bianca prima di toccare qualcosa."
          value={showAimGuide}
          onChange={setShowAimGuide}
        />
        <ToggleRow
          label="Pallina fantasma"
          description="Aggiunge il punto d'impatto e la direzione della pallina colpita."
          value={showGhostBall}
          onChange={setShowGhostBall}
        />
        <View>
          <Text style={styles.rowLabel}>Sensibilità della mira</Text>
          <Text style={styles.rowDescription}>
            Quanto ruota il tiro per ogni trascinamento. In vista mira il trascinamento verticale
            alza e abbassa l’occhio, e la pizzicata lo avvicina alla bianca.
          </Text>
          <View style={styles.pillRow}>
            {SENSITIVITY_STEPS.map((step) => {
              const selected = step.value === activeStep.value;
              return (
                <Pressable
                  key={step.label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setAimSensitivity(step.value)}
                  style={({ pressed }) => [
                    styles.pill,
                    selected && styles.pillSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]}>
                    {step.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      <SectionLabel>Dati</SectionLabel>
      <Card>
        <GameButton label="Ripristina le opzioni" onPress={resetSettings} />
        <GameButton
          label="Cancella la partita salvata"
          variant="danger"
          sublabel={savedCleared ? 'Cancellata' : undefined}
          onPress={confirmClearSave}
        />
        <GameButton label="Azzera i progressi puzzle" variant="danger" onPress={confirmResetProgress} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  swatchRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  swatchWrap: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.two,
  },
  swatch: {
    width: '100%',
    height: 54,
    borderRadius: Radius.small,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: Palette.accent,
  },
  swatchLabel: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
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
  locationRow: {
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surfaceRaised,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  locationRowSelected: {
    borderColor: Palette.accent,
    backgroundColor: 'rgba(61, 220, 132, 0.14)',
  },
  locationRowLocked: {
    opacity: 0.45,
  },
  locationText: {
    gap: 2,
  },
  locationLabelSelected: {
    color: Palette.accent,
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
  rowLabel: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rowDescription: {
    color: Palette.textMuted,
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
    borderRadius: Radius.small,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: 'rgba(61, 220, 132, 0.18)',
    borderColor: Palette.accent,
  },
  pillLabel: {
    color: Palette.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  pillLabelSelected: {
    color: Palette.accent,
  },
  pressed: {
    opacity: 0.7,
  },
});
