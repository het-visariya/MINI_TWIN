import type { Metadata } from "next";

import { ModuleStub } from "@/components/patterns/module-stub";

export const metadata: Metadata = { title: "Reminders" };

export default function RemindersPage() {
  return (
    <ModuleStub
      title={"Reminders"}
      description={"Timely, few, and neutral in wording. Nothing about health or money ever appears in a notification."}
      domain="routine"
      planned={[
        "In-app notifications and email reminders",
        "Quiet hours and a daily cap you control",
        "Neutral wording only — no health or money details in any message",
      ]}
      connects={"Reminders are triggered by deadlines, accepted plans and your own preferences. The daily cap is shared with Regreter, so nudges and reminders cannot stack up on the same day."}
    />
  );
}
