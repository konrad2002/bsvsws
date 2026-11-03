import { z } from "zod";

export const uuidSchema = z.uuid();
/** Trimmed + lower-cased before validation (users paste addresses with spaces/capitals). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben."));
