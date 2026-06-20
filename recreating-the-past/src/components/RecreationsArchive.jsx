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

  if (isVideoType(mediaType)) {
    return (
      <div className="media-preview video-preview">
        <img
          src={getPosterSrc(artist, pair, side)}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <div className="play-indicator">▶</div>
      </div>
    );
  }

  return <img src={src} alt="" />;
}

function FullMedia({ artist, pair, side }) {
  const mediaType = getMediaType(pair, side);
  const src = getMediaSrc(artist, pair, side);

  if (isVideoType(mediaType)) {
    return (
      <video
        className="fullscreen-media"
        controls
        muted
        poster={getPosterSrc(artist, pair, side)}
      >
        <source src={src} type="video/mp4" />
      </video>
    );
  }

  return <img src={src} alt="" className="fullscreen-media" />;
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
      className={`media-tile media-tile-${side}`}
      onMouseEnter={() => setHoveredSide(side)}
      onMouseLeave={() => setHoveredSide(null)}
      onFocus={() => setHoveredSide(side)}
      onBlur={() => setHoveredSide(null)}
      onClick={openPair}
    >
      <MediaPreview artist={artist} pair={pair} side={side} />

      {hoveredSide === side && <div className="tile-caption">{caption}</div>}
    </button>
  );
}

function ArtworkRow({ artist, pair, index, openPair }) {
  const [hoveredSide, setHoveredSide] = useState(null);

  return (
    <div className="artwork-row">
      <aside className="timeline-item">
        <div className="timeline-dot" />
        <div className="timeline-copy">
          <div className="timeline-title">{pair.originalTitle}</div>
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

      <aside className="student-aside">
        <div className="student-name">{pair.student}</div>
      </aside>
    </div>
  );
}

function FullscreenComparison({ selected, close }) {
  if (!selected) return null;

  const { artist, pair } = selected;

  return (
    <div className="fullscreen-overlay">
      <button className="fullscreen-close" onClick={close} aria-label="Close">
        ×
      </button>

      <div className="fullscreen-grid">
        <div className="fullscreen-side">
          <div className="fullscreen-label">
            {artist.artist}, <em>{pair.originalTitle}</em>, {pair.originalYear}
          </div>

          <FullMedia artist={artist} pair={pair} side="original" />

          {pair.originalLink && (
            <a href={pair.originalLink} target="_blank" rel="noreferrer">
              Original source
            </a>
          )}
        </div>

        <div className="fullscreen-side">
          <div className="fullscreen-label">{pair.student}, Recreation</div>

          <FullMedia artist={artist} pair={pair} side="recreation" />

          {pair.recreationLink && (
            <a href={pair.recreationLink} target="_blank" rel="noreferrer">
              Recreation link
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ArtistMenu({ artists, activeArtistSlug }) {
  return (
    <nav className="artist-menu" aria-label="Artist navigation">
      <div className="artist-menu-list">
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
    <div className="artwork-row">
      <aside className="final-timeline-item">
        <div className="final-timeline-copy">
          <div className="final-artist-name">{pair.artist}</div>
          <div className="timeline-title">{pair.originalTitle}</div>
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

      <aside className="student-aside">
        <div className="student-name">{pair.student}</div>
      </aside>
    </div>
  );
}

function FinalProjectSection({ finalData, setSelected, sectionRef }) {
  const sortedPairs = useMemo(() => getSortedPairs(finalData.pairs), [finalData.pairs]);

  return (
    <section
      id="final-project"
      ref={sectionRef}
      className="artist-section final-project-section"
      data-artist-slug="final"
    >
      <h2 className="artist-heading">Final Project: Choose Your Own Artist</h2>

      <div className="structure-inline" aria-hidden="true">
        <div className="structure-inline-inner">
          <div />
          <div className="structure-center">Original — Recreation</div>
          <div />
        </div>
      </div>

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

function ArtistSection({ artist, setSelected, sectionRef }) {
  const sortedPairs = useMemo(() => getSortedPairs(artist.pairs), [artist.pairs]);

  return (
    <section
      id={artist.artistSlug}
      ref={sectionRef}
      className="artist-section"
      data-artist-slug={artist.artistSlug}
    >
      <h2 className="artist-heading">{artist.artist}</h2>

      <div className="structure-inline" aria-hidden="true">
        <div className="structure-inline-inner">
          <div />
          <div className="structure-center">Original — Recreation</div>
          <div />
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

  const [activeArtistSlug, setActiveArtistSlug] = useState(regularArtists[0]?.artistSlug);

  const sectionRefs = useRef({});

  useEffect(() => {
    const sections = Object.values(sectionRefs.current).filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible) {
          setActiveArtistSlug(visible.target.dataset.artistSlug);
        }
      },
      {
        root: null,
        threshold: [0.2, 0.4, 0.6],
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [archive]);

  return (
    <>
      <header className="top-nav">
        <div className="site-title">Recreating the Past</div>

        <nav>
          <a href="/">Recreations</a>
          <a href="/about">About</a>
          <a href="/people">People</a>
        </nav>
      </header>

      <main>
        <ArtistMenu artists={regularArtists} activeArtistSlug={activeArtistSlug} />

        {regularArtists.map((artist) => (
          <ArtistSection
            key={artist.artistSlug}
            artist={artist}
            setSelected={setSelected}
            sectionRef={(element) => {
              sectionRefs.current[artist.artistSlug] = element;
            }}
          />
        ))}

        {finalProject && (
          <FinalProjectSection
            finalData={finalProject}
            setSelected={setSelected}
            sectionRef={(element) => {
              sectionRefs.current["final"] = element;
            }}
          />
        )}

        <FullscreenComparison selected={selected} close={() => setSelected(null)} />
      </main>
    </>
  );
}