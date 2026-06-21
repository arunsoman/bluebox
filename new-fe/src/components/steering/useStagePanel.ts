import { useEffect, useState } from "react";
import { useSteeringStore } from "@/stores/steeringStore";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useIdeLayoutStore } from "@/stores/ideLayoutStore";

const PAGE_SIZE = 20;

/**
 * Shared state/derivations behind the five stage-specific steering panels
 * (Actor Discovery, Capability Definition, Use Case/Story/Task
 * Decomposition) — pagination, bookmarking, and the HIGH/CRITICAL consent
 * gate described throughout doc/phase-1-wireframe.md §7-12 ("Approve All:
 * disabled until HIGH consent checkbox checked"). Row rendering stays in
 * each panel component since the fields shown differ per stage.
 */
export function useStagePanel() {
  const projectId = usePipelineStore((s) => s.projectId);
  const setActiveCenterTab = useIdeLayoutStore((s) => s.setActiveCenterTab);
  const {
    panel,
    selectedNodeIds,
    bookmarkedOptionIds,
    mode,
    expandedNodeId,
    submitting,
    regenerating,
    init,
    toggleSelect,
    toggleBookmark,
    setMode,
    setExpanded,
    submitAction,
    regenerate,
  } = useSteeringStore();

  const [page, setPage] = useState(0);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [consentedIds, setConsentedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (projectId) init(projectId);
  }, [projectId, init]);

  useEffect(() => {
    setPage(0);
    setConsentedIds(new Set());
  }, [panel?.stage_id]);

  function toggleConsent(nodeId: string) {
    setConsentedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  const totalPages = panel ? Math.ceil(panel.draft_output.length / PAGE_SIZE) : 0;
  const pageNodes = panel ? panel.draft_output.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : [];
  const approvableNodes = panel ? panel.draft_output.filter((n) => n.status !== "auto_approved") : [];
  const approvableIds = approvableNodes.map((n) => n.node_id);
  const pendingConsent = approvableNodes.filter((n) => n.consent_required && !consentedIds.has(n.node_id));
  // A stage that generated zero approvable items has nothing blocking it - submitting an
  // empty accept is a no-op on the backend (steering_service.accept_all) and still advances
  // the FSM, so the user isn't stuck just because this stage had no candidates to review.
  const nothingToApprove = approvableIds.length === 0;
  const canApproveAll = nothingToApprove || pendingConsent.length === 0;
  const approveAllLabel = nothingToApprove ? "Continue" : "Approve All";
  const bookmarkedNodes = panel ? panel.draft_output.filter((n) => bookmarkedOptionIds.has(n.node_id)) : [];
  const expandedNode = panel?.draft_output.find((n) => n.node_id === expandedNodeId) ?? null;

  return {
    panel,
    selectedNodeIds,
    bookmarkedOptionIds,
    mode,
    expandedNodeId,
    expandedNode,
    submitting,
    toggleSelect,
    toggleBookmark,
    setMode,
    setExpanded,
    submitAction,
    page,
    setPage,
    totalPages,
    pageNodes,
    showBookmarks,
    setShowBookmarks,
    bookmarkedNodes,
    consentedIds,
    toggleConsent,
    approvableIds,
    canApproveAll,
    nothingToApprove,
    approveAllLabel,
    regenerating,
    regenerate,
    goToImpactGraph: () => setActiveCenterTab("graph"),
  } as const;
}
