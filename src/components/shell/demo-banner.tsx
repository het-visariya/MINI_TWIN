import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * Always visible in demo mode.
 *
 * Someone who lands here from a shared link needs to know, on every screen,
 * that these numbers are not theirs — otherwise the demo is just a product
 * that lies. Slim enough not to fight with the content.
 */
export function DemoBanner() {
  return (
    <div className="border-accent/25 bg-accent/5 border-b">
      <div className="content-width flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs">
        <span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 font-medium">
          Demo
        </span>
        <span className="text-muted-foreground">
          Sample data. Nothing you change here is saved.
        </span>
        <Link
          href="/signup"
          className="text-foreground ml-auto inline-flex items-center gap-1 font-medium underline underline-offset-4"
        >
          Create your own twin
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
