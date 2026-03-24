import "dotenv/config";

import { createExportWorker } from "../jobs/exportQueue";
import { exportService } from "../services/exportService";

export function startExportWorker() {
  console.log("Starting export worker...");
  const worker = createExportWorker(async (job) => exportService.processQueuedExport(job.data));

  worker.on("ready", () => {
    console.log("Export worker is ready and listening for jobs.");
  });

  worker.on("active", (job) => {
    console.log(`Processing export job ${job.id} (${job.data.format})`);
  });

  worker.on("completed", (job) => {
    console.log(`Completed export job ${job.id}`);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`Export job ${jobId ?? "unknown"} stalled`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Export job ${job?.id ?? "unknown"} failed`, error);
  });

  worker.on("error", (error) => {
    console.error("Export worker error", error);
  });

  return worker;
}

if (require.main === module) {
  startExportWorker();
}
