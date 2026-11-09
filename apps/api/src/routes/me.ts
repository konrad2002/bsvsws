import type { FastifyPluginAsync } from "fastify";
import type { AuthService } from "../modules/auth/auth-service.js";

/** GET /me – identity and authorization context of the calling user. */
export const meRoutes: FastifyPluginAsync<{ auth: AuthService }> = async (app, { auth }) => {
  app.get("/me", async (request) => auth.authenticate(request.headers.authorization));
};
