import { FastifyInstance } from "fastify";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: unknown, request, reply) => {
    const validationError = error as { validation?: unknown };

    if (validationError.validation) {
      return reply.status(400).send({
        message: "Validation failed",
        details: validationError.validation,
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        message: error.message,
        details: error.details,
      });
    }

    request.log.error(error, "Unhandled application error");

    return reply.status(500).send({
      message: "Internal server error",
    });
  });
}
