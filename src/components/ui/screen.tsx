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

import { BackButton } from '@/components/ui/icons';
import { Heading, Overline } from '@/components/ui/luxe';
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
      <View style={[styles.inner, { paddingTop: insets.top + Spacing.four }]}>
        {/* Same header as every other screen: a drawn chevron and a serif
            title, with no rule under it. The rule was there to separate the
            title from a list; there is no list any more. */}
        <View style={styles.header}>
          {onBack ? <BackButton label="Indietro" onPress={onBack} /> : null}

          <View style={styles.headerText}>
            <Heading size={26}>{title}</Heading>
            {subtitle ? <Overline>{subtitle}</Overline> : null}
          </View>
        </View>

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

/**
 * A section heading, optionally with an icon.
 *
 * The icon sits in a lit square rather than loose beside the text: at label size
 * a bare glyph next to spaced capitals reads as a bullet point, whereas a filled
 * tile reads as a marker for the block beneath it.
 */
export function SectionLabel({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <View style={styles.section}>
      {icon ? <View style={styles.sectionIcon}>{icon}</View> : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    marginBottom: -Spacing.one,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201, 169, 98, 0.3)',
    backgroundColor: '#161208',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    /**
     * Denser than the tiles elsewhere, on purpose.
     *
     * A card holds paragraphs rather than a label and a line, and a moving scene
     * showing through a block of body text is a different proposition from one
     * showing through a heading. Still lighter than it was, so the table is
     * visible at the edges.
     */
    backgroundColor: '#0d1210',
    borderRadius: 4,
    padding: Spacing.four,
    gap: Spacing.four,
  },
});
