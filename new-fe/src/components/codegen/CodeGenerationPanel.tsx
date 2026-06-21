import { useEffect, useState } from "react";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useCodeGenStore } from "@/stores/codeGenStore";
import { useToast } from "@/components/common/Toast/ToastContext";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { ApiError } from "@/api/httpClient";
import styles from "./CodeGenerationPanel.module.css";

const STATUS_LABEL: Record<TaskGenerationStatus["status"], string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Unknown error";
}

/**
 * Watches a project's Stage 8 code generation live - NOT a panel named in
 * doc/uiux_specification.agent.final.md (the spec only has an ephemeral
 * per-file "Code Stream Card" in chat, §5.1.2); this is a deliberate
 * extension, same precedent as the log viewer / AI Config popup.
 */
export function CodeGenerationPanel() {
  const projectId = usePipelineStore((s) => s.projectId);
  const tasks = useCodeGenStore((s) => s.tasks);
  const paused = useCodeGenStore((s) => s.paused);
  const loading = useCodeGenStore((s) => s.loading);
  const init = useCodeGenStore((s) => s.init);
  const startAll = useCodeGenStore((s) => s.startAll);
  const pause = useCodeGenStore((s) => s.pause);
  const resume = useCodeGenStore((s) => s.resume);
  const stop = useCodeGenStore((s) => s.stop);
  const runTask = useCodeGenStore((s) => s.runTask);
  const { pushToast } = useToast();
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [jobBusy, setJobBusy] = useState(false);

  useEffect(() => {
    if (projectId) init(projectId);
  }, [projectId, init]);

  const anyRunning = tasks.some((t) => t.status === "running");
  const anyQueued = tasks.some((t) => t.status === "queued");
  const filesCompleted = tasks.reduce((sum, t) => sum + t.files_completed, 0);
  const filesTotal = tasks.reduce((sum, t) => sum + t.files_total, 0);

  async function withJobBusy(action: () => Promise<void>, failTitle: string) {
    setJobBusy(true);
    try {
      await action();
    } catch (err) {
      pushToast({ severity: "error", title: failTitle, body: errorMessage(err) });
    } finally {
      setJobBusy(false);
    }
  }

  async function handleRunTask(taskId: string) {
    setBusyTaskId(taskId);
    try {
      await runTask(taskId);
    } catch (err) {
      pushToast({ severity: "error", title: "Could not run task", body: errorMessage(err) });
    } finally {
      setBusyTaskId(null);
    }
  }

  if (loading) {
    return (
      <div className={styles.panel}>
        <Spinner />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No engineering tasks yet"
        description="Tasks appear here once Stage 6 (Task Decomposition) has committed them."
      />
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.progress}>
          <span className={styles.progressLabel}>
            {filesCompleted}/{filesTotal} files
            {paused && anyQueued ? " — pausing after current task" : ""}
          </span>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: filesTotal > 0 ? `${(filesCompleted / filesTotal) * 100}%` : "0%" }}
            />
          </div>
        </div>
        <div className={styles.controls}>
          {!anyRunning && !anyQueued && (
            <Button
              variant="primary"
              loading={jobBusy}
              onClick={() => withJobBusy(startAll, "Could not start generation")}
            >
              Generate All
            </Button>
          )}
          {(anyRunning || anyQueued) && !paused && (
            <Button
              variant="secondary"
              loading={jobBusy}
              onClick={() => withJobBusy(pause, "Could not pause generation")}
            >
              Pause
            </Button>
          )}
          {(anyRunning || anyQueued) && paused && (
            <Button
              variant="secondary"
              loading={jobBusy}
              onClick={() => withJobBusy(resume, "Could not resume generation")}
            >
              Resume
            </Button>
          )}
          {(anyRunning || anyQueued) && (
            <Button variant="danger" loading={jobBusy} onClick={() => withJobBusy(stop, "Could not stop generation")}>
              Stop
            </Button>
          )}
        </div>
      </div>

      <div className={styles.taskList}>
        {tasks.map((task) => (
          <div key={task.task_id} className={styles.taskRow}>
            <span className={`${styles.statusDot} ${styles[`status-${task.status}`]}`} aria-hidden />
            <div className={styles.taskInfo}>
              <span className={styles.taskId}>{task.task_id}</span>
              <span className={styles.taskMeta}>
                {STATUS_LABEL[task.status]}
                {task.status === "running" && task.current_file ? ` — ${task.current_file}` : ""}
                {task.status !== "queued" ? ` — ${task.files_completed}/${task.files_total} files` : ""}
              </span>
              {task.error && <span className={styles.taskError}>{task.error.message}</span>}
            </div>
            <button
              className={styles.rowAction}
              disabled={task.status === "running" || busyTaskId === task.task_id}
              onClick={() => handleRunTask(task.task_id)}
            >
              {busyTaskId === task.task_id
                ? "Running…"
                : task.status === "completed" || task.status === "failed" || task.status === "cancelled"
                  ? "Rerun"
                  : "Run"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
