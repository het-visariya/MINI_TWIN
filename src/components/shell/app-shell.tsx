"use client";

import Link from "next/link";

import { AccountMenu } from "@/components/shell/account-menu";
import { DemoBanner } from "@/components/shell/demo-banner";
import { MobileNav } from "@/components/shell/mobile-nav";
import { QuickAdd } from "@/components/shell/quick-add";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { TwinDock } from "@/components/shell/twin-dock";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { TwinFallback } from "@/components/twin/twin-fallback";
import { JarvisProvider } from "@/components/twin/jarvis";
import { JarvisMount } from "@/components/twin/jarvis-mount";
import { JarvisSummon } from "@/components/twin/jarvis-summon";
import { NotificationBell } from "@/components/shell/notification-bell";
import { markAllRead, markRead } from "@/app/(app)/reminders/actions";
import type { NotificationView } from "@/lib/data/reminders.repo";
import { TwinStateProvider } from "@/components/twin/twin-state";
import type { TwinMessage, TwinState } from "@/lib/domain/types";

/**
 * The authenticated shell: sidebar on desktop, bottom navigation on mobile,
 * and the twin reachable from every screen.
 */
export function AppShell({
  children,
  conversation,
  demo = false,
  twinState = "balanced",
  twinIntensity = 0.5,
  jarvisGreeting = "Your twin",
  jarvisOneThing = null,
  notifications = [],
  unread = 0,
}: {
  children: React.ReactNode;
  conversation: TwinMessage[];
  /** Sample data: flagged on every screen so it is never mistaken for yours. */
  demo?: boolean;
  twinState?: TwinState;
  twinIntensity?: number;
  /** Built from the snapshot the layout already has — never an AI call. */
  jarvisGreeting?: string;
  jarvisOneThing?: string | null;
  notifications?: NotificationView[];
  unread?: number;
}) {
  return (
    <TwinStateProvider initialState={twinState} initialIntensity={twinIntensity}>
      <JarvisProvider>
      <div className="flex min-h-dvh flex-col">
        {demo && <DemoBanner />}

        <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-[100rem] items-center gap-3 px-4">
            <Link href="/home" className="flex items-center gap-2">
              <span className="size-7">
                <TwinFallback state={twinState} label="" />
              </span>
              <span className="text-sm font-medium tracking-tight">Digital Twin</span>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <QuickAdd />
              <NotificationBell
                notifications={notifications}
                unread={unread}
                onMarkRead={markRead}
                onMarkAllRead={markAllRead}
              />
              <JarvisSummon />
              <ThemeToggle />
              <TwinDock messages={conversation} />
              <AccountMenu demo={demo} />
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[100rem] flex-1 gap-6 px-4">
          <aside className="hidden w-60 shrink-0 py-6 md:block">
            <div className="sticky top-20">
              <SidebarNav />
            </div>
          </aside>

          <main id="main" className="min-w-0 flex-1 pt-6 pb-24 md:pb-10">
            {children}
          </main>
        </div>

        <QuickAdd variant="fab" />
        <MobileNav />
      </div>

      {/* Mounted last so it sits above the shell, and loaded only once it has
          actually been summoned. */}
      <JarvisMount
        greeting={jarvisGreeting}
        oneThing={jarvisOneThing}
        state={twinState}
        conversation={conversation}
      />
      </JarvisProvider>
    </TwinStateProvider>
  );
}
