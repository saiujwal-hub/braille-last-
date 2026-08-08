"""Cell detection: YOLO (fine-tuned on DSBI) with a geometric fallback.

The deployed path is:
    - if a YOLO model is loaded, run it;
    - merge with the geometric result when both produced plausible cell counts
      (helps on messy photos where either method alone misses cells);
    - otherwise fall back to geometric alone so the pipeline always runs.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from ..config import get_config
from ..logging_conf import get_logger
from .cells import detect_cells_geometric

log = get_logger("app.pipeline.detect")


def _yolo_boxes(model: Any, img: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Run YOLO and return (x, y, w, h) boxes for class 0 (cell)."""
    cfg = get_config()
    if model is None:
        return []
    results = model.predict(
        img,
        imgsz=cfg.models.yolo_imgsz,
        conf=cfg.models.yolo_conf,
        iou=cfg.models.yolo_iou,
        classes=[cfg.models.yolo_class],
        verbose=False,
    )
    boxes: list[tuple[int, int, int, int]] = []
    if not results:
        return boxes
    for r in results:
        if r.boxes is None:
            continue
        for b in r.boxes.xyxy.tolist():
            x1, y1, x2, y2 = b
            boxes.append((int(x1), int(y1), int(x2 - x1), int(y2 - y1)))
    return boxes


def detect_cells(model: Any, binary: np.ndarray, color: np.ndarray) -> tuple[list[tuple[int, int, int, int]], str]:
    """Detect cell boxes. Returns (boxes, detector_name)."""
    geo = detect_cells_geometric(binary)
    yolo = _yolo_boxes(model, color) if model is not None else []

    if model is not None and yolo and geo:
        # Merge: keep YOLO boxes, then append geometric cells not overlapping one.
        merged = list(yolo)
        for gx, gy, gw, gh in geo:
            if not _overlaps((gx, gy, gw, gh), yolo, overlap=0.3):
                merged.append((gx, gy, gw, gh))
        return merged, "merged"

    if yolo:
        return yolo, "yolo"

    return geo, "geometric"


def _overlaps(box: tuple[int, int, int, int], others: list[tuple[int, int, int, int]], overlap: float = 0.3) -> bool:
    x1, y1, w, h = box
    a = _area(x1, y1, w, h)
    if a <= 0:
        return False
    for ox, oy, ow, oh in others:
        ix = max(0, min(x1 + w, ox + ow) - max(x1, ox))
        iy = max(0, min(y1 + h, oy + oh) - max(y1, oy))
        if (ix * iy) / a >= overlap:
            return True
    return False


def _area(x: int, y: int, w: int, h: int) -> float:
    return float(max(0, w) * max(0, h))
