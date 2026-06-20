import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { projectsApi } from "@/api/endpoints/projects";
import { ApiError } from "@/api/httpClient";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { useToast } from "@/components/common/Toast/ToastContext";
import { useAuthStore } from "@/stores/authStore";
import { usePipelineStore, isOnboardingState } from "@/stores/pipelineStore";
import { ProjectCard } from "./ProjectCard";
import { NewProjectModal } from "./NewProjectModal";
import styles from "./ProjectDashboard.module.css";

export function ProjectDashboard() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
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

  async function handleCreate(req: CreateProjectRequest) {
    try {
      const project = await projectsApi.create(req);
      setShowNewProject(false);
      await openProject(project.project_id);
    } catch (err) {
      pushToast({
        severity: "error",
        title: "Could not create project",
        body: err instanceof ApiError ? err.message : "Unknown error",
      });
    }
  }

  async function openProject(projectId: string) {
    setOpening(projectId);
    try {
      const sessionState = await projectsApi.resume(projectId);
      connect(projectId, sessionState.session_id);
      const destination = isOnboardingState(sessionState.current_state) ? "onboarding" : "workspace";
      navigate(`/projects/${projectId}/${destination}`);
    } catch (err) {
      pushToast({
        severity: "error",
        title: "Could not open project",
        body: err instanceof ApiError ? err.message : "Unknown error",
      });
      setOpening(null);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your projects</h1>
        <div className={styles.headerActions}>
          <span className={styles.userEmail}>{user?.email}</span>
          <Button variant="secondary" onClick={logout}>
            Sign out
          </Button>
          <Button onClick={() => setShowNewProject(true)}>New project</Button>
        </div>
      </header>

      {projects === null && !loadError && (
        <div className={styles.centered}>
          <Spinner />
        </div>
      )}

      {loadError && (
        <EmptyState
          title="Couldn't load projects"
          description={loadError}
          action={<Button onClick={() => void loadProjects()}>Retry</Button>}
        />
      )}

      {projects !== null && projects.length === 0 && !loadError && (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start the pipeline."
          action={<Button onClick={() => setShowNewProject(true)}>New project</Button>}
        />
      )}

      {projects !== null && projects.length > 0 && (
        <div className={styles.grid}>
          {projects.map((project) => (
            <ProjectCard
              key={project.project_id}
              project={project}
              onOpen={() => void openProject(project.project_id)}
            />
          ))}
        </div>
      )}

      {opening && (
        <div className={styles.openingOverlay}>
          <Spinner />
          <span>Resuming session…</span>
        </div>
      )}

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
