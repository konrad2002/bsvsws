/**
 * Declarative Directus access configuration (roles, policies, permissions, settings).
 * Applied idempotently by `pnpm directus:apply`. Documented in docs/04-authorization.md.
 *
 * Licence note: field/row restrictions ("custom permission rules") need a Directus
 * licence; without it Directus rejects them on create and ignores them on read.
 * To stay licence-independent, every BASE permission is unrestricted (all fields,
 * no filter); `assertNoCustomRules` (tested) enforces this. Directus always
 * conceals password/token fields. Fine-grained rules live in Fastify.
 * Exception: `hardened` variants (security-critical writes) are installed instead
 * of the base rule when the instance is licensed – see PermissionDef.hardened.
 *
 * Remember: Directus permissions are a second layer. Business authorization for
 * sensitive workflows is enforced in Fastify (spec §3.5).
 */
import {
  DIRECTUS_POLICY_IDS,
  DIRECTUS_ROLE_IDS,
  DIRECTUS_SERVICE_USER_ID,
} from "@bsv-sws/directus";

const BENUTZER_ONLY = { role: { _eq: DIRECTUS_ROLE_IDS.user } };

export type PermissionAction = "create" | "read" | "update" | "delete";

export interface PermissionRule {
  fields: string[];
  permissions?: Record<string, unknown> | null;
  validation?: Record<string, unknown> | null;
  presets?: Record<string, unknown> | null;
}

export interface PermissionDef extends PermissionRule {
  collection: string;
  action: PermissionAction;
  /**
   * Stricter variant installed instead of the base rule when the instance is
   * licensed (custom rules available). The base rule must stay unrestricted.
   * If the licence lapses, Directus ignores the hardened rule → the action is
   * denied (fails closed) until `directus:apply` reinstalls the base rule.
   */
  hardened?: PermissionRule;
}

export interface PolicyDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  app_access: boolean;
  admin_access: boolean;
  permissions: PermissionDef[];
}

export interface RoleDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  policies: string[];
}

/** Collections whose permissions are managed here (also on the built-in public policy). */
export const MANAGED_COLLECTIONS = [
  "clubs",
  "club_memberships",
  "invitations",
  "audit_logs",
  "notification_settings",
  "directus_users",
  "directus_files",
] as const;

const all = ["*"];
const read = (collection: string) =>
  ({ collection, action: "read", fields: all }) satisfies PermissionDef;
const write = (collection: string, action: "create" | "update") =>
  ({ collection, action, fields: all }) satisfies PermissionDef;

export const POLICIES: PolicyDef[] = [
  {
    id: DIRECTUS_POLICY_IDS.federationStudio,
    name: "Verband – Studio",
    description:
      "Eingeschränkter Studio-Zugang für Verbandsbenutzer. Workflow-Daten nur lesend; Änderungen laufen über die Anwendung (Fastify).",
    icon: "admin_panel_settings",
    app_access: true,
    admin_access: false,
    permissions: [
      read("clubs"),
      read("club_memberships"),
      read("invitations"),
      read("audit_logs"),
      read("directus_users"),
      read("directus_files"),
      // Configuration only (no workflow data): recipients of federation emails.
      read("notification_settings"),
      write("notification_settings", "update"),
    ],
  },
  {
    id: DIRECTUS_POLICY_IDS.apiService,
    name: "API-Servicekonto",
    description:
      "Least-Privilege-Policy des Fastify-Servicekontos. Fastify prüft die Berechtigung des ursprünglichen Benutzers selbst.",
    icon: "dns",
    app_access: false,
    admin_access: false,
    permissions: [
      read("clubs"),
      write("clubs", "create"),
      write("clubs", "update"),
      read("club_memberships"),
      write("club_memberships", "create"),
      write("club_memberships", "update"),
      read("invitations"),
      write("invitations", "create"),
      write("invitations", "update"),
      read("audit_logs"),
      write("audit_logs", "create"),
      read("notification_settings"),
      // Registration via invitation creates/activates accounts (role is set by Fastify).
      read("directus_users"),
      {
        ...write("directus_users", "create"),
        // Licensed: may only create "Benutzer" accounts with registration fields.
        hardened: {
          fields: ["first_name", "last_name", "email", "password", "phone", "status", "role"],
          validation: BENUTZER_ONLY,
          presets: { role: DIRECTUS_ROLE_IDS.user },
        },
      },
      {
        ...write("directus_users", "update"),
        // Licensed: never role/email, and only accounts that are "Benutzer" (no admin/federation takeover).
        hardened: {
          fields: ["first_name", "last_name", "password", "phone", "status"],
          permissions: BENUTZER_ONLY,
        },
      },
      // Club logo uploads.
      read("directus_files"),
      write("directus_files", "create"),
    ],
  },
];

/**
 * Permissions added to the built-in public policy (unauthenticated reads).
 * Unrestricted so it does not depend on the licence; club records contain only
 * public information. Next.js filters `active = true` itself.
 */
export const PUBLIC_PERMISSIONS: PermissionDef[] = [read("clubs")];

export const ROLES: RoleDef[] = [
  {
    id: DIRECTUS_ROLE_IDS.federation,
    name: "Verband",
    description: "Verbandsbenutzer (federation).",
    icon: "shield",
    policies: [DIRECTUS_POLICY_IDS.federationStudio],
  },
  {
    id: DIRECTUS_ROLE_IDS.user,
    name: "Benutzer",
    description:
      "Vereinsbenutzer ohne Studio-Zugang. Mitglied/Vereinsvertreter ergibt sich aus der Mitgliedschaft.",
    icon: "person",
    // No Directus permissions at all: club users only act through Next.js/Fastify.
    policies: [],
  },
  {
    id: DIRECTUS_ROLE_IDS.apiService,
    name: "API-Service",
    description: "Nur für das technische Fastify-Servicekonto.",
    icon: "dns",
    policies: [DIRECTUS_POLICY_IDS.apiService],
  },
];

export const SERVICE_USER = {
  id: DIRECTUS_SERVICE_USER_ID,
  email: "api-service@bsv-sws.de",
  first_name: "API",
  last_name: "Service",
  role: DIRECTUS_ROLE_IDS.apiService,
};

export const SETTINGS = {
  project_name: "BSV-SWS",
  default_language: "de-DE",
  /** Invitation-only: Directus self-registration stays disabled (spec §5.1). */
  public_registration: false,
  /** Suspend an account after this many failed logins. */
  auth_login_attempts: 10,
  /** Minimum 10 characters. */
  auth_password_policy: "/^.{10,}$/",
};

/** Throws if any BASE permission uses a licence-gated custom rule (hardened variants may). */
export function assertNoCustomRules(defs: PermissionDef[]): void {
  for (const d of defs) {
    const restrictedFields = !(d.fields.length === 1 && d.fields[0] === "*");
    if (restrictedFields || d.permissions || d.validation || d.presets) {
      throw new Error(`Permission ${d.action} on ${d.collection} uses a licence-gated custom rule`);
    }
  }
}
