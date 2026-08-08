"""Convert the DSBI dataset into YOLO detection labels.

DSBI (https://github.com/yeluo1994/DSBI) annotates every page with:
  - the deskew `angle`,
  - vertical line positions (`v_position_total`, spacing `v_interval_total`),
  - horizontal line positions (`h_position_total`, spacing `h_interval_total`),
  - and, per cell, a 6-bit row of dots.

We derive one bounding box per cell from the intersecting line positions and emit
YOLO `images/xxx.txt` labels next to each image, class 0 = "braille cell".

NOTE: DSBI carries no explicit license file; it is research data. This converter is a
defensive parser — verify the exact annotation format against the repo before batch runs.

Usage:
    python scripts/dsbi_to_yolo.py --dataset ../dsbi --out ./dsbi_yolo
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

KEY = re.compile(r"^([A-Za-z_]+)\s*[:=]\s*(.+)$")
DOT_LINE = re.compile(r"^\s*(\d+)\s*[:\-]\s*([01\s,]+)\s*$")


def parse_annotation(txt: Path) -> tuple[list[float], list[float], list[list[int]]]:
    """Return (v_positions, h_positions, cells_mask_rows)."""
    v_pos: list[float] = []
    h_pos: list[float] = []
    cells: list[list[int]] = []
    current_list: list[float] | None = None

    for line in txt.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        m = KEY.match(line)
        if m:
            key, val = m.group(1).strip(), m.group(2).strip()
            if key.startswith("v_position_total"):
                current_list = v_pos
                vals = [float(t) for t in val.replace(",", " ").split() if t.replace(".", "", 1).replace("-", "", 1).isdigit()]
                v_pos.extend(vals)
                continue
            if key.startswith("h_position_total"):
                current_list = h_pos
                vals = [float(t) for t in val.replace(",", " ").split() if t.replace(".", "", 1).replace("-", "", 1).isdigit()]
                h_pos.extend(vals)
                continue
            if key.startswith("v_interval_total") or key.startswith("h_interval_total"):
                current_list = None
                continue
            continue
        m2 = DOT_LINE.match(line)
        if m2:
            dots = [int(t) for t in re.findall(r"[01]", m2.group(2))]
            if len(dots) >= 6:
                cells.append(dots[:6])
    return v_pos, h_pos, cells


def make_boxes(v_pos: list[float], h_pos: list[float], pad_frac: float = 0.12) -> list[tuple[float, float, float, float]]:
    """Intersect vertical & horizontal line positions into (cx, cy, w, h) normalized."""
    vs = sorted(v_pos)
    hs = sorted(h_pos)
    boxes: list[tuple[float, float, float, float]] = []
    for i in range(len(hs) - 1):
        for j in range(len(vs) - 1):
            cx = (vs[j] + vs[j + 1]) / 2.0
            cy = (hs[i] + hs[i + 1]) / 2.0
            w = (vs[j + 1] - vs[j]) * (1 + 2 * pad_frac)
            h = (hs[i + 1] - hs[i]) * (1 + 2 * pad_frac)
            boxes.append((cx, cy, w, h))
    return boxes


def normalize(boxes: list[tuple[float, float, float, float]], w_img: int, h_img: int) -> list[tuple[float, float, float, float]]:
    return [(cx / w_img, cy / h_img, bw / w_img, bh / h_img) for (cx, cy, bw, bh) in boxes]


def main() -> int:
    ap = argparse.ArgumentParser(description="DSBI -> YOLO labels")
    ap.add_argument("--dataset", required=True, help="Path to the DSBI repo")
    ap.add_argument("--out", required=True, help="Where to write labels/images")
    ap.add_argument("--img-ext", default=".jpg", help="Image extension used by DSBI")
    args = ap.parse_args()

    ds = Path(args.dataset)
    out = Path(args.out)
    (out / "images").mkdir(parents=True, exist_ok=True)
    (out / "labels").mkdir(parents=True, exist_ok=True)

    n = 0
    for txt in ds.rglob("*.txt"):
        try:
            v_pos, h_pos, cells = parse_annotation(txt)
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] skipping {txt}: {exc}")
            continue
        if not v_pos or not h_pos:
            print(f"[warn] no grid in {txt}")
            continue

        img_path = txt.with_suffix(args.img_ext)
        if not img_path.exists():
            # Try a couple of common extensions.
            for ext in (".png", ".tif", ".bmp", ".JPG"):
                alt = txt.with_suffix(ext)
                if alt.exists():
                    img_path = alt
                    break
        if not img_path.exists():
            print(f"[warn] no image for {txt}")
            continue

        import cv2

        h_img, w_img = cv2.imread(str(img_path)).shape[:2]
        boxes = normalize(make_boxes(v_pos, h_pos), w_img, h_img)
        if not boxes:
            continue

        label = out / "labels" / (txt.stem + ".txt")
        lines = [f"0 {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}" for (cx, cy, bw, bh) in boxes]
        label.write_text("\n".join(lines), encoding="utf-8")

        import shutil

        dest = out / "images" / img_path.name
        shutil.copy2(img_path, dest)
        n += 1

    print(f"Converted {n} pages into {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
