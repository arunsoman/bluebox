import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { useToast } from "@/components/common/Toast/ToastContext";
import { usePipelineStore } from "@/stores/pipelineStore";
import { socketClient } from "@/ws/socketClient";
import { deployApi } from "@/api/endpoints/deploy";
import { auditApi } from "@/api/endpoints/audit";
import { rbacApi } from "@/api/endpoints/rbac";
import { ApiError } from "@/api/httpClient";
import sharedStyles from "@/components/nodes/EditorForms.module.css";
import styles from "./DeploymentModal.module.css";

const TARGETS: { value: DeployRequest["target"]; label: string }[] = [
  { value: "vercel", label: "Vercel (Production)" },
  { value: "aws_amplify", label: "AWS Amplify" },
  { value: "netlify", label: "Netlify" },
  { value: "kubernetes", label: "Kubernetes" },
];

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** doc/phase-1-wireframe.md §16.1-16.2 — Deployment Configuration + Deployment Complete. */
export function DeploymentModal({ onClose }: { onClose: () => void }) {
  const projectId = usePipelineStore((s) => s.projectId);
  const { pushToast } = useToast();

  const [phase, setPhase] = useState<"config" | "deploying" | "complete">("config");
  const [target, setTarget] = useState<DeployRequest["target"]>("vercel");
  const [envVars, setEnvVars] = useState([{ key: "DATABASE_URL", value: "" }, { key: "JWT_SECRET", value: "" }]);
  const [deploying, setDeploying] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<DeployStatus | null>(null);

  useEffect(() => {
    const unsubscribers = [
      socketClient.on("DEPLOYING", () => setBuildLogs((prev) => [...prev, "[deploy] Building and uploading…"])),
      socketClient.on("DEPLOYED", async () => {
        if (!projectId) return;
        try {
          const result = await deployApi.getStatus(projectId);
          setStatus(result);
          setBuildLogs(result.build_logs);
          setPhase("complete");
        } catch (err) {
          pushToast({ severity: "error", title: "Could not load deploy status", body: err instanceof ApiError ? err.message : "Unknown error" });
        }
      }),
    ];
    return () => unsubscribers.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function updateEnvVar(index: number, field: "key" | "value", value: string) {
    setEnvVars((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  }

  async function deploy() {
    if (!projectId) return;
    setDeploying(true);
    setBuildLogs(["[deploy] Queued…"]);
    setPhase("deploying");
    try {
      await deployApi.start(projectId, {
        target,
        environment_variables: Object.fromEntries(envVars.filter((v) => v.key).map((v) => [v.key, v.value])),
        ssl: true,
      });
    } catch (err) {
      pushToast({ severity: "error", title: "Deploy failed to start", body: err instanceof ApiError ? err.message : "Unknown error" });
      setPhase("config");
    } finally {
      setDeploying(false);
    }
  }

  async function downloadArtifact(type: "ledger" | "rbac" | "audit") {
    if (!projectId) return;
    try {
      if (type === "ledger") downloadJson("decision-ledger.json", await auditApi.getLedger(projectId));
      if (type === "rbac") downloadJson("rbac-model.json", await rbacApi.getModel(projectId));
      if (type === "audit") downloadJson("audit-trail.json", await auditApi.getAuditTrail(projectId));
    } catch (err) {
      pushToast({ severity: "error", title: "Download failed", body: err instanceof ApiError ? err.message : "Unknown error" });
    }
  }

  if (phase === "config") {
    return (
      <Modal title="Stage 10: Deployment Pipeline" onClose={onClose} width={640}>
        <section className={sharedStyles.section}>
          <h3 className={sharedStyles.sectionTitle}>Target Environment</h3>
          <div className={sharedStyles.sectionBody}>
            {TARGETS.map((t) => (
              <label key={t.value} className={sharedStyles.row} style={{ alignItems: "center", gap: 8 }}>
                <input type="radio" checked={target === t.value} onChange={() => setTarget(t.value)} />
                {t.label}
              </label>
            ))}
          </div>
        </section>

        <section className={sharedStyles.section}>
          <h3 className={sharedStyles.sectionTitle}>Environment Variables</h3>
          <div className={sharedStyles.sectionBody}>
            {envVars.map((v, i) => (
              <div key={i} className={sharedStyles.row}>
                <input className={sharedStyles.input} placeholder="KEY" value={v.key} onChange={(e) => updateEnvVar(i, "key", e.target.value)} />
                <input
                  className={sharedStyles.input}
                  placeholder="value"
                  type="password"
                  value={v.value}
                  onChange={(e) => updateEnvVar(i, "value", e.target.value)}
                />
              </div>
            ))}
            <button className={sharedStyles.addButton} onClick={() => setEnvVars((prev) => [...prev, { key: "", value: "" }])}>
              + Add Variable
            </button>
          </div>
        </section>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <Button variant="secondary" onClick={onClose}>
            Back to Preview
          </Button>
          <Button loading={deploying} onClick={deploy}>
            Deploy
          </Button>
        </div>
      </Modal>
    );
  }

  if (phase === "deploying") {
    return (
      <Modal title="Deploying…" onClose={onClose} width={520}>
        <div className={styles.logPane}>
          {buildLogs.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="🎉 Deployment Complete" onClose={onClose} width={520}>
      <div className={styles.completeBody}>
        {status?.url && (
          <p className={styles.url}>
            <a href={status.url} target="_blank" rel="noreferrer">
              {status.url}
            </a>
            <button className={sharedStyles.addButton} onClick={() => navigator.clipboard.writeText(status.url ?? "")}>
              Copy
            </button>
          </p>
        )}
        {status?.qr_code_url && <img src={status.qr_code_url} alt="Deployment QR code" width={160} height={160} />}

        {status && status.health_checks.length > 0 && (
          <section className={sharedStyles.section}>
            <h3 className={sharedStyles.sectionTitle}>Health Checks</h3>
            <div className={sharedStyles.sectionBody}>
              {status.health_checks.map((h, i) => (
                <div key={i}>
                  {h.status === "pass" ? "🟢" : h.status === "fail" ? "🔴" : "🟡"} {h.check_name}
                  {h.response_time_ms !== undefined && ` (${h.response_time_ms}ms)`}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className={sharedStyles.section}>
          <h3 className={sharedStyles.sectionTitle}>Export Artifacts</h3>
          <div className={sharedStyles.sectionBody}>
            <button className={sharedStyles.addButton} onClick={() => downloadArtifact("ledger")}>
              Download Decision Ledger JSON
            </button>
            <button className={sharedStyles.addButton} onClick={() => downloadArtifact("rbac")}>
              Download RBAC Model JSON
            </button>
            <button className={sharedStyles.addButton} onClick={() => downloadArtifact("audit")}>
              Download Audit Trail JSON
            </button>
            <button className={sharedStyles.addButton} disabled title="No workspace export endpoint in the API contract">
              Download Workspace ZIP
            </button>
          </div>
        </section>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
