import { MEMBERSHIP_ROLE_LABELS, USER_LEVEL_LABELS } from "@bsv-sws/shared";
import { requireUser } from "@/lib/auth/current-user";

export default async function InternalHomePage() {
  const user = await requireUser("/intern");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Intern</h1>
      <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="font-medium">Angemeldet als</dt>
        <dd>{user.email}</dd>
        <dt className="font-medium">Benutzerebene</dt>
        <dd>{USER_LEVEL_LABELS[user.level]}</dd>
        <dt className="font-medium">Verein</dt>
        <dd>
          {user.membership
            ? `${user.membership.club.name} (${MEMBERSHIP_ROLE_LABELS[user.membership.role]})`
            : "Keine Vereinszugehörigkeit"}
        </dd>
      </dl>
    </div>
  );
}
