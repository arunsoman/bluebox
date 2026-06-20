import Editor from "@monaco-editor/react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { socketClient } from "@/ws/socketClient";
import { useToast } from "@/components/common/Toast/ToastContext";
import { ApiError } from "@/api/httpClient";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/common/Button";
import { EditorTabs } from "./EditorTabs";
import { parseInlineSteering } from "./InlineSteeringParser";
import styles from "./EditorPanel.module.css";

export function EditorPanel() {
  const { pushToast } = useToast();
  const { openTabs, activeTabPath, setActiveTab, closeFile, updateTabContent, saveFile } =
    useWorkspaceStore();

  // Lifecycle (init/teardown) is owned by FileExplorer, which is always
  // mounted in the left sidebar regardless of which center tab is active —
  // owning it here too would wipe shared workspace state on tab switches.
  const activeTab = openTabs.find((t) => t.path === activeTabPath) ?? null;

  async function handleSave() {
    if (!activeTab) return;
    try {
      await saveFile(activeTab.path);
      pushToast({ severity: "success", title: "File saved", body: activeTab.path });
    } catch (err) {
      pushToast({
        severity: "error",
        title: "Save failed",
        body: err instanceof ApiError ? err.message : "Unknown error",
      });
    }
  }

  function handleSendSteering() {
    if (!activeTab) return;
    const { instructions, strippedContent } = parseInlineSteering(activeTab.content);
    if (instructions.length === 0) {
      pushToast({ severity: "info", title: "No @steering comments found" });
      return;
    }
    instructions.forEach((instruction) => {
      try {
        socketClient.emit("MID_STAGE_STEER", {
          stage_id: 0,
          instruction,
          action_type: "modify",
          file_path: activeTab.path,
        });
      } catch (err) {
        pushToast({
          severity: "error",
          title: "Could not send steering instruction",
          body: err instanceof Error ? err.message : undefined,
        });
      }
    });
    updateTabContent(activeTab.path, strippedContent);
    pushToast({ severity: "info", title: `${instructions.length} steering instruction(s) sent` });
  }

  if (openTabs.length === 0) {
    return (
      <EmptyState
        title="No file open"
        description="Open a file from the File Explorer to start editing."
      />
    );
  }

  return (
    <div className={styles.panel}>
      <EditorTabs tabs={openTabs} activePath={activeTabPath} onSelect={setActiveTab} onClose={closeFile} />
      {activeTab && (
        <>
          <div className={styles.toolbar}>
            <span className={styles.path}>{activeTab.path}</span>
            {activeTab.isGenerating && <span className={styles.generating}>Generating…</span>}
            <Button variant="secondary" onClick={handleSendSteering}>
              Send @steering comments
            </Button>
            <Button onClick={handleSave} disabled={!activeTab.isModified}>
              Save
            </Button>
          </div>
          <div className={styles.editorWrapper}>
            <Editor
              path={activeTab.path}
              language={activeTab.language || "plaintext"}
              value={activeTab.content}
              onChange={(value) => updateTabContent(activeTab.path, value ?? "")}
              options={{ minimap: { enabled: true }, fontSize: 13, readOnly: activeTab.isGenerating }}
              onMount={(editorInstance) => {
                editorInstance.onKeyDown((e) => {
                  if (e.ctrlKey && e.code === "KeyS") {
                    e.preventDefault();
                    void handleSave();
                  }
                });
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
