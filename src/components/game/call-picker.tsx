/**
 * Naming the shot, in the two modes that require it.
 *
 * A ball and a pocket have to be said before the cue moves, or the pot does not
 * count. That is two choices, and the honest way to present them is the way they
 * exist on the table: pick what you are hitting, then say where it is going.
 *
 * Drawn as a small plan of the table rather than as a row of six buttons named
 * "corner NW" and so on. Nobody thinks of a pocket by its compass point — they
 * think of it as *that one, over there* — so the control is a picture with the
 * pockets in the places they actually are, seen from above the way the overhead
 * camera shows it. Tapping a corner of the diagram is the same gesture as
 * pointing at a corner of the table.
 *
 * It sits over the table while aiming and disappears once the call is made, so
 * it costs nothing on the shots after the first look.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Palette, Radius } from '@/constants/game-theme';
import { Spacing } from '@/constants/theme';
import { playTap } from '@/game/audio/sfx';
import { ballSetById, colorForBallIn } from '@/constants/ball-sets';
import { BallKind, ballKindFor } from '@/game/core/ball';
import type { PocketId } from '@/game/core/table';
import { legalTargets, needsCall } from '@/game/rules/match';
import { Phase } from '@/game/rules/types';
import type { MessageKey } from '@/i18n';
import { useT } from '@/i18n/use-t';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

/**
 * Where each pocket sits on the diagram, as fractions of its box.
 *
 * The table runs up the screen in the overhead view — long axis vertical — so
 * the corners are the four corners of a tall rectangle and the two side pockets
 * are halfway down its long edges. These are the same six the solver has, in the
 * same relative places.
 */
const SPOTS: { id: PocketId; left: number; top: number; labelKey: MessageKey }[] = [
  { id: 'corner-nw', left: 0, top: 0, labelKey: 'call.pocketCornerNw' },
  { id: 'corner-ne', left: 1, top: 0, labelKey: 'call.pocketCornerNe' },
  { id: 'side-n', left: 1, top: 0.5, labelKey: 'call.pocketSideN' },
  { id: 'side-s', left: 0, top: 0.5, labelKey: 'call.pocketSideS' },
  { id: 'corner-sw', left: 0, top: 1, labelKey: 'call.pocketCornerSw' },
  { id: 'corner-se', left: 1, top: 1, labelKey: 'call.pocketCornerSe' },
];

/** The white a striped ball is, under its band. Matches the shader's. */
const STRIPE_GROUND = '#f2efe6';

const DIAGRAM_WIDTH = 132;
const DIAGRAM_HEIGHT = 196;
const HOLE = 26;

export function CallPicker() {
  const t = useT();
  const phase = useSession((s) => s.phase);
  const match = useSession((s) => s.match);
  const world = useSession((s) => s.world);
  const setCall = useSession((s) => s.setCall);
  const ballSetId = useSettings((s) => s.ballSetId);

  const [ball, setBall] = useState<number | null>(null);

  /*
   * The set the player actually chose, not a fixed palette.
   *
   * The picker was reading the solver's own colours, which are the reference set
   * and not necessarily what is on the cloth — so with any other set selected
   * the swatches named balls by the wrong colour.
   */
  const set = ballSetById(ballSetId);

  const aiming = phase === Phase.AIMING;
  const call = match && match.kind !== 'free' ? match.state.call : null;

  /*
   * Hidden whenever there is nothing to say.
   *
   * Not shown while the computer is playing either: it names its own shots
   * through the planner, and a picker over somebody else's turn invites a tap
   * that would do nothing.
   */
  if (!match || !world || !aiming || !needsCall(match)) return null;
  if (match.state.players[match.state.current]?.cpu) return null;
  if (call) return null;

  /*
   * What may be called.
   *
   * In eight-ball this is the shooter's own group; in straight pool it is
   * everything, because every ball is worth the same. Either way it comes from
   * the rules rather than being worked out again here.
   */
  const allowed =
    legalTargets(match, world) ?? world.remainingObjectBalls().map((b) => b.number);
  const choices = [...allowed].sort((a, b) => a - b);

  const choosePocket = (pocket: PocketId) => {
    if (ball === null) return;
    playTap('confirm');
    setCall({ ball, pocket });
    setBall(null);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(160)}
      style={styles.root}>
      <Text style={styles.prompt}>
        {ball === null ? t('call.pickBall') : t('call.pickPocket', { number: ball })}
      </Text>

      {ball === null ? (
        <View style={styles.balls}>
          {choices.map((number) => {
            const colour = colorForBallIn(set, number);
            /*
             * Striped exactly when the ball on the table is striped.
             *
             * Both halves of that matter. `ballKindFor` decides which numbers
             * are stripes — asked rather than re-derived here, so the picker
             * cannot disagree with the solver — and the set decides whether they
             * are drawn that way at all, because some of them are plain right
             * through. Getting either wrong means picking the ball that looks
             * like the one you meant and calling a different one.
             */
            const striped = set.striped && ballKindFor(number) === BallKind.STRIPE;

            return (
              <Pressable
                key={number}
                accessibilityRole="button"
                accessibilityLabel={String(number)}
                onPress={() => {
                  playTap();
                  setBall(number);
                }}
                style={({ pressed }) => [
                  styles.ball,
                  // A stripe is a white ball with a band of colour across it,
                  // which is what the shader draws on the table.
                  { backgroundColor: striped ? STRIPE_GROUND : colour },
                  pressed && styles.pressed,
                ]}>
                {striped ? <View style={[styles.band, { backgroundColor: colour }]} /> : null}

                {/* A white disc behind the numeral, the way a real ball carries
                    its number, so it stays readable on the dark colours. */}
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{number}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.diagramWrap}>
          <View style={styles.diagram}>
            {SPOTS.map((spot) => (
              <Pressable
                key={spot.id}
                accessibilityRole="button"
                accessibilityLabel={t(spot.labelKey)}
                onPress={() => choosePocket(spot.id)}
                style={({ pressed }) => [
                  styles.hole,
                  {
                    left: spot.left * DIAGRAM_WIDTH - HOLE / 2,
                    top: spot.top * DIAGRAM_HEIGHT - HOLE / 2,
                  },
                  pressed && styles.holePressed,
                ]}
              />
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              playTap();
              setBall(null);
            }}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Text style={styles.backLabel}>{t('common.back')}</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201, 169, 98, 0.28)',
    backgroundColor: 'rgba(8, 11, 10, 0.92)',
  },
  prompt: {
    color: Palette.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  balls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    maxWidth: 232,
  },
  ball: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    /*
     * Clips the stripe to the circle.
     *
     * The band is a full-width rectangle, so without this it runs straight out
     * past the curve at the ball's widest point and the swatch reads as a disc
     * with a bar through it rather than as a striped ball. The rounded corners
     * only shape the view's own background; anything drawn inside it needs the
     * overflow rule to be cut to the same silhouette.
     */
    overflow: 'hidden',
  },
  /**
   * The coloured band across a stripe.
   *
   * Proportioned like the shader's: it turns white above latitude 0.52, which
   * leaves a band a little under half the ball's height across its middle.
   */
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    /*
     * Pinned from both edges rather than given a height.
     *
     * An absolutely positioned child is outside the parent's `justifyContent`,
     * so a bare height would have left the band at the top of the ball instead
     * of across its middle. Insetting equally from top and bottom centres it by
     * construction and keeps the proportion at any swatch size.
     */
    top: '27%',
    bottom: '27%',
  },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f4ec',
  },
  badgeText: {
    color: '#141414',
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  diagramWrap: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  /** The cloth, seen from above. Long axis up the screen, as in the game. */
  diagram: {
    width: DIAGRAM_WIDTH,
    height: DIAGRAM_HEIGHT,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#5b3a1e',
    backgroundColor: '#12503a',
  },
  hole: {
    position: 'absolute',
    width: HOLE,
    height: HOLE,
    borderRadius: HOLE / 2,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 98, 0.5)',
    backgroundColor: '#050706',
  },
  holePressed: {
    borderColor: Palette.gold,
    backgroundColor: '#2a2313',
  },
  back: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  backLabel: {
    color: Palette.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.6,
  },
});
