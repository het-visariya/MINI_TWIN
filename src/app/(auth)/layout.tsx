import Link from "next/link";

import { AuthTwin } from "@/components/auth/auth-twin";
import { TwinStateProvider } from "@/components/twin/twin-state";

/**
 * The split shell for every auth screen.
 *
 * Desktop: the twin on the left, the form on the right. Mobile: a small twin
 * above the form — it is the only decoration on these screens, and it is the
 * product's one recognisable object, so it earns the space.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <TwinStateProvider initialState="resting" initialIntensity={0.15}>
      <div className="grid min-h-dvh lg:grid-cols-2">
        <aside className="relative hidden flex-col justify-between border-r p-10 lg:flex">
          <Link href="/" className="text-sm font-medium tracking-tight">
            Digital Twin
          </Link>

          <div className="flex flex-1 items-center justify-center py-10">
            <AuthTwin />
          </div>

          <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
            One twin of you. Your timetable, your gym, your money and your goals in
            one place — so you can see what a decision costs before you make it.
          </p>
        </aside>

        <main
          id="main"
          className="flex flex-col items-center justify-center px-4 py-10 sm:px-8"
        >
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
              <div className="size-20">
                <AuthTwin compact />
              </div>
              <Link href="/" className="text-sm font-medium tracking-tight">
                Digital Twin
              </Link>
            </div>

            {children}
          </div>
        </main>
      </div>
    </TwinStateProvider>
  );
}
