import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * One Prisma client per process, created on first use.
 *
 * Lazy on purpose: demo mode and the landing page never touch the database,
 * and `next build` evaluates every module it prerenders. Constructing the
 * client at import time would make a missing DATABASE_URL break routes that
 * do not need one.
 *
 * Next's dev server re-evaluates modules on every edit, so without the global
 * cache each save would open a fresh connection pool until Postgres refused
 * new ones.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in, or use demo mode (/demo), which never reads the database.",
    );
  }

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  globalForPrisma.prisma = client;
  return client;
}

/** True when the app is configured to talk to a database at all. */
export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
