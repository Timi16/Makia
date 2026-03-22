import "dotenv/config";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";

import { registerErrorHandler } from "./middleware/errorHandler";
import { registerRateLimiter } from "./middleware/rateLimiter";

const DEFAULT_PORT = 4000;

export async function buildServer() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  await app.register(cookie);
  await app.register(cors, {
    credentials: true,
    origin: process.env.FRONTEND_ORIGIN ?? true,
  });
  await registerRateLimiter(app);

  registerErrorHandler(app);

  return app;
}

async function start() {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const host = "0.0.0.0";

  try {
    await app.listen({ host, port });
  } catch (error) {
    app.log.error(error, "Failed to start server");
    process.exit(1);
  }
}

if (require.main === module) {
  void start();
}
