import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import {
  deleteAccount,
  saveAiConsent,
  savePreferences,
  sessionIsFresh,
  signOutOtherSessions,
} from "@/app/(app)/settings/actions";
import { ModuleTabs } from "@/components/patterns/module-tabs";
import { PageHeader } from "@/components/patterns/page-header";
import { GridSkeleton } from "@/components/patterns/states";
import {
  AiConsentForm,
  DeleteAccount,
  ExportButton,
  Guardrails,
  GuardianView,
  PreferencesForm,
  SessionsPanel,
} from "@/components/settings/settings-panels";
import { getAccountRepo } from "@/lib/data/repo";
import { getSession } from "@/lib/auth/session";
import type { AccountView } from "@/lib/data/account.repo";

export const metadata: Metadata = { title: "Privacy & control" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<GridSkeleton count={3} />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const repo = await getAccountRepo();

  /* The current session's token, so the sessions list can mark which device
     is this one. Read here rather than in the repo so the repo stays a query
     layer with no knowledge of the request. */
  const session = await getSession().catch(() => null);
  const view = await repo.getAccount(session?.session?.token);
  const fresh = await sessionIsFresh();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Privacy &amp; control"
        description="What your twin knows, what it may send, and how to take it all back. Every switch here does exactly what it says."
        askAbout="what my twin knows about me"
      />

      <ModuleTabs
        tabs={[
          {
            value: "you",
            label: "You & your twin",
            content: (
              <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                <PreferencesForm action={savePreferences} profile={view.profile} />
                <Guardrails />
              </div>
            ),
          },
          {
            value: "ai",
            label: "AI & consent",
            content: <ConsentTab view={view} />,
          },
          {
            value: "data",
            label: "Your data",
            content: (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-6">
                  <ExportButton />
                  <SessionsPanel
                    action={signOutOtherSessions}
                    sessions={view.sessions}
                  />
                </div>
                <div className="space-y-6">
                  <DeleteAccount
                    action={deleteAccount}
                    dataSummary={view.dataSummary}
                    sessionFresh={fresh}
                  />
                  <GuardianView />
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               AI & consent                                 */
/* -------------------------------------------------------------------------- */

function ConsentTab({ view }: { view: AccountView }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <AiConsentForm action={saveAiConsent} profile={view.profile} />

      <section
        aria-labelledby="consent-log-heading"
        className="bg-card shadow-card rounded-xl border p-4"
      >
        <h2 id="consent-log-heading" className="text-base font-medium">
          Consent history
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Every time your twin sent your data to an AI model, and what categories went.
        </p>

        {view.consentLog.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed p-5 text-center">
            <ShieldCheck className="text-muted-foreground size-5" aria-hidden />
            <p className="text-sm font-medium">Nothing sent yet</p>
            <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
              Ask my twin asks before it sends anything, and writes a row here when it
              does. An empty list means nothing of yours has left this app.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {view.consentLog.map((record) => (
              <li key={record.id} className="bg-surface-2/50 rounded-lg border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{featureLabel(record.feature)}</p>
                  <p className="text-muted-foreground text-2xs">
                    {new Date(record.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {record.summary}
                </p>

                <ul className="mt-2 flex flex-wrap gap-1">
                  {record.categories.map((category) => (
                    <li
                      key={category}
                      className="bg-muted rounded-full border px-2 py-0.5 text-2xs"
                    >
                      {category}
                    </li>
                  ))}
                </ul>

                {!record.granted && (
                  <p className="text-attention mt-1.5 text-2xs">
                    You declined this one, so nothing was sent.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function featureLabel(feature: string): string {
  switch (feature) {
    case "twin_chat":
      return "Ask my twin";
    case "jarvis":
      return "Jarvis";
    case "career_roadmap":
      return "Career roadmap draft";
    default:
      return feature.replace(/_/g, " ");
  }
}
