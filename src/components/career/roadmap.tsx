"use client";

import { ChevronDown, ChevronUp, GripVertical, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ActionForm, FieldError } from "@/components/patterns/action-form";
import { DeleteButton } from "@/components/patterns/delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { reorder } from "@/lib/domain/calc/career";
import type { RoadmapItemView } from "@/lib/data/career.repo";
import type { ActionResult } from "@/lib/validation/shared";

/**
 * The roadmap checklist, reorderable by drag **and** by keyboard.
 *
 * The drag handle is for pointer users; the up/down buttons do the same thing
 * and are the reason this is usable without a mouse. A drag-only list is a
 * list a keyboard user cannot reorder, and "drag to reorder" is exactly the
 * interaction that tends to ship inaccessible.
 *
 * Order is applied optimistically and then persisted as the full list of ids,
 * so a failed save snaps back to the server's order rather than leaving the
 * screen disagreeing with the database.
 */
export function Roadmap({
  items,
  careerGoalId,
  addAction,
  toggleAction,
  reorderAction,
  deleteAction,
}: {
  items: RoadmapItemView[];
  careerGoalId: string;
  addAction: (formData: FormData) => Promise<ActionResult>;
  toggleAction: (formData: FormData) => Promise<ActionResult>;
  reorderAction: (formData: FormData) => Promise<ActionResult>;
  deleteAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const [order, setOrder] = useState<RoadmapItemView[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const list = order ?? items;

  const persist = (next: RoadmapItemView[]) => {
    setOrder(next);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("careerGoalId", careerGoalId);
      for (const item of next) formData.append("orderedIds", item.id);

      const result = await reorderAction(formData);

      if (result.ok) {
        /* Hand control back to the server's order once it agrees with ours. */
        setOrder(null);
      } else {
        setOrder(null);
        toast.error(result.error);
      }
    });
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length) return;
    persist(reorder(list, from, to));
  };

  const toggle = (itemId: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("itemId", itemId);

      const result = await toggleAction(formData);
      if (!result.ok) toast.error(result.error);
    });
  };

  return (
    <div className="space-y-3">
      <ActionForm action={addAction} successMessage="Added." resetOnSuccess>
        {({ pending: adding, fieldErrors }) => (
          <>
            <input type="hidden" name="careerGoalId" value={careerGoalId} />
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[10rem] flex-1">
                <Label htmlFor="roadmap-title" className="text-2xs">
                  Next step
                </Label>
                <Input
                  id="roadmap-title"
                  name="title"
                  placeholder="Build a REST API with auth and tests"
                  required
                />
              </div>
              <div className="w-36">
                <Label htmlFor="roadmap-due" className="text-2xs">
                  By <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input id="roadmap-due" name="dueDate" type="date" />
              </div>
              <Button type="submit" variant="outline" size="sm" disabled={adding}>
                <Plus aria-hidden />
                Add
              </Button>
            </div>
            <FieldError message={fieldErrors.title} />
          </>
        )}
      </ActionForm>

      {list.length === 0 ? (
        <p className="text-muted-foreground border-t pt-3 text-xs">
          Nothing on the roadmap yet. Add the next concrete thing — not
          &ldquo;learn backend&rdquo;, but the thing you would do on Saturday.
        </p>
      ) : (
        <ol className="space-y-1.5 border-t pt-3">
          {list.map((item, index) => (
            <li
              key={item.id}
              draggable
              onDragStart={() => setDragging(item.id)}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!dragging) return;
                const from = list.findIndex((row) => row.id === dragging);
                setDragging(null);
                if (from !== -1 && from !== index) move(from, index);
              }}
              className={cn(
                "bg-surface-2/50 flex items-start gap-2 rounded-lg border p-2.5",
                dragging === item.id && "opacity-50",
                item.done && "opacity-70",
              )}
            >
              <GripVertical
                className="text-muted-foreground mt-0.5 size-4 shrink-0 cursor-grab"
                aria-hidden
              />

              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggle(item.id)}
                disabled={pending}
                id={`roadmap-${item.id}`}
                className="accent-accent mt-0.5 size-4 shrink-0"
              />

              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`roadmap-${item.id}`}
                  className={cn(
                    "cursor-pointer text-sm",
                    item.done && "text-muted-foreground line-through",
                  )}
                >
                  {item.title}
                </label>
                {item.dueDate && (
                  <p
                    className={cn(
                      "mt-0.5 text-xs",
                      !item.done && isOverdue(item.dueDate)
                        ? "text-attention"
                        : "text-muted-foreground",
                    )}
                  >
                    {!item.done && isOverdue(item.dueDate) ? "Was due " : "By "}
                    {new Date(item.dueDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                )}
              </div>

              {/* The keyboard path to the same reordering. */}
              <div className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  disabled={index === 0 || pending}
                  onClick={() => move(index, index - 1)}
                  aria-label={`Move "${item.title}" up`}
                >
                  <ChevronUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  disabled={index === list.length - 1 || pending}
                  onClick={() => move(index, index + 1)}
                  aria-label={`Move "${item.title}" down`}
                >
                  <ChevronDown aria-hidden />
                </Button>
              </div>

              <DeleteButton
                action={deleteAction}
                name="itemId"
                id={item.id}
                label={`"${item.title}"`}
              />
            </li>
          ))}
        </ol>
      )}

      <p className="text-muted-foreground text-2xs">
        Drag the handle, or use the arrows — both reorder the list and the order is saved.
      </p>
    </div>
  );
}

function isOverdue(dueDate: string): boolean {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}
