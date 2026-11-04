/**
 * Application audit actions (spec §4.5) with German labels for the federation's
 * log view. Keep in sync with docs/05-workflows.md "Audit actions".
 */
export const AUDIT_ACTION_LABELS = {
  "club.created": "Verein angelegt",
  "club.updated": "Verein geändert",
  "club.logo_changed": "Vereinslogo geändert",
  "invitation.created": "Einladung erstellt",
  "invitation.resent": "Einladung erneut gesendet",
  "invitation.revoked": "Einladung widerrufen",
  "invitation.accepted": "Einladung angenommen",
  "user.verified": "E-Mail-Adresse bestätigt",
  "membership.created": "Mitgliedschaft begonnen",
  "membership.promoted": "Zum Vereinsvertreter ernannt",
  "membership.demoted": "Vereinsvertreter zurückgestuft",
  "membership.removed": "Aus dem Verein entfernt",
  "event.created": "Veranstaltung angelegt",
  "event.updated": "Veranstaltung geändert",
  "event.submitted": "Veranstaltung eingereicht",
  "event.resubmitted": "Veranstaltung erneut eingereicht",
  "event.approved": "Veranstaltung freigegeben",
  "event.rejected": "Veranstaltung abgelehnt",
  "event.published": "Veranstaltung veröffentlicht",
  "event.unpublished": "Veranstaltung zurückgezogen",
  "event.removal_requested": "Entfernung beantragt",
  "event.removal_approved": "Entfernung genehmigt",
  "event.removal_rejected": "Entfernung abgelehnt",
  "event.discarded": "Entwurf verworfen",
  "event.deleted": "Veranstaltung gelöscht",
  "event.file_added": "Datei hinzugefügt",
  "event.file_removed": "Datei entfernt",
  "event.image_changed": "Bild geändert",
  "settings.updated": "Einstellungen geändert",
} as const;
export type AuditAction = keyof typeof AUDIT_ACTION_LABELS;

/** Groups for the log filter (action prefix). */
export const AUDIT_ACTION_GROUPS = {
  club: "Vereine",
  invitation: "Einladungen",
  membership: "Mitgliedschaften",
  user: "Konten",
  event: "Veranstaltungen",
  settings: "Einstellungen",
} as const;

export const auditActionLabel = (action: string): string =>
  (AUDIT_ACTION_LABELS as Record<string, string>)[action] ?? action;
