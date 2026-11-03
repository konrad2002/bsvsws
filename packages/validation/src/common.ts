import { z } from "zod";

export const uuidSchema = z.uuid();
export const emailSchema = z.email().trim().toLowerCase();
