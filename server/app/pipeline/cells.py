"""Geometric fallback cell detector (no ML needed).

Used when the YOLO cell detector is not configured (e.g. before training), or merged
with it. Strategy (ported from the proven PWA pipeline):
  1. connected components -> dot centroids;
  2. cluster centroids into horizontal rows;
  3. group rows into dot-triples (lines), using the braille ratio
     within-line spacing : line gap ~ 1 : 2;
  4. within each line, cluster columns into dot-pairs and fuse each pair into a cell box.

Returns a list of cell boxes (x, y, w, h) sorted by (line, column).
"""

from __future__ import annotations

import cv2
import numpy as np

from ..logging_conf import get_logger

log = get_logger("app.pipeline.cells")


def _dot_centroids(binary: np.ndarray, min_area: int = 4, max_area: int = 900) -> list[tuple[float, float]]:
    """Centroids of dark connected components that look like dots."""
    h_img, w_img = binary.shape
    n, labels, stats, _ = cv2.connectedComponentsWithStats(255 - binary, connectivity=8)
    out: list[tuple[float, float]] = []
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < min_area or area > max_area:
            continue
        x = int(stats[i, cv2.CC_STAT_LEFT])
        y = int(stats[i, cv2.CC_STAT_TOP])
        w = int(stats[i, cv2.CC_STAT_WIDTH])
        h = int(stats[i, cv2.CC_STAT_HEIGHT])
        # Ignore blobs in the top 5% or bottom 8% of the image to filter out paper edges and camera watermarks
        cy = y + h / 2.0
        if cy < h_img * 0.05 or cy > h_img * 0.92:
            continue
        # Dot shape check: roughly round.
        if w > 3 * h or h > 3 * w:
            continue
        cx = x + w / 2.0
        out.append((cx, cy))
    return out


def _cluster_1d(values: list[float], tol: float) -> list[list[float]]:
    """Greedy 1D clustering into groups whose spread <= tol."""
    sorted_vals = sorted(values)
    clusters: list[list[float]] = []
    for v in sorted_vals:
        if clusters and v - clusters[-1][-1] <= tol:
            clusters[-1].append(v)
        else:
            clusters.append([v])
    return clusters


def _cluster_rows(cy: list[float], tol: float) -> list[tuple[float, list[float]]]:
    """Return (mean_y, ys_in_row) for each detected dot row."""
    clusters = _cluster_1d(cy, tol)
    return [(float(np.mean(c)), c) for c in clusters if len(c) > 0]


def _group_into_lines(rows: list[float], tol: float) -> list[list[float]]:
    """Group dot-row Y positions into braille lines (triples with 1:2 spacing)."""
    if len(rows) < 3:
        return [rows] if rows else []
    rows_sorted = sorted(rows)
    lines: list[list[float]] = []
    current: list[float] = [rows_sorted[0]]
    for i in range(1, len(rows_sorted)):
        gap = rows_sorted[i] - rows_sorted[i - 1]
        if len(current) < 3 and gap <= 1.6 * tol:
            current.append(rows_sorted[i])
        else:
            lines.append(current)
            current = [rows_sorted[i]]
    if current:
        lines.append(current)
    return lines


def detect_cells_geometric(binary: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Detect braille cell boxes without any ML. Returns (x, y, w, h) boxes."""
    dots = _dot_centroids(binary)
    if len(dots) < 4:
        return []

    ys = [d[1] for d in dots]
    xs = [d[0] for d in dots]
    # Tolerance ≈ 0.75 * the typical dot pitch. Nearest-neighbour distance is unreliable
    # (same-row dots give ~0), and the median of positive pairwise y-differences is
    # inflated by across-line gaps, so use the 25th percentile (robust to outliers).
    ys_arr = np.array(ys)
    diffs = np.abs(ys_arr[:, None] - ys_arr)
    diffs = diffs[diffs > 1e-6]
    tol = float(np.percentile(diffs, 25)) * 0.75 + 1e-3 if diffs.size else 1.0
    tol = max(tol, 1.0)

    rows = _cluster_rows(ys, tol)
    row_ys = [r[0] for r in rows]
    lines = _group_into_lines(row_ys, tol)

    cells: list[tuple[int, int, int, int]] = []
    for line_rows in lines:
        # Collect dot centroids whose y belongs to any row of this line.
        lo = min(line_rows) - tol
        hi = max(line_rows) + tol
        line_dots = [(x, y) for (x, y) in dots if lo <= y <= hi]
        if not line_dots:
            continue
        xclusters = _cluster_1d([d[0] for d in line_dots], tol)
        # Braille columns come in pairs (dot1-3, dot4-6) with 1:2 spacing.
        # Group x-cluster centres into adjacent pairs.
        x_centers = [float(np.mean(c)) for c in xclusters]
        pairs = _pair_x_centers(x_centers, tol)
        for left, right in pairs:
            # Box spans one full dot pitch beyond the outer columns/rows, so the
            # 6 dot positions sit at exact fractions of the box: columns at
            # 0.25/0.75 and rows at 1/6, 3/6, 5/6.
            s = right - left  # intra-cell dot pitch
            if s <= 0:
                s = tol * 1.5
            x0 = left - s / 2
            x1 = right + s / 2
            y_min = min(line_rows) - s / 2
            y_max = max(line_rows) + s / 2
            w = int(round(x1 - x0))
            h = int(round(y_max - y_min))
            cells.append((int(round(x0)), int(round(y_min)), w, h))

    # Order by (line index, column).
    cells.sort(key=lambda c: (c[1], c[0]))
    return cells


def _pair_x_centers(centers: list[float], tol: float) -> list[tuple[float, float]]:
    """Pair neighbouring dot-columns into (dot1-3 col, dot4-6 col) cells.

    Letters like 'a' (dot1 only) have a single raised column; for those we synthesize a
    partner column using the median cell width so the cell is still detected.
    """
    if not centers:
        return []
    centers = sorted(centers)
    pairs: list[tuple[float, float]] = []
    i = 0
    while i < len(centers) - 1:
        gap = centers[i + 1] - centers[i]
        if gap <= 2.4 * tol:  # within-cell pair
            pairs.append((centers[i], centers[i + 1]))
            i += 2
        else:
            i += 1

    if not pairs:
        # Nothing paired: assume a reasonable cell width from the dot spacing.
        med_w = 1.8 * tol
    else:
        widths = [r - l for (l, r) in pairs]
        med_w = float(np.median(widths))

    # Attach lone columns to the nearest cell as a synthetic partner.
    paired_left = {l for (l, r) in pairs}
    paired_right = {r for (l, r) in pairs}
    used = paired_left | paired_right
    for c in centers:
        if c in used:
            continue
        pairs.append((c, c + med_w))
    return sorted(pairs, key=lambda p: p[0])
