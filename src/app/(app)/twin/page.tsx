import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/patterns/page-header";
import { CardSkeleton } from "@/components/patterns/states";
import { TwinChat } from "@/components/twin/twin-chat";
import { getRepo } from "@/lib/data/repo";
import { twinLlmConnected } from "@/lib/integrations/twin-llm";

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

      {!twinLlmConnected() && (
        <p
          role="status"
          className="border-attention/30 bg-attention/5 rounded-lg border px-3.5 py-2.5 text-sm"
        >
          Your twin&rsquo;s assistant is not switched on yet, so it cannot answer in
          words. Everything else on this screen still reads from your own numbers.
        </p>
      )}

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
    (await getRepo()).getConversation(),
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

      {/* The typing indicator used to live here, always on, animating for a
          reply that never came. It now belongs to TwinChat, which shows it
          only while a request is genuinely in flight. */}
      <TwinChat
        initialMessages={messages}
        starters={starters}
        initialPrompt={params.about}
        /* One thread per day: a conversation that never ends becomes a
           context window nobody can afford, and "what did I ask yesterday"
           is a different question from "carry on". */
        threadId={new Date().toISOString().slice(0, 10)}
      />
    </>
  );
}
