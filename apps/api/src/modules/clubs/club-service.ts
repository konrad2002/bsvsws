import { createItem, readItem, readItems, updateItem, uploadFiles } from "@directus/sdk";
import type { Club as ClubRow } from "@bsv-sws/directus";
import type { Club, ClubCreateInput, ClubUpdateInput } from "@bsv-sws/validation";
import type { ServiceClient } from "../../lib/directus.js";
import { isNotFoundOrForbidden, uniqueViolationField } from "../../lib/directus-errors.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import type { AuditService } from "../audit/audit-service.js";
import type { AuthContext } from "../auth/auth-service.js";
import { authorize, canManageClub, isFederation } from "../auth/authorization.js";
import { assertCanUpdateClub, diffFields } from "./club-rules.js";

const CLUB_FIELDS = [
  "id",
  "name",
  "short_name",
  "slug",
  "active",
  "logo",
  "description",
  "website",
  "email",
  "phone",
  "street",
  "postal_code",
  "city",
  "sports",
  "venue",
] as const;

/** Allowed logo types. SVG is excluded on purpose (can carry scripts). */
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export function toClub(row: Partial<ClubRow>): Club {
  return {
    id: row.id!,
    name: row.name!,
    shortName: row.short_name ?? null,
    slug: row.slug!,
    active: row.active ?? true,
    logo: (row.logo as string | null) ?? null,
    description: row.description ?? null,
    website: row.website ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    street: row.street ?? null,
    postalCode: row.postal_code ?? null,
    city: row.city ?? null,
    sports: row.sports ?? [],
    venue: row.venue ?? null,
  };
}

const COLUMN: Record<keyof ClubUpdateInput, keyof ClubRow> = {
  name: "name",
  slug: "slug",
  active: "active",
  shortName: "short_name",
  description: "description",
  website: "website",
  email: "email",
  phone: "phone",
  street: "street",
  postalCode: "postal_code",
  city: "city",
  sports: "sports",
  venue: "venue",
};

function toRow(input: ClubUpdateInput): Partial<ClubRow> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) row[COLUMN[key as keyof ClubUpdateInput]] = value;
  }
  return row as Partial<ClubRow>;
}

function mapUniqueError(error: unknown): never {
  const field = uniqueViolationField(error);
  if (field === "slug") throw conflict("SLUG_TAKEN", "Diese URL (Slug) ist bereits vergeben.");
  if (field === "name")
    throw conflict("NAME_TAKEN", "Ein Verein mit diesem Namen existiert bereits.");
  throw error;
}

export interface ClubServiceDeps {
  client: ServiceClient;
  audit: AuditService;
  directusUrl: string;
  serviceToken: string;
}

export function createClubService({ client, audit, directusUrl, serviceToken }: ClubServiceDeps) {
  async function loadRow(id: string): Promise<ClubRow> {
    try {
      return (await client.request(readItem("clubs", id, { fields: [...CLUB_FIELDS] }))) as ClubRow;
    } catch (error) {
      if (isNotFoundOrForbidden(error)) throw notFound("Verein nicht gefunden.");
      throw error;
    }
  }

  return {
    /** Federation: all clubs including inactive ones. */
    async list(ctx: AuthContext): Promise<Club[]> {
      authorize(isFederation(ctx));
      const rows = await client.request(
        readItems("clubs", { fields: [...CLUB_FIELDS], sort: ["name"], limit: -1 }),
      );
      return rows.map((r) => toClub(r as ClubRow));
    },

    /** Federation, or any member of the club. */
    async get(ctx: AuthContext, id: string): Promise<Club> {
      authorize(canManageClub(ctx, id) || ctx.membership?.club.id === id);
      return toClub(await loadRow(id));
    },

    async create(ctx: AuthContext, input: ClubCreateInput): Promise<Club> {
      authorize(isFederation(ctx));
      let row: ClubRow;
      try {
        row = (await client.request(
          createItem("clubs", toRow(input) as never, { fields: [...CLUB_FIELDS] }),
        )) as ClubRow;
      } catch (error) {
        mapUniqueError(error);
      }
      await audit.record({
        actor: ctx.id,
        action: "club.created",
        entityType: "clubs",
        entityId: row.id,
        club: row.id,
        changes: { after: input },
      });
      return toClub(row);
    },

    async update(ctx: AuthContext, id: string, input: ClubUpdateInput): Promise<Club> {
      assertCanUpdateClub(ctx, id, input);
      const before = toClub(await loadRow(id));
      const diff = diffFields(
        before as unknown as Record<string, unknown>,
        input as Record<string, unknown>,
      );
      if (!diff.changed) return before;
      let row: ClubRow;
      try {
        row = (await client.request(
          updateItem("clubs", id, toRow(input) as never, { fields: [...CLUB_FIELDS] }),
        )) as ClubRow;
      } catch (error) {
        mapUniqueError(error);
      }
      await audit.record({
        actor: ctx.id,
        action: "club.updated",
        entityType: "clubs",
        entityId: id,
        club: id,
        changes: { before: diff.before, after: diff.after },
      });
      return toClub(row);
    },

    async setLogo(
      ctx: AuthContext,
      id: string,
      file: { filename: string; mimetype: string; data: Buffer },
    ) {
      authorize(canManageClub(ctx, id));
      if (!(LOGO_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
        throw badRequest("INVALID_FILE_TYPE", "Bitte ein Logo als PNG, JPEG oder WebP hochladen.");
      }
      const before = await loadRow(id);
      const form = new FormData();
      form.append("title", `Logo ${before.name}`);
      form.append(
        "file",
        new Blob([new Uint8Array(file.data)], { type: file.mimetype }),
        file.filename,
      );
      const uploaded = (await client.request(uploadFiles(form))) as { id: string };
      const row = (await client.request(
        updateItem("clubs", id, { logo: uploaded.id } as never, { fields: [...CLUB_FIELDS] }),
      )) as ClubRow;
      await audit.record({
        actor: ctx.id,
        action: "club.logo_changed",
        entityType: "clubs",
        entityId: id,
        club: id,
        changes: { before: { logo: before.logo }, after: { logo: uploaded.id } },
      });
      return toClub(row);
    },

    async removeLogo(ctx: AuthContext, id: string) {
      authorize(canManageClub(ctx, id));
      const before = await loadRow(id);
      if (!before.logo) return toClub(before);
      const row = (await client.request(
        updateItem("clubs", id, { logo: null } as never, { fields: [...CLUB_FIELDS] }),
      )) as ClubRow;
      await audit.record({
        actor: ctx.id,
        action: "club.logo_changed",
        entityType: "clubs",
        entityId: id,
        club: id,
        changes: { before: { logo: before.logo }, after: { logo: null } },
      });
      return toClub(row);
    },

    /**
     * Public logo delivery. Directus files are not publicly readable (protected
     * documents will live there too), so the API serves exactly the club's logo.
     */
    async fetchLogo(id: string): Promise<{ body: Buffer; contentType: string } | null> {
      let row: ClubRow;
      try {
        row = await loadRow(id);
      } catch {
        return null;
      }
      if (!row.logo) return null;
      const res = await fetch(new URL(`/assets/${row.logo as string}`, directusUrl), {
        headers: { authorization: `Bearer ${serviceToken}` },
      });
      if (!res.ok) return null;
      return {
        body: Buffer.from(await res.arrayBuffer()),
        contentType: res.headers.get("content-type") ?? "application/octet-stream",
      };
    },
  };
}

export type ClubService = ReturnType<typeof createClubService>;
