import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { adminGuard } from "../middleware/adminGuard";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
});

function getListWhere(search: string | undefined): Prisma.UserWhereInput | undefined {
  if (!search || search.length === 0) {
    return undefined;
  }

  return {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ],
  };
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", adminGuard);

  app.get("/overview", async () => {
    const activeSince = new Date();
    activeSince.setDate(activeSince.getDate() - 30);

    const [totalUsers, totalBooks, totalExports, newUsersLast30Days, activeUsersLast30Days] =
      await prisma.$transaction([
        prisma.user.count(),
        prisma.book.count(),
        prisma.exportJob.count(),
        prisma.user.count({
          where: {
            createdAt: {
              gte: activeSince,
            },
          },
        }),
        prisma.user.count({
          where: {
            books: {
              some: {
                updatedAt: {
                  gte: activeSince,
                },
              },
            },
          },
        }),
      ]);

    return {
      totalUsers,
      totalBooks,
      totalExports,
      newUsersLast30Days,
      activeUsersLast30Days,
    };
  });

  app.get("/users", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const where = getListWhere(query.search);
    const skip = (query.page - 1) * query.pageSize;
    const activeSince = new Date();
    activeSince.setDate(activeSince.getDate() - 30);

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: query.pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              books: true,
              exportJobs: true,
            },
          },
          books: {
            select: {
              updatedAt: true,
            },
            orderBy: {
              updatedAt: "desc",
            },
            take: 1,
          },
        },
      }),
    ]);

    return {
      items: users.map((user) => {
        const latestBookUpdate = user.books[0]?.updatedAt;
        const isActive = Boolean(latestBookUpdate && latestBookUpdate >= activeSince);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          booksCount: user._count.books,
          exportsCount: user._count.exportJobs,
          status: isActive ? "active" : "inactive",
        };
      }),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  });

  app.get("/books", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const where: Prisma.BookWhereInput | undefined =
      query.search && query.search.length > 0
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { user: { name: { contains: query.search, mode: "insensitive" } } },
              { user: { email: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : undefined;

    const [total, books] = await prisma.$transaction([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        orderBy: {
          updatedAt: "desc",
        },
        skip,
        take: query.pageSize,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              chapters: true,
              exportJobs: true,
            },
          },
        },
      }),
    ]);

    return {
      items: books.map((book) => ({
        id: book.id,
        title: book.title,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        owner: book.user,
        chaptersCount: book._count.chapters,
        exportsCount: book._count.exportJobs,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  });
}
