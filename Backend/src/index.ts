import "dotenv/config";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";

import { exportQueue } from "./jobs/exportQueue";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";
import { registerErrorHandler } from "./middleware/errorHandler";
import { registerRateLimiter } from "./middleware/rateLimiter";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { bookRoutes } from "./routes/books";
import { chapterRoutes } from "./routes/chapters";
import { exportRoutes } from "./routes/export";
import { storageRoutes } from "./routes/storage";
import { registerRealtimeServer } from "./ws/realtimeServer";

const DEFAULT_PORT = 4000;

function parseAllowedOrigins() {
  const raw = process.env.FRONTEND_ORIGIN;

  if (!raw || raw.trim().length === 0) {
    return null;
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export async function buildServer() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  const allowedOrigins = parseAllowedOrigins();

  await app.register(cookie);
  await app.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    origin: (origin, callback) => {
      if (!allowedOrigins || !origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.includes(origin));
    },
  });
  await registerRateLimiter(app);

  app.get("/health", async () => ({
    status: "ok",
  }));

  app.get("/ready", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();

      return {
        status: "ready",
      };
    } catch (error) {
      app.log.error(error, "Readiness check failed");

      return reply.status(503).send({
        status: "not_ready",
      });
    }
  });

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(bookRoutes, { prefix: "/api/books" });
  await app.register(chapterRoutes, { prefix: "/api" });
  await app.register(storageRoutes, { prefix: "/api/storage" });
  await app.register(exportRoutes, { prefix: "/api/export" });
  await registerRealtimeServer(app);

  app.addHook("onClose", async () => {
    await Promise.allSettled([prisma.$disconnect(), exportQueue.close(), redis.quit()]);
  });

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
