"""Fine-tune a small YOLO cell detector on the DSBI-derived labels.

Why retrain: no pretrained "braille cell" detector exists anywhere; the COCO-pretrained
`yolov8n.pt` does not know what a Braille cell is. DSBI (research data, cite it) provides
the exact per-cell boxes, so this is a ~114-page fine-tune that typically converges in a
few minutes on a laptop GPU or tens of minutes on CPU.

Usage (after scripts/dsbi_to_yolo.py):
    python scripts/train_yolo.py --data ./dsbi_yolo --epochs 60
    python scripts/train_yolo.py --data ./dsbi_yolo --epochs 60 --model yolov8s.pt
"""

from __future__ import annotations

import argparse
from pathlib import Path


def write_data_yaml(root: Path, out: Path) -> None:
    root = root.resolve()
    out.write_text(
        f"path: {root}\n"
        "train: images\n"
        "val: images\n"
        "nc: 1\n"
        "names:\n"
        "  0: braille-cell\n",
        encoding="utf-8",
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Fine-tune YOLO for Braille cell detection")
    ap.add_argument("--data", required=True, help="Directory from dsbi_to_yolo.py (images/ + labels/)")
    ap.add_argument("--model", default="yolov8n.pt", help="Base weights (downloads if missing)")
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--device", default="", help="cpu / 0 / ''")
    ap.add_argument("--project", default="runs/train", help="Output dir")
    ap.add_argument("--name", default="braille-cell", help="Run name")
    args = ap.parse_args()

    data_dir = Path(args.data)
    yaml_path = data_dir / "data.yaml"
    write_data_yaml(data_dir, yaml_path)

    from ultralytics import YOLO  # lazily imported so --help works without the stack

    model = YOLO(args.model)
    model.train(
        data=str(yaml_path),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device or None,
        project=args.project,
        name=args.name,
        single_cls=True,
    )
    # Best weights are written to {project}/{name}/weights/best.pt
    print(f"Done. Point BB_YOLO_WEIGHTS at {Path(args.project) / args.name / 'weights' / 'best.pt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
