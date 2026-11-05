import { buttonVariants } from "@bsv-sws/ui/components/button";
import type { PublicEventDetail } from "@bsv-sws/validation";

/** Links into the SwimResults web app (live timing, results, athlete search). */
export function SwimResultsLinks({
  links,
}: {
  links: NonNullable<PublicEventDetail["swimresults"]>;
}) {
  const items = [
    { href: links.liveUrl, label: "Livetiming" },
    { href: links.resultsUrl, label: "Echtzeit-Ergebnisse" },
    { href: links.athletesUrl, label: "Sportler finden" },
  ];
  return (
    <section aria-labelledby="swimresults" className="flex flex-col gap-2">
      <h2 id="swimresults">Live &amp; Ergebnisse</h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Bereitgestellt von SwimResults.</p>
    </section>
  );
}
