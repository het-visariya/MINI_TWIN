import dns from "node:dns";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolConfig } from "pg";

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
/**
 * A DNS lookup that keeps working when the resolver blinks.
 *
 * Diagnosed rather than guessed. Connections to the Supabase pooler failed in
 * bursts lasting minutes, surfacing as
 * `Connection terminated due to connection timeout` — which reads as "the
 * database is down". It was not: Postgres sat idle and healthy throughout,
 * and raw TCP to the pooler succeeded 5 times out of 5. What failed was the
 * name lookup:
 *
 *     DNS: FAIL ECONNREFUSED
 *     raw TCP to :5432 -> 5 ok, 0 failed
 *
 * The local resolver was refusing queries. With no address there is nothing
 * to connect to, so every query in that window failed, and an app that looks
 * broken for two minutes at a time is indistinguishable from one that is.
 *
 * So the last good address for a host is remembered and used when resolution
 * fails. This cannot mask a genuinely moved endpoint for long — the entry
 * expires — and a first lookup that fails still fails, because there is
 * nothing to fall back to. It only covers the case it was built for: a host
 * that resolved a minute ago and would resolve again if asked twice.
 */
const DNS_CACHE_MS = 5 * 60 * 1000;

const dnsCache = new Map<string, { address: string; family: number; at: number }>();

function cachedLookup(
  hostname: string,
  options: dns.LookupOneOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
): void {
  dns.lookup(hostname, options, (error, address, family) => {
    if (!error && address) {
      dnsCache.set(hostname, { address, family, at: Date.now() });
      callback(null, address, family);
      return;
    }

    const cached = dnsCache.get(hostname);

    if (cached && Date.now() - cached.at < DNS_CACHE_MS) {
      console.warn(
        `[db] DNS lookup for ${hostname} failed (${error?.code ?? "unknown"}); using the address cached ${Math.round(
          (Date.now() - cached.at) / 1000,
        )}s ago.`,
      );

      callback(null, cached.address, cached.family);
      return;
    }

    callback(error, "", 0);
  });
}

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
   * The pool is constructed here rather than left to PrismaPg's config
   * overload, because `lookup` is a pg option the adapter's own types do not
   * surface. PrismaPg accepts a ready-made Pool, which is the supported way
   * to reach the rest of pg's configuration.
   */
  /*
   * `lookup` is passed straight through to net.connect by pg, but it is
   * declared on ClientConfig and not on PoolConfig — a gap in the typings
   * rather than in the behaviour. Widened here, narrowly, so the rest of the
   * object keeps its types.
   */
  const poolConfig: PoolConfig & { lookup?: typeof cachedLookup } = {
    connectionString,

    /* Sized against this app's widest fan-out -- see the note above. */
    max: 10,

    /* Retire idle sockets before the pooler does, and keep live ones alive.
       Supavisor closes connections it considers idle; our pool does not find
       out, and hands the next request a socket the far end has already shut,
       which surfaces as "Connection terminated unexpectedly". */
    idleTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5_000,

    /* Long enough to ride out a brief burst, short enough that a genuinely
       exhausted pool says so instead of hanging the request. */
    connectionTimeoutMillis: 10_000,

    /* Survives a resolver that intermittently refuses queries -- see above. */
    lookup: cachedLookup,
  };

  const client = new PrismaClient({ adapter: new PrismaPg(new Pool(poolConfig)) });

  globalForPrisma.prismaCache = { client, connectionString };
  return client;
}

/** True when the app is configured to talk to a database at all. */
export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
