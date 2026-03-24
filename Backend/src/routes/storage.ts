import { FastifyInstance } from "fastify";
import { z } from "zod";

import { authGuard } from "../middleware/authGuard";
import { storageService } from "../services/storageService";

const presignSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(255),
  bookId: z.uuid(),
  assetKind: z.enum(["cover", "image", "file"]).optional(),
});

const confirmSchema = z.object({
  s3Key: z.string().min(1),
  bookId: z.uuid(),
  fileType: z.string().min(1).max(255),
  assetKind: z.enum(["cover", "image", "file"]).optional(),
});

export async function storageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authGuard);

  app.post("/presign", async (request) => {
    const body = presignSchema.parse(request.body);

    return storageService.createPresignedUpload({
      ...body,
      userId: request.user.id,
    });
  });

  app.post("/confirm", async (request) => {
    const body = confirmSchema.parse(request.body);

    return storageService.confirmUpload({
      ...body,
      userId: request.user.id,
    });
  });
}
