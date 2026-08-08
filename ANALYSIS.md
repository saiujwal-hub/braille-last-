# Repository analysis & licensing

This document analyzes the ten repositories named in the brief, records what we **reuse**
(pretrained weights / code ideas), what we **adapt**, and — for the single model that must
be retrained — *why* retraining is unavoidable.

---

## 1. AngelinaReader — https://github.com/IlyaOvodov/AngelinaReader

**What it is.** A complete Optical Braille Recognition system (web + CLI). Detects Braille
symbols with a **RetinaNet** CNN trained on the DSBI dataset, then groups detected symbols
into lines, auto-detects orientation by trying all 4 rotations and keeping the one with the
most common Braille characters, and decodes verso (reverse) text by *inverting the image and
flipping it horizontally*.

**What we reuse/adapt.**

- The **4-orientation search** for automatic page orientation → `server/app/pipeline/orientation.py`.
- The **verso trick** (invert + horizontal flip) for two-sided pages → same module.
- The heuristic **line formation** from symbol centroids → `server/app/pipeline/cells.py`.
- The `~?~` convention for un-decodable symbols → we render these as `?` with a low
  confidence value, per the brief ("never guess letters").

**What we replace.** RetinaNet → Ultralytics YOLO (simpler to install, faster inference,
easy fine-tune from pretrained weights). Liblouis translation → our own compact grade-1
tables (heavier than needed for a hackathon; Liblouis stays optional).

**License.** Source is public with no explicit license header captured; treat as
research/reference. We only borrow *ideas*, not code.

## 2. Ultralytics YOLO — https://github.com/ultralytics/ultralytics

**What it is.** State-of-the-art object detection (YOLOv8/YOLO11/YOLO26) with an extremely
simple Python/CLI API and auto-downloading pretrained weights.

**What we reuse.**

- Pretrained **`yolov8n.pt`** (COCO) as the *starting checkpoint* for fine-tuning
  (transfer learning — orders of magnitude faster and more robust than from scratch).
- The `ultralytics` inference API for the deployed cell detector.

**What must be retrained and why.** There is **no off-the-shelf pretrained Braille-cell
detector** anywhere — the COCO 80-class model does not include "Braille cell", and no
mainstream hub ships one. Detecting Braille cells is precisely the step that makes the rest
of the pipeline reliable, so we fine-tune a small YOLO (`yolov8n`, ~3.2M params) on
**DSBI** (114 fully-annotated Braille pages). See `server/scripts/train_yolo.py`. The server
ships a **geometric fallback** detector so the whole pipeline works even *before* training.

**License.** **AGPL-3.0.** Fine for hackathon/non-commercial use; note the enterprise license
if this ever ships commercially.

## 3. OpenCV — https://github.com/opencv/opencv

**What it is.** The de-facto computer vision library (Apache-2.0).

**What we reuse (code APIs).**

- `cv2.getPerspectiveTransform` + `warpPerspective` → perspective correction.
- `cv2.createCLAHE` → adaptive histogram equalization.
- `cv2.adaptiveThreshold` / `cv2.threshold(OTSU)` + `morphologyEx` → threshold + noise removal.
- `cv2.Laplacian` variance → blur detection.
- Connected components + morphology → geometric cell/dot detector fallback.

**License.** Apache-2.0.

## 4. Real-ESRGAN — https://github.com/xinntao/Real-ESRGAN

**What it is.** Practical blind super-resolution / restoration (BSD-3-Clause).

**What we reuse.**

- Pretrained **`realesr-general-x4v3`** — the *tiny* general model (fast on CPU, ideal for a
  hackathon server). Applied **only when the blur/quality check flags the image**, per the
  brief, so we never pay its cost on sharp photos.
- The **ncnn-vulkan portable binary** is documented as a drop-in alternative that needs no
  CUDA/PyTorch.

**License.** BSD-3-Clause.

## 5. Coqui TTS — https://github.com/coqui-ai/TTS

**What it is.** A deep-learning Text-to-Speech toolkit (MPL-2.0) with hundreds of
pretrained voices.

**What we reuse.**

- Pretrained **`tts_models/en/ljspeech/vits`** (VITS — fast, single-speaker, ~30s downloads).
- The `TTS(model_name=...)` Python API for offline synthesis on the local server.
- Android's built-in TTS engine (`flutter_tts`) is used as an on-device fallback when the
  server is unreachable.

**License.** **MPL-2.0** (file-level copyleft — fine for an app; keep its source files
unmodified and ship a copy of the license, which we do via requirements attribution).

## 6. FastAPI — https://github.com/fastapi/fastapi

**What it is.** Modern async Python API framework (MIT).

**What we reuse.** The whole backend: routes, Pydantic schemas, dependency injection for the
lazy model loader, auto OpenAPI docs at `/docs`.

**License.** MIT.

## 7. Flutter — https://github.com/flutter/flutter

**What it is.** Google's cross-platform UI toolkit (BSD-3-Clause).

**What we reuse.** The Android app: camera plugin, HTTP client, audio playback, declarative
UI. The `app/` folder is a Flutter project scaffold — run `flutter create .` inside it (or
`flutter run`) to materialize the platform folders.

**License.** BSD-3-Clause.

## 8. PyTorch — https://github.com/pytorch/pytorch

**What it is.** The ML runtime (BSD-3-Clause).

**What we reuse.** Inference runtime for YOLO and Real-ESRGAN. Docker images use the **CPU**
wheel to keep the hackathon footprint small; a CUDA image is provided as an option.

**License.** BSD-3-Clause.

## 9. Segment Anything (SAM) — https://github.com/facebookresearch/segment-anything

**What it is.** Promptable segmentation foundation model (Apache-2.0, weights research-licensed).

**What we reuse (optional, off by default).** An optional **high-accuracy mode** that
prompts SAM with the 6 dot locations inside each detected cell and uses the returned masks
to decide dot presence when the geometric signal is ambiguous. Not required for the core
flow — keeping it lazy keeps memory low.

**License.** Apache-2.0 (code). Model weights are subject to the SAM model license
(available for research/non-commercial and limited commercial use).

## 10. DSBI — https://github.com/yeluo1994/DSBI

**What it is.** The Double-Sided Braille Image Dataset: 114 double-sided Braille page images
with exact annotations — skew angle, vertical/horizontal line positions, and, for every
cell, its grid (row, col) and its **6-dot pattern** (`1` = raised dot). Also ships
de-skewed images and a fixed train/test split (26/88).

**What we reuse.**

- **Training data** for the YOLO cell detector: the converter `server/scripts/dsbi_to_yolo.py`
  derives per-cell bounding boxes from the annotated line positions and emits YOLO `.txt`
  labels.
- **Ground truth** for validating the OCR stage (the 6-dot masks are already there).
- The `imageRotate` deskew recipe (angle sign convention) → our deskew helper.

**License.** Dataset repo carries no explicit OSS license; it is published for research use.
Cite it in any talk/README: *Renqiang Li, Hong Liu, Xiangdong Wan, Yueliang Qiang, DSBI,
arXiv:1811.10893, 2018*.

---

## Why only ONE model is retrained

| Component | Reuse | Retrain? |
| --- | --- | --- |
| Perspective / CLAHE / threshold / noise | OpenCV algorithms | No |
| Super-resolution on blurry photos | Real-ESRGAN `realesr-general-x4v3` weights | No |
| Braille **cell detection** | Start from `yolov8n.pt` COCO weights | **Yes — fine-tune on DSBI** (no pretrained braille detector exists) |
| Per-cell dot OCR | Geometric signal + template correlation | No (works, and is auditable) |
| Translation | Grade-1 table (from the existing PWA) | No |
| TTS | Coqui VITS pretrained voice | No |
| Dot segmentation (optional) | SAM `vit_b` weights | No |

The geometric fallback means the server runs the full pipeline **before** any training is
done; the fine-tuned YOLO then only makes cell detection more robust on messy real photos.
