"""End-to-end OCR pipeline orchestrator.

Stage order: decode -> quality gate -> (optional) Real-ESRGAN -> preprocess ->
detect cells -> orientation + verso -> per-cell OCR -> translate -> text assembly ->
confidence. Also builds the optional debug payload (base64 JPEGs + per-cell data).
"""

from __future__ import annotations

import base64
from typing import Optional

import cv2
import numpy as np

from ..config import get_config
from ..errors import NotBrailleError, TooFewDotsError
from ..logging_conf import get_logger
from ..models.loader import Models
from ..schemas import (
    CellResult,
    DebugDots,
    DebugPayload,
    QualityReport,
    ScanResponse,
)
from .detect import detect_cells
from .dots import decode_cell, dot_radius_from_cell
from .orientation import best_orientation, verso_handle
from .preprocess import decode_image, preprocess, to_gray
from .quality import assess_quality
from .translate import braille_mask_to_char, braille_unicode

log = get_logger("app.pipeline")


def _b64_jpeg(img: np.ndarray, quality: int = 82) -> str:
    """Encode an image as base64 JPEG for the debug payload."""
    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        return ""
    return base64.b64encode(buf.tobytes()).decode("ascii")


def _draw_boxes(img: np.ndarray, boxes: list[tuple[int, int, int, int]], color=(0, 200, 0)) -> np.ndarray:
    out = img.copy()
    for x, y, w, h in boxes:
        cv2.rectangle(out, (x, y), (x + w, y + h), color, 2)
    return out


def _draw_dots(img: np.ndarray, binary: np.ndarray, cells, color=(0, 0, 255)) -> tuple[np.ndarray, list[list[int]]]:
    """Draw per-cell detected dots and return their centroids."""
    out = cv2.cvtColor(binary.copy(), cv2.COLOR_GRAY2BGR)
    pts: list[list[int]] = []
    from .dots import dot_scores

    cfg = get_config()
    for x, y, w, h in cells:
        radius = dot_radius_from_cell(w, h)
        scores = dot_scores(binary, x, y, w, h)
        for bit, (fx, fy) in enumerate(((0.25, 1 / 6), (0.25, 3 / 6), (0.25, 5 / 6), (0.75, 1 / 6), (0.75, 3 / 6), (0.75, 5 / 6))):
            cx = int(x + fx * w)
            cy = int(y + fy * h)
            if scores[bit] >= cfg.ocr.dot_threshold:
                cv2.circle(out, (cx, cy), int(radius), color, -1)
                pts.append([cx, cy])
    return out, pts


def _assemble_lines(cells, binary: np.ndarray) -> tuple[list[str], list[CellResult], list[tuple[int, int]]]:
    """Group decoded cells into text lines; returns (lines, cell_results, uncertain)."""
    cfg = get_config()
    results: list[CellResult] = []
    uncertain: list[tuple[int, int]] = []
    for x, y, w, h in sorted(cells, key=lambda c: (c[1], c[0])):
        mask, conf = decode_cell(binary, x, y, w, h)
        char = braille_mask_to_char(mask)
        is_uncertain = conf < cfg.ocr.uncertain_threshold or char == "?"
        if is_uncertain:
            uncertain.append((y, x))
        results.append(
            CellResult(
                row=0,  # filled in below
                col=0,
                box=[x, y, w, h],
                mask=mask,
                unicode=braille_unicode(mask),
                character=char,
                confidence=round(conf, 3),
                uncertain=is_uncertain,
            )
        )

    if not results:
        return [], results, uncertain

    # Group into lines by vertical centre proximity (tolerance = half a cell).
    cells_sorted = sorted(results, key=lambda c: c.box[1])
    lines: list[list[CellResult]] = [[]]
    prev_y = cells_sorted[0].box[1] + cells_sorted[0].box[3] / 2
    for c in cells_sorted:
        cy = c.box[1] + c.box[3] / 2
        if abs(cy - prev_y) > max(1.0, c.box[3] * 0.6):
            lines.append([])
        lines[-1].append(c)
        prev_y = cy

    texts: list[str] = []
    final_results: list[CellResult] = []
    final_uncertain: list[tuple[int, int]] = []
    for row_i, line in enumerate(lines):
        line_sorted = sorted(line, key=lambda c: c.box[0])
        chars = []
        for col_i, c in enumerate(line_sorted):
            final_results.append(c.model_copy(update={"row": row_i, "col": col_i}))
            chars.append(c.character)
            if c.uncertain:
                final_uncertain.append((row_i, col_i))
        texts.append("".join(chars).replace("  ", " ").strip())

    return texts, final_results, final_uncertain


def _overall_confidence(results: list[CellResult]) -> float:
    if not results:
        return 0.0
    return round(float(np.mean([r.confidence for r in results])), 3)


def _maybe_enhance(img: np.ndarray, models: Models, force: Optional[bool]) -> tuple[np.ndarray, bool]:
    """Run Real-ESRGAN when the quality gate says the image is blurry."""
    cfg = get_config()
    gray = to_gray(img)
    q = assess_quality(gray)
    should = q["blurry"] if force is None else bool(force)

    if not should or models.enhancer is None or models.enhancer_loaded is False:
        return img, False

    try:
        enhanced, _ = models.enhancer.enhance(img, outscale=cfg.models.enhancer_scale)
        return enhanced, True
    except Exception as exc:  # noqa: BLE001
        log.warning("Enhancement failed, using original: %s", exc)
        return img, False


def run_pipeline(
    image_bytes: bytes,
    debug: bool = False,
    language: str = "en",
    force_enhance: Optional[bool] = None,
    models: Optional[Models] = None,
) -> ScanResponse:
    """Run the full OCR pipeline and produce a ScanResponse."""
    from ..models.loader import get_models

    models = models or get_models()
    cfg = get_config()

    img = decode_image(image_bytes)
    orig_b64 = _b64_jpeg(resize_max_dim_local(img)) if debug else None

    enhanced_img, was_enhanced = _maybe_enhance(img, models, force_enhance)
    q = assess_quality(to_gray(enhanced_img))
    if q["blurry"] and not was_enhanced and models.enhancer is None:
        log.warning("Blurry image but no enhancer configured; continuing anyway.")

    pre = preprocess(enhanced_img, max_dim=cfg.quality.max_dim)
    binary = pre["binary"]
    color = pre["original"]

    cells, detector = detect_cells(models.yolo if models.yolo_loaded else None, binary, color)

    if not cells:
        raise NotBrailleError("No Braille cell structure detected in the image.")

    # Orientation + verso handling (rotates binary & re-maps cells).
    radius = int(dot_radius_from_cell(cells[0][2], cells[0][3]))
    k = best_orientation(binary, cells, radius)
    if k:
        from .orientation import _rotate, _transform_cells

        binary = _rotate(binary, k)
        color = _rotate(color, k)
        cells = _transform_cells(cells, pre["binary"].shape, k)
    binary, cells = verso_handle(binary, cells, radius)

    texts, results, uncertain = _assemble_lines(cells, binary)

    # Filter spurious cells that produced only '?' — if none decode, it's not braille.
    decoded = [c for c in results if c.character != "?"]
    if len(decoded) == 0:
        raise TooFewDotsError("No decodable Braille characters found — is this a Braille page?")
    if len(decoded) < 2:
        raise TooFewDotsError("Too few readable Braille cells to read a sentence.")

    confidence = _overall_confidence(results)
    text = "\n".join(texts)

    payload: Optional[DebugPayload] = None
    if debug:
        pre_b64 = _b64_jpeg(cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR))
        overlay_cells = _b64_jpeg(_draw_boxes(color, cells))
        dots_img, dot_pts = _draw_dots(color, binary, cells)
        dots_b64 = _b64_jpeg(dots_img)
        payload = DebugPayload(
            original=orig_b64,
            preprocessed=pre_b64,
            cells_overlay=overlay_cells,
            dots_overlay=dots_b64,
            cells=results,
            dots=DebugDots(points=dot_pts),
        )

    return ScanResponse(
        text=text,
        language=language,
        overall_confidence=confidence,
        uncertain_indices=uncertain,
        cells=results,
        quality=QualityReport(
            blurry=q["blurry"],
            enhanced=was_enhanced,
            perspective_corrected=False,
            lighting=q["lighting"],
            clahe_applied=pre["clahe_applied"],
            detector=detector,
        ),
        debug=payload,
    )


def resize_max_dim_local(img: np.ndarray, max_dim: int = 640) -> np.ndarray:
    from .preprocess import resize_max_dim

    return resize_max_dim(img, max_dim)
