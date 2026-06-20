import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SteeringPanelView } from "./SteeringPanelView";
import { useSteeringStore } from "@/stores/steeringStore";
import { usePipelineStore } from "@/stores/pipelineStore";

vi.mock("@/api/endpoints/steering", () => ({
  steeringApi: { submitAction: vi.fn() },
}));

vi.mock("@/ws/socketClient", () => ({
  socketClient: { on: vi.fn(() => () => {}), emit: vi.fn() },
}));

// stage_id 99 has no dedicated panel, exercising the dispatcher's fallback to GenericStagePanel.
const PANEL: SteeringPanel = {
  stage_id: 99,
  stage_name: "Database Schema",
  stage_description: "Review the proposed schema before it advances.",
  draft_output: [
    {
      node_id: "n1",
      node_type: "table",
      name: "users",
      description: "Core user table",
      layer: "database",
      risk_classification: "LOW_RISK",
      status: "paused",
      downstream_count: 3,
      bookmarked: false,
      selected: false,
    },
    {
      node_id: "n2",
      node_type: "table",
      name: "sessions",
      description: "Session store",
      layer: "database",
      risk_classification: "MEDIUM",
      status: "auto_approved",
      downstream_count: 1,
      bookmarked: false,
      selected: false,
    },
  ],
  options: [],
  context_window: "Generated from the onboarding seed entities.",
  render_policy: { default_mode: "summary", summary_page_size: 20 },
  trust_mode: "PARANOID",
  auto_approved_count: 1,
  paused_count: 1,
  critical_count: 0,
  total_nodes: 2,
};

describe("SteeringPanelView", () => {
  beforeEach(() => {
    usePipelineStore.setState({ projectId: "proj-1" });
    useSteeringStore.setState({
      projectId: "proj-1",
      panel: null,
      selectedNodeIds: new Set(),
      bookmarkedOptionIds: new Set(),
      mode: "summary",
      expandedNodeId: null,
      submitting: false,
      unsubscribe: null,
    });
  });

  it("shows an empty state until the backend sends a panel", () => {
    render(<SteeringPanelView />);
    expect(screen.getByText("Waiting for the next stage boundary")).toBeInTheDocument();
  });

  it("renders the real draft nodes once a panel is present, with auto-approved nodes excluded from manual approval", () => {
    useSteeringStore.setState({ panel: PANEL });
    render(<SteeringPanelView />);

    expect(screen.getByText("Database Schema")).toBeInTheDocument();
    expect(screen.getByText("users")).toBeInTheDocument();
    expect(screen.getByText("sessions")).toBeInTheDocument();
    expect(screen.getByText("Trust: PARANOID (1 auto)")).toBeInTheDocument();
  });

  it("submits the real accept action for all approvable nodes when Approve All is clicked", async () => {
    useSteeringStore.setState({ panel: PANEL });
    const { steeringApi } = await import("@/api/endpoints/steering");
    render(<SteeringPanelView />);

    await userEvent.click(screen.getByRole("button", { name: "Approve All" }));

    expect(steeringApi.submitAction).toHaveBeenCalledWith(
      "proj-1",
      expect.objectContaining({
        action_type: "accept",
        stage_id: 99,
        payload: { selected_node_ids: ["n1"] },
      }),
    );
  });
});
