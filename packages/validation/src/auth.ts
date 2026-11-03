import { ACCOUNT_ROLES, MEMBERSHIP_ROLES, USER_LEVELS } from "@bsv-sws/shared";
import { z } from "zod";
import { emailSchema, uuidSchema } from "./common.js";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Bitte Passwort eingeben.").max(256),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const activeMembershipSchema = z.object({
  id: uuidSchema,
  role: z.enum(MEMBERSHIP_ROLES),
  club: z.object({
    id: uuidSchema,
    name: z.string(),
    slug: z.string(),
  }),
});
export type ActiveMembership = z.infer<typeof activeMembershipSchema>;

/**
 * Identity + authorization context of the authenticated user, as returned by
 * Fastify `GET /me`. The frontend uses it for display only – never for security.
 */
export const sessionUserSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  accountRole: z.enum(ACCOUNT_ROLES),
  level: z.enum(USER_LEVELS),
  membership: activeMembershipSchema.nullable(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

/** Uniform error body of the Fastify API. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
