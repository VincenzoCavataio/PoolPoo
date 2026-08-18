/**
 * The shooting panel: aim strip, power, shot button.
 *
 * Deliberately squat — it used to be tall enough to sit over the near pockets,
 * which is the one part of the table you most need to see while lining a shot
 * up. Aiming gets its own row because it is the control used most and the one
 * that needs the finest touch.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { SpinControl } from '@/components/game/spin-control';
import { Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { usePowerGesture } from '@/game/input/gestures';
import { CameraMode } from '@/game/render/camera';
import { Phase } from '@/game/rules/types';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';

/** One tap of the fine-aim buttons, in radians — a touch over half a degree. */
const FINE_AIM_STEP = 0.01;
const TICKS = 21;
/** Radians per pixel dragged across the strip. */
const SCRUB_PER_PX = 0.0022;
/** Fraction of the strip at each end that keeps turning while held. */
const EDGE_ZONE = 0.2;
/** Radians per second at the very end of the strip. */
const EDGE_RATE = 1.15;

function powerColor(power: number): string {
  if (power > 0.8) return Palette.danger;
  if (power > 0.5) return Palette.gold;
  return Palette.accent;
}

/**
 * A ruler to push against, with the edges live.
 *
 * Dragging scrubs the aim as far as the finger travels, which runs out of strip
 * exactly when a long rotation is wanted. So the outer fifth at each end keeps
 * turning for as long as the finger stays there, faster the further in it is —
 * the strip behaves like a rocker switch once you reach the end of it.
 */
function AimStrip() {
  const t = useT();
  const [width, setWidth] = useState(0);
  const [edge, setEdge] = useState(0);

  const hold = useRef({ running: false, direction: 0, depth: 0 });
  const frame = useRef<number | null>(null);
  const last = useRef(0);

  const stop = useCallback(() => {
    hold.current.running = false;
    hold.current.direction = 0;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setEdge(0);
  }, []);

  const tick = useCallback(() => {
    const now = Date.now();
    const delta = Math.min(0.05, (now - last.current) / 1000);
    last.current = now;

    const { direction, depth } = hold.current;
    if (direction !== 0 && useSession.getState().phase === Phase.AIMING) {
      useSession.getState().nudgeAim(direction * EDGE_RATE * depth * delta);
    }

    frame.current = hold.current.running ? requestAnimationFrame(tick) : null;
  }, []);

  const track = useCallback(
    (x: number) => {
      if (width <= 0) return;
      const position = Math.min(1, Math.max(0, x / width));

      let direction = 0;
      let depth = 0;
      if (position < EDGE_ZONE) {
        direction = -1;
        depth = (EDGE_ZONE - position) / EDGE_ZONE;
      } else if (position > 1 - EDGE_ZONE) {
        direction = 1;
        depth = (position - (1 - EDGE_ZONE)) / EDGE_ZONE;
      }

      hold.current.direction = direction;
      hold.current.depth = Math.max(0.25, depth);
      setEdge(direction);
    },
    [width],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((event) => {
          last.current = Date.now();
          hold.current.running = true;
          track(event.x);
          if (frame.current === null) frame.current = requestAnimationFrame(tick);
        })
        .onChange((event) => {
          const session = useSession.getState();
          if (session.phase === Phase.AIMING) session.nudgeAim(event.changeX * SCRUB_PER_PX);
          track(event.x);
        })
        .onFinalize(stop),
    [track, tick, stop],
  );

  useEffect(() => stop, [stop]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.strip}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityLabel={t('game.aimStrip')}>
        <View style={[styles.edgeZone, styles.edgeLeft, edge === -1 && styles.edgeActive]} pointerEvents="none" />
        <View style={[styles.edgeZone, styles.edgeRight, edge === 1 && styles.edgeActive]} pointerEvents="none" />

        <View style={styles.ticks} pointerEvents="none">
          {Array.from({ length: TICKS }, (_, i) => (
            <View
              key={i}
              style={[styles.tick, i % 5 === 0 && styles.tickMajor, i === (TICKS - 1) / 2 && styles.tickCentre]}
            />
          ))}
        </View>
        <Text style={styles.stripLabel} pointerEvents="none">
          ◀ {t('game.aim')} ▶
        </Text>
      </View>
    </GestureDetector>
  );
}

export function GameControls() {
  const t = useT();
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
            accessibilityLabel={t('game.aimLeft')}
            onPress={() => nudgeAim(-FINE_AIM_STEP)}
            style={({ pressed }) => [styles.fine, pressed && styles.pressed]}>
            <Text style={styles.fineLabel}>◀</Text>
          </Pressable>

          <AimStrip />

          <Pressable
            accessibilityLabel={t('game.aimRight')}
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
            accessibilityLabel={canShoot ? t('game.shootLabel') : t('game.goAimLabel')}
            onPress={canShoot ? takeShot : () => setCameraMode(CameraMode.CUE)}
            style={({ pressed }) => [
              styles.shoot,
              !canShoot && styles.shootBlocked,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.shootLabel, !canShoot && styles.shootLabelBlocked]}>
              {canShoot ? t('game.shoot') : t('game.goAim')}
            </Text>
          </Pressable>
        </View>

        {!fromCue ? (
          <Text style={styles.hint}>{t('game.shootBlocked')}</Text>
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
  edgeZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: `${EDGE_ZONE * 100}%`,
    backgroundColor: 'transparent',
  },
  edgeLeft: {
    left: 0,
    borderTopLeftRadius: Radius.small,
    borderBottomLeftRadius: Radius.small,
  },
  edgeRight: {
    right: 0,
    borderTopRightRadius: Radius.small,
    borderBottomRightRadius: Radius.small,
  },
  edgeActive: {
    backgroundColor: 'rgba(61, 220, 132, 0.22)',
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
