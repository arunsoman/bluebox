import styles from "./EditorForms.module.css";

interface UserStoryDraft {
  title: string;
  description: string;
  layer: string;
  status: NodeStatus;
  actor_id: string;
  story_points: number;
  priority: UserStory["priority"];
  acceptance_criteria: AcceptanceCriterion[];
  technical_notes: string;
  dependencies: string[];
}

export type { UserStoryDraft };

const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21];
const PRIORITIES: UserStory["priority"][] = ["Must Have", "Should Have", "Could Have"];

function acIsComplete(ac: AcceptanceCriterion): boolean {
  return ac.given.trim().length > 0 && ac.when.trim().length > 0 && ac.then.trim().length > 0;
}

export function UserStoryEditorForm({
  value,
  onChange,
  availableActors,
  availableDependencies,
}: {
  value: UserStoryDraft;
  onChange: (patch: Partial<UserStoryDraft>) => void;
  availableActors: GraphNode[];
  availableDependencies: GraphNode[];
}) {
  function updateAc(i: number, patch: Partial<AcceptanceCriterion>) {
    const next = value.acceptance_criteria.map((ac, idx) => (idx === i ? { ...ac, ...patch } : ac));
    onChange({ acceptance_criteria: next.map((ac) => ({ ...ac, complete: acIsComplete(ac) })) });
  }
  function removeAc(i: number) {
    onChange({ acceptance_criteria: value.acceptance_criteria.filter((_, idx) => idx !== i) });
  }
  function moveAc(i: number, delta: number) {
    const target = i + delta;
    if (target < 0 || target >= value.acceptance_criteria.length) return;
    const next = [...value.acceptance_criteria];
    const [moved] = next.splice(i, 1);
    next.splice(target, 0, moved as AcceptanceCriterion);
    onChange({ acceptance_criteria: next });
  }

  return (
    <>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Basic Info</h3>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <label className={styles.label}>
              Title <span className={styles.requiredMark}>*</span> — "As a [role], I want [goal], so that [benefit]"
            </label>
            <textarea className={styles.textarea} value={value.title} onChange={(e) => onChange({ title: e.target.value })} />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Actor</label>
              <select className={styles.select} value={value.actor_id} onChange={(e) => onChange({ actor_id: e.target.value })}>
                <option value="">Select an actor…</option>
                {availableActors.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Story Points</label>
              <select className={styles.select} value={value.story_points} onChange={(e) => onChange({ story_points: Number(e.target.value) })}>
                {STORY_POINTS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Priority</label>
              <select className={styles.select} value={value.priority} onChange={(e) => onChange({ priority: e.target.value as UserStory["priority"] })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Acceptance Criteria <span className={styles.requiredMark}>*</span>
        </h3>
        <div className={styles.sectionBody}>
          {value.acceptance_criteria.map((ac, i) => (
            <div key={ac.ac_id} className={styles.acCard}>
              <div className={styles.acHeader}>
                <span>AC-{i + 1}</span>
                <div className={styles.acActions}>
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveAc(i, -1)}>↑</button>
                  <button type="button" aria-label="Move down" disabled={i === value.acceptance_criteria.length - 1} onClick={() => moveAc(i, 1)}>↓</button>
                  <button type="button" aria-label="Remove AC" onClick={() => removeAc(i)}>🗑</button>
                </div>
              </div>
              <input className={styles.input} value={ac.given} onChange={(e) => updateAc(i, { given: e.target.value })} placeholder="Given…" />
              <input className={styles.input} value={ac.when} onChange={(e) => updateAc(i, { when: e.target.value })} placeholder="When…" />
              <input className={styles.input} value={ac.then} onChange={(e) => updateAc(i, { then: e.target.value })} placeholder="Then…" />
              {ac.complete ? (
                <span className={styles.acStatusOk}>🟢 Complete AC format</span>
              ) : (
                <span className={styles.acStatusError}>🔴 Incomplete — Given/When/Then all required</span>
              )}
            </div>
          ))}
          <button
            type="button"
            className={styles.addButton}
            onClick={() =>
              onChange({
                acceptance_criteria: [
                  ...value.acceptance_criteria,
                  { ac_id: `ac-${value.acceptance_criteria.length + 1}`, given: "", when: "", then: "", complete: false },
                ],
              })
            }
          >
            + Add Acceptance Criterion
          </button>
          <div>
            {value.acceptance_criteria.length > 0 ? "🟢" : "🔴"} {value.acceptance_criteria.length} AC defined (min 1 required)
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Technical Notes & Dependencies</h3>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <label className={styles.label}>Technical Notes</label>
            <textarea className={styles.textarea} value={value.technical_notes} onChange={(e) => onChange({ technical_notes: e.target.value })} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Dependencies</label>
            <div className={styles.chipRow}>
              {value.dependencies.map((id) => (
                <span key={id} className={styles.chip}>
                  {availableDependencies.find((n) => n.id === id)?.name ?? id}
                  <button type="button" aria-label={`Remove ${id}`} onClick={() => onChange({ dependencies: value.dependencies.filter((x) => x !== id) })}>
                    {" "}×
                  </button>
                </span>
              ))}
            </div>
            <select
              className={styles.select}
              value=""
              onChange={(e) => {
                if (e.target.value) onChange({ dependencies: [...value.dependencies, e.target.value] });
              }}
            >
              <option value="">+ Add Dependency</option>
              {availableDependencies
                .filter((n) => !value.dependencies.includes(n.id))
                .map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
            </select>
          </div>
        </div>
      </section>
    </>
  );
}
