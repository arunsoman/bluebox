import { DraftNodeRow } from "./DraftNodeRow";
import { NodeDetailCard } from "./NodeDetailCard";
import { BookmarkDrawer } from "./BookmarkDrawer";
import { StagePanelChrome } from "./StagePanelChrome";
import { useStagePanel } from "./useStagePanel";
import { useRevisionBudget } from "./useRevisionBudget";
import { usePipelineStore } from "@/stores/pipelineStore";
import styles from "./StagePanelShared.module.css";

interface AccessGuard {
  guard_id: string;
  description: string;
  is_required: boolean;
  is_defined: boolean;
}

interface FilePath {
  path: string;
}

interface TaskFullData {
  complexity?: string;
  estimated_hours?: number;
  access_guards?: AccessGuard[];
  file_paths?: FilePath[];
}

function taskMeta(node: DraftNode) {
  const full = node.full_data as TaskFullData | undefined;
  if (full?.complexity === undefined && full?.estimated_hours === undefined) return undefined;
  return `${full?.complexity ?? "—"} | Est: ${full?.estimated_hours ?? "—"}h`;
}

function taskExtra(node: DraftNode) {
  const full = node.full_data as TaskFullData | undefined;
  const guards = full?.access_guards ?? [];
  const files = full?.file_paths ?? [];
  if (guards.length === 0 && files.length === 0) return undefined;
  const definedCount = guards.filter((g) => g.is_defined).length;
  return (
    <>
      {guards.length > 0 && (
        <ul className={styles.guardList}>
          <li>
            {definedCount} of {guards.length} access guards defined
            {definedCount < guards.length && node.risk_classification !== "LOW_RISK" && " — meets requirement"}
          </li>
          {guards.map((g) => (
            <li key={g.guard_id} className={styles.guardItem}>
              {g.is_defined ? "✓" : "○"} {g.description}
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <div className={styles.fileChips}>
          {files.map((f, i) => (
            <span key={i} className={styles.fileChip}>
              {f.path}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

/** doc/phase-1-wireframe.md §12.1 — Task Decomposition Steering Panel. */
export function TaskDecompositionPanel() {
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
    approvableIds,
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
      subtitle="Decompose stories into engineering tasks with file paths and access guards"
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
        title: canApproveAll ? undefined : "Check the consent box on every HIGH/CRITICAL task first",
        label: approveAllLabel,
        onClick: () => submitAction("accept", { selected_node_ids: approvableIds }),
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
            meta={taskMeta(node)}
            extra={taskExtra(node)}
            consent={
              node.consent_required
                ? {
                    checked: consentedIds.has(node.node_id),
                    onToggle: () => toggleConsent(node.node_id),
                    label: "I consent to this PCI-DSS / compliance scope for this task",
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
              meta={taskMeta(node)}
              extra={taskExtra(node)}
            />
          ))
        ))}
    </StagePanelChrome>
  );
}
