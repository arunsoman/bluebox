import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { useToast } from "@/components/common/Toast/ToastContext";
import { usePipelineStore } from "@/stores/pipelineStore";
import { techStackApi } from "@/api/endpoints/techStack";
import { ApiError } from "@/api/httpClient";
import styles from "./TechStackOptionsModal.module.css";

/**
 * doc/phase-1-wireframe.md §8.1 — Tech Stack Options.
 * The contract has no "detected signals" field on TechStackOptionsMatrix
 * (types.d.ts) — only PRD/onboarding free text mentions it — so that row
 * from the wireframe is omitted rather than fabricated.
 */
export function TechStackOptionsModal({ matrix, onClose }: { matrix: TechStackOptionsMatrix; onClose: () => void }) {
  const projectId = usePipelineStore((s) => s.projectId);
  const { pushToast } = useToast();
  const [selecting, setSelecting] = useState(false);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [rawJsonFor, setRawJsonFor] = useState<string | null>(null);

  function toggleBookmark(optionId: string) {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  }

  async function selectOption(optionId: string) {
    if (!projectId) return;
    setSelecting(true);
    try {
      const profile = await techStackApi.selectStack(projectId, { option_id: optionId });
      pushToast({ severity: "success", title: "Tech stack selected", body: profile.rationale });
      onClose();
    } catch (err) {
      pushToast({ severity: "error", title: "Could not select tech stack", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setSelecting(false);
    }
  }

  return (
    <Modal title="Tech Stack Options" onClose={onClose} width={840}>
      <div className={styles.optionsList}>
        {matrix.options.map((opt) => (
          <div key={opt.option_id} className={styles.option}>
            <div className={styles.optionHeader}>
              <span className={styles.optionName}>{opt.option_name}</span>
            </div>

            <div className={styles.stack}>
              {opt.stack.map((c, i) => (
                <div key={i} className={styles.stackRow}>
                  <span className={styles.stackFramework}>
                    {c.framework}
                    {c.version ? ` (${c.version})` : ""}
                  </span>
                  <span className={styles.stackLanguage}>{c.language}</span>
                  <span className={styles.stackJustification}>{c.justification}</span>
                </div>
              ))}
            </div>

            <p className={styles.optionRationale}>{opt.rationale}</p>

            <div className={styles.prosConsRow}>
              <div className={styles.prosCons}>
                <strong>Pros</strong>
                <ul>
                  {opt.pros.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              <div className={styles.prosCons}>
                <strong>Cons</strong>
                <ul>
                  {opt.cons.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className={styles.actions}>
              <Button loading={selecting} onClick={() => selectOption(opt.option_id)}>
                Select
              </Button>
              <button className={styles.linkButton} onClick={() => toggleBookmark(opt.option_id)}>
                {bookmarked.has(opt.option_id) ? "★ Bookmarked" : "☆ Bookmark"}
              </button>
              <button className={styles.linkButton} onClick={() => setRawJsonFor(rawJsonFor === opt.option_id ? null : opt.option_id)}>
                View Raw JSON
              </button>
            </div>

            {rawJsonFor === opt.option_id && <pre className={styles.rawJson}>{JSON.stringify(opt, null, 2)}</pre>}
          </div>
        ))}
      </div>
    </Modal>
  );
}
