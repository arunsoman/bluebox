import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePipelineStore } from "@/stores/pipelineStore";
import { workspaceApi } from "@/api/endpoints/workspace";
import { socketClient } from "@/ws/socketClient";
import { ApiError } from "@/api/httpClient";
import { useToast } from "@/components/common/Toast/ToastContext";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { FileTreeNode } from "./FileTreeNode";
import { FileContextMenu } from "./FileContextMenu";
import { ProvenanceTooltip } from "./ProvenanceTooltip";
import styles from "./FileExplorer.module.css";

export function FileExplorer() {
  const projectId = usePipelineStore((s) => s.projectId);
  const { pushToast } = useToast();
  const { tree, loadingTree, activeTabPath, init, refreshTree, openFile, teardown } = useWorkspaceStore();

  const [contextMenu, setContextMenu] = useState<{ path: string; x: number; y: number } | null>(null);
  const [hoverPath, setHoverPath] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<ProvenanceInfo | null>(null);
  const [whyInfo, setWhyInfo] = useState<ProvenanceInfo | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) void init(projectId);
    return () => teardown();
  }, [projectId, init, teardown]);

  useEffect(() => {
    if (!hoverPath || !projectId) {
      setHoverInfo(null);
      return;
    }
    const timer = setTimeout(() => {
      workspaceApi.getProvenance(projectId, { path: hoverPath }).then(setHoverInfo).catch(() => setHoverInfo(null));
    }, 500);
    return () => clearTimeout(timer);
  }, [hoverPath, projectId]);

  async function handleWhy(path: string) {
    if (!projectId) return;
    try {
      setWhyInfo(await workspaceApi.getProvenance(projectId, { path }));
    } catch (err) {
      pushToast({ severity: "error", title: "Could not load provenance", body: err instanceof ApiError ? err.message : "Unknown error" });
    }
  }

  async function handleDiff(path: string) {
    if (!projectId) return;
    try {
      setDiffResult(await workspaceApi.getDiff(projectId, { file_path: path }));
    } catch (err) {
      pushToast({ severity: "error", title: "Could not load diff", body: err instanceof ApiError ? err.message : "Unknown error" });
    }
  }

  function handleSteer(path: string) {
    const instruction = window.prompt(`Steering instruction for ${path}:`);
    if (!instruction) return;
    try {
      socketClient.emit("CODE_FILE_STEER", { file_path: path, action: "modify", instruction });
      pushToast({ severity: "info", title: "Steering instruction sent" });
    } catch (err) {
      pushToast({ severity: "error", title: "Could not send steering instruction", body: err instanceof Error ? err.message : undefined });
    }
  }

  function confirmRegenerate() {
    if (!regenerateTarget) return;
    try {
      socketClient.emit("CODE_FILE_STEER", { file_path: regenerateTarget, action: "regenerate" });
      pushToast({ severity: "info", title: "Regeneration requested" });
    } catch (err) {
      pushToast({ severity: "error", title: "Could not request regeneration", body: err instanceof Error ? err.message : undefined });
    }
    setRegenerateTarget(null);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Explorer</span>
        <button className={styles.refresh} onClick={() => void refreshTree()} title="Refresh">
          ↻
        </button>
      </div>

      {loadingTree && (
        <div className={styles.loading}>
          <Spinner size={20} />
        </div>
      )}

      {!loadingTree && !tree && (
        <EmptyState title="No files yet" description="Files will appear during code generation." />
      )}

      {!loadingTree && tree && (
        <div className={styles.tree}>
          <FileTreeNode
            node={tree}
            depth={0}
            activePath={activeTabPath}
            onOpenFile={(path) => void openFile(path)}
            onContextMenu={(path, x, y) => setContextMenu({ path, x, y })}
            onHoverFile={setHoverPath}
          />
          {hoverPath && hoverInfo && hoverInfo.file_path === hoverPath && (
            <div className={styles.tooltipAnchor}>
              <ProvenanceTooltip info={hoverInfo} />
            </div>
          )}
        </div>
      )}

      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onSteer={() => handleSteer(contextMenu.path)}
          onWhy={() => handleWhy(contextMenu.path)}
          onDiff={() => handleDiff(contextMenu.path)}
          onRegenerate={() => setRegenerateTarget(contextMenu.path)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {whyInfo && (
        <Modal title="Why this file exists" onClose={() => setWhyInfo(null)} width={420}>
          <ProvenanceTooltip info={whyInfo} />
        </Modal>
      )}

      {diffResult && (
        <Modal title={`Diff — ${diffResult.file_path}`} onClose={() => setDiffResult(null)} width={520}>
          <p>{diffResult.additions.length} additions, {diffResult.deletions.length} deletions, {diffResult.modifications.length} modifications, {diffResult.unchanged} unchanged.</p>
          <div className={styles.diffLines}>
            {diffResult.additions.map((l) => (
              <div key={`a${l.line_number}`} className={styles.added}>+ {l.content}</div>
            ))}
            {diffResult.deletions.map((l) => (
              <div key={`d${l.line_number}`} className={styles.removed}>- {l.content}</div>
            ))}
          </div>
        </Modal>
      )}

      {regenerateTarget && (
        <Modal title="Regenerate file" onClose={() => setRegenerateTarget(null)} width={400}>
          <p>Regenerating will overwrite current content of {regenerateTarget}.</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Button variant="secondary" onClick={() => setRegenerateTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmRegenerate}>
              Confirm Regenerate
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
