#!/usr/bin/env python3
"""
Generate colors.json from recreation images using LAB k-means clustering.

Run once from the project root or any working directory:
    python scripts/generate_colors.py

Requires: Pillow, scikit-learn, numpy
    pip install Pillow scikit-learn numpy

Algorithm
---------
For each recreation image, k-means is run in CIELAB color space (perceptually
uniform, so cluster centroids represent visually distinct colors). Every entry
in archive.json gets two colors written to src/data/colors.json:

  fill      — hex color of the largest cluster (dominant / outer ring color)
  innerFill — hex color of the most chromatic qualifying cluster (inner square)

The inner color is always the most chromatically vibrant non-dominant cluster
that covers at least --min-bucket-pct of the image. If no cluster clears that
threshold, the second-largest cluster is used as a fallback so innerFill is
always a valid color.

Tuning dials
------------
--k INT               K-means cluster count.
                      Fewer clusters → broader, more-distinct color buckets.
                      More clusters → finer distinctions, but centroids may be
                      very similar to one another.
                      Default: 8

--min-bucket-pct NUM  Minimum fraction (0–1) of image pixels a cluster must
                      represent to be considered as the inner color.
                      Raise to require the inner color to be more prominent.
                      Default: 0.05  (5 %)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from sklearn.cluster import KMeans

SCRIPT_DIR   = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
ARCHIVE_PATH = PROJECT_ROOT / "src" / "data" / "archive.json"
COLORS_PATH  = PROJECT_ROOT / "src" / "data" / "colors.json"
MEDIA_ROOT   = PROJECT_ROOT / "public"  / "media"

# ── Defaults (match docstring above) ──────────────────────────────────────────

DEFAULT_K              = 8
DEFAULT_MIN_BUCKET_PCT = 0.05

# ── Pure-numpy sRGB <-> CIELAB conversion (no skimage required) ───────────────

# D65 white point
_D65 = np.array([0.95047, 1.00000, 1.08883])

# sRGB → XYZ (D65) matrix
_M_RGB_XYZ = np.array([
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041],
])

# XYZ → sRGB matrix
_M_XYZ_RGB = np.array([
    [ 3.2404542, -1.5371385, -0.4985314],
    [-0.9692660,  1.8760108,  0.0415560],
    [ 0.0556434, -0.2040259,  1.0572252],
])


def _linearise(c: np.ndarray) -> np.ndarray:
    """sRGB gamma → linear light."""
    out = np.empty_like(c)
    m = c > 0.04045
    out[m]  = ((c[m] + 0.055) / 1.055) ** 2.4
    out[~m] = c[~m] / 12.92
    return out


def _delinearise(c: np.ndarray) -> np.ndarray:
    """Linear light → sRGB gamma."""
    out = np.empty_like(c)
    m = c > 0.0031308
    out[m]  = 1.055 * c[m] ** (1.0 / 2.4) - 0.055
    out[~m] = 12.92 * c[~m]
    return out


def _xyz_to_f(t: np.ndarray) -> np.ndarray:
    eps, kappa = 0.008856, 903.3
    out = np.empty_like(t)
    m = t > eps
    out[m]  = t[m] ** (1.0 / 3.0)
    out[~m] = (kappa * t[~m] + 16.0) / 116.0
    return out


def rgb_uint8_to_lab(rgb: np.ndarray) -> np.ndarray:
    """Convert (..., 3) uint8 array to CIELAB float64."""
    c = rgb.astype(np.float64) / 255.0
    c = _linearise(c)
    xyz = c @ _M_RGB_XYZ.T
    xyz /= _D65
    f = _xyz_to_f(xyz)
    L = 116.0 * f[..., 1] - 16.0
    a = 500.0 * (f[..., 0] - f[..., 1])
    b = 200.0 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def lab_to_hex(lab_vec: np.ndarray) -> str:
    """Convert a single (3,) LAB vector to '#rrggbb'."""
    L, a, b = lab_vec
    fy = (L + 16.0) / 116.0
    fx = a / 500.0 + fy
    fz = fy - b / 200.0

    eps, kappa = 0.008856, 903.3
    xyz = np.array([
        fx ** 3 if fx ** 3 > eps else (116.0 * fx - 16.0) / kappa,
        fy ** 3 if L > kappa * eps else L / kappa,
        fz ** 3 if fz ** 3 > eps else (116.0 * fz - 16.0) / kappa,
    ]) * _D65

    rgb = np.clip(xyz @ _M_XYZ_RGB.T, 0.0, 1.0)
    rgb = np.clip(_delinearise(rgb), 0.0, 1.0)
    r, g, bl = (int(round(x * 255)) for x in rgb)
    return f"#{r:02x}{g:02x}{bl:02x}"


# ── Image path resolution ──────────────────────────────────────────────────────

def image_path(media_folder: str, pair: dict) -> Path | None:
    """Return the path of the best available recreation image for a pair."""
    pid = pair["id"]
    candidates = [
        MEDIA_ROOT / media_folder / "posters"      / f"{pid}_r.jpg",
        MEDIA_ROOT / media_folder / "recreations"  / f"{pid}_r.jpg",
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


# ── Core colour extraction ─────────────────────────────────────────────────────

def extract_colors(
    img_path: Path,
    k: int,
    min_bucket_pct: float,
) -> dict:
    """Run LAB k-means on *img_path* and return a dict with fill / innerFill."""
    img = Image.open(img_path).convert("RGB")
    img = img.resize((120, 120), Image.LANCZOS)

    rgb_flat = np.array(img, dtype=np.uint8).reshape(-1, 3)
    lab_flat = rgb_uint8_to_lab(rgb_flat)   # (N, 3)

    # K-means may need fewer clusters than pixels
    actual_k = min(k, len(np.unique(rgb_flat, axis=0)))
    km = KMeans(n_clusters=actual_k, n_init=10, random_state=42)
    labels = km.fit_predict(lab_flat)
    centers = km.cluster_centers_           # (actual_k, 3) in LAB

    counts  = np.bincount(labels, minlength=actual_k)
    order   = np.argsort(-counts)           # largest cluster first

    dominant_lab = centers[order[0]]
    fill_hex     = lab_to_hex(dominant_lab)

    n_pixels    = len(labels)
    inner_hex   = None
    best_chroma = -1.0

    for idx in order[1:]:
        frac   = counts[idx] / n_pixels
        chroma = float(np.sqrt(centers[idx][1] ** 2 + centers[idx][2] ** 2))
        if frac >= min_bucket_pct and chroma > best_chroma:
            best_chroma = chroma
            inner_hex   = lab_to_hex(centers[idx])

    # Fallback: if no cluster cleared min_bucket_pct, use the second-largest
    if inner_hex is None and len(order) > 1:
        inner_hex = lab_to_hex(centers[order[1]])

    return {"fill": fill_hex, "innerFill": inner_hex or fill_hex}


# ── Entry point ────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate colors.json from recreation images.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--k", type=int, default=DEFAULT_K,
                   help=f"K-means cluster count (default {DEFAULT_K})")
    p.add_argument("--min-bucket-pct", type=float, default=DEFAULT_MIN_BUCKET_PCT,
                   help=f"Min cluster pixel fraction for accent (default {DEFAULT_MIN_BUCKET_PCT})")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    with ARCHIVE_PATH.open(encoding="utf-8") as f:
        archive = json.load(f)

    colors: dict[str, dict] = {}
    skipped = 0

    for section in archive:
        media_folder = section.get("mediaFolder", "")
        for pair in section.get("pairs", []):
            pid = pair.get("id")
            if not pid:
                continue

            path = image_path(media_folder, pair)
            if path is None:
                print(f"  [skip] {pid} — no image found")
                skipped += 1
                continue

            try:
                result = extract_colors(
                    path,
                    k=args.k,
                    min_bucket_pct=args.min_bucket_pct,
                )
                colors[pid] = result
                print(f"  {pid}: {result['fill']} + inner {result['innerFill']}")
            except Exception as exc:
                print(f"  [error] {pid}: {exc}", file=sys.stderr)
                skipped += 1

    with COLORS_PATH.open("w", encoding="utf-8") as f:
        json.dump(colors, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nDone: {len(colors)} entries written to {COLORS_PATH.relative_to(PROJECT_ROOT)}")
    if skipped:
        print(f"  {skipped} entries skipped (no image or error)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
