/**
 * The light switch on the wall.
 *
 * The industrial kind: a cream plate, a screw at each end, and a rocker standing
 * out of it with **O** stamped on the top half and **I** on the bottom. Pressing
 * one end sinks it and lifts the other, and which end is down is what tells you
 * the state — the same way the switch on the side of any piece of equipment of
 * that era did.
 *
 * The relief is built from three fixed pieces rather than a rotation:
 *
 *  - a **rim** around the rocker, lit on the top-left and shadowed on the
 *    bottom-right, which is the block's own thickness;
 *  - two **halves** that swap brightness, the pressed one going into shade;
 *  - a **shadow** under whichever half is standing out.
 *
 * Nothing turns, which matters: an earlier version rotated the moulding to fake
 * the pivot and rotated it about its middle instead of its base, so the block
 * leaned and sat visibly askew in the plate. Everything here stays square.
 *
 * Drawn with plain views rather than in the GL scene. The backdrop's canvas is
 * *behind* the menu and a control has to be in front of it to be pressed, so
 * putting the switch in the scene would mean projecting its position out to the
 * touch layer every frame — the machinery the cue ball needs in play, for a
 * thing that never moves.
 *
 * Pressing it is not a request: the room goes dark on the down stroke, and the
 * tube does its whole starting performance on the way back up. The lamp owns
 * that timing; this only says which way the switch is facing.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { playTap } from '@/game/audio/sfx';
import { useT } from '@/i18n/use-t';
import { useRoomLight } from '@/store/room-light';

const PLATE_WIDTH = 44;
const PLATE_HEIGHT = 66;

export function LightSwitch() {
  const t = useT();
  const on = useRoomLight((state) => state.on);
  const toggle = useRoomLight((state) => state.toggle);

  /**
   * Which half is pressed in: 0 is O down (off), 1 is I down (on).
   *
   * Fast and eased out — a rocker has a spring behind it, so it leaves under
   * force and arrives against a stop. Slower than about a tenth of a second and
   * it reads as something dragged rather than thrown.
   */
  const position = useDerivedValue(() =>
    withTiming(on ? 1 : 0, { duration: 100, easing: Easing.out(Easing.quad) }),
  );

  /**
   * The two halves, lit against each other.
   *
   * The pressed half is the one that has gone *into* the plate, so it loses the
   * light and its label dims with it; the raised half catches the light coming
   * from above. They are the same colour underneath — this is one moulding, and
   * cross-fading two different colours would have gone grey through the middle
   * of the throw.
   */
  const topFace = useAnimatedStyle(() => ({ opacity: 0.34 + position.value * 0.66 }));
  const bottomFace = useAnimatedStyle(() => ({ opacity: 1 - position.value * 0.66 }));

  /**
   * The labels dim with the half they are stamped on.
   *
   * The raised half faces the room and its mark stays legible; the pressed half
   * has turned into the plate and its mark goes with it. That is also what makes
   * the state readable at a glance without reading either letter: the one you
   * can see is the one that is *not* selected, exactly as on the real fitting.
   */
  const topLabel = useAnimatedStyle(() => ({ opacity: 0.45 + position.value * 0.45 }));
  const bottomLabel = useAnimatedStyle(() => ({ opacity: 0.9 - position.value * 0.45 }));

  /**
   * The shadow that falls into whichever half has been pressed in.
   *
   * On (`position` 1) presses the **I**, the lower half, so the shadow belongs
   * at the bottom; off presses the **O** and it moves to the top. Wiring these
   * the other way round — shadowing the half that is standing out — reads as a
   * switch pressed at the end nobody touched.
   */
  const topShadow = useAnimatedStyle(() => ({ opacity: (1 - position.value) * 0.5 }));
  const bottomShadow = useAnimatedStyle(() => ({ opacity: position.value * 0.5 }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={t('menu.lightSwitch')}
      onPress={() => {
        // The same click the tube's starter makes, because it is the same act.
        playTap('select');
        toggle();
      }}
      hitSlop={12}
      style={({ pressed }) => [styles.plate, pressed && styles.platePressed]}>
      <View style={[styles.screw, styles.screwTop]}>
        <View style={styles.screwSlot} />
      </View>
      <View style={[styles.screw, styles.screwBottom]}>
        <View style={styles.screwSlot} />
      </View>

      {/* The rim is the block's thickness: lit above, shadowed below. */}
      <View style={styles.rim}>
        <View style={styles.rocker}>
          <Animated.View style={[styles.half, topFace]}>
            <Animated.Text style={[styles.label, topLabel]}>O</Animated.Text>
          </Animated.View>

          {/* The seam where the two halves meet. */}
          <View style={styles.seam} />

          <Animated.View style={[styles.half, bottomFace]}>
            <Animated.Text style={[styles.label, bottomLabel]}>I</Animated.Text>
          </Animated.View>

          {/* Shadows over the sunk half, at whichever end that is. */}
          <Animated.View
            style={[styles.shadow, styles.shadowTop, topShadow]}
            pointerEvents="none"
          />
          <Animated.View
            style={[styles.shadow, styles.shadowBottom, bottomShadow]}
            pointerEvents="none"
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * The faceplate: cream plastic, yellowed, lit from above.
   *
   * Bright border on top, dark on the bottom — a surface lit from above catches
   * light on its upper edge and drops its lower edge into shadow, and the eye
   * reads that as standing off the wall behind it.
   */
  plate: {
    width: PLATE_WIDTH,
    height: PLATE_HEIGHT,
    borderRadius: 4,
    paddingVertical: 11,
    paddingHorizontal: 6,
    backgroundColor: '#cdc5b2',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.6)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.45)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.22)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 0, 0, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  platePressed: {
    backgroundColor: '#bbb3a1',
  },
  screw: {
    position: 'absolute',
    left: PLATE_WIDTH / 2 - 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#b1a997',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.32)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screwTop: {
    top: 2.5,
  },
  screwBottom: {
    bottom: 2.5,
  },
  screwSlot: {
    width: 4,
    height: 1,
    borderRadius: 0.5,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    transform: [{ rotate: '28deg' }],
  },
  /**
   * The rim: the visible thickness of the block standing out of the plate.
   *
   * Equal widths all round so the rocker stays centred — only the colours
   * differ, light where the room's light falls on it and dark where it does not.
   * That is what gives it height without moving it off centre.
   */
  rim: {
    flex: 1,
    width: '100%',
    borderRadius: 3,
    borderWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.55)',
    borderLeftColor: 'rgba(255, 255, 255, 0.35)',
    borderRightColor: 'rgba(0, 0, 0, 0.3)',
    borderBottomColor: 'rgba(0, 0, 0, 0.4)',
    backgroundColor: '#2b2822',
    overflow: 'hidden',
  },
  /** The rocker's face, filling the rim. */
  rocker: {
    flex: 1,
    backgroundColor: '#e2dbca',
  },
  half: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ece5d4',
  },
  /** The line where the two halves of the moulding meet. */
  seam: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  /**
   * The stamped marks.
   *
   * Small, and the same weight as each other — these are moulded into the
   * plastic rather than printed, so they read as marks in a surface rather than
   * as type on it.
   */
  label: {
    color: '#3a362c',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  /** A wash over whichever half has been pressed in. */
  shadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#000',
  },
  shadowTop: {
    top: 0,
  },
  shadowBottom: {
    bottom: 0,
  },
});
