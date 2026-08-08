"""OCR pipeline package.

Stage order (mirrors the PWA pipeline, ported to OpenCV):
    decode -> resize -> perspective -> deskew -> orient ->
    CLAHE -> adaptive threshold -> denoise ->
    cell detection (YOLO or geometric) -> per-cell dot OCR ->
    translate -> confidence -> optional enhance (Real-ESRGAN on blurry input)

`pipeline.run_pipeline` orchestrates everything and returns a `ScanResponse`.
"""

from .pipeline import run_pipeline

__all__ = ["run_pipeline"]
