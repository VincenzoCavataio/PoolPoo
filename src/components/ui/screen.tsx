/**
 * The frame every menu sits in.
 *
 * Dark cabinet ink, a neon heading, a hazard stripe under it and scanlines over
 * the lot. Restyling this one component is what turned all four menus from a
 * settings app into something that looks like a game.
 */

import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NeonText, Scanlines, StripeBand } from '@/components/ui/arcade';
import { Arcade } from '@/constants/game-theme';
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
    <View style={[styles.root, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.inner}>
        <View style={styles.header}>
          {onBack ? (
            <Pressable
              accessibilityLabel="Indietro"
              onPress={onBack}
              style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
              <Text style={styles.backLabel}>◀</Text>
            </Pressable>
          ) : null}
          <View style={styles.headerText}>
            <NeonText size={26} spacing={3} style={styles.title}>
              {title.toUpperCase()}
            </NeonText>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>

        <StripeBand height={10} />

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

      <Scanlines />
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionTick} />
      <Text style={styles.sectionLabel}>{children}</Text>
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardEdge} pointerEvents="none" />
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Arcade.ink,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerText: {
    flex: 1,
  },
  title: {
    alignItems: 'flex-start',
  },
  back: {
    width: 46,
    height: 46,
    backgroundColor: Arcade.panelRaised,
    borderWidth: 3,
    borderColor: Arcade.edge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: {
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  backLabel: {
    color: Arcade.cyan,
    fontSize: 16,
    fontWeight: '900',
  },
  subtitle: {
    color: Arcade.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  content: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    paddingRight: 6,
  },
  footer: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  sectionTick: {
    width: 10,
    height: 10,
    backgroundColor: Arcade.gold,
    transform: [{ rotate: '45deg' }],
  },
  sectionLabel: {
    color: Arcade.gold,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  card: {
    position: 'relative',
  },
  cardEdge: {
    position: 'absolute',
    left: 5,
    right: -5,
    top: 5,
    bottom: -5,
    backgroundColor: '#0d0620',
  },
  cardBody: {
    backgroundColor: Arcade.panel,
    borderWidth: 3,
    borderColor: Arcade.edge,
    padding: Spacing.three,
    gap: Spacing.three,
  },
});
