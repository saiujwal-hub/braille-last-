"""Automatic quality assessment: blur and lighting checks.

The blur gate decides whether Real-ESRGAN runs (per the brief: enhance only when the
image is genuinely blurry). We also keep a hard floor below which we refuse to read.
"""

from __future__ import annotations

import cv2
import numpy as np

from ..config import get_config
from .preprocess import to_gray


def laplacian_variance(gray: np.ndarray) -> float:
    """Standard focus measure. High = sharp; low = blurry."""
    if gray.ndim == 3:
        gray = to_gray(gray)
    if gray.dtype != np.uint8:
        gray = np.clip(gray, 0, 255).astype(np.uint8)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def assess_quality(gray: np.ndarray) -> dict:
    """Return {blurry, blur_score, lighting} for the given grayscale image."""
    cfg = get_config()
    variance = laplacian_variance(gray)
    mean = float(np.mean(gray))
    blurry = variance < cfg.quality.blur_laplacian_var

    if mean < cfg.quality.lighting_low:
        lighting = "low"
    elif mean > cfg.quality.lighting_high:
        lighting = "harsh"
    else:
        lighting = "ok"

    return {"blurry": blurry, "blur_score": variance, "lighting": lighting}
