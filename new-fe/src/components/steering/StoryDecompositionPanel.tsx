import { DraftNodeRow } from "./DraftNodeRow";
import { NodeDetailCard } from "./NodeDetailCard";
import { BookmarkDrawer } from "./BookmarkDrawer";
import { StagePanelChrome } from "./StagePanelChrome";
import { useStagePanel } from "./useStagePanel";
import { useRevisionBudget } from "./useRevisionBudget";
import { usePipelineStore } from "@/stores/pipelineStore";
import styles from "./StagePanelShared.module.css";

interface StoryFullData {
  story_points?: number;
  priority?: string;
  acceptance_criteria?: unknown[];
}

function storyMeta(node: DraftNode) {
  const full = node.full_data as StoryFullData | undefined;
  if (full?.story_points === undefined && !full?.acceptance_criteria) return undefined;
  return `Points: ${full?.story_points ?? "—"} | ${full?.priority ?? ""} | AC: ${full?.acceptance_criteria?.length ?? 0}`;
}

/** doc/phase-1-wireframe.md §11.1 — Story Decomposition Steering Panel. */
export function StoryDecompositionPanel() {
  const projectId = usePipelineStore((s) => s.projectId);
  const budget = useRevisionBudget(projectId);
  const state = useStagePanel();
  if (!state.panel) return null;
  const {
    panel,
    selectedNodeIds,
    bookmarkedOptionIds,
    mode,
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
    expandedNode,
    acceptAllSelection,
    canApproveAll,
    approveAllLabel,
    consentedIds,
    toggleConsent,
    goToImpactGraph,
    regenerating,
    regenerate,
  } = state;

  return (
    <StagePanelChrome
      title={panel.stage_name}
      subtitle="Decompose use cases into implementable user stories"
      trustSummary={`Trust: ${panel.trust_mode} (${panel.auto_approved_count} auto-approved, ${panel.paused_count} paused, ${panel.critical_count} CRITICAL)`}
      mode={mode}
      setMode={setMode}
      page={page}
      setPage={setPage}
      totalPages={totalPages}
      contextWindow={panel.context_window}
      extraRow={
        budget && (
          <div className={styles.budgetRow}>
            <span>
              Revision Budget: {budget.remaining} / {budget.total} remaining
            </span>
            <div className={styles.budgetBar}>
              <div
                className={styles.budgetFill}
                style={{ width: `${budget.total === 0 ? 0 : (budget.remaining / budget.total) * 100}%` }}
              />
            </div>
            {budget.remaining <= 1 && <span className={styles.budgetWarning}>Budget low. Use What-If mode for exploration.</span>}
          </div>
        )
      }
      approveAll={{
        disabled: !canApproveAll,
        loading: submitting,
        title: canApproveAll ? undefined : "Check the consent box on every HIGH/CRITICAL story first",
        label: approveAllLabel,
        onClick: () => submitAction("accept", { selected_node_ids: acceptAllSelection }),
      }}
      reviewSelected={{
        disabled: selectedNodeIds.size === 0,
        loading: submitting,
        onClick: () => submitAction("accept", { selected_node_ids: Array.from(selectedNodeIds) }),
      }}
      bookmarkCount={bookmarkedOptionIds.size}
      onShowBookmarks={() => setShowBookmarks(true)}
      onImpactGraph={goToImpactGraph}
      regenerate={{ loading: regenerating, onClick: regenerate }}
      bookmarkDrawer={
        showBookmarks && (
          <BookmarkDrawer
            nodes={bookmarkedNodes}
            submitting={submitting}
            onClose={() => setShowBookmarks(false)}
            onSelect={(nodeId) => {
              void submitAction("accept", { selected_node_ids: [nodeId] });
              setShowBookmarks(false);
            }}
          />
        )
      }
    >
      {mode === "summary" &&
        pageNodes.map((node) => (
          <DraftNodeRow
            key={node.node_id}
            node={node}
            selected={selectedNodeIds.has(node.node_id)}
            bookmarked={bookmarkedOptionIds.has(node.node_id)}
            onToggleSelect={() => toggleSelect(node.node_id)}
            onToggleBookmark={() => toggleBookmark(node.node_id)}
            onOpenDetail={() => {
              setMode("detail");
              setExpanded(node.node_id);
            }}
            meta={storyMeta(node)}
            consent={
              node.consent_required
                ? {
                    checked: consentedIds.has(node.node_id),
                    onToggle: () => toggleConsent(node.node_id),
                    label:
                      node.risk_classification === "CRITICAL"
                        ? "I consent to this PCI-DSS / compliance-scoped story"
                        : "I consent to this implementation",
                  }
                : undefined
            }
          />
        ))}

      {mode === "detail" &&
        (expandedNode ? (
          <NodeDetailCard
            node={expandedNode}
            submitting={submitting}
            onSaveDescription={(newDescription) =>
              submitAction("modify", {
                modified_nodes: [
                  {
                    node_id: expandedNode.node_id,
                    field_path: "description",
                    new_value: newDescription,
                    old_value: expandedNode.description,
                  },
                ],
              })
            }
          />
        ) : (
          panel.draft_output.map((node) => (
            <DraftNodeRow
              key={node.node_id}
              node={node}
              selected={selectedNodeIds.has(node.node_id)}
              bookmarked={bookmarkedOptionIds.has(node.node_id)}
              onToggleSelect={() => toggleSelect(node.node_id)}
              onToggleBookmark={() => toggleBookmark(node.node_id)}
              onOpenDetail={() => setExpanded(node.node_id)}
              meta={storyMeta(node)}
            />
          ))
        ))}
    </StagePanelChrome>
  );
}
