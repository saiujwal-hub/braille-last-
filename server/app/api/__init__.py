"""HTTP API routes: /health, /scan, /tts.

Kept thin: request handling + error mapping live here; the actual work is delegated to
`app.pipeline` and `app.models`. Responses follow the Pydantic schemas in `schemas.py`.
"""

from __future__ import annotations

import base64
from io import BytesIO

from fastapi import APIRouter, File, UploadFile

from ..config import get_config
from ..errors import ModelUnavailableError, TtsError
from ..logging_conf import get_logger
from ..models.loader import get_models
from ..pipeline import run_pipeline
from ..schemas import HealthResponse, ScanResponse, TTSRequest, TTSResponse

log = get_logger("app.api")
router = APIRouter()

VERSION = "1.0.0"


@router.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    cfg = get_config()
    models = get_models()
    return HealthResponse(
        version=VERSION,
        detectors=models.health(),
        tts="loaded" if models.tts_loaded else (models.tts_error or "disabled"),
    )


@router.post("/scan", response_model=ScanResponse, tags=["ocr"])
async def scan(
    file: UploadFile = File(..., description="JPEG/PNG photo of a Braille page"),
    debug: bool = False,
    language: str = "en",
    force_enhance: bool | None = None,
) -> ScanResponse:
    data = await file.read()
    log.info("Scan request: %s (%d bytes, debug=%s)", file.filename, len(data), debug)
    return run_pipeline(data, debug=debug, language=language, force_enhance=force_enhance)


@router.post("/tts", response_model=TTSResponse, tags=["speech"])
def synthesize(req: TTSRequest) -> TTSResponse:
    models = get_models()
    if not models.tts_loaded or models.tts is None:
        raise ModelUnavailableError("Offline TTS is not enabled on this server.")
    try:
        buf = BytesIO()
        models.tts.tts_to_file(text=req.text, file_path=buf, format="wav")
        buf.seek(0)
        audio = buf.read()
    except Exception as exc:  # noqa: BLE001
        raise TtsError(f"TTS synthesis failed: {exc}") from exc
    return TTSResponse(audio_base64=base64.b64encode(audio).decode("ascii"))


@router.get("/tts/ping", tags=["speech"])
def tts_ping() -> dict:
    models = get_models()
    return {"ok": True, "tts": "loaded" if models.tts_loaded else "disabled"}


@router.get("/", tags=["system"])
def root() -> dict:
    return {
        "service": "Braille Bridge OCR server",
        "version": VERSION,
        "docs": "/docs",
        "endpoints": ["/health", "/scan", "/tts"],
    }
