"""Central configuration for the Braille Bridge server.

All settings are overridable through environment variables so the same code runs in
Docker, on a laptop, and on a Raspberry Pi.

Naming follows Twelve-Factor: a single module owns every tunable, and every value has a
sane default that makes the server work out-of-the-box.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def load_env_file() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        try:
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip()
                    if val.startswith(('"', "'")) and val.endswith(val[0]):
                        val = val[1:-1]
                    if key and key not in os.environ:
                        os.environ[key] = val
        except Exception:
            pass


load_env_file()


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except (TypeError, ValueError):
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, str(default)))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Paths:
    """Filesystem locations (all resolved relative to the server root)."""

    server_root: Path = Path(__file__).resolve().parent.parent
    weights: Path = field(default_factory=lambda: Path(os.environ.get("BB_WEIGHTS", "weights")))
    logs: Path = field(default_factory=lambda: Path(os.environ.get("BB_LOGS", "logs")))

    def __post_init__(self) -> None:
        # Resolve relative to the server root so path behaviour is identical no matter
        # which CWD the server is launched from.
        for name in ("weights", "logs"):
            p = getattr(self, name)
            if not p.is_absolute():
                object.__setattr__(self, name, self.server_root / p)


@dataclass(frozen=True)
class ModelConfig:
    """Which pretrained models to load and how (all lazy, all optional)."""

    # --- YOLO cell detector -----------------------------------------------------
    # Point this at the fine-tuned DSBI model (scripts/train_yolo.py). If unset, the
    # server transparently falls back to the geometric detector, so the full pipeline
    # runs even before training.
    yolo_weights: str = field(default_factory=lambda: _env("BB_YOLO_WEIGHTS", ""))
    yolo_imgsz: int = field(default_factory=lambda: _env_int("BB_YOLO_IMGSZ", 1280))
    yolo_conf: float = field(default_factory=lambda: _env_float("BB_YOLO_CONF", 0.30))
    yolo_iou: float = field(default_factory=lambda: _env_float("BB_YOLO_IOU", 0.45))
    yolo_class: int = field(default_factory=lambda: _env_int("BB_YOLO_CLASS", 0))

    # --- Real-ESRGAN ------------------------------------------------------------
    enhancer_weights: str = field(
        default_factory=lambda: _env("BB_ESRGAN_WEIGHTS", "weights/RealESRGAN_x4plus.pth")
    )
    enhancer_scale: int = field(default_factory=lambda: _env_int("BB_ESRGAN_SCALE", 2))
    enhancer_enabled: bool = field(default_factory=lambda: _env_bool("BB_ESRGAN_ENABLED", True))

    # --- Coqui TTS --------------------------------------------------------------
    tts_model: str = field(default_factory=lambda: _env("BB_TTS_MODEL", "tts_models/en/ljspeech/vits"))
    tts_enabled: bool = field(default_factory=lambda: _env_bool("BB_TTS_ENABLED", True))
    tts_sample_rate: int = field(default_factory=lambda: _env_int("BB_TTS_SR", 22050))

    # --- Segment Anything (optional high-accuracy mode) --------------------------
    sam_enabled: bool = field(default_factory=lambda: _env_bool("BB_SAM_ENABLED", False))
    sam_weights: str = field(default_factory=lambda: _env("BB_SAM_WEIGHTS", "weights/sam_vit_b.pth"))

    # --- Compute ----------------------------------------------------------------
    device: str = field(default_factory=lambda: _env("BB_DEVICE", ""))  # "" => auto (cuda/cpu)


@dataclass(frozen=True)
class QualityConfig:
    """Thresholds for the automatic quality assessment (tuned empirically)."""

    blur_laplacian_var: float = field(default_factory=lambda: _env_float("BB_BLUR_VAR", 90.0))
    lighting_low: int = field(default_factory=lambda: _env_int("BB_LIGHT_LOW", 60))
    lighting_high: int = field(default_factory=lambda: _env_int("BB_LIGHT_HIGH", 200))
    max_dim: int = field(default_factory=lambda: _env_int("BB_MAX_DIM", 1600))


@dataclass(frozen=True)
class OcrConfig:
    """Per-cell OCR thresholds."""

    # A dot is "present" when its local-contrast score exceeds this (0..1 scale).
    dot_threshold: float = field(default_factory=lambda: _env_float("BB_DOT_THRESH", 0.45))
    # Cell confidence below this marks the character as uncertain (highlighted in the app).
    uncertain_threshold: float = field(default_factory=lambda: _env_float("BB_UNCERTAIN", 0.55))


@dataclass(frozen=True)
class ServerConfig:
    """HTTP server knobs."""

    host: str = field(default_factory=lambda: _env("BB_HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: _env_int("BB_PORT", 8000))
    log_level: str = field(default_factory=lambda: _env("BB_LOG_LEVEL", "INFO"))


@dataclass(frozen=True)
class AppConfig:
    """Aggregated configuration."""

    paths: Paths = Paths()
    models: ModelConfig = ModelConfig()
    quality: QualityConfig = QualityConfig()
    ocr: OcrConfig = OcrConfig()
    server: ServerConfig = ServerConfig()
    preload_models: bool = field(
        default_factory=lambda: _env_bool("BB_PRELOAD", True),
        init=False,
    )


_config: AppConfig | None = None


def get_config() -> AppConfig:
    """Return the process-wide config singleton (built once)."""
    global _config
    if _config is None:
        _config = AppConfig()
        for d in (_config.paths.weights, _config.paths.logs):
            d.mkdir(parents=True, exist_ok=True)
    return _config
