"use client";

import { Check, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  applySuggestion,
  declineSuggestion,
  undoAppliedAction,
} from "@/app/(app)/twin/actions";
import { ConsentSheet } from "@/components/patterns/consent-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanProposal, TwinMessage as Message } from "@/lib/domain/types";

/** The three-dot indicator shown while the twin is composing. */
export function TypingIndicator() {
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs">
      <span className="sr-only">Your twin is replying</span>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="bg-accent size-1.5 animate-pulse rounded-full"
          style={{ animationDelay: `${index * 160}ms` }}
          aria-hidden
        />
      ))}
    </div>
  );
}

/**
 * The negotiation primitive: a proposed plan the user can accept, edit or
 * decline. A proposal is never applied by being shown.
 */
function PlanProposalCard({ proposal }: { proposal: PlanProposal }) {
  const [status, setStatus] = useState(proposal.status);
  const [undoId, setUndoId] = useState<string | null>(proposal.appliedActionId ?? null);
  const [pending, setPending] = useState<"apply" | "decline" | "undo" | null>(null);

  /*
   * Lines to show. `diff` is the current shape; `changes` is what the demo
   * fixtures still carry, and they predate the suggestion engine. Supporting
   * both keeps demo mode honest rather than silently blank.
   */
  const lines =
    proposal.diff?.length
      ? proposal.diff.map((d) => ({ label: d.label, detail: `${d.before} → ${d.after}` }))
      : (proposal.changes ?? []);

  /**
   * Apply.
   *
   * Only the id is sent. The server reads the executable params from the
   * stored row, so this button cannot be made to apply something other than
   * what is written above it.
   */
  async function apply() {
    setPending("apply");

    const result = await applySuggestion(proposal.id);
    setPending(null);

    if (!result.ok) {
      /* A refusal is usually the plan having moved since the twin suggested
         this, and the server's sentence names the actual obstacle — so it is
         shown as written rather than replaced with something generic. */
      setStatus("superseded");
      toast.error(result.error);
      return;
    }

    setStatus("accepted");
    setUndoId(result.data.undoId);

    toast.success("Done — your plan is updated.", {
      /* Undo lives on the toast because that is where someone looks in the
         two seconds after realising they did not mean it. */
      action: result.data.undoId
        ? { label: "Undo", onClick: () => void undo(result.data.undoId!) }
        : undefined,
    });
  }

  async function decline() {
    setPending("decline");

    const result = await declineSuggestion(proposal.id);
    setPending(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setStatus("declined");
    /* Said out loud because it is a promise the product keeps: declining
       teaches the twin, it does not merely dismiss a card. */
    toast.info("Noted — your twin will offer this kind less often.");
  }

  async function undo(actionId: string) {
    setPending("undo");

    const result = await undoAppliedAction(actionId);
    setPending(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setStatus("proposed");
    setUndoId(null);
    toast.success("Reverted. Your plan is back as it was.");
  }

  return (
    <div className="border-accent/25 bg-accent/5 mt-3 rounded-lg border p-3">
      <p className="text-sm font-medium">{proposal.summary}</p>

      {proposal.rationale && (
        <p className="text-muted-foreground mt-1 text-xs">{proposal.rationale}</p>
      )}

      {lines.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {lines.map((change) => (
            <li key={change.label} className="text-xs">
              <span className="font-medium">{change.label}:</span>{" "}
              <span className="text-muted-foreground">{change.detail}</span>
            </li>
          ))}
        </ul>
      )}

      {status === "proposed" ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button
            variant="primary"
            size="sm"
            disabled={pending !== null}
            onClick={() => void apply()}
          >
            <Check aria-hidden />
            {pending === "apply" ? "Applying…" : "Apply"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending !== null}
            onClick={() => void decline()}
          >
            <X aria-hidden />
            Decline
          </Button>
        </div>
      ) : status === "accepted" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-ok text-xs font-medium">Applied to your plan.</p>
          {undoId && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending !== null}
              onClick={() => void undo(undoId)}
            >
              {pending === "undo" ? "Undoing…" : "Undo"}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground mt-3 text-xs font-medium">
          {status === "declined"
            ? "Declined. Your plan is unchanged."
            : "This changed since your twin suggested it — ask again for the current plan."}
        </p>
      )}
    </div>
  );
}

export function TwinMessageBubble({ message }: { message: Message }) {
  const isUser = message.author === "user";

  return (
    <div
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
      data-author={message.author}
    >
      {!isUser && (
        <span className="border-accent/25 bg-accent/10 text-accent mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full border">
          <Sparkles className="size-3.5" aria-hidden />
          <span className="sr-only">Your twin</span>
        </span>
      )}

      <div className={cn("min-w-0 max-w-[46rem]", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed",
            isUser
              ? "bg-accent text-accent-foreground rounded-br-md"
              : "bg-card rounded-bl-md border",
          )}
        >
          {message.text}
        </div>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.sources.map((source) => (
              <span
                key={source.label}
                className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs"
              >
                {source.label}
                <span className="tabular text-foreground font-medium">
                  {source.value}
                </span>
              </span>
            ))}
          </div>
        )}

        {message.consent && (
          <div className="mt-2">
            <ConsentSheet uses={message.consent} />
          </div>
        )}

        {message.proposal && <PlanProposalCard proposal={message.proposal} />}

        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {message.suggestions.map((suggestion) => (
              <Button key={suggestion} variant="outline" size="sm">
                {suggestion}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatThread({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col gap-6" role="log" aria-label="Conversation with your twin">
      {messages.map((message) => (
        <TwinMessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
