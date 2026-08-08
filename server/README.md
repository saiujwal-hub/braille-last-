# Braille Bridge Server

FastAPI + OpenCV + (optional) PyTorch OCR server for slate-and-stylus Braille.
Fully offline once models are provisioned. See root [`README.md`](../README.md) and
[`docs/INSTALLATION.md`](../docs/INSTALLATION.md).

## Layout

```
app/
  main.py            FastAPI app + lifespan (background model load)
  config.py          pydantic-free dataclass config, all env-overridable
  errors.py          typed exceptions + handlers -> stable JSON error codes
  schemas.py         Pydantic API contract (mirrored by the Flutter app)
  logging_conf.py    console + rotating file logging
  api/               /health, /scan, /tts
  models/            lazy, optional loaders: YOLO, Real-ESRGAN, Coqui TTS, SAM
  pipeline/          preprocess, quality, cells (geometric), detect (yolo+merge),
                     dots (per-cell OCR), orientation+verso, translate, pipeline
scripts/
  download_models.py pretrained weight provisioning (one-time, needs internet)
  dsbi_to_yolo.py    DSBI annotations -> YOLO detection labels
  train_yolo.py      fine-tune yolov8n for braille-cell detection on DSBI
tests/               unit + integration + API tests (no GPU/ML required)
```

## Quickstart

```bash
cd server
python -m venv .venv && .venv\Scripts\activate      # Windows
pip install -r requirements.txt
python scripts/download_models.py --esrgan --tts    # one-time (internet)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- API docs: <http://127.0.0.1:8000/docs>
- Health: <http://127.0.0.1:8000/health>
- App connects to `http://<your-lan-ip>:8000`

## Configuration

Every knob is an environment variable (see `.env.example`). The most useful:

| Var | Default | Meaning |
| --- | --- | --- |
| `BB_YOLO_WEIGHTS` | *(empty)* | Fine-tuned YOLO weights; empty = geometric fallback |
| `BB_ESRGAN_ENABLED` | `true` | Real-ESRGAN on blurry photos |
| `BB_TTS_ENABLED` | `true` | Offline Coqui VITS TTS |
| `BB_SAM_ENABLED` | `false` | Optional SAM high-accuracy dot masks |
| `BB_PRELOAD` | `true` | Preload models in the background at startup |
| `BB_BLUR_VAR` | `90.0` | Laplacian-variance blur threshold |

## Tests

```bash
cd server
pytest
```

Tests build synthetic Braille pages in-memory and run the whole pipeline without any ML
dependencies, so CI/laptops without a GPU can still validate the core logic.
