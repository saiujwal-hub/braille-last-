# Installation

Braille Bridge runs **fully offline** after one provisioning step. Everything stays on
your own Wi-Fi.

## Architecture recap

- **Server** (this repo's `server/`): OCR + TTS. Runs on a laptop or Raspberry Pi on the
  same network as the phone.
- **App** (`app/`): Flutter Android app that photographs Braille and shows/speaks the text.
- **PWA** (repo root): a no-server browser demo — zero install, works today.

## 1. Server (FastAPI + OpenCV + optional PyTorch)

```bash
cd server
python -m venv .venv
# Windows: .venv\Scripts\activate   |   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

### 1a. Provision models (one-time, needs internet)

```bash
python scripts/download_models.py --esrgan --tts --yolo-base
```

This downloads Real-ESRGAN `x4plus`, the Coqui VITS English voice, and the YOLOv8n COCO
base for fine-tuning. After this step, the server **never** needs the internet.

### 1b. (Optional but recommended) Fine-tune the cell detector

```bash
# Convert DSBI annotations to YOLO labels (DSBI is research data — verify the format):
python scripts/dsbi_to_yolo.py --dataset ../dsbi --out ./dsbi_yolo
# Fine-tune (few minutes on GPU, ~30–60 min on CPU):
python scripts/train_yolo.py --data ./dsbi_yolo --epochs 60
# Point the server at the result:
export BB_YOLO_WEIGHTS=runs/train/braille-cell/weights/best.pt
```

Without this step the server uses the **geometric fallback** detector, so the full
pipeline still works.

### 1c. Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- API docs: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`
- Find your LAN IP (`ipconfig` on Windows / `hostname -I` on Linux) — the phone connects
  to `http://<that-ip>:8000`.

### Docker alternative

```bash
docker compose up -d
```

(The Dockerfile is CPU-first; swap the base image + torch wheel for a CUDA build on GPU
hosts.)

## 2. Android app

```bash
cd app
flutter pub get
flutter create . --org com.example   # materializes platform folders
flutter run
```

Open **Settings** in the app and enter `http://<server-lan-ip>:8000`. Tap **Check
connection**; then **Read Braille**.

## 3. PWA (optional live demo, no install)

```bash
npm install
npm run dev
# open http://localhost:5173
```

## Network & security notes

- All traffic is plain HTTP on your local network; don't expose the server to the public
  internet. Firewall rule: allow port 8000 on the host for LAN clients.
- Android requires `android:usesCleartextTraffic="true"` for plain-HTTP LAN (see
  `app/README.md`).
- Models are downloaded exactly once; afterwards the system works with no internet.

## Offline checklist

- [ ] `server/weights/` contains the `.pth` / TTS model files
- [ ] Server boots and `/health` returns 200
- [ ] Phone and server on the same Wi-Fi; Settings → Check connection → green
- [ ] A test photo of printed Braille reads back with text + speech
