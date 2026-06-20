import { DraftNodeRow } from "./DraftNodeRow";
import { NodeDetailCard } from "./NodeDetailCard";
import { BookmarkDrawer } from "./BookmarkDrawer";
import { StagePanelChrome } from "./StagePanelChrome";
import { useStagePanel } from "./useStagePanel";

interface UseCaseFullData {
  main_flow?: unknown[];
  preconditions?: unknown[];
}

function describeUseCaseMeta(node: DraftNode) {
  const full = node.full_data as UseCaseFullData | undefined;
  if (!full?.main_flow && !full?.preconditions) return undefined;
  return `Steps: ${full.main_flow?.length ?? 0} | Pre: ${full.preconditions?.length ?? 0}`;
}

/** doc/phase-1-wireframe.md §10.1 — Use Case Decomposition Steering Panel. */
export function UseCaseDecompositionPanel() {
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
    consentedIds,
    toggleConsent,
    goToImpactGraph,
  } = state;

  return (
    <StagePanelChrome
      title={panel.stage_name}
      subtitle="Decompose capabilities into user-interaction flows"
      trustSummary={`Trust: ${panel.trust_mode} (${panel.auto_approved_count} auto-approved, ${panel.paused_count} paused, ${panel.critical_count} CRITICAL)`}
      mode={mode}
      setMode={setMode}
      page={page}
      setPage={setPage}
      totalPages={totalPages}
      contextWindow={panel.context_window}
      approveAll={{
        disabled: !canApproveAll,
        loading: submitting,
        title: canApproveAll ? undefined : "Check the consent box on every HIGH/CRITICAL use case first",
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
            meta={describeUseCaseMeta(node)}
            consent={
              node.consent_required
                ? {
                    checked: consentedIds.has(node.node_id),
                    onToggle: () => toggleConsent(node.node_id),
                    label: "I consent to this cross-cutting use case (requires architectural review)",
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
              meta={describeUseCaseMeta(node)}
            />
          ))
        ))}
    </StagePanelChrome>
  );
}
