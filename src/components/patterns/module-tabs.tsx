"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "cn";

/**
 * Tabs for a module whose panels are rendered on the server.
 *
 * The panels arrive as already-rendered nodes, so the server component stays a
 * server component and only the tab mechanism is client-side. The alternative
 * — making the page a client component so it can hold the selected tab — would
 * push every query in the module to the browser.
 *
 * All panels are mounted and hidden rather than rendered on demand: a module's
 * data is fetched once for the page, so there is nothing to defer, and
 * switching tabs is then instant.
 */
export function ModuleTabs({
  tabs,
  defaultValue,
  className,
}: {
  tabs: { value: string; label: string; content: React.ReactNode }[];
  defaultValue?: string;
  className?: string;
}) {
  return (
    <Tabs defaultValue={defaultValue ?? tabs[0]?.value} className={cn("gap-4", className)}>
      {/* Scrolls rather than wraps at 360px, so the tab row stays one line. */}
      <TabsList className="w-full justify-start overflow-x-auto">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-0">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
