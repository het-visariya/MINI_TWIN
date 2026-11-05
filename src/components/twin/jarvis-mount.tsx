"use client";

import dynamic from "next/dynamic";

import { useJarvis } from "@/components/twin/jarvis";
import type { TwinMessage, TwinState } from "@/lib/domain/types";

/**
 * Loads the overlay the first time it is summoned, and not before.
 *
 * The overlay pulls in the whole chat — the thread, the composer, the consent
 * sheet — and most visits to most screens never open it. `ssr: false` because
 * it cannot render on the server anyway (it reads `document` for the focus
 * trap) and prerendering a hidden dialog buys nothing.
 *
 * Rendering `null` until `open` is what makes the import lazy in practice:
 * `next/dynamic` fetches the chunk on first render, so mounting it eagerly
 * would download the overlay for everyone regardless.
 */
const Overlay = dynamic(
  () => import("@/components/twin/jarvis-overlay").then((m) => m.JarvisOverlay),
  { ssr: false },
);

export function JarvisMount(props: {
  greeting: string;
  oneThing: string | null;
  state: TwinState;
  conversation: TwinMessage[];
}) {
  const { open } = useJarvis();

  if (!open) return null;

  return <Overlay {...props} />;
}
