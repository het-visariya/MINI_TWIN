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

      /* Sized against this app's widest fan-out, not plucked from the air.

         Several screens gather their data with a single Promise.all of around
         nine independent queries -- `gatherPulseInputs` is the widest. A pool
         smaller than that fan-out does not fail outright, it queues, and under
         any concurrency the queue outlives `connectionTimeoutMillis`. The
         symptom is "timeout exceeded when trying to connect" against a
         perfectly healthy database.

         Worse, a server action that hangs for the full timeout invites the
         user to press the button again, so a too-small pool surfaces as
         *duplicate rows*. An earlier revision of this file set 5 and did
         exactly that to the workout form: one logWorkout hung for 15s, the
         user clicked again, and the workout was logged twice.

         Ten covers the widest fan-out with headroom. The ceiling worth
         respecting is Supavisor's: in session mode each client connection
         holds a Postgres backend for its lifetime, so this cannot be raised
         freely -- but ten against max_connections of 60 leaves room for
         migrations, a second dev server and psql. */
      max: 10,

      /* Release idle sockets without churning reconnects between the several
         requests of one page load. */
      idleTimeoutMillis: 30_000,

      /* Long enough to ride out a brief burst, short enough that a genuinely
         exhausted pool says so instead of hanging the request. */
      connectionTimeoutMillis: 10_000,
    }),
  });

  globalForPrisma.prismaCache = { client, connectionString };
  return client;
}

/** True when the app is configured to talk to a database at all. */
export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
