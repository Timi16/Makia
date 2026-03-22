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
