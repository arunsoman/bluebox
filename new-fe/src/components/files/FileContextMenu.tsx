import styles from "./FileContextMenu.module.css";

interface FileContextMenuProps {
  x: number;
  y: number;
  onSteer: () => void;
  onWhy: () => void;
  onDiff: () => void;
  onRegenerate: () => void;
  onClose: () => void;
}

export function FileContextMenu({ x, y, onSteer, onWhy, onDiff, onRegenerate, onClose }: FileContextMenuProps) {
  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.menu} style={{ left: x, top: y }}>
        <button
          onClick={() => {
            onSteer();
            onClose();
          }}
        >
          Steer
        </button>
        <button
          onClick={() => {
            onWhy();
            onClose();
          }}
        >
          Why
        </button>
        <button
          onClick={() => {
            onDiff();
            onClose();
          }}
        >
          Diff
        </button>
        <button
          onClick={() => {
            onRegenerate();
            onClose();
          }}
        >
          Regenerate
        </button>
      </div>
    </>
  );
}
