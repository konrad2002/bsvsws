import { Alert } from "@bsv-sws/ui/components/form";

export function NoAccess({
  children = "Dieser Bereich ist für dich nicht freigegeben.",
}: {
  children?: React.ReactNode;
}) {
  return <Alert variant="error">{children}</Alert>;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}
