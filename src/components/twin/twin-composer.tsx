"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { ConsentSheet } from "@/components/patterns/consent-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const dataUses = [
  {
    label: "Today's plan",
    detail: "Your commitments, their durations and the time you have available",
  },
  {
    label: "Academic records",
    detail: "Attendance, deadlines and internal marks for the subjects involved",
  },
  {
    label: "Your question",
    detail: "The message you typed, and the screen you asked it from",
  },
];

export function TwinComposer({
  starters,
  initialPrompt,
}: {
  starters: string[];
  initialPrompt?: string;
}) {
  const [value, setValue] = useState(
    initialPrompt ? `About ${initialPrompt}: ` : "",
  );

  return (
    <div className="bg-card shadow-card sticky bottom-20 space-y-3 rounded-xl border p-3 md:bottom-4">
      <div className="flex flex-wrap gap-1.5">
        {starters.map((starter) => (
          <Button
            key={starter}
            variant="outline"
            size="sm"
            onClick={() => setValue(starter)}
          >
            {starter}
          </Button>
        ))}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => event.preventDefault()}
      >
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={2}
          placeholder="Ask about anything in your own data…"
          aria-label="Message your twin"
          className="min-h-[3.25rem] resize-none"
        />
        <Button type="submit" variant="primary" size="icon-lg" aria-label="Send message">
          <Send aria-hidden />
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-2xs">
          Personal context is only sent after you approve it.
        </p>
        <ConsentSheet uses={dataUses} />
      </div>
    </div>
  );
}
