/**
 * Icons, drawn rather than imported.
 *
 * There is no icon font or SVG library in the project, and adding one for a
 * dozen glyphs would be a poor trade — but the deciding reason is that nothing
 * in a generic icon set says *billiards*. A cue, a rack, a pocket and a stack of
 * chalk are the vocabulary of this game, and each is a handful of circles and
 * rectangles at the sizes a menu uses.
 *
 * Every icon takes a `size` and a `color` and draws inside a square of that
 * size, so they line up in a row without any of them carrying its own padding.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { Luxe } from '@/constants/game-theme';
import { playTap } from '@/game/audio/sfx';

interface IconProps {
  size?: number;
  color?: string;
}

/** A rack of balls: the triangle, for starting a game. */
export function RackIcon({ size = 24, color = Luxe.text }: IconProps) {
  const ball = size * 0.26;
  const gap = ball * 0.08;
  const rows = [1, 2, 3];

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ gap }}>
        {rows.map((count, rowIndex) => (
          <View key={rowIndex} style={[styles.row, { gap }]}>
            {Array.from({ length: count }, (_, i) => (
              <View
                key={i}
                style={{
                  width: ball,
                  height: ball,
                  borderRadius: ball / 2,
                  // The apex ball is solid, the rest outlined: a filled triangle
                  // of dots reads as a pattern, this reads as a rack.
                  backgroundColor: rowIndex === 0 ? color : 'transparent',
                  borderWidth: rowIndex === 0 ? 0 : 1,
                  borderColor: color,
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/** A cue laid across the frame, for resuming a game already in progress. */
export function CueIcon({ size = 24, color = Luxe.text }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.9,
          height: 2,
          backgroundColor: color,
          transform: [{ rotate: '-38deg' }],
        }}
      />
      {/* The tip, offset along the same diagonal. */}
      <View
        style={{
          position: 'absolute',
          width: size * 0.16,
          height: 3,
          backgroundColor: color,
          opacity: 0.55,
          transform: [{ rotate: '-38deg' }, { translateX: size * 0.36 }],
        }}
      />
    </View>
  );
}

/**
 * Three balls in a rising row: the shot, and how hard it is played.
 *
 * A cue drawn at this size is a bare diagonal line, which reads as a slash
 * before it reads as a cue. Balls are what this game is made of and a row of
 * them growing left to right is the same shape as the gauge above the button —
 * so the icon says *power* rather than merely *billiards*.
 *
 * Aligned along the bottom, the way the gauge's own blocks are: they grow
 * upward from a common floor rather than about their middles, which is what
 * makes the row read as a scale instead of as three unrelated dots.
 */
export function PowerBallsIcon({ size = 24, color = Luxe.text }: IconProps) {
  const sizes = [size * 0.34, size * 0.52, size * 0.72];

  /*
   * The box is only as tall as the balls, not a full square.
   *
   * Every other icon here fills its `size` box, so centring the box centres the
   * drawing. This one does not: the balls sit on a common floor and the largest
   * is under three quarters of the height, so a square box would carry a band of
   * nothing across its top — and beside a line of text, "centred" would put that
   * empty band on the middle line and hang the balls below it. Sized to the ink
   * instead, the icon's own centre is the centre of what you can see.
   *
   * Width stays the full `size`, which is what keeps it in step with the row of
   * icons elsewhere.
   */
  const height = sizes[sizes.length - 1];

  return (
    <View style={[styles.box, styles.ballRow, { width: size, height, gap: size * 0.08 }]}>
      {sizes.map((diameter, i) => (
        <View
          key={i}
          style={{
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: color,
            // The smaller balls sit back a little, so the row reads as one
            // rising thing rather than three of equal weight.
            opacity: 0.55 + i * 0.225,
          }}
        />
      ))}
    </View>
  );
}

/** Three sliders, for settings. */
export function SlidersIcon({ size = 24, color = Luxe.text }: IconProps) {
  const rows = [0.3, 0.62, 0.45];

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ width: size * 0.86, gap: size * 0.16 }}>
        {rows.map((at, i) => (
          <View key={i} style={styles.sliderRow}>
            <View style={{ height: 1, flex: 1, backgroundColor: color, opacity: 0.4 }} />
            <View
              style={{
                position: 'absolute',
                left: `${at * 100}%`,
                width: size * 0.14,
                height: size * 0.14,
                borderRadius: size * 0.07,
                backgroundColor: color,
              }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/** A pocket: a ring with a ball dropping into it. Used for the room picker. */
export function PocketIcon({ size = 24, color = Luxe.text }: IconProps) {
  const outer = size * 0.72;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          borderWidth: 1.5,
          borderColor: color,
          opacity: 0.5,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: outer * 0.5,
          height: outer * 0.5,
          borderRadius: outer * 0.25,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** A folded corner of cloth, for the cloth picker. */
export function ClothIcon({ size = 24, color = Luxe.text }: IconProps) {
  const s = size * 0.74;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: s,
          height: s * 0.78,
          borderWidth: 1.5,
          borderColor: color,
          borderRadius: 2,
        }}
      />
      {/* The turned-back corner, drawn as a triangle from a rotated square. */}
      <View
        style={{
          position: 'absolute',
          right: size * 0.13,
          bottom: size * 0.11,
          width: s * 0.3,
          height: s * 0.3,
          backgroundColor: color,
          opacity: 0.65,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/** Two balls, one striped, for the ball-set picker. */
export function BallsIcon({ size = 24, color = Luxe.text }: IconProps) {
  const ball = size * 0.46;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ flexDirection: 'row', gap: -ball * 0.18 }}>
        <View
          style={{
            width: ball,
            height: ball,
            borderRadius: ball / 2,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            width: ball,
            height: ball,
            borderRadius: ball / 2,
            borderWidth: 1.5,
            borderColor: color,
            overflow: 'hidden',
            justifyContent: 'center',
          }}>
          <View style={{ height: ball * 0.3, backgroundColor: color }} />
        </View>
      </View>
    </View>
  );
}

/**
 * One icon per discipline, each drawn from what the game is actually about.
 *
 * Not four variations on a billiard ball. The point of these is to tell four
 * games apart at a glance in a list, so each picks the one thing that makes its
 * game different from the other three: free play counts, eight-ball divides the
 * table in two, the called game names a pocket, straight pool racks again.
 *
 * All four are built from the same vocabulary of circles and bars as the rest of
 * this file, at the same weight, so they read as a set.
 */

/** Free play: a scattered table. Every ball in play, none of them special. */
export function FreePlayIcon({ size = 24, color = Luxe.text }: IconProps) {
  const ball = size * 0.26;
  // Placed by hand rather than on a grid: the whole idea is that nothing is
  // arranged, and an even spread would read as a formation.
  const spots = [
    { left: 0.04, top: 0.1 },
    { left: 0.46, top: 0.02 },
    { left: 0.7, top: 0.42 },
    { left: 0.2, top: 0.52 },
    { left: 0.56, top: 0.68 },
  ];

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {spots.map((spot, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: spot.left * size,
            top: spot.top * size,
            width: ball,
            height: ball,
            borderRadius: ball / 2,
            // The last one hollow, so the group reads as mixed rather than as
            // five of the same thing.
            backgroundColor: index === 4 ? 'transparent' : color,
            borderWidth: index === 4 ? 1.5 : 0,
            borderColor: color,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Eight-ball: a solid and a stripe, with the black between them.
 *
 * The two groups and the ball that ends the game, which is the whole of what
 * makes this game itself.
 */
export function EightBallIcon({ size = 24, color = Luxe.text }: IconProps) {
  const ball = size * 0.36;
  const black = size * 0.3;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.03 }}>
        {/* Solid. */}
        <View
          style={{
            width: ball,
            height: ball,
            borderRadius: ball / 2,
            backgroundColor: color,
          }}
        />

        {/* The black, smaller and ringed: the one they are both playing for. */}
        <View
          style={{
            width: black,
            height: black,
            borderRadius: black / 2,
            borderWidth: 1.5,
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View
            style={{
              width: black * 0.34,
              height: black * 0.34,
              borderRadius: black * 0.17,
              backgroundColor: color,
            }}
          />
        </View>

        {/* Stripe: a hollow ball with a band across its middle. */}
        <View
          style={{
            width: ball,
            height: ball,
            borderRadius: ball / 2,
            borderWidth: 1.5,
            borderColor: color,
            overflow: 'hidden',
            justifyContent: 'center',
          }}>
          <View style={{ height: ball * 0.3, backgroundColor: color }} />
        </View>
      </View>
    </View>
  );
}

/**
 * The called game: a ball, an arrow, a pocket.
 *
 * Saying where it is going before you send it, which is the one thing this adds
 * to eight-ball — so the icon is that sentence, drawn.
 */
export function CalledIcon({ size = 24, color = Luxe.text }: IconProps) {
  const ball = size * 0.28;
  const pocket = size * 0.34;
  const weight = Math.max(1.5, size * 0.07);

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.06 }}>
        <View
          style={{
            width: ball,
            height: ball,
            borderRadius: ball / 2,
            backgroundColor: color,
          }}
        />

        {/* The shaft and its head, the head built from two short bars meeting. */}
        <View style={{ width: size * 0.2, height: ball, justifyContent: 'center' }}>
          <View style={{ height: weight, borderRadius: weight / 2, backgroundColor: color }} />
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: ball / 2 - weight / 2 - size * 0.055,
              width: size * 0.11,
              height: weight,
              borderRadius: weight / 2,
              backgroundColor: color,
              transform: [{ rotate: '40deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: ball / 2 - weight / 2 + size * 0.055,
              width: size * 0.11,
              height: weight,
              borderRadius: weight / 2,
              backgroundColor: color,
              transform: [{ rotate: '-40deg' }],
            }}
          />
        </View>

        {/* The pocket: an open mouth, not a filled disc, so it reads as a hole. */}
        <View
          style={{
            width: pocket,
            height: pocket,
            borderRadius: pocket / 2,
            borderWidth: weight,
            borderColor: color,
          }}
        />
      </View>
    </View>
  );
}

/**
 * Straight pool: a triangle with an arrow curling back into it.
 *
 * The re-rack, which is what separates 14.1 from any other game where balls are
 * worth a point each.
 */
export function StraightPoolIcon({ size = 24, color = Luxe.text }: IconProps) {
  const ball = size * 0.2;
  const weight = Math.max(1.5, size * 0.07);
  const rows = [1, 2, 3];

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {/* The rack, apex up, sitting low so the arrow has room above it. */}
      <View style={{ marginTop: size * 0.16, gap: -ball * 0.06 }}>
        {rows.map((count, r) => (
          <View key={r} style={{ flexDirection: 'row', justifyContent: 'center', gap: -ball * 0.06 }}>
            {Array.from({ length: count }, (_, i) => (
              <View
                key={i}
                style={{
                  width: ball,
                  height: ball,
                  borderRadius: ball / 2,
                  backgroundColor: color,
                }}
              />
            ))}
          </View>
        ))}
      </View>

      {/*
        The one that goes back.

        A hollow ball above the apex with a short bar under it: the ball that was
        potted, on its way to being racked again.
      */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: size / 2 - ball * 0.6,
          width: ball * 1.2,
          height: ball * 1.2,
          borderRadius: ball * 0.6,
          borderWidth: weight * 0.8,
          borderColor: color,
        }}
      />
    </View>
  );
}

/** A globe, for language: an outline with two lines of latitude. */
export function GlobeIcon({ size = 24, color = Luxe.text }: IconProps) {
  const d = size * 0.72;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: d,
          height: d,
          borderRadius: d / 2,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      {/* One meridian, as a narrow ellipse, and one line of latitude. */}
      <View
        style={{
          position: 'absolute',
          width: d * 0.46,
          height: d,
          borderRadius: d / 2,
          borderWidth: 1,
          borderColor: color,
          opacity: 0.7,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: d,
          height: 1,
          backgroundColor: color,
          opacity: 0.7,
        }}
      />
    </View>
  );
}

/** A stack of discs, for stored data. */
export function DiscsIcon({ size = 24, color = Luxe.text }: IconProps) {
  const w = size * 0.76;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ gap: size * 0.1 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              width: w,
              height: size * 0.14,
              borderRadius: size * 0.07,
              borderWidth: 1,
              borderColor: color,
              opacity: 1 - i * 0.22,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** A speaker, for audio and haptics. */
export function SoundIcon({ size = 24, color = Luxe.text }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.08 }}>
        <View
          style={{
            width: size * 0.24,
            height: size * 0.3,
            backgroundColor: color,
            borderRadius: 1,
          }}
        />
        {/* Two arcs, as ring segments clipped to their right half. */}
        {[0.34, 0.5].map((r, i) => (
          <View
            key={r}
            style={{
              width: size * r * 0.5,
              height: size * r,
              borderTopRightRadius: size * r,
              borderBottomRightRadius: size * r,
              borderWidth: 1.5,
              borderLeftWidth: 0,
              borderColor: color,
              opacity: 0.8 - i * 0.3,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Down, level, up — the three graphics presets, as a direction rather than a word.
 *
 * "Low / Medium / High" are already on the pills; this says the same thing in a
 * shape, which is what lets the row be read at a glance instead of compared
 * three times. The middle one is a bar and not a chevron on purpose: medium is
 * not a weaker version of up, it is the absence of a direction.
 *
 * Built like `BackIcon` — each arm placed absolutely and then rotated, never
 * translated after rotating, because transforms compose and a translation after
 * a rotation runs along the rotated axis.
 */
export function LevelIcon({
  direction,
  size = 24,
  color = Luxe.text,
}: IconProps & { direction: 'down' | 'level' | 'up' }) {
  const arm = size * 0.34;
  const weight = Math.max(2, size * 0.1);

  if (direction === 'level') {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <View
          style={{
            width: arm * 1.7,
            height: weight,
            borderRadius: weight / 2,
            backgroundColor: color,
          }}
        />
      </View>
    );
  }

  // Up points the vertex at the top, so the arms fall away from it; down is the
  // same shape mirrored.
  const rise = direction === 'up' ? -1 : 1;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ width: arm * 1.7, height: arm }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: arm / 2 - weight / 2,
            width: arm,
            height: weight,
            borderRadius: weight / 2,
            backgroundColor: color,
            transform: [{ rotate: `${rise * 40}deg` }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: arm / 2 - weight / 2,
            width: arm,
            height: weight,
            borderRadius: weight / 2,
            backgroundColor: color,
            transform: [{ rotate: `${-rise * 40}deg` }],
          }}
        />
      </View>
    </View>
  );
}

/** A chevron, for going back. Drawn from two bars so it keeps its weight. */
export function BackIcon({ size = 24, color = Luxe.text }: IconProps) {
  const arm = size * 0.42;
  const weight = Math.max(2, size * 0.09);

  /**
   * Two bars meeting at a point, positioned by layout rather than by transform.
   *
   * The first version rotated each bar and then translated it, which does not do
   * what it reads as: transforms compose, so the translation happened along the
   * *rotated* axis and moved each bar diagonally instead of up and down. The two
   * halves never met, and at 7px long there was too little of them to see what
   * had gone wrong — the chevron simply vanished.
   *
   * Here each bar is placed absolutely at its own corner and only rotated, so
   * where it sits and which way it points are independent.
   */
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ width: arm, height: arm * 1.4 }}>
        <View
          style={{
            position: 'absolute',
            top: arm * 0.7 - weight / 2 - arm * 0.35,
            width: arm,
            height: weight,
            borderRadius: weight / 2,
            backgroundColor: color,
            transform: [{ rotate: '-45deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: arm * 0.7 - weight / 2 + arm * 0.35,
            width: arm,
            height: weight,
            borderRadius: weight / 2,
            backgroundColor: color,
            transform: [{ rotate: '45deg' }],
          }}
        />
      </View>
    </View>
  );
}

/**
 * The back button.
 *
 * A panel with a chevron in it, not a bare glyph. The screens sit over a live
 * scene now, and an unbacked mark in a corner disappears the moment a lit rail
 * drifts under it — the same reason the menu panels became opaque. One component
 * rather than the identical block repeated on three screens.
 */
export function BackButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        playTap();
        onPress();
      }}
      // A larger touch target than the panel it draws, so the button is easy to
      // hit without being visually heavy.
      hitSlop={10}
      style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}>
      <BackIcon size={20} color={Luxe.text} />
    </Pressable>
  );
}

/**
 * A ball with a dotted line leaving it: the aim line.
 *
 * The dashes are the point — a solid line would read as a cue or a rail, while
 * a broken one reads as a path something is going to take.
 */
export function AimLineIcon({ size = 24, color = Luxe.text }: IconProps) {
  const ball = size * 0.3;
  const dash = size * 0.12;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={[styles.row, { alignItems: 'center', gap: size * 0.07 }]}>
        <View
          style={{
            width: ball,
            height: ball,
            borderRadius: ball / 2,
            borderWidth: 1.5,
            borderColor: color,
          }}
        />
        {[0.9, 0.65, 0.4].map((opacity, i) => (
          <View
            key={i}
            style={{ width: dash, height: 1.5, backgroundColor: color, opacity }}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * A ball with a mark off centre: the contact point.
 *
 * The mark sits high and to one side rather than in the middle, because centred
 * is precisely the state that means *no* english — an icon showing it would be
 * the icon for the feature switched off.
 */
export function SpinIcon({ size = 24, color = Luxe.text }: IconProps) {
  const ball = size * 0.74;
  const mark = size * 0.16;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: ball,
          height: ball,
          borderRadius: ball / 2,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: mark,
          height: mark,
          borderRadius: mark / 2,
          backgroundColor: color,
          transform: [{ translateX: ball * 0.22 }, { translateY: -ball * 0.22 }],
        }}
      />
    </View>
  );
}

/**
 * A video camera: a body with the lens barrel out one side.
 *
 * The distinction matters here, because the button changes the *view* and never
 * captures anything. A round lens centred in a rectangle is the universal sign
 * for a stills camera — it says "take a picture of this", which is the one thing
 * this control does not do. The barrel out the side is what makes it a camera
 * that is pointed rather than fired.
 *
 * An earlier attempt at this shape failed on proportion rather than idea: the
 * body took only three fifths of the box and the barrel was a solid triangle
 * tacked to it, which read as a box with a wedge beside it. This gives the body
 * the room it needs and draws the barrel as an outlined trapezium — the same
 * hairline weight as everything else here, so it reads as part of the object
 * instead of a blob attached to it.
 */
export function CameraIcon({ size = 24, color = Luxe.text }: IconProps) {
  const height = size * 0.54;
  const body = size * 0.62;
  const barrel = size * 0.26;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={[styles.row, { alignItems: 'center' }]}>
        <View
          style={{
            width: body,
            height,
            borderRadius: size * 0.09,
            borderWidth: 1.5,
            borderColor: color,
          }}
        />

        {/*
          The barrel: outlined, and butted against the body.

          Its left edge is dropped so the two shapes share a join rather than
          drawing a line down the middle of it — one object with a snout, not two
          rectangles touching.

          Square rather than tapered. A trapezium would be truer to a real lens
          housing, and both ways of getting one here are worse than the shape is
          better: a `rotateY` with perspective renders differently across
          platforms and can collapse the view outright, and a border-triangle is
          solid, which puts a filled wedge next to hairline strokes.
        */}
        <View
          style={{
            width: barrel,
            height: height * 0.6,
            marginLeft: -1.5,
            borderWidth: 1.5,
            borderLeftWidth: 0,
            borderColor: color,
            borderTopRightRadius: size * 0.06,
            borderBottomRightRadius: size * 0.06,
          }}
        />
      </View>
    </View>
  );
}

/**
 * A chevron, drawn from two strokes rather than set as ◀ or ▶.
 *
 * The glyphs are solid triangles at whatever weight the system font gives them,
 * which next to hairline-drawn icons reads as a different vocabulary. Two thin
 * bars meeting at a point match the rest.
 */
export function ChevronIcon({
  direction = 'right',
  size = 24,
  color = Luxe.text,
}: IconProps & { direction?: 'left' | 'right' }) {
  const arm = size * 0.42;
  const lean = direction === 'right' ? 1 : -1;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          position: 'absolute',
          width: 1.8,
          height: arm,
          borderRadius: 1,
          backgroundColor: color,
          transform: [
            { translateY: -arm / 2.6 },
            { rotate: `${lean * 38}deg` },
          ],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 1.8,
          height: arm,
          borderRadius: 1,
          backgroundColor: color,
          transform: [
            { translateY: arm / 2.6 },
            { rotate: `${-lean * 38}deg` },
          ],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Luxe.hairlineStrong,
    backgroundColor: '#141a17',
  },
  backPressed: {
    backgroundColor: '#222b27',
  },
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  /** A row sitting on a common floor, for scales drawn out of shapes. */
  ballRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
