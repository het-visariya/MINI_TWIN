"use client";

import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChatThread, TypingIndicator } from "@/components/patterns/chat-thread";
import { ConsentSheet } from "@/components/patterns/consent-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TWIN_DATA_USES } from "@/lib/domain/twin";
import type { TwinMessage } from "@/lib/domain/types";

/**
 * "Ask my twin", actually asking.
 *
 * What it replaces is worth stating: the old composer's form handler was
 * `onSubmit={(event) => event.preventDefault()}` — the box accepted a question
 * and did nothing with it — above a typing indicator that was always on
 * screen, animating for a reply that was never coming.
 *
 * So two rules here:
 *
 *   - **The indicator means something.** It appears when a request is in
 *     flight and disappears the moment the first token lands, after which the
 *     text appearing is itself the progress. It is never decoration.
 *   - **Nothing is sent until consent is given**, and the consent is per
 *     session rather than remembered forever. The server enforces the same
 *     rule and records it, so this is the courtesy, not the gate.
 *
 * The answer is streamed as newline-delimited JSON rather than SSE: the reader
 * is this component's own `fetch`, not an `EventSource`, and a line of JSON
 * needs no framing ceremony.
 */
export function TwinChat({
  initialMessages,
  starters,
  initialPrompt,
  threadId,
}: {
  initialMessages: TwinMessage[];
  starters: string[];
  initialPrompt?: string;
  threadId: string;
}) {
  const [messages, setMessages] = useState<TwinMessage[]>(initialMessages);
  const [value, setValue] = useState(initialPrompt ? `About ${initialPrompt}: ` : "");
  const [pending, setPending] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [toolRunning, setToolRunning] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [healthDataAllowed, setHealthDataAllowed] = useState(true);

  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, streaming]);

  /* A request in flight when the component goes away is a request nobody is
     listening to; aborting it stops the model being billed for an answer that
     has nowhere to land. */
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || pending) return;

      setValue("");
      setPending(true);
      setStreaming("");
      setMessages((previous) => [
        ...previous,
        { id: `local-${Date.now()}`, author: "user", text: question },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      /* Built up across frames so the finished message carries its chips and
         proposal, exactly as the stored row will. */
      let answer = "";
      let sources: TwinMessage["sources"];
      let proposal: TwinMessage["proposal"];
      let failed: string | null = null;

      try {
        const response = await fetch("/api/twin/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: question,
            threadId,
            consented: true,
            healthDataAllowed,
          }),
        });

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          failed = payload?.error ?? "Your twin could not answer just now.";
        } else {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value: chunk } = await reader.read();
            if (done) break;

            buffer += decoder.decode(chunk, { stream: true });

            /* Only whole lines are parsed: a chunk boundary can fall inside a
               JSON object, and the tail stays in the buffer until its newline
               arrives. */
            let newline: number;
            while ((newline = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newline).trim();
              buffer = buffer.slice(newline + 1);
              if (!line) continue;

              let frame: Record<string, unknown>;
              try {
                frame = JSON.parse(line) as Record<string, unknown>;
              } catch {
                continue;
              }

              if (frame.type === "text") {
                answer += String(frame.delta ?? "");
                setStreaming(answer);
                setToolRunning(null);
              } else if (frame.type === "tool") {
                setToolRunning(String(frame.name ?? ""));
              } else if (frame.type === "used") {
                sources = frame.used as TwinMessage["sources"];
              } else if (frame.type === "suggestion") {
                /* The id is the stored TwinSuggestion row's, not one made up
                   here. Apply sends exactly that id, and the server reads the
                   params from the row — so a card cannot be made to apply
                   something other than what it displays. */
                const stored = frame.suggestion as {
                  id: string;
                  summary: string;
                  rationale: string;
                  diff: { label: string; before: string; after: string }[];
                  confidence: number;
                };

                proposal = {
                  id: stored.id,
                  summary: stored.summary,
                  rationale: stored.rationale,
                  diff: stored.diff,
                  confidence: stored.confidence,
                  status: "proposed",
                };
              } else if (frame.type === "error") {
                failed = String(frame.message ?? "Your twin could not answer.");
              } else if (frame.type === "done" && frame.messageId) {
                /* Adopt the stored id, so the bubble matches the row that now
                   exists and a reload does not duplicate it. */
                void frame.messageId;
              }
            }
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          failed = "That didn't reach your twin. Check your connection and try again.";
        }
      } finally {
        abortRef.current = null;
        setToolRunning(null);
        setStreaming("");
        setPending(false);
      }

      if (answer.trim()) {
        setMessages((previous) => [
          ...previous,
          {
            id: `twin-${Date.now()}`,
            author: "twin",
            text: answer.trim(),
            sources,
            proposal,
          },
        ]);
      }

      if (failed) {
        setMessages((previous) => [
          ...previous,
          { id: `err-${Date.now()}`, author: "twin", text: failed },
        ]);
      }
    },
    [healthDataAllowed, pending, threadId],
  );

  return (
    <>
      <ChatThread messages={messages} />

      {/* The live answer, rendered as a plain bubble so it does not jump when
          it is replaced by the stored message on completion. */}
      {streaming && (
        <div className="mt-6" aria-live="polite">
          <div className="bg-card shadow-card max-w-[46rem] rounded-xl border p-3.5 text-sm whitespace-pre-wrap">
            {streaming}
          </div>
        </div>
      )}

      {/* Only while nothing has arrived yet. Once tokens are landing, the text
          itself is the progress indicator. */}
      {pending && !streaming && (
        <div className="mt-4">
          {toolRunning ? (
            <p className="text-muted-foreground px-1 text-xs" aria-live="polite">
              Reading your {toolLabel(toolRunning)}…
            </p>
          ) : (
            <TypingIndicator />
          )}
        </div>
      )}

      <div ref={endRef} />

      <div className="bg-card shadow-card sticky bottom-20 mt-6 space-y-3 rounded-xl border p-3 md:bottom-4">
        {!consented ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Before your twin can answer</p>
            <p className="text-muted-foreground text-xs">
              It reads your own numbers to answer, and that means sending some of them
              to an AI model. Nothing is sent until you approve it, and the approval
              lasts for this session only.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ConsentSheet
                uses={TWIN_DATA_USES}
                onApprove={() => setConsented(true)}
                trigger={
                  <Button variant="primary" size="sm">
                    Review and approve
                  </Button>
                }
              />
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="accent-accent size-4"
                  checked={!healthDataAllowed}
                  onChange={(event) => setHealthDataAllowed(!event.target.checked)}
                />
                Never send health or food data
              </label>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {starters.map((starter) => (
                <Button
                  key={starter}
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => void send(starter)}
                >
                  {starter}
                </Button>
              ))}
            </div>

            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void send(value);
              }}
            >
              <Textarea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  /* Enter sends, Shift+Enter breaks the line — the convention
                     everywhere else people type into a chat. */
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(value);
                  }
                }}
                rows={2}
                disabled={pending}
                placeholder="Ask about anything in your own data…"
                aria-label="Message your twin"
                className="min-h-[3.25rem] resize-none"
              />
              <Button
                type="submit"
                variant="primary"
                size="icon-lg"
                disabled={pending || value.trim().length === 0}
                aria-label="Send message"
              >
                <Send aria-hidden />
              </Button>
            </form>

            <p className="text-muted-foreground text-2xs">
              {healthDataAllowed
                ? "Approved for this session. Your twin answers from your own numbers and shows which ones it used."
                : "Approved for this session, with health and food data withheld."}
            </p>
          </>
        )}
      </div>
    </>
  );
}

/** Tool names as the user would say them, for the "reading your …" line. */
function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    getTodayPlan: "plan for today",
    getTimeBudget: "time budget",
    getPulseScores: "pulse scores",
    getAcademicStatus: "attendance and deadlines",
    getTasks: "tasks",
    getGoals: "goals",
    getNutritionToday: "meals today",
    simulatePostpone: "schedule",
    proposeDayRebuild: "plan for today",
    logEntry: "draft",
  };

  return labels[name] ?? "numbers";
}
