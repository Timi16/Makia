import { Queue, Worker, type Processor } from "bullmq";

export const exportQueueName = "ebook-export";

export interface ExportQueuePayload {
  jobId: string;
  bookId: string;
  userId: string;
  format: "EPUB" | "MOBI";
}

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

function createRedisConnection() {
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    maxRetriesPerRequest: null,
    password: url.password || undefined,
    port: Number(url.port || 6379),
    username: url.username || undefined,
  };
}

export const exportQueue = new Queue<ExportQueuePayload>(exportQueueName, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5_000,
    },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

export function createExportWorker(processor: Processor<ExportQueuePayload>) {
  return new Worker<ExportQueuePayload>(exportQueueName, processor, {
    connection: createRedisConnection(),
    concurrency: 2,
  });
}
