import {
  createItem,
  createUser,
  readItem,
  readItems,
  readSingleton,
  readUsers,
  updateItem,
  updateUser,
} from "@directus/sdk";
import { DIRECTUS_ROLE_IDS, type InvitationStatus } from "@bsv-sws/directus";
import type { MembershipRole } from "@bsv-sws/shared";
import type {
  InvitationCreateInput,
  InvitationLinkResult,
  InvitationRegisterInput,
  InvitationSummary,
  PublicInvitation,
} from "@bsv-sws/validation";
import type { FastifyBaseLogger } from "fastify";
import {
  generateToken,
  generateVerificationCode,
  hmacCode,
  safeEqualHex,
  sha256,
} from "../../lib/crypto.js";
import type { ServiceClient } from "../../lib/directus.js";
import { isNotFoundOrForbidden, uniqueViolationField } from "../../lib/directus-errors.js";
import { AppError, badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import type { Mailer } from "../../lib/mailer.js";
import type { AuditService } from "../audit/audit-service.js";
import type { AuthContext } from "../auth/auth-service.js";
import { authorize, canInvite, canManageClub } from "../auth/authorization.js";
import {
  invitationEmail,
  memberJoinedEmail,
  representativeJoinedEmail,
  verificationCodeEmail,
} from "../notifications/templates.js";
import {
  assertInvitationUsable,
  emailsMatch,
  invitationDisplayStatus,
  inviteLink,
  MAX_VERIFICATION_ATTEMPTS,
  VERIFICATION_CODE_TTL_MS,
} from "./invitation-rules.js";

interface InvitationRow {
  id: string;
  email: string;
  club: { id: string; name: string };
  membership_role: MembershipRole;
  status: InvitationStatus;
  expires_at: string;
  issued_by: string;
  accepted_at: string | null;
  date_created: string | null;
  email_sent_at: string | null;
  registered_user: { id: string; status: string; email: string } | null;
  verification_code_hash: string | null;
  verification_expires_at: string | null;
  verification_attempts: number;
}

const FIELDS = [
  "id",
  "email",
  "club.id",
  "club.name",
  "membership_role",
  "status",
  "expires_at",
  "issued_by",
  "accepted_at",
  "date_created",
  "email_sent_at",
  "registered_user.id",
  "registered_user.status",
  "registered_user.email",
  "verification_code_hash",
  "verification_expires_at",
  "verification_attempts",
];

interface UserRow {
  id: string;
  email: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
}

export interface InvitationServiceDeps {
  client: ServiceClient;
  audit: AuditService;
  mailer: Mailer;
  log: FastifyBaseLogger;
  appSecret: string;
  webPublicUrl: string;
  invitationTtlDays: number;
  now?: () => Date;
}

export function createInvitationService(deps: InvitationServiceDeps) {
  const { client, audit, mailer, log } = deps;
  const now = deps.now ?? (() => new Date());

  const summary = (row: InvitationRow): InvitationSummary => ({
    id: row.id,
    email: row.email,
    role: row.membership_role,
    status: invitationDisplayStatus(row, now()),
    expiresAt: row.expires_at,
    createdAt: row.date_created,
    emailSentAt: row.email_sent_at,
    acceptedAt: row.accepted_at,
  });

  async function loadById(id: string): Promise<InvitationRow> {
    try {
      return (await client.request(
        readItem("invitations", id, { fields: FIELDS as never }),
      )) as unknown as InvitationRow;
    } catch (error) {
      if (isNotFoundOrForbidden(error)) throw notFound("Einladung nicht gefunden.");
      throw error;
    }
  }

  async function findByToken(token: string): Promise<InvitationRow | null> {
    const rows = (await client.request(
      readItems("invitations", {
        filter: { token_hash: { _eq: sha256(token) } },
        fields: FIELDS as never,
        limit: 1,
      }),
    )) as unknown as InvitationRow[];
    return rows[0] ?? null;
  }

  async function requireByToken(token: string): Promise<InvitationRow> {
    const row = await findByToken(token);
    if (!row) throw notFound("Dieser Einladungslink ist ungültig.");
    return row;
  }

  async function findUserByEmail(email: string): Promise<UserRow | null> {
    const rows = (await client.request(
      readUsers({
        filter: { email: { _eq: email.toLowerCase() } },
        fields: ["id", "email", "status", "first_name", "last_name"],
        limit: 1,
      }),
    )) as unknown as UserRow[];
    return rows[0] ?? null;
  }

  async function sendInvitationEmail(row: InvitationRow, link: string): Promise<boolean> {
    try {
      await mailer.send(
        invitationEmail({
          to: row.email,
          clubName: row.club.name,
          role: row.membership_role,
          link,
          expiresAt: row.expires_at,
        }),
      );
      await client.request(
        updateItem("invitations", row.id, { email_sent_at: now().toISOString() } as never),
      );
      return true;
    } catch (error) {
      log.warn({ err: error, invitation: row.id }, "Invitation email could not be sent");
      return false;
    }
  }

  /** Creates a fresh token (rotating any previous one) and returns the one-time link. */
  async function issueToken(id: string): Promise<{ token: string; expiresAt: string }> {
    const token = generateToken();
    const expiresAt = new Date(now().getTime() + deps.invitationTtlDays * 86_400_000).toISOString();
    await client.request(
      updateItem("invitations", id, { token_hash: sha256(token), expires_at: expiresAt } as never),
    );
    return { token, expiresAt };
  }

  /**
   * Atomic acceptance: membership creation and invitation update happen in ONE
   * Directus request (nested relational write = one DB transaction). The unique
   * constraints on club_memberships.active_user and .invitation turn a second
   * active membership or a second acceptance into a 409 (spec §5.3).
   */
  async function acceptInto(row: InvitationRow, user: UserRow): Promise<string> {
    const at = now().toISOString();
    let membership: { id: string };
    try {
      membership = (await client.request(
        createItem(
          "club_memberships",
          {
            user: user.id,
            club: row.club.id,
            role: row.membership_role,
            status: "active",
            active_user: user.id,
            started_at: at,
            created_by: row.issued_by,
            invitation: {
              id: row.id,
              status: "accepted",
              accepted_at: at,
              accepted_by: user.id,
              verification_code_hash: null,
            },
          } as never,
          { fields: ["id"] },
        ),
      )) as { id: string };
    } catch (error) {
      const field = uniqueViolationField(error);
      if (field === "active_user") {
        throw conflict(
          "ALREADY_MEMBER",
          "Du bist bereits Mitglied eines Vereins. Eine zweite Vereinszugehörigkeit ist nicht möglich.",
        );
      }
      if (field === "invitation")
        throw conflict("INVITATION_USED", "Diese Einladung wurde bereits angenommen.");
      throw error;
    }

    await audit.record({
      actor: user.id,
      action: "invitation.accepted",
      entityType: "invitations",
      entityId: row.id,
      club: row.club.id,
      context: { membership: membership.id, role: row.membership_role },
    });
    await audit.record({
      actor: user.id,
      action: "membership.created",
      entityType: "club_memberships",
      entityId: membership.id,
      club: row.club.id,
      changes: { after: { role: row.membership_role, user: user.id } },
      context: { invitation: row.id, granted_by: row.issued_by },
    });
    await notifyAccepted(row, user);
    return membership.id;
  }

  /** spec §5.7: member joined → club representatives; representative joined → configured federation list. */
  async function notifyAccepted(row: InvitationRow, user: UserRow) {
    const memberName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
    try {
      if (row.membership_role === "member") {
        const reps = (await client.request(
          readItems("club_memberships", {
            filter: {
              club: { _eq: row.club.id },
              status: { _eq: "active" },
              role: { _eq: "representative" },
              user: { _neq: user.id },
            },
            fields: ["user.email"] as never,
            limit: -1,
          }),
        )) as unknown as { user: { email: string | null } }[];
        const to = reps.map((r) => r.user.email).filter((e): e is string => !!e);
        if (to.length)
          await mailer.send(
            memberJoinedEmail({ to, clubName: row.club.name, memberName, memberEmail: user.email }),
          );
      } else {
        const settings = (await client.request(readSingleton("notification_settings"))) as {
          representative_joined_recipients: string[] | null;
        } | null;
        const to = settings?.representative_joined_recipients?.filter(Boolean) ?? [];
        if (to.length) {
          await mailer.send(
            representativeJoinedEmail({
              to,
              clubName: row.club.name,
              memberName,
              memberEmail: user.email,
            }),
          );
        } else {
          log.warn("No representative_joined_recipients configured in notification_settings");
        }
      }
    } catch (error) {
      // Notifications never undo a successful acceptance.
      log.error({ err: error, invitation: row.id }, "Acceptance notification failed");
    }
  }

  /** Generates a new code (resets attempts) and emails it to the invited address. */
  async function sendCode(row: InvitationRow, userId: string): Promise<void> {
    const code = generateVerificationCode();
    await client.request(
      updateItem("invitations", row.id, {
        registered_user: userId,
        verification_code_hash: hmacCode(deps.appSecret, row.id, code),
        verification_expires_at: new Date(now().getTime() + VERIFICATION_CODE_TTL_MS).toISOString(),
        verification_attempts: 0,
      } as never),
    );
    try {
      await mailer.send(verificationCodeEmail({ to: row.email, code }));
    } catch (error) {
      log.error({ err: error, invitation: row.id }, "Verification code email failed");
      throw new AppError(
        502,
        "EMAIL_FAILED",
        "Die E-Mail mit dem Bestätigungscode konnte nicht gesendet werden. Bitte versuche es erneut.",
      );
    }
  }

  async function loadClub(id: string): Promise<{ id: string; name: string }> {
    try {
      return (await client.request(readItem("clubs", id, { fields: ["id", "name"] }))) as {
        id: string;
        name: string;
      };
    } catch (error) {
      if (isNotFoundOrForbidden(error)) throw notFound("Verein nicht gefunden.");
      throw error;
    }
  }

  return {
    async listForClub(ctx: AuthContext, clubId: string): Promise<InvitationSummary[]> {
      authorize(canManageClub(ctx, clubId));
      const rows = (await client.request(
        readItems("invitations", {
          filter: { club: { _eq: clubId } },
          fields: FIELDS as never,
          sort: ["-date_created"],
          limit: 100,
        }),
      )) as unknown as InvitationRow[];
      return rows.map(summary);
    },

    async create(
      ctx: AuthContext,
      clubId: string,
      input: Required<InvitationCreateInput>,
    ): Promise<InvitationLinkResult> {
      authorize(
        canInvite(ctx, clubId, input.role),
        input.role === "representative"
          ? "Vereinsvertreter kann nur der Verband einladen."
          : "Du kannst nur Mitglieder deines eigenen Vereins einladen.",
      );
      const club = await loadClub(clubId);

      const open = await client.request(
        readItems("invitations", {
          filter: {
            club: { _eq: clubId },
            email: { _eq: input.email },
            status: { _eq: "pending" },
            expires_at: { _gt: now().toISOString() },
          } as never, // SDK types timestamps as plain strings (no _gt)
          fields: ["id"],
          limit: 1,
        }),
      );
      if (open.length) {
        throw conflict(
          "INVITATION_EXISTS",
          "Für diese E-Mail-Adresse gibt es bereits eine offene Einladung. Du kannst sie erneut senden.",
        );
      }
      const existingUser = await findUserByEmail(input.email);
      if (existingUser) {
        const sameClub = await client.request(
          readItems("club_memberships", {
            filter: { active_user: { _eq: existingUser.id }, club: { _eq: clubId } },
            fields: ["id"],
            limit: 1,
          }),
        );
        if (sameClub.length)
          throw conflict(
            "ALREADY_MEMBER_OF_CLUB",
            "Diese Person ist bereits Mitglied des Vereins.",
          );
      }

      const token = generateToken();
      const expiresAt = new Date(
        now().getTime() + deps.invitationTtlDays * 86_400_000,
      ).toISOString();
      const created = (await client.request(
        createItem(
          "invitations",
          {
            token_hash: sha256(token),
            email: input.email,
            club: clubId,
            membership_role: input.role,
            status: "pending",
            expires_at: expiresAt,
            issued_by: ctx.id,
          } as never,
          { fields: ["id"] },
        ),
      )) as { id: string };
      const row = { ...(await loadById(created.id)), club };
      const link = inviteLink(deps.webPublicUrl, token);
      const emailSent = input.sendEmail ? await sendInvitationEmail(row, link) : false;

      await audit.record({
        actor: ctx.id,
        action: "invitation.created",
        entityType: "invitations",
        entityId: row.id,
        club: clubId,
        changes: { after: { email: input.email, role: input.role } },
        context: { emailSent },
      });
      return { invitation: summary(await loadById(row.id)), link, emailSent };
    },

    /** New link (old one stops working), new expiry, optional email. */
    async regenerate(
      ctx: AuthContext,
      id: string,
      sendEmail: boolean,
    ): Promise<InvitationLinkResult> {
      const row = await loadById(id);
      authorize(canInvite(ctx, row.club.id, row.membership_role));
      if (row.status !== "pending")
        throw conflict("INVITATION_NOT_PENDING", "Diese Einladung ist nicht mehr offen.");
      const { token, expiresAt } = await issueToken(id);
      const link = inviteLink(deps.webPublicUrl, token);
      const emailSent = sendEmail
        ? await sendInvitationEmail({ ...row, expires_at: expiresAt }, link)
        : false;
      await audit.record({
        actor: ctx.id,
        action: "invitation.resent",
        entityType: "invitations",
        entityId: id,
        club: row.club.id,
        context: { emailSent },
      });
      return { invitation: summary(await loadById(id)), link, emailSent };
    },

    async revoke(ctx: AuthContext, id: string): Promise<InvitationSummary> {
      const row = await loadById(id);
      authorize(canInvite(ctx, row.club.id, row.membership_role));
      if (row.status !== "pending")
        throw conflict("INVITATION_NOT_PENDING", "Diese Einladung ist nicht mehr offen.");
      await client.request(
        updateItem("invitations", id, {
          status: "revoked",
          revoked_at: now().toISOString(),
          revoked_by: ctx.id,
        } as never),
      );
      await audit.record({
        actor: ctx.id,
        action: "invitation.revoked",
        entityType: "invitations",
        entityId: id,
        club: row.club.id,
      });
      return summary(await loadById(id));
    },

    /** Public: what the holder of the link may see. */
    async getPublic(token: string): Promise<PublicInvitation> {
      const row = await findByToken(token);
      if (!row) {
        return {
          status: "invalid",
          email: null,
          role: null,
          clubName: null,
          accountExists: false,
          awaitingVerification: false,
        };
      }
      const display = invitationDisplayStatus(row, now());
      const status = display === "pending" ? "valid" : display;
      const user = status === "valid" ? await findUserByEmail(row.email) : null;
      return {
        status,
        email: row.email,
        role: row.membership_role,
        clubName: row.club.name,
        accountExists: user?.status === "active",
        awaitingVerification:
          status === "valid" && user?.status === "unverified" && !!row.verification_code_hash,
      };
    },

    /**
     * Registration of a NEW account (spec §5.3/5.6). The account is created as
     * `unverified` (cannot log in) and a 6-digit code is emailed to the invited
     * address; only verify() activates it and creates the membership.
     */
    async register(token: string, input: InvitationRegisterInput): Promise<void> {
      const row = await requireByToken(token);
      assertInvitationUsable(row, now());
      const existing = await findUserByEmail(row.email);
      if (existing && existing.status === "active") {
        throw conflict(
          "ACCOUNT_EXISTS",
          "Für diese E-Mail-Adresse gibt es bereits ein Konto. Bitte melde dich an, um die Einladung anzunehmen.",
        );
      }
      if (existing && existing.status !== "unverified") {
        throw conflict(
          "ACCOUNT_UNAVAILABLE",
          "Für diese E-Mail-Adresse ist keine Registrierung möglich. Bitte wende dich an den Verband.",
        );
      }

      const profile = {
        first_name: input.firstName,
        last_name: input.lastName,
        password: input.password,
        phone: input.phone ?? null,
      };
      let userId: string;
      if (existing) {
        await client.request(updateUser(existing.id, profile as never));
        userId = existing.id;
      } else {
        const created = (await client.request(
          createUser(
            {
              ...profile,
              email: row.email,
              status: "unverified",
              role: DIRECTUS_ROLE_IDS.user,
            } as never,
            { fields: ["id"] },
          ),
        )) as { id: string };
        userId = created.id;
      }
      await sendCode(row, userId);
    },

    async resendCode(token: string): Promise<void> {
      const row = await requireByToken(token);
      assertInvitationUsable(row, now());
      if (!row.registered_user || row.registered_user.status !== "unverified") {
        throw badRequest(
          "NOT_AWAITING_VERIFICATION",
          "Für diese Einladung wird kein Bestätigungscode erwartet.",
        );
      }
      await sendCode(row, row.registered_user.id);
    },

    /** Checks the code, activates the account and accepts the invitation. */
    async verify(token: string, code: string): Promise<{ email: string }> {
      const row = await requireByToken(token);
      assertInvitationUsable(row, now());
      const user = row.registered_user;
      if (
        !user ||
        user.status !== "unverified" ||
        !row.verification_code_hash ||
        !row.verification_expires_at
      ) {
        throw badRequest(
          "NOT_AWAITING_VERIFICATION",
          "Für diese Einladung wird kein Bestätigungscode erwartet.",
        );
      }
      if (!emailsMatch(user.email, row.email)) throw forbidden();
      if (row.verification_attempts >= MAX_VERIFICATION_ATTEMPTS) {
        throw new AppError(
          429,
          "CODE_LOCKED",
          "Zu viele Fehlversuche. Bitte fordere einen neuen Code an.",
        );
      }
      if (new Date(row.verification_expires_at).getTime() <= now().getTime()) {
        throw badRequest(
          "CODE_EXPIRED",
          "Der Code ist abgelaufen. Bitte fordere einen neuen Code an.",
        );
      }
      if (!safeEqualHex(row.verification_code_hash, hmacCode(deps.appSecret, row.id, code))) {
        const attempts = row.verification_attempts + 1;
        await client.request(
          updateItem("invitations", row.id, { verification_attempts: attempts } as never),
        );
        throw badRequest("INVALID_CODE", "Der Code ist nicht korrekt.", {
          remainingAttempts: Math.max(0, MAX_VERIFICATION_ATTEMPTS - attempts),
        });
      }

      await client.request(updateUser(user.id, { status: "active" } as never));
      await audit.record({
        actor: user.id,
        action: "user.verified",
        entityType: "directus_users",
        entityId: user.id,
        club: row.club.id,
        context: { invitation: row.id },
      });
      const fullUser = (await findUserByEmail(row.email))!;
      await acceptInto(row, fullUser);
      return { email: row.email };
    },

    /** Existing, logged-in account accepts (spec §5.3 steps 4–8). */
    async acceptExisting(ctx: AuthContext, token: string): Promise<void> {
      const row = await requireByToken(token);
      assertInvitationUsable(row, now());
      if (!emailsMatch(ctx.email, row.email)) {
        throw forbidden("Diese Einladung gilt für eine andere E-Mail-Adresse.", "EMAIL_MISMATCH");
      }
      if (ctx.membership) {
        throw conflict(
          "ALREADY_MEMBER",
          ctx.membership.club.id === row.club.id
            ? "Du bist bereits Mitglied dieses Vereins. Rollen werden in der Vereinsverwaltung geändert."
            : "Du bist bereits Mitglied eines anderen Vereins. Eine zweite Vereinszugehörigkeit ist nicht möglich.",
        );
      }
      await acceptInto(row, {
        id: ctx.id,
        email: ctx.email,
        status: "active",
        first_name: ctx.firstName,
        last_name: ctx.lastName,
      });
    },
  };
}

export type InvitationService = ReturnType<typeof createInvitationService>;
