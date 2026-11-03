/**
 * Applies the version-controlled Directus configuration to an instance:
 *   1. project settings
 *   2. schema snapshot (directus/snapshots/schema.json) – refuses deletions unless
 *      --allow-destructive is passed (spec §14.3: no automatic destructive changes)
 *   3. policies + permissions, roles, role↔policy links
 *   4. the Fastify service account (token from DIRECTUS_SERVICE_TOKEN)
 *
 * Idempotent: safe to run repeatedly. Flags: --dry-run, --allow-destructive
 */
import {
  createPermission,
  createPolicy,
  createRole,
  createUser,
  customEndpoint,
  deletePermissions,
  readPermissions,
  readPolicies,
  readRoles,
  readUsers,
  schemaApply,
  schemaDiff,
  updatePolicy,
  updateRole,
  updateSettings,
  updateUser,
} from "@directus/sdk";
import { readFile } from "node:fs/promises";
import { DIRECTUS_POLICY_IDS } from "@bsv-sws/directus";
import {
  assertNoCustomRules,
  MANAGED_COLLECTIONS,
  POLICIES,
  PUBLIC_PERMISSIONS,
  ROLES,
  SERVICE_USER,
  SETTINGS,
  type PermissionDef,
  type PermissionRule,
} from "./access.js";
import { adminClient, env, SNAPSHOT_PATH } from "./env.js";
import { findDestructiveChanges, summarizeDiff, type SchemaDiff } from "./schema-diff.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const allowDestructive = args.has("--allow-destructive");
const client = adminClient();

const log = (msg: string) => console.log(dryRun ? `[dry-run] ${msg}` : msg);

async function applySettings() {
  log("Settings: project name, language, registration, login attempts, password policy");
  if (!dryRun) await client.request(updateSettings(SETTINGS));
}

async function applySchema() {
  const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  // No `force`: a snapshot from a different Directus version is rejected and must be re-exported.
  const result = (await client.request(schemaDiff(snapshot))) as unknown as
    { hash: string; diff: SchemaDiff } | undefined;
  if (!result?.diff) {
    log("Schema: up to date");
    return;
  }
  for (const line of summarizeDiff(result.diff)) log(`Schema change: ${line}`);
  const destructive = findDestructiveChanges(result.diff);
  if (destructive.length > 0 && !allowDestructive) {
    throw new Error(
      `Refusing destructive schema changes without --allow-destructive:\n  ${destructive.join("\n  ")}`,
    );
  }
  if (!dryRun) await client.request(schemaApply(result as never));
  log("Schema: applied");
}

function toPayload(policy: string, d: PermissionDef, rule: PermissionRule = d) {
  return {
    policy,
    collection: d.collection,
    action: d.action,
    fields: rule.fields,
    permissions: rule.permissions ?? null,
    validation: rule.validation ?? null,
    presets: rule.presets ?? null,
  };
}

function isLicenceRestricted(error: unknown) {
  return (error as { errors?: { extensions?: { code?: string } }[] })?.errors?.some(
    (e) => e.extensions?.code === "RESOURCE_RESTRICTED",
  );
}

async function replacePermissions(
  policy: string,
  defs: PermissionDef[],
  collections: readonly string[],
) {
  const existing = await client.request(
    readPermissions({
      filter: { policy: { _eq: policy }, collection: { _in: [...collections] } },
      fields: ["id"],
      limit: -1,
    }),
  );
  const ids = existing.map((p) => p.id as unknown as string);
  if (!dryRun && ids.length > 0) await client.request(deletePermissions(ids as never));
  let hardened = 0;
  for (const d of defs) {
    if (dryRun) continue;
    if (d.hardened) {
      try {
        await client.request(createPermission(toPayload(policy, d, d.hardened) as never));
        hardened += 1;
        continue;
      } catch (error) {
        if (!isLicenceRestricted(error)) throw error;
        console.warn(
          `WARNING: no Directus licence – ${d.action} on ${d.collection} installed WITHOUT hardening.`,
        );
      }
    }
    await client.request(createPermission(toPayload(policy, d) as never));
  }
  log(
    `Permissions of policy ${policy}: ${ids.length} replaced by ${defs.length} (${hardened} hardened)`,
  );
}

async function applyPolicies() {
  for (const { permissions, ...policy } of POLICIES) {
    const found = await client.request(
      readPolicies({ filter: { id: { _eq: policy.id } }, fields: ["id"] }),
    );
    log(`Policy "${policy.name}": ${found.length ? "update" : "create"}`);
    if (!dryRun) {
      if (found.length) await client.request(updatePolicy(policy.id, policy as never));
      else await client.request(createPolicy(policy as never));
    }
    // Own policies: every collection is managed here.
    const collections = [
      ...new Set([...MANAGED_COLLECTIONS, ...permissions.map((p) => p.collection)]),
    ];
    await replacePermissions(policy.id, permissions, collections);
  }
  // Built-in public policy: only touch our managed collections.
  await replacePermissions(DIRECTUS_POLICY_IDS.public, PUBLIC_PERMISSIONS, MANAGED_COLLECTIONS);
}

async function applyRoles() {
  for (const { policies, ...role } of ROLES) {
    const found = await client.request(
      readRoles({ filter: { id: { _eq: role.id } }, fields: ["id"] }),
    );
    log(`Role "${role.name}": ${found.length ? "update" : "create"}`);
    if (!dryRun) {
      if (found.length) await client.request(updateRole(role.id, role as never));
      else await client.request(createRole(role as never));
    }
    for (const policy of policies) {
      const links = await client.request<{ id: string }[]>(
        customEndpoint({
          path: "/access",
          method: "GET",
          params: { filter: { role: { _eq: role.id }, policy: { _eq: policy } }, fields: ["id"] },
        }),
      );
      if (links.length === 0) {
        log(`  link policy ${policy}`);
        if (!dryRun) {
          await client.request(
            customEndpoint({
              path: "/access",
              method: "POST",
              body: JSON.stringify({ role: role.id, policy }),
            }),
          );
        }
      }
    }
  }
}

async function applyServiceUser() {
  const token = env.DIRECTUS_SERVICE_TOKEN;
  if (!token || token.length < 32) {
    throw new Error(
      "DIRECTUS_SERVICE_TOKEN must be set (min. 32 chars, e.g. `openssl rand -hex 32`).",
    );
  }
  const found = await client.request(
    readUsers({ filter: { id: { _eq: SERVICE_USER.id } }, fields: ["id"] }),
  );
  log(`Service account ${SERVICE_USER.email}: ${found.length ? "update" : "create"}`);
  if (dryRun) return;
  const data = { ...SERVICE_USER, status: "active", token };
  if (found.length) await client.request(updateUser(SERVICE_USER.id, data as never));
  else await client.request(createUser(data as never));
}

assertNoCustomRules([...POLICIES.flatMap((p) => p.permissions), ...PUBLIC_PERMISSIONS]);
await applySettings();
await applySchema();
await applyPolicies();
await applyRoles();
await applyServiceUser();
log("Directus configuration applied.");
