"""Per-cell Braille dot OCR (the "reader" stage).

Given a detected cell box on the binary image, evaluate the 6 standard dot positions
and decide which are raised. This is deliberately simple and auditable: for each of the
6 positions we measure the local dark-pixel density and threshold it. No ML here — the
pretrained models are used for enhancement and (optionally) cell detection only, keeping
the reading step transparent for the hackathon judges.

Braille cell layout (front/raised side):
    dot1  dot4
    dot2  dot5
    dot3  dot6

Bit convention: mask bit0 = dot1 ... bit5 = dot6.
"""

from __future__ import annotations

import math

import cv2
import numpy as np

from ..config import get_config

# The six (col, row) positions inside a normalized cell box, as fractions.
_DOT_POS = (
    (0.25, 1 / 6),  # dot1
    (0.25, 3 / 6),  # dot2
    (0.25, 5 / 6),  # dot3
    (0.75, 1 / 6),  # dot4
    (0.75, 3 / 6),  # dot5
    (0.75, 5 / 6),  # dot6
)


def dot_radius_from_cell(w: int, h: int) -> float:
    """Estimate a dot sampling radius from cell dimensions.

    A cell box spans two dot pitches wide (w = 2 * pitch); a raised dot's radius is
    ~0.3 * pitch, so 0.15 * w ≈ the dot radius. Kept small so the dark-fraction measure
    is dominated by the dot, not the surrounding paper.
    """
    return max(1.0, 0.15 * w)


def _dark_fraction(binary: np.ndarray, cx: float, cy: float, radius: float) -> float:
    """Fraction of dark pixels (raised dot = dark, value 0) inside a circle."""
    h, w = binary.shape
    ys, xs = np.ogrid[0:h, 0:w]
    dist2 = (xs - cx) ** 2 + (ys - cy) ** 2
    mask = dist2 <= radius * radius
    if mask.sum() == 0:
        return 0.0
    dark = binary[mask] == 0
    return float(dark.mean())


def extract_mask_from_cell(binary: np.ndarray, x: int, y: int, w: int, h: int, dot_radius: int | None = None) -> int:
    """Return the 6-bit mask for one cell (threshold from config)."""
    cfg = get_config()
    radius = dot_radius or dot_radius_from_cell(w, h)
    mask = 0
    for bit, (fx, fy) in enumerate(_DOT_POS):
        cx = x + fx * w
        cy = y + fy * h
        if _dark_fraction(binary, cx, cy, radius) >= cfg.ocr.dot_threshold:
            mask |= 1 << bit
    return mask


def dot_scores(binary: np.ndarray, x: int, y: int, w: int, h: int, dot_radius: int | None = None) -> list[float]:
    """Per-dot dark fractions (for the debug overlay / confidence)."""
    radius = dot_radius or dot_radius_from_cell(w, h)
    return [_dark_fraction(binary, x + fx * w, y + fy * h, radius) for (fx, fy) in _DOT_POS]


def cell_confidence(binary: np.ndarray, x: int, y: int, w: int, h: int, mask: int, dot_radius: int | None = None) -> float:
    """Confidence in the mask: how far each dot's density sits from the decision line.

    Returns 0..1 where 1.0 means every dot was measured decisively on its correct side
    of the threshold.
    """
    cfg = get_config()
    threshold = cfg.ocr.dot_threshold
    scores = dot_scores(binary, x, y, w, h, dot_radius)
    if not scores:
        return 0.0
    margins = []
    for bit, score in enumerate(scores):
        present = bool(mask & (1 << bit))
        if present:
            margins.append(max(0.0, (score - threshold) / (1.0 - threshold)))
        else:
            margins.append(max(0.0, (threshold - score) / threshold))
    return float(sum(margins) / len(margins))


def decode_cell(binary: np.ndarray, x: int, y: int, w: int, h: int, dot_radius: int | None = None) -> tuple[int, float]:
    """Convenience: mask + confidence for one cell."""
    mask = extract_mask_from_cell(binary, x, y, w, h, dot_radius)
    conf = cell_confidence(binary, x, y, w, h, mask, dot_radius)
    return mask, conf


# Re-export for orientation.py to avoid a circular import cost.
def mask_from_cell(binary: np.ndarray, x: int, y: int, w: int, h: int, dot_radius: int) -> int:
    return extract_mask_from_cell(binary, x, y, w, h, dot_radius)
