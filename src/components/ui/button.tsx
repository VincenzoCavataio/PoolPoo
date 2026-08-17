/**
 * The one button the whole app uses.
 *
 * It is now an adapter onto `ArcadeButton`, which is what gave every menu the
 * cabinet look in one change rather than screen by screen. The old four-variant
 * API is kept so nothing calling it had to be touched.
 */

import { type StyleProp, type ViewStyle } from 'react-native';

import { ArcadeButton, type ArcadeVariant } from '@/components/ui/arcade';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const MAPPED: Record<ButtonVariant, ArcadeVariant> = {
  primary: 'primary',
  secondary: 'secondary',
  // There is no such thing as a ghost button on a cabinet.
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
    <ArcadeButton
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
