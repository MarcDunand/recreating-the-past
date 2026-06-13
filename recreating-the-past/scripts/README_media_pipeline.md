# Media Pipeline

`process_media.py` reads `src/data/media_manifest.json` and creates local media files under `public/media/<mediaFolder>/`.

It supports these local sources:

- `local_video`
- `local_image`
- `local_gif`

It can also process these downloadable sources when `--download` is passed:

- `youtube`
- `dropbox`

Without `--download`, downloadable sources are reported under `Needs download` and nothing is downloaded. Screen-recording sources such as `google_drive`, `p5`, and `openprocessing` are still skipped for now.

## Commands

From the Astro project directory:

```powershell
cd recreating-the-past
```

Preview work for one artist without writing files:

```powershell
python scripts/process_media.py john-whitney --dry-run
```

Process one artist:

```powershell
python scripts/process_media.py john-whitney
```

Overwrite existing outputs:

```powershell
python scripts/process_media.py john-whitney --force
```

Report which YouTube and Dropbox sources would need downloads:

```powershell
python scripts/process_media.py john-whitney --dry-run
```

Preview YouTube and Dropbox download commands without writing files:

```powershell
python scripts/process_media.py john-whitney --download --dry-run
```

Download and process YouTube and Dropbox sources:

```powershell
python scripts/process_media.py john-whitney --download
```

Download YouTube sources using cookies from a browser where you are signed into YouTube:

```powershell
python scripts/process_media.py john-whitney --download --cookies-from-browser chrome
```

Use `edge` or `firefox` instead if that is where you are signed in:

```powershell
python scripts/process_media.py john-whitney --download --cookies-from-browser edge
python scripts/process_media.py john-whitney --download --cookies-from-browser firefox
```

Overwrite existing downloaded source files and generated outputs:

```powershell
python scripts/process_media.py john-whitney --download --force
```

Show command-line help:

```powershell
python scripts/process_media.py help
python scripts/process_media.py --help
```

The artist slug is required. Current examples are:

```powershell
python scripts/process_media.py vera-molnar --dry-run
python scripts/process_media.py john-whitney --dry-run
```

## Time Fields

`start` and `duration` are read from each side in `media_manifest.json`.

Accepted formats:

```json
""
"12"
"12.5"
"00:00:12"
"00:34:50"
```

Examples:

```json
{
  "sourceType": "local_video",
  "source": "../../../contentDump/example/source.mov",
  "start": "12",
  "duration": "5",
  "notes": "Start at 12 seconds and output 5 seconds."
}
```

```json
{
  "sourceType": "local_video",
  "source": "../../../contentDump/example/source.mov",
  "start": "00:34:50",
  "duration": "",
  "notes": "Start at 34 minutes 50 seconds and process to the end."
}
```

```json
{
  "sourceType": "local_gif",
  "source": "../../../contentDump/john-whitney/images/image21.gif",
  "start": "",
  "duration": "",
  "notes": "Convert the whole GIF to MP4."
}
```

The script uses accurate ffmpeg seeking for short clips by placing `-ss` after `-i`. If `duration` is empty, ffmpeg processes from `start` to the end of the source.

Poster frames default to 2 seconds into the processed clip. If `ffprobe` is available and the poster source is shorter than 2 seconds, the script uses the clip midpoint instead.

## Downloads

YouTube and Dropbox sources use `yt-dlp`. If it is not installed, install it with one of:

```powershell
python -m pip install yt-dlp
winget install yt-dlp.yt-dlp
```

### Browser Cookies

Some YouTube downloads may fail with a message like `Sign in to confirm you're not a bot`. In that case, pass `--cookies-from-browser` with the browser where you are currently signed into YouTube and can watch the video normally.

For a normal single-profile browser setup, the value is just the browser name:

```powershell
python scripts/process_media.py john-whitney --download --cookies-from-browser chrome
```

This tells `yt-dlp` to use your local browser session for the download request. The script does not read browser cookies unless you explicitly pass this option.

If you later use multiple browser profiles, `yt-dlp` also accepts values such as `chrome:Default` or `chrome:"Profile 1"`.

Downloaded source files are cached separately from final web media:

```text
public/<mediaFolder>/originals/<id>_o_source.mp4
public/<mediaFolder>/recreations/<id>_r_source.mp4
```

For example:

```text
public/whitney/originals/sun_permutations_o_source.mp4
public/whitney/recreations/haotian_catalog_r_source.mp4
```

These cached files are then converted into the normal `public/media/<mediaFolder>/...` outputs. Existing cached downloads are reused unless `--force` is passed.

## Outputs

Original side:

```text
public/media/<mediaFolder>/originals/<id>_o.mp4
public/media/<mediaFolder>/posters/<id>_o.jpg
```

Recreation side:

```text
public/media/<mediaFolder>/recreations/<id>_r.mp4
public/media/<mediaFolder>/posters/<id>_r.jpg
```

For `local_image`, the media output is `.jpg`, and the same image is copied as the poster.
