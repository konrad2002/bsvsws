import { fetchCalendarFeed } from "@/lib/data/public-events";

/**
 * Public WebCal feeds (spec §7.13): /kalender/alle.ics and /kalender/<kalender>.ics.
 * Subscribe via webcal://<host>/kalender/<name>.ics. No authentication, published events only.
 */
export async function GET(_request: Request, { params }: RouteContext<"/kalender/[feed]">) {
  const { feed } = await params;
  const match = /^([a-z]{1,30})\.ics$/.exec(feed);
  if (!match) return new Response("Not found", { status: 404 });
  const res = await fetchCalendarFeed(match[1]!);
  if (!res.ok) return new Response("Not found", { status: 404 });
  return new Response(await res.text(), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="bsv-sws-${match[1]}.ics"`,
      "cache-control": "public, max-age=900",
    },
  });
}
