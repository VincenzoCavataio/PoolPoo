import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface GameButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  sublabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GameButton({
  label,
  onPress,
  variant = 'secondary',
  sublabel,
  disabled = false,
  style,
}: GameButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <View style={styles.labels}>
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.labelPrimary,
            variant === 'danger' && styles.labelDanger,
          ]}>
          {label}
        </Text>
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderColor: Palette.border,
    minHeight: 56,
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: Palette.accent,
    borderColor: Palette.accent,
  },
  secondary: {
    backgroundColor: Palette.surfaceRaised,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: 'transparent',
    borderColor: Palette.danger,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.35,
  },
  labels: {
    gap: 2,
  },
  label: {
    color: Palette.text,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelPrimary: {
    color: Palette.accentText,
  },
  labelDanger: {
    color: Palette.danger,
  },
  sublabel: {
    color: Palette.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
