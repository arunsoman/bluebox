import styles from "./EditorForms.module.css";

interface StringListFieldProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}

/** Reusable add/remove/reorder editor for the many string-array fields across node editors (goals, preconditions, in_scope, etc.). */
export function StringListField({ label, items, onChange, placeholder, addLabel = "+ Add" }: StringListFieldProps) {
  function update(index: number, value: string) {
    onChange(items.map((item, i) => (i === index ? value : item)));
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved as string);
    onChange(next);
  }

  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <ul className={styles.stringList}>
        {items.map((item, i) => (
          <li key={i} className={styles.stringListRow}>
            <input
              className={styles.stringListInput}
              value={item}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
            />
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
            <button type="button" aria-label="Remove" onClick={() => remove(i)}>
              🗑
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={styles.addButton} onClick={() => onChange([...items, ""])}>
        {addLabel}
      </button>
    </div>
  );
}
