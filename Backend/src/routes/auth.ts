import { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";

import {
  clearRefreshCookie,
  refreshCookieName,
  setRefreshCookie,
  authService,
} from "../services/authService";

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (request, reply) => {
    const result = await authService.register(request.body);

    setRefreshCookie(reply, result.refreshToken);

    return reply.status(201).send(result);
  });

  app.post("/login", async (request, reply) => {
    const result = await authService.login(request.body, {
      expectedRole: UserRole.USER,
    });
    setRefreshCookie(reply, result.refreshToken);

    return reply.send(result);
  });

  app.post("/admin/login", async (request, reply) => {
    const body = request.body as Record<string, string> | null | undefined;

    const input = {
      usernameOrEmail: body?.usernameOrEmail ?? "admin@makia.local",
      password: body?.password ?? "admin123456",
    };

    const result = await authService.adminLogin(input); // ← was authService.login()

    setRefreshCookie(reply, result.refreshToken);

    return reply.send(result);
  });

  app.post("/refresh", async (request, reply) => {
    const refreshToken = request.cookies[refreshCookieName];
    const result = await authService.refresh(refreshToken);
    setRefreshCookie(reply, result.refreshToken);

    return reply.send(result);
  });

  app.post("/logout", async (request, reply) => {
    await authService.logout(request.cookies[refreshCookieName]);
    clearRefreshCookie(reply);

    return reply.status(204).send();
  });
}
