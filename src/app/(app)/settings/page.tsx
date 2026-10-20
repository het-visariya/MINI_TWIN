import type { Metadata } from "next";

import { ModuleStub } from "@/components/patterns/module-stub";

export const metadata: Metadata = { title: "Privacy & control" };

export default function SettingsPage() {
  return (
    <ModuleStub
      title={"Privacy & control"}
      description={"Your data, your consent history, and the switches that decide what the twin may use. All of it reversible."}
      domain="routine"
      planned={[
        "Export everything, delete your account, review and withdraw AI consent",
        "Per-module switches: a module you turn off is a module the twin cannot read",
        "Personal memory you can read, edit and delete entry by entry",
        "Row-level isolation so each account can only ever see its own data",
        "Guardian view: read-only, for under-18 accounts, off until legally reviewed",
      ]}
      connects={"This module governs every other one. Consent, storage, notifications, memory and deletion are decided here, and the rest of the product has to respect those answers."}
    />
  );
}
