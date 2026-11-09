import { MEMBERSHIP_ROLES, USER_LEVELS } from "@bsv-sws/shared";
import { z } from "zod";
import { emailSchema, uuidSchema } from "./common.js";

/** Phase 7 – federation administration (settings, account overview, audit log). */

const recipientListSchema = z
  .array(emailSchema)
  .max(50, "Höchstens 50 Empfänger.")
  .transform((list) => [...new Set(list)]);

/** Application settings (Directus singleton `notification_settings`). */
export const appSettingsSchema = z.object({
  /** Notified when a representative accepts an invitation (spec §10.2). */
  representativeJoinedRecipients: z.array(z.string()),
  /** Notified when an event is submitted for review (spec §10.3). */
  eventReviewRecipients: z.array(z.string()),
  /** Spec §19.7: null = unlimited. Binds representatives; federation may override (§4.4). */
  maxRepresentativesPerClub: z.number().int().nullable(),
  updatedAt: z.string().nullable(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const appSettingsUpdateSchema = z.object({
  representativeJoinedRecipients: recipientListSchema,
  eventReviewRecipients: recipientListSchema,
  maxRepresentativesPerClub: z
    .number()
    .int("Bitte eine ganze Zahl angeben.")
    .min(1, "Mindestens 1 – leer lassen für unbegrenzt.")
    .max(100)
    .nullable(),
});
export type AppSettingsUpdateInput = z.input<typeof appSettingsUpdateSchema>;

export const ACCOUNT_STATUSES = [
  "active",
  "invited",
  "draft",
  "suspended",
  "archived",
  "unverified",
] as const;

export const accountSummarySchema = z.object({
  id: uuidSchema,
  email: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  status: z.enum(ACCOUNT_STATUSES),
  /** Derived like the session level; `visitor` = account without club. Null = role not used by the app. */
  level: z.enum(USER_LEVELS).nullable(),
  club: z.object({ id: uuidSchema, name: z.string() }).nullable(),
  membershipRole: z.enum(MEMBERSHIP_ROLES).nullable(),
  lastAccess: z.string().nullable(),
});
export type AccountSummary = z.infer<typeof accountSummarySchema>;

export const ACCOUNT_FILTERS = ["all", "without_club", "representatives", "federation"] as const;
export type AccountFilter = (typeof ACCOUNT_FILTERS)[number];

export const accountListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  filter: z.enum(ACCOUNT_FILTERS).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});

export const auditLogEntrySchema = z.object({
  id: z.number(),
  timestamp: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  actor: z.object({ id: uuidSchema, name: z.string() }).nullable(),
  club: z.object({ id: uuidSchema, name: z.string() }).nullable(),
  changes: z.object({ before: z.unknown().optional(), after: z.unknown().optional() }).nullable(),
  comment: z.string().nullable(),
  context: z.record(z.string(), z.unknown()).nullable(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const auditLogQuerySchema = z.object({
  /** Action prefix, e.g. `event` or `membership.promoted`. */
  action: z
    .string()
    .trim()
    .regex(/^[a-z_.]{1,60}$/)
    .optional(),
  club: uuidSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), page: z.number(), pageCount: z.number(), total: z.number() });
export interface Paginated<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
}
