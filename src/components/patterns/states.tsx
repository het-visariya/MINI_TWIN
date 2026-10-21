import { CircleAlert, Inbox, RotateCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The states every screen must declare. Defined once so no screen ships with
 * a bare spinner or a blank panel.
 */

export function EmptyState({
  title,
  purpose,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  /**
   * What this screen is for, in one sentence. An empty state is the first
   * thing a new user sees here, so it has to teach rather than apologise.
   */
  purpose: string;
  /** The first thing they can do. Required — an empty state is never a dead end. */
  action: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface-2/60 flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center",
        className,
      )}
    >
      <span className="bg-card text-muted-foreground inline-flex size-10 items-center justify-center rounded-full border">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
          {purpose}
        </p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "That did not load",
  description = "Nothing was changed. Try again, and if it keeps failing the data behind this panel may be unavailable.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-risk/30 bg-risk/5 flex flex-col items-center gap-3 rounded-xl border p-8 text-center",
        className,
      )}
      role="alert"
    >
      <span className="bg-card text-risk inline-flex size-10 items-center justify-center rounded-full border">
        <CircleAlert className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
          {description}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
      )}
    </div>
  );
}

/** Card-shaped placeholder that reserves the real card's height. */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-card shadow-card flex flex-col gap-3 rounded-xl border p-5">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-10 w-20" />
      <Skeleton className="h-2 w-full rounded-full" />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className="h-3 w-full last:w-2/3" />
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}
