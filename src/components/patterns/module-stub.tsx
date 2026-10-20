import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { DomainIcon } from "@/components/patterns/domain-icon";
import { EmptyState } from "@/components/patterns/states";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import type { Domain } from "@/lib/design/tokens";

/**
 * A module whose screen arrives in phase 2. It still gets a real route, a real
 * header and a stated scope, so the information architecture is complete and
 * navigable while the screens are built.
 */
export function ModuleStub({
  title,
  description,
  domain,
  planned,
  connects,
}: {
  title: string;
  description: string;
  domain: Domain;
  /** What this module will contain, from the specification. */
  planned: string[];
  /** Why it is connected to the rest of the twin. */
  connects: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} askAbout={title.toLowerCase()} />

      <EmptyState
        title="This screen is next in line"
        purpose="The design language, the shell and the shared components are in place. This module's screens are built in phase 2."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/home">
              Back to twin home
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section
          aria-labelledby="planned-heading"
          className="bg-card shadow-card rounded-xl border p-4"
        >
          <h2 id="planned-heading" className="text-base font-medium">
            What this module will hold
          </h2>
          <ul className="mt-3 space-y-2">
            {planned.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm">
                <span aria-hidden className="text-accent">
                  •
                </span>
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-card shadow-card rounded-xl border p-4">
          <h2 className="flex items-center gap-2 text-base font-medium">
            <DomainIcon domain={domain} />
            How it connects
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            {connects}
          </p>
          <p className="text-muted-foreground mt-3 border-t pt-3 text-xs">
            Only connections that genuinely change a decision are built. Linking data
            just because it exists would make the product feel invasive.
          </p>
        </section>
      </div>
    </div>
  );
}
