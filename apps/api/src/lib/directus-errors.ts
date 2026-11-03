/** Helpers to interpret errors thrown by the Directus SDK. */

interface DirectusErrorShape {
  errors?: { message?: string; extensions?: { code?: string; field?: string } }[];
  response?: { status?: number };
}

export function directusErrorCode(error: unknown): string | undefined {
  return (error as DirectusErrorShape)?.errors?.[0]?.extensions?.code;
}

/** Returns the field name if the error is a unique-constraint violation. */
export function uniqueViolationField(error: unknown): string | undefined {
  const first = (error as DirectusErrorShape)?.errors?.[0];
  return first?.extensions?.code === "RECORD_NOT_UNIQUE"
    ? (first.extensions.field ?? "")
    : undefined;
}

export function isNotFoundOrForbidden(error: unknown): boolean {
  const status = (error as DirectusErrorShape)?.response?.status;
  return status === 403 || status === 404;
}
