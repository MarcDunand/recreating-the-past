Homework 1 (Vera Molnár) extraction notes

Generated from the uploaded PDF.

Folder structure:
  media/molnar/originals/<id>_o.jpg
  media/molnar/recreations/<id>_r.jpg
  archive.json

Conventions:
  - id format: student_original-work
  - original image suffix: _o.jpg
  - recreation image suffix: _r.jpg
  - artistSlug uses dashes: vera-molnar

Notes / issues found:
  - Template pages 1-2 were skipped.
  - Bela Sanchez Taipe / Carrés rouges et bleus: the PDF page contains an original image and an empty recreation area. A blank placeholder recreation image was created.
  - Malvika Dwivedi: the PDF did not provide a specific original title or year. I used originalTitle = "Untitled line-grid work" and originalYear = "unknown".
  - Eitan Wolf: the PDF labels the original as Untitled and links to MoMA; year was not visible in the PDF, so originalYear = "unknown".
  - All media extracted from the PDF are still images. If some student works are actually videos, replace the relevant recreation image with a web-compressed .mp4 later and change recreationMediaType to "video" in archive.json.
  - Page 19 contains additional Yufeng Zhao process images; those were not included as original/recreation media because page 18 already contains the comparison pair.
