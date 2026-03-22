import { FastifyInstance } from "fastify";
import { z } from "zod";

import { withUserRls } from "../lib/rls";
import { AppError } from "../middleware/errorHandler";
import { authGuard } from "../middleware/authGuard";

const paramsSchema = z.object({
  id: z.uuid(),
});

const createBookSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  coverUrl: z.url().optional(),
  genre: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

const updateBookSchema = createBookSchema.partial().refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  {
    message: "At least one field is required",
  }
);

export async function bookRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authGuard);

  app.get("/", async (request) => {
    return withUserRls(request.user.id, async (tx) =>
      tx.book.findMany({
        orderBy: { updatedAt: "desc" },
      })
    );
  });

  app.post("/", async (request, reply) => {
    const body = createBookSchema.parse(request.body);

    const book = await withUserRls(request.user.id, async (tx) =>
      tx.book.create({
        data: {
          ...body,
          tags: body.tags ?? [],
          userId: request.user.id,
        },
      })
    );

    return reply.status(201).send(book);
  });

  app.get("/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const book = await withUserRls(request.user.id, async (tx) =>
      tx.book.findUnique({
        where: { id },
      })
    );

    if (!book) {
      throw new AppError(404, "Book not found");
    }

    return book;
  });

  app.patch("/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const body = updateBookSchema.parse(request.body);

    return withUserRls(request.user.id, async (tx) => {
      const existingBook = await tx.book.findUnique({
        where: { id },
      });

      if (!existingBook) {
        throw new AppError(404, "Book not found");
      }

      return tx.book.update({
        where: { id },
        data: {
          ...body,
          tags: body.tags ?? existingBook.tags,
        },
      });
    });
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);

    await withUserRls(request.user.id, async (tx) => {
      const existingBook = await tx.book.findUnique({
        where: { id },
      });

      if (!existingBook) {
        throw new AppError(404, "Book not found");
      }

      await tx.book.delete({
        where: { id },
      });
    });

    return reply.status(204).send();
  });
}
