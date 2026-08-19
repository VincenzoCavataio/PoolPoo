/**
 * The frame every menu sits in.
 *
 * A serif heading and a lit hairline over a wash of baize — the table itself,
 * dimmed right down, with a few balls drifting in the dark. Restyling this one
 * component is what carries the look across every menu.
 *
 * The backdrop is deliberately behind the safe-area padding rather than inside
 * it: it has to run under the notch and past the home indicator, or the illusion
 * stops at a straight edge two thirds of the way up the screen.
 */

import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeltBackdrop } from '@/components/ui/felt';
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
    <View style={styles.root}>
      <FeltBackdrop />

      <View style={[styles.inner, { paddingTop: insets.top + Spacing.four }]}>
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
    borderRadius: 4,
    backgroundColor: 'rgba(8, 12, 10, 0.6)',
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
    // Opaque enough to sit on the felt. The old surface was near-transparent,
    // which was fine over flat ink and would let the backdrop print straight
    // through the text now.
    backgroundColor: 'rgba(8, 12, 10, 0.82)',
    borderRadius: 4,
    padding: Spacing.four,
    gap: Spacing.four,
  },
});
