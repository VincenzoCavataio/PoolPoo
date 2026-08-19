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
import { ScrollView, StyleSheet, View } from 'react-native';
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

/**
 * The title bar every screen wears.
 *
 * The title is centred, and that takes a little arranging: the back chevron sits
 * on the left, so text simply placed beside it lands off to one side of the
 * panel. The fix is to balance it — an empty box the same width as the chevron
 * on the right, with the title taking the space between. The title is then
 * centred on the *panel*, not on the leftovers, and it stays centred whether or
 * not there is a chevron at all.
 *
 * Shared, so the three screens that carry a heading cannot drift apart. They had
 * each grown their own copy, and the panel behind them arrived at different
 * times in different files.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? <BackButton label="Indietro" onPress={onBack} /> : null}
      </View>

      <View style={styles.headerText}>
        <Heading size={22}>{title}</Heading>
        {subtitle ? <Overline>{subtitle}</Overline> : null}
      </View>

      {/* The counterweight: empty, and exactly as wide as the chevron. */}
      <View style={styles.headerSide} />
    </View>
  );
}

export function Screen({ title, subtitle, onBack, children, footer }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.inner, { paddingTop: insets.top + Spacing.four }]}>
        {/* Same header as every other screen: a drawn chevron and a serif
            title, with no rule under it. The rule was there to separate the
            title from a list; there is no list any more. */}
        <ScreenHeader title={title} subtitle={subtitle} onBack={onBack} />

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
  /**
   * The title bar, on a surface of its own.
   *
   * It used to be a heading and a chevron laid straight onto the room behind —
   * which is the one thing every panel on these screens had already been fixed
   * *not* to do. The scene drifts, so a rail passing under a serif title changes
   * the contrast under it while it is being read, and the app ended up with its
   * content on solid ground and its titles floating over moving scenery.
   *
   * Same treatment as the panels below it: a dark ground, a hairline, rounded
   * corners. The table is still seen — in the gaps between panels, which is
   * where it was always meant to show through.
   */
  header: {
    flexDirection: 'row',
    // Centred, not bottom-aligned: the three columns are a chevron, a title and
    // a counterweight, and they sit on one line rather than on a baseline.
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    backgroundColor: '#0d1210',
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  /**
   * The two ends of the bar, kept the same width.
   *
   * The chevron lives in the left one and the right one stays empty. Equal
   * widths are what let the middle be the true middle: without the counterweight
   * the title centres in the space the chevron leaves, which sits it visibly off
   * to the right of the panel.
   */
  headerSide: {
    width: 40,
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
