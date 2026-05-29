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

We need scripts to build local media folders for each week/artist.

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

- Create a media manifest format.
- Write a script that reads `archive.json` and checks which expected local media/poster files are missing.
- Write a script that uses ffmpeg to convert source videos/GIFs into local web MP4s and posters.
- Build a review contact sheet of all original/recreation pairs.
- Add optional support for source clips with start time and duration.
