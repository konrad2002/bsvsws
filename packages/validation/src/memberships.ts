import { MEMBERSHIP_ROLES } from "@bsv-sws/shared";
import { z } from "zod";
import { emailSchema, uuidSchema } from "./common.js";

export const membershipRoleChangeSchema = z.object({ role: z.enum(MEMBERSHIP_ROLES) });
export type MembershipRoleChangeInput = z.infer<typeof membershipRoleChangeSchema>;

export const clubMemberSchema = z.object({
  membershipId: uuidSchema,
  userId: uuidSchema,
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string(),
  role: z.enum(MEMBERSHIP_ROLES),
  startedAt: z.string(),
});
export type ClubMember = z.infer<typeof clubMemberSchema>;

export const INVITATION_DISPLAY_STATUSES = ["pending", "expired", "accepted", "revoked"] as const;
export type InvitationDisplayStatus = (typeof INVITATION_DISPLAY_STATUSES)[number];

export const invitationCreateSchema = z.object({
  email: emailSchema,
  role: z.enum(MEMBERSHIP_ROLES),
  /** false = only create the link for manual sharing (spec §5.3). */
  sendEmail: z.boolean().default(true),
});
export type InvitationCreateInput = z.input<typeof invitationCreateSchema>;

export const invitationSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  role: z.enum(MEMBERSHIP_ROLES),
  status: z.enum(INVITATION_DISPLAY_STATUSES),
  expiresAt: z.string(),
  createdAt: z.string().nullable(),
  emailSentAt: z.string().nullable(),
  acceptedAt: z.string().nullable(),
});
export type InvitationSummary = z.infer<typeof invitationSchema>;

/** Returned once when an invitation link is (re)generated. The link is never retrievable again. */
export const invitationLinkResultSchema = z.object({
  invitation: invitationSchema,
  link: z.string(),
  emailSent: z.boolean(),
});
export type InvitationLinkResult = z.infer<typeof invitationLinkResultSchema>;

/** Public view of an invitation for the person holding the link. */
export const publicInvitationSchema = z.object({
  status: z.enum(["valid", "expired", "accepted", "revoked", "invalid"]),
  email: z.string().nullable(),
  role: z.enum(MEMBERSHIP_ROLES).nullable(),
  clubName: z.string().nullable(),
  /** An active account with this email exists → log in and accept instead of registering. */
  accountExists: z.boolean(),
  /** Registration done, waiting for the 6-digit code. */
  awaitingVerification: z.boolean(),
});
export type PublicInvitation = z.infer<typeof publicInvitationSchema>;

export const passwordSchema = z
  .string()
  .min(10, "Das Passwort muss mindestens 10 Zeichen lang sein.")
  .max(256);

export const invitationRegisterSchema = z.object({
  firstName: z.string().trim().min(1, "Bitte Vornamen angeben.").max(80),
  lastName: z.string().trim().min(1, "Bitte Nachnamen angeben.").max(80),
  password: passwordSchema,
  phone: z
    .string()
    .trim()
    .max(50)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});
export type InvitationRegisterInput = z.infer<typeof invitationRegisterSchema>;

export const verificationCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Bitte den 6-stelligen Code eingeben."),
});

export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Ungültiger Einladungslink.");
