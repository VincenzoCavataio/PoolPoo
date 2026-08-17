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
export function Overline({ children, color = Luxe.textFaint }: { children: ReactNode; color?: string }) {
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

export type LuxeVariant = 'primary' | 'secondary' | 'danger';

/**
 * A row, not a button-shaped button.
 *
 * Hairline top and bottom, the label on the left, a thin gold chevron on the
 * right. The primary action earns a gold border and the faintest gold wash —
 * that is the whole hierarchy, and it is enough.
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
      <View style={styles.buttonText}>
        <Text
          style={[
            styles.buttonLabel,
            isPrimary && { color: Luxe.gold },
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

      <Text style={[styles.chevron, isPrimary && { color: Luxe.gold }]}>›</Text>
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
    minHeight: 68,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    backgroundColor: Luxe.surface,
  },
  buttonPrimary: {
    borderColor: 'rgba(201, 169, 98, 0.45)',
    backgroundColor: 'rgba(201, 169, 98, 0.06)',
  },
  buttonDanger: {
    borderColor: 'rgba(217, 117, 107, 0.35)',
    backgroundColor: 'transparent',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  buttonDisabled: {
    opacity: 0.32,
  },
  buttonText: {
    flex: 1,
    gap: 4,
  },
  buttonLabel: {
    color: Luxe.text,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 1.6,
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
  chevron: {
    color: Luxe.textFaint,
    fontSize: 22,
    fontWeight: '300',
    marginTop: -2,
  },
});
