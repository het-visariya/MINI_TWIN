import { TwinStateProvider } from "@/components/twin/twin-state";

/**
 * Setup has no sidebar and no navigation on purpose: there is exactly one
 * thing to do on this screen, and an escape hatch into the half-configured app
 * would leave the user somewhere that cannot explain itself yet.
 *
 * The twin starts resting and dim so the final step has somewhere to arrive
 * from.
 */
export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <TwinStateProvider initialState="resting" initialIntensity={0.15}>
      {children}
    </TwinStateProvider>
  );
}
