"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * "Ask about this" — present on every card that shows a number or a decision.
 * It carries that card's subject into the twin conversation, so the twin starts
 * with the context the user was looking at instead of a blank prompt.
 */
export function AskAboutThis({
  subject,
  className,
}: {
  subject: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="icon-sm"
          asChild
          className={className}
        >
          <Link
            href={{ pathname: "/twin", query: { about: subject } }}
            aria-label={`Ask your twin about ${subject}`}
          >
            <Sparkles aria-hidden />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Ask about this</TooltipContent>
    </Tooltip>
  );
}
