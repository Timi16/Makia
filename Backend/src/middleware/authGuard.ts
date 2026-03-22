import { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "./errorHandler";
import { authService } from "../services/authService";

export async function authGuard(request: FastifyRequest, _reply: FastifyReply) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(401, "Missing bearer token");
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new AppError(401, "Missing bearer token");
  }

  request.user = authService.verifyAccessToken(token);
}
