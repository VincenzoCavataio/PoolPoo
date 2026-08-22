/**
 * Menu furniture: quiet, expensive-looking, and almost entirely made of thin
 * lines.
 *
 * This replaced a chunky arcade treatment that read as a cheap console game. The
 * language here is the opposite of that one: hairline borders instead of thick
 * bevels, flat surfaces instead of hard offset shadows, a serif for headings, one
 * restrained gold, and a great deal of empty space. Nothing shouts.
 *
 * "Neon" is deliberately faint — a luminous line and a soft halo, built by
 * stacking a few views at falling opacity, because a real blur is not available
 * and a hard glow would undo the restraint the rest of the design depends on.
 */

import { type ReactNode, useEffect } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Luxe } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';

/** A serif for headings is most of what separates this from a settings screen. */
export const LuxeFonts = Platform.select({
  ios: { serif: 'ui-serif', sans: 'system-ui' },
  default: { serif: 'serif', sans: undefined as string | undefined },
}) ?? { serif: 'serif', sans: undefined };

/**
 * A hairline that appears to be lit.
 *
 * Three lines: a bright one a pixel high, then wider ones at a fraction of the
 * opacity. Read together they suggest light bleeding off the edge, which is as
 * close to a glow as is available without a blur.
 */
export function GlowRule({
  color = Luxe.glow,
  width = 72,
  align = 'center',
}: {
  color?: string;
  width?: number | `${number}%`;
  align?: 'center' | 'flex-start';
}) {
  return (
    <View style={[styles.glowWrap, { alignItems: align }]} pointerEvents="none">
      <View style={[styles.glowHalo, { width, backgroundColor: color, opacity: 0.07 }]} />
      <View style={[styles.glowMid, { width, backgroundColor: color, opacity: 0.2 }]} />
      <View style={[styles.glowCore, { width, backgroundColor: color }]} />
    </View>
  );
}

/** A faint coloured bloom placed behind something, for a touch of light. */
export function SoftHalo({
  color = Luxe.glow,
  size = 220,
  style,
}: {
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.haloWrap, style]} pointerEvents="none">
      {[1, 0.72, 0.46].map((scale, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            width: size * scale,
            height: size * scale,
            borderRadius: (size * scale) / 2,
            backgroundColor: color,
            opacity: 0.03 + index * 0.02,
          }}
        />
      ))}
    </View>
  );
}

/** Small, wide-tracked, upper-case label. Used for every secondary line. */
/**
 * Small spaced capitals, for labels above a heading.
 *
 * Defaults to `textMuted` rather than `textFaint`. The faint tone was legible on
 * flat ink but only reaches 2.6:1 against the lit part of the felt behind the
 * menus — under the 3:1 that small text needs — where muted holds 5.2:1.
 */
export function Overline({ children, color = Luxe.textMuted }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.overline, { color }]}>{children}</Text>;
}

export function Heading({
  children,
  size = 30,
  color = Luxe.text,
  style,
}: {
  children: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <Text
        style={[
          styles.heading,
          { fontSize: size, color, lineHeight: size * 1.15, fontFamily: LuxeFonts.serif },
        ]}>
        {children}
      </Text>
    </View>
  );
}

/** Breathes rather than blinks: a slow fade, nothing insistent. */
export function Breathe({ children, period = 2200 }: { children: ReactNode; period?: number }) {
  const value = useSharedValue(0.55);

  useEffect(() => {
    value.value = withRepeat(
      withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [period, value]);

  const style = useAnimatedStyle(() => ({ opacity: value.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * The eight ball, drawn rather than rendered.
 *
 * Three flat layers — the sphere, a highlight up and to the left, and the white
 * disc with the numeral — read as a lit ball at this size, and cost nothing next
 * to standing up a GL context for one object on a screen that lasts a few
 * seconds.
 *
 * It lives here because three places now show it: the native splash (rasterised
 * from the same proportions by `scripts/build-splash-icon.py`), the title
 * screen, and the pause before the table. One object carried through all of them
 * is what makes those three screens read as one sequence rather than as three
 * arrivals — so it must not be three slightly different balls.
 *
 * `float` is for a screen that holds: it rises and settles, which makes it an
 * object rather than a logo. Somewhere the ball only passes through, leave it
 * off and let the screen's own motion carry it.
 */
export function EightBall({ size = 104, float = false }: { size?: number; float?: boolean }) {
  const lift = useSharedValue(0);

  useEffect(() => {
    if (!float) return;
    lift.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [float, lift]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: float ? -4 + lift.value * 8 : 0 }],
  }));

  return (
    <Animated.View style={style}>
      <View
        style={[
          ballStyles.ball,
          { width: size, height: size, borderRadius: size / 2 },
        ]}>
        {/* The lit side. Offset up and left, matching where the room's lamps are. */}
        <View
          style={[
            ballStyles.sheen,
            {
              top: -size * 0.3,
              left: -size * 0.24,
              width: size * 0.9,
              height: size * 0.9,
              borderRadius: size * 0.45,
            },
          ]}
        />
        <View
          style={[
            ballStyles.badge,
            { width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21 },
          ]}>
          <Text style={[ballStyles.numeral, { fontSize: size * 0.26 }]}>8</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const ballStyles = StyleSheet.create({
  ball: {
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    // A rim of light, which is what separates a dark ball from a dark room.
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  badge: {
    backgroundColor: '#f4f1e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeral: {
    color: '#141414',
    fontWeight: '700',
    fontFamily: LuxeFonts.sans,
  },
});

export type LuxeVariant = 'primary' | 'secondary' | 'danger';

/**
 * A plate with a lit edge.
 *
 * A dark panel, a bar of light down the leading side, and the label in spaced
 * capitals. The primary action gets a gold edge, a gold label and a point more
 * size — that is the whole hierarchy, and it is enough.
 */
export function LuxeButton({
  label,
  onPress,
  sublabel,
  variant = 'secondary',
  disabled = false,
  badge,
  style,
}: {
  label: string;
  onPress: () => void;
  sublabel?: string;
  variant?: LuxeVariant;
  disabled?: boolean;
  badge?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary && styles.buttonPrimary,
        isDanger && styles.buttonDanger,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        style,
      ]}>
      {/*
        A lit edge down the leading side, instead of a chevron down the trailing
        one.

        The chevron was the tell: a row with a `›` at the end is what a settings
        list looks like, and three of them stacked read as a form no matter what
        colour they are. A bar of light at the start reads as a thing that is
        switched on — and the primary action gets a brighter one, so the eye lands
        on it before reading a word.
      */}
      <View
        style={[
          styles.buttonEdge,
          isPrimary && styles.buttonEdgePrimary,
          isDanger && styles.buttonEdgeDanger,
        ]}
      />

      <View style={styles.buttonText}>
        <Text
          style={[
            styles.buttonLabel,
            isPrimary && styles.buttonLabelPrimary,
            isDanger && { color: Luxe.danger },
          ]}
          numberOfLines={1}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={styles.buttonSublabel} numberOfLines={2}>
            {sublabel}
          </Text>
        ) : null}
      </View>

      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glowWrap: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  glowHalo: {
    position: 'absolute',
    height: 5,
    borderRadius: 3,
  },
  glowMid: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
  },
  glowCore: {
    height: 1,
  },
  haloWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overline: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 3.4,
    textTransform: 'uppercase',
  },
  heading: {
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 72,
    paddingRight: Spacing.three,
    paddingVertical: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    // Darker and more opaque than before: it now has to hold its own over the
    // felt behind it, where the old near-transparent surface would have let the
    // backdrop show straight through the label.
    backgroundColor: '#0d1210',
    borderRadius: 4,
    overflow: 'hidden',
  },
  buttonPrimary: {
    borderColor: 'rgba(201, 169, 98, 0.45)',
    backgroundColor: '#1d1810',
  },
  buttonDanger: {
    borderColor: 'rgba(217, 117, 107, 0.35)',
    backgroundColor: '#0d1210',
  },
  buttonPressed: {
    backgroundColor: '#252b28',
  },
  buttonDisabled: {
    opacity: 0.32,
  },
  /** The lit leading edge. Full height, so it reads as part of the panel. */
  buttonEdge: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: Luxe.hairlineStrong,
  },
  buttonEdgePrimary: {
    backgroundColor: Luxe.gold,
  },
  buttonEdgeDanger: {
    backgroundColor: Luxe.danger,
  },
  buttonText: {
    flex: 1,
    gap: 4,
    paddingLeft: Spacing.one,
  },
  buttonLabel: {
    color: Luxe.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  buttonLabelPrimary: {
    color: Luxe.gold,
    fontSize: 17,
  },
  buttonSublabel: {
    color: Luxe.textMuted,
    fontSize: 12,
    letterSpacing: 0.3,
    lineHeight: 17,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201, 169, 98, 0.5)',
  },
  badgeLabel: {
    color: Luxe.gold,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.8,
  },
});
