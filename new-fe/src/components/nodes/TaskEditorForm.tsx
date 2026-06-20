import { StringListField } from "./StringListField";
import styles from "./EditorForms.module.css";

interface TaskDraft {
  name: string;
  description: string;
  layer: string;
  status: NodeStatus;
  estimated_hours: number | null;
  complexity: EngineeringTask["complexity"] | null;
  preconditions: string[];
  postconditions: string[];
  file_paths: string[];
  tech_stack_requirements: string[];
  database_schema_changes: string;
  access_guards: AccessGuard[];
  parent_story_id: string;
}

export type { TaskDraft };

const HOURS = [1, 2, 4, 8, 16, 24, 40];
const COMPLEXITIES: EngineeringTask["complexity"][] = ["Low", "Medium", "High", "Critical"];
const GUARD_TYPES: AccessGuard["guard_type"][] = ["authorization", "authentication", "input_validation", "rate_limiting"];

export function TaskEditorForm({
  value,
  onChange,
  availableStories,
}: {
  value: TaskDraft;
  onChange: (patch: Partial<TaskDraft>) => void;
  availableStories: GraphNode[];
}) {
  function updateGuard(i: number, patch: Partial<AccessGuard>) {
    onChange({ access_guards: value.access_guards.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) });
  }

  return (
    <>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Basic Info</h3>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <label className={styles.label}>
              Task Name <span className={styles.requiredMark}>*</span>
            </label>
            <textarea className={styles.textarea} value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Layer</label>
              <input className={styles.input} value={value.layer} onChange={(e) => onChange({ layer: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Parent Story</label>
              <select className={styles.select} value={value.parent_story_id} onChange={(e) => onChange({ parent_story_id: e.target.value })}>
                <option value="">Select a story…</option>
                {availableStories.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Estimated Hours</label>
              <select
                className={styles.select}
                value={value.estimated_hours ?? ""}
                onChange={(e) => onChange({ estimated_hours: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Not set</option>
                {HOURS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              {value.estimated_hours == null && <span className={styles.acStatusError}>🔴 Required for sprint planning</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Complexity</label>
              <select
                className={styles.select}
                value={value.complexity ?? ""}
                onChange={(e) => onChange({ complexity: (e.target.value || null) as EngineeringTask["complexity"] | null })}
              >
                <option value="">Not set</option>
                {COMPLEXITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Pre & Post Conditions <span className={styles.requiredMark}>*</span>
        </h3>
        <div className={styles.sectionBody}>
          <StringListField label="Preconditions" items={value.preconditions} onChange={(preconditions) => onChange({ preconditions })} addLabel="+ Add Precondition" />
          <StringListField label="Postconditions" items={value.postconditions} onChange={(postconditions) => onChange({ postconditions })} addLabel="+ Add Postcondition" />
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Implementation Details</h3>
        <div className={styles.sectionBody}>
          <StringListField label="File Paths" items={value.file_paths} onChange={(file_paths) => onChange({ file_paths })} addLabel="+ Add Path" />
          <StringListField
            label="Tech Stack Requirements"
            items={value.tech_stack_requirements}
            onChange={(tech_stack_requirements) => onChange({ tech_stack_requirements })}
          />
          <div className={styles.field}>
            <label className={styles.label}>Database Schema Changes</label>
            <textarea
              className={styles.textarea}
              style={{ fontFamily: "var(--font-mono)" }}
              value={value.database_schema_changes}
              onChange={(e) => onChange({ database_schema_changes: e.target.value })}
              placeholder="ALTER TABLE …"
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Access Guards (Security)</h3>
        <div className={styles.sectionBody}>
          {value.access_guards.map((guard, i) => (
            <div key={i} className={styles.acCard}>
              <select className={styles.select} value={guard.guard_type} onChange={(e) => updateGuard(i, { guard_type: e.target.value as AccessGuard["guard_type"] })}>
                {GUARD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input className={styles.input} value={guard.description} onChange={(e) => updateGuard(i, { description: e.target.value })} placeholder="Description" />
              <button type="button" onClick={() => onChange({ access_guards: value.access_guards.filter((_, idx) => idx !== i) })}>
                🗑 Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.addButton}
            onClick={() => onChange({ access_guards: [...value.access_guards, { guard_type: "authorization", description: "" }] })}
          >
            + Add Guard
          </button>
          <div className={value.access_guards.length > 0 ? styles.acStatusOk : undefined}>
            {value.access_guards.length > 0 ? "🟢" : "⚪"} {value.access_guards.length} access guard(s) defined
          </div>
        </div>
      </section>
    </>
  );
}
