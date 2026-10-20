import { Receipt, Target } from "lucide-react";
import type { Metadata } from "next";

import { ConsequenceCard } from "@/components/patterns/consequence-card";
import { DomainIcon } from "@/components/patterns/domain-icon";
import { PageHeader } from "@/components/patterns/page-header";
import { FuturePaths } from "@/components/regreter/future-paths";
import { ToneSetting } from "@/components/regreter/tone-setting";
import { Button } from "@/components/ui/button";
import { getRepo } from "@/lib/data/repo";

export const metadata: Metadata = { title: "Regreter & future self" };

export default async function RegreterPage() {
  const { consequence, receipts, plans, futurePaths } = await (
    await getRepo()
  ).getRegreter();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regreter & future self"
        description="See the cost of a decision before you make it, and what it actually cost afterwards — with a way back. It talks about the decision, never about you."
        askAbout="what postponing this costs me"
      />

      <section aria-labelledby="preview-heading" className="space-y-3">
        <div>
          <h2 id="preview-heading" className="text-base font-medium">
            Regret preview
          </h2>
          <p className="text-muted-foreground text-xs">
            Both options, with their real trade-offs. The figures come from the
            planning engine — nothing here is invented to push you one way.
          </p>
        </div>
        <ConsequenceCard consequence={consequence} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="receipts-heading" className="space-y-3">
          <div>
            <h2
              id="receipts-heading"
              className="flex items-center gap-2 text-base font-medium"
            >
              <Receipt className="size-4" aria-hidden />
              Cost receipts
            </h2>
            <p className="text-muted-foreground text-xs">
              What a miss actually cost, and the one action that recovers it.
            </p>
          </div>

          {receipts.map((receipt) => (
            <article
              key={receipt.id}
              className="bg-card shadow-card rounded-xl border p-4"
            >
              <h3 className="text-sm font-medium">{receipt.missed}</h3>

              <ul className="mt-3 space-y-2">
                {receipt.effects.map((effect) => (
                  <li key={effect.statement} className="flex items-start gap-2.5">
                    <DomainIcon domain={effect.domain} />
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {effect.statement}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="border-ok/30 bg-ok/5 mt-4 rounded-lg border p-3">
                <p className="text-sm font-medium">{receipt.recovery.label}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {receipt.recovery.detail}
                </p>
                <Button size="sm" className="mt-3">
                  Add the recovery plan
                </Button>
              </div>
            </article>
          ))}

          <section
            aria-labelledby="plan3-heading"
            className="bg-card shadow-card rounded-xl border p-4"
          >
            <h3
              id="plan3-heading"
              className="flex items-center gap-2 text-sm font-medium"
            >
              <Target className="size-4" aria-hidden />
              Plan in 3
            </h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Wish, obstacle, if-then. You write all three — the twin only keeps them
              in front of you.
            </p>

            {plans.map((plan) => (
              <dl key={plan.id} className="mt-3 space-y-2.5">
                {[
                  { term: "Wish", detail: plan.wish },
                  { term: "Obstacle", detail: plan.obstacle },
                  { term: "If-then", detail: plan.ifThen },
                ].map((row) => (
                  <div key={row.term} className="bg-surface-2/60 rounded-lg border p-2.5">
                    <dt className="text-2xs font-medium tracking-wide uppercase">
                      {row.term}
                    </dt>
                    <dd className="mt-0.5 text-xs">{row.detail}</dd>
                  </div>
                ))}
              </dl>
            ))}
          </section>
        </section>

        <ToneSetting />
      </div>

      <FuturePaths simulation={futurePaths} />
    </div>
  );
}
