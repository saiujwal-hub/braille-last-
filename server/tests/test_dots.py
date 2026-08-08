"""Unit tests for the per-cell dot OCR and the geometric cell detector."""

import cv2
import numpy as np

from app.pipeline.cells import detect_cells_geometric
from app.pipeline.dots import decode_cell, dot_radius_from_cell
from app.pipeline.translate import char_to_mask
from tests.helpers import _cell_centers, _DOT_OFFSETS, CELL_H, CELL_W, render_page


def _binary_from_page(img: np.ndarray) -> np.ndarray:
    gray = img if img.ndim == 2 else cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Match the pipeline convention: raised dots are dark -> 0 in the binary image.
    _, bin_ = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return bin_


def test_dot_radius_estimate():
    assert dot_radius_from_cell(40, 60) > 0


def test_decode_cell_dot_3_present():
    # letter 'l' = dots 1,2,3 (mask 7)
    page = render_page(["l"], jpeg=False)
    binary = _binary_from_page(page)
    (cx, cy), = _cell_centers("l")
    x, y = int(cx - CELL_W / 2), int(cy - CELL_H / 2)
    mask, conf = decode_cell(binary, x, y, CELL_W, CELL_H)
    assert mask == char_to_mask("l")
    assert conf >= 0.5


def test_decode_empty_cell_is_space():
    # space = mask 0: render a cell position with no dots.
    img = np.full((80, 80), 240, dtype=np.uint8)
    mask, _ = decode_cell(img, 20, 20, CELL_W, CELL_H)
    assert mask == 0


def test_geometric_detector_finds_cells_for_hello():
    page = render_page(["hello"], jpeg=False)
    binary = _binary_from_page(page)
    cells = detect_cells_geometric(binary)
    # 5 cells -> 10 dot columns -> at least 5 cell boxes.
    assert len(cells) >= 5
    # All boxes within image bounds.
    h, w = binary.shape
    for x, y, bw, bh in cells:
        assert x >= 0 and y >= 0 and x + bw <= w + 4 and y + bh <= h + 4


def test_geometric_detector_two_lines():
    page = render_page(["hi", "me"], jpeg=False)
    binary = _binary_from_page(page)
    cells = detect_cells_geometric(binary)
    # 4 cells in two lines -> expect >= 4 boxes with two distinct y clusters.
    assert len(cells) >= 4
    ys = sorted({int(y) for _, y, _, _ in cells})
    assert len(ys) >= 2


def test_full_mask_roundtrip():
    """Every dot position individually produces exactly its bit."""
    img = np.full((90, 90), 240, dtype=np.uint8)
    x, y, w, h = 25, 15, CELL_W, CELL_H
    for bit, (fx, fy) in enumerate(_DOT_OFFSETS):
        fresh = img.copy()
        dx, dy = x + fx * w, y + fy * h
        cv2.circle(fresh, (int(dx), int(dy)), 6, 0, -1)
        mask, _ = decode_cell(fresh, x, y, w, h)
        assert mask == (1 << bit), f"bit {bit} misdetected: {mask:#06b}"
