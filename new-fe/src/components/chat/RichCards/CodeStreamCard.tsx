import { useIdeLayoutStore } from "@/stores/ideLayoutStore";
import styles from "./RichCards.module.css";

interface CodeStreamCardProps {
  chunk: CodeFileChunk;
  onJumpToFile?: (path: string) => void;
}

export function CodeStreamCard({ chunk, onJumpToFile }: CodeStreamCardProps) {
  const setActiveCenterTab = useIdeLayoutStore((s) => s.setActiveCenterTab);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>{chunk.file_path}</div>
      <pre className={styles.codeSnippet}>{chunk.content_delta}</pre>
      <button
        className={styles.cardAction}
        onClick={() => {
          setActiveCenterTab("editor");
          onJumpToFile?.(chunk.file_path);
        }}
      >
        Jump to File →
      </button>
    </div>
  );
}
