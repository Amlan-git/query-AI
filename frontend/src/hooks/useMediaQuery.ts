import { useState, useEffect } from "react";

/**
 * Reactive hook that tracks a CSS media query match state.
 * Used by AppLayout to determine sidebar display mode (static column vs overlay drawer).
 *
 * @param query - A valid CSS media query string, e.g. "(min-width: 768px)"
 * @returns `true` when the media query matches, `false` otherwise
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);

    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Sync on mount in case SSR initial value was wrong
    setMatches(mql.matches);

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}
