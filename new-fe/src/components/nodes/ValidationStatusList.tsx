import styles from "./EditorForms.module.css";

/** Renders a real ValidationResult (doc/api_event_contract.md §5.1) as the colored status rows shown across every node editor wireframe. */
export function ValidationStatusList({ result }: { result: ValidationResult }) {
  return (
    <div className={styles.sectionBody}>
      {result.required_fields.map((field) => (
        <div key={field.field_path}>
          {field.present ? "🟢" : "🔴"} {field.field_name}
          {!field.present && field.required ? <span className={styles.requiredMark}> — required</span> : null}
        </div>
      ))}
      {result.errors.map((err) => (
        <div key={err.field_path + err.error_code} className={styles.acStatusError}>
          🔴 {err.message}
          {err.suggested_fix ? ` — ${err.suggested_fix}` : ""}
        </div>
      ))}
      {result.warnings.map((warn) => (
        <div key={warn.field_path + warn.warning_code}>🟡 {warn.message}</div>
      ))}
      {result.errors.length === 0 && result.warnings.length === 0 && (
        <div className={styles.acStatusOk}>🟢 Completeness {Math.round(result.completeness_score * 100)}%</div>
      )}
    </div>
  );
}
