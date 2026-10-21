"use client";

import { HelpCircle } from "lucide-react";
import { useState } from "react";

import { AskAboutThis } from "@/components/patterns/ask-about-this";
import { DomainIcon } from "@/components/patterns/domain-icon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Priority, Task } from "@/lib/domain/types";

const priorityTone: Record<Priority, string> = {
  critical: "text-risk border-risk/35 bg-risk/10",
  high: "text-attention border-attention/35 bg-attention/10",
  normal: "text-muted-foreground bg-muted",
  low: "text-muted-foreground bg-muted/60",
};

const relativeDue = (due?: string) => {
  if (!due) return "No deadline";
  const days = Math.round(
    (new Date(due).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
};

export function TaskRow({ task }: { task: Task }) {
  const [done, setDone] = useState(Boolean(task.done));

  return (
    <article
      className={cn(
        "bg-card shadow-card rounded-xl border p-3.5 transition-opacity",
        done && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <DomainIcon domain={task.domain} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                "text-sm font-medium",
                done && "text-muted-foreground line-through",
              )}
            >
              {task.title}
            </h3>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-2xs font-medium capitalize",
                priorityTone[task.priority],
              )}
            >
              {task.priority}
            </span>
          </div>

          <p className="text-muted-foreground mt-1 text-xs">
            {relativeDue(task.due)} ·{" "}
            <span className="tabular">{task.estimateMinutes}m</span> estimated
            {task.progress > 0 && (
              <>
                {" "}
                · <span className="tabular">{task.progress}%</span> done
              </>
            )}
          </p>

          {task.progress > 0 && (
            <Progress
              value={task.progress}
              className="mt-2"
              aria-label={`${task.title}: ${task.progress} percent complete`}
            />
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="-ml-2 mt-1.5">
                <HelpCircle aria-hidden />
                Why is this ranked here?
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-sm">
              <p className="font-medium">Why this one</p>
              <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                {task.why}
              </p>
              <p className="text-muted-foreground mt-3 border-t pt-2 text-2xs">
                Ranking uses urgency, importance, stated consequence and anything
                this task blocks. Change your estimate and the order changes with it.
              </p>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <AskAboutThis subject={task.title} />
          <Button
            variant={done ? "outline" : "default"}
            size="sm"
            onClick={() => setDone((previous) => !previous)}
            aria-pressed={done}
          >
            {done ? "Undo" : "Done"}
          </Button>
        </div>
      </div>
    </article>
  );
}
