import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditPanel } from "./AuditPanel";
import { ToastProvider } from "@/components/common/Toast/ToastProvider";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useAuditNavigationStore } from "@/stores/auditNavigationStore";
import { auditApi } from "@/api/endpoints/audit";

vi.mock("@/api/endpoints/audit", () => ({
  auditApi: {
    getLedger: vi.fn(),
    getAuditTrail: vi.fn(),
    requestRevision: vi.fn(),
    revertDecision: vi.fn(),
  },
}));

const LEDGER: DecisionLedger = {
  entries: [
    {
      entry_id: "DEC-042",
      decision_type: "steering",
      stage: 3,
      stage_name: "Capability Definition",
      summary: "Selected React + Node.js stack",
      status: "active",
      payload: { decision: "tech_stack_selection", option_id: "TS-003" },
      provenance: { trigger_event: "STEERING_ACTION", context_snapshot_id: "ctx-1" },
      metadata: { layer: "frontend", risk_classification: "LOW_RISK", auto_approved: false, trust_mode_at_decision: "BALANCED" },
      created_at: "2026-06-19T10:00:00Z",
      created_by: "architect",
    },
  ],
  total_count: 1,
  revision_budget_remaining: 4,
  revision_budget_total: 5,
};

function renderPanel() {
  return render(
    <ToastProvider>
      <AuditPanel />
    </ToastProvider>,
  );
}

describe("AuditPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePipelineStore.setState({ projectId: "proj-1" });
    useAuditNavigationStore.setState({ focusEntryId: null, focusAuditQuery: null });
    vi.mocked(auditApi.getLedger).mockResolvedValue(LEDGER);
  });

  it("renders the real decision ledger entries from the API", async () => {
    renderPanel();
    expect(await screen.findByText("Selected React + Node.js stack")).toBeInTheDocument();
    expect(screen.getByText("DEC-042")).toBeInTheDocument();
    expect(screen.getByText(/revision budget 4\/5 remaining/)).toBeInTheDocument();
  });

  it("expands an entry to reveal its full payload and Initiate Revision action", async () => {
    renderPanel();
    const row = await screen.findByText("Selected React + Node.js stack");
    await userEvent.click(row);

    expect(screen.getByText(/tech_stack_selection/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Initiate Revision" })).toBeInTheDocument();
  });

  it("switches to the Audit Trail tab and fetches real trail data", async () => {
    vi.mocked(auditApi.getAuditTrail).mockResolvedValue({
      events: [
        {
          event_id: "evt-1",
          timestamp: "2026-06-19T14:32:01Z",
          session_id: "sess-1",
          actor: { user_id: "u1", role: "architect" },
          action: "steering",
          stage: 3,
          target: { target_type: "capability", target_id: "cap-1" },
          description: "Selected React framework",
          storage_tier: "FULL",
        },
      ],
      total_count: 1,
      storage_used_bytes: 1024,
      storage_budget_bytes: 4096,
      retention_days: 90,
    });

    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Audit Trail" }));

    expect(await screen.findByText("Selected React framework")).toBeInTheDocument();
    expect(auditApi.getAuditTrail).toHaveBeenCalledWith("proj-1", expect.objectContaining({ limit: 100 }));
  });
});
