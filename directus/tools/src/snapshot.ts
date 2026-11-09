/**
 * Exports the current Directus schema to directus/snapshots/schema.json.
 * Run after changing the schema in a local instance, then commit the file.
 */
import { schemaSnapshot } from "@directus/sdk";
import { writeFile } from "node:fs/promises";
import { adminClient, SNAPSHOT_PATH } from "./env.js";

const snapshot = await adminClient().request(schemaSnapshot());
await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`Schema snapshot written to ${SNAPSHOT_PATH}`);
