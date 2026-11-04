# Jarvis — inspection (phase I)

Findings before any feature code, per the PIM brief. Three things here change
the shape of the work, and they are flagged **FINDING** so they are not missed:
the reference repo's licence, the absence of a write layer for the models the
suggestion engine must mutate, and the browser's limits on the voice loop.

---

## I1. The reference repo — `FatihMakes/Mark-LVI`

Cloned read-only to a scratch directory, reviewed, and deleted. Nothing was
copied.

### FINDING 1 — the licence forbids reuse of the code

`LICENSE` is **Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0)**,
not MIT or Apache:

> Copyright (c) 2026 FatihMakes … Commercial use is not permitted.

Two consequences:

- **No code may be copied into MINI_TWIN**, not even a function, unless this
  product is permanently non-commercial *and* carries attribution. A student
  product that might later charge for anything cannot take that risk, and
  removing it afterwards means unpicking it from everything built on top.
- **Techniques and ideas are not restricted.** Copyright protects expression,
  not the insight that an amplitude number should drive a visual. Everything
  below is therefore recorded as *what they learned*, to be re-implemented from
  scratch in TypeScript against our own tokens.

I have assumed we take inspiration only. **Tell me if you have a different
arrangement with the author** and I will revisit.

### What it actually is

A **Python 3 / PyQt6 desktop application** — 65 `.py` files, zero TypeScript.
It runs on the user's machine and controls it: `pyautogui` moves the mouse,
`mss`/`opencv` read the screen, it opens and closes applications and deletes
files. Voice runs on the **Gemini Live API** (bidirectional audio streaming),
with offline `faster-whisper` and `piper-tts` as alternatives.

None of that can be "connected directly" to a Next.js web app, and the reason
is not the language. Mark LVI's value is OS control, which a web server cannot
and must not have over a visitor's machine. Its architecture is therefore
inapplicable; its *craft* is worth taking.

### Technique 1 — one audio level, computed once

From `core/avatar.py`:

> Lip-sync comes from the audio pipeline, not from the avatar. `main.py`
> already computes a real RMS level off the PCM for both the mic and JARVIS's
> own output. The avatar just consumes that number, **so there is no second
> audio path to fall out of sync**.

**Adopt.** One `AnalyserNode` produces one number; the orb consumes it. The
temptation in a browser is to let the orb do its own `getUserMedia`, which
gives two capture paths that drift apart.

### Technique 2 — the orb must not lip-sync to the user

> The mouth only tracks the level while JARVIS is *speaking* — during listening
> the same level drives the aura, so the head never lip-syncs to the user's
> voice.

**Adopt.** Same number, different visual channel per state: listening drives a
halo, speaking drives the core. Otherwise the twin appears to mouth the user's
words back at them, which reads as mockery.

### Technique 3 — calibrate to the room, never to a constant

`avatar.py` keeps `_v_peak`, a decaying estimate of *this voice's* loud level,
and derives the silence floor as a fraction of it. `core/echo.py` argues the
general case at length:

> A single tuned number is wrong for almost everyone: too eager on a loud
> desktop speaker, too deaf on a quiet laptop.

**Adopt.** A hard-coded amplitude threshold means the orb is dead for a quiet
laptop mic and pinned for a loud headset. A running peak with decay
self-calibrates in seconds.

### Technique 4 — the echo tail

`core/echo.py` exists because writing to an audio device returns when the
buffer accepts the audio, not when the room is finished with it — so a mic
streaming during that gap hears the assistant's own last sentence and answers
itself. Their solution is spectral subtraction plus a learned echo gain.

**Do not port.** It is a hard DSP problem and it is solving a *continuous
listening* design. **Push-to-talk sidesteps it entirely**: the mic is only open
while a button is held, and opening it cancels any speech in progress. That is
a design choice that deletes the problem rather than solving it.

### Technique 5 — render without a GPU, deliberately

> Everything is QPainter, so there is no OpenGL context, no shader compile, no
> GPU driver to disagree with us.

**Adopt, and we already have the piece.** The orb should be built from the
existing `twin-fallback.tsx` SVG sampler, not a second WebGL canvas. This also
satisfies the standing one-canvas rule — and the Home canvas already pauses
while Jarvis is open (shipped in `17ed358`).

### Not adopted

Their conversation surface is a PyQt HUD with a holographic head; the layout
idioms do not transfer to a web document, and our design system already has a
chat thread. Continuous wake-word listening is out: it means a hot mic, which
is the wrong default for a student product holding health and money data.

---

## I2. What already exists in MINI_TWIN

Substantially more than the brief assumes — much of M1 and M4 shipped in the
previous round.

| Concern | Path | State |
|---|---|---|
| Streaming chat endpoint | `src/app/api/twin/chat/route.ts` | **Built** — NDJSON stream, consent gate, rate limit |
| Model adapter + tool loop | `src/lib/integrations/twin-llm.ts` | **Built** — function calling, 9 call sites, CRLF-safe SSE |
| Tool declarations + prompt | `src/lib/domain/twin.ts` | **Built** — 10 tools, safety rules, Tele-MANAS |
| Tool execution (user-scoped) | `src/lib/data/twin.repo.ts` | **Built** |
| Chat UI, real token streaming | `src/components/twin/twin-chat.tsx` | **Built** — fake typing indicator removed |
| Jarvis overlay + ⌘J | `src/components/twin/jarvis*.tsx` | **Built** — focus trap, lazy load, canvas pause |
| Reminder engine | `src/lib/domain/calc/reminders.ts` | **Built** — quiet hours, daily cap, `FORBIDDEN_IN_COPY` |
| Notification bell | `src/components/shell/notification-bell.tsx` | **Built** |
| Session helpers | `src/lib/auth/session.ts` | `requireViewer` / `requireUser` / `requireWriter` |
| Twin visual + SVG fallback | `src/components/twin/twin-{visual,fallback}.tsx` | **Built** |

Model: **Gemini via REST**, no SDK — `gemini-3.5-flash`, chosen by testing
(`3.8`, `3.7` and `flash-latest` all returned 503; `3.1-flash-lite` invented a
meal from a 1×1 pixel). Function calling is wired, including the
`thoughtSignature` echo Gemini 3 requires.

**The data boundary already holds.** `rg "prisma\." src/app src/components`
returns nothing: every write goes through the repo layer. M6's first check
passes today.

**Not built:** voice (no `SpeechRecognition` or `speechSynthesis` anywhere),
the orb, Settings → "What your twin has learned", mobile-nav and tap-the-twin
summons, and the entire suggestion→action engine.

---

## I3. Reads and writes the engine needs

### Reads — all present

`getTodayPlan`, `getTimeBudget`, `getPulseScores`, `getAcademicStatus`,
`getTasks`, `getGoals`, `getNutritionToday`, all via `repo.forUser(userId)`.
Missing only `getUserContext` (traits + accept/decline history), needed by M5.

### FINDING 2 — the models the engine must mutate have no write layer at all

Counted across the whole of `src/lib`:

| Model | Existing write calls |
|---|---|
| **`task`** | **0** |
| **`commitment`** | **0** |
| **`goal`** | **0** |
| `mealLog` | 3 |
| `workoutSession` | 2 |
| `expense` | 2 |
| `weightLog` | 1 |
| `notification` | 4 |

Tasks, commitments and goals are **read-only in this build** — populated by
seed and fixtures, never written by any screen. There is no "add task" action
anywhere; `quick-add` lists a `task` mode with nothing behind it.

This is the single biggest finding. The three suggestion kinds the brief cares
most about — `reschedule_task`, `rebuild_day`, `adjust_goal` — therefore cannot
be built on an existing write path, because there is none. **M2 requires first
building the task / commitment / goal mutation layer**, which the rest of the
app will need anyway and which was presumably scheduled for a later phase.

Mapping each kind to its true cost:

| Suggestion kind | Underlying write | Status |
|---|---|---|
| `log_meal` | `logMeal` | **reuse** |
| `log_water` / `log_workout` / `log_expense` | existing actions | **reuse** |
| `snooze_reminder` | partial — `markRead` exists, snooze does not | small build |
| `reschedule_task`, `complete_task` | none | **new layer** |
| `rebuild_day` | none (bulk commitment reschedule) | **new layer** |
| `adjust_goal` | none | **new layer** |

### Invariants each executor must enforce

- `Commitment.flexibility = FIXED` never moves; `SHIFTABLE` may move within the
  day; `FLEXIBLE` may move freely.
- `Commitment.dependsOn[]` ordering must survive any rebuild.
- No two commitments may overlap: `start … start + minutes`.
- Money is **paise integers** (`amountMinor`) — never floats.
- No weight target for under-20s (`mayShowWeightGoal` already encodes this).
- Calendar dates are **UTC midnight** via `toCalendarDate` / `isoCalendarDate` —
  the convention fixed in `1d519f6`; a new executor that uses local midnight
  will silently write the wrong day.
- Photo-derived nutrition rows stay `isEstimate: true`.

---

## I4. Contracts

### Suggestion schema

The model proposes; **the server validates and executes**. Critically, the
executable `params` are rebuilt server-side from the tool's own lookup rather
than taken from model prose — a model that writes `{"taskId": "<any id>"}` must
not thereby reach another row.

```ts
type Suggestion = {
  kind: "reschedule_task" | "rebuild_day" | "log_meal" | "adjust_goal" | …;
  summary: string;        // shown as the card title
  rationale: string;      // why this helps THIS user
  diff: { before: string; after: string }[];
  params: Record<string, unknown>;   // validated per-kind by zod
  confidence: number;     // 0–1
  reversible: true;       // nothing irreversible is ever proposed
};
```

Persisted to a new `TwinSuggestion` row as `pending`, with `AppliedAction`
capturing prior values for undo and `SuggestionFeedback` recording declines.
Three new models, one migration.

**Apply is driven by `suggestionId` alone.** The client never sends `params`;
they are read from the stored row. Otherwise a crafted POST applies anything.

### Voice support matrix

| | `SpeechRecognition` | `speechSynthesis` |
|---|---|---|
| Chrome / Edge desktop | yes (`webkitSpeechRecognition`) | yes |
| Chrome Android | yes | yes |
| Safari (macOS/iOS) | partial, prefixed, unreliable | yes |
| **Firefox** | **no** | yes |

So: **typing is always the primary surface**; the mic is feature-detected and
simply absent where unsupported, with one line of explanation rather than a
dead button. Default `en-IN`, Hindi (`hi-IN`) selectable. Speaking is **opt-in,
off by default** — a product that talks out loud unasked in a library is one
people stop opening.

`SpeechRecognition` also sends audio to a **browser-vendor** service in Chrome.
That is a new data category and must pass the same consent gate as the model.

### Audio reactivity

`getUserMedia` → `AnalyserNode` → `getByteTimeDomainData` → RMS, smoothed,
normalised against a decaying running peak (Technique 3). While speaking, drive
the orb from `SpeechSynthesisUtterance.onboundary` instead, since we have no
output stream to analyse. Idle is a slow sine breath. All of it respects
`prefers-reduced-motion` by collapsing to a static state label.

### Personalisation inputs

`Profile.traits` (chronotype, study-block length, tone, gym days, diet) plus
accept/decline counts per kind, exposed as a `getUserContext` tool rather than
stuffed into every prompt — so it is fetched when relevant, enumerable for the
consent sheet, and visible in Settings.

---

## Proposed order, with revised costs

1. **Write layer for task / commitment / goal** — unavoidable prerequisite
   (FINDING 2), and valuable beyond Jarvis.
2. **M2 suggestion engine** — 3 models, executors, apply/decline/undo,
   transactions, idempotency.
3. **M3** — wire the inline cards (the UI exists and currently says
   *"Nothing is saved in this preview build"*).
4. **M4 voice + orb** — push-to-talk, feature detection, opt-in TTS.
5. **M5 personalisation**, **M6 review**, **M7 tests**.

---

## Questions before M

1. **Licence (FINDING 1).** I have assumed inspiration only, no copied code.
   Confirm, or tell me about an arrangement with the author.
2. **Scope of the write layer (FINDING 2).** Tasks, commitments and goals need
   mutations that do not exist. Build the full layer now, or start with
   `reschedule_task` + `complete_task` only and defer `rebuild_day`?
3. **Gemini quota.** The key is currently returning
   `429 You exceeded your current quota`. Voice and suggestions both multiply
   model calls. Is billing being enabled, or should I build against the null
   provider and have you test later?

No feature code has been written. Items 1 and 3 do not block starting item 1 of
the order above.
