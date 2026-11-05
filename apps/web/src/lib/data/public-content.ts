import "server-only";
import {
  articleCategorySchema,
  articleDetailSchema,
  articlePageSchema,
  homeSchema,
  navigationSchema,
  pageSchema,
  publicClubDetailSchema,
  publicClubSchema,
  redirectSchema,
} from "@bsv-sws/validation";
import { z } from "zod";
import { publicJson } from "../public-api";

export async function getNavigation() {
  return navigationSchema.parse(await publicJson("/public/navigation"));
}

/** Home banner (Studio: Inhalte → Startseite). */
export async function getHome() {
  return homeSchema.parse(await publicJson("/public/home"));
}

/** null = no visible page at this path. */
export async function getPage(path: string) {
  const data = await publicJson(`/public/pages?path=${encodeURIComponent(path)}`);
  return data ? pageSchema.parse(data) : null;
}

export async function listArticles(query: { category?: string; page?: number; pageSize?: number }) {
  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  return articlePageSchema.parse(await publicJson(`/public/articles?${params}`));
}

export async function getArticle(slug: string) {
  const data = await publicJson(`/public/articles/${encodeURIComponent(slug)}`);
  return data ? articleDetailSchema.parse(data) : null;
}

export async function listArticleCategories() {
  return z.array(articleCategorySchema).parse(await publicJson("/public/article-categories"));
}

export async function listClubs() {
  return z.array(publicClubSchema).parse(await publicJson("/public/clubs"));
}

export async function getClub(slug: string) {
  const data = await publicJson(`/public/clubs/${encodeURIComponent(slug)}`);
  return data ? publicClubDetailSchema.parse(data) : null;
}

export async function resolveRedirect(path: string, query: string) {
  const data = await publicJson(`/public/redirects?${new URLSearchParams({ path, query })}`);
  return data ? redirectSchema.parse(data) : null;
}
