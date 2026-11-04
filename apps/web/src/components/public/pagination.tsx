import Link from "next/link";

/** Simple numbered pagination (?seite=N). Page 1 has no parameter (clean URL). */
export function Pagination({
  basePath,
  page,
  pageCount,
}: {
  basePath: string;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => (p === 1 ? basePath : `${basePath}?seite=${p}`);
  return (
    <nav aria-label="Seiten" className="flex flex-wrap items-center gap-2 text-sm">
      {page > 1 && (
        <Link
          href={href(page - 1)}
          className="rounded border px-2 py-1 hover:bg-neutral-100"
          rel="prev"
        >
          ← Neuere
        </Link>
      )}
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? "page" : undefined}
          className={`rounded border px-2 py-1 ${p === page ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
        >
          {p}
        </Link>
      ))}
      {page < pageCount && (
        <Link
          href={href(page + 1)}
          className="rounded border px-2 py-1 hover:bg-neutral-100"
          rel="next"
        >
          Ältere →
        </Link>
      )}
    </nav>
  );
}
