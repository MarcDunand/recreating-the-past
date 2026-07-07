import { useEffect, useMemo, useRef, useState } from "react";
import "./RecreationsArchive.css";

function getYearNumber(pair) {
  const match = String(pair.originalYear || "").match(/\d{4}/);
  return match ? Number(match[0]) : 9999;
}

function getSortedPairs(pairs) {
  return [...pairs].sort((a, b) => {
    const yearA = getYearNumber(a);
    const yearB = getYearNumber(b);

    if (yearA !== yearB) return yearA - yearB;
    return a.originalTitle.localeCompare(b.originalTitle);
  });
}

function getMediaType(pair, side) {
  if (side === "original") {
    return pair.originalMediaType || pair.originalMedia?.type || "image";
  }

  return pair.recreationMediaType || pair.recreationMedia?.type || "image";
}

function isVideoType(mediaType) {
  return mediaType === "video" || mediaType === "gif";
}

function getMediaSrc(artist, pair, side) {
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

function getPosterSrc(artist, pair, side) {
  const mediaObject = side === "original" ? pair.originalMedia : pair.recreationMedia;

  if (mediaObject?.poster) {
    return mediaObject.poster;
  }

  const suffix = side === "original" ? "o" : "r";
  return `/media/${artist.mediaFolder}/posters/${pair.id}_${suffix}.jpg`;
}

// Length of the one-shot hover preview shown on the scrolling view (seconds)
const PREVIEW_SECONDS = 2;

function MediaPreview({ artist, pair, side, isHovered }) {
  const mediaType = getMediaType(pair, side);
  const src = getMediaSrc(artist, pair, side);
  const isVideo = isVideoType(mediaType);
  const poster = isVideo ? getPosterSrc(artist, pair, side) : src;

  return (
    <div className={`media-preview${isVideo ? " video-preview" : ""}`}>
      <img className="media-bg-blur" src={poster} alt="" aria-hidden="true" />
      {isVideo && isHovered ? (
        // Hover preview: play just the first couple of seconds once, then hold.
        // The video remounts fresh on each hover, so it restarts from 0 when the
        // mouse leaves and returns. Independent of the global pause/play state.
        <video
          className="media-fg"
          src={src}
          poster={poster}
          muted
          autoPlay
          playsInline
          preload="metadata"
          onTimeUpdate={(e) => {
            if (e.currentTarget.currentTime >= PREVIEW_SECONDS) e.currentTarget.pause();
          }}
        />
      ) : (
        <img className="media-fg" src={poster} alt="" />
      )}
    </div>
  );
}

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

  return (
    <div className="fullscreen-grid">
      <div className="fullscreen-side">
        <div className="fullscreen-label">
          {pair.originalLink ? (
            <a href={pair.originalLink} target="_blank" rel="noreferrer">
              {artist.artist}, <em>{pair.originalTitle}</em>, {pair.originalYear}
            </a>
          ) : (
            <>{artist.artist}, <em>{pair.originalTitle}</em>, {pair.originalYear}</>
          )}
        </div>

        <div className="fullscreen-media-wrapper">
          {renderSquare("original", origRef, origIsVideo)}
        </div>
      </div>

      <div className="fullscreen-side">
        <div className="fullscreen-label">
          {pair.recreationLink ? (
            <a href={pair.recreationLink} target="_blank" rel="noreferrer">
              {pair.student}, <em>Recreation</em>, 2026
            </a>
          ) : (
            <>{pair.student}, <em>Recreation</em>, 2026</>
          )}
        </div>

        <div className="fullscreen-media-wrapper">
          {renderSquare("recreation", recRef, recIsVideo)}
        </div>
      </div>
    </div>
  );
}

function MediaTile({ artist, pair, side, hoveredSide, setHoveredSide, openPair }) {
  const caption =
    side === "original" ? (
      <>
        {artist.artist}, <em>{pair.originalTitle}</em>
      </>
    ) : (
      <>
        {pair.student}, <em>Recreation</em>
      </>
    );

  return (
    <button
      className={`media-tile media-tile-${side}${hoveredSide !== null ? " is-hovered" : ""}`}
      onMouseEnter={() => setHoveredSide(side)}
      onMouseLeave={() => setHoveredSide(null)}
      onFocus={() => setHoveredSide(side)}
      onBlur={() => setHoveredSide(null)}
      onClick={openPair}
    >
      <MediaPreview artist={artist} pair={pair} side={side} isHovered={hoveredSide !== null} />

      {hoveredSide !== null && <div className="tile-caption">{caption}</div>}
    </button>
  );
}

function ArtworkRow({ artist, pair, index, openPair }) {
  const [hoveredSide, setHoveredSide] = useState(null);

  return (
    <div className="artwork-row" data-pair-id={pair.id}>
      <aside className="timeline-item">
        <div className="timeline-dot" />
        <div className="timeline-copy">
          {pair.originalLink ? (
            <a href={pair.originalLink} target="_blank" rel="noreferrer" className="list-link">
              <div className="timeline-title">{pair.originalTitle}</div>
            </a>
          ) : (
            <div className="timeline-title">{pair.originalTitle}</div>
          )}
          <div className="timeline-year">{pair.originalYear}</div>
        </div>
      </aside>

      <div className="pair-diptych">
        <MediaTile
          artist={artist}
          pair={pair}
          side="original"
          hoveredSide={hoveredSide}
          setHoveredSide={setHoveredSide}
          openPair={openPair}
        />

        <div className="pair-gutter" />

        <MediaTile
          artist={artist}
          pair={pair}
          side="recreation"
          hoveredSide={hoveredSide}
          setHoveredSide={setHoveredSide}
          openPair={openPair}
        />
      </div>

    </div>
  );
}

function FullscreenComparison({ selected, close, onPrev, onNext, paused, setPaused }) {
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
      <button
        className="fullscreen-nav fullscreen-nav-prev"
        onClick={onPrev}
        disabled={!onPrev}
        aria-label="Previous"
      >
        <span className="fullscreen-chevron" aria-hidden="true" />
      </button>

      <button className="fullscreen-close" onClick={close} aria-label="Close">
        ×
      </button>

      <ComparisonViewer selected={selected} paused={paused} setPaused={setPaused} />

      <button
        className="fullscreen-nav fullscreen-nav-next"
        onClick={onNext}
        disabled={!onNext}
        aria-label="Next"
      >
        <span className="fullscreen-chevron" aria-hidden="true" />
      </button>
    </div>
  );
}

function StickyBar({ stickySlug, regularArtists, onToggleMenu }) {
  const displayName =
    stickySlug === "final"
      ? "Final Project"
      : regularArtists.find((a) => a.artistSlug === stickySlug)?.artist ?? "";

  return (
    <div className="sticky-bar">
      <div className="sticky-bar-inner">
        <div className="sticky-bar-artist-group">
          <button
            type="button"
            className="sticky-bar-hamburger"
            onClick={onToggleMenu}
            aria-label="Open artist menu"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="sticky-bar-artist">{displayName}</div>
        </div>
        <div className="sticky-bar-diptych">
          <span className="sticky-bar-original">Original</span>
          <span />
          <span className="sticky-bar-recreation">Recreation</span>
        </div>
      </div>
    </div>
  );
}

function ArtistMenu({ artists, activeArtistSlug, isExpanded, isOpen, onClose }) {
  const listRef = useRef(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector(".is-active");
    if (!active) return;
    const listH = list.clientHeight;
    const itemTop = active.offsetTop;
    const itemH = active.clientHeight;
    const desired = itemTop - (listH - itemH) / 2;
    list.scrollTop = Math.max(0, Math.min(desired, list.scrollHeight - listH));
  }, [activeArtistSlug]);

  return (
    <>
      {isOpen && <div className="artist-menu-backdrop" onClick={onClose} />}
      <nav
        className={`artist-menu${isExpanded ? " is-expanded" : ""}${isOpen ? " is-open" : ""}`}
        aria-label="Artist navigation"
      >
        <div className="artist-menu-list" ref={listRef}>
          {artists.map((artist) => (
            <a
              key={artist.artistSlug}
              className={`artist-menu-item ${
                activeArtistSlug === artist.artistSlug ? "is-active" : ""
              }`}
              href={`#${artist.artistSlug}`}
              onClick={onClose}
            >
              <span className="artist-menu-dot" />
              <span className="artist-menu-label">{artist.artist}</span>
            </a>
          ))}

          <a
            className={`artist-menu-item final-project-link${activeArtistSlug === "final" ? " is-active" : ""}`}
            href="#final-project"
            onClick={onClose}
          >
            <span className="final-project-diamond" />
            <span className="artist-menu-label">Final Project</span>
          </a>
        </div>
      </nav>
    </>
  );
}

function FinalArtworkRow({ pair, openPair }) {
  const [hoveredSide, setHoveredSide] = useState(null);
  const syntheticArtist = { artist: pair.artist, mediaFolder: "final" };

  return (
    <div className="artwork-row" data-pair-id={pair.id}>
      <aside className="final-timeline-item">
        <div className="final-timeline-copy">
          <div className="final-artist-name">{pair.artist}</div>
          {pair.originalLink ? (
            <a href={pair.originalLink} target="_blank" rel="noreferrer" className="list-link">
              <div className="timeline-title">{pair.originalTitle}</div>
            </a>
          ) : (
            <div className="timeline-title">{pair.originalTitle}</div>
          )}
          <div className="timeline-year">{pair.originalYear}</div>
        </div>
      </aside>

      <div className="pair-diptych">
        <MediaTile
          artist={syntheticArtist}
          pair={pair}
          side="original"
          hoveredSide={hoveredSide}
          setHoveredSide={setHoveredSide}
          openPair={openPair}
        />
        <div className="pair-gutter" />
        <MediaTile
          artist={syntheticArtist}
          pair={pair}
          side="recreation"
          hoveredSide={hoveredSide}
          setHoveredSide={setHoveredSide}
          openPair={openPair}
        />
      </div>

    </div>
  );
}

function FinalProjectSection({ finalData, setSelected, sectionRef, headingRef }) {
  const sortedPairs = useMemo(() => getSortedPairs(finalData.pairs), [finalData.pairs]);

  return (
    <section
      id="final-project"
      ref={sectionRef}
      className="artist-section final-project-section"
      data-artist-slug="final"
    >
      <h2 className="final-heading" ref={headingRef}>Final Project: Bring Your Own Artist</h2>

      <div className="work-list">
        {sortedPairs.map((pair, index) => (
          <FinalArtworkRow
            key={pair.id}
            pair={pair}
            index={index}
            openPair={() => {
              const syntheticArtist = { artist: pair.artist, mediaFolder: "final" };
              setSelected({ artist: syntheticArtist, pair, pairIndex: index });
            }}
          />
        ))}
      </div>
    </section>
  );
}

function ArtistSection({ artist, setSelected, sectionRef, headingRef }) {
  const sortedPairs = useMemo(() => getSortedPairs(artist.pairs), [artist.pairs]);

  return (
    <section
      id={artist.artistSlug}
      ref={sectionRef}
      className="artist-section"
      data-artist-slug={artist.artistSlug}
    >
      <div className="artwork-row artist-heading-row">
        <div className="artist-heading-span">
          <h2 className="artist-heading" ref={headingRef}>{artist.artist}</h2>
        </div>
      </div>

      <div className="work-list">
        {sortedPairs.map((pair, index) => (
          <ArtworkRow
            key={pair.id}
            artist={artist}
            pair={pair}
            index={index}
            openPair={() => setSelected({ artist, pair, pairIndex: index })}
          />
        ))}
      </div>
    </section>
  );
}

const PAUSED_STORAGE_KEY = "rtp-video-paused";

export default function RecreationsArchive({ archive }) {
  const [selected, setSelected] = useState(null);

  // Global pause/play state, shared across every pair and persisted to
  // localStorage so it survives navigating away and back.
  const [paused, setPausedState] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PAUSED_STORAGE_KEY) === "true";
  });
  const setPaused = (value) => {
    setPausedState(value);
    try {
      window.localStorage.setItem(PAUSED_STORAGE_KEY, String(value));
    } catch {
      /* ignore storage failures (private mode, etc.) */
    }
  };

  const regularArtists = useMemo(() => archive.filter((a) => a.artistSlug !== "final"), [archive]);
  const finalProject = useMemo(() => archive.find((a) => a.artistSlug === "final"), [archive]);

  const allPairs = useMemo(() => {
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
  }, [regularArtists, finalProject]);

  const [activeArtistSlug, setActiveArtistSlug] = useState(regularArtists[0]?.artistSlug);
  const [stickyArtistSlug, setStickyArtistSlug] = useState(regularArtists[0]?.artistSlug);
  const [isNearTop, setIsNearTop] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const sectionRefs = useRef({});
  const headingRefs = useRef({});

  // Auto-open a pair from ?pair=<id> URL parameter (linked from the People page)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pairId = params.get("pair");
    if (!pairId) return;
    const found = allPairs.find(({ pair }) => pair.id === pairId);
    if (!found) return;
    setSelected(found);
    const url = new URL(window.location.href);
    url.searchParams.delete("pair");
    window.history.replaceState({}, "", url.toString());
  }, [allPairs]);

  useEffect(() => {
    const handleScroll = () => {
      setIsNearTop(window.scrollY < 167);

      // Left dot menu: section-level tracking at 40% viewport height
      const menuThreshold = window.innerHeight * 0.4;
      const sectionEntries = Object.entries(sectionRefs.current).filter(([, el]) => el);
      let menuActive = null;
      for (const [slug, el] of sectionEntries) {
        if (el.getBoundingClientRect().top <= menuThreshold) menuActive = slug;
      }
      if (!menuActive && sectionEntries.length > 0) menuActive = sectionEntries[0][0];
      if (menuActive) setActiveArtistSlug(menuActive);

      // Sticky bar: heading-level tracking — transfers name when h2 hits the bar
      const stickyThreshold = 48 + 44; // top-nav height + sticky-bar height
      const headingEntries = Object.entries(headingRefs.current).filter(([, el]) => el);
      let stickyActive = null;
      for (const [slug, el] of headingEntries) {
        if (el.getBoundingClientRect().top <= stickyThreshold) stickyActive = slug;
      }
      if (!stickyActive && headingEntries.length > 0) stickyActive = headingEntries[0][0];

      // Blank out the sticky name for 100px before the next heading enters — prevents
      // the jarring state where the bar shows the previous artist while the next is visible
      let goBlank = false;
      for (const [, el] of headingEntries) {
        const top = el.getBoundingClientRect().top;
        if (top > stickyThreshold && top <= stickyThreshold + 100) {
          goBlank = true;
          break;
        }
      }
      setStickyArtistSlug(goBlank ? null : stickyActive);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [archive]);

  return (
    <>
      <header className="top-nav">
        <a href="/" className="site-title">
          <span className="site-title-recreating">Recreating</span>
          {" the "}
          <span className="site-title-past">Past</span>
        </a>

        <nav>
          <a href="/" className="nav-current">Recreations</a>
          <a href="/people">People</a>
          <a href="/about">About</a>
        </nav>
      </header>

      <StickyBar
        stickySlug={stickyArtistSlug}
        regularArtists={regularArtists}
        onToggleMenu={() => setMenuOpen((open) => !open)}
      />

      <main>
        <ArtistMenu
          artists={regularArtists}
          activeArtistSlug={activeArtistSlug}
          isExpanded={isNearTop}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
        />

        {regularArtists.map((artist) => (
          <ArtistSection
            key={artist.artistSlug}
            artist={artist}
            setSelected={setSelected}
            sectionRef={(element) => { sectionRefs.current[artist.artistSlug] = element; }}
            headingRef={(element) => { headingRefs.current[artist.artistSlug] = element; }}
          />
        ))}

        {finalProject && (
          <FinalProjectSection
            finalData={finalProject}
            setSelected={setSelected}
            sectionRef={(element) => { sectionRefs.current["final"] = element; }}
            headingRef={(element) => { headingRefs.current["final"] = element; }}
          />
        )}

        <FullscreenComparison
          selected={selected}
          paused={paused}
          setPaused={setPaused}
          close={() => {
            if (selected) {
              const el = document.querySelector(`[data-pair-id="${selected.pair.id}"]`);
              if (el) el.scrollIntoView({ block: "center", behavior: "instant" });
            }
            setSelected(null);
          }}
          onPrev={
            selected && allPairs.findIndex((p) => p.pair.id === selected.pair.id) > 0
              ? () => {
                  const i = allPairs.findIndex((p) => p.pair.id === selected.pair.id);
                  setSelected(allPairs[i - 1]);
                }
              : null
          }
          onNext={
            selected &&
            allPairs.findIndex((p) => p.pair.id === selected.pair.id) < allPairs.length - 1
              ? () => {
                  const i = allPairs.findIndex((p) => p.pair.id === selected.pair.id);
                  setSelected(allPairs[i + 1]);
                }
              : null
          }
        />
      </main>
    </>
  );
}