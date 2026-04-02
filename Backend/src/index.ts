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
import { authService } from "./services/authService";
import { registerRealtimeServer } from "./ws/realtimeServer";

const DEFAULT_PORT = 4000;

type OriginRule =
  | {
      type: "any";
    }
  | {
      type: "exact";
      origin: string;
    }
  | {
      type: "host";
      host: string;
    }
  | {
      type: "wildcardHost";
      protocol: "http:" | "https:" | null;
      hostSuffix: string;
    };

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

function parseOriginRule(value: string): OriginRule | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed === "*") {
    return { type: "any" };
  }

  const wildcardMatch = trimmed.match(/^(https?:\/\/)?\*\.(.+)$/i);
  if (wildcardMatch) {
    const rawProtocol = wildcardMatch[1]?.toLowerCase();
    const protocol =
      rawProtocol === "http://"
        ? "http:"
        : rawProtocol === "https://"
          ? "https:"
          : null;
    const hostSuffix = wildcardMatch[2].replace(/\/+$/, "").toLowerCase();

    if (hostSuffix.length > 0) {
      return {
        type: "wildcardHost",
        protocol,
        hostSuffix,
      };
    }
  }

  if (!trimmed.includes("://") && /^[a-z0-9.-]+(?::\d+)?$/i.test(trimmed)) {
    return {
      type: "host",
      host: trimmed.toLowerCase(),
    };
  }

  const normalized = normalizeOrigin(trimmed);
  if (!normalized) {
    return null;
  }

  return {
    type: "exact",
    origin: normalized,
  };
}

function parseAllowedOrigins() {
  const raw = process.env.FRONTEND_ORIGIN;

  if (!raw || raw.trim().length === 0) {
    return null;
  }

  const rules = raw
    .split(",")
    .map((value) => parseOriginRule(value))
    .filter((value): value is OriginRule => value !== null);

  return rules.length > 0 ? rules : null;
}

function isAllowedOrigin(origin: string, rules: OriginRule[]) {
  let parsedOrigin: URL | null = null;
  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  for (const rule of rules) {
    if (rule.type === "any") {
      return true;
    }

    if (rule.type === "exact" && normalizedOrigin === rule.origin) {
      return true;
    }

    if (rule.type === "host" || rule.type === "wildcardHost") {
      if (!parsedOrigin) {
        try {
          parsedOrigin = new URL(normalizedOrigin);
        } catch {
          return false;
        }
      }
    }

    if (rule.type === "host" && parsedOrigin && parsedOrigin.host.toLowerCase() === rule.host) {
      return true;
    }

    if (rule.type === "wildcardHost" && parsedOrigin) {
      if (rule.protocol && parsedOrigin.protocol !== rule.protocol) {
        continue;
      }

      const hostname = parsedOrigin.hostname.toLowerCase();
      if (hostname.endsWith(`.${rule.hostSuffix}`)) {
        return true;
      }
    }
  }

  return false;
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
    allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
    origin: (origin, callback) => {
      if (!allowedOrigins || !origin) {
        callback(null, true);
        return;
      }

      const allowed = isAllowedOrigin(origin, allowedOrigins);

      if (!allowed) {
        app.log.warn(
          {
            origin,
            configuredOrigins: process.env.FRONTEND_ORIGIN,
          },
          "CORS origin blocked"
        );
      }

      callback(null, allowed);
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
    const defaultAdmin = await authService.ensureDefaultAdmin();
    if (defaultAdmin) {
      app.log.info(
        {
          email: defaultAdmin.email,
          password: defaultAdmin.password,
          created: defaultAdmin.created,
          usingFallback: defaultAdmin.usingFallback,
        },
        "Default admin is ready"
      );
    }

    await app.listen({ host, port });
  } catch (error) {
    app.log.error(error, "Failed to start server");
    process.exit(1);
  }
}

if (require.main === module) {
  void start();
}
