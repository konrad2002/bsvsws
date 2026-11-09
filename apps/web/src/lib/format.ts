/** German date/time formatting (Europe/Berlin). */

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});
const dateTimeFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

/** Plain calendar dates (YYYY-MM-DD) are formatted without time zone shifts. */
export const formatDate = (isoDate: string) =>
  dateFmt.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));

export const formatDateTime = (iso: string | null) =>
  iso ? dateTimeFmt.format(new Date(iso)) : "–";

export function formatDateRange(start: string, end: string) {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

export function formatFileSize(bytes: number | null) {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

const berlinDateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Berlin",
});
/** Timestamp → "4. November 2026" in Europe/Berlin (news dates). */
export const formatPublishedDate = (iso: string) => berlinDateFmt.format(new Date(iso));
