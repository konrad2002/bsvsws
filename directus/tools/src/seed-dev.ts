/**
 * Minimal LOCAL seed for development and manual testing (spec §14.6):
 * one demo club and three test accounts. Idempotent. Refuses non-local targets.
 *
 *   verband@example.com     federation
 *   vertreter@example.com   user + representative of "SV Musterstadt"
 *   mitglied@example.com    user + member of "SV Musterstadt"
 *
 * Password: DEV_SEED_PASSWORD from .env (min. 10 chars).
 */
import { createItem, createUser, readItems, readUsers } from "@directus/sdk";
import { DIRECTUS_ROLE_IDS } from "@bsv-sws/directus";
import type { MembershipRole } from "@bsv-sws/shared";
import { adminClient, env } from "./env.js";

const host = new URL(env.DIRECTUS_URL).hostname;
if (!["localhost", "127.0.0.1"].includes(host)) {
  throw new Error(`Refusing to seed non-local Directus (${host}).`);
}
const password = env.DEV_SEED_PASSWORD;
if (!password || password.length < 10)
  throw new Error("Set DEV_SEED_PASSWORD (min. 10 chars) in .env.");

const client = adminClient();

async function ensureClub() {
  const existing = await client.request(
    readItems("clubs", { filter: { slug: { _eq: "sv-musterstadt" } }, fields: ["id"] }),
  );
  if (existing[0]) return existing[0].id as string;
  const club = await client.request(
    createItem("clubs", {
      name: "SV Musterstadt e. V.",
      short_name: "SV Musterstadt",
      slug: "sv-musterstadt",
      active: true,
      city: "Musterstadt",
      sports: ["swimming", "masters"],
    }),
  );
  console.log("Created club SV Musterstadt");
  return club.id as string;
}

async function ensureUser(email: string, firstName: string, role: string) {
  const existing = await client.request(
    readUsers({ filter: { email: { _eq: email } }, fields: ["id"] }),
  );
  if (existing[0]) return existing[0].id as string;
  const user = await client.request(
    createUser({
      email,
      password,
      first_name: firstName,
      last_name: "Test",
      role,
      status: "active",
    }),
  );
  console.log(`Created user ${email}`);
  return user.id as string;
}

async function ensureMembership(userId: string, clubId: string, role: MembershipRole) {
  const existing = await client.request(
    readItems("club_memberships", { filter: { active_user: { _eq: userId } }, fields: ["id"] }),
  );
  if (existing[0]) return;
  await client.request(
    createItem("club_memberships", {
      user: userId,
      club: clubId,
      role,
      status: "active",
      active_user: userId,
      started_at: new Date().toISOString(),
    }),
  );
  console.log(`Created ${role} membership for ${userId}`);
}

const clubId = await ensureClub();
await ensureUser("verband@example.com", "Verband", DIRECTUS_ROLE_IDS.federation);
const rep = await ensureUser("vertreter@example.com", "Vertreter", DIRECTUS_ROLE_IDS.user);
const member = await ensureUser("mitglied@example.com", "Mitglied", DIRECTUS_ROLE_IDS.user);
await ensureMembership(rep, clubId, "representative");
await ensureMembership(member, clubId, "member");
console.log("Dev seed complete.");
