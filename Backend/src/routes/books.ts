import { FastifyInstance } from "fastify";
import { CollaboratorRole } from "@prisma/client";
import { z } from "zod";

import { BookAccessRole, requireBookAccess } from "../lib/bookAccess";
import { withUserRls } from "../lib/rls";
import { AppError } from "../middleware/errorHandler";
import { authGuard } from "../middleware/authGuard";
import { notifyBookChanged } from "../ws/realtimeServer";

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

const bookAccessInclude = (userId: string) =>
  ({
    user: { select: { id: true, name: true, email: true } },
    collaborators: {
      where: { userId },
      select: { role: true },
      take: 1,
    },
    _count: { select: { collaborators: true } },
  }) as const;

interface BookWithAccess {
  user: { id: string; name: string; email: string };
  collaborators: { role: CollaboratorRole }[];
  _count: { collaborators: number };
  userId: string;
}

function serializeBook<T extends BookWithAccess>(book: T, userId: string) {
  const { user, collaborators, _count, ...rest } = book;
  const accessRole: BookAccessRole =
    book.userId === userId ? "OWNER" : (collaborators[0]?.role ?? "VIEWER");

  return {
    ...rest,
    owner: user,
    accessRole,
    collaboratorCount: _count.collaborators,
  };
}

export async function bookRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authGuard);

  app.get("/", async (request) => {
    const books = await withUserRls(request.user.id, async (tx) =>
      tx.book.findMany({
        orderBy: { updatedAt: "desc" },
        include: bookAccessInclude(request.user.id),
      })
    );

    return books.map((book) => serializeBook(book, request.user.id));
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
        include: bookAccessInclude(request.user.id),
      })
    );

    return reply.status(201).send(serializeBook(book, request.user.id));
  });

  app.get("/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const book = await withUserRls(request.user.id, async (tx) =>
      tx.book.findUnique({
        where: { id },
        include: bookAccessInclude(request.user.id),
      })
    );

    if (!book) {
      throw new AppError(404, "Book not found");
    }

    return serializeBook(book, request.user.id);
  });

  app.patch("/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const body = updateBookSchema.parse(request.body);

    const book = await withUserRls(request.user.id, async (tx) => {
      await requireBookAccess(tx, id, request.user.id, "owner");

      const existingBook = await tx.book.findUniqueOrThrow({
        where: { id },
        select: { tags: true },
      });

      return tx.book.update({
        where: { id },
        data: {
          ...body,
          tags: body.tags ?? existingBook.tags,
        },
        include: bookAccessInclude(request.user.id),
      });
    });

    void notifyBookChanged(id);

    return serializeBook(book, request.user.id);
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);

    await withUserRls(request.user.id, async (tx) => {
      await requireBookAccess(tx, id, request.user.id, "owner");

      await tx.book.delete({
        where: { id },
      });
    });

    return reply.status(204).send();
  });
}
