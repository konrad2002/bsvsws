/**
 * Decides whether a link click starts a client-side navigation that the progress
 * bar should track: a plain left click on a same-origin link to another page,
 * which Next's <Link> has taken over (`defaultPrevented`). Everything else –
 * downloads, new tabs, external links, hash jumps – is a native browser action
 * with the browser's own loading indicator.
 */
export function isTrackedNavigation(
  click: {
    defaultPrevented: boolean;
    button: number;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  },
  link: { href: string; target: string; hasDownload: boolean } | null,
  current: string,
): boolean {
  if (!link || !click.defaultPrevented || click.button !== 0) return false;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (link.hasDownload || (link.target && link.target !== "_self")) return false;
  let to: URL;
  let from: URL;
  try {
    from = new URL(current);
    to = new URL(link.href, from);
  } catch {
    return false;
  }
  return to.origin === from.origin && pageKey(to) !== pageKey(from);
}

/** Path + query: what identifies a page (the hash does not). */
export const pageKey = (url: { pathname: string; search: string }) => url.pathname + url.search;
