import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { projectsApi } from "@/api/endpoints/projects";
import { ApiError } from "@/api/httpClient";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { useToast } from "@/components/common/Toast/ToastContext";
import { usePipelineStore } from "@/stores/pipelineStore";
import { ProjectCard } from "./ProjectCard";
import { NewProjectModal } from "./NewProjectModal";
import styles from "./ProjectsPanel.module.css";

export function ProjectsPanel() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const connect = usePipelineStore((s) => s.connect);

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await projectsApi.list({ status: "active", sort_by: "last_active" });
      setProjects(list.projects);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load projects.");
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  async function openProject(projectId: string) {
    setOpening(projectId);
    try {
      const sessionState = await projectsApi.resume(projectId);
      connect(projectId, sessionState.session_id);
      navigate(`/workspace/${projectId}`);
    } catch (err) {
      pushToast({ severity: "error", title: "RESUME FAILED", body: err instanceof ApiError ? err.message : "Unknown error" });
      setOpening(null);
    }
  }

  async function handleCreate(req: CreateProjectRequest) {
    try {
      const project = await projectsApi.create(req);
      setShowNewProject(false);
      await openProject(project.project_id);
    } catch (err) {
      pushToast({ severity: "error", title: "CREATE FAILED", body: err instanceof ApiError ? err.message : "Unknown error" });
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <span className={styles.count}>{projects?.length ?? 0} sessions found</span>
        <button className={styles.newBtn} onClick={() => setShowNewProject(true)}>
          + new
        </button>
      </div>

      <div className={styles.main}>
        {projects === null && !loadError && (
          <div className={styles.centered}>
            <Spinner />
            <span className={styles.loadingText}>loading sessions...</span>
          </div>
        )}

        {loadError && (
          <EmptyState title="LOAD_ERROR" description={loadError} action={<Button onClick={() => void loadProjects()}>RETRY</Button>} />
        )}

        {projects !== null && projects.length === 0 && !loadError && (
          <EmptyState
            title="NO_PROJECTS"
            description="Initialize a new pipeline to begin."
            action={<Button onClick={() => setShowNewProject(true)}>NEW PROJECT</Button>}
          />
        )}

        {projects !== null && projects.length > 0 && (
          <div className={styles.grid}>
            {projects.map((project, i) => (
              <ProjectCard key={project.project_id} project={project} onOpen={() => void openProject(project.project_id)} index={i} />
            ))}
          </div>
        )}
      </div>

      {opening && (
        <div className={styles.openingOverlay}>
          <div className={styles.openingBox}>
            <Spinner />
            <span className={styles.openingText}>resuming session {opening.slice(0, 8)}...</span>
          </div>
        </div>
      )}

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} onCreate={handleCreate} />}
    </div>
  );
}
