import type {
  EventCalendar,
  EventStatus,
  MembershipRole,
  OrganizerType,
  RemovalStatus,
  RemovalType,
  ScheduleEntryType,
  Sport,
} from "@bsv-sws/shared";

/**
 * TypeScript view of the Directus collections, used to type the SDK client.
 * Source of truth is directus/snapshots/schema.json – keep this in sync and
 * document changes in docs/03-data-model.md.
 */

type Uuid = string;
type Timestamp = string;

export interface DirectusUserRecord {
  id: Uuid;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  status: "active" | "invited" | "draft" | "suspended" | "archived" | "unverified";
  role: Uuid | null;
  phone: string | null;
}

export interface Club {
  id: Uuid;
  active: boolean;
  name: string;
  short_name: string | null;
  slug: string;
  logo: Uuid | null;
  description: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  sports: Sport[] | null;
  venue: string | null;
  date_created: Timestamp | null;
  date_updated: Timestamp | null;
}

export type MembershipStatus = "active" | "ended";
export type MembershipEndReason = "removed" | "left";

export interface ClubMembership {
  id: Uuid;
  user: Uuid | DirectusUserRecord;
  club: Uuid | Club;
  role: MembershipRole;
  status: MembershipStatus;
  /** = user while active, otherwise null. Unique → max. one active membership per user. */
  active_user: Uuid | null;
  started_at: Timestamp;
  ended_at: Timestamp | null;
  end_reason: MembershipEndReason | null;
  invitation: Uuid | Invitation | null;
  created_by: Uuid | null;
  ended_by: Uuid | null;
  date_created: Timestamp | null;
  date_updated: Timestamp | null;
}

export type InvitationStatus = "pending" | "accepted" | "revoked";

export interface Invitation {
  id: Uuid;
  /** SHA-256 hex of the secret token. The plaintext token is never stored. */
  token_hash: string;
  email: string;
  club: Uuid | Club;
  membership_role: MembershipRole;
  status: InvitationStatus;
  expires_at: Timestamp;
  issued_by: Uuid;
  accepted_at: Timestamp | null;
  accepted_by: Uuid | null;
  revoked_at: Timestamp | null;
  revoked_by: Uuid | null;
  /** Not-yet-verified account registered through this invitation. */
  registered_user: Uuid | DirectusUserRecord | null;
  /** HMAC of the current 6-digit verification code. */
  verification_code_hash: string | null;
  verification_expires_at: Timestamp | null;
  verification_attempts: number;
  email_sent_at: Timestamp | null;
  date_created: Timestamp | null;
  date_updated: Timestamp | null;
}

/** Singleton: recipients of federation notification emails (spec §10.3). */
export interface NotificationSettings {
  id: number;
  representative_joined_recipients: string[] | null;
  event_review_recipients: string[] | null;
  date_updated: Timestamp | null;
}

export interface AuditLog {
  /** bigInteger: Directus returns it as a string. */
  id: number | string;
  timestamp: Timestamp | null;
  actor: Uuid | null;
  action: string;
  entity_type: string;
  entity_id: string;
  club: Uuid | null;
  changes: { before?: unknown; after?: unknown } | null;
  comment: string | null;
  context: Record<string, unknown> | null;
}

export interface EventCategoryRow {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  sort: number | null;
}

export interface EventRow {
  id: Uuid;
  status: EventStatus;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  calendar: EventCalendar;
  club: Uuid | Club | null;
  organizer_type: OrganizerType;
  organizer_name: string | null;
  official: boolean;
  venue: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  website: string | null;
  title_image: Uuid | null;
  logo: Uuid | null;
  admission_info: string | null;
  results_service: string | null;
  swimresults_id: string | null;
  additional_info: string | null;
  created_by: Uuid | null;
  submitted_by: Uuid | null;
  submitted_at: Timestamp | null;
  reviewed_by: Uuid | null;
  reviewed_at: Timestamp | null;
  review_comment: string | null;
  published_at: Timestamp | null;
  deleted_at: Timestamp | null;
  deleted_by: Uuid | null;
  date_created: Timestamp | null;
  date_updated: Timestamp | null;
}

export interface EventScheduleEntryRow {
  id: Uuid;
  event: Uuid;
  date: string | null;
  time: string | null;
  end_time: string | null;
  type: ScheduleEntryType;
  title: string;
  description: string | null;
  sort: number | null;
}

export interface EventFileRow {
  id: Uuid;
  event: Uuid;
  file: Uuid;
  description: string;
  sort: number | null;
}

export interface EventRemovalRequestRow {
  id: Uuid;
  event: Uuid;
  type: RemovalType;
  reason: string | null;
  status: RemovalStatus;
  /** = event while pending, otherwise null. Unique → max. one open request per event. */
  pending_event: Uuid | null;
  requested_by: Uuid;
  decided_by: Uuid | null;
  decided_at: Timestamp | null;
  decision_comment: string | null;
  date_created: Timestamp | null;
}

export interface DirectusSchema {
  clubs: Club[];
  club_memberships: ClubMembership[];
  invitations: Invitation[];
  audit_logs: AuditLog[];
  notification_settings: NotificationSettings;
  events: EventRow[];
  event_categories: EventCategoryRow[];
  event_schedule_entries: EventScheduleEntryRow[];
  event_files: EventFileRow[];
  event_removal_requests: EventRemovalRequestRow[];
  directus_users: DirectusUserRecord[];
}
