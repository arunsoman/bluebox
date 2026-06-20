import { StringListField } from "./StringListField";
import styles from "./EditorForms.module.css";

interface ActorDraft {
  name: string;
  description: string;
  layer: string;
  status: NodeStatus;
  actor_type: Actor["actor_type"];
  icon?: string;
  goals: string[];
  pain_points: string[];
  technical_proficiency: Actor["technical_proficiency"];
  role_name: string;
  permissions: string[];
  data_access_level: Actor["data_access_level"];
}

export type { ActorDraft };

const ACTOR_TYPES: Actor["actor_type"][] = ["Primary", "Secondary", "System", "External"];
const PROFICIENCY: Actor["technical_proficiency"][] = ["Low", "Medium", "High"];
const ACCESS_LEVELS: Actor["data_access_level"][] = ["None", "Own", "Department", "All"];

export function ActorEditorForm({ value, onChange }: { value: ActorDraft; onChange: (patch: Partial<ActorDraft>) => void }) {
  return (
    <>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Basic Info</h3>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <label className={styles.label}>
              Actor Name <span className={styles.requiredMark}>*</span>
            </label>
            <input className={styles.input} value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Type</label>
              <select className={styles.select} value={value.actor_type} onChange={(e) => onChange({ actor_type: e.target.value as Actor["actor_type"] })}>
                {ACTOR_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Layer</label>
              <input className={styles.input} value={value.layer} onChange={(e) => onChange({ layer: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Icon</label>
              <input className={styles.input} value={value.icon ?? ""} onChange={(e) => onChange({ icon: e.target.value })} placeholder="👤" />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Profile & Motivations</h3>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea className={styles.textarea} value={value.description} onChange={(e) => onChange({ description: e.target.value })} />
          </div>
          <StringListField label="Goals (what they want to achieve)" items={value.goals} onChange={(goals) => onChange({ goals })} />
          <StringListField label="Pain Points (current frustrations)" items={value.pain_points} onChange={(pain_points) => onChange({ pain_points })} />
          <div className={styles.field}>
            <label className={styles.label}>Technical Proficiency</label>
            <select
              className={styles.select}
              value={value.technical_proficiency}
              onChange={(e) => onChange({ technical_proficiency: e.target.value as Actor["technical_proficiency"] })}
            >
              {PROFICIENCY.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Permissions & RBAC</h3>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <label className={styles.label}>Role Name</label>
            <input className={styles.input} value={value.role_name} onChange={(e) => onChange({ role_name: e.target.value })} />
          </div>
          <StringListField label="Permissions" items={value.permissions} onChange={(permissions) => onChange({ permissions })} addLabel="+ Add Permission" />
          <div className={styles.field}>
            <label className={styles.label}>Data Access Level</label>
            <select
              className={styles.select}
              value={value.data_access_level}
              onChange={(e) => onChange({ data_access_level: e.target.value as Actor["data_access_level"] })}
            >
              {ACCESS_LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
      </section>
    </>
  );
}
