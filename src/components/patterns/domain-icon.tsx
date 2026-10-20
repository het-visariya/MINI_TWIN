import {
  Briefcase,
  Dumbbell,
  GraduationCap,
  ListChecks,
  Moon,
  Salad,
  Target,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "cn";
import type { Domain } from "@/lib/design/tokens";

const icons: Record<Domain, LucideIcon> = {
  academic: GraduationCap,
  productivity: ListChecks,
  health: Dumbbell,
  nutrition: Salad,
  finance: Wallet,
  career: Briefcase,
  goals: Target,
  routine: Moon,
};

export const domainLabel: Record<Domain, string> = {
  academic: "Academic",
  productivity: "Productivity",
  health: "Health",
  nutrition: "Nutrition",
  finance: "Finance",
  career: "Career",
  goals: "Goals",
  routine: "Routine",
};

/**
 * Domains are told apart by their icon and their name, not by a hue. There
 * used to be eight domain colours; eight colours on one screen is decoration,
 * and it left no colour free to mean "you can act here".
 *
 * `active` is the one exception: the accent marks the domain currently
 * selected or being acted on.
 */
export function DomainIcon({
  domain,
  className,
  withLabel = false,
  active = false,
}: {
  domain: Domain;
  className?: string;
  withLabel?: boolean;
  active?: boolean;
}) {
  const Icon = icons[domain];
  const tone = active
    ? "text-accent border-accent/40 bg-accent/10"
    : "text-muted-foreground border-border bg-surface-2";

  if (withLabel) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
          tone,
          className,
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {domainLabel[domain]}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border",
        tone,
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{domainLabel[domain]}</span>
    </span>
  );
}
