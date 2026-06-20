import { useState } from "react";
import { Button } from "@/components/common/Button";
import styles from "./ComplianceBanner.module.css";

const HIGH_RISK: ComplianceFramework[] = ["GDPR", "HIPAA", "PCI-DSS"];
const MEDIUM_RISK: ComplianceFramework[] = ["SOC2", "ISO27001"];

function chipClass(framework: ComplianceFramework): string {
  if (HIGH_RISK.includes(framework)) return styles.high;
  if (MEDIUM_RISK.includes(framework)) return styles.medium;
  return styles.low;
}

interface ComplianceBannerProps {
  result: ComplianceDetectionResult;
  onConfirm: () => void;
}

export function ComplianceBanner({ result, onConfirm }: ComplianceBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [removedFrameworks, setRemovedFrameworks] = useState<Set<ComplianceFramework>>(new Set());
  const [showPolicy, setShowPolicy] = useState(false);

  if (dismissed) return null;
  const frameworks = result.frameworks.filter((f) => !removedFrameworks.has(f));

  return (
    <div className={styles.banner}>
      <div className={styles.header}>
        <span className={styles.headerText}>Compliance frameworks detected</span>
        <button className={styles.dismiss} aria-label="Dismiss" onClick={() => setDismissed(true)}>
          ×
        </button>
      </div>

      <div className={styles.chips}>
        {frameworks.map((framework) => (
          <span key={framework} className={`${styles.chip} ${chipClass(framework)}`}>
            {framework}
            <button
              className={styles.chipRemove}
              aria-label={`Remove ${framework}`}
              onClick={() =>
                setRemovedFrameworks((prev) => new Set(prev).add(framework))
              }
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <button className={styles.toggle} onClick={() => setShowPolicy((v) => !v)}>
        Review audit policy defaults {showPolicy ? "▾" : "▸"}
      </button>

      {showPolicy && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Policy Setting</th>
              <th>Detected Default</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(result.audit_policy_defaults).map(([setting, value]) => (
              <tr key={setting}>
                <td>{setting}</td>
                <td>
                  <code>{value}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Button style={{ width: "100%", marginTop: 16 }} onClick={onConfirm}>
        Confirm and Continue
      </Button>
    </div>
  );
}
