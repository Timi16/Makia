import { FastifyReply, FastifyRequest } from "fastify";
import { UserRole } from "@prisma/client";

import { AppError } from "./errorHandler";
import { authGuard } from "./authGuard";

export async function adminGuard(request: FastifyRequest, reply: FastifyReply) {
  await authGuard(request, reply);

  if (request.user.role !== UserRole.ADMIN) {
    throw new AppError(403, "Admin access required");
  }
}
