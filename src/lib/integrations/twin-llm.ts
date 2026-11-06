/**
 * The model behind "Ask my twin", behind an interface.
 *
 * Two things distinguish this from the food-vision provider next door:
 *
 *   - **It streams.** The old screen showed a fake typing indicator that was
 *     always on and never meant anything. Real tokens arrive here as the model
 *     produces them, so the indicator is the answer appearing.
 *   - **It calls tools rather than being handed a context blob.** Grounding by
 *     prompt-stuffing means deciding up front what the question might need,
 *     sending all of it, and hoping. Tools mean the model asks for the two
 *     numbers it actually needs, we run those reads against the session user's
 *     own rows, and the answer can name exactly what it used. The privacy
 *     story follows from the same mechanism: what gets sent is what was asked
 *     for, and it is enumerable.
 *
 * Nothing here knows what a task or a meal is. It moves turns and tool calls;
 * the tools themselves live in the repo, where the `userId` scoping lives too.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * How long to wait for the NEXT byte, not for the whole answer.
 *
 * An earlier revision aborted each model call after a fixed 30s. That is the
 * wrong shape: a long answer streams for longer than that quite legitimately,
 * and the hard cap cut one off mid-sentence —
 *
 *     {"type":"text","delta":"You have 13.5 hours free today..."}
 *     {"type":"error","message":"Your twin stopped mid-answer."}
 *
 * which is worse than either finishing or failing cleanly. An idle timeout
 * distinguishes the two cases a timeout actually needs to tell apart: a
 * connection that has stalled, and one that is simply still talking. The
 * timer is reset on every chunk, so a healthy stream is never interrupted
 * and a dead one is still caught quickly.
 */
const IDLE_TIMEOUT_MS = 20_000;

/**
 * The wall-clock budget for an entire answer, tool rounds included.
 *
 * Without this the ceiling is MAX_TOOL_ROUNDS * TIMEOUT_MS, which is minutes:
 * a measured round trip to this model is 5-8 seconds even for one sentence,
 * because it is a thinking model. An answer that takes two minutes has
 * already failed in the only way the user measures, so the loop stops here
 * and says so rather than continuing to be technically in progress.
 */
const TOTAL_BUDGET_MS = 120_000;

/**
 * How many times the model may call tools before it has to answer.
 *
 * A ceiling, not a target. Without one, a model that keeps re-reading the
 * same number loops until the timeout and the user watches nothing happen.
 *
 * Six rather than four, which was measured rather than guessed. Asked to move
 * a deadline, the model spent its rounds on getTasks, getTasks again,
 * getAcademicStatus and getTodayPlan — reasonable groundwork — and then had
 * none left to call the propose tool, so it answered "I could not gather
 * everything I needed". The ceiling was cutting off the useful step, not a
 * runaway loop. With thirteen tools, exploring a few before acting is the
 * normal shape of an answer.
 */
export const MAX_TOOL_ROUNDS = 6;

/** An OpenAPI-subset schema, as Gemini's `functionDeclarations` expects. */
export type ToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
  /**
   * Gemini 3's opaque reasoning token for this call.
   *
   * It arrives attached to the functionCall part and MUST be sent back with
   * it. Omitting it fails the next round with
   * "Function call is missing a thought_signature in functionCall parts" --
   * a 400 that arrives only on the second round, so the tools appear to work
   * and then the answer never comes. Opaque to us: carried, never read.
   */
  thoughtSignature?: string;
};

/** One turn of the conversation as the model sees it. */
export type LlmTurn =
  | { role: "user"; text: string }
  | { role: "model"; text: string }
  | { role: "model"; calls: ToolCall[] }
  | { role: "tool"; name: string; result: unknown };

/** What the caller observes while an answer is produced. */
export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool-start"; name: string; args: Record<string, unknown> }
  | { type: "tool-done"; name: string }
  | { type: "error"; message: string };

export interface TwinLlm {
  readonly kind: "null" | "gemini";
  /**
   * Run one exchange to completion, streaming text as it arrives.
   *
   * `runTool` is supplied by the caller rather than registered here, because
   * executing a tool needs the session user and this module must never see
   * one.
   */
  answer(input: {
    system: string;
    history: LlmTurn[];
    tools: ToolSchema[];
    runTool: (call: ToolCall) => Promise<unknown>;
    signal?: AbortSignal;
  }): AsyncGenerator<StreamEvent>;
}

/* -------------------------------------------------------------------------- */
/*                                    null                                    */
/* -------------------------------------------------------------------------- */

/**
 * Used when GEMINI_API_KEY is absent.
 *
 * It says so plainly rather than staying silent, because a chat box that
 * accepts a question and produces nothing is indistinguishable from one that
 * is broken.
 */
export const nullTwinLlm: TwinLlm = {
  kind: "null",

  async *answer() {
    yield {
      type: "text",
      delta:
        "The twin's assistant is not switched on yet, so I can't answer in words. " +
        "Everything else on this screen still works from your own numbers.",
    };
  },
};

/* -------------------------------------------------------------------------- */
/*                                   gemini                                   */
/* -------------------------------------------------------------------------- */

type GeminiPart =
  | { text: string; thoughtSignature?: string }
  | {
      functionCall: { name: string; args?: Record<string, unknown> };
      thoughtSignature?: string;
    }
  | { functionResponse: { name: string; response: unknown } };

function toGeminiContents(history: LlmTurn[]): { role: string; parts: GeminiPart[] }[] {
  return history.map((turn) => {
    if (turn.role === "tool") {
      /* Gemini expects a tool result to come back as a "user" turn carrying a
         functionResponse part — it is an input to the model, not an output. */
      return {
        role: "user",
        parts: [{ functionResponse: { name: turn.name, response: { result: turn.result } } }],
      };
    }

    if ("calls" in turn) {
      return {
        role: "model",
        parts: turn.calls.map((call) => ({
          functionCall: { name: call.name, args: call.args },
          ...(call.thoughtSignature
            ? { thoughtSignature: call.thoughtSignature }
            : {}),
        })),
      };
    }

    return { role: turn.role, parts: [{ text: turn.text }] };
  });
}

/**
 * Split an SSE body into `data:` payloads.
 *
 * Written out rather than pulled in because it is short and the subtleties are
 * specific:
 *
 *   - **A chunk boundary can fall anywhere**, including inside a JSON object,
 *     so nothing is parsed until a blank line has been seen.
 *   - **Line endings are CRLF.** Google's endpoint separates frames with
 *     `



`, and an earlier version of this function split on `

`
 *     alone. It therefore never found a frame boundary, yielded nothing, and
 *     the answer came back empty with no error at all -- the model had
 *     replied, the HTTP call had succeeded, and the parser silently dropped
 *     every token. CRLF is normalised to LF before the split so both forms
 *     work and neither can regress quietly.
 */
export async function* sseEvents(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
  /** Called on every chunk, so the caller can reset its idle timer. */
  onChunk?: () => void,
): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) return;

      const { done, value } = await reader.read();
      if (done) break;

      onChunk?.();

      /* Normalised on arrival, so the split below only has one case to
         handle and a server that switches to bare LF keeps working. */
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let split: number;
      while ((split = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);

        const line = block.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;

        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          yield JSON.parse(payload);
        } catch {
          /* A malformed frame is skipped rather than ending the answer: the
             next one usually carries the rest of the sentence. */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function geminiTwinLlm(apiKey: string, model: string): TwinLlm {
  return {
    kind: "gemini",

    async *answer({ system, history, tools, runTool, signal }) {
      const turns: LlmTurn[] = [...history];
      const deadline = Date.now() + TOTAL_BUDGET_MS;

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
        if (Date.now() > deadline) {
          yield {
            type: "text",
            delta:
              "\n\nThat is taking longer than it should. Ask me again, or about one thing at a time.",
          };
          return;
        }

        const controller = new AbortController();
        const onAbort = () => controller.abort();
        signal?.addEventListener("abort", onAbort, { once: true });

        /* Logged because an idle abort is indistinguishable from a model
           that simply said nothing, and the two want different fixes. */
        let chunks = 0;
        const giveUp = () => {
          console.error(
            `[twin-llm] no data for ${IDLE_TIMEOUT_MS}ms (round ${round}, ${chunks} chunks so far)`,
          );
          controller.abort();
        };

        let timer = setTimeout(giveUp, IDLE_TIMEOUT_MS);
        const resetIdle = () => {
          chunks += 1;
          clearTimeout(timer);
          timer = setTimeout(giveUp, IDLE_TIMEOUT_MS);
        };

        let response: Response;
        try {
          response = await fetch(
            `${ENDPOINT}/${model}:streamGenerateContent?alt=sse`,
            {
              method: "POST",
              signal: controller.signal,
              headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: toGeminiContents(turns),
                /* Offered on every round. The last round still passes them so
                   the model is not forced into a tool-free answer mid-thought;
                   the round counter is what ends the loop. */
                tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
                generationConfig: {
                  /* Low: this answers from the user's own numbers, where
                     inventiveness is the failure mode, not the feature. */
                  temperature: 0.3,
                  maxOutputTokens: 1200,

                  /*
                   * Thinking off.
                   *
                   * Measured: the same one-sentence question costs 7.7s with
                   * thinking and 4.6s without, and a tool round trip pays it
                   * every time. The work here is reading numbers out of tool
                   * results and saying them plainly -- there is no chain of
                   * reasoning worth seconds of latency, and the user is
                   * watching an empty box while it happens.
                   */
                  thinkingConfig: { thinkingBudget: 0 },
                },
              }),
            },
          );
        } catch (error) {
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          yield { type: "error", message: describe(error) };
          return;
        }

        if (!response.ok || !response.body) {
          const detail = (await response.text().catch(() => "")).slice(0, 200);
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          yield {
            type: "error",
            message:
              response.status === 429 || response.status === 503
                ? "Your twin is busy right now. Try again in a moment."
                : "Your twin could not answer just now.",
          };
          console.error(`[twin-llm] ${response.status}: ${detail}`);
          return;
        }

        const calls: ToolCall[] = [];
        let text = "";

        try {
          for await (const event of sseEvents(response.body, controller.signal, resetIdle)) {
            const parts =
              (event as { candidates?: { content?: { parts?: GeminiPart[] } }[] })
                .candidates?.[0]?.content?.parts ?? [];

            for (const part of parts) {
              if ("text" in part && part.text) {
                text += part.text;
                yield { type: "text", delta: part.text };
              } else if ("functionCall" in part) {
                calls.push({
                  name: part.functionCall.name,
                  args: part.functionCall.args ?? {},
                  thoughtSignature: part.thoughtSignature,
                });
              }
            }
          }
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
        }

        /* No tool calls means the model has answered, and the loop is done. */
        if (calls.length === 0) return;

        if (round === MAX_TOOL_ROUNDS) {
          /* Out of rounds with the model still asking for data. Saying so is
             better than a confident answer built on whatever arrived first. */
          yield {
            type: "text",
            delta:
              "\n\nI couldn't gather everything I needed for that one. Try asking about one thing at a time.",
          };
          return;
        }

        if (text) turns.push({ role: "model", text });
        turns.push({ role: "model", calls });

        for (const call of calls) {
          yield { type: "tool-start", name: call.name, args: call.args };

          /* A tool that throws becomes a result the model can read and talk
             about, not an exception that ends the answer. "I don't have that
             yet" is a better outcome than a blank screen. */
          let result: unknown;
          try {
            result = await runTool(call);
          } catch (error) {
            result = { error: describe(error) };
          }

          turns.push({ role: "tool", name: call.name, result });
          yield { type: "tool-done", name: call.name };
        }
      }
    },
  };
}

export function getTwinLlm(): TwinLlm {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;

  if (!apiKey || !model) return nullTwinLlm;

  return geminiTwinLlm(apiKey, model);
}

export function twinLlmConnected(): boolean {
  return getTwinLlm().kind !== "null";
}

function describe(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "That took too long. Try asking again.";
  }

  return error instanceof Error ? error.message : "unknown error";
}
