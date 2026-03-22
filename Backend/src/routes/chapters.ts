import { FastifyInstance } from "fastify";
import { z } from "zod";

import { withUserRls } from "../lib/rls";
import { authGuard } from "../middleware/authGuard";
import { AppError } from "../middleware/errorHandler";

const bookParamsSchema = z.object({
  id: z.uuid(),
});

const chapterParamsSchema = z.object({
  id: z.uuid(),
});

const createChapterSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().default(""),
});

const updateChapterSchema = z.object({
  content: z.string(),
});

const reorderChapterSchema = z.object({
  order: z.number().int().min(1),
});

export async function chapterRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authGuard);

  app.get("/books/:id/chapters", async (request) => {
    const { id } = bookParamsSchema.parse(request.params);

    return withUserRls(request.user.id, async (tx) => {
      const book = await tx.book.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!book) {
        throw new AppError(404, "Book not found");
      }

      return tx.chapter.findMany({
        where: { bookId: id },
        orderBy: { order: "asc" },
      });
    });
  });

  app.post("/books/:id/chapters", async (request, reply) => {
    const { id } = bookParamsSchema.parse(request.params);
    const body = createChapterSchema.parse(request.body);

    const chapter = await withUserRls(request.user.id, async (tx) => {
      const book = await tx.book.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!book) {
        throw new AppError(404, "Book not found");
      }

      const aggregate = await tx.chapter.aggregate({
        where: { bookId: id },
        _max: { order: true },
      });

      return tx.chapter.create({
        data: {
          bookId: id,
          content: body.content,
          order: (aggregate._max.order ?? 0) + 1,
          title: body.title,
        },
      });
    });

    return reply.status(201).send(chapter);
  });

  app.patch("/chapters/:id", async (request) => {
    const { id } = chapterParamsSchema.parse(request.params);
    const body = updateChapterSchema.parse(request.body);

    return withUserRls(request.user.id, async (tx) => {
      const chapter = await tx.chapter.findUnique({
        where: { id },
      });

      if (!chapter) {
        throw new AppError(404, "Chapter not found");
      }

      const updatedChapter = await tx.chapter.update({
        where: { id },
        data: {
          content: body.content,
        },
      });

      await tx.chapterVersion.create({
        data: {
          chapterId: id,
          content: body.content,
        },
      });

      return updatedChapter;
    });
  });

  app.delete("/chapters/:id", async (request, reply) => {
    const { id } = chapterParamsSchema.parse(request.params);

    await withUserRls(request.user.id, async (tx) => {
      const chapter = await tx.chapter.findUnique({
        where: { id },
      });

      if (!chapter) {
        throw new AppError(404, "Chapter not found");
      }

      await tx.chapter.delete({
        where: { id },
      });

      await tx.chapter.updateMany({
        where: {
          bookId: chapter.bookId,
          order: {
            gt: chapter.order,
          },
        },
        data: {
          order: {
            decrement: 1,
          },
        },
      });
    });

    return reply.status(204).send();
  });

  app.patch("/chapters/:id/reorder", async (request) => {
    const { id } = chapterParamsSchema.parse(request.params);
    const { order: requestedOrder } = reorderChapterSchema.parse(request.body);

    return withUserRls(request.user.id, async (tx) => {
      const chapter = await tx.chapter.findUnique({
        where: { id },
      });

      if (!chapter) {
        throw new AppError(404, "Chapter not found");
      }

      const chapterCount = await tx.chapter.count({
        where: { bookId: chapter.bookId },
      });
      const nextOrder = Math.max(1, Math.min(requestedOrder, chapterCount));

      if (nextOrder === chapter.order) {
        return chapter;
      }

      await tx.chapter.update({
        where: { id },
        data: { order: 0 },
      });

      if (nextOrder < chapter.order) {
        await tx.chapter.updateMany({
          where: {
            bookId: chapter.bookId,
            order: {
              gte: nextOrder,
              lt: chapter.order,
            },
          },
          data: {
            order: {
              increment: 1,
            },
          },
        });
      } else {
        await tx.chapter.updateMany({
          where: {
            bookId: chapter.bookId,
            order: {
              gt: chapter.order,
              lte: nextOrder,
            },
          },
          data: {
            order: {
              decrement: 1,
            },
          },
        });
      }

      return tx.chapter.update({
        where: { id },
        data: {
          order: nextOrder,
        },
      });
    });
  });

  app.get("/chapters/:id/versions", async (request) => {
    const { id } = chapterParamsSchema.parse(request.params);

    return withUserRls(request.user.id, async (tx) => {
      const chapter = await tx.chapter.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!chapter) {
        throw new AppError(404, "Chapter not found");
      }

      return tx.chapterVersion.findMany({
        where: { chapterId: id },
        orderBy: { savedAt: "desc" },
        take: 20,
      });
    });
  });
}
