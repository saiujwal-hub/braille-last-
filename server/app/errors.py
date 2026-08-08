"""Typed exceptions and FastAPI exception handlers for the OCR server.

Every failure mode of the pipeline has a stable, machine-readable `code` so the Flutter
client can render a friendly message instead of a raw 500.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class BrailleError(Exception):
    """Base class for all expected failures. `http_status` drives the response code."""

    code: str = "error"
    http_status: int = 400

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class DecodeError(BrailleError):
    """The uploaded image could not be decoded."""

    code = "decode"
    http_status = 400


class BlurryImageError(BrailleError):
    """The image is so blurry even enhancement is not expected to help."""

    code = "blurry"
    http_status = 422


class NotBrailleError(BrailleError):
    """No Braille cell/dot structure could be found."""

    code = "not-braille"
    http_status = 422


class TooFewDotsError(BrailleError):
    """The image decoded but contains too few dots to be a Braille page."""

    code = "too-few-dots"
    http_status = 422


class ModelUnavailableError(BrailleError):
    """A requested optional model (e.g. TTS) is not configured/loaded."""

    code = "model-unavailable"
    http_status = 503


class TtsError(BrailleError):
    """TTS synthesis failed."""

    code = "tts"
    http_status = 500


def register_exception_handlers(app: FastAPI) -> None:
    """Attach handlers so BrailleError subclasses become clean JSON responses."""

    @app.exception_handler(BrailleError)
    async def _handle_braille_error(_req: Request, exc: BrailleError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.http_status,
            content={"ok": False, "error": exc.code, "message": exc.message},
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(_req: Request, exc: Exception) -> JSONResponse:
        from .logging_conf import get_logger

        get_logger("app.errors").exception("Unexpected failure: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": "internal",
                "message": "Unexpected server error. Please try again.",
            },
        )
