import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

export type UserScopedTransaction = Prisma.TransactionClient;

export async function withUserRls<T>(
  userId: string,
  callback: (tx: UserScopedTransaction) => Promise<T>
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;

    return callback(tx);
  });
}

/**
 * Runs `callback` in a transaction that bypasses per-user row-level security.
 * Only for admin routes (behind adminGuard) that must see every user's data.
 */
export async function withAdminRls<T>(callback: (tx: UserScopedTransaction) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;

    return callback(tx);
  });
}
