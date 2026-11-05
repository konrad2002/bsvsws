import type { PublicEventFile, ScheduleEntry } from "@bsv-sws/validation";
import type { FastifyBaseLogger } from "fastify";
import {
  parseList,
  srFileSchema,
  srIncidentSchema,
  srPartSchema,
  toFiles,
  toSchedule,
} from "./swimresults-rules.js";

export interface SwimResultsData {
  /** null = not available (request failed); [] = SwimResults has no data. */
  schedule: ScheduleEntry[] | null;
  files: PublicEventFile[] | null;
}

/**
 * Read-only client for the public SwimResults meeting API with a small in-memory
 * cache (owner decision: live data, short cache). Failures never throw – the
 * event page then falls back to the manually entered data.
 */
export function createSwimResultsClient(deps: {
  apiUrl: string;
  downloadUrl: string;
  log: FastifyBaseLogger;
  ttlMs?: number;
  /** Shorter cache for failures, so an outage is not hammered. */
  errorTtlMs?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
  now?: () => number;
}) {
  const ttl = deps.ttlMs ?? 5 * 60_000;
  const errorTtl = deps.errorTtlMs ?? 60_000;
  const timeout = deps.timeoutMs ?? 4000;
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const base = deps.apiUrl.replace(/\/$/, "");
  const MAX_ENTRIES = 200;
  const cache = new Map<string, { expires: number; value: Promise<unknown> }>();
  /** Marks a failed request (SwimResults itself answers `null` for unknown meetings). */
  const FAILED = Symbol("failed");

  async function getJson(path: string): Promise<unknown> {
    const res = await doFetch(`${base}/${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) throw new Error(`SwimResults ${path}: HTTP ${res.status}`);
    return res.json();
  }

  /** Cached request; concurrent callers share one in-flight promise. Resolves to FAILED on error. */
  function cached(path: string): Promise<unknown> {
    const hit = cache.get(path);
    if (hit && hit.expires > now()) return hit.value;
    const entry = { expires: now() + ttl, value: Promise.resolve<unknown>(FAILED) };
    entry.value = getJson(path).catch((err: unknown) => {
      entry.expires = now() + errorTtl;
      deps.log.warn({ err, path }, "SwimResults request failed");
      return FAILED;
    });
    cache.delete(path);
    cache.set(path, entry);
    if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    return entry.value;
  }

  return {
    async meeting(meetingId: string): Promise<SwimResultsData> {
      const id = encodeURIComponent(meetingId);
      const [files, parts, incidents] = await Promise.all([
        cached(`meeting/v1/file/meeting/list/${id}`),
        cached(`meeting/v1/event/meet/${id}/parts`),
        cached(`meeting/v1/incident/meet/${id}`),
      ]);
      return {
        files: files === FAILED ? null : toFiles(parseList(srFileSchema, files), deps.downloadUrl),
        // Incidents are optional decoration; the races decide whether there is a schedule.
        schedule:
          parts === FAILED
            ? null
            : toSchedule(parseList(srPartSchema, parts), parseList(srIncidentSchema, incidents)),
      };
    },
  };
}

export type SwimResultsClient = ReturnType<typeof createSwimResultsClient>;
