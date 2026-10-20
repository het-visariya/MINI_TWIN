# Digital Twin — Front-end Redesign, Auth, Missing Modules, Working Twin + "Jarvis" Mode

> Paste this whole file into your coding agent (Claude Code, Cursor, etc.) from the repo root of `Digital_Twin/`.
> Work phase by phase. Do not start a phase until the previous one builds (`npm run build`) and lints (`npm run lint`) cleanly.

---

## 0. Your role

You are a **senior front-end engineer with 10+ years building production React UI/UX, motion design and WebGL/Three.js experiences**. You care about clarity first, then craft. Every animation must earn its place: it either explains a change of state, guides attention to the one thing that matters, or gives feedback on an action. Nothing moves "for decoration".

You are redesigning **Digital Twin** — a life OS for students and young professionals. The product pitch, which every screen must make obvious within 5 seconds:

> Students use one app for the timetable, another for the gym, another for food and another for money, and none of them talk to each other. Digital Twin puts everything into one "twin" of you. It tells you things like *"if you postpone this assignment, tomorrow becomes 2 hours heavier"*, and it lets you test decisions before you make them.

---

## 1. What exists today (read this before touching code)

**Stack (keep it):** Next.js 16.4 (App Router, `cacheComponents: true`), React 19.3, TypeScript, Tailwind CSS v4 (`@theme inline` tokens in `src/app/globals.css`), shadcn/ui (style `radix-nova`, Radix primitives), `motion` (Framer Motion successor), `@react-three/fiber` + `@react-three/drei` + `three`, `next-themes`, `cmdk`, `sonner`, `lucide-react`.

**Structure:**
- `src/app/page.tsx` — public landing page (links to `/design-system` in the header — remove from public nav).
- `src/app/(app)/*` — app routes: `home`, `productivity`, `academic`, `goals`, `regreter`, `twin`, and stubs (`insights`, `health`, `nutrition`, `finance`, `career`, `reminders`, `settings`) rendered by `components/patterns/module-stub.tsx`.
- `src/app/(onboarding)/onboarding/[step]/page.tsx` — setup wizard.
- `src/lib/data/repo.ts` — **the single data boundary**; screens call `repo.getX()` and never import fixtures. Keep this rule.
- `src/lib/data/fixtures.ts` — all current sample data.
- `src/lib/domain/types.ts` — domain model (`Commitment`, `Score`, `Consequence`, `TwinMessage`, etc.). Keep and extend; don't fork.
- `src/lib/design/tokens.ts` — TS mirror of CSS colours for the R3F scene/charts.
- `src/lib/navigation.ts` — sidebar + mobile nav config.
- `src/components/twin/*` — 3D twin (`twin-scene.tsx` with `MeshDistortMaterial`), fallback, state provider.
- `src/components/shell/*` — app shell, sidebar, quick-add (⌘K), `twin-dock.tsx` (sheet chat).

**Known problems (confirmed in code + screenshots):**
1. **No authentication at all.** `/home` is reachable by anyone; no login, signup, session, or route protection.
2. **"Ask my twin" does nothing.** `twin-dock.tsx` form does `event.preventDefault()` and nothing else; the twin page renders a fixed fixture conversation and a *permanently visible* `TypingIndicator`. There is no `/api` route and no Gemini integration.
3. **7 of 13 sidebar items are "Soon" stubs** (Insights, Health, Nutrition, Finance, Career, Reminders, Privacy & control).
4. **Visual identity is purple + cyan on navy** (`#0f0f23`, `#8b5cf6`, `#22d3ee`). The owner explicitly rejects purple/blue. It also reads as an "AI template".
5. **Information overload on Home:** six score cards each with a paragraph + "What goes into this?", a conflict banner with 4 chips, a hero, a brief list, today list and time budget — all on one scroll. A new user can't tell what to do.
6. **The twin visual is a cyan distorted blob** — it doesn't communicate "a twin of you" and looks like a stock shader.
7. Duplicate entry points to the twin (header button, sidebar item, page) with three different behaviours.
8. Next.js dev indicator ("N" badge) overlaps the sidebar footer in screenshots.

---

## 2. Design direction

### 2.1 Principles
1. **One thing per screen.** Every screen answers "what should I do now?" before anything else.
2. **Progressive disclosure.** Numbers first, explanation one tap away. No paragraph is visible by default if a sentence will do.
3. **Plain language.** Labels a first-year student understands. Keep the brand names (Regreter, Twin Pulse) but always pair with a plain subtitle ("Regreter — see what putting things off really costs").
4. **Calm, not gamified.** No confetti, no streak flames, no red badges screaming. Compared only to your own past.
5. **Monochrome + one accent.** Colour means "you can act here" or "status". Never decoration.

### 2.2 Colour system (replace all purple/blue/cyan)

Dark mode is the hero. True black base, warm neutral greys, **one accent**. Replace values in `globals.css` **and** `src/lib/design/tokens.ts` (they must stay in sync).

| Token | Dark | Light | Use |
|---|---|---|---|
| `--background` | `#000000` | `#FAFAF8` | page |
| `--surface-1` (card) | `#0B0B0B` | `#FFFFFF` | cards |
| `--surface-2` | `#141414` | `#F2F2EF` | raised / hover / inputs |
| `--border` | `#1F1F1F` | `#E6E6E1` | hairlines |
| `--border-strong` | `#2E2E2E` | `#D2D2CC` | focused / selected |
| `--foreground` | `#EDEDEA` | `#0A0A0A` | primary text |
| `--muted-foreground` | `#8A8A85` | `#5F5F5A` | secondary text |
| `--accent` (**primary**) | `#D4F25A` (signal lime) | `#5C7A00` | buttons, focus rings, active nav, twin glow, AI |
| `--accent-foreground` | `#0A0A0A` | `#FFFFFF` | text on accent |
| `--ok` | `#8FD694` | `#2F7D3A` | on track (always with ✓ icon + label) |
| `--attention` | `#F2B544` | `#9A6300` | needs attention (with ! icon + label) |
| `--risk` | `#F2555A` | `#C42B30` | risk / overdue |
| `--simulation` | `#B8B8B2` dashed border | `#6B6B66` | anything that is a projection |

Rules:
- **Delete every purple, violet, indigo, blue, cyan and teal value** in the repo (`grep -rniE "violet|purple|indigo|cyan|sky-|blue|teal|#8b5cf6|#7c3aed|#22d3ee|#0891b2|#0f0f23|#1a1830"`).
- Domain hues collapse to **neutral greys + an icon**. Charts use the accent for "you" and grey tints (`#EDEDEA`, `#8A8A85`, `#4A4A47`) for comparisons. Never more than one accent on screen at once in a chart.
- The `--ai` token is removed; AI uses the same accent. One accent = one meaning: "act / twin".
- Light mode exists and is equally polished, but default theme is `dark`.
- Contrast: all text ≥ 4.5:1, verify the lime on black for small text (use it for fills and large text; use `--foreground` for small labels on accent surfaces).

### 2.3 Typography
- Replace Inter with **Geist Sans** for UI and **Geist Mono** for numbers/scores (`next/font` or the `geist` package). Use `font-variant-numeric: tabular-nums` on every number.
- Scale: 12 / 14 / 16 / 20 / 28 / 40 / 56. Headings `font-medium` with `tracking-tight`; avoid heavy 700 everywhere.
- Big numbers (scores, hours) are the visual anchor of cards — Geist Mono, 40px.

### 2.4 Layout & spacing
- 4px grid; card padding 20/24; radius 12 (cards), 999 (pills), 8 (inputs).
- Max content width 1200px; sidebar collapses to a 64px **icon rail** (expand on hover / pin).
- Cards: `surface-1`, 1px `border`, **no shadows in dark mode**, subtle inner highlight on hover (`SpotlightCard`, see §3).
- Disable the Next dev indicator overlap: `devIndicators: false` in `next.config.ts` (or move to `bottom-right`).

---

## 3. Motion & 3D — curated, use ONLY these

Install React Bits components via the shadcn registry in the **TS + Tailwind** variant:
```bash
npx shadcn@latest add @react-bits/<ComponentName>-TS-TW
```
Before installing, open the component on https://reactbits.dev to confirm the exact name and props; if a name below has changed, pick the closest equivalent and note it in the PR. Put them under `src/components/bits/` (move after install if the CLI puts them elsewhere), recolour every one to the tokens above (no hardcoded purples from their demos), and wrap each in a `useReducedMotion()` guard that renders the static end state.

| Where | Component | Why |
|---|---|---|
| Landing hero headline | **BlurText** (by words, once) | Calm reveal, no gimmick |
| Landing rotating line "…your timetable / your gym / your money" | **RotatingText** | Explains "everything in one place" visually |
| Landing background | **Threads** *or* **DotGrid** at ≤10% opacity in grey with accent on cursor proximity | Texture, not noise; pick one, not both |
| Landing feature grid | **MagicBento** (spotlight + border glow only; disable particles/tilt) | One grid explains the 4 differentiators |
| Scores / hours everywhere | **CountUp** (once on first view) | Numbers feel alive without looping |
| All cards in app | **SpotlightCard** (spotlight colour = `rgba(212,242,90,0.06)`) | Subtle hover affordance |
| Section entrances | **AnimatedContent** / **FadeContent** (12px rise, 300ms, stagger 40ms) | Consistent entrance language |
| Onboarding wizard | **Stepper** | Shows progress + resumability |
| Primary CTA on landing only | **StarBorder** (accent, slow) | One special button on the whole site |
| Jarvis overlay core | **Orb** (hue shifted to lime/neutral, `hoverIntensity` low) | The "awake" twin; voice-reactive (see §8) |
| Jarvis response text | **DecryptedText** (first line only) then plain streaming | Signature "Jarvis" feel, then readable |
| Notifications list / Today list | **AnimatedList** | Items arriving/leaving feel physical |

**Banned:** SplashCursor, BlobCursor, ClickSpark on everything, Ballpit, Hyperspeed, glitch text, any looping rainbow/gradient text, particle confetti. Max **one** WebGL canvas visible at a time (the twin *or* a background, never both).

**Motion tokens** (`src/components/motion/presets.ts` — rewrite):
- Durations: `fast 150ms`, `base 250ms`, `slow 450ms`. Easing: `[0.22, 1, 0.36, 1]` (out-quint) for enters, `[0.4, 0, 1, 1]` for exits. Springs: `{ stiffness: 380, damping: 32 }` for layout.
- Use `motion`'s `layout` + `AnimatePresence` for list reorders (priority engine re-ranking is a *signature moment* — tasks visibly slide into new order).
- Page transitions: 200ms cross-fade + 8px rise via a template-level wrapper; no full-page slides.

### 3.1 The 3D twin (rebuild `components/twin/twin-scene.tsx`)
Replace the cyan `MeshDistortMaterial` blob with a **particle-figure twin**:
- ~4,000–6,000 points (`THREE.Points` + custom `ShaderMaterial`) sampled on a soft abstract bust/silhouette *or* a sphere if no model is available (start with sphere; architecture must allow swapping a GLB-sampled point set later via `MeshSurfaceSampler`).
- Points are warm-white (`#EDEDEA`) with a small number (10–15%) tinted accent lime that represent "active commitments".
- **State → motion mapping** (keep the existing `TwinState` type):
  - `focused`: points tight, slow breathing (scale 1 ± 0.01, 0.2Hz).
  - `balanced`: gentle noise drift.
  - `stretched`: points pulled outward at the edges, faster drift, more accent points (the plan is "pulling" on you) — never red, never "sad".
  - `resting`: points settle, dimmer, very slow.
  - Transitions between states tween uniforms over 1.2s.
- Pointer: subtle parallax (max 4°). Click/tap on the twin opens Jarvis (§8).
- Performance: `dpr={[1, 1.75]}`, `frameloop="demand"` when off-screen (IntersectionObserver), `PerformanceMonitor` from drei to drop particle count on slow devices, lazy-load with `next/dynamic({ ssr: false })`, keep `twin-fallback.tsx` (CSS/SVG) for reduced motion, no WebGL, or `saveData`.
- Pulse-driven: the 5 Twin Pulse scores map to 5 subtle "bands" on the figure — tapping a pulse ring on Home highlights its band.

---

## 4. Information architecture (remove, merge, regroup)

### 4.1 Remove / merge
- Remove "Design system" from the public header (keep `/design-system` route but only when `process.env.NODE_ENV !== "production"`).
- Remove the always-on `TypingIndicator`; it only renders while a real request streams.
- Remove "Ask my twin" as a **sidebar page entry**. The twin lives in two places only: **(a)** the header twin button / ⌘J → Jarvis overlay, **(b)** a full `/twin` history page reachable from inside Jarvis ("Open full history").
- Merge **Momentum** into Twin Pulse (it is the headline number; the five domain scores sit under it). No more six equal cards.
- Merge "Goals & planning" + "Regreter & future self" under one **Plan** destination with tabs: *Goals*, *Time budget*, *Regreter*, *Future self*.
- Remove the 4 domain chips from the conflict banner; one line + one button.
- "What goes into this?" becomes an `(i)` icon button that opens a popover — not a text link on every card.
- Delete the "Soon" badge pattern entirely — every module ships in this redesign.

### 4.2 New navigation
Sidebar (icon rail, expandable), grouped:

```
Today        Home
             Tasks & focus          (was Productivity)
Plan         Plan                   (Goals · Time budget · Regreter · Future self)
Life         Academic · Health · Nutrition · Finance · Career
Review       Insights
─────────
(bottom)     Reminders (bell in header, not sidebar) · Settings & privacy · Profile menu
```

Header: logo · global search/quick add (⌘K) · reminders bell · theme toggle · **twin button (⌘J)** · avatar menu (Profile, Settings, Demo mode toggle, Log out).

Mobile bottom nav (5): Home · Tasks · **Twin (centre, raised)** · Plan · Life (opens a sheet with the 5 life modules).

Update `src/lib/navigation.ts` accordingly; remove the `upcoming` flag.

---

## 5. Phase 1 — Design system reset

1. Rewrite tokens in `globals.css` + `tokens.ts` per §2.2. Remove all purple/blue/cyan.
2. Swap fonts (§2.3).
3. Restyle shadcn primitives in `components/ui/*`: `button` variants = `primary` (accent fill), `secondary` (surface-2), `ghost`, `outline`, `destructive`; remove the `ai` variant (map callers to `primary`).
4. Rewrite `components/patterns/*`: `score-card`, `status-chip` (icon + label + colour), `conflict-banner`, `consequence-card`, `time-budget-bar`, `page-header`, `states` (empty/loading/error with *teaching* copy — every empty state says what this screen is for and offers the first action).
5. Install the curated React Bits set (§3) into `components/bits/`.
6. Rebuild the twin scene (§3.1).
7. Update `/design-system` to showcase the new tokens and components (dev only).

**Done when:** no purple/blue/cyan in `grep`, light + dark both pass contrast, `/design-system` shows every component in both themes, Lighthouse a11y ≥ 95 on that page.

---

## 6. Phase 2 — Authentication & onboarding (the missing gateway)

Use **Better Auth** with **Prisma + PostgreSQL** (the repo comment already anticipates Prisma). Email sending via **Mailjet** (already in the spec).

### 6.1 Backend wiring
- `prisma/schema.prisma`: Better Auth tables (`user`, `session`, `account`, `verification`) + `Profile` (dob, lifeStage, onboardingStep, regreterTone, traits JSON) + domain tables mirroring `domain/types.ts` (Commitment, Task, Subject, AttendanceRecord, Goal, WorkoutLog, MealLog, Expense, Investment, Habit, MoodCheckin, AiConsentLog, TwinMessage). Every domain row has `userId` and **every query in `repo.ts` filters by the session user** ("each user can only ever see their own rows").
- Providers: email + password (with email verification and password reset), Google OAuth.
- `src/proxy.ts` (Next 16's renamed middleware; use `middleware.ts` only if the installed Next version still requires it): protect `/(app)` and `/onboarding/*`; redirect unauthenticated users to `/login?next=…`; redirect authenticated users who haven't finished onboarding to their saved step.
- Also re-check the session inside each server action / route handler — the proxy is not the only guard.
- `repo.ts` becomes session-aware: `repo.forUser(userId).getTwinSnapshot()`. Keep the fixture path behind `DEMO_MODE` (see 6.4).

### 6.2 Screens (`src/app/(auth)/`)
- `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`.
- Layout: split screen on desktop — left: the particle twin slowly forming as the user types (state `balanced`); right: the form. Mobile: form only with a small twin at the top.
- Signup flow order: **Date of birth first** (age gate) → if under 13, show a kind block screen and do not create an account; if 13–17, show "Accounts for under-18s open once parental consent is in place" and do not create an account (per spec) → email/password or Google → verify email.
- Inline validation, password strength meter, show/hide password, Google button with official styling, clear error copy ("That email already has an account — log in instead?").
- Rate-limit auth endpoints; generic error on login failure (don't reveal whether the email exists).

### 6.3 Onboarding wizard (rebuild `onboarding/[step]`)
Steps: About you → Life stage (school / college / other — changes academic questions) → Academics → Health basics → Daily routine (wake/sleep, commute, meals) → Money → Career → Regreter tone → Privacy & AI consent → **"Meet your twin"**.
- React Bits **Stepper**; each step saves on "Next" (server action) and can be resumed; optional steps have "Skip for now".
- Health step: medical-condition checkbox shows the "talk to a doctor" note; no weight-loss targets if age < 20.
- Final step: the twin particle figure assembles from the user's answers (accent points appear for each commitment added), then a 3-card guided tour of Home: "This is your One Thing", "This is your Twin Pulse", "Press ⌘J any time to talk to your twin".
- Every answer that describes the user's habits/preferences is written to `Profile.traits` (used by Jarvis, §8).

### 6.4 Demo mode
- "Try the demo" on landing → `/demo` sets a signed, httpOnly `demo=1` cookie and loads fixtures through `repo`; writes are in-memory only and **never touch real accounts**. A persistent slim banner: "Demo — sample data. Create your own twin →".

**Done when:** a new user can sign up (email and Google), verify, finish onboarding, log out, log back in and land on Home with their own (initially empty) data; under-18 DOBs are blocked; `/home` without a session redirects to `/login`.

---

## 7. Phase 3 — Screen-by-screen redesign + build all "Soon" modules

Every screen follows the same skeleton: **Page header (title + one-line plain explanation) → the one action → the key numbers → details below the fold.** Every screen has a "first-time" empty state that teaches.

### 7.1 Landing (`/`)
- Header: logo · "How it works" · "Log in" · **"Try the demo"**.
- Hero: BlurText headline "One twin of you. Every part of your life, finally talking." + RotatingText line + short sub-copy + primary CTA (StarBorder) "Create your twin" + secondary "Try the demo".
- Right side: the live particle twin.
- **"How it works" in 3 steps** (big, visual, no jargon): 1. Add your week (timetable, gym, money) → 2. Your twin connects them → 3. See the cost before you decide. Each step has a tiny looping illustration made from real UI fragments (e.g., the Regret Preview card).
- **A live mini-demo**: an interactive card "You have DBMS assignment due tomorrow — Postpone?" with a toggle; flipping it animates tomorrow's bar from 4h to 6h. This one card sells the product.
- MagicBento with the 4 differentiators.
- Privacy strip: "Your data is yours. Export or delete any time. The twin asks before sending anything to AI."
- Footer.

### 7.2 Home (`/home`)
Order, top to bottom:
1. **Greeting + twin + One Thing** (single hero card). Left: twin (smaller than now, ~240px). Right: "Your one thing" title, one-sentence reason, two buttons: **Start now** (opens focus timer for that task) and **What if I postpone?** (opens Regret Preview sheet). The 3 bullet "brief" collapses into the reason sentence.
2. **Conflict line** (only if conflict exists): "Today needs 6h 15m — you have 4h 30m." + **Fix my day** (opens a sheet with a proposed rebuilt day; the user accepts/edits; nothing changes without consent).
3. **Twin Pulse**: one row. Momentum as the large number on the left (CountUp), five compact **ring gauges** (Academic, Fitness, Productivity, Career, Routine) on the right, each with value + trend arrow. Tap → popover with meaning + inputs + "Ask about this". No paragraphs by default.
4. **Today timeline**: vertical timeline of commitments with "Fixed / Flexible" tags and a "now" line; drag to reorder flexible items.
5. **Quick actions**: 6 compact chips (task, workout, meal, study, expense, goal) — each completes in ≤3 taps via the Quick Add sheet.

### 7.3 Tasks & focus (`/productivity`)
Priority-ranked task list with animated re-ranking + "Why this order?" popover; focus timer (full-screen optional, twin dims to `focused`); habits; 28-day consistency score; Life heatmap (week × domain, greyscale intensity with accent for today).

### 7.4 Plan (`/plan` with tabs; redirect `/goals` and `/regreter`)
- **Goals**: cards with progress + deadline; Goal Conflict Detector as a single horizontal bar "Goals need 18h · you have 16h · short by 2h".
- **Time budget**: the day as a stacked bar (sleep, classes, commute, meals, free); Recovery Mode button after misses → tonight / tomorrow / later columns.
- **Regreter**: Regret Preview (Complete now vs Postpone side by side), Cost Receipts (receipt-styled cards with one-tap recovery), Plan-in-3 (wish / obstacle / if-then), tone setting (Gentle / Balanced / Direct / No Mercy — never insulting), Sunday Review, Fresh-Start Reset, Future-Self Letter, guardrails visible in settings, effectiveness view (nudges acted on, by tone).
- **Future self**: sliders (study hours, gym days, sleep, attendance) → today / 3-day / 7-day projections; FutureMe two-path chart. Always framed with the `simulation` dashed style and "Prototype simulation" label.

### 7.5 Academic (`/academic`)
Subjects (difficulty, importance, credits), timetable week view, attendance with **one-tap present/absent** and **bunk budget** ("You can miss 2 more DBMS classes" / "Need 4 to recover"), assignments, exams, grades, backlogs, CGPA what-if sliders, academic risk (Low/Med/High with reasons), deadline cascade visualised as a 4-step chain (missed assignment → internals → grade → CGPA).

### 7.6 Health (`/health`) — build fully
Workout logger (exercises, sets × reps × weight, PRs auto-detected, weekly volume and consistency), weight log, sleep log, BMI (adult categories ≥ 20; BMI-for-age percentile with sex for < 20), protein range + per-meal split, water calculator + quick-log (+250ml taps), calorie estimate **adults only**, 5-second mood/energy check-in (5 faces/1 slider). Safety: no weight-loss targets under 20; doctor note if a medical condition is set. Persistent "Not medical advice" footer.

### 7.7 Nutrition (`/nutrition`) — build fully
Searchable Indian food table (seed JSON of common foods: roti, dal, rice, paneer, idli, dosa, poha, upma, rajma, chole, curd, etc. with per-serving macros); **natural-language logging** "2 rotis and dal" → parsed preview card → user confirms → saves; unmatched items marked "Estimate"; macros vs targets as 4 thin bars; saved meals; allergy warnings (blocking banner before saving a flagged item). Never show weight/food nudges from Regreter.

### 7.8 Finance (`/finance`) — build fully
Income, monthly budget, expenses by category (donut in greys + accent for the biggest), subscriptions with renewal dates, savings goals, **projected month-end** line (actual solid, projection dashed). Investments: stocks, MFs, FDs, SIPs with invested vs current value; live prices only where an API key is configured, otherwise manual; persistent "Tracking only, not financial advice".

### 7.9 Career (`/career`) — build fully
Target role; skills with levels (1–5) vs role requirements → gap chart (horizontal bars, you = accent, required = grey outline); certifications; projects; placement status; roadmap as a vertical milestone list with "Draft with twin" (AI).

### 7.10 Insights (`/insights`) — build fully
Weekly Twin Review (went well / slipped / next week's focus); Twin Evolution (30-day sparkline per pulse score); Life Graph (correlations like sleep vs study) **only after ≥ 21 days of data**, labelled "Pattern, not proof" — before that, an empty state with a progress ring "9 of 21 days collected"; achievements (meaningful milestones only).

### 7.11 Reminders (header bell + `/settings/reminders`)
In-app notification centre (AnimatedList), email reminders via Mailjet, quiet hours, daily cap; neutral wording only — no health or money details in notifications/emails.

### 7.12 Settings & privacy (`/settings`)
Profile, Regreter tone + guardrails, AI consent history (every request: when, what was sent, which feature), **Export all data** (JSON zip), **Delete account** (typed confirmation), connected accounts, theme, Jarvis shortcut customisation, guardian view (disabled with explanation).

### 7.13 PWA
`app/manifest.ts`, icons, service worker (e.g. Serwist) with offline queue for logging (task done, water, workout set, expense) that syncs when online; offline banner.

**Done when:** no stub screens remain; every module reads/writes through `repo` with the session user; each screen has empty, loading (skeleton), error and populated states; mobile layouts verified at 360px.

---

## 8. Phase 4 — Make "Ask my twin" work + build **Jarvis mode**

### 8.1 Working twin chat (fix the broken feature first)
- Route handler `src/app/api/twin/chat/route.ts` (POST, streaming). Use **Google Gemini** via `@google/genai` (model name from `process.env.GEMINI_MODEL`, key from `GEMINI_API_KEY`, server-side only — never exposed to the client). The Vercel AI SDK (`ai` + `@ai-sdk/google` + `useChat`) is an acceptable alternative for streaming + tool calling; pick one and use it consistently.
- **Grounding via tools, not prompt-stuffing.** Give the model function tools that call `repo.forUser(userId)`: `getTodayPlan`, `getTimeBudget`, `getPulseScores`, `getAcademicStatus`, `getTasks`, `getGoals`, `simulatePostpone(taskId)`, `proposeDayRebuild(constraints)`, `logEntry(type, payload)` (meal/expense/workout — returns a *draft* only), `getUserTraits`.
- Every answer returns **"numbers used" chips** (the existing chip UI in the screenshot is good — keep it) built from tool results, so the user sees what the answer came from.
- **Write actions are proposals.** Anything that changes data (rebuild week, add task, log meal) renders a confirm card: *Apply* / *Edit* / *Dismiss*. Nothing changes without a tap.
- **Consent gate:** before the first request in a session (and whenever new data categories would be sent), show `ConsentSheet` listing exactly what will be sent; log to `AiConsentLog`. Respect a "never send health data" toggle.
- System prompt rules: answer from the user's numbers; say "I don't have that data yet" instead of guessing; never act as a doctor, dietitian or financial adviser; follow the user's Regreter tone but never insult; no food/weight nudges; if the user mentions distress or self-harm, stop planning talk, respond with care and show crisis resources for India (e.g. Tele-MANAS 14416) — this is non-negotiable.
- Persist conversations in `TwinMessage`; `/twin` shows history with search.
- Remove the fake `TypingIndicator`; show a real streaming state (twin pulses, tokens stream in).
- Rate-limit per user; graceful errors ("The twin couldn't reach the AI service — your data is safe. Try again.").

### 8.2 Jarvis mode — the summoned twin
A full-screen, voice-first command layer that "wakes up" on demand. It is the same agent as 8.1 with a different, more immersive surface.

**Waking it**
- Global shortcut: **⌘J / Ctrl+J** (configurable in Settings; avoid clashing with ⌘K quick add). Also: tap the twin anywhere, or the centre mobile nav button. Long-press on mobile = start listening immediately.
- Optional hands-free wake phrase "Hey Twin" — **off by default**, opt-in in Settings, only while the tab is visible, with a clear "listening" indicator. Never listen in the background without explicit consent.
- `Esc` or the same shortcut closes it. Focus is trapped while open; focus returns to the previous element on close.

**Wake sequence (≈700ms total, reduced-motion = instant fade)**
1. Page content scales to 0.98 and blurs (backdrop-filter 12px) behind a black 85% scrim.
2. The twin's particles stream from wherever the twin was on the page into the centre and condense into the **Orb** (React Bits Orb, recoloured lime/white).
3. A one-line greeting decrypts in (DecryptedText), personalised: "Evening, Het. DBMS is still your one thing — 2 hours left." (built from traits + current snapshot, no AI call needed for the greeting).

**Layout**
- Centre: the Orb. **Audio-reactive**: while listening, drive Orb intensity from mic amplitude (Web Audio `AnalyserNode`); while speaking, from the TTS/word boundary events; idle = slow breathing.
- Below: live transcript (what you said) → streamed answer → "numbers used" chips → any action cards.
- Bottom: input bar (type or hold Space / mic button to talk), and 3 context suggestions generated from the current page + snapshot ("Rebuild tonight", "What if I skip gym?", "Log 2 rotis and dal").
- Top-right: "Open full history", mute voice, close.

**Voice**
- Speech-to-text: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) with `en-IN` default and Hindi option; feature-detect and fall back to typing gracefully (Firefox/Safari limitations). Optionally a server STT route later.
- Text-to-speech: `speechSynthesis` with a user-selectable voice; voice replies are **opt-in** (default: text only). Interruptible — speaking again stops TTS.

**Personalisation from the user's traits**
- `Profile.traits` (JSON) holds stated traits from onboarding and Settings: chronotype (morning/night), preferred study block length, tone, motivation style, typical procrastination window, gym days, diet type, allergies, goals.
- Behavioural signals (task completion by hour, which nudge tones get acted on, postponement patterns) are computed **from the user's own logs** and shown to the user in Settings → "What your twin has learned", where each item can be edited or deleted. Nothing hidden.
- Traits shape: greeting, suggestion chips, plan proposals (e.g., schedules deep work in the user's productive hours), and response length/tone. Traits are passed to the model via the `getUserTraits` tool, not dumped into every prompt.

**Agent capabilities in Jarvis (all via the same tools; writes require confirmation)**
- "Rebuild today/this week, keep the gym" → proposal diff (before/after timeline) → Apply.
- "What if I postpone X?" → Regret Preview card inline.
- "Log …" (meal, expense, workout, water) → parsed draft → Confirm.
- "Start focus on X for 50 minutes" → closes Jarvis, starts timer.
- "Why is my academic score down?" → explanation + chips.
- "Navigate to finance" → routes there.

**Engineering**
- `src/components/jarvis/` → `JarvisProvider` (global state, shortcut listener mounted once in the app shell), `JarvisOverlay`, `useVoiceInput`, `useSpeech`, `useAudioLevel`, `jarvis-orb.tsx`.
- Lazy-load the overlay and Orb (`next/dynamic`) so they cost nothing until summoned; preload on hover of the twin button.
- Only one WebGL context: when Jarvis opens, pause the page twin canvas.
- Full keyboard + screen-reader support: `role="dialog"`, `aria-modal`, live region for streamed answers, visible "Listening…" text, not only animation.

**Done when:** ⌘J opens Jarvis from every app screen; typed and spoken questions get grounded, streamed answers with "numbers used"; a proposed rebuild can be applied and is reflected on Home; consent is asked and logged; works with voice unsupported (typing only); reduced-motion users get no particle travel.

---

## 9. Quality bar (applies to every phase)

- **Accessibility:** WCAG 2.2 AA. Status never by colour alone (icon + label). Focus rings = 2px accent. All interactive elements ≥ 44px on touch. `prefers-reduced-motion` respected everywhere (React Bits guard + motion `MotionConfig reducedMotion="user"`).
- **Performance:** LCP < 2.5s on mid-range Android (4G); JS on `/home` first load < 200KB gz excluding the lazy twin; WebGL lazy + paused off-screen; images via `next/image`.
- **Copy:** sentence case, plain words, numbers with units ("2h 15m", "₹4,200"), INR formatting via `Intl.NumberFormat('en-IN')`.
- **States:** every data view has loading (skeleton matching final layout), empty (teaches + first action), error (what happened + retry), and populated.
- **Security/privacy:** session checked in every server action/route; per-user row filtering in `repo`; no personal data in notifications/emails; AI keys server-only; consent log.
- **Testing:** Vitest for domain calculations (bunk budget, CGPA what-if, time budget, BMI/age logic, protein range, projections); Playwright e2e for signup → onboarding → home, demo mode, Fix my day, Jarvis open/ask/apply.
- **Code hygiene:** keep the `repo` boundary; no fixtures imported in screens; components ≤ ~200 lines; colours only via tokens.

---

## 10. Deliverables & order of work

1. Phase 1 — Design system reset + new twin (PR 1).
2. Phase 2 — Auth, age gate, onboarding, demo mode, Prisma schema (PR 2).
3. Phase 3 — Landing + Home + Tasks + Plan + Academic redesign (PR 3), then Health, Nutrition, Finance, Career, Insights, Reminders, Settings, PWA (PR 4).
4. Phase 4 — Working twin chat API, then Jarvis mode (PR 5).

For each PR: a short summary, before/after screenshots (desktop dark, desktop light, mobile dark), list of removed elements, and any React Bits component name changes.

**Environment variables to add to `.env.example`:**
```
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
MAILJET_FROM_EMAIL=
GEMINI_API_KEY=
GEMINI_MODEL=
MARKET_DATA_API_KEY=        # optional, for live investment prices
```

Start with Phase 1. Before writing code, list the files you will change and the purple/blue values you found, then proceed.
