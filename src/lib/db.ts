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

  /*
   * The connection options go to PrismaPg, not to a Pool built here.
   *
   * An earlier revision constructed the Pool by hand in order to pass pg's
   * `lookup` option (a DNS cache, for a resolver that refuses queries in
   * bursts). That silently dropped the TLS configuration PrismaPg derives
   * from the connection string, and Supabase's pooler requires TLS -- so
   * every query failed as "Connection terminated due to connection timeout",
   * the same sentence the DNS outage produces, which is what made the two
   * hard to tell apart. The cache also never once fired in testing.
   *
   * A resolver that refuses queries is a machine-level problem and wants a
   * machine-level fix (point the interface at 1.1.1.1 or 8.8.8.8). Trading
   * away transport security to paper over it is not a trade worth making.
   */
  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString,

      /* Sized against this app's widest fan-out: several screens gather their
         data with one Promise.all of around nine queries, and a pool smaller
         than the fan-out queues until connectionTimeoutMillis expires. A
         too-small pool surfaces as duplicate rows, because a server action
         that hangs invites the user to press the button again. */
      max: 10,

      /* Retire idle sockets before the pooler does, and keep live ones alive.
         Supavisor closes connections it considers idle; without this the pool
         hands the next request a socket the far end has already shut. */
      idleTimeoutMillis: 10_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 5_000,

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
