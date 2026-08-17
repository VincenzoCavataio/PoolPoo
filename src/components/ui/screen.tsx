import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette, Radius } from '@/constants/game-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';

interface ScreenProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
  /** Footer pinned below the scrolling content. */
  footer?: ReactNode;
}

export function Screen({ title, subtitle, onBack, children, footer }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.three }]}>
      <View style={styles.inner}>
        <View style={styles.header}>
          {onBack ? (
            <Pressable
              accessibilityLabel="Indietro"
              onPress={onBack}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
              <Text style={styles.backLabel}>‹</Text>
            </Pressable>
          ) : null}
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>

        {footer ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>{footer}</View>
        ) : (
          <View style={{ height: insets.bottom + Spacing.three }} />
        )}
      </View>
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.background,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  headerText: {
    flex: 1,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLabel: {
    color: Palette.text,
    fontSize: 28,
    lineHeight: 30,
    marginTop: -4,
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    color: Palette.text,
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: Palette.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  footer: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  sectionLabel: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: Spacing.two,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.three,
    gap: Spacing.three,
  },
});
