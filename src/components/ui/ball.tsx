/**
 * A ball, drawn flat — the same one the table draws, in two dimensions.
 *
 * It takes its colour from whichever set the player has chosen, carries its
 * number on the white disc, and wears the stripe if the set has stripes and the
 * number is above the eight. Those three things together are what make it read
 * as a ball rather than as a coloured dot: a plain circle in the right colour is
 * a swatch, and a swatch is not what either of the screens using this is for.
 *
 * `active` is the difference between a ball that is there and a place where one
 * could be — an outline with nothing in it. Both screens need that: the player
 * picker counts up to four, and the loading rack fills from one to fifteen.
 */

import { StyleSheet, Text, View } from 'react-native';

import { ballSetById, colorForBallIn } from '@/constants/ball-sets';
import { Luxe } from '@/constants/game-theme';
import { useSettings } from '@/store/settings';

export function Ball({
  number,
  active = true,
  size,
}: {
  number: number;
  active?: boolean;
  size: number;
}) {
  const setId = useSettings((s) => s.ballSetId);
  const set = ballSetById(setId);
  const colour = colorForBallIn(set, number);

  // Stripes only exist above the eight, and only in a set that has them.
  const striped = set.striped && number > 8;

  return (
    <View
      style={[
        styles.ball,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: active ? (striped ? '#f2efe6' : colour) : 'transparent',
          borderColor: active ? 'transparent' : Luxe.hairlineStrong,
        },
      ]}>
      {/* The stripe: a band across the middle, with the pale ball showing above
          and below it. */}
      {active && striped ? (
        <View style={[styles.stripe, { height: size * 0.56, backgroundColor: colour }]} />
      ) : null}

      {active ? (
        <>
          <View
            style={[
              styles.sheen,
              {
                width: size * 0.38,
                height: size * 0.38,
                borderRadius: size * 0.19,
                top: size * 0.14,
                left: size * 0.16,
              },
            ]}
          />

          {/* The number, on the white disc every numbered ball carries. */}
          <View
            style={[
              styles.disc,
              { width: size * 0.52, height: size * 0.52, borderRadius: size * 0.26 },
            ]}>
            <Text style={[styles.number, { fontSize: size * 0.3 }]}>{number}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ball: {
    borderWidth: 1.5,
    overflow: 'hidden',
    // The number disc is a child in normal flow, so without these it settles
    // into the top-left corner instead of the middle of the circle.
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheen: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  stripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Centred by hand: an absolute child ignores the parent's justification, and
    // the band has to sit across the middle of the ball.
    top: '22%',
  },
  /** The white disc the number is printed on. */
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f5ef',
  },
  number: {
    color: '#14161a',
    fontWeight: '800',
    // The same gap the table's own numbers use, so a two-digit ball does not run
    // its characters together.
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
});
