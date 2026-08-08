"""Automatic page orientation (AngelinaReader idea) + verso handling.

Slate-and-stylus pages are photographed in any of four rotations. Trying all four
rotations and keeping the one that produces the most plausible Braille is cheap and
removes a whole class of user errors. Double-sided paper is handled with the
"verso trick": invert the image and flip it horizontally.
"""

from __future__ import annotations

import cv2
import numpy as np

from .translate import braille_mask_to_char, char_confidence

# Number of "valid" braille characters per orientation needed before we accept it.
# If every orientation fails, the caller falls back to a heuristic / warns the user.
_MIN_VALID = 2


def _rotate(img: np.ndarray, k: int) -> np.ndarray:
    """Rotate 90° clockwise k times."""
    return np.rot90(img, k=-k)  # negative k => clockwise


def _horizontal_flip(img: np.ndarray) -> np.ndarray:
    return cv2.flip(img, 1)


def _invert(img: np.ndarray) -> np.ndarray:
    return 255 - img


def _count_valid(binary: np.ndarray, cells: list[tuple[int, int, int, int]], dot_radius: int) -> tuple[int, float]:
    """Count cells whose 6-dot mask decodes to a confident character."""
    valid = 0
    total_conf = 0.0
    checked = 0
    for x, y, w, h in cells:
        mask = _mask_from_cell(binary, x, y, w, h, dot_radius)
        conf = char_confidence(mask)
        checked += 1
        if conf >= 0.0 and braille_mask_to_char(mask) != "?":
            valid += 1
            total_conf += conf
    return valid, (total_conf / checked if checked else 0.0)


def _mask_from_cell(binary: np.ndarray, x: int, y: int, w: int, h: int, dot_radius: int) -> int:
    """Placeholder re-export of the per-cell mask extraction (see dots.py)."""
    from .dots import extract_mask_from_cell

    return extract_mask_from_cell(binary, x, y, w, h, dot_radius)


def best_orientation(binary: np.ndarray, cells: list[tuple[int, int, int, int]], dot_radius: int) -> int:
    """Return k (0..3) = number of clockwise 90° rotations to apply for the best text.

    Heuristic fallback: the standard Braille page orientation (0°) when tie/uncertain.
    """
    scores: list[tuple[int, float, float]] = []  # (valid, conf, k)
    for k in range(4):
        rotated = _rotate(binary, k)
        # Transform cells accordingly (x,y)->rotated coords for the 2x2.. careful:
        # we rotate the *image*, so recompute cell boxes by transforming corners.
        rot_cells = _transform_cells(cells, binary.shape, k)
        valid, conf = _count_valid(rotated, rot_cells, dot_radius)
        scores.append((valid, conf, k))

    scores.sort(key=lambda t: (t[0], t[1]), reverse=True)
    best = scores[0]
    if best[0] >= _MIN_VALID:
        return int(best[2])
    return 0


def _transform_cells(
    cells: list[tuple[int, int, int, int]], shape: tuple[int, int], k: int
) -> list[tuple[int, int, int, int]]:
    """Map cell boxes from the original image into the k-times-rotated frame.

    Uses the centre convention for a 90° clockwise rotation of shape (H, W):
        (cx, cy) -> (H - cy, cx)      frame becomes (W, H)
    so the frame dimensions are updated after each step.
    """
    h, w = shape[:2]
    out = []
    for x, y, bw, bh in cells:
        cx, cy = x + bw / 2.0, y + bh / 2.0
        rh, rw = h, w  # frame dimensions as we rotate
        for _ in range(k % 4):
            cx, cy = rh - cy, cx
            rh, rw = rw, rh
        out.append((int(cx - bw / 2), int(cy - bh / 2), bw, bh))
    return out


def verso_handle(binary: np.ndarray, cells: list[tuple[int, int, int, int]], dot_radius: int) -> tuple[np.ndarray, list[tuple[int, int, int, int]]]:
    """Attempt the verso (back-of-page) trick: invert + horizontal flip.

    Returns (transformed_binary, transformed_cells) when it scores strictly better than
    the unflipped image, else the originals.
    """
    inverted = _invert(binary)
    flipped = _horizontal_flip(inverted)
    flip_cells = _transform_flip(cells, binary.shape[1])

    current, _ = _count_valid(binary, cells, dot_radius)
    candidate, _ = _count_valid(flipped, flip_cells, dot_radius)
    if candidate > current:
        return flipped, flip_cells
    return binary, cells


def _transform_flip(cells: list[tuple[int, int, int, int]], width: int) -> list[tuple[int, int, int, int]]:
    return [(width - (x + w), y, w, h) for (x, y, w, h) in cells]
