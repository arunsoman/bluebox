import { useState } from "react";
import { Button } from "@/components/common/Button";
import styles from "./RichnessClassificationView.module.css";

const BADGE: Record<RichnessMode, { label: string; className: string }> = {
  WELL_FORMED: { label: "Well-Formed PRD Detected", className: styles.wellFormed },
  MINIMALIST: { label: "Guided Input Needed", className: styles.minimalist },
  SEED_ONLY: { label: "Seed Builder Required", className: styles.seedOnly },
};

const CTA_LABEL: Record<RichnessMode, string> = {
  WELL_FORMED: "Review PRD Analysis",
  MINIMALIST: "Start Guided Input",
  SEED_ONLY: "Build Your Seed",
};

interface RichnessClassificationViewProps {
  classification: RichnessClassification;
  submitting: boolean;
  onProceed: (mode: RichnessMode) => void;
  onOverride: (mode: RichnessMode, rationale: string) => void;
}

export function RichnessClassificationView({
  classification,
  submitting,
  onProceed,
  onOverride,
}: RichnessClassificationViewProps) {
  const [expanded, setExpanded] = useState(false);
  const [reviewing, setReviewing] = useState(classification.requires_user_review);
  const badge = BADGE[classification.mode];

  if (reviewing) {
    return (
      <div className={styles.card}>
        <p className={styles.reviewQuestion}>
          We're {Math.round(classification.confidence * 100)}% confident this is{" "}
          <strong>{badge.label}</strong>. Is that right?
        </p>
        <div className={styles.reviewActions}>
          <Button disabled={submitting} onClick={() => setReviewing(false)}>
            Yes, that's right
          </Button>
          <Button
            variant="secondary"
            loading={submitting}
            onClick={() => {
              const next =
                classification.mode === "WELL_FORMED" ? "MINIMALIST" : ("WELL_FORMED" as RichnessMode);
              onOverride(next, "User corrected automatic classification");
            }}
          >
            No, let me correct
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.badgeRow}>
        <span className={`${styles.badge} ${badge.className}`}>
          <span className={styles.dot} />
          {badge.label}
        </span>
        <span className={styles.confidence}>{Math.round(classification.confidence * 100)}% confidence</span>
      </div>

      <button className={styles.expandToggle} onClick={() => setExpanded((v) => !v)}>
        Why this classification? {expanded ? "▾" : "▸"}
      </button>
      {expanded && (
        <ul className={styles.basisList}>
          {classification.classification_basis.map((basis) => (
            <li key={basis}>{basis}</li>
          ))}
        </ul>
      )}

      <Button
        style={{ width: "100%", marginTop: 16 }}
        loading={submitting}
        onClick={() => onProceed(classification.mode)}
      >
        {CTA_LABEL[classification.mode]}
      </Button>
    </div>
  );
}
