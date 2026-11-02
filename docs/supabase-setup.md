# Supabase setup

What this project uses Supabase for, what is already done, and the two values
you still have to copy out of the dashboard by hand.

---

## 0. The short version

The project **already exists**. It was created through the Supabase MCP, so you
do not need to create one:

| | |
|---|---|
| Project name | `digital-twin` |
| Reference | `vbvhlalfjmlhvtendicx` |
| Region | `ap-south-1` (Mumbai) |
| Organisation | WorkHolic (free plan) |
| Project URL | `https://vbvhlalfjmlhvtendicx.supabase.co` |
| Dashboard | https://supabase.com/dashboard/project/vbvhlalfjmlhvtendicx |

Already done for you:

- Project provisioned and healthy.
- Private Storage bucket `meal-photos` created (2 MB cap, JPEG/PNG/WebP only).

Still needed from you — **two values, one dashboard visit**: the database
password and the `service_role` key. [Section 3](#3-the-two-values-you-must-copy)
has the exact clicks.

---

## 1. Which auth we use, and why

**Supabase is the Postgres host and the file store. It is not the identity
provider.** Authentication stays on Better Auth.

This was a real fork in the road, so here is the reasoning rather than just the
verdict.

Better Auth is not a thin wrapper in this codebase. It carries:

- the **age gate**, enforced in `databaseHooks.user.create.before` in
  `src/lib/auth/auth.ts`, so that every path that can create a user — our own
  `createAccount` action, Better Auth's `/sign-up/email`, and the Google OAuth
  callback — has to pass the same check, and fails closed without a valid
  date-of-birth cookie;
- **database-backed rate limits** with per-endpoint rules for sign-in, sign-up,
  password reset and verification resend;
- email verification with `requireEmailVerification`;
- the **demo-aware viewer model** in `src/lib/auth/session.ts`
  (`requireUser` / `requireViewer`), which is what lets demo mode behave like a
  real account while writing nothing.

Moving to Supabase Auth would mean rewriting all of that and re-deriving the
age gate on a new set of hooks. The usual reason to pay that cost is Row Level
Security — and **this app cannot benefit from RLS**. Prisma connects as the
table owner over a Postgres connection string, not as `authenticated` with a
user JWT, so `auth.uid()` is `null` on every query and an `auth.uid() = user_id`
policy would never match. RLS here would be inert, not protective.

So the boundary that actually protects user data is the one the app already
has: **every query is scoped by `userId` in the repo layer**, and no query runs
without one.

### What this means in practice

- `auth.uid()` is always `null`. Do not write policies that depend on it.
- The `meal-photos` bucket is **private with no `anon` or `authenticated`
  grant at all**. There is no policy to get wrong.
- Every photo read and write goes through our own server with the
  `service_role` key, which bypasses RLS by design. Object paths are built as
  `{userId}/{mealPhotoId}.jpg` from the **verified session user**, never from
  anything the client sends.
- The browser never receives a Supabase credential. `NEXT_PUBLIC_SUPABASE_URL`
  and `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist in `.env.example` for a possible
  future client-upload path and are unused today.

---

## 2. Why one connection string and not a pooled/direct pair

A common Supabase + Prisma setup points `DATABASE_URL` at the transaction
pooler (port 6543) and `DIRECT_URL` at a direct connection (5432), because the
transaction pooler cannot run migrations.

**That split is not available in Prisma 7.** Prisma 7 moved the datasource into
`prisma7.config.ts`, and its `Datasource` type is exactly:

```ts
type Datasource = { url?: string; shadowDatabaseUrl?: string };
```

There is no `directUrl`. A 6543 `DATABASE_URL` would therefore need a direct
URL that Prisma 7 has nowhere to read from.

So this project uses **one** connection string: the **session pooler on port
5432**, which serves the running app *and* migrations. It is also IPv4, whereas
the direct `db.<ref>.supabase.co:5432` host is IPv6-only unless you buy the
IPv4 add-on.

If the app ever outgrows the session pooler, the move is to Prisma Accelerate
or a 6543 URL plus a migration step that uses its own connection — not a
`DIRECT_URL` env var.

---

## 3. The two values you must copy

These cannot be read through the MCP or any API — Supabase only ever shows them
in the dashboard. Everything else is already configured.

### 3a. Database password → `DATABASE_URL`

The password was generated when the project was created and never surfaced, so
it has to be reset once.

1. Open **https://supabase.com/dashboard/project/vbvhlalfjmlhvtendicx/settings/database**
2. Under **Database password**, click **Reset database password**.
3. Click **Generate a password**, then **copy it** — this is the only time it
   is shown.
4. On the same page find **Connection string** → the **Session pooler** tab
   (port **5432**, host `aws-1-ap-south-1.pooler.supabase.com`).
5. Copy that URI and replace `[YOUR-PASSWORD]` with the password from step 3.

Put the result in `.env`:

```
DATABASE_URL=postgresql://postgres.vbvhlalfjmlhvtendicx:<password>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

> Use the **Session pooler** tab, not Transaction pooler (6543) and not Direct
> connection. See [section 2](#2-why-one-connection-string-and-not-a-pooleddirect-pair).

### 3b. `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

1. Open **https://supabase.com/dashboard/project/vbvhlalfjmlhvtendicx/settings/api-keys**
2. Find **`service_role`** and click **Reveal**, then copy it.

```
SUPABASE_SERVICE_ROLE_KEY=<the service_role key>
SUPABASE_URL=https://vbvhlalfjmlhvtendicx.supabase.co
```

> This key bypasses RLS and is a full-access credential. It is server-side only
> — never prefix it with `NEXT_PUBLIC_`, never log it, never commit it. `.env`
> is gitignored (`.gitignore:34`); keep it that way.

### 3c. The rest of `.env`

```
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<openssl rand -base64 32>
CRON_SECRET=<openssl rand -base64 32>
```

---

## 4. Apply the schema

Once `DATABASE_URL` is set:

```bash
npx prisma migrate deploy   # apply existing migrations
npx prisma generate         # regenerate the client
npx tsx prisma/seed.ts      # reference data: the Food table
```

For a from-scratch rebuild during development:

```bash
npx prisma migrate reset    # drops, re-applies every migration, then seeds
```

This also resolves the earlier **`rateLimit` error**. That was never a schema
bug — `rate_limit` is defined in `prisma/migrations/0_init/migration.sql:84`
with its unique index on `key`. Better Auth's database-backed rate limiter was
querying a table that did not exist because the migrations had never been
applied to a live database. Applying them fixes it.

---

## 5. Auth settings in the dashboard

Better Auth issues its own sessions, so **Supabase Auth is unused** and its
settings do not affect sign-in. You do not need to enable Email auth or set a
Site URL for this app to work.

The redirect URLs that matter are Better Auth's, driven by `BETTER_AUTH_URL`:

- development: `http://localhost:3000`
- production: your deployed origin

### Google sign-in (optional, off by default)

The Google button is hidden unless both variables are set, so the app runs
fine without them.

1. https://console.cloud.google.com/apis/credentials → **Create credentials** →
   **OAuth client ID** → **Web application**.
2. Authorised redirect URI: `${BETTER_AUTH_URL}/api/auth/callback/google`
   (e.g. `http://localhost:3000/api/auth/callback/google`).
3. Put the client ID and secret in `.env`:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Note the age gate still applies: the Google callback goes through the same
`databaseHooks.user.create.before` check, so a Google sign-up with no valid
date-of-birth cookie is refused like any other.

---

## 6. Storage: the `meal-photos` bucket

Already created. For reference, this is what it is:

| Setting | Value |
|---|---|
| Name | `meal-photos` |
| Public | **no** |
| Size limit | 2 MB (clients compress to ~1.5 MB first) |
| MIME types | `image/jpeg`, `image/png`, `image/webp` |
| Policies | **none** — deliberately |

It was created with:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 2097152,
        array['image/jpeg','image/png','image/webp']);
```

There are no `anon`/`authenticated` policies because there is no Supabase JWT
to match against — see [section 1](#1-which-auth-we-use-and-why). Access control
is: the server resolves the session user, builds the path from that user's id,
and uses the service-role key. A leaked object path grants nothing, because the
bucket is private and reads are short-lived signed URLs.

---

## 7. Free-plan limits worth knowing

The WorkHolic org is on the **free plan**, which allows a limited number of
active projects — `oasis-whatsapp-dev` is active and `eduvest` is paused
alongside this one.

A free project is **paused automatically after about a week of inactivity**.
A paused project's database refuses connections, which shows up as connection
errors from Prisma rather than anything obviously Supabase-shaped. Restore it
from the dashboard, or ask me to call the MCP's `restore_project`.

Free-plan storage and egress are capped; meal photos are small and capped at
2 MB each, so this is not a near-term concern.
