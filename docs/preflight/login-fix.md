# The login failure — root cause and fix

**Symptom.** An account created three days earlier, plainly visible in the
Supabase table editor, failed to log in with *"That email and password do not
match an account."*

## Root cause

**The app could not reach the database at all.** Nothing was wrong with the
account, the password, or the data.

Supabase's connection pooler serves a certificate issued by Supabase's own
private root — `Supabase Root 2021 CA` — which is not in Node's trust store.
Our `DATABASE_URL` carried no `sslmode`, and `pg` defaults to *no TLS* when
the connection string does not ask for it. The pooler refuses a plaintext
connection, so every query failed:

```
APP PRISMA: FAILED after 10433ms
  Connection terminated due to connection timeout
```

Ten seconds is exactly the pool's `connectionTimeoutMillis`. Better Auth's
user lookup therefore returned nothing, and the login form reported the only
thing it can report when no user is found — that the email and password do not
match. **The message was accurate about what the code saw and completely
misleading about why.**

That generic message exists for a good reason: saying "no account with that
email" turns the form into a way to discover who has an account. The cost is
that a *database* failure and a *credential* failure look identical from the
outside, which is what made this take so long to find.

### What it was not

Each of these was checked and ruled out before anything was changed:

| Hypothesis | Finding |
|---|---|
| Wrong database / different project | No — `vbvhlalfjmlhvtendicx`, the correct project. `DATABASE_URL` host, port and database printed and confirmed. |
| Account was demo-mode or seed-only | No — a real row, created 2026-11-02 15:01. |
| No credential row (social-only signup) | No — `account` row exists, `providerId = credential`, password hash present. |
| Email not verified | No — `emailVerified = true`. |
| Email case/whitespace mismatch | No — stored lowercase, and the login action already trims and lowercases. |
| Hash scheme or `BETTER_AUTH_SECRET` changed | No — Better Auth hashes with scrypt, independent of the secret, and the secret is unchanged. |

The decisive test was running the *app's own* Prisma client against the test
email. It timed out while the Supabase MCP, on a different network path, read
the same row instantly.

## The fix

`DATABASE_URL` now requests TLS **and verifies it properly**:

```
...?application_name=digital_twin&sslmode=verify-full&sslrootcert=./certs/supabase-root-2021.crt
```

`certs/supabase-root-2021.crt` is Supabase's public root, valid to April 2031.
It was taken from the pooler's own certificate chain and then confirmed to be
a genuine root — self-signed, subject identical to issuer, CN matching
Supabase's published name — rather than trusted on sight.

**`verify-full`, not `no-verify`.** Disabling certificate checking would also
have worked and was the faster path. It was rejected: the connection carries
a whole student's academic, health and financial record, and `verify-full`
validates the certificate chain *and* the hostname. The app previously
verified nothing at all, because it was not negotiating TLS in the first
place, so this is strictly an improvement rather than a workaround.

Verified afterwards:

```
openssl ... -CAfile certs/supabase-root-2021.crt -verify_hostname ...
  Verification: OK
  Verify return code: 0 (ok)

APP PRISMA: OK in 1352ms
  users visible to the app : 20
  test account found       : true
  credential + hash present: true

POST /api/auth/sign-in/email  ->  HTTP 200, 200, 200
```

## Reproducing the working flow for the demo

1. `npm run build && npm run start` (the production build; the dev server is
   not what to present on).
2. Open `http://localhost:3000/login`.
3. Sign in as `hetvisariya06@gmail.com`.

The account logs in as it is — it did not need recreating, and nothing about
it was ever broken.

## Note for deployment

`sslrootcert` is a relative path, resolved from the process's working
directory. That is correct when the app is started from the project root, as
`npm run start` does. A deployment that starts the process elsewhere needs an
absolute path or the certificate bundled alongside.
