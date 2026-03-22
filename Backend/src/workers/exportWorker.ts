import "dotenv/config";

import { createExportWorker } from "../jobs/exportQueue";
import { exportService } from "../services/exportService";

export function startExportWorker() {
  const worker = createExportWorker(async (job) => exportService.processQueuedExport(job.data));

  worker.on("completed", (job) => {
    console.log(`Completed export job ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Export job ${job?.id ?? "unknown"} failed`, error);
  });

  return worker;
}

if (require.main === module) {
  startExportWorker();
}
