import "fastify";

import { AuthenticatedUser } from "../services/authService";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
}
