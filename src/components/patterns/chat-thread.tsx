"use client";

import { Check, Pencil, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConsentSheet } from "@/components/patterns/consent-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import type { PlanProposal, TwinMessage as Message } from "@/lib/domain/types";

/** The three-dot indicator shown while the twin is composing. */
export function TypingIndicator() {
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs">
      <span className="sr-only">Your twin is replying</span>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="bg-ai size-1.5 animate-pulse rounded-full"
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

  return (
    <div className="border-ai/30 bg-ai/5 mt-3 rounded-lg border p-3">
      <p className="text-sm font-medium">{proposal.summary}</p>

      <ul className="mt-2.5 space-y-1.5">
        {proposal.changes.map((change) => (
          <li key={change.label} className="text-xs">
            <span className="font-medium">{change.label}:</span>{" "}
            <span className="text-muted-foreground">{change.detail}</span>
          </li>
        ))}
      </ul>

      {status === "proposed" ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button
            variant="ai"
            size="sm"
            onClick={() => {
              setStatus("accepted");
              toast.success("Plan accepted", {
                description: "Nothing is saved in this preview build.",
              });
            }}
          >
            <Check aria-hidden />
            Accept
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.info("Opened for editing", {
                description: "Plan editing arrives with the planning engine.",
              })
            }
          >
            <Pencil aria-hidden />
            Change something
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setStatus("declined")}>
            <X aria-hidden />
            Decline
          </Button>
        </div>
      ) : (
        <p
          className={cn(
            "mt-3 text-xs font-medium",
            status === "accepted" ? "text-ok" : "text-muted-foreground",
          )}
        >
          {status === "accepted"
            ? "Accepted. You can change it any time."
            : "Declined. Your plan is unchanged."}
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
        <span className="border-ai/30 bg-ai/10 text-ai mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full border">
          <Sparkles className="size-3.5" aria-hidden />
          <span className="sr-only">Your twin</span>
        </span>
      )}

      <div className={cn("min-w-0 max-w-[46rem]", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
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
