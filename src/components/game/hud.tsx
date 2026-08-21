/**
 * Heads-up display.
 *
 * Kept to a single slim row. The canvas fills the screen so the scene has no
 * seams, which means every point the HUD occupies is a point of table hidden
 * behind it — and the camera compensates by framing the table into the band
 * left free, so a taller HUD literally pushes the table smaller.
 */

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Animated, { FadeInDown } from 'react-native-reanimated';

import { LuxeFonts } from '@/components/ui/luxe';
import { ballSetById, colorForBallIn } from '@/constants/ball-sets';
import { Luxe, Palette, Radius } from '@/constants/game-theme';
import { BallKind, ballKindFor } from '@/game/core/ball';
import { Spacing } from '@/constants/theme';
import type { PocketId } from '@/game/core/table';
import { currentCall, winningSeats } from '@/game/rules/match';
import { GameModeKind, Phase } from '@/game/rules/types';
import type { MessageKey } from '@/i18n';
import { useMessageRenderer, useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

/**
 * How long the foul panel stays up.
 *
 * Long enough to read a short sentence twice over, and no longer: it is a
 * notice, not a state, and the table underneath it is what the player wants
 * back.
 */
const FOUL_NOTICE_MS = 2600;

/** The white a striped ball is under its band. Matches the shader's. */
const STRIPE_GROUND = '#f2efe6';

/** How each pocket is named in the ticker. Shared with the call picker's labels. */
const POCKET_LABELS: Record<PocketId, MessageKey> = {
  'corner-nw': 'call.pocketCornerNw',
  'corner-ne': 'call.pocketCornerNe',
  'corner-sw': 'call.pocketCornerSw',
  'corner-se': 'call.pocketCornerSe',
  'side-n': 'call.pocketSideN',
  'side-s': 'call.pocketSideS',
};

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
/**
 * The balls a seat has taken, as small coloured discs.
 *
 * No numbers on them. At this size a numeral is a smudge, and the number is not
 * what is being asked anyway — what a player wants from a glance at the
 * scoreboard is *which* are gone, and colour plus solid-or-striped answers that
 * without anything to read.
 *
 * Striped balls are drawn the way the table draws them: a pale disc with a band
 * of colour across the middle, from the same ball set, so a ball here and the
 * same ball on the cloth are recognisably one object.
 */
function PottedBalls({ balls }: { balls: number[] }) {
  const ballSetId = useSettings((s) => s.ballSetId);
  const set = ballSetById(ballSetId);

  if (balls.length === 0) return null;

  return (
    <View style={styles.potted}>
      {balls.map((number) => {
        const colour = colorForBallIn(set, number);
        // A set without stripes draws every object ball solid, exactly as the
        // table does — asked of `ballKindFor` rather than re-derived here.
        const striped = set.striped && ballKindFor(number) === BallKind.STRIPE;

        return (
          <View
            key={number}
            style={[styles.pottedBall, { backgroundColor: striped ? STRIPE_GROUND : colour }]}>
            {striped ? (
              <View style={[styles.pottedBand, { backgroundColor: colour }]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

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

      {/* What this seat has taken off the table. */}
      {current?.potted?.length ? <PottedBalls balls={current.potted} /> : null}

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
            <View key={row.id} style={styles.otherRowLine}>
              <Text style={styles.otherPlayer} numberOfLines={1}>
                {row.name} <Text style={styles.otherScore}>{badge(row)}</Text>
              </Text>
              {row.potted?.length ? <PottedBalls balls={row.potted} /> : null}
            </View>
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
  const t = useT();
  const render = useMessageRenderer();
  const messages = useSession((s) => s.messages);
  const phase = useSession((s) => s.phase);
  const lastOutcome = useSession((s) => s.lastOutcome);

  const note = phase === Phase.AIMING ? messages[messages.length - 1] : undefined;
  const isFoul = lastOutcome?.foul === true;

  /**
   * The foul panel takes itself down after a few seconds.
   *
   * It used to sit there until the next shot was played, which is fine for the
   * small turn message in the corner — that is a status line, and a status line
   * should say what the status is. A foul is an *event*: it happened, it is
   * announced, and then it is over. Left up, a large card in the middle of the
   * table becomes something you have to shoot around.
   *
   * Keyed on the outcome object rather than on a flag, so two fouls in a row
   * each get their own countdown; without that the second would inherit
   * whatever was left of the first.
   */
  const [foulShown, setFoulShown] = useState(true);

  useEffect(() => {
    if (!isFoul) return;
    setFoulShown(true);
    const timer = setTimeout(() => setFoulShown(false), FOUL_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [isFoul, lastOutcome]);

  if (!note) return null;

  /*
   * A foul is not a note.
   *
   * Both used to arrive as the same small strip in the bottom corner — the right
   * weight for "your turn", and far too little for "you have just given away a
   * point". The two are different kinds of statement and now look it: a turn
   * message stays where it was, and a foul is centred over the table with the
   * word itself above the reason.
   *
   * Still one component, because it is still one channel. What changed is how
   * loudly it speaks, not how many voices there are.
   */
  /*
   * Once the foul notice has had its time, it is finished — not demoted.
   *
   * Falling through to the small corner note would show the same sentence a
   * second time in a quieter style, which is the duplication this whole thing
   * was untangled to remove.
   */
  if (isFoul) {
    if (!foulShown) return null;

    return (
      <View style={styles.foulLayer} pointerEvents="none">
        <Animated.View entering={FadeInDown.duration(220)} style={styles.foulCard}>
          <Text style={styles.foulWord}>{t('celebration.foul')}</Text>
          <Text style={styles.foulLine}>{render(note)}</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.noteLayer} pointerEvents="none">
      <View style={styles.note}>
        <View style={styles.noteAccent} />
        <Text style={styles.noteLabel} numberOfLines={1}>
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
      <Animated.View entering={FadeInDown.duration(340)} style={styles.overlayCard}>
        {/*
          The frame's own heading, in the face the wordmark uses.
        */}
        <Text style={styles.overlayKicker}>{t('result.frameOver')}</Text>
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

        <View style={styles.overlayRule} />

        <View style={styles.resultTable}>
          {ranked.map((row) => {
            const winner = won.includes(row.id);
            return (
              <View key={row.id} style={[styles.resultRow, winner && styles.resultRowWon]}>
                {/*
                  A gold marker on the winning rows rather than a colour change
                  alone: which side won is the one thing this panel exists to
                  say, and it should survive being glanced at.
                */}
                <View style={[styles.resultMark, winner && styles.resultMarkWon]} />
                <Text style={[styles.resultName, winner && styles.resultNameWon]} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={[styles.resultScore, winner && styles.resultScoreWon]}>
                  {row.score === undefined
                    ? t(winner ? 'result.won' : 'result.lost')
                    : t('result.points', { count: row.score })}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Filled gold, like every other control that commits: the way on. */}
        <Pressable
          accessibilityRole="button"
          // The same people, the same rules, a fresh rack.
          onPress={() => startGame(match.kind, table.length, table.map((row) => row.name))}
          style={({ pressed }) => [styles.again, pressed && styles.againPressed]}>
          <Text style={styles.againLabel}>{t('result.newGame')}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={goToMenu}
          style={({ pressed }) => [styles.leave, pressed && styles.pressedQuiet]}>
          <Text style={styles.leaveLabel}>{t('common.menu')}</Text>
        </Pressable>
      </Animated.View>
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
  /** The row of discs. Wraps, because fifteen balls will not fit on one line. */
  potted: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 3,
  },
  /**
   * One ball. Round, small, and clipped.
   *
   * `overflow: hidden` is what keeps a stripe's band inside the circle — the
   * radius only shapes the view's own background, so anything drawn inside it
   * runs straight out past the curve without this.
   */
  pottedBall: {
    width: 12,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pottedBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '27%',
    bottom: '27%',
  },
  otherRowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  /**
   * The foul, over the middle of the table.
   *
   * High enough to clear the controls and low enough to sit on the cloth rather
   * than over the scoreboard, which is where the eye already is after a shot.
   */
  foulLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '32%',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  foulCard: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(217, 117, 107, 0.5)',
    backgroundColor: 'rgba(8, 11, 10, 0.94)',
  },
  /** The word, in the danger tone: read before the sentence under it. */
  foulWord: {
    color: Luxe.danger,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  foulLine: {
    color: Luxe.text,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
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
  noteAccent: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: Palette.accent,
  },
  noteLabel: {
    color: Palette.text,
    fontSize: 12,
  },
  /**
   * The result, in the shell's own language rather than the table's.
   *
   * It was a grey card with the in-game palette on it, which is right for a HUD
   * that has to sit over green baize and wrong for the one panel that is not
   * part of play. This is where a frame is settled, so it wears what the menus
   * wear: near-black ground, a gold edge, the serif face for the name, and gold
   * on the row that won.
   */
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Darker than before: the table underneath was competing with the panel.
    backgroundColor: 'rgba(4, 6, 5, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#080b0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 98, 0.28)',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  overlayKicker: {
    color: Luxe.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  overlayTitle: {
    color: Luxe.text,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: LuxeFonts.serif,
    textAlign: 'center',
  },
  /** A lit rule under the title, the same mark the wordmark carries. */
  overlayRule: {
    alignSelf: 'center',
    width: 52,
    height: 1,
    backgroundColor: Luxe.gold,
    opacity: 0.65,
  },
  overlayDetail: {
    color: Luxe.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  stars: {
    color: Luxe.gold,
    fontSize: 34,
    textAlign: 'center',
    letterSpacing: 4,
  },
  starsEmpty: {
    color: 'rgba(255, 255, 255, 0.14)',
  },
  resultTable: {
    gap: Spacing.one,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  resultRowWon: {
    borderColor: 'rgba(201, 169, 98, 0.45)',
    backgroundColor: 'rgba(201, 169, 98, 0.08)',
  },
  resultMark: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  resultMarkWon: {
    backgroundColor: Luxe.gold,
  },
  resultName: {
    flex: 1,
    color: Luxe.textMuted,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  resultNameWon: {
    color: Luxe.text,
  },
  resultScore: {
    color: Luxe.textMuted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  resultScoreWon: {
    color: Luxe.gold,
    fontWeight: '800',
  },
  again: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 8,
    backgroundColor: Luxe.gold,
    marginTop: Spacing.one,
  },
  againPressed: {
    backgroundColor: '#b8985a',
  },
  againLabel: {
    color: Luxe.ink,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  leave: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  leaveLabel: {
    color: Luxe.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  pressedQuiet: {
    opacity: 0.6,
  },
});
