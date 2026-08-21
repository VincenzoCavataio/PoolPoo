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

import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { LuxeFonts } from '@/components/ui/luxe';
import { ballSetById, colorForBallIn } from '@/constants/ball-sets';
import { BackButton } from '@/components/ui/icons';
import { Luxe, Palette, Radius } from '@/constants/game-theme';
import { playTap } from '@/game/audio/sfx';
import { BallKind, ballKindFor } from '@/game/core/ball';
import { Spacing } from '@/constants/theme';
import type { PocketId } from '@/game/core/table';
import { currentCall, winningSeats } from '@/game/rules/match';
import { GameModeKind, Phase, type Standing } from '@/game/rules/types';
import type { MessageKey } from '@/i18n';
import { useMessageRenderer, useT } from '@/i18n/use-t';
import { useBoard } from '@/store/board';
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

/**
 * What to call a seat when the board is closed.
 *
 * Four full names do not fit on one line — measured, they need 422pt of the 254
 * available — and four names truncated to ellipses tell you nothing at all. Past
 * two players the row switches to short tags instead: the first word, cut to
 * three letters, which is enough to tell "Marco" from "Computer 2" when the
 * order round the table is already known.
 *
 * Up to two, the names fit as they are and there is no reason to abbreviate.
 */
function compactName(name: string, seats: number): string {
  if (seats <= 2) return name;

  const first = name.trim().split(/\s+/)[0] ?? name;
  const tail = name.trim().match(/\d+$/)?.[0];
  // "Computer 2" becomes "COM2": the number is the part that distinguishes one
  // machine from another, so it survives the cut.
  return tail ? `${first.slice(0, 3)}${tail}` : first.slice(0, 3);
}

/** Every object ball, in order. The rack has a slot for each. */
const ALL_BALLS = Array.from({ length: 15 }, (_, i) => i + 1);

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

/**
 * Out of the game, using the same button every other screen uses.
 *
 * It used to be a bare chevron character in muted grey — a different size, a
 * different weight and a different shape from the bordered tile the menus carry,
 * for the control that does the same job. A back button that changes appearance
 * depending on where you are is one the eye has to find again each time.
 */
function GameBackButton() {
  const router = useRouter();
  const t = useT();
  const leaveGame = useSession((s) => s.leaveGame);

  return (
    <BackButton
      label={t('game.backToMenu')}
      onPress={() => {
        leaveGame();
        router.replace('/menu');
      }}
    />
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
 * A seat's rack: fifteen slots, filling as the balls go down.
 *
 * Every ball has a place from the start, empty until it is potted. That is the
 * whole point of showing slots rather than a growing row of what has been
 * taken: an empty socket says *this one is still out there*, which is the
 * question a player is actually asking, and the row cannot change width as the
 * frame goes on — so nothing below it ever shifts.
 *
 * No numbers on them. At this size a numeral is a smudge, and the number is not
 * what is being asked: colour plus solid-or-striped answers it without anything
 * to read.
 *
 * Striped balls are drawn the way the table draws them — a pale disc with a band
 * of colour across the middle, from the same ball set — so a ball here and the
 * same ball on the cloth are recognisably one object.
 */
function BallRack({ potted }: { potted: number[] }) {
  const ballSetId = useSettings((s) => s.ballSetId);
  const set = ballSetById(ballSetId);
  const taken = new Set(potted);

  return (
    <View style={styles.rack}>
      {ALL_BALLS.map((number) => {
        if (!taken.has(number)) {
          // An empty socket: the ball is still on the table.
          return <View key={number} style={[styles.slot, styles.slotEmpty]} />;
        }

        const colour = colorForBallIn(set, number);
        // A set without stripes draws every object ball solid, exactly as the
        // table does — asked of `ballKindFor` rather than re-derived here.
        const striped = set.striped && ballKindFor(number) === BallKind.STRIPE;

        return (
          <View
            key={number}
            style={[styles.slot, { backgroundColor: striped ? STRIPE_GROUND : colour }]}>
            {striped ? <View style={[styles.slotBand, { backgroundColor: colour }]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function Scoreboard() {
  const t = useT();
  const table = useSession((s) => s.standings);
  const match = useSession((s) => s.match);
  if (table.length === 0) return null;

  const call = match ? currentCall(match) : null;

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

  /*
   * Which balls to show, and whose.
   *
   * Eight-ball is the only mode where the answer matters to play: the group is
   * the thing you are clearing, and it belongs to the *team* rather than to a
   * seat. In free play and straight pool the discs are a record of what has
   * happened, not information you shoot against — the score already says it —
   * so they are shown for whoever is at the table and nobody else.
   *
   * That is the whole fix for four players. The old board gave every seat its
   * own wrapping row of discs, so a late frame stacked up to eight rows of
   * jewellery over the table. Showing one set instead of four is not a
   * compromise: three of those four were never being read.
   */
  /*
   * Two states, and the compact one is the default.
   *
   * Fifteen slots for every seat is the full picture, and the full picture is
   * not what a player needs on most shots — they need to know whose turn it is
   * and who is ahead, which is one line. So the board sits closed, showing names
   * and standings on a single row, and opens to the racks when it is asked.
   *
   * A tap rather than a permanent setting: which of the two you want changes
   * *within* a frame, not between them. You glance at the standings constantly
   * and check the racks two or three times a game.
   */
  return (
    <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('game.boardExpand')}
        onPress={() => {
          playTap();
          useBoard.getState().show();
        }}
        style={styles.titleBlock}>
        {/*
          Everybody on one line: name and standing, the seat at the table lit.
          Four players cost one row, which is what makes this the state to be in
          while playing.
        */}
        <View style={styles.compactRow}>
          {table.map((row) => (
            <View
              key={row.id}
              style={[styles.compactSeat, row.isCurrent && styles.compactSeatCurrent]}>
              <Text
                style={[styles.compactName, row.isCurrent && styles.compactNameCurrent]}
                numberOfLines={1}>
                {compactName(row.name, table.length)}
              </Text>
              <Text style={[styles.compactValue, row.isCurrent && styles.compactValueCurrent]}>
                {badge(row)}
              </Text>
            </View>
          ))}
        </View>

        {/*
          The shot that was called, kept in view until it is played.

          Naming a pocket and then having nowhere to check what you named is the
          obvious way to lose track of it — particularly in straight pool, where
          a call is made on every single visit.
        */}
        {call ? (
          <Text style={styles.callLine}>
            {t('call.declared', { number: call.ball, pocket: t(POCKET_LABELS[call.pocket]) })}
          </Text>
        ) : null}
    </Pressable>
  );
}

/**
 * The full board, over the table and with the game held still.
 *
 * A panel rather than an expanded header, because it is a *reading* — you have
 * stopped to look something up. Squeezing fifteen slots per player into the
 * corner of the HUD made it both cramped and permanently in the way; here it has
 * the room to be laid out properly and it costs nothing when it is closed.
 *
 * The pause is the reason this is safe to open mid-shot. Without it a panel over
 * a rolling table would let the frame play on behind it, and checking the score
 * could cost you the game.
 */
export function FullBoard() {
  const t = useT();
  const open = useBoard((s) => s.open);
  const close = useBoard((s) => s.hide);
  const table = useSession((s) => s.standings);
  const mode = useSession((s) => s.mode);
  const setPaused = useSession((s) => s.setPaused);

  useEffect(() => {
    if (!open) return;
    setPaused(true);
    // Released on close *and* on unmount, so backing out to the menu with the
    // board open cannot leave the next game frozen.
    return () => setPaused(false);
  }, [open, setPaused]);

  // Left open when the game ends, the panel would sit over the result screen.
  useEffect(() => () => close(), [close]);

  if (!open) return null;

  const onClose = close;
  const badge = (row: Standing): string => {
    if (row.group) return t(row.group === 'solids' ? 'rules.solids' : 'rules.stripes');
    if (row.score === undefined) return t('rules.open');
    return String(row.score);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(140)}
      style={styles.boardOverlay}>
      {/* Anywhere off the panel closes it, which is the gesture people try. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={t('game.boardCollapse')}
        onPress={() => {
          playTap();
          onClose();
        }}
      />

      <Animated.View entering={FadeInDown.duration(220)} style={styles.boardCard}>
        <Text style={styles.boardKicker}>{t('game.boardTitle')}</Text>
        <View style={styles.boardRule} />

        {table.map((row) => (
          <View key={row.id} style={[styles.seat, row.isCurrent && styles.seatCurrent]}>
            <View style={styles.seatLine}>
              <Text
                style={[styles.seatName, row.isCurrent && styles.seatNameCurrent]}
                numberOfLines={1}>
                {row.name}
              </Text>

              {/* The run belongs beside the name, not on a line of its own. */}
              {mode === GameModeKind.STRAIGHT && row.isCurrent && row.run ? (
                <Text style={styles.runLine}>{t('rules.runOf', { count: row.run })}</Text>
              ) : null}

              <Text style={[styles.seatValue, row.isCurrent && styles.seatValueCurrent]}>
                {badge(row)}
              </Text>
            </View>

            <BallRack potted={row.potted ?? []} />
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            playTap();
            onClose();
          }}
          style={({ pressed }) => [styles.boardClose, pressed && styles.pressedQuiet]}>
          <Text style={styles.boardCloseLabel}>{t('common.close')}</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export function GameHud() {
  return (
    <View style={styles.hud} pointerEvents="box-none">
      <View style={styles.topRow} pointerEvents="box-none">
        <GameBackButton />
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
    /*
     * Clear of the table below.
     *
     * The board grew a row of opponent chips, and with nothing under it the
     * bottom one sat hard against the top edge of the stage — close enough that
     * a name and the rail behind it ran together. This is the gap the scoreboard
     * needs to read as a thing above the table rather than on it.
     */
    paddingBottom: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    // Aligned to the top rather than the middle: the board is several lines tall
    // and the back button is one, so centring it left the arrow floating in the
    // middle of the names.
    alignItems: 'flex-start',
    // Wider than the row's usual gap: the arrow is a tile with its own edge, and
    // a name starting right beside it reads as part of the same control.
    gap: Spacing.three,
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
  pressed: {
    opacity: 0.7,
  },
  /**
   * The board, as a panel like every other panel in the app.
   *
   * It used to be bare rows floating on the table — the only surface in the game
   * with no ground under it, which is why it read as dropped there rather than
   * designed. Near-black behind a gold hairline is what the menus wear, and the
   * scoreboard is the one part of the HUD that is a *document* rather than a
   * control, so it is the part that should look like one.
   *
   * No `flex`. It carried `flex: 1`, which was harmless when the board was one
   * line and wrong the moment it became four: this sits inside a row whose
   * children are aligned to the top, so the parent has no height of its own to
   * divide, and a flex child against an undefined basis collapses to its first
   * line — which is why the seats below the first were laid out past the bottom
   * of a box that had already stopped growing.
   */
  titleBlock: {
    alignSelf: 'flex-start',
    gap: 1,
    padding: Spacing.two,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201, 169, 98, 0.28)',
    // A shade translucent, unlike the menus': the table behind is the thing
    // being played, and a solid black slab over it would be a hole in the room.
    backgroundColor: 'rgba(8, 11, 10, 0.82)',
  },
  /**
   * One seat inside the panel.
   *
   * No border of its own any more — the panel supplies the edge, and a frame
   * inside a frame is what made the old board look like four loose things rather
   * than one list. The seat at the table is marked by a lit ground alone, which
   * is quieter and reads faster.
   */
  /**
   * The full board, over everything.
   *
   * `absoluteFill` on the game screen rather than in the header: it is a reading
   * you have stopped to take, so it gets the room to be laid out properly
   * instead of being crammed into a corner that is in the way the rest of the
   * time.
   */
  boardOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(4, 6, 5, 0.88)',
    zIndex: 20,
  },
  /** The app's own panel: near-black behind a gold hairline. */
  boardCard: {
    width: '100%',
    maxWidth: 340,
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 98, 0.28)',
    backgroundColor: '#080b0a',
  },
  boardKicker: {
    color: Luxe.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  /** The lit rule the menus carry under a heading. */
  boardRule: {
    alignSelf: 'center',
    width: 44,
    height: 1,
    marginBottom: Spacing.one,
    backgroundColor: Luxe.gold,
    opacity: 0.65,
  },
  boardClose: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    marginTop: Spacing.one,
  },
  boardCloseLabel: {
    color: Luxe.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  /**
   * Closed: every seat on one line.
   *
   * `nowrap` with shrinking names, so four players never become two rows — the
   * whole point of the compact state is that its height does not depend on how
   * many are playing.
   */
  compactRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 4,
  },
  /**
   * One seat on the closed row.
   *
   * Tight padding, and deliberately: four of these plus their gaps come to 253
   * of the 254 points available with the longest tags, which is no margin at
   * all. Four points each side instead of six leaves room for a phone narrower
   * than the one this was measured on.
   */
  compactSeat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 5,
  },
  compactSeatCurrent: {
    backgroundColor: 'rgba(201, 169, 98, 0.12)',
  },
  compactName: {
    flexShrink: 1,
    color: Luxe.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  compactNameCurrent: {
    color: Luxe.text,
  },
  compactValue: {
    color: Luxe.textMuted,
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  compactValueCurrent: {
    color: Luxe.gold,
  },
  seat: {
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  seatCurrent: {
    backgroundColor: 'rgba(201, 169, 98, 0.1)',
  },
  seatLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  seatName: {
    flexShrink: 1,
    color: Luxe.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  seatNameCurrent: {
    color: Luxe.text,
  },
  seatValue: {
    marginLeft: 'auto',
    color: Luxe.textMuted,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  seatValueCurrent: {
    color: Luxe.gold,
  },
  /**
   * The rack: fifteen slots on one line, never wrapping.
   *
   * At 8pt with 2pt gaps the row is 148pt against the 272 the board has, so it
   * fits with room to spare on the narrowest phone this runs on — and because
   * the count is fixed, the row is the same width for every seat and for the
   * whole frame.
   */
  rack: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 2,
  },
  /**
   * A slot, filled or empty, always with an edge.
   *
   * The border is on every ball rather than only on the dark ones: the eight is
   * near-black and vanished into the panel entirely without it, and a rule that
   * applies to one ball is a rule somebody will break when the ball sets change.
   * It also gives the coloured ones definition against each other at 8pt, where
   * two adjacent reds would otherwise merge.
   */
  slot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  /**
   * An empty socket: an outline, not a filled disc.
   *
   * Hollow is what makes it read as a place waiting to be filled rather than as
   * a grey ball. Faint enough to recede behind the ones that are there.
   */
  slotEmpty: {
    backgroundColor: 'transparent',
    // Fainter than a filled one, so an empty socket recedes behind the balls
    // that are actually there.
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  slotBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '27%',
    bottom: '27%',
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
