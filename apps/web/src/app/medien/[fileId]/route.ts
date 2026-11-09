import { uuidSchema } from "@bsv-sws/validation";
import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/lib/auth/tokens";
import { env } from "@/lib/env";

/**
 * CMS files (images/documents in articles and pages). Fastify decides access by
 * the content that references the file (spec §8.5): public files for everyone,
 * files of protected pages only for users who may see such a page. The session
 * token is forwarded; without login the browser is sent to the login page.
 */
export async function GET(request: Request, { params }: RouteContext<"/medien/[fileId]">) {
  const { fileId } = await params;
  if (!uuidSchema.safeParse(fileId).success) return new Response(null, { status: 404 });
  const url = new URL(request.url);
  const width = url.searchParams.get("width");
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;

  const res = await fetch(
    new URL(
      `/content/files/${fileId}${width && /^\d{2,4}$/.test(width) ? `?width=${width}` : ""}`,
      env.API_URL,
    ),
    { cache: "no-store", headers: token ? { authorization: `Bearer ${token}` } : {} },
  );

  if (res.status === 401) {
    const login = new URL("/login", url);
    login.searchParams.set("next", url.pathname + url.search);
    return Response.redirect(login, 307);
  }
  if (res.status === 403) {
    return new Response("Kein Zugriff – für diese Datei fehlt dir die Berechtigung.", {
      status: 403,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "private, no-store",
      },
    });
  }
  if (!res.ok || !res.body) return new Response(null, { status: 404 });

  const headers = new Headers({
    "content-type": res.headers.get("content-type") ?? "application/octet-stream",
    "cache-control": res.headers.get("cache-control") ?? "private, no-store",
    "x-content-type-options": "nosniff",
  });
  const disposition = res.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  return new Response(res.body, { headers });
}
