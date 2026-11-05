import { SPORTS, VISIBILITY_LEVELS } from "@bsv-sws/shared";
import { z } from "zod";
import { uuidSchema } from "./common.js";

/** Public CMS content (Phase 5). `contentHtml` is already sanitized by the API. */

export const navItemSchema: z.ZodType<NavItem> = z.lazy(() =>
  z.object({
    id: z.number(),
    label: z.string(),
    href: z.string().nullable(),
    external: z.boolean(),
    newTab: z.boolean(),
    children: z.array(navItemSchema),
  }),
);
export interface NavItem {
  id: number;
  label: string;
  /** null = group label without link */
  href: string | null;
  external: boolean;
  newTab: boolean;
  children: NavItem[];
}

export const navigationSchema = z.object({
  main: z.array(navItemSchema),
  footer: z.array(navItemSchema),
  /** Menu "Interner Bereich" (visible items for the user's level). */
  internal: z.array(navItemSchema),
});
export type Navigation = z.infer<typeof navigationSchema>;

export const pageSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  path: z.string(),
  /** Public URL, or /intern/seiten/<path> for protected pages. */
  href: z.string(),
  /** Effective visibility (strictest along the page path). */
  visibility: z.enum(VISIBILITY_LEVELS),
  contentHtml: z.string(),
  breadcrumbs: z.array(z.object({ title: z.string(), href: z.string() })),
  children: z.array(z.object({ title: z.string(), href: z.string() })),
  updatedAt: z.string().nullable(),
});
export type PublicPage = z.infer<typeof pageSchema>;

export const articleCategorySchema = z.object({ name: z.string(), slug: z.string() });

export const articleSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  teaser: z.string().nullable(),
  publishedAt: z.string(),
  category: articleCategorySchema,
  featuredImage: uuidSchema.nullable(),
  author: z.string().nullable(),
});
export type ArticleSummary = z.infer<typeof articleSummarySchema>;

export const articleDetailSchema = articleSummarySchema.extend({
  contentHtml: z.string(),
  updatedAt: z.string().nullable(),
});
export type ArticleDetail = z.infer<typeof articleDetailSchema>;

export const articlePageSchema = z.object({
  items: z.array(articleSummarySchema),
  page: z.number(),
  pageCount: z.number(),
  total: z.number(),
});
export type ArticlePage = z.infer<typeof articlePageSchema>;

export const articleQuerySchema = z.object({
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,120}$/)
    .optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const publicClubSchema = z.object({
  name: z.string(),
  shortName: z.string().nullable(),
  slug: z.string(),
  city: z.string().nullable(),
  sports: z.array(z.enum(SPORTS)),
  hasLogo: z.boolean(),
  /** For the logo URL (/api/clubs/:id/logo). */
  id: uuidSchema,
});
export type PublicClub = z.infer<typeof publicClubSchema>;

export const publicClubDetailSchema = publicClubSchema.extend({
  description: z.string().nullable(),
  website: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  street: z.string().nullable(),
  postalCode: z.string().nullable(),
  venue: z.string().nullable(),
});
export type PublicClubDetail = z.infer<typeof publicClubDetailSchema>;

/** Home banner (Studio singleton `homepage`); null = banner switched off. */
export const homeSchema = z.object({
  hero: z
    .object({
      kicker: z.string().nullable(),
      title: z.string(),
      imageId: z.string().nullable(),
      button: z.object({ label: z.string(), href: z.string(), external: z.boolean() }).nullable(),
    })
    .nullable(),
});
export type Home = z.infer<typeof homeSchema>;

export const redirectSchema = z.object({ to: z.string(), permanent: z.boolean() });
