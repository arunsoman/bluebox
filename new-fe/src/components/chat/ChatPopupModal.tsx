import { Modal } from "@/components/common/Modal";
import { ChatPanel } from "./ChatPanel";
import styles from "./ChatPopupModal.module.css";

/**
 * Pop-out variant of the always-docked left-sidebar chat panel - lets a
 * component elsewhere in the workspace (e.g. PRDAnalysisReport's "Discuss in
 * chat" per-conflict action) hand off to the assistant with context
 * pre-filled (via chatStore's `draftMessage`) without navigating the user
 * away from whatever they were looking at. Reuses ChatPanel as-is.
 */
export function ChatPopupModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Discuss with AI" onClose={onClose} width={560}>
      <div className={styles.body}>
        <ChatPanel />
      </div>
    </Modal>
  );
}
