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
  /**
   * A floor under these screens, rather than the drifting table.
   *
   * The backdrop is mounted at the root and every route is transparent, which is
   * right for the menu — the gap between its panels is the largest view of the
   * table anywhere in the app. It is wrong for a screen you *read*: options and
   * trophies are long lists, and a room sliding about underneath a column of
   * cards left them with nothing to sit on. Scrolling them felt like scrolling
   * over a hole.
   *
   * A veil rather than a wall, and a *lighter* one than the cards it holds.
   *
   * Three things were tried before this landed. Nearly black at 94% was a wall:
   * the room was merely rumoured behind it. Lightening the cards instead
   * separated them and took the depth out of the screen — a card is supposed to
   * be the dark thing. What works is the order everything else in the app uses:
   * a lit ground with dark panels on it.
   *
   * The colour is a neutral grey. A green-tinted veil was tried first, on the
   * theory that it would read as the room washed out rather than as a sheet laid
   * over it; in practice it just looked green, and green is the cloth's colour
   * rather than the room's. The strength is set by the worst case — with the neon lit the table underneath rises a long way,
   * and a ground that stops separating when the light comes on is the same bug
   * measured a different way.
   *
   * Darkened as far as it can go, with the card edges carrying the difference.
   * At this depth a card's own fill is only 1.07:1 against the ground — not
   * enough on its own — so the hairline round it is raised from 10% white to
   * 18%. That figure is set by the *lit* case rather than the dark one: with
   * the neon on, the ground rises and 14% fell to 1.14:1, which is the edge
   * fading out exactly when the room brightens. At 18% it holds either way.
   */
  root: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(4, 5, 5, 0.95)',
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
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
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
    borderColor: 'rgba(255, 255, 255, 0.18)',
    /**
     * Denser than the tiles elsewhere, on purpose.
     *
     * A card holds paragraphs rather than a label and a line, and a moving scene
     * showing through a block of body text is a different proposition from one
     * showing through a heading. Still lighter than it was, so the table is
     * visible at the edges.
     */
    /**
     * Dark, and the ground behind it is what makes it read.
     *
     * The cards were briefly lightened to separate them from the background, and
     * that was the wrong half of the problem: a card is meant to be dark, and
     * lifting it took the depth out of the screen. The separation comes from the
     * veil behind instead — the darker ground, the lighter card, in that order.
     */
    backgroundColor: '#0d1210',
    /**
     * 8, like the panels everywhere else.
     *
     * The radius was 4 here and 8 on every menu row, which is small enough to
     * pass unnoticed one screen at a time and exactly the sort of thing that
     * makes a set of screens feel assembled rather than designed.
     */
    borderRadius: 8,
    padding: Spacing.three,
    /**
     * 16 between the things in a card, not 24.
     *
     * A card holds a list of settings, and at 24 the gaps grew wider than the
     * rows themselves — the options screen came apart into floating fragments
     * rather than reading as grouped.
     */
    gap: Spacing.three,
  },
});
