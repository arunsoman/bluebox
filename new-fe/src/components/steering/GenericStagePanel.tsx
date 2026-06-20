import { EmptyState } from "@/components/common/EmptyState";
import { DraftNodeRow } from "./DraftNodeRow";
import { NodeDetailCard } from "./NodeDetailCard";
import { BookmarkDrawer } from "./BookmarkDrawer";
import { StagePanelChrome } from "./StagePanelChrome";
import { useStagePanel } from "./useStagePanel";

/** Fallback rendering for any stage_id without a dedicated panel (e.g. unrecognized/future stages) — the original generic steering panel UI, without the per-stage consent gate. */
export function GenericStagePanel() {
  const state = useStagePanel();
  if (!state.panel) {
    return (
      <EmptyState
        title="Waiting for the next stage boundary"
        description="The Steering Panel populates once the backend has a draft ready for review."
      />
    );
  }
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
    goToImpactGraph,
  } = state;

  return (
    <StagePanelChrome
      title={panel.stage_name}
      subtitle={panel.stage_description}
      trustSummary={`Trust: ${panel.trust_mode} (${panel.auto_approved_count} auto)`}
      mode={mode}
      setMode={setMode}
      page={page}
      setPage={setPage}
      totalPages={totalPages}
      contextWindow={panel.context_window}
      approveAll={{
        disabled: approvableIds.length === 0,
        loading: submitting,
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
            />
          ))
        ))}
    </StagePanelChrome>
  );
}
