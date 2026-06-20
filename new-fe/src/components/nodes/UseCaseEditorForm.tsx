import { StringListField } from "./StringListField";
import styles from "./EditorForms.module.css";

interface UseCaseDraft {
  name: string;
  description: string;
  layer: string;
  status: NodeStatus;
  primary_actor_id: string;
  secondary_actor_ids: string[];
  preconditions: string[];
  main_flow: UseCaseStep[];
  alternative_flows: AlternativeFlow[];
  postconditions: string[];
  success_criteria: string[];
}

export type { UseCaseDraft };

function StepListEditor({ steps, onChange }: { steps: UseCaseStep[]; onChange: (steps: UseCaseStep[]) => void }) {
  function update(i: number, patch: Partial<UseCaseStep>) {
    onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function remove(i: number) {
    onChange(steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, step_number: idx + 1 })));
  }
  function move(i: number, delta: number) {
    const target = i + delta;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const [moved] = next.splice(i, 1);
    next.splice(target, 0, moved as UseCaseStep);
    onChange(next.map((s, idx) => ({ ...s, step_number: idx + 1 })));
  }
  return (
    <div className={styles.stringList}>
      {steps.map((step, i) => (
        <div key={i} className={styles.stringListRow}>
          <span>{step.step_number}.</span>
          <input
            className={styles.stringListInput}
            value={step.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="What happens in this step"
          />
          <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
          <button type="button" aria-label="Move down" disabled={i === steps.length - 1} onClick={() => move(i, 1)}>↓</button>
          <button type="button" aria-label="Remove step" onClick={() => remove(i)}>🗑</button>
        </div>
      ))}
      <button
        type="button"
        className={styles.addButton}
        onClick={() => onChange([...steps, { step_number: steps.length + 1, description: "", actor_performing: "" }])}
      >
        + Add Step
      </button>
    </div>
  );
}

export function UseCaseEditorForm({
  value,
  onChange,
  availableActors,
}: {
  value: UseCaseDraft;
  onChange: (patch: Partial<UseCaseDraft>) => void;
  availableActors: GraphNode[];
}) {
  return (
    <>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Basic Info</h3>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <label className={styles.label}>
              Name <span className={styles.requiredMark}>*</span>
            </label>
            <input className={styles.input} value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Layer</label>
            <input className={styles.input} value={value.layer} onChange={(e) => onChange({ layer: e.target.value })} />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Description & Context</h3>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <label className={styles.label}>
              Description <span className={styles.requiredMark}>*</span> (min 50 chars)
            </label>
            <textarea className={styles.textarea} value={value.description} onChange={(e) => onChange({ description: e.target.value })} />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Actors & Preconditions</h3>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <label className={styles.label}>Primary Actor</label>
            <select className={styles.select} value={value.primary_actor_id} onChange={(e) => onChange({ primary_actor_id: e.target.value })}>
              <option value="">Select an actor…</option>
              {availableActors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Secondary Actors</label>
            <div className={styles.chipRow}>
              {value.secondary_actor_ids.map((id) => (
                <span key={id} className={styles.chip}>
                  {availableActors.find((a) => a.id === id)?.name ?? id}
                  <button
                    type="button"
                    aria-label={`Remove ${id}`}
                    onClick={() => onChange({ secondary_actor_ids: value.secondary_actor_ids.filter((x) => x !== id) })}
                  >
                    {" "}×
                  </button>
                </span>
              ))}
            </div>
            <select
              className={styles.select}
              value=""
              onChange={(e) => {
                if (e.target.value) onChange({ secondary_actor_ids: [...value.secondary_actor_ids, e.target.value] });
              }}
            >
              <option value="">+ Add Actor</option>
              {availableActors
                .filter((a) => a.id !== value.primary_actor_id && !value.secondary_actor_ids.includes(a.id))
                .map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
            </select>
          </div>
          <StringListField label="Preconditions" items={value.preconditions} onChange={(preconditions) => onChange({ preconditions })} />
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Flow Steps (Main + Alternatives)</h3>
        <div className={styles.sectionBody}>
          <label className={styles.label}>Main Flow (min 3 steps)</label>
          <StepListEditor steps={value.main_flow} onChange={(main_flow) => onChange({ main_flow })} />

          <label className={styles.label}>Alternative Flows</label>
          {value.alternative_flows.map((flow, i) => (
            <div key={flow.flow_id} className={styles.acCard}>
              <div className={styles.acHeader}>
                <input
                  className={styles.input}
                  value={flow.flow_name}
                  onChange={(e) =>
                    onChange({
                      alternative_flows: value.alternative_flows.map((f, idx) => (idx === i ? { ...f, flow_name: e.target.value } : f)),
                    })
                  }
                  placeholder="Alt flow name"
                />
                <button
                  type="button"
                  onClick={() => onChange({ alternative_flows: value.alternative_flows.filter((_, idx) => idx !== i) })}
                >
                  🗑
                </button>
              </div>
              <StepListEditor
                steps={flow.steps}
                onChange={(steps) =>
                  onChange({ alternative_flows: value.alternative_flows.map((f, idx) => (idx === i ? { ...f, steps } : f)) })
                }
              />
            </div>
          ))}
          <button
            type="button"
            className={styles.addButton}
            onClick={() =>
              onChange({
                alternative_flows: [
                  ...value.alternative_flows,
                  { flow_id: `alt-${value.alternative_flows.length + 1}`, flow_name: "", trigger_condition: "", steps: [] },
                ],
              })
            }
          >
            + Add Alt Flow
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Postconditions & Success Criteria</h3>
        <div className={styles.sectionBody}>
          <StringListField label="Postconditions" items={value.postconditions} onChange={(postconditions) => onChange({ postconditions })} />
          <StringListField label="Success Criteria" items={value.success_criteria} onChange={(success_criteria) => onChange({ success_criteria })} />
        </div>
      </section>
    </>
  );
}
