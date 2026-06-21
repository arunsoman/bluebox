import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/common/Toast/ToastContext";
import { ApiError } from "@/api/httpClient";
import { onboardingApi } from "@/api/endpoints/onboarding";
import { useIdeLayoutStore } from "@/stores/ideLayoutStore";
import { useChatPopupStore } from "@/stores/chatPopupStore";
import { useChatStore } from "@/stores/chatStore";
import styles from "./PRDAnalysisReport.module.css";

interface PRDAnalysisReportProps {
  report: PRDAnalysisReportType;
  projectId: string;
  onReportChange: (updated: PRDAnalysisReportType) => void;
  onProceed: () => void;
  /** True when rendering a previously-submitted PRD (PRDPanel's post-onboarding fetch) — hides the "Proceed" action, which doesn't apply to history, in favor of a link to wherever the pipeline currently is. */
  readOnly?: boolean;
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Unknown error";
}

// be/.../chunked_prd_analyzer.py STAGE_NAMES - kept in sync manually, no endpoint exposes this table.
const STAGE_NAMES = [
  "Seed / Problem Statement",
  "Ideation",
  "Actors",
  "Capabilities",
  "Use Cases",
  "User Stories",
  "Engineering Tasks",
  "Finalization",
  "Code Generation",
  "Runtime",
];

export function PRDAnalysisReport({
  report,
  projectId,
  onReportChange,
  onProceed,
  readOnly = false,
}: PRDAnalysisReportProps) {
  const { pushToast } = useToast();
  const setActiveCenterTab = useIdeLayoutStore((s) => s.setActiveCenterTab);
  const showChatPopup = useChatPopupStore((s) => s.show);
  const setDraftMessage = useChatStore((s) => s.setDraftMessage);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [stageChoice, setStageChoice] = useState<Record<string, number>>({});

  async function runAction(key: string, fn: () => Promise<PRDAnalysisReportType>) {
    setPendingAction(key);
    try {
      onReportChange(await fn());
    } catch (err) {
      pushToast({ severity: "error", title: "Action failed", body: errorMessage(err) });
    } finally {
      setPendingAction(null);
    }
  }

  function discussInChat(description: string, involvedSections: string[]) {
    setDraftMessage(
      `Help me resolve this PRD conflict: "${description}" (sections: ${involvedSections.join(", ")})`,
    );
    showChatPopup();
  }

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
                <div className={styles.itemRow}>
                  {s.section_name}
                  <span className={styles.stageTag}>→ Stage {s.mapped_to_stage}</span>
                </div>
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
                <div className={styles.itemRow}>
                  {s.section_name} — <span className={styles.muted}>{s.missing_detail}</span>
                  <button
                    className={styles.linkButton}
                    disabled={pendingAction === `thin:${s.section_name}`}
                    onClick={() =>
                      runAction(`thin:${s.section_name}`, () =>
                        onboardingApi.addThinSectionDetail(projectId, { section_name: s.section_name }),
                      )
                    }
                  >
                    {pendingAction === `thin:${s.section_name}` ? <Spinner size={12} /> : "Add detail"}
                  </button>
                </div>
                {s.generated_content && <pre className={styles.generatedContent}>{s.generated_content}</pre>}
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
                <div className={styles.itemRow}>
                  {s.expected_section_name}
                  <button
                    className={styles.linkButton}
                    disabled={pendingAction === `missing:${s.expected_section_name}`}
                    onClick={() =>
                      runAction(`missing:${s.expected_section_name}`, () =>
                        onboardingApi.generateMissingSectionContent(projectId, {
                          section_name: s.expected_section_name,
                        }),
                      )
                    }
                  >
                    {pendingAction === `missing:${s.expected_section_name}` ? <Spinner size={12} /> : "Generate"}
                  </button>
                </div>
                {s.generated_content && <pre className={styles.generatedContent}>{s.generated_content}</pre>}
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
                <div className={styles.itemRow}>
                  {s.section_name}
                  <span className={styles.actionGroup}>
                    <select
                      className={styles.stageSelect}
                      value={stageChoice[s.section_name] ?? 7}
                      disabled={pendingAction !== null}
                      onChange={(e) =>
                        setStageChoice((prev) => ({ ...prev, [s.section_name]: Number(e.target.value) }))
                      }
                    >
                      {STAGE_NAMES.map((name, idx) => (
                        <option key={idx} value={idx}>
                          {idx}: {name}
                        </option>
                      ))}
                    </select>
                    <button
                      className={styles.linkButton}
                      disabled={pendingAction !== null}
                      onClick={() =>
                        runAction(`map:${s.section_name}`, () =>
                          onboardingApi.mapUnmappedSectionToStage(projectId, {
                            section_name: s.section_name,
                            stage: stageChoice[s.section_name] ?? 7,
                          }),
                        )
                      }
                    >
                      {pendingAction === `map:${s.section_name}` ? <Spinner size={12} /> : "Map to Stage"}
                    </button>
                    <button
                      className={styles.linkButton}
                      disabled={pendingAction !== null}
                      onClick={() =>
                        runAction(`annotate:${s.section_name}`, () =>
                          onboardingApi.saveUnmappedSectionAsAnnotation(projectId, {
                            section_name: s.section_name,
                          }),
                        )
                      }
                    >
                      {pendingAction === `annotate:${s.section_name}` ? <Spinner size={12} /> : "Save as Annotation"}
                    </button>
                    <button
                      className={styles.linkButton}
                      disabled={pendingAction !== null}
                      onClick={() =>
                        runAction(`scope:${s.section_name}`, () =>
                          onboardingApi.markUnmappedSectionOutOfScope(projectId, {
                            section_name: s.section_name,
                          }),
                        )
                      }
                    >
                      {pendingAction === `scope:${s.section_name}` ? <Spinner size={12} /> : "Out of Scope"}
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {report.out_of_scope_sections.length > 0 && (
            <p className={styles.outOfScopeNote}>
              Out of scope: {report.out_of_scope_sections.join(", ")}
            </p>
          )}
        </section>

        {report.conflicts.length > 0 && (
          <section className={styles.section}>
            <h2 className={`${styles.sectionHeader} ${styles.error}`}>
              Conflicts ({report.conflicts.length})
            </h2>
            <ul className={styles.list}>
              {report.conflicts.map((c, i) => (
                <li key={i}>
                  <div className={styles.itemRow}>
                    {c.description}
                    <button
                      className={styles.linkButton}
                      onClick={() => discussInChat(c.description, c.involved_sections)}
                    >
                      Discuss in chat
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!readOnly && (
          <div className={styles.footer}>
            <Button onClick={onProceed}>Proceed to workspace</Button>
          </div>
        )}

        {readOnly && (
          <div className={styles.readOnlyFooter}>
            <Button variant="secondary" onClick={() => setActiveCenterTab("steering")}>
              Go to Steering →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
