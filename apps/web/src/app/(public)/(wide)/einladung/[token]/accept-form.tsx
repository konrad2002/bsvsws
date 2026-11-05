"use client";

import { Button } from "@bsv-sws/ui/components/button";
import { Alert } from "@bsv-sws/ui/components/form";
import { useActionState } from "react";
import { acceptAction } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptAction.bind(null, token), {});
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? "Wird angenommen …" : "Einladung annehmen"}
      </Button>
    </form>
  );
}
