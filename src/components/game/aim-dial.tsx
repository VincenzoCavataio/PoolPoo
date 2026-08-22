/**
 * The aim dial: a small half-wheel that turns with the cue.
 *
 * It replaces the aim strip that used to sit in the panel below. That strip was
 * a good instrument in the wrong place — a scale of rolling marks reads well,
 * but it lived under the table while the thing it measured happened on it, so
 * lining up a shot meant watching two places at once.
 *
 * Now the drag on the table *is* the control and this is its readout. It appears
 * on the touch and goes when the touch does, so nothing permanent is added over
 * the board.
 *
 * A wheel rather than a line because the quantity is an angle. A strip has to
 * pretend a rotation is a distance and rely on marks scrolling off each end to
 * imply the wrap-around; a wheel simply turns.
 *
 * The dial went through a spell of being as wide as the screen, which made the
 * arc across it so deep that the band had to be tall to hold it, and the whole
 * thing sat over the table like a piece of furniture. It is a small disc again,
 * cut in half and centred in a full-width row: the row is what places it, the
 * disc is what you read.
 */

import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Palette } from '@/constants/game-theme';
import { TICK_DEGREES } from '@/game/input/detents';
import { CameraMode } from '@/game/render/camera';
import { Phase } from '@/game/rules/types';
import { useAimDial } from '@/store/aim-dial';
import { useSession } from '@/store/session';

/**
 * The wheel's diameter, in points.
 *
 * Big enough to read at a glance — the marks have to be tellable apart while the
 * eye's real business is the balls — and no bigger, because it still has to
 * leave the shot it is measuring visible.
 */
const DIAL_SIZE = 190;

/**
 * How much of the disc shows, in points — a band off the top, not the full half.
 *
 * Shallower than a half: the crown is where the reading happens, and the further
 * down the disc you show, the more of the table it covers to say the same thing.
 * This keeps roughly the top seventy degrees of arc, which is more than the
 * pointer will ever need and still reads unmistakably as part of a circle.
 *
 * Scaled with the diameter rather than fixed, so a bigger wheel shows the same
 * slice of arc instead of a flatter one.
 */
const REVEAL = 56;

/** The longest mark on the rim, in points. */
const MAJOR_TICK = 17;

/** Gap between the rim and the tip of a mark, in points. */
const RIM_INSET = 6;

/** The face's outline. Sits inside its bounds, so it shifts the rim inwards. */
const BORDER = 1;

/**
 * A theme colour at a given strength.
 *
 * Per-colour alpha rather than `opacity` on the views: opacity on a parent fades
 * everything inside it, pointer included, and the pointer has to stay at full
 * strength to be read against.
 *
 * The channels are pulled out of the token itself so these follow the theme. If
 * a token ever stops being a plain `#rrggbb`, the fallback keeps the dial
 * drawable rather than blanking it.
 */
function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return color;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Minor marks: pale, and the quieter half of the scale.
 *
 * Held well below the pointer's full white so that sixty of them round the rim
 * stay a texture to be counted against rather than sixty things demanding to be
 * read. They went dark for a while, which only worked while the face was a light
 * opaque grey; on a dark veil the scale has to be the light thing.
 */
const TICK_LIGHT = withAlpha(Palette.text, 0.6);

/**
 * The face's fill: a dark veil, with the cloth showing through it.
 *
 * The neutral grey this replaced was opaque on purpose — a translucent face
 * wears the cloth's hue, and an earlier wash of `textMuted` came out plain sky
 * blue over the blue baize, which belonged to nothing else in the app. Grey
 * fixed that and was dull for it: a flat plate on a lit table.
 *
 * The fix is to be translucent but *neutral*: `background` is the app's own
 * near-black, so the veil darkens whatever is behind it without tinting it. The
 * cloth keeps its colour, the dial keeps the table's light, and no hue is
 * invented that the theme does not already have.
 *
 * Dark rather than light, which decides the marks: on a darkened cloth the gold
 * and a pale scale both read at 5:1 or better, where near-black ticks would sit
 * at about 1.5:1 and vanish.
 */
const FACE_FILL = withAlpha(Palette.background, 0.45);

/**
 * The rim: a pale hairline, at a whisper.
 *
 * The veil is darker than any cloth, so the disc already separates itself and
 * the edge has no work to do beyond finishing it. Pale rather than dark now —
 * on a dark face a dark outline is invisible, and what little the edge says it
 * says by catching the light the way the marks do.
 */
const FACE_EDGE = withAlpha(Palette.text, 0.18);

/**
 * The whole rim is marked: sixty ticks, one every six degrees.
 *
 * A partial fan does not work here. The wheel turns by the raw aim angle, which
 * is unbounded — so with marks only near the pointer, aiming past about thirty
 * degrees rotated the last of them out of the slot and left it empty. Ticking
 * the full circle means there is always a mark under the pointer no matter how
 * far the cue has been turned, and it costs sixty small views drawn once.
 */
const TICKS_PER_TURN = 360 / TICK_DEGREES;

/** One mark, laid on the rim at its own angle. */
function Tick({ step }: { step: number }) {
  const degrees = step * TICK_DEGREES;
  // Every fifth mark is long, so the scale can be counted rather than only felt.
  const major = Math.abs(step) % 5 === 0;

  return (
    <View style={[styles.tickAnchor, { transform: [{ rotate: `${degrees}deg` }] }]}>
      <View style={[styles.tick, major && styles.tickMajor]} />
    </View>
  );
}

const STEPS: number[] = [];
for (let i = 0; i < TICKS_PER_TURN; i++) STEPS.push(i);

export function AimDial() {
  const active = useAimDial((s) => s.active);
  const aimAngle = useSession((s) => s.aimAngle);
  const aiming = useSession((s) => s.phase === Phase.AIMING);
  const cueView = useSession((s) => s.cameraMode === CameraMode.CUE);

  /*
   * On only while a finger is turning the cue.
   *
   * The drag raises it and the end of the drag drops it, so it is a readout for
   * a movement in progress rather than a permanent fixture: the table stays
   * clear the rest of the time, which is most of the time.
   *
   * The phase and the view are checked as well as the touch. `release` is tied
   * to the end of a gesture, and a shot taken mid-drag ends the aim without
   * ending the gesture — so the last word on whether there is anything to aim
   * belongs here.
   */
  if (!active || !aiming || !cueView) return null;

  /*
   * The wheel's rotation, as a plain style rather than an animated one.
   *
   * `aimAngle` is zustand state, so this component already re-renders on every
   * nudge — which is exactly when the dial has to move. A worklet would not: it
   * only re-runs when a *shared value* it reads changes, and a captured JS
   * number never does, so the wheel would sit pinned wherever the angle was when
   * it mounted.
   *
   * Negated so the marks sweep against the turn, the way a compass card does:
   * aim right and the scale passes leftwards under the fixed pointer.
   */
  const degrees = -aimAngle * (180 / Math.PI);

  return (
    // Quick on both counts: the dial belongs to a touch, and a fade that
    // outlasts the finger reads as lag rather than as polish.
    <Animated.View
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(160)}
      style={styles.container}
      pointerEvents="none">
      {/*
        The crop: a plain rectangle that shows only the top band of what is
        inside it.

        Two views rather than one, and this is the whole reason. Cropping and
        rounding cannot be the same view: a box that is `REVEAL` tall with a
        `borderRadius` of a full radius has asked for corners bigger than itself,
        and React Native answers by scaling them down to fit — which quietly
        turns the circle into a flatter ellipse. That was the uneven gap: the
        marks sit at a true constant radius, so a rim that is flattened at the
        top and tighter at the sides shows more air above than beside them.

        So the crop is square-cornered and does nothing but limit the height, and
        the disc inside it keeps its own honest curve.
      */}
      <View style={styles.crop}>
        {/* The face: a full circle, most of it below the crop. */}
        <View style={styles.face}>
          {/* The turning part. */}
          <View style={[styles.wheel, { transform: [{ rotate: `${degrees}deg` }] }]}>
            {STEPS.map((step) => (
              <Tick key={step} step={step} />
            ))}
          </View>
        </View>

        {/*
          The pointer, fixed at the top.

          Outside the turning view, or it would rotate with the scale and there
          would be nothing to measure against — a compass card with no lubber
          line.
        */}
        <View style={styles.pointer} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /**
   * The full-width row the dial sits in.
   *
   * It draws nothing itself. Its whole job is to span the stage so the housing
   * can be centred in it, which keeps the dial in one known place regardless of
   * how wide the screen is.
   */
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    /*
     * Flush with the bottom of the stage.
     *
     * It sat a couple of units clear, which left a strip of cloth under it and
     * made the dial look like a card lying on the table. Sitting on the edge, it
     * reads as part of the frame the table is set into — and the flat bottom of
     * the disc has something to be flat *against*.
     */
    bottom: 0,
    alignItems: 'center',
  },
  /**
   * The crop: square corners, and no styling of its own.
   *
   * It exists only to cut the disc off at `REVEAL`. Every visible edge belongs
   * to the face inside it — see the note at the call site for why these cannot
   * be the same view.
   */
  crop: {
    width: DIAL_SIZE,
    height: REVEAL,
    overflow: 'hidden',
    alignItems: 'center',
  },
  /**
   * The face: a true circle, of which only the top band is ever seen.
   *
   * `borderRadius` is exactly half the width on a box that is square, so the
   * radius is never scaled down and the rim stays circular. Its border and fill
   * are the dial's visible surface; the crop above simply hides the rest.
   */
  face: {
    position: 'absolute',
    top: 0,
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    borderWidth: BORDER,
    borderColor: FACE_EDGE,
    backgroundColor: FACE_FILL,
    overflow: 'hidden',
    alignItems: 'center',
  },
  /**
   * The wheel: fills the face, and turns inside it.
   *
   * Sized to the face's *content* box — a point smaller on each side than the
   * face itself, because the border sits inside those bounds. Without that the
   * marks would sit a point closer to the rim than the geometry says.
   */
  wheel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  /**
   * A full-height column pinned to the wheel's centre, rotated about it.
   *
   * Rotating a tall anchor is how a mark gets placed on a rim without any
   * trigonometry: the transform origin is the middle of the wheel, so the tick
   * at the anchor's top end lands on the circumference at whatever angle the
   * anchor is turned to.
   */
  tickAnchor: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    /*
     * A little air between the rim and the mark.
     *
     * Without it the topmost tick starts flush against the housing's edge and
     * reads as touching it rather than as sitting inside the wheel.
     */
    paddingTop: RIM_INSET,
  },
  /*
   * Two kinds of mark, told apart by colour as well as by length.
   *
   * The minors are dark: sixty of them go round the rim, and a scale that is
   * mostly quiet marks lets the eye find the loud ones without counting. The
   * fifths are the theme's gold — the colour this app reserves for the thing
   * worth looking at — so the divisions of thirty degrees announce themselves.
   */
  tick: {
    width: 1.5,
    height: 10,
    borderRadius: 0.75,
    backgroundColor: TICK_LIGHT,
  },
  tickMajor: {
    width: 2,
    height: MAJOR_TICK,
    borderRadius: 1,
    backgroundColor: Palette.gold,
  },
  /**
   * The lubber line: the place the scale is read from.
   *
   * Now that the marks carry the accent too, the pointer cannot be told apart by
   * hue alone — so it is told apart by weight and reach: full-strength text
   * white, wider than any mark, and overshooting them at both ends. The one
   * thing on the dial that is not green is the thing you read *against*.
   */
  pointer: {
    position: 'absolute',
    /*
     * Measured from the same rim the marks are.
     *
     * `BORDER` because the face's own outline sits inside its bounds, so the
     * cloth-facing edge of the rim is a point below the crop's top; the rest
     * starts it just above the marks so it overshoots them at both ends and is
     * never mistaken for one.
     */
    top: BORDER + RIM_INSET - 3,
    width: 2,
    height: MAJOR_TICK + 7,
    borderRadius: 1.25,
    backgroundColor: Palette.text,
  },
});
