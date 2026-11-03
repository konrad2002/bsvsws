import { MEMBERSHIP_ROLE_LABELS, type MembershipRole } from "@bsv-sws/shared";
import type { EmailMessage } from "../../lib/mailer.js";

/**
 * German plain-text email templates (spec §10.2). Plain text keeps them robust
 * across mail clients; an HTML layout can follow with the visual design.
 */

const SIGNATURE = "\n\nViele Grüße\nBezirksschwimmverband Südwestsachsen\n";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  });

export function invitationEmail(input: {
  to: string;
  clubName: string;
  role: MembershipRole;
  link: string;
  expiresAt: string;
}): EmailMessage {
  const asRep = input.role === "representative";
  return {
    to: input.to,
    subject: asRep
      ? `Einladung als Vereinsvertreter für ${input.clubName}`
      : `Einladung in den internen Bereich – ${input.clubName}`,
    text:
      `Hallo,\n\n` +
      `du wurdest eingeladen, dem internen Bereich des Bezirksschwimmverbands Südwestsachsen ` +
      `als ${MEMBERSHIP_ROLE_LABELS[input.role]} des Vereins „${input.clubName}“ beizutreten.\n\n` +
      (asRep
        ? `Als Vereinsvertreter kannst du die Vereinsdaten pflegen, Mitglieder einladen und Veranstaltungen einreichen.\n\n`
        : "") +
      `Über diesen Link kannst du ein Konto anlegen oder dich mit einem bestehenden Konto anmelden:\n\n` +
      `${input.link}\n\n` +
      `Der Link ist bis zum ${formatDate(input.expiresAt)} gültig und kann nur einmal verwendet werden. ` +
      `Wenn du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.` +
      SIGNATURE,
  };
}

export function verificationCodeEmail(input: { to: string; code: string }): EmailMessage {
  return {
    to: input.to,
    subject: `Dein Bestätigungscode: ${input.code}`,
    text:
      `Hallo,\n\n` +
      `dein Bestätigungscode für die Registrierung beim Bezirksschwimmverband Südwestsachsen lautet:\n\n` +
      `    ${input.code}\n\n` +
      `Der Code ist 15 Minuten gültig. Wenn du dich nicht registriert hast, kannst du diese E-Mail ignorieren.` +
      SIGNATURE,
  };
}

export function memberJoinedEmail(input: {
  to: string[];
  clubName: string;
  memberName: string;
  memberEmail: string;
}): EmailMessage {
  return {
    to: input.to,
    subject: `Neues Mitglied im internen Bereich: ${input.memberName}`,
    text:
      `Hallo,\n\n` +
      `${input.memberName} (${input.memberEmail}) hat die Einladung angenommen und ist jetzt ` +
      `Mitglied von „${input.clubName}“ im internen Bereich.` +
      SIGNATURE,
  };
}

export function representativeJoinedEmail(input: {
  to: string[];
  clubName: string;
  memberName: string;
  memberEmail: string;
}): EmailMessage {
  return {
    to: input.to,
    subject: `Neuer Vereinsvertreter: ${input.clubName}`,
    text:
      `Hallo,\n\n` +
      `${input.memberName} (${input.memberEmail}) hat die Einladung angenommen und ist jetzt ` +
      `Vereinsvertreter von „${input.clubName}“.` +
      SIGNATURE,
  };
}
