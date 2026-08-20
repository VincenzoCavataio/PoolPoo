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
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
