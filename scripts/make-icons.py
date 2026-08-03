#!/usr/bin/env python3
"""Рисует иконки расширения без внешних зависимостей.

Скруглённый тёмный квадрат, белая стрелка вниз, черта-основание под ней.
Сглаживание получается за счёт отрисовки в четыре раза крупнее и усреднения.
"""

import pathlib
import struct
import zlib

SCALE = 4
SIZES = (16, 32, 48, 128)
BACKGROUND = (23, 24, 26, 255)
FOREGROUND = (255, 255, 255, 255)
OUT_DIR = pathlib.Path(__file__).resolve().parent.parent / "icons"


def inside_rounded_rect(x, y, size, radius):
    if x < 0 or y < 0 or x >= size or y >= size:
        return False
    cx = min(max(x, radius), size - radius)
    cy = min(max(y, radius), size - radius)
    dx = x - cx
    dy = y - cy
    return dx * dx + dy * dy <= radius * radius


def inside_triangle(x, y, a, b, c):
    def sign(p, q, r):
        return (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])

    d1 = sign((x, y), a, b)
    d2 = sign((x, y), b, c)
    d3 = sign((x, y), c, a)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def render(size):
    big = size * SCALE
    radius = big * 0.235
    pixels = bytearray(big * big * 4)

    shaft_left = big * 0.445
    shaft_right = big * 0.555
    shaft_top = big * 0.20
    shaft_bottom = big * 0.50

    head = ((big * 0.30, big * 0.46), (big * 0.70, big * 0.46), (big * 0.50, big * 0.70))

    base_left = big * 0.28
    base_right = big * 0.72
    base_top = big * 0.78
    base_bottom = big * 0.845

    for y in range(big):
        for x in range(big):
            offset = (y * big + x) * 4
            px = x + 0.5
            py = y + 0.5

            if not inside_rounded_rect(px, py, big, radius):
                continue

            color = BACKGROUND
            in_shaft = shaft_left <= px <= shaft_right and shaft_top <= py <= shaft_bottom
            in_base = base_left <= px <= base_right and base_top <= py <= base_bottom
            if in_shaft or in_base or inside_triangle(px, py, *head):
                color = FOREGROUND

            pixels[offset:offset + 4] = bytes(color)

    return downsample(pixels, big, size)


def downsample(pixels, big, size):
    out = bytearray(size * size * 4)
    span = SCALE * SCALE
    for y in range(size):
        for x in range(size):
            totals = [0, 0, 0, 0]
            for sy in range(SCALE):
                for sx in range(SCALE):
                    offset = ((y * SCALE + sy) * big + (x * SCALE + sx)) * 4
                    alpha = pixels[offset + 3]
                    totals[0] += pixels[offset] * alpha
                    totals[1] += pixels[offset + 1] * alpha
                    totals[2] += pixels[offset + 2] * alpha
                    totals[3] += alpha
            alpha_sum = totals[3]
            target = (y * size + x) * 4
            if alpha_sum == 0:
                out[target:target + 4] = b"\x00\x00\x00\x00"
                continue
            out[target] = totals[0] // alpha_sum
            out[target + 1] = totals[1] // alpha_sum
            out[target + 2] = totals[2] // alpha_sum
            out[target + 3] = alpha_sum // span
    return out


def write_png(path, size, pixels):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        raw.extend(pixels[y * size * 4:(y + 1) * size * 4])

    def chunk(tag, payload):
        data = tag + payload
        return struct.pack(">I", len(payload)) + data + struct.pack(">I", zlib.crc32(data))

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    blob = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(blob)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        write_png(OUT_DIR / f"icon{size}.png", size, render(size))
        print(f"icons/icon{size}.png")


if __name__ == "__main__":
    main()
