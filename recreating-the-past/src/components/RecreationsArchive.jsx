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

function MediaPreview({ artist, pair, side }) {
  const mediaType = getMediaType(pair, side);
  const src = getMediaSrc(artist, pair, side);
  const isVideo = isVideoType(mediaType);
  const fgSrc = isVideo ? getPosterSrc(artist, pair, side) : src;

  return (
    <div className={`media-preview${isVideo ? " video-preview" : ""}`}>
      <img className="media-bg-blur" src={fgSrc} alt="" aria-hidden="true" />
      <img className="media-fg" src={fgSrc} alt="" />
      {isVideo && <div className="play-indicator">▶</div>}
    </div>
  );
}

function FullMedia({ artist, pair, side }) {
  const mediaType = getMediaType(pair, side);
  const src = getMediaSrc(artist, pair, side);
  const isVideo = isVideoType(mediaType);
  const bgSrc = isVideo ? getPosterSrc(artist, pair, side) : src;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setLoaded(false); }, [src]);

  return (
    <div className="fullscreen-media-square">
      <img className="media-bg-blur" src={bgSrc} alt="" aria-hidden="true" />
      {!loaded && <div className="media-loading-skeleton" />}
      {isVideo ? (
        <video
          key={src}
          className="fullscreen-media"
          controls
          muted
          poster={getPosterSrc(artist, pair, side)}
          onLoadedData={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0 }}
        >
          <source src={src} type="video/mp4" />
        </video>
      ) : (
        <img
          key={src}
          src={src}
          alt=""
          className="fullscreen-media"
          onLoad={() => setLoaded(true)}
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
      <MediaPreview artist={artist} pair={pair} side={side} />

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
              <div className="timeline-year">{pair.originalYear}</div>
            </a>
          ) : (
            <>
              <div className="timeline-title">{pair.originalTitle}</div>
              <div className="timeline-year">{pair.originalYear}</div>
            </>
          )}
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

function FullscreenComparison({ selected, close, onPrev, onNext }) {
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

  const { artist, pair } = selected;

  return (
    <div className="fullscreen-overlay" ref={overlayRef}>
      <button
        className="fullscreen-nav fullscreen-nav-prev"
        onClick={onPrev}
        disabled={!onPrev}
        aria-label="Previous"
      >
        ↑
      </button>

      <button className="fullscreen-close" onClick={close} aria-label="Close">
        ×
      </button>

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
            <FullMedia artist={artist} pair={pair} side="original" />
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
            <FullMedia artist={artist} pair={pair} side="recreation" />
          </div>
        </div>
      </div>

      <button
        className="fullscreen-nav fullscreen-nav-next"
        onClick={onNext}
        disabled={!onNext}
        aria-label="Next"
      >
        ↓
      </button>
    </div>
  );
}

function StickyBar({ stickySlug, regularArtists }) {
  const displayName =
    stickySlug === "final"
      ? "Final Project"
      : regularArtists.find((a) => a.artistSlug === stickySlug)?.artist ?? "";

  return (
    <div className="sticky-bar">
      <div className="sticky-bar-inner">
        <div className="sticky-bar-artist">{displayName}</div>
        <div className="sticky-bar-diptych">
          <span className="sticky-bar-original">Original</span>
          <span />
          <span className="sticky-bar-recreation">Recreation</span>
        </div>
      </div>
    </div>
  );
}

function ArtistMenu({ artists, activeArtistSlug, isExpanded }) {
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
    <nav className={`artist-menu${isExpanded ? " is-expanded" : ""}`} aria-label="Artist navigation">
      <div className="artist-menu-list" ref={listRef}>
        {artists.map((artist) => (
          <a
            key={artist.artistSlug}
            className={`artist-menu-item ${
              activeArtistSlug === artist.artistSlug ? "is-active" : ""
            }`}
            href={`#${artist.artistSlug}`}
          >
            <span className="artist-menu-dot" />
            <span className="artist-menu-label">{artist.artist}</span>
          </a>
        ))}

        <a
          className={`artist-menu-item final-project-link${activeArtistSlug === "final" ? " is-active" : ""}`}
          href="#final-project"
        >
          <span className="final-project-diamond" />
          <span className="artist-menu-label">Final Project</span>
        </a>
      </div>
    </nav>
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
              <div className="timeline-year">{pair.originalYear}</div>
            </a>
          ) : (
            <>
              <div className="timeline-title">{pair.originalTitle}</div>
              <div className="timeline-year">{pair.originalYear}</div>
            </>
          )}
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
      <h2 className="final-heading" ref={headingRef}>Final Project: Choose Your Own Artist</h2>

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

  const sectionRefs = useRef({});
  const headingRefs = useRef({});

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
          <a href="/">Recreations</a>
          <a href="/people">People</a>
          <a href="/about">About</a>
        </nav>
      </header>

      <StickyBar stickySlug={stickyArtistSlug} regularArtists={regularArtists} />

      <main>
        <ArtistMenu artists={regularArtists} activeArtistSlug={activeArtistSlug} isExpanded={isNearTop} />

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