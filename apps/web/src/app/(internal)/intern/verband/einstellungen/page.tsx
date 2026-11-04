import type { Metadata } from "next";
import { SettingsForm } from "@/components/internal/admin/settings-form";
import { NoAccess } from "@/components/internal/notices";
import { requireUser } from "@/lib/auth/current-user";
import { getSettings } from "@/lib/data/admin";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const user = await requireUser("/intern/verband/einstellungen");
  if (user.level !== "federation" && user.level !== "administrator") return <NoAccess />;
  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        {settings.updatedAt && (
          <p className="text-sm text-neutral-600">
            Zuletzt geändert: {formatDateTime(settings.updatedAt)}
          </p>
        )}
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
