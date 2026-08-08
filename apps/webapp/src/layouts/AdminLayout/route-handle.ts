import { useMatches } from 'react-router-dom';

/**
 * Content modes of the authenticated shell. Routes opt in from the router
 * (`handle: FULL_BLEED`) — never via per-page CSS:
 *
 * - `readable` (default): padded content column, pages set their own
 *   reading width (forms, settings…), the window scrolls.
 * - `full-bleed`: the shell pins itself to the viewport and hands the page
 *   the whole width and height; the page owns its internal scrolling.
 *   Data views (grids) live here.
 */
type ContentMode = 'readable' | 'full-bleed';

type RouteHandle = {
  contentMode?: ContentMode;
};

/** Route handle for data views: `{ path, element, handle: FULL_BLEED }`. */
const FULL_BLEED: RouteHandle = { contentMode: 'full-bleed' };

function isFullBleedHandle(handle: unknown): boolean {
  return (
    typeof handle === 'object' &&
    handle !== null &&
    'contentMode' in handle &&
    (handle as RouteHandle).contentMode === 'full-bleed'
  );
}

/** Resolves the active content mode from the matched routes (deepest wins). */
function useContentMode(): ContentMode {
  const matches = useMatches();
  return matches.some((match) => isFullBleedHandle(match.handle))
    ? 'full-bleed'
    : 'readable';
}

export { FULL_BLEED, useContentMode };
