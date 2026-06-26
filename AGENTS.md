# Recreating the Past Website — Agent Instructions

## Project overview

This is a custom static website for the MIT Media Lab course "Recreating the Past," taught by Zach Lieberman. The site is an archive of student recreations of historical computational artworks.

The main page is a visual comparison archive. Each entry pairs an original artwork with a student recreation. The website is built as an Astro SSG site with a React island for the interactive archive.

The final deployed site should be static and portable: HTML, CSS, JS, JSON, images, videos, and poster frames. Avoid server-side dependencies, paid APIs, external CMS systems, or runtime services.

## Tech stack

- **Astro** (SSG) — only one page currently: `src/pages/index.astro`
- **React** island (via `client:load`) — all interactivity is in `RecreationsArchive.jsx`
- **Plain CSS** — `RecreationsArchive.css`, no CSS-in-JS
- **JSON data** — `src/data/archive.json`
- **Local media files** — `public/media/`
- **Jost** font from Google Fonts (300/400/500/600 italic, loaded in `index.astro`)

## Important files

- `src/pages/index.astro` — HTML shell, loads Jost font, mounts `<RecreationsArchive />`
- `src/components/RecreationsArchive.jsx` — all UI components and state
- `src/components/RecreationsArchive.css` — all styles
- `src/data/archive.json` — artwork data
- `src/data/media_manifest.json` — media-processing instructions (not used at runtime)
- `scripts/check_expected_media.py` — reports missing local media
- `scripts/process_media.py` — builds web-ready media from manifest
- `scripts/make_media_review.py` — generates `review/media_review.html` contact sheet
- `scripts/README_media_pipeline.md` — media-pipeline command reference
- `public/media/` — all local media files served by the site

## Archive data structure

`archive.json` is an array of artist sections. Artists with `artistSlug: "final"` are treated as the Final Project section.

```json
{
  "artist": "Vera Molnár",
  "artistSlug": "vera-molnar",
  "mediaFolder": "molnar",
  "pairs": []
}
```

Each pair:

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

### Media vs. links

- `originalMediaType` / `recreationMediaType` — type of local media shown on page (`"image"` or `"video"`)
- `originalLink` — public citation/official page for the original artwork (rendered as a link in both the scroll view and the fullscreen view)
- `recreationLink` — public link to the student's code/sketch (rendered in the fullscreen view)
- `recreationLink` may be empty

Do not treat `originalLink` or `recreationLink` as media sources. Media sources belong in `media_manifest.json`.

## Page layout and UI

### Overall structure

```
<header class="top-nav">        position: sticky, top: 0, height: 48px, z-index: 30
<div class="sticky-bar">        position: sticky, top: 48px, height: 44px, z-index: 29
<main>
  <nav class="artist-menu">     position: fixed, left: 20px, spans top: 92px to bottom: 20px
  <section class="artist-section"> × N artists
  <section class="final-project-section">
  <div class="fullscreen-overlay">  z-index: 100, conditionally rendered
```

### CSS custom properties

```css
:root {
  --side-gutter: 260px;  /* horizontal space reserved on the left for the menu */
  --text-sm: 16px;       /* base text size */
}
```

At `max-width: 1100px`: `--side-gutter: 200px`.
At `max-width: 800px`: `--side-gutter: 0` (menu hidden, single-column layout).

### Top nav

Fixed height 48px, sticky at top. Contains site title (`Recreating the Past` with color spans) and nav links.

Brand colors:
- "Recreating" → `#DAAE00` (yellow)
- "the Past" → `#d45113` (orange)

### Sticky bar

`position: sticky; top: 48px`. Shows the current artist name on the left and "Original / Recreation" column labels on the right. 

- Uses **asymmetric padding**: `padding: 0 4vw 0 calc(var(--side-gutter) + 4vw)` — mirrors the `main` left offset.
- Inner grid: `220px minmax(0, 1200px)` with `column-gap: 34px` (matches artwork rows).
- Artist name **blanks out** for 100px before the next heading enters the bar — prevents showing the previous artist's name while the next heading is visible.

### Artwork rows

`main` has `padding-left: var(--side-gutter); padding-right: 0; padding-top: 167px`.

Each `.artwork-row` is a 2-column grid: `220px minmax(0, 1200px)` with `column-gap: 34px`.

Columns:
1. **Timeline item** (220px) — vertical timeline line with a dot, original title/year (linked via `originalLink` if present, using `.list-link` style)
2. **Pair diptych** — 3-column sub-grid: `1fr 14px 1fr` (original | gutter | recreation). Clicking either tile opens the fullscreen comparison.

The artist heading row spans both columns (`grid-column: 1 / 3`) with an inverted-L decorative underline.

**There is no student name column** — it was removed. The only 2 columns are timeline and diptych.

### Final Project section

Uses `FinalArtworkRow` which is similar to `ArtworkRow` but has no vertical timeline line and shows the student's artist name above the original title/year.

### Left dot menu (`ArtistMenu`)

`position: fixed; left: 20px; top: 92px; bottom: 20px` — spans between the sticky bar bottom and 20px from the viewport bottom. Uses `display: flex; flex-direction: column; justify-content: center` so the list is vertically centered within that space.

The inner `.artist-menu-list` has `min-height: 0; overflow: hidden`. When the list is taller than the available space, items are clipped and the list uses programmatic `scrollTop` (clamped to valid range) to center the active item.

Menu behavior:
- Dots only visible by default; hovering the menu fades in artist name labels.
- When `isExpanded` (user is near the top of the page, `scrollY < 167`), labels are always visible.
- Active item shows as an outlined hollow dot; non-active items scale up slightly on hover.
- Final Project uses a teal diamond (`#75C9C8`) instead of a dot.

### Scroll tracking (in `RecreationsArchive`)

Two independent trackers on `window` scroll:

1. **Left menu active** (`activeArtistSlug`): tracks which section top has passed `40% of viewport height`. Controls the `is-active` dot.
2. **Sticky bar** (`stickyArtistSlug`): tracks which `h2` heading has passed `92px` from top. Goes `null` (blank) for 100px before any heading enters the bar.
3. **`isNearTop`**: `window.scrollY < 167` — expands menu labels while at the page top.

### Fullscreen comparison (`FullscreenComparison`)

Triggered by clicking any media tile. Shows both media side by side at full screen. 

- Prev/Next buttons navigate through all pairs globally (across all artists, in sorted order).
- **Keyboard**: left/right arrows navigate, Escape closes.
- **Scroll wheel**: up/down wheel triggers prev/next (400ms throttle, non-passive wheel listener).
- **Closing**: scrolls the page back to the row that was open (`scrollIntoView({ block: "center", behavior: "instant" })`), using `data-pair-id` attributes on rows.
- Artwork title/year links to `originalLink`; student name links to `recreationLink`.

### Media loading skeleton

`FullMedia` shows a shimmer skeleton while media loads (on `key={src}` remount). `opacity: 0` on the media until `onLoad`/`onLoadedData` fires.

### React hooks used

- `useState`, `useEffect`, `useMemo`, `useRef` — all from React.
- No external state management library.

### Key refs

- `sectionRefs` — one ref per artist section, used for left menu tracking.
- `headingRefs` — one ref per `h2`, used for sticky bar tracking.
- `listRef` — the `.artist-menu-list` element, used for programmatic scroll centering.
- `overlayRef` — the fullscreen overlay div, used to attach the wheel event listener.
- `lastWheelRef` — timestamps last wheel event to throttle navigation.

## Media manifest

`src/data/media_manifest.json` describes how to produce the local media files. It should not duplicate all archive metadata.

```json
{
  "artist": "John Whitney",
  "artistSlug": "john-whitney",
  "mediaFolder": "whitney",
  "entries": [
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
        "notes": ""
      }
    }
  ]
}
```

Allowed `sourceType` values: `local_video`, `local_image`, `local_gif`, `youtube`, `google_drive`, `dropbox`, `p5`, `openprocessing`, `missing`.

For local source types, `source` paths should be relative to `src/data/media_manifest.json`.

## Media naming convention

For an entry with `"id": "marc_catalog"` in artist with `"mediaFolder": "molnar"`:

```
public/media/molnar/originals/marc_catalog_o.mp4   (or .jpg)
public/media/molnar/recreations/marc_catalog_r.mp4 (or .jpg)
public/media/molnar/posters/marc_catalog_o.jpg
public/media/molnar/posters/marc_catalog_r.jpg
```

Suffixes: `_o` = original, `_r` = recreation.

## Media pipeline

Scripts in `scripts/` build and review local media for each artist.

- `scripts/check_expected_media.py` — reports missing local media/poster files.
- `scripts/process_media.py` — reads manifest, generates web-ready media for one artist.
- `scripts/make_media_review.py` — generates `review/media_review.html` contact sheet.

Usage:

```powershell
python scripts/process_media.py john-whitney --dry-run
python scripts/process_media.py vera-molnar --download --cookies-from-browser chrome
python scripts/process_media.py help
```

`process_media.py` currently supports: `local_video`, `local_image`, `local_gif`, `youtube`, `dropbox`.

Do not download remote sources without `--download`. YouTube may need `--cookies-from-browser chrome/edge/firefox`.

Downloaded source files are cached separately:

```
public/<mediaFolder>/originals/<id>_o_source.mp4
public/<mediaFolder>/recreations/<id>_r_source.mp4
```

## Preferred media processing

Use ffmpeg:

```bash
ffmpeg -i input.mov -vf "scale='min(1920,iw)':-2" -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart -an output.mp4
```

Poster frame (default 2 seconds into clip):

```bash
ffmpeg -ss 00:00:02 -i input.mp4 -frames:v 1 poster.jpg
```

Preferred format: `.mp4`, H.264, yuv420p, `-movflags +faststart`, 720p–1080p max, no audio (`-an`) unless specifically needed.

Videos should be muted/audio-stripped by default — the site has no use for audio tracks.

## Responsive breakpoints

- **≤ 1100px**: `--side-gutter: 200px`, timeline column narrows to 170px, column gap 24px.
- **≤ 800px**: menu hidden, `--side-gutter: 0`, single-column layout, sticky bar simplified.

## Do not do

- Do not change the archive data schema without explaining why.
- Do not hard-code individual artworks into React components.
- Do not assume every entry is an image; support video.
- Do not use remote embeds for final playback unless explicitly requested.
- Do not delete `originalLink` or `recreationLink` values.
- Do not place large source-quality videos directly in Git; use compressed web versions.
- Do not introduce a backend server.
- Do not add a student name column — it was intentionally removed.
