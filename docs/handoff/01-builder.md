# Handoff — Builder (twin-builder) — 2026-10-22

## Branch & last commit

Branch `agent/01-builder`, branched from `phase-1-design-system`.

Commits, oldest first:

| Commit | What |
|---|---|
| `21e931f` | Models and calculations for the seven modules (schema + migration + health/nutrition/finance calc + CDC data) |
| `2e676a1` | Career, insights and reminder calculations |
| `d1a8af4` | Validation schemas and the mailer/price adapters |
| `e717fa1` | Health module, end to end |
| `f1c63b6` | Nutrition module, food seed and the allergy gate |
| `c50e806` | Finance module |
| `6e37d5e` | Career module |
| `8e66655` | Insights module, pulse engine, snapshot cron |
| `bb17146` | Reminders module, delivery cron |
| *(this commit)* | Privacy & control, Quick Add wiring, nav cleanup, handoff |

## What I completed

- [x] All 7 modules implemented per §3.4. `ModuleStub` is deleted — nothing imported it.
- [x] No "Soon" badge anywhere. `upcoming` is gone from `NavItem` and from the sidebar's render.
- [x] `npx prisma migrate dev` runs clean from an empty database — verified in this session: after the legacy tables were dropped `public` held **0 tables**, then `0_init` and `20261021164726_modules_…` applied in sequence. `npx prisma db seed` loads 96 foods, all with a `source`.
- [x] Every server action rejects unauthenticated calls (`requireWriter` throws) and parses with zod before touching the repo.
- [x] Demo mode: every module reads fixtures and every write is a no-op returning the optimistic object.
- [x] `npm run lint`, `npx tsc --noEmit`, `npm run build` all pass. Build emits 29 routes.
- [x] This handoff.

**Not done, and it is in your court:** `npx prisma migrate reset --force` was blocked by the sandbox as a destructive action. The from-empty path is verified by the sequence above, but if you want the literal command in your notes, run it yourself — the only data to lose is the 96 seeded foods, which the seed puts back.

## Files and models added/changed

### Schema (`prisma/schema.prisma`, 47 models)

New: `HealthProfile`, `WorkoutSession`, `WorkoutSet`, `Food`, `DietProfile`, `MealItem`, `SavedMeal`, `SavedMealItem`, `FinanceProfile`, `Subscription`, `SavingsGoal`, `CareerGoal`, `RoleSkillRequirement`, `UserSkill`, `Certification`, `Project`, `PlacementStatus`, `RoadmapItem`, `PulseSnapshot`, `WeeklyReview`, `Achievement`, `NotificationPrefs`, `ReminderRule`, `Notification`, `DevEmail`.

New enums: `ActivityLevel`, `DietType`, `MealType`, `PaymentMethod`, `BillingCycle`, `InvestmentKind`, `PlacementStage`, `ProjectStatus`, `ReminderKind`, `ReminderChannel`.

Changed: `WorkoutLog` → `WorkoutSession` + `WorkoutSet`; `MealLog` reshaped to have `MealItem` children; `Expense` gained `paymentMethod` and lost `renewsOn`; `Investment` gained `interestRate`, `sipAmountMinor`, `sipDay`, `startDate` and its `kind` became an enum; `Profile` lost `quietHoursStart`, `quietHoursEnd`, `dailyReminderCap`.

### Shared, built once and used by every module

| Path | What |
|---|---|
| `src/components/patterns/action-form.tsx` | `ActionForm` (pending, inline field errors, one toast, input preserved on failure), `FieldError`, `FormError` |
| `src/components/patterns/module-tabs.tsx` | Tabs whose panels render on the server |
| `src/components/patterns/delete-button.tsx` | Delete with a popover confirm |
| `src/components/patterns/charts.tsx` | Added `BarChart`, `BarRows`, `ProgressRing`, `Sparkline` |
| `src/lib/validation/shared.ts` | `isoDate`, `rupeesToMinor`, `formDataToObject`, `invalid`, `ActionResult` |
| `src/lib/cron.ts` | Bearer-secret guard, constant-time, closed when unset |
| `src/lib/auth/session.ts` | Added `requireWriter` / `Writer` |
| `src/lib/data/repo.ts` | `moduleRepo()` resolver + `getHealthRepo` … `getAccountRepo`; Home now renders the live pulse |
| `src/lib/data/module-fixtures.ts` | Demo data for all seven modules |

### Per module

| Module | Calc | Repo | Actions | UI |
|---|---|---|---|---|
| Health | `calc/health.ts` | `data/health.repo.ts` | `(app)/health/actions.ts` | `(app)/health/page.tsx`, `components/health/{workout-logger,water-log,mood-checkin,body-forms}.tsx` |
| Nutrition | `calc/nutrition.ts` | `data/nutrition.repo.ts` | `(app)/nutrition/actions.ts` | `(app)/nutrition/page.tsx`, `components/nutrition/{meal-composer,nutrition-panels}.tsx` |
| Finance | `calc/finance.ts` | `data/finance.repo.ts` | `(app)/finance/actions.ts` | `(app)/finance/page.tsx`, `components/finance/finance-forms.tsx` |
| Career | `calc/career.ts`, `domain/data/role-templates.ts` | `data/career.repo.ts` | `(app)/career/actions.ts` | `(app)/career/page.tsx`, `components/career/{career-forms,roadmap}.tsx` |
| Insights | `calc/insights.ts`, `calc/pulse.ts` | `data/insights.repo.ts` | — (read-only) | `(app)/insights/page.tsx` |
| Reminders | `calc/reminders.ts` | `data/reminders.repo.ts` | `(app)/reminders/actions.ts` | `(app)/reminders/page.tsx`, `components/reminders/reminder-controls.tsx` |
| Privacy | — | `data/account.repo.ts` | `(app)/settings/actions.ts` | `(app)/settings/page.tsx`, `components/settings/settings-panels.tsx` |

Routes: `GET /api/account/export`, `POST /api/cron/snapshot`, `POST /api/cron/reminders`.
Data asset: `src/lib/domain/data/cdc-bmi-for-age.json` (438 rows, real CDC 2000 LMS table, fetched from cdc.gov, source and retrieval date inside the file).

## How to run it

```bash
npm install
npx prisma generate
npx prisma migrate deploy     # or migrate dev
npx prisma db seed            # 96 foods
npm run dev
```

`.env` needs `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. `CRON_SECRET` is needed only to exercise the cron endpoints. Everything else in `.env.example` is optional and the adapters fall back: no Mailjet key → `ConsoleMailer` writes to the terminal **and** the `DevEmail` table; no market-data key → `NullPriceProvider` and the UI says "Live prices: not connected".

**On `DATABASE_URL`:** it must be a `postgresql://` string, not the `https://<ref>.supabase.co` REST endpoint, and a password containing `@` must be percent-encoded as `%40` or Prisma reads it as the host separator (that is a `P1013`, and it cost us a detour).

Cron, locally:

```bash
curl -X POST localhost:3000/api/cron/snapshot  -H "Authorization: Bearer $CRON_SECRET"
curl -X POST localhost:3000/api/cron/reminders -H "Authorization: Bearer $CRON_SECRET"
```

## Pure functions worth testing

All of these are pure — no Prisma, no React, no `Date.now()` inside; anything time-dependent takes `now`.

### `src/lib/domain/calc/health.ts`
| Function | What it does |
|---|---|
| `epleyOneRepMax(weightKg, reps)` | Epley estimate; returns the weight itself at 1 rep, 0 for bodyweight |
| `personalRecords(sets)` | Best actual lift **and** best estimated 1RM per exercise, reported separately |
| `isPersonalRecord(set, history)` | Drives the live PR badge |
| `weeklyVolume(sets, weekStart)` / `volumeSeries(sets, now, weeks)` | Σ reps × weight, windowed |
| `weeklyConsistency(sessions, plannedPerWeek, weekStart)` | Null when planned is 0 |
| `bmi(heightCm, weightKg)` | Null for impossible inputs |
| `bmiCategory(bmi, { ageMonths, sex })` | **Adult table only at ≥ 240 months.** Under that, CDC for-age; returns `{ kind: "unavailable", reason }` without a sex |
| `bmiForAgePercentile(bmi, ageMonths, sex)` | LMS → z → normal CDF, interpolated between half-month rows |
| `normalCdf(z)` | Abramowitz & Stegun 7.1.26 |
| `proteinRange(weightKg, level)` / `perMealSplit` | Range + source, null for bad weight |
| `waterTarget(weightKg)` | 30–35 ml/kg, labelled an estimate |
| `calorieEstimate({...})` | Mifflin–St Jeor × factor. **Null under 18**, null without a sex |
| `mayShowWeightGoal(ageYears)` | False under 20, no override |
| `ageYears` / `ageMonths` | Part-months, so a 19-year-old is not rounded up |
| `sleepMinutes(bedtime, wake)` | Crosses midnight |

### `src/lib/domain/calc/nutrition.ts`
`parseMealText(text, foods)`, `takeQuantity(piece)` (digits, `1/2`, "half", "two", serving words), `matchFood(text, foods)` (exact → alias → singular → 0.6 token overlap), `dailyTotals`, `totalsByMealType`, `macroTargets`, `allergyConflicts`, `dietConflicts`, `searchFoods`, `scaleFood`.

### `src/lib/domain/calc/finance.ts`
`formatMinor` (Indian grouping), `toMinor`/`fromMinor`, `spendByCategory`, `monthTotal`, `projectedMonthEnd` (day 1 divides by 1, adds known renewals), `budgetStatus`, `renewalsBeforeMonthEnd`, `annualSubscriptionCost`, `dailyCumulative`, `fdMaturity(principal, rate, years, compounding)`, `investmentSummary`, `savingsProgress`, `monthlyToReachGoal`.

### `src/lib/domain/calc/career.ts`
`skillGap(requirements, userSkills)` (per-skill `min` cap), `roadmapProgress`, `reorder`, `placementProgress`, `daysToTarget`.

### `src/lib/domain/calc/insights.ts`
`pearson(xs, ys)` (**null, not NaN, on zero variance**), `lifeGraph(series, minDays)` (locked under 21; pair needs `minDays` *paired* days; |r| < 0.3 dropped), `twinEvolution`, `weeklyReview(input)`, `evaluateAchievements`.

### `src/lib/domain/calc/pulse.ts`
`computePulse(inputs)` (absent area → score omitted, never 0; momentum null below 2 scores), `pulseSnapshotRow`, `bandFor`.

### `src/lib/domain/calc/reminders.ts`
`isInQuietHours(now, prefs)` (crosses midnight; start == end means off), `canSend(countToday, prefs)`, `sendDecision`, `dueReminders(rules, candidates, now)`, `neutralCopy(kind)`, **`neutralCopyIsSafe(copy)`** — asserts no digits and no health/money vocabulary; please test it over every kind in `REMINDER_KINDS`.

### Also worth a test
`src/lib/data/account.repo.ts` → `EXPORTED_MODELS`. It is the single list the export and the deletion summary both read. A model added to the schema and not to that list is silently missing from "export all my data". A test that compares it against the schema's `userId`-bearing models would catch that; I did not write one.

I ran 25 throwaway sanity assertions over this layer while building (all passed, including `fdMaturity(100000, 8, 1, "quarterly") === 108243` to the paise, the CDC percentile path, and the parser cases). They were deliberately **not** committed — the catalogue is yours, with IDs.

## Errors seen but not fixed

1. **`cn` is both an npm package and a local helper.** `src/lib/utils.ts` is just `export { cn } from "cn"`, and 50-odd files import `from "cn"` directly. §4.6.5 wants the package dropped and `src/lib/utils.ts` kept. I left it alone — it is a 50-file import rewrite with no behaviour change, and doing it mid-module would have put noise in every commit. No errors result from it today.
2. **`src/components/bits/*`** (`Stepper.tsx`, `Orb.tsx`, `MagicBento.tsx`, …) are phase-1 vendored showcase components. Several are unimported. `npx depcheck` has not been run. Candidates for your dead-code sweep.
3. **`WeeklyReview` rows are only written by the cron.** If `/api/cron/snapshot` is never called, `weeklyReviewsRead` stays 0 and the "First review read" milestone cannot unlock. The Insights screen itself always recomputes the review from live data, so the screen is correct either way — but the milestone is effectively cron-gated. Worth a decision.
4. **`syncAchievements` has `attendanceRecovered: false` hard-coded.** Detecting "was below the rule, now above it" needs attendance history we do not snapshot. The milestone is therefore unreachable. It is visible and locked, with its requirement shown, which is honest but incomplete.
5. **Unverified by me, needs a browser:** every page renders and the build prerenders them, but I never loaded a route in a browser. Hydration, the Radix dialog/tooltip warnings §4.6.4 lists, and real console output across the three viewer states are all yours.
6. **Legacy data dump.** Before dropping the 46 old Supabase-Auth tables (user-approved) I dumped their 23 rows to `…/scratchpad/legacy-public-dump.json`. That is in a session scratchpad and will be cleaned up. Move it if anyone might want it.

## Decisions I made that the next agent must respect

1. **`WorkoutLog` became `WorkoutSession` + `WorkoutSet`.** Personal records and per-exercise volume are real queries, not a JSON column to sum. The DB was empty, so there was no migration of data.
2. **`HealthProfile` holds height and activity level only.** `sex`, `dob` and `hasMedicalCondition` stay on `Profile`, where the age gate wrote them. **Do not add a second copy of an age anywhere** — every age-dependent safety rule reads `Profile.dob`, and a duplicate is how such a rule gets bypassed without anyone noticing.
3. **`bmiCategory` takes `(bmi, { ageMonths, sex })`, not `(bmi, ageYears)`** as §3.4.1 wrote it. Years cannot index a half-month reference table, and the sex is not optional for the under-20 path. Changing it back would reintroduce the bug it exists to prevent.
4. **Quiet hours, the daily cap and the email switch live only on `NotificationPrefs`.** The three fields were removed from `Profile`.
5. **Every `Food` row is `source: "estimate"`.** The macros are reasonable working figures but were not read from IFCT 2017 row by row, and labelling them "IFCT 2017" would be exactly the dishonesty rule §0.1.7 forbids. `prisma/seed.ts` documents how to upgrade rows one at a time. **Please do not bulk-relabel them.**
6. **Money is paise in an `Int`, end to end.** `rupeesToMinor` converts once at the form boundary, `formatMinor` once at the component boundary. Nothing between them handles a rupee float.
7. **Demo writes are no-ops, not errors.** `requireWriter` allows demo; each module's demo repo accepts the write and discards it. Making demo forms error would teach a visitor nothing about the product. This is what DEMO-02 should assert.
8. **The pulse engine is `calc/pulse.ts`, with one implementation and two callers** — Home live, the snapshot job stored. Do not add a second copy for either.
9. **The lazy daily snapshot runs in `after()`**, not during render. A render may be retried or discarded; `after()` runs once, after the response. Please keep side effects out of render.
10. **Cron endpoints are closed when `CRON_SECRET` is unset** (503), not open. A deployment that forgets the variable must not expose a write-everything endpoint.
11. **Account deletion relies on the schema's cascades**, not a hand-written table list, and requires a session younger than 10 minutes.
12. **`neutralCopy` is the only source of notification text.** `FORBIDDEN_IN_COPY` + `neutralCopyIsSafe` sit next to it so a leaky new string fails a check rather than reaching a lock screen.
13. Quick Add's meal entry **does not parse**. It saves the typed words as one unmatched, estimate-marked item. Parsing silently from a palette would be the one place a guessed macro lands without the user seeing it.

## Open questions for the owner

1. **The database password is in this session's transcript** (`Pramit@@123`, and an earlier wrong guess). Worth rotating in Supabase and updating `.env`.
2. **Food macros.** Do you want the IFCT 2017 values entered properly? It is a per-row lookup against the published tables — a real afternoon of work, and the only way to drop the "estimate" label honestly.
3. **`attendanceRecovered`** (open question 4 above): snapshot per-subject attendance so the milestone can fire, or drop that milestone?
4. **Guardian view** is visible and disabled with "Switched off until legally reviewed", per §3.4.7. Nothing behind it exists. Confirm that is still the intent.
5. **One career goal at a time.** The schema allows several and keeps old roadmaps; the screen works with the most recent. A gap chart against two target roles is unreadable, but if you want goal switching with history surfaced, that is a Phase 3 IA question.
6. **`/goals` and `/regreter`** still read partly from fixtures for logged-in users (`getPlanning`, `getRegreter` in `repo.ts` return `fixtures.weeklyCapacity`, `fixtures.recoveryPlan`, `fixtures.futurePaths`). That predates this round and was out of my scope, but it means two screens show sample data to real users. The Integrator should decide whether that is a bug to fix now.
