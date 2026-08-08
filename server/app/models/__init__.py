"""Model package: lazy loaders for YOLO, Real-ESRGAN, Coqui TTS and optional SAM.

Every loader is optional and lazy:
  - no model download blocks server boot;
  - a missing model degrades a stage instead of failing the whole request;
  - the geometric cell detector + built-in dot OCR keep the core pipeline working with
    zero heavy dependencies.
"""

from .loader import Models, get_models

__all__ = ["Models", "get_models"]
