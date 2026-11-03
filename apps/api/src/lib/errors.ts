import type { FastifyError, FastifyInstance } from "fastify";
import { z } from "zod";

/**
 * Application error with a stable machine-readable code. All API errors are
 * rendered as `{ error: { code, message, details? } }` (see apiErrorSchema).
 * Messages are German because they may be shown to users.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = (message = "Bitte melde dich an.") =>
  new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Dafür fehlt dir die Berechtigung.", code = "FORBIDDEN") =>
  new AppError(403, code, message);
export const notFound = (message = "Nicht gefunden.") => new AppError(404, "NOT_FOUND", message);
export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
export const gone = (code: string, message: string) => new AppError(410, code, message);
export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const validationError = (error: z.ZodError) =>
  new AppError(400, "VALIDATION_ERROR", "Die Eingaben sind ungültig.", z.flattenError(error));

/** Parses external input with Zod, throwing a uniform 400 on failure. */
export function parseInput<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .code(error.statusCode)
        .send({ error: { code: error.code, message: error.message, details: error.details } });
    }
    const status = error.statusCode ?? 500;
    if (status >= 500) request.log.error(error);
    const message =
      status === 429
        ? "Zu viele Anfragen. Bitte versuche es später erneut."
        : status >= 500
          ? "Interner Fehler."
          : error.message;
    return reply.code(status).send({
      error: {
        code:
          status === 429
            ? "RATE_LIMITED"
            : status >= 500
              ? "INTERNAL_ERROR"
              : (error.code ?? "BAD_REQUEST"),
        message,
      },
    });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Nicht gefunden." } }),
  );
}
