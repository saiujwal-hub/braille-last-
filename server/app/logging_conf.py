"""Structured logging setup: console + rotating file.

Keeps every pipeline stage auditable (the debug requirement of the brief) without
interleaving noise between concurrent requests.
"""

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler

from .config import get_config


def setup_logging() -> None:
    """Configure the root logger once. Safe to call multiple times."""
    cfg = get_config()
    root = logging.getLogger()
    if root.handlers:  # already configured
        return

    level = getattr(logging, cfg.server.log_level.upper(), logging.INFO)
    root.setLevel(level)

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    root.addHandler(console)

    log_path = cfg.paths.logs / "braille-bridge.log"
    file_handler = RotatingFileHandler(log_path, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
    file_handler.setFormatter(fmt)
    root.addHandler(file_handler)

    # Keep third-party (uvicorn, torch) chatter from flooding the app logger.
    for noisy in ("uvicorn.access", "PIL", "matplotlib", "TTS"):
        logging.getLogger(noisy).setLevel(max(level, logging.WARNING))


def get_logger(name: str) -> logging.Logger:
    """Shorthand for a namespaced child logger."""
    return logging.getLogger(name)
