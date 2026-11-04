/**
 * Fixed Directus identifiers. Roles, policies and the service account are
 * created with these IDs by `pnpm directus:apply` (directus/tools), so they are
 * identical in every environment and code can rely on them.
 *
 * The built-in Administrator role is NOT listed: administrators are recognised
 * by `admin_access` (GET /policies/me/globals), not by role ID.
 */
export const DIRECTUS_ROLE_IDS = {
  federation: "6d71ae1e-5994-4d30-b0c1-0b389dc84562",
  user: "d72b538c-fcdd-43c9-bc46-7a20ec0375da",
  apiService: "5ecc84ce-8f8f-4d8e-be1c-4977ce331aa0",
} as const;

export const DIRECTUS_POLICY_IDS = {
  /** Built-in public policy (constant in Directus). */
  public: "abf8a154-5b1c-4a46-ac9c-7300570f4f17",
  /** Limited Directus Studio access for federation users. */
  federationStudio: "8ae01fe4-df79-4b17-9175-efc2b2a4a4ed",
  /** Least-privilege policy of the Fastify service account. */
  apiService: "2aa52b87-29e6-48cc-bfc0-f03db7ee24bc",
} as const;

export const DIRECTUS_SERVICE_USER_ID = "ddfc5c33-37d9-4ba7-9daf-277f3c0e9f5c";

export const DIRECTUS_FOLDER_IDS = {
  /** Only files in this folder are served publicly (CMS images/downloads). Editor uploads land here. */
  publicMedia: "184b9625-f7cc-49dc-9e12-3b7ab98721d5",
} as const;
