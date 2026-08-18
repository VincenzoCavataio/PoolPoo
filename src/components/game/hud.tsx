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

function FreeScoreboard() {
  const free = useSession((s) => s.free);
  if (!free) return null;

  return (
    <View style={styles.chipRow}>
      {free.players.map((player, index) => {
        const active = index === free.current && !free.finished;
        return (
          <View key={player.id} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipName, active && styles.chipNameActive]} numberOfLines={1}>
              {player.name}
            </Text>
            <Text style={[styles.chipScore, active && styles.chipScoreActive]}>{player.score}</Text>
          </View>
        );
      })}
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
  const render = useMessageRenderer();
  const mode = useSession((s) => s.mode);
  const messages = useSession((s) => s.messages);
  const phase = useSession((s) => s.phase);

  // One line only: the celebration banner already carries the loud news.
  const note = phase === Phase.AIMING ? messages[messages.length - 1] : undefined;

  return (
    <View style={styles.hud} pointerEvents="box-none">
      <View style={styles.topRow} pointerEvents="box-none">
        <BackButton />
        <View style={styles.topContent} pointerEvents="box-none">
          {mode === 'free' ? <FreeScoreboard /> : <PuzzleStatus />}
        </View>
      </View>

      {note ? (
        <View style={styles.note} pointerEvents="none">
          <Text style={styles.noteLabel} numberOfLines={1}>
            {render(note)}
          </Text>
        </View>
      ) : null}
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
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  topContent: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
    backgroundColor: 'rgba(12, 19, 16, 0.88)',
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLabel: {
    color: Palette.text,
    fontSize: 26,
    lineHeight: 28,
    marginTop: -3,
  },
  pressed: {
    opacity: 0.7,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.small,
    backgroundColor: 'rgba(12, 19, 16, 0.88)',
    borderWidth: 1,
    borderColor: Palette.border,
  },
  chipActive: {
    borderColor: Palette.accent,
    backgroundColor: 'rgba(61, 220, 132, 0.18)',
  },
  chipName: {
    color: Palette.textMuted,
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  chipNameActive: {
    color: Palette.text,
  },
  chipScore: {
    color: Palette.textMuted,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  chipScoreActive: {
    color: Palette.accent,
  },
  puzzleBox: {
    backgroundColor: 'rgba(12, 19, 16, 0.88)',
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
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
  note: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(12, 19, 16, 0.85)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    maxWidth: '100%',
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
