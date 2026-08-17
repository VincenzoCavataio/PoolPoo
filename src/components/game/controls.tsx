/**
 * The shooting panel: aim strip, power, shot button.
 *
 * Deliberately squat — it used to be tall enough to sit over the near pockets,
 * which is the one part of the table you most need to see while lining a shot
 * up. Aiming gets its own row because it is the control used most and the one
 * that needs the finest touch.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { SpinControl } from '@/components/game/spin-control';
import { Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { useAimScrubGesture, usePowerGesture } from '@/game/input/gestures';
import { CameraMode } from '@/game/render/camera';
import { Phase } from '@/game/rules/types';
import { useSession } from '@/store/session';

/** One tap of the fine-aim buttons, in radians — a touch over half a degree. */
const FINE_AIM_STEP = 0.01;
const TICKS = 21;

function powerColor(power: number): string {
  if (power > 0.8) return Palette.danger;
  if (power > 0.5) return Palette.gold;
  return Palette.accent;
}

/** A ruler to push against, so the drag has something that looks draggable. */
function AimStrip() {
  const scrub = useAimScrubGesture();

  return (
    <GestureDetector gesture={scrub}>
      <View style={styles.strip} accessibilityLabel="Trascina per ruotare la stecca">
        <View style={styles.ticks} pointerEvents="none">
          {Array.from({ length: TICKS }, (_, i) => (
            <View
              key={i}
              style={[styles.tick, i % 5 === 0 && styles.tickMajor, i === (TICKS - 1) / 2 && styles.tickCentre]}
            />
          ))}
        </View>
        <Text style={styles.stripLabel} pointerEvents="none">
          ◀ mira ▶
        </Text>
      </View>
    </GestureDetector>
  );
}

export function GameControls() {
  const power = useSession((s) => s.power);
  const phase = useSession((s) => s.phase);
  const cameraMode = useSession((s) => s.cameraMode);
  const takeShot = useSession((s) => s.takeShot);
  const nudgeAim = useSession((s) => s.nudgeAim);
  const setCameraMode = useSession((s) => s.setCameraMode);

  const [trackWidth, setTrackWidth] = useState(0);
  const powerGesture = usePowerGesture(trackWidth);

  const aiming = phase === Phase.AIMING;
  const fromCue = cameraMode === CameraMode.CUE;
  const canShoot = aiming && fromCue;

  if (!aiming) return null;

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <View style={styles.row}>
          <Pressable
            accessibilityLabel="Ruota la mira a sinistra"
            onPress={() => nudgeAim(-FINE_AIM_STEP)}
            style={({ pressed }) => [styles.fine, pressed && styles.pressed]}>
            <Text style={styles.fineLabel}>◀</Text>
          </Pressable>

          <AimStrip />

          <Pressable
            accessibilityLabel="Ruota la mira a destra"
            onPress={() => nudgeAim(FINE_AIM_STEP)}
            style={({ pressed }) => [styles.fine, pressed && styles.pressed]}>
            <Text style={styles.fineLabel}>▶</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <SpinControl />

          <GestureDetector gesture={powerGesture}>
            <View
              style={styles.track}
              onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
              <View
                style={[
                  styles.trackFill,
                  { width: `${power * 100}%`, backgroundColor: powerColor(power) },
                ]}
              />
              <Text style={styles.trackLabel} pointerEvents="none">
                {Math.round(power * 100)}%
              </Text>
              <View
                style={[styles.thumb, { left: `${power * 100}%`, borderColor: powerColor(power) }]}
              />
            </View>
          </GestureDetector>

          <Pressable
            accessibilityLabel={canShoot ? 'Tira' : 'Torna in vista mira per tirare'}
            onPress={canShoot ? takeShot : () => setCameraMode(CameraMode.CUE)}
            style={({ pressed }) => [
              styles.shoot,
              !canShoot && styles.shootBlocked,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.shootLabel, !canShoot && styles.shootLabelBlocked]}>
              {canShoot ? 'TIRA' : 'MIRA'}
            </Text>
          </Pressable>
        </View>

        {!fromCue ? (
          <Text style={styles.hint}>Dall’alto puoi solo guardare: torna in mira per tirare</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
  },
  panel: {
    backgroundColor: 'rgba(12, 19, 16, 0.9)',
    borderRadius: Radius.large,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  strip: {
    flex: 1,
    height: 44,
    borderRadius: Radius.small,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ticks: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  tick: {
    width: 1,
    height: 8,
    backgroundColor: Palette.border,
  },
  tickMajor: {
    height: 15,
    backgroundColor: Palette.textMuted,
  },
  tickCentre: {
    width: 2,
    height: 26,
    backgroundColor: Palette.accent,
  },
  stripLabel: {
    color: Palette.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  fine: {
    width: 44,
    height: 44,
    borderRadius: Radius.small,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fineLabel: {
    color: Palette.text,
    fontSize: 16,
  },
  track: {
    flex: 1,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    justifyContent: 'center',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: Radius.pill,
    opacity: 0.85,
  },
  trackLabel: {
    color: Palette.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: Radius.pill,
    backgroundColor: Palette.text,
    borderWidth: 3,
  },
  shoot: {
    width: 88,
    height: 48,
    borderRadius: Radius.small,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shootBlocked: {
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.gold,
  },
  shootLabel: {
    color: Palette.accentText,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  shootLabelBlocked: {
    color: Palette.gold,
  },
  pressed: {
    opacity: 0.7,
  },
  hint: {
    color: Palette.gold,
    fontSize: 11,
    textAlign: 'center',
  },
});
