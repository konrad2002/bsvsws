import { uuidSchema } from "@bsv-sws/validation";
import { proxyAsset } from "@/lib/asset-proxy";

export async function GET(
  _req: Request,
  { params }: RouteContext<"/api/events/[eventId]/images/[kind]">,
) {
  const { eventId, kind } = await params;
  if (!uuidSchema.safeParse(eventId).success || !["title_image", "logo"].includes(kind)) {
    return new Response(null, { status: 404 });
  }
  return proxyAsset(`/events/${eventId}/images/${kind}`);
}
