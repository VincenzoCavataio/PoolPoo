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
import { levelById, nextLevelId } from '@/game/rules/levels';
import { describeGoal, shotsLeft } from '@/game/rules/puzzle';
import { Phase } from '@/game/rules/types';
import { useMessageRenderer, useT } from '@/i18n/use-t';
import { useProgress } from '@/store/progress';
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
function FreeScoreboard() {
  const free = useSession((s) => s.free);
  if (!free) return null;

  const current = free.players[free.current];
  const others = free.players.filter((_, i) => i !== free.current);

  return (
    <View style={styles.titleBlock}>
      <View style={styles.titleLine}>
        <Text style={styles.playerName} numberOfLines={1}>
          {current?.name ?? ''}
        </Text>
        <Text style={styles.playerScore}>{current?.score ?? 0}</Text>
      </View>

      {others.length > 0 ? (
        <View style={styles.otherRow}>
          {others.map((player) => (
            <Text key={player.id} style={styles.otherPlayer} numberOfLines={1}>
              {player.name} <Text style={styles.otherScore}>{player.score}</Text>
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PuzzleStatus() {
  const t = useT();
  const render = useMessageRenderer();
  const puzzle = useSession((s) => s.puzzle);
  const levelId = useSession((s) => s.levelId);
  const level = levelId ? levelById(levelId) : undefined;
  if (!puzzle || !level) return null;

  const remaining = shotsLeft(level, puzzle);

  return (
    <View style={styles.puzzleBox}>
      <View style={styles.puzzleHeader}>
        <Text style={styles.puzzleName} numberOfLines={1}>
          {t(level.nameKey)}
        </Text>
        <Text style={[styles.puzzleShots, remaining <= 1 && styles.puzzleShotsLow]}>
          {t('game.shotsLeft', { count: remaining })}
        </Text>
      </View>
      <Text style={styles.puzzleGoal} numberOfLines={1}>
        {render(describeGoal(level))}
      </Text>
    </View>
  );
}

export function GameHud() {
  const mode = useSession((s) => s.mode);

  return (
    <View style={styles.hud} pointerEvents="box-none">
      <View style={styles.topRow} pointerEvents="box-none">
        <BackButton />
        <View style={styles.topContent} pointerEvents="box-none">
          {mode === 'free' ? <FreeScoreboard /> : <PuzzleStatus />}
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

export function GameOverOverlay() {
  const router = useRouter();
  const t = useT();
  const render = useMessageRenderer();
  const phase = useSession((s) => s.phase);
  const mode = useSession((s) => s.mode);
  const free = useSession((s) => s.free);
  const puzzle = useSession((s) => s.puzzle);
  const levelId = useSession((s) => s.levelId);
  const startFree = useSession((s) => s.startFree);
  const startPuzzle = useSession((s) => s.startPuzzle);
  const retryLevel = useSession((s) => s.retryLevel);
  const leaveGame = useSession((s) => s.leaveGame);
  const stars = useProgress((s) => s.stars);

  if (phase !== Phase.GAME_OVER) return null;

  const goToMenu = () => {
    leaveGame();
    router.replace('/menu');
  };

  const level = levelId ? levelById(levelId) : undefined;
  const upcoming = levelId ? nextLevelId(levelId) : null;
  const won = puzzle?.status === 'won';

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayCard}>
        {mode === 'free' && free ? (
          <>
            <Text style={styles.overlayTitle}>
              {free.winners.length === 1
                ? t('result.winner', {
                    name: free.players.find((p) => p.id === free.winners[0])?.name ?? '',
                  })
                : t('result.draw')}
            </Text>
            <View style={styles.resultTable}>
              {[...free.players]
                .sort((a, b) => b.score - a.score)
                .map((player) => (
                  <View key={player.id} style={styles.resultRow}>
                    <Text style={styles.resultName}>{player.name}</Text>
                    <Text style={styles.resultScore}>
                      {t('result.points', { count: player.score })}
                    </Text>
                  </View>
                ))}
            </View>
            <GameButton
              label={t('result.newGame')}
              variant="primary"
              onPress={() => startFree(free.players.length, free.players.map((p) => p.name))}
            />
          </>
        ) : null}

        {mode === 'puzzle' && puzzle && level ? (
          <>
            <Text style={styles.overlayTitle}>
              {won ? t('result.solved') : t('result.failed')}
            </Text>
            {won ? (
              <>
                <Stars value={puzzle.stars} />
                <Text style={styles.overlayDetail}>
                  {t('game.shotsLeft', { count: puzzle.shotsUsed })} /{' '}
                  {t('game.shotsLeft', { count: level.maxShots })}
                </Text>
              </>
            ) : (
              <Text style={styles.overlayDetail}>
                {puzzle.failReason ? render(puzzle.failReason) : t('result.retry')}
              </Text>
            )}

            {won && upcoming ? (
              <GameButton
                label={t('result.nextLevel')}
                variant="primary"
                sublabel={(() => {
                  const next = levelById(upcoming);
                  return next ? t(next.nameKey) : undefined;
                })()}
                onPress={() => startPuzzle(upcoming)}
              />
            ) : null}
            <GameButton
              label={won ? t('result.replay') : t('result.retry')}
              onPress={retryLevel}
            />
            {won && !upcoming ? (
              <Text style={styles.overlayDetail}>
                {t('result.allLevels', {
                  count: Object.values(stars).reduce((a, b) => a + b, 0),
                })}
              </Text>
            ) : null}
          </>
        ) : null}

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
  otherScore: {
    color: Palette.text,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  puzzleBox: {
    backgroundColor: HUD_SURFACE,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  puzzleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  puzzleName: {
    color: Palette.text,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  puzzleShots: {
    color: Palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  puzzleShotsLow: {
    color: Palette.danger,
  },
  puzzleGoal: {
    color: Palette.textMuted,
    fontSize: 11,
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
