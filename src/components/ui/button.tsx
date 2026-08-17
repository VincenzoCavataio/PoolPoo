/**
 * The one button the whole app uses.
 *
 * An adapter onto `LuxeButton`, which is how the entire set of menus changed
 * look in a single edit rather than screen by screen. The four-variant API is
 * kept so nothing calling it had to be touched.
 */

import { type StyleProp, type ViewStyle } from 'react-native';

import { LuxeButton, type LuxeVariant } from '@/components/ui/luxe';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const MAPPED: Record<ButtonVariant, LuxeVariant> = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'secondary',
  danger: 'danger',
};

interface GameButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  sublabel?: string;
  disabled?: boolean;
  badge?: string;
  style?: StyleProp<ViewStyle>;
}

export function GameButton({
  label,
  onPress,
  variant = 'secondary',
  sublabel,
  disabled = false,
  badge,
  style,
}: GameButtonProps) {
  return (
    <LuxeButton
      label={label}
      onPress={onPress}
      sublabel={sublabel}
      variant={MAPPED[variant]}
      disabled={disabled}
      badge={badge}
      style={style}
    />
  );
}
