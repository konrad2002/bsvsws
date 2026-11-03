import { SPORTS } from "@bsv-sws/shared";
import { z } from "zod";
import { uuidSchema } from "./common.js";

/** Trims; empty string → null (form fields). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(
    z
      .url({ protocol: /^https?$/, error: "Bitte eine gültige Web-Adresse (https://…) angeben." })
      .nullable(),
  )
  .nullable()
  .optional();

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben.").nullable())
  .nullable()
  .optional();

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche.");

/** Fields a club representative may edit (owner decision: not name/slug/active). */
export const clubRepresentativeFieldsSchema = z.object({
  shortName: optionalText(80),
  description: optionalText(20_000),
  website: optionalUrl,
  email: optionalEmail,
  phone: optionalText(50),
  street: optionalText(120),
  postalCode: optionalText(10),
  city: optionalText(80),
  sports: z.array(z.enum(SPORTS)).max(SPORTS.length).optional(),
  venue: optionalText(2000),
});
export const REPRESENTATIVE_CLUB_FIELDS = Object.keys(clubRepresentativeFieldsSchema.shape);

/** Fields only the federation may set. */
export const clubFederationFieldsSchema = z.object({
  name: z.string().trim().min(2, "Bitte einen Vereinsnamen angeben.").max(160),
  slug: slugSchema,
  active: z.boolean(),
});

export const clubCreateSchema = clubFederationFieldsSchema.extend(
  clubRepresentativeFieldsSchema.shape,
);
export type ClubCreateInput = z.infer<typeof clubCreateSchema>;

export const clubUpdateSchema = clubCreateSchema.partial().strict();
export type ClubUpdateInput = z.infer<typeof clubUpdateSchema>;

export const clubSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  shortName: z.string().nullable(),
  slug: z.string(),
  active: z.boolean(),
  logo: uuidSchema.nullable(),
  description: z.string().nullable(),
  website: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  street: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  sports: z.array(z.enum(SPORTS)),
  venue: z.string().nullable(),
});
export type Club = z.infer<typeof clubSchema>;
