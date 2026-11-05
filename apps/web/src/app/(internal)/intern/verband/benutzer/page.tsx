import { MEMBERSHIP_ROLE_LABELS, USER_LEVEL_LABELS } from "@bsv-sws/shared";
import { Button } from "@bsv-sws/ui/components/button";
import { Badge, Input, Select } from "@bsv-sws/ui/components/form";
import { ACCOUNT_FILTERS, type AccountFilter, type AccountSummary } from "@bsv-sws/validation";
import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/internal/notices";
import { Pagination } from "@/components/public/pagination";
import { requireUser } from "@/lib/auth/current-user";
import { listAccounts } from "@/lib/data/admin";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Benutzerkonten" };

const FILTER_LABELS: Record<AccountFilter, string> = {
  all: "Alle Konten",
  without_club: "Ohne Verein",
  representatives: "Vereinsvertreter",
  federation: "Verband",
};

const STATUS_LABELS: Partial<Record<AccountSummary["status"], string>> = {
  suspended: "gesperrt",
  invited: "eingeladen",
  draft: "Entwurf",
  archived: "archiviert",
  unverified: "unbestätigt",
};

function levelLabel(a: AccountSummary) {
  if (a.level === null) return "Sonstige";
  if (a.level === "visitor") return "Ohne Verein";
  return USER_LEVEL_LABELS[a.level];
}

/** Read-only overview of all accounts (owner decision); changes happen on the club page. */
export default async function AccountsPage({
  searchParams,
}: PageProps<"/intern/verband/benutzer">) {
  const user = await requireUser("/intern/verband/benutzer");
  if (user.level !== "federation" && user.level !== "administrator") return <NoAccess />;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : undefined;
  const filter = ACCOUNT_FILTERS.find((f) => f === params.filter) ?? "all";
  const page = Math.max(1, Number(params.seite) || 1);
  const result = await listAccounts({ q, filter, page });

  return (
    <div className="flex flex-col gap-6">
      <h1>Benutzerkonten</h1>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <label className="flex flex-col gap-1 text-sm">
          Suche (Name oder E-Mail)
          <Input name="q" type="search" defaultValue={q} className="w-64" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Anzeigen
          <Select name="filter" defaultValue={filter}>
            {ACCOUNT_FILTERS.map((f) => (
              <option key={f} value={f}>
                {FILTER_LABELS[f]}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="outline">
          Suchen
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {result.total} {result.total === 1 ? "Konto" : "Konten"}. Rollen und Mitgliedschaften
        änderst du auf der Seite des Vereins.
      </p>
      <div className="overflow-x-auto">
        <table className="data-table text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>E-Mail</th>
              <th>Stufe</th>
              <th>Verein</th>
              <th>Letzte Anmeldung</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((a) => (
              <tr key={a.id}>
                <td>
                  {[a.firstName, a.lastName].filter(Boolean).join(" ") || "–"}
                  {STATUS_LABELS[a.status] && (
                    <Badge className="ml-2">{STATUS_LABELS[a.status]}</Badge>
                  )}
                </td>
                <td>{a.email ?? "–"}</td>
                <td>{levelLabel(a)}</td>
                <td>
                  {a.club ? (
                    <Link href={`/intern/verband/vereine/${a.club.id}`} className="link">
                      {a.club.name}
                      {a.membershipRole && ` (${MEMBERSHIP_ROLE_LABELS[a.membershipRole]})`}
                    </Link>
                  ) : (
                    "–"
                  )}
                </td>
                <td className="whitespace-nowrap">{formatDateTime(a.lastAccess)}</td>
              </tr>
            ))}
            {result.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-2 text-muted-foreground">
                  Keine Konten gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        basePath="/intern/verband/benutzer"
        page={result.page}
        pageCount={result.pageCount}
        query={{ q, filter: filter === "all" ? undefined : filter }}
        labels={{ prev: "← Zurück", next: "Weiter →" }}
      />
    </div>
  );
}
