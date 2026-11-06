# Gemini produced no output — root cause and fix

**Symptom.** "Ask my twin" and the Nutrition photo analysis returned nothing.
The key was valid and in `.env`, and nothing crashed.

It was **three separate faults wearing the same blank screen**, which is why
it resisted a single explanation. Each had to be removed before the next
became visible.

## What it was not

Ruled out first, in the order the brief asked:

| Checked | Finding |
|---|---|
| Retired model name (2.1) | **No.** ListModels with the real key returns 47 models supporting `generateContent`, and `gemini-3.5-flash` is among them. |
| Wrong SDK or endpoint (2.2) | **No.** No SDK is used; the repo calls the REST API directly — `v1beta/models/<model>:streamGenerateContent?alt=sse`, key in the `x-goog-api-key` header. Correct and current. |
| Key leaked to the client (2.2) | **No.** No `NEXT_PUBLIC_` prefix, never imported by a client component, no stray quotes in `.env`. |
| Response read from the wrong field (2.3) | **No.** `candidates[0].content.parts[]`, handling both `text` and `functionCall` parts. |
| Frontend not consuming the stream (2.3) | **No.** Verified at the HTTP layer with `curl -N`: frames arrive correctly. |

## Fault 1 — the whole answer could run for minutes

Each model call had a 60s timeout and the tool loop allows six rounds, so the
ceiling was six minutes. Measured: `POST /api/twin/chat` returned **nothing in
121 seconds**. A request that long has already failed in the only way a user
measures.

Fixed with a 120s wall-clock backstop for the whole exchange, and by turning
thinking off — `gemini-3.5-flash` is a thinking model and every tool round
paid for it:

```
thinking on (default)   7727ms
thinkingBudget: 0       4644ms
```

The work here is reading numbers out of tool results and saying them plainly.
There is no chain of reasoning worth seconds of latency.

(`thinkingLevel: "low"` is rejected by this model with a 400. Only
`thinkingConfig.thinkingBudget` works.)

## Fault 2 — the timeout cut off answers that were working

Replacing the long timeout with a shorter one made it worse in a more
interesting way:

```
{"type":"text","delta":"You have 13.5 hours free today..."}
{"type":"error","message":"Your twin stopped mid-answer."}
```

A fixed per-call timeout cannot tell a stalled connection from one that is
simply still talking, and it guillotined a healthy stream mid-sentence —
worse than either finishing or failing cleanly.

Replaced with an **idle timeout**: 20 seconds without a single byte, reset on
every chunk. That distinguishes exactly the two cases a timeout needs to tell
apart. A healthy stream is never interrupted; a dead one is still caught
quickly. An idle abort is also logged server-side, because "no data for 20s"
and "the model said nothing" look identical from outside and want different
fixes.

## Fault 3 — the free-tier quota was exhausted

With the first two fixed, the real answer appeared:

```
429 RESOURCE_EXHAUSTED
quota : generativelanguage.googleapis.com/generate_content_free_tier_requests
limit : 20
retry after: 11990s   (~3h20m)
```

**Twenty requests.** A day of diagnosis spends that easily. This is not
something code can fix, and the error was never surfaced clearly because the
request had always been timing out before it got that far.

Quota is per model, so the fix was to find one with headroom:

| Model | Result |
|---|---|
| `gemini-3.5-flash` | 429, exhausted |
| `gemini-2.5-flash` | 404 — retired |
| `gemini-2.5-flash-lite` | 404 — retired |
| `gemini-3.5-flash-lite` | 400 |
| **`gemini-3.1-flash-lite`** | **200** |

`GEMINI_MODEL=gemini-3.1-flash-lite`.

## Verified working

```
{"type":"tool","name":"getTimeBudget"}
{"type":"text","delta":"You have 13.5 hours free today, as you have no
                        tasks or commitments currently scheduled."}
{"type":"used","used":[{"label":"Available today","value":"13.5h"},
                       {"label":"Planned","value":"0h"}]}
{"type":"done","messageId":"cmw4hu1zb00025spd43d6nvz2"}
```

Thirteen seconds, grounded in the user's own numbers, with the "numbers used"
chips, persisted to the conversation.

## One caveat worth knowing before the demo

`gemini-3.1-flash-lite` is the model that **invented a plausible meal from a
1×1 pixel** during food-vision testing, where `gemini-3.5-flash` correctly
reported no food. For the twin chat that does not matter — the numbers come
from tools, and the model only phrases them. For **photo nutrition it
matters**, because the model is the only thing looking at the plate.

Every photo-derived row is labelled an estimate and nothing is saved until
the user confirms, so a bad reading is visible and correctable rather than
silent. Still: if the photo feature is being demonstrated, use a clear
picture of recognisable food and read the estimates aloud as estimates.

When `gemini-3.5-flash` quota resets (~3h20m from the 429, or sooner with
billing enabled), switching back is a one-line change to `GEMINI_MODEL`.
