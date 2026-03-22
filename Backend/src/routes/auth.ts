import { FastifyInstance } from "fastify";

import { clearRefreshCookie, refreshCookieName, setRefreshCookie, authService } from "../services/authService";

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (request, reply) => {
    const result = await authService.register(request.body);

    setRefreshCookie(reply, result.refreshToken);

    return reply.status(201).send(result);
  });

  app.post("/login", async (request, reply) => {
    const result = await authService.login(request.body);

    setRefreshCookie(reply, result.refreshToken);

    return reply.send(result);
  });

  app.post("/refresh", async (request, reply) => {
    const refreshToken = request.cookies[refreshCookieName];
    const result = await authService.refresh(refreshToken);

    return reply.send(result);
  });

  app.post("/logout", async (_request, reply) => {
    clearRefreshCookie(reply);

    return reply.status(204).send();
  });
}
