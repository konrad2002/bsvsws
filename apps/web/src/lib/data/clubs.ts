import "server-only";
import { clubMemberSchema, clubSchema, invitationSchema } from "@bsv-sws/validation";
import { z } from "zod";
import { apiFetch } from "../api";

/** Server-side data access for club administration (all checks happen in Fastify). */

export async function getClub(clubId: string) {
  return clubSchema.parse(await apiFetch(`/clubs/${clubId}`));
}

export async function listClubs() {
  return z.array(clubSchema).parse(await apiFetch("/clubs"));
}

export async function listMembers(clubId: string) {
  return z.array(clubMemberSchema).parse(await apiFetch(`/clubs/${clubId}/members`));
}

export async function listInvitations(clubId: string) {
  return z.array(invitationSchema).parse(await apiFetch(`/clubs/${clubId}/invitations`));
}
