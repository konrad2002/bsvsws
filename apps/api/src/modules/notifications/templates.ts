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

const eventLink = (webPublicUrl: string, eventId: string) =>
  new URL(`/intern/veranstaltungen/${eventId}`, webPublicUrl).toString();

export function eventSubmittedEmail(input: {
  to: string[];
  title: string;
  clubName: string | null;
  eventId: string;
  webPublicUrl: string;
  resubmitted: boolean;
}): EmailMessage {
  return {
    to: input.to,
    subject: `${input.resubmitted ? "Erneut eingereicht" : "Neue Veranstaltung zur Prüfung"}: ${input.title}`,
    text:
      `Hallo,\n\n` +
      `${input.clubName ? `der Verein „${input.clubName}“` : "Es"} hat die Veranstaltung „${input.title}“ ` +
      `${input.resubmitted ? "erneut " : ""}zur Freigabe eingereicht.\n\n` +
      `Prüfen: ${eventLink(input.webPublicUrl, input.eventId)}` +
      SIGNATURE,
  };
}

export function eventDecisionEmail(input: {
  to: string;
  title: string;
  approved: boolean;
  comment: string | null;
  eventId: string;
  webPublicUrl: string;
}): EmailMessage {
  return {
    to: input.to,
    subject: input.approved
      ? `Veranstaltung freigegeben: ${input.title}`
      : `Veranstaltung abgelehnt: ${input.title}`,
    text:
      `Hallo,\n\n` +
      (input.approved
        ? `die Veranstaltung „${input.title}“ wurde vom Verband freigegeben und ist jetzt öffentlich sichtbar.`
        : `die Veranstaltung „${input.title}“ wurde vom Verband abgelehnt.\n\nBegründung:\n${input.comment ?? "–"}\n\n` +
          `Du kannst die Veranstaltung überarbeiten und erneut einreichen.`) +
      (input.approved && input.comment ? `\n\nKommentar:\n${input.comment}` : "") +
      `\n\n${eventLink(input.webPublicUrl, input.eventId)}` +
      SIGNATURE,
  };
}

export function removalRequestedEmail(input: {
  to: string[];
  title: string;
  type: "unpublish" | "delete";
  reason: string;
  eventId: string;
  webPublicUrl: string;
}): EmailMessage {
  const what = input.type === "delete" ? "Löschung" : "Depublizierung";
  return {
    to: input.to,
    subject: `Antrag auf ${what}: ${input.title}`,
    text:
      `Hallo,\n\n` +
      `für die veröffentlichte Veranstaltung „${input.title}“ wurde die ${what} beantragt. ` +
      `Die Veranstaltung bleibt bis zur Entscheidung öffentlich sichtbar.\n\n` +
      `Begründung:\n${input.reason}\n\n` +
      `Entscheiden: ${eventLink(input.webPublicUrl, input.eventId)}` +
      SIGNATURE,
  };
}

export function removalDecidedEmail(input: {
  to: string;
  title: string;
  type: "unpublish" | "delete";
  approved: boolean;
  comment: string | null;
  eventId: string;
  webPublicUrl: string;
}): EmailMessage {
  const what = input.type === "delete" ? "Löschung" : "Depublizierung";
  return {
    to: input.to,
    subject: `Antrag auf ${what} ${input.approved ? "genehmigt" : "abgelehnt"}: ${input.title}`,
    text:
      `Hallo,\n\n` +
      `dein Antrag auf ${what} der Veranstaltung „${input.title}“ wurde ${input.approved ? "genehmigt" : "abgelehnt"}.` +
      (input.comment ? `\n\nKommentar:\n${input.comment}` : "") +
      `\n\n${eventLink(input.webPublicUrl, input.eventId)}` +
      SIGNATURE,
  };
}
