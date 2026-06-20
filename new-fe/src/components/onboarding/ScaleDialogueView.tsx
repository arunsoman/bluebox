import { useState } from "react";
import { Button } from "@/components/common/Button";
import styles from "./ScaleDialogueView.module.css";

interface ScaleDialogueViewProps {
  conflicts: ScaleInputConflict[];
  generating: boolean;
  onSubmit: (inputs: ScaleInputs) => void;
}

export function ScaleDialogueView({ conflicts, generating, onSubmit }: ScaleDialogueViewProps) {
  const [totalUsers, setTotalUsers] = useState(10000);
  const [concurrentUsers, setConcurrentUsers] = useState(500);
  const [budget, setBudget] = useState(500);
  const [noBudgetLimit, setNoBudgetLimit] = useState(false);
  const [timeline, setTimeline] = useState<ScaleInputs["launch_timeline"]>("1-3 months");

  const concurrentExceedsTotal = concurrentUsers > totalUsers;
  const hasBlockingConflict = concurrentExceedsTotal || conflicts.length > 0;

  function handleSubmit() {
    onSubmit({
      expected_total_users: totalUsers,
      peak_concurrent_users: concurrentUsers,
      monthly_budget_usd: noBudgetLimit ? undefined : budget,
      no_budget_limit: noBudgetLimit,
      launch_timeline: timeline,
    });
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2 className={styles.heading}>Define Your Scale</h2>

        <label className={styles.label}>Expected total users *</label>
        <input
          type="number"
          className={styles.input}
          value={totalUsers}
          onChange={(e) => setTotalUsers(Number(e.target.value))}
        />

        <label className={styles.label}>Peak concurrent users *</label>
        <input
          type="number"
          className={`${styles.input} ${concurrentExceedsTotal ? styles.inputError : ""}`}
          value={concurrentUsers}
          onChange={(e) => setConcurrentUsers(Number(e.target.value))}
        />
        {concurrentExceedsTotal && (
          <p className={styles.errorText}>Peak concurrent users cannot exceed total users</p>
        )}

        <label className={styles.label}>Monthly budget (USD)</label>
        <input
          type="number"
          className={styles.input}
          disabled={noBudgetLimit}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
        />
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={noBudgetLimit}
            onChange={(e) => setNoBudgetLimit(e.target.checked)}
          />
          No limit
        </label>

        <label className={styles.label}>Launch timeline *</label>
        <select
          className={styles.input}
          value={timeline}
          onChange={(e) => setTimeline(e.target.value as ScaleInputs["launch_timeline"])}
        >
          <option value="< 1 month">&lt; 1 month</option>
          <option value="1-3 months">1-3 months</option>
          <option value="3-6 months">3-6 months</option>
          <option value="6+ months">6+ months</option>
        </select>

        {conflicts.map((c, i) => (
          <p key={i} className={styles.errorText}>
            {c.description}
          </p>
        ))}

        <Button
          style={{ width: "100%", marginTop: 20 }}
          disabled={hasBlockingConflict}
          loading={generating}
          onClick={handleSubmit}
        >
          Generate Options
        </Button>
      </div>
    </div>
  );
}
