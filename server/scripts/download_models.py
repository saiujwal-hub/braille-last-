"""One-time model provisioning script.

Downloads the pretrained weights the server reuses:
  - Real-ESRGAN `RealESRGAN_x4plus` (BSD-3-Clause)      [or general x4v3 via --tiny]
  - Coqui VITS English voice (MPL-2.0)                   [--tts]
  - (optional) SAM `vit_b` checkpoint (research license) [--sam]
  - (optional) YOLO base `yolov8n.pt` COCO weights       [--yolo-base]

Run once, on the machine that will host the server, with internet access. Everything
downloaded lands in `server/weights/` and is then used fully offline.

Usage:
    python scripts/download_models.py --esrgan --tts
    python scripts/download_models.py --all
"""

from __future__ import annotations

import argparse
import sys
import urllib.request
from pathlib import Path

WEIGHTS_DIR = Path(__file__).resolve().parent.parent / "weights"

URLS = {
    "esrgan": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x4plus.pth",
    "esrgan-tiny": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth",
    "sam": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth",
    "yolo-base": "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt",
}


def download(name: str, url: str) -> Path:
    dest = WEIGHTS_DIR / Path(url).name
    if dest.exists():
        print(f"[skip]  {name} already present: {dest}")
        return dest
    print(f"[get ]  {name}: {url}")
    urllib.request.urlretrieve(url, dest)
    print(f"[ok  ]  {name} -> {dest}")
    return dest


def main() -> int:
    ap = argparse.ArgumentParser(description="Download pretrained weights for the Braille Bridge server.")
    ap.add_argument("--esrgan", action="store_true", help="Real-ESRGAN x4plus (BSD-3-Clause)")
    ap.add_argument("--tiny", action="store_true", help="Use the tiny general x4v3 instead (CPU-friendly)")
    ap.add_argument("--tts", action="store_true", help="Coqui VITS English voice (MPL-2.0)")
    ap.add_argument("--sam", action="store_true", help="SAM vit_b (research license)")
    ap.add_argument("--yolo-base", action="store_true", help="YOLOv8n COCO base for fine-tuning")
    ap.add_argument("--all", action="store_true", help="Everything above")
    args = ap.parse_args()

    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

    jobs: list[tuple[str, str]] = []
    if args.all or args.esrgan or args.tiny:
        key = "esrgan-tiny" if args.tiny else "esrgan"
        jobs.append((key, URLS[key]))
    if args.all or args.sam:
        jobs.append(("sam", URLS["sam"]))
    if args.all or args.yolo_base:
        jobs.append(("yolo-base", URLS["yolo-base"]))

    for name, url in jobs:
        try:
            download(name, url)
        except Exception as exc:  # noqa: BLE001
            print(f"[FAIL]  {name}: {exc}", file=sys.stderr)
            return 1

    if args.tts or args.all:
        print("[tts ]  Coqui model downloads on first TTS load; run the server once with BB_TTS_ENABLED=true.")

    print("Done. Weights live in", WEIGHTS_DIR)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
