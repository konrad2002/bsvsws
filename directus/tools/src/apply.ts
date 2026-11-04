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
  createItem,
  createPermission,
  createPolicy,
  createRole,
  createUser,
  customEndpoint,
  deletePermissions,
  readItems,
  readSingleton,
  updateSingleton,
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
import {
  BASE_ARTICLE_CATEGORIES,
  BASE_EVENT_CATEGORIES,
  BASE_FOOTER_NAVIGATION,
  BASE_MAIN_NAVIGATION,
  BASE_PAGES,
  placeholderContent,
  PUBLIC_MEDIA_FOLDER,
  type BaseNavItem,
  type BasePage,
} from "./base-data.js";
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

/** Inserts categories missing by slug. */
async function ensureCategories(
  collection: string,
  categories: { slug: string; name: string; sort: number }[],
) {
  const existing = (await client.request(
    readItems(collection as never, { fields: ["slug"], limit: -1 } as never),
  )) as { slug: string }[];
  const have = new Set(existing.map((c) => c.slug));
  for (const category of categories) {
    if (have.has(category.slug)) continue;
    log(`Base data: ${collection} "${category.name}"`);
    if (!dryRun)
      await client.request(createItem(collection as never, { ...category, active: true } as never));
  }
}

/**
 * Inserts missing base data; never overwrites administrator edits (owner decision:
 * all environments). Pages / navigation are only created if the collection is empty.
 */
async function applyBaseData() {
  // Directus creates a singleton's row lazily on the first update – concurrent
  // first updates create several rows (verified). Create the one row up front.
  const settings = (await client.request(readSingleton("notification_settings" as never))) as {
    id?: number;
  } | null;
  if (!settings?.id) {
    log("Base data: notification_settings row");
    if (!dryRun)
      await client.request(
        updateSingleton(
          "notification_settings" as never,
          { representative_joined_recipients: null } as never,
        ),
      );
  }

  await ensureCategories("event_categories", BASE_EVENT_CATEGORIES);
  await ensureCategories("article_categories", BASE_ARTICLE_CATEGORIES);

  const folders = await client.request(
    customEndpoint<{ id: string }[]>({
      path: "/folders",
      method: "GET",
      params: { filter: { id: { _eq: PUBLIC_MEDIA_FOLDER.id } }, fields: ["id"] },
    }),
  );
  if (folders.length === 0) {
    log(`Base data: folder "${PUBLIC_MEDIA_FOLDER.name}"`);
    if (!dryRun) {
      await client.request(
        customEndpoint({
          path: "/folders",
          method: "POST",
          body: JSON.stringify(PUBLIC_MEDIA_FOLDER),
        }),
      );
    }
  }

  const pageIds = new Map<string, string>(); // "verband/vorstand" → id
  const existingPages = (await client.request(
    readItems("pages" as never, { fields: ["id"], limit: 1 } as never),
  )) as unknown[];
  if (existingPages.length === 0) {
    log(`Base data: ${BASE_PAGES.length} top-level pages with children`);
    const createPages = async (pages: BasePage[], parent: { id: string; path: string } | null) => {
      for (const [i, page] of pages.entries()) {
        const path = parent ? `${parent.path}/${page.slug}` : page.slug;
        if (dryRun) continue;
        const created = (await client.request(
          createItem(
            "pages" as never,
            {
              status: "published",
              visibility: "public",
              title: page.title,
              slug: page.slug,
              parent: parent?.id ?? null,
              content: placeholderContent(page.title),
              sort: i + 1,
            } as never,
          ),
        )) as { id: string };
        pageIds.set(path, created.id);
        if (page.children) await createPages(page.children, { id: created.id, path });
      }
    };
    await createPages(BASE_PAGES, null);
  } else {
    const all = (await client.request(
      readItems("pages" as never, { fields: ["id", "slug", "parent"], limit: -1 } as never),
    )) as { id: string; slug: string; parent: string | null }[];
    const byId = new Map(all.map((p) => [p.id, p]));
    const pathOf = (p: { slug: string; parent: string | null }): string =>
      p.parent && byId.get(p.parent) ? `${pathOf(byId.get(p.parent)!)}/${p.slug}` : p.slug;
    for (const p of all) pageIds.set(pathOf(p), p.id);
  }

  const existingNav = (await client.request(
    readItems("navigation_items" as never, { fields: ["id"], limit: 1 } as never),
  )) as unknown[];
  if (existingNav.length > 0) return;
  log("Base data: main and footer navigation");
  if (dryRun) return;
  const createNav = async (
    menu: "main" | "footer",
    items: BaseNavItem[],
    parent: number | null,
  ) => {
    for (const [i, item] of items.entries()) {
      const target =
        "route" in item
          ? { link_type: "route", route: item.route }
          : pageIds.get(item.pagePath)
            ? { link_type: "page", page: pageIds.get(item.pagePath) }
            : { link_type: "none" };
      const created = (await client.request(
        createItem(
          "navigation_items" as never,
          {
            menu,
            label: item.label,
            parent,
            sort: i + 1,
            visibility: "public",
            active: true,
            ...target,
          } as never,
        ),
      )) as { id: number };
      if (item.children) await createNav(menu, item.children, created.id);
    }
  };
  await createNav("main", BASE_MAIN_NAVIGATION, null);
  await createNav("footer", BASE_FOOTER_NAVIGATION, null);
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
await applyBaseData();
await applyServiceUser();
log("Directus configuration applied.");
