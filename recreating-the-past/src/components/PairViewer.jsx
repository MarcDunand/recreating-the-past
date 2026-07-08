import { useEffect, useRef, useState } from "react";
import "./RecreationsArchive.css";

// ── Shared media/pair helpers ───────────────────────────────────────────────
// This module owns the fullscreen two-up comparison viewer and everything it
// needs, so it can be reused on any page (the recreations archive and the
// people page both mount it). RecreationsArchive.jsx imports these helpers too,
// keeping a single source of truth for how media is resolved and displayed.

function getYearNumber(pair) {
  const match = String(pair.originalYear || "").match(/\d{4}/);
  return match ? Number(match[0]) : 9999;
}

export function getSortedPairs(pairs) {
  return [...pairs].sort((a, b) => {
    const yearA = getYearNumber(a);
    const yearB = getYearNumber(b);

    if (yearA !== yearB) return yearA - yearB;
    return a.originalTitle.localeCompare(b.originalTitle);
  });
}

export function getMediaType(pair, side) {
  if (side === "original") {
    return pair.originalMediaType || pair.originalMedia?.type || "image";
  }

  return pair.recreationMediaType || pair.recreationMedia?.type || "image";
}

export function isVideoType(mediaType) {
  return mediaType === "video" || mediaType === "gif";
}

export function getMediaSrc(artist, pair, side) {
  const mediaObject = side === "original" ? pair.originalMedia : pair.recreationMedia;

  if (mediaObject?.src) {
    return mediaObject.src;
  }

  const suffix = side === "original" ? "o" : "r";
  const folder = side === "original" ? "originals" : "recreations";
  const mediaType = getMediaType(pair, side);
  const extension = isVideoType(mediaType) ? "mp4" : "jpg";

  return `/media/${artist.mediaFolder}/${folder}/${pair.id}_${suffix}.${extension}`;
}

export function getPosterSrc(artist, pair, side) {
  const mediaObject = side === "original" ? pair.originalMedia : pair.recreationMedia;

  if (mediaObject?.poster) {
    return mediaObject.poster;
  }

  const suffix = side === "original" ? "o" : "r";
  return `/media/${artist.mediaFolder}/posters/${pair.id}_${suffix}.jpg`;
}

// Flat, chronologically-sorted list of every { artist, pair } in the archive —
// regular weeks first, then the final project (whose artist is synthesized per
// pair). Used for prev/next navigation and for looking a pair up by id.
export function buildAllPairs(archive) {
  const regularArtists = archive.filter((a) => a.artistSlug !== "final");
  const finalProject = archive.find((a) => a.artistSlug === "final");

  const list = [];
  for (const artist of regularArtists) {
    for (const pair of getSortedPairs(artist.pairs)) {
      list.push({ artist, pair });
    }
  }
  if (finalProject) {
    for (const pair of getSortedPairs(finalProject.pairs)) {
      list.push({ artist: { artist: pair.artist, mediaFolder: "final" }, pair });
    }
  }
  return list;
}

// Length of the one-shot hover preview shown on the scrolling view (seconds)
export const PREVIEW_SECONDS = 2;

export const PAUSED_STORAGE_KEY = "rtp-video-paused";

const PLAY_GLYPH = "▶";
const PAUSE_GLYPH = "❚❚";

// Renders the two-up comparison and coordinates the video playback:
// trims both videos to the shorter one's length, keeps them in sync, and
// drives the shared centered play/pause control. Pause/play is a global
// prop so it persists across pairs and (via localStorage) across pages.
function ComparisonViewer({ selected, paused, setPaused }) {
  const { artist, pair } = selected;

  const origIsVideo = isVideoType(getMediaType(pair, "original"));
  const recIsVideo = isVideoType(getMediaType(pair, "recreation"));

  const origRef = useRef(null);
  const recRef = useRef(null);
  const pausedRef = useRef(paused);
  const durations = useRef({});
  const loopLimit = useRef(Infinity);
  const hideTimer = useRef(null);
  const clickTimer = useRef(null);

  const [controlsVisible, setControlsVisible] = useState(false);
  const [loaded, setLoaded] = useState({});

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const activeVideos = () =>
    [origIsVideo ? origRef.current : null, recIsVideo ? recRef.current : null].filter(Boolean);

  const recomputeLimit = () => {
    const vals = [];
    if (origIsVideo && durations.current.orig) vals.push(durations.current.orig);
    if (recIsVideo && durations.current.rec) vals.push(durations.current.rec);
    // Stop just short of the shorter clip's true end so we loop cleanly.
    loopLimit.current = vals.length ? Math.min(...vals) - 0.05 : Infinity;
  };

  // Reset per-pair bookkeeping when navigating to a different pair.
  useEffect(() => {
    durations.current = {};
    loopLimit.current = Infinity;
    setLoaded({});
  }, [pair.id]);

  // Apply the global pause/play state to the real media elements.
  useEffect(() => {
    for (const v of activeVideos()) {
      if (paused) v.pause();
      else v.play().catch(() => {});
    }
  }, [paused, pair.id]);

  // While playing, enforce the trimmed loop length and keep the pair in sync.
  useEffect(() => {
    if (paused) return;
    let raf;
    const tick = () => {
      const orig = origIsVideo ? origRef.current : null;
      const rec = recIsVideo ? recRef.current : null;
      const driver = orig || rec;
      if (driver && loopLimit.current !== Infinity) {
        if (driver.currentTime >= loopLimit.current) {
          if (orig) orig.currentTime = 0;
          if (rec) rec.currentTime = 0;
          for (const v of activeVideos()) v.play().catch(() => {});
        } else if (orig && rec && Math.abs(rec.currentTime - orig.currentTime) > 0.2) {
          rec.currentTime = orig.currentTime;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, pair.id, origIsVideo, recIsVideo]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (clickTimer.current) clearTimeout(clickTimer.current);
  }, []);

  // Show native controls only while a single video is in browser fullscreen;
  // strip them again on exit so the inline view stays chrome-free.
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        for (const v of [origRef.current, recRef.current]) {
          if (v) v.controls = false;
        }
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Show the control and arm the 2s idle fade-out.
  const nudgeControls = () => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 2000);
  };

  // Hide immediately when the pointer leaves a video entirely.
  const hideControls = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setControlsVisible(false);
  };

  // Single click toggles pause/play; a double click (fullscreen) cancels it.
  const handleClick = () => {
    nudgeControls();
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      setPaused(!pausedRef.current);
    }, 220);
  };

  const handleDblClick = (ref) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    const el = ref.current;
    if (el?.requestFullscreen) {
      el.controls = true;
      el.requestFullscreen().catch(() => {});
    }
  };

  const markLoaded = (side) => setLoaded((prev) => ({ ...prev, [side]: true }));

  const renderSquare = (side, ref, isVideo) => {
    const src = getMediaSrc(artist, pair, side);
    const poster = getPosterSrc(artist, pair, side);
    const bgSrc = isVideo ? poster : src;
    const isLoaded = !!loaded[side];

    return (
      <div
        className={`fullscreen-media-square${isVideo ? " is-video" : ""}`}
        onMouseEnter={isVideo ? nudgeControls : undefined}
        onMouseMove={isVideo ? nudgeControls : undefined}
        onMouseLeave={isVideo ? hideControls : undefined}
        onClick={isVideo ? handleClick : undefined}
        onDoubleClick={isVideo ? () => handleDblClick(ref) : undefined}
      >
        <img className="media-bg-blur" src={bgSrc} alt="" aria-hidden="true" />
        {!isLoaded && <div className="media-loading-skeleton" />}
        {isVideo ? (
          <video
            key={src}
            ref={ref}
            className="fullscreen-media"
            muted
            playsInline
            poster={poster}
            style={{ opacity: isLoaded ? 1 : 0 }}
            onLoadedMetadata={(e) => {
              durations.current[side === "original" ? "orig" : "rec"] = e.currentTarget.duration;
              recomputeLimit();
              if (pausedRef.current) e.currentTarget.currentTime = 0;
              else e.currentTarget.play().catch(() => {});
            }}
            onLoadedData={() => markLoaded(side)}
          >
            <source src={src} type="video/mp4" />
          </video>
        ) : (
          <img
            key={src}
            src={src}
            alt=""
            className="fullscreen-media"
            style={{ opacity: isLoaded ? 1 : 0 }}
            onLoad={() => markLoaded(side)}
          />
        )}
        {isVideo && (
          <div className={`video-control${controlsVisible ? " is-visible" : ""}`} aria-hidden="true">
            <span className={`video-control-glyph${paused ? " is-play" : ""}`}>
              {paused ? PLAY_GLYPH : PAUSE_GLYPH}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Each side stacks its label directly above its media, and the label+media
  // group is centered vertically (see .fullscreen-side in CSS). Both labels
  // reserve the same height, so a one-line and a two-line label leave their
  // media at the same y position — keeping the two media boxes aligned.
  return (
    <div className="fullscreen-grid">
      <div className="fullscreen-side">
        <div className="fullscreen-label">
          <span className="fullscreen-label-text">
            {pair.originalLink ? (
              <a href={pair.originalLink} target="_blank" rel="noreferrer">
                {artist.artist}, <em>{pair.originalTitle}</em>, {pair.originalYear}
              </a>
            ) : (
              <>{artist.artist}, <em>{pair.originalTitle}</em>, {pair.originalYear}</>
            )}
          </span>
        </div>

        <div className="fullscreen-media-wrapper">
          {renderSquare("original", origRef, origIsVideo)}
        </div>
      </div>

      <div className="fullscreen-side">
        <div className="fullscreen-label">
          <span className="fullscreen-label-text">
            {pair.recreationLink ? (
              <a href={pair.recreationLink} target="_blank" rel="noreferrer">
                {pair.student}, <em>Recreation</em>, 2026
              </a>
            ) : (
              <>{pair.student}, <em>Recreation</em>, 2026</>
            )}
          </span>
        </div>

        <div className="fullscreen-media-wrapper">
          {renderSquare("recreation", recRef, recIsVideo)}
        </div>
      </div>
    </div>
  );
}

// Fullscreen overlay wrapping the comparison viewer. `showNav` toggles the
// prev/next arrows (and their keyboard/scroll shortcuts still no-op when the
// handlers are null), so the people page can open a single pair without them.
export function FullscreenComparison({ selected, close, onPrev, onNext, paused, setPaused, showNav = true, closeDark = false }) {
  const overlayRef = useRef(null);
  const lastWheelRef = useRef(0);

  useEffect(() => {
    if (!selected) return;

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") close();
      if ((e.key === "ArrowUp" || e.key === "ArrowLeft") && onPrev) onPrev();
      if ((e.key === "ArrowDown" || e.key === "ArrowRight") && onNext) onNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, close, onPrev, onNext]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el || !selected) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheelRef.current < 400) return;
      lastWheelRef.current = now;
      if (e.deltaY > 0 && onNext) onNext();
      else if (e.deltaY < 0 && onPrev) onPrev();
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [selected, onPrev, onNext]);

  if (!selected) return null;

  return (
    <div className="fullscreen-overlay" ref={overlayRef}>
      {showNav && (
        <button
          className="fullscreen-nav fullscreen-nav-prev"
          onClick={onPrev}
          disabled={!onPrev}
          aria-label="Previous"
        >
          <span className="fullscreen-chevron" aria-hidden="true" />
        </button>
      )}

      <button
        className={`fullscreen-close${closeDark ? " fullscreen-close--dark" : ""}`}
        onClick={close}
        aria-label="Close"
      >
        ×
      </button>

      <ComparisonViewer selected={selected} paused={paused} setPaused={setPaused} />

      {showNav && (
        <button
          className="fullscreen-nav fullscreen-nav-next"
          onClick={onNext}
          disabled={!onNext}
          aria-label="Next"
        >
          <span className="fullscreen-chevron" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
