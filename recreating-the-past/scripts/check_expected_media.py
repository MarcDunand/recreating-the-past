#!/usr/bin/env python3
"""Report missing local archive media files without modifying anything."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DEFAULT_ARCHIVE = REPO_ROOT / "src" / "data" / "archive.json"
DEFAULT_MEDIA_ROOT = REPO_ROOT / "public" / "media"

MEDIA_EXTENSIONS = {
    "image": ".jpg",
    "video": ".mp4",
}


@dataclass(frozen=True)
class ExpectedFile:
    artist: str
    pair_id: str
    label: str
    path: Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Check archive.json entries against expected local original, "
            "recreation, and poster files."
        )
    )
    parser.add_argument(
        "--archive",
        type=Path,
        default=DEFAULT_ARCHIVE,
        help=f"Path to archive.json. Default: {DEFAULT_ARCHIVE}",
    )
    parser.add_argument(
        "--media-root",
        type=Path,
        default=DEFAULT_MEDIA_ROOT,
        help=f"Path to public media root. Default: {DEFAULT_MEDIA_ROOT}",
    )
    return parser.parse_args()


def load_archive(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as archive_file:
        data = json.load(archive_file)

    if not isinstance(data, list):
        raise ValueError(f"Archive should be a list, got {type(data).__name__}")

    return data


def media_extension(media_type: str, artist: str, pair_id: str, side: str) -> str:
    try:
        return MEDIA_EXTENSIONS[media_type]
    except KeyError as exc:
        known_types = ", ".join(sorted(MEDIA_EXTENSIONS))
        raise ValueError(
            f"Unknown {side} media type {media_type!r} for {artist} / {pair_id}. "
            f"Expected one of: {known_types}"
        ) from exc


def expected_files(archive: list[dict[str, Any]], media_root: Path) -> list[ExpectedFile]:
    files: list[ExpectedFile] = []

    for section in archive:
        artist = section.get("artist", "Unknown artist")
        media_folder = section.get("mediaFolder")
        pairs = section.get("pairs", [])

        if not media_folder:
            raise ValueError(f"Missing mediaFolder for artist section {artist!r}")
        if not isinstance(pairs, list):
            raise ValueError(f"pairs should be a list for artist section {artist!r}")

        section_root = media_root / media_folder

        for pair in pairs:
            pair_id = pair.get("id")
            if not pair_id:
                raise ValueError(f"Missing pair id in artist section {artist!r}")

            original_type = pair.get("originalMediaType", "")
            recreation_type = pair.get("recreationMediaType", "")

            original_ext = media_extension(
                original_type,
                artist,
                pair_id,
                "original",
            )
            recreation_ext = media_extension(
                recreation_type,
                artist,
                pair_id,
                "recreation",
            )

            files.extend(
                [
                    ExpectedFile(
                        artist,
                        pair_id,
                        "original",
                        section_root / "originals" / f"{pair_id}_o{original_ext}",
                    ),
                    ExpectedFile(
                        artist,
                        pair_id,
                        "recreation",
                        section_root / "recreations" / f"{pair_id}_r{recreation_ext}",
                    ),
                ]
            )

            if original_type == "video":
                files.append(
                    ExpectedFile(
                        artist,
                        pair_id,
                        "original poster",
                        section_root / "posters" / f"{pair_id}_o.jpg",
                    )
                )
            if recreation_type == "video":
                files.append(
                    ExpectedFile(
                        artist,
                        pair_id,
                        "recreation poster",
                        section_root / "posters" / f"{pair_id}_r.jpg",
                    )
                )

    return files


def relative_to_current_dir(path: Path) -> str:
    try:
        return str(path.relative_to(Path.cwd()))
    except ValueError:
        return str(path)


def main() -> int:
    args = parse_args()
    archive_path = args.archive.resolve()
    media_root = args.media_root.resolve()

    archive = load_archive(archive_path)
    expected = expected_files(archive, media_root)
    missing = [item for item in expected if not item.path.is_file()]

    print(f"Archive: {relative_to_current_dir(archive_path)}")
    print(f"Media root: {relative_to_current_dir(media_root)}")
    print(f"Expected files: {len(expected)}")
    print(f"Missing files: {len(missing)}")

    if missing:
        print()
        current_artist = None
        current_pair = None
        for item in missing:
            if item.artist != current_artist:
                current_artist = item.artist
                current_pair = None
                print(f"{item.artist}")
            if item.pair_id != current_pair:
                current_pair = item.pair_id
                print(f"  {item.pair_id}")
            print(f"    - {item.label}: {relative_to_current_dir(item.path)}")
        return 1

    print("All expected media files are present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
