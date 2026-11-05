import { AlertTriangle, CheckCircle2, CircleAlert, Clock, FlaskConical } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Status } from "@/lib/domain/types";

type ChipKind = Status | "simulation";

const chip: Record<ChipKind, { label: string; icon: LucideIcon; className: string }> = {
  ok: {
    label: "On track",
    icon: CheckCircle2,
    className: "text-ok border-ok/35 bg-ok/10",
  },
  attention: {
    label: "Needs attention",
    icon: CircleAlert,
    className: "text-attention border-attention/35 bg-attention/10",
  },
  risk: {
    label: "At risk",
    icon: AlertTriangle,
    className: "text-risk border-risk/35 bg-risk/10",
  },
  overdue: {
    label: "Overdue",
    icon: Clock,
    className: "text-overdue border-overdue/35 bg-overdue/10",
  },
  simulation: {
    label: "Simulation",
    icon: FlaskConical,
    className: "text-simulation border-simulation/40 bg-simulation/10",
  },
};

/**
 * Status always arrives as icon + word. Colour never carries the meaning on
 * its own, so the chip still reads correctly in greyscale.
 */
export function StatusChip({
  kind,
  children,
  className,
}: {
  kind: ChipKind;
  children?: React.ReactNode;
  className?: string;
}) {
  const { label, icon: Icon, className: tone } = chip[kind];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {children ?? label}
    </span>
  );
}
