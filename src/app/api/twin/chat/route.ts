/**
 * POST /api/twin/chat — the twin answers, streaming.
 *
 * A route handler rather than a server action because the response is a
 * stream: the answer should appear as it is written, not arrive whole after a
 * silence. The old screen faked that with a typing indicator that was always
 * on and never meant anything; this one has nothing to fake.
 *
 * The order of the guards is deliberate. Session, then demo, then consent,
 * then rate limit, then the model — each refusal is cheaper than the one after
 * it, and the user's hourly allowance is only spent on a request that could
 * actually have been answered.
 *
 * The frame protocol is newline-delimited JSON rather than SSE: the client is
 * our own `fetch` reader, not an `EventSource`, and NDJSON needs no framing
 * ceremony. Each line is one of:
 *
 *   {"type":"text","delta":"…"}       a token, append it
 *   {"type":"tool","name":"getTasks"} a number being fetched, for the UI
 *   {"type":"used","used":[…]}        the "numbers used" chips
 *   {"type":"proposal","proposal":{…}} an Apply / Dismiss card
 *   {"type":"error","message":"…"}    shown to the user as written
 *   {"type":"done","messageId":"…"}
 */

import { requireWriter } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db";
import {
  logConsent,
  recentTurns,
  runTwinTool,
  saveTurn,
  type UsedNumber,
} from "@/lib/data/twin.repo";
import { suggestionsRepoForUser, type SuggestionView } from "@/lib/data/suggestions.repo";
import {
  TWIN_CONSENT_CATEGORIES,
  TWIN_CONSENT_FEATURE,
  TWIN_TOOLS,
  twinSystemPrompt,
} from "@/lib/domain/twin";
import { getTwinLlm, type LlmTurn } from "@/lib/integrations/twin-llm";
import { consume } from "@/lib/rate-limit";
import { twinChatSchema } from "@/lib/validation/twin";

/** Generous for conversation, low enough to bound a leaked session's cost. */
const CHAT_LIMIT = { limit: 40, windowSeconds: 60 * 60 } as const;

export async function POST(request: Request) {
  let writer;
  try {
    writer = await requireWriter();
  } catch {
    return Response.json({ error: "Sign in to ask your twin." }, { status: 401 });
  }

  if (writer.kind === "demo") {
    return Response.json(
      {
        error:
          "Demo mode cannot send anything to an AI model — there is no account behind it. Sign up to ask your twin about your own numbers.",
      },
      { status: 403 },
    );
  }

  const { userId } = writer;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That request did not arrive intact." }, { status: 400 });
  }

  const parsed = twinChatSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "That message could not be sent." },
      { status: 400 },
    );
  }

  const { message, threadId, healthDataAllowed } = parsed.data;

  const verdict = await consume(
    `twin-chat:${userId}`,
    CHAT_LIMIT.limit,
    CHAT_LIMIT.windowSeconds,
  );

  if (!verdict.ok) {
    return Response.json(
      {
        error: `That is a lot of questions in one hour. Try again in ${Math.ceil(
          verdict.retryAfterSeconds / 60,
        )} minutes.`,
      },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } },
    );
  }

  const llm = getTwinLlm();

  /* Recorded before anything is sent, so the log reflects what the user
     agreed to even if the model call then fails. */
  await logConsent(userId, {
    feature: TWIN_CONSENT_FEATURE,
    categories: healthDataAllowed
      ? TWIN_CONSENT_CATEGORIES
      : TWIN_CONSENT_CATEGORIES.filter((c) => !c.startsWith("Food")),
    summary: healthDataAllowed
      ? "One question, with today's plan, academics, tasks, goals and pulse available on request."
      : "One question, with health and food data withheld.",
  });

  const suggestions = suggestionsRepoForUser(userId);

  const [profile, account, history, acceptance] = await Promise.all([
    getPrisma().profile.findUnique({ where: { userId }, select: { traits: true } }),
    getPrisma().user.findUnique({ where: { id: userId }, select: { name: true } }),
    recentTurns(userId, threadId),
    /* What the user has done with past suggestions, so a kind they keep
       declining is offered more sparingly rather than endlessly re-pitched. */
    suggestions.acceptanceByKind(),
  ]);

  await saveTurn(userId, threadId, { author: "USER", text: message });

  const system = twinSystemPrompt({
    firstName: (account?.name ?? "").trim().split(/\s+/)[0] || null,
    localTime: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    traits: traitLines(profile?.traits),
    healthDataAllowed,
    acceptance,
  });

  const turns: LlmTurn[] = [
    ...history.map((row): LlmTurn =>
      row.author === "USER"
        ? { role: "user", text: row.text }
        : { role: "model", text: row.text },
    ),
    { role: "user", text: message },
  ];

  const encoder = new TextEncoder();

  /* Accumulated across the stream so the finished answer can be stored with
     the numbers it used — the chips have to survive a page reload. */
  let answer = "";
  const used: UsedNumber[] = [];
  let suggestion: SuggestionView | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (frame: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));

      try {
        for await (const event of llm.answer({
          system,
          history: turns,
          tools: TWIN_TOOLS,
          signal: request.signal,
          runTool: async (call) => {
            const run = await runTwinTool(userId, call, { healthDataAllowed });

            for (const number of run.used) {
              /* De-duplicated: a model that reads the time budget twice should
                 not put the same chip on screen twice. */
              if (!used.some((u) => u.label === number.label && u.value === number.value)) {
                used.push(number);
              }
            }

            /*
             * Persisted here, as it is produced, so the card the user sees
             * carries a real id. Apply later reads params from this row —
             * never from the client — which is what makes the thing executed
             * the same as the thing shown.
             *
             * Last one wins: two cards for one answer would ask the user to
             * apply two changes with one decision.
             */
            if (run.suggestion) {
              const stored = await suggestions.create(run.suggestion);

              /* `create` returns null when the model's params are malformed.
                 No card is better than one that cannot be applied. */
              if (stored) suggestion = stored;
            }

            return run.result;
          },
        })) {
          if (event.type === "text") {
            answer += event.delta;
            send({ type: "text", delta: event.delta });
          } else if (event.type === "tool-start") {
            send({ type: "tool", name: event.name });
          } else if (event.type === "error") {
            send({ type: "error", message: event.message });
          }
        }

        if (used.length > 0) send({ type: "used", used });
        if (suggestion) send({ type: "suggestion", suggestion });

        const messageId = answer.trim()
          ? await saveTurn(userId, threadId, {
              author: "TWIN",
              text: answer.trim(),
              sources: used,
              proposal: suggestion ?? undefined,
            })
          : null;

        send({ type: "done", messageId });
      } catch (error) {
        console.error(
          `[twin/chat] ${error instanceof Error ? error.message : "unknown error"}`,
        );

        send({
          type: "error",
          message: "Your twin stopped mid-answer. Nothing was changed — try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      /* Stops a proxy buffering the whole answer and delivering it at once,
         which would reintroduce exactly the silence this endpoint exists to
         remove. */
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * `Profile.traits` as sentences for the prompt.
 *
 * Defensive about shape because it is a Json column written by several
 * screens: a trait that is not a string is skipped rather than stringified
 * into "[object Object]" and shown to the user as something they said.
 */
function traitLines(traits: unknown): string[] {
  if (!traits || typeof traits !== "object" || Array.isArray(traits)) return [];

  return Object.entries(traits as Record<string, unknown>)
    .filter(([, value]) => typeof value === "string" || typeof value === "number")
    .map(([key, value]) => `${humanise(key)}: ${value}`)
    .slice(0, 12);
}

function humanise(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
}
