import IORedis from "ioredis";

declare global {
  var redis: IORedis | undefined;
}

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis =
  globalThis.redis ??
  new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.redis = redis;
}
