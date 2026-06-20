import { useRef } from "react";
import styles from "./ResizableSash.module.css";

interface ResizableSashProps {
  direction: "vertical" | "horizontal";
  onDrag: (deltaPx: number) => void;
}

/** A 4px drag handle between panels — UIUX §3.1.4. */
export function ResizableSash({ direction, onDrag }: ResizableSashProps) {
  const lastPos = useRef(0);

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    lastPos.current = direction === "vertical" ? e.clientX : e.clientY;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    function handleMove(ev: PointerEvent) {
      const pos = direction === "vertical" ? ev.clientX : ev.clientY;
      const delta = pos - lastPos.current;
      lastPos.current = pos;
      onDrag(delta);
    }
    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <div
      className={direction === "vertical" ? styles.vertical : styles.horizontal}
      onPointerDown={handlePointerDown}
      role="separator"
      aria-orientation={direction}
    />
  );
}
