"use client";

import Link from "next/link";

import { MobileNav } from "@/components/shell/mobile-nav";
import { QuickAdd } from "@/components/shell/quick-add";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { TwinDock } from "@/components/shell/twin-dock";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { TwinFallback } from "@/components/twin/twin-fallback";
import { TwinStateProvider } from "@/components/twin/twin-state";
import type { TwinMessage, TwinState } from "@/lib/domain/types";

/**
 * The authenticated shell: sidebar on desktop, bottom navigation on mobile,
 * and the twin reachable from every screen.
 */
export function AppShell({
  children,
  conversation,
  twinState = "balanced",
  twinIntensity = 0.5,
}: {
  children: React.ReactNode;
  conversation: TwinMessage[];
  twinState?: TwinState;
  twinIntensity?: number;
}) {
  return (
    <TwinStateProvider initialState={twinState} initialIntensity={twinIntensity}>
      <div className="flex min-h-dvh flex-col">
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
              <ThemeToggle />
              <TwinDock messages={conversation} />
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
    </TwinStateProvider>
  );
}
