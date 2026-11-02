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
/**
 * The cached client is stored next to the connection string it was built from.
 *
 * Without that second field the cache is unconditional, and editing
 * DATABASE_URL in .env does not take effect: Next reloads the env and
 * `process.env` updates, but the adapter has already captured the old string,
 * so every query keeps going to the previous database until the dev server is
 * restarted. That failed as
 * `(ENOTFOUND) tenant/user postgres.<old-ref> not found` long after .env had
 * been corrected, which points at the database rather than at the cache and
 * costs an hour to track down. Comparing the string makes the stale client
 * impossible instead of merely unlikely.
 */
/*
 * A distinct key from the plain `prisma` one this module used to set. The dev
 * server keeps `globalThis` across a hot reload, so after an edit the old key
 * can still hold a value in the previous shape — a bare client rather than
 * this record. Reading that as the new shape yields `undefined.$disconnect()`,
 * which surfaces as an unrelated-looking signup failure. A new key cannot
 * collide with the old value, and the old one is simply left to be collected.
 */
const globalForPrisma = globalThis as unknown as {
  prismaCache?: { client: PrismaClient; connectionString: string };
};

export function getPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in, or use demo mode (/demo), which never reads the database.",
    );
  }

  const cached = globalForPrisma.prismaCache;

  /* Guarded on `client` as well as the string: a half-written or
     differently-shaped cache must fall through to building a fresh client
     rather than throwing from inside the accessor every caller depends on. */
  if (cached?.client && cached.connectionString === connectionString) {
    return cached.client;
  }

  /* The old pool is closed rather than abandoned, so repeated edits to
     DATABASE_URL cannot leak a pool per edit. Best-effort: a failure to close
     the previous client must not stop the new one being created. */
  if (cached?.client) {
    void Promise.resolve(cached.client.$disconnect()).catch(() => {});
  }

  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString,

      /* Bounded well below pg's default of 10.

         This app talks to Supabase through Supavisor, which has its own cap on
         *client* connections per project — a limit reached long before
         Postgres itself runs out of backends. A dev server that hot-reloads
         for hours can hold several pools at once, and the symptom when those
         slots run out is not a clear pool error but an intermittent
         `Can't reach database server`, which looks like a network fault and
         sends you debugging the wrong thing. Five is ample for one instance
         and leaves room for migrations, a second dev server and psql. */
      max: 5,

      /* Don't hold idle sockets open against the pooler any longer than a
         request burst needs them. */
      idleTimeoutMillis: 10_000,

      /* Fail fast rather than hanging a request for the pg default. */
      connectionTimeoutMillis: 15_000,
    }),
  });

  globalForPrisma.prismaCache = { client, connectionString };
  return client;
}

/** True when the app is configured to talk to a database at all. */
export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
