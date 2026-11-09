/** Only allow same-site relative paths as post-login targets (prevents open redirects). */
export function safeRedirectPath(value: unknown, fallback = "/intern"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
