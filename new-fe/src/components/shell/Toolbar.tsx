import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { layoutApi } from "@/api/endpoints/layout";
import { sessionApi } from "@/api/endpoints/session";
import { ApiError } from "@/api/httpClient";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useIdeLayoutStore } from "@/stores/ideLayoutStore";
import { useCompletenessGateStore } from "@/stores/completenessGateStore";
import { useRbacGateStore } from "@/stores/rbacGateStore";
import { useTechStackGateStore } from "@/stores/techStackGateStore";
import { useDeploymentStore } from "@/stores/deploymentStore";
import { useCheckpointRestoreStore } from "@/stores/checkpointRestoreStore";
import { useToast } from "@/components/common/Toast/ToastContext";
import { Button } from "@/components/common/Button";
import styles from "./Toolbar.module.css";

const TRUST_MODES: TrustMode[] = ["PARANOID", "BALANCED", "AUTO_PILOT"];

interface ToolbarProps {
  projectName: string;
}

export function Toolbar({ projectName }: ToolbarProps) {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const projectId = usePipelineStore((s) => s.projectId);
  const pipelineState = usePipelineStore((s) => s.pipelineState);
  const socketStatus = usePipelineStore((s) => s.socketStatus);
  const trustMode = useIdeLayoutStore((s) => s.trustMode);
  const setTrustMode = useIdeLayoutStore((s) => s.setTrustMode);
  const showGate = useCompletenessGateStore((s) => s.show);
  const showRbacGate = useRbacGateStore((s) => s.show);
  const techStackMatrix = useTechStackGateStore((s) => s.matrix);
  const showTechStackGate = useTechStackGateStore((s) => s.show);
  const showDeploy = useDeploymentStore((s) => s.show);
  const showCheckpoints = useCheckpointRestoreStore((s) => s.show);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [savingExit, setSavingExit] = useState(false);

  async function handleTrustModeChange(mode: TrustMode) {
    setDropdownOpen(false);
    if (!projectId || mode === trustMode) return;
    try {
      const result = await layoutApi.setTrustMode(projectId, {
        new_mode: mode,
        apply_to_future_only: true,
      });
      setTrustMode(result.new_mode);
      if (result.warning) pushToast({ severity: "warning", title: "Trust mode changed", body: result.warning });
    } catch (err) {
      pushToast({
        severity: "error",
        title: "Could not change trust mode",
        body: err instanceof ApiError ? err.message : "Unknown error",
      });
    }
  }

  async function handleSaveAndExit() {
    if (!projectId) return;
    setSavingExit(true);
    try {
      await sessionApi.saveAndExit(projectId);
      navigate("/");
    } catch (err) {
      pushToast({
        severity: "error",
        title: "Could not save & exit",
        body: err instanceof ApiError ? err.message : "Unknown error",
      });
    } finally {
      setSavingExit(false);
    }
  }

  return (
    <header className={styles.toolbar}>
      <div className={styles.left}>
        <span className={styles.connectionDot} data-status={socketStatus} title={`Socket: ${socketStatus}`} />
        <span className={styles.projectName} title={projectName}>
          {projectName}
        </span>
      </div>

      <div className={styles.center}>
        {pipelineState && (
          <span className={styles.stageBadge}>
            Stage {pipelineState.current_stage}: {pipelineState.stage_name}
          </span>
        )}
      </div>

      <div className={styles.right}>
        <Button variant="secondary" onClick={showGate}>
          Completeness
        </Button>
        <Button variant="secondary" onClick={showRbacGate}>
          RBAC
        </Button>
        {techStackMatrix && (
          <Button variant="secondary" onClick={() => showTechStackGate()}>
            Tech Stack
          </Button>
        )}
        <Button variant="secondary" onClick={showDeploy}>
          Deploy
        </Button>
        <Button variant="secondary" onClick={showCheckpoints}>
          Checkpoints
        </Button>
        <Button variant="secondary" loading={savingExit} onClick={handleSaveAndExit}>
          Save & Exit
        </Button>
        <button className={styles.iconButton} title="Settings — not implemented in this pass" disabled>
          ⚙
        </button>
        <div className={styles.trustModeWrapper}>
          <button
            className={`${styles.trustBadge} ${styles[trustMode]}`}
            onClick={() => setDropdownOpen((v) => !v)}
          >
            {trustMode}
          </button>
          {dropdownOpen && (
            <div className={styles.dropdown}>
              {TRUST_MODES.map((mode) => (
                <button key={mode} className={styles.dropdownItem} onClick={() => handleTrustModeChange(mode)}>
                  {mode}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
