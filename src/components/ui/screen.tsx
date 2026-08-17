/**
 * The frame every menu sits in.
 *
 * Near-black, a serif heading, one lit hairline, and a lot of nothing. Restyling
 * this single component is what carried the look across all four menus.
 */

import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlowRule, Heading, Overline } from '@/components/ui/luxe';
import { Luxe } from '@/constants/game-theme';
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
    <View style={[styles.root, { paddingTop: insets.top + Spacing.four }]}>
      <View style={styles.inner}>
        <View style={styles.header}>
          {onBack ? (
            <Pressable
              accessibilityLabel="Indietro"
              onPress={onBack}
              style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
              <Text style={styles.backLabel}>‹</Text>
            </Pressable>
          ) : null}

          <View style={styles.headerText}>
            {subtitle ? <Overline>{subtitle}</Overline> : null}
            <Heading size={30} style={styles.title}>
              {title}
            </Heading>
          </View>
        </View>

        <GlowRule width={56} align="flex-start" />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>

        {footer ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.four }]}>{footer}</View>
        ) : (
          <View style={{ height: insets.bottom + Spacing.four }} />
        )}
      </View>
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Overline color={Luxe.gold}>{children}</Overline>
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Luxe.ink,
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
    alignItems: 'flex-end',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.two,
  },
  title: {
    marginBottom: 2,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
  },
  backPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  backLabel: {
    color: Luxe.textMuted,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '300',
    marginTop: -3,
  },
  content: {
    gap: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
  },
  footer: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  section: {
    marginTop: Spacing.three,
    marginBottom: -Spacing.one,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    backgroundColor: Luxe.surface,
    padding: Spacing.four,
    gap: Spacing.four,
  },
});
