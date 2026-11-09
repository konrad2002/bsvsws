"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { isTrackedNavigation, pageKey } from "@/lib/navigation-progress";

/**
 * Thin progress bar at the top of the window while a client-side navigation is
 * pending (slow connections would otherwise give no feedback after a click).
 * It appears only after a short delay (CSS), so fast navigations show nothing,
 * and ends as soon as the new URL is rendered.
 */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}

function ProgressBar() {
  const current = pageKey({ pathname: usePathname(), search: searchString(useSearchParams()) });
  // The page the navigation started on; loading ends once a different page renders.
  const [startedOn, setStartedOn] = useState<string | null>(null);
  // Any page change ends the navigation (reset while rendering, React's pattern for
  // state derived from changing values).
  const [renderedOn, setRenderedOn] = useState(current);
  if (renderedOn !== current) {
    setRenderedOn(current);
    setStartedOn(null);
  }
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    // Bubble phase on window: runs after React/Next handled the click.
    const onClick = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      const link =
        a instanceof HTMLAnchorElement
          ? { href: a.href, target: a.target, hasDownload: a.hasAttribute("download") }
          : null;
      if (isTrackedNavigation(e, link, window.location.href)) setStartedOn(currentRef.current);
    };
    // Back/forward: the URL has already changed when popstate fires.
    const onPopState = () => {
      if (pageKey(window.location) !== currentRef.current) setStartedOn(currentRef.current);
    };
    window.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const loading = startedOn === current;
  return <div aria-hidden className="nav-progress bg-accent" data-loading={loading || undefined} />;
}

const searchString = (params: URLSearchParams) => {
  const s = params.toString();
  return s ? `?${s}` : "";
};
