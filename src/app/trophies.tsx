/**
 * The trophy cabinet.
 *
 * Grouped by kind rather than listed flat, because the four kinds are asking for
 * different things: progression is a matter of turning up, skill is a shot you
 * meant, a feat is a whole game held together, and a secret is not asking for
 * anything at all until you have found it.
 *
 * A locked secret shows an outline and no words. That is the point of it — a
 * hint would turn it into a task, and the whole value of a hidden trophy is
 * meeting it without having been sent.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Screen, SectionLabel } from '@/components/ui/screen';
import { Luxe } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { TROPHIES, type Trophy, type TrophyKind } from '@/game/trophies/catalogue';
import type { MessageKey } from '@/i18n';
import { useT } from '@/i18n/use-t';
import { trophyTally, useTrophies } from '@/store/trophies';

const GROUPS: { kind: TrophyKind; labelKey: MessageKey }[] = [
  { kind: 'progress', labelKey: 'trophy.groupProgress' },
  { kind: 'skill', labelKey: 'trophy.groupSkill' },
  { kind: 'feat', labelKey: 'trophy.groupFeat' },
  { kind: 'secret', labelKey: 'trophy.groupSecret' },
];

function TrophyRow({ trophy }: { trophy: Trophy }) {
  const t = useT();
  const unlocked = useTrophies((s) => Boolean(s.unlocked[trophy.id]));
  const progress = useTrophies((s) => s.progress[trophy.id] ?? 0);

  // A locked secret gives nothing away — not its name, not how it is earned.
  const hidden = trophy.kind === 'secret' && !unlocked;
  const label = hidden ? t('trophy.secret') : t(trophy.labelKey);
  const hint = hidden ? t('trophy.secretHint') : t(trophy.hintKey);

  // Counted trophies show how far along they are; the rest would just say 0/1.
  const counted = trophy.target !== undefined && trophy.target > 1 && !unlocked && !hidden;

  return (
    <View style={styles.row}>
      <View style={[styles.badge, unlocked && styles.badgeEarned]}>
        <Text style={[styles.badgeMark, unlocked && styles.badgeMarkEarned]}>
          {unlocked ? '★' : hidden ? '?' : '☆'}
        </Text>
      </View>

      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, !unlocked && styles.rowLabelLocked]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.rowHint} numberOfLines={2}>
          {hint}
        </Text>
      </View>

      {counted ? (
        <Text style={styles.count}>
          {Math.min(progress, trophy.target!)}/{trophy.target}
        </Text>
      ) : null}
    </View>
  );
}

export default function TrophiesScreen() {
  const router = useRouter();
  const t = useT();
  const unlocked = useTrophies((s) => s.unlocked);
  const tally = trophyTally(unlocked);

  return (
    <Screen
      title={t('trophy.title')}
      subtitle={t('trophy.tally', { earned: tally.earned, total: tally.total })}
      onBack={() => router.back()}>
      {GROUPS.map((group) => {
        const inGroup = TROPHIES.filter((tr) => tr.kind === group.kind);
        if (inGroup.length === 0) return null;

        return (
          <View key={group.kind} style={styles.group}>
            <SectionLabel>{t(group.labelKey)}</SectionLabel>
            <Card>
              {inGroup.map((trophy) => (
                <TrophyRow key={trophy.id} trophy={trophy} />
              ))}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  badge: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairline,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  badgeEarned: {
    borderColor: 'rgba(201, 169, 98, 0.5)',
    backgroundColor: 'rgba(201, 169, 98, 0.12)',
  },
  badgeMark: {
    color: Luxe.textFaint,
    fontSize: 15,
  },
  badgeMarkEarned: {
    color: Luxe.gold,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: Luxe.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  rowLabelLocked: {
    color: Luxe.textMuted,
  },
  rowHint: {
    color: Luxe.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  count: {
    color: Luxe.textMuted,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
