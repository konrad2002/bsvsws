const GERMAN: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
  Ä: "ae",
  Ö: "oe",
  Ü: "ue",
};

/**
 * URL slug with German transliteration ("Südwest-Pokal 2027" → "suedwest-pokal-2027").
 * Lower-case ASCII letters, digits and single hyphens; trimmed to `maxLength`.
 */
export function slugify(input: string, maxLength = 80): string {
  return input
    .replace(/[äöüßÄÖÜ]/g, (c) => GERMAN[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}
