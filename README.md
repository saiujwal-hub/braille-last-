# Braille Bridge

Turn photos of handwritten **slate-and-stylus Braille** into readable text and speech —
completely offline, on your own hardware.

**Problem.** Parents and teachers of visually impaired students cannot easily read
handwritten Braille. Braille is written with a slate and stylus; the result is a page of
indented/embossed dots that only a trained Braille reader can decode. Braille Bridge
photographs that page and reads it aloud.

**Constraints honored**

- 100% offline. No cloud AI (no OpenAI / Gemini / Claude / Google Vision / Azure).
- All heavy inference (YOLO, Real-ESRGAN, TTS) runs on an open-source **local server** on
  the same Wi-Fi network (laptop / Raspberry Pi); the Android app talks to it over LAN.
- Pretrained open-source models are reused wherever possible; the only retrained model is
  the Braille-cell detector (fine-tuned YOLO on the DSBI dataset) — see
  [`ANALYSIS.md`](./ANALYSIS.md) for the justification.

## What's in this repository

| Component | Path | What it does |
| --- | --- | --- |
| **Server** (FastAPI + OpenCV + PyTorch) | [`server/`](./server) | Full OCR pipeline: perspective correction → CLAHE → adaptive threshold → noise removal → Real-ESRGAN (on demand) → YOLO cell detection → per-cell dot OCR → translation → confidence scoring, plus offline TTS and a rich debug payload. |
| **Android app** (Flutter) | [`app/`](./app) | Camera capture, results + confidence, uncertain-character highlighting, debug-mode viewer, offline TTS playback. |
| **Live web demo** (on-device PWA) | root (`src/`, `index.html`) | A browser-based, fully-on-device reader using a pure-CV pipeline (no server). Great for instant demos and as a fallback. |
| **Docs** | [`docs/`](./docs) | [Architecture](./docs/ARCHITECTURE.md), [Installation guide](./docs/INSTALLATION.md). |
| **Repo analysis & licenses** | [`ANALYSIS.md`](./ANALYSIS.md) | Per-repository analysis of the 10 listed sources, pretrained weights reused, and why only one model needs retraining. |

## Quickstart

```bash
# 1) Backend server (on the device that will host inference)
cd server
pip install -r requirements.txt
python scripts/download_models.py
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 2) Android app (on your dev machine)
cd app
flutter run
# 3) Point the app's Settings screen at http://<server-lan-ip>:8000
```

Full steps, model downloads, and the optional YOLO fine-tune on DSBI are in
[`docs/INSTALLATION.md`](./docs/INSTALLATION.md).

## Pipeline

```
Camera
  → Perspective correction        (OpenCV quadrilateral warp)
  → CLAHE                         (adaptive contrast, poor lighting)
  → Adaptive threshold + noise    (Otsu/adaptive + morphology)
  → Real-ESRGAN                   (only when the image is blurry)
  → YOLO detects Braille cells    (fine-tuned on DSBI; geometric fallback built-in)
  → Braille OCR                   (per-cell 6-dot recognition)
  → Translate to English          (grade-1 table, never guesses → '?')
  → Confidence score + highlight uncertain characters
  → Offline Text-to-Speech        (Coqui VITS on the local server)
```

## Status

- **Server**: clean modular FastAPI app, debug payload, unit tests, Docker. Scaffolded and
  ready to run once Python/OpenCV/PyTorch are installed (not installed on the authoring
  machine).
- **App**: Flutter scaffold (camera, results, debug, TTS) ready for `flutter create`/`run`.
- **PWA**: fully working, tested (47/47 unit tests) and deployable today.

## License & attribution

This project adapts ideas from the repositories analyzed in
[`ANALYSIS.md`](./ANALYSIS.md). It is provided for educational / hackathon use; check each
dependency's license before commercial distribution.
