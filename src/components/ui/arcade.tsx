/**
 * Menu furniture, built to look like a 1990s cabinet attract screen.
 *
 * Everything here is drawn with plain views and text — no images, no gradients,
 * no blur. That is not only a constraint: hard edges, offset shadows and stacked
 * colour fringes are exactly what the era's screens looked like, because that is
 * all the hardware could do. A neon glow is three copies of the same word nudged
 * apart, and it reads better than a real blur would.
 */

import { type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Arcade } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';

/**
 * CRT scanlines. Cheap, static, and the single strongest signal that this is
 * meant to be a screen from 1994.
 */
export function Scanlines({ rows = 90 }: { rows?: number }) {
  return (
    <View style={styles.scanlines} pointerEvents="none">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.scanline} />
      ))}
    </View>
  );
}

/** Diagonal hazard stripes, the decorative bar of every menu of the period. */
export function StripeBand({ height = 12 }: { height?: number }) {
  return (
    <View style={[styles.band, { height }]} pointerEvents="none">
      {Array.from({ length: 40 }, (_, i) => (
        <View
          key={i}
          style={[
            styles.bandStripe,
            { left: i * 18 - 20, backgroundColor: i % 2 === 0 ? Arcade.magenta : Arcade.violet },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * A word with a colour fringe on each side.
 *
 * Three stacked copies: cyan pushed one way, magenta the other, the real text on
 * top. It is misregistered colour, which is what a cheap CRT did to bright text
 * and what the eye now reads as "neon".
 */
export function NeonText({
  children,
  size = 40,
  color = Arcade.text,
  spacing = 4,
  style,
}: {
  children: string;
  size?: number;
  color?: string;
  spacing?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const base = {
    fontSize: size,
    fontWeight: '900' as const,
    letterSpacing: spacing,
  };

  return (
    <View style={[styles.neonWrap, style]}>
      <Text style={[base, styles.neonGhost, { color: Arcade.cyan, left: -2, top: 1 }]}>
        {children}
      </Text>
      <Text style={[base, styles.neonGhost, { color: Arcade.magenta, left: 2, top: -1 }]}>
        {children}
      </Text>
      <Text style={[base, { color }]}>{children}</Text>
    </View>
  );
}

/** Bracket corners, as though the panel were framed by a targeting reticle. */
export function CornerFrame({ children, color = Arcade.cyan }: { children: ReactNode; color?: string }) {
  return (
    <View style={styles.frame}>
      {(
        [
          ['topLeft', styles.cornerTopLeft],
          ['topRight', styles.cornerTopRight],
          ['bottomLeft', styles.cornerBottomLeft],
          ['bottomRight', styles.cornerBottomRight],
        ] as const
      ).map(([key, corner]) => (
        <View key={key} style={[styles.corner, corner, { borderColor: color }]} pointerEvents="none" />
      ))}
      {children}
    </View>
  );
}

/** Slow blink, for "press start" style prompts. */
export function Blink({ children, period = 1100 }: { children: ReactNode; period?: number }) {
  const value = useSharedValue(1);

  useEffect(() => {
    value.value = withRepeat(withTiming(0.15, { duration: period, easing: Easing.linear }), -1, true);
  }, [period, value]);

  const style = useAnimatedStyle(() => ({ opacity: value.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export type ArcadeVariant = 'primary' | 'secondary' | 'danger';

const VARIANT_COLORS: Record<ArcadeVariant, { face: string; edge: string; label: string }> = {
  primary: { face: Arcade.magenta, edge: '#8c1355', label: '#1a0512' },
  secondary: { face: Arcade.panelRaised, edge: '#0d0620', label: Arcade.text },
  danger: { face: Arcade.panel, edge: '#0d0620', label: '#ff8b7a' },
};

/**
 * A chunky button with a hard offset shadow.
 *
 * The shadow has no blur and the button physically moves onto it when pressed,
 * which is how a 90s interface said "this is a key you are pushing". Modern soft
 * shadows would read as a web page.
 */
export function ArcadeButton({
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
  variant?: ArcadeVariant;
  disabled?: boolean;
  badge?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = VARIANT_COLORS[variant];

  return (
    <View style={[styles.buttonSlot, style]}>
      <View style={[styles.buttonShadow, { backgroundColor: colors.edge }]} pointerEvents="none" />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.face, borderColor: colors.edge },
          variant === 'danger' && { borderColor: '#ff8b7a' },
          pressed && styles.buttonPressed,
          disabled && styles.buttonDisabled,
        ]}>
        <View style={styles.buttonInner}>
          <Text style={[styles.buttonLabel, { color: colors.label }]} numberOfLines={1}>
            {label}
          </Text>
          {sublabel ? (
            <Text
              style={[
                styles.buttonSublabel,
                { color: variant === 'primary' ? '#3d0a25' : Arcade.textMuted },
              ]}
              numberOfLines={2}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  scanlines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  scanline: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  band: {
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  bandStripe: {
    position: 'absolute',
    top: -14,
    bottom: -14,
    width: 8,
    transform: [{ rotate: '24deg' }],
  },
  neonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  neonGhost: {
    position: 'absolute',
  },
  frame: {
    position: 'relative',
    paddingVertical: Spacing.two,
  },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
  },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  buttonSlot: {
    position: 'relative',
  },
  buttonShadow: {
    position: 'absolute',
    left: 5,
    right: -5,
    top: 5,
    bottom: -5,
  },
  button: {
    borderWidth: 3,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 60,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  buttonPressed: {
    transform: [{ translateX: 4 }, { translateY: 4 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonInner: {
    flex: 1,
    gap: 3,
  },
  buttonLabel: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  buttonSublabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  badge: {
    borderWidth: 2,
    borderColor: Arcade.gold,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  badgeLabel: {
    color: Arcade.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
