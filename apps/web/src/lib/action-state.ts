import "server-only";
import { ApiRequestError } from "./api";

/** Uniform result of form server actions (consumed with useActionState). */
export interface ActionState<T = undefined> {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  data?: T;
}

/**
 * Converts thrown API errors into displayable form state. Validation details
 * from Fastify (`z.flattenError`) become field errors. Unknown errors rethrow.
 */
export function toActionError<T = undefined>(error: unknown): ActionState<T> {
  if (error instanceof ApiRequestError) {
    const details = error.details as { fieldErrors?: Record<string, string[]> } | undefined;
    return { error: error.message, fieldErrors: details?.fieldErrors };
  }
  throw error;
}

/** Reads optional text fields from FormData ("" stays "" → API normalises to null). */
export function formText(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}
