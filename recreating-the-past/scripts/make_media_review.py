#!/usr/bin/env python3
"""Generate a standalone HTML review page for local archive media posters."""

from __future__ import annotations

import argparse
import html
import json
import os
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DEFAULT_ARCHIVE = PROJECT_ROOT / "src" / "data" / "archive.json"
DEFAULT_MEDIA_ROOT = PROJECT_ROOT / "public" / "media"
DEFAULT_OUTPUT = PROJECT_ROOT / "review" / "media_review.html"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create an HTML contact sheet for expected archive media posters."
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
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output HTML file. Default: {DEFAULT_OUTPUT}",
    )
    return parser.parse_args()


def load_archive(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as archive_file:
        data = json.load(archive_file)
    if not isinstance(data, list):
        raise ValueError(f"Archive should be a list, got {type(data).__name__}")
    return data


def rel_link(target: Path, from_file: Path) -> str:
    relative = os.path.relpath(target, from_file.parent)
    return relative.replace(os.sep, "/")


def esc(value: Any) -> str:
    return html.escape(str(value), quote=True)


def poster_panel(
    label: str,
    poster_path: Path,
    mp4_path: Path,
    output_path: Path,
) -> str:
    poster_label = esc(label)
    if poster_path.is_file():
        poster_html = (
            f'<img src="{esc(rel_link(poster_path, output_path))}" '
            f'alt="{poster_label} poster" loading="lazy">'
        )
        status = '<span class="status ok">poster found</span>'
    else:
        poster_html = (
            '<div class="missing-box">'
            '<strong>Missing poster</strong>'
            f'<code>{esc(str(poster_path))}</code>'
            '</div>'
        )
        status = '<span class="status missing">missing poster</span>'

    if mp4_path.is_file():
        video_link = (
            f'<a class="video-link" href="{esc(rel_link(mp4_path, output_path))}">'
            "open mp4"
            "</a>"
        )
    else:
        video_link = '<span class="video-missing">no local mp4</span>'

    return f"""
          <div class="panel">
            <div class="panel-head">
              <span>{poster_label}</span>
              {status}
            </div>
            <div class="poster-frame">
              {poster_html}
            </div>
            <div class="panel-foot">{video_link}</div>
          </div>
    """


def build_row(section: dict[str, Any], pair: dict[str, Any], media_root: Path, output_path: Path) -> str:
    artist = section.get("artist", "Unknown artist")
    media_folder = section.get("mediaFolder", "")
    pair_id = pair.get("id", "")

    folder_root = media_root / media_folder
    original_poster = folder_root / "posters" / f"{pair_id}_o.jpg"
    recreation_poster = folder_root / "posters" / f"{pair_id}_r.jpg"
    original_mp4 = folder_root / "originals" / f"{pair_id}_o.mp4"
    recreation_mp4 = folder_root / "recreations" / f"{pair_id}_r.mp4"

    original_panel = poster_panel("Original", original_poster, original_mp4, output_path)
    recreation_panel = poster_panel("Recreation", recreation_poster, recreation_mp4, output_path)

    return f"""
      <article class="entry">
        <header class="entry-meta">
          <div>
            <h2>{esc(pair.get("originalTitle", "Untitled"))}</h2>
            <p>{esc(artist)} · {esc(pair.get("originalYear", "unknown"))}</p>
          </div>
          <dl>
            <div><dt>Student</dt><dd>{esc(pair.get("student", ""))}</dd></div>
            <div><dt>ID</dt><dd><code>{esc(pair_id)}</code></dd></div>
          </dl>
        </header>
        <div class="comparison">
          {original_panel}
          {recreation_panel}
        </div>
      </article>
    """


def build_html(archive: list[dict[str, Any]], media_root: Path, output_path: Path) -> str:
    rows: list[str] = []
    total_pairs = 0
    missing_posters = 0

    for section in archive:
        pairs = section.get("pairs", [])
        if not isinstance(pairs, list):
            raise ValueError(f"pairs should be a list for {section.get('artist', 'unknown artist')}")
        for pair in pairs:
            total_pairs += 1
            pair_id = pair.get("id", "")
            media_folder = section.get("mediaFolder", "")
            poster_root = media_root / media_folder / "posters"
            if not (poster_root / f"{pair_id}_o.jpg").is_file():
                missing_posters += 1
            if not (poster_root / f"{pair_id}_r.jpg").is_file():
                missing_posters += 1
            rows.append(build_row(section, pair, media_root, output_path))

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Media Review</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f7f7f4;
      --ink: #171717;
      --muted: #666;
      --line: #d8d8d0;
      --panel: #fff;
      --missing: #b42318;
      --ok: #22713f;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.4;
    }}
    main {{
      max-width: 1400px;
      margin: 0 auto;
      padding: 32px 20px 56px;
    }}
    .page-head {{
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: end;
      border-bottom: 1px solid var(--line);
      padding-bottom: 20px;
      margin-bottom: 24px;
    }}
    h1 {{
      font-size: 32px;
      margin: 0 0 6px;
      letter-spacing: 0;
    }}
    .summary {{
      margin: 0;
      color: var(--muted);
    }}
    .entry {{
      border-bottom: 1px solid var(--line);
      padding: 24px 0 30px;
    }}
    .entry-meta {{
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      align-items: start;
      margin-bottom: 14px;
    }}
    h2 {{
      font-size: 20px;
      margin: 0 0 4px;
      letter-spacing: 0;
    }}
    .entry-meta p {{
      margin: 0;
      color: var(--muted);
    }}
    dl {{
      display: grid;
      grid-template-columns: auto auto;
      gap: 10px 18px;
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }}
    dt {{
      font-weight: 700;
      color: var(--ink);
    }}
    dd {{ margin: 0; }}
    code {{
      font-family: Consolas, Monaco, monospace;
      font-size: 12px;
    }}
    .comparison {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }}
    .panel {{
      background: var(--panel);
      border: 1px solid var(--line);
    }}
    .panel-head,
    .panel-foot {{
      min-height: 38px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 10px;
      font-size: 13px;
    }}
    .panel-head {{
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    .poster-frame {{
      aspect-ratio: 16 / 9;
      display: grid;
      place-items: center;
      background: #ededE8;
      overflow: hidden;
    }}
    img {{
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }}
    .status {{
      font-weight: 700;
      font-size: 12px;
    }}
    .status.ok {{ color: var(--ok); }}
    .status.missing {{ color: var(--missing); }}
    .missing-box {{
      width: 100%;
      height: 100%;
      display: grid;
      align-content: center;
      gap: 10px;
      padding: 18px;
      color: var(--missing);
      border: 3px solid var(--missing);
      background: #fff4f2;
      overflow-wrap: anywhere;
    }}
    .missing-box code {{
      color: #5f1812;
      line-height: 1.5;
    }}
    .video-link {{
      color: #174ea6;
      font-weight: 700;
    }}
    .video-missing {{
      color: var(--muted);
    }}
    @media (max-width: 760px) {{
      .page-head,
      .entry-meta,
      .comparison {{
        grid-template-columns: 1fr;
      }}
      dl {{
        grid-template-columns: 1fr;
      }}
    }}
  </style>
</head>
<body>
  <main>
    <header class="page-head">
      <div>
        <h1>Media Review</h1>
        <p class="summary">{total_pairs} pairs · {missing_posters} missing poster files</p>
      </div>
    </header>
    {''.join(rows)}
  </main>
</body>
</html>
"""


def main() -> int:
    args = parse_args()
    archive_path = args.archive.resolve()
    media_root = args.media_root.resolve()
    output_path = args.output.resolve()

    archive = load_archive(archive_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(build_html(archive, media_root, output_path), encoding="utf-8")
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
