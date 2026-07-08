import { useEffect, useMemo, useState } from "react";
import { FullscreenComparison, buildAllPairs, PAUSED_STORAGE_KEY } from "./PairViewer.jsx";

// Lightweight island for the people page. It renders nothing until a square is
// clicked: the page's inline script dispatches an "open-pair" event carrying a
// pair id, which we look up in the archive and hand to the same fullscreen
// viewer the recreations page uses — just without the prev/next navigation.
export default function PeoplePairViewer({ archive }) {
  const [selected, setSelected] = useState(null);

  // Pause/play state is shared with the recreations page via localStorage, so
  // the two views stay consistent.
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

  const allPairs = useMemo(() => buildAllPairs(archive), [archive]);

  useEffect(() => {
    const openPair = (e) => {
      const found = allPairs.find(({ pair }) => pair.id === e.detail);
      if (found) setSelected(found);
    };
    window.addEventListener("open-pair", openPair);
    return () => window.removeEventListener("open-pair", openPair);
  }, [allPairs]);

  return (
    <FullscreenComparison
      selected={selected}
      paused={paused}
      setPaused={setPaused}
      showNav={false}
      closeDark={true}
      onPrev={null}
      onNext={null}
      close={() => setSelected(null)}
    />
  );
}
