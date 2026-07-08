#!/usr/bin/env python3
"""
Generate tiny 100x100 recreation thumbnails for the People page hover previews.

Run once from the project root or any working directory:
    python scripts/generate_thumbnails.py

Requires: Pillow
    pip install Pillow

What it does
------------
For every pair in archive.json it takes the recreation image that the People
page hover currently shows — the poster frame for video/gif recreations, or the
recreation still otherwise — and writes a center-cropped 100x100 JPEG to:

    public/media/<mediaFolder>/thumbnails/<pairId>_r.jpg

The square center-crop (via ImageOps.fit) matches the `object-fit: cover` the
table squares already use, so the hover looks identical but downloads a ~few-KB
file instead of the full-size recreation. Clicking a square still opens the
full-size media (handled separately by the fullscreen viewer).

Re-run this whenever recreation images or posters change.

Tuning
------
--size INT   Thumbnail edge length in px (square). Default: 100
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

SCRIPT_DIR   = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
ARCHIVE_PATH = PROJECT_ROOT / "src" / "data" / "archive.json"
MEDIA_ROOT   = PROJECT_ROOT / "public" / "media"

DEFAULT_SIZE = 100


def source_path(media_folder: str, pair: dict) -> Path | None:
    """Return the recreation image the hover uses (poster for video/gif, still
    otherwise), falling back to the other if the preferred one is missing."""
    pid = pair["id"]
    poster = MEDIA_ROOT / media_folder / "posters"     / f"{pid}_r.jpg"
    still  = MEDIA_ROOT / media_folder / "recreations" / f"{pid}_r.jpg"

    media_type = (pair.get("recreationMediaType") or "image").lower()
    candidates = [poster, still] if media_type in ("video", "gif") else [still, poster]

    for c in candidates:
        if c.is_file():
            return c
    return None


def make_thumbnail(src: Path, dest: Path, size: int) -> None:
    """Write a center-cropped size x size JPEG of *src* to *dest*."""
    with Image.open(src) as img:
        img = img.convert("RGB")
        thumb = ImageOps.fit(img, (size, size), Image.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        thumb.save(dest, "JPEG", quality=82, optimize=True)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate 100x100 recreation thumbnails for the People page.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--size", type=int, default=DEFAULT_SIZE,
                   help=f"Thumbnail edge length in px (default {DEFAULT_SIZE})")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    with ARCHIVE_PATH.open(encoding="utf-8") as f:
        archive = json.load(f)

    written = 0
    skipped = 0

    for section in archive:
        media_folder = section.get("mediaFolder", "")
        for pair in section.get("pairs", []):
            pid = pair.get("id")
            if not pid:
                continue

            src = source_path(media_folder, pair)
            if src is None:
                print(f"  [skip] {pid} — no recreation image found")
                skipped += 1
                continue

            dest = MEDIA_ROOT / media_folder / "thumbnails" / f"{pid}_r.jpg"
            try:
                make_thumbnail(src, dest, args.size)
                written += 1
                print(f"  {pid}: {dest.relative_to(MEDIA_ROOT)}")
            except Exception as exc:
                print(f"  [error] {pid}: {exc}", file=sys.stderr)
                skipped += 1

    print(f"\nDone: {written} thumbnails written under {MEDIA_ROOT.relative_to(PROJECT_ROOT)}/*/thumbnails/")
    if skipped:
        print(f"  {skipped} entries skipped (no image or error)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
