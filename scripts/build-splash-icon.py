"""
Draws the splash icon: the eight ball, matching the title screen's.

Written out rather than kept as a binary asset so the one shape the app opens
with has a source. The title screen builds the same ball from three views —
sphere, sheen, numbered disc — and this is the same three, rasterised, so the
native splash and the screen that replaces it show the same object.

No dependency: the project has no image library, and adding one to draw a
circle would cost more than the fifty lines of PNG encoder below.
"""

import math
import struct
import zlib

SIZE = 512          # generous: the native splash scales it down to imageWidth
BALL = 0x14, 0x14, 0x14
BADGE = 0xF4, 0xF1, 0xE8
INK = 0x0C, 0x13, 0x10

# Proportions lifted from the title screen's stylesheet, as fractions of the ball.
BADGE_R = 0.21
SHEEN_OFFSET = -0.27, -0.21
SHEEN_R = 0.45
RIM = 0.14


def coverage(dx, dy, r, samples=3):
    """Fractional cover of one pixel by a circle, sampled on a grid."""
    hit = 0
    step = 1.0 / (samples + 1)
    for sy in range(samples):
        for sx in range(samples):
            ox = (sx + 1) * step - 0.5
            oy = (sy + 1) * step - 0.5
            if math.hypot(dx + ox, dy + oy) <= r:
                hit += 1
    return hit / (samples * samples)


def mix(base, over, alpha):
    return tuple(round(b + (o - b) * alpha) for b, o in zip(base, over))


def draw():
    half = SIZE / 2
    radius = half * 0.94
    rows = []

    for y in range(SIZE):
        row = bytearray()
        for x in range(SIZE):
            dx = x - half + 0.5
            dy = y - half + 0.5

            # Transparent outside the ball, so the splash background shows.
            inside = coverage(dx, dy, radius)
            if inside <= 0:
                row += bytes((0, 0, 0, 0))
                continue

            colour = BALL

            # The rim of light that separates a dark ball from a dark room.
            edge = coverage(dx, dy, radius * 0.975)
            if edge < 1:
                colour = mix(colour, (255, 255, 255), (1 - edge) * RIM)

            # The lit side, up and to the left, where the room's lamps are.
            #
            # Falls off smoothly rather than ending on an edge. A hard-edged
            # highlight cuts the ball in two — it reads as a shape laid on top
            # of the sphere instead of as light falling across it.
            sx = dx - SHEEN_OFFSET[0] * radius * 2
            sy = dy - SHEEN_OFFSET[1] * radius * 2
            reach = radius * SHEEN_R * 2
            d = math.hypot(sx, sy)
            if d < reach:
                falloff = 1 - (d / reach)
                colour = mix(colour, (255, 255, 255), falloff * falloff * 0.13)

            # The numbered disc.
            badge = coverage(dx, dy, radius * BADGE_R * 2)
            if badge > 0:
                colour = mix(colour, BADGE, badge)

            row += bytes((*colour, round(inside * 255)))
        rows.append(row)

    return rows


def numeral(rows):
    """Stamps an 8 into the badge, drawn as two rings."""
    half = SIZE / 2
    radius = half * 0.94
    r = radius * BADGE_R * 2
    # Two circles stacked, the lower slightly larger, as an 8 is set.
    for cy, rr, weight in ((-r * 0.30, r * 0.34, 0.115), (r * 0.33, r * 0.40, 0.125)):
        for y in range(SIZE):
            for x in range(SIZE):
                dx = x - half + 0.5
                dy = y - half + 0.5 - cy
                d = math.hypot(dx, dy)
                thick = r * weight
                if abs(d - rr) <= thick:
                    # Rows are per-scanline, so the index is the pixel within
                    # this row rather than an offset into the whole image.
                    i = x * 4
                    if rows[y][i + 3] == 0:
                        continue
                    fade = 1 - max(0.0, (abs(d - rr) - thick * 0.5) / (thick * 0.5))
                    a = min(1.0, max(0.0, fade))
                    px = mix(tuple(rows[y][i:i + 3]), (0x14, 0x14, 0x14), a)
                    rows[y][i:i + 3] = bytes(px)
    return rows


def encode(rows, path):
    raw = b''.join(b'\x00' + bytes(r) for r in rows)

    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body))

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')

    with open(path, 'wb') as handle:
        handle.write(png)


if __name__ == '__main__':
    encode(numeral(draw()), 'assets/images/splash-icon.png')
    print('wrote assets/images/splash-icon.png')
