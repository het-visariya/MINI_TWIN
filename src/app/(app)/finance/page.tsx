import type { Metadata } from "next";

import { ModuleStub } from "@/components/patterns/module-stub";

export const metadata: Metadata = { title: "Finance" };

export default function FinancePage() {
  return (
    <ModuleStub
      title={"Finance"}
      description={"What you have committed financially, what is left, and what a paid goal would actually cost you. Tracking only — never advice."}
      domain="finance"
      planned={[
        "Income, monthly budget, expenses by category, subscriptions and savings goals",
        "Projected month-end from your spending trend against the budget",
        "Investments (stocks, mutual funds, FDs, SIPs) with invested and current value — tracking only",
        "Expense splitting for hostel and flat life: who owes whom",
      ]}
      connects={"Finance meets planning where money and time trade off: a paid certification compares its fee against your budget and deadline, and the twin can suggest a free alternative or a different timeline. It gives no personalised investment advice."}
    />
  );
}
