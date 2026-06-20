import { useMemo, useState } from "react";
import { Button } from "@/components/common/Button";
import styles from "./HostingOptionsView.module.css";

/**
 * doc/phase-1-wireframe.md §6.2 — Hosting Options Matrix.
 * Bookmark/compare/raw-JSON are local UI state: the contract (api_event_contract.md
 * §6.2, types.d.ts HostingOption) has no bookmark or comparison endpoint for this
 * screen, unlike the steering panels which persist bookmarks via BOOKMARK_TOGGLE.
 */
interface HostingOptionsViewProps {
  matrix: HostingOptionsMatrix;
  scaleInputs: ScaleInputs;
  selecting: boolean;
  onSelectOption: (optionId: string) => void;
}

export function HostingOptionsView({ matrix, scaleInputs, selecting, onSelectOption }: HostingOptionsViewProps) {
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [rawJsonFor, setRawJsonFor] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);

  const recommended = useMemo(
    () => matrix.options.find((o) => o.scale_fit === "optimal") ?? matrix.options[0],
    [matrix.options],
  );

  function toggleBookmark(optionId: string) {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  }

  const bookmarkedOptions = matrix.options.filter((o) => bookmarked.has(o.option_id));
  const compareOptions =
    compareIds &&
    ([
      matrix.options.find((o) => o.option_id === compareIds[0]),
      matrix.options.find((o) => o.option_id === compareIds[1]),
    ] as const);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Hosting Options Matrix</h2>
        <p className={styles.scalePersona}>
          Scale Persona: <strong>{matrix.scale_persona}</strong> ({scaleInputs.expected_total_users.toLocaleString()}{" "}
          users, {scaleInputs.peak_concurrent_users.toLocaleString()} concurrent
          {scaleInputs.monthly_budget_usd ? `, $${scaleInputs.monthly_budget_usd}/mo budget` : ""})
        </p>
      </div>

      <div className={styles.optionsList}>
        {matrix.options.map((opt) => (
          <div key={opt.option_id} className={styles.option}>
            <div className={styles.optionHeader}>
              <span className={styles.optionName}>{opt.option_name}</span>
              {opt === recommended && <span className={styles.recommendedBadge}>Recommended</span>}
              {opt.over_budget && <span className={styles.overBudgetBadge}>Over budget</span>}
            </div>

            <p className={styles.optionDescription}>{opt.architecture_description}</p>

            <div className={styles.components}>
              {opt.components.map((c, i) => (
                <span key={i} className={styles.componentChip}>
                  {c.component_type}: {c.provider} {c.service_name} ({c.tier})
                </span>
              ))}
            </div>

            <div className={styles.cost}>
              <span className={styles.costRange}>
                Low: ${opt.estimated_monthly_cost.low_usd} | Mid: ${opt.estimated_monthly_cost.mid_usd} | High: $
                {opt.estimated_monthly_cost.high_usd}
              </span>
              <p className={styles.costBasis}>Basis: {opt.estimated_monthly_cost.basis}</p>
              {opt.estimated_monthly_cost.assumptions.length > 0 && (
                <p className={styles.costMeta}>Assumptions: {opt.estimated_monthly_cost.assumptions.join(", ")}</p>
              )}
              {opt.estimated_monthly_cost.excludes.length > 0 && (
                <p className={styles.costMeta}>Excludes: {opt.estimated_monthly_cost.excludes.join(", ")}</p>
              )}
            </div>

            <div className={styles.badgeRow}>
              <span className={opt.over_budget ? styles.badgeError : styles.badgeSuccess}>
                {opt.over_budget ? "Over budget" : "Within budget"}
              </span>
              <span
                className={
                  opt.scale_fit === "optimal"
                    ? styles.badgeSuccess
                    : opt.scale_fit === "acceptable"
                      ? styles.badgeWarning
                      : styles.badgeError
                }
              >
                Scale fit: {opt.scale_fit}
              </span>
            </div>

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

            <p className={styles.optionRationale}>{opt.rationale}</p>

            <div className={styles.actions}>
              <Button loading={selecting} onClick={() => onSelectOption(opt.option_id)}>
                Select
              </Button>
              <button className={styles.linkButton} onClick={() => toggleBookmark(opt.option_id)}>
                {bookmarked.has(opt.option_id) ? "★ Bookmarked" : "☆ Bookmark"}
              </button>
              <button
                className={styles.linkButton}
                onClick={() => setRawJsonFor(rawJsonFor === opt.option_id ? null : opt.option_id)}
              >
                View Raw JSON
              </button>
            </div>

            {rawJsonFor === opt.option_id && <pre className={styles.rawJson}>{JSON.stringify(opt, null, 2)}</pre>}
          </div>
        ))}
      </div>

      {bookmarkedOptions.length >= 2 && (
        <div className={styles.compareSection}>
          <div className={styles.compareHeader}>
            <span>Compare:</span>
            <select
              value={compareIds?.[0] ?? ""}
              onChange={(e) => setCompareIds([e.target.value, compareIds?.[1] ?? bookmarkedOptions[1].option_id])}
            >
              {bookmarkedOptions.map((o) => (
                <option key={o.option_id} value={o.option_id}>
                  {o.option_name}
                </option>
              ))}
            </select>
            <span>vs</span>
            <select
              value={compareIds?.[1] ?? ""}
              onChange={(e) => setCompareIds([compareIds?.[0] ?? bookmarkedOptions[0].option_id, e.target.value])}
            >
              {bookmarkedOptions.map((o) => (
                <option key={o.option_id} value={o.option_id}>
                  {o.option_name}
                </option>
              ))}
            </select>
          </div>

          {compareOptions && compareOptions[0] && compareOptions[1] && (
            <table className={styles.compareTable}>
              <tbody>
                <tr>
                  <td>Mid cost</td>
                  <td>${compareOptions[0].estimated_monthly_cost.mid_usd}</td>
                  <td>${compareOptions[1].estimated_monthly_cost.mid_usd}</td>
                </tr>
                <tr>
                  <td>Scale fit</td>
                  <td>{compareOptions[0].scale_fit}</td>
                  <td>{compareOptions[1].scale_fit}</td>
                </tr>
                <tr>
                  <td>Over budget</td>
                  <td>{compareOptions[0].over_budget ? "Yes" : "No"}</td>
                  <td>{compareOptions[1].over_budget ? "Yes" : "No"}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {recommended && (
        <div className={styles.architectNote}>
          <strong>Architect Note:</strong> {recommended.rationale}
        </div>
      )}
    </div>
  );
}
