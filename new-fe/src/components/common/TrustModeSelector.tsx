import styles from "./TrustModeSelector.module.css";

const MODES: { mode: TrustMode; label: string; tooltip: string }[] = [
  {
    mode: "PARANOID",
    label: "PARANOID",
    tooltip:
      "The system will stop at every stage and ask for your confirmation. Recommended when you want full control.",
  },
  {
    mode: "BALANCED",
    label: "BALANCED",
    tooltip:
      "Low-risk items like standard data models are auto-approved. The system asks about APIs, auth, and security decisions.",
  },
  {
    mode: "AUTO_PILOT",
    label: "AUTO_PILOT",
    tooltip:
      "Only critical decisions — schema migrations, RBAC changes, payment logic — trigger a pause. Best for experienced users.",
  },
];

interface TrustModeSelectorProps {
  value: TrustMode;
  onChange: (mode: TrustMode) => void;
}

/** UIUX §4.1.4 — three-segment pill toggle. */
export function TrustModeSelector({ value, onChange }: TrustModeSelectorProps) {
  return (
    <div className={styles.pill} role="radiogroup" aria-label="Trust mode">
      {MODES.map(({ mode, label, tooltip }) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          title={tooltip}
          className={`${styles.segment} ${styles[mode]} ${value === mode ? styles.active : ""}`}
          onClick={() => onChange(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
