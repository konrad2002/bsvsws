import { buttonVariants } from "@bsv-sws/ui/components/button";
import type { PublicEventDetail } from "@bsv-sws/validation";

/** SwimResults badge and links into its web app (live timing, results, athlete search). */
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
    <section aria-labelledby="swimresults" className="flex flex-col gap-3">
      <h2 id="swimresults">Live &amp; Ergebnisse</h2>
      <a href={links.meetingUrl} target="_blank" rel="noopener noreferrer" className="w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static badge, as on bsv-sws.de */}
        <img
          src="/swimresults-badge.png"
          alt="Veranstaltung mit SwimResults"
          width={250}
          height={75}
          className="h-auto w-[175px] max-w-full"
        />
      </a>
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
    </section>
  );
}
