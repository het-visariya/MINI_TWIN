# MINI_TWIN (Digital Twin) — Overview & Execution Plan for Claude Code

> **Repo:** https://github.com/het-visariya/MINI_TWIN
> **Run from:** repo root, inside Claude Code.
> **This file is the single source of truth for this round of work.** Read it fully before doing anything. When this file and your own instincts disagree, follow this file. When this file and the code disagree about *what exists*, trust the code and record the difference in your handoff note.

---

## 0. How to use this document

This round of work is split across **three sub-agents that run one after another**:

| Order | Sub-agent | Owns | Starts when | Produces |
|---|---|---|---|---|
| 1 | **Builder** (`twin-builder`) | Implement every sidebar module still marked **"Soon"**, front end + back end + database, end to end | Immediately | Working modules + `docs/handoff/01-builder.md` |
| 2 | **Integrator** (`twin-integrator`) | Audit and fix every connection: Prisma ↔ Better Auth ↔ server actions ↔ UI, the broken 3D twin (white boxes), runtime/console errors, type and lint errors across the whole codebase | Builder's handoff exists and `npm run build` passes | Clean, error-free app + `docs/handoff/02-integrator.md` |
| 3 | **QA** (`twin-qa`) | Configure the testing stack from scratch and write the test suite (unit, integration, API, E2E, cross-browser, accessibility, visual) | Integrator's handoff exists and the app runs with zero console errors | Green test suite + CI + `docs/handoff/03-qa.md` + `docs/qa/test-plan.md` |

**Out of scope for this round (do NOT start):** the Phase 3 visual/IA redesign (landing rework, sidebar regrouping, merging Goals/Regreter into "Plan"), Phase 4 (Gemini-powered Ask my twin + Jarvis mode), and **all external API integrations** (Gemini, Mailjet sending, live market prices, Google OAuth credentials). For anything that needs an external API, build the **interface and a local/dev implementation now**, and leave a clearly marked adapter that switches on when the env key is present. Those integrations are the next round.

### 0.1 Rules every sub-agent follows

1. **Do not loop.** Before searching the codebase for something, check §2 (known map) and the previous agent's handoff. Use `rg` (ripgrep) with specific patterns; do not open files one by one hoping to find things. If you have searched 3 times for the same thing without success, write it down as an open question in your handoff and move on.
2. **Work in small, verifiable steps.** After each module or fix: `npm run lint && npx tsc --noEmit`. After each group of changes: `npm run build`. Never leave the repo in a non-building state at the end of a step.
3. **Keep the data boundary.** Screens only ever read through `src/lib/data/repo.ts` (or the session-scoped repo it exposes). Screens never import Prisma, never import fixtures.
4. **Every query is scoped to the signed-in user.** No query may run without a `userId` from the server-side session. Demo mode uses fixtures/in-memory data and never writes to the database.
5. **Colours only through tokens** (black base, warm greys, one lime accent `#D4F25A`). No purple, violet, indigo, blue, cyan or teal anywhere. Status is always icon + label + colour, never colour alone.
6. **Commit per logical unit** with conventional messages (`feat(health): workout logger`, `fix(twin): white canvas`, `test(e2e): onboarding`). One branch per sub-agent: `agent/01-builder`, `agent/02-integrator`, `agent/03-qa`, each branched from the previous one.
7. **Never invent data values that pretend to be real** (food macros, BMI percentile tables, prices). Use a cited source, or label the value clearly as an estimate, or show "not available".
8. **At the end, write the handoff note** using the exact template in §6. The next agent depends on it.

---

## 1. Product context (what the app is)

Digital Twin is a life OS for students and young professionals. Students use one app for the timetable, another for the gym, another for food and another for money, and none of them talk to each other. Digital Twin puts everything into one "twin" of the user. It says things like *"if you postpone this assignment, tomorrow becomes 2 hours heavier"* and lets users test decisions before making them.

Tone and safety rules that apply to every module:
- Compared only with the user's own past, never with other people.
- Calm, not gamified. No streaks that reset to zero, no spammy alerts.
- Health: not a doctor. No weight-loss targets for users under 20. Calorie estimate for adults only. If a medical condition is ticked, show a "talk to a doctor" note.
- Nutrition: not a dietitian. Regreter never nudges about food or weight.
- Finance: tracking only, not financial advice.
- Notifications and emails: neutral wording, never contain health or money details.

---

## 2. Known map of the codebase (start here, not with a blind search)

This is the state as of the last review. Verify quickly, then trust it.

**Stack:** Next.js 16.4 (App Router, `cacheComponents: true`, Turbopack), React 19.3, TypeScript, Tailwind v4 (tokens in `src/app/globals.css` `@theme inline`), shadcn/ui (Radix), `motion`, `@react-three/fiber` + `@react-three/drei` + `three`, `next-themes`, `cmdk`, `sonner`, `lucide-react`, **Better Auth + Prisma** (added since).

**Key paths:**
- `src/app/(app)/*` — app routes. Stubs rendered via `components/patterns/module-stub.tsx`: `insights`, `health`, `nutrition`, `finance`, `career`, `reminders`, `settings`.
- `src/app/(app)/layout.tsx` — `AppLayout`; this is where the Better Auth error in §4.1 is thrown.
- `src/lib/navigation.ts` — sidebar config; items have `upcoming: true` → renders the "Soon" badge.
- `src/lib/data/repo.ts` — data boundary. `src/lib/data/fixtures.ts` — demo data.
- `src/lib/domain/types.ts` — domain types. `src/lib/design/tokens.ts` — TS mirror of colours used by the 3D scene and charts.
- `src/components/twin/*` — `twin-scene.tsx` (R3F canvas), `twin-visual.tsx`, `twin-fallback.tsx`, `twin-state.tsx`, `twin-hero.tsx`.
- `src/components/shell/*` — `app-shell.tsx`, `sidebar-nav.tsx`, `twin-dock.tsx` (header "Ask my twin"), `quick-add.tsx`, `mobile-nav.tsx`.
- `prisma/schema.prisma`, the Better Auth config (find with `rg -l "betterAuth\(" src`), and the auth client (`rg -l "createAuthClient" src`).

**Confirmed bugs from the latest screenshots:**
1. **Better Auth: "Prisma schema mismatch — Missing tables: rateLimit"**, thrown server-side from `AppLayout`. Shown as "1 Issue" in the Next dev overlay.
2. **The 3D twin renders as a solid white square** in two places: the Home hero and the header "Ask my twin" button.
3. **Seven sidebar items still show "Soon":** Insights & reviews, Health, Nutrition, Finance, Career, Reminders, Privacy & control.

---

## 3. SUB-AGENT 1 — Builder: implement every "Soon" module end to end

### 3.1 Goal
Every item in the sidebar is a real, working module. A signed-in user can create, read, update and delete their own data in each module; the data persists in Postgres through Prisma; the UI shows loading, empty, error and populated states; demo mode shows realistic sample data and never writes.

### 3.2 Before you start (15 minutes, no more)
1. `git checkout -b agent/01-builder`.
2. Run `npm install`, `npx prisma generate`, `npm run build`. Note every error in a scratch list — **do not fix unrelated errors**; that is Sub-agent 2's job. Only fix what blocks you from building your modules. Exception: fix the `rateLimit` table error (§4.1 step A) immediately, because it blocks every page.
3. Read `prisma/schema.prisma`, `repo.ts`, `types.ts`, one existing complete module (`academic` or `productivity`) end to end. Copy its patterns; do not invent a new architecture.

### 3.3 The pattern every module must follow
For each module `<m>` build these layers in this order:

1. **Prisma models** in `prisma/schema.prisma`. Every model has `id String @id @default(cuid())`, `userId String`, relation to `User` with `onDelete: Cascade`, `createdAt`, `updatedAt`, and `@@index([userId])` (plus a date index where you query by date). Run `npx prisma migrate dev --name <m>`.
2. **Domain types** in `src/lib/domain/types.ts` (or `src/lib/domain/<m>.ts` if the file grows past ~400 lines).
3. **Pure calculation functions** in `src/lib/domain/calc/<m>.ts` — no Prisma, no React, no `Date.now()` inside (pass `now` in). These are what Sub-agent 3 unit-tests, so keep them pure and exported.
4. **Validation schemas** with `zod` in `src/lib/validation/<m>.ts`. Every server action parses input with these. Install `zod` if absent.
5. **Repo functions** in `repo.ts` (or `src/lib/data/<m>.repo.ts` re-exported from `repo.ts`). Signature: `getX(userId)`, `createX(userId, input)`, etc. Demo mode branch returns fixtures and turns writes into no-ops that return the optimistic object.
6. **Server actions** in `src/app/(app)/<m>/actions.ts` with `"use server"`. Each action: get session → reject if none → parse with zod → call repo → `revalidatePath('/<m>')` → return `{ ok: true, data } | { ok: false, error }`. Never throw raw errors to the client.
7. **Fixtures** for demo mode in `fixtures.ts` (realistic Indian-student sample data).
8. **UI** in `src/app/(app)/<m>/page.tsx` + `src/components/<m>/*`. Server component page reads via repo inside a `<Suspense>` boundary (required by `cacheComponents`), client components for forms. Each page: page header (title + one-line plain explanation) → the primary action → key numbers → details. Every data block has skeleton, empty (explains the feature + first action), error (message + retry) and populated states. Mobile verified at 360px.
9. **Navigation:** remove `upcoming: true` for the module in `src/lib/navigation.ts`. Do **not** regroup or rename the nav (that is Phase 3).
10. **Quick add:** if the module has a loggable entry (workout, meal, water, expense), add it to the ⌘K Quick Add sheet so it completes in ≤ 3 taps.

### 3.4 Module specifications

#### 3.4.1 Health (`/health`)
**Models:** `WorkoutSession` (date, notes), `WorkoutSet` (sessionId, exercise, setIndex, reps, weightKg), `WeightLog` (date, kg), `SleepLog` (date, bedtime, wakeTime, quality 1–5), `WaterLog` (date, ml), `MoodCheckin` (date, mood 1–5, energy 1–5), `HealthProfile` (heightCm, sex, activityLevel, hasMedicalCondition boolean, dob read from Profile).
**Calculations (`calc/health.ts`):**
- `personalRecords(sets)` → best weight per exercise and best estimated 1RM (Epley: `w × (1 + reps/30)`), flagged as an estimate.
- `weeklyVolume(sets, weekStart)` → Σ reps × weight per week. `weeklyConsistency(sessions, plannedPerWeek)` → kept / planned.
- `bmi(heightCm, weightKg)`; `bmiCategory(bmi, ageYears)`: adult categories (<18.5, 18.5–24.9, 25–29.9, ≥30) **only when age ≥ 20**. For age < 20 use BMI-for-age percentile from the **CDC 2000 LMS reference table** bundled as `src/lib/domain/data/cdc-bmi-for-age.json` with the source cited in a comment. If the table is not available, return `{ category: null, reason: "needs age-and-sex reference data" }` — never guess.
- `proteinRange(weightKg, activityLevel)` → a range (e.g. sedentary ≈ 0.8 g/kg, active ≈ 1.2–1.6 g/kg; keep constants in one config object with a source comment) + `perMealSplit(range, meals)`.
- `waterTarget(weightKg)` → general estimate (≈ 30–35 ml/kg), labelled as an estimate.
- `calorieEstimate(...)` (Mifflin–St Jeor × activity factor) → returns `null` if age < 18.
**Safety:** if age < 20, the weight-goal input does not render and the API rejects weight-loss targets. If `hasMedicalCondition`, show a persistent "Talk to a doctor before acting on these numbers" note. Footer on every Health view: "Not medical advice."
**UI:** tabs *Workouts · Body · Sleep · Water · Check-in*. Workout logger with fast set entry (exercise autocomplete from the user's history, +/- steppers for reps and weight, "Repeat last set"). PR badge when a set beats the previous best. Weekly volume bar chart. Weight and sleep line charts (last 30 days). Water quick-log buttons (+250 ml, +500 ml) with a progress ring. Mood/energy check-in in 5 seconds (two 1–5 selectors, one tap each).

#### 3.4.2 Nutrition (`/nutrition`)
**Models:** `Food` (global seed table: name, aliases[], servingLabel, servingGrams, kcal, proteinG, carbsG, fatG, fibreG, source), `MealLog` (date, mealType breakfast/lunch/snack/dinner), `MealItem` (mealLogId, foodId nullable, label, quantity, kcal, proteinG, carbsG, fatG, isEstimate), `SavedMeal` + `SavedMealItem`, `DietProfile` (dietType veg/eggetarian/non-veg/vegan/jain, allergies[]).
**Seed:** `prisma/seed.ts` with ~60–100 common Indian foods (roti, phulka, paratha, rice, jeera rice, dal, rajma, chole, paneer sabzi, curd, idli, dosa, sambar, poha, upma, khichdi, egg, chicken curry, banana, milk, chai, etc.). Values from **IFCT 2017 (National Institute of Nutrition)** where available; set `source` per row. If a value is not from a source, set `source: "estimate"`. Wire `"prisma": { "seed": "tsx prisma/seed.ts" }` in `package.json`.
**Natural-language logging (no AI yet):** `parseMealText("2 rotis and dal")` in `calc/nutrition.ts` — a deterministic parser: split on `and`, `,`, `+`, `with`; read leading quantities (digits, "a", "one", "two", "half", "1/2"); fuzzy-match names and aliases against `Food` (simple normalised token match + plurals). Unmatched pieces become items with `isEstimate: true` and zero macros, shown as "Couldn't match — add details". The parser returns a **draft**; the user confirms before anything saves. (Phase 4 will swap in Gemini behind the same function signature.)
**Calculations:** `dailyTotals(items)`, `macroTargets(profile)` (protein from Health's `proteinRange`), `allergyConflicts(items, allergies)`.
**UI:** search table of foods (filter, serving size selector); "Log a meal" input with live parsed preview; today's meals grouped by meal type; 4 thin bars for kcal/protein/carbs/fat vs target; saved meals (one tap to re-log); **allergy warning blocks the save** until the user explicitly confirms. Footer: "Not a dietitian. Estimates are marked."

#### 3.4.3 Finance (`/finance`)
**Models:** `FinanceProfile` (monthlyIncome, monthlyBudget, currency default INR), `Expense` (date, amount, category, note, paymentMethod), `Subscription` (name, amount, cycle monthly/yearly, nextRenewal), `SavingsGoal` (name, target, saved, deadline), `Investment` (type stock/mutual_fund/fd/sip, name, symbol optional, investedAmount, units optional, currentValue manual, interestRate for FD, sipAmount + sipDay for SIP, startDate).
**Calculations:** `spendByCategory(expenses, month)`, `projectedMonthEnd(expenses, budget, today)` (linear run-rate: spent ÷ daysElapsed × daysInMonth, plus known subscription renewals before month end), `budgetStatus` (on track / at risk / over), `fdMaturity(principal, rate, years, compounding)`, `investmentSummary(investments)` (invested vs current, absolute and % gain). All money in **paise as integers** in the database (avoid float errors); format with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
**Live prices:** create `src/lib/integrations/prices.ts` with `interface PriceProvider { getQuote(symbol): Promise<number | null> }` and a `NullPriceProvider` that returns `null`. UI shows the manual current value and a "Live prices: not connected" note. The real provider comes in the integrations round.
**UI:** month header with budget ring; add expense in ≤ 3 taps (amount → category chip → save); category breakdown (greys + accent for the biggest category); projected month-end line (actual solid, projection dashed); subscriptions list with next renewal; savings goals progress; investments table. Persistent footer: "Tracking only — not financial advice."

#### 3.4.4 Career (`/career`)
**Models:** `CareerGoal` (targetRole, targetDate), `RoleSkillRequirement` (careerGoalId, skill, requiredLevel 1–5), `UserSkill` (skill, level 1–5, evidence), `Certification` (name, issuer, date, url), `Project` (title, description, skills[], url, status), `PlacementStatus` (stage: preparing/applying/interviewing/offer/placed, notes), `RoadmapItem` (careerGoalId, title, dueDate, done, order).
**Role templates:** `src/lib/domain/data/role-templates.ts` with 6–8 common roles (Backend developer, Frontend developer, Full-stack, Data analyst, Data scientist, ML engineer, DevOps, UI/UX designer) listing skills + suggested levels. Picking a role pre-fills requirements; the user can edit them.
**Calculations:** `skillGap(requirements, userSkills)` → per-skill gap and an overall readiness % (Σ min(level, required) ÷ Σ required). `roadmapProgress(items)`.
**UI:** target role picker; gap chart (horizontal bars: you = accent fill, required = grey outline); skills editor; certifications and projects lists; placement stage stepper; roadmap checklist with drag reorder. "Draft roadmap with twin" button renders **disabled with "Coming with Ask my twin"** (Phase 4).

#### 3.4.5 Insights & reviews (`/insights`)
**Models:** `PulseSnapshot` (date, academic, fitness, productivity, career, routine, momentum — one row per user per day, `@@unique([userId, date])`), `WeeklyReview` (weekStart, wentWell[], slipped[], nextFocus[]), `Achievement` (key, unlockedAt).
**Snapshot job:** `recordDailySnapshot(userId, date)` computes the pulse scores using the **same functions Home already uses** (find them; do not duplicate logic) and upserts. Expose `POST /api/cron/snapshot` protected by `Authorization: Bearer ${CRON_SECRET}` that runs it for all users; also run it lazily on first Home visit each day if today's row is missing.
**Calculations:** `weeklyReview(data, weekStart)` — deterministic, rule-based (e.g. "Workouts: 4 of 4 planned" → went well; "Attendance dropped below 75% in DBMS" → slipped). `twinEvolution(snapshots, 30)` → sparkline series per score. `lifeGraph(series, minDays = 21)` → Pearson correlations between pairs (sleep hours vs study minutes, workouts vs productivity, etc.); returns `{ locked: true, daysCollected }` if fewer than 21 days. `evaluateAchievements(data)` → meaningful milestones only (first full week logged, 4-week workout consistency, attendance recovered above 75%, savings goal reached).
**UI:** Weekly Twin Review card (three columns); Twin Evolution sparklines; Life Graph shown only after 21 days with the label **"Pattern, not proof"**, otherwise a progress ring "9 of 21 days collected"; achievements grid (locked ones greyed, no pressure copy).

#### 3.4.6 Reminders (`/reminders`)
**Models:** `Notification` (type, title, body, link, readAt, createdAt), `ReminderRule` (kind: deadline/attendance/workout/water/weekly_review/custom, enabled, leadMinutes, channel in_app/email/both), `NotificationPrefs` (quietHoursStart, quietHoursEnd, dailyCap default 3, emailEnabled, timezone default `Asia/Kolkata`).
**Calculations:** `isInQuietHours(now, prefs)` (handles ranges that cross midnight), `canSend(countToday, prefs)`, `dueReminders(rules, commitments, now)`, and `neutralCopy(kind)` which **never** includes health or money values.
**Delivery:** `src/lib/integrations/mailer.ts` with `interface Mailer { send(to, subject, text, html) }`, a `ConsoleMailer` (dev: logs to the server console and writes to a dev outbox table or file) and a `MailjetMailer` stub that is selected only when `MAILJET_API_KEY` and `MAILJET_SECRET_KEY` exist. `POST /api/cron/reminders` (Bearer `CRON_SECRET`) evaluates due reminders, respects quiet hours and the cap, writes in-app `Notification`s and calls the mailer.
**UI:** bell in the header with unread count (and the sidebar item stays); notification list with mark-read / mark-all-read; rules editor with toggles; quiet hours and daily cap controls; "Send me a test reminder" button (in-app + console mail).

#### 3.4.7 Privacy & control (`/settings`)
**Models:** `AiConsentLog` (if not present: feature, categoriesSent[], createdAt), `Profile` fields for preferences (theme, regreterTone, `traits` JSON for later Jarvis use).
**Features:**
- **Export all data:** `GET /api/account/export` → JSON file (one key per model, user's rows only, no password hashes, no session tokens), `Content-Disposition: attachment`.
- **Delete account:** typed confirmation ("delete my twin") → server action deletes the `User` (cascades) → signs out → redirects to `/` with a toast. Requires a fresh session (re-enter password or re-auth within the last 10 minutes).
- **AI consent history:** table of every consent record (when, feature, what was sent). Empty state explains that Ask my twin asks before sending anything.
- **Profile & preferences:** name, life stage, Regreter tone (Gentle/Balanced/Direct/No Mercy), Regreter guardrails shown read-only (max 3 nudges/day, pause button, gentle mode after low-mood days), theme.
- **Sessions:** list active sessions with "Sign out other devices" (Better Auth supports this).
- **Guardian view:** visible, disabled, with "Switched off until legally reviewed."

### 3.5 Builder definition of done
- [ ] All 7 modules implemented per §3.4; no `ModuleStub` usage remains (delete the component if unused).
- [ ] No "Soon" badge anywhere; `upcoming` removed from nav types.
- [ ] `npx prisma migrate dev` runs clean from an empty database; `npx prisma db seed` loads foods and demo-safe data.
- [ ] Every server action rejects unauthenticated calls and invalid input.
- [ ] Demo mode: every module shows sample data; writes do not touch the DB.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build` all pass.
- [ ] `docs/handoff/01-builder.md` written per §6, including the list of pure calc functions (for QA) and any errors you saw but did not fix (for the Integrator).

---

## 4. SUB-AGENT 2 — Integrator: make every connection work and remove every error

### 4.1 Goal
The app starts, every route renders, every action round-trips to the database, the 3D twin renders correctly, and the browser console, server terminal, `tsc`, ESLint and `next build` all report **zero errors and zero warnings you can reasonably fix**.

### 4.2 Inputs
Read `docs/handoff/01-builder.md` first. Its "Errors seen, not fixed" list is your starting backlog. `git checkout -b agent/02-integrator` from `agent/01-builder`.

### 4.3 Step A — Better Auth ↔ Prisma (`Missing tables: rateLimit`)
**Cause:** the Better Auth config has rate limiting stored in the database (`rateLimit: { storage: "database" }` or equivalent), but `schema.prisma` has no `RateLimit` model.
**Fix (preferred):**
1. Regenerate the auth schema with the CLI matching the installed version. The error message suggests `npx auth generate`; if that command is not found, use `npx @better-auth/cli@latest generate`. Point it at the auth config file if it cannot find it (`--config <path>`).
2. Review the diff to `schema.prisma` — keep your own models untouched; accept only Better Auth's tables/fields (`rateLimit` with `key`, `count`, `lastRequest`).
3. `npx prisma migrate dev --name better_auth_rate_limit` then `npx prisma generate`.
4. Restart the dev server (Turbopack caches the Prisma client).
**Alternative** (only if the CLI cannot run): set rate-limit storage to `"memory"` in dev and document it.
**Also check in this step:**
- `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are set; `.env.example` lists every variable used anywhere (`rg "process.env\.\w+" -o src | sort -u`).
- The Prisma client is a singleton (`globalThis` pattern in `src/lib/db.ts`) — no "too many clients" warnings in dev.
- `AppLayout` reads the session via `auth.api.getSession({ headers: await headers() })` **inside a Suspense boundary** or in a child component; with `cacheComponents: true`, uncached dynamic access in a layout without Suspense causes build/prerender errors.
- Route protection: `src/proxy.ts` (Next 16 name for middleware) redirects unauthenticated users from `/(app)` and `/onboarding/*` to `/login?next=…`. Proxy does an optimistic cookie check only; **every server action and route handler re-checks the session**.
- Sign up → verify → log in → log out → log back in works locally with the dev mailer (verification and reset links printed to the server console).

### 4.4 Step B — The white 3D twin (hero + header button)
Symptoms: a solid white square where the twin should render, both on Home (large) and in the header "Ask my twin" button (small). Work through these **in order** and stop at the first confirmed cause (note which one in the handoff):
1. **Undefined colour → white.** `new THREE.Color(undefined)` and `<color attach="background" args={[undefined]} />` both default to **white**. The colour palette in `src/lib/design/tokens.ts` was rewritten to black/lime; the scene probably still reads a removed key (e.g. `palette.dark.ai`, `palette.dark.primary`, `domainHue.*`). Run `rg "palette\.|domainHue" src/components/twin` and check every key exists. Fix by reading tokens through a typed helper that throws in dev on a missing key.
2. **Opaque background.** The canvas should be transparent: `<Canvas gl={{ alpha: true, antialias: true }} style={{ background: "transparent" }}>`; remove any white `setClearColor` or `<color attach="background">` unless it uses the black token.
3. **Shader/material failure.** Open DevTools console for `THREE.WebGLProgram: Shader Error` or `THREE.WebGLRenderer: Context Lost`. A failing custom `ShaderMaterial` can render flat white. Fix the GLSL, or fall back to `PointMaterial`/`MeshStandardMaterial` while fixing.
4. **Two WebGL contexts.** The header button and the hero each mount a `<Canvas>`. Rule: **only one WebGL canvas on screen**. The header dock must use `twin-fallback.tsx` (SVG/CSS) — never a canvas.
5. **SSR / sizing.** The scene must load with `next/dynamic(() => import(...), { ssr: false })`, its parent must have explicit size (`relative` + `h-[240px] w-[240px]` or aspect ratio), and a placeholder (the SVG fallback) must show while loading — never a white `div`. Check for `bg-white` / `bg-foreground` / `bg-card` placeholders: `rg "bg-white|bg-foreground" src/components/twin src/components/shell`.
6. **Reduced motion / no WebGL.** If `prefers-reduced-motion`, `navigator.connection.saveData`, or WebGL is unavailable, render the fallback. Test by disabling hardware acceleration.
Also confirm: the state label under the twin ("stretched — the plan asks for more time than the day has") still renders; the twin pauses rendering when off-screen (`frameloop="demand"` + IntersectionObserver); version compatibility of `three`, `@react-three/fiber`, `@react-three/drei` (`npm ls three` must show **one** version of `three`; deduplicate if not).

### 4.5 Step C — Front end ↔ back end connectivity audit
For **every** route in `src/app/(app)` and `src/app/(auth)`, and every server action / route handler, verify and tick off in a table in the handoff:

| Check | How |
|---|---|
| Page renders signed in, signed out (redirect), and in demo mode | Visit each route in all three states |
| Reads go through `repo` with the session `userId` | `rg "prisma\." src/app src/components` must return **nothing** |
| Every mutation revalidates the right path and the UI updates without a manual refresh | Create/edit/delete one item per module |
| Validation errors show inline, server errors show a toast, nothing crashes the page | Submit empty/invalid forms |
| Loading skeletons and empty states appear | Throttle network; use a fresh user |
| Quick Add (⌘K) entries save to the right module | One of each |
| Home numbers (pulse, time budget, conflicts, today list) come from real data for real users, fixtures only in demo | Log data, reload Home |
| Cross-module links work (e.g. Health workout count feeds Fitness pulse; Finance month-end feeds nothing outside Finance) | Inspect calc call sites |
| Cron endpoints reject requests without the bearer secret | `curl` with and without the header |
| Export returns only the caller's data; delete cascades fully | Two test users |

### 4.6 Step D — Whole-codebase error sweep
Run, fix, re-run until clean:
1. `npx tsc --noEmit` — no `any` added to silence errors; fix the types.
2. `npm run lint` — fix, don't disable rules (a disable comment needs a one-line reason).
3. `npm run build` — no prerender/cacheComponents errors, no "Dynamic server usage" errors.
4. Dev server: open every route and watch both the **browser console** and the **terminal**. Fix hydration mismatches (dates/greetings computed at render → compute on the server once and pass down, or render client-only), missing `key` props, `act()` warnings, failed fetches, 404 assets, React 19 ref warnings, Radix "DialogContent requires a DialogTitle" warnings, and `next/image` warnings.
5. Remove dead code: unused components (old `ModuleStub` if unused), unused fixtures, unused dependencies (`npx depcheck`), duplicated `cn` package (the repo has both `cn` and `clsx`+`tailwind-merge`; keep `src/lib/utils.ts` `cn()` and remove the `cn` npm package if unused).
6. Set `devIndicators: false` (or position it bottom-right) in `next.config.ts` so the Next badge doesn't cover the sidebar.
7. Colour sweep: `rg -niE "violet|purple|indigo|cyan|sky-|blue-|teal|#8b5cf6|#7c3aed|#22d3ee|#0891b2|#0f0f23|#1a1830" src` must return nothing.

### 4.7 Integrator definition of done
- [ ] Zero errors in browser console and server terminal across every route (signed in, signed out, demo).
- [ ] Twin renders on Home; header uses the SVG fallback; no white boxes in light or dark mode.
- [ ] `tsc`, lint, build all clean; `prisma migrate reset` + seed works from scratch.
- [ ] Connectivity table in the handoff fully ticked.
- [ ] `docs/handoff/02-integrator.md` written per §6, including the root cause of each fixed bug and how to reproduce it (QA will turn these into regression tests).

---

## 5. SUB-AGENT 3 — QA: configure testing from scratch and write the test suite

Act as a QA automation lead with 5+ years of cross-browser testing (BrowserStack-style matrices). The goal is not coverage for its own sake; it is **confidence that the features users rely on keep working**.

### 5.1 Inputs
Read both handoffs. Use the Builder's list of pure calc functions for unit tests and the Integrator's bug list for regression tests. `git checkout -b agent/03-qa` from `agent/02-integrator`.

### 5.2 Tooling to set up

| Layer | Tool | Location |
|---|---|---|
| Unit (pure calc, validation, utils) | **Vitest** | `src/**/*.test.ts` |
| Component | **Vitest + @testing-library/react + jsdom + @testing-library/user-event** | `src/**/*.test.tsx` |
| Integration (repo + server actions against a real DB) | Vitest with a **separate test Postgres** (`DATABASE_URL_TEST`, Docker `postgres:16` via `docker-compose.test.yml`), reset with `prisma migrate reset --force --skip-seed` before the run, each test in its own user | `tests/integration/**` |
| API route handlers | Vitest calling the exported `GET/POST` with `new Request(...)` | `tests/api/**` |
| End-to-end | **Playwright** | `tests/e2e/**` |
| Accessibility | **@axe-core/playwright** on every main route | `tests/a11y/**` |
| Visual regression | Playwright `toHaveScreenshot()` (dark + light, desktop + mobile) with masks for dates/animations | `tests/visual/**` |
| Cross-browser cloud | **BrowserStack** via `browserstack-node-sdk` with `browserstack.yml` (reads `BROWSERSTACK_USERNAME` / `BROWSERSTACK_ACCESS_KEY`); runs only when the keys exist | root |
| CI | GitHub Actions `.github/workflows/ci.yml`: install → prisma generate → lint → tsc → unit → integration (Postgres service) → build → Playwright (chromium) → upload report; BrowserStack job on `main` only | `.github/` |

**Config details:**
- `vitest.config.ts`: `environment: 'jsdom'` for `.tsx`, `node` for `.ts` via `environmentMatchGlobs` or projects; `@` path alias; coverage with `v8`, thresholds **≥ 90% lines for `src/lib/domain/calc/**`**, ≥ 70% overall.
- `playwright.config.ts`: `webServer` runs `npm run build && npm run start` against the test DB; projects: `chromium`, `firefox`, `webkit`, `Mobile Chrome (Pixel 7)`, `Mobile Safari (iPhone 14)`; `trace: 'on-first-retry'`, `video: 'retain-on-failure'`, 1 retry in CI; `use.reducedMotion: 'reduce'` for visual tests so 3D/animations are stable.
- **Auth for E2E:** a `global-setup.ts` that creates a verified test user directly through Prisma + Better Auth's API and saves `storageState` to `tests/.auth/user.json`. Email verification links are read from the `ConsoleMailer` dev outbox, not a real inbox.
- **Fake time:** unit tests pass `now`; E2E uses `page.clock.setFixedTime('2026-10-21T18:30:00+05:30')` so "due tomorrow" and greetings are deterministic.
- **WebGL in CI:** headless Chromium may lack GPU; the twin must fall back to SVG, and a test asserts that (this is a feature, not a flake).
- Scripts in `package.json`: `test`, `test:unit`, `test:integration`, `test:e2e`, `test:a11y`, `test:visual`, `test:bs`, `test:all`.

### 5.3 BrowserStack device/browser matrix
| Platform | Browsers / devices |
|---|---|
| Windows 11 | Chrome latest, Edge latest, Firefox latest |
| macOS (latest) | Safari latest, Chrome latest |
| Android | Samsung Galaxy S23 (Chrome), Pixel 7 (Chrome), a low-end device e.g. Galaxy A-series (Chrome) |
| iOS | iPhone 14 / 15 (Safari), iPad (Safari) |
Run the **smoke** tag (`@smoke`) on the full matrix and the full suite on desktop Chrome only, to control minutes.

### 5.4 Test case catalogue
Write each test with its ID in the title (e.g. `test('AUTH-03 rejects login with wrong password', …)`) and tag priority: `@smoke` (P0), `@regression` (P1), `@edge` (P2). Also write `docs/qa/test-plan.md` mirroring this catalogue with status columns.

**A. Authentication & access (E2E + API)**
| ID | Case | Expected |
|---|---|---|
| AUTH-01 @smoke | Sign up with valid DOB (≥ 18), email, strong password | Account created, verification email in dev outbox, redirect to verify screen |
| AUTH-02 | DOB under 13 | Kind block screen, **no** user row created |
| AUTH-03 | DOB 13–17 | "Opens once parental consent is in place", no user row |
| AUTH-04 @smoke | Log in with verified account | Lands on Home (or saved onboarding step) |
| AUTH-05 | Log in with wrong password | Generic error, does not reveal whether email exists |
| AUTH-06 | Log in before verifying email | Prompt to verify, resend link works |
| AUTH-07 | Forgot password → reset link → new password → log in | Old password rejected, new accepted |
| AUTH-08 @smoke | Visit `/home`, `/health`, `/finance` signed out | Redirect to `/login?next=…`, then back after login |
| AUTH-09 | Repeated failed logins | Rate limited after the configured count (regression for the `rateLimit` table bug) |
| AUTH-10 | Log out | Session cleared; back button does not show private data |
| AUTH-11 | Server action called without session (direct POST) | Rejected, no DB write |
| AUTH-12 | User A requests User B's record id via action/API | Not found / forbidden, never returns data |

**B. Onboarding & demo**
| ID | Case | Expected |
|---|---|---|
| ONB-01 @smoke | Complete all steps | Profile saved, lands on Home |
| ONB-02 | Close mid-wizard, log back in | Resumes at saved step with answers kept |
| ONB-03 | Skip optional steps | Allowed; required steps block with inline error |
| ONB-04 | Life stage "school" vs "college" | Academic questions change accordingly |
| DEMO-01 @smoke | "Try the demo" | Demo banner visible, all modules show sample data |
| DEMO-02 | Add an expense in demo, reload | Not persisted; DB row count unchanged |

**C. Home & twin**
| ID | Case | Expected |
|---|---|---|
| HOME-01 @smoke | Home loads for a seeded user | One Thing, conflict line, pulse scores and today list render from DB |
| HOME-02 | No data user | Teaching empty states, no NaN/undefined/0% garbage |
| HOME-03 | Time conflict present | Message shows planned vs available hours correctly |
| TWIN-01 @smoke | Twin area on Home | Canvas or SVG fallback visible; **no element with a solid white fill** in the twin container (regression for white box) |
| TWIN-02 | Header twin button | Uses SVG fallback; only one `<canvas>` on the page |
| TWIN-03 | `reducedMotion: 'reduce'` / WebGL disabled | SVG fallback renders, no console errors |
| NAV-01 @smoke | Every sidebar item | Navigates, renders, **no "Soon" badge anywhere** |

**D. Health**
| ID | Case | Expected |
|---|---|---|
| HLT-01 @smoke | Log a workout with 3 sets | Saved, weekly volume updates |
| HLT-02 | Beat a previous best | PR badge appears |
| HLT-03 (unit) | `bmi(170, 65)` | ≈ 22.5, adult category "healthy" when age ≥ 20 |
| HLT-04 (unit) | BMI for age 19 | Uses percentile path or returns `category: null` — never adult category |
| HLT-05 | User aged 19 opens weight goal | Weight-loss target not offered; API rejects it |
| HLT-06 (unit) | `calorieEstimate` for age 17 | `null` |
| HLT-07 | Medical condition ticked | Doctor note visible on Health views |
| HLT-08 | Water +250 ml × 4 | Ring shows 1,000 ml |
| HLT-09 | Mood check-in | Two taps save; one per day (second edits the first) |
| HLT-10 (unit) | `personalRecords`, `weeklyVolume`, `proteinRange` boundaries (0 kg, negative, huge values) | Validation rejects invalid, math correct for valid |

**E. Nutrition**
| ID | Case | Expected |
|---|---|---|
| NUT-01 @smoke | Type "2 rotis and dal", confirm | Two items saved with roti quantity 2 |
| NUT-02 (unit) | Parser: "half plate rice", "1/2 cup curd", "2 eggs, 1 banana", "chai + biscuit" | Quantities and matches correct; unmatched → `isEstimate` |
| NUT-03 | Unknown food "xyz curry" | Shown as estimate, not silently dropped |
| NUT-04 | Peanut allergy, log "peanut chikki" | Save blocked until explicit confirm |
| NUT-05 | Daily totals vs targets | Bars match summed macros |
| NUT-06 | Saved meal re-log | One tap creates a new log with same items |
| NUT-07 | Seed data | Every `Food` row has a `source` |

**F. Finance**
| ID | Case | Expected |
|---|---|---|
| FIN-01 @smoke | Add expense ₹250 Food | Appears in list and category total |
| FIN-02 (unit) | `projectedMonthEnd` on day 1, mid-month, last day, with renewals | Correct, no divide-by-zero |
| FIN-03 (unit) | Money stored in paise; 0.1 + 0.2 style sums | Exact |
| FIN-04 | INR formatting | "₹1,25,000" Indian grouping |
| FIN-05 (unit) | `fdMaturity` quarterly compounding | Matches known value |
| FIN-06 | Investments without price API | Manual value shown, "Live prices: not connected" |
| FIN-07 | Disclaimer | "Not financial advice" visible on Finance views |

**G. Career**
| ID | Case | Expected |
|---|---|---|
| CAR-01 @smoke | Pick "Backend developer" | Requirements pre-filled, editable |
| CAR-02 (unit) | `skillGap` with over-qualified skills | Readiness caps at 100% per skill |
| CAR-03 | Reorder roadmap by drag (and keyboard) | Order persists after reload |
| CAR-04 | "Draft roadmap with twin" | Disabled with "Coming with Ask my twin" |

**H. Insights**
| ID | Case | Expected |
|---|---|---|
| INS-01 | User with 9 days of snapshots | Life Graph locked, "9 of 21 days collected" |
| INS-02 | User with 21+ days | Correlations shown, labelled "Pattern, not proof" |
| INS-03 (unit) | `lifeGraph` with constant series | No NaN (handles zero variance) |
| INS-04 | `/api/cron/snapshot` without secret | 401; with secret: one row per user per day (idempotent) |
| INS-05 | Weekly review | Went well / slipped / next focus derived from data |

**I. Reminders**
| ID | Case | Expected |
|---|---|---|
| REM-01 @smoke | "Send me a test reminder" | In-app notification + dev outbox entry |
| REM-02 (unit) | Quiet hours 23:00–07:00 at 02:00 and 12:00 | true / false (crosses midnight) |
| REM-03 (unit) | Daily cap 3 | 4th reminder suppressed |
| REM-04 (unit) | `neutralCopy` for every kind | Contains no digits for weight/₹ amounts, no health/money terms |
| REM-05 | Mark all read | Bell count goes to 0 |
| REM-06 | `/api/cron/reminders` without secret | 401 |

**J. Privacy & control**
| ID | Case | Expected |
|---|---|---|
| PRV-01 @smoke | Export data | JSON downloads; contains user's rows only; no password hash / tokens |
| PRV-02 | Delete account with wrong confirmation text | Blocked |
| PRV-03 | Delete account correctly | User and all rows gone (verify every model count = 0 for that user), signed out |
| PRV-04 | Sign out other sessions | Second browser context loses access |
| PRV-05 | Guardian view | Visible, disabled, explanation shown |

**K. Cross-cutting**
| ID | Case | Expected |
|---|---|---|
| A11Y-01 @smoke | axe on every main route, dark + light | 0 serious/critical violations |
| A11Y-02 | Keyboard-only: navigate sidebar, open Quick Add (⌘K / Ctrl+K), log an expense, close dialogs with Esc | All reachable, visible focus, focus returns |
| A11Y-03 | Status chips | Each has icon + text, not colour only |
| RESP-01 | 360px, 768px, 1280px, 1920px | No horizontal scroll, no overlapping elements (Next badge no longer covers sidebar) |
| THEME-01 | Toggle dark/light, reload | Persisted; no flash of wrong theme; no purple/blue anywhere (computed-style scan) |
| PERF-01 | Lighthouse CI on `/`, `/home` | LCP < 2.5s (mobile emulation), CLS < 0.1 |
| ERR-01 @smoke | Console listener during E2E smoke run | **Fails the test on any `console.error` or uncaught page error** |
| ERR-02 | DB down (stop test Postgres) | Error states render with retry; no white screen |
| SEC-01 | XSS: save `<img src=x onerror=alert(1)>` as a task/expense note | Rendered as text |
| SEC-02 | Cron/export endpoints | Correct auth; no data leakage across users |
| VIS-01 | Screenshots of Home, Health, Finance, Insights, Settings (dark/light, desktop/mobile) | Match baselines |

### 5.5 QA definition of done
- [ ] `npm run test:all` green locally; CI workflow green on the branch.
- [ ] Coverage thresholds met; report committed as CI artifact (not to git).
- [ ] Every Integrator bug has a named regression test.
- [ ] BrowserStack config present and documented; smoke run results attached if keys were available, otherwise instructions in the handoff.
- [ ] `docs/qa/test-plan.md` and `docs/handoff/03-qa.md` written.
- [ ] Any product bug found is **fixed if small and obvious** (with a test), otherwise logged in the handoff with steps to reproduce — do not silently skip or `test.skip` it.

---

## 6. Handoff note template (`docs/handoff/0X-<agent>.md`)

Every sub-agent writes exactly these sections, short and factual:

```md
# Handoff — <agent name> — <date>
## Branch & last commit
## What I completed (checklist from my definition of done, ticked)
## Files and models added/changed (grouped by module)
## How to run it (commands, env vars needed, seed)
## Pure functions worth testing (path → function → what it does)   # Builder only
## Bugs fixed: root cause → fix → how to reproduce                  # Integrator only
## Errors seen but not fixed (with file:line and the exact message)
## Decisions I made that the next agent must respect
## Open questions for the owner
```

---

## 7. Environment variables (`.env.example` must contain all of these)

```
# Core
DATABASE_URL=
DATABASE_URL_TEST=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
CRON_SECRET=

# Next round (integrations) — leave empty for now; adapters stay on dev/null implementations
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
MAILJET_FROM_EMAIL=
GEMINI_API_KEY=
GEMINI_MODEL=
MARKET_DATA_API_KEY=

# QA
BROWSERSTACK_USERNAME=
BROWSERSTACK_ACCESS_KEY=
```

---

## 8. Optional: Claude Code sub-agent definitions

Create these files so the orchestrating session can delegate with `Use the twin-builder agent…`, then `twin-integrator`, then `twin-qa`, strictly in that order.

`.claude/agents/twin-builder.md`
```md
---
name: twin-builder
description: Implements the remaining "Soon" modules (Health, Nutrition, Finance, Career, Insights, Reminders, Privacy & control) end to end for MINI_TWIN. Use first.
---
Follow overview.md §0.1 and §3 exactly. Stay inside scope; do not redesign navigation or add external API integrations. Finish by writing docs/handoff/01-builder.md per §6.
```

`.claude/agents/twin-integrator.md`
```md
---
name: twin-integrator
description: Fixes Better Auth/Prisma, the white 3D twin, all front end ↔ back end connections and every lint/type/build/console error in MINI_TWIN. Use after twin-builder.
---
Read docs/handoff/01-builder.md first. Follow overview.md §0.1 and §4 exactly, in the step order given. Finish by writing docs/handoff/02-integrator.md per §6.
```

`.claude/agents/twin-qa.md`
```md
---
name: twin-qa
description: Sets up Vitest, Testing Library, Playwright, axe, visual tests, BrowserStack and CI for MINI_TWIN and implements the test catalogue. Use after twin-integrator.
---
Read both previous handoffs first. Follow overview.md §0.1 and §5 exactly. Finish by writing docs/qa/test-plan.md and docs/handoff/03-qa.md per §6.
```

---

## 9. What comes after this round (for context only — do not start)

1. **Phase 3:** visual and IA redesign — landing page rework, sidebar regrouping (Plan = Goals · Time budget · Regreter · Future self), Twin Pulse as rings with Momentum as the headline, React Bits motion set, particle-figure twin.
2. **Phase 4:** working Ask my twin on Gemini with tool calling over `repo`, consent logging, then **Jarvis mode** (⌘J / Ctrl+J summoned overlay, voice in/out, trait-based personalisation, confirm-before-write actions).
3. **Integrations:** Google OAuth, Mailjet sending, live market prices, Gemini — each switching on its adapter when keys are added to `.env`.
