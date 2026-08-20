/**
 * Heads-up display.
 *
 * Kept to a single slim row. The canvas fills the screen so the scene has no
 * seams, which means every point the HUD occupies is a point of table hidden
 * behind it — and the camera compensates by framing the table into the band
 * left free, so a taller HUD literally pushes the table smaller.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GameButton } from '@/components/ui/button';
import { Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { GameModeKind, Phase } from '@/game/rules/types';
import { currentCall, winningSeats } from '@/game/rules/match';
import type { PocketId } from '@/game/core/table';
import type { MessageKey } from '@/i18n';

/** How each pocket is named in the ticker. Shared with the call picker's labels. */
const POCKET_LABELS: Record<PocketId, MessageKey> = {
  'corner-nw': 'call.pocketCornerNw',
  'corner-ne': 'call.pocketCornerNe',
  'corner-sw': 'call.pocketCornerSw',
  'corner-se': 'call.pocketCornerSe',
  'side-n': 'call.pocketSideN',
  'side-s': 'call.pocketSideS',
};
import { useMessageRenderer, useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';

/**
 * The panel colours the top HUD is built from.
 *
 * Named rather than repeated inline, because the same glass has to appear on the
 * scoreboard, the puzzle box, the note and the camera controls — and the whole
 * point of this pass is that those stop looking like four separate widgets that
 * happen to share a screen. Slightly more opaque than the bottom bar's surface:
 * this sits over the bright end of the table where the lamps are.
 */
export const HUD_SURFACE = 'rgba(10, 17, 14, 0.9)';
export const HUD_SURFACE_ACTIVE = 'rgba(61, 220, 132, 0.16)';

export function Stars({ value, max = 3 }: { value: number; max?: number }) {
  return (
    <Text style={styles.stars}>
      {'★'.repeat(Math.max(0, Math.min(max, value)))}
      <Text style={styles.starsEmpty}>{'☆'.repeat(Math.max(0, max - value))}</Text>
    </Text>
  );
}

function BackButton() {
  const router = useRouter();
  const t = useT();
  const leaveGame = useSession((s) => s.leaveGame);

  return (
    <Pressable
      accessibilityLabel={t('game.backToMenu')}
      onPress={() => {
        leaveGame();
        router.replace('/menu');
      }}
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
      <Text style={styles.backLabel}>‹</Text>
    </Pressable>
  );
}

/**
 * Whose turn it is, and what everyone has scored.
 *
 * A title, not a panel. The screen is a stack of rows now, and this is the top
 * one — so the player's name reads as the heading of what is going on below it,
 * with the other players trailing behind at label size. That ordering is the
 * whole point: at a glance you get the name, and only if you look do you get the
 * table.
 *
 * Scores use tabular figures so a number does not shift sideways as it ticks
 * past nine, the same treatment the power readout gets.
 */
function Scoreboard() {
  const t = useT();
  const table = useSession((s) => s.standings);
  const mode = useSession((s) => s.mode);
  const match = useSession((s) => s.match);
  if (table.length === 0) return null;

  const current = table.find((row) => row.isCurrent);
  const call = match ? currentCall(match) : null;
  const others = table.filter((row) => !row.isCurrent);

  /**
   * What a seat is worth, in a word.
   *
   * Eight-ball has no score at all — it is won, not counted — so the number
   * beside a name there would always be zero and would mean nothing. What
   * matters instead is which half of the table you are on, and that only once
   * somebody has claimed it.
   */
  const badge = (row: (typeof table)[number]): string => {
    if (row.group) return t(row.group === 'solids' ? 'rules.solids' : 'rules.stripes');
    if (row.score === undefined) return t('rules.open');
    return String(row.score);
  };

  return (
    <View style={styles.titleBlock}>
      <View style={styles.titleLine}>
        <Text style={styles.playerName} numberOfLines={1}>
          {current?.name ?? ''}
        </Text>
        <Text style={styles.playerScore}>{current ? badge(current) : ''}</Text>
      </View>

      {/* The run, which is the whole point of 14.1 and meaningless elsewhere. */}
      {mode === GameModeKind.STRAIGHT && current?.run ? (
        <Text style={styles.runLine}>{t('rules.runOf', { count: current.run })}</Text>
      ) : null}

      {/*
        The shot that was called, kept in view until it is played.

        Naming a pocket and then having nowhere to check what you named is the
        obvious way to lose track of it — particularly in straight pool, where a
        call is made on every single visit.
      */}
      {call ? (
        <Text style={styles.callLine}>
          {t('call.declared', { number: call.ball, pocket: t(POCKET_LABELS[call.pocket]) })}
        </Text>
      ) : null}

      {others.length > 0 ? (
        <View style={styles.otherRow}>
          {others.map((row) => (
            <Text key={row.id} style={styles.otherPlayer} numberOfLines={1}>
              {row.name} <Text style={styles.otherScore}>{badge(row)}</Text>
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function GameHud() {
  return (
    <View style={styles.hud} pointerEvents="box-none">
      <View style={styles.topRow} pointerEvents="box-none">
        <BackButton />
        <View style={styles.topContent} pointerEvents="box-none">
          <Scoreboard />
        </View>
      </View>

    </View>
  );
}

/**
 * The last thing that happened, laid over the bottom of the table.
 *
 * Kept out of the title bar and out of the stack. It comes and goes between
 * shots, and a row that appears and disappears would resize the table under the
 * player's hands every time — so it floats inside the board's own frame, where
 * it costs nothing when there is nothing to say.
 */
export function ShotNote() {
  const render = useMessageRenderer();
  const messages = useSession((s) => s.messages);
  const phase = useSession((s) => s.phase);
  const lastOutcome = useSession((s) => s.lastOutcome);

  const note = phase === Phase.AIMING ? messages[messages.length - 1] : undefined;
  if (!note) return null;

  const isFoul = lastOutcome?.foul === true;

  return (
    <View style={styles.noteLayer} pointerEvents="none">
      <View style={[styles.note, isFoul && styles.noteFoul]}>
        {/* A stripe down the leading edge, so a foul is distinguishable from an
            ordinary turn message without reading the words. */}
        <View style={[styles.noteAccent, isFoul && styles.noteAccentFoul]} />
        <Text style={[styles.noteLabel, isFoul && styles.noteLabelFoul]} numberOfLines={1}>
          {render(note)}
        </Text>
      </View>
    </View>
  );
}

/**
 * The result panel.
 *
 * One outcome now that there is one mode: who won, what everyone scored, and the
 * two ways out. It used to branch on whether the game was a puzzle or a frame,
 * carrying stars, shot budgets and a next-level button through the same
 * component — all of which existed only for a mode the game no longer has.
 */
export function GameOverOverlay() {
  const router = useRouter();
  const t = useT();
  const phase = useSession((s) => s.phase);
  const match = useSession((s) => s.match);
  const table = useSession((s) => s.standings);
  const startGame = useSession((s) => s.startGame);
  const leaveGame = useSession((s) => s.leaveGame);

  if (phase !== Phase.GAME_OVER || !match) return null;

  const goToMenu = () => {
    leaveGame();
    router.replace('/menu');
  };

  const won = winningSeats(match);
  /*
   * Ordered by score where there is one, and left in seat order where there is
   * not.
   *
   * Eight-ball is won rather than counted, so sorting its rows by a score that
   * is always zero would shuffle them arbitrarily between games. The winners
   * are marked instead, which is the thing worth showing.
   */
  const ranked =
    table[0]?.score === undefined ? table : [...table].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayCard}>
        <Text style={styles.overlayTitle}>
          {won.length === 1
            ? t('result.winner', { name: table.find((row) => row.id === won[0])?.name ?? '' })
            : won.length > 1
              ? // A winning pair, named together: the frame was won by a side.
                t('result.winners', {
                  names: won
                    .map((id) => table.find((row) => row.id === id)?.name ?? '')
                    .join(' & '),
                })
              : t('result.draw')}
        </Text>

        <View style={styles.resultTable}>
          {ranked.map((row) => (
            <View key={row.id} style={styles.resultRow}>
              <Text style={styles.resultName}>{row.name}</Text>
              <Text style={styles.resultScore}>
                {row.score === undefined
                  ? t(won.includes(row.id) ? 'result.won' : 'result.lost')
                  : t('result.points', { count: row.score })}
              </Text>
            </View>
          ))}
        </View>

        <GameButton
          label={t('result.newGame')}
          variant="primary"
          // The same people, the same rules, a fresh rack.
          onPress={() => startGame(match.kind, table.length, table.map((row) => row.name))}
        />
        <GameButton label={t('common.menu')} variant="ghost" onPress={goToMenu} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Positioned by the game screen's HUD layer, so this is a plain flow container.
  hud: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  topContent: {
    flex: 1,
  },
  /**
   * The way out, as a chevron rather than a button.
   *
   * Nothing floats over the table any more, so this sits in the title bar with
   * the player's name — a panelled square would read as a control that does
   * something to the game, which back does not.
   */
  backButton: {
    width: 28,
    height: 34,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backLabel: {
    color: Palette.textMuted,
    fontSize: 26,
    lineHeight: 28,
    marginTop: -3,
  },
  pressed: {
    opacity: 0.7,
  },
  titleBlock: {
    flex: 1,
    gap: 1,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  playerName: {
    flexShrink: 1,
    color: Palette.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  playerScore: {
    color: Palette.accent,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  /** The players waiting, at label size so they never compete with the heading. */
  otherRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  otherPlayer: {
    color: Palette.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  /** The standing call, under the name. Called modes only. */
  callLine: {
    color: Palette.textMuted,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  /** The current run, under the name. 14.1 only. */
  runLine: {
    color: Palette.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  otherScore: {
    color: Palette.text,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  noteLayer: {
    position: 'absolute',
    left: Spacing.two,
    right: Spacing.two,
    bottom: Spacing.two,
    alignItems: 'flex-start',
  },
  note: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: HUD_SURFACE,
    borderWidth: 1,
    borderColor: Palette.border,
    // Square like the panels above it. The pill shape was the one thing up here
    // that belonged to no other control on screen.
    borderRadius: Radius.small,
    paddingRight: Spacing.three,
    paddingVertical: 5,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  noteFoul: {
    borderColor: 'rgba(255, 107, 94, 0.5)',
  },
  noteAccent: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: Palette.accent,
  },
  noteAccentFoul: {
    backgroundColor: Palette.danger,
  },
  noteLabelFoul: {
    color: Palette.danger,
  },
  noteLabel: {
    color: Palette.text,
    fontSize: 12,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6, 10, 8, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Palette.surface,
    borderRadius: Radius.large,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  overlayTitle: {
    color: Palette.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  overlayDetail: {
    color: Palette.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  stars: {
    color: Palette.gold,
    fontSize: 34,
    textAlign: 'center',
    letterSpacing: 4,
  },
  starsEmpty: {
    color: Palette.border,
  },
  resultTable: {
    gap: Spacing.two,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    backgroundColor: Palette.surfaceRaised,
  },
  resultName: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  resultScore: {
    color: Palette.accent,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
