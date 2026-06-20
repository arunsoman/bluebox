import { StringListField } from "./StringListField";
import styles from "./EditorForms.module.css";

interface CapabilityDraft {
  name: string;
  description: string;
  layer: string;
  status: NodeStatus;
  priority: MoscowPriority;
  in_scope: string[];
  out_of_scope: string[];
  business_value: string;
  linked_use_case_ids: string[];
}

export type { CapabilityDraft };

const PRIORITIES: MoscowPriority[] = ["Must Have", "Should Have", "Could Have", "Won't Have"];

export function CapabilityEditorForm({
  value,
  onChange,
  availableUseCases,
}: {
  value: CapabilityDraft;
  onChange: (patch: Partial<CapabilityDraft>) => void;
  availableUseCases: GraphNode[];
}) {
  return (
    <>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Basic Info</h3>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <label className={styles.label}>
              Capability Name <span className={styles.requiredMark}>*</span>
            </label>
            <input className={styles.input} value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Layer</label>
              <input className={styles.input} value={value.layer} onChange={(e) => onChange({ layer: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Priority</label>
              <select className={styles.select} value={value.priority} onChange={(e) => onChange({ priority: e.target.value as MoscowPriority })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Scope & Boundaries</h3>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea className={styles.textarea} value={value.description} onChange={(e) => onChange({ description: e.target.value })} />
          </div>
          <StringListField label="In Scope" items={value.in_scope} onChange={(in_scope) => onChange({ in_scope })} />
          <StringListField label="Out of Scope" items={value.out_of_scope} onChange={(out_of_scope) => onChange({ out_of_scope })} />
          <div className={styles.field}>
            <label className={styles.label}>Business Value</label>
            <textarea className={styles.textarea} value={value.business_value} onChange={(e) => onChange({ business_value: e.target.value })} />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Linked Use Cases (downstream)</h3>
        <div className={styles.sectionBody}>
          <div className={styles.chipRow}>
            {value.linked_use_case_ids.map((id) => {
              const node = availableUseCases.find((n) => n.id === id);
              return (
                <span key={id} className={styles.chip}>
                  {node?.name ?? id}
                  <button
                    type="button"
                    aria-label={`Unlink ${id}`}
                    onClick={() => onChange({ linked_use_case_ids: value.linked_use_case_ids.filter((x) => x !== id) })}
                  >
                    {" "}×
                  </button>
                </span>
              );
            })}
          </div>
          <select
            className={styles.select}
            value=""
            onChange={(e) => {
              if (e.target.value) onChange({ linked_use_case_ids: [...value.linked_use_case_ids, e.target.value] });
            }}
          >
            <option value="">+ Link Use Case</option>
            {availableUseCases
              .filter((n) => !value.linked_use_case_ids.includes(n.id))
              .map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
          </select>
        </div>
      </section>
    </>
  );
}
