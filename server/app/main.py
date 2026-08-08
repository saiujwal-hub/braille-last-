"""FastAPI application entrypoint.

Run with:
    uvicorn app.main:app --host 0.0.0.0 --port 8000
or from this package:  python -m app.main

Set BB_PRELOAD=false to skip background model loading (useful for tests/CI).
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router as api_router
from .config import get_config
from .errors import register_exception_handlers
from .logging_conf import setup_logging


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging()
    cfg = get_config()
    if cfg.preload_models:
        from .models.loader import preload_models_async

        preload_models_async()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Braille Bridge OCR Server",
        description="Offline slate-and-stylus Braille OCR + TTS. See /docs for the API.",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # LAN-only service; tighten for production.
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    cfg = get_config()
    uvicorn.run("app.main:app", host=cfg.server.host, port=cfg.server.port, log_level=cfg.server.log_level.lower())
