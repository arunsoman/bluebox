import { Button } from "@/components/common/Button";
import styles from "./PRDAnalysisReport.module.css";

interface PRDAnalysisReportProps {
  report: PRDAnalysisReportType;
  onProceed: () => void;
}

/**
 * AC-RI-06 (map/annotate/out-of-scope actions per unmapped section) has no
 * corresponding REST/WS endpoint in doc/api_event_contract.md §2.2 — the
 * buttons render per the wireframe but stay disabled with an honest
 * tooltip rather than calling an endpoint we invented.
 */
const NOT_WIRED_TOOLTIP = "Not yet available — this action has no endpoint in the API contract";

export function PRDAnalysisReport({ report, onProceed }: PRDAnalysisReportProps) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>PRD Analysis Report</h1>

        <section className={styles.section}>
          <h2 className={`${styles.sectionHeader} ${styles.success}`}>
            Explicit Sections ({report.explicit_sections.length})
          </h2>
          <ul className={styles.list}>
            {report.explicit_sections.map((s) => (
              <li key={s.section_name}>
                {s.section_name}
                <span className={styles.stageTag}>→ Stage {s.mapped_to_stage}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={`${styles.sectionHeader} ${styles.warning}`}>
            Thin Sections ({report.thin_sections.length})
          </h2>
          <ul className={styles.list}>
            {report.thin_sections.map((s) => (
              <li key={s.section_name}>
                {s.section_name} — <span className={styles.muted}>{s.missing_detail}</span>
                <button className={styles.linkButton} disabled title={NOT_WIRED_TOOLTIP}>
                  Add detail
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={`${styles.sectionHeader} ${styles.error}`}>
            Missing Sections ({report.missing_sections.length})
          </h2>
          <ul className={styles.list}>
            {report.missing_sections.map((s) => (
              <li key={s.expected_section_name}>
                {s.expected_section_name}
                <button className={styles.linkButton} disabled title={NOT_WIRED_TOOLTIP}>
                  Generate
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={`${styles.sectionHeader} ${styles.info}`}>
            Unmapped Sections ({report.unmapped_sections.length})
          </h2>
          <ul className={styles.list}>
            {report.unmapped_sections.map((s) => (
              <li key={s.section_name}>
                {s.section_name}
                <span className={styles.actionGroup}>
                  <button className={styles.linkButton} disabled title={NOT_WIRED_TOOLTIP}>
                    Map to Stage
                  </button>
                  <button className={styles.linkButton} disabled title={NOT_WIRED_TOOLTIP}>
                    Save as Annotation
                  </button>
                  <button className={styles.linkButton} disabled title={NOT_WIRED_TOOLTIP}>
                    Out of Scope
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {report.conflicts.length > 0 && (
          <section className={styles.section}>
            <h2 className={`${styles.sectionHeader} ${styles.error}`}>
              Conflicts ({report.conflicts.length})
            </h2>
            <ul className={styles.list}>
              {report.conflicts.map((c, i) => (
                <li key={i}>{c.description}</li>
              ))}
            </ul>
          </section>
        )}

        <div className={styles.footer}>
          <Button onClick={onProceed}>Proceed to workspace</Button>
        </div>
      </div>
    </div>
  );
}
