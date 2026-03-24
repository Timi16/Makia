import { FastifyInstance } from "fastify";
import { z } from "zod";

import { authGuard } from "../middleware/authGuard";
import { exportService } from "../services/exportService";

const createExportSchema = z.object({
  bookId: z.uuid(),
  format: z.enum(["EPUB", "MOBI"]),
});

const paramsSchema = z.object({
  jobId: z.uuid(),
});

export async function exportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authGuard);

  app.post("/", async (request, reply) => {
    const body = createExportSchema.parse(request.body);
    const result = await exportService.createExportJob({
      ...body,
      userId: request.user.id,
    });

    return reply.status(202).send(result);
  });

  app.get("/:jobId/status", async (request) => {
    const { jobId } = paramsSchema.parse(request.params);

    return exportService.getExportStatus({
      jobId,
      userId: request.user.id,
    });
  });
}
