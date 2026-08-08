"""Lazy, optional model loader.

Holds the heavy runtime objects (YOLO detector, Real-ESRGAN enhancer, TTS engine, SAM)
and only materializes them on first use. The container is built by `create_models` on a
background thread at startup and shared process-wide via `get_models`.

Design rule: no import of ultralytics / torch / TTS / realesrgan at module import time.
Those imports live inside `_load_*` helpers so `app.main:app` can be imported on any
machine (e.g. for tests or a web server without the ML stack).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from ..config import get_config

log = logging.getLogger("app.models")


@dataclass
class Models:
    """Container of lazily-instantiated models."""

    yolo: Any = None
    yolo_loaded: bool = False
    yolo_error: Optional[str] = None

    enhancer: Any = None
    enhancer_loaded: bool = False
    enhancer_error: Optional[str] = None

    tts: Any = None
    tts_loaded: bool = False
    tts_error: Optional[str] = None

    sam: Any = None
    sam_loaded: bool = False
    sam_error: Optional[str] = None

    def detector_name(self) -> str:
        return "yolo" if self.yolo_loaded else "geometric"

    def health(self) -> dict:
        """Compact status dict for /health."""
        return {
            "yolo": "loaded" if self.yolo_loaded else (self.yolo_error or "disabled"),
            "esrgan": "loaded" if self.enhancer_loaded else (self.enhancer_error or "disabled"),
            "tts": "loaded" if self.tts_loaded else (self.tts_error or "disabled"),
            "sam": "loaded" if self.sam_loaded else (self.sam_error or "disabled"),
        }


def _detect_device(forced: str) -> str:
    if forced:
        return forced
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def _load_yolo(cfg) -> Any:
    """Load the fine-tuned YOLO cell detector, or fail soft."""
    if not cfg.models.yolo_weights:
        return None
    from ultralytics import YOLO  # lazy import

    model = YOLO(cfg.models.yolo_weights)
    return model


def _load_enhancer(cfg) -> Any:
    """Load Real-ESRGAN (realesrgan Python API)."""
    if not cfg.models.enhancer_enabled or not cfg.models.enhancer_weights:
        return None
    from realesrgan import RealESRGANer  # lazy import

    try:
        from basicsr.archs.rrdbnet_arch import RRDBNet
    except Exception:
        from realesrgan.archs.srvgg_arch import SRVGGNetCompact as RRDBNet  # general x4v3

    upsampler = RealESRGANer(
        scale=cfg.models.enhancer_scale,
        model_path=str(cfg.models.enhancer_weights),
        model=RRDBNet(num_in_ch=3, num_out_ch=3, scale=cfg.models.enhancer_scale, num_feat=64, num_block=23),
        tile=0,
        tile_pad=10,
        pre_pad=0,
        half=False,
        device=_detect_device(cfg.models.device),
        gpu_id=0,
    )
    return upsampler


def _load_tts(cfg) -> Any:
    """Load Coqui TTS engine (offline local model)."""
    if not cfg.models.tts_enabled:
        return None
    from TTS.api import TTS  # lazy import

    tts = TTS(model_name=cfg.models.tts_model, progress_bar=False)
    return tts


def _load_sam(cfg) -> Any:
    """Load Segment Anything model (optional high-accuracy dot masks)."""
    if not cfg.models.sam_enabled or not cfg.models.sam_weights:
        return None
    from segment_anything import sam_model_registry  # lazy import

    sam = sam_model_registry["vit_b"](checkpoint=cfg.models.sam_weights)
    device = _detect_device(cfg.models.device)
    sam.to(device)
    sam.eval()
    return sam


def create_models() -> Models:
    """Materialize every configured model, logging per-model outcome."""
    cfg = get_config()
    models = Models()

    for name, loader, attr in (
        ("yolo", _load_yolo, "yolo"),
        ("esrgan", _load_enhancer, "enhancer"),
        ("tts", _load_tts, "tts"),
        ("sam", _load_sam, "sam"),
    ):
        try:
            obj = loader(cfg)
            if obj is not None:
                setattr(models, attr, obj)
                setattr(models, f"{attr}_loaded", True)
                log.info("Loaded %s", name)
            else:
                log.info("%s disabled (not configured)", name)
        except Exception as exc:  # noqa: BLE001 - degrade gracefully
            setattr(models, f"{attr}_error", str(exc))
            log.error("Failed to load %s: %s", name, exc)

    return models


_models: Models | None = None
_models_future: asyncio.Future | None = None


def get_models() -> Models:
    """Return the process-wide Models container (building it lazily if needed)."""
    global _models
    if _models is None:
        _models = create_models()
    return _models


def preload_models_async() -> None:
    """Kick off model loading in the background so the first request is fast."""
    global _models, _models_future
    if _models is not None:
        return

    async def _build() -> None:
        global _models
        if _models is None:
            _models = create_models()

    try:
        loop = asyncio.get_running_loop()
        _models_future = asyncio.ensure_future(_build())
    except RuntimeError:
        # No running loop (e.g. called from tests / CLI): build synchronously.
        _models = create_models()


def await_models(timeout: float = 60.0) -> Models:
    """Block until background model loading finishes (for startup hooks)."""
    global _models, _models_future
    if _models_future is not None:
        try:
            asyncio.get_running_loop().run_until_complete(
                asyncio.wait_for(_models_future, timeout=timeout)
            )
        except RuntimeError:
            pass
    return get_models()
