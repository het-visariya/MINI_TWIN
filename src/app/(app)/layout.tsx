import { redirect } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { requireViewer } from "@/lib/auth/session";
import { getRemindersRepo, getRepo } from "@/lib/data/repo";
import { nextOnboardingPath } from "@/lib/onboarding/steps";

/*
 * Blocking rather than streamed: this route decides whether the visitor may
 * see the page at all. A redirect cannot be streamed inside a Suspense
 * fallback — the shell would paint first and the user would see a flash of an
 * app they are not logged into — so the session check runs before any HTML.
 */
export const instant = false;

/**
 * The real gate for every authenticated screen.
 *
 * `src/proxy.ts` has already bounced requests with no session cookie, but a
 * cookie is not a session — this is where the session is actually verified,
 * and where a user who has not finished setting up is sent back to the step
 * they stopped at.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireViewer("/home");

  if (viewer.kind === "user" && !viewer.profile.onboardingCompletedAt) {
    redirect(nextOnboardingPath(viewer.profile.onboardingStep));
  }

  const repo = await getRepo(viewer);

  /* Both are already needed by the shell, so Jarvis's greeting costs no extra
     query -- and no model call, which is the point: an overlay that has to
     ask an API before it can say hello is one people stop summoning. */
  const [conversation, snapshot, reminders] = await Promise.all([
    repo.getConversation(),
    repo.getTwinSnapshot(),
    (await getRemindersRepo()).getReminders(),
  ]);

  return (
    <AppShell
      conversation={conversation}
      demo={repo.mode === "demo"}
      twinState={snapshot.state}
      twinIntensity={snapshot.intensity}
      jarvisGreeting={snapshot.greeting}
      jarvisOneThing={snapshot.oneThing?.title ?? null}
      notifications={reminders.notifications}
      unread={reminders.unread}
    >
      {children}
    </AppShell>
  );
}
