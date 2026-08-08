"""Synthetic Braille page generator shared by tests.

Renders the exact slate-and-stylus dot pattern (raised dots = dark) for a given English
string onto a clean light background, matching the geometry the detector assumes.
"""

from __future__ import annotations

import cv2
import numpy as np

from app.pipeline.translate import char_to_mask

CELL_W, CELL_H = 40, 60  # cell box dimensions
DOT_RADIUS = 6
DX, DY = CELL_W / 2, CELL_H / 3  # intra-cell dot spacing
CELL_GAP_X = 2 * DX  # 40
LINE_GAP_Y = 2 * DY  # 40
MARGIN = 20

_DOT_OFFSETS = (
    (0.25, 1 / 6),
    (0.25, 3 / 6),
    (0.25, 5 / 6),
    (0.75, 1 / 6),
    (0.75, 3 / 6),
    (0.75, 5 / 6),
)


def _cell_centers(text: str, line: int = 0) -> list[tuple[float, float]]:
    centers = []
    for i, ch in enumerate(text):
        cx = MARGIN + i * (CELL_W + CELL_GAP_X) + CELL_W / 2
        cy = MARGIN + line * (CELL_H + LINE_GAP_Y) + CELL_H / 2
        centers.append((cx, cy))
    return centers


def render_page(lines: list[str], jpeg: bool = True) -> np.ndarray | bytes:
    """Render text lines as a synthetic Braille page (light paper, dark dots)."""
    n_cols = max(len(ln) for ln in lines) if lines else 0
    width = int(MARGIN * 2 + n_cols * (CELL_W + CELL_GAP_X))
    height = int(MARGIN * 2 + len(lines) * (CELL_H + LINE_GAP_Y))
    img = np.full((height, width), 240, dtype=np.uint8)

    for line_i, text in enumerate(lines):
        for (cx, cy), ch in zip(_cell_centers(text, line_i), text):
            mask = char_to_mask(ch)
            if mask is None:
                continue
            for bit, (fx, fy) in enumerate(_DOT_OFFSETS):
                if mask & (1 << bit):
                    dx, dy = cx - CELL_W / 2 + fx * CELL_W, cy - CELL_H / 2 + fy * CELL_H
                    cv2.circle(img, (int(dx), int(dy)), DOT_RADIUS, 10, -1)
    if jpeg:
        ok, buf = cv2.imencode(".jpg", img)
        assert ok
        return buf.tobytes()
    return img


def render_page_bytes(lines: list[str]) -> bytes:
    return render_page(lines, jpeg=True)
