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

/** Per-domain tint classes. The hue identifies data, never branding. */
export const domainTint: Record<Domain, string> = {
  academic: "text-domain-academic bg-domain-academic/10 border-domain-academic/25",
  productivity:
    "text-domain-productivity bg-domain-productivity/10 border-domain-productivity/25",
  health: "text-domain-health bg-domain-health/10 border-domain-health/25",
  nutrition: "text-domain-nutrition bg-domain-nutrition/10 border-domain-nutrition/25",
  finance: "text-domain-finance bg-domain-finance/10 border-domain-finance/25",
  career: "text-domain-career bg-domain-career/10 border-domain-career/25",
  goals: "text-domain-goals bg-domain-goals/10 border-domain-goals/25",
  routine: "text-domain-routine bg-domain-routine/10 border-domain-routine/25",
};

export function DomainIcon({
  domain,
  className,
  withLabel = false,
}: {
  domain: Domain;
  className?: string;
  withLabel?: boolean;
}) {
  const Icon = icons[domain];

  if (withLabel) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
          domainTint[domain],
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
        "inline-flex size-8 items-center justify-center rounded-lg border",
        domainTint[domain],
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{domainLabel[domain]}</span>
    </span>
  );
}
