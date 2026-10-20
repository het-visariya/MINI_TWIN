import { AppShell } from "@/components/shell/app-shell";
import { repo } from "@/lib/data/repo";

/**
 * The shell itself holds no request-time data, so it is prerendered and the
 * navigation paints immediately. Per-request content streams inside each
 * page's own Suspense boundary.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const conversation = await repo.getConversation();

  return <AppShell conversation={conversation}>{children}</AppShell>;
}
