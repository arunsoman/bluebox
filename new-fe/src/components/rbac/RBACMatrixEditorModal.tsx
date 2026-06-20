import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/common/Toast/ToastContext";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useAuthStore } from "@/stores/authStore";
import { rbacApi } from "@/api/endpoints/rbac";
import { ApiError } from "@/api/httpClient";
import styles from "@/components/nodes/EditorForms.module.css";
import rbacStyles from "./RBACMatrixEditorModal.module.css";

/**
 * doc/phase-1-wireframe.md §7.2 — RBAC Matrix Editor.
 * "Add Guard" on an escalation path has no corresponding RBACChange
 * change_type in the contract (api_event_contract.md §6.1 / types.d.ts
 * RBACChange only supports add_role/remove_role/add_permission/grant/
 * revoke/set_inheritance) — rendered disabled rather than wired to a
 * guessed mutation, consistent with new-fe's no-guessed-endpoints rule.
 */
export function RBACMatrixEditorModal({ onClose }: { onClose: () => void }) {
  const projectId = usePipelineStore((s) => s.projectId);
  const isAdmin = useAuthStore((s) => s.user?.permissions.includes("pipeline_admin") ?? false);
  const { pushToast } = useToast();

  const [model, setModel] = useState<RBACModel | null>(null);
  const [validation, setValidation] = useState<RBACValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [confirmOverride, setConfirmOverride] = useState(false);
  const [overrideText, setOverrideText] = useState("");

  async function load() {
    if (!projectId) return;
    setLoading(true);
    try {
      const result = await rbacApi.getModel(projectId);
      setModel(result);
    } catch (err) {
      pushToast({ severity: "error", title: "Could not load RBAC model", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function runValidate() {
    if (!projectId) return;
    setValidating(true);
    try {
      const result = await rbacApi.validate(projectId);
      setValidation(result);
    } catch (err) {
      pushToast({ severity: "error", title: "Validation failed", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setValidating(false);
    }
  }

  async function removeInheritance(roleId: string) {
    if (!projectId || !model) return;
    try {
      const updated = await rbacApi.updateModel(projectId, {
        version: model.version,
        changes: [{ change_type: "set_inheritance", target_id: roleId, new_value: null }],
      });
      setModel(updated);
      await runValidate();
      pushToast({ severity: "success", title: "Inheritance removed" });
    } catch (err) {
      pushToast({ severity: "error", title: "Could not update inheritance", body: err instanceof ApiError ? err.message : "Unknown error" });
    }
  }

  async function commit(force: boolean) {
    if (!projectId) return;
    const rationale = force ? overrideText : "Committed from RBAC Matrix Editor";
    setCommitting(true);
    try {
      const result = await rbacApi.commit(projectId, { force, rationale });
      pushToast({
        severity: "success",
        title: `RBAC model committed (v${result.committed_version})`,
        body: `Generated: ${result.generated_middleware_files.join(", ")}`,
      });
      setConfirmOverride(false);
      onClose();
    } catch (err) {
      pushToast({ severity: "error", title: "Commit failed", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setCommitting(false);
    }
  }

  if (loading || !model) {
    return (
      <Modal title="RBAC Matrix Editor" onClose={onClose} width={840}>
        <Spinner />
      </Modal>
    );
  }

  const roleName = (roleId: string) => model.roles.find((r) => r.role_id === roleId)?.role_name ?? roleId;
  const permission = (permissionId: string) => model.permissions.find((p) => p.permission_id === permissionId);

  const cycles = validation?.inheritance_cycles ?? model.inheritance_graph.cycles;
  const escalations = validation?.privilege_escalations ?? [];
  const hasBlockingIssues = cycles.length > 0 || escalations.length > 0;

  return (
    <Modal title={`RBAC Matrix Editor — v${model.version}`} onClose={onClose} width={840}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Role Inheritance Graph</h3>
        <div className={styles.sectionBody}>
          <div className={rbacStyles.inheritanceChain}>
            {model.inheritance_graph.nodes
              .slice()
              .sort((a, b) => a.depth - b.depth)
              .map((n, i) => (
                <span key={n.role_id} className={rbacStyles.chainItem}>
                  {i > 0 && <span className={rbacStyles.chainArrow}>→</span>}
                  {roleName(n.role_id)}
                </span>
              ))}
          </div>
          <div className={rbacStyles.depthRow}>
            Depth: {model.inheritance_graph.max_depth}
            {cycles.length === 0 ? (
              <span className={rbacStyles.badgeSuccess}>No cycles detected</span>
            ) : (
              <span className={rbacStyles.badgeError}>{cycles.length} cycle(s) detected</span>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Permission Matrix</h3>
        <div className={styles.sectionBody}>
          <table className={rbacStyles.table}>
            <thead>
              <tr>
                <th>Role</th>
                <th>Resource</th>
                <th>Action</th>
                <th>Granted</th>
                <th>Rationale</th>
                <th>Decision Maker</th>
              </tr>
            </thead>
            <tbody>
              {model.role_permissions.map((rp) => {
                const perm = permission(rp.permission_id);
                return (
                  <tr key={rp.entry_id}>
                    <td>{roleName(rp.role_id)}</td>
                    <td>{perm?.resource ?? rp.permission_id}</td>
                    <td>{perm?.action ?? "—"}</td>
                    <td>{rp.granted ? "✓" : "✗"}</td>
                    <td>{rp.rationale}</td>
                    <td>{rp.decision_maker}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Data Access Matrix</h3>
        <div className={styles.sectionBody}>
          <table className={rbacStyles.table}>
            <thead>
              <tr>
                <th>Role</th>
                <th>Entity</th>
                <th>Access</th>
                <th>Rationale</th>
                <th>Guard</th>
              </tr>
            </thead>
            <tbody>
              {model.data_access_matrix.map((d, i) => (
                <tr key={i}>
                  <td>{roleName(d.role_id)}</td>
                  <td>{d.entity}</td>
                  <td>{d.access_level}</td>
                  <td>{d.rationale}</td>
                  <td>{d.guard ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Validation</h3>
        <div className={styles.sectionBody}>
          <div className={rbacStyles.actions}>
            <Button variant="secondary" loading={validating} onClick={runValidate}>
              Validate
            </Button>
            <button className={styles.addButton} onClick={() => setShowRawJson((v) => !v)}>
              Export JSON
            </button>
          </div>

          {validation && (
            <>
              <div>
                {cycles.length === 0 ? "🟢" : "🔴"} {cycles.length} cycles, {escalations.length === 0 ? "🟢" : "🔴"}{" "}
                {escalations.length} escalations, {validation.missing_rationales.length === 0 ? "🟢" : "🟡"}{" "}
                {validation.missing_rationales.length} missing rationales
              </div>

              {escalations.map((esc, i) => (
                <div key={i} className={styles.acCard}>
                  <div className={styles.acStatusError}>
                    🔴 PRIVILEGE ESCALATION: {esc.path.map(roleName).join(" → ")} ({esc.resulting_access}, depth {esc.depth})
                  </div>
                  <div className={styles.acActions}>
                    <button type="button" onClick={() => removeInheritance(esc.path[esc.path.length - 1])}>
                      Remove Inheritance
                    </button>
                    <button type="button" disabled title="Not modeled in the API contract — no guard mutation for role_permissions">
                      Add Guard
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {showRawJson && <pre className={rbacStyles.rawJson}>{JSON.stringify(model, null, 2)}</pre>}
        </div>
      </section>

      <div className={rbacStyles.footer}>
        {hasBlockingIssues && <span className={rbacStyles.badgeError}>Commit blocked until escalations/cycles resolved.</span>}
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {hasBlockingIssues ? (
          <Button variant="danger" disabled={!isAdmin} title={isAdmin ? undefined : "Requires pipeline_admin role"} onClick={() => setConfirmOverride(true)}>
            Override & Commit →
          </Button>
        ) : (
          <Button loading={committing} onClick={() => commit(false)}>
            Commit
          </Button>
        )}
      </div>

      {confirmOverride && (
        <Modal title="Override RBAC Validation" onClose={() => setConfirmOverride(false)} width={420}>
          <p>{escalations.length} escalation(s) and {cycles.length} cycle(s) will be committed unresolved. Provide a rationale.</p>
          <div className={styles.field}>
            <label className={styles.label}>Rationale</label>
            <input className={styles.input} value={overrideText} onChange={(e) => setOverrideText(e.target.value)} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Button variant="secondary" onClick={() => setConfirmOverride(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!overrideText} loading={committing} onClick={() => commit(true)}>
              Confirm Override
            </Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
