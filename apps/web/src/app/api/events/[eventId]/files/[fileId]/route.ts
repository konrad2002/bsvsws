import { uuidSchema } from "@bsv-sws/validation";
import { proxyAsset } from "@/lib/asset-proxy";

export async function GET(
  _req: Request,
  { params }: RouteContext<"/api/events/[eventId]/files/[fileId]">,
) {
  const { eventId, fileId } = await params;
  if (!uuidSchema.safeParse(eventId).success || !uuidSchema.safeParse(fileId).success) {
    return new Response(null, { status: 404 });
  }
  return proxyAsset(`/events/${eventId}/files/${fileId}`);
}
