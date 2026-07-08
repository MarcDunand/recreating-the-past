import { useEffect, useMemo, useRef, useState } from "react";
import "./RecreationsArchive.css";
import {
  getSortedPairs,
  getMediaType,
  isVideoType,
  getMediaSrc,
  getPosterSrc,
  buildAllPairs,
  FullscreenComparison,
  PREVIEW_SECONDS,
  PAUSED_STORAGE_KEY,
} from "./PairViewer.jsx";

function MediaPreview({ artist, pair, side, isHovered }) {
  const mediaType = getMediaType(pair, side);
  const src = getMediaSrc(artist, pair, side);
  const isVideo = isVideoType(mediaType);
  const poster = isVideo ? getPosterSrc(artist, pair, side) : src;

  // Show a shimmer skeleton until the poster/thumbnail loads, then fade the
  // image in — same loading treatment as the fullscreen viewer. Driven off the
  // always-present bg-blur img, which shares the poster src with the foreground.
  const bgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  // Cached images can finish before React attaches onLoad, so also check
  // .complete on mount — otherwise the skeleton could hang on a cached tile.
  useEffect(() => {
    if (bgRef.current?.complete) setLoaded(true);
  }, [poster]);

  return (
    <div className={`media-preview${isVideo ? " video-preview" : ""}`}>
      <img
        ref={bgRef}
        className="media-bg-blur"
        src={poster}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
      />
      {!loaded && <div className="media-loading-skeleton" />}
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
        <img
          className="media-fg"
          src={poster}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ opacity: loaded ? 1 : 0 }}
        />
      )}
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

function StickyBar({ stickySlug, weekSlug, regularArtists, weekBySlug, onToggleMenu }) {
  const isFinal = stickySlug === "final";
  const displayName = isFinal
    ? "Final Project"
    : regularArtists.find((a) => a.artistSlug === stickySlug)?.artist ?? "";
  // The week tracks weekSlug, which never blanks during the name's transition
  // gap — so it switches straight from one week to the next. The final has none.
  const week = weekSlug === "final" ? null : weekBySlug[weekSlug];

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
          {week != null && <div className="sticky-bar-week">Week {week}:</div>}
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

  // Explicit course-week grouping — several weeks cover two artists, and Claire
  // Hentschker joins Week 6 (matching how the People page files her under the
  // Burson column). Flattened into a plain slug → week-number lookup.
  const weekBySlug = useMemo(() => {
    const WEEKS = [
      ["vera-molnar"],
      ["john-whitney"],
      ["muriel-cooper", "john-maeda"],
      ["anni-albers"],
      ["lillian-schwartz", "ken-knowlton"],
      ["nancy-burson", "jason-salavon", "claire-hentschker"],
      ["myron-krueger", "camille-utterback"],
      ["woody-vasulka", "rosa-menkman"],
    ];
    const map = {};
    WEEKS.forEach((slugs, i) => {
      for (const slug of slugs) map[slug] = i + 1;
    });
    return map;
  }, []);

  const allPairs = useMemo(() => buildAllPairs(archive), [archive]);

  const [activeArtistSlug, setActiveArtistSlug] = useState(regularArtists[0]?.artistSlug);
  const [stickyArtistSlug, setStickyArtistSlug] = useState(regularArtists[0]?.artistSlug);
  // Tracks the active artist for the week label. Unlike stickyArtistSlug it is
  // never blanked between artists, so the week transitions straight across.
  const [stickyWeekSlug, setStickyWeekSlug] = useState(regularArtists[0]?.artistSlug);
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
      setStickyWeekSlug(stickyActive);
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
        weekSlug={stickyWeekSlug}
        regularArtists={regularArtists}
        weekBySlug={weekBySlug}
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