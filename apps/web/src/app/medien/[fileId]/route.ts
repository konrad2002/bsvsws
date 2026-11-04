import { uuidSchema } from "@bsv-sws/validation";
import { fetchMedia } from "@/lib/data/public-content";

/**
 * Public CMS media (images/downloads in articles and pages). Fastify only serves
 * files from the "Öffentliche Medien" folder; optional ?width= image transform.
 */
export async function GET(request: Request, { params }: RouteContext<"/medien/[fileId]">) {
  const { fileId } = await params;
  if (!uuidSchema.safeParse(fileId).success) return new Response(null, { status: 404 });
  const width = new URL(request.url).searchParams.get("width");
  const res = await fetchMedia(fileId, width && /^\d{2,4}$/.test(width) ? width : null);
  if (!res.ok || !res.body) return new Response(null, { status: 404 });
  const headers = new Headers({
    "content-type": res.headers.get("content-type") ?? "application/octet-stream",
    "cache-control": "public, max-age=3600",
    "x-content-type-options": "nosniff",
  });
  const disposition = res.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  return new Response(res.body, { headers });
}
