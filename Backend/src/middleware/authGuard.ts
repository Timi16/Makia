import { FastifyReply, FastifyRequest } from "fastify";

export async function authGuard(_request: FastifyRequest, reply: FastifyReply) {
  return reply.status(501).send({
    message: "Authentication guard is not implemented yet",
  });
}
