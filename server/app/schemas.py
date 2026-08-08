"""Pydantic schemas defining the public API contract.

The Flutter app is generated from these shapes, so keep field names stable.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class ScanOptions(BaseModel):
    """Per-request pipeline switches."""

    debug: bool = Field(default=False, description="Include the full debug payload (images + per-cell data).")
    language: Literal["en"] = Field(default="en", description="Braille table language (grade-1 English today).")
    force_enhance: Optional[bool] = Field(
        default=None,
        description="Override auto blur detection: true=enforce Real-ESRGAN, false=skip it.",
    )


class CellResult(BaseModel):
    """One decoded Braille cell."""

    row: int
    col: int
    box: list[int] = Field(description="[x, y, w, h] in the preprocessed image.")
    mask: int = Field(description="6-bit mask, bit0 = dot 1 (top-left).")
    unicode: str = Field(description="Unicode Braille cell (U+28xx).")
    character: str = Field(description="Decoded character, or '?' when unknown/uncertain.")
    confidence: float = Field(ge=0.0, le=1.0)
    uncertain: bool = Field(description="True when the cell is below the confidence bar.")


class DebugDots(BaseModel):
    """Detected dot centroids, for the debug overlay."""

    points: list[list[int]] = Field(description="[[x, y], ...]")


class QualityReport(BaseModel):
    """What the quality assessment found, and what it did about it."""

    blurry: bool
    enhanced: bool
    perspective_corrected: bool
    lighting: Literal["low", "ok", "harsh"]
    clahe_applied: bool
    detector: Literal["yolo", "geometric", "merged"]


class DebugPayload(BaseModel):
    """Everything the debug screen needs."""

    original: Optional[str] = Field(default=None, description="Base64 JPEG of the resized input.")
    preprocessed: Optional[str] = Field(default=None, description="Base64 JPEG after preprocessing.")
    cells_overlay: Optional[str] = Field(default=None, description="Base64 JPEG with cell boxes drawn.")
    dots_overlay: Optional[str] = Field(default=None, description="Base64 JPEG with detected dots drawn.")
    cells: list[CellResult] = Field(default_factory=list)
    dots: DebugDots = Field(default_factory=lambda: DebugDots(points=[]))


class ScanResponse(BaseModel):
    """Successful scan result."""

    ok: bool = True
    text: str = Field(description="Decoded text, lines separated by '\\n'.")
    language: str = "en"
    overall_confidence: float = Field(ge=0.0, le=1.0)
    uncertain_indices: list[tuple[int, int]] = Field(
        description="(row, col) pairs the app should highlight."
    )
    cells: list[CellResult] = Field(default_factory=list)
    quality: QualityReport
    debug: Optional[DebugPayload] = None


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    voice: Optional[str] = None


class TTSResponse(BaseModel):
    ok: bool = True
    format: str = "audio/wav"
    audio_base64: str = Field(description="Base64 WAV bytes.")


class HealthResponse(BaseModel):
    ok: bool = True
    version: str
    detectors: dict[str, str] = Field(description="e.g. {'yolo': 'loaded', 'esrgan': 'not-configured'}")
    tts: str
