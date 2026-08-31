import { AppError } from "../middleware/errorHandler";
import { UserScopedTransaction } from "./rls";

export type BookAccessRole = "OWNER" | "EDITOR" | "VIEWER";

const WRITE_ROLES: BookAccessRole[] = ["OWNER", "EDITOR"];

/**
 * Resolves the caller's role on a book. Must run inside `withUserRls`, so a
 * book the caller cannot see resolves to `null`.
 */
export async function getBookAccess(
  tx: UserScopedTransaction,
  bookId: string,
  userId: string
): Promise<BookAccessRole | null> {
  const book = await tx.book.findUnique({
    where: { id: bookId },
    select: {
      userId: true,
      collaborators: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!book) {
    return null;
  }

  if (book.userId === userId) {
    return "OWNER";
  }

  return book.collaborators[0]?.role ?? null;
}

export function canWriteBook(role: BookAccessRole | null) {
  return role !== null && WRITE_ROLES.includes(role);
}

export async function requireBookAccess(
  tx: UserScopedTransaction,
  bookId: string,
  userId: string,
  level: "read" | "write" | "owner"
): Promise<BookAccessRole> {
  const role = await getBookAccess(tx, bookId, userId);

  if (!role) {
    throw new AppError(404, "Book not found");
  }

  if (level === "write" && !canWriteBook(role)) {
    throw new AppError(403, "You have view-only access to this book");
  }

  if (level === "owner" && role !== "OWNER") {
    throw new AppError(403, "Only the book owner can do that");
  }

  return role;
}
