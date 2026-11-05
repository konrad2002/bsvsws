/** Icon shape per file format, as in the SwimResults file list. */
export type FileIcon = "document" | "data" | "archive" | "file";

/** Icon and colour token class (theme.css `--file-*`) for a file extension. */
export function fileFormat(extension: string | null): { icon: FileIcon; colorClass: string } {
  const ext = extension?.toLowerCase() ?? "";
  if (ext === "pdf") return { icon: "document", colorClass: "bg-file-pdf" };
  if (/^dsv\d+$/.test(ext)) return { icon: "data", colorClass: "bg-file-dsv" };
  if (/^dsv\d+z$/.test(ext)) return { icon: "archive", colorClass: "bg-file-dsv" };
  if (ext === "lef") return { icon: "data", colorClass: "bg-file-lenex" };
  if (ext === "lxf") return { icon: "archive", colorClass: "bg-file-lenex" };
  if (ext === "zip") return { icon: "archive", colorClass: "bg-file-zip" };
  return { icon: "file", colorClass: "bg-file-other" };
}
