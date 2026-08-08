# Architecture

Braille Bridge is a **hybrid-offline** system: the heavy inference runs on a local server
on the same Wi-Fi network; the Android app only captures and displays. Nothing leaves your
home network.

## System diagram

```mermaid
flowchart LR
    subgraph Android["Flutter app (Android)"]
        CAM[Camera capture] --> SCAN["POST /scan"]
        RES[Result screen] --> TTSB["POST /tts (or on-device)"]
        DBG[Debug screen] --> DBGAPI["GET debug payload"]
    end

    subgraph Server["FastAPI server (LAN, offline)"]
        R[/scan] --> DECODE[decode JPEG/PNG]
        DECODE --> Q[Quality gate\nLaplacian variance]
        Q -- blurry --> ESR[Real-ESRGAN\nx4plus]
        Q -- sharp --> P
        ESR --> P[Preprocess\nperspective, CLAHE,\nadaptive threshold,\nmorphology]
        P --> D[Cell detection\nYOLO fine-tuned on DSBI\n+ geometric fallback]
        D --> O[Orientation 0/90/180/270\n+ verso invert/flip]
        O --> OCR[Per-cell 6-dot OCR\nlocal contrast]
        OCR --> TR[Grade-1 translate\never guesses -> '?']
        TR --> CONF[Confidence + uncertain marks]
        CONF --> RESP[/ScanResponse JSON/]
        TTSB --> TTSENG[Coqui VITS\nlocal/ offline]
        TTSENG --> WAV[/WAV bytes/]
    end

    SCAN --> R
    DBGAPI --> RESP
    RES --> TTSB
```

## Data flow (one scan)

1. **Capture** — the app sends a JPEG/PNG to `POST /scan` over LAN (plain HTTP; a
   `usesCleartextTraffic` flag on Android enables it).
2. **Quality gate** — Laplacian variance classifies the photo as sharp or blurry. Blurry
   photos go through **Real-ESRGAN** (`RealESRGAN_x4plus`, BSD-3-Clause) once; sharp
   photos skip it entirely (per the brief: enhance *only* when needed).
3. **Preprocess** — perspective correction, deskew, **CLAHE** (adaptive histogram
   equalization for uneven lighting), **adaptive threshold**, morphological open/close
   to remove noise. All OpenCV primitives, Apache-2.0.
4. **Cell detection** — a YOLO detector fine-tuned on the **DSBI** dataset (AGPL-3.0 via
   Ultralytics; the *only* retrained model — no pretrained Braille-cell detector exists).
   A geometric fallback (connected components + row-triple grouping, ideas from
   AngelinaReader) guarantees the pipeline runs even before training.
5. **Orientation** — try 0/90/180/270 and keep the rotation with the most valid Braille
   characters (AngelinaReader idea). Double-sided paper: invert + horizontal flip (verso).
6. **Per-cell OCR** — the 6 dot positions are measured by local contrast; each cell is
   decoded to a 6-bit mask. Deterministic and auditable — no black box.
7. **Translation** — grade-1 table maps masks to letters/punctuation. Unknown masks become
   `?` (the reader never guesses).
8. **Confidence** — per-cell margin-based confidence; cells below the bar are highlighted
   in the app and the server reports `uncertain_indices`.
9. **Result** — the app renders text, highlights uncertain cells, and plays speech either
   from the server's Coqui VITS (MPL-2.0) or the device's built-in TTS.

## Why only one model is retrained

| Capability | Approach | License | Retrain? |
| --- | --- | --- | --- |
| Image cleanup / perspective | OpenCV | Apache-2.0 | No |
| Blurry-photo enhancement | Real-ESRGAN `x4plus` | BSD-3-Clause | No |
| Braille **cell detection** | YOLOv8n fine-tune on DSBI | AGPL-3.0 | **Yes** |
| Per-cell dot reading | Geometric local-contrast | — (own code) | No |
| Translation | Grade-1 table | — (own code) | No |
| Text to speech | Coqui VITS LJSpeech | MPL-2.0 | No |
| Dot segmentation (optional) | SAM `vit_b` | Apache-2.0 | No |

## Failure modes (stable error codes)

| HTTP | `error` code | Meaning | App UX |
| --- | --- | --- | --- |
| 400 | `decode` | Not an image | "Send a photo" |
| 422 | `blurry` | Too blurry to read | "Retake closer/steadier" |
| 422 | `not-braille` | No cell structure | "Not a Braille page" |
| 422 | `too-few-dots` | <2 readable cells | "Move camera closer" |
| 503 | `model-unavailable` | TTS not enabled | Falls back to on-device TTS |
| 500 | `internal` | Unexpected | "Try again" |

## The PWA

The root `src/` folder is a fully on-device reader (pure-CV in TypeScript, no server,
47/47 tests green). It is the live demo and the architectural reference the server
pipeline ports to Python.

## Known limitations

- **Word spaces (geometric fallback):** a Braille space is an *empty cell* — it produces
  no dots, so the pure geometric detector has no box to decode and word boundaries can be
  lost ("hi there" → "hithere"). The fine-tuned YOLO detector fixes this because it is
  trained on every cell (including empty ones) annotated in DSBI.
- **Enhancement cost:** Real-ESRGAN only runs when the quality gate flags the photo as
  blurry, so sharp photos pay nothing. Provisioning the weights needs internet once.
- **AGPL-3.0 (YOLO):** fine for a hackathon; review the Ultralytics enterprise license
  before any commercial distribution.
- **DSBI license:** the dataset carries no explicit license file; it is research data and
  must be cited (Li et al., arXiv:1811.10893).
