import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ChatThread, TypingIndicator } from "@/components/patterns/chat-thread";
import { PageHeader } from "@/components/patterns/page-header";
import { CardSkeleton } from "@/components/patterns/states";
import { TwinComposer } from "@/components/twin/twin-composer";
import { repo } from "@/lib/data/repo";

export const metadata: Metadata = { title: "Ask my twin" };

const starters = [
  "Why am I falling behind this week?",
  "Rebuild today around the assignment",
  "What happens if I skip the gym today?",
  "Explain my momentum score",
];

export default function TwinPage({
  searchParams,
}: {
  searchParams: Promise<{ about?: string }>;
}) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Ask my twin"
        description="It answers from your own numbers, shows which ones it used, and asks before sending anything personal."
      />

      <Suspense fallback={<CardSkeleton lines={5} />}>
        <Conversation searchParams={searchParams} />
      </Suspense>

      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <ShieldCheck className="text-ok mt-0.5 size-4 shrink-0" aria-hidden />
        Your twin is not a doctor, dietitian or financial adviser. It explains your
        own data and helps you plan; for medical, dietary or investment decisions it
        will tell you to speak to a professional.
      </p>
    </div>
  );
}

async function Conversation({
  searchParams,
}: {
  searchParams: Promise<{ about?: string }>;
}) {
  const [messages, params] = await Promise.all([
    repo.getConversation(),
    searchParams,
  ]);

  return (
    <>
      {params.about && (
        <p className="border-accent/25 bg-accent/5 mb-6 rounded-lg border px-3.5 py-2.5 text-sm">
          Starting from <span className="font-medium">{params.about}</span> — the
          screen you came from.
        </p>
      )}

      <ChatThread messages={messages} />
      <div className="mt-4">
        <TypingIndicator />
      </div>

      <div className="mt-6">
        <TwinComposer starters={starters} initialPrompt={params.about} />
      </div>
    </>
  );
}
