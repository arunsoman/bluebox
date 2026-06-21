import { DraftNodeRow } from "./DraftNodeRow";
import { NodeDetailCard } from "./NodeDetailCard";
import { BookmarkDrawer } from "./BookmarkDrawer";
import { StagePanelChrome } from "./StagePanelChrome";
import { useStagePanel } from "./useStagePanel";

/** doc/phase-1-wireframe.md §8.2 — Capability Definition Steering Panel. */
export function CapabilityDefinitionPanel() {
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
      subtitle="Define what your application can do"
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
        title: canApproveAll ? undefined : "Check the consent box on every HIGH/CRITICAL capability first",
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
            consent={
              node.consent_required
                ? {
                    checked: consentedIds.has(node.node_id),
                    onToggle: () => toggleConsent(node.node_id),
                    label:
                      node.risk_classification === "CRITICAL"
                        ? "I consent to this implementation (touches confidential data)"
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
            />
          ))
        ))}
    </StagePanelChrome>
  );
}
