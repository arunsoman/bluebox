import { useState } from "react";
import { Button } from "@/components/common/Button";
import styles from "./SeedBuilderView.module.css";

interface SeedBuilderViewProps {
  dialogue: SeedBuilderDialogue;
  onSubmitStep: (stepId: string, fieldValues: Record<string, unknown>, navigation: "next" | "back" | "submit") => void;
  submitting: boolean;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: SeedField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.field_type === "boolean") {
    return (
      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {field.field_name}
      </label>
    );
  }
  if (field.field_type === "select") {
    return (
      <select className={styles.input} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={field.field_type === "number" ? "number" : "text"}
      className={styles.input}
      value={String(value ?? "")}
      onChange={(e) => onChange(field.field_type === "number" ? Number(e.target.value) : e.target.value)}
    />
  );
}

export function SeedBuilderView({ dialogue, onSubmitStep, submitting }: SeedBuilderViewProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>({});

  const maybeStep = dialogue.steps[stepIndex];
  if (!maybeStep) return null;
  // Re-bound so nested closures below see a definitely-defined value.
  const step: SeedStep = maybeStep;
  const isLast = stepIndex === dialogue.steps.length - 1;
  const progressPercent = ((stepIndex + 1) / dialogue.steps.length) * 100;

  function handleBack() {
    if (stepIndex === 0) return;
    onSubmitStep(step.step_id, values, "back");
    setStepIndex(stepIndex - 1);
  }

  function handleNext() {
    const navigation = isLast ? "submit" : "next";
    onSubmitStep(step.step_id, values, navigation);
    if (!isLast) setStepIndex(stepIndex + 1);
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>
        <p className={styles.stepLabel}>
          Step {step.step_number} of {step.total_steps} — {step.step_name}
        </p>
        <p className={styles.description}>{step.description}</p>

        <div className={styles.fields}>
          {step.fields.map((field) => (
            <div key={field.field_id} className={styles.fieldRow}>
              {field.field_type !== "boolean" && <label className={styles.label}>{field.field_name}</label>}
              <FieldInput
                field={field}
                value={values[field.field_id]}
                onChange={(v) => setValues((prev) => ({ ...prev, [field.field_id]: v }))}
              />
            </div>
          ))}
        </div>

        <div className={styles.navRow}>
          <Button variant="secondary" disabled={stepIndex === 0} onClick={handleBack}>
            ← Back
          </Button>
          <Button loading={submitting} onClick={handleNext}>
            {isLast ? "Run Pipeline" : "Next →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
