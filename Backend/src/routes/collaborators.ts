import { FastifyInstance } from "fastify";
import { CollaboratorRole } from "@prisma/client";
import { z } from "zod";

import { requireBookAccess } from "../lib/bookAccess";
import { withUserRls } from "../lib/rls";
import { AppError } from "../middleware/errorHandler";
import { authGuard } from "../middleware/authGuard";
import { revokeRealtimeAccess } from "../ws/realtimeServer";

const bookParamsSchema = z.object({
  id: z.uuid(),
});

const collaboratorParamsSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
});

const roleSchema = z.enum(CollaboratorRole);

const inviteSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  role: roleSchema.default(CollaboratorRole.EDITOR),
});

const updateRoleSchema = z.object({
  role: roleSchema,
});

const userSelect = {
  id: true,
  name: true,
  email: true,
} as const;

const collaboratorSelect = {
  id: true,
  role: true,
  createdAt: true,
  user: { select: userSelect },
} as const;

function serializeCollaborator(entry: {
  id: string;
  role: CollaboratorRole;
  createdAt: Date;
  user: { id: string; name: string; email: string };
}) {
  return {
    id: entry.id,
    userId: entry.user.id,
    name: entry.user.name,
    email: entry.user.email,
    role: entry.role,
    createdAt: entry.createdAt,
  };
}

export async function collaboratorRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authGuard);

  app.get("/books/:id/collaborators", async (request) => {
    const { id } = bookParamsSchema.parse(request.params);

    return withUserRls(request.user.id, async (tx) => {
      const accessRole = await requireBookAccess(tx, id, request.user.id, "read");

      const [book, collaborators] = await Promise.all([
        tx.book.findUniqueOrThrow({
          where: { id },
          select: { user: { select: userSelect } },
        }),
        tx.bookCollaborator.findMany({
          where: { bookId: id },
          orderBy: { createdAt: "asc" },
          select: collaboratorSelect,
        }),
      ]);

      return {
        accessRole,
        owner: book.user,
        collaborators: collaborators.map(serializeCollaborator),
      };
    });
  });

  app.post("/books/:id/collaborators", async (request, reply) => {
    const { id } = bookParamsSchema.parse(request.params);
    const body = inviteSchema.parse(request.body);

    const collaborator = await withUserRls(request.user.id, async (tx) => {
      await requireBookAccess(tx, id, request.user.id, "owner");

      const invitee = await tx.user.findFirst({
        where: { email: { equals: body.email, mode: "insensitive" } },
        select: { id: true },
      });

      if (!invitee) {
        throw new AppError(404, "No account exists with that email address");
      }

      if (invitee.id === request.user.id) {
        throw new AppError(400, "You already own this book");
      }

      const entry = await tx.bookCollaborator.upsert({
        where: { bookId_userId: { bookId: id, userId: invitee.id } },
        create: {
          bookId: id,
          userId: invitee.id,
          role: body.role,
          invitedById: request.user.id,
        },
        update: { role: body.role },
        select: collaboratorSelect,
      });

      return serializeCollaborator(entry);
    });

    return reply.status(201).send(collaborator);
  });

  app.patch("/books/:id/collaborators/:userId", async (request) => {
    const { id, userId } = collaboratorParamsSchema.parse(request.params);
    const body = updateRoleSchema.parse(request.body);

    return withUserRls(request.user.id, async (tx) => {
      await requireBookAccess(tx, id, request.user.id, "owner");

      const existing = await tx.bookCollaborator.findUnique({
        where: { bookId_userId: { bookId: id, userId } },
        select: { id: true },
      });

      if (!existing) {
        throw new AppError(404, "Collaborator not found");
      }

      const entry = await tx.bookCollaborator.update({
        where: { id: existing.id },
        data: { role: body.role },
        select: collaboratorSelect,
      });

      return serializeCollaborator(entry);
    });
  });

  app.delete("/books/:id/collaborators/:userId", async (request, reply) => {
    const { id, userId } = collaboratorParamsSchema.parse(request.params);

    await withUserRls(request.user.id, async (tx) => {
      const role = await requireBookAccess(tx, id, request.user.id, "read");

      if (role !== "OWNER" && userId !== request.user.id) {
        throw new AppError(403, "Only the book owner can remove collaborators");
      }

      const existing = await tx.bookCollaborator.findUnique({
        where: { bookId_userId: { bookId: id, userId } },
        select: { id: true },
      });

      if (!existing) {
        throw new AppError(404, "Collaborator not found");
      }

      await tx.bookCollaborator.delete({ where: { id: existing.id } });
    });

    await revokeRealtimeAccess(id, userId);

    return reply.status(204).send();
  });
}
