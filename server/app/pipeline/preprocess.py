"""Preprocessing: decode, resize, deskew, CLAHE, threshold, denoise.

Mirrors the proven pure-CV preprocessing from the existing PWA pipeline
(`src/lib/cv/preprocess.ts`) using OpenCV primitives so behaviour stays consistent
between the web demo and the server.
"""

from __future__ import annotations

import cv2
import numpy as np

from ..errors import DecodeError
from ..logging_conf import get_logger

log = get_logger("app.pipeline.preprocess")


def decode_image(data: bytes) -> np.ndarray:
    """Decode raw JPEG/PNG bytes into a BGR numpy array."""
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise DecodeError("Uploaded data is not a decodable image (JPEG/PNG).")
    return img


def resize_max_dim(img: np.ndarray, max_dim: int = 1600) -> np.ndarray:
    """Downscale so the longest side never exceeds `max_dim` (keep aspect ratio)."""
    h, w = img.shape[:2]
    longest = max(h, w)
    if longest <= max_dim:
        return img
    scale = max_dim / float(longest)
    return cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def to_gray(img: np.ndarray) -> np.ndarray:
    if img.ndim == 2:
        return img
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def deskew_otsu(gray: np.ndarray) -> tuple[np.ndarray, float]:
    """Estimate and correct slight rotation via Otsu + minAreaRect.

    Returns (deskewed_gray, angle_degrees). Angle is tiny for a slate-and-stylus page;
    the orientation stage (0/90/180/270) handles full-page flips.
    """
    thr = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    contours, _ = cv2.findContours(thr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return gray, 0.0

    # Largest connected foreground blob ≈ the page / braille area.
    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < 0.01 * gray.size:
        return gray, 0.0

    rect = cv2.minAreaRect(largest)
    angle = rect[-1]
    # minAreaRect reports in [-90, 0); wrap into [-45, 45] so a wide, upright page
    # maps to 0 instead of -90. True deskew is only a few degrees; larger angles are
    # handled by the orientation stage.
    if angle > 45:
        angle -= 90
    elif angle < -45:
        angle += 90
    if abs(angle) < 0.05:
        return gray, 0.0

    h, w = gray.shape
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    rotated = cv2.warpAffine(
        gray, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )
    return rotated, float(angle)


def clahe(gray: np.ndarray, clip: float = 2.0, tile: int = 8) -> np.ndarray:
    """Adaptive histogram equalization for uneven lighting."""
    return cv2.createCLAHE(clipLimit=clip, tileGridSize=(tile, tile)).apply(gray)


def adaptive_binarize(gray: np.ndarray, block: int = 31, c: int = 10) -> np.ndarray:
    """Gaussian adaptive threshold -> clean binary image."""
    block = int(block) if block % 2 == 1 else int(block) + 1
    return cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, block, c
    )


def denoise(binary: np.ndarray, dot_radius: int = 2) -> np.ndarray:
    """Morphological open+close to drop specks and connect faint dots.

    `dot_radius` is a hint from the cell detector; defaults to a small kernel.
    """
    k = max(1, 2 * dot_radius + 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    return cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)


def preprocess(
    img: np.ndarray,
    max_dim: int = 1600,
    apply_clahe: bool = True,
    dot_radius_hint: int = 2,
) -> dict:
    """Full preprocessing chain. Returns a dict of intermediates for later stages."""
    img = resize_max_dim(img, max_dim)
    gray = to_gray(img)
    gray, angle = deskew_otsu(gray)

    lighting = "ok"
    mean = float(gray.mean())
    if mean < 60:
        lighting = "low"
    elif mean > 200:
        lighting = "harsh"

    enhanced_gray = clahe(gray) if apply_clahe else gray
    binary = adaptive_binarize(enhanced_gray)
    binary = denoise(binary, dot_radius_hint)

    return {
        "original": img,
        "gray": gray,
        "enhanced": enhanced_gray,
        "binary": binary,
        "deskew_angle": angle,
        "lighting": lighting,
        "clahe_applied": bool(apply_clahe),
    }
