"""Shared pytest configuration.

Disables every optional heavy model so the test suite runs without GPU/ML stack, then
makes the `server/` package importable regardless of CWD.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent.parent
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

# Test-safe configuration: no model loading, no network, small images.
os.environ.setdefault("BB_PRELOAD", "false")
os.environ.setdefault("BB_TTS_ENABLED", "false")
os.environ.setdefault("BB_ESRGAN_ENABLED", "false")
os.environ.setdefault("BB_SAM_ENABLED", "false")
os.environ.setdefault("BB_YOLO_WEIGHTS", "")
os.environ.setdefault("BB_BLUR_VAR", "10000")  # never flag synthetic images blurry
