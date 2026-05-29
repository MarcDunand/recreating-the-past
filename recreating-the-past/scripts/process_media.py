#!/usr/bin/env python3
"""Process local manifest media into the site's public media folders."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DEFAULT_MANIFEST = PROJECT_ROOT / "src" / "data" / "media_manifest.json"
DEFAULT_MEDIA_ROOT = PROJECT_ROOT / "public" / "media"

SUPPORTED_SOURCE_TYPES = {"local_video", "local_image", "local_gif"}
VIDEO_SOURCE_TYPES = {"local_video", "local_gif"}
IMAGE_SOURCE_TYPES = {"local_image"}


@dataclass
class Report:
    processed: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)

    def add(self, category: str, message: str) -> None:
        getattr(self, category).append(message)


@dataclass(frozen=True)
class SideJob:
    artist: str
    media_folder: str
    entry_id: str
    side: str
    suffix: str
    source_type: str
    source: str
    start: str
    duration: str
    media_output: Path
    poster_output: Path

    @property
    def label(self) -> str:
        return f"{self.artist} / {self.entry_id} / {self.side}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Process local media_manifest.json sources into web-ready media."
    )
    parser.add_argument(
        "artist_slug",
        help="Artist slug to process, such as vera-molnar or john-whitney.",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
        help=f"Path to media manifest. Default: {DEFAULT_MANIFEST}",
    )
    parser.add_argument(
        "--media-root",
        type=Path,
        default=DEFAULT_MEDIA_ROOT,
        help=f"Output media root. Default: {DEFAULT_MEDIA_ROOT}",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing output files.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would happen without writing files.",
    )
    return parser.parse_args()


def load_manifest(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as manifest_file:
        data = json.load(manifest_file)
    if not isinstance(data, list):
        raise ValueError(f"Manifest should be a list, got {type(data).__name__}")
    return data


def require_ffmpeg() -> str:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError(
            "ffmpeg is not installed or is not on PATH. Install ffmpeg, then rerun "
            "this script from the project root or any working directory."
        )
    return ffmpeg


def resolve_source(manifest_path: Path, source: str) -> Path:
    source_path = Path(source)
    if source_path.is_absolute():
        return source_path
    return (manifest_path.parent / source_path).resolve()


def relative_path(path: Path) -> str:
    try:
        return str(path.relative_to(Path.cwd()))
    except ValueError:
        return str(path)


def output_paths(media_root: Path, media_folder: str, entry_id: str, suffix: str, is_video: bool) -> tuple[Path, Path]:
    media_dir = media_root / media_folder / ("originals" if suffix == "o" else "recreations")
    media_ext = ".mp4" if is_video else ".jpg"
    media_output = media_dir / f"{entry_id}_{suffix}{media_ext}"
    poster_output = media_root / media_folder / "posters" / f"{entry_id}_{suffix}.jpg"
    return media_output, poster_output


def iter_jobs(
    manifest: list[dict[str, Any]],
    artist_slug: str,
    media_root: Path,
) -> list[SideJob]:
    jobs: list[SideJob] = []
    matched_section = False
    for section in manifest:
        if section.get("artistSlug") != artist_slug:
            continue

        matched_section = True
        artist = section.get("artist", "Unknown artist")
        media_folder = section.get("mediaFolder")
        entries = section.get("entries", [])
        if not media_folder:
            raise ValueError(f"Missing mediaFolder for artist section {artist!r}")
        if not isinstance(entries, list):
            raise ValueError(f"entries should be a list for artist section {artist!r}")

        for entry in entries:
            entry_id = entry.get("id")
            if not entry_id:
                raise ValueError(f"Missing entry id in artist section {artist!r}")

            for side, suffix in (("original", "o"), ("recreation", "r")):
                side_data = entry.get(side)
                if not isinstance(side_data, dict):
                    raise ValueError(f"Missing {side} object for {artist} / {entry_id}")

                source_type = side_data.get("sourceType", "")
                is_video = source_type in VIDEO_SOURCE_TYPES
                media_output, poster_output = output_paths(
                    media_root, media_folder, entry_id, suffix, is_video
                )
                jobs.append(
                    SideJob(
                        artist=artist,
                        media_folder=media_folder,
                        entry_id=entry_id,
                        side=side,
                        suffix=suffix,
                        source_type=source_type,
                        source=side_data.get("source", ""),
                        start=side_data.get("start", ""),
                        duration=side_data.get("duration", ""),
                        media_output=media_output,
                        poster_output=poster_output,
                    )
                )
    if not matched_section:
        available = ", ".join(
            sorted(section.get("artistSlug", "") for section in manifest if section.get("artistSlug"))
        )
        raise ValueError(
            f"Artist slug {artist_slug!r} was not found in the manifest. "
            f"Available artist slugs: {available or 'none'}"
        )

    return jobs


def run_command(command: list[str], dry_run: bool) -> subprocess.CompletedProcess[str] | None:
    if dry_run:
        print("DRY RUN:", " ".join(command))
        return None
    return subprocess.run(command, capture_output=True, text=True)


def ensure_parent_dirs(paths: list[Path], dry_run: bool) -> None:
    if dry_run:
        for path in sorted({item.parent for item in paths}):
            print(f"DRY RUN: create directory {relative_path(path)}")
        return
    for path in paths:
        path.parent.mkdir(parents=True, exist_ok=True)


def expected_outputs(job: SideJob) -> list[Path]:
    outputs = [job.media_output]
    if job.source_type in VIDEO_SOURCE_TYPES:
        outputs.append(job.poster_output)
    elif job.source_type in IMAGE_SOURCE_TYPES and job.poster_output != job.media_output:
        outputs.append(job.poster_output)
    return outputs


def existing_outputs(job: SideJob) -> list[Path]:
    return [path for path in expected_outputs(job) if path.exists()]


def should_skip_existing(job: SideJob, force: bool) -> str | None:
    existing = existing_outputs(job)
    expected = expected_outputs(job)
    if existing and len(existing) == len(expected) and not force:
        outputs = ", ".join(relative_path(path) for path in existing)
        return f"{job.label}: output exists ({outputs}); use --force to overwrite"
    return None


def ffmpeg_video_command(ffmpeg: str, source: Path, output: Path, start: str, duration: str) -> list[str]:
    command = [ffmpeg, "-y"]
    if start:
        command.extend(["-ss", start])
    command.extend(["-i", str(source)])
    if duration:
        command.extend(["-t", duration])
    command.extend(
        [
            "-vf",
            "scale='min(1920,iw)':-2",
            "-c:v",
            "libx264",
            "-crf",
            "24",
            "-preset",
            "slow",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-an",
            str(output),
        ]
    )
    return command


def ffmpeg_image_command(ffmpeg: str, source: Path, output: Path) -> list[str]:
    return [ffmpeg, "-y", "-i", str(source), "-frames:v", "1", "-q:v", "2", str(output)]


def ffmpeg_poster_command(ffmpeg: str, source: Path, output: Path) -> list[str]:
    return [ffmpeg, "-y", "-ss", "00:00:02", "-i", str(source), "-frames:v", "1", "-q:v", "2", str(output)]


def copy_file(source: Path, output: Path, dry_run: bool) -> None:
    if dry_run:
        print(f"DRY RUN: copy {relative_path(source)} -> {relative_path(output)}")
        return
    shutil.copy2(source, output)


def handle_completed(
    result: subprocess.CompletedProcess[str] | None,
    report: Report,
    failure_message: str,
) -> bool:
    if result is None:
        return True
    if result.returncode == 0:
        return True
    stderr = result.stderr.strip() or result.stdout.strip() or "no ffmpeg output"
    report.add("failed", f"{failure_message}: {stderr}")
    return False


def process_video(
    job: SideJob,
    source: Path,
    ffmpeg: str,
    force: bool,
    dry_run: bool,
    report: Report,
) -> bool:
    ensure_parent_dirs([job.media_output, job.poster_output], dry_run)
    if force or not job.media_output.exists():
        result = run_command(
            ffmpeg_video_command(ffmpeg, source, job.media_output, job.start, job.duration),
            dry_run,
        )
        if not handle_completed(result, report, f"{job.label}: failed to convert video/GIF"):
            return False

    if force or not job.poster_output.exists():
        poster_source = job.media_output if not dry_run and job.media_output.exists() else source
        result = run_command(ffmpeg_poster_command(ffmpeg, poster_source, job.poster_output), dry_run)
        if not handle_completed(result, report, f"{job.label}: failed to generate poster"):
            return False
    return True


def process_image(
    job: SideJob,
    source: Path,
    ffmpeg: str,
    force: bool,
    dry_run: bool,
    report: Report,
) -> bool:
    ensure_parent_dirs([job.media_output, job.poster_output], dry_run)
    if force or not job.media_output.exists():
        if source.suffix.lower() in {".jpg", ".jpeg"}:
            if source.resolve() != job.media_output.resolve():
                copy_file(source, job.media_output, dry_run)
        else:
            result = run_command(ffmpeg_image_command(ffmpeg, source, job.media_output), dry_run)
            if not handle_completed(result, report, f"{job.label}: failed to convert image"):
                return False

    if job.poster_output != job.media_output and (force or not job.poster_output.exists()):
        poster_source = job.media_output if not dry_run and job.media_output.exists() else source
        copy_file(poster_source, job.poster_output, dry_run)
    return True


def process_job(
    job: SideJob,
    manifest_path: Path,
    ffmpeg: str,
    force: bool,
    dry_run: bool,
    report: Report,
) -> None:
    if job.source_type not in SUPPORTED_SOURCE_TYPES:
        report.add("skipped", f"{job.label}: unsupported sourceType {job.source_type!r}")
        return

    if not job.source:
        report.add("missing", f"{job.label}: empty local source path")
        return

    source = resolve_source(manifest_path, job.source)
    if not source.is_file():
        report.add("missing", f"{job.label}: source not found ({relative_path(source)})")
        return

    skip_reason = should_skip_existing(job, force)
    if skip_reason:
        report.add("skipped", skip_reason)
        return

    planned_outputs = [path for path in expected_outputs(job) if force or not path.exists()]

    if job.source_type in VIDEO_SOURCE_TYPES:
        ok = process_video(job, source, ffmpeg, force, dry_run, report)
    else:
        ok = process_image(job, source, ffmpeg, force, dry_run, report)

    if ok:
        action = "would process" if dry_run else "processed"
        outputs = ", ".join(relative_path(path) for path in planned_outputs)
        report.add(
            "processed",
            f"{job.label}: {action} {relative_path(source)} -> {outputs}",
        )


def print_report(report: Report) -> None:
    print()
    print("Media processing report")
    print(f"  processed: {len(report.processed)}")
    print(f"  skipped:   {len(report.skipped)}")
    print(f"  missing:   {len(report.missing)}")
    print(f"  failed:    {len(report.failed)}")

    for title, items in (
        ("Processed", report.processed),
        ("Skipped", report.skipped),
        ("Missing", report.missing),
        ("Failed", report.failed),
    ):
        if not items:
            continue
        print()
        print(title)
        for item in items:
            print(f"  - {item}")


def main() -> int:
    args = parse_args()
    manifest_path = args.manifest.resolve()
    media_root = args.media_root.resolve()
    report = Report()

    try:
        manifest = load_manifest(manifest_path)
        jobs = iter_jobs(manifest, args.artist_slug, media_root)
        ffmpeg = require_ffmpeg()
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    for job in jobs:
        process_job(job, manifest_path, ffmpeg, args.force, args.dry_run, report)

    print_report(report)
    return 1 if report.failed or report.missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
