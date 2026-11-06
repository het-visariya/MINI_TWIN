# Go / no-go — presentation

Verified against the **production build** (`npm run build && npm start`), not
the dev server. Everything below was observed, not assumed; where something
was not verified it says so.

## Verified

| | Check | Evidence |
|---|---|---|
| ✅ | Production build clean | `Compiled successfully` |
| ✅ | `tsc --noEmit`, `npm run lint` | 0 errors, 0 warnings |
| ✅ | Unit tests | 100 passing |
| ✅ | **The 3-day-old account logs in** | `POST /api/auth/sign-in/email` → 200, 200, 200; and through the UI |
| ✅ | Signed out, `/home` → `/login` | `/login?next=%2Fhome` |
| ✅ | Home greets by name | "Good evening, Het" |
| ✅ | All seven modules load signed in | nutrition, health, finance, productivity, goals, insights, twin |
| ✅ | No `NaN` / `Invalid Date` / `undefined` on Home | |
| ✅ | One live `<canvas>`, dotted globe, no white box | |
| ✅ | ⌘J / Ctrl+J opens Jarvis | focus trapped, Esc closes |
| ✅ | Notification bell present | |
| ✅ | **Demo mode writes nothing** | users 20→20, meals 3→3, tasks 2→2 after browsing three modules |
| ✅ | Zero console errors on the golden path | 14/14 checks, 0 errors |
| ✅ | No `prisma.` in `src/app` or `src/components` | every read through `repo.forUser(userId)` |
| ✅ | Gemini key server-side only | no `NEXT_PUBLIC_` prefix, never imported by a client component |
| ✅ | TLS verified end to end | `verify-full` against Supabase's pinned root, `Verify return code: 0` |

## Known risks, with what to do

**1. Gemini returns 503 intermittently.** `gemini-3.5-flash` answered 200 on
one call and 503 "model overloaded" on the next, minutes apart. Nothing in
our code can fix a busy model. 503 is retried twice automatically, and a
failure shows a written message rather than a crash — but **the twin may
decline to answer on stage.**

*On the day:* ask the twin something early, before the audience is watching.
If it 503s, carry on and come back to it; the rest of the app is unaffected.

**2. The demo account has almost no data.** The twin's last real answers were
honest about it — *"I don't have enough data to give you a full picture yet.
You have 13.5 hours free today with 0 hours planned, but no tasks, attendance
or pulse scores recorded."* That is the designed behaviour and it is good
behaviour, but it is a thin demo.

*Strongly recommended:* spend ten minutes adding a few tasks, a subject with
attendance, one workout and one expense before presenting. The twin then has
numbers to reason about and the "numbers used" chips have something to show.

**3. Chat latency.** A tool-using answer costs roughly 5s per round. Bounded
at 45s total, after which it stops and says so. Typical answers should land
in 10–20s. **Do not ask it something while silent and waiting** — type the
question, say what you expect it to do, then let it answer.

**4. The campus DNS resolver (`10.160.2.99`) refuses queries in bursts.**
Observed failing and recovering repeatedly. When it fails, nothing reaches
Supabase.

*Before presenting:* set the Wi-Fi DNS to `1.1.1.1` or use a phone hotspot.
This is the single highest-value thing to do, and it is a two-minute
Windows setting.

## Not verified

- **Create/edit persistence across logout/login in every module.** The write
  layer is covered by integration tests against the live database (tasks,
  commitments, goals: create, reschedule, complete, rebuild, undo, plus
  cross-user isolation), but the full click-through in each module's UI was
  not completed before time ran out.
- **A bad-key failure path for Gemini in the browser.** The code path returns
  a written message and the composer keeps the user's text, but this was not
  exercised live.

## The fallback that always works

`/demo` needs **no database and no AI**. Verified: `/demo`, `/home`,
`/nutrition`, `/twin` all return 200 and write nothing. If anything at all
goes wrong with the network, the database or Gemini, open `/demo` and
present the whole product from sample data.

**Have a second tab open on `/demo` before you start.**

## Demo script

Start the server first — the **production** build, not `next dev`:

```bash
npm run build
npm start
```

1. `/login` → sign in as `hetvisariya06@gmail.com`.
2. **Home** — the dotted twin, "Good evening, Het", today's one thing, the
   pulse scores.
3. **Nutrition** — log a meal by typing "2 rotis and dal"; show the parsed
   rows and that nothing saves until confirmed.
4. **Press ⌘J** anywhere — Jarvis opens over the page, greets from the
   snapshot with no AI call, the Home canvas pauses behind it.
5. Ask the twin *"How many hours free do I have today?"* — watch the tool
   chips and the streamed answer; point out the "numbers used" chips.
6. Ask *"Push my lab report deadline to Friday"* — an Apply / Decline card
   appears. **Apply**, then show the task actually moved, then **Undo** from
   the toast.
7. **Settings → Privacy** — the consent log showing what was sent to the AI.
8. Fallback at any point: `/demo`.

Steps 5 and 6 are the ones that depend on Gemini. If it is having a bad
minute, say what the twin would do and move on; everything else is local.
