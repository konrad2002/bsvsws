import { describe, expect, it, vi } from "vitest";
import { createSwimResultsClient } from "./swimresults-client.js";

const log = { warn: vi.fn() } as never;

function setup(respond: (url: string) => Response | Promise<Response>) {
  let time = 0;
  const fetch = vi.fn(async (url: string | URL | Request) => respond(String(url)));
  const client = createSwimResultsClient({
    apiUrl: "https://api.example/",
    downloadUrl: "https://dl.example",
    log,
    ttlMs: 1000,
    errorTtlMs: 100,
    fetch: fetch as never,
    now: () => time,
  });
  return { client, fetch, advance: (ms: number) => (time += ms) };
}

const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

describe("SwimResults client", () => {
  it("loads files, parts and incidents and caches them", async () => {
    const { client, fetch, advance } = setup((url) =>
      url.endsWith("/list/M1")
        ? json([{ name: "MEETING_INFO", path: "/M1/a.pdf", existing: true }])
        : url.endsWith("/parts")
          ? json([
              { number: 1, events: [{ number: 1, distance: 50, style: { name: "FREESTYLE" } }] },
            ])
          : json(null),
    );
    const data = await client.meeting("M1");
    expect(data.files).toHaveLength(1);
    expect(data.schedule?.map((e) => e.kind)).toEqual(["section", "race"]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[0]![0]).toBe("https://api.example/meeting/v1/file/meeting/list/M1");

    await client.meeting("M1");
    expect(fetch).toHaveBeenCalledTimes(3);
    advance(1001);
    await client.meeting("M1");
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it("returns null per section on errors and retries after the error TTL", async () => {
    const { client, fetch, advance } = setup(() => new Response("down", { status: 502 }));
    expect(await client.meeting("M1")).toEqual({ files: null, schedule: null });
    await client.meeting("M1");
    expect(fetch).toHaveBeenCalledTimes(3);
    advance(101);
    await client.meeting("M1");
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it("treats an unknown meeting (null) as no data", async () => {
    const { client } = setup(() => json(null));
    expect(await client.meeting("NOPE")).toEqual({ files: [], schedule: [] });
  });
});
