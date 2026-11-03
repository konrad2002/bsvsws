/**
 * Declarative Directus access configuration (roles, policies, permissions, settings).
 * Applied idempotently by `pnpm directus:apply`. Documented in docs/04-authorization.md.
 *
 * Licence note: field/row restrictions ("custom permission rules") need a Directus
 * licence; without it Directus rejects them on create and ignores them on read.
 * To stay licence-independent, ALL permissions here are unrestricted (all fields,
 * no filter). Directus always conceals password/token fields. Fine-grained rules
 * live in Fastify. `assertNoCustomRules` (tested) enforces this.
 *
 * Remember: Directus permissions are a second layer. Business authorization for
 * sensitive workflows is enforced in Fastify (spec §3.5).
 */
import {
  DIRECTUS_POLICY_IDS,
  DIRECTUS_ROLE_IDS,
  DIRECTUS_SERVICE_USER_ID,
} from "@bsv-sws/directus";

export type PermissionAction = "create" | "read" | "update" | "delete";

export interface PermissionDef {
  collection: string;
  action: PermissionAction;
  fields: string[];
  permissions?: Record<string, unknown> | null;
  validation?: Record<string, unknown> | null;
  presets?: Record<string, unknown> | null;
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
  "directus_users",
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
      read("directus_users"),
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

/** Throws if any permission uses a licence-gated custom rule (field list or filter). */
export function assertNoCustomRules(defs: PermissionDef[]): void {
  for (const d of defs) {
    const restrictedFields = !(d.fields.length === 1 && d.fields[0] === "*");
    if (restrictedFields || d.permissions || d.validation || d.presets) {
      throw new Error(`Permission ${d.action} on ${d.collection} uses a licence-gated custom rule`);
    }
  }
}
