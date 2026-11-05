import Link from "next/link";

/**
 * Simple numbered pagination (?seite=N). Page 1 has no parameter (clean URL).
 * `query` keeps other parameters (filters) on every link.
 */
export function Pagination({
  basePath,
  page,
  pageCount,
  query = {},
  labels = { prev: "← Neuere", next: "Ältere →" },
}: {
  basePath: string;
  page: number;
  pageCount: number;
  query?: Record<string, string | undefined>;
  labels?: { prev: string; next: string };
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const params = new URLSearchParams(
      Object.entries(query).filter((e): e is [string, string] => !!e[1]),
    );
    if (p > 1) params.set("seite", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav aria-label="Seiten" className="flex flex-wrap items-center gap-2 text-sm">
      {page > 1 && (
        <Link href={href(page - 1)} className="rounded border px-2 py-1 hover:bg-muted" rel="prev">
          {labels.prev}
        </Link>
      )}
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? "page" : undefined}
          className={`rounded border px-2 py-1 ${p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          {p}
        </Link>
      ))}
      {page < pageCount && (
        <Link href={href(page + 1)} className="rounded border px-2 py-1 hover:bg-muted" rel="next">
          {labels.next}
        </Link>
      )}
    </nav>
  );
}
