import { useEffect, useState } from "react";
import { auditApi } from "@/api/endpoints/audit";

/** doc/phase-1-wireframe.md §11.1/§12.1 — "Revision Budget: N / M remaining" meter, sourced from the real decision ledger rather than fabricated per-panel. */
export function useRevisionBudget(projectId: string | null) {
  const [budget, setBudget] = useState<{ remaining: number; total: number } | null>(null);

  useEffect(() => {
    if (!projectId) return;
    auditApi
      .getLedger(projectId)
      .then((ledger) => setBudget({ remaining: ledger.revision_budget_remaining, total: ledger.revision_budget_total }))
      .catch(() => setBudget(null));
  }, [projectId]);

  return budget;
}
