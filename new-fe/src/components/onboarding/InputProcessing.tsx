import { Spinner } from "@/components/common/Spinner";
import styles from "./InputProcessing.module.css";

export interface ProcessingStepView {
  index: number;
  name: string;
  status: "pending" | "active" | "complete";
}

interface InputProcessingProps {
  steps: ProcessingStepView[];
}

export function InputProcessing({ steps }: InputProcessingProps) {
  const completeCount = steps.filter((s) => s.status === "complete").length;
  const progressPercent = steps.length > 0 ? Math.round((completeCount / steps.length) * 100) : 0;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Spinner />
        <h2 className={styles.heading}>Analyzing your input...</h2>

        {steps.length === 0 ? (
          <p className={styles.waiting}>Submitting input…</p>
        ) : (
          <>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
            </div>
            <ul className={styles.stepList}>
              {steps.map((step) => (
                <li key={step.index} className={`${styles.step} ${styles[step.status]}`}>
                  <span className={styles.stepIcon} aria-hidden>
                    {step.status === "complete" ? "✓" : step.status === "active" ? "●" : "○"}
                  </span>
                  {step.name}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
