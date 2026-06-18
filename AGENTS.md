# Recreating the Past Website — Agent Instructions

## Project overview

This is a custom static website for the MIT Media Lab course “Recreating the Past,” taught by Zach Lieberman. The site is an archive of student recreations of historical computational artworks.

The main page is a visual comparison archive. Each entry pairs:

Original artwork → Student recreation

The website is built as a static site using Astro with a React component for the interactive archive.

The final deployed site should be static and portable: HTML, CSS, JS, JSON, images, videos, and poster frames. Avoid server-side dependencies, paid APIs, external CMS systems, or runtime services.

## Current tech stack

- Astro
- React component for archive interaction
- Plain CSS
- JSON data file
- Local media files in `public/media/`
- Native HTML `<video>` for local video playback
- ffmpeg for media processing scripts

## Important files

- `src/pages/index.astro`
- `src/components/RecreationsArchive.jsx`
- `src/components/RecreationsArchive.css`
- `src/data/archive.json`
- `src/data/media_manifest.json`
- `scripts/check_expected_media.py`
- `scripts/process_media.py`
- `scripts/make_media_review.py`
- `scripts/README_media_pipeline.md`
- `public/media/`

## Data structure

The archive JSON is an array of artist sections.

Each artist has:

```json
{
  "artist": "Vera Molnár",
  "artistSlug": "vera-molnar",
  "mediaFolder": "molnar",
  "pairs": []
}
```

Each pair has:

```json
{
  "id": "marc_catalog",
  "originalTitle": "Catalog",
  "originalYear": "1961",
  "originalMediaType": "video",
  "originalLink": "https://...",
  "student": "Marc Dunand",
  "recreationMediaType": "video",
  "recreationLink": "https://..."
}
```

The `id` is used to derive local media filenames.

### Media vs. links

Keep these concepts separate:

- `originalMediaType` and `recreationMediaType` describe the local media shown on the comparison page.
- `originalLink` is the public citation/official page for the original artwork, shown below the original media.
- `recreationLink` is the public link to the student's code, sketch, or project page, shown below the recreation media.
- `recreationLink` may be empty when no public code/sketch link is available.

Do not treat `originalLink` or `recreationLink` as media-processing sources unless the user explicitly asks for that. Media-processing source URLs and local source paths belong in `src/data/media_manifest.json`.

## Media manifest

`src/data/media_manifest.json` describes how to produce the local media files that the site expects. It should not duplicate all archive metadata.

The manifest is organized as a list of artist sections:

```json
{
  "artist": "John Whitney",
  "artistSlug": "john-whitney",
  "mediaFolder": "whitney",
  "entries": []
}
```

Each entry corresponds to one archive pair and has `original` and `recreation` source instructions:

```json
{
  "id": "marc_catalog",
  "original": {
    "sourceType": "youtube",
    "source": "https://...",
    "start": "00:00:00",
    "duration": "00:00:12",
    "notes": ""
  },
  "recreation": {
    "sourceType": "p5",
    "source": "https://...",
    "start": "",
    "duration": "",
    "notes": ""
  }
}
```

Allowed `sourceType` values:

- `local_video`
- `local_image`
- `local_gif`
- `youtube`
- `google_drive`
- `dropbox`
- `p5`
- `openprocessing`
- `missing`

For local source types, `source` paths should be relative to `src/data/media_manifest.json`, not absolute.

## Media naming convention

For an entry with:

```json
"id": "marc_catalog"
```

the local files should be:

```txt
public/media/<mediaFolder>/originals/marc_catalog_o.mp4
public/media/<mediaFolder>/recreations/marc_catalog_r.mp4
public/media/<mediaFolder>/posters/marc_catalog_o.jpg
public/media/<mediaFolder>/posters/marc_catalog_r.jpg
```

For image-only entries, use `.jpg` instead of `.mp4`.

Suffixes:

- `_o` = original
- `_r` = recreation

Examples:

```txt
public/media/whitney/originals/marc_catalog_o.mp4
public/media/whitney/recreations/marc_catalog_r.mp4
public/media/whitney/posters/marc_catalog_o.jpg
public/media/whitney/posters/marc_catalog_r.jpg
```

## Current archive layout

The current chosen layout is:

- One vertical column of large original/recreation pairs.
- Each row has:
  - a slim left-side timeline entry with the original title and year
  - a large original image/video on the left
  - a slim gutter
  - a large recreation image/video on the right
- The top bar says:
  - `Original → Recreation`
- Hovering over each side shows only a small bottom caption:
  - original side: `Artist, Original Title`
  - recreation side: `Student Name, Recreation`
- No hover highlighting.
- A minimalist left-side artist navigation shows dots; hovered dots reveal artist names.
- A yellow diamond below the artist dots represents the Final Project section.

## Media pipeline goal

Scripts in `scripts/` build and review local media folders for each week/artist.

For each item in `archive.json`, the pipeline should produce:

```txt
public/media/<mediaFolder>/originals/<id>_o.mp4 or .jpg
public/media/<mediaFolder>/recreations/<id>_r.mp4 or .jpg
public/media/<mediaFolder>/posters/<id>_o.jpg
public/media/<mediaFolder>/posters/<id>_r.jpg
```

The source media may come from:

- embedded GIFs/images extracted from Google Doc exports
- local videos
- Google Drive videos
- Dropbox clips
- YouTube links
- p5.js/OpenProcessing sketches that may need screen recording
- timestamped excerpts from longer videos

Current scripts:

- `scripts/check_expected_media.py` reports missing expected local media/poster files from `archive.json`.
- `scripts/process_media.py` reads `media_manifest.json` and generates web-ready local media for one artist.
- `scripts/make_media_review.py` generates `review/media_review.html`, a local contact sheet for checking poster pairs.
- `scripts/README_media_pipeline.md` documents media-pipeline commands.

`process_media.py` requires an artist slug:

```powershell
python scripts/process_media.py john-whitney --dry-run
python scripts/process_media.py vera-molnar --dry-run
```

It also accepts `help` as a friendly alias for `--help`:

```powershell
python scripts/process_media.py help
```

## Preferred media processing behavior

Use `ffmpeg` for:

- trimming clips
- converting GIF/video to web-ready MP4
- generating poster frames
- scaling videos to reasonable web resolution
- removing audio unless needed
- normalizing codecs for browser playback

Preferred web video format:

- `.mp4`
- H.264
- yuv420p
- `-movflags +faststart`
- usually 720p or 1080p max

Example ffmpeg output style:

```bash
ffmpeg -i input.mov -vf "scale='min(1920,iw)':-2" -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart -an output.mp4
```

Poster frame:

```bash
ffmpeg -ss 00:00:02 -i input.mp4 -frames:v 1 poster.jpg
```

Poster frames should default to 2 seconds into the processed clip. If the clip is shorter than 2 seconds, use the clip midpoint instead.

Accepted `start` and `duration` formats in the media manifest:

- `""`
- `"12"`
- `"12.5"`
- `"00:00:12"`
- `"00:34:50"`

`process_media.py` currently supports processing:

- `local_video`
- `local_image`
- `local_gif`
- `youtube`
- `dropbox`

Do not download remote sources unless the user passes `--download`. Without `--download`, downloadable sources should be reported as needing download.

YouTube and Dropbox downloads use `yt-dlp` when available. YouTube may require browser cookies if it reports `Sign in to confirm you're not a bot`. Keep browser-cookie access explicit:

```powershell
python scripts/process_media.py john-whitney --download --cookies-from-browser chrome
python scripts/process_media.py john-whitney --download --cookies-from-browser edge
python scripts/process_media.py john-whitney --download --cookies-from-browser firefox
```

Downloaded source files are cached separately from final media:

```txt
public/<mediaFolder>/originals/<id>_o_source.mp4
public/<mediaFolder>/recreations/<id>_r_source.mp4
```

Final generated media still belongs under `public/media/<mediaFolder>/...`.

## Robustness goals

The final site should not rely on:

- YouTube embeds
- Vimeo embeds
- live Google Drive embeds
- live Dropbox embeds
- paid video services
- Notion/Airtable/Google Sheets as runtime CMS
- server-side rendering

External source links should remain in JSON as citations/credits, but the site should serve local media files when possible.

## Do not do

- Do not change the archive data schema without explaining why.
- Do not hard-code individual artworks into React components.
- Do not assume every entry is an image; support video.
- Do not use remote embeds for final playback unless explicitly requested.
- Do not delete original source links.
- Do not place large source-quality videos directly in Git if avoidable; use compressed web versions.
- Do not introduce a backend server.

## Good next tasks

- Continue filling `media_manifest.json` for artists beyond Vera Molnár and John Whitney.
- Add support for `google_drive` downloads or manual source capture.
- Add support for p5.js/OpenProcessing screen-recording workflows.
- Use `scripts/make_media_review.py` after processing media to inspect poster pairs.
- Keep improving source notes in `media_manifest.json` without duplicating archive metadata.
