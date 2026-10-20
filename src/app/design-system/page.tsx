import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AnimatedContent,
  BlurText,
  CountUp,
  DecryptedText,
  RotatingText,
  SpotlightCard,
  StarBorder,
} from "@/components/bits/twin-bits";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Heatmap, TrendChart } from "@/components/patterns/charts";
import { ConflictBanner } from "@/components/patterns/conflict-banner";
import { ConsentSheet } from "@/components/patterns/consent-sheet";
import { ConsequenceCard } from "@/components/patterns/consequence-card";
import { ChatThread } from "@/components/patterns/chat-thread";
import { DomainIcon } from "@/components/patterns/domain-icon";
import { PulseRing } from "@/components/patterns/pulse-ring";
import { ScoreCard } from "@/components/patterns/score-card";
import { SimulationFrame } from "@/components/patterns/simulation-frame";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/patterns/states";
import { StatusChip } from "@/components/patterns/status-chip";
import { TimeBudgetBar } from "@/components/patterns/time-budget-bar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { TwinFallback } from "@/components/twin/twin-fallback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DOMAINS, STATUSES, duration } from "@/lib/design/tokens";
import * as fixtures from "@/lib/data/fixtures";
import type { TwinState } from "@/lib/domain/types";

export const metadata: Metadata = { title: "Design system" };

const surfaceTokens = [
  "background",
  "surface-1",
  "surface-2",
  "border",
  "border-strong",
  "foreground",
  "muted-foreground",
  "accent",
  "destructive",
] as const;

const typeScale = [
  { className: "text-3xl", label: "Display · 56/60" },
  { className: "text-2xl", label: "Metric · 40/44" },
  { className: "text-xl", label: "Heading 1 · 28/34" },
  { className: "text-lg", label: "Heading 2 · 20/28" },
  { className: "text-base", label: "Body · 16/24" },
  { className: "text-sm", label: "Body small · 14/22" },
  { className: "text-xs", label: "Caption · 12/18" },
];

const twinStates: TwinState[] = ["focused", "balanced", "stretched", "resting"];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-20">
      <h2 id={`${id}-heading`} className="text-lg font-medium tracking-tight">
        {title}
      </h2>
      <p className="text-muted-foreground mt-1 mb-4 max-w-2xl text-sm">{description}</p>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  /* The design system is a build tool, not part of the product. */
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">
              Digital Twin design system
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Every token, state, component and motion preset the product is built
              from. Switch the theme in the corner and compare — anything that looks
              wrong here is wrong everywhere.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" asChild>
              <Link href="/home">Open the app</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-12">
        <Section
          id="colour"
          title="Colour"
          description="True black, warm neutral greys and exactly one accent. The accent means \u201cyou can act here\u201d or \u201cthis is you\u201d \u2014 it is never decoration, and the twin and the AI share it rather than having colours of their own."
        >
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {surfaceTokens.map((token) => (
              <div key={token}>
                <div
                  className="h-16 rounded-lg border"
                  style={{ backgroundColor: `var(--${token})` }}
                />
                <p className="mt-1.5 text-xs font-medium">{token}</p>
                <p className="text-muted-foreground font-mono text-2xs">
                  --{token}
                </p>
              </div>
            ))}
          </div>

          <h3 className="mt-6 text-sm font-medium">
            Domains — told apart by icon and name, not by hue
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {DOMAINS.map((domain) => (
              <DomainIcon key={domain} domain={domain} withLabel />
            ))}
          </div>

          <h3 className="mt-6 text-sm font-medium">
            Status — colour never carries the meaning alone
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUSES.map((status) => (
              <StatusChip key={status} kind={status} />
            ))}
            <StatusChip kind="simulation" />
          </div>
        </Section>

        <Section
          id="type"
          title="Typography"
          description="Geist Sans for the interface, Geist Mono for every number, with tabular figures so a score does not jitter as it changes. Headings are medium weight and tight; nothing in the product is bold."
        >
          <div className="bg-card space-y-3 rounded-xl border p-4">
            {typeScale.map((item) => (
              <div key={item.label} className="flex flex-wrap items-baseline gap-3">
                <p className={item.className}>Finish the assignment</p>
                <span className="text-muted-foreground font-mono text-2xs">
                  {item.label}
                </span>
              </div>
            ))}
            <div className="border-t pt-3">
              <p className="tabular text-2xl font-medium">7.95 · 4h 30m · ₹6,000</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Tabular numerals, used for all metrics
              </p>
            </div>
          </div>
        </Section>

        <Section
          id="motion"
          title="Motion"
          description="Three durations and two easing curves, defined once. Every preset \u2014 and every React Bits component \u2014 checks the reduced-motion preference and renders the final state instead of animating."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-card rounded-xl border p-4">
              <h3 className="text-sm font-medium">Durations</h3>
              <dl className="mt-3 space-y-1.5 text-xs">
                {Object.entries(duration).map(([name, ms]) => (
                  <div key={name} className="flex justify-between gap-3">
                    <dt className="capitalize">{name}</dt>
                    <dd className="tabular text-muted-foreground">{ms}ms</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t pt-1.5">
                  <dt>Easing</dt>
                  <dd className="text-muted-foreground font-mono">
                    cubic-bezier(.22,1,.36,1)
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-card rounded-xl border p-4">
              <h3 className="text-sm font-medium">Stagger reveal</h3>
              <Stagger className="mt-3 space-y-2">
                {["First item", "Second item", "Third item", "Fourth item"].map(
                  (item) => (
                    <StaggerItem
                      key={item}
                      className="bg-muted/50 rounded-md border px-3 py-2 text-xs"
                    >
                      {item}
                    </StaggerItem>
                  ),
                )}
              </Stagger>
            </div>
          </div>
        </Section>

        <Section
          id="twin"
          title="The twin"
          description="A figure made of ~5,200 points, in four states set explicitly by the app or the user. Warm-white points are you; the accent ones are your active commitments. No state expresses disappointment, and none is derived from inferred mood. Shown here as the static fallback, which also replaces the canvas under reduced motion or without WebGL."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {twinStates.map((state) => (
              <div key={state} className="bg-card rounded-xl border p-3 text-center">
                <div className="mx-auto size-24">
                  <TwinFallback state={state} label={`Twin, ${state}`} />
                </div>
                <p className="mt-2 text-xs font-medium capitalize">{state}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="controls"
          title="Controls"
          description="Touch-comfortable below the small breakpoint, compact on pointer devices. One filled button per view \u2014 if two things are accent-filled, neither reads as the thing to do."
        >
          <div className="bg-card space-y-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              {(["primary", "secondary", "outline", "ghost", "destructive"] as const).map(
                (variant) => (
                  <Button key={variant} variant={variant}>
                    {variant}
                  </Button>
                ),
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["xs", "sm", "default", "lg"] as const).map((size) => (
                <Button key={size} size={size} variant="outline">
                  size {size}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>Badge</Badge>
              <div className="flex items-center gap-2">
                <Switch id="ds-switch" defaultChecked />
                <Label htmlFor="ds-switch" className="text-xs">
                  Switch
                </Label>
              </div>
              <div className="w-48">
                <Label htmlFor="ds-input" className="text-xs">
                  Input
                </Label>
                <Input id="ds-input" placeholder="2 rotis and dal" className="mt-1" />
              </div>
              <ConsentSheet
                uses={[
                  {
                    label: "Today's plan",
                    detail: "Commitments, durations and available time",
                  },
                ]}
              />
            </div>
          </div>
        </Section>

        <Section
          id="scores"
          title="Scores"
          description="A score cannot render without saying what it means and what it was built from — the type makes those fields required."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ScoreCard score={fixtures.pulse[0]} />
            <ScoreCard score={fixtures.momentum} />
          </div>
        </Section>

        <Section
          id="decisions"
          title="Decisions & conflicts"
          description="The shapes Regreter, “Fix my day” and plan negotiation share. The twin states both sides and the trade-offs; the user chooses."
        >
          <div className="space-y-3">
            <ConflictBanner conflict={fixtures.conflicts[0]} />
            <ConsequenceCard consequence={fixtures.consequences[0]} />
          </div>
        </Section>

        <Section
          id="simulation"
          title="Simulation"
          description="Anything projected rather than measured wears this frame, with its assumptions listed. It is how a projection stays distinguishable from a record."
        >
          <SimulationFrame
            title="Projected CGPA"
            assumptions={fixtures.cgpaSimulation.assumptions}
          >
            <p className="tabular text-2xl font-medium">7.95</p>
            <p className="text-muted-foreground mt-1 text-xs">
              On the grades you selected, from a current 7.82.
            </p>
          </SimulationFrame>
        </Section>

        <Section
          id="planning"
          title="Time & planning"
          description="Hours needed against hours available, with the shortfall named and the reserved blocks listed."
        >
          <div className="bg-card rounded-xl border p-4">
            <TimeBudgetBar budget={fixtures.timeBudget} />
          </div>
        </Section>

        <Section
          id="charts"
          title="Charts"
          description="Two forms only. The accent is always \u201cyou\u201d and never appears twice in one figure; everything you are compared against is a grey tint. Both carry a legend and per-value text, so nothing is communicated by colour alone."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="bg-card rounded-xl border p-4">
              <Heatmap days={fixtures.heatmap.days} rows={fixtures.heatmap.rows} todayIndex={3} />
            </div>
            <div className="bg-card rounded-xl border p-4">
              <TrendChart
                labels={["W1", "W2", "W3", "W4"]}
                series={[
                  { label: "You", values: [58, 64, 70, 62], emphasis: true },
                  { label: "Your 28-day average", values: [62, 61, 63, 62] },
                  {
                    label: "If nothing changes",
                    values: [62, 60, 57, 54],
                    projected: true,
                  },
                ]}
              />
            </div>
          </div>
        </Section>

        <Section
          id="conversation"
          title="Conversation"
          description="Streaming replies with the numbers they used, and the plan proposal the user can accept, change or decline. A proposal is never applied by being shown."
        >
          <div className="bg-card rounded-xl border p-4">
            <ChatThread messages={fixtures.conversation} />
          </div>
        </Section>


        <Section
          id="bits"
          title="Motion components"
          description="The curated React Bits set, recoloured to the tokens and wrapped so each one renders its static end state under reduced motion. Nothing outside this list is installed, and no more than one WebGL canvas is ever visible at once."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="bg-card rounded-xl border p-5">
              <p className="text-muted-foreground font-mono text-2xs">BlurText</p>
              <p className="mt-2 text-lg">
                <BlurText text="One twin of you." />
              </p>
              <p className="text-muted-foreground mt-4 font-mono text-2xs">
                RotatingText
              </p>
              <p className="mt-2 flex flex-wrap items-baseline gap-1.5 text-lg">
                <span>Everything in one place —</span>
                <RotatingText
                  texts={["your timetable", "your gym", "your money"]}
                  mainClassName="text-accent"
                />
              </p>
            </div>

            <div className="bg-card rounded-xl border p-5">
              <p className="text-muted-foreground font-mono text-2xs">CountUp</p>
              <p className="mt-2 text-2xl" data-slot="metric">
                <CountUp to={74} />
              </p>
              <p className="text-muted-foreground mt-4 font-mono text-2xs">
                DecryptedText
              </p>
              <p className="mt-2 text-sm">
                <DecryptedText text="DBMS is still your one thing — 2 hours left." />
              </p>
            </div>

            <SpotlightCard>
              <p className="text-muted-foreground font-mono text-2xs">SpotlightCard</p>
              <p className="mt-2 text-sm">
                Every card in the app. Hover it: the spotlight is a 6% accent wash,
                an affordance rather than information.
              </p>
            </SpotlightCard>

            <div className="bg-card flex flex-col items-start gap-3 rounded-xl border p-5">
              <p className="text-muted-foreground font-mono text-2xs">
                StarBorder — landing CTA only
              </p>
              <StarBorder>Create your twin</StarBorder>
              <p className="text-muted-foreground text-xs">
                One special button on the whole site. Anywhere else, a primary
                button.
              </p>
            </div>

            <AnimatedContent className="lg:col-span-2">
              <div className="bg-card rounded-xl border p-5">
                <p className="text-muted-foreground font-mono text-2xs">
                  AnimatedContent / FadeContent
                </p>
                <p className="mt-2 text-sm">
                  Section entrances: 12px rise, 300ms, 40ms stagger. This panel
                  arrived that way.
                </p>
              </div>
            </AnimatedContent>
          </div>

          <p className="text-muted-foreground mt-4 text-xs">
            Also installed and token-recoloured, shown on the screens that use
            them: DotGrid (landing background), MagicBento (landing feature grid),
            Stepper (onboarding), AnimatedList (reminders and the today list) and
            Orb (Jarvis).
          </p>
        </Section>

        <Section
          id="pulse"
          title="Twin Pulse"
          description="Momentum is the headline number; the five domain scores sit under it as ring gauges. This replaced six equal score cards — tapping a ring highlights its band on the twin figure."
        >
          <div className="bg-card rounded-xl border p-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div>
                <p className="text-muted-foreground text-xs">Momentum</p>
                <p className="text-2xl leading-none" data-slot="metric">
                  <CountUp to={fixtures.momentum.value} />
                </p>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                {fixtures.pulse.slice(0, 5).map((score) => (
                  <PulseRing key={score.id} score={score} />
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="states"
          title="Empty, loading and error"
          description="Declared up front so no screen ships with a bare spinner or a blank panel."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            <Reveal>
              <EmptyState
                title="No tasks yet"
                purpose="This screen ranks what you have to do by what it costs you to put off \u2014 not by its due date. Add one task and the twin starts ranking."
                action={<Button size="sm">Add a task</Button>}
              />
            </Reveal>
            <CardSkeleton />
            <ErrorState />
          </div>
        </Section>
      </div>
    </div>
  );
}
