import { AUDIT_ACTION_GROUPS, auditActionLabel } from "@bsv-sws/shared";
import { Button } from "@bsv-sws/ui/components/button";
import { Select } from "@bsv-sws/ui/components/form";
import { uuidSchema, type AuditLogEntry } from "@bsv-sws/validation";
import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/internal/notices";
import { Pagination } from "@/components/public/pagination";
import { requireUser } from "@/lib/auth/current-user";
import { listAuditLog } from "@/lib/data/admin";
import { listClubs } from "@/lib/data/clubs";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Protokoll" };

const GROUPS = Object.keys(AUDIT_ACTION_GROUPS) as (keyof typeof AUDIT_ACTION_GROUPS)[];

/** Link to the affected entity, where the app has a page for it. */
function entityHref(e: AuditLogEntry): string | null {
  if (e.entityType === "events") return `/intern/veranstaltungen/${e.entityId}`;
  if (e.entityType === "clubs") return `/intern/verband/vereine/${e.entityId}`;
  if (e.club) return `/intern/verband/vereine/${e.club.id}`;
  return null;
}

function Changes({ entry }: { entry: AuditLogEntry }) {
  const hasChanges =
    entry.changes && (entry.changes.before !== undefined || entry.changes.after !== undefined);
  if (!hasChanges && !entry.context) return null;
  return (
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer text-neutral-600">Details</summary>
      <dl className="mt-1 grid gap-1">
        {entry.changes?.before !== undefined && (
          <>
            <dt className="font-medium">Vorher</dt>
            <dd>
              <pre className="overflow-x-auto rounded bg-neutral-50 p-2 whitespace-pre-wrap">
                {JSON.stringify(entry.changes.before, null, 2)}
              </pre>
            </dd>
          </>
        )}
        {entry.changes?.after !== undefined && (
          <>
            <dt className="font-medium">Nachher</dt>
            <dd>
              <pre className="overflow-x-auto rounded bg-neutral-50 p-2 whitespace-pre-wrap">
                {JSON.stringify(entry.changes.after, null, 2)}
              </pre>
            </dd>
          </>
        )}
        {entry.context && (
          <>
            <dt className="font-medium">Kontext</dt>
            <dd>
              <pre className="overflow-x-auto rounded bg-neutral-50 p-2 whitespace-pre-wrap">
                {JSON.stringify(entry.context, null, 2)}
              </pre>
            </dd>
          </>
        )}
      </dl>
    </details>
  );
}

/** Application audit log (spec §4.5), read-only, newest first. */
export default async function AuditLogPage({
  searchParams,
}: PageProps<"/intern/verband/protokoll">) {
  const user = await requireUser("/intern/verband/protokoll");
  if (user.level !== "federation" && user.level !== "administrator") return <NoAccess />;
  const params = await searchParams;
  const action = GROUPS.find((g) => g === params.bereich);
  const club = uuidSchema.safeParse(params.verein).success ? (params.verein as string) : undefined;
  const page = Math.max(1, Number(params.seite) || 1);
  const [log, clubs] = await Promise.all([listAuditLog({ action, club, page }), listClubs()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Protokoll</h1>
      <form className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Bereich
          <Select name="bereich" defaultValue={action ?? ""}>
            <option value="">Alle</option>
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {AUDIT_ACTION_GROUPS[g]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Verein
          <Select name="verein" defaultValue={club ?? ""}>
            <option value="">Alle</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="outline">
          Filtern
        </Button>
      </form>

      <p className="text-sm text-neutral-700">{log.total} Einträge</p>
      <ol className="flex flex-col divide-y rounded border">
        {log.items.map((e) => {
          const href = entityHref(e);
          return (
            <li key={e.id} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {href ? (
                    <Link href={href} className="hover:underline">
                      {auditActionLabel(e.action)}
                    </Link>
                  ) : (
                    auditActionLabel(e.action)
                  )}
                </span>
                <time className="text-xs text-neutral-600" dateTime={e.timestamp ?? undefined}>
                  {formatDateTime(e.timestamp)}
                </time>
              </div>
              <span className="text-neutral-700">
                {e.actor?.name ?? "System"}
                {e.club && ` · ${e.club.name}`}
              </span>
              {e.comment && <span className="text-neutral-700">„{e.comment}“</span>}
              <Changes entry={e} />
            </li>
          );
        })}
        {log.items.length === 0 && (
          <li className="px-3 py-2 text-sm text-neutral-600">Keine Einträge.</li>
        )}
      </ol>
      <Pagination
        basePath="/intern/verband/protokoll"
        page={log.page}
        pageCount={log.pageCount}
        query={{ bereich: action, verein: club }}
        labels={{ prev: "← Neuere", next: "Ältere →" }}
      />
    </div>
  );
}
