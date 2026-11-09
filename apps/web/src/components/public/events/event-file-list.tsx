import { Badge } from "@bsv-sws/ui/components/form";
import type { PublicEventFile } from "@bsv-sws/validation";
import { formatFileSize } from "@/lib/format";
import { fileFormat, type FileIcon } from "@/lib/file-format";

/**
 * Event files in the style of the SwimResults file list: colour-coded icon per
 * format, name, extension badge and download count. Announced files that do not
 * exist yet are greyed out and not linked.
 */
export function EventFileList({ eventId, files }: { eventId: string; files: PublicEventFile[] }) {
  return (
    <section aria-labelledby="dateien" className="flex flex-col gap-2">
      <h2 id="dateien">Dateien</h2>
      <ul className="card flex flex-col gap-1 p-2">
        {files.map((f, i) => (
          <li key={f.fileId ?? `${f.type}-${i}`}>
            <FileRow eventId={eventId} file={f} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FileRow({ eventId, file: f }: { eventId: string; file: PublicEventFile }) {
  const format = fileFormat(f.extension);
  const href = f.fileId ? `/api/events/${eventId}/files/${f.fileId}` : f.url;
  // SwimResults gives hosted files a counter; external links have none.
  const external = !f.fileId && !!f.url && f.downloads == null;
  const content = (
    <>
      <span
        aria-hidden
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-file-icon-foreground ${format.colorClass}`}
      >
        <Icon name={format.icon} className="size-5" />
      </span>
      <span className="min-w-0 flex-1 truncate group-hover:underline">{f.label}</span>
      {f.extension && (
        <Badge className="border-primary bg-primary text-primary-foreground">
          .{f.extension.toLowerCase()}
        </Badge>
      )}
      <span className="flex w-16 shrink-0 items-center justify-end gap-1 text-xs text-muted-foreground">
        {external ? (
          <Icon name="link" className="size-4" title="Externer Link" />
        ) : f.downloads ? (
          <>
            <Icon name="download" className="size-4" title="Downloads" />
            <span>
              {f.downloads}
              <span className="sr-only"> Downloads</span>
            </span>
          </>
        ) : (
          f.size != null && formatFileSize(f.size)
        )}
      </span>
    </>
  );
  const row = "flex items-center gap-3 rounded px-1 py-1 text-sm";

  if (!f.available || !href)
    return (
      <div className={`${row} text-muted-foreground opacity-50 grayscale`}>
        {content}
        <span className="sr-only">(noch nicht verfügbar)</span>
      </div>
    );
  return (
    <a
      href={href}
      className={`group ${row} text-foreground hover:bg-muted`}
      {...(f.url ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {content}
    </a>
  );
}

/** Material Symbols paths (Apache 2.0), inlined to avoid an icon dependency. */
const ICON_PATHS: Record<FileIcon | "download" | "link", string> = {
  document:
    "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
  data: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z",
  archive:
    "M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 6h-2v2h2v2h-2v2h-2v-2h2v-2h-2v-2h2v-2h-2V8h2v2h2v2z",
  file: "M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z",
  download: "M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z",
  link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
};

function Icon({
  name,
  className,
  title,
}: {
  name: keyof typeof ICON_PATHS;
  className?: string;
  title?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      {title && <title>{title}</title>}
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
